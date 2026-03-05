"""
AI Council — Conversation Orchestrator
Controls the full multi-round debate flow and yields SSE events.
"""

import json
import logging
import time
from dataclasses import dataclass
from typing import AsyncGenerator, Optional

from .agents import AgentManager, AgentResponse, get_available_agents
from .debate import DebateEngine
from .synthesizer import FinalSynthesizer, parse_votes

logger = logging.getLogger("ai_council")

ROUND_NAMES = {
    1: "Initial Response",
    2: "Critique Phase",
    3: "Refinement",
    4: "Voting",
    5: "Final Synthesis",
}


@dataclass
class CouncilConfig:
    enabled_agents: Optional[list[str]] = None
    max_rounds: int = 5


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, default=str)}\n\n"


class ConversationOrchestrator:
    def __init__(self, config: Optional[CouncilConfig] = None):
        self.config = config or CouncilConfig()
        self.manager = AgentManager(self.config.enabled_agents)
        self.debate = DebateEngine(self.manager)
        self.synthesizer = FinalSynthesizer(self.manager)

    async def run_debate(self, prompt: str) -> AsyncGenerator[str, None]:
        """Run the full debate, yielding SSE events throughout."""
        t0 = time.time()
        total_tokens = 0
        metrics: dict[str, dict] = {
            k: {"times": [], "tokens": 0, "errors": 0}
            for k in self.manager.keys()
        }

        def _track(responses: list[AgentResponse]):
            nonlocal total_tokens
            for r in responses:
                if r.agent in metrics:
                    metrics[r.agent]["times"].append(r.response_time)
                    metrics[r.agent]["tokens"] += r.token_estimate
                    total_tokens += r.token_estimate
                    if r.error:
                        metrics[r.agent]["errors"] += 1

        def _emit_responses(responses: list[AgentResponse]):
            events = []
            for r in responses:
                events.append(_sse({
                    "type": "agent_response",
                    "round": r.round_num,
                    "response_type": r.response_type,
                    "agent": r.agent,
                    "role": r.role,
                    "content": r.content,
                    "response_time": r.response_time,
                    "tokens": r.token_estimate,
                    "error": r.error,
                }))
            return events

        # Send available agents info
        yield _sse({
            "type": "council_start",
            "agents": [
                {"key": k, "name": c.name, "role": c.role, "color": c.color}
                for k, c in self.manager.agents.items()
            ],
        })

        # ──────────────────────────── Round 1 ────────────────────────────
        yield _sse({"type": "round_start", "round": 1, "name": ROUND_NAMES[1]})

        for k in self.manager.keys():
            cfg = self.manager.get_config(k)
            yield _sse({"type": "agent_typing", "round": 1, "agent": k, "role": cfg.role})

        r1 = await self.debate.run_initial(prompt)
        _track(r1)
        for ev in _emit_responses(r1):
            yield ev
        yield _sse({"type": "round_end", "round": 1})

        if self.config.max_rounds < 2 or len([r for r in r1 if not r.error]) < 2:
            yield self._done_event(t0, total_tokens, metrics, {})
            return

        # ──────────────────────────── Round 2 ────────────────────────────
        yield _sse({"type": "round_start", "round": 2, "name": ROUND_NAMES[2]})

        for k in self.manager.keys():
            cfg = self.manager.get_config(k)
            yield _sse({"type": "agent_typing", "round": 2, "agent": k, "role": cfg.role})

        r2 = await self.debate.run_critique(prompt, r1)
        _track(r2)
        for ev in _emit_responses(r2):
            yield ev
        yield _sse({"type": "round_end", "round": 2})

        if self.config.max_rounds < 3:
            yield self._done_event(t0, total_tokens, metrics, {})
            return

        # ──────────────────────────── Round 3 ────────────────────────────
        yield _sse({"type": "round_start", "round": 3, "name": ROUND_NAMES[3]})

        for k in self.manager.keys():
            cfg = self.manager.get_config(k)
            yield _sse({"type": "agent_typing", "round": 3, "agent": k, "role": cfg.role})

        r3 = await self.debate.run_refinement(prompt, r1, r2)
        _track(r3)
        for ev in _emit_responses(r3):
            yield ev
        yield _sse({"type": "round_end", "round": 3})

        if self.config.max_rounds < 4:
            yield self._done_event(t0, total_tokens, metrics, {})
            return

        # ──────────────────────────── Round 4 ────────────────────────────
        yield _sse({"type": "round_start", "round": 4, "name": ROUND_NAMES[4]})

        r4 = await self.debate.run_voting(r3)
        _track(r4)
        votes, tally = parse_votes(r4)

        yield _sse({
            "type": "vote_result",
            "round": 4,
            "votes": votes,
            "tally": tally,
        })
        yield _sse({"type": "round_end", "round": 4})

        if self.config.max_rounds < 5:
            yield self._done_event(t0, total_tokens, metrics, tally)
            return

        # ──────────────────────────── Round 5 ────────────────────────────
        yield _sse({"type": "round_start", "round": 5, "name": ROUND_NAMES[5]})

        synthesis = await self.synthesizer.synthesize(prompt, r3, tally)
        _track([synthesis])

        yield _sse({
            "type": "synthesis",
            "agent": synthesis.agent,
            "content": synthesis.content,
            "response_time": synthesis.response_time,
            "tokens": synthesis.token_estimate,
            "error": synthesis.error,
        })
        yield _sse({"type": "round_end", "round": 5})

        # ──────────────────────────── Done ───────────────────────────────
        yield self._done_event(t0, total_tokens, metrics, tally)

    def _done_event(
        self,
        t0: float,
        total_tokens: int,
        metrics: dict,
        tally: dict,
    ) -> str:
        agent_metrics = []
        for k, data in metrics.items():
            cfg = self.manager.get_config(k)
            avg = (
                round(sum(data["times"]) / len(data["times"]), 2)
                if data["times"]
                else 0
            )
            agent_metrics.append({
                "agent": k,
                "name": cfg.name if cfg else k,
                "role": cfg.role if cfg else "",
                "color": cfg.color if cfg else "#888",
                "avg_response_time": avg,
                "total_tokens": data["tokens"],
                "errors": data["errors"],
                "votes_received": tally.get(k, 0),
            })

        return _sse({
            "type": "done",
            "total_time": round(time.time() - t0, 2),
            "total_tokens": total_tokens,
            "metrics": agent_metrics,
        })
