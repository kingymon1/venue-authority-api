"""A small synchronous client for the Venue Authority API."""

from .client import VenueAuthority
from .errors import ApiError, VenueAuthorityError
from .models import (
    AuditExport,
    Coverage,
    Facility,
    Resolution,
    SourceAttribution,
    Watchlist,
    Webhook,
)

__all__ = [
    "ApiError",
    "AuditExport",
    "Coverage",
    "Facility",
    "Resolution",
    "SourceAttribution",
    "VenueAuthority",
    "VenueAuthorityError",
    "Watchlist",
    "Webhook",
]

__version__ = "0.1.0"
