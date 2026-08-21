"""Typed views over the stable fields returned by the public API.

Unknown fields are intentionally retained in ``raw`` so the client remains
forward-compatible with additive API response fields.
"""

from dataclasses import dataclass, field
from typing import Any, List, Mapping, Optional

def unwrap_data(value: Any) -> Mapping[str, Any]:
    """Return the API's object payload when it is wrapped in ``data``."""
    if isinstance(value, Mapping) and isinstance(value.get("data"), Mapping):
        return value["data"]
    return value if isinstance(value, Mapping) else {}


@dataclass(frozen=True)
class SourceAttribution:
    source_id: Optional[str] = None
    source_class: Optional[str] = None
    source_class_label: Optional[str] = None
    attribution: Optional[str] = None
    required_notice: Optional[str] = None
    license_url: Optional[str] = None
    modification_notice: Optional[str] = None
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, value: Any) -> Optional["SourceAttribution"]:
        if not isinstance(value, Mapping):
            return None
        return cls(
            source_id=value.get("sourceId"),
            source_class=value.get("sourceClass"),
            source_class_label=value.get("sourceClassLabel"),
            attribution=value.get("attribution"),
            required_notice=value.get("requiredNotice"),
            license_url=value.get("licenseUrl"),
            modification_notice=value.get("modificationNotice"),
            raw=dict(value),
        )


@dataclass(frozen=True)
class Resolution:
    disposition: str
    reason: str
    request_id: Optional[str]
    record: Optional[Mapping[str, Any]]
    source_attribution: Optional[SourceAttribution]
    snapshot: Optional[Mapping[str, Any]]
    evidence: Optional[Mapping[str, Any]]
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "Resolution":
        return cls(
            disposition=str(value.get("disposition", "")),
            reason=str(value.get("reason", "")),
            request_id=value.get("requestId"),
            record=value.get("record") if isinstance(value.get("record"), Mapping) else None,
            source_attribution=SourceAttribution.from_dict(value.get("sourceAttribution")),
            snapshot=value.get("snapshot") if isinstance(value.get("snapshot"), Mapping) else None,
            evidence=value.get("evidence") if isinstance(value.get("evidence"), Mapping) else None,
            raw=dict(value),
        )


@dataclass(frozen=True)
class Facility:
    raw: Mapping[str, Any]

    @property
    def record(self) -> Optional[Mapping[str, Any]]:
        value = unwrap_data(self.raw).get("record", unwrap_data(self.raw))
        return value if isinstance(value, Mapping) else None

    @property
    def source_attribution(self) -> Optional[SourceAttribution]:
        return SourceAttribution.from_dict(unwrap_data(self.raw).get("sourceAttribution"))


@dataclass(frozen=True)
class Coverage:
    raw: Mapping[str, Any]

    @property
    def sources(self) -> List[Mapping[str, Any]]:
        value = self.raw.get("sources", self.raw.get("data", []))
        return [dict(item) for item in value if isinstance(item, Mapping)] if isinstance(value, list) else []


@dataclass(frozen=True)
class Watchlist:
    raw: Mapping[str, Any]

    @property
    def id(self) -> Optional[str]:
        return unwrap_data(self.raw).get("id")

    @property
    def name(self) -> Optional[str]:
        return unwrap_data(self.raw).get("name")


@dataclass(frozen=True)
class Webhook:
    raw: Mapping[str, Any]

    @property
    def id(self) -> Optional[str]:
        return unwrap_data(self.raw).get("id")

    @property
    def url(self) -> Optional[str]:
        return unwrap_data(self.raw).get("url")


@dataclass(frozen=True)
class AuditExport:
    raw: Mapping[str, Any]

    @property
    def id(self) -> Optional[str]:
        return unwrap_data(self.raw).get("id")

    @property
    def artifact_url(self) -> Optional[str]:
        payload = unwrap_data(self.raw)
        return payload.get("url") or payload.get("artifactUrl")
