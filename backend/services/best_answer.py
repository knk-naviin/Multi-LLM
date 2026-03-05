"""
Best Answer Mode — Simplified Multi-Agent Engine
Runs all available LLM agents in parallel, then synthesizes
the best combined answer. Returns both the final answer and
individual agent messages for the "AI Agent Chat" dropdown.
"""

import asyncio
import logging
import time
from typing import Optional

from services.ai_council.agents import AgentManager, AGENT_DEFINITIONS

logger = logging.getLogger("best_answer")


class BestAnswerEngine:
    def __init__(self, enabled_agents: Optional[list[str]] = None):
        self.manager = AgentManager(enabled_agents)

    async def generate(self, prompt: str) -> dict:
        t0 = time.time()

        # ── Step 1: All agents respond in parallel ───────────────────
        initial_prompts = {}
        for key in self.manager.keys():
            cfg = self.manager.get_config(key)
            initial_prompts[key] = (
                f"You are an AI agent with the role: {cfg.role}.\n"
                f"Your focus area: {cfg.focus}.\n\n"
                f"Answer the following question thoroughly from your perspective:\n\n"
                f"{prompt}"
            )

        responses = await self.manager.call_all_parallel(initial_prompts)

        # Build agent_chat list
        agent_chat = []
        for r in responses:
            cfg = AGENT_DEFINITIONS.get(r.agent)
            agent_chat.append({
                "agent": r.agent,
                "name": cfg.name if cfg else r.agent,
                "role": r.role,
                "message": r.content if not r.error else f"[Error: {r.error}]",
                "response_time": r.response_time,
                "tokens": r.token_estimate,
                "error": r.error,
            })

        # Filter out errored responses for synthesis
        valid_responses = [r for r in responses if not r.error and r.content.strip()]

        if not valid_responses:
            return {
                "final_answer": "All AI agents failed to respond. Please try again.",
                "synthesized_by": "system",
                "agent_chat": agent_chat,
                "response_time_seconds": round(time.time() - t0, 2),
            }

        # If only one agent responded, use its response directly
        if len(valid_responses) == 1:
            r = valid_responses[0]
            return {
                "final_answer": r.content,
                "synthesized_by": r.agent,
                "agent_chat": agent_chat,
                "response_time_seconds": round(time.time() - t0, 2),
            }

        # ── Step 2: Synthesize best answer ───────────────────────────
        responses_text = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[r.agent].name} ({AGENT_DEFINITIONS[r.agent].role}) ---\n"
            f"{r.content}"
            for r in valid_responses
        )

        synthesis_prompt = (
            f"You are a synthesis engine for Swastik AI. "
            f"Multiple AI agents have answered the same question.\n\n"
            f"Original question: {prompt}\n\n"
            f"Their responses:\n{responses_text}\n\n"
            f"Create the best possible answer by:\n"
            f"1. Taking the strongest points from each response\n"
            f"2. Ensuring accuracy and completeness\n"
            f"3. Resolving any contradictions\n"
            f"4. Making it well-structured, clear, and concise\n\n"
            f"Provide the definitive answer (do NOT mention the other agents or "
            f"that you are synthesizing — just provide the answer directly):"
        )

        # Use the first available agent for synthesis
        synth_key = self.manager.keys()[0]
        synth_result = await self.manager.call_agent(synth_key, synthesis_prompt)

        final_answer = (
            synth_result.content
            if not synth_result.error
            else valid_responses[0].content  # fallback to best single response
        )

        return {
            "final_answer": final_answer,
            "synthesized_by": synth_result.agent if not synth_result.error else valid_responses[0].agent,
            "agent_chat": agent_chat,
            "response_time_seconds": round(time.time() - t0, 2),
        }
