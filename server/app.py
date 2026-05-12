#!/usr/bin/env python3

from http.server import ThreadingHTTPServer
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.handlers import AppHandler  # noqa: E402
from api.runtime import init_db  # noqa: E402


def main():
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", 8080), AppHandler)
    print("eBPF Trigger Observatory API listening on http://127.0.0.1:8080")
    server.serve_forever()


if __name__ == "__main__":
    main()
