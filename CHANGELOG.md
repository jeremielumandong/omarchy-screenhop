# ScreenHop 1.0.0

Local development version; not published.

- Searchable device picker with 16 presets, orientation control and independent preview windows.
- Centered phone/tablet/desktop outlines and persistent device labels, with live page interaction and a frame toggle.
- Direct browser mode with device information in its title.
- Optional linked clicks, ordinary input, scrolling and same-origin link navigation.
- Linking defaults off. OAuth/OIDC, provider login, credential/MFA forms and security challenges pause synchronization. Redirect chains and authentication callbacks are never replayed as navigation commands.
- Local browser/Omarchy tests and saved-login-profile plan.

- Fixed installer backups shadowing the live plugin with version 0.1.0. Backups now live outside plugin discovery.
- Framed previews are borderless app windows, centered horizontally and vertically, with hover/focus tools.

- Fixed linked-state reporting, SPA navigation from buttons/rows, and authentication pause recovery after same-document callback cleanup.
- Added opt-in phone remote with QR pairing, touch/keyboard control, and immediate disconnect.
- Added device categories, custom viewport sizes, and original decorative device skins.

- Fixed phone connectivity with dedicated TCP53318 and scoped UFW setup through the system password prompt.
- Paced frame capture and reduced image traffic without changing page viewport metrics. Bounded input queues coalesce movement and recover from stalled requests.
- Fixed unnamed theme buttons and hidden duplicate controls, verified against omarchy.org.

- WebRTC is now the default video transport for framed desktop and phone previews, with direct native Chromium tab capture and on-demand JPEG fallback.
- Preserved interactive controls, device skins, authentication isolation, navigation reconnection, and phone revocation.
