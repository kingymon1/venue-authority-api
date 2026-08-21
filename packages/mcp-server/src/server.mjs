import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const DEFAULT_API_BASE_URL = "https://venueauthority.com";
const DEFAULT_TIMEOUT_MS = 30_000;

function apiBaseUrl(raw) {
  const value = raw || DEFAULT_API_BASE_URL;
  let url;
  try { url = new URL(value); } catch { throw new Error("api_base_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("api_base_url_must_be_https_origin");
  return url.origin;
}

function timeoutMs(raw) {
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 120_000) throw new Error("timeout_invalid");
  return value;
}

const optionalRequestId = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/).optional();
const coverageSchema = z.object({}).strict();
const resolveSchema = z.object({
  name: z.string().trim().min(1).max(300),
  address: z.string().trim().min(1).max(500),
  requestId: optionalRequestId,
}).strict();
const facilitySchema = z.object({
  id: z.string().trim().min(1).max(200),
  requestId: optionalRequestId,
}).strict();

async function callApi(path, { method = "GET", body, apiKey, requestId: suppliedRequestId, fetcher = fetch, baseUrl, timeout } = {}) {
  const url = new URL(path, baseUrl);
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (suppliedRequestId) headers["x-request-id"] = suppliedRequestId;
  const response = await fetcher(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout), cache: "no-store" });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: "invalid_json_response" }; }
  return { status: response.status, ok: response.ok, data };
}

function resultFor(response) {
  return {
    content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
    structuredContent: { httpStatus: response.status, ok: response.ok, data: response.data },
    isError: !response.ok,
  };
}

function toolError(error) {
  return { content: [{ type: "text", text: error instanceof Error ? error.message : "request_failed" }], isError: true };
}

export function createVenueAuthorityMcpServer({ env = process.env, fetcher = fetch } = {}) {
  const baseUrl = apiBaseUrl(env.VENUE_AUTHORITY_API_BASE_URL);
  const apiKey = env.VENUE_AUTHORITY_API_KEY?.trim();
  const timeout = timeoutMs(env.VENUE_AUTHORITY_TIMEOUT_MS);
  const server = new McpServer({ name: "venue-authority", version: "0.1.0" });

  server.registerTool("venue_authority_coverage", {
    title: "Venue Authority coverage",
    description: "Read current supported regulator sources, record counts, availability, and freshness. Public and not metered.",
    inputSchema: coverageSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async () => {
    try { return resultFor(await callApi("/api/v1/coverage", { baseUrl, timeout, fetcher })); }
    catch (error) { return toolError(error); }
  });

  server.registerTool("venue_authority_resolve", {
    title: "Venue Authority resolve",
    description: "Resolve a merchant name and street address against supported regulator records. Requires VENUE_AUTHORITY_API_KEY and may consume one prepaid unit; exact replays are not charged twice.",
    inputSchema: resolveSchema,
    annotations: { openWorldHint: true },
  }, async ({ name, address, requestId }) => {
    if (!apiKey) return toolError(new Error("authenticated_api_key_not_configured"));
    try { return resultFor(await callApi("/api/v1/resolve", { method: "POST", body: { name, address }, apiKey, requestId: requestId ?? `mcp-${crypto.randomUUID()}`, baseUrl, timeout, fetcher })); }
    catch (error) { return toolError(error); }
  });

  server.registerTool("venue_authority_get_facility", {
    title: "Venue Authority facility",
    description: "Retrieve one canonical regulator facility and its source-linked evidence. Requires VENUE_AUTHORITY_API_KEY and may consume one prepaid unit.",
    inputSchema: facilitySchema,
    annotations: { openWorldHint: true },
  }, async ({ id, requestId }) => {
    if (!apiKey) return toolError(new Error("authenticated_api_key_not_configured"));
    try { return resultFor(await callApi(`/api/v1/facilities/${encodeURIComponent(id)}`, { apiKey, requestId: requestId ?? `mcp-${crypto.randomUUID()}`, baseUrl, timeout, fetcher })); }
    catch (error) { return toolError(error); }
  });

  return server;
}

export async function startStdioServer(options = {}) {
  const server = createVenueAuthorityMcpServer(options);
  await server.connect(new StdioServerTransport());
  return server;
}
