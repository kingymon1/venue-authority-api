# `venue-authority`

Dependency-free Node.js client for the Venue Authority API. It supports Node 18+ and uses the built-in `fetch` implementation.

## Install

Build this package from the repository, then install the generated package from `packages/node-sdk`:

```bash
npm install ./packages/node-sdk
```

## First request

Create a verified workspace at [venueauthority.com/sign-up](https://venueauthority.com/sign-up), create the complimentary test key, and keep its plaintext value safe: it is shown only once.

```ts
import {VenueAuthorityClient} from "venue-authority";

const client = new VenueAuthorityClient({apiKey: process.env.VENUE_AUTHORITY_API_KEY});
const result = await client.resolveFacility(
  {name: "YOAN MING GARDEN", address: "1407 Madison Avenue, New York NY 10029"},
  {requestId: "onboarding-merchant-0001"},
);
console.log(result.disposition, result.reason, result.requestId);
```

`getCoverage()` is public and does not require an API key. All workspace operations require a bearer API key. Valid resolution, canonical facility, and audit-export creation requests consume one prepaid unit; exact replay does not consume another unit.

## Supported operations

- Coverage: `getCoverage`
- Resolution and evidence: `resolveFacility`, `getFacility`
- Watchlists: `listPortfolios`, `createPortfolio`, `listPortfolioItems`, `addPortfolioItem`, `deletePortfolioItem`, `listPortfolioEvents`
- Webhooks: `listWebhooks`, `createWebhook`, `deleteWebhook`, `listWebhookDeliveries`
- Audit exports: `createAuditExport`, `downloadAuditExport`

Request IDs must be 8–128 characters matching `[A-Za-z0-9._:-]`. The SDK generates a valid ID when one is not supplied for metered create/read operations, but supplying a stable ID is recommended for safe retries.

`baseUrl` must be a credential-free HTTPS origin. Requests have a 30-second default timeout; configure `timeoutMs` from 1 to 120,000 milliseconds when needed. Public coverage never receives the bearer key.

HTTP failures throw `VenueAuthorityError`, which includes `status`, `requestId`, and the parsed response `body`. The SDK never logs API keys or response bodies.

## Development

```bash
npm run build
npm test
```

The package has no provider credentials, makes no network calls during tests, and does not publish or deploy anything.
