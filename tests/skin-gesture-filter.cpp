#include "../native/skin-gesture-filter.h"
#include <cassert>
int main() {
 QPointingDevice device("test",1,QInputDevice::DeviceType::TouchPad,QPointingDevice::PointerType::Finger,QInputDevice::Capability::Position,2,0);
 SkinGestureFilter filter;
 QNativeGestureEvent pinch(Qt::ZoomNativeGesture,&device,2,{},{},{},0.25,{});
 assert(filter.eventFilter(nullptr,&pinch));
 QNativeGestureEvent pan(Qt::PanNativeGesture,&device,2,{},{},{},0.0,{1,2});
 assert(!filter.eventFilter(nullptr,&pan));
 QEvent wheel(QEvent::Wheel), key(QEvent::KeyPress);
 assert(!filter.eventFilter(nullptr,&wheel));
 assert(!filter.eventFilter(nullptr,&key));
}
