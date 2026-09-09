# ScreenHop: saved test login profiles

Status: planned, not implemented. The current release opens device previews and can link their interactions.

## Intended workflow

Add a profile selector next to the website address. A user creates a named profile, such as “Demo customer” or “Staging admin”, opens a preview, and signs in normally once. ScreenHop retains that profile's browser session so later previews can reuse it.

Device windows using the same profile share cookies and browser storage. Separate accounts use separate profiles, with independent browser data directories. A profile is selected before opening a window; switching an existing window to another account opens a new window for that profile.

## Implementation steps

1. Store named profile metadata and browser data in ScreenHop's application state directory. Use opaque IDs for paths and human-readable names only for display.
2. Give each profile its own managed browser session. Pass the selected profile ID through the picker, controller, and launch commands.
3. Add create, rename, and remove actions. Removing a profile requires confirmation because it erases its saved login session.
4. Limit linked interactions to windows in the same profile, so testing one account does not trigger actions in another account's session.
5. Verify that cookies survive a restart, same-profile windows share authentication, separate profiles remain isolated, and expired sessions can sign in again.

Session expiry, logout, MFA, and site security requirements still apply. ScreenHop does not bypass authentication or promise permanent login.

A later optional feature could import supported browser storage state for test environments. Imported state contains authentication material and belongs inside the selected local profile; ScreenHop should not collect or store raw passwords or other login credentials.

## Deferred phone remote

Phone remote control is excluded from the first public release. A future design must establish authenticated encrypted transport with a usable pairing experience, such as a native companion app with QR-bound identity verification or an explicitly configured secure transport. Do not restore the old plaintext LAN bearer endpoint.
