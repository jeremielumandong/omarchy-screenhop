#include <QGuiApplication>
#include "skin-gesture-filter.h"
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QtWebEngineQuick>
#include <QLocalServer>
#include <QLocalSocket>
#include <QFile>
#include <QDir>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QTimer>
#include <QUuid>
#include <QQuickWindow>
#include <QLockFile>
#include <memory>
#include <QPointer>
#include <QScreen>
#include <QPixmap>
#include <X11/Xlib.h>
#include <X11/Xatom.h>
class Bridge: public QObject {
 Q_OBJECT
 Q_PROPERTY(QVariantMap config MEMBER config CONSTANT)
 Q_PROPERTY(QString markup MEMBER markup CONSTANT)
 Q_PROPERTY(QString folder MEMBER folder CONSTANT)
 Q_PROPERTY(QString profile MEMBER profile CONSTANT)
public:
 QQuickWindow *host=nullptr; Display *display=nullptr; ::Window childWindow=0; QVariantMap panel; QProcess browser;
 QVariantMap config; QString markup,folder,profile,socketPath,url; std::unique_ptr<QLockFile> profileLock; QLocalServer server; QPointer<QLocalSocket> inspection;
 Bridge(QString configPath) {
  QFile f(configPath); if(!f.open(QIODevice::ReadOnly))qFatal("Cannot read native preview configuration");
  auto data=QJsonDocument::fromJson(f.readAll()).object(); config=data["device"].toObject().toVariantMap();folder=data["folder"].toString();profile=data["profile"].toString();
  QFile html(data["html"].toString());if(!html.open(QIODevice::ReadOnly))qFatal("Cannot read skin document");markup=QString::fromUtf8(html.readAll());
  profileLock=std::make_unique<QLockFile>(profile+"/instance.lock");if(!profileLock->tryLock())qFatal("Native profile is already in use");url=config["url"].toString();socketPath=data["socket"].toString();server.setSocketOptions(QLocalServer::UserAccessOption);
  if(!server.listen(socketPath))qFatal("Cannot listen on native preview socket");
  connect(&server,&QLocalServer::newConnection,this,[this]{auto s=server.nextPendingConnection();s->setReadBufferSize(65536);connect(s,&QLocalSocket::disconnected,s,&QObject::deleteLater);
   QTimer::singleShot(5000,s,[s]{s->disconnectFromServer();});
   connect(s,&QLocalSocket::readyRead,this,[this,s]{if(!s->canReadLine())return;auto obj=QJsonDocument::fromJson(s->readLine()).object();auto action=obj["action"].toString();
    if(action=="geometry"){auto value=QJsonObject::fromVariantMap(panel);value["dpr"]=host?host->devicePixelRatio():1;value["child"]=QString::number(childWindow);reply(s,value);return;}
    if(action=="embed"){reply(s,{{"embedded",embed(obj["pid"].toInt())}});return;}
    if(action=="url"){url=obj["url"].toString();reply(s,{{"status","ok"}});return;}
    if(action=="inspect"){forward(s,"inspect");return;}
    if(action=="page-screenshot"){forward(s,"page-screenshot",obj);return;}
    if(action=="resize"){host->resize(obj["width"].toInt(),obj["height"].toInt());reply(s,{{"status","ok"}});return;}
    if(action=="snapshot"){reply(s,{{"device",QJsonObject::fromVariantMap(config)},{"url",url}});return;}
    if(action=="request-link"){emit confirmLink();reply(s,{{"status","pending"}});return;}
    if(action=="close"){reply(s,{{"status","closed"}});QTimer::singleShot(100,qApp,&QCoreApplication::quit);return;}
    if(action=="screenshot"){reply(s,{{"error","Use the desktop screenshot tool for native window captures"}});return;}
    reply(s,{{"error","Unknown command"}});
   });
  });
 }
 ~Bridge(){browser.terminate();if(!browser.waitForFinished(3000))browser.kill();server.close();QFile::remove(socketPath);if(display)XCloseDisplay(display);}
 void forward(QLocalSocket *client,QString action,QJsonObject extra={}) {
  auto peer=new QLocalSocket(this);QPointer<QLocalSocket> receiver=client;
  connect(peer,&QLocalSocket::connected,peer,[peer,action,extra]()mutable{extra["action"]=action;peer->write(QJsonDocument(extra).toJson(QJsonDocument::Compact)+'\n');});
  connect(peer,&QLocalSocket::readyRead,this,[this,peer,receiver]{if(peer->canReadLine()){auto value=QJsonDocument::fromJson(peer->readLine()).object();if(receiver)reply(receiver,value);peer->disconnectFromServer();}});
  connect(peer,&QLocalSocket::errorOccurred,this,[this,peer,receiver](QLocalSocket::LocalSocketError){if(receiver)reply(receiver,{{"error","Browser is starting"}});peer->deleteLater();});
  connect(peer,&QLocalSocket::disconnected,peer,&QObject::deleteLater);
  QTimer::singleShot(5000,peer,[peer]{peer->abort();peer->deleteLater();});peer->connectToServer(socketPath+".browser");
 }
 bool embed(int pid) {
  if(!host)return false;if(!display){display=XOpenDisplay(nullptr);if(!display)return false;XSetErrorHandler([](Display*,XErrorEvent*){return 0;});}
  Atom type;int format;unsigned long count,left;unsigned char *data=nullptr;
  XGetWindowProperty(display,DefaultRootWindow(display),XInternAtom(display,"_NET_CLIENT_LIST",False),0,4096,False,XA_WINDOW,&type,&format,&count,&left,&data);
  if(data){auto windows=reinterpret_cast<::Window*>(data);for(unsigned long i=0;i<count;i++){
   unsigned char *value=nullptr;unsigned long n,rest;int fmt;Atom t;
   XGetWindowProperty(display,windows[i],XInternAtom(display,"_NET_WM_PID",False),0,1,False,XA_CARDINAL,&t,&fmt,&n,&rest,&value);
   bool match=value&&n&&*reinterpret_cast<unsigned long*>(value)==static_cast<unsigned long>(pid);if(value)XFree(value);
   if(match){unsigned char* title=nullptr;unsigned long length,remain;Atom kind;int bits;XGetWindowProperty(display,windows[i],XInternAtom(display,"_NET_WM_NAME",False),0,1024,False,AnyPropertyType,&kind,&bits,&length,&remain,&title);match=title&&QString::fromUtf8(reinterpret_cast<char*>(title),length).startsWith("ScreenHop");if(title)XFree(title);}
   if(match){childWindow=windows[i];break;}
  }XFree(data);}
  if(!childWindow)return false;
  XUnmapWindow(display,childWindow);XAddToSaveSet(display,childWindow);XReparentWindow(display,childWindow,host->winId(),0,0);XSetWindowBorderWidth(display,childWindow,0);placeBrowser(panel);XMapWindow(display,childWindow);XFlush(display);return true;
 }
 Q_INVOKABLE void placeBrowser(QVariantMap value){panel=value;if(!display||!childWindow||!host)return;double dpr=host->devicePixelRatio();XMoveResizeWindow(display,childWindow,qRound(value["x"].toDouble()*dpr),qRound(value["y"].toDouble()*dpr),qMax(1,qRound(value["width"].toDouble()*dpr)),qMax(1,qRound(value["height"].toDouble()*dpr)));XFlush(display);}
 Q_INVOKABLE void browserAction(QString action){forward(nullptr,action);}
 void startBrowser(QString configPath){browser.setProcessChannelMode(QProcess::ForwardedErrorChannel);connect(&browser,qOverload<int,QProcess::ExitStatus>(&QProcess::finished),this,[](int,QProcess::ExitStatus){QCoreApplication::quit();});browser.start("node",{folder+"/native-chromium.mjs",configPath});}
 void reply(QLocalSocket*s,QJsonObject obj){s->write(QJsonDocument(obj).toJson(QJsonDocument::Compact)+'\n');s->flush();s->disconnectFromServer();}
 Q_INVOKABLE void setUrl(QString value){url=value;}
 Q_INVOKABLE void report(QVariantMap value){if(inspection){reply(inspection,QJsonObject::fromVariantMap(value));inspection=nullptr;}}
 Q_INVOKABLE void switchLinked(){auto p=new QProcess(this);connect(p,qOverload<int,QProcess::ExitStatus>(&QProcess::finished),this,[this,p](int code,QProcess::ExitStatus){if(code)emit switchError(QString::fromUtf8(p->readAllStandardError()));p->deleteLater();});p->start("node",{folder+"/native-switch.mjs","--apply-link"});}
 signals:void inspectRequested();void confirmLink();void screenshotRequested(QString path);void switchError(QString message);
};
int main(int argc,char**argv){QCoreApplication::setAttribute(Qt::AA_ShareOpenGLContexts);QtWebEngineQuick::initialize();QGuiApplication app(argc,argv);SkinGestureFilter skinGestures;app.installEventFilter(&skinGestures);app.setApplicationName("screenhop-native");if(argc!=2)return 2;Bridge bridge(argv[1]);QQmlApplicationEngine engine;engine.rootContext()->setContextProperty("bridge",&bridge);engine.load(QUrl::fromLocalFile(bridge.folder+"/native/Preview.qml"));if(engine.rootObjects().isEmpty())return 1;auto window=qobject_cast<QQuickWindow*>(engine.rootObjects().first());bridge.host=window;bridge.startBrowser(argv[1]);QObject::connect(&bridge,&Bridge::screenshotRequested,window,[window](QString path){window->screen()->grabWindow(window->winId()).save(path);});return app.exec();}
#include "main.moc"
