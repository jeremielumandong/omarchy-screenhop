import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../capture-rtc.js',import.meta.url),'utf8');
test('capture cadence aggregates receivers, preserves geometry, and releases demand',async()=>{
 const changes=[];
 let constraints={width:{ideal:390,max:390},height:{ideal:844,max:844}};
 const track={readyState:'live',getConstraints:()=>constraints,applyConstraints:async value=>{constraints=value;changes.push(value);},addEventListener(){},stop(){this.readyState='ended'}};
 class Peer {close(){} addTrack(){} async setRemoteDescription(value){this.remoteDescription=value} async createAnswer(){return{type:'answer',sdp:'fixture'}} async setLocalDescription(value){this.localDescription=value} }
 const context=vm.createContext({screenhopRTCConfig:{width:390,height:844,fps:30},screenhopRTCEvent(){},navigator:{mediaDevices:{getDisplayMedia:async()=>({getTracks:()=>[track],getVideoTracks:()=>[track]})}},RTCPeerConnection:Peer,addEventListener(){},innerWidth:390,innerHeight:844});
 vm.runInContext(source,context);
 const signal=context.screenhopRTC.signal;
 await signal({type:'offer',peerId:'desktop',sdp:'fixture'});
 await signal({type:'activity',peerId:'desktop',fps:10});assert.equal(constraints.frameRate.max,10);
 await signal({type:'offer',peerId:'phone',sdp:'fixture'});
 await signal({type:'activity',peerId:'phone',fps:30});assert.equal(constraints.frameRate.max,30);
 await signal({type:'activity',peerId:'desktop',fps:1});assert.equal(constraints.frameRate.max,30);
 await signal({type:'close',peerId:'phone'});await new Promise(r=>setImmediate(r));assert.equal(constraints.frameRate.max,1);
 await signal({type:'activity',peerId:'desktop',fps:30});assert.equal(constraints.frameRate.min,30,'interaction immediately restores minimum cadence');
 await assert.rejects(signal({type:'activity',peerId:'desktop',fps:100}),/Invalid capture cadence/);
 for(const value of changes){assert.equal(value.width.max,390);assert.equal(value.height.max,844);}
 context.screenhopRTC.close();assert.equal(track.readyState,'ended');
});
test('viewer cadence responds to inactivity, visibility, quality and recording',async()=>{
 const html=await readFile(new URL('../viewer.html',import.meta.url),'utf8');
 const body=html.slice(html.indexOf('function activityDemand()'),html.indexOf('function reportActivity('));
 const context=vm.createContext({quality:'auto',lastActivity:0,recordingActive:false,document:{hidden:false},performance:{now:()=>0}});
 vm.runInContext(body,context);
 assert.equal(context.activityDemand().fps,30);
 context.performance.now=()=>3100;assert.equal(context.activityDemand().fps,10);
 context.quality='eco';assert.equal(context.activityDemand().fps,5);
 context.document.hidden=true;assert.equal(context.activityDemand().fps,1);
 context.quality='smooth';assert.equal(context.activityDemand().fps,5);
 context.document.hidden=false;assert.equal(context.activityDemand().fps,30);
 context.quality='auto';context.document.hidden=true;assert.equal(context.activityDemand().fps,2);
 context.recordingActive=true;assert.equal(context.activityDemand().fps,30);
});
