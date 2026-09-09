# Native Chromium experiment (local only)

Enable **Native previews (experimental)** in ScreenHop. Unlinked launches use separate system Chromium processes embedded inside the existing device skins through XWayland. Linked launches use the existing WebRTC renderer. WebRTC remains the fallback default in source. The ScreenHop plugin setting `nativePreviews: true` can select native by default for a local installation; linked previews still use WebRTC.

The first Qt-browser prototype was rejected because it produced different mobile layouts. The revised implementation uses Qt WebEngine only for local skin HTML; websites run in the same system Chromium binary as the published renderer. DevTools commands travel over inherited pipes, with no debugging TCP listener. A temporary loopback-only static startup page establishes browser client hints before the requested website is opened; that startup HTTP server is then closed.

## Rendering checks

`native-parity-report.json` records comparisons with the current WebRTC source browser for eight scenarios: portrait iPhone SE, iPhone SE without viewport metadata, landscape iPhone SE, 1920 × 1080 desktop, iPhone X, Pixel 11, Galaxy S26 Ultra, and landscape iPad Pro 11. All compared fields matched: screen and layout dimensions, visual viewport width, DPR, orientation, touch points, pointer/hover queries, Chromium version, user-agent and client hints. Missing viewport metadata correctly retains the approximately 980px mobile layout viewport rather than falsely using 375px.

Display scaling changes Chromium's compositor scale without changing emulated device settings. Runtime readiness checks screen size, DPR and input capability before reporting a native preview ready. This is Chromium emulation, not Safari or a physical device. These fixture comparisons establish parity for the tested fields; they are not proof of identical pixels or universal website compatibility. Cloudflare remains an automated-browser limitation. No performance improvement percentage has been measured.

## Switching and sessions

Use the three-dot menu or the widget's **Link previews** control. Confirming reopens native previews in WebRTC. Originals close only after replacements open and linking succeeds. Failed switches leave originals open and remove newly created replacements. Switches are serialized; known authentication pages are rejected before replacements are opened. Authentication policy may prevent linking.

Unsaved page state and sign-ins do not transfer between renderer profiles. Each native device configuration has numbered persistent profiles under ~/.local/state/screenhop/native, with a lock preventing simultaneous use of the same profile. Reopening a closed slot preserves its cookies. The earlier Qt and plain-browser profiles are separate and are not imported.

Turning linking off leaves existing WebRTC windows open; newly opened previews use native rendering. Disabling the experiment restores normal launch behavior. Workspace restore, batch screenshots, and recording remain on the original renderer. Use the desktop screenshot tool for native window captures. Native back/forward/reload, frame visibility, skin color selection and renderer switching are available.

## Build and test

Requires Qt6 WebEngine Quick, Quick and Network development files, X11/XExt, XWayland, system Chromium and a C++ compiler. Build using `bash scripts/build-native.sh`. Generated binaries are under `.native/` and are not committed.

Run `node --test --test-concurrency=1 tests/native-parity.test.mjs tests/native-frame.test.mjs tests/native-input.test.mjs tests/native-switch.test.mjs`. The input test additionally requires libXtst and focuses only its own test window. Tests cover comparison fields, scaled viewports, saved cookies after process restart, trusted native mouse input, keyboard, scrolling, and switching. The widget smoke test is `bash tests/ui-smoke.sh`.

Development remains on experiment/independent-browser. Nothing has been pushed or published.

Native previews are opt-in; WebRTC remains the default. The native frame and page now scale together to fit the window, including enlargement on scaled desktops. Chromium’s visible drawing surface is explicitly resized without changing device metrics. Preset viewport dimensions and DPR are unchanged. Existing direct browser windows must be reopened.

New tabs and popups inherit the opener’s device metrics and touch settings before their first scripts execute. They currently appear in separate Chromium windows without a device skin; the original preview remains skinned. Opener relationships are preserved for authentication flows. Workspace and batch screenshot controls are disabled while native mode is selected. The launcher refreshes link status and checks controller state again before opening a native preview.

The installer builds and installs the native executable and helpers. Build dependencies: a C++ compiler, pkg-config, Qt6 development packages for WebEngineQuick/Quick/Network, libX11/libXext; runtime also requires XWayland and flock (util-linux).
