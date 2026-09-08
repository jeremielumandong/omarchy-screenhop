#!/usr/bin/env node
// ScreenHop: a local controller keeps CDP attached while the preview is open.
import { readFile, mkdir, unlink, chmod } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LinkedPreviews } from './linked-previews.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const devices = JSON.parse(await readFile(join(here, 'devices.json'), 'utf8'));
const delay = ms => new Promise(r => setTimeout(r, ms));
export function normalizeUrl(input) {
  let value = String(input || '').trim();
  if (!value) throw new Error('Enter a website address.');
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#]|$)/i.test(value)) value = 'http://' + value;
    else value = 'https://' + value;
  }
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
  return url.href;
}
export function selection(request) {
  let device = devices.find(d => d.id === request.device);
  if(request.device === 'custom') {
    const width=Number(request.width),height=Number(request.height),dpr=Number(request.dpr ?? 1);
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<100||height<100||width>3840||height>3840||!Number.isFinite(dpr)||dpr<1||dpr>4)
      throw new Error('Custom size must be 100–3840 CSS pixels, with pixel ratio 1–4.');
    const mobile=request.mobile===true;
    device={id:'custom',name:mobile?'Custom phone':'Custom desktop',group:'Custom',skin:mobile?'android':'desktop',width,height,dpr,mobile};
  }
  if (!device) throw new Error('Unknown device. Choose a device from the list.');
  return { ...device, width: request.landscape ? device.height : device.width,
    height: request.landscape ? device.width : device.height, url: normalizeUrl(request.url) };
}
export class CDP {
  constructor(ws) {
    this.ws = ws; this.sequence = 0; this.pending = new Map();
    ws.addEventListener('message', e => {
      const message = JSON.parse(e.data);
      if (!message.id) { this.onEvent?.(message); return; }
      const call = this.pending.get(message.id);
      if (!call) return;
      this.pending.delete(message.id); clearTimeout(call.timer);
      if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result);
    });
    ws.addEventListener('close', () => {
      for (const call of this.pending.values()) { clearTimeout(call.timer); call.reject(new Error('Preview browser closed.')); }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('Browser connection timed out.')); }, 8000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once:true});
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Cannot connect to preview browser.')); }, {once:true});
    });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(method + ' timed out.')); }, 12000);
      this.pending.set(id, {resolve, reject, timer});
      try { this.ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})})); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
}
async function endpoint(profile) {
  try {
    const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
    if (!/^\d+$/.test(port) || !path.startsWith('/devtools/browser/')) return null;
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`, {signal:AbortSignal.timeout(600)})).json();
    if (new URL(version.webSocketDebuggerUrl).pathname !== path) return null;
    return `ws://127.0.0.1:${port}${path}`;
  } catch { return null; }
}
function browserExecutable() {
  const candidates = process.env.SCREENHOP_BROWSER ? [process.env.SCREENHOP_BROWSER] : ['chromium', 'google-chrome-stable', 'google-chrome', 'brave-browser'];
  for (const binary of candidates) {
    try { return execFileSync('which', [binary], {encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim(); } catch {}
  }
  throw new Error('Install Chromium, or set SCREENHOP_BROWSER to a Chromium-based browser executable.');
}
function hyprWindows() {
  try { return JSON.parse(execFileSync('hyprctl',['-j','clients'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1000})); }
  catch { return []; }
}
async function serve(state, headless) {
  const profile = join(state, 'browser');
  await mkdir(profile, {recursive:true, mode:0o700});
  let cdp, lastUsed = Date.now();
  const sessions = new Map();
  const contexts = new Map();
  const muted = new Map();
  let linked = false;
  const syncScript = await readFile(join(here, 'sync.js'), 'utf8');
  const linker = new LinkedPreviews({connection:()=>cdp,sessions,contexts,muted,state:(value,reason)=>{linked=value;}});
  function onEvent(event) {
    linker.handle(event);
  }
  async function preview(request) {
    const device = selection(request);
    const existingWindows = new Set(headless ? [] : hyprWindows().map(w => w.address));
    if(request.linked)linker.setEnabled(true);
    if (!cdp || cdp.ws.readyState !== WebSocket.OPEN) {
      let url = await endpoint(profile);
      if (!url) {
        const log = openSync(join(state, 'browser.log'), 'a', 0o600);
        const child = spawn(browserExecutable(), [
          `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
          '--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble',
          '--class=screenhop', '--window-size=500,850', '--no-startup-window', ...(headless ? ['--headless=new'] : [])
        ], {detached:true, stdio:['ignore',log,log]});
        closeSync(log);
        let failure;
        child.on('error', error => { failure = error; });
        child.unref();
        for (let i = 0; i < 100 && !url; i++) { if (failure) throw failure; await delay(100); url = await endpoint(profile); }
        if (!url) throw new Error('Browser did not start. See ' + join(state, 'browser.log'));
      }
      cdp = await CDP.connect(url); sessions.clear(); contexts.clear(); muted.clear(); linker.reset(); cdp.onEvent = onEvent;
    }
    const targets = await cdp.send('Target.getTargets');
    for (const id of sessions.keys()) {
      if (!targets.targetInfos.some(t => t.targetId === id)) { linker.remove(sessions.get(id)); sessions.delete(id); }
    }
    const {targetId} = await cdp.send('Target.createTarget', {url:'about:blank', newWindow:true});
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten:true});
    sessions.set(targetId, sessionId);
    muted.set(sessionId, Date.now() + 10000);
    await cdp.send('Page.enable',{},sessionId);
    await cdp.send('Runtime.enable',{},sessionId);
    await cdp.send('Runtime.addBinding',{name:'screenhopEvent',executionContextName:'screenhop'},sessionId);
    const label = 'ScreenHop · ' + device.name + ' · ' + device.width + ' × ' + device.height + ' | ';
    const titleScript = '(()=>{const prefix=' + JSON.stringify(label) + ';const update=()=>{if(!document.title.startsWith(prefix))document.title=prefix+document.title;};new MutationObserver(update).observe(document,{childList:true,subtree:true,characterData:true});update();})();';
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:syncScript+'\n'+titleScript,worldName:'screenhop'},sessionId);
    let previewAddress;
    if (!headless && process.env.HYPRLAND_INSTANCE_SIGNATURE) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const window = hyprWindows().find(w => !existingWindows.has(w.address) && /screenhop/i.test(w.class));
        if (window && /^0x[0-9a-f]+$/.test(window.address)) {
          previewAddress = window.address;
          try { execFileSync('hyprctl',['dispatch', 'hl.dsp.window.float({action="set",window="address:' + window.address + '"})'],{stdio:'pipe',timeout:2000}); }
          catch (error) { console.error('Could not float preview:',error.message); }
          await delay(100);
          break;
        }
        await delay(50);
      }
    }
    // Display scaling fits large devices on the desktop without changing their CSS viewport.
    const scale = Math.min(1, 1100 / device.width, 780 / device.height);
    const window = await cdp.send('Browser.getWindowForTarget', {targetId});
    await cdp.send('Browser.setWindowBounds', {windowId:window.windowId, bounds:{windowState:'normal'}});
    await cdp.send('Browser.setWindowBounds', {windowId:window.windowId, bounds:{width:Math.max(360, Math.ceil(device.width * scale)), height:Math.ceil(device.height * scale) + 60}});
    if (previewAddress) {
      try { execFileSync('hyprctl',['dispatch', 'hl.dsp.window.resize({window="address:' + previewAddress + '",x=' + Math.max(360,Math.ceil(device.width*scale)) + ',y=' + (Math.ceil(device.height*scale)+100) + ',relative=false})'],{stdio:'pipe',timeout:2000}); }
      catch (error) { console.error('Could not resize preview:',error.message); }
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width:device.width, height:device.height, deviceScaleFactor:device.dpr, mobile:device.mobile,
      screenWidth:device.width, screenHeight:device.height, scale,
      screenOrientation:{type:device.width > device.height ? 'landscapePrimary' : 'portraitPrimary', angle:device.width > device.height ? 90 : 0}
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', {enabled:device.mobile, maxTouchPoints:device.mobile ? 5 : 1}, sessionId);
    {
      const result = await cdp.send('Page.navigate', {url:device.url}, sessionId);
      if (result.errorText) throw new Error('Cannot load website: ' + result.errorText);

    }
    await cdp.send('Page.bringToFront', {}, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', {enabled:device.mobile, maxTouchPoints:device.mobile ? 5 : 1}, sessionId);
    muted.set(sessionId, Date.now() + 500);
    return {status:'ready', linked, reason:linker.reason, targetId, device:device.name, width:device.width, height:device.height, url:device.url};
  }
  const socket = join(state, 'controller.sock');
  // A leftover socket has no listener after a crash; an active one must never be replaced.
  try { await rpc(socket, {ping:true}); return; } catch (e) {
    if (!['ENOENT','ECONNREFUSED'].includes(e.code)) throw e;
    await unlink(socket).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
  let queue = Promise.resolve();
  const server = createServer(client => {
    client.setEncoding('utf8'); client.setTimeout(45000, () => client.destroy());
    let buffer = '';
    client.on('error', () => {});
    client.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 16384) { client.destroy(); return; }
      if (!buffer.includes('\n')) return;
      client.removeAllListeners('data');
      queue = queue.then(async () => {
        lastUsed = Date.now();
        try {
          const request = JSON.parse(buffer.split('\n')[0]);
          if (request.link !== undefined) linker.setEnabled(request.link === 'on');
          const result = request.status ? {status:'state',enabled:linked,reason:linker.reason,previewCount:sessions.size} : request.link !== undefined ? {status:'linked', enabled:linked, reason:linker.reason} : request.ping ? {status:'ok',protocol:2} : request.close ? await closePreview() : request.inspect ? await inspectPreview(request.targetId) : await preview(request);
          client.end(JSON.stringify(result) + '\n');
        } catch (error) { client.end(JSON.stringify({status:'error', error:error.message}) + '\n'); }
      });
    });
  });
  async function inspectPreview(targetId) {
    const sessionId = sessions.get(targetId);
    if (!sessionId || !cdp) throw new Error('No preview is open.');
    const result = await cdp.send('Runtime.evaluate', {
      expression:'({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,touch:navigator.maxTouchPoints,phone:matchMedia("(max-width:500px)").matches,url:location.href})', returnByValue:true
    }, sessionId);
    return result.result.value;
  }
  async function closePreview() {
    if (cdp?.ws.readyState === WebSocket.OPEN) await cdp.send('Browser.close').catch(() => {});
    return {status:'closed'};
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  await chmod(socket, 0o600);
  const idle = setInterval(() => {
    if ((!cdp || cdp.ws.readyState !== WebSocket.OPEN) && Date.now() - lastUsed > 30000) {
      clearInterval(idle); server.close(); unlink(socket).catch(() => {});
    }
  }, 5000);
}
export function rpc(socket, request) {
  return new Promise((resolve, reject) => {
    const client = createConnection(socket); let result = '';
    client.setEncoding('utf8');
    client.setTimeout(40000, () => client.destroy(new Error('Preview request timed out.')));
    client.on('connect', () => client.write(JSON.stringify(request) + '\n'));
    client.on('data', chunk => { result += chunk; if (result.includes('\n')) { client.end(); try { resolve(JSON.parse(result.split('\n')[0])); } catch (e) { reject(e); } } });
    client.on('error', reject);
    client.on('end', () => { if (!result.includes('\n')) reject(new Error('Controller closed without a response.')); });
  });
}
async function main() {
  const args = process.argv.slice(2); const opts = {};
  for (let i=0; i<args.length; i++) {
    const key = args[i];
    if (['--mobile','--landscape','--linked','--headless','--serve','--close','--list','--status'].includes(key)) opts[key.slice(2)] = true;
    else if (['--width','--height','--dpr','--device','--url','--state','--link'].includes(key) && args[i+1]) opts[key.slice(2)] = args[++i];
    else throw new Error('Usage: node viewport.mjs --device ID --url URL [--landscape] [--list]');
  }
  if (opts.list) { console.log(JSON.stringify(devices)); return; }
  if (opts.link !== undefined && !['on','off'].includes(opts.link)) throw new Error('Use --link on or --link off.');
  if (!opts.serve && !opts.close && !opts.status && opts.link === undefined) selection(opts);
  const state = resolve(opts.state || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'screenhop-native'));
  await mkdir(state, {recursive:true, mode:0o700});
  if (opts.serve) { await serve(state, opts.headless); return; }
  const socket = join(state, 'controller.sock'); let response;
  try {
    const running=await rpc(socket,{ping:true});
    if(running.protocol!==2&&!opts.close)throw new Error('ScreenHop was updated. Save your work, close all ScreenHop previews, wait 35 seconds, then reopen them to activate the update.');
    response = await rpc(socket, opts);
  } catch (error) {
    if (!['ENOENT','ECONNREFUSED'].includes(error.code)) throw error;
    if (opts.close || opts.status || opts.link !== undefined) { console.log(JSON.stringify({status:opts.close ? 'closed' : opts.status ? 'state' : 'linked', enabled:opts.link === 'on',reason:'',previewCount:0})); return; }
    const log = openSync(join(state, 'controller.log'), 'a', 0o600);
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve', '--state', state, ...(opts.headless ? ['--headless'] : [])], {detached:true, stdio:['ignore',log,log]});
    closeSync(log); child.unref();
    for (let i=0; i<60; i++) {
      await delay(100);
      try { response = await rpc(socket, opts); break; } catch(e) { if (!['ENOENT','ECONNREFUSED'].includes(e.code)) throw e; }
    }
    if (!response) throw new Error('Controller did not start. See ' + join(state, 'controller.log'));
  }
  if (response.status === 'error') throw new Error(response.error);
  console.log(JSON.stringify(response));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
