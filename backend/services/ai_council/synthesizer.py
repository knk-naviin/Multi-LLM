"""
AI Council — Final Synthesizer
Generates the combined best answer from all debate rounds.
"""

import json
import logging
import re
from typing import Optional

from .agents import AgentManager, AgentResponse, AGENT_DEFINITIONS

logger = logging.getLogger("ai_council")


def parse_votes(
    vote_responses: list[AgentResponse],
) -> tuple[dict[str, str], dict[str, int]]:
    """Parse vote responses to build voter→voted_for map and tally."""
    votes: dict[str, str] = {}

    for r in vote_responses:
        if r.error:
            continue
        content = r.content.strip()

        # Try JSON first
        try:
            match = re.search(r"\{[^}]+\}", content)
            if match:
                data = json.loads(match.group())
                voted_for = data.get("vote", "").lower().strip()
                if voted_for in AGENT_DEFINITIONS:
                    votes[r.agent] = voted_for
                    continue
        except (json.JSONDecodeError, AttributeError):
            pass

        # Fallback: find model name in text
        for model_key in AGENT_DEFINITIONS:
            if model_key in content.lower():
                votes[r.agent] = model_key
                break

    tally: dict[str, int] = {}
    for voted_for in votes.values():
        tally[voted_for] = tally.get(voted_for, 0) + 1

    return votes, tally


class FinalSynthesizer:
    def __init__(self, manager: AgentManager):
        self.manager = manager

    async def synthesize(
        self,
        user_prompt: str,
        refined: list[AgentResponse],
        tally: dict[str, int],
    ) -> AgentResponse:
        # Use the model with the most votes for synthesis; default to first available
        best_model = (
            max(tally, key=tally.get) if tally else self.manager.keys()[0]
        )

        responses_text = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[r.agent].name} ({AGENT_DEFINITIONS[r.agent].role}) "
            f"[Votes: {tally.get(r.agent, 0)}] ---\n{r.content}"
            for r in refined
            if not r.error
        )

        prompt = (
            f"You are the Final Synthesizer for an AI Council debate.\n\n"
            f"Original question: {user_prompt}\n\n"
            f"The following refined answers were provided by different AI agents, "
            f"along with their vote counts:\n\n{responses_text}\n\n"
            f"Create a comprehensive final answer that:\n"
            f"1. Combines the strongest ideas from all responses\n"
            f"2. Prioritizes answers that received more votes\n"
            f"3. Resolves any contradictions\n"
            f"4. Is well-structured and complete\n\n"
            f"Provide the definitive answer:"
        )

        result = await self.manager.call_agent(best_model, prompt)
        result.round_num = 5
        result.response_type = "synthesis"
        return result
