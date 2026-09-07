"""Unit tests for the context-branch SQLite store."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from context_store import (  # noqa: E402
    DEFAULT_MAX_DEPTH,
    ContextStore,
    DepthLimitError,
    NotFoundError,
)


def _store(test: unittest.TestCase) -> ContextStore:
    store = ContextStore(":memory:")
    test.addCleanup(store.close)
    return store


def _fork(
    store: ContextStore,
    conversation_id: str,
    name: str,
    parent_id: str | None = None,
    event_id: str = "evt-1",
    event_ts: str = "2026-01-01T00:00:00+00:00",
) -> dict:
    return store.create_branch(
        conversation_id=conversation_id,
        name=name,
        diverged_at_event_ts=event_ts,
        diverged_at_event_id=event_id,
        parent_branch_id=parent_id,
    )


class ContextStoreTests(unittest.TestCase):
    def test_default_max_depth_is_three(self) -> None:
        store = _store(self)
        self.assertEqual(store.get_config()["max_depth"], DEFAULT_MAX_DEPTH)

    def test_rejects_fork_beyond_default_max_depth(self) -> None:
        store = _store(self)
        root = _fork(store, "conv-1", "main")
        current = root
        for index in range(DEFAULT_MAX_DEPTH):
            current = _fork(
                store,
                "conv-1",
                f"b{index + 1}",
                parent_id=current["branch_id"],
                event_id=f"evt-{index + 2}",
            )
        with self.assertRaises(DepthLimitError):
            _fork(
                store,
                "conv-1",
                "too-deep",
                parent_id=current["branch_id"],
                event_id="evt-overflow",
            )

    def test_rejects_fork_beyond_custom_max_depth(self) -> None:
        store = _store(self)
        store.put_config({"max_depth": 1})
        root = _fork(store, "conv-1", "main")
        child = _fork(store, "conv-1", "child", parent_id=root["branch_id"])
        self.assertEqual(child["depth"], 1)
        with self.assertRaises(DepthLimitError):
            _fork(store, "conv-1", "grandchild", parent_id=child["branch_id"])

    def test_parent_is_unchanged_after_fork(self) -> None:
        store = _store(self)
        root = _fork(store, "conv-1", "main")
        parent_before = dict(root)
        child = _fork(store, "conv-1", "experiment", parent_id=root["branch_id"])
        listed = {item["branch_id"]: item for item in store.list_branches("conv-1")}
        parent_after = listed[root["branch_id"]]
        self.assertEqual(parent_after["name"], parent_before["name"])
        self.assertEqual(parent_after["depth"], parent_before["depth"])
        self.assertEqual(
            parent_after["diverged_at_event_id"],
            parent_before["diverged_at_event_id"],
        )
        self.assertEqual(child["parent_id"], root["branch_id"])
        self.assertEqual(child["ancestry"], [root["branch_id"]])

    def test_rejoin_bookkeeping(self) -> None:
        store = _store(self)
        root = _fork(store, "conv-1", "main")
        child = _fork(store, "conv-1", "experiment", parent_id=root["branch_id"])
        result = store.rejoin(
            root["branch_id"],
            child["branch_id"],
            "2026-01-02T00:00:00+00:00",
        )
        self.assertEqual(result["rejoin"]["from_branch_id"], child["branch_id"])
        rejoins = result["branch"]["rejoins"]
        self.assertEqual(len(rejoins), 1)
        self.assertEqual(rejoins[0]["rejoin_event_ts"], "2026-01-02T00:00:00+00:00")

    def test_rename_and_missing_parent(self) -> None:
        store = _store(self)
        root = _fork(store, "conv-1", "main")
        renamed = store.rename_branch(root["branch_id"], "trunk")
        self.assertEqual(renamed["name"], "trunk")
        with self.assertRaises(NotFoundError):
            _fork(store, "conv-1", "orphan", parent_id="missing")

    def test_import_project_yaml_max_depth(self) -> None:
        store = _store(self)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "project.yaml")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(
                    "project:\n  name: Demo\n  context:\n    max_depth: 2\n"
                )
            config = store.import_project_config(path)
        self.assertEqual(config["max_depth"], 2)
