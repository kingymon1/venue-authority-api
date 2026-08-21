export type RequestId = string;
export type SourceClass = "food_inspection" | "food_business_license" | "alcohol_license" | "hospitality_license";
export interface VenueAuthorityErrorBody {
    error?: string;
    requestId?: string;
    [key: string]: unknown;
}
export declare class VenueAuthorityError extends Error {
    readonly status: number;
    readonly requestId?: string;
    readonly body: VenueAuthorityErrorBody;
    constructor(status: number, body: VenueAuthorityErrorBody, message?: string);
}
export interface CoverageResponse {
    [key: string]: unknown;
}
export interface ResolveRequest {
    name: string;
    address: string;
}
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
export interface FacilityResponse {
    [key: string]: unknown;
}
export interface Portfolio {
    id?: string;
    name?: string;
    [key: string]: unknown;
}
export interface PortfolioItem {
    id?: string;
    jurisdiction?: string;
    sourceId?: string;
    [key: string]: unknown;
}
export interface PortfolioEvent {
    [key: string]: unknown;
}
export interface Webhook {
    id?: string;
    url?: string;
    [key: string]: unknown;
}
export interface WebhookDelivery {
    [key: string]: unknown;
}
export interface AuditExport {
    id?: string;
    sha256?: string;
    [key: string]: unknown;
}
export interface VenueAuthorityClientOptions {
    apiKey?: string;
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}
export interface ResolveOptions {
    requestId?: RequestId;
}
export interface GetFacilityOptions {
    requestId?: RequestId;
}
export interface CreateAuditExportOptions {
    requestId?: RequestId;
    format?: "json";
}
export interface ListWebhookDeliveriesOptions {
    webhookId?: string;
}
declare const requestIdPattern: RegExp;
export declare class VenueAuthorityClient {
    readonly baseUrl: string;
    private readonly apiKey?;
    private readonly fetcher;
    private readonly timeoutMs;
    constructor(options?: VenueAuthorityClientOptions);
    private request;
    /** Read current source coverage without an API key or unit charge. */
    getCoverage(): Promise<CoverageResponse>;
    resolveFacility(input: ResolveRequest, options?: ResolveOptions): Promise<ResolutionResponse>;
    getFacility(id: string, options?: GetFacilityOptions): Promise<FacilityResponse>;
    listPortfolios(): Promise<Portfolio[]>;
    createPortfolio(name: string): Promise<Portfolio>;
    listPortfolioItems(portfolioId: string): Promise<PortfolioItem[]>;
    addPortfolioItem(portfolioId: string, jurisdiction: string, sourceId: string): Promise<PortfolioItem>;
    deletePortfolioItem(portfolioId: string, itemId: string): Promise<Record<string, unknown>>;
    listPortfolioEvents(portfolioId: string): Promise<PortfolioEvent[]>;
    listWebhooks(): Promise<Webhook[]>;
    createWebhook(url: string): Promise<Webhook>;
    deleteWebhook(webhookId: string): Promise<Record<string, unknown>>;
    listWebhookDeliveries(options?: ListWebhookDeliveriesOptions): Promise<WebhookDelivery[]>;
    createAuditExport(requestIds: string[], options?: CreateAuditExportOptions): Promise<AuditExport>;
    downloadAuditExport(exportId: string): Promise<Record<string, unknown>>;
}
export { requestIdPattern };
