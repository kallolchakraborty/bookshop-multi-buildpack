"""Structured Logger for SAP BTP Application Logging Service (application-logging-service).

Formats log output as standardized SAP Cloud Logging JSON payloads sent to stdout/stderr,
which are automatically ingested, parsed, and indexed by the SAP Application Logging service Kibana dashboard.
"""
import datetime
import json
import sys

COMPONENT_NAME = "bookshop-ai-subsystem"

def _emit_sap_log(level: str, message: str, extra: dict = None):
    """Format and emit structured SAP Cloud Logging JSON payload."""
    payload = {
        "written_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "written_ts": int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000),
        "component": COMPONENT_NAME,
        "layer": "python-worker",
        "level": level.upper(),
        "msg": message,
    }
    if extra:
        payload.update(extra)

    out_stream = sys.stderr if level.upper() in ("ERROR", "FATAL", "WARN") else sys.stderr
    out_stream.write(json.dumps(payload) + "\n")
    out_stream.flush()

def log_info(message: str, **kwargs):
    """Log informational event to SAP Application Logging service."""
    _emit_sap_log("INFO", message, kwargs)

def log_warn(message: str, **kwargs):
    """Log warning event to SAP Application Logging service."""
    _emit_sap_log("WARN", message, kwargs)

def log_error(message: str, exc: Exception = None, **kwargs):
    """Log error event with traceback details to SAP Application Logging service."""
    extra = dict(kwargs)
    if exc:
        extra["error_type"] = type(exc).__name__
        extra["error_details"] = str(exc)
    _emit_sap_log("ERROR", message, extra)
