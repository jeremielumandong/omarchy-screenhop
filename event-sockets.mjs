import {WebSocketServer,createWebSocketStream} from './third_party/ws/wrapper.mjs';

// Persistent event traffic must not consume Chromium's small HTTP/1 connection
// pool. Controls remain on the existing validated JSON endpoints.
export function attachEventSockets(server,authorize) {
 const sockets=new WebSocketServer({noServer:true,perMessageDeflate:false,maxPayload:1024});
 server.on('upgrade',(req,socket,head)=>{
  let subscribe;
  try {subscribe=authorize(req);if(req.method!=='GET'||typeof subscribe!=='function')throw Error('Forbidden');}
  catch {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}
  sockets.handleUpgrade(req,socket,head,ws=>{
   const stream=createWebSocketStream(ws,{decodeStrings:false});
   stream.on('error',()=>stream.destroy());
   // The event socket is server-to-viewer only; never accept commands here.
   ws.on('message',()=>ws.close(1008,'Use the validated control endpoints'));
   try {subscribe(stream);}catch {stream.destroy();}
  });
 });
 return ()=>{for(const client of sockets.clients)client.terminate();sockets.close();};
}
