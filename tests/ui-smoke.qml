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
                check(widget.devices.length === 16, "Catalog load failed: " + widget.launchError);
                check(widget.linked, "Previews should link by default");
                widget.query = "pixel";
                check(widget.matching("").length === 2, "Search failed");
                widget.query = "";
                widget.open();
                widget.setLinked(false);
            } else if (stage === 1) {
                check(!widget.linked && !widget.launchError, "Unlink failed: " + widget.launchError);
                widget.setLinked(true);
            } else if (stage === 2) {
                check(widget.linked && !widget.launchError, "Link failed: " + widget.launchError);
                widget.landscape = true;
                widget.website = "https://example.com/path?q=a&text=two words";
                widget.launch(widget.devices[0]);
            } else if (stage === 3) {
                check(!widget.launchError, "Launch failed: " + widget.launchError);
                check(widget.status.indexOf("Preview is open") === 0, "Launch status missing");
                widget.linked = false;
                widget.landscape = false;
                widget.launch(widget.devices[1]);
            } else {
                check(!widget.launchError, "Second launch failed: " + widget.launchError);
                console.log("PASS ScreenHop catalog, search, linked toggle, launch arguments and panel creation");
                widget.close();
                Qt.quit();
            }
            stage++;
        }
    }
}
