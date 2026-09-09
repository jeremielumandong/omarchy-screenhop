# ScreenHop 1.0.1 native previews

- Support the `nativePreviews` plugin preference. WebRTC remains the default when the preference is absent.
- Apply device metrics, request identity and touch settings to new tabs before scripts run. Popups retain opener relationships and open in separate, unskinned Chromium windows.
- Serialize renderer switches, reject known authentication pages before switching and clean up failed replacement previews without closing existing previews.
- Refresh linking status in the panel and check current controller state before independent launches.
- Disable unsupported workspace and batch screenshot controls in native mode with an explicit explanation.
- Build and install the native host and helpers, replace the executable atomically, and include native components in the build fingerprint.
- Extend native, UI and installation regression coverage.

Native/WebRTC profiles remain separate; real-device accuracy and performance gains are not established by these tests.

Validation: six native regression tests passed (viewport parity, input, persistence, popups and switching), the extended panel smoke test passed, clean/repeated installation checks passed, and workspace/authentication unit tests passed. Final switch tests also verified that stale independent launches route to linked WebRTC and that rollback leaves pre-existing previews open. Controller protocol was advanced to 9; older running controllers can still serve normal launches and status; they must be closed before native-to-WebRTC migration with this build.

Source-only plugin copies continue to support WebRTC without a native binary. Selecting native mode before building gives an explicit installation instruction.

Update-loop regression: protocol 8 remains compatible with ordinary opening. The panel stops repeated status polling when it detects that controller, allowing it to retire once its previews close. A regression test confirms migration is rejected before creating replacements on protocol 8.

Proportional enlargement: removed the one-physical-pixel presentation cap. The native page drawing surface follows the skin dimensions while layout viewport and device DPR remain unchanged. Added enlarged right-edge input coverage. Browser shutdown waits briefly for normal exit so profile data can flush.

The embedded Chromium child uses kiosk presentation to omit the fullscreen-exit banner. The enclosing ScreenHop window retains normal window-manager closing controls. Native input and popup emulation checks passed.

Latest QA: see [release validation](../VALIDATION.md) for the broader regression run, eight viewport comparisons, build race fix, and resource measurements. Native host builds now replace the executable atomically so rebuilding does not temporarily make launches fail.
