# Venue Authority ten-minute quick start

Contract version: 2026-08-13

1. Create a verified workspace.
2. Create a test key and copy its one-time value. Test and live are visible key environments on the same authenticated API hostname. The complimentary test allowance is granted once to the verified identity and workspace. Changing the key label or environment cannot create another allowance.
3. Send a merchant name and street address with a stable request ID.
4. Read the disposition, policy reason, source identity, source class, attribution, license, modification notice, snapshot, and evidence boundary. Food inspection records are a different source class from food business licence, alcohol licence, and hospitality licence records. Do not present one class as another. On-demand source history is labelled retrieved_on_demand. An unavailable source effective date is returned as null with effectiveAtStatus set to unavailable.
5. Replay the exact request ID and payload to verify stored replay without another debit.
6. Create a portfolio, add canonical jurisdiction and source IDs, and inspect its event history.
7. Register a public HTTPS webhook, inspect per-delivery history, and delete the endpoint when it is no longer needed.
8. Choose only an existing prepaid plan if the supported coverage fits your use case.

```bash
curl -X POST https://venueauthority.com/api/v1/resolve \
  -H 'Authorization: Bearer YOUR_ONE_TIME_KEY' \
  -H 'X-Request-Id: quickstart-000001' \
  -H 'Content-Type: application/json' \
  --data '{"name":"REDACTED MERCHANT","address":"REDACTED STREET ADDRESS"}'
```

Portfolio and webhook management accept the signed-in customer session or a workspace API key. The generated Postman collection includes portfolio item create, list, and delete requests, portfolio events, webhook deletion, and per-delivery history.

An accepted response includes this attribution boundary:

```json
{"sourceAttribution":{"sourceClass":"food_inspection","sourceClassLabel":"food inspection records"}}
```

A valid resolution or policy rejection consumes one unit. Malformed input, authentication failure, unavailable serving state, rights failure, and exact replay do not consume another unit.
