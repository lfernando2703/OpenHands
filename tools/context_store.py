"""SQLite store for git-like conversation context branches.

Branch, rejoin, and max-depth config live beside the other agent-canvas
stores under ``~/.openhands/agent-canvas/context.sqlite``. Forks are
metadata only: they do not start conversations or mutate events.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

CONTEXT_DB_FILENAME = "context.sqlite"
CONFIG_MAX_DEPTH = "max_depth"
DEFAULT_MAX_DEPTH = 3
MIN_MAX_DEPTH = 1


class ContextError(Exception):
    """Raised for invalid context-store operations."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


class NotFoundError(ContextError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status=404)


class DepthLimitError(ContextError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status=422)


def default_db_path() -> str:
    root = os.path.join(os.path.expanduser("~"), ".openhands", "agent-canvas")
    os.makedirs(root, exist_ok=True)
    return os.path.join(root, CONTEXT_DB_FILENAME)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


_ACTIVE: "ContextStore | None" = None


def get_active_store() -> "ContextStore | None":
    return _ACTIVE


def set_active_store(store: "ContextStore | None") -> None:
    global _ACTIVE
    _ACTIVE = store


class ContextStore:
    """CRUD store for context branches, rejoins, and depth config."""

    def __init__(self, db_path: str = ":memory:") -> None:
        self.db_path = db_path
        self._lock = threading.RLock()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self._init_schema()

    def close(self) -> None:
        self.conn.close()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS branches (
                branch_id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                parent_id TEXT,
                name TEXT NOT NULL,
                diverged_at_event_ts TEXT NOT NULL,
                diverged_at_event_id TEXT NOT NULL,
                depth INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES branches(branch_id)
            );
            CREATE TABLE IF NOT EXISTS forks (
                id TEXT PRIMARY KEY,
                branch_id TEXT NOT NULL,
                from_branch_id TEXT NOT NULL,
                rejoin_event_ts TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
                FOREIGN KEY (from_branch_id) REFERENCES branches(branch_id)
            );
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS checkpoints (
                id TEXT PRIMARY KEY,
                branch_id TEXT NOT NULL,
                label TEXT NOT NULL,
                at_event_ts TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
            );
            CREATE TABLE IF NOT EXISTS rewinds (
                id TEXT PRIMARY KEY,
                branch_id TEXT NOT NULL,
                after_timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
            );
            """
        )
        existing = self.conn.execute(
            "SELECT value FROM config WHERE key = ?", (CONFIG_MAX_DEPTH,)
        ).fetchone()
        if existing is None:
            self.conn.execute(
                "INSERT INTO config (key, value) VALUES (?, ?)",
                (CONFIG_MAX_DEPTH, str(DEFAULT_MAX_DEPTH)),
            )
        self.conn.commit()

    def get_config(self) -> dict[str, Any]:
        with self._lock:
            row = self.conn.execute(
                "SELECT value FROM config WHERE key = ?", (CONFIG_MAX_DEPTH,)
            ).fetchone()
            raw = row["value"] if row else str(DEFAULT_MAX_DEPTH)
            try:
                max_depth = int(raw)
            except (TypeError, ValueError):
                max_depth = DEFAULT_MAX_DEPTH
            return {CONFIG_MAX_DEPTH: max_depth}

    def put_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        if CONFIG_MAX_DEPTH in payload:
            try:
                max_depth = int(payload[CONFIG_MAX_DEPTH])
            except (TypeError, ValueError) as exc:
                raise ContextError("max_depth must be an integer") from exc
            if max_depth < MIN_MAX_DEPTH:
                raise ContextError("max_depth must be >= 1")
            with self._lock:
                self.conn.execute(
                    "INSERT INTO config (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (CONFIG_MAX_DEPTH, str(max_depth)),
                )
                self.conn.commit()
        return self.get_config()

    def import_project_config(self, path: str) -> dict[str, Any]:
        from project_config import load_project_config

        data = load_project_config(os.path.abspath(path))
        context = (data.get("project") or {}).get("context") or {}
        if not isinstance(context, dict):
            context = {}
        if CONFIG_MAX_DEPTH in context:
            return self.put_config({CONFIG_MAX_DEPTH: context[CONFIG_MAX_DEPTH]})
        return self.get_config()

    def _get_branch(self, branch_id: str) -> dict[str, Any]:
        row = _row_to_dict(
            self.conn.execute(
                "SELECT * FROM branches WHERE branch_id = ?", (branch_id,)
            ).fetchone()
        )
        if row is None:
            raise NotFoundError(f"branch {branch_id} not found")
        return row

    def _ancestry(self, branch: dict[str, Any]) -> list[str]:
        chain: list[str] = []
        parent_id = branch.get("parent_id")
        seen: set[str] = set()
        while parent_id:
            if parent_id in seen:
                break
            seen.add(parent_id)
            chain.append(parent_id)
            row = _row_to_dict(
                self.conn.execute(
                    "SELECT parent_id FROM branches WHERE branch_id = ?",
                    (parent_id,),
                ).fetchone()
            )
            parent_id = row["parent_id"] if row else None
        return chain

    def _rejoins_for(self, branch_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM forks WHERE branch_id = ? ORDER BY created_at",
            (branch_id,),
        ).fetchall()
        return [_row_to_dict(row) for row in rows]  # type: ignore[misc]

    def _serialize(self, branch: dict[str, Any]) -> dict[str, Any]:
        return {
            **branch,
            "ancestry": self._ancestry(branch),
            "rejoins": self._rejoins_for(branch["branch_id"]),
        }

    def list_branches(self, conversation_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.conn.execute(
                "SELECT * FROM branches WHERE conversation_id = ? "
                "ORDER BY created_at",
                (conversation_id,),
            ).fetchall()
            return [self._serialize(_row_to_dict(row) or {}) for row in rows]

    def create_branch(
        self,
        conversation_id: str,
        name: str,
        diverged_at_event_ts: str,
        diverged_at_event_id: str,
        parent_branch_id: str | None = None,
    ) -> dict[str, Any]:
        conversation_id = (conversation_id or "").strip()
        name = (name or "").strip()
        diverged_at_event_ts = (diverged_at_event_ts or "").strip()
        diverged_at_event_id = (diverged_at_event_id or "").strip()
        if not conversation_id:
            raise ContextError("conversation_id is required")
        if not name:
            raise ContextError("name is required")
        if not diverged_at_event_ts or not diverged_at_event_id:
            raise ContextError("divergence event id and timestamp are required")

        with self._lock:
            max_depth = int(self.get_config()[CONFIG_MAX_DEPTH])
            parent: dict[str, Any] | None = None
            parent_snapshot: dict[str, Any] | None = None
            if parent_branch_id:
                parent = self._get_branch(parent_branch_id)
                parent_snapshot = dict(parent)
                depth = int(parent["depth"]) + 1
            else:
                depth = 0
            if depth > max_depth:
                raise DepthLimitError(
                    f"fork depth {depth} exceeds max_depth {max_depth}"
                )
            branch_id = new_id()
            created_at = utc_now()
            self.conn.execute(
                """
                INSERT INTO branches (
                    branch_id, conversation_id, parent_id, name,
                    diverged_at_event_ts, diverged_at_event_id, depth, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    branch_id,
                    conversation_id,
                    parent["branch_id"] if parent else None,
                    name,
                    diverged_at_event_ts,
                    diverged_at_event_id,
                    depth,
                    created_at,
                ),
            )
            self.conn.commit()
            created = self._serialize(self._get_branch(branch_id))
            if parent_snapshot is not None:
                current_parent = self._get_branch(parent_snapshot["branch_id"])
                for key in (
                    "name",
                    "diverged_at_event_ts",
                    "diverged_at_event_id",
                    "depth",
                    "parent_id",
                    "conversation_id",
                    "created_at",
                ):
                    if current_parent[key] != parent_snapshot[key]:
                        raise ContextError("parent branch was mutated")
            return created

    def rename_branch(self, branch_id: str, name: str) -> dict[str, Any]:
        name = (name or "").strip()
        if not name:
            raise ContextError("name is required")
        with self._lock:
            self._get_branch(branch_id)
            self.conn.execute(
                "UPDATE branches SET name = ? WHERE branch_id = ?",
                (name, branch_id),
            )
            self.conn.commit()
            return self._serialize(self._get_branch(branch_id))

    def rejoin(
        self,
        branch_id: str,
        from_branch_id: str,
        rejoin_event_ts: str,
    ) -> dict[str, Any]:
        rejoin_event_ts = (rejoin_event_ts or "").strip()
        from_branch_id = (from_branch_id or "").strip()
        if not from_branch_id or not rejoin_event_ts:
            raise ContextError("from_branch_id and rejoin_event_ts are required")
        with self._lock:
            target = self._get_branch(branch_id)
            source = self._get_branch(from_branch_id)
            if source["conversation_id"] != target["conversation_id"]:
                raise ContextError("rejoin branches must share a conversation")
            record = {
                "id": new_id(),
                "branch_id": branch_id,
                "from_branch_id": from_branch_id,
                "rejoin_event_ts": rejoin_event_ts,
                "created_at": utc_now(),
            }
            self.conn.execute(
                """
                INSERT INTO forks (id, branch_id, from_branch_id, rejoin_event_ts, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["branch_id"],
                    record["from_branch_id"],
                    record["rejoin_event_ts"],
                    record["created_at"],
                ),
            )
            self.conn.commit()
            return {
                "rejoin": record,
                "branch": self._serialize(self._get_branch(branch_id)),
            }

    def _checkpoint_row(self, row: sqlite3.Row) -> dict[str, Any]:
        data = _row_to_dict(row) or {}
        branch = self._get_branch(str(data["branch_id"]))
        data["conversation_id"] = branch["conversation_id"]
        return data

    def create_checkpoint(
        self, branch_id: str, label: str, at_event_ts: str
    ) -> dict[str, Any]:
        label = (label or "").strip()
        at_event_ts = (at_event_ts or "").strip()
        branch_id = (branch_id or "").strip()
        if not branch_id or not label or not at_event_ts:
            raise ContextError("branch_id, label, and at_event_ts are required")
        with self._lock:
            self._get_branch(branch_id)
            record = {
                "id": new_id(),
                "branch_id": branch_id,
                "label": label,
                "at_event_ts": at_event_ts,
                "created_at": utc_now(),
            }
            self.conn.execute(
                """
                INSERT INTO checkpoints (id, branch_id, label, at_event_ts, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["branch_id"],
                    record["label"],
                    record["at_event_ts"],
                    record["created_at"],
                ),
            )
            self.conn.commit()
            record["conversation_id"] = self._get_branch(branch_id)["conversation_id"]
            return record

    def list_checkpoints(
        self,
        conversation_id: str | None = None,
        branch_id: str | None = None,
    ) -> list[dict[str, Any]]:
        conversation_id = (conversation_id or "").strip() or None
        branch_id = (branch_id or "").strip() or None
        with self._lock:
            if branch_id:
                self._get_branch(branch_id)
                rows = self.conn.execute(
                    "SELECT * FROM checkpoints WHERE branch_id = ? ORDER BY created_at",
                    (branch_id,),
                ).fetchall()
            elif conversation_id:
                rows = self.conn.execute(
                    """
                    SELECT c.* FROM checkpoints c
                    JOIN branches b ON b.branch_id = c.branch_id
                    WHERE b.conversation_id = ?
                    ORDER BY c.created_at
                    """,
                    (conversation_id,),
                ).fetchall()
            else:
                raise ContextError("conversation_id or branch_id is required")
            return [self._checkpoint_row(row) for row in rows]

    def delete_checkpoint(self, checkpoint_id: str) -> None:
        checkpoint_id = (checkpoint_id or "").strip()
        if not checkpoint_id:
            raise ContextError("checkpoint id is required")
        with self._lock:
            row = self.conn.execute(
                "SELECT id FROM checkpoints WHERE id = ?", (checkpoint_id,)
            ).fetchone()
            if row is None:
                raise NotFoundError(f"checkpoint {checkpoint_id} not found")
            self.conn.execute(
                "DELETE FROM checkpoints WHERE id = ?", (checkpoint_id,)
            )
            self.conn.commit()

    def record_rewind(self, branch_id: str, after_timestamp: str) -> dict[str, Any]:
        after_timestamp = (after_timestamp or "").strip()
        branch_id = (branch_id or "").strip()
        if not branch_id or not after_timestamp:
            raise ContextError("branch_id and after_timestamp are required")
        with self._lock:
            self._get_branch(branch_id)
            record = {
                "id": new_id(),
                "branch_id": branch_id,
                "after_timestamp": after_timestamp,
                "created_at": utc_now(),
            }
            self.conn.execute(
                """
                INSERT INTO rewinds (id, branch_id, after_timestamp, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["branch_id"],
                    record["after_timestamp"],
                    record["created_at"],
                ),
            )
            self.conn.commit()
            return record

    def export_branch(self, branch_id: str) -> dict[str, Any]:
        branch_id = (branch_id or "").strip()
        if not branch_id:
            raise ContextError("branch_id is required")
        with self._lock:
            branch = self._serialize(self._get_branch(branch_id))
            checkpoints = self.list_checkpoints(branch_id=branch_id)
            return {
                "conversation_id": branch["conversation_id"],
                "branch_id": branch_id,
                "divergence": {
                    "parent_id": branch["parent_id"],
                    "event_id": branch["diverged_at_event_id"],
                    "event_ts": branch["diverged_at_event_ts"],
                },
                "checkpoints": checkpoints,
                "events": [],
            }
