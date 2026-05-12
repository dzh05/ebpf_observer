# Server Layer Notes

The service layer owns persistence, aggregation, and administrative APIs.

Key functions:

- rule management
- event search
- summary statistics
- experiment registration
- audit logging

## Runtime

The current server implementation uses only the Python standard library.

## Dependency pinning

- `requirements.txt` is kept intentionally minimal because there are no third-party runtime packages yet.
- If future server changes add external packages, pin them here with exact versions.
