import json
import unittest
from typing import Mapping, Optional

from venue_authority import ApiError, VenueAuthority, VenueAuthorityError


class FakeTransport:
    def __init__(self, status: int = 200, payload=None):
        self.status = status
        self.payload = payload if payload is not None else {}
        self.calls = []

    def __call__(self, method: str, url: str, headers: Mapping[str, str], body: Optional[bytes], timeout: float):
        self.calls.append((method, url, dict(headers), body, timeout))
        return self.status, {"content-type": "application/json"}, json.dumps(self.payload).encode()


class ClientTests(unittest.TestCase):
    def test_resolve_sends_bearer_and_request_id_and_returns_typed_result(self):
        transport = FakeTransport(payload={
            "disposition": "accepted",
            "reason": "matched",
            "requestId": "demo-0001",
            "sourceAttribution": {"sourceClass": "food_inspection", "sourceClassLabel": "food inspection records"},
        })
        client = VenueAuthority(api_key="va_test_example", transport=transport)
        result = client.resolve("Example Cafe", "1 Main Street", request_id="demo-0001")
        self.assertEqual(result.disposition, "accepted")
        self.assertEqual(result.source_attribution.source_class, "food_inspection")
        method, url, headers, body, _ = transport.calls[0]
        self.assertEqual((method, url), ("POST", "https://venueauthority.com/api/v1/resolve"))
        self.assertEqual(headers["Authorization"], "Bearer va_test_example")
        self.assertEqual(headers["X-Request-Id"], "demo-0001")
        self.assertEqual(json.loads(body or b""), {"name": "Example Cafe", "address": "1 Main Street"})

    def test_coverage_is_public(self):
        transport = FakeTransport(payload={"sources": [{"id": "source-a"}]})
        result = VenueAuthority(transport=transport).coverage()
        self.assertEqual(result.sources[0]["id"], "source-a")
        self.assertNotIn("Authorization", transport.calls[0][2])

    def test_api_error_preserves_status_and_request_id(self):
        transport = FakeTransport(status=422, payload={"error": "policy_rejected", "requestId": "demo-0001"})
        with self.assertRaises(ApiError) as caught:
            VenueAuthority(api_key="key", transport=transport).resolve("Cafe", "1 Main")
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(caught.exception.request_id, "demo-0001")
        self.assertEqual(caught.exception.message, "policy_rejected")

    def test_invalid_request_id_fails_before_network(self):
        transport = FakeTransport()
        with self.assertRaises(ValueError):
            VenueAuthority(api_key="key", transport=transport).resolve("Cafe", "1 Main", request_id="bad id")
        self.assertEqual(transport.calls, [])

    def test_authenticated_request_without_key_fails_before_network(self):
        transport = FakeTransport(payload={"data": {"id": "portfolio-1", "name": "Review queue"}})
        with self.assertRaisesRegex(VenueAuthorityError, "API key"):
            VenueAuthority(transport=transport).create_watchlist("Review queue")
        self.assertEqual(transport.calls, [])

    def test_base_url_must_be_https_origin(self):
        with self.assertRaises(ValueError):
            VenueAuthority(base_url="http://localhost:3000")
        with self.assertRaises(ValueError):
            VenueAuthority(base_url="https://example.com/api")

    def test_input_validation_happens_before_network(self):
        transport = FakeTransport()
        client = VenueAuthority(api_key="key", transport=transport)
        with self.assertRaises(ValueError):
            client.resolve(" ", "1 Main")
        with self.assertRaises(ValueError):
            client.create_webhook("http://example.com/hook")
        with self.assertRaises(ValueError):
            client.create_webhook("https://user:secret@example.com/hook")
        with self.assertRaises(ValueError):
            client.facility("x" * 201)
        with self.assertRaises(ValueError):
            client.create_watchlist(" ")
        with self.assertRaises(ValueError):
            client.add_watchlist_item("portfolio", "", "source")
        with self.assertRaises(ValueError):
            client.download_audit_export("not-a-uuid")
        with self.assertRaises(ValueError):
            client.create_audit_export(["bad id"])
        self.assertEqual(transport.calls, [])


if __name__ == "__main__":
    unittest.main()
