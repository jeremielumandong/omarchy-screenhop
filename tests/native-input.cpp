#include <X11/Xlib.h>
#include <X11/keysym.h>
#include <X11/extensions/XTest.h>
#include <cstdlib>
#include <unistd.h>
int main(int argc,char**argv){if(argc!=5)return 2;auto d=XOpenDisplay(nullptr);if(!d)return 3;Window w=strtoul(argv[1],nullptr,10),child;int x,y;XTranslateCoordinates(d,w,DefaultRootWindow(d),atoi(argv[2]),atoi(argv[3]),&x,&y,&child);XSetInputFocus(d,w,RevertToParent,CurrentTime);XTestFakeMotionEvent(d,-1,x,y,0);XTestFakeButtonEvent(d,1,True,0);XTestFakeButtonEvent(d,1,False,0);XFlush(d);usleep(100000);if(argv[4][0]=='a'){auto code=XKeysymToKeycode(d,XK_a);XTestFakeKeyEvent(d,code,True,0);XTestFakeKeyEvent(d,code,False,0);}else if(argv[4][0]=='s')for(int i=0;i<5;i++){XTestFakeButtonEvent(d,5,True,0);XTestFakeButtonEvent(d,5,False,0);}XFlush(d);XCloseDisplay(d);}
