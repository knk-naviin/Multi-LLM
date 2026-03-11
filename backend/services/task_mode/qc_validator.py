"""
Task Mode — QC Validator
Quality Control validation stage. After reviewer approves, QC agent checks for
edge cases, performance, security, and best practices. If QC fails, loops back
to Developer for revision.
"""

import json
import logging
import re
from typing import AsyncGenerator

from services.ai_council.agents import AgentManager
from services.task_mode.agent_executor import execute_step, stream_step, StepResult

logger = logging.getLogger("task_mode")

MAX_QC_ITERATIONS = 3


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, default=str)}\n\n"


def _parse_qc_verdict(content: str) -> tuple[bool, str]:
    """
    Parse QC output for structured verdict.
    Returns (passed, feedback_text).
    """
    verdict_match = re.search(
        r"VERDICT:\s*(PASS|FAIL|NEEDS_REVISION|NEEDS_FIX|REJECT)",
        content,
        re.IGNORECASE,
    )
    if verdict_match:
        verdict = verdict_match.group(1).upper()
        return verdict == "PASS", content
    # Default: if no verdict marker found, assume PASS
    return True, content


class QCValidator:
    """
    QC validation stage with Developer revision loop.
    If QC fails → Developer revises → QC re-checks. Max N iterations.
    Yields SSE events and tracks final_output.
    """

    def __init__(
        self,
        manager: AgentManager,
        task_prompt: str,
        current_output: str,
        developer_agent: str,
        qc_agent: str,
        developer_role_key: str,
        developer_role_label: str,
        qc_role_key: str,
        qc_role_label: str,
        qc_prompt_template: str,
        max_iterations: int = MAX_QC_ITERATIONS,
    ):
        self.manager = manager
        self.task_prompt = task_prompt
        self.current_output = current_output
        self.developer_agent = developer_agent
        self.qc_agent = qc_agent
        self.developer_role_key = developer_role_key
        self.developer_role_label = developer_role_label
        self.qc_role_key = qc_role_key
        self.qc_role_label = qc_role_label
        self.qc_prompt_template = qc_prompt_template
        self.max_iterations = max_iterations

        # Tracked output for synthesis phase
        self.final_output: str = current_output
        self.total_tokens: int = 0
        self.total_time: float = 0
        self.steps: list[dict] = []

    async def run(self) -> AsyncGenerator[str, None]:
        """
        Run QC validation. If QC fails, loop back to developer.
        Yields SSE events for real-time UI updates.
        """
        output = self.current_output

        for iteration in range(1, self.max_iterations + 1):
            # ── QC Step ──────────────────────────────────────────────────
            qc_prompt = self.qc_prompt_template.format(
                task_prompt=self.task_prompt,
                previous_output=output,
            )
            # Append structured verdict instruction
            qc_prompt += (
                "\n\nIMPORTANT: You MUST end your review with a verdict line in this EXACT format:\n"
                "VERDICT: PASS (if all quality checks pass and the work is production-ready)\n"
                "or\n"
                "VERDICT: FAIL (if critical issues are found that must be fixed)\n\n"
                "List specific issues that need to be fixed if the verdict is FAIL."
            )

            yield _sse({
                "type": "step_start",
                "step": self.qc_role_key,
                "step_label": self.qc_role_label,
                "agent": self.qc_agent,
                "iteration": iteration,
            })

            qc_result: StepResult | None = None
            async for item in stream_step(
                manager=self.manager,
                agent_key=self.qc_agent,
                role_key=self.qc_role_key,
                role_label=self.qc_role_label,
                prompt=qc_prompt,
            ):
                if isinstance(item, str):
                    yield _sse({
                        "type": "step_token",
                        "step": self.qc_role_key,
                        "agent": self.qc_agent,
                        "content": item,
                        "iteration": iteration,
                    })
                elif isinstance(item, StepResult):
                    qc_result = item

            if qc_result is None:
                self.final_output = output
                return

            yield _sse({
                "type": "step_complete",
                "step": self.qc_role_key,
                "step_label": self.qc_role_label,
                "agent": qc_result.agent,
                "agent_name": qc_result.agent_name,
                "content": qc_result.content,
                "response_time": qc_result.response_time,
                "tokens": qc_result.tokens,
                "error": qc_result.error,
                "iteration": iteration,
            })

            self.total_tokens += qc_result.tokens
            self.total_time += qc_result.response_time
            self.steps.append({
                "step": self.qc_role_key,
                "step_label": self.qc_role_label,
                "agent": qc_result.agent,
                "agent_name": qc_result.agent_name,
                "content": qc_result.content,
                "response_time": qc_result.response_time,
                "tokens": qc_result.tokens,
                "error": qc_result.error,
                "iteration": iteration,
            })

            if qc_result.error:
                self.final_output = output
                return

            passed, qc_feedback = _parse_qc_verdict(qc_result.content)

            if passed:
                yield _sse({
                    "type": "qc_passed",
                    "step": self.qc_role_key,
                    "iteration": iteration,
                    "message": "QC validation passed. All checks cleared.",
                })
                self.final_output = output
                return

            # QC failed — need revision
            yield _sse({
                "type": "qc_feedback",
                "step": self.qc_role_key,
                "iteration": iteration,
                "feedback": qc_feedback[:500],
                "message": f"QC failed — sending back for revision (attempt {iteration}/{self.max_iterations})",
            })

            # If max iterations reached, proceed anyway
            if iteration == self.max_iterations:
                yield _sse({
                    "type": "qc_passed",
                    "step": self.qc_role_key,
                    "iteration": iteration,
                    "message": f"Max QC iterations ({self.max_iterations}) reached. Proceeding with latest output.",
                })
                self.final_output = output
                return

            # ── Developer Revision Step ──────────────────────────────────
            revision_prompt = (
                f"QC validation found critical issues. Revise your work to fix all problems.\n\n"
                f"Original Task: {self.task_prompt}\n\n"
                f"Current output:\n{output}\n\n"
                f"QC feedback:\n{qc_feedback}\n\n"
                f"Fix ALL issues identified and provide the complete corrected version."
            )

            yield _sse({
                "type": "step_start",
                "step": self.developer_role_key,
                "step_label": f"{self.developer_role_label} (QC Revision)",
                "agent": self.developer_agent,
                "iteration": iteration,
            })

            dev_result: StepResult | None = None
            async for item in stream_step(
                manager=self.manager,
                agent_key=self.developer_agent,
                role_key=self.developer_role_key,
                role_label=self.developer_role_label,
                prompt=revision_prompt,
            ):
                if isinstance(item, str):
                    yield _sse({
                        "type": "step_token",
                        "step": self.developer_role_key,
                        "agent": self.developer_agent,
                        "content": item,
                        "iteration": iteration,
                    })
                elif isinstance(item, StepResult):
                    dev_result = item

            if dev_result is None:
                self.final_output = output
                return

            yield _sse({
                "type": "step_complete",
                "step": self.developer_role_key,
                "step_label": f"{self.developer_role_label} (QC Revision)",
                "agent": dev_result.agent,
                "agent_name": dev_result.agent_name,
                "content": dev_result.content,
                "response_time": dev_result.response_time,
                "tokens": dev_result.tokens,
                "error": dev_result.error,
                "iteration": iteration,
            })

            self.total_tokens += dev_result.tokens
            self.total_time += dev_result.response_time
            self.steps.append({
                "step": self.developer_role_key,
                "step_label": f"{self.developer_role_label} (QC Revision)",
                "agent": dev_result.agent,
                "agent_name": dev_result.agent_name,
                "content": dev_result.content,
                "response_time": dev_result.response_time,
                "tokens": dev_result.tokens,
                "error": dev_result.error,
                "iteration": iteration,
            })

            if not dev_result.error:
                output = dev_result.content

        self.final_output = output
