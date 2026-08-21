"""Exceptions raised by the Venue Authority client."""

from typing import Any, Mapping, Optional


class VenueAuthorityError(Exception):
    """Base class for client and API errors."""


class ApiError(VenueAuthorityError):
    """An unsuccessful HTTP response from Venue Authority."""

    def __init__(
        self,
        status_code: int,
        message: str,
        *,
        request_id: Optional[str] = None,
        payload: Optional[Mapping[str, Any]] = None,
    ) -> None:
        self.status_code = status_code
        self.message = message
        self.request_id = request_id
        self.payload = dict(payload or {})
        suffix = ""
        if request_id:
            suffix = " request_id=" + request_id
        super().__init__(f"Venue Authority API returned HTTP {status_code}: {message}{suffix}")
