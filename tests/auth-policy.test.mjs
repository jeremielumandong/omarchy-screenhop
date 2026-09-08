import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {isAuthUrl,canSyncNavigation} from '../sync-policy.mjs';

for (const url of [
  'https://identity.test/connect/authorize?client_id=app&response_type=code&code_challenge=abc',
  'https://app.test/finish?code=single-use&state=private',
  'https://app.test/#access_token=secret&id_token=jwt&state=private',
  'https://app.test/#/done?id_token=jwt',
  'https://app.test/signin-oidc',
  'https://app.test/finish?oauth_token=secret&oauth_verifier=private',
  'https://accounts.google.com/o/oauth2/v2/auth','https://accounts.google.com/ServiceLogin',
  'https://tenant.okta.com/some/custom/path','https://tenant.auth0.com/u/identifier',
  'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
  'https://tenant.auth0.com/authorize',
  'https://tenant.okta.com/oauth2/default/v1/authorize',
  'https://github.com/login/oauth/authorize',
  'https://app.test/login','https://app.test/account/signin',
  'https://app.test/mfa','https://app.test/verification','https://app.test/reset-password',
  'https://app.test/cdn-cgi/challenge-platform/h/g','https://app.test/?__cf_chl_tk=private',
  'https://challenges.cloudflare.com/turnstile/v0/abc',
  'https://app.test/%6cogin','javascript:alert(1)','invalid',
]) test(`blocks authentication navigation ${url}`, () => {
  assert.equal(isAuthUrl(url),true);
  assert.equal(canSyncNavigation('https://app.test/products',url),false);
});

test('allows same-origin ordinary navigation and fragments',()=> {
  assert.equal(canSyncNavigation('https://app.test/products','https://app.test/cart?sort=new#details'),true);
  assert.equal(canSyncNavigation('https://app.test/products','https://other.test/products'),false);
  assert.equal(canSyncNavigation('https://app.test/login','https://app.test/products'),false);
});

function harness({url='https://app.test/products',fields=false}={}) {
  const events=[]; const listeners={}; let observer;
  class Element {
    constructor({tag='button',text='',password=false,submit=false,href}={}) {Object.assign(this,{tag,textContent:text,password,submit,href,form:submit?{}:null});}
    matches(selector) {
      if (selector==='a[href]') return this.tag==='a';
      if (selector.includes('one-time-code')) return this.password;
      if (selector.includes('button:not')) return this.submit;
      if (selector.includes('password')) return this.password;
      return false;
    }
    closest(selector) {return selector==='form'?null:this;}
    getAttribute(attr) {return attr==='id'?'test':null;}
    hasAttribute() {return false;}
  }
  const document={querySelector:()=>fields?{}:null,querySelectorAll:()=>[{}],addEventListener:(name,cb)=>listeners[name]=cb};
  const context={Element,document,location:new URL(url),screenhopEvent:data=>events.push(JSON.parse(data)),MutationObserver:class {constructor(cb){observer=cb;}observe(){}},addEventListener(){},URL,URLSearchParams,Date,setTimeout,clearTimeout};
  vm.runInNewContext(readFileSync(new URL('../sync.js',import.meta.url),'utf8'),context);
  return {events,Element,click:target=>listeners.click({target,isTrusted:true,button:0}),showAuth:()=>{fields=true;observer();}};
}

test('auth detection on install and dynamic forms emits only once',()=> {
  const initial=harness({fields:true}); assert.equal(initial.events[0].kind,'auth');
  const dynamic=harness();dynamic.showAuth();dynamic.showAuth();assert.equal(dynamic.events.length,1);assert.equal(dynamic.events[0].kind,'auth');
});
test('login actions pause before mirroring and retain website event handling',()=> {
  const h=harness();h.click(new h.Element({text:'Continue with Google'}));h.click(new h.Element({text:'Cart'}));
  assert.deepEqual(h.events.map(e=>e.kind),['auth']);
});
test('submit controls never mirror; ordinary anchors emit only navigation',()=> {
  const h=harness();h.click(new h.Element({submit:true,text:'Save'}));assert.equal(h.events.length,0);
  h.click(new h.Element({tag:'a',href:'https://app.test/cart'}));
  assert.deepEqual(h.events.map(e=>e.kind),['navigate']);assert.equal(h.events[0].url,'https://app.test/cart');
});
