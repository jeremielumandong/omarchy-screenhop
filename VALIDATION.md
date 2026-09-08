# ScreenHop 1.0.0 validation

Validated locally on Omarchy / Hyprland, 2026-09-08. Not published.

- Authentication policy/DOM tests: **29 passed**. Covers IdentityServer, Okta, Azure AD/Microsoft Entra ID, Auth0, Google and GitHub patterns; code/PKCE, implicit/hybrid and OAuth1 callback parameters; password/username/MFA forms; Cloudflare challenge detection.
- Framed browser integration: **2 passed**. Independent device dimensions, orientation, pixel density, input behavior, linked clicks/input/scroll and trusted same-origin navigation.
- Centered viewer integration: **1 passed**, including a visible Hyprland run. Verified label, outline centering, live rendering, mouse/keyboard forwarding, unchanged viewport when the frame toggles, and closing the rendering page with its frame.
- The viewer integration exercised **six local provider-shaped redirect chains** and a standard login/MFA form. Authentication callbacks and form submissions occurred once and were not replayed into other previews; linking could not resume while an auth callback remained open.
- Direct/native browser integration: **2 passed** with the same linking and sizing checks.
- Omarchy QML smoke: **passed**. Catalog, search, frame/native routing, link control, authentication pause message, URL arguments and panel rendering.
- JavaScript and installer shell syntax checks: passed.

The provider tests use local fixtures and synthetic callback values. No live tenant sign-in, production Cloudflare challenge solve, or universal provider compatibility is claimed. Keep linking off during authentication; Cloudflare can still reject automated/emulated browsers.

Screenshot `preview.png` was captured from the actual framed viewer displaying a local test page. Named login profiles/session import remain planned in PLAN.md.

- Borderless desktop regression passed: application viewport height equals outer window height (no browser titlebar/tabs/address bar), and the device outline is centered on both axes.
- Installer regression passed: legacy backup migration and repeat installs preserve all backups outside discovery and leave exactly one discoverable ScreenHop 1.0.0.

## Linking, phone remote and catalog update

- Combined authentication/browser/viewer/phone suite: 36 tests passed. Real browser coverage includes unnamed SPA buttons and clickable rows, group linking preservation, same-document OAuth recovery, and phone input reaching both the lead and follower.
- Direct/native regression: 2 tests passed with the same linking scenarios.
- Phone HTTP tests cover token gating, origin/Host validation, allowed commands, frame streaming and revocation. Phone touch/keyboard bridge tested in Chromium; physical phone and actual Wi-Fi connectivity remain unverified.
- Catalog expanded to 66 unique presets across 10 groups; original 16 dimensions and IDs preserved. Generic specialty devices are labeled responsive.
- QML category/custom-size/phone/linking smoke passed; repeated installer test passed with the phone module included.
- Existing controllers require all previews to close and 35 seconds to exit before the update takes effect. New CLI detects outdated controllers and gives an explicit message.
