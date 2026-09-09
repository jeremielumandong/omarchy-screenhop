# ScreenHop 1.0.3 publication

## Release scope

The release provides desktop responsive previews, device presets, linked browsing, screenshots, recordings and saved workspaces. Phone remote control is deferred; the package excludes its LAN listener, pairing UI, certificate configuration and firewall helper. Desktop control and browser debugging endpoints remain loopback-only.

Keep `arkane.screenhop` and version `1.0.3`. The public package contains 103 presets and ScreenHop-authored frames. Locally supplied Samsung artwork and its Git history must not be published. Adapted Playwright descriptors retain their upstream Apache-2.0 license/notice and modification attribution.

## Preparing the package

`python3 scripts/prepare-publication.py NEW_OUTPUT_DIRECTORY` exports an explicit public file list, strips local `skinAsset` metadata and excludes private state and Git history. It refuses an existing output path. The installer backs up older installations before removing retired phone-sharing modules.

Validate the exported directory with `omarchy plugin validate`, installer/UI smoke tests and desktop viewer, touch, capture, signaling and multi-preview regressions. Record current results in VALIDATION.md. Release notes live in CHANGELOG.md and listing copy in MARKETPLACE_SUBMISSION.md.

## Publishing

Use the clean public repository history and push the release commit to `main`. Do not push the separate local-development `main`: its history contains locally supplied vendor assets. Recheck upstream HEAD and use a normal fast-forward push for this release.

The original Marketplace submission, [issue #5799](https://github.com/omacom/omarchy-plugin-marketplace/issues/5799), is closed after publication. For an existing listing, use the [Plugin verification form](https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=verify-plugin.yml), select **Verify and publish a newer upstream commit**, and supply `arkane.screenhop`, the repository root URL, and the final full 40-character default-branch HEAD. Compatibility validation, security baseline and maintainer approval must bind the same commit. The old snapshot remains authoritative until promotion completes. See [the update workflow](https://github.com/omacom/omarchy-plugin-marketplace/blob/main/VERIFICATION.md#promoting-a-plugin-update).

Publish tag `v1.0.3` and its GitHub release at the same commit. A GitHub release does not update the Marketplace verification snapshot. No local test certificates, private keys, browser profiles, saved credentials or pairing URLs belong in the package.

Version 1.0.3 includes optional native Chromium sources and build instructions; WebRTC remains the public default. The existing Marketplace issue is closed after publication of the earlier snapshot. A fresh Marketplace validation and security baseline must refer to the final full 1.0.3 commit.
