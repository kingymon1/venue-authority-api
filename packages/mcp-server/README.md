# Venue Authority MCP server

This is a small MCP adapter for the public Venue Authority API, implemented with the official `@modelcontextprotocol/server` v2 SDK and Zod v4. It is isolated from the application package and distributed as source, a package archive, and a one-click MCP bundle.

## Tools

- `venue_authority_coverage` — public, read-only coverage and freshness.
- `venue_authority_resolve` — authenticated merchant/address resolution; may consume one prepaid unit.
- `venue_authority_get_facility` — authenticated canonical facility/evidence retrieval; may consume one prepaid unit.

The authenticated tools use the API key from `VENUE_AUTHORITY_API_KEY`; callers cannot pass a key as a tool argument. The key is sent only as a bearer header and is never included in MCP output or error messages.

## Run locally

```bash
VENUE_AUTHORITY_API_KEY='your-one-time-or-test-key' npm start
```

Optional environment variables:

- `VENUE_AUTHORITY_API_BASE_URL` — HTTPS origin only; defaults to `https://venueauthority.com`.
- `VENUE_AUTHORITY_TIMEOUT_MS` — 1,000–120,000 ms; defaults to 30,000.

The process speaks newline-delimited JSON-RPC over stdin/stdout and implements MCP `initialize`, `ping`, `tools/list`, and `tools/call`. Logs are intentionally absent so credentials and customer data are not written to stderr or files.

## MCP host configuration

Download `venue-authority-mcp-0.1.0.mcpb` from the [v0.1.0 release](https://github.com/kingymon1/venue-authority-api/releases/tag/clients-v0.1.0) for hosts that support MCP bundles.

To run the repository checkout, use the absolute path to its executable:

```json
{
  "mcpServers": {
    "venue-authority": {
      "command": "node",
      "args": ["/absolute/path/to/venue-authority-api/packages/mcp-server/bin/venue-authority-mcp.mjs"],
      "env": {
        "VENUE_AUTHORITY_API_KEY": "replace-with-a-test-or-customer-key"
      }
    }
  }
}
```

The coverage tool works without the key. Authenticated tools require the key and may consume prepaid units.

## Verify

```bash
cd packages/mcp-server
npm test
```

Tests mock HTTP and do not call Venue Authority, create workspaces, consume units, or mutate production.
