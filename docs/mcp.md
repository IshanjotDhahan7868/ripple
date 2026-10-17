# Ripple MCP server

Exposes Ripple's fixed tool catalog (`ripple/tools.py`: `SPEC` + `FUNCS`) to any MCP client over stdio.
Tools are generated from `SPEC`, so the catalog stays single-source. The model never writes Cypher.
Every result is JSON text and includes `"queries": [{"name", "ms"}]`, the FalkorDB queries that ran.
Errors (`ToolError`, bad arguments, DB failures) come back as results with `isError: true` and `{"error": "..."}`.

## Run

```bash
cd ~/Projects/ripple
.venv/bin/python -m ripple.mcp_server
```

It loads `.env` (real environment variables win), then talks to FalkorDB per `FALKORDB_HOST/PORT/USERNAME/PASSWORD`
and graph `RIPPLE_GRAPH` (default `ripple`). For the local Docker instance:
`FALKORDB_HOST=localhost FALKORDB_PORT=6380 FALKORDB_USERNAME= FALKORDB_PASSWORD=`.

## Claude Code

```bash
claude mcp add ripple -- /home/ishan/Projects/ripple/.venv/bin/python -m ripple.mcp_server
```

## Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "ripple": {
      "command": "/home/ishan/Projects/ripple/.venv/bin/python",
      "args": ["-m", "ripple.mcp_server"],
      "cwd": "/home/ishan/Projects/ripple"
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `search_drivers` | Full-text search for driver ids. Call first. |
| `analyze_impact` | Propagate a shock (1-4 driver ids, direction +1/-1, depth) to affected drivers and assets, with exact paths. |
| `recall_events` | Past events (last N days) that hit given drivers. |
| `explain_link` | Shortest causal path between two drivers. |
| `systemic_drivers` | Most load-bearing drivers by PageRank. |
| `record_alert` | Write: save an Event and file an alert flagging tickers. |

`record_alert` mutates the graph; clients should confirm before calling it.
