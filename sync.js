// Installed in a private DevTools world, separate from the website's JavaScript.
(() => {
  if (globalThis.__screenhopInstalled) return;
  globalThis.__screenhopInstalled = true;
  let mutedUntil = 0;
  let authPaused = false;
// Authentication transactions belong to one preview: OAuth state, one-time codes,
// and challenge tokens must never be replayed into another browser context.
function isAuthUrl(value) {
  let url;
  try { url = new URL(value); } catch { return true; }
  if (!['http:', 'https:'].includes(url.protocol)) return true;
  if (/(?:^|\.)(?:accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|auth0\.com|okta\.com|oktapreview\.com)$/.test(url.hostname)) return true;
  const path = decodeURIComponentSafe(url.pathname).toLowerCase();
  if (/(?:^|\/)(?:oauth2?|oidc|connect|authorize|authorization|token|auth|authenticate|authentication|login|log-in|signin|sign-in|signout|sign-out|logout|log-out|sso|callback|callback-oidc|signin-oidc|signout-callback-oidc|account|accounts|identity|identityserver|challenge|mfa|otp|verify|verification|recover|recovery|reset-password)(?:[/._-]|$)/i.test(path)) return true;
  if (/\/cdn-cgi\//i.test(path) || /(?:^|\.)(?:challenges\.cloudflare\.com)$/i.test(url.hostname)) return true;
  const sensitive = /^(?:code|state|redirect_uri|response_type|response_mode|nonce|client_id|code_challenge|code_verifier|id_token|access_token|session_state|oauth_token|oauth_verifier|samlrequest|samlresponse|relaystate|returnurl|return_url|__cf.*|cf_chl.*)$/i;
  const fragment = new URLSearchParams(url.hash.slice(1).replace(/^.*?\?/, ''));
  return [...url.searchParams.keys(), ...fragment.keys()].some(key => sensitive.test(key));
}

function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function canSyncNavigation(sourcePreviousUrl, nextUrl) {
  if (isAuthUrl(sourcePreviousUrl) || isAuthUrl(nextUrl)) return false;
  try { return new URL(sourcePreviousUrl).origin === new URL(nextUrl).origin; }
  catch { return false; }
}

  const pauseAuth = reason => {
    if (authPaused) return;
    authPaused = true;
    globalThis.screenhopEvent(JSON.stringify({kind:'auth',reason,origin:location.origin}));
  };
  const authFields = 'input[type="password"],input[autocomplete="one-time-code"],input[autocomplete="username"],input[autocomplete="current-password"],input[autocomplete="new-password"],input[name="otp"],input[name="verification_code"]';
  const authText = /\b(?:log[ -]?in|sign[ -]?in|sign[ -]?out|log[ -]?out|authenticate|one[ -]time|verification|password|continue with|sign up|register)\b/i;
  const authAction = element => element.matches(authFields) ||
    (element.closest('form') && (element.closest('form').querySelector(authFields) || authText.test(element.closest('form').getAttribute('action') || ''))) ||
    (element.matches('a[href]') && isAuthUrl(element.href)) ||
    authText.test([element.textContent,element.getAttribute('aria-label'),element.value].filter(Boolean).join(' '));
  const submitAction = element => !!element.form &&
    (element.matches('button:not([type]),button[type="submit"]') || element.matches('input[type="submit"],input[type="image"]'));
  const detectAuthPage = () => {
    if (isAuthUrl(location.href)) pauseAuth('Authentication or challenge URL');
    else if (document.querySelector(authFields)) pauseAuth('Login or verification form');
    else if (document.querySelector('iframe[src*="challenges.cloudflare.com"],.cf-turnstile,#challenge-form')) pauseAuth('Browser verification challenge');
  };
  detectAuthPage();
  new MutationObserver(detectAuthPage).observe(document,{childList:true,subtree:true});
  addEventListener('hashchange',detectAuthPage);
  addEventListener('popstate',detectAuthPage);

  const key = element => {
    if (!(element instanceof Element)) return null;
    for (const attr of ['data-testid','id','name','aria-label']) {
      const value = element.getAttribute(attr);
      if (value) {
        const selector = element.tagName.toLowerCase() + '[' + attr + '=' + JSON.stringify(value) + ']';
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
    }
    if (element.matches('a[href]')) {
      const selector = 'a[href=' + JSON.stringify(element.getAttribute('href')) + ']';
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    return null;
  };
  const send = (event, data) => {
    if (!authPaused && event.isTrusted && Date.now() >= mutedUntil) globalThis.screenhopEvent(JSON.stringify({...data, origin:location.origin}));
  };
  document.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target.closest('button,a,input,select,textarea,[role="button"]') : null;
    if (!element || !event.isTrusted || authPaused) return;
    if (authAction(element)) { pauseAuth('Authentication action'); return; }
    if (submitAction(element) || element.matches('input[type="password"],input[type="file"]')) return;
    if (element.matches('a[href]')) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || element.hasAttribute('download') || (element.target && element.target !== '_self')) return;
      if (canSyncNavigation(location.href,element.href)) send(event,{kind:'navigate',url:element.href});
      return;
    }
    const selector = key(element);
    if (selector) send(event, {kind:'click',selector});
  }, true);
  document.addEventListener('submit', event => {
    if (event.isTrusted && (event.target.querySelector(authFields) || authText.test(event.target.action || ''))) pauseAuth('Login form submission');
  }, true);
  document.addEventListener('input', event => {
    const element = event.target;
    if (!(element instanceof Element)) return;
    if (event.isTrusted && authAction(element)) { pauseAuth('Authentication input'); return; }
    if (!element.matches('input,textarea,select') || element.matches('[type="password"],[type="file"],[type="hidden"]')) return;
    const selector = key(element);
    if (selector) send(event, {kind:'input',selector,value:element.value,checked:element.checked});
  }, true);
  let scrollTimer;
  document.addEventListener('scroll', event => {
    if (event.target !== document || Date.now() < mutedUntil) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => send(event, {kind:'scroll',x:scrollX / Math.max(1,document.documentElement.scrollWidth-innerWidth),y:scrollY / Math.max(1,document.documentElement.scrollHeight-innerHeight)}), 80);
  }, true);
  globalThis.screenhopApply = data => {
    detectAuthPage();
    if (authPaused || location.origin !== data.origin) return false;
    mutedUntil = Date.now() + 500;
    if (data.kind === 'scroll') {
      scrollTo(data.x * Math.max(0,document.documentElement.scrollWidth-innerWidth),data.y * Math.max(0,document.documentElement.scrollHeight-innerHeight));
      return true;
    }
    const element = document.querySelector(data.selector);
    if (!element || !element.getClientRects().length || element.disabled) return false;
    if (authAction(element) || submitAction(element) || element.matches('a[href]')) return false;
    if (data.kind === 'click') { element.click(); return true; }
    if (data.kind === 'input' && element.matches('input,textarea,select') && !element.matches('[type="password"],[type="file"],[type="hidden"]')) {
      const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(element,data.value);
      if (element.matches('[type="checkbox"],[type="radio"]')) element.checked = !!data.checked;
      element.dispatchEvent(new Event('input',{bubbles:true}));
      element.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    return false;
  };
})();
