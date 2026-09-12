# ScreenHop 1.0.5

- Remove the in-picker self-updater and its detached worker. ScreenHop no longer fetches, fast-forwards to, installs, or executes code from a remote repository.
- Keep updates under Omarchy and Marketplace control. The picker can only compare the installed renderer with a running preview and restart previews from code already present on disk.
- Remove the retired updater from publication exports and upgraded installations, and add regressions that reject updater artifacts or update/build commands in the picker.

This release addresses the Marketplace review of commit `4898f79b86cf0c0cb994050d9286d28517f2cce3`. Version 1.0.5 must receive a fresh exact-commit review before publication.

---

# ScreenHop 1.0.4

Remove **Reload picker** entirely. The 1.0.3 registry-refresh approach still unloaded desktop-wide plugin panels and services and was reported to disrupt the shell. After installing or building, **Done** now only clears the update notice and closes ScreenHop. It invokes no shell restart or registry refresh.

The update controls, first-time native builds, optional native renderer and Bar text toggle remain available. Existing previews stay open until you choose to close and reopen them after saving work.

Validation: the picker regression exercises Done, verifies that the notice clears and the picker closes, and fails if either `omarchy` or `omarchy-shell` is invoked. It passed. Exported plugin validation and displayed-version consistency checks passed. This does not claim a recovery test on the affected desktop.

Update from a separate terminal and avoid the older Reload picker button:

```sh
omarchy plugin update arkane.screenhop --yes
```

If the desktop shell is already unavailable, recover it by running `omarchy restart shell` from an independent terminal or a logged-in TTY. If an old picker remains cached after updating, the same command can reload the shell from that independent terminal.

---

# ScreenHop 1.0.3

- Fix **Reload picker** stopping the entire Omarchy shell. It now requests a plugin-registry refresh through `omarchy-shell shell rescanPlugins` without restarting the shell process.
- Include the in-picker update and native-build controls added after 1.0.2: check for updates, confirm the checked commit, build native previews on first use, and retry a build when already up to date. System build dependencies must be installed separately.
- Retain the optional native renderer and saved **Bar text** toggle.

If running an older picker, close it and update from an independent terminal:

```sh
omarchy plugin update arkane.screenhop --yes
omarchy restart shell
```

Do not use the older picker’s Reload picker button for this update. If its earlier restart left the desktop menu unavailable, run `omarchy restart shell` from a terminal or a logged-in TTY to recover it.

Validation: picker smoke passed with the reload action exercised against a mocked registry command; the test verifies that the picker closes and its reload flag clears. Six updater tests previously passed, including first-time builds, current-source builds, build failure handling and detached worker completion. This patch does not change the updater engine.

---

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
