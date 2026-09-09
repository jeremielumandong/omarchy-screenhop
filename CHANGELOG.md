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
