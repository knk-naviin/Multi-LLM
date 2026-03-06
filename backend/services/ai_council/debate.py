"""
AI Council — Debate Engine
Manages critique, refinement rounds, and sequential debate mode.
"""

from .agents import AgentManager, AgentResponse, AGENT_DEFINITIONS


# ── Stance detection keywords ──────────────────────────────────────

STANCE_KEYWORDS: dict[str, list[str]] = {
    "oppose": [
        "i oppose", "i disagree", "i strongly disagree",
        "i must disagree", "i cannot agree", "i don't agree",
    ],
    "partial_agree": [
        "i partially agree", "while i agree", "i agree in part",
        "partially correct", "i agree with some", "i partly agree",
    ],
    "agree": [
        "i agree", "i concur", "i support", "i fully agree",
        "i second", "i strongly agree",
    ],
}


class DebateEngine:
    def __init__(self, manager: AgentManager):
        self.manager = manager

    # ── Stance detection ───────────────────────────────────────────

    def _detect_stance(self, content: str) -> str:
        """Parse the first 200 chars for stance keywords.

        Returns one of: 'oppose', 'partial_agree', 'agree', or 'review'.
        Checks oppose first to avoid 'i agree' matching inside 'i don't agree'.
        """
        snippet = content[:200].lower()
        for stance, keywords in STANCE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in snippet:
                    return stance
        return "review"

    # ── Sequential debate prompt builders ──────────────────────────

    def _sequential_initial_prompt(self, agent_key: str, user_prompt: str) -> str:
        """Prompt for the first agent in sequential debate (no prior context)."""
        cfg = self.manager.get_config(agent_key)
        return (
            f"You are {cfg.name}, an AI agent with the role: {cfg.role}.\n"
            f"Your focus area: {cfg.focus}.\n\n"
            f"You are the first speaker in a structured AI debate. "
            f"Provide a thorough initial analysis of the following question:\n\n"
            f"{user_prompt}\n\n"
            f"Give a clear, well-structured response that presents your perspective. "
            f"Other AI agents will respond to your points next."
        )

    def _sequential_followup_prompt(
        self,
        agent_key: str,
        user_prompt: str,
        prior_responses: list[AgentResponse],
    ) -> str:
        """Prompt for subsequent agents who must reference all prior responses."""
        cfg = self.manager.get_config(agent_key)
        prior_text = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[r.agent].name} ({AGENT_DEFINITIONS[r.agent].role}) ---\n"
            f"{r.content}"
            for r in prior_responses
            if not r.error
        )
        prior_names = ", ".join(
            AGENT_DEFINITIONS[r.agent].name
            for r in prior_responses
            if not r.error
        )
        return (
            f"You are {cfg.name}, an AI agent with the role: {cfg.role}.\n"
            f"Your focus area: {cfg.focus}.\n\n"
            f"A structured AI debate is in progress about this question:\n"
            f"\"{user_prompt}\"\n\n"
            f"The following agents have already responded: {prior_names}\n\n"
            f"Their responses:\n\n{prior_text}\n\n"
            f"IMPORTANT — You MUST begin your response with ONE of these phrases:\n"
            f"- \"I agree with [agent name]...\" if you support their position\n"
            f"- \"I disagree with [agent name]...\" if you oppose their position\n"
            f"- \"I partially agree with [agent name]...\" for a nuanced stance\n\n"
            f"Then provide your own analysis. Reference specific points from "
            f"previous responses and be direct about where you agree or disagree. "
            f"This is a debate — take a clear position."
        )

    def _sequential_synthesis_prompt(
        self,
        user_prompt: str,
        all_responses: list[AgentResponse],
    ) -> str:
        """Prompt for generating the final synthesis after sequential debate."""
        responses_text = "\n\n".join(
            f"--- {AGENT_DEFINITIONS[r.agent].name} ({AGENT_DEFINITIONS[r.agent].role}) ---\n"
            f"{r.content}"
            for r in all_responses
            if not r.error
        )
        return (
            f"You are the Final Synthesizer for an AI debate.\n\n"
            f"Original question: {user_prompt}\n\n"
            f"The following agents debated this topic sequentially, each building "
            f"on and responding to previous arguments:\n\n{responses_text}\n\n"
            f"Create a comprehensive final answer that:\n"
            f"1. Identifies the key points of agreement across agents\n"
            f"2. Addresses the points of disagreement and resolves them\n"
            f"3. Combines the strongest insights from all perspectives\n"
            f"4. Is well-structured and actionable\n\n"
            f"Provide the definitive synthesized answer:"
        )

    # ── Parallel round prompt builders (existing) ──────────────────

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
