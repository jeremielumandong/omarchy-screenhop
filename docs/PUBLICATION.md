# ScreenHop 1.0.0 publication preparation

Prepared against https://plugins.omarchy.org/publish.html and the marketplace's submission form on 2026-09-08. This document is a preparation record; no marketplace issue, release or tag has been published.

## Public content

Keep `arkane.screenhop` and version `1.0.0`. The public package contains 103 presets and ScreenHop-authored frames. It excludes Samsung PNGs, emulator layout files and their accompanying READMEs. Their available download terms did not establish redistribution permission. Existing local Galaxy skin installations remain separate.

Adapted Playwright descriptors retain full upstream Apache-2.0 license/notice and modification attribution. The two preview screenshots were supplied by the author and show omarchy.org, the device picker, and the local Galaxy skin setup. README captions distinguish these local skins from the public package.

## Preparation

`python3 scripts/prepare-publication.py /tmp/screenhop-public-ready` creates a new public directory from the explicit file list, strips local `skinAsset` metadata, and excludes private state and Git history. It refuses an existing output path.

Validate that directory with `omarchy plugin validate`, installer smoke tests, device catalog checks, and viewer/phone/capture regression tests. The marketplace checks the current public repository commit, not just an uploaded archive.

## Publishing Git history

Do not push the local development `main`: it contains a commit with the Samsung files. Use the prepared local `publication/1.0.0` branch, whose parent is the last public commit and whose new tree is the exported package. This preserves the local development branch and installed skins without exposing the vendor files through published history. Recheck the remote head before any eventual push; do not force-push over intervening work.

## Publication workflow

The author has authorized pushing the prepared public code and updated screenshots to the repository's `main` branch. Push `publication/1.0.0:main` only as a fast-forward, then verify the remote commit. The local development `main` remains separate because it contains the local Samsung asset import.

The marketplace listing copy in MARKETPLACE_SUBMISSION.md describes the current 1.0.0 functionality, dependencies and limits. Its category is Developer Tools, with Launcher, Quickshell and Workspaces tags. The main screenshot shows the picker; the second shows side-by-side previews.

Marketplace submission, version tags and GitHub releases are separate actions and have not been requested in this push. Confirm the form's asset-rights statement with the author when submitting.

## Validation

Passed on the exported public package: Omarchy manifest validation; repeated installation/backup smoke test; 103-device catalog integrity; nine viewer, phone and screenshot tests, including authentication isolation and real renderer input. The optional vendor asset test is explicitly skipped because those files are excluded. Both author-supplied preview screenshots were visually inspected. No browser profiles, credentials, pairing URLs, standalone Samsung asset files or Git internals are included in the exported tree.
