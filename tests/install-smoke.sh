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
with tempfile.TemporaryDirectory(prefix="screenhop-install-smoke-") as temporary:
    root = Path(temporary)
    config = root / "config"
    state = root / "state"
    commands = root / "bin"
    commands.mkdir()
    for name in ("omarchy-shell", "omarchy"):
        command = commands / name
        command.write_text("#!/bin/sh\nexit 0\n")
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

    environment = dict(
        os.environ,
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
        assert json.loads(discoverable[0].read_text())["version"] == "1.0.0"

    backups = list((state / "omarchy/plugin-backups").glob("*/plugin/manifest.json"))
    assert len(backups) == 3, backups
    assert sorted(json.loads(path.read_text())["version"] for path in backups) == [
        "0.1.0", "1.0.0", "1.0.0",
    ]
    assert sorted((path.parent / "preserved-marker").read_text() for path in backups) == [
        "0.1.0", "1.0.0", "1.0.0",
    ]
    assert not list(plugins.glob("arkane.screenhop.backup.*"))

print("PASS: repeated installs preserve backups outside discovery and expose only ScreenHop 1.0.0")
PY
