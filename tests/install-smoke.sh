#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

python3 - "$source_dir" <<'PY'
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

source = Path(sys.argv[1])
release_version = json.loads((source / "manifest.json").read_text())["version"]
with tempfile.TemporaryDirectory(prefix="screenhop-install-smoke-") as temporary:
    root = Path(temporary)
    config = root / "config"
    state = root / "state"
    commands = root / "bin"
    commands.mkdir()
    for name in ("omarchy-shell", "omarchy"):
        command = commands / name
        command.write_text("#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$SCREENHOP_INSTALL_TEST_LOG\"\nexit 0\n")
        command.chmod(0o755)

    plugins = config / "omarchy/plugins"
    plugins.mkdir(parents=True)
    for name, version in (
        ("arkane.screenhop", "1.0.0"),
        ("arkane.screenhop.backup.20260908163626", "0.1.0"),
    ):
        plugin = plugins / name
        plugin.mkdir()
        (plugin / "manifest.json").write_text(json.dumps({
            "id": "arkane.screenhop", "version": version,
        }))
        (plugin / "preserved-marker").write_text(version)
        (plugin / "Widget.qml").write_text("// older widget")
        (plugin / "phone-remote.mjs").write_text("// retired remote")
        (plugin / "phone-firewall.mjs").write_text("// retired firewall helper")

    environment = dict(
        os.environ,
        SCREENHOP_INSTALL_TEST_LOG=str(root / "commands.log"),
        XDG_CONFIG_HOME=str(config),
        XDG_STATE_HOME=str(state),
        PATH=str(commands) + os.pathsep + os.environ.get("PATH", os.defpath),
    )
    for _ in range(2):
        subprocess.run(["bash", str(source / "scripts/install.sh")],
                       env=environment, check=True)
        discoverable = [
            manifest for manifest in plugins.glob("*/manifest.json")
            if json.loads(manifest.read_text()).get("id") == "arkane.screenhop"
        ]
        assert len(discoverable) == 1, discoverable
        assert discoverable[0].parent == plugins / "arkane.screenhop"
        assert json.loads(discoverable[0].read_text())["version"] == release_version

    assert (root / "commands.log").read_text().splitlines().count("restart shell") == 1
    assert not (plugins / "arkane.screenhop/phone-remote.mjs").exists()
    assert not (plugins / "arkane.screenhop/phone-firewall.mjs").exists()
    assert len(json.loads((plugins / "arkane.screenhop/devices.json").read_text())) == 103
    installed = plugins / "arkane.screenhop"
    for name in ("independent-browser.mjs", "native-launch.mjs", "native-chromium.mjs", "native-switch.mjs", "native/Preview.qml", "native/main.cpp", ".native/screenhop-native"):
        assert (installed / name).read_bytes() == (source / name).read_bytes(), name
    subprocess.run(["node", "--input-type=module", "-e", "import {buildIdentity} from './build.mjs'; console.log(await buildIdentity())"], cwd=installed, check=True)
    assert (installed / "skin-assets.mjs").is_file()
    assert (installed / "docs/DEVICE_SOURCES.md").is_file()
    for device in json.loads((installed / "devices.json").read_text()):
        skin = device.get("skinAsset")
        if skin:
            for name in [skin["foreground"]] + [color["file"] for color in skin["colors"]]:
                asset = Path("assets/skins") / skin["id"] / name
                assert (installed / asset).read_bytes() == (source / asset).read_bytes()
    backups = list((state / "omarchy/plugin-backups").glob("*/plugin/manifest.json"))
    assert len(backups) == 3, backups
    assert sorted(json.loads(path.read_text())["version"] for path in backups) == [
        "0.1.0", "1.0.0", release_version,
    ]
    assert sorted((path.parent / "preserved-marker").read_text() for path in backups) == [
        "0.1.0", "1.0.0", "1.0.0",
    ]
    assert not list(plugins.glob("arkane.screenhop.backup.*"))

    environment['XDG_CONFIG_HOME'] = str(root / 'fresh-config')
    subprocess.run(['bash', str(source / 'scripts/install.sh')], env=environment, check=True)
    fresh = root / 'fresh-config/omarchy/plugins/arkane.screenhop'
    assert (fresh / '.native/screenhop-native').is_file()
    assert (fresh / 'independent-browser.mjs').is_file()

print("PASS: clean and repeated installs preserve backups outside discovery and expose only the current ScreenHop version")
PY
