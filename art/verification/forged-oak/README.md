# Forged Oak integration acceptance

User selected the existing Forged Oak prototype over Greyward Stone. The shipped three PNGs match its approved hashes; the isolated prototypes are retained unchanged.

## Changed experience
Oak/brass bottom band, recessed band/right-rail icon buttons, and open-aperture minimap surround. The small desktop clock has an opaque backing to prevent brass trim crossing the text. Original rectangles, 44px targets, labels, meters, drawer behavior and simulation are unchanged. No new stacking layer or animation.

## Evidence
- `gates.json`: full lint/tests/typecheck/build/auth command exited 0; 1,485 tests passed with no failures/skips; art inventory audit passed.
- `report.json`: desktop and mobile, normal artwork and all three downloads rejected; exact approved asset hashes, unchanging geometry, 44px buttons, drawer Escape and minimap controls; no page errors.
- `desktop-oak.png`, `mobile-oak.png`: final normal artwork.
- `desktop-fallback.png`, `mobile-fallback.png`: actual download-failure captures.
- `hud/after.json`: all 43 existing HUD/layout/interaction cases passed with zero recorded errors. Associated screenshots are retained beside it.
- Saved Blender source independently reopened: 189 objects; three named relief collections.

Mobile checks are Chromium phone-sized viewports on the desktop GPU, not physical-phone hardware. A paused disposable world and blocked WebSocket isolate UI tests; this does not constitute multiplayer/backend QA. No FPS improvement is claimed. No crafting/identity/network rules changed.

The first asset test failed before implementation. A separate clock-backing assertion failed before the visibility fix; both focused tests now pass. The full gate was rerun after the final CSS change. Existing CRLF in src/styles.css is preserved; whitespace checking enables Git's cr-at-eol interpretation rather than normalizing unrelated lines.

Production verification is performed after commit/push and recorded in the separate delivery report, including live CSS URL and exact deployed texture hashes.
