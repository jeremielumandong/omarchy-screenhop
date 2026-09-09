#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$root/.native"
/usr/lib/qt6/moc "$root/native/main.cpp" -o "$root/.native/main.moc"
native_output=$(mktemp "$root/.native/screenhop-native.XXXXXXXX")
trap 'rm -f -- "$native_output"' EXIT
c++ -std=c++17 -O2 -fPIC -I"$root/.native" "$root/native/main.cpp" -o "$native_output" $(pkg-config --cflags --libs Qt6WebEngineQuick Qt6Quick Qt6Network x11 xext)

chmod 755 "$native_output"
mv -f -- "$native_output" "$root/.native/screenhop-native"
