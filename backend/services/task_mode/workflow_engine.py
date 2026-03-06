"""
Task Mode — Workflow Engine
Orchestrates sequential agent execution for task workflows.
Runs each role step in order, passing output to the next step.
"""

import logging
import time
from typing import Optional

from services.ai_council.agents import AgentManager
from services.task_mode.task_router import get_task_config
from services.task_mode.agent_executor import execute_step
from services.task_mode.final_synthesizer import synthesize_final

logger = logging.getLogger("task_mode")


class TaskWorkflowEngine:
    """
    Runs a complete task workflow:
      Task Prompt → Role 1 → Role 2 → Role 3 → Final Synthesizer → Result
    """

    def __init__(self, task_type: str, agents: dict[str, str]):
        """
        Args:
            task_type: Key from TASK_TYPES (e.g. "coding", "research")
            agents: Mapping of role_key -> agent_key (e.g. {"coder": "gpt", "reviewer": "claude"})
        """
        self.task_type = task_type
        self.agent_assignments = agents
        self.config = get_task_config(task_type)
        self.manager = AgentManager()  # All available agents

    async def run(self, task_prompt: str) -> dict:
        """
        Execute the full workflow pipeline and return results.

        Returns:
            {
                "final_answer": str,
                "synthesized_by": str,
                "task_type": str,
                "workflow_chat": [
                    {
                        "role_key": str,
                        "role_label": str,
                        "agent": str,
                        "agent_name": str,
                        "message": str,
                        "response_time": float,
                        "tokens": int,
                        "error": str | None,
                    },
                    ...
                ],
                "response_time_seconds": float,
            }
        """
        if not self.config:
            return {
                "final_answer": f"Unknown task type: {self.task_type}",
                "synthesized_by": "system",
                "task_type": self.task_type,
                "workflow_chat": [],
                "response_time_seconds": 0,
            }

        t0 = time.time()
        workflow_chat: list[dict] = []
        previous_output = ""

        # ── Sequential execution of each role step ───────────────────
        for role in self.config.roles:
            agent_key = self.agent_assignments.get(role.key, self.manager.keys()[0])

            # Build prompt with task_prompt and previous step output
            prompt = role.prompt_template.format(
                task_prompt=task_prompt,
                previous_output=previous_output or "(No previous output — this is the first step)",
            )

            logger.info(
                "Task workflow [%s] step '%s' → agent '%s'",
                self.task_type,
                role.key,
                agent_key,
            )

            result = await execute_step(
                manager=self.manager,
                agent_key=agent_key,
                role_key=role.key,
                role_label=role.label,
                prompt=prompt,
            )

            step_data = {
                "role_key": result.role_key,
                "role_label": result.role_label,
                "agent": result.agent,
                "agent_name": result.agent_name,
                "message": result.content if not result.error else f"[Error: {result.error}]",
                "response_time": result.response_time,
                "tokens": result.tokens,
                "error": result.error,
            }
            workflow_chat.append(step_data)

            # Pass output to next step (skip if error)
            if not result.error and result.content.strip():
                previous_output = result.content

        # ── Final synthesis ───────────────────────────────────────────
        valid_steps = [s for s in workflow_chat if not s.get("error")]

        if not valid_steps:
            return {
                "final_answer": "All workflow agents failed. Please try again.",
                "synthesized_by": "system",
                "task_type": self.task_type,
                "workflow_chat": workflow_chat,
                "response_time_seconds": round(time.time() - t0, 2),
            }

        # If only one step succeeded, use it directly
        if len(valid_steps) == 1:
            return {
                "final_answer": valid_steps[0]["message"],
                "synthesized_by": valid_steps[0]["agent"],
                "task_type": self.task_type,
                "workflow_chat": workflow_chat,
                "response_time_seconds": round(time.time() - t0, 2),
            }

        # Synthesize from all steps
        synth = await synthesize_final(
            manager=self.manager,
            task_prompt=task_prompt,
            task_type=self.task_type,
            workflow_outputs=valid_steps,
        )

        return {
            "final_answer": synth["content"],
            "synthesized_by": synth["agent"],
            "task_type": self.task_type,
            "workflow_chat": workflow_chat,
            "response_time_seconds": round(time.time() - t0, 2),
        }
