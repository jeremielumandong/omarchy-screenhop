import {isAuthUrl,canSyncNavigation} from './sync-policy.mjs';

// Synchronize user intent, never an OAuth redirect chain or a replayed callback.
export class LinkedPreviews {
  constructor({connection,sessions,contexts,muted,state}) {
    Object.assign(this,{connection,sessions,contexts,muted,state});
    this.enabled=false;this.reason='';this.auth=new Set();this.urls=new Map();this.pending=new Map();this.queue=Promise.resolve();this.generation=0;
  }
  setEnabled(value) {
    if(value&&this.auth.size){this.pause('Linking is paused while a preview is signing in.');return;}
    this.enabled=!!value;this.reason='';this.generation++;this.pending.clear();this.state(this.enabled,this.reason);
  }
  pause(reason) { this.enabled=false;this.reason=reason;this.generation++;this.pending.clear();this.state(false,reason); }
  remove(session) {this.auth.delete(session);this.urls.delete(session);this.pending.delete(session);this.contexts.delete(session);this.muted.delete(session);}
  reset() {this.auth.clear();this.urls.clear();this.pending.clear();this.generation++;}
  handle(event) {
    const session=event.sessionId;
    if(![...this.sessions.values()].includes(session))return;
    if(event.method==='Runtime.executionContextCreated'&&event.params.context.name==='screenhop')this.contexts.set(session,event.params.context.id);
    if(event.method==='Runtime.executionContextsCleared')this.contexts.delete(session);
    const navigation=(event.method==='Page.frameNavigated'&&!event.params.frame.parentId)||event.method==='Page.navigatedWithinDocument';
    if(navigation) {
      const url=event.params.frame?.url||event.params.url;
      this.urls.set(session,url);
      const contextId=this.contexts.get(session);
      if(contextId)this.connection().send('Runtime.evaluate',{expression:'globalThis.screenhopCheckAuth?.()',contextId},session).catch(()=>{});
      if(isAuthUrl(url)&&url!=='about:blank') {
        this.auth.add(session);this.pause('Linking paused for sign-in or a security challenge. Complete it in this preview only.');return;
      }
      this.auth.delete(session);
      // An unqualified click only authorizes a same-document SPA route change.
      // It must never lend intent to a later full-page redirect or script navigation.
      if(event.method==='Page.frameNavigated'&&!this.pending.get(session)?.url)this.pending.delete(session);
      const intent=this.pending.get(session);
      if(intent&&!canSyncNavigation(intent.origin,url)) {this.pause('External navigation stays in this preview.');return;}
      if(event.method==='Page.navigatedWithinDocument')this.finishNavigation(session);
    }
    if(event.method==='Page.loadEventFired') {this.muted.set(session,Date.now()+100);this.finishNavigation(session);}
    if(event.method!=='Runtime.bindingCalled'||event.params.name!=='screenhopEvent'||this.contexts.get(session)!==event.params.executionContextId)return;
    let data;try{data=JSON.parse(event.params.payload)}catch{return}
    if(data.kind==='auth-clear') {this.auth.delete(session);return;}
    if(data.kind==='auth') {this.auth.add(session);this.pause('Linking paused for sign-in, verification, or a security challenge. Complete it in this preview only.');return;}
    if(!this.enabled||Date.now()<(this.muted.get(session)||0))return;
    if(JSON.stringify(data).length>10000)return;
    if(data.kind==='gesture') {
      const origin=this.urls.get(session);
      if(!isAuthUrl(origin))this.pending.set(session,{origin,started:Date.now()});
      return;
    }
    if(data.kind==='navigate') {
      if(!canSyncNavigation(this.urls.get(session),data.url)){this.pause('Sign-in and external navigation stay in this preview.');return;}
      this.pending.set(session,{url:data.url,origin:this.urls.get(session),started:Date.now()});return;
    }
    if(!['click','input','scroll'].includes(data.kind))return;
    const generation=this.generation;
    this.queue=this.queue.then(async()=>{
      for(const destination of this.sessions.values()) {
        if(!this.enabled||this.generation!==generation)return;
        if(destination===session||!this.contexts.has(destination)||this.auth.has(destination))continue;
        this.muted.set(destination,Date.now()+500);
        await this.connection().send('Runtime.evaluate',{expression:'globalThis.screenhopApply('+JSON.stringify(data)+')',contextId:this.contexts.get(destination)},destination).catch(()=>{});
      }
    }).catch(()=>{});
  }
  finishNavigation(session) {
    const intent=this.pending.get(session);if(!intent)return;
    const generation=this.generation;
    setTimeout(()=>{
      if(!this.enabled||this.generation!==generation||this.pending.get(session)!==intent)return;
      if(Date.now()-intent.started>(intent.url?10000:2500)){this.pending.delete(session);return;}
      this.pending.delete(session);
      const url=this.urls.get(session);
      if(!canSyncNavigation(intent.origin,url)||url===intent.origin)return;
      this.queue=this.queue.then(async()=>{
        for(const destination of this.sessions.values()) {
          if(!this.enabled||this.generation!==generation)return;
          if(destination===session||this.auth.has(destination)||!canSyncNavigation(this.urls.get(destination),url))continue;
          this.muted.set(destination,Date.now()+10000);
          await this.connection().send('Page.navigate',{url},destination).catch(()=>{});
        }
      }).catch(()=>{});
    },200);
  }
}
