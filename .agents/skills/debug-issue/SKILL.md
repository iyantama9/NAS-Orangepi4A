---
name: debug-issue
description: >-
  Use this skill when investigating bugs, tracing call hierarchies, finding root causes, or diagnosing regressions using code-review-graph.
---

# Debug Issue with code-review-graph

Use the structural graph to quickly trace execution paths, find callers/callees, and isolate bugs without burning tokens scanning the repo.

> [!NOTE]
> Always pass `repo_root` with the workspace root path in tool arguments (e.g. `repo_root: "d:/Project/NAS Orange Pi 4A/nas-orange-pi"`).

## Step-by-Step Debug Workflow

1. **Locate suspect code**:
   - Call `call_mcp_tool` with `ServerName: "code-review-graph"`, `ToolName: "semantic_search_nodes_tool"`, `Arguments: {"query": "<keywords>", "repo_root": "<workspace_path>", "detail_level": "minimal"}` using error message keywords, function names, or route endpoints.

2. **Trace call chains**:
   - Call `query_graph_tool` with `pattern="callers_of"`, `target="<node_name>"`, `repo_root="<workspace_path>"` to trace where calls originate.
   - Call `query_graph_tool` with `pattern="callees_of"`, `target="<node_name>"`, `repo_root="<workspace_path>"` to trace downstream function invocations.

3. **Inspect full execution flow**:
   - Call `get_flow_tool` with `flow_id` and `repo_root="<workspace_path>"` to view the sequence of steps and data flow through the suspected area.

4. **Check recent changes for regressions**:
   - Call `detect_changes_tool` with `repo_root="<workspace_path>"` to determine whether recent modifications touched suspect functions.

5. **Examine impact radius**:
   - Call `get_impact_radius_tool` with `repo_root="<workspace_path>"` on suspected files to check what dependencies might be feeding bad state into the failing component.
