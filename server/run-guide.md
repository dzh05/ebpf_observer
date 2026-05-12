# Minimal Backend Run Guide

## Purpose

This backend provides a small demo API so the web prototype can show a more realistic middleware shape without requiring a database or external dependencies.

## Start the API

Run from the project root:

```bash
python3 /Users/erwinschrodinger/repo/ebpf-trigger-observatory/server/app.py
```

The service listens on `http://127.0.0.1:8080`.

## Example Endpoints

- `GET /health`
- `GET /stats/overview`
- `GET /events`
- `GET /events/evt_20260417_0018`
- `GET /rules`
- `GET /audit-logs`
- `GET /demo-data`

## Frontend Behavior

The web prototype now tries to load `http://127.0.0.1:8080/demo-data`.

- If the API is available, the UI shows `API dataset loaded`.
- If the API is not available, it falls back to the embedded sample dataset.

This makes the demo resilient during presentations.
