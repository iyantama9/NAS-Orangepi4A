<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has an incremental knowledge graph indexed with code-review-graph. ALWAYS use the code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore the codebase.**
The graph is faster, much cheaper (orders of magnitude fewer tokens), and gives structural context (callers, callees, imports, dependents, and test coverage) that flat file scanning cannot provide.

The MCP server is registered as `code-review-graph`. To use these tools in Antigravity, call `call_mcp_tool` with `ServerName: "code-review-graph"` and `ToolName: "<tool_name>"`.

### When to use graph tools FIRST

- **Exploring code & searching symbols**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep / ripgrep.
- **Understanding impact & blast radius**: `get_impact_radius_tool` instead of manually tracing imports.
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire source files.
- **Finding relationships**: `query_graph_tool` with pattern `callers_of`, `callees_of`, `imports_of`, `children_of`, or `tests_for`.
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`.
- **Execution flows**: `list_flows_tool` and `get_flow_tool` to understand full execution traces.

Fall back to grep/glob/view_file **only** when the graph does not cover what you need.

### Key Tools Reference

| Tool Name | Purpose / When to use |
|---|---|
| `detect_changes_tool` | Reviewing code changes — returns risk-scored analysis (High/Med/Low) |
| `get_review_context_tool` | Retrieve minimal token-efficient source snippets for code review |
| `get_impact_radius_tool` | Understand blast radius and downstream dependents of modified files |
| `get_affected_flows_tool` | Discover which high-level execution flows are impacted by changes |
| `query_graph_tool` | Trace callers, callees, imports, children, tests, and dependencies |
| `semantic_search_nodes_tool` | Locate functions, classes, and types by name, route, or keyword |
| `get_architecture_overview_tool` | High-level codebase architecture and module coupling overview |
| `list_communities_tool` / `get_community_tool` | Explore functional clusters and domain boundaries |
| `find_large_functions_tool` | Identify complex or oversized functions for refactoring |
| `refactor_tool` / `apply_refactor_tool` | Preview and execute symbol renames and dead-code removal |

### Recommended Review & Exploration Workflow

1. Start by running `get_minimal_context_tool(task="<your task>")` or `get_architecture_overview_tool`.
2. When reviewing changes, invoke `detect_changes_tool` first, followed by `get_affected_flows_tool`.
3. Check test coverage on modified nodes with `query_graph_tool(pattern="tests_for", node_id="<id>")`.
4. Use `get_review_context_tool` to inspect only the relevant code snippets.
