import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
    id: root
    moduleName: "arkane.screenhop"
    Component.onCompleted: console.info("ScreenHop 1.0.0 widget loaded:", pluginDirectory, "initial URL:", website)
    property bool toolsExpanded: false
    property var workspaceNames: []
    property string workspaceName: ""
    property string buildStatus: ""
    property bool updateAvailable: false
    property bool confirmUpdate: false
    property bool batchSkin: true
    property int phoneViewers: 0
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
    property bool phoneEnabled: false
    property string phoneUrl: ""
    property string phoneQrData: ""
    property string phoneReason: ""
    property bool phoneReplyReceived: false
    property bool phoneFirewallPending: false
    property bool firewallReplyReceived: false
    property bool firewallRetry: true
    property string firewallMessage: ""
    property bool linked: false
    property bool pendingLinked: false
    property bool launchReplyReceived: false
    property bool linkReplyReceived: false
    readonly property string helperName: deviceFrame ? "viewport.mjs" : "native-preview.mjs"
    property string selectedId: ""
    property string status: "Choose a device to open a browser preview."
    property string launchError: ""
    readonly property bool busy: launcher.running || linkUpdater.running || phoneUpdater.running || phoneFirewall.running || workspaceRunner.running
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
    function open() { opened = true; refreshLinked(); refreshPhone(); }
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
        var args = ["node", pluginDirectory + helperName, "--device", device.id, "--url", website.trim()];
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
        linkUpdater.command = ["node", pluginDirectory + helperName, "--status"];
        linkUpdater.running = true;
    }
    function setLinked(value) {
        if (busy) return;
        pendingLinked = value;
        linkReplyReceived = false;
        launchError = "";
        linkUpdater.command = ["node", pluginDirectory + helperName, "--link", value ? "on" : "off"];
        linkUpdater.running = true;
    }
    function refreshPhone() {
        if (phoneUpdater.running) return;
        phoneReplyReceived = false;
        phoneFirewallPending = false;
        phoneUpdater.command = ["node", pluginDirectory + "viewport.mjs", "--phone-status"];
        phoneUpdater.running = true;
    }
    function setPhone(value) {
        if (busy || (value && !deviceFrame)) return;
        phoneReason = "";
        firewallMessage = "";
        firewallRetry = true;
        phoneFirewallPending = value;
        phoneReplyReceived = false;
        phoneUpdater.command = ["node", pluginDirectory + "viewport.mjs", "--phone", value ? "on" : "off"];
        phoneUpdater.running = true;
    }
    Process {
        id: phoneUpdater
        stdout: SplitParser {
            onRead: data => {
                try {
                    var message = JSON.parse(data);
                    if (message.status === "phone" && typeof message.enabled === "boolean") {
                        root.phoneReplyReceived = true;
                        root.phoneEnabled = message.enabled;
                        root.phoneUrl = message.enabled ? (message.url || "") : "";
                        root.phoneQrData = message.enabled ? (message.qrData || "") : "";
                        root.phoneReason = message.reason || "";
                        root.phoneViewers = message.connectedViewers || 0;
                    }
                } catch (error) { /* Ignore diagnostic lines. */ }
            }
        }
        stderr: SplitParser {
            onRead: data => { if (data.trim()) root.phoneReason = data.trim(); }
        }
        onExited: (exitCode, exitStatus) => {
            if ((exitCode !== 0 || !root.phoneReplyReceived) && !root.phoneReason)
                root.phoneReason = "Could not update phone sharing.";
            if (exitCode === 0 && root.phoneReplyReceived && root.phoneEnabled && root.phoneFirewallPending)
                root.allowPhoneFirewall();
            root.phoneFirewallPending = false;
        }
    }
    function allowPhoneFirewall() {
        if (!phoneEnabled || phoneFirewall.running) return;
        firewallReplyReceived = false;
        firewallMessage = "Checking Wi-Fi access. Enter your password in the system prompt if requested.";
        phoneFirewall.command = ["node", pluginDirectory + "phone-firewall.mjs"];
        phoneFirewall.running = true;
    }
    Process {
        id: phoneFirewall
        stdout: SplitParser {
            onRead: data => {
                try {
                    var message = JSON.parse(data);
                    if (typeof message.message === "string") {
                        root.firewallReplyReceived = true;
                        root.firewallMessage = message.message;
                        root.firewallRetry = message.status !== "ready" && message.status !== "inactive";
                    }
                } catch (error) { /* Ignore diagnostic lines. */ }
            }
        }
        onExited: (exitCode, exitStatus) => {
            if (!root.firewallReplyReceived) {
                root.firewallMessage = "Could not check Wi-Fi access. Use Allow Wi-Fi access to retry.";
                root.firewallRetry = true;
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
                    id: frameButton
                    text: root.deviceFrame ? "✓ Device frame" : "Device frame"
                    selected: root.deviceFrame
                    bordered: true
                    focusable: true
                    enabled: !root.busy
                    onClicked: {
                        root.deviceFrame = !root.deviceFrame;
                        root.refreshLinked();
                        root.refreshPhone();
                    }
                }
                Label {
                    width: parent.width - frameButton.width - parent.spacing
                    anchors.verticalCenter: parent.verticalCenter
                    text: root.deviceFrame ? "Framed device preview" : "Direct browser window"
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
            Row {
                width: parent.width
                spacing: Style.space(8)
                Button {
                    id: phoneButton
                    text: root.phoneEnabled ? "Stop sharing" : "Phone remote"
                    selected: root.phoneEnabled
                    bordered: true
                    focusable: true
                    enabled: !root.busy && (root.deviceFrame || root.phoneEnabled)
                    onClicked: root.setPhone(!root.phoneEnabled)
                }
                Label {
                    width: parent.width - phoneButton.width - parent.spacing
                    anchors.verticalCenter: parent.verticalCenter
                    text: root.firewallMessage || root.phoneReason || (root.deviceFrame ? "Use your phone on the same Wi-Fi." : "Phone remote requires Device frame.")
                    font.pixelSize: Style.font.bodySmall
                    opacity: 0.75
                }
            }
            Row {
                visible: root.phoneEnabled
                width: parent.width
                spacing: Style.space(12)
                Image {
                    id: phoneQr
                    visible: root.phoneQrData.length > 0
                    width: visible ? Style.space(124) : 0
                    height: width
                    source: root.phoneQrData
                    fillMode: Image.PreserveAspectFit
                    smooth: false
                    Accessible.name: "Scan to open the ScreenHop phone remote"
                }
                Column {
                    width: parent.width - (phoneQr.visible ? phoneQr.width + parent.spacing : 0)
                    spacing: Style.space(6)
                    Label {
                        width: parent.width
                        text: "Open this address on your phone, choose the lead preview, and enable linking to control the other previews."
                        font.pixelSize: Style.font.bodySmall
                    }
                    Button {
                        visible: root.firewallRetry || phoneFirewall.running
                        text: phoneFirewall.running ? "Waiting for authorization…" : "Allow Wi-Fi access"
                        bordered: true
                        focusable: true
                        enabled: !root.busy
                        onClicked: root.allowPhoneFirewall()
                    }
                    TextEdit {
                        width: parent.width
                        text: root.phoneUrl
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.bodySmall
                        readOnly: true
                        selectByMouse: true
                        wrapMode: TextEdit.WrapAnywhere
                        Accessible.name: "Phone remote address"
                    }
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
                        text: root.toolsExpanded ? "− Workspace and tools" : "+ Workspace and tools"
                        bordered: true; focusable: true; enabled: !root.busy
                        onClicked: { root.toolsExpanded = !root.toolsExpanded; if (root.toolsExpanded) root.workspaceAction(["--list"]); }
                    }
                    Column {
                        visible: root.toolsExpanded
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
                        Label { width: parent.width; text: "ScreenHop 1.0.0 · " + (root.buildStatus || "Check the running build before applying an update."); font.pixelSize: Style.font.bodySmall }
                        Row {
                            spacing: Style.space(6)
                            Button { text: "Check build"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.workspaceAction(["--status"]) }
                            Button { text: "Apply update…"; visible: root.updateAvailable; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.confirmUpdate = true }
                        }
                        Column {
                            visible: root.confirmUpdate; width: parent.width; spacing: Style.space(6)
                            Label { width: parent.width; text: "This closes and reopens all framed previews. Unsaved page changes will be lost and phone sharing will stop. Device choices and URLs are restored; linking starts off. Finish signing in first."; font.pixelSize: Style.font.bodySmall }
                            Row {
                                spacing: Style.space(6)
                                Button { text: "Close previews and update"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.workspaceAction(["--apply-update", "--confirm-close"]) }
                                Button { text: "Cancel"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.confirmUpdate = false }
                            }
                        }
                        Label { width: parent.width; text: "Phone: " + (root.phoneEnabled ? root.phoneViewers + " connected preview viewer(s). Keep both devices on the same network; guest Wi-Fi isolation can block access." : "Sharing is off."); font.pixelSize: Style.font.bodySmall }
                        Button { text: "Refresh phone status"; bordered: true; focusable: true; enabled: !root.busy; onClicked: root.refreshPhone() }
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
