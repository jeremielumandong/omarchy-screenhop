# ScreenHop 1.0.0 publication

## Release scope

The first public release provides desktop responsive previews, device presets, linked browsing, screenshots, recordings and saved workspaces. Phone remote control is deferred; the package excludes its LAN listener, pairing UI, certificate configuration and firewall helper. Desktop control and browser debugging endpoints remain loopback-only.

Keep `arkane.screenhop` and version `1.0.0`. The public package contains 103 presets and ScreenHop-authored frames. Locally supplied Samsung artwork and its Git history must not be published. Adapted Playwright descriptors retain their upstream Apache-2.0 license/notice and modification attribution.

## Preparing the package

`python3 scripts/prepare-publication.py NEW_OUTPUT_DIRECTORY` exports an explicit public file list, strips local `skinAsset` metadata and excludes private state and Git history. It refuses an existing output path. The installer backs up older installations before removing retired phone-sharing modules.

Validate the exported directory with `omarchy plugin validate`, installer/UI smoke tests and desktop viewer, touch, capture, signaling and multi-preview regressions. Record current results in VALIDATION.md. Release notes live in CHANGELOG.md and listing copy in MARKETPLACE_SUBMISSION.md.

## Publishing

Use the public `publication/1.0.0` branch. Do not push the separate local-development `main`: its history contains locally supplied vendor assets. Recheck upstream HEAD and use a normal fast-forward push when publication resumes.

The existing marketplace submission is [issue #5799](https://github.com/omacom/omarchy-plugin-marketplace/issues/5799). After the final code and release documentation are pushed, edit that existing issue to request fresh validation and the automated security baseline for the full 40-character commit. Default-branch HEAD, validation commit and baseline commit must match before maintainer approval. Do not reuse the earlier phone-sharing attestation.

Publication/revalidation is paused for local review. A GitHub release or version tag is a separate action. No local test certificates, private keys, browser profiles, saved credentials or pairing URLs belong in the package.
