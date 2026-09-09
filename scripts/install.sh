#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
plugin_dir="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins/arkane.screenhop"
backup_root="${XDG_STATE_HOME:-$HOME/.local/state}/omarchy/plugin-backups"
ui_changed=false
if [[ -f "$plugin_dir/Widget.qml" ]] && ! cmp -s "$source_dir/Widget.qml" "$plugin_dir/Widget.qml"; then ui_changed=true; fi
if [[ -f "$plugin_dir/devices.json" ]] && ! cmp -s "$source_dir/devices.json" "$plugin_dir/devices.json"; then ui_changed=true; fi
command -v node >/dev/null
node -e 'if (typeof WebSocket !== "function") throw new Error("Node.js with built-in WebSocket is required")'
command -v omarchy-shell >/dev/null
command -v omarchy >/dev/null
omarchy plugin validate "$source_dir"
if [[ -n ${SCREENHOP_BROWSER:-} ]]; then
    command -v "$SCREENHOP_BROWSER" >/dev/null
else
    browser_available=false
    for browser_command in chromium google-chrome-stable google-chrome brave-browser; do
        if command -v "$browser_command" >/dev/null; then browser_available=true; break; fi
    done
    if ! $browser_available; then echo "Install Chromium or set SCREENHOP_BROWSER before installing ScreenHop." >&2; exit 1; fi
fi
# The registry scans every visible child directory and resolves duplicate ids
# by scan order. Backups beside the plugin can therefore load old code instead.
for legacy_backup in "$plugin_dir".backup.*; do
    [[ -d "$legacy_backup" ]] || continue
    [[ "${legacy_backup##*/}" =~ ^arkane\.screenhop\.backup\.[0-9]{14}$ ]] || continue
    mkdir -p -- "$backup_root"
    backup_dir=$(mktemp -d "$backup_root/arkane.screenhop.legacy.XXXXXXXX")
    mv -- "$legacy_backup" "$backup_dir/plugin"
done
if [[ -e "$plugin_dir" ]]; then
    mkdir -p -- "$backup_root"
    backup_dir=$(mktemp -d "$backup_root/arkane.screenhop.XXXXXXXX")
    cp -a -- "$plugin_dir" "$backup_dir/plugin"
fi
mkdir -p -- "$plugin_dir"
for filename in Widget.qml manifest.json viewport.mjs native-preview.mjs preview-host.mjs skin-assets.mjs event-sockets.mjs viewer.html linked-previews.mjs sync-policy.mjs sync.js capture-rtc.js capture-ui.js build.mjs workspaces.mjs devices.json README.md PLAN.md LICENSE THIRD_PARTY_NOTICES.md preview.png; do
    cp -- "$source_dir/$filename" "$plugin_dir/$filename"
done
# Remove retired phone-sharing modules from an older installation after backup.
rm -f -- "$plugin_dir/phone-remote.mjs" "$plugin_dir/phone-firewall.mjs"
mkdir -p -- "$plugin_dir/assets" "$plugin_dir/docs"
if [[ -d "$source_dir/assets" ]]; then cp -a -- "$source_dir/assets/." "$plugin_dir/assets/"; fi
cp -a -- "$source_dir/docs/." "$plugin_dir/docs/"
mkdir -p -- "$plugin_dir/third_party"
cp -a -- "$source_dir/third_party/." "$plugin_dir/third_party/"
omarchy-shell shell rescanPlugins
omarchy plugin enable arkane.screenhop

# Some Qt builds retain plugin component state across registry rescans.
if $ui_changed; then omarchy restart shell; fi
