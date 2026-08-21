export type RequestId = string;

export type SourceClass = "food_inspection" | "food_business_license" | "alcohol_license" | "hospitality_license";

export interface VenueAuthorityErrorBody { error?: string; requestId?: string; [key: string]: unknown }

export class VenueAuthorityError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly body: VenueAuthorityErrorBody;

  constructor(status: number, body: VenueAuthorityErrorBody, message = body.error ?? `Venue Authority request failed with HTTP ${status}`) {
    super(message);
    this.name = "VenueAuthorityError";
    this.status = status;
    this.requestId = typeof body.requestId === "string" ? body.requestId : undefined;
    this.body = body;
  }
}

export interface CoverageResponse { [key: string]: unknown }
export interface ResolveRequest { name: string; address: string }
export interface SourceAttribution {
  sourceId?: string;
  sourceClass?: SourceClass;
  sourceClassLabel?: string;
  attribution?: string;
  requiredNotice?: string | null;
  licenseUrl?: string;
  modificationNotice?: string;
}
export interface ResolutionResponse {
  disposition: "accepted" | "rejected";
  reason: string;
  requestId: string;
  sourceAttribution: SourceAttribution | null;
  record?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface FacilityResponse { [key: string]: unknown }
export interface Portfolio { id?: string; name?: string; [key: string]: unknown }
export interface PortfolioItem { id?: string; jurisdiction?: string; sourceId?: string; [key: string]: unknown }
export interface PortfolioEvent { [key: string]: unknown }
export interface Webhook { id?: string; url?: string; [key: string]: unknown }
export interface WebhookDelivery { [key: string]: unknown }
export interface AuditExport { id?: string; sha256?: string; [key: string]: unknown }

export interface VenueAuthorityClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface ResolveOptions { requestId?: RequestId }
export interface GetFacilityOptions { requestId?: RequestId }
export interface CreateAuditExportOptions { requestId?: RequestId; format?: "json" }
export interface ListWebhookDeliveriesOptions { webhookId?: string }

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const defaultBaseUrl = "https://venueauthority.com";
const defaultTimeoutMs = 30_000;
const maxTimeoutMs = 120_000;

function assertRequestId(value: string): void {
  if (!requestIdPattern.test(value)) throw new TypeError("requestId must be 8 to 128 letters, numbers, periods, underscores, colons, or hyphens");
}

function requestId(value?: string): string {
  const generated = value ?? `va-sdk-${crypto.randomUUID()}`;
  assertRequestId(generated);
  return generated;
}

function pathSegment(value: string, label: string, maxLength?: number): string {
  if (!value || value.includes("/") || (maxLength !== undefined && value.length > maxLength)) throw new TypeError(`${label} must be a non-empty path segment${maxLength ? ` of at most ${maxLength} characters` : ""}`);
  return encodeURIComponent(value);
}

function listData<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && Array.isArray((body as {data?: unknown}).data)) return (body as {data: T[]}).data;
  return body as T[];
}

function dataOf<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) return (body as {data: T}).data;
  return body as T;
}

export class VenueAuthorityClient {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: VenueAuthorityClientOptions = {}) {
    let parsedBaseUrl: URL;
    try { parsedBaseUrl = new URL(options.baseUrl ?? defaultBaseUrl); } catch { throw new TypeError("baseUrl must be a valid HTTPS origin"); }
    if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.username || parsedBaseUrl.password || parsedBaseUrl.pathname !== "/" || parsedBaseUrl.search || parsedBaseUrl.hash) throw new TypeError("baseUrl must be a credential-free HTTPS origin without a path, query, or fragment");
    this.baseUrl = parsedBaseUrl.origin;
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > maxTimeoutMs) throw new TypeError(`timeoutMs must be an integer from 1 to ${maxTimeoutMs}`);
    if (typeof this.fetcher !== "function") throw new TypeError("A fetch implementation is required");
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    if (authenticated && !this.apiKey) throw new Error("An apiKey is required for this operation");
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (authenticated && this.apiKey) headers.set("authorization", `Bearer ${this.apiKey}`);
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    if (init.signal?.aborted) controller.abort();
    else init.signal?.addEventListener("abort", () => controller.abort(), {once: true});
    let response: Response;
    try { response = await this.fetcher(new URL(path, `${this.baseUrl}/`).toString(), {...init, headers, signal: controller.signal}); }
    finally { clearTimeout(timer); }
    const text = await response.text();
    let body: unknown = undefined;
    if (text) {
      try { body = JSON.parse(text); } catch { body = {data: text}; }
    }
    if (!response.ok) {
      const errorBody = body && typeof body === "object" ? body as VenueAuthorityErrorBody : {};
      throw new VenueAuthorityError(response.status, errorBody);
    }
    return body as T;
  }

  /** Read current source coverage without an API key or unit charge. */
  getCoverage(): Promise<CoverageResponse> {
    return this.request<CoverageResponse>("/api/v1/coverage", {}, false);
  }

  resolveFacility(input: ResolveRequest, options: ResolveOptions = {}): Promise<ResolutionResponse> {
    if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 300 || typeof input.address !== "string" || !input.address.trim() || input.address.length > 500) throw new TypeError("name must be 1 to 300 characters and address must be 1 to 500 characters");
    return this.request<ResolutionResponse>("/api/v1/resolve", {method: "POST", headers: {"x-request-id": requestId(options.requestId)}, body: JSON.stringify({name: input.name, address: input.address})});
  }

  getFacility(id: string, options: GetFacilityOptions = {}): Promise<FacilityResponse> {
    return this.request<FacilityResponse>(`/api/v1/facilities/${pathSegment(id, "facilityId", 200)}`, {headers: {"x-request-id": requestId(options.requestId)}});
  }

  async listPortfolios(): Promise<Portfolio[]> { return listData<Portfolio>(await this.request("/api/v1/portfolios")); }

  async createPortfolio(name: string): Promise<Portfolio> {
    if (!name.trim() || name.length > 80) throw new TypeError("name must be 1 to 80 characters");
    return dataOf<Portfolio>(await this.request("/api/v1/portfolios", {method: "POST", body: JSON.stringify({name})}));
  }

  async listPortfolioItems(portfolioId: string): Promise<PortfolioItem[]> { return listData<PortfolioItem>(await this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/items`)); }

  async addPortfolioItem(portfolioId: string, jurisdiction: string, sourceId: string): Promise<PortfolioItem> {
    if (!jurisdiction.trim() || !sourceId.trim()) throw new TypeError("jurisdiction and sourceId are required");
    return dataOf<PortfolioItem>(await this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/items`, {method: "POST", body: JSON.stringify({jurisdiction, sourceId})}));
  }

  async deletePortfolioItem(portfolioId: string, itemId: string): Promise<Record<string, unknown>> { return this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/items/${pathSegment(itemId, "itemId")}`, {method: "DELETE"}); }

  async listPortfolioEvents(portfolioId: string): Promise<PortfolioEvent[]> { return listData<PortfolioEvent>(await this.request(`/api/v1/portfolios/${pathSegment(portfolioId, "portfolioId")}/events`)); }

  async listWebhooks(): Promise<Webhook[]> { return listData<Webhook>(await this.request("/api/v1/webhooks")); }

  async createWebhook(url: string): Promise<Webhook> {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new TypeError("url must be a valid URL"); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) throw new TypeError("url must be a credential-free HTTPS URL on the standard HTTPS port");
    return dataOf<Webhook>(await this.request("/api/v1/webhooks", {method: "POST", body: JSON.stringify({url})}));
  }

  async deleteWebhook(webhookId: string): Promise<Record<string, unknown>> { return this.request(`/api/v1/webhooks/${pathSegment(webhookId, "webhookId")}`, {method: "DELETE"}); }

  async listWebhookDeliveries(options: ListWebhookDeliveriesOptions = {}): Promise<WebhookDelivery[]> {
    const query = options.webhookId ? `?webhookId=${encodeURIComponent(options.webhookId)}` : "";
    return listData<WebhookDelivery>(await this.request(`/api/v1/webhooks/deliveries${query}`));
  }

  createAuditExport(requestIds: string[], options: CreateAuditExportOptions = {}): Promise<AuditExport> {
    if (!Array.isArray(requestIds) || requestIds.length < 1 || requestIds.length > 100 || requestIds.some((id) => typeof id !== "string" || !requestIdPattern.test(id))) throw new TypeError("requestIds must contain 1 to 100 valid request IDs");
    return this.request<AuditExport>("/api/v1/audit-exports", {method: "POST", headers: {"x-request-id": requestId(options.requestId)}, body: JSON.stringify({requestIds, format: options.format ?? "json"})}).then(data => dataOf<AuditExport>(data));
  }

  downloadAuditExport(exportId: string): Promise<Record<string, unknown>> { return this.request(`/api/v1/audit-exports/${pathSegment(exportId, "auditExportId")}`); }
}

export {requestIdPattern};
