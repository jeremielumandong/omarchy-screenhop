# ScreenHop

Pick a device. Open its browser preview. Link your screens.

ScreenHop is an Omarchy shell plugin with a searchable device grid, 16 phone/tablet/computer presets, portrait/rotated orientation, and multiple simultaneous Chromium preview windows. Enter a website URL (including localhost), then click a device tile. Every click opens another preview.

**Link previews** is enabled by default. It synchronizes main-frame navigation, matching clicks, ordinary form input, and proportional page scrolling across ScreenHop windows. Turn it off for independent testing. Clicks are matched by unique data-testid, id, name, aria-label or link href, and skip missing/hidden elements. Password and file inputs are excluded. Embedded frames, shadow DOM and arbitrary custom controls are not synchronized. Linked actions execute in each preview, so use test data for workflows that submit changes.

The plugin uses actual viewport emulation through Chromium's DevTools Protocol, not an iframe. iPhone presets approximate screen layout; Chromium does not become Safari. Device dimensions are CSS pixels for the full simulated screen, not physical hardware pixels or a guarantee of a particular mobile browser's available area. Large previews scale down visually to fit while preserving their CSS dimensions. Mobile pages without a viewport meta tag may use a wider layout viewport, as they do on devices.

## Requirements

- Omarchy shell / Quickshell with third-party bar widget support.
- Node.js 22 or later, with built-in WebSocket support.
- Chromium (or a Chromium-based browser selected with SCREENHOP_BROWSER).

No npm dependencies or browser extension are required. ScreenHop uses a separate persistent browser profile under `$XDG_CACHE_HOME/screenhop/browser` (normally `~/.cache/screenhop/browser`). Existing personal browser sessions are not imported. You can sign in normally there; persistence follows the website's cookie/session rules. Named login profiles and session import are planned in [PLAN.md](PLAN.md).

## Install from GitHub

```sh
omarchy plugin add https://github.com/jeremielumandong/omarchy-screenhop.git --enable
```

Review the plugin when prompted, then enable it. ScreenHop appears on the right of the bar.

## Install locally

From the project folder:

```sh
bash scripts/install.sh
```

Click **ScreenHop** on the right of the bar, enter your URL, and choose devices. The shell loads the widget immediately. To remove it from the bar, run `omarchy plugin disable arkane.screenhop`. Browser windows can be closed normally; their local controller exits shortly after the browser closes.

## CLI

```sh
node viewport.mjs --device iphone-13 --url http://localhost:3000 --linked
node viewport.mjs --device pixel-5 --url http://localhost:3000 --linked
node viewport.mjs --device desktop --url http://localhost:3000 --linked
node viewport.mjs --link off
node viewport.mjs --list
node viewport.mjs --close
```

`--close` closes all ScreenHop preview windows. `--state /path` selects an isolated controller/profile directory for testing. Internal browser debugging binds to loopback; the controller's local socket resides in a private directory. It stays attached so emulation and linked interactions remain active after the picker closes.

## Validation

```sh
node --test tests/browser.test.mjs
bash tests/ui-smoke.sh
```

Browser integration tests launch local Chromium and a local fixture server, checking independent viewport dimensions, rotation, pixel density, touch settings, linked clicks/input/scroll/navigation, and unlink. The QML test requires a Wayland session and exercises the actual Omarchy panel, catalog search, orientation, linking, and safe launch arguments.

Device presets are informed by [Playwright's device descriptors](https://github.com/microsoft/playwright/blob/v1.51.1/packages/playwright-core/src/server/deviceDescriptorsSource.json). Emulation uses the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/).
