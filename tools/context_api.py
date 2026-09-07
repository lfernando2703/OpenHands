"""Startup registration for the context-branch store singleton.

Imported via ``--import-modules context_api`` so the SQLite store is ready
before REST handlers run. Missing or unreadable state dirs are ignored.
"""

from __future__ import annotations

import os
import sys

from context.api import (  # noqa: F401
    ContextService,
    handle_request,
    serve_context,
)
from context_store import (
    ContextStore,
    default_db_path,
    get_active_store,
    set_active_store,
)


def start_default_store() -> ContextStore | None:
    existing = get_active_store()
    if existing is not None:
        return existing
    try:
        store = ContextStore(default_db_path())
        set_active_store(store)
        return store
    except Exception:
        return None


def _in_unit_tests() -> bool:
    return "unittest" in sys.modules or "pytest" in sys.modules


if (
    not _in_unit_tests()
    and os.environ.get("OH_CONTEXT_NO_START") != "1"
):
    try:
        start_default_store()
    except Exception:
        pass
