"""
Task Mode — Iterative Workflow Engine
Orchestrates the full iterative task workflow with review loops and QC validation.
Yields SSE events as an AsyncGenerator for real-time streaming.

Workflow:
  Developer ↔ Reviewer loop (max N iterations)
  → Developer ↔ QC loop (max N iterations)
  → Final Synthesis
  → Done
"""

import json
import logging
import time
from typing import AsyncGenerator

from services.ai_council.agents import AgentManager
from services.task_mode.task_router import get_task_config, TASK_TYPES
from services.task_mode.review_loop_manager import ReviewLoopManager
from services.task_mode.qc_validator import QCValidator
from services.task_mode.final_synthesizer import synthesize_final, stream_synthesize_final

logger = logging.getLogger("task_mode")


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, default=str)}\n\n"


class IterativeWorkflowEngine:
    """
    Iterative task workflow with review loops and QC validation.
    Yields SSE events as an AsyncGenerator[str, None].

    Phases:
      1. Developer ↔ Reviewer loop (up to max_review_iterations)
      2. QC validation loop (up to max_qc_iterations)
      3. Final Synthesis
    """

    def __init__(
        self,
        task_type: str,
        agents: dict[str, str],
        max_review_iterations: int = 3,
        max_qc_iterations: int = 3,
    ):
        self.task_type = task_type
        self.agent_assignments = agents
        self.config = get_task_config(task_type)
        self.manager = AgentManager()
        self.max_review_iterations = max_review_iterations
        self.max_qc_iterations = max_qc_iterations

    async def run_workflow(self, task_prompt: str) -> AsyncGenerator[str, None]:
        """Run the full iterative workflow, yielding SSE events throughout."""

        if not self.config:
            yield _sse({
                "type": "error",
                "message": f"Unknown task type: {self.task_type}",
            })
            yield _sse({
                "type": "done",
                "total_time": 0,
                "total_tokens": 0,
                "task_type": self.task_type,
            })
            return

        t0 = time.time()
        roles = self.config.roles

        # Map roles: [0]=Developer, [1]=Reviewer, [2]=QC
        dev_role = roles[0]
        reviewer_role = roles[1]
        qc_role = roles[2]

        dev_agent = self.agent_assignments.get(dev_role.key, self.manager.keys()[0])
        reviewer_agent = self.agent_assignments.get(reviewer_role.key, self.manager.keys()[0])
        qc_agent = self.agent_assignments.get(qc_role.key, self.manager.keys()[0])

        # ── Emit workflow_start ──────────────────────────────────────────
        yield _sse({
            "type": "workflow_start",
            "task_type": self.task_type,
            "task_label": self.config.label,
            "task_prompt": task_prompt,
            "roles": [
                {
                    "key": r.key,
                    "label": r.label,
                    "description": r.description,
                    "agent": self.agent_assignments.get(r.key, self.manager.keys()[0]),
                }
                for r in roles
            ],
        })

        # ── Phase 1: Developer ↔ Reviewer Loop ──────────────────────────
        logger.info(
            "Task workflow [%s] Phase 1: Developer ↔ Reviewer loop",
            self.task_type,
        )

        review_loop = ReviewLoopManager(
            manager=self.manager,
            task_prompt=task_prompt,
            developer_agent=dev_agent,
            reviewer_agent=reviewer_agent,
            developer_role_key=dev_role.key,
            developer_role_label=dev_role.label,
            reviewer_role_key=reviewer_role.key,
            reviewer_role_label=reviewer_role.label,
            developer_prompt_template=dev_role.prompt_template,
            reviewer_prompt_template=reviewer_role.prompt_template,
            max_iterations=self.max_review_iterations,
        )

        async for event in review_loop.run():
            yield event

        # ── Phase 2: QC Validation Loop ──────────────────────────────────
        logger.info(
            "Task workflow [%s] Phase 2: QC validation (input: %d chars)",
            self.task_type,
            len(review_loop.final_output),
        )

        qc_validator = QCValidator(
            manager=self.manager,
            task_prompt=task_prompt,
            current_output=review_loop.final_output,
            developer_agent=dev_agent,
            qc_agent=qc_agent,
            developer_role_key=dev_role.key,
            developer_role_label=dev_role.label,
            qc_role_key=qc_role.key,
            qc_role_label=qc_role.label,
            qc_prompt_template=qc_role.prompt_template,
            max_iterations=self.max_qc_iterations,
        )

        async for event in qc_validator.run():
            yield event

        # ── Phase 3: Final Synthesis ─────────────────────────────────────
        logger.info(
            "Task workflow [%s] Phase 3: Final synthesis",
            self.task_type,
        )

        # Collect all steps for synthesis context
        all_steps = review_loop.steps + qc_validator.steps
        valid_steps = [
            {
                "role_label": s["step_label"],
                "agent_name": s.get("agent_name", s.get("agent", "Unknown")),
                "agent": s.get("agent", "unknown"),
                "content": s.get("content", ""),
                "error": s.get("error"),
            }
            for s in all_steps
            if s.get("content") and not s.get("error")
        ]

        yield _sse({
            "type": "step_start",
            "step": "final_synthesis",
            "step_label": "Final Synthesis",
            "agent": dev_agent,
            "iteration": 1,
        })

        synth: dict | None = None
        if valid_steps:
            async for item in stream_synthesize_final(
                manager=self.manager,
                task_prompt=task_prompt,
                task_type=self.task_type,
                workflow_outputs=valid_steps,
            ):
                if isinstance(item, str):
                    yield _sse({
                        "type": "step_token",
                        "step": "final_synthesis",
                        "agent": dev_agent,
                        "content": item,
                        "iteration": 1,
                    })
                elif isinstance(item, dict):
                    synth = item
        else:
            synth = {
                "content": qc_validator.final_output or review_loop.final_output or "Workflow produced no output.",
                "agent": dev_agent,
                "agent_name": dev_agent.upper(),
                "response_time": 0,
                "tokens": 0,
            }

        if synth is None:
            synth = {
                "content": qc_validator.final_output or review_loop.final_output or "Workflow produced no output.",
                "agent": dev_agent,
                "agent_name": dev_agent.upper(),
                "response_time": 0,
                "tokens": 0,
            }

        yield _sse({
            "type": "final_result",
            "content": synth["content"],
            "agent": synth["agent"],
            "agent_name": synth.get("agent_name", synth["agent"]),
            "response_time": synth.get("response_time", 0),
            "tokens": synth.get("tokens", 0),
        })

        # ── Done ─────────────────────────────────────────────────────────
        total_time = round(time.time() - t0, 2)
        total_tokens = (
            review_loop.total_tokens
            + qc_validator.total_tokens
            + synth.get("tokens", 0)
        )

        yield _sse({
            "type": "done",
            "total_time": total_time,
            "total_tokens": total_tokens,
            "task_type": self.task_type,
            "steps_count": len(all_steps),
        })
