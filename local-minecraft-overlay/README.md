# Local Minecraft Overlay

Local-only SpeedrunIGT overlay server (port 2026 by default) that reads records from:

```
C:\\Users\\rania\\speedrunigt\\records
```

## Run

```bash
npm install
npm run local:minecraft
```

Open in OBS browser source:

```
http://localhost:2026/overlay
```

## Config

- `MINECRAFT_OVERLAY_PORT` (default: 2026)
- `SPEEDRUNIGT_RECORDS_DIR` (default: C:\\Users\\rania\\speedrunigt\\records)
