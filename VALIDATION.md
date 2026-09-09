# Publication validation

## Phone transport security fix — 2026-09-08

Phone sharing now requires a configured certificate already trusted by the phone, with TLS 1.2+ for pairing, input/action requests, SSE and WebSockets. The server validates certificate dates, Subject Alternative Name and private-key match before listening. Each sharing session receives a new random 256-bit credential; disabling sharing revokes it and disconnects phones. No plaintext listener or fallback exists. The README documents authenticated certificate provisioning and renewal. Desktop previews remain available without phone TLS configuration.

Passed:

- 21 route/security regressions: `node --test tests/phone-remote.test.mjs tests/event-sockets.test.mjs tests/rtc-signaling.test.mjs tests/phone-firewall.test.mjs`. Covers HTTP/WS replay denial, untrusted TLS rejection, TLS 1.2/1.3 acceptance and legacy rejection, invalid/missing configuration, expired/mismatched identities, token rotation/revocation, Host/Origin enforcement and scoped firewall behavior.
- Five Chromium integration cases: `node --test --test-concurrency=1 tests/viewer.test.mjs tests/rtc-viewer.test.mjs tests/multi-preview.test.mjs tests/screenshot.test.mjs`. Includes seven desktop plus seven HTTPS/WSS phone viewers with live WebRTC video and real input, linked controls, authentication isolation, screenshots and cleanup.
- `bash tests/install-smoke.sh`: repeated installation, backup preservation and one discoverable plugin.
- `bash tests/ui-smoke.sh`: picker catalog, search, frame/native launch, linking, authentication pause and HTTPS pairing display.
- `omarchy plugin validate .`: plugin manifest/compatibility validation.

TLS tests generate an ephemeral identity, validate it with an explicit test CA, and separately verify that an untrusted client rejects it. Browser integration pins only that ephemeral key in a test wrapper. Production code has no certificate-verification bypass. No keys, certificates or pairing credentials are committed.

These checks are regression evidence, not a security audit. Marketplace validation and the automated security baseline must be rerun for the final full commit; maintainer review remains required.
