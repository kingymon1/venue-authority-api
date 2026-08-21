import {describe, expect, it} from "vitest";
import {VenueAuthorityClient, VenueAuthorityError} from "../src/index.js";

function fakeFetch(responses: Array<{status?: number; body: unknown}>) {
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const fetcher: typeof globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});
    const next = responses.shift() ?? {body: {}};
    return new Response(typeof next.body === "string" ? next.body : JSON.stringify(next.body), {status: next.status ?? 200, headers: {"content-type": "application/json"}});
  };
  return {fetcher, calls};
}

describe("VenueAuthorityClient", () => {
  it("reads public coverage without sending bearer auth", async () => {
    const mock = fakeFetch([{body: {data: []}}]);
    const client = new VenueAuthorityClient({apiKey: "va_test_example", fetch: mock.fetcher});
    await client.getCoverage();
    expect(new Headers(mock.calls[0].init?.headers).get("authorization")).toBeNull();
    expect(mock.calls[0].url).toBe("https://venueauthority.com/api/v1/coverage");
  });

  it("validates a credential-free HTTPS origin and bounded timeout", async () => {
    expect(() => new VenueAuthorityClient({baseUrl: "http://example.com"})).toThrow("HTTPS origin");
    expect(() => new VenueAuthorityClient({baseUrl: "https://user:pass@example.com"})).toThrow("credential-free");
    expect(() => new VenueAuthorityClient({baseUrl: "https://example.com/api"})).toThrow("without a path");
    expect(() => new VenueAuthorityClient({timeoutMs: 0})).toThrow("timeoutMs");
    const fetcher: typeof globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {once: true});
    });
    await expect(new VenueAuthorityClient({timeoutMs: 5, fetch: fetcher}).getCoverage()).rejects.toThrow("aborted");
  });

  it("matches the resolve endpoint's 300/500 character bounds", async () => {
    const mock = fakeFetch([{body: {disposition: "accepted", reason: "ok", requestId: "resolve-1", sourceAttribution: null}}]);
    const client = new VenueAuthorityClient({apiKey: "va_test_example", fetch: mock.fetcher});
    await client.resolveFacility({name: "n".repeat(300), address: "a".repeat(500)}, {requestId: "resolve-1"});
    expect(() => client.resolveFacility({name: "n".repeat(301), address: "a"})).toThrow("1 to 300");
    expect(() => client.resolveFacility({name: "n", address: "a".repeat(501)})).toThrow("1 to 500");
  });

  it("sends bearer auth and stable request ID for resolution", async () => {
    const mock = fakeFetch([{body: {disposition: "accepted", reason: "ok", requestId: "resolve-1", sourceAttribution: null}}]);
    const client = new VenueAuthorityClient({apiKey: "va_test_example", fetch: mock.fetcher});
    await client.resolveFacility({name: "Example", address: "1 Main St"}, {requestId: "resolve-1"});
    const headers = new Headers(mock.calls[0].init?.headers);
    expect(headers.get("authorization")).toBe("Bearer va_test_example");
    expect(headers.get("x-request-id")).toBe("resolve-1");
    expect(JSON.parse(String(mock.calls[0].init?.body))).toEqual({name: "Example", address: "1 Main St"});
  });

  it("covers portfolio, webhook, and export routes with typed convenience methods", async () => {
    const mock = fakeFetch([
      {body: {data: [{id: "p1", name: "Watchlist"}]}}, {body: {data: {id: "p1", name: "Watchlist"}}},
      {body: {data: []}}, {body: {data: {id: "i1"}}}, {body: {ok: true}}, {body: {data: []}},
      {body: {data: [{id: "w1"}]}}, {body: {data: {id: "w1", url: "https://example.com/hook"}}}, {body: {ok: true}}, {body: {data: []}},
      {body: {data: {id: "e1", sha256: "a".repeat(64)}}}, {body: {id: "e1", bytes: "{}"}},
    ]);
    const client = new VenueAuthorityClient({apiKey: "va_test_example", fetch: mock.fetcher});
    await client.listPortfolios(); expect((await client.createPortfolio("Watchlist")).id).toBe("p1"); await client.listPortfolioItems("p1"); expect((await client.addPortfolioItem("p1", "nyc", "50069801")).id).toBe("i1"); await client.deletePortfolioItem("p1", "i1"); await client.listPortfolioEvents("p1");
    await client.listWebhooks(); expect((await client.createWebhook("https://example.com/hook")).id).toBe("w1"); await client.deleteWebhook("w1"); await client.listWebhookDeliveries({webhookId: "w1"});
    expect((await client.createAuditExport(["resolve-1"])).id).toBe("e1"); await client.downloadAuditExport("e1");
    expect(mock.calls).toHaveLength(12);
  });

  it("surfaces structured API errors and rejects unsafe client input", async () => {
    const mock = fakeFetch([{status: 402, body: {error: "The prepaid balance is exhausted.", requestId: "resolve-1"}}]);
    const client = new VenueAuthorityClient({apiKey: "va_test_example", fetch: mock.fetcher});
    await expect(client.resolveFacility({name: "Example", address: "1 Main St"}, {requestId: "resolve-1"})).rejects.toMatchObject({status: 402, requestId: "resolve-1"});
    await expect(client.createWebhook("http://example.com/hook")).rejects.toThrow("HTTPS");
    await expect(client.createWebhook("https://user:secret@example.com/hook")).rejects.toThrow("credential-free");
    expect(() => client.getFacility("x".repeat(201))).toThrow("at most 200");
    expect(() => client.resolveFacility({name: "Example", address: "1 Main St"}, {requestId: "bad"})).toThrow("requestId");
    expect(() => new VenueAuthorityError(400, {error: "bad"})).not.toThrow();
  });
});
