# ScreenHop 1.0.0

- 103 searchable device presets and custom CSS viewport/DPR settings.
- Centered borderless previews with original decorative frames and mouse/touch input.
- WebRTC video with adaptive capture and JPEG fallback.
- Optional linked navigation and interactions, paused around recognized sign-in flows.
- Local phone pairing through QR code, screenshots and silent recordings.
- Saved workspaces, batch screenshots and build/update controls.
- Official specification sources and visible labels for estimated device viewports.

Public packaging excludes locally supplied Samsung emulator artwork. See THIRD_PARTY_NOTICES.md for licensing and README.md for limitations.

- Fix connection starvation after five previews by moving persistent event traffic to authenticated WebSockets. Preserve video, validated control endpoints, JPEG fallback, skins and phone revocation.

- Require explicitly configured trusted HTTPS/WSS for phone pairing and remote control (TLS 1.2+). Reject missing, expired, mismatched or unreadable TLS identities before listening. Generate a fresh 256-bit pairing credential on each enable and revoke connections/credentials on stop; remove plaintext LAN pairing and document certificate provisioning.
