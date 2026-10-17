"""Ripple as an MCP server (stdio). Tools are generated from tools.SPEC / tools.FUNCS, so the catalog
stays single-source. Run: python -m ripple.mcp_server"""

import asyncio
import json
import sys

import anyio
import mcp_types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .env import load_env

load_env()

from . import tools  # noqa: E402
from .db import TracedGraph, graph  # noqa: E402


def _text(payload: dict, is_error: bool = False) -> types.CallToolResult:
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=json.dumps(payload, default=str))],
        is_error=is_error,
    )


def _run_tool(name: str, args: dict) -> types.CallToolResult:
    """Blocking: run one catalog tool against a traced graph; always returns a result, never raises."""
    fn = tools.FUNCS.get(name)
    if fn is None:
        return _text({"error": f"Unknown tool {name!r}"}, True)
    g = TracedGraph(graph())
    try:
        out = fn(g, **(args or {}))
    except tools.ToolError as e:
        return _text({"error": str(e), "queries": _queries(g)}, True)
    except TypeError as e:  # missing / unexpected arguments
        return _text({"error": f"Bad arguments for {name}: {e}", "queries": _queries(g)}, True)
    except Exception as e:  # DB down, etc. - surface to the client instead of killing the server
        return _text({"error": f"{type(e).__name__}: {e}", "queries": _queries(g)}, True)
    return _text({**out, "queries": _queries(g)})


def _queries(g: TracedGraph) -> list[dict]:
    return [{"name": q["name"], "ms": q["ms"]} for q in g.log]


async def list_tools(ctx, params) -> types.ListToolsResult:
    return types.ListToolsResult(tools=[
        types.Tool(name=s["name"], description=s["description"], input_schema=s["input_schema"])
        for s in tools.SPEC
    ])


async def call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
    return await anyio.to_thread.run_sync(_run_tool, params.name, dict(params.arguments or {}))


server = Server("ripple", on_list_tools=list_tools, on_call_tool=call_tool)


async def main() -> None:
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
