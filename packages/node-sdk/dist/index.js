export class VenueAuthorityError extends Error {
    status;
    requestId;
    body;
    constructor(status, body, message = body.error ?? `Venue Authority request failed with HTTP ${status}`) {
        super(message);
        this.name = "VenueAuthorityError";
        this.status = status;
        this.requestId = typeof body.requestId === "string" ? body.requestId : undefined;
        this.body = body;
    }
}
const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const defaultBaseUrl = "https://venueauthority.com";
const defaultTimeoutMs = 30_000;
const maxTimeoutMs = 120_000;
function assertRequestId(value) {
    if (!requestIdPattern.test(value))
        throw new TypeError("requestId must be 8 to 128 letters, numbers, periods, underscores, colons, or hyphens");
}
function requestId(value) {
    const generated = value ?? `va-sdk-${crypto.randomUUID()}`;
    assertRequestId(generated);
    return generated;
}
function pathSegment(value, label, maxLength) {
    if (!value || value.includes("/") || (maxLength !== undefined && value.length > maxLength))
        throw new TypeError(`${label} must be a non-empty path segment${maxLength ? ` of at most ${maxLength} characters` : ""}`);
    return encodeURIComponent(value);
}
function listData(body) {
    if (Array.isArray(body))
        return body;
    if (body && typeof body === "object" && Array.isArray(body.data))
        return body.data;
    return body;
}
function dataOf(body) {
    if (body && typeof body === "object" && "data" in body)
        return body.data;
    return body;
}
export class VenueAuthorityClient {
    baseUrl;
    apiKey;
    fetcher;
    timeoutMs;
    constructor(options = {}) {
        let parsedBaseUrl;
        try {
            parsedBaseUrl = new URL(options.baseUrl ?? defaultBaseUrl);
        }
        catch {
            throw new TypeError("baseUrl must be a valid HTTPS origin");
        }
        if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.username || parsedBaseUrl.password || parsedBaseUrl.pathname !== "/" || parsedBaseUrl.search || parsedBaseUrl.hash)
            throw new TypeError("baseUrl must be a credential-free HTTPS origin without a path, query, or fragment");
        this.baseUrl = parsedBaseUrl.origin;
        this.apiKey = options.apiKey;
        this.fetcher = options.fetch ?? globalThis.fetch;
        this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
        if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > maxTimeoutMs)
            throw new TypeError(`timeoutMs must be an integer from 1 to ${maxTimeoutMs}`);
        if (typeof this.fetcher !== "function")
            throw new TypeError("A fetch implementation is required");
    }
    async request(path, init = {}, authenticated = true) {
        if (authenticated && !this.apiKey)
            throw new Error("An apiKey is required for this operation");
        const headers = new Headers(init.headers);
        headers.set("accept", "application/json");
        if (authenticated && this.apiKey)
            headers.set("authorization", `Bearer ${this.apiKey}`);
        if (init.body !== undefined && !headers.has("content-type"))
            headers.set("content-type", "application/json");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        if (init.signal?.aborted)
            controller.abort();
        else
            init.signal?.addEventListener("abort", () => controller.abort(), { once: true });
        let response;
        try {
            response = await this.fetcher(new URL(path, `${this.baseUrl}/`).toString(), { ...init, headers, signal: controller.signal });
        }
        finally {
            clearTimeout(timer);
        }
        const text = await response.text();
        let body = undefined;
        if (text) {
            try {
                body = JSON.parse(text);
            }
            catch {
                body = { data: text };
            }
        }
        if (!response.ok) {
            const errorBody = body && typeof body === "object" ? body : {};
            throw new VenueAuthorityError(response.status, errorBody);
        }
        return body;
    }
    /** Read current source coverage without an API key or unit charge. */
    getCoverage() {
        return this.request("/api/v1/coverage", {}, false);
    }
    resolveFacility(input, options = {}) {
        if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 300 || typeof input.address !== "string" || !input.address.trim() || input.address.length > 500)
            throw new TypeError("name must be 1 to 300 characters and address must be 1 to 500 characters");
        return this.request("/api/v1/resolve", { method: "POST", headers: { "x-request-id": requestId(options.requestId) }, body: JSON.stringify({ name: input.name, address: input.address }) });
    }
    getFacility(id, options = {}) {
        return this.request(`/api/v1/facilities/${pathSegment(id, "facilityId", 200)}`, { headers: { "x-request-id": requestId(options.requestId) } });
    }
    async listPortfolios() { return listData(await this.request("/api/v1/portfolios")); }
    async createPortfolio(name) {
        if (!name.trim() || name.length > 80)
            throw new TypeError("name must be 1 to 80 characters");
        return dataOf(await this.request("/api/v1/portfolios", { method: "POST", body: JSON.stringify({ name }) }));
    }
    async listPortfolioItems(portfolioId) { return listData(await this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/items`)); }
    async addPortfolioItem(portfolioId, jurisdiction, sourceId) {
        if (!jurisdiction.trim() || !sourceId.trim())
            throw new TypeError("jurisdiction and sourceId are required");
        return dataOf(await this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/items`, { method: "POST", body: JSON.stringify({ jurisdiction, sourceId }) }));
    }
    async deletePortfolioItem(portfolioId, itemId) { return this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/items/${pathSegment(itemId, "itemId")}`, { method: "DELETE" }); }
    async listPortfolioEvents(portfolioId) { return listData(await this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/events`)); }
    async listWebhooks() { return listData(await this.request("/api/v1/webhooks")); }
    async createWebhook(url) {
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            throw new TypeError("url must be a valid URL");
        }
        if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443"))
            throw new TypeError("url must be a credential-free HTTPS URL on the standard HTTPS port");
        return dataOf(await this.request("/api/v1/webhooks", { method: "POST", body: JSON.stringify({ url }) }));
    }
    async deleteWebhook(webhookId) { return this.request(`/api/v1/webhooks/${pathSegment(webhookId, "webhookId")}`, { method: "DELETE" }); }
    async listWebhookDeliveries(options = {}) {
        const query = options.webhookId ? `?webhookId=${encodeURIComponent(options.webhookId)}` : "";
        return listData(await this.request(`/api/v1/webhooks/deliveries${query}`));
    }
    createAuditExport(requestIds, options = {}) {
        if (!Array.isArray(requestIds) || requestIds.length < 1 || requestIds.length > 100 || requestIds.some((id) => typeof id !== "string" || !requestIdPattern.test(id)))
            throw new TypeError("requestIds must contain 1 to 100 valid request IDs");
        return this.request("/api/v1/audit-exports", { method: "POST", headers: { "x-request-id": requestId(options.requestId) }, body: JSON.stringify({ requestIds, format: options.format ?? "json" }) }).then(data => dataOf(data));
    }
    downloadAuditExport(exportId) { return this.request(`/api/v1/audit-exports/${pathSegment(exportId, "auditExportId")}`); }
}
export { requestIdPattern };
