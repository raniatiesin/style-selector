# Stream Overlay

Standalone OBS browser-source overlay.

## File
- overlay.html

## Run
1. In OBS, add Browser Source.
2. Set URL to local file path for overlay.html.
3. Set Width to 1440 and Height to 1080.
4. Enable transparency.
5. Disable refresh on scene switch and disable shutdown when hidden.

## OBS WebSocket
1. Enable OBS WebSocket server in OBS (default ws://localhost:4455).
2. Open overlay.html and set OBS password in the config block.
3. Keep scene names exactly: Work, Talk, Break.

## Notes
- This file is standalone and does not require Vite or React.
- Do not commit real OBS password to version control.
