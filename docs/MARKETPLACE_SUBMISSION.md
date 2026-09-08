# Marketplace submission draft

Title: [Plugin]: ScreenHop

## Repository URL

https://github.com/jeremielumandong/omarchy-screenhop

## Category

Developer Tools

## Tags

Launcher, Quickshell, Workspaces

## Maintainer notes

ScreenHop opens responsive Chromium previews from an Omarchy bar widget. Version 1.0.0 provides 103 presets, custom CSS dimensions/DPR, optional linked browsing, local phone pairing, screenshots, recordings and saved workspaces.

Requires an Omarchy shell with third-party plugins, Quickshell, Hyprland, Node.js 22.4+ with built-in WebSocket, and Chromium or a configured compatible browser. No npm dependencies or browser extension. qrencode is optional for QR images. Phone sharing is opt-in; it binds TCP53318 and may request a scoped UFW rule through the system password prompt. Local preview tokens grant control; use a trusted network. Private browser state stays in the user's cache directories. Installation/removal and retained state are documented in README.md.

MIT covers ScreenHop code and original demonstration artwork; adapted Playwright device data includes Apache-2.0 LICENSE and NOTICE. This public version excludes Samsung emulator artwork. Device presets and authentication protection are approximations, not real-device or identity-provider certification.

## Checklist to confirm when submitting

- Public repository contains the prepared commit and installation/removal instructions.
- Plugin license, third-party notices and dependencies are documented.
- Submitter confirms rights to the code and preview assets.
- Plugin does not overwrite user configuration without explicit consent.
- Approval is a listing review, not a security review.

Submission form: https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml
