"""
AI Council — Debate Engine
Manages critique and refinement rounds.
"""

from .agents import AgentManager, AgentResponse, AGENT_DEFINITIONS


class DebateEngine:
    def __init__(self, manager: AgentManager):
        self.manager = manager

    # ── Prompt builders ──────────────────────────────────────────────

    def _initial_prompt(self, agent_key: str, user_prompt: str) -> str:
        cfg = self.manager.get_config(agent_key)
        return (
            f"You are an AI agent with the role: {cfg.role}.\n"
            f"Your focus area: {cfg.focus}.\n\n"
            f"Answer the following question thoroughly from your perspective:\n\n"
            f"{user_prompt}"
        )

    def _critique_prompt(
        self, agent_key: str, user_prompt: str, r1: list[AgentResponse]
    ) -> str:
        cfg = self.manager.get_config(agent_key)
        others = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[r.agent].name} ({AGENT_DEFINITIONS[r.agent].role}) ---\n{r.content}"
            for r in r1
            if r.agent != agent_key and not r.error
        )
        return (
            f"You are an AI agent with the role: {cfg.role}.\n"
            f"Your focus area: {cfg.focus}.\n\n"
            f"Original question: {user_prompt}\n\n"
            f"Other agents provided these responses:\n\n{others}\n\n"
            f"Analyze these responses and provide your critique:\n"
            f"1. Identify any mistakes or inaccuracies\n"
            f"2. Point out missing information\n"
            f"3. Suggest improvements\n"
            f"Be constructive and specific."
        )

    def _refinement_prompt(
        self,
        agent_key: str,
        user_prompt: str,
        original: str,
        critiques: list[AgentResponse],
    ) -> str:
        cfg = self.manager.get_config(agent_key)
        critique_text = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[c.agent].name}'s critique ---\n{c.content}"
            for c in critiques
            if not c.error
        )
        return (
            f"You are an AI agent with the role: {cfg.role}.\n\n"
            f"Original question: {user_prompt}\n\n"
            f"Your original answer:\n{original}\n\n"
            f"Critiques from other agents:\n{critique_text}\n\n"
            f"Based on these critiques, provide an improved and refined answer. "
            f"Address the valid criticisms and incorporate the best suggestions."
        )

    def _vote_prompt(self, refined: list[AgentResponse]) -> str:
        options = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[r.agent].name} ---\n{r.content}"
            for r in refined
            if not r.error
        )
        names = ", ".join(r.agent for r in refined if not r.error)
        return (
            f"Review these refined responses and vote for the BEST one.\n"
            f"You may vote for your own response if you truly believe it is best.\n\n"
            f"{options}\n\n"
            f'Reply with ONLY a JSON object: {{"vote": "model_name", "reason": "brief reason"}}\n'
            f"where model_name is one of: {names}"
        )

    # ── Round runners ────────────────────────────────────────────────

    async def run_initial(self, user_prompt: str) -> list[AgentResponse]:
        prompts = {k: self._initial_prompt(k, user_prompt) for k in self.manager.keys()}
        responses = await self.manager.call_all_parallel(prompts)
        for r in responses:
            r.round_num = 1
            r.response_type = "response"
        return responses

    async def run_critique(
        self, user_prompt: str, r1: list[AgentResponse]
    ) -> list[AgentResponse]:
        prompts = {k: self._critique_prompt(k, user_prompt, r1) for k in self.manager.keys()}
        responses = await self.manager.call_all_parallel(prompts)
        for r in responses:
            r.round_num = 2
            r.response_type = "critique"
        return responses

    async def run_refinement(
        self,
        user_prompt: str,
        r1: list[AgentResponse],
        r2: list[AgentResponse],
    ) -> list[AgentResponse]:
        original_map = {r.agent: r.content for r in r1 if not r.error}
        prompts = {}
        for k in self.manager.keys():
            orig = original_map.get(k)
            if orig:
                prompts[k] = self._refinement_prompt(k, user_prompt, orig, r2)
        responses = await self.manager.call_all_parallel(prompts)
        for r in responses:
            r.round_num = 3
            r.response_type = "refinement"
        return responses

    async def run_voting(self, refined: list[AgentResponse]) -> list[AgentResponse]:
        prompts = {k: self._vote_prompt(refined) for k in self.manager.keys()}
        responses = await self.manager.call_all_parallel(prompts)
        for r in responses:
            r.round_num = 4
            r.response_type = "vote"
        return responses
