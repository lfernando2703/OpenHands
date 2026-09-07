"""Checkpoint, rewind-record, and export contract tests."""

from __future__ import annotations

import os
import sys
import unittest

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from context.api import ContextService, handle_request  # noqa: E402
from context_store import ContextStore, NotFoundError  # noqa: E402


def _store(test: unittest.TestCase) -> ContextStore:
    store = ContextStore(":memory:")
    test.addCleanup(store.close)
    return store


def _service(test: unittest.TestCase) -> ContextService:
    store = _store(test)
    return ContextService(store)


def _root(store: ContextStore) -> dict:
    return store.create_branch(
        conversation_id="conv-1",
        name="main",
        diverged_at_event_ts="2026-01-01T00:00:00+00:00",
        diverged_at_event_id="evt-1",
    )


class ContextCheckpointStoreTests(unittest.TestCase):
    def test_create_list_and_delete_checkpoint(self) -> None:
        store = _store(self)
        root = _root(store)
        created = store.create_checkpoint(
            branch_id=root["branch_id"],
            label="before-refactor",
            at_event_ts="2026-01-02T00:00:00+00:00",
        )
        self.assertEqual(created["label"], "before-refactor")
        self.assertEqual(created["branch_id"], root["branch_id"])
        listed = store.list_checkpoints(conversation_id="conv-1")
        self.assertEqual(len(listed), 1)
        store.delete_checkpoint(created["id"])
        self.assertEqual(store.list_checkpoints(branch_id=root["branch_id"]), [])

    def test_delete_unknown_checkpoint_is_404(self) -> None:
        store = _store(self)
        with self.assertRaises(NotFoundError):
            store.delete_checkpoint("missing")


class ContextRewindExportApiTests(unittest.TestCase):
    def test_checkpoint_crud_endpoints(self) -> None:
        service = _service(self)
        root = _root(service.store)
        status, created = handle_request(
            service,
            "POST",
            "/api/context/checkpoints",
            {
                "branch_id": root["branch_id"],
                "label": "cp-1",
                "at_event_ts": "2026-01-02T00:00:00+00:00",
            },
        )
        self.assertEqual(status, 200)
        checkpoint_id = created["checkpoint"]["id"]
        status, listed = handle_request(
            service,
            "GET",
            "/api/context/checkpoints?conversation_id=conv-1",
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(listed["checkpoints"]), 1)
        status, _ = handle_request(
            service, "DELETE", f"/api/context/checkpoints/{checkpoint_id}"
        )
        self.assertEqual(status, 200)
        status, listed = handle_request(
            service,
            "GET",
            f"/api/context/checkpoints?branch_id={root['branch_id']}",
        )
        self.assertEqual(status, 200)
        self.assertEqual(listed["checkpoints"], [])

    def test_rewind_records_after_timestamp(self) -> None:
        service = _service(self)
        root = _root(service.store)
        status, payload = handle_request(
            service,
            "POST",
            f"/api/context/branches/{root['branch_id']}/rewind",
            {"after_timestamp": "2026-01-02T12:00:00+00:00"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            payload["rewind"]["after_timestamp"], "2026-01-02T12:00:00+00:00"
        )
        self.assertEqual(payload["rewind"]["branch_id"], root["branch_id"])

    def test_export_includes_branch_metadata_and_checkpoints(self) -> None:
        service = _service(self)
        root = _root(service.store)
        service.store.create_checkpoint(
            branch_id=root["branch_id"],
            label="saved",
            at_event_ts="2026-01-02T00:00:00+00:00",
        )
        status, payload = handle_request(
            service,
            "GET",
            f"/api/context/export?branch_id={root['branch_id']}",
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["conversation_id"], "conv-1")
        self.assertEqual(payload["branch_id"], root["branch_id"])
        self.assertEqual(payload["divergence"]["event_id"], "evt-1")
        self.assertEqual(len(payload["checkpoints"]), 1)
        self.assertEqual(payload["checkpoints"][0]["label"], "saved")
        self.assertIn("events", payload)
        self.assertEqual(payload["events"], [])
