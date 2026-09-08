import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
    id: root
    moduleName: "arkane.screenhop"
    property bool opened: false
    property bool popoutSwitchClosing: false
    property var devices: []
    property string query: ""
    property string website: "http://localhost:3000"
    property bool landscape: false
    property bool linked: true
    property bool pendingLinked: true
    property string selectedId: ""
    property string status: "Choose a device to open a browser preview."
    property string launchError: ""
    readonly property bool busy: launcher.running || linkUpdater.running
    readonly property string pluginDirectory: decodeURIComponent(Qt.resolvedUrl(".").toString().replace(/^file:\/\//, "")).replace(/\/?$/, "/")
    readonly property var groups: {
        var result = [];
        devices.forEach(function(device) {
            if (result.indexOf(device.group) < 0) result.push(device.group);
        });
        return result;
    }
    function matching(group) {
        var needle = query.trim().toLowerCase();
        return devices.filter(function(device) {
            return (!group || device.group === group)
                && (!needle || (device.name + " " + device.group + " " + device.width + "x" + device.height).toLowerCase().indexOf(needle) >= 0);
        });
    }
    function open() { opened = true; }
    function close() { opened = false; }
    function closeForPopoutSwitch() {
        popoutSwitchClosing = true;
        close();
        Qt.callLater(function() { root.popoutSwitchClosing = false; });
    }
    function launch(device) {
        if (busy) return;
        if (!website.trim()) { launchError = "Enter a website address first."; return; }
        selectedId = device.id;
        launchError = "";
        status = "Opening " + device.name + "…";
        var args = ["node", pluginDirectory + "viewport.mjs", "--device", device.id, "--url", website.trim()];
        if (landscape) args.push("--landscape");
        if (linked) args.push("--linked");
        launcher.command = args;
        launcher.running = true;
    }
    function setLinked(value) {
        if (busy) return;
        pendingLinked = value;
        launchError = "";
        linkUpdater.command = ["node", pluginDirectory + "viewport.mjs", "--link", value ? "on" : "off"];
        linkUpdater.running = true;
    }
    FileView {
        path: root.pluginDirectory + "devices.json"
        onLoaded: {
            try {
                var catalog = JSON.parse(text());
                if (!Array.isArray(catalog)) throw new Error("Expected an array");
                root.devices = catalog;
            } catch (error) { root.launchError = "Cannot read the device catalog: " + error.message; }
        }
        onLoadFailed: root.launchError = "The device catalog could not be loaded."
    }
    Process {
        id: launcher
        stdout: SplitParser {
            onRead: data => {
                try {
                    var message = JSON.parse(data);
                    if (message.status === "ready") root.status = "Preview is open. Choose a device to open another window.";
                } catch (error) { /* Ignore diagnostic lines. */ }
            }
        }
        stderr: SplitParser {
            onRead: data => { if (data.trim()) root.launchError = data.trim(); }
        }
        onExited: (exitCode, exitStatus) => {
            if (exitCode !== 0 && !root.launchError) root.launchError = "Browser preview could not start (exit " + exitCode + ").";
            root.status = exitCode === 0 ? "Preview is open. Choose a device to open another window." : "Unable to open preview.";
        }
    }
    Process {
        id: linkUpdater
        stderr: SplitParser {
            onRead: data => { if (data.trim()) root.launchError = data.trim(); }
        }
        onExited: (exitCode, exitStatus) => {
            if (exitCode === 0) {
                root.linked = root.pendingLinked;
                root.status = root.linked ? "Previews linked: navigation, clicks, typing and scrolling sync." : "Previews unlinked. Each window works independently.";
            } else if (!root.launchError) {
                root.launchError = "Could not update linked previews (exit " + exitCode + ").";
            }
        }
    }
    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight
    WidgetButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: "󰆊 ScreenHop"
        labelVisible: true
        onPressed: { if (root.opened) root.close(); else root.open(); }
    }
    component Label: Text {
        color: Color.foreground
        font.family: Style.font.family
        font.pixelSize: Style.font.body
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
    }
    KeyboardPanel {
        id: panel
        anchorItem: button
        owner: root
        bar: root.bar
        open: root.opened
        focusTarget: search
        contentWidth: panel.fittedContentWidth(Style.space(570))
        contentHeight: panel.fittedContentHeight(Style.space(690), Style.space(750))
        Column {
            anchors.fill: parent
            spacing: Style.space(10)
            Row {
                width: parent.width
                Label { text: "ScreenHop"; font.bold: true; font.pixelSize: Style.font.body * 1.4; width: parent.width - dismiss.width; anchors.verticalCenter: parent.verticalCenter }
                Button { id: dismiss; text: "Close"; focusable: true; onClicked: root.close() }
            }
            Label { width: parent.width; text: "YOUR WEBSITE, ON EVERY SCREEN"; font.pixelSize: Style.font.bodySmall; opacity: 0.65 }
            TextField {
                width: parent.width
                text: root.website
                placeholderText: "https://example.com or localhost:3000"
                Accessible.name: "Website address"
                enabled: !root.busy
                onTextEdited: root.website = text
                Keys.onEscapePressed: root.close()
            }
            Row {
                width: parent.width
                spacing: Style.space(8)
                TextField {
                    id: search
                    width: parent.width - orientation.width - parent.spacing
                    placeholderText: "Search devices…"
                    Accessible.name: "Search devices"
                    onTextChanged: { root.query = text; scroll.contentY = 0; }
                    Keys.onEscapePressed: root.close()
                }
                Button {
                    id: orientation
                    text: root.landscape ? "Landscape" : "Portrait"
                    selected: root.landscape
                    bordered: true
                    focusable: true
                    enabled: !root.busy
                    height: search.height
                    onClicked: root.landscape = !root.landscape
                }
            }
            Row {
                width: parent.width
                spacing: Style.space(8)
                Button {
                    id: linkButton
                    text: root.linked ? "✓ Link previews" : "Link previews"
                    selected: root.linked
                    bordered: true
                    focusable: true
                    enabled: !root.busy
                    onClicked: root.setLinked(!root.linked)
                }
                Label {
                    width: parent.width - linkButton.width - parent.spacing
                    anchors.verticalCenter: parent.verticalCenter
                    text: "Sync navigation, clicks, typing and scroll"
                    font.pixelSize: Style.font.bodySmall
                    opacity: 0.65
                }
            }
            Label {
                id: statusLabel
                width: parent.width
                text: root.launchError || root.status
                opacity: root.launchError ? 1 : 0.75
                font.pixelSize: Style.font.bodySmall
            }
            Flickable {
                id: scroll
                width: parent.width
                height: Math.max(Style.space(100), parent.height - y - footer.height - parent.spacing)
                contentWidth: width
                contentHeight: catalog.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds
                flickableDirection: Flickable.VerticalFlick
                function ensureVisible(item) {
                    var point = item.mapToItem(catalog, 0, 0);
                    if (point.y < contentY) contentY = point.y;
                    else if (point.y + item.height > contentY + height) contentY = Math.min(Math.max(0, contentHeight - height), point.y + item.height - height);
                }
                Keys.onEscapePressed: root.close()
                Column {
                    id: catalog
                    width: scroll.width
                    spacing: Style.space(18)
                    Label { visible: root.matching("").length === 0; width: parent.width; text: root.devices.length ? "No devices match your search." : "Loading devices…" }
                    Repeater {
                        model: root.groups
                        delegate: Column {
                            id: section
                            required property string modelData
                            readonly property var matches: root.matching(modelData)
                            visible: matches.length > 0
                            width: catalog.width
                            spacing: Style.space(8)
                            Label { text: section.modelData; font.bold: true }
                            Flow {
                                width: parent.width
                                spacing: Style.space(8)
                                Repeater {
                                    model: section.matches
                                    delegate: Rectangle {
                                        id: tile
                                        required property var modelData
                                        readonly property bool selected: root.selectedId === modelData.id
                                        width: (section.width - Style.space(8) * (section.width >= Style.space(480) ? 3 : 2)) / (section.width >= Style.space(480) ? 4 : 3)
                                        height: Style.space(132)
                                        radius: Style.cornerRadius
                                        color: tile.selected || tile.activeFocus || click.containsMouse ? Qt.alpha(Color.accent, 0.12) : "transparent"
                                        border.width: 1
                                        border.color: tile.selected || tile.activeFocus || click.containsMouse ? Color.accent : Qt.alpha(Color.foreground, 0.2)
                                        enabled: !root.busy
                                        opacity: !enabled && !selected ? 0.45 : 1
                                        activeFocusOnTab: true
                                        Accessible.role: Accessible.Button
                                        Accessible.name: modelData.name + ", " + modelData.width + " by " + modelData.height
                                        onActiveFocusChanged: if (activeFocus) scroll.ensureVisible(tile)
                                        Keys.onReturnPressed: root.launch(modelData)
                                        Keys.onEnterPressed: root.launch(modelData)
                                        Keys.onSpacePressed: root.launch(modelData)
                                        Column {
                                            anchors.centerIn: parent
                                            width: parent.width - Style.space(10)
                                            spacing: Style.space(6)
                                            Item {
                                                width: parent.width; height: Style.space(38)
                                                Rectangle {
                                                    anchors.centerIn: parent
                                                    height: modelData.width > modelData.height ? Style.space(25) : Style.space(37)
                                                    width: Math.max(Style.space(17), Math.min(Style.space(48), height * modelData.width / modelData.height))
                                                    rotation: root.landscape ? 90 : 0
                                                    radius: modelData.mobile ? Style.space(4) : Style.space(2)
                                                    color: "transparent"
                                                    border.width: 2
                                                    border.color: tile.selected ? Color.accent : Color.foreground
                                                    Rectangle { anchors.horizontalCenter: parent.horizontalCenter; anchors.top: parent.top; anchors.topMargin: 3; width: 5; height: 2; color: parent.border.color; visible: modelData.mobile }
                                                }
                                            }
                                            Label { width: parent.width; height: Style.space(34); text: modelData.name; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter; font.pixelSize: Style.font.bodySmall; maximumLineCount: 2; elide: Text.ElideRight }
                                            Label { width: parent.width; text: (root.landscape ? modelData.height : modelData.width) + " × " + (root.landscape ? modelData.width : modelData.height); horizontalAlignment: Text.AlignHCenter; font.pixelSize: Style.font.bodySmall; opacity: 0.6 }
                                        }
                                        MouseArea { id: click; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.launch(tile.modelData) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Label { id: footer; width: parent.width; text: "Viewport sizes in CSS pixels · Chromium preview"; font.pixelSize: Style.font.bodySmall; opacity: 0.5 }
        }
    }
}
