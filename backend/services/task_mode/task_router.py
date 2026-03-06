"""
Task Mode — Task Router
Defines task types, their workflow roles, and role-specific prompt templates.
"""

from dataclasses import dataclass


@dataclass
class TaskRole:
    key: str
    label: str
    description: str
    prompt_template: str  # {task_prompt} and {previous_output} are substituted


@dataclass
class TaskTypeConfig:
    key: str
    label: str
    icon: str
    roles: list[TaskRole]


# ── Task Type Definitions ────────────────────────────────────────────

TASK_TYPES: dict[str, TaskTypeConfig] = {
    "coding": TaskTypeConfig(
        key="coding",
        label="Coding",
        icon="Code",
        roles=[
            TaskRole(
                key="coder",
                label="Coding Agent",
                description="Writes the initial code",
                prompt_template=(
                    "You are an expert software engineer. "
                    "Write clean, production-ready code for the following task.\n\n"
                    "Task: {task_prompt}\n\n"
                    "Provide the complete implementation with proper error handling, "
                    "comments, and best practices. Output code only with brief explanations."
                ),
            ),
            TaskRole(
                key="reviewer",
                label="Code Reviewer",
                description="Reviews the code and suggests improvements",
                prompt_template=(
                    "You are a senior code reviewer. "
                    "Review the following code written by another developer.\n\n"
                    "Original Task: {task_prompt}\n\n"
                    "Code to review:\n{previous_output}\n\n"
                    "Provide:\n"
                    "1. Issues found (bugs, security, performance)\n"
                    "2. Improvement suggestions\n"
                    "3. The improved version of the code incorporating your fixes"
                ),
            ),
            TaskRole(
                key="qc",
                label="QC Agent",
                description="Checks for bugs, performance issues, and best practices",
                prompt_template=(
                    "You are a Quality Assurance engineer. "
                    "Perform a final quality check on this code.\n\n"
                    "Original Task: {task_prompt}\n\n"
                    "Code after review:\n{previous_output}\n\n"
                    "Check for:\n"
                    "1. Remaining bugs or edge cases\n"
                    "2. Performance optimizations\n"
                    "3. Security vulnerabilities\n"
                    "4. Best practice compliance\n\n"
                    "Provide the final optimized version of the code."
                ),
            ),
        ],
    ),
    "content_writing": TaskTypeConfig(
        key="content_writing",
        label="Content Writing",
        icon="FileText",
        roles=[
            TaskRole(
                key="writer",
                label="Writer Agent",
                description="Writes the initial content",
                prompt_template=(
                    "You are a professional content writer. "
                    "Write engaging, well-structured content for the following brief.\n\n"
                    "Brief: {task_prompt}\n\n"
                    "Write comprehensive, high-quality content with proper formatting."
                ),
            ),
            TaskRole(
                key="editor",
                label="Editor Agent",
                description="Edits and improves the content",
                prompt_template=(
                    "You are a professional editor. "
                    "Edit and improve the following content.\n\n"
                    "Original Brief: {task_prompt}\n\n"
                    "Content to edit:\n{previous_output}\n\n"
                    "Improve:\n"
                    "1. Clarity and readability\n"
                    "2. Grammar and style\n"
                    "3. Flow and structure\n"
                    "4. Engagement and impact\n\n"
                    "Provide the improved version."
                ),
            ),
            TaskRole(
                key="quality_reviewer",
                label="Quality Reviewer",
                description="Final quality review",
                prompt_template=(
                    "You are a senior content quality reviewer. "
                    "Perform a final quality review on this content.\n\n"
                    "Original Brief: {task_prompt}\n\n"
                    "Edited content:\n{previous_output}\n\n"
                    "Check for:\n"
                    "1. Factual accuracy\n"
                    "2. Tone consistency\n"
                    "3. SEO optimization (if applicable)\n"
                    "4. Final polish\n\n"
                    "Provide the finalized content."
                ),
            ),
        ],
    ),
    "story_building": TaskTypeConfig(
        key="story_building",
        label="Story Building",
        icon="BookOpen",
        roles=[
            TaskRole(
                key="story_creator",
                label="Story Creator",
                description="Creates the initial story",
                prompt_template=(
                    "You are a creative fiction writer. "
                    "Create an engaging story based on the following prompt.\n\n"
                    "Prompt: {task_prompt}\n\n"
                    "Write a compelling story with vivid characters, "
                    "setting, conflict, and resolution."
                ),
            ),
            TaskRole(
                key="plot_improver",
                label="Plot Improver",
                description="Improves the plot and narrative",
                prompt_template=(
                    "You are a story development expert. "
                    "Improve the plot and narrative of this story.\n\n"
                    "Original Prompt: {task_prompt}\n\n"
                    "Story to improve:\n{previous_output}\n\n"
                    "Enhance:\n"
                    "1. Plot depth and twists\n"
                    "2. Character development\n"
                    "3. Pacing and tension\n"
                    "4. Dialogue quality\n\n"
                    "Provide the improved story."
                ),
            ),
            TaskRole(
                key="style_editor",
                label="Style Editor",
                description="Polishes prose style and voice",
                prompt_template=(
                    "You are a literary style editor. "
                    "Polish the prose style of this story.\n\n"
                    "Original Prompt: {task_prompt}\n\n"
                    "Story to polish:\n{previous_output}\n\n"
                    "Focus on:\n"
                    "1. Prose quality and word choice\n"
                    "2. Show vs tell\n"
                    "3. Consistent voice and tone\n"
                    "4. Sensory details and immersion\n\n"
                    "Provide the final polished story."
                ),
            ),
        ],
    ),
    "research": TaskTypeConfig(
        key="research",
        label="Research",
        icon="Search",
        roles=[
            TaskRole(
                key="researcher",
                label="Research Agent",
                description="Conducts thorough research",
                prompt_template=(
                    "You are an expert researcher. "
                    "Conduct thorough research on the following topic.\n\n"
                    "Topic: {task_prompt}\n\n"
                    "Provide comprehensive findings with sources, data, "
                    "and multiple perspectives."
                ),
            ),
            TaskRole(
                key="fact_checker",
                label="Fact Checker",
                description="Verifies facts and claims",
                prompt_template=(
                    "You are a fact-checking specialist. "
                    "Verify and validate the following research.\n\n"
                    "Original Topic: {task_prompt}\n\n"
                    "Research to verify:\n{previous_output}\n\n"
                    "Verify:\n"
                    "1. Accuracy of claims and data\n"
                    "2. Logic of arguments\n"
                    "3. Missing perspectives\n"
                    "4. Potential biases\n\n"
                    "Provide the fact-checked and corrected version."
                ),
            ),
            TaskRole(
                key="summarizer",
                label="Summary Agent",
                description="Summarizes findings clearly",
                prompt_template=(
                    "You are an expert at synthesizing research. "
                    "Create a clear, well-structured summary.\n\n"
                    "Original Topic: {task_prompt}\n\n"
                    "Verified research:\n{previous_output}\n\n"
                    "Create a comprehensive summary with:\n"
                    "1. Key findings\n"
                    "2. Supporting evidence\n"
                    "3. Conclusions\n"
                    "4. Recommendations"
                ),
            ),
        ],
    ),
    "data_analysis": TaskTypeConfig(
        key="data_analysis",
        label="Data Analysis",
        icon="BarChart",
        roles=[
            TaskRole(
                key="analyst",
                label="Analysis Agent",
                description="Analyzes the data",
                prompt_template=(
                    "You are a data analyst. "
                    "Analyze the following data or analysis request.\n\n"
                    "Request: {task_prompt}\n\n"
                    "Provide detailed analysis including methodology, "
                    "findings, patterns, and statistical insights."
                ),
            ),
            TaskRole(
                key="validator",
                label="Validation Agent",
                description="Validates analysis methodology and findings",
                prompt_template=(
                    "You are a data validation expert. "
                    "Validate the following analysis.\n\n"
                    "Original Request: {task_prompt}\n\n"
                    "Analysis to validate:\n{previous_output}\n\n"
                    "Validate:\n"
                    "1. Methodology correctness\n"
                    "2. Statistical accuracy\n"
                    "3. Logical conclusions\n"
                    "4. Edge cases or data issues\n\n"
                    "Provide the validated and corrected analysis."
                ),
            ),
            TaskRole(
                key="reporter",
                label="Report Agent",
                description="Creates a clear report",
                prompt_template=(
                    "You are a data reporting specialist. "
                    "Create a polished report from this analysis.\n\n"
                    "Original Request: {task_prompt}\n\n"
                    "Validated analysis:\n{previous_output}\n\n"
                    "Create a clear report with:\n"
                    "1. Executive summary\n"
                    "2. Key metrics and findings\n"
                    "3. Visualizations (described in text)\n"
                    "4. Actionable recommendations"
                ),
            ),
        ],
    ),
    "debugging": TaskTypeConfig(
        key="debugging",
        label="Debugging",
        icon="Bug",
        roles=[
            TaskRole(
                key="debugger",
                label="Debug Agent",
                description="Finds and identifies bugs",
                prompt_template=(
                    "You are a debugging expert. "
                    "Analyze the following code or issue to find bugs.\n\n"
                    "Issue: {task_prompt}\n\n"
                    "Identify:\n"
                    "1. Root cause of the issue\n"
                    "2. All related bugs\n"
                    "3. Why the bug occurs\n"
                    "4. Reproduction steps"
                ),
            ),
            TaskRole(
                key="fixer",
                label="Fix Agent",
                description="Proposes and implements fixes",
                prompt_template=(
                    "You are a bug fix specialist. "
                    "Fix the bugs identified in the following analysis.\n\n"
                    "Original Issue: {task_prompt}\n\n"
                    "Bug analysis:\n{previous_output}\n\n"
                    "Provide:\n"
                    "1. The fix for each bug\n"
                    "2. Explanation of why the fix works\n"
                    "3. The corrected code\n"
                    "4. Prevention strategies"
                ),
            ),
            TaskRole(
                key="tester",
                label="Test Agent",
                description="Verifies fixes and suggests tests",
                prompt_template=(
                    "You are a QA testing expert. "
                    "Verify the fixes and suggest test cases.\n\n"
                    "Original Issue: {task_prompt}\n\n"
                    "Fixed code:\n{previous_output}\n\n"
                    "Provide:\n"
                    "1. Verification that fixes are correct\n"
                    "2. Test cases to prevent regression\n"
                    "3. Edge cases to consider\n"
                    "4. The final verified code with tests"
                ),
            ),
        ],
    ),
}


def get_task_config(task_type: str) -> TaskTypeConfig | None:
    """Return config for a task type, or None if not found."""
    return TASK_TYPES.get(task_type)
