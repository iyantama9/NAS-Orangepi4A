---
name: review-changes
description: >-
  Use this skill when performing code reviews, reviewing PRs, assessing blast radius, or evaluating test coverage using code-review-graph.
---

# Review Changes with code-review-graph

Perform a structured, risk-aware, token-efficient code review using the knowledge graph.

> [!NOTE]
> Always pass `repo_root` with the workspace root path in tool arguments (e.g. `repo_root: "d:/Project/NAS Orange Pi 4A/nas-orange-pi"`).

## Step-by-Step Review Workflow

1. **Analyze changes & risk score**:
   - Call `call_mcp_tool` with `ServerName: "code-review-graph"`, `ToolName: "detect_changes_tool"`, `Arguments: {"repo_root": "<workspace_path>"}` to obtain risk-scored changes, affected nodes, and risk level (High / Medium / Low).

2. **Check affected execution flows**:
   - Call `call_mcp_tool` with `ServerName: "code-review-graph"`, `ToolName: "get_affected_flows_tool"`, `Arguments: {"repo_root": "<workspace_path>"}` to see which end-to-end execution flows pass through modified functions.

3. **Check test coverage & test gaps**:
   - For modified high-risk functions, call `query_graph_tool` with `pattern="tests_for"`, `target="<node_name>"`, and `repo_root="<workspace_path>"` to see if tests exist.
   - Note any modified functions lacking test coverage as potential regression risks.

4. **Assess blast radius**:
   - Call `get_impact_radius_tool` with the modified file path and `repo_root="<workspace_path>"` to determine all downstream callers and dependents.

5. **Retrieve targeted source context**:
   - Call `get_review_context_tool` with `repo_root="<workspace_path>"` to get concise, relevant snippets rather than reading whole files.

## Review Report Structure
Format findings clearly:
- **Risk Assessment**: High / Medium / Low with rationale.
- **Affected Workflows**: Downstream flows and critical call chains impacted.
- **Test Coverage**: Tested functions vs missing tests.
- **Recommendations**: Specific fixes or test cases to add before merging.
