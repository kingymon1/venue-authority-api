# Venue Authority Python SDK

Small synchronous client for the [Venue Authority API](https://venueauthority.com/developers). It uses Python's standard library, so the first request needs no runtime dependency.

## Install

From this directory:

```bash
python -m pip install .
```

## First request

Coverage is public and does not consume units:

```python
from venue_authority import VenueAuthority

client = VenueAuthority()
coverage = client.coverage()
print(len(coverage.sources), "supported sources")
```

Authenticated resolution uses a complimentary test key or prepaid API key. Use a stable request ID so an exact replay is not charged twice:

```python
from venue_authority import VenueAuthority

client = VenueAuthority(api_key="va_test_REPLACE_ME")
result = client.resolve(
    "REDACTED MERCHANT",
    "REDACTED STREET ADDRESS",
    request_id="quickstart-000001",
)
print(result.disposition, result.reason)
if result.source_attribution:
    print(result.source_attribution.source_class_label)
```

`ApiError` exposes `status_code`, `message`, `request_id`, and the JSON error payload. The client does not retry automatically because valid resolver and export requests are metered. Handle `422` policy rejections, `402` exhausted balance, `409` idempotency conflicts, `410` withdrawn sources, and `503` source or rights unavailability explicitly.

The client also covers coverage, canonical facilities, workspace watchlists, webhooks, and audit exports. Authenticated methods use a Venue Authority Bearer API key. See the [API contract](https://venueauthority.com/openapi.json) for response details and source-class boundaries. Food inspection records, food business licences, alcohol licences, and hospitality licences are distinct source classes.

## Development

```bash
python -m unittest discover -s tests -v
```
