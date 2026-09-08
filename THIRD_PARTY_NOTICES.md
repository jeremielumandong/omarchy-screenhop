# Third-party notices

ScreenHop-authored code is licensed under the root MIT `LICENSE`. That license does not replace the licenses of third-party material or grant rights to manufacturer artwork and trademarks.

## Playwright device descriptors

Parts of `devices.json` adapt viewport dimensions, device scale factors and mobile-device classifications from Microsoft Playwright v1.55.0:

- Source: https://github.com/microsoft/playwright/blob/v1.55.0/packages/playwright-core/src/server/deviceDescriptorsSource.json
- License: Apache License 2.0, reproduced verbatim in `third_party/playwright/LICENSE`.
- Upstream notice: reproduced verbatim in `third_party/playwright/NOTICE`.

ScreenHop modified the descriptor structure: it selects device entries, assigns ScreenHop IDs and groups, adds decorative frame styles and source metadata, and omits Playwright browser-engine and user-agent configuration. Some names combine related models. Additional presets and recent models use manufacturer specifications and explicitly identified density assumptions; they are not all Playwright descriptors. See `docs/DEVICE_SOURCES.md` and per-device source metadata for provenance and viewport limitations.

## Optional Samsung emulator artwork

The public package includes ScreenHop-authored generic frames. Samsung emulator PNG artwork and its original layout files are excluded. Locally supplied artwork remains third-party material and is not relicensed by ScreenHop.

The supplied archive README files describe emulator use but contain no identified redistribution grant. Samsung's developer portal terms refer software downloads to its EULA; the reviewed EULA limits incorporation and third-party transfer. No permission to redistribute those skin assets has been established by this project. This records the publication decision, not an assurance about any particular user's rights.

- Samsung developer terms: https://developer.samsung.com/terms?location=us
- Samsung developer EULA: https://developer.samsung.com/end-user-license?location=us
- Reviewed: 2026-09-08.

Device and vendor names identify testing presets. ScreenHop is not endorsed by Apple, Samsung, Google, Microsoft, or the other named device manufacturers.
