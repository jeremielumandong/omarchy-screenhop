import QtQuick
import Quickshell
ShellRoot {
    QtObject {
        id: testBar
        property string position: "top"
        property bool vertical: false
        property int barSize: 30
        property bool foregroundAnimationEnabled: false
        property string fontFamily: "monospace"
        property color barForeground: "white"
        property color urgent: "red"
        property var activePopout: null
        function requestPopout(item) { activePopout = item; }
        function releasePopout(item) { activePopout = null; }
        function hideTooltip(item) {}
        function showTooltip(item, text) {}
    }
    PanelWindow {
        visible: true; implicitWidth: 1000; implicitHeight: 900
        Widget { id: widget; bar: testBar }
    }
    property int stage: 0
    function check(value, message) { if (!value) throw new Error(message); }
    Timer {
        interval: 150; running: true; repeat: true
        onTriggered: {
            if (!widget.devices.length || widget.busy) return;
            if (stage === 0) {
                check(widget.devices.length >= 16, "Catalog load failed: " + widget.launchError);
                check(!widget.linked, "Previews should start unlinked");
                check(widget.deviceFrame, "Device frame should be the default");
                widget.query = "pixel";
                check(widget.matching("").length >= 2, "Search failed");
                widget.query = "";
                widget.category = "Tablets";
                check(widget.matching("").length >= 3 && widget.matching("").every(function(device) { return device.group === "Tablets"; }), "Category filter failed");
                widget.category = "";
                widget.linked = true; // Simulate stale shell state before reading the controller.
                widget.open();
            } else if (stage === 1) {
                check(!widget.linked && !widget.launchError, "Status refresh failed: " + widget.launchError);
                widget.setLinked(false);
            } else if (stage === 2) {
                check(!widget.linked && !widget.launchError, "Unlink failed: " + widget.launchError);
                widget.setLinked(true);
            } else if (stage === 3) {
                check(widget.linked && !widget.launchError, "Link failed: " + widget.launchError);
                widget.landscape = true;
                widget.website = "https://example.com/path?q=a&text=two words";
                widget.launch(widget.devices[0]);
            } else if (stage === 4) {
                check(!widget.launchError, "Launch failed: " + widget.launchError);
                check(widget.status === "Linking paused during sign in.", "Auth pause reason missing");
                check(!widget.linked, "Auth pause should clear linked state");
                widget.setLinked(true);
            } else if (stage === 5) {
                check(!widget.linked && !widget.launchError, "Denied enable must remain unlinked: " + widget.launchError);
                check(widget.status === "Linking paused during sign in.", "Denied enable reason missing");
                widget.deviceFrame = false;
                widget.linked = true;
                widget.refreshLinked();
            } else if (stage === 6) {
                check(!widget.linked && !widget.launchError, "Native status refresh failed: " + widget.launchError);
                widget.landscape = false;
                widget.launch(widget.devices[1]);
            } else if (stage === 7) {
                check(!widget.launchError, "Second launch failed: " + widget.launchError);
                widget.setLinked(true);
            } else if (stage === 8) {
                check(widget.linked && !widget.launchError, "Native link failed: " + widget.launchError);
                check(!widget.phoneEnabled && !widget.phoneReason, "Phone status refresh failed");
                widget.setPhone(true);
                check(!widget.busy && !widget.phoneEnabled, "Native mode must not start sharing");
                widget.deviceFrame = true;
                widget.setPhone(true);
            } else if (stage === 9) {
                check(widget.phoneEnabled && !widget.phoneReason, "Phone remote enable failed: " + widget.phoneReason);
                check(widget.phoneUrl === "https://screenhop.example.test:53318/test-token/", "Phone remote URL missing");
                check(widget.phoneQrData === "", "Manual URL fallback must work without a QR image");
                widget.setPhone(false);
            } else if (stage === 10) {
                check(!widget.phoneEnabled && !widget.phoneUrl && !widget.phoneReason, "Phone remote stop failed");
                widget.customExpanded = true;
                widget.customWidth = "0";
                widget.launchCustom();
                check(!widget.busy && widget.launchError.length > 0, "Invalid custom dimensions should be rejected");
                widget.customWidth = "428";
                widget.customHeight = "926";
                widget.customDpr = "3";
                widget.linked = false;
                widget.launchCustom();
            } else if (stage === 11) {
                check(!widget.launchError && widget.selectedId === "custom", "Custom framed launch failed: " + widget.launchError);
                widget.deviceFrame = false;
                widget.customMobile = false;
                widget.launchCustom();
            } else {
                check(!widget.launchError, "Custom native launch failed: " + widget.launchError);
                console.log("PASS ScreenHop catalog, search, frame/native launches, linked toggle, auth pause and panel creation");
                widget.close();
                Qt.quit();
            }
            stage++;
        }
    }
}
