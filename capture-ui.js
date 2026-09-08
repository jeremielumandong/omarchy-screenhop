(() => {
  'use strict';
  const screenshotButton = document.getElementById('capture-screenshot');
  const recordButton = document.getElementById('capture-record');
  const skinOption = document.getElementById('capture-skin');
  const hint = document.getElementById('capture-hint');
  const badge = document.getElementById('recording-status');
  const clock = document.getElementById('recording-time');
  const frameButton = document.getElementById('frame');
  const downloadURLs = new Set();
  const byteLimit = 128 * 1024 * 1024, durationLimit = 180000;
  let recording = null, preparingSession = null, preparing = false, leaving = false;
  const captureHandle = 'screenhop-record-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
  let handleSupported = false;
  try {
    if (navigator.mediaDevices?.setCaptureHandleConfig) {
      navigator.mediaDevices.setCaptureHandleConfig({handle:captureHandle,exposeOrigin:true,permittedOrigins:[location.origin]});
      handleSupported = true;
    }
  } catch {}
  const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());
  function tell(message) { hint.textContent = message; if (typeof toast === 'function') toast(message); }
  function filename(kind, extension) {
    const device = String(config.name || 'preview').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
    return `screenhop-${device}-${config.width}x${config.height}-${kind}-${timestamp}.${extension}`;
  }
  function download(blob, name) {
    if (!blob.size || leaving) return;
    const url = URL.createObjectURL(blob); downloadURLs.add(url);
    const anchor = document.createElement('a'); anchor.className = 'capture-download'; anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => { URL.revokeObjectURL(url); downloadURLs.delete(url); },60000);
  }
  function hideDrawer() { document.querySelector('.tool-dock').classList.remove('open'); document.getElementById('tools-toggle').setAttribute('aria-expanded','false'); const keyboard = document.getElementById('phone-keyboard-panel'); if (keyboard) keyboard.hidden = true; document.getElementById('phone-keyboard-toggle')?.setAttribute('aria-expanded','false'); document.getElementById('toast').hidden = true; }
  function currentPicture() {
    const live = document.getElementById('rtc-video'), image = document.getElementById('display');
    if (document.getElementById('screen').classList.contains('rtc-live') && live.readyState >= 2) return live;
    if (image.complete && image.naturalWidth) return image;
    return null;
  }
  function chooseMime() {
    if (!globalThis.MediaRecorder) throw new Error('This browser cannot record video. Screenshots are still available.');
    const supported = ['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!supported) throw new Error('This browser has no supported video recording format.');
    return supported;
  }
  async function screenshot() {
    if (screenshotButton.disabled) return;
    screenshotButton.disabled = true;
    const skin = skinOption.checked;
    hideDrawer();
    try {
      const response = await fetch(config.base + '/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'screenshot',skin}),signal:AbortSignal.timeout(15000)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Screenshot could not be captured.');
      if (result.mimeType !== 'image/png' || typeof result.data !== 'string') throw new Error('The screenshot response was incomplete.');
      const binary = atob(result.data), bytes = new Uint8Array(binary.length);
      for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
      download(new Blob([bytes],{type:'image/png'}),result.filename || filename(skin?'device':'page','png'));
      tell('Screenshot saved.');
    } catch (error) { tell(error.message || 'Screenshot could not be saved.'); }
    finally { screenshotButton.disabled = false; }
  }
  function makeCanvasRecording(draw, width, height, session) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2,Math.round(width)); canvas.height = Math.max(2,Math.round(height));
    const context = canvas.getContext('2d',{alpha:false});
    if (!context || !canvas.captureStream) throw new Error('This browser cannot record the compatibility preview.');
    const render = () => {
      if (session.finished) return;
      try { draw(context,canvas); } catch { stopRecording('Recording stopped because the preview became unavailable.'); }
    };
    render(); session.renderTimer = setInterval(render,1000/30);
    session.output = canvas.captureStream(30);
    return session.output;
  }
  async function prepareSkinStream(pending, session) {
    const stream = await pending; session.native = stream;
    const track = stream.getVideoTracks()[0];
    if (!track || track.getSettings().displaySurface !== 'browser' || track.getCaptureHandle?.()?.handle !== captureHandle) {
      throw new Error('Select this ScreenHop tab to record its device frame. No recording was saved.');
    }
    const cancel = message => { if (session.cancelled) return; session.cancelled = true; session.cancelReason = message; if (recording === session) stopRecording(message); else stopTracks(stream); };
    track.addEventListener('capturehandlechange',() => { if (track.getCaptureHandle?.()?.handle !== captureHandle) cancel('Recording stopped because the shared tab changed.'); });
    track.addEventListener('ended',() => cancel('Recording stopped when tab sharing ended.'));
    await track.applyConstraints({...track.getConstraints(),frameRate:{min:30,max:30}}).catch(() => {});
    const region = document.getElementById('capture-region') || document.getElementById('fit-box');
    if (globalThis.CropTarget?.fromElement && typeof track.cropTo === 'function') {
      try { await track.cropTo(await CropTarget.fromElement(region)); session.output = new MediaStream([track]); return session.output; } catch {}
    }
    // Safe fallback after verifying self-capture: crop each native video frame to the device bounds.
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream;
    session.scratchVideo = video; await video.play();
    if (!video.videoWidth) await new Promise((resolve,reject) => { const timeout = setTimeout(() => reject(new Error('Tab video did not start.')),5000); video.addEventListener('loadeddata',() => { clearTimeout(timeout); resolve(); },{once:true}); });
    const bounds = region.getBoundingClientRect();
    return makeCanvasRecording((context,canvas) => {
      const rect = region.getBoundingClientRect(), sx = video.videoWidth / innerWidth, sy = video.videoHeight / innerHeight;
      context.drawImage(video,rect.x*sx,rect.y*sy,rect.width*sx,rect.height*sy,0,0,canvas.width,canvas.height);
    },bounds.width*devicePixelRatio,bounds.height*devicePixelRatio,session);
  }
  function restoreUI(session) {
    document.body.classList.remove('recording-skin');
    frameButton.disabled = false;
    if (session.restoreFrame && !leaving) { showFrame = false; updateFrame(); }
    recordButton.textContent = 'Record'; recordButton.setAttribute('aria-pressed','false'); recordButton.disabled = false;
    skinOption.disabled = false; badge.hidden = true;
  }
  function cleanup(session) {
    session.finished = true; clearInterval(session.renderTimer); clearInterval(session.clockTimer); clearTimeout(session.limitTimer);
    stopTracks(session.output); if (session.native !== session.output) stopTracks(session.native);
    if (session.scratchVideo) { session.scratchVideo.pause(); session.scratchVideo.srcObject = null; }
    if (recording === session) recording = null;
    restoreUI(session);
  }
  function stopRecording(message) {
    const session = recording;
    if (!session || session.stopping) return;
    session.stopping = true;
    if (message) { session.stopReason = message; tell(message); }
    if (session.recorder?.state !== 'inactive') session.recorder?.stop();
  }
  async function beginRecording() {
    if (preparing || recording) return;
    let session;
    try {
      const mimeType = chooseMime();
      if (!currentPicture()) throw new Error('Wait for the live preview before recording.');
      const skin = skinOption.checked;
      // The native prompt must start synchronously in the actual Record click handler.
      let nativePromise = null;
      if (skin) {
        if (!navigator.mediaDevices?.getDisplayMedia || !handleSupported) throw new Error('Device-frame recording needs desktop Chromium. Uncheck Include device frame to record this webpage here.');
        nativePromise = navigator.mediaDevices.getDisplayMedia({audio:false,video:{width:{ideal:Math.round(innerWidth*devicePixelRatio)},height:{ideal:Math.round(innerHeight*devicePixelRatio)},frameRate:{ideal:30,max:30}},preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',systemAudio:'exclude',monitorTypeSurfaces:'exclude'});
      }
      preparing = true; recordButton.disabled = true; skinOption.disabled = true;
      session = {skin,mimeType,chunks:[],bytes:0,finished:false,stopping:false,cancelled:false,restoreFrame:skin && !showFrame}; preparingSession = session;
      document.body.classList.toggle('recording-skin',skin);
      if (session.restoreFrame) { showFrame = true; updateFrame(); }
      frameButton.disabled = true; hideDrawer();
      let stream;
      if (skin) stream = await prepareSkinStream(nativePromise,session);
      else {
        const live = document.getElementById('rtc-video');
        const original = document.getElementById('screen').classList.contains('rtc-live') && live.srcObject?.getVideoTracks().find(track => track.readyState === 'live');
        if (original) { session.output = new MediaStream([original.clone()]); stream = session.output; }
        else stream = makeCanvasRecording((context,canvas) => { const picture = currentPicture(); if (picture) context.drawImage(picture,0,0,canvas.width,canvas.height); },config.width,config.height,session);
      }
      if (leaving) { cleanup(session); return; }
      if (session.cancelled || stream.getVideoTracks().some(track => track.readyState !== 'live')) throw new Error(session.cancelReason || 'Recording ended before it could start.');
      const recorder = new MediaRecorder(stream,{mimeType,videoBitsPerSecond:Math.min(8000000,Math.max(1500000,Number(config.width)*Number(config.height)*4))});
      session.recorder = recorder; session.started = performance.now(); recording = session;
      recorder.addEventListener('dataavailable',event => {
        if (!event.data.size) return;
        if (session.bytes + event.data.size > byteLimit) { stopRecording('Recording saved at the 128 MB limit.'); return; }
        session.chunks.push(event.data); session.bytes += event.data.size;
      });
      recorder.addEventListener('error',() => stopRecording('Recording stopped because the browser encoder failed.'));
      recorder.addEventListener('stop',() => {
        const blob = new Blob(session.chunks,{type:recorder.mimeType || mimeType}); session.chunks.length = 0;
        cleanup(session);
        if (blob.size && !leaving) { download(blob,filename(skin?'device':'page',mimeType.includes('mp4')?'mp4':'webm')); tell(session.stopReason || 'Recording saved.'); }
        else if (!leaving) tell('No video frames were recorded. Try again after the preview connects.');
      });
      stream.getVideoTracks().forEach(track => track.addEventListener('ended',() => stopRecording('Recording stopped because the video ended.')));
      recorder.start(1000);
      badge.hidden = false; clock.textContent = '00:00';
      recordButton.textContent = 'Stop recording'; recordButton.setAttribute('aria-pressed','true'); recordButton.disabled = false;
      session.clockTimer = setInterval(() => { const seconds = Math.floor((performance.now()-session.started)/1000); clock.textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; },250);
      session.limitTimer = setTimeout(() => stopRecording('Recording saved at the 3-minute limit.'),durationLimit);
      hint.textContent = skin ? 'Recording the device frame. Use Stop to save.' : 'Recording the webpage. Use Stop to save.';
    } catch (error) { if (session) cleanup(session); tell(error.name === 'NotAllowedError' ? 'Recording cancelled. Choose this ScreenHop tab to include its frame.' : error.message || 'Recording could not start.'); }
    finally { preparing = false; preparingSession = null; if (!recording) { recordButton.disabled = false; skinOption.disabled = false; } }
  }
  screenshotButton.disabled = false; recordButton.disabled = false;
  screenshotButton.addEventListener('click',screenshot);
  recordButton.addEventListener('click',() => { if (recording) stopRecording(); else void beginRecording(); });
  document.getElementById('capture-stop').addEventListener('click',() => stopRecording());
  skinOption.addEventListener('change',() => { hint.textContent = skinOption.checked ? 'PNG includes the frame. For recording, choose this ScreenHop tab when asked.' : 'Save only the webpage, without its device frame.'; });
  addEventListener('pagehide',() => { leaving = true; if (preparingSession) { preparingSession.cancelled = true; stopTracks(preparingSession.native); } if (recording) { const session = recording; stopRecording(); cleanup(session); } downloadURLs.forEach(url => URL.revokeObjectURL(url)); downloadURLs.clear(); });
})();
