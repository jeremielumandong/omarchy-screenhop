#pragma once
#include <QObject>
#include <QEvent>
#include <QNativeGestureEvent>

// This filter runs only in the Qt skin host, never in the website browser.
class SkinGestureFilter : public QObject {
public:
 using QObject::QObject;
 bool eventFilter(QObject *, QEvent *event) override {
  if (event->type() == QEvent::NativeGesture &&
      static_cast<QNativeGestureEvent *>(event)->gestureType() == Qt::ZoomNativeGesture) {
   event->accept();
   return true;
  }
  return false;
 }
};
