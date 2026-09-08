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
