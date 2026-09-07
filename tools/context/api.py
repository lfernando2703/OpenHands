"""REST handlers for git-like context branches.

Until these routes are mounted on the agent-server, they are served by the
kanban sidecar (same pattern as standards) at ``/api/context/*``.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from context_store import (
    ContextError,
    ContextStore,
    default_db_path,
    get_active_store,
    set_active_store,
)

JsonBody = dict[str, Any] | None
Handler = Callable[["ContextService", dict[str, str], JsonBody], tuple[int, Any]]

BRANCHES_PATH = "/api/context/branches"
BRANCH_PATH = r"/api/context/branches/(?P<branch_id>[^/]+)"
REJOIN_PATH = r"/api/context/branches/(?P<branch_id>[^/]+)/rejoin"
REWIND_PATH = r"/api/context/branches/(?P<branch_id>[^/]+)/rewind"
CONFIG_PATH = "/api/context/config"
IMPORT_PATH = "/api/context/import-project-config"
CHECKPOINTS_PATH = "/api/context/checkpoints"
CHECKPOINT_PATH = r"/api/context/checkpoints/(?P<checkpoint_id>[^/]+)"
EXPORT_PATH = "/api/context/export"


class ContextService:
    def __init__(self, store: ContextStore) -> None:
        self.store = store

    def close(self) -> None:
        self.store.close()


def _json_body(body: JsonBody) -> dict[str, Any]:
    return body if isinstance(body, dict) else {}


def _query(path: str) -> dict[str, str]:
    parsed = urlparse(path)
    return {key: values[-1] for key, values in parse_qs(parsed.query).items()}


def _post_branch(
    service: ContextService, _params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    payload = _json_body(body)
    branch = service.store.create_branch(
        conversation_id=str(payload.get("conversation_id") or ""),
        name=str(payload.get("name") or ""),
        diverged_at_event_ts=str(payload.get("diverged_at_event_ts") or ""),
        diverged_at_event_id=str(payload.get("diverged_at_event_id") or ""),
        parent_branch_id=str(payload["parent_branch_id"])
        if payload.get("parent_branch_id")
        else None,
    )
    return 200, {"branch": branch}


def _list_branches(
    service: ContextService, params: dict[str, str], _body: JsonBody
) -> tuple[int, Any]:
    conversation_id = str(params.get("conversation_id") or "").strip()
    if not conversation_id:
        raise ContextError("conversation_id is required")
    return 200, {"branches": service.store.list_branches(conversation_id)}


def _rename_branch(
    service: ContextService, params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    payload = _json_body(body)
    branch = service.store.rename_branch(
        params["branch_id"], str(payload.get("name") or "")
    )
    return 200, {"branch": branch}


def _rejoin(
    service: ContextService, params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    payload = _json_body(body)
    return 200, service.store.rejoin(
        params["branch_id"],
        str(payload.get("from_branch_id") or ""),
        str(payload.get("rejoin_event_ts") or ""),
    )


def _get_config(
    service: ContextService, _params: dict[str, str], _body: JsonBody
) -> tuple[int, Any]:
    return 200, service.store.get_config()


def _put_config(
    service: ContextService, _params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    payload = _json_body(body)
    project_yaml = payload.pop("project_yaml", None)
    updated = service.store.put_config(payload)
    if project_yaml:
        try:
            updated = service.store.import_project_config(str(project_yaml))
        except Exception:
            pass
    return 200, updated


def _import_project(
    service: ContextService, _params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    path = str(_json_body(body).get("path") or "").strip()
    if not path:
        raise ContextError("path is required")
    return 200, service.store.import_project_config(path)


def _post_checkpoint(
    service: ContextService, _params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    payload = _json_body(body)
    checkpoint = service.store.create_checkpoint(
        str(payload.get("branch_id") or ""),
        str(payload.get("label") or ""),
        str(payload.get("at_event_ts") or ""),
    )
    return 200, {"checkpoint": checkpoint}


def _list_checkpoints(
    service: ContextService, params: dict[str, str], _body: JsonBody
) -> tuple[int, Any]:
    return 200, {
        "checkpoints": service.store.list_checkpoints(
            conversation_id=params.get("conversation_id"),
            branch_id=params.get("branch_id"),
        )
    }


def _delete_checkpoint(
    service: ContextService, params: dict[str, str], _body: JsonBody
) -> tuple[int, Any]:
    service.store.delete_checkpoint(params["checkpoint_id"])
    return 200, {"ok": True}


def _rewind_branch(
    service: ContextService, params: dict[str, str], body: JsonBody
) -> tuple[int, Any]:
    payload = _json_body(body)
    rewind = service.store.record_rewind(
        params["branch_id"],
        str(payload.get("after_timestamp") or ""),
    )
    return 200, {"rewind": rewind}


def _export_branch(
    service: ContextService, params: dict[str, str], _body: JsonBody
) -> tuple[int, Any]:
    branch_id = str(params.get("branch_id") or "").strip()
    if not branch_id:
        raise ContextError("branch_id is required")
    return 200, service.store.export_branch(branch_id)


ROUTES: tuple[tuple[str, re.Pattern[str], Handler], ...] = (
    ("POST", re.compile(rf"^{BRANCHES_PATH}$"), _post_branch),
    ("GET", re.compile(rf"^{BRANCHES_PATH}$"), _list_branches),
    ("PUT", re.compile(rf"^{BRANCH_PATH}$"), _rename_branch),
    ("POST", re.compile(rf"^{REJOIN_PATH}$"), _rejoin),
    ("POST", re.compile(rf"^{REWIND_PATH}$"), _rewind_branch),
    ("GET", re.compile(rf"^{CONFIG_PATH}$"), _get_config),
    ("PUT", re.compile(rf"^{CONFIG_PATH}$"), _put_config),
    ("POST", re.compile(rf"^{IMPORT_PATH}$"), _import_project),
    ("POST", re.compile(rf"^{CHECKPOINTS_PATH}$"), _post_checkpoint),
    ("GET", re.compile(rf"^{CHECKPOINTS_PATH}$"), _list_checkpoints),
    ("DELETE", re.compile(rf"^{CHECKPOINT_PATH}$"), _delete_checkpoint),
    ("GET", re.compile(rf"^{EXPORT_PATH}$"), _export_branch),
)


def handle_request(
    service: ContextService,
    method: str,
    path: str,
    body: JsonBody = None,
) -> tuple[int, Any]:
    pathname = urlparse(path).path
    params = _query(path)
    try:
        for route_method, pattern, handler in ROUTES:
            if route_method != method:
                continue
            match = pattern.match(pathname)
            if match is None:
                continue
            params.update(match.groupdict())
            return handler(service, params, body)
        return 404, {"error": f"No route for {method} {pathname}"}
    except ContextError as exc:
        return exc.status, {"error": str(exc)}
    except (TypeError, ValueError) as exc:
        return 400, {"error": str(exc)}


class ContextRequestHandler(BaseHTTPRequestHandler):
    server: "ContextHTTPServer"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch()

    def do_PUT(self) -> None:  # noqa: N802
        self._dispatch()

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch()

    def do_DELETE(self) -> None:  # noqa: N802
        self._dispatch()

    def _dispatch(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        payload: JsonBody = json.loads(raw) if raw else None
        status, data = handle_request(
            self.server.service, self.command, self.path, payload
        )
        body = b"" if data is None else json.dumps(data).encode()
        self.send_response(status)
        if body:
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Type", "application/json")
        else:
            self.send_header("Content-Length", "0")
        self.end_headers()
        if body:
            self.wfile.write(body)


class ContextHTTPServer(ThreadingHTTPServer):
    def __init__(
        self,
        server_address: tuple[str, int],
        service: ContextService,
    ) -> None:
        super().__init__(server_address, ContextRequestHandler)
        self.service = service


def serve_context(
    host: str,
    port: int,
    service: ContextService | None = None,
) -> ContextHTTPServer:
    if service is None:
        store = get_active_store() or ContextStore(default_db_path())
        set_active_store(store)
        service = ContextService(store)
    return ContextHTTPServer((host, port), service)


def main() -> None:
    parser = argparse.ArgumentParser(description="Context-branch HTTP API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18013)
    parser.add_argument("--db", default=None)
    args = parser.parse_args()
    store = ContextStore(args.db or default_db_path())
    set_active_store(store)
    service = ContextService(store)
    server = serve_context(args.host, args.port, service=service)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    finally:
        server.server_close()
        service.close()


if __name__ == "__main__":
    main()
