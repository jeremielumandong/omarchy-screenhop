import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CDP} from '../viewport.mjs';
const exec=promisify(execFile), helper=new URL('../viewport.mjs',import.meta.url).pathname;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fixture=initial=>`<!doctype html><html data-theme="${initial}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button{height:40px;width:100px}#picker{position:absolute;top:100px}</style><button type="button" aria-pressed="false" onclick="document.documentElement.dataset.theme='nord'">Nord</button><button type="button" aria-pressed="false" onclick="document.documentElement.dataset.theme='blue'">Blue</button><button type="button" aria-pressed="false" onclick="document.documentElement.dataset.theme='gold'">Gold</button><script>function showPicker(){document.body.insertAdjacentHTML('beforeend','<div id="picker" role="dialog" aria-label="Theme picker"><button type="button" aria-label="Use Nord" onclick="setTheme()"></button><button type="button" aria-label="Use Nord" onclick="setTheme()">Nord</button></div>')}function setTheme(){document.documentElement.dataset.theme='nord';document.querySelector('#picker')?.remove()}</script></html>`;

test('explicit theme intent handles closed pickers while preserving trust, auth and origin boundaries',{timeout:40000},async()=>{
  const state=await mkdtemp(join(tmpdir(),'screenhop-theme-test-'));
  const server=createServer((req,res)=>res.end('<!doctype html><title>fixture bootstrap</title>'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const run=(...args)=>exec(process.execPath,[helper,'--state',state,...args],{timeout:30000});
  let cdp;
  try {
    const first=JSON.parse((await run('--headless','--device','iphone-13','--url',url)).stdout);
    const second=JSON.parse((await run('--device','desktop','--url',url)).stdout);
    const [port,path]=(await readFile(join(state,'browser/DevToolsActivePort'),'utf8')).trim().split('\n');
    cdp=await CDP.connect(`ws://127.0.0.1:${port}${path}`);
    const sessions=[];
    for(const target of [first,second]) sessions.push((await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId);
    const [source,other]=sessions;
    const evaluate=async(session,expression)=>(await cdp.send('Runtime.evaluate',{expression,returnByValue:true},session)).result.value;
    const initial=new Map([[source,'blue'],[other,'gold']]);
    const fetchErrors=[];
    cdp.onEvent=event=>{
      if(event.method==='Fetch.requestPaused') cdp.send('Fetch.fulfillRequest',{requestId:event.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(event.params.resourceType==='Document'?fixture(initial.get(event.sessionId)):'').toString('base64')},event.sessionId).catch(error=>fetchErrors.push(error));
    };
    for(const session of sessions){
      await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]},session);
      await cdp.send('Page.navigate',{url:'https://omarchy.org/screenhop-fixture'},session);
    }
    const waitTheme=async(session,value)=>{
      for(let i=0;i<60;i++){if(await evaluate(session,'document.documentElement.dataset.theme')===value)return;await delay(50);}
      assert.equal(await evaluate(session,'document.documentElement.dataset.theme'),value);
    };
    await waitTheme(source,'blue');await waitTheme(other,'gold');await delay(200);
    // A picker can already be open when the user enables linking.
    await evaluate(source,'showPicker()');await run('--link','on');
    const click=async(session,selector)=>{
      const position=await evaluate(session,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...position,button:'left',clickCount:1},session);
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...position,button:'left',clickCount:1},session);
    };
    await click(source,'#picker button:last-child');await waitTheme(other,'nord');
    assert.equal(await evaluate(other,'!!document.querySelector("#picker")'),false);
    await delay(600);
    await evaluate(source,"document.documentElement.dataset.theme='gold'");await delay(300);
    assert.equal(await evaluate(other,'document.documentElement.dataset.theme'),'nord','unrelated programmatic changes are not broadcast');
    await evaluate(source,"document.body.insertAdjacentHTML('beforeend','<input type=password>')");await delay(100);
    await click(source,'button:nth-child(2)');await waitTheme(source,'blue');await delay(300);
    assert.equal(await evaluate(other,'document.documentElement.dataset.theme'),'nord','authentication pause blocks theme synchronization');
    await evaluate(source,"document.querySelector('input').remove()");await delay(100);
    await cdp.send('Page.navigate',{url:'https://example.test/screenhop-fixture'},other);
    await waitTheme(other,'gold');await delay(200);await run('--link','on');
    await click(source,'button:first-child');await waitTheme(source,'nord');await delay(300);
    assert.equal(await evaluate(other,'document.documentElement.dataset.theme'),'gold','theme intents never cross origins');
    assert.deepEqual(fetchErrors,[]);
  } finally { cdp?.ws.close();await run('--close').catch(()=>{});await new Promise(resolve=>server.close(resolve)); }
});
