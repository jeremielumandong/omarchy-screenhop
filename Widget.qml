import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
    id: root
    moduleName: "arkane.screenhop"
    Component.onCompleted: console.info("ScreenHop 1.0.1 widget loaded:", pluginDirectory, "initial URL:", website)
    readonly property bool showBarText: setting("showBarText", true)
    function setBarText(value) {
        var entry = {id: root.moduleName};
        for (var key in root.settings) if (key !== "id") entry[key] = root.settings[key];
        entry.showBarText = value;
        root.settings = entry;
        if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
            root.bar.shell.updateEntryInline(root.moduleName, entry);
    }
    property bool toolsExpanded: false
    property var workspaceNames: []
    property string workspaceName: ""
    property string buildStatus: ""
    property bool updateAvailable: false
    property bool confirmUpdate: false
    property bool batchSkin: true
    property bool opened: false
    property bool popoutSwitchClosing: false
    property var devices: []
    property string query: ""
    property string category: ""
    property bool customExpanded: false
    property string customWidth: "390"
    property string customHeight: "844"
    property string customDpr: "2"
    property bool customMobile: true
    property string website: "https://omarchy.org"
    property bool landscape: false
    property bool deviceFrame: true
    property bool independentBrowser: setting("nativePreviews", false)
    property bool legacyController: false
    property bool linked: false
    property bool pendingLinked: false
    property bool launchReplyReceived: false
    property bool linkReplyReceived: false
    readonly property string helperName: independentBrowser || deviceFrame ? "viewport.mjs" : "native-preview.mjs"
    property string selectedId: ""
    property string status: "Choose a device to open a browser preview."
    property string launchError: ""
    readonly property bool busy: launcher.running || linkUpdater.running || workspaceRunner.running
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
                && (!category || device.group === category)
                && (!needle || (device.name + " " + device.group + " " + device.width + "x" + device.height).toLowerCase().indexOf(needle) >= 0);
        });
    }
    function open() { opened = true; refreshLinked(); }
    function close() { opened = false; }
    function closeForPopoutSwitch() {
        popoutSwitchClosing = true;
        close();
        Qt.callLater(function() { root.popoutSwitchClosing = false; });
    }
    function launchCustom() {
        var width = Number(customWidth), height = Number(customHeight), dpr = Number(customDpr);
        if (!isFinite(width) || width < 100 || width > 3840 || Math.floor(width) !== width
            || !isFinite(height) || height < 100 || height > 3840 || Math.floor(height) !== height
            || !isFinite(dpr) || dpr < 1 || dpr > 4) {
            launchError = "Use whole-pixel dimensions from 100–3840 and pixel density from 1–4.";
            return;
        }
        launch({id: "custom", name: customMobile ? "Custom phone" : "Custom desktop", width: width, height: height, dpr: dpr, mobile: customMobile});
    }
    function launch(device) {
        if (busy) return;
        if (!website.trim()) { launchError = "Enter a website address first."; return; }
        selectedId = device.id;
        launchError = "";
        status = "Opening " + device.name + "…";
        launchReplyReceived = false;
        var args = ["node", pluginDirectory + (independentBrowser && !linked ? "independent-browser.mjs" : helperName), "--device", device.id, "--url", website.trim()];
        if (device.id === "custom") {
            args.push("--width", String(device.width), "--height", String(device.height), "--dpr", String(device.dpr));
            if (device.mobile) args.push("--mobile");
        }
        if (landscape) args.push("--landscape");
        if (linked) args.push("--linked");
        launcher.command = args;
        launcher.running = true;
    }
    function refreshLinked() {
        if (busy) return;
        pendingLinked = linked;
        linkReplyReceived = false;
        launchError = "";
        linkUpdater.command = ["node", pluginDirectory + (independentBrowser ? "native-switch.mjs" : helperName), "--status"];
        linkUpdater.running = true;
    }
    function setLinked(value) {
        if (busy) return;
        pendingLinked = value;
        linkReplyReceived = false;
        launchError = "";
        linkUpdater.command = ["node", pluginDirectory + (independentBrowser ? "native-switch.mjs" : helperName), "--link", value ? "on" : "off"];
        linkUpdater.running = true;
    }
    Timer {
        interval: 1000; repeat: true; running: root.opened && root.independentBrowser && !root.legacyController
        onTriggered: {
            if (root.busy || statusPoll.running) return;
            statusPoll.command = ["node", root.pluginDirectory + "native-switch.mjs", "--status"];
            statusPoll.running = true;
        }
    }
    // Background checks must not dim controls or replace the user's status message.
    Process {
        id: statusPoll
        stdout: SplitParser {
            onRead: data => {
                if (root.busy) return;
                try {
                    var message = JSON.parse(data);
                    if (message.protocol !== undefined) root.legacyController = message.protocol < 9;
                    if (typeof message.enabled === "boolean") root.linked = message.enabled;
                } catch (error) { /* Keep the previous state on a failed background check. */ }
            }
        }
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
                    if (message.protocol !== undefined) root.legacyController = message.protocol < 9;
                    if (message.status === "ready") {
                        root.launchReplyReceived = true;
                        if (typeof message.linked === "boolean") root.linked = message.linked;
                        root.status = message.reason || "Preview is open. Choose a device to open another window.";
                    }
                } catch (error) { /* Ignore diagnostic lines. */ }
            }
        }
        stderr: SplitParser {
            onRead: data => { if (data.trim()) root.launchError = data.trim(); }
        }
        onExited: (exitCode, exitStatus) => {
            if (exitCode !== 0 && !root.launchError) root.launchError = "Browser preview could not start (exit " + exitCode + ").";
            if (exitCode !== 0) root.status = "Unable to open preview.";
            else if (!root.launchReplyReceived) root.status = "Preview is open. Choose a device to open another window.";
        }
    }
    Process {
        id: linkUpdater
        stdout: SplitParser {
            onRead: data => {
                try {
                    var message = JSON.parse(data);
                    if (message.protocol !== undefined) root.legacyController = message.protocol < 9;
                    var enabled = typeof message.enabled === "boolean" ? message.enabled : message.linked;
                    if (typeof enabled === "boolean") {
                        root.pendingLinked = enabled;
                        root.linkReplyReceived = true;
                        root.status = message.reason || (enabled ? "Previews linked: navigation, clicks, typing and scrolling sync." : "Previews unlinked. Each window works independently.");
                    }
                } catch (error) { /* Ignore diagnostic lines. */ }
            }
        }
        stderr: SplitParser {
            onRead: data => { if (data.trim()) root.launchError = data.trim(); }
        }
        onExited: (exitCode, exitStatus) => {
            if (exitCode === 0 && root.linkReplyReceived) {
                root.linked = root.pendingLinked;
            } else if (exitCode === 0) {
                root.launchError = "Could not read the current linking state.";
            } else if (!root.launchError) {
                root.launchError = "Could not update linked previews (exit " + exitCode + ").";
            }
        }
    }
    function workspaceAction(args) {
        if (busy) return;
        if (independentBrowser) { launchError = "Workspace tools currently support WebRTC previews only. Turn off native previews to use them."; return; }
        launchError = "";
        workspaceRunner.command = ["node", pluginDirectory + "workspaces.mjs"].concat(args);
        workspaceRunner.running = true;
    }
    Process {
        id: workspaceRunner
        stdout: SplitParser {
            onRead: data => {
                try {
                    var message = JSON.parse(data);
                    if (message.protocol !== undefined) root.legacyController = message.protocol < 9;
                    if (message.names) root.workspaceNames = message.names;
                    if (message.message) root.status = message.message;
                    if (message.status === "build") {
                        root.buildStatus = "Installed: " + message.installed + " · Running: " + message.running;
                        root.updateAvailable = message.updateAvailable;
                    }
                } catch (error) { /* Ignore diagnostic lines. */ }
            }
        }
        stderr: SplitParser { onRead: data => { if (data.trim()) root.launchError = data.trim(); } }
        onExited: (exitCode, exitStatus) => {
            root.confirmUpdate = false;
            if (exitCode !== 0 && !root.launchError) root.launchError = "ScreenHop could not complete that action.";
        }
    }
    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight
    WidgetButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: root.showBarText ? "󰆊 ScreenHop" : "󰆊"
        tooltipText: "ScreenHop"
        Accessible.name: "ScreenHop"
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
                Label { text: "ScreenHop"; font.bold: true; font.pixelSize: Style.font.body * 1.4; width: parent.width - dismiss.width - barTextButton.width - parent.spacing * 2; anchors.verticalCenter: parent.verticalCenter }
                spacing: Style.space(8)
                Button {
                    id: barTextButton
                    text: "Bar text"
                    selected: root.showBarText
                    bordered: true
                    focusable: true
                    Accessible.name: root.showBarText ? "Hide ScreenHop text in the bar" : "Show ScreenHop text in the bar"
                    onClicked: root.setBarText(!root.showBarText)
                }
                Button { id: dismiss; text: "Close"; focusable: true; onClicked: root.close() }
            }
            Label { width: parent.width; text: "YOUR WEBSITE, ON EVERY SCREEN"; font.pixelSize: Style.font.bodySmall; opacity: 0.65 }
            TextField {
                width: parent.width
                text: root.website
                placeholderText: "https://omarchy.org"
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
                    text: root.independentBrowser ? "● Native previews (experimental)" : "Native previews (experimental)"
                    selected: root.independentBrowser
                    bordered: true
                    focusable: true
                    enabled: !root.busy
                    onClicked: root.independentBrowser = !root.independentBrowser
                }
            }
            Label {
                width: parent.width
                visible: root.independentBrowser
                text: "Unlinked previews use system Chromium directly inside device skins. Link previews switches to WebRTC after confirmation. Pages reopen; unsaved state and sign-in sessions cannot transfer."
                wrapMode: Text.WordWrap
                font.pixelSize: Style.font.bodySmall
            }
            Row {
                width: parent.width
                spacing: Style.space(8)
                Button {
                    id: frameButton
                    text: root.deviceFrame ? "✓ Device frame" : "Device frame"
                    selected: root.deviceFrame
                    bordered: true
                    focusable: true
                    enabled: !root.busy && !root.independentBrowser
                    onClicked: {
                        root.deviceFrame = !root.deviceFrame;
                        root.refreshLinked();
                    }
                }
                Label {
                    width: parent.width - frameButton.width - parent.spacing
                    anchors.verticalCenter: parent.verticalCenter
                    text: root.independentBrowser ? "Skins are controlled inside native previews" : root.deviceFrame ? "Framed device preview" : "Direct browser window"
                    font.pixelSize: Style.font.bodySmall
                    opacity: 0.65
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
                    Button {
                        text: root.independentBrowser ? "Workspace tools require WebRTC previews" : root.toolsExpanded ? "− Workspace and tools" : "+ Workspace and tools"
                        bordered: true; focusable: true;
                        enabled: !root.busy && !root.independentBrowser
                        onClicked: { root.toolsExpanded = !root.toolsExpanded; if (root.toolsExpanded) root.workspaceAction(["--list"]); }
                    }
                    Column {
                        visible: root.toolsExpanded && !root.independentBrowser
                        width: parent.width
                        spacing: Style.space(8)
                        Label { width: parent.width; text: "Save your open framed previews, or reopen a saved device set. URLs and device choices are saved; sign-in sessions are not exported."; font.pixelSize: Style.font.bodySmall }
                        Row {
                            width: parent.width; spacing: Style.space(6)
                            TextField { width: parent.width - saveWorkspaceButton.width - parent.spacing; placeholderText: "Workspace name"; Accessible.name: "Workspace name"; text: root.workspaceName; onTextEdited: root.workspaceName = text; enabled: !root.busy }
                            Button { id: saveWorkspaceButton; text: "Save open previews"; bordered: true; focusable: true; enabled: !root.busy && root.deviceFrame && root.workspaceName.trim().length > 0; onClicked: root.workspaceAction(["--save", root.workspaceName]) }
                        }
                        Flow {
                            width: parent.width; spacing: Style.space(6)
                            Repeater {
                                model: root.workspaceNames
                                delegate: Button { required property string modelData; text: "Open " + modelData; bordered: true; focusable: true; enabled: !root.busy; onClicked: { root.deviceFrame = true; root.workspaceAction(["--restore", modelData]); } }
                            }
                        }
                        Row {
                            spacing: Style.space(6)
                            Button { text: root.batchSkin ? "✓ Include skin" : "Page only"; selected: root.batchSkin; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.batchSkin = !root.batchSkin }
                            Button { text: "Screenshot all"; bordered: true; focusable: true; enabled: !root.busy && root.deviceFrame; onClicked: root.workspaceAction(root.batchSkin ? ["--batch"] : ["--batch", "--page-only"]) }
                        }
                        Label { width: parent.width; text: "ScreenHop 1.0.1 · " + (root.buildStatus || "Check the running build before applying an update."); font.pixelSize: Style.font.bodySmall }
                        Row {
                            spacing: Style.space(6)
                            Button { text: "Check build"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.workspaceAction(["--status"]) }
                            Button { text: "Apply update…"; visible: root.updateAvailable; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.confirmUpdate = true }
                        }
                        Column {
                            visible: root.confirmUpdate; width: parent.width; spacing: Style.space(6)
                            Label { width: parent.width; text: "This closes and reopens all framed previews. Unsaved page changes will be lost. Device choices and URLs are restored; linking starts off. Finish signing in first."; font.pixelSize: Style.font.bodySmall }
                            Row {
                                spacing: Style.space(6)
                                Button { text: "Close previews and update"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.workspaceAction(["--apply-update", "--confirm-close"]) }
                                Button { text: "Cancel"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.confirmUpdate = false }
                            }
                        }
                    }
                    Flow {
                        width: parent.width
                        spacing: Style.space(6)
                        Repeater {
                            model: [""].concat(root.groups)
                            delegate: Button {
                                required property string modelData
                                text: modelData || "All devices"
                                selected: root.category === modelData
                                bordered: true
                                focusable: true
                                onClicked: { root.category = modelData; scroll.contentY = 0; }
                            }
                        }
                    }
                    Button {
                        text: root.customExpanded ? "− Custom size" : "+ Custom size"
                        selected: root.customExpanded
                        bordered: true
                        focusable: true
                        onClicked: root.customExpanded = !root.customExpanded
                    }
                    Column {
                        visible: root.customExpanded
                        width: parent.width
                        spacing: Style.space(8)
                        Label { width: parent.width; text: "Viewport width × height in CSS pixels; density controls the pixel ratio."; font.pixelSize: Style.font.bodySmall }
                        Row {
                            width: parent.width
                            spacing: Style.space(8)
                            TextField {
                                width: (parent.width - 2 * parent.spacing) / 3
                                text: root.customWidth
                                placeholderText: "Width"
                                Accessible.name: "Custom width in CSS pixels"
                                onTextEdited: root.customWidth = text
                            }
                            TextField {
                                width: (parent.width - 2 * parent.spacing) / 3
                                text: root.customHeight
                                placeholderText: "Height"
                                Accessible.name: "Custom height in CSS pixels"
                                onTextEdited: root.customHeight = text
                            }
                            TextField {
                                width: (parent.width - 2 * parent.spacing) / 3
                                text: root.customDpr
                                placeholderText: "Density"
                                Accessible.name: "Custom pixel density"
                                onTextEdited: root.customDpr = text
                            }
                        }
                        Row {
                            spacing: Style.space(8)
                            Button {
                                text: root.customMobile ? "Phone / touch" : "Desktop"
                                selected: root.customMobile
                                bordered: true
                                focusable: true
                                onClicked: root.customMobile = !root.customMobile
                            }
                            Button {
                                text: "Open custom preview"
                                bordered: true
                                focusable: true
                                enabled: !root.busy
                                onClicked: root.launchCustom()
                            }
                        }
                    }
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
