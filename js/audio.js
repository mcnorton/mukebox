/**
 * MukeBox — Web Audio API playback
 */

(function () {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  const DEFAULT_MASTER_GAIN = 0.8;

  let ctx = null;
  let masterGain = null;
  let outputNode = null;

  let isPlaying = false;
  let progress = 0;
  let progressRaf = null;
  let playbackStartTime = 0;
  let scheduledNodes = [];
  let totalDuration = 0;
  let activeCells = [];
  let cellSchedule = [];
  let audioReady = false;
  let initPromise = null;
  let unlockPromise = null;
  let loopEnabled = false;
  let lastSong = null;
  let onStateChange = null;
  let playbackToken = 0;

  const NOTE_MAP = {
    C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6,
    G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
  };

  function pitchToFreq(pitch) {
    const match = pitch.match(/^([A-G]#?)(\d)$/);
    if (!match) return 440;
    const note = match[1];
    const octave = parseInt(match[2], 10);
    const midi = NOTE_MAP[note] + (octave + 1) * 12;
    return 440 * (2 ** ((midi - 69) / 12));
  }

  function isMobileBrowser() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobileChrome = /CriOS|Chrome\/.*Mobile/i.test(ua);
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    return isIOS || isAndroid || isMobileChrome || isCoarse;
  }

  function useLiteAudio() {
    return isMobileBrowser();
  }

  function notifyStateChange() {
    if (onStateChange) onStateChange(isPlaying);
  }

  function createImpulseBuffer(context, duration, decay) {
    const rate = context.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = context.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * ((1 - i / length) ** decay);
      }
    }
    return impulse;
  }

  function setupOutputChain() {
    if (!ctx || !masterGain) return;

    if (useLiteAudio()) {
      outputNode = masterGain;
      masterGain.connect(ctx.destination);
      return;
    }

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.8;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.2;

    const convolver = ctx.createConvolver();
    convolver.buffer = createImpulseBuffer(ctx, 2.5, 2);

    masterGain.connect(dryGain);
    masterGain.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);
    outputNode = masterGain;
  }

  function getContext() {
    if (!ctx) {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = DEFAULT_MASTER_GAIN;
      setupOutputChain();
    }
    return ctx;
  }

  function playSilentBuffer() {
    const c = getContext();
    const buffer = c.createBuffer(1, 1, c.sampleRate);
    buffer.getChannelData(0)[0] = 0;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
    source.stop(c.currentTime + 0.001);
  }

  async function ensureUnlocked() {
    const c = getContext();
    playSilentBuffer();
    if (c.state === 'suspended') {
      await c.resume();
    }
  }

  function unlockFromUserGesture() {
    if (!unlockPromise) {
      unlockPromise = ensureUnlocked().finally(() => {
        unlockPromise = null;
      });
    }
    return unlockPromise;
  }

  function bindMobileAudioResume() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (audioReady || isPlaying)) {
        unlockFromUserGesture();
      }
    });
  }

  bindMobileAudioResume();

  function trackNode(node) {
    scheduledNodes.push(node);
    return node;
  }

  function clearScheduledNodes() {
    scheduledNodes.forEach((node) => {
      try {
        if (node.stop) node.stop(0);
        node.disconnect?.();
      } catch {
        /* already stopped */
      }
    });
    scheduledNodes = [];
  }

  function playPiano(pitch, duration, when) {
    const c = getContext();
    const freq = pitchToFreq(pitch);
    const t = when ?? c.currentTime;
    const dur = Math.max(duration, 0.05);

    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    const gain = c.createGain();
    const peak = 0.35;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(peak * 0.3, t + Math.min(dur * 0.4, 0.5));
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(outputNode);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    trackNode(osc);
    trackNode(gain);
  }

  function playBassDrum(duration, when) {
    const c = getContext();
    const t = when ?? c.currentTime;
    const dur = Math.max(duration, 0.1);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(outputNode);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    trackNode(osc);
    trackNode(gain);
  }

  function playSnare(duration, when) {
    const c = getContext();
    const t = when ?? c.currentTime;
    const dur = Math.max(duration, 0.1);
    const len = Math.ceil(c.sampleRate * dur);

    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(outputNode);
    noise.start(t);
    noise.stop(t + dur + 0.05);
    trackNode(noise);
    trackNode(filter);
    trackNode(gain);
  }

  function playTriangle(duration, when) {
    const c = getContext();
    const t = when ?? c.currentTime;
    const dur = Math.max(duration, 0.5);
    const freq = pitchToFreq('A6');

    const len = Math.ceil(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(10, t);

    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const partial = c.createOscillator();
    partial.type = 'sine';
    partial.frequency.setValueAtTime(freq, t);

    const partialGain = c.createGain();
    partialGain.gain.setValueAtTime(0.15, t);
    partialGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);

    const mix = c.createGain();
    mix.gain.value = 1;

    noise.connect(filter);
    filter.connect(noiseGain);
    partial.connect(partialGain);
    noiseGain.connect(mix);
    partialGain.connect(mix);
    mix.connect(outputNode);

    noise.start(t);
    noise.stop(t + dur + 0.05);
    partial.start(t);
    partial.stop(t + dur + 0.05);
    trackNode(noise);
    trackNode(filter);
    trackNode(noiseGain);
    trackNode(partial);
    trackNode(partialGain);
    trackNode(mix);
  }

  function scheduleEvent(ev, startTime) {
    const when = startTime + ev.time;
    if (ev.type === 'melodic') {
      playPiano(ev.pitch, ev.duration, when);
    } else if (ev.instrument === 'snareDrum') {
      playSnare(ev.duration, when);
    } else if (ev.instrument === 'triangle') {
      playTriangle(ev.duration, when);
    } else {
      playBassDrum(ev.duration, when);
    }
  }

  async function playWarmupRecipe(recipe, gain) {
    const c = getContext();
    masterGain.gain.value = gain;
    const start = c.currentTime + 0.05;
    recipe.events.forEach((ev) => scheduleEvent(ev, start));
    await new Promise((resolve) => setTimeout(resolve, (recipe.totalDuration + 0.1) * 1000));
  }

  async function runAudioWarmup() {
    const { Schedule } = window.WMF;
    getContext();

    await playWarmupRecipe(Schedule.buildWarmupPreloadRecipe(), 0);
    await playWarmupRecipe(Schedule.buildWarmupTestRecipe(), DEFAULT_MASTER_GAIN);
  }

  async function startWithWarmup() {
    await unlockFromUserGesture();
    await initAudio();
    await runAudioWarmup();
  }

  async function initAudio() {
    await ensureUnlocked();
    if (audioReady) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      getContext();
      audioReady = true;
      return true;
    })();

    try {
      return await initPromise;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  }

  async function preloadAudio() {
    return initAudio();
  }

  function isAudioReady() {
    return audioReady;
  }

  function setLoopEnabled(enabled) {
    loopEnabled = !!enabled;
  }

  function getLoopEnabled() {
    return loopEnabled;
  }

  function stopPlayback() {
    playbackToken += 1;
    clearScheduledNodes();
    isPlaying = false;
    progress = 0;
    playbackStartTime = 0;
    activeCells = [];
    cellSchedule = [];

    if (progressRaf) {
      cancelAnimationFrame(progressRaf);
      progressRaf = null;
    }
    if (window.WMF.Grid) window.WMF.Grid.updatePlayingHighlight();
    notifyStateChange();
  }

  function finishPlayback(token) {
    if (token !== playbackToken) return;

    if (loopEnabled && lastSong) {
      clearScheduledNodes();
      isPlaying = false;
      progress = 0;
      activeCells = [];
      if (progressRaf) {
        cancelAnimationFrame(progressRaf);
        progressRaf = null;
      }
      if (window.WMF.Grid) window.WMF.Grid.updatePlayingHighlight();
      startPlayback(lastSong);
      return;
    }
    stopPlayback();
  }

  async function startPlayback(song) {
    await ensureUnlocked();
    await initAudio();

    lastSong = song;
    playbackToken += 1;
    const token = playbackToken;

    const { Schedule } = window.WMF;
    const schedule = Schedule.buildSchedule(song);
    const events = schedule.events;
    totalDuration = schedule.totalDuration;
    cellSchedule = schedule.cellSchedule;

    if (totalDuration === 0) {
      const { getTimeSignatureConfig } = window.WMF;
      const cfg = getTimeSignatureConfig(song.timeSignature);
      const beatSec = Schedule.beatDurationSec(song.tempo, song.timeSignature);
      const maxMeasures = Math.max(...song.tracks.map((t) => t.measures.length), 1);
      totalDuration = maxMeasures * cfg.beatCount * beatSec;
    }

    const c = getContext();
    playbackStartTime = c.currentTime + 0.1;

    events.forEach((ev) => {
      scheduleEvent(ev, playbackStartTime);
    });

    isPlaying = true;
    notifyStateChange();

    const animate = () => {
      if (!isPlaying || token !== playbackToken) return;

      const transportSeconds = Math.max(0, c.currentTime - playbackStartTime);
      progress = totalDuration > 0 ? Math.min(transportSeconds / totalDuration, 1) : 0;
      updateActiveCells(transportSeconds);

      if (window.WMF.Grid) window.WMF.Grid.updatePlayingHighlight();

      if (progress >= 1) {
        finishPlayback(token);
        return;
      }
      progressRaf = requestAnimationFrame(animate);
    };
    progressRaf = requestAnimationFrame(animate);

    setTimeout(() => {
      if (token === playbackToken && isPlaying) {
        finishPlayback(token);
      }
    }, (totalDuration + 0.15) * 1000);
  }

  async function playSong(song) {
    stopPlayback();
    await startPlayback(song);
  }

  function updateActiveCells(transportSeconds) {
    activeCells = cellSchedule
      .filter((c) => transportSeconds >= c.time && transportSeconds < c.endTime)
      .map((c) => ({
        pitch: c.pitch,
        trackId: c.trackId,
        measureIndex: c.measureIndex,
        cellIndex: c.cellIndex,
        isDrum: c.isDrum,
      }));
  }

  function setTempo() {
    /* tempo is baked into buildSchedule; no runtime transport */
  }

  function getProgress() {
    return progress;
  }

  function getIsPlaying() {
    return isPlaying;
  }

  function getActiveCells() {
    return activeCells;
  }

  async function previewPitch(pitch) {
    if (isPlaying) return;
    try {
      await unlockFromUserGesture();
      await initAudio();
      const c = getContext();
      playPiano(pitch, 0.3, c.currentTime);
    } catch {
      /* audio preview optional */
    }
  }

  async function previewDrum(instrument) {
    if (isPlaying) return;
    try {
      await unlockFromUserGesture();
      await initAudio();
      const c = getContext();
      const now = c.currentTime;
      if (instrument === 'snareDrum') {
        playSnare(0.15, now);
      } else if (instrument === 'triangle') {
        playTriangle(0.3, now);
      } else {
        playBassDrum(0.2, now);
      }
    } catch {
      /* audio preview optional */
    }
  }

  window.WMF = window.WMF || {};
  window.WMF.Audio = {
    initAudio,
    preloadAudio,
    runAudioWarmup,
    startWithWarmup,
    isAudioReady,
    ensureUnlocked,
    unlockFromUserGesture,
    playSong,
    stopPlayback,
    setTempo,
    setLoopEnabled,
    getLoopEnabled,
    previewPitch,
    previewDrum,
    get onStateChange() { return onStateChange; },
    set onStateChange(cb) { onStateChange = cb; },
    getProgress,
    getIsPlaying,
    getActiveCells,
  };
})();
