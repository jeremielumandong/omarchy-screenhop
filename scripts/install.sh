#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
plugin_dir="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins/arkane.screenhop"
command -v node >/dev/null
node -e 'if (typeof WebSocket !== "function") throw new Error("Node.js with built-in WebSocket is required")'
command -v omarchy-shell >/dev/null
if [[ -e "$plugin_dir" ]]; then
    cp -a -- "$plugin_dir" "$plugin_dir.backup.$(date +%Y%m%d%H%M%S)"
fi
mkdir -p -- "$plugin_dir"
for filename in Widget.qml manifest.json viewport.mjs native-preview.mjs preview-host.mjs viewer.html linked-previews.mjs sync-policy.mjs sync.js devices.json README.md PLAN.md LICENSE preview.png; do
    cp -- "$source_dir/$filename" "$plugin_dir/$filename"
done
omarchy-shell shell rescanPlugins
omarchy plugin enable arkane.screenhop
