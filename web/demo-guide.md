# Demo Guide

## What to Show

1. Open the dashboard and explain the platform goal: detect trigger-like traffic early in XDP while keeping payload handling non-executable.
2. Move to the events page and show how evidence is stored as metadata, previews, and hashes.
3. Move to the rules page and explain policy choices:
   - `PASS`
   - `DROP`
   - `SAMPLE_ONLY`
4. Move to the audit page and emphasize research traceability.
5. Point to `ebpf/xdp_probe.c` to show that the kernel-side skeleton emits events and does not launch commands.

## Suggested Demo Narrative

- "This is an attack-chain research observatory, not an offensive framework."
- "The XDP layer classifies packets and emits evidence very early in the receive path."
- "The management plane lets us study rules, outcomes, and operator behavior over time."
- "Everything is designed so the thesis can discuss offensive tradecraft while the implementation remains safe and auditable."
