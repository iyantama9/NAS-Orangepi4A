---
name: explore-codebase
description: >-
  Use this skill when navigating, understanding architecture, searching functions/classes, or tracing dependencies in a repository indexed with code-review-graph.
---

# Explore Codebase with code-review-graph

Use the `code-review-graph` MCP tools to explore and understand the codebase efficiently without reading entire files or scanning with grep/glob.

> [!NOTE]
> Always pass `repo_root` with the workspace root path in tool arguments (e.g. `repo_root: "d:/Project/NAS Orange Pi 4A/nas-orange-pi"`) so the MCP server targets the right repository database.

## Step-by-Step Workflow

1. **Check metrics & high-level structure**:
   - Call `call_mcp_tool` with `ServerName: "code-review-graph"`, `ToolName: "list_graph_stats_tool"`, `Arguments: {"repo_root": "<workspace_path>"}` to see overall codebase metrics.
   - Call `call_mcp_tool` with `ServerName: "code-review-graph"`, `ToolName: "get_architecture_overview_tool"`, `Arguments: {"repo_root": "<workspace_path>"}` to see high-level community structure and module coupling.

2. **Inspect communities & modules**:
   - Call `list_communities_tool` to find major functional areas and clusters.
   - Call `get_community_tool` with `community_id` to inspect key members, hubs, and boundaries.

3. **Locate symbols**:
   - Call `semantic_search_nodes_tool` with `query="<symbol or concept>"`, `repo_root="<workspace_path>"`, `detail_level="minimal"` to find functions, classes, or types by name or semantic intent.

4. **Trace relationships**:
   - Call `query_graph_tool` with `repo_root="<workspace_path>"`, `target="<node_name_or_path>"`, and `pattern`:
     - `"callers_of"`: find who calls this function.
     - `"callees_of"`: find what this function calls.
     - `"imports_of"`: find dependencies imported by this file/node.
     - `"children_of"`: view all functions, classes, and types inside a file.

5. **Understand execution paths**:
   - Call `list_flows_tool` with `repo_root="<workspace_path>"` to list key execution flows.
   - Call `get_flow_tool` with `flow_id` and `repo_root="<workspace_path>"` to trace end-to-end execution flow.

## Token Efficiency Rules
- Prefer `get_minimal_context_tool(task="<your task>", repo_root="<workspace_path>")` before querying broadly.
- Use `detail_level="minimal"` whenever available. Escalate to `"standard"` only if necessary.
- Avoid falling back to grep/find unless the graph does not cover the file or grammar.
