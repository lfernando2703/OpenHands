"""HTTP API tests for context-branch endpoints."""

from __future__ import annotations

import os
import sys
import unittest

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from context.api import ContextService, handle_request  # noqa: E402
from context_store import ContextStore, DEFAULT_MAX_DEPTH  # noqa: E402


def _service(test: unittest.TestCase) -> ContextService:
    store = ContextStore(":memory:")
    test.addCleanup(store.close)
    return ContextService(store)


def _create(
    service: ContextService,
    conversation_id: str = "conv-1",
    name: str = "main",
    parent: str | None = None,
    event_id: str = "evt-1",
) -> dict:
    body: dict = {
        "conversation_id": conversation_id,
        "name": name,
        "diverged_at_event_ts": "2026-01-01T00:00:00+00:00",
        "diverged_at_event_id": event_id,
    }
    if parent:
        body["parent_branch_id"] = parent
    status, payload = handle_request(service, "POST", "/api/context/branches", body)
    if status != 200:
        return {"status": status, **payload}
    return payload["branch"]


class ContextApiTests(unittest.TestCase):
    def test_create_list_rename_and_rejoin(self) -> None:
        service = _service(self)
        root = _create(service)
        self.assertEqual(root["depth"], 0)
        child = _create(service, name="experiment", parent=root["branch_id"], event_id="evt-2")
        self.assertEqual(child["parent_id"], root["branch_id"])
        status, listed = handle_request(
            service, "GET", "/api/context/branches?conversation_id=conv-1"
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(listed["branches"]), 2)
        status, renamed = handle_request(
            service,
            "PUT",
            f"/api/context/branches/{child['branch_id']}",
            {"name": "alt"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(renamed["branch"]["name"], "alt")
        status, rejoined = handle_request(
            service,
            "POST",
            f"/api/context/branches/{root['branch_id']}/rejoin",
            {
                "from_branch_id": child["branch_id"],
                "rejoin_event_ts": "2026-01-03T00:00:00+00:00",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(rejoined["branch"]["rejoins"]), 1)

    def test_depth_limit_returns_422(self) -> None:
        service = _service(self)
        current = _create(service)
        for index in range(DEFAULT_MAX_DEPTH):
            current = _create(
                service,
                name=f"b{index}",
                parent=current["branch_id"],
                event_id=f"evt-{index + 2}",
            )
        overflow = _create(
            service,
            name="too-deep",
            parent=current["branch_id"],
            event_id="evt-overflow",
        )
        self.assertEqual(overflow["status"], 422)

    def test_config_get_and_put(self) -> None:
        service = _service(self)
        status, config = handle_request(service, "GET", "/api/context/config")
        self.assertEqual(status, 200)
        self.assertEqual(config["max_depth"], DEFAULT_MAX_DEPTH)
        status, updated = handle_request(
            service, "PUT", "/api/context/config", {"max_depth": 2}
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["max_depth"], 2)

    def test_unknown_route_is_404(self) -> None:
        service = _service(self)
        status, payload = handle_request(service, "GET", "/api/context/nope")
        self.assertEqual(status, 404)
        self.assertIn("error", payload)
