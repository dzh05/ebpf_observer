# eBPF Trigger Observatory

A lab-oriented observability project that combines:

- a React frontend for dashboarding, UDP message composition, and a Web SSH page
- a Python backend for demo APIs and UDP packet sending
- a standalone SSH socket server for the Web SSH terminal bridge

## Project layout

- `web/` React frontend powered by Vite
- `server/` Python API and UDP sender
- `ssh-server/` standalone Socket.IO + SSH bridge
- `ebpf/` XDP/eBPF notes and skeletons
- `docs/` architecture and experiment notes

## Prerequisites

- Node.js 18+
- Python 3.10+
- Access to an SSH target if you want to use the Web SSH page

## Run the backend API

```bash
cd server
python3 app.py
```

This starts the demo API and UDP sender on `http://127.0.0.1:8080`.

## Run the React frontend

```bash
cd web
npm install
npm run dev

VITE_API_BASE_URL=http://38.207.189.106:8082  VITE_SSH_SOCKET_URL=http://127.0.0.1:4000 npm run dev -- --host 0.0.0.0
```

Open the app in your browser at the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:8000
```

### Frontend environment variables

Create a local `.env` file in `web/` if you want to override service URLs:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_SSH_SOCKET_URL=http://127.0.0.1:4000
```

## Run the Web SSH server

```bash
cd ssh-server
npm install
npm start
```

This starts the Socket.IO SSH bridge on `http://127.0.0.1:4000`.

## How the pieces fit together

- The React app fetches demo data from the Python backend.
- The UDP Sender page requests the Python backend to build and send a fixed-length UDP payload.
- The Web SSH page connects to the standalone SSH server over Socket.IO and proxies terminal input/output.

## Notes

- The UDP payload format keeps a configurable prefix and raw message, followed by a fixed `END` suffix and padding to 200 bytes.
- The SSH bridge expects valid SSH credentials for the target host.
