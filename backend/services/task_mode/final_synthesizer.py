"""
Task Mode — Final Synthesizer
Takes the outputs from all workflow steps and produces a final optimized result.
"""

import logging
from typing import AsyncGenerator, Union

from services.ai_council.agents import AgentManager, AgentResponse

logger = logging.getLogger("task_mode")


async def synthesize_final(
    manager: AgentManager,
    task_prompt: str,
    task_type: str,
    workflow_outputs: list[dict],
    synth_agent: str | None = None,
) -> dict:
    """
    Synthesize all workflow step outputs into a single optimized final answer.
    Uses the last step's agent by default, or falls back to first available.
    """
    agent_key = synth_agent or (
        workflow_outputs[-1]["agent"] if workflow_outputs else manager.keys()[0]
    )

    # Build context from all workflow steps
    steps_text = "\n\n".join(
        f"--- {step['role_label']} ({step['agent_name']}) ---\n{step['content']}"
        for step in workflow_outputs
        if step.get("content") and not step.get("error")
    )

    synthesis_prompt = (
        f"You are a final synthesis engine for a {task_type.replace('_', ' ')} workflow.\n\n"
        f"Original Task: {task_prompt}\n\n"
        f"The following specialists have worked on this task sequentially:\n\n"
        f"{steps_text}\n\n"
        f"Your job:\n"
        f"1. Take the FINAL output from the last specialist as the base\n"
        f"2. Incorporate any remaining improvements from earlier steps that were missed\n"
        f"3. Ensure the output is complete, polished, and production-ready\n"
        f"4. Do NOT mention the workflow or other agents — present the output directly\n\n"
        f"Provide the final optimized output:"
    )

    result = await manager.call_agent(agent_key, synthesis_prompt)

    if result.error:
        # Fallback: use the last successful step's output
        for step in reversed(workflow_outputs):
            if step.get("content") and not step.get("error"):
                return {
                    "content": step["content"],
                    "agent": step["agent"],
                    "agent_name": step["agent_name"],
                    "response_time": 0,
                    "tokens": 0,
                    "error": f"Synthesis failed ({result.error}), using last step output",
                }

        return {
            "content": "All workflow steps failed. Please try again.",
            "agent": "system",
            "agent_name": "System",
            "response_time": 0,
            "tokens": 0,
            "error": "All steps failed",
        }

    cfg = manager.get_config(agent_key)
    return {
        "content": result.content,
        "agent": result.agent,
        "agent_name": cfg.name if cfg else result.agent.upper(),
        "response_time": result.response_time,
        "tokens": result.token_estimate,
        "error": None,
    }


async def stream_synthesize_final(
    manager: AgentManager,
    task_prompt: str,
    task_type: str,
    workflow_outputs: list[dict],
    synth_agent: str | None = None,
) -> AsyncGenerator[Union[str, dict], None]:
    """
    Stream tokens during final synthesis, then yield the final result dict.
    Callers distinguish tokens (str) from the result (dict) via isinstance.
    """
    agent_key = synth_agent or (
        workflow_outputs[-1]["agent"] if workflow_outputs else manager.keys()[0]
    )

    steps_text = "\n\n".join(
        f"--- {step['role_label']} ({step['agent_name']}) ---\n{step['content']}"
        for step in workflow_outputs
        if step.get("content") and not step.get("error")
    )

    synthesis_prompt = (
        f"You are a final synthesis engine for a {task_type.replace('_', ' ')} workflow.\n\n"
        f"Original Task: {task_prompt}\n\n"
        f"The following specialists have worked on this task sequentially:\n\n"
        f"{steps_text}\n\n"
        f"Your job:\n"
        f"1. Take the FINAL output from the last specialist as the base\n"
        f"2. Incorporate any remaining improvements from earlier steps that were missed\n"
        f"3. Ensure the output is complete, polished, and production-ready\n"
        f"4. Do NOT mention the workflow or other agents — present the output directly\n\n"
        f"Provide the final optimized output:"
    )

    agent_response: AgentResponse | None = None
    async for item in manager.stream_agent(agent_key, synthesis_prompt):
        if isinstance(item, str):
            yield item
        elif isinstance(item, AgentResponse):
            agent_response = item

    if agent_response and not agent_response.error:
        cfg = manager.get_config(agent_key)
        yield {
            "content": agent_response.content,
            "agent": agent_response.agent,
            "agent_name": cfg.name if cfg else agent_response.agent.upper(),
            "response_time": agent_response.response_time,
            "tokens": agent_response.token_estimate,
            "error": None,
        }
    elif agent_response and agent_response.error:
        # Fallback: use the last successful step's output
        for step in reversed(workflow_outputs):
            if step.get("content") and not step.get("error"):
                yield {
                    "content": step["content"],
                    "agent": step["agent"],
                    "agent_name": step["agent_name"],
                    "response_time": 0,
                    "tokens": 0,
                    "error": f"Synthesis failed ({agent_response.error}), using last step output",
                }
                return
        yield {
            "content": "All workflow steps failed. Please try again.",
            "agent": "system",
            "agent_name": "System",
            "response_time": 0,
            "tokens": 0,
            "error": "All steps failed",
        }
