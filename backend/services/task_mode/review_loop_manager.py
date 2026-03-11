"""
Task Mode — Review Loop Manager
Manages the iterative Developer ↔ Reviewer feedback loop.
Developer produces output → Reviewer evaluates with PASS/NEEDS_REVISION verdict →
If rejected, feedback goes back to Developer for revision. Repeats up to max_iterations.
"""

import json
import logging
import re
from typing import AsyncGenerator

from services.ai_council.agents import AgentManager
from services.task_mode.agent_executor import execute_step, stream_step, StepResult

logger = logging.getLogger("task_mode")

MAX_REVIEW_ITERATIONS = 3


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, default=str)}\n\n"


def _parse_review_verdict(content: str) -> tuple[bool, str]:
    """
    Parse reviewer output for structured verdict.
    Returns (is_approved, feedback_text).
    """
    verdict_match = re.search(
        r"VERDICT:\s*(PASS|NEEDS_REVISION|FAIL|REJECT|APPROVED)",
        content,
        re.IGNORECASE,
    )
    if verdict_match:
        verdict = verdict_match.group(1).upper()
        approved = verdict in ("PASS", "APPROVED")
        return approved, content
    # Default: if no verdict marker found, assume PASS
    return True, content


class ReviewLoopManager:
    """
    Manages the Developer ↔ Reviewer iterative loop.
    Yields SSE events and tracks final_output for the next phase.
    """

    def __init__(
        self,
        manager: AgentManager,
        task_prompt: str,
        developer_agent: str,
        reviewer_agent: str,
        developer_role_key: str,
        developer_role_label: str,
        reviewer_role_key: str,
        reviewer_role_label: str,
        developer_prompt_template: str,
        reviewer_prompt_template: str,
        max_iterations: int = MAX_REVIEW_ITERATIONS,
    ):
        self.manager = manager
        self.task_prompt = task_prompt
        self.developer_agent = developer_agent
        self.reviewer_agent = reviewer_agent
        self.developer_role_key = developer_role_key
        self.developer_role_label = developer_role_label
        self.reviewer_role_key = reviewer_role_key
        self.reviewer_role_label = reviewer_role_label
        self.developer_prompt_template = developer_prompt_template
        self.reviewer_prompt_template = reviewer_prompt_template
        self.max_iterations = max_iterations

        # Tracked output for next phase
        self.final_output: str = ""
        self.total_tokens: int = 0
        self.total_time: float = 0
        self.steps: list[dict] = []

    async def run(self) -> AsyncGenerator[str, None]:
        """
        Run the Developer → Reviewer iterative loop.
        Yields SSE events for real-time UI updates.
        """
        previous_output = ""
        review_feedback = ""

        for iteration in range(1, self.max_iterations + 1):
            # ── Developer Step ───────────────────────────────────────────
            if iteration == 1:
                dev_prompt = self.developer_prompt_template.format(
                    task_prompt=self.task_prompt,
                    previous_output="(No previous output — this is the first step)",
                )
            else:
                dev_prompt = (
                    f"You received feedback from a reviewer. "
                    f"Revise your work to address all issues.\n\n"
                    f"Original Task: {self.task_prompt}\n\n"
                    f"Your previous output:\n{previous_output}\n\n"
                    f"Reviewer feedback:\n{review_feedback}\n\n"
                    f"Provide the complete revised version incorporating all feedback."
                )

            yield _sse({
                "type": "step_start",
                "step": self.developer_role_key,
                "step_label": self.developer_role_label
                + (f" (Revision {iteration - 1})" if iteration > 1 else ""),
                "agent": self.developer_agent,
                "iteration": iteration,
            })

            dev_result: StepResult | None = None
            async for item in stream_step(
                manager=self.manager,
                agent_key=self.developer_agent,
                role_key=self.developer_role_key,
                role_label=self.developer_role_label,
                prompt=dev_prompt,
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
                return

            step_label = self.developer_role_label + (
                f" (Revision {iteration - 1})" if iteration > 1 else ""
            )

            yield _sse({
                "type": "step_complete",
                "step": self.developer_role_key,
                "step_label": step_label,
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
                "step_label": step_label,
                "agent": dev_result.agent,
                "agent_name": dev_result.agent_name,
                "content": dev_result.content,
                "response_time": dev_result.response_time,
                "tokens": dev_result.tokens,
                "error": dev_result.error,
                "iteration": iteration,
            })

            if dev_result.error:
                self.final_output = previous_output or ""
                return

            previous_output = dev_result.content

            # ── Reviewer Step ────────────────────────────────────────────
            review_prompt = self.reviewer_prompt_template.format(
                task_prompt=self.task_prompt,
                previous_output=previous_output,
            )
            # Append structured verdict instruction
            review_prompt += (
                "\n\nIMPORTANT: You MUST end your review with a verdict line in this EXACT format:\n"
                "VERDICT: PASS (if the work meets quality standards and is ready for the next stage)\n"
                "or\n"
                "VERDICT: NEEDS_REVISION (if improvements are required)\n\n"
                "Provide specific, actionable feedback for any needed revisions."
            )

            yield _sse({
                "type": "step_start",
                "step": self.reviewer_role_key,
                "step_label": self.reviewer_role_label,
                "agent": self.reviewer_agent,
                "iteration": iteration,
            })

            review_result: StepResult | None = None
            async for item in stream_step(
                manager=self.manager,
                agent_key=self.reviewer_agent,
                role_key=self.reviewer_role_key,
                role_label=self.reviewer_role_label,
                prompt=review_prompt,
            ):
                if isinstance(item, str):
                    yield _sse({
                        "type": "step_token",
                        "step": self.reviewer_role_key,
                        "agent": self.reviewer_agent,
                        "content": item,
                        "iteration": iteration,
                    })
                elif isinstance(item, StepResult):
                    review_result = item

            if review_result is None:
                self.final_output = previous_output
                return

            yield _sse({
                "type": "step_complete",
                "step": self.reviewer_role_key,
                "step_label": self.reviewer_role_label,
                "agent": review_result.agent,
                "agent_name": review_result.agent_name,
                "content": review_result.content,
                "response_time": review_result.response_time,
                "tokens": review_result.tokens,
                "error": review_result.error,
                "iteration": iteration,
            })

            self.total_tokens += review_result.tokens
            self.total_time += review_result.response_time
            self.steps.append({
                "step": self.reviewer_role_key,
                "step_label": self.reviewer_role_label,
                "agent": review_result.agent,
                "agent_name": review_result.agent_name,
                "content": review_result.content,
                "response_time": review_result.response_time,
                "tokens": review_result.tokens,
                "error": review_result.error,
                "iteration": iteration,
            })

            if review_result.error:
                self.final_output = previous_output
                return

            approved, review_feedback = _parse_review_verdict(review_result.content)

            if approved:
                yield _sse({
                    "type": "review_approved",
                    "step": self.reviewer_role_key,
                    "iteration": iteration,
                    "message": "Reviewer approved the work.",
                })
                break
            else:
                yield _sse({
                    "type": "review_feedback",
                    "step": self.reviewer_role_key,
                    "iteration": iteration,
                    "feedback": review_feedback[:500],
                    "message": f"Revision requested (attempt {iteration}/{self.max_iterations})",
                })

                # If we've hit the max, proceed anyway
                if iteration == self.max_iterations:
                    yield _sse({
                        "type": "review_approved",
                        "step": self.reviewer_role_key,
                        "iteration": iteration,
                        "message": f"Max review iterations ({self.max_iterations}) reached. Proceeding with latest output.",
                    })

        self.final_output = previous_output
