# ScreenHop marketplace submission

**Title:** [Plugin]: ScreenHop — Your website, every screen

**Repository URL:** https://github.com/jeremielumandong/omarchy-screenhop

**Category:** Developer Tools

**Tags:** Launcher, Quickshell, Workspaces

## Short description

Preview your website across multiple devices, side by side. A responsive testing workspace for developers on Omarchy.

## Maintainer notes / listing copy

### Preview your website across multiple devices—side by side.

Built for developers who want to preview their websites in multiple device views at once. A layout can look great on your laptop and break on a phone. ScreenHop puts those views next to each other, so you can see the difference while you work.

Open ScreenHop from the bar, enter your site or localhost URL, and choose from **103 searchable presets** or set your own CSS dimensions and pixel density. Each device opens in a centered, borderless preview with its name and resolution visible. Compare phones, tablets, foldables and desktop layouts without manually resizing browser windows.

**One workflow, several views.** Enable linked browsing to mirror supported clicks, ordinary typing, scrolling and navigation across matching controls. Phone and tablet previews send touch input; desktop previews support mouse hover. Recognized sign-in and verification flows pause linking.

**Your phone can be the controller.** Pair through a QR code on trusted local Wi-Fi, select a preview, and interact from your phone's browser. Link the previews to control the group. No companion app or cloud account is required.

**Capture what matters.** Save PNG screenshots and silent recordings, with a device frame or just the webpage. Export screenshots from every open preview, and save your device-and-URL workspace for the next session.

**Tune the preview to your workflow.** WebRTC video is the default, with Auto, Eco and Smooth capture modes, live diagnostics, and JPEG compatibility fallback. Display scaling fits large previews on your desktop without changing the tested CSS viewport.

ScreenHop is built for responsive development, layout reviews and documenting bugs—directly from your Omarchy desktop.

### Requirements and practical limits

Requires an Omarchy shell with third-party plugins, Quickshell, Hyprland, Node.js 22.4+ with built-in WebSocket, and Chromium or a configured compatible browser. No npm dependencies or browser extension. `qrencode` is optional for QR images; a pairing URL is available without it.

These are Chromium previews, not real devices, Safari or mobile OS emulators. Presets derived from physical specifications are marked approximate. Linking skips unsupported or ambiguous controls, and authentication detection is not a guarantee for every provider. Native browser dialogs and file workflows are available through direct browser mode. Recordings are silent and limited to three minutes or 128 MB.

Phone sharing is opt-in, uses local HTTP on TCP53318, and may request a scoped UFW rule through the system password prompt. Use a trusted network: pairing URLs grant preview control. Installation, removal, retained browser profiles and firewall rules are documented in README.md.

MIT covers ScreenHop code and original CSS frames. Adapted Playwright device data includes its Apache-2.0 license and notice. The public package excludes standalone Samsung emulator asset files. The author-supplied screenshots show a local Galaxy skin setup, as identified in the README.

## Preview images

- Main preview: `preview.png` — ScreenHop's device picker alongside responsive previews.
- Additional screenshot: `docs/images/device-previews.png` — foldable and phone views side by side.

## Submission checklist

Confirm these in the marketplace form when submitting:

- The public repository contains the current code and installation/removal instructions.
- License, third-party notices and dependencies are documented.
- The submitter owns or has permission to submit the plugin and preview assets.
- The plugin does not overwrite user configuration without explicit consent.
- Marketplace approval is a listing review, not a security review.

Submit: https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml
