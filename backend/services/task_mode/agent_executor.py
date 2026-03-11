"""
Task Mode — Agent Executor
Executes a single agent step in the task workflow pipeline.
"""

import logging
import time
from dataclasses import dataclass
from typing import AsyncGenerator, Optional, Union

from services.ai_council.agents import AgentManager, AgentResponse

logger = logging.getLogger("task_mode")


@dataclass
class StepResult:
    role_key: str
    role_label: str
    agent: str
    agent_name: str
    content: str
    response_time: float
    tokens: int
    error: Optional[str] = None


async def execute_step(
    manager: AgentManager,
    agent_key: str,
    role_key: str,
    role_label: str,
    prompt: str,
) -> StepResult:
    """Execute a single workflow step with the assigned agent."""
    cfg = manager.get_config(agent_key)
    if not cfg:
        # Fallback to first available agent
        available = manager.keys()
        if not available:
            return StepResult(
                role_key=role_key,
                role_label=role_label,
                agent=agent_key,
                agent_name=agent_key.upper(),
                content="",
                response_time=0,
                tokens=0,
                error="No agents available",
            )
        agent_key = available[0]
        cfg = manager.get_config(agent_key)

    result = await manager.call_agent(agent_key, prompt)

    return StepResult(
        role_key=role_key,
        role_label=role_label,
        agent=result.agent,
        agent_name=cfg.name if cfg else result.agent.upper(),
        content=result.content,
        response_time=result.response_time,
        tokens=result.token_estimate,
        error=result.error,
    )


async def stream_step(
    manager: AgentManager,
    agent_key: str,
    role_key: str,
    role_label: str,
    prompt: str,
) -> AsyncGenerator[Union[str, StepResult], None]:
    """Stream tokens from a workflow step, then yield the final StepResult.

    Callers distinguish token chunks (str) from the final result
    via isinstance(item, str) vs isinstance(item, StepResult).
    """
    cfg = manager.get_config(agent_key)
    if not cfg:
        available = manager.keys()
        if not available:
            yield StepResult(
                role_key=role_key,
                role_label=role_label,
                agent=agent_key,
                agent_name=agent_key.upper(),
                content="",
                response_time=0,
                tokens=0,
                error="No agents available",
            )
            return
        agent_key = available[0]
        cfg = manager.get_config(agent_key)

    agent_response: AgentResponse | None = None
    async for item in manager.stream_agent(agent_key, prompt):
        if isinstance(item, str):
            yield item
        elif isinstance(item, AgentResponse):
            agent_response = item

    if agent_response:
        yield StepResult(
            role_key=role_key,
            role_label=role_label,
            agent=agent_response.agent,
            agent_name=cfg.name if cfg else agent_response.agent.upper(),
            content=agent_response.content,
            response_time=agent_response.response_time,
            tokens=agent_response.token_estimate,
            error=agent_response.error,
        )
