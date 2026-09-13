---
name: refactor-safely
description: >-
  Use this skill when planning renames, eliminating dead code, decomposing large functions, or safely modifying shared components using code-review-graph.
---

# Refactor Safely with code-review-graph

Perform safe, dependency-aware refactoring with confidence using the structural knowledge graph.

> [!NOTE]
> Always pass `repo_root` with the workspace root path in tool arguments (e.g. `repo_root: "d:/Project/NAS Orange Pi 4A/nas-orange-pi"`).

## Step-by-Step Refactoring Workflow

1. **Identify refactoring targets**:
   - Call `call_mcp_tool` with `ServerName: "code-review-graph"`, `ToolName: "find_large_functions_tool"`, `Arguments: {"repo_root": "<workspace_path>"}` to find oversized functions or high cyclomatic complexity.
   - Call `refactor_tool` with `mode="dead_code"`, `repo_root="<workspace_path>"` to detect unused/unreferenced code.
   - Call `refactor_tool` with `mode="suggest"`, `repo_root="<workspace_path>"` to get community-based modularity suggestions.

2. **Preview renames**:
   - For symbol or function renames, run `refactor_tool` with `mode="rename"`, `source_name="<symbol>"`, `target_name="<new_name>"`, and `repo_root="<workspace_path>"`.
   - Carefully review the proposed replacement list before applying.

3. **Check blast radius & flows**:
   - Call `get_impact_radius_tool` with `repo_root="<workspace_path>"` on affected files to ensure callers in other modules are accounted for.
   - Call `get_affected_flows_tool` with `repo_root="<workspace_path>"` to confirm critical workflows remain intact.

4. **Apply and verify**:
   - Apply edits (or use `apply_refactor_tool` if applicable).
   - Run `detect_changes_tool` with `repo_root="<workspace_path>"` to verify that the refactor only touched expected boundaries.
