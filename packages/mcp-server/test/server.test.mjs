import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createVenueAuthorityMcpServer } from "../src/server.mjs";

function response(status, data) { return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data) }; }

async function connectedMemoryServer(options) {
  const server = createVenueAuthorityMcpServer(options);
  const client = new Client({ name: "venue-authority-mcp-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

test("coverage is public and does not send an authorization header", async () => {
  let seen;
  const { server, client } = await connectedMemoryServer({ env: {}, fetcher: async (url, options) => { seen = { url: String(url), options }; return response(200, { data: [{ id: "nyc", availability: "available" }] }); } });
  const result = await client.callTool({ name: "venue_authority_coverage", arguments: {} });
  assert.equal(result.isError, false);
  assert.equal(seen.url, "https://venueauthority.com/api/v1/coverage");
  assert.equal(seen.options.headers.authorization, undefined);
  await client.close(); await server.close();
});

test("API base URL must be a credential-free HTTPS origin", () => {
  assert.throws(
    () => createVenueAuthorityMcpServer({ env: { VENUE_AUTHORITY_API_BASE_URL: "https://example.com/api" } }),
    /api_base_url_must_be_https_origin/,
  );
});

test("resolve forwards bearer key and request id without putting the key in the body", async () => {
  let seen;
  const { server, client } = await connectedMemoryServer({ env: { VENUE_AUTHORITY_API_KEY: "secret-test-key" }, fetcher: async (url, options) => { seen = { url: String(url), options }; return response(200, { decision: "accepted" }); } });
  const result = await client.callTool({ name: "venue_authority_resolve", arguments: { name: "Example Cafe", address: "1 Main Street", requestId: "stable-1" } });
  assert.equal(result.isError, false);
  assert.equal(seen.options.headers.authorization, "Bearer secret-test-key");
  assert.equal(seen.options.headers["x-request-id"], "stable-1");
  assert.deepEqual(JSON.parse(seen.options.body), { name: "Example Cafe", address: "1 Main Street" });
  await client.close(); await server.close();
});

test("authenticated tools return a tool error before network without a key", async () => {
  let calls = 0;
  const { server, client } = await connectedMemoryServer({ env: {}, fetcher: async () => { calls += 1; return response(200, {}); } });
  const result = await client.callTool({ name: "venue_authority_resolve", arguments: { name: "A", address: "B" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /authenticated_api_key_not_configured/);
  assert.equal(calls, 0);
  await client.close(); await server.close();
});

test("real SDK client discovers the three tools over stdio", async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ["bin/venue-authority-mcp.mjs"], cwd: process.cwd(), env: { VENUE_AUTHORITY_API_BASE_URL: "https://venueauthority.com" }, stderr: "pipe" });
  const client = new Client({ name: "venue-authority-mcp-test", version: "0.1.0" });
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name), ["venue_authority_coverage", "venue_authority_resolve", "venue_authority_get_facility"]);
  assert.match(listed.tools[1].description, /may consume one prepaid unit/);
  assert.equal(listed.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.tools[1].annotations.readOnlyHint, undefined);
  await client.close();
});

test("request IDs follow the public contract", async () => {
  let calls = 0;
  const { server, client } = await connectedMemoryServer({ env: { VENUE_AUTHORITY_API_KEY: "key" }, fetcher: async () => { calls += 1; return response(200, {}); } });
  const invalid = await client.callTool({ name: "venue_authority_resolve", arguments: { name: "A", address: "B", requestId: "short" } });
  assert.equal(invalid.isError, true);
  assert.equal(calls, 0);
  const valid = await client.callTool({ name: "venue_authority_resolve", arguments: { name: "A", address: "B", requestId: "req-1234" } });
  assert.equal(valid.isError, false);
  await client.close(); await server.close();
});

test("facility identifiers are encoded and API errors do not expose credentials", async () => {
  let seen;
  const { server, client } = await connectedMemoryServer({ env: { VENUE_AUTHORITY_API_KEY: "do-not-leak" }, fetcher: async (url) => { seen = String(url); return response(401, { error: "invalid key" }); } });
  const result = await client.callTool({ name: "venue_authority_get_facility", arguments: { id: "source/id with spaces" } });
  assert.equal(seen, "https://venueauthority.com/api/v1/facilities/source%2Fid%20with%20spaces");
  assert.equal(result.isError, true);
  assert.doesNotMatch(JSON.stringify(result), /do-not-leak/);
  const tooLong = await client.callTool({ name: "venue_authority_get_facility", arguments: { id: "x".repeat(201) } });
  assert.equal(tooLong.isError, true);
  await client.close(); await server.close();
});
