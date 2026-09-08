# ScreenHop 1.0.0

Pick a device. Open its browser preview. Link your screens.

**Local development build — not published.**

ScreenHop is an Omarchy shell plugin with 66 searchable presets across 10 categories and custom viewport sizes. Each selection opens a separate preview at the device's CSS dimensions.

![ScreenHop centered device preview](preview.png)

## Device previews

Click **ScreenHop** in the bar, enter your website URL (including localhost), and choose a device. The selected device's name and resolution appear above a centered outline. Framed previews use borderless app windows with no browser tabs, address bar, or persistent toolbar; controls appear from the small menu button on hover or keyboard focus. Phone, tablet and desktop frames surround the live webpage without covering it or changing its viewport. Large devices scale visually to fit. Preview streaming uses JPEG quality 75, a maximum 1280-pixel long edge, and capture pacing of up to 20 frames per second per preview (about 60 across the group). These display optimizations preserve the tested CSS viewport and pixel density.

- **Device frame on:** a live offscreen Chromium renderer appears inside a centered device frame. Mouse, keyboard, paste and scrolling are forwarded to the actual page. Use the viewer's Frame toggle to hide the decorative outline without changing viewport dimensions.
- **Device frame off in the picker:** opens a direct Chromium window with the device and resolution in its title. This retains native browser controls and is preferable for sign-in troubleshooting or features the streamed viewer does not support.
- **Portrait/rotation:** swaps width and height before opening another preview.

Use category chips to browse Apple phones, Android phones, tablets, foldables, watches, computers, TVs, kiosks, handhelds and smart panels. **Custom size** accepts 100–3840 CSS pixels per axis and pixel density 1–4, with phone touch or desktop mode. Device skins include classic/notched/island phones, camera bezels, tablets, foldables, watches, laptops and display stands. Skins are original decorative approximations, not vendor artwork; they do not change the page viewport or emulate browser/OS chrome.

Specialty presets marked “responsive” are representative layouts, not certified device dimensions or hardware emulation. New branded phone/tablet profiles use [Playwright v1.55.0 device descriptors](https://github.com/microsoft/playwright/blob/v1.55.0/packages/playwright-core/src/server/deviceDescriptorsSource.json), preferring CSS screen size when supplied. Existing preset dimensions remain compatible with earlier ScreenHop sessions.

Framed and direct previews use separate browser profiles. Within each mode, previews share that mode's browser cookies. Existing personal browser sessions are not imported. Named account profiles and session import are planned in [PLAN.md](PLAN.md).

The frame is visual styling, not a mobile operating system or Safari emulator. Chromium remains the rendering engine. Mobile pages without a viewport meta tag can have a wider layout viewport, as on actual devices. Native file pickers, downloads, browser dialogs, drag-and-drop files and accessibility tree interaction are not exposed through the streamed frame; use direct mode for those workflows.

## Linked browsing and authentication

Linking **defaults off**. Enable **Link previews** for ordinary page comparison. It mirrors matching clicks, ordinary text input and proportional page scrolling. Trusted same-origin navigation from links, buttons and clickable rows is copied after it settles, including SPA route changes. Redirects without a trusted navigation gesture are not broadcast. Opening another preview preserves the group’s linking setting.

Sign-in, OAuth/OIDC callbacks, verification codes and security challenges belong to one preview. ScreenHop pauses linking on recognized authentication URLs, identity-provider hosts, credential forms, MFA fields and sign-in actions. Submit controls, passwords, files and one-time codes are not mirrored. It stays paused until you explicitly enable it after authentication pages have been left.

Regression coverage includes IdentityServer, Okta, Azure AD/Microsoft Entra ID, Auth0, Google and GitHub URL patterns; OAuth2 authorization code/PKCE, implicit/hybrid callbacks, OAuth1 callback parameters, standard login and MFA forms. These are local fixtures, **not certification against every provider or a live tenant**. Unknown custom authentication UI may require an additional detection rule. Keep linking off while signing in.

Cloudflare can still challenge or reject emulated/automated browsers. ScreenHop does not bypass those checks. Cloudflare documents that headless browsers and automation are unsupported for production challenge solving: [supported browsers](https://developers.cloudflare.com/cloudflare-challenges/reference/supported-browsers/). Direct mode removes the streamed/headless view but still uses viewport emulation and is not a guarantee of challenge compatibility.

Clicks match visible unique data-testid, aria-label, id, name, link href or semantic button text, and skip missing, hidden or ambiguous controls. Embedded frames, shadow DOM and arbitrary custom controls are not synchronized. Linked actions run in each preview; use test data for actions that change application state.

## Phone remote

Open framed previews, then choose **Phone remote** in the ScreenHop picker. Scan the QR code using a phone on the same Wi-Fi, select a lead preview, and enable **Link previews** to control the group. No phone app or cloud account is needed. This uses a local browser controller; it does not integrate with the LocalSend app.

Tap to click and swipe to scroll. For typing, tap the field inside the preview, open **Keyboard**, and type using the phone keyboard helper. Authentication still pauses linking; your phone controls the selected desktop renderer without importing a phone login session.

**Stop sharing** closes the listener, disconnects phones and revokes the pairing URL. ScreenHop uses TCP port **53318**. When UFW needs a rule, enabling Phone remote invokes the system password prompt to allow only the active local subnet/interface. ScreenHop never reads or stores the password. The scoped firewall rule remains for later sessions; no service listens while sharing is off. Sharing defaults off. The pairing URL grants control over these previews: use a trusted local network, since the connection uses local HTTP. Both devices must be reachable on the same network; guest Wi-Fi isolation or a firewall may block access. `qrencode` is optional; a copyable URL is always available.

## Requirements and local installation

- Omarchy shell / Quickshell with third-party widgets and current Hyprland Lua dispatchers.
- Node.js 22 or later with built-in WebSocket support.
- Chromium, or a Chromium-based executable selected with SCREENHOP_BROWSER.

No npm dependencies or browser extension are needed.

```sh
bash scripts/install.sh
```

The widget appears at the right of the bar. The installer keeps backups outside Omarchy’s plugin discovery directory and migrates older timestamped backup folders so they cannot override the current plugin. After updating, close all ScreenHop previews and wait 35 seconds before reopening them so the previous controller exits. Opening just one new window while old previews remain open still uses that old controller. Browser profile cookies are retained.

To remove the widget from the bar: `omarchy plugin disable arkane.screenhop`.

## Local state and CLI

Framed mode uses `$XDG_CACHE_HOME/screenhop-framed` and direct mode uses `$XDG_CACHE_HOME/screenhop-native` (normally under `~/.cache`). These directories contain private browser data and local controller sockets. The frame server binds to loopback and uses an unguessable URL token. Do not share those URLs as public preview links.

```sh
node viewport.mjs --device iphone-13 --url http://localhost:3000
node viewport.mjs --device pixel-5 --url http://localhost:3000 --linked
node viewport.mjs --link off
node viewport.mjs --status
node viewport.mjs --phone on
node viewport.mjs --phone off
node viewport.mjs --device custom --width 420 --height 900 --dpr 2 --mobile --url http://localhost:3000
node native-preview.mjs --device desktop --url http://localhost:3000
node native-preview.mjs --link off
node viewport.mjs --list
```

`--state /path` selects isolated test state. `--close` closes all previews belonging to that helper/mode. Closing a framed window also closes its underlying rendering page. A local controller remains attached while windows are open and exits shortly after the browser closes.

## Tests

```sh
node --test tests/auth-policy.test.mjs tests/browser.test.mjs tests/viewer.test.mjs tests/phone-remote.test.mjs
SCREENHOP_TEST_NATIVE=1 node --test tests/browser.test.mjs
bash tests/ui-smoke.sh
bash tests/install-smoke.sh
```

Browser tests require local browser/socket access. The QML test requires a Wayland session. See [VALIDATION.md](VALIDATION.md) for results.

Repository configured locally: `git@github.com:jeremielumandong/omarchy-screenhop.git`. No push, tag or GitHub release has been made.

Device presets are informed by [Playwright's descriptors](https://github.com/microsoft/playwright/blob/v1.51.1/packages/playwright-core/src/server/deviceDescriptorsSource.json). Viewport emulation uses the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/).

## Native WebRTC

Direct Chromium tab capture now feeds WebRTC video without intermediate JPEG conversion. Same-host prototypes verified phone, rotation, watch and desktop viewports at up to30fps with no droppedframes in shortanimatedchecks. VP8 software encoding measured about0.9–1.0ms/frame forphone and4.4ms/frame fordesktop; synthetic decodedinput latency29–84ms. These are prototype same-host results, not physical Wi-Fi latency guarantees.

Actual ScreenHop integration verified desktop/phone video, no JPEG fallback work for supported pages, pointer/keyboard input, linked followers, phone revocation and hard-navigation renegotiation. A site denying display-capture permission falls back to interactive JPEG. Odd encoded dimensions may round down one pixel while CSS dimensions remain exact.

Video uses WebRTC; production input remains on the ordered HTTP control channel. No external STUN/TURN service or new native dependency is used.

Final validation:42combined authentication, source-browser, signaling, phone and WebRTC integrationtests passed. Visible borderless WebRTC integrationpassed afterfixing Chromium’s sharedcaptureindicator resizingallsourcewindows; policy-deniedautomaticfallback andexplicitJPEGcompatibility integrationpassed. PhysicalphoneWi-Fi remains userverification.

## Resolution and export validation

The live iPhone 11 Pro Max preview was verified at 414 × 896 CSS pixels, DPR 3, and 414 × 896 video after correction. A regression deliberately changes the native capture surface size and verifies automatic recovery.

Screenshot integration verifies 1170 × 2532 page PNG output for 390 × 844 at DPR 3, frame-region cropping, frame-state restoration, and authenticated desktop/phone routes.

The capture UI smoke test downloaded both PNG modes and decoded three WebM recordings with ffmpeg: JPEG page, WebRTC page, and native device-frame capture. Page recordings were 390 × 844; the frame recording was 406 × 892 (encoder alignment from a 407 × 893 region). Decoded timelines exceeded one second. Stopping the cloned WebRTC recording preserved the live preview track.
