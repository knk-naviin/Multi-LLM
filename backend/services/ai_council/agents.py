"""
AI Council — Agent Manager
Manages individual LLM agents with specialized debate roles.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

from config import OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, GROK_API_KEY
from models.gpt import call_gpt
from models.gemini import call_gemini, can_call_gemini
from models.claude import call_claude
from models.grok import call_grok

logger = logging.getLogger("ai_council")


@dataclass
class AgentConfig:
    name: str
    role: str
    focus: str
    color: str
    call_fn: Callable[[str], str]


@dataclass
class AgentResponse:
    agent: str
    role: str
    content: str
    response_time: float
    token_estimate: int
    round_num: int
    response_type: str = "response"
    error: Optional[str] = None


# ─── Agent Definitions ───────────────────────────────────────────────

AGENT_DEFINITIONS: dict[str, AgentConfig] = {
    "gpt": AgentConfig(
        name="GPT",
        role="Engineer / Problem Solver",
        focus="logical reasoning and structured answers",
        color="#10a37f",
        call_fn=call_gpt,
    ),
    "gemini": AgentConfig(
        name="Gemini",
        role="Researcher",
        focus="factual knowledge, real-world examples, and data-driven analysis",
        color="#4285f4",
        call_fn=call_gemini,
    ),
    "claude": AgentConfig(
        name="Claude",
        role="Philosopher / Safety Reviewer",
        focus="ethics, nuance, safety considerations, and deep explanation",
        color="#d97706",
        call_fn=call_claude,
    ),
    "grok": AgentConfig(
        name="Grok",
        role="Critic / Simplifier",
        focus="challenging assumptions, finding flaws, and simplifying complex ideas",
        color="#ef4444",
        call_fn=call_grok,
    ),
}


def get_available_agents() -> list[str]:
    """Return agent keys whose API keys are configured."""
    available = []
    if OPENAI_API_KEY:
        available.append("gpt")
    if GEMINI_API_KEY:
        available.append("gemini")
    if ANTHROPIC_API_KEY:
        available.append("claude")
    if GROK_API_KEY:
        available.append("grok")
    return available


# ─── Agent Manager ───────────────────────────────────────────────────


class AgentManager:
    def __init__(self, enabled_agents: Optional[list[str]] = None):
        available = get_available_agents()
        self.agents: dict[str, AgentConfig] = {}
        for key, config in AGENT_DEFINITIONS.items():
            if key not in available:
                continue
            if enabled_agents is None or key in enabled_agents:
                self.agents[key] = config

    async def call_agent(self, agent_key: str, prompt: str) -> AgentResponse:
        config = self.agents.get(agent_key)
        if not config:
            return AgentResponse(
                agent=agent_key,
                role="Unknown",
                content="",
                response_time=0,
                token_estimate=0,
                round_num=0,
                error=f"Agent {agent_key} not available",
            )

        start = time.time()
        try:
            if agent_key == "gemini" and not can_call_gemini():
                return AgentResponse(
                    agent=agent_key,
                    role=config.role,
                    content="",
                    response_time=0,
                    token_estimate=0,
                    round_num=0,
                    error="Gemini rate limited — skipped",
                )

            content = await asyncio.to_thread(config.call_fn, prompt)
            elapsed = time.time() - start
            token_estimate = max(1, len(content.split()) * 4 // 3)

            return AgentResponse(
                agent=agent_key,
                role=config.role,
                content=content,
                response_time=round(elapsed, 2),
                token_estimate=token_estimate,
                round_num=0,
            )
        except Exception as e:
            elapsed = time.time() - start
            logger.warning("Agent %s failed: %s", agent_key, e)
            return AgentResponse(
                agent=agent_key,
                role=config.role,
                content="",
                response_time=round(elapsed, 2),
                token_estimate=0,
                round_num=0,
                error=str(e),
            )

    async def call_all_parallel(self, prompts: dict[str, str]) -> list[AgentResponse]:
        """Call multiple agents in parallel with their respective prompts."""
        tasks = [
            self.call_agent(key, prompts[key])
            for key in self.agents
            if key in prompts
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        responses = []
        for r in results:
            if isinstance(r, AgentResponse):
                responses.append(r)
            elif isinstance(r, Exception):
                logger.error("Parallel agent call error: %s", r)
        return responses

    def get_config(self, key: str) -> Optional[AgentConfig]:
        return self.agents.get(key)

    def keys(self) -> list[str]:
        return list(self.agents.keys())
