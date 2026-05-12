#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from .runtime import (
    get_db_connection,
    init_db,
    json_bytes,
    load_data,
    normalize_bool,
    new_id,
    now_iso,
    require_fields,
    send_temperature_udp,
)


class AppHandler(BaseHTTPRequestHandler):
    server_version = "ETOHTTP/0.2"

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            body = self.read_json_body()
        except ValueError as exc:
            self.respond_json(400, {"error": str(exc)})
            return

        if parsed.path == "/api/agent/register":
            self.handle_agent_register(body)
            return

        if parsed.path == "/api/agent/heartbeat":
            self.handle_agent_heartbeat(body)
            return

        if parsed.path == "/api/agent/events":
            self.handle_agent_events(body)
            return

        self.respond_json(404, {"error": "not found"})

    def do_GET(self):
        parsed = urlparse(self.path)
        data = load_data()

        if parsed.path == "/udp/temperature":
            query = parse_qs(parsed.query)
            try:
                target_host = query["targetHost"][0]
                target_port = int(query["targetPort"][0])
                message = query["message"][0]
                client = query.get("client", ["messages_client"])[0]
                payload = send_temperature_udp(target_host, target_port, message, client=client)
            except (KeyError, TypeError, ValueError, IndexError) as exc:
                self.respond_json(400, {"error": str(exc)})
                return

            self.respond_json(200, {"status": "sent", "payloadLength": len(payload), "payload": payload.decode("utf-8", errors="replace").rstrip()})
            return

        if parsed.path == "/health":
            self.respond_json(200, {"status": "ok"})
            return

        if parsed.path == "/api/agents":
            with get_db_connection() as connection:
                rows = connection.execute(
                    """
                    SELECT
                        r.agent_id,
                        r.host_id,
                        r.hostname,
                        r.version,
                        r.host_external_ip,
                        r.registered_at,
                        r.last_seen_at,
                        r.healthy,
                        r.queue_depth,
                        COALESCE(MAX(b.sequence), 0) AS last_sequence
                    FROM agent_registry r
                    LEFT JOIN agent_event_batches b ON b.agent_id = r.agent_id
                    GROUP BY r.agent_id
                    ORDER BY r.last_seen_at DESC
                    """
                ).fetchall()
            items = [self._row_to_agent(row) for row in rows]
            self.respond_json(200, {"items": items})
            return

        if parsed.path.startswith("/api/agents/"):
            path_parts = parsed.path.strip("/").split("/")
            agent_id = path_parts[2] if len(path_parts) >= 3 else ""
            sequence_only = len(path_parts) == 4 and path_parts[3] == "sequence"
            with get_db_connection() as connection:
                row = connection.execute(
                    """
                    SELECT
                        r.agent_id,
                        r.host_id,
                        r.hostname,
                        r.version,
                        r.host_external_ip,
                        r.registered_at,
                        r.last_seen_at,
                        r.healthy,
                        r.queue_depth,
                        COALESCE(MAX(b.sequence), 0) AS last_sequence
                    FROM agent_registry r
                    LEFT JOIN agent_event_batches b ON b.agent_id = r.agent_id
                    WHERE r.agent_id = ?
                    GROUP BY r.agent_id
                    """,
                    (agent_id,),
                ).fetchone()
            if not row:
                self.respond_json(404, {"error": "agent not found"})
                return
            agent = self._row_to_agent(row)
            if sequence_only:
                self.respond_json(200, {"agent_id": agent["agent_id"], "last_sequence": agent["last_sequence"], "next_sequence": agent["last_sequence"] + 1})
            else:
                self.respond_json(200, agent)
            return

        if parsed.path == "/api/heartbeats":
            with get_db_connection() as connection:
                rows = connection.execute(
                    "SELECT id, agent_id, timestamp_ns, healthy, queue_depth, received_at FROM agent_heartbeats ORDER BY received_at DESC"
                ).fetchall()
            self.respond_json(200, {"items": [self._row_to_heartbeat(row) for row in rows]})
            return

        if parsed.path == "/api/events":
            with get_db_connection() as connection:
                rows = connection.execute(
                    "SELECT * FROM agent_events ORDER BY received_at DESC"
                ).fetchall()
            self.respond_json(200, {"items": [self._decode_agent_event_row(row) for row in rows]})
            return

        if parsed.path.startswith("/api/events/"):
            event_id = parsed.path.rsplit("/", 1)[-1]
            with get_db_connection() as connection:
                row = connection.execute("SELECT * FROM agent_events WHERE id = ?", (event_id,)).fetchone()
            if row:
                self.respond_json(200, self._decode_agent_event_row(row))
            else:
                self.respond_json(404, {"error": "event not found"})
            return

        if parsed.path == "/stats/overview":
            payload = {
                "overview": data["overview"],
                "trend": data["trend"],
                "topRules": data["topRules"]
            }
            self.respond_json(200, payload)
            return

        if parsed.path == "/rules":
            self.respond_json(200, {"items": data["rules"]})
            return

        if parsed.path.startswith("/rules/"):
            rule_id = parsed.path.rsplit("/", 1)[-1]
            item = next((rule for rule in data["rules"] if rule["id"] == rule_id), None)
            if item:
                self.respond_json(200, item)
            else:
                self.respond_json(404, {"error": "rule not found"})
            return

        if parsed.path == "/events":
            items = data["events"]
            query = parse_qs(parsed.query)

            action = query.get("action", [None])[0]
            rule = query.get("rule", [None])[0]

            if action:
                items = [item for item in items if item["action"] == action]
            if rule:
                items = [item for item in items if item["rule"] == rule]

            self.respond_json(200, {"items": items})
            return

        if parsed.path.startswith("/events/"):
            event_id = parsed.path.rsplit("/", 1)[-1]
            item = next((event for event in data["events"] if event["id"] == event_id), None)
            if item:
                self.respond_json(200, item)
            else:
                self.respond_json(404, {"error": "event not found"})
            return

        if parsed.path == "/audit-logs":
            self.respond_json(200, {"items": data["audit"]})
            return

        if parsed.path == "/demo-data":
            self.respond_json(200, data)
            return

        self.respond_json(404, {"error": "not found"})

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length)
        if not raw:
            return {}
        try:
            import json
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSON body: {exc.msg}") from exc

    def handle_agent_register(self, body):
        try:
            require_fields(body, ["agent_id", "hostname", "host_ip", "version"])
        except ValueError as exc:
            self.respond_json(400, {"error": str(exc)})
            return

        agent_id = str(body["agent_id"])
        record = {
            "agent_id": agent_id,
            "host_id": str(body.get("host_id") or body["agent_id"]),
            "hostname": str(body["hostname"]),
            "version": str(body["version"]),
            "registered_at": now_iso(),
            "last_seen_at": now_iso(),
            "healthy": 1,
            "queue_depth": 0,
            "host_external_ip": str(body["host_ip"]),
        }
        with get_db_connection() as connection:
            existing = connection.execute("SELECT agent_id FROM agent_registry WHERE agent_id = ?", (agent_id,)).fetchone()
            if existing:
                self.respond_json(200, {"ok": True})
                return

            connection.execute(
                """
                INSERT INTO agent_registry (agent_id, host_id, hostname, version, host_external_ip, registered_at, last_seen_at, healthy, queue_depth)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["agent_id"],
                    record["host_id"],
                    record["hostname"],
                    record["version"],
                    record["host_external_ip"],
                    record["registered_at"],
                    record["last_seen_at"],
                    record["healthy"],
                    record["queue_depth"],
                ),
            )
        self.respond_json(200, {"ok": True})

    def handle_agent_heartbeat(self, body):
        try:
            require_fields(body, ["agent_id", "timestamp_ns", "host_ip", "healthy", "queue_depth"])
        except ValueError as exc:
            self.respond_json(400, {"error": str(exc)})
            return

        agent_id = str(body["agent_id"])
        try:
            queue_depth = int(body["queue_depth"])
        except (TypeError, ValueError):
            self.respond_json(400, {"error": "queue_depth must be an integer"})
            return

        heartbeat = {
            "id": new_id("hb"),
            "agent_id": agent_id,
            "timestamp_ns": str(body["timestamp_ns"]),
            "healthy": 1 if normalize_bool(body["healthy"]) else 0,
            "queue_depth": queue_depth,
            "received_at": now_iso(),
        }
        with get_db_connection() as connection:
            row = connection.execute("SELECT agent_id FROM agent_registry WHERE agent_id = ?", (agent_id,)).fetchone()
            if not row:
                self.respond_json(404, {"error": "agent not registered"})
                return
            connection.execute(
                "INSERT INTO agent_heartbeats (id, agent_id, timestamp_ns, healthy, queue_depth, received_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    heartbeat["id"],
                    heartbeat["agent_id"],
                    heartbeat["timestamp_ns"],
                    heartbeat["healthy"],
                    heartbeat["queue_depth"],
                    heartbeat["received_at"],
                ),
            )
            connection.execute(
                "UPDATE agent_registry SET last_seen_at = ?, healthy = ?, queue_depth = ?, host_external_ip = ? WHERE agent_id = ?",
                (heartbeat["received_at"], heartbeat["healthy"], queue_depth, str(body["host_ip"]), agent_id),
            )
        self.respond_json(200, {"ok": True})

    def handle_agent_events(self, body):
        try:
            require_fields(body, ["agent_id", "sequence", "host_external_ip", "events"])
        except ValueError as exc:
            self.respond_json(400, {"error": str(exc)})
            return

        agent_id = str(body["agent_id"])
        try:
            sequence = int(body["sequence"])
        except (TypeError, ValueError):
            self.respond_json(400, {"error": "sequence must be an integer"})
            return

        events = body["events"]
        if not isinstance(events, list) or not events:
            self.respond_json(400, {"error": "events must be a non-empty array"})
            return

        batch_id = new_id("batch")
        received_at = now_iso()
        normalized_events = []
        with get_db_connection() as connection:
            row = connection.execute("SELECT agent_id FROM agent_registry WHERE agent_id = ?", (agent_id,)).fetchone()
            if not row:
                self.respond_json(404, {"error": "agent not registered"})
                return

            existing = connection.execute(
                "SELECT sequence FROM agent_event_batches WHERE agent_id = ? AND sequence = ?",
                (agent_id, sequence),
            ).fetchone()
            if existing:
                self.respond_json(409, {"error": "sequence already processed", "lastSequence": int(existing["sequence"])} )
                return

            for index, event in enumerate(events):
                if not isinstance(event, dict):
                    self.respond_json(400, {"error": f"events[{index}] must be an object"})
                    return
                try:
                    require_fields(event, ["timestamp_ns", "event_type", "direction", "protocol", "pid", "comm"])
                except ValueError as exc:
                    self.respond_json(400, {"error": f"events[{index}] {str(exc)}"})
                    return

                normalized = {
                    "id": event.get("id", new_id("evt")),
                    "batch_id": batch_id,
                    "agent_id": agent_id,
                    "sequence": sequence,
                    "event_index": index,
                    "host_external_ip": body["host_external_ip"],
                    "received_at": received_at,
                    "timestamp_ns": str(event["timestamp_ns"]),
                    "event_type": str(event["event_type"]),
                    "direction": str(event["direction"]),
                    "protocol": str(event["protocol"]),
                    "pid": int(event["pid"]),
                    "comm": str(event["comm"]),
                    "cgroup_id": event.get("cgroup_id"),
                    "src_ip": event.get("src_ip") or event.get("local_ip"),
                    "src_port": event.get("src_port") or event.get("local_port"),
                    "dst_ip": event.get("dst_ip") or event.get("remote_ip"),
                    "dst_port": event.get("dst_port") or event.get("remote_port"),
                    "extra_json": json_bytes({
                        "tid": event.get("tid"),
                        "uid": event.get("uid"),
                        "local_ip": event.get("local_ip"),
                        "local_port": event.get("local_port"),
                        "remote_ip": event.get("remote_ip"),
                        "remote_port": event.get("remote_port"),
                        **(event.get("extra") or {}),
                    }).decode("utf-8"),
                }
                normalized_events.append(normalized)

            connection.execute(
                "INSERT INTO agent_event_batches (id, agent_id, sequence, host_external_ip, received_at, event_count) VALUES (?, ?, ?, ?, ?, ?)",
                (batch_id, agent_id, sequence, body["host_external_ip"], received_at, len(normalized_events)),
            )
            for event in normalized_events:
                connection.execute(
                    """
                    INSERT INTO agent_events (
                        id, batch_id, agent_id, sequence, event_index, host_external_ip, received_at,
                        timestamp_ns, event_type, direction, protocol, pid, comm, cgroup_id,
                        src_ip, src_port, dst_ip, dst_port, extra_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event["id"],
                        event["batch_id"],
                        event["agent_id"],
                        event["sequence"],
                        event["event_index"],
                        event["host_external_ip"],
                        event["received_at"],
                        event["timestamp_ns"],
                        event["event_type"],
                        event["direction"],
                        event["protocol"],
                        event["pid"],
                        event["comm"],
                        event["cgroup_id"],
                        event["src_ip"],
                        event["src_port"],
                        event["dst_ip"],
                        event["dst_port"],
                        event["extra_json"],
                    ),
                )
            connection.execute(
                "UPDATE agent_registry SET last_seen_at = ? WHERE agent_id = ?",
                (received_at, agent_id),
            )
        self.respond_json(200, {"ok": True, "eventCount": len(normalized_events), "sequence": sequence})

    def _row_to_agent(self, row):
        payload = dict(row)
        payload["healthy"] = bool(payload.get("healthy"))
        payload["last_sequence"] = int(payload.get("last_sequence") or 0)
        payload["next_sequence"] = payload["last_sequence"] + 1
        return payload

    def _row_to_heartbeat(self, row):
        payload = dict(row)
        payload["healthy"] = bool(payload.get("healthy"))
        return payload

    def _decode_agent_event_row(self, row):
        payload = dict(row)
        extra_json = payload.pop("extra_json", None)
        if extra_json is not None:
            try:
                payload["extra"] = __import__("json").loads(extra_json)
            except __import__("json").JSONDecodeError:
                payload["extra"] = extra_json
        else:
            payload["extra"] = None
        return payload

    def log_message(self, format, *args):
        return

    def respond_json(self, status, payload):
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)
