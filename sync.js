// Installed in a private DevTools world, separate from the website's JavaScript.
(() => {
  if (globalThis.__screenhopInstalled) return;
  globalThis.__screenhopInstalled = true;
  let mutedUntil = 0;
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
    if (event.isTrusted && Date.now() >= mutedUntil) globalThis.screenhopEvent(JSON.stringify({...data, origin:location.origin}));
  };
  document.addEventListener('click', event => {
    const element = event.target.closest('button,a,input,select,textarea,[role="button"]');
    if (!element || element.matches('input[type="password"],input[type="file"]')) return;
    const selector = key(element);
    if (selector) send(event, {kind:'click',selector});
  }, true);
  document.addEventListener('input', event => {
    const element = event.target;
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
    if (location.origin !== data.origin) return false;
    mutedUntil = Date.now() + 500;
    if (data.kind === 'scroll') {
      scrollTo(data.x * Math.max(0,document.documentElement.scrollWidth-innerWidth),data.y * Math.max(0,document.documentElement.scrollHeight-innerHeight));
      return true;
    }
    const element = document.querySelector(data.selector);
    if (!element || !element.getClientRects().length || element.disabled) return false;
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
