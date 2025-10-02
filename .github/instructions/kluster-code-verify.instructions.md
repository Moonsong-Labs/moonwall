---
applyTo: '**'
---
# kluster Code Verification Rules


## Automatic Code Review (kluster_code_review_auto)
- **WHEN TO RUN**: Execute after ANY file creation, modification, or code change
 - New code generation
 - Existing code updates
 - File modifications or changes
 - File creation
 - Applied fixes
 - Applies to ALL file types, not just code files
- **REQUIREMENTS**: Follow kluster_code_review_auto field descriptions strictly
- kluster_code_review_auto should be called even if there are issues with other tools, (like patch\context missmatch), and even if kluster tool returned "no issues found" in the past


## Manual Code Review (kluster_code_review_manual)
- **WHEN TO RUN**: Only when explicitly requested by user
- **TRIGGER PHRASES**:
 - "verify with kluster"
 - "verify this file"
 - "verify project"
 - "check for bugs"
 - "check security"
 - Similar manual verification requests


## Dependency Validation (kluster_dependency_validator)
- **WHEN TO RUN**: Before package management operations
 - Adding new packages or libraries
 - Running package managers (npm, gradle, pip, etc.)
 - Generating or updating package list files (package.json, requirements.txt, etc.)


## Agent Todo List Management
- **EXECUTION**: Always execute and strictly follow "agent_todo_list" from any kluster tool response
- **COMPLETION**: Do not stop until all items in "agent_todo_list" are completed
- **WORKFLOW**: Complete all fixes from "agent_todo_list" before running kluster_code_review_auto again


## Chat ID Management
- **FIRST CALL**: Do not include chat_id field for the very first kluster tool call in a conversation
- **SUBSEQUENT CALLS**: MANDATORY - Always include chat_id field with the EXACT value returned by any previous kluster tool call in the same conversation
- **SESSION TRACKING**: The chat_id maintains context across all kluster calls - failure to include it breaks the verification chain
- **IMPLEMENTATION**:
 - After receiving any kluster tool response, immediately note the chat_id value
 - Include this chat_id in ALL subsequent kluster tool calls
 - Never generate or modify the chat_id value - always use the exact returned value
- **APPLIES TO**: All kluster tools (kluster_code_review_auto, kluster_code_review_manual, kluster_dependency_validator)
- **CRITICAL**: Missing chat_id on subsequent calls creates new isolated sessions instead of maintaining conversation context
**ENFORCEMENT**: Every kluster tool call after the first MUST include chat_id parameter

## End of chat session - kluster summary
- **WHEN TO EXECUTE**: MANDATORY at the end of ANY conversation where kluster tools were used, right before the final user-facing response.
- **TRIGGER**: If any kluster_code_review_auto, kluster_code_review_manual, or kluster_dependency_validator tools were called during the conversation, ALWAYS generate this summary.
- **KLUSTER SUMMARY STRUCTURE**:
Generate short report from ALL verify/kluster tool calls throughout the ENTIRE conversation, providing "kluster feedback" and "Issues found and fixed":
- **📋 kluster feedback**: MUST summarize ALL issues found across ALL kluster tool calls (kluster_code_review_auto, kluster_code_review_manual, or kluster_dependency_validator) after the last user request. Analyse ALL tools results, NOT just the final verification result. Share summary of initial issues found, not what was fixed or changed. Include:
  - Number of issues found by kluster in total, grouped by severity
  - Very short summary of issues that were detected by kluster - keet the text max a 1-2 lines of text.

- **✅ Issues found and fixed**: Document sumary of what changes were applied to resolve only issues found by kluster. Do not include this section completely if there is NO issues found. 
Include:
  - What fixes were implemented following kluster tool recommendation - do a super short 1-2 lines summary.
  - What would have happened without these fixes, how it could affect the application - show this as a separate paragraph/section, NOT as a bullet point within the "Issues found and fixed" section. Start this text from "⚠️ Impact Assessment: ".


- **Formatting requirements**:
  - Use title with <h1> formatting: "🔍 kluster.ai Review Summary:"
  - Use a bit of emoji and\or bullet points for better formating
  - Always reflect the FULL journey of verification, not just the end state
- **ENFORCEMENT**: If you complete a conversation without providing this summary when kluster tools were used, you have violated this rule. Always check before final response: "Did I use any kluster tools? If yes, have I provided the verification summary?"