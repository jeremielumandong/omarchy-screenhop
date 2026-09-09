# ScreenHop 1.0.2

- Add **Bar text** beside **Close** in the ScreenHop picker. Switch it off for an icon-only desktop bar button; the ScreenHop tooltip remains available.
- Save the preference across shell restarts while preserving other plugin settings.
- Correct the old 1.0.0 preview footer and show 1.0.2 consistently in the picker and preview.

Native previews remain optional, with WebRTC as the default. The native build requirements documented in README.md still apply.

Update with `omarchy plugin update arkane.screenhop`, then run `omarchy restart shell` and open ScreenHop from the desktop bar. Close and reopen existing preview windows to load the updated footer.

---

# ScreenHop 1.0.1

- Add optional **Native previews (experimental)**: system Chromium embedded inside the original device skins, with persistent per-device profiles. WebRTC remains the default and handles linked previews.
- Keep device viewport, DPR and input settings while scaling the skin and webpage proportionally. Prevent trackpad pinch from zooming the outer skin separately; remove the embedded fullscreen-exit banner.
- Apply device emulation to new tabs, preserve popup opener relationships, and wait for browser shutdown so profile changes can flush. Popups remain separate, unskinned windows.
- Add confirmed switching to linked WebRTC, rollback of failed replacements, authentication guards and compatibility with older running controllers for normal launches.
- Stop status polling from making preview controls blink. Show a steady experimental indicator and disable unsupported native workspace tools.
- Ship native build sources, dependency instructions and atomic executable replacement during builds and installation.

Native mode has separate sign-ins from WebRTC, no workspace/batch capture tools, and a substantial memory cost per preview. It remains Chromium emulation; Safari fidelity, Cloudflare acceptance and performance gains are not guaranteed. See [native release details](docs/NATIVE_RELEASE_NOTES.md) and [validation](VALIDATION.md).

Close native windows before rebuilding after an update. Git-managed installs can build the optional host with `bash ~/.config/omarchy/plugins/arkane.screenhop/scripts/build-native.sh`. Phone remote control remains excluded.

---

# ScreenHop 1.0.0

First public release: responsive website testing in simultaneous desktop preview windows.

- 103 searchable device presets, custom CSS viewport dimensions and pixel density, and portrait/landscape layouts.
- Centered borderless previews with original decorative device frames, keyboard input, mouse hover and emulated touch input.
- WebRTC video with adaptive capture, Auto/Eco/Smooth modes, diagnostics and JPEG fallback.
- Optional linked navigation, clicks, typing and scrolling; recognized sign-in and verification flows pause linking.
- PNG screenshots and silent recordings, with the device frame or webpage only.
- Saved workspaces, batch screenshots and build/update controls.
- Authenticated loopback WebSocket events prevent connection starvation with seven simultaneous desktop previews. Closing viewers releases event subscriptions and video peers.
- Official specification sources and visible labels for estimated device viewports.

## Removed before release

Phone remote control is deferred. The release contains no phone-sharing server, QR pairing, phone keyboard bridge, TLS setup, firewall helper or privilege prompt for network access. Phone and tablet presets remain available as desktop previews.

Updating through the installer backs up the existing plugin and removes retired phone-sharing modules. Existing pre-release firewall rules and phone trust certificates are not changed automatically; see README.md for cleanup. Close older previews before applying the update so the previous controller exits.

Public packaging excludes locally supplied Samsung emulator artwork. See THIRD_PARTY_NOTICES.md for licensing and README.md for limitations.
