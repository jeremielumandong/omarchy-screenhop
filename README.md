# ScreenHop 1.0.0

Pick a device. Open its browser preview. Link your screens.

**Local development build — not published.**

ScreenHop is an Omarchy shell plugin with 16 searchable phone, tablet, and computer presets. Each selection opens a separate preview at the device's CSS dimensions.

![ScreenHop centered device preview](preview.png)

## Device previews

Click **ScreenHop** in the bar, enter your website URL (including localhost), and choose a device. The selected device's name and resolution appear above a centered outline. Phone, tablet and desktop frames surround the live webpage without covering it or changing its viewport. Large devices scale visually to fit.

- **Device frame on:** a live offscreen Chromium renderer appears inside a centered device frame. Mouse, keyboard, paste and scrolling are forwarded to the actual page. Use the viewer's Frame toggle to hide the decorative outline without changing viewport dimensions.
- **Device frame off in the picker:** opens a direct Chromium window with the device and resolution in its title. This retains native browser controls and is preferable for sign-in troubleshooting or features the streamed viewer does not support.
- **Portrait/rotation:** swaps width and height before opening another preview.

Framed and direct previews use separate browser profiles. Within each mode, previews share that mode's browser cookies. Existing personal browser sessions are not imported. Named account profiles and session import are planned in [PLAN.md](PLAN.md).

The frame is visual styling, not a mobile operating system or Safari emulator. Chromium remains the rendering engine. Mobile pages without a viewport meta tag can have a wider layout viewport, as on actual devices. Native file pickers, downloads, browser dialogs, drag-and-drop files and accessibility tree interaction are not exposed through the streamed frame; use direct mode for those workflows.

## Linked browsing and authentication

Linking **defaults off**. Enable **Link previews** for ordinary page comparison. It mirrors matching clicks, ordinary text input and proportional page scrolling. Only trusted, same-origin link navigation is copied after loading; server redirects are never broadcast as navigation commands.

Sign-in, OAuth/OIDC callbacks, verification codes and security challenges belong to one preview. ScreenHop pauses linking on recognized authentication URLs, identity-provider hosts, credential forms, MFA fields and sign-in actions. Submit controls, passwords, files and one-time codes are not mirrored. It stays paused until you explicitly enable it after authentication pages have been left.

Regression coverage includes IdentityServer, Okta, Azure AD/Microsoft Entra ID, Auth0, Google and GitHub URL patterns; OAuth2 authorization code/PKCE, implicit/hybrid callbacks, OAuth1 callback parameters, standard login and MFA forms. These are local fixtures, **not certification against every provider or a live tenant**. Unknown custom authentication UI may require an additional detection rule. Keep linking off while signing in.

Cloudflare can still challenge or reject emulated/automated browsers. ScreenHop does not bypass those checks. Cloudflare documents that headless browsers and automation are unsupported for production challenge solving: [supported browsers](https://developers.cloudflare.com/cloudflare-challenges/reference/supported-browsers/). Direct mode removes the streamed/headless view but still uses viewport emulation and is not a guarantee of challenge compatibility.

Clicks match unique data-testid, id, name, aria-label or link href and skip missing/hidden elements. Embedded frames, shadow DOM and arbitrary custom controls are not synchronized. Linked actions run in each preview; use test data for actions that change application state.

## Requirements and local installation

- Omarchy shell / Quickshell with third-party widgets and current Hyprland Lua dispatchers.
- Node.js 22 or later with built-in WebSocket support.
- Chromium, or a Chromium-based executable selected with SCREENHOP_BROWSER.

No npm dependencies or browser extension are needed.

```sh
bash scripts/install.sh
```

The widget appears at the right of the bar. After updating, open new previews to use the new controller. Previously opened previews remain in their existing session; the older linked session was disabled during the OAuth fix.

To remove the widget from the bar: `omarchy plugin disable arkane.screenhop`.

## Local state and CLI

Framed mode uses `$XDG_CACHE_HOME/screenhop-framed` and direct mode uses `$XDG_CACHE_HOME/screenhop-native` (normally under `~/.cache`). These directories contain private browser data and local controller sockets. The frame server binds to loopback and uses an unguessable URL token. Do not share those URLs as public preview links.

```sh
node viewport.mjs --device iphone-13 --url http://localhost:3000
node viewport.mjs --device pixel-5 --url http://localhost:3000 --linked
node viewport.mjs --link off
node native-preview.mjs --device desktop --url http://localhost:3000
node native-preview.mjs --link off
node viewport.mjs --list
```

`--state /path` selects isolated test state. `--close` closes all previews belonging to that helper/mode. Closing a framed window also closes its underlying rendering page. A local controller remains attached while windows are open and exits shortly after the browser closes.

## Tests

```sh
node --test tests/auth-policy.test.mjs tests/browser.test.mjs tests/viewer.test.mjs
SCREENHOP_TEST_NATIVE=1 node --test tests/browser.test.mjs
bash tests/ui-smoke.sh
```

Browser tests require local browser/socket access. The QML test requires a Wayland session. See [VALIDATION.md](VALIDATION.md) for results.

Repository configured locally: `git@github.com:jeremielumandong/omarchy-screenhop.git`. No push, tag or GitHub release has been made.

Device presets are informed by [Playwright's descriptors](https://github.com/microsoft/playwright/blob/v1.51.1/packages/playwright-core/src/server/deviceDescriptorsSource.json). Viewport emulation uses the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/).
