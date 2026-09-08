import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CDP, rpc, normalizeUrl, selection } from '../viewport.mjs';
const exec = promisify(execFile);
const helper = new URL('../viewport.mjs', import.meta.url).pathname;
test('URL and device validation', () => {
  assert.equal(normalizeUrl('localhost:3000/path'), 'http://localhost:3000/path');
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
  assert.throws(() => normalizeUrl('file:///etc/passwd'));
  assert.throws(() => normalizeUrl('https://user:password@example.com'));
  assert.throws(() => selection({device:'missing',url:'https://example.com'}));
  assert.equal(selection({device:'iphone-13',url:'localhost:3000',landscape:true}).width,844);
});
test('independent device windows, persistent viewports, rotation and navigation', {timeout:80000}, async () => {
  const state = await mkdtemp(join(tmpdir(), 'screenhop-browser-test-'));
  const server = createServer((req,res) => {
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScreenHop test</title><style>body{margin:0;background:#131a25;color:white;font:24px sans-serif}div{padding:24px} @media(max-width:500px){body{background:#16352c}}</style><div>ScreenHop responsive test</div><button id="count" style="position:absolute;left:20px;top:100px;width:120px;height:40px" onclick="this.textContent=String(Number(this.textContent)+1)">0</button><input id="entry" style="position:absolute;left:20px;top:160px"><div style="height:3000px"></div>');
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const run = (...args) => exec(process.execPath,[helper,'--state',state,...args],{timeout:40000});
  let cdp;
  try {
    const first = await run(...(process.env.SCREENHOP_TEST_HEADFUL ? [] : ['--headless']),'--device','iphone-13','--url',url);
    assert.equal(JSON.parse(first.stdout).status,'ready');
    const [port,path] = (await readFile(join(state,'browser','DevToolsActivePort'),'utf8')).trim().split('\n');
    cdp = await CDP.connect(`ws://127.0.0.1:${port}${path}`);
    const firstId = JSON.parse(first.stdout).targetId;
    let targetId = firstId;
    async function metrics(id = targetId) { const value = await rpc(join(state,'controller.sock'), {inspect:true, targetId:id}); value.dpr = Math.round(value.dpr * 1e6) / 1e6; return value; }
    async function launch(...args) { targetId = JSON.parse((await run(...args)).stdout).targetId; }
    await new Promise(r=>setTimeout(r,500));
    assert.deepEqual(await metrics(), {width:390,height:844,dpr:3,touch:5,phone:true,url:url+'/'});
    await launch('--device','iphone-13','--url',url,'--landscape');
    let m = await metrics(); assert.equal(m.width,844); assert.equal(m.height,390); assert.equal(m.phone,false);
    await launch('--device','desktop','--url',url+'/desktop');
    await new Promise(r=>setTimeout(r,200));
    m = await metrics(); assert.equal(m.width,1920); assert.equal(m.height,1080); assert.equal(m.touch,0); assert.equal(m.dpr,1); assert.equal(m.url,url+'/desktop');
    assert.equal((await cdp.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page' && t.url.startsWith(url)).length,3);
    assert.equal((await metrics(firstId)).width,390);
    assert.equal((await metrics(firstId)).touch,5);
    await launch('--device','pixel-5','--url',url);
    m = await metrics(); assert.equal(m.width,393); assert.equal(m.height,851); assert.equal(m.dpr,2.75);
    await run('--link','on');
    await new Promise(r=>setTimeout(r,600));
    const {sessionId:sourceSession} = await cdp.send('Target.attachToTarget',{targetId:firstId,flatten:true});
    const {sessionId:otherSession} = await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const evaluate = async (session,expression) => (await cdp.send('Runtime.evaluate',{expression,returnByValue:true},session)).result.value;
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:60,y:120,button:'left',clickCount:1},sourceSession);
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:60,y:120,button:'left',clickCount:1},sourceSession);
    await new Promise(r=>setTimeout(r,400));
    assert.equal(await evaluate(sourceSession,'document.querySelector("#count").textContent'),'1');
    assert.equal(await evaluate(otherSession,'document.querySelector("#count").textContent'),'1');
    await evaluate(sourceSession,'document.querySelector("#entry").focus()');
    await cdp.send('Input.insertText',{text:'ScreenHop linked input'},sourceSession);
    await new Promise(r=>setTimeout(r,400));
    assert.equal(await evaluate(otherSession,'document.querySelector("#entry").value'),'ScreenHop linked input');
    await evaluate(sourceSession,'scrollTo(0,1000)');
    await new Promise(r=>setTimeout(r,400));
    assert.ok(await evaluate(otherSession,'scrollY > 500'));
    await cdp.send('Page.navigate',{url:url+'/linked'},sourceSession);
    await new Promise(r=>setTimeout(r,700));
    assert.equal(await evaluate(otherSession,'location.pathname'),'/linked');
    await run('--link','off');
    await cdp.send('Page.navigate',{url:url+'/independent'},sourceSession);
    await new Promise(r=>setTimeout(r,400));
    assert.equal(await evaluate(otherSession,'location.pathname'),'/linked');
    if (process.env.SCREENHOP_TEST_HEADFUL) {
      const windows = JSON.parse((await exec('hyprctl',['-j','clients'])).stdout).filter(w=>/screenhop/i.test(w.class));
      assert.ok(windows.length >= 4);
      assert.ok(windows.every(w=>w.floating),'ScreenHop previews must float under Hyprland: ' + JSON.stringify(windows.map(w=>({title:w.title,floating:w.floating,size:w.size}))));
    }
    console.log('Link evidence: real click, typed input, proportional scrolling, navigation and unlink passed.');
    console.log('Browser evidence: iPhone 390×844, rotated 844×390, desktop 1920×1080, Pixel 393×851; persistent overrides, independent touch settings and simultaneous windows passed.');
  } finally {
    cdp?.ws.close(); await run('--close').catch(()=>{}); await new Promise(r=>server.close(r));
  }
});
