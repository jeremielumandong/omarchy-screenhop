#!/usr/bin/env bash
set -euo pipefail
plugin_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
shell_dir=${OMARCHY_SHELL_DIR:-/usr/share/omarchy/shell}
test_dir=$(mktemp -d /tmp/screenhop-ui-smoke.XXXXXX)
trap 'rm -rf -- "$test_dir"' EXIT
for module in Commons Ui; do
    ln -s "$shell_dir/$module" "$test_dir/$module"
done
mkdir -p "$test_dir/bin"
cat > "$test_dir/bin/omarchy-shell" <<'SH'
#!/bin/sh
printf called > "$SCREENHOP_FORBIDDEN_SHELL_CALL"
exit 99
SH
chmod +x "$test_dir/bin/omarchy-shell"
cp "$test_dir/bin/omarchy-shell" "$test_dir/bin/omarchy"
export SCREENHOP_FORBIDDEN_SHELL_CALL="$test_dir/forbidden-shell-call"
export PATH="$test_dir/bin:$PATH"
cp "$plugin_dir/Widget.qml" "$plugin_dir/devices.json" "$test_dir/"
cp "$plugin_dir/tests/ui-smoke.qml" "$test_dir/shell.qml"
cat > "$test_dir/viewport.mjs" <<'JS'
import assert from 'node:assert/strict';
import {existsSync, writeFileSync} from 'node:fs';
const args = process.argv.slice(2);
const native = process.argv[1].endsWith("native-preview.mjs");
if (args[0] === '--status') {
    assert.deepEqual(args, ['--status']);
    console.log(JSON.stringify({status: 'state', enabled: false, previewCount: 0}));
} else if (args[0] === '--link') {
    assert.deepEqual(args, ['--link', args[1]]);
    assert.ok(['on', 'off'].includes(args[1]));
    if (native) assert.equal(args[1], 'on');
    const denied = !native && args[1] === 'on' && existsSync(process.argv[1] + '.auth');
    if (!native && args[1] === 'on') writeFileSync(process.argv[1] + '.auth', '1');
    console.log(JSON.stringify({status: 'linked', enabled: args[1] === 'on' && !denied, reason: denied ? 'Linking paused during sign in.' : ''}));
} else {
    const shared = ['--device', args[1], '--url', 'https://example.com/path?q=a&text=two words'];
    if (args[1] === 'custom') {
        assert.deepEqual(args, [...shared, '--width', '428', '--height', '926', '--dpr', '3', ...(!native ? ['--mobile'] : [])]);
        console.log(JSON.stringify({status: 'ready', linked: false}));
    } else if (args[1] === 'iphone-se') {
        assert.equal(native, false);
        assert.deepEqual(args, [...shared, '--landscape', '--linked']);
        console.log(JSON.stringify({status: 'ready', linked: false, reason: 'Linking paused during sign in.'}));
    } else {
        assert.equal(native, true);
        assert.equal(args[1], 'iphone-12-mini');
        assert.deepEqual(args, shared);
        console.log(JSON.stringify({status: 'ready', linked: false}));
    }
}
JS
cp "$test_dir/viewport.mjs" "$test_dir/native-preview.mjs"
cp "$test_dir/viewport.mjs" "$test_dir/native-switch.mjs"
cp "$test_dir/viewport.mjs" "$test_dir/independent-browser.mjs"
# A real Wayland session is required by Omarchy's KeyboardPanel component.
timeout 15 quickshell -p "$test_dir" --no-color 2>&1 | tee "$test_dir/output.log"
rg -q 'PASS ScreenHop catalog' "$test_dir/output.log"
if rg 'ERROR|TypeError|ReferenceError|Cannot assign|Cannot open:|Error: (Catalog|Search|Unlink|Link|Launch|Second)' "$test_dir/output.log"; then
    exit 1
fi

[[ ! -e "$SCREENHOP_FORBIDDEN_SHELL_CALL" ]]
[[ ! -e "$plugin_dir/plugin-update.mjs" ]]
! rg -q 'plugin-update|git (fetch|pull|merge)|build-native\.sh' "$plugin_dir/Widget.qml"
