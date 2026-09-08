# ScreenHop validation

Validated on this Omarchy / Hyprland desktop, 2026-09-08.

- Node browser tests: 2 passed, 0 failed. Executed against real Chromium with visible windows under Hyprland.
- Verified four independent previews, persistent CSS viewport dimensions, rotation, pixel density, mobile touch and desktop input settings.
- Verified linked real clicks, text input, proportional scrolling, navigation, and independent navigation after unlink.
- Verified ScreenHop windows float under Hyprland using its Lua dispatcher API.
- QML UI smoke: passed against installed Omarchy components; checked 16-device catalog, search, link toggle, orientation, two launches and URL argument integrity.
- JavaScript syntax and installer shell syntax checks passed.

Named login profiles and imported sessions are planned, not implemented; see PLAN.md.
