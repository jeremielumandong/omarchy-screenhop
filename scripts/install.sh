#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
plugin_dir="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins/arkane.screenhop"
backup_root="${XDG_STATE_HOME:-$HOME/.local/state}/omarchy/plugin-backups"
command -v node >/dev/null
node -e 'if (typeof WebSocket !== "function") throw new Error("Node.js with built-in WebSocket is required")'
command -v omarchy-shell >/dev/null
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
for filename in Widget.qml manifest.json viewport.mjs native-preview.mjs preview-host.mjs phone-remote.mjs phone-firewall.mjs viewer.html linked-previews.mjs sync-policy.mjs sync.js capture-rtc.js devices.json README.md PLAN.md LICENSE preview.png; do
    cp -- "$source_dir/$filename" "$plugin_dir/$filename"
done
omarchy-shell shell rescanPlugins
omarchy plugin enable arkane.screenhop
