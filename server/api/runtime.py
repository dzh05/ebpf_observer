#!/usr/bin/env python3

import json
import socket
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4


ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "sample_data.json"
DB_FILE = ROOT / "data" / "observatory.db"
UDP_PAYLOAD_SIZE = 200
DB_LOCK = Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_data():
    with DATA_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_db_connection():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DB_LOCK:
        with get_db_connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS agent_registry (
                    agent_id TEXT PRIMARY KEY,
                    host_id TEXT,
                    hostname TEXT NOT NULL,
                    version TEXT NOT NULL,
                    host_external_ip TEXT,
                    registered_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    healthy INTEGER NOT NULL DEFAULT 1,
                    queue_depth INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS agent_heartbeats (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    timestamp_ns TEXT NOT NULL,
                    healthy INTEGER NOT NULL,
                    queue_depth INTEGER NOT NULL,
                    received_at TEXT NOT NULL,
                    FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id)
                );

                CREATE TABLE IF NOT EXISTS agent_event_batches (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    host_external_ip TEXT NOT NULL,
                    received_at TEXT NOT NULL,
                    event_count INTEGER NOT NULL,
                    FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id),
                    UNIQUE(agent_id, sequence)
                );

                CREATE TABLE IF NOT EXISTS agent_events (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    event_index INTEGER NOT NULL,
                    host_external_ip TEXT NOT NULL,
                    received_at TEXT NOT NULL,
                    timestamp_ns TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    protocol TEXT NOT NULL,
                    pid INTEGER NOT NULL,
                    comm TEXT NOT NULL,
                    cgroup_id TEXT,
                    src_ip TEXT,
                    src_port INTEGER,
                    dst_ip TEXT,
                    dst_port INTEGER,
                    extra_json TEXT,
                    FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id),
                    FOREIGN KEY (batch_id) REFERENCES agent_event_batches(id)
                );

                CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id ON agent_events(agent_id);
                CREATE INDEX IF NOT EXISTS idx_agent_events_batch_id ON agent_events(batch_id);
                CREATE INDEX IF NOT EXISTS idx_agent_batches_agent_id ON agent_event_batches(agent_id);
                CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent_id ON agent_heartbeats(agent_id);
                """
            )
            columns = {row[1] for row in connection.execute("PRAGMA table_info(agent_registry)").fetchall()}
            if "host_id" not in columns:
                connection.execute("ALTER TABLE agent_registry ADD COLUMN host_id TEXT")


def json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def build_udp_payload(message, client="messages_client"):
    payload_text = f"{client}{message}END"
    payload = payload_text.encode("utf-8")
    if len(payload) > UDP_PAYLOAD_SIZE:
        raise ValueError(f"payload exceeds {UDP_PAYLOAD_SIZE} bytes")
    return payload.ljust(UDP_PAYLOAD_SIZE, b" ")


def send_temperature_udp(target_host, target_port, message, client="messages_client"):
    payload = build_udp_payload(message, client=client)
    print(f"Sending UDP payload to {target_host}:{target_port}")
    print(payload.decode("utf-8", errors="replace"))
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.sendto(payload, (target_host, target_port))
    return payload


def require_fields(payload, fields):
    missing = [field for field in fields if field not in payload]
    if missing:
        raise ValueError(f"missing required fields: {', '.join(missing)}")


def normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y", "on"}:
            return True
        if lowered in {"false", "0", "no", "n", "off"}:
            return False
    return bool(value)


def new_id(prefix):
    return f"{prefix}_{uuid4().hex}"
