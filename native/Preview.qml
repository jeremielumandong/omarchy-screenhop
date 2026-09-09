import QtQuick
import QtQuick.Controls
import QtQuick.Window
import QtWebEngine
ApplicationWindow {
 id: root
 width: Math.min(1100, Number(bridge.config.width)+160); height: 930
 visible: true; color: "#202124"; title: "ScreenHop · " + bridge.config.name + " · Native"
 property var panel: ({x:0,y:0,width:0,height:0})
 property bool frameVisible: true
 property bool skinReady: false
 property bool measuring: false
 property string failure: ""
 function geometry() {
  if (!skinReady || measuring) return;
  measuring = true;
  skin.runJavaScript("fit();(()=>{const r=document.getElementById('screen').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()", function(r){root.measuring=false;if(r && r.width>0 && JSON.stringify(r)!==JSON.stringify(root.panel)){root.panel=r;bridge.placeBrowser(r);}});
 }
 onWidthChanged: layoutTimer.restart()
 onHeightChanged: layoutTimer.restart()
 // Skin assets and zoom resets can settle after the window resize signal.
 Timer {interval:100;repeat:true;running:root.skinReady;onTriggered:root.geometry()}
 Timer {id: layoutTimer;interval:80;onTriggered:root.geometry()}
 WebEngineView {
  id: skin; anchors.fill:parent
  // The skin supplies geometry to the native child. Never zoom it independently.
  zoomFactor: 1
  onZoomFactorChanged: if (zoomFactor !== 1) zoomFactor = 1
  Keys.onPressed: function(event) {
   if ((event.modifiers & Qt.ControlModifier) && [Qt.Key_Plus, Qt.Key_Equal, Qt.Key_Minus, Qt.Key_0].indexOf(event.key) >= 0) event.accepted = true;
  }
  MouseArea {
   anchors.fill: parent
   acceptedButtons: Qt.NoButton
   onWheel: function(wheel) { wheel.accepted = !!(wheel.modifiers & Qt.ControlModifier); }
  }
  profile: WebEngineProfile {offTheRecord:true}
  settings.localContentCanAccessRemoteUrls:false
  settings.localContentCanAccessFileUrls:true
  Component.onCompleted: loadHtml(bridge.markup,"file://"+bridge.folder+"/")
  onLoadingChanged: function(info){if(info.status===WebEngineView.LoadSucceededStatus){root.skinReady=true;root.geometry();}}
 }
 Button {id:toolsButton;text:"···";anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:14;onClicked:tools.visible=!tools.visible}
 Popup {
  id:tools;popupType:Popup.Window;x:root.width-width-12;y:root.height-height-50;width:315;height:controls.implicitHeight+24
  background:Rectangle{color:"#292c34";radius:12;border.color:"#50545f"}
  Column {id:controls;anchors.fill:parent;anchors.margins:12;spacing:8
   Label {text:"Independent browser";color:"#e8e9ed"}
   Row {spacing:8;Button{text:"Back";onClicked:bridge.browserAction("back")} Button{text:"Forward";onClicked:bridge.browserAction("forward")} Button{text:"Reload";onClicked:bridge.browserAction("reload")}}
   Button {text:"Link previews";onClicked:confirm.open()}
   Button {text:root.frameVisible?"Hide device frame":"Show device frame";onClicked:{root.frameVisible=!root.frameVisible;skin.runJavaScript("showFrame="+root.frameVisible+";updateFrame()",function(){root.geometry();});}}
   ComboBox {
    visible:bridge.config.skinAsset !== undefined
    model:bridge.config.skinAsset ? bridge.config.skinAsset.colors : []
    textRole:"name"
    onActivated:function(index){skin.runJavaScript("document.getElementById('skin-color').value="+JSON.stringify(model[index].file)+";document.getElementById('skin-color').dispatchEvent(new Event('change'))");}
   }
   Label {width:260;wrapMode:Text.WordWrap;text:Number(bridge.config.width)+" × "+Number(bridge.config.height)+" CSS px · direct rendering";color:"#b0b4c0"}
   Label {width:260;wrapMode:Text.WordWrap;text:root.failure;color:"#ffb0b0";visible:text.length>0}
  }
 }
 Dialog {
  id:confirm;popupType:Popup.Window;title:"Switch to linked previews?";modal:true;anchors.centerIn:parent;width:Math.min(440,root.width-30)
  standardButtons:Dialog.Ok|Dialog.Cancel
  Label {width:parent.width;wrapMode:Text.WordWrap;text:"All open native previews will reopen in the WebRTC renderer. Unsaved changes and sign-in sessions cannot transfer between renderers. Your native sign-in stays saved for next time."}
  onAccepted:bridge.switchLinked()
 }
 Connections {
  target:bridge
  function onConfirmLink(){confirm.open();root.raise();root.requestActivate();}
  function onSwitchError(message){root.failure=message;tools.visible=true;}

 }
}
