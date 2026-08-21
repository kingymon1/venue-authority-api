"""Synchronous Venue Authority API client using only Python's standard library."""

import json
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, Mapping, Optional, Tuple, Union
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

from .errors import ApiError, VenueAuthorityError
from .models import AuditExport, Coverage, Facility, Resolution, Watchlist, Webhook, unwrap_data

Json = Union[Mapping[str, Any], list, str, int, float, bool, None]
Transport = Callable[[str, str, Mapping[str, str], Optional[bytes], float], Tuple[int, Mapping[str, str], bytes]]
REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")


def _default_transport(method: str, url: str, headers: Mapping[str, str], body: Optional[bytes], timeout: float) -> Tuple[int, Mapping[str, str], bytes]:
    request = Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            return int(response.status), dict(response.headers.items()), response.read()
    except HTTPError as error:
        return int(error.code), dict(error.headers.items()) if error.headers else {}, error.read()
    except URLError as error:
        raise VenueAuthorityError(f"Venue Authority request failed: {error.reason}") from error


def _json_body(body: bytes) -> Json:
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return body.decode("utf-8", errors="replace")


def _items(payload: Any) -> list:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, Mapping):
        value = payload.get("data", payload.get("items", payload.get("webhooks", payload.get("portfolios", []))))
        return value if isinstance(value, list) else []
    return []


@dataclass
class VenueAuthority:
    """A synchronous client.

    ``api_key`` is sent as a Bearer token. Coverage is public. Authenticated
    operations require a Venue Authority API key.
    Requests are never retried automatically because resolver and export calls
    are metered and rely on stable request IDs for safe replay.
    """

    api_key: Optional[str] = None
    base_url: str = "https://venueauthority.com"
    timeout: float = 30.0
    transport: Optional[Transport] = None

    def __post_init__(self) -> None:
        self.base_url = self.base_url.rstrip("/")
        parsed = urlsplit(self.base_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.path not in ("", "/") or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("base_url must be an HTTPS origin without credentials, query, or fragment")
        if self.timeout <= 0:
            raise ValueError("timeout must be positive")
        self._transport = self.transport or _default_transport

    def _request(self, method: str, path: str, *, body: Optional[Mapping[str, Any]] = None, query: Optional[Mapping[str, Any]] = None, request_id: Optional[str] = None, auth: bool = True) -> Any:
        if auth and not self.api_key:
            raise VenueAuthorityError("an API key is required for authenticated operations")
        if request_id is not None and not REQUEST_ID.fullmatch(request_id):
            raise ValueError("request_id must match [A-Za-z0-9._:-]{8,128}")
        url = self.base_url + path
        if query:
            url += "?" + urlencode({key: value for key, value in query.items() if value is not None})
        headers: Dict[str, str] = {"Accept": "application/json", "User-Agent": "venue-authority-python/0.1.0"}
        if auth:
            headers["Authorization"] = "Bearer " + self.api_key
        encoded = None
        if body is not None:
            encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if request_id:
            headers["X-Request-Id"] = request_id
        status, response_headers, response_body = self._transport(method, url, headers, encoded, self.timeout)
        payload = _json_body(response_body)
        if status < 200 or status >= 300:
            details = payload if isinstance(payload, Mapping) else {}
            message = str(details.get("error", f"HTTP {status}"))
            raise ApiError(status, message, request_id=details.get("requestId"), payload=details)
        return payload

    def resolve(self, name: str, address: str, *, request_id: Optional[str] = None) -> Resolution:
        if not isinstance(name, str) or not name.strip() or len(name) > 300:
            raise ValueError("name must be a non-empty string of at most 300 characters")
        if not isinstance(address, str) or not address.strip() or len(address) > 500:
            raise ValueError("address must be a non-empty string of at most 500 characters")
        payload = self._request("POST", "/api/v1/resolve", body={"name": name, "address": address}, request_id=request_id)
        if not isinstance(payload, Mapping):
            raise VenueAuthorityError("resolve returned a non-object response")
        return Resolution.from_dict(payload)

    def coverage(self) -> Coverage:
        payload = self._request("GET", "/api/v1/coverage", auth=False)
        return Coverage(payload if isinstance(payload, Mapping) else {"data": payload})

    def facility(self, facility_id: str, *, request_id: Optional[str] = None) -> Facility:
        if not isinstance(facility_id, str) or not facility_id or len(facility_id) > 200 or "/" in facility_id:
            raise ValueError("facility_id must be a non-empty path segment of at most 200 characters")
        payload = self._request("GET", "/api/v1/facilities/" + quote(facility_id, safe=""), request_id=request_id)
        return Facility(payload if isinstance(payload, Mapping) else {"data": payload})

    def list_watchlists(self) -> list[Watchlist]:
        return [Watchlist(item) for item in _items(self._request("GET", "/api/v1/portfolios")) if isinstance(item, Mapping)]

    def create_watchlist(self, name: str) -> Watchlist:
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValueError("name must be a non-empty string of at most 80 characters")
        payload = self._request("POST", "/api/v1/portfolios", body={"name": name})
        return Watchlist(unwrap_data(payload))

    def list_watchlist_items(self, portfolio_id: str) -> Any:
        return self._request("GET", f"/api/v1/portfolios/{quote(portfolio_id, safe='')}/items")

    def add_watchlist_item(self, portfolio_id: str, jurisdiction: str, source_id: str) -> Any:
        if not isinstance(jurisdiction, str) or not jurisdiction.strip() or not isinstance(source_id, str) or not source_id.strip():
            raise ValueError("jurisdiction and source_id are required")
        return self._request("POST", f"/api/v1/portfolios/{quote(portfolio_id, safe='')}/items", body={"jurisdiction": jurisdiction, "sourceId": source_id})

    def delete_watchlist_item(self, portfolio_id: str, item_id: str) -> Any:
        return self._request("DELETE", f"/api/v1/portfolios/{quote(portfolio_id, safe='')}/items/{quote(item_id, safe='')}")

    def list_watchlist_events(self, portfolio_id: str) -> Any:
        return self._request("GET", f"/api/v1/portfolios/{quote(portfolio_id, safe='')}/events")

    def list_webhooks(self) -> list[Webhook]:
        return [Webhook(item) for item in _items(self._request("GET", "/api/v1/webhooks")) if isinstance(item, Mapping)]

    def create_webhook(self, url: str) -> Webhook:
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password or (parsed.port is not None and parsed.port != 443):
            raise ValueError("webhook url must be a credential-free HTTPS URL on the standard HTTPS port")
        payload = self._request("POST", "/api/v1/webhooks", body={"url": url})
        return Webhook(unwrap_data(payload))

    def delete_webhook(self, webhook_id: str) -> Any:
        return self._request("DELETE", f"/api/v1/webhooks/{quote(webhook_id, safe='')}")

    def list_webhook_deliveries(self, *, webhook_id: Optional[str] = None) -> Any:
        return self._request("GET", "/api/v1/webhooks/deliveries", query={"webhookId": webhook_id})

    def create_audit_export(self, request_ids: list[str], *, format: str = "json", request_id: Optional[str] = None) -> AuditExport:
        if not 1 <= len(request_ids) <= 100 or any(not isinstance(value, str) or not REQUEST_ID.fullmatch(value) for value in request_ids):
            raise ValueError("request_ids must contain between 1 and 100 valid request IDs")
        if format != "json":
            raise ValueError("format must be 'json'")
        payload = self._request("POST", "/api/v1/audit-exports", body={"requestIds": request_ids, "format": format}, request_id=request_id)
        return AuditExport(unwrap_data(payload))

    def download_audit_export(self, export_id: str) -> Any:
        if not isinstance(export_id, str) or not UUID.fullmatch(export_id):
            raise ValueError("export_id must be a canonical UUID")
        return self._request("GET", f"/api/v1/audit-exports/{quote(export_id, safe='')}")
