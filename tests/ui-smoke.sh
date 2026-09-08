#!/usr/bin/env bash
set -euo pipefail
plugin_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
shell_dir=${OMARCHY_SHELL_DIR:-/usr/share/omarchy/shell}
test_dir=$(mktemp -d /tmp/screenhop-ui-smoke.XXXXXX)
trap 'rm -rf -- "$test_dir"' EXIT
for module in Commons Ui; do
    ln -s "$shell_dir/$module" "$test_dir/$module"
done
cp "$plugin_dir/Widget.qml" "$plugin_dir/devices.json" "$test_dir/"
cp "$plugin_dir/tests/ui-smoke.qml" "$test_dir/shell.qml"
cat > "$test_dir/viewport.mjs" <<'JS'
import assert from 'node:assert/strict';
const args = process.argv.slice(2);
if (args[0] === '--link') {
    assert.deepEqual(args, ['--link', args[1]]);
    assert.ok(['on', 'off'].includes(args[1]));
} else {
    const shared = ['--device', args[1], '--url', 'https://example.com/path?q=a&text=two words'];
    if (args[1] === 'iphone-se') assert.deepEqual(args, [...shared, '--landscape', '--linked']);
    else { assert.equal(args[1], 'iphone-12-mini'); assert.deepEqual(args, shared); }
    console.log(JSON.stringify({status: 'ready'}));
}
JS
# A real Wayland session is required by Omarchy's KeyboardPanel component.
timeout 15 quickshell -p "$test_dir" --no-color 2>&1 | tee "$test_dir/output.log"
rg -q 'PASS ScreenHop catalog' "$test_dir/output.log"
if rg 'ERROR|TypeError|ReferenceError|Cannot assign|Cannot open:|Error: (Catalog|Search|Unlink|Link|Launch|Second)' "$test_dir/output.log"; then
    exit 1
fi
