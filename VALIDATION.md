# ScreenHop 1.0.0 validation

## Desktop-only release

Phone remote control is removed from the release tree, CLI, picker, viewer input bridge, build identity and export manifest. Its TLS test helper and standalone remote/firewall tests are removed. The installer backs up an older installation and removes its retired phone-sharing modules. Desktop preview control binds to `127.0.0.1`; the controller uses a private Unix socket. Controller protocol 8 prevents new commands from silently using an older running controller.

README.md, CHANGELOG.md, PLAN.md and both publication/listing guides describe the first-release scope. The main screenshot now uses the existing side-by-side device image, so it does not advertise the removed phone-sharing button.

## Passed checks

- 43 tests across auth-policy, event-sockets, multi-preview, rtc-signaling, rtc-viewer, screenshot, touch-input, touch-viewer, viewer and workspaces. Covers seven simultaneous desktop WebRTC previews, real input, signaling authentication and cleanup, touch gestures, screenshots, viewport geometry, linked previews and sign-in isolation.
- `bash tests/install-smoke.sh`: repeated installs preserve backups, remove obsolete remote/firewall modules and expose one plugin.
- `bash tests/ui-smoke.sh`: simplified picker, catalog/search, frame/native launches, custom dimensions, linking and authentication pause.
- `omarchy plugin validate .`: manifest and compatibility validation.
- Exported package passes plugin validation and installer smoke; no phone-sharing modules or TLS test helpers are present, and validation notes are preserved.
- Removed `--phone` and `--phone-status` CLI options reject before starting a controller.
- `node --check viewport.mjs`, `node --check capture-ui.js` and `git diff --check`.

The auth-policy test harness was corrected to notify both registered mutation observers with a records array, matching browser behavior; the production authentication policy was unchanged.

Marketplace revalidation is paused for local review. After publication resumes, the final full default-branch commit must match both the new validation report and security baseline. These local regressions are not a marketplace attestation or security audit.
