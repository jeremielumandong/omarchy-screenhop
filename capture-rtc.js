(() => {
  'use strict';
  globalThis.screenhopRTC?.close();
  const options = globalThis.screenhopRTCConfig || {};
  const width = Math.max(1, Number(options.width) || innerWidth);
  const height = Math.max(1, Number(options.height) || innerHeight);
  const fps = Math.max(1, Math.min(60, Number(options.fps) || 30));
  const peers = new Map(), earlyCandidates = new Map();
  let constraintQueue = Promise.resolve(), appliedFPS = fps;
  let capture = null, capturePromise = null, closed = false, captureGeneration = 0;
  const emit = message => { try { globalThis.screenhopRTCEvent(JSON.stringify(message)); } catch {} };
  const stopCapture = () => { const wasCapturing = Boolean(capture); captureGeneration++; capture?.getTracks().forEach(track => track.stop()); capture = null; capturePromise = null; if (wasCapturing) emit({type: 'capture', active: false}); };
  function closePeer(peerId) {
    const peer = peers.get(peerId);
    if (peer) { peer.closed = true; peer.pc.close(); peers.delete(peerId); }
    earlyCandidates.delete(peerId);
    if (!peers.size) stopCapture(); else void adaptCapture();
  }
  function adaptCapture() {
    constraintQueue = constraintQueue.catch(() => {}).then(async () => {
      const track = capture?.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') return;
      const demand = Math.max(1, ...[...peers.values()].map(peer => peer.fps));
      if (demand === appliedFPS) return;
      await track.applyConstraints({...track.getConstraints(), width: {ideal: width, max: width}, height: {ideal: height, max: height}, frameRate: {min: demand, max: demand}});
      appliedFPS = demand;
    });
    return constraintQueue;
  }
  function getCapture() {
    if (capturePromise) return capturePromise;
    // Invoked directly in the user-gesture CDP evaluation; no screenshots or canvas conversion.
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Native capture needs a secure website origin.');
    const generation = captureGeneration;
    const pending = navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: {width: {ideal: width, max: width}, height: {ideal: height, max: height}, frameRate: {ideal: fps, max: fps}},
      preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude'
    });
    capturePromise = pending.then(async stream => {
      if (closed || !peers.size || generation !== captureGeneration) { stream.getTracks().forEach(track => track.stop()); throw new Error('Capture was closed.'); }
      capture = stream;
      // Capture chrome can resize the headless tab; the host restores its exact content dimensions.
      emit({type: 'capture'});
      const track = stream.getVideoTracks()[0];
      // Minimum capture cadence avoids ~1s input latency on otherwise static pages.
      await track.applyConstraints({width: {ideal: width, max: width}, height: {ideal: height, max: height}, frameRate: {min: fps, max: fps}});
      appliedFPS = fps; await adaptCapture();
      track.addEventListener('ended', () => {
        for (const peerId of [...peers.keys()]) { emit({peerId, type: 'error', error: 'Native tab capture ended.'}); closePeer(peerId); }
      });
      return stream;
    }).catch(error => { if (generation === captureGeneration) stopCapture(); throw error; });
    return capturePromise;
  }
  async function signal(message) {
    if (closed) throw new Error('Native capture context was closed.');
    const peerId = message?.peerId;
    if (typeof peerId !== 'string' || !peerId || peerId.length > 100) throw new Error('Invalid preview peer.');
    if (message.type === 'close' || message.type === 'fallback') { closePeer(peerId); return; }
    if (message.type === 'activity') {
      if (!Number.isInteger(message.fps) || message.fps < 1 || message.fps > 30) throw new Error('Invalid capture cadence.');
      const peer = peers.get(peerId); if (peer) { peer.fps = message.fps; await adaptCapture(); } return;
    }
    if (message.type === 'candidate') {
      const peer = peers.get(peerId);
      if (!peer || !peer.pc.remoteDescription) {
        if (!earlyCandidates.has(peerId) && earlyCandidates.size >= 8) return;
        const queued = earlyCandidates.get(peerId) || [];
        if (queued.length < 64) queued.push(message.candidate);
        earlyCandidates.set(peerId, queued);
      } else await peer.pc.addIceCandidate(message.candidate);
      return;
    }
    if (message.type !== 'offer' || typeof message.sdp !== 'string') throw new Error('Unsupported preview signal.');
    if (!peers.has(peerId) && peers.size >= 8) { emit({peerId, type: 'error', error: 'Too many live preview connections.'}); return; }
    if (peers.has(peerId)) closePeer(peerId);
    const pc = new RTCPeerConnection({iceServers: []});
    const peer = {pc, closed: false, fps}; peers.set(peerId, peer);
    pc.onicecandidate = event => { if (event.candidate && !peer.closed) emit({peerId, type: 'candidate', candidate: event.candidate.toJSON()}); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { emit({peerId, type: 'error', error: 'Direct preview connection failed.'}); closePeer(peerId); }
    };
    try {
      const streamPromise = getCapture();
      void streamPromise.catch(() => {});
      await pc.setRemoteDescription({type: 'offer', sdp: message.sdp});
      const queued = earlyCandidates.get(peerId) || []; earlyCandidates.delete(peerId);
      for (const candidate of queued) await pc.addIceCandidate(candidate);
      const stream = await streamPromise;
      if (peer.closed || closed) return;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      await pc.setLocalDescription(await pc.createAnswer());
      if (!peer.closed) emit({peerId, type: 'answer', sdp: pc.localDescription.sdp});
    } catch (error) {
      emit({peerId, type: 'error', error: error.message || 'Native capture could not start.'});
      closePeer(peerId);
    }
  }
  function close() { closed = true; for (const peerId of [...peers.keys()]) closePeer(peerId); earlyCandidates.clear(); stopCapture(); }
  globalThis.screenhopRTC = {signal, close};
  addEventListener('pagehide', close, {once: true});
})();
