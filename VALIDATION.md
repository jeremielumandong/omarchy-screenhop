# ScreenHop 1.0.5 validation

The self-updater, its tests and every picker process/UI hook that invoked it have been removed. Publication export and installation lists exclude `plugin-update.mjs`; upgrades explicitly delete a stale copy after preserving the previous installation in the normal backup location. UI and installer smoke checks assert that no updater remains and that the picker contains no repository update or native-build execution path.

Remediation validation passed: Omarchy validation of the exported public tree; QML picker smoke; repeated, upgrade and fresh-install smoke; shell and JavaScript syntax checks; three workspace/build-identity tests; and 51 selected runtime tests. One vendor-artwork test was intentionally skipped in the public export. The native-switch test initially reported the intentionally absent public binary, then passed after building the optional native host from the exported, reviewed source. `git diff --check` passed.

## Previous 1.0.4 validation

The picker regression passed with the Done action exercised and both `omarchy` and `omarchy-shell` replaced by fail-and-record stubs. Neither command was invoked. The update notice cleared and only the picker closed. Source review confirms the picker contains no shell restart or registry refresh command. Export/plugin validation and displayed-version consistency checks passed. This supersedes the 1.0.3 mocked-refresh evidence, which did not cover desktop-wide plugin unload behavior.

## Previous 1.0.3 validation

The picker reload regression exercises the Reload picker action using a mocked `omarchy-shell shell rescanPlugins` command and verifies successful completion without a shell restart. The existing catalog, bar text, rendering-mode and updater UI checks also passed. This does not claim a full live-desktop recovery test on the affected machine. Export/plugin validation and version consistency are checked for this patch. Earlier renderer evidence is retained below.

## Previous 1.0.2 validation

This patch adds the saved Bar text toggle and corrects displayed version labels. The native/WebRTC engines and installer behavior are unchanged from 1.0.1. Validation for the underlying renderer is recorded below; it is not a claim of a new full regression run for 1.0.2.

## 1.0.2 checks

- Exported-package picker smoke passed, including hiding/restoring bar text and preserving existing settings.
- Exported package passed Omarchy plugin validation.
- Manifest, picker and preview version labels all match 1.0.2; the exported picker includes Bar text and retains the optional native setting.
- `git diff --check` passed.

## Previous 1.0.1 validation

## Final exported release checks

The exported 1.0.1 source package completed the full serial Node regression suite: **67 tests, 66 passed, 0 failed, 1 intentionally skipped** (vendor image assets are absent from the public package). The previously intermittent WebRTC touch test passed in this run. UI smoke, clean and repeated installation smoke, plugin validation, JavaScript syntax checks and `git diff --check` also passed. Source-only build identity works without a compiled native host. Native sources and build scripts are included in the export; executable output and profiles are excluded.

## Earlier local regression evidence

The pre-release review ran 67 tests: 64 passed initially, two failed, and one vendor-image skin test was intentionally skipped. Native parity failed to launch during a concurrent rebuild; atomic native executable replacement fixes that race. A 328-sample rebuild check preserved executable availability. The WebRTC touch viewer timed out once; it passed on targeted rerun, but the intermittent timeout has not been conclusively diagnosed. Both failed test files passed on recheck.

Eight native/WebRTC comparisons matched the tested fields: iPhone SE portrait, iPhone SE without viewport metadata, iPhone SE landscape, desktop 1920 × 1080, iPhone X, Pixel 11, Galaxy S26 Ultra and iPad Pro 11 landscape. Metrics include layout/screen dimensions, visual viewport width, DPR, orientation, touch/pointer capabilities and request identity. This does not prove identical pixels, physical-device fidelity or Safari behavior.

Coverage includes native input at enlarged edges, keyboard/scrolling, profile cookie persistence, popup emulation, linked routing, failed-switch rollback, authentication guards and controller compatibility. UI and clean/repeated installation smoke checks passed during local review.

A local static-page probe after 20 seconds used about 583 MiB PSS for one preview and 2,120 MiB for four. One-preview CPU sampled about 2.16% of one core; the four-preview CPU sample was invalid because processes exited between samples. No owned processes remained after closing. This is not a WebRTC performance comparison.

## Release scope and security

Native previews remain opt-in publicly. They embed system Chromium through XWayland, with a private Unix control socket and inherited-pipe browser debugging. A temporary loopback bootstrap serves an empty local page. The skin host loads local UI. The existing WebRTC path retains authenticated loopback control. Phone sharing, LAN listeners and firewall/pkexec helpers remain excluded.

Browser profiles and cookies remain local and are not packaged. Native and WebRTC profiles are separate. Popups have no skins; native workspace and batch capture tools are unavailable. Cloudflare acceptance and speedups are not guaranteed.

The public export includes native source/build files and original CSS frames, excludes native binaries, private state, local vendor artwork and development Git history. Marketplace validation and its security baseline must be rerun against the final full default-branch commit. Local tests and this document are not Marketplace attestations or a security audit.
