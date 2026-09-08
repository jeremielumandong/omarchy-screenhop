# ScreenHop 1.0.0 publication preparation

Prepared against https://plugins.omarchy.org/publish.html and the marketplace's submission form on 2026-09-08. This document is a preparation record; no marketplace issue, release or tag has been published.

## Public content

Keep `arkane.screenhop` and version `1.0.0`. The public package contains 103 presets and ScreenHop-authored frames. It excludes Samsung PNGs, emulator layout files and their accompanying READMEs. Their available download terms did not establish redistribution permission. Existing local Galaxy skin installations remain separate.

Adapted Playwright descriptors retain full upstream Apache-2.0 license/notice and modification attribution. The preview image shows an original ScreenHop test page inside its original CSS frame.

## Preparation

`python3 scripts/prepare-publication.py /tmp/screenhop-public-ready` creates a new public directory from the explicit file list, strips local `skinAsset` metadata, and excludes private state and Git history. It refuses an existing output path.

Validate that directory with `omarchy plugin validate`, installer smoke tests, device catalog checks, and viewer/phone/capture regression tests. The marketplace checks the current public repository commit, not just an uploaded archive.

## Publishing Git history

Do not push the local development `main`: it contains a commit with the Samsung files. Use the prepared local `publication/1.0.0` branch, whose parent is the last public commit and whose new tree is the exported package. This preserves the local development branch and installed skins without exposing the vendor files through published history. Recheck the remote head before any eventual push; do not force-push over intervening work.

## Remaining external actions

After user review, push the prepared branch to the intended public branch, verify GitHub displays the new manifest/README/preview, optionally tag/release 1.0.0, then submit the text in MARKETPLACE_SUBMISSION.md. Do not mark the submission's asset-rights checkbox on behalf of the author without their confirmation. The existing repository is public; its checked head during preparation was 335542a3090bb91592b38e1a7fa195ee24245b09.

## Validation

Passed on the exported public package: Omarchy manifest validation; repeated installation/backup smoke test; 103-device catalog integrity; nine viewer, phone and screenshot tests, including authentication isolation and real renderer input. The optional vendor asset test is explicitly skipped because those files are excluded. The original CSS-frame preview image was visually inspected. No browser profiles, credentials, pairing URLs, Samsung assets or Git internals are included in the exported tree.
