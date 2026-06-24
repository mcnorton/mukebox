/**
 * Tone.js 연주 — schedule.js가 만든 이벤트만 재생
 */

(function () {
  let pianoSynth = null;
  let drumSynth = null;
  let reverb = null;
  let isPlaying = false;
  let progress = 0;
  let progressRaf = null;
  let scheduledEvents = [];
  let totalDuration = 0;
  let activeCells = [];
  let cellSchedule = [];

  async function initAudio() {
    await Tone.start();

    if (!reverb) {
      reverb = new Tone.Reverb({ decay: 2.5, wet: 0.2 }).toDestination();
      await reverb.generate();
    }

    if (!pianoSynth) {
      pianoSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        detune: 0,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 1.2, sustain: 0.1, release: 1.2 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      });
      pianoSynth.connect(reverb);
      pianoSynth.volume.value = -8;
    }

    if (!drumSynth) {
      drumSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
      }).toDestination();
      drumSynth.volume.value = -3;
    }

    return true;
  }

  function stopPlayback() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    scheduledEvents.forEach((id) => Tone.Transport.clear(id));
    scheduledEvents = [];
    isPlaying = false;
    progress = 0;
    activeCells = [];
    cellSchedule = [];

    if (progressRaf) {
      cancelAnimationFrame(progressRaf);
      progressRaf = null;
    }
    if (window.WMF.Grid) window.WMF.Grid.updatePlayingHighlight();
  }

  function updateActiveCells(transportSeconds) {
    activeCells = cellSchedule
      .filter((c) => transportSeconds >= c.time && transportSeconds < c.endTime)
      .map((c) => ({
        pitch: c.pitch,
        measureIndex: c.measureIndex,
        cellIndex: c.cellIndex,
        isDrum: c.isDrum,
      }));
  }

  async function playSong(song) {
    stopPlayback();
    await initAudio();

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

    Tone.Transport.bpm.value = song.tempo;

    events.forEach((ev) => {
      const id = Tone.Transport.schedule((t) => {
        if (ev.type === 'melodic') {
          pianoSynth.triggerAttackRelease(ev.pitch, ev.duration, t);
        } else {
          drumSynth.triggerAttackRelease(ev.pitch, ev.duration, t);
        }
      }, ev.time);
      scheduledEvents.push(id);
    });

    isPlaying = true;
    Tone.Transport.start();

    const animate = () => {
      if (!isPlaying) return;

      const transportSeconds = Tone.Transport.seconds;
      progress = totalDuration > 0 ? Math.min(transportSeconds / totalDuration, 1) : 0;
      updateActiveCells(transportSeconds);

      if (window.WMF.Grid) window.WMF.Grid.updatePlayingHighlight();

      if (progress >= 1) {
        stopPlayback();
        return;
      }
      progressRaf = requestAnimationFrame(animate);
    };
    progressRaf = requestAnimationFrame(animate);

    Tone.Transport.scheduleOnce(() => {
      stopPlayback();
    }, totalDuration + 0.05);
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

  window.WMF = window.WMF || {};
  window.WMF.Audio = {
    initAudio,
    playSong,
    stopPlayback,
    getProgress,
    getIsPlaying,
    getActiveCells,
  };
})();
