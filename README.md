# Venue Authority API

Venue Authority checks a food-service merchant's name and street address against supported US regulator records. Each decision includes the matched source and evidence boundary, so merchant onboarding teams can keep an audit receipt instead of relying on an opaque yes or no.

It is built for payment facilitators, marketplaces, KYB providers, and restaurant platforms that need to verify locations during onboarding. Watchlist and webhook operations are documented for supported workspaces. Paid monitoring expansion is not available yet. Check current availability on the status and pricing pages.

## Check coverage first

The coverage endpoint does not require an API key:

```bash
curl https://venueauthority.com/api/v1/coverage
```

The response shows the jurisdictions, regulator sources, source classes, and freshness state currently available to the API. Check it before sending merchant records.

## See a decision before signing up

[Open the public Portfolio Proof example](https://venueauthority.com/portfolio-proof#example-report) to inspect a source-linked accepted decision, a rejected decision, and the evidence boundary. The fixed example does not require an account or upload a file.

## Test a decision

1. [Create a verified workspace](https://venueauthority.com/sign-up?redirect_url=/dashboard/keys).
2. Create a test key in the dashboard. An eligible verified workspace receives a one-time allowance of 25 test units.
3. Send a merchant name and street address with a stable request ID.

```bash
curl -X POST https://venueauthority.com/api/v1/resolve \
  -H 'Authorization: Bearer YOUR_ONE_TIME_KEY' \
  -H 'X-Request-Id: quickstart-000001' \
  -H 'Content-Type: application/json' \
  --data '{"name":"MERCHANT NAME","address":"STREET ADDRESS"}'
```

A valid decision returns the disposition, policy reason, source identity, source class, source attribution, snapshot, and evidence boundary. Replaying the same request ID with the same payload returns the stored result without another debit.

## Integration files

- [OpenAPI 3.1 contract](openapi.json)
- [Postman collection](postman/venue-authority.json)
- [Ten-minute quick start](docs/quick-start.md)

The contract also covers canonical facility records, portfolios, audit exports, webhooks, and webhook delivery history.

## Client packages

The repository includes three reviewed, versioned integrations:

- [Node.js SDK](packages/node-sdk) for Node 18 and later. It has no runtime dependencies.
- [Python SDK](packages/python-sdk) for Python 3.9 and later. It uses only the standard library at runtime.
- [MCP server](packages/mcp-server) for MCP hosts that need public coverage, facility resolution, or canonical facility evidence.

The [v0.1.0 release](https://github.com/kingymon1/venue-authority-api/releases/tag/clients-v0.1.0) includes a one-click MCP bundle and downloadable archives for all three clients. npm and PyPI releases will be documented here only after the corresponding registry publication succeeds.

## Product boundaries

Venue Authority resolves a submitted facility to a supported regulator record. It does not infer the legal operator, prove that a business is physically open, or search outside the coverage returned by the API. Uncertain matches are rejected.

## Links

- [Developer documentation](https://venueauthority.com/developers)
- [Coverage](https://venueauthority.com/coverage)
- [Pricing](https://venueauthority.com/pricing)
- [Service status](https://venueauthority.com/status)
- [Support](https://venueauthority.com/support)
- [Terms](https://venueauthority.com/terms)

This repository contains public integration artifacts. Use of the hosted API is governed by the Venue Authority terms.
