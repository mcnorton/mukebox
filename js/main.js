/**
 * MukeBox — App entry point
 */

(function () {
  const {
    Grid, Audio, Storage, setTimeSignature, timeSignatureKey, normalizeTempo, TEMPO_PRESETS,
    trimTrailingEmptyMeasures, getSolfege,
  } = window.WMF;
  const I18n = window.WMF.I18n;

  let song = Storage.loadInitialSong();
  song.tempo = normalizeTempo(song.tempo);

  const langControl = document.getElementById('lang-control');
  const btnLang = document.getElementById('btn-lang');
  const langPopover = document.getElementById('lang-popover');
  const meterControl = document.getElementById('meter-control');
  const btnMeter = document.getElementById('btn-meter');
  const meterPopover = document.getElementById('meter-popover');
  const meterLabel = document.getElementById('meter-label');
  const tempoSliderControl = document.getElementById('tempo-slider-control');
  const tempoSlider = document.getElementById('tempo-slider');
  const tempoNameEl = tempoSliderControl?.querySelector('.tempo-name');
  const tempoBpmEl = tempoSliderControl?.querySelector('.tempo-bpm');
  const btnPlay = document.getElementById('btn-play');
  const playIcon = btnPlay?.querySelector('.play-icon');
  const btnLoop = document.getElementById('btn-loop');

  function syncMeterLabel() {
    if (!meterLabel || !song.timeSignature) return;
    const key = timeSignatureKey(song.timeSignature);
    meterLabel.textContent = `${I18n.t('meter')} ${key}`;

    document.querySelectorAll('#meter-popover .meter-option').forEach((opt) => {
      const selected = opt.dataset.value === key;
      opt.classList.toggle('is-selected', selected);
      opt.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function getTempoPresetIndex(bpm) {
    const normalized = normalizeTempo(bpm);
    const idx = TEMPO_PRESETS.findIndex((preset) => preset.bpm === normalized);
    return idx >= 0 ? idx : TEMPO_PRESETS.findIndex((preset) => preset.bpm === 120);
  }

  function updateTempoDisplay(preset, sliderIndex) {
    if (!preset) return;
    const name = I18n.tempoName(preset.bpm);
    if (tempoNameEl) tempoNameEl.textContent = name;
    if (tempoBpmEl) tempoBpmEl.textContent = String(preset.bpm);
    if (tempoSlider) {
      tempoSlider.setAttribute('aria-valuetext', `${name} ${preset.bpm}`);
      const idx = sliderIndex ?? Number(tempoSlider.value);
      const max = Number(tempoSlider.max) || TEMPO_PRESETS.length - 1;
      const fill = max > 0 ? (idx / max) * 100 : 0;
      tempoSlider.style.setProperty('--tempo-slider-fill', `${fill}%`);
    }
  }

  function syncTempoSlider() {
    if (!tempoSlider) return;
    const idx = getTempoPresetIndex(song.tempo);
    tempoSlider.value = String(idx);
    updateTempoDisplay(TEMPO_PRESETS[idx], idx);
  }

  function refreshSolfege() {
    document.querySelectorAll('.piano-key[data-pitch] .key-solfege').forEach((el) => {
      const pitch = el.closest('.piano-key')?.dataset.pitch;
      if (pitch) el.textContent = getSolfege(pitch);
    });
  }

  function updateLangSelectedState() {
    const lang = I18n.getLang();
    document.querySelectorAll('.lang-option').forEach((opt) => {
      const selected = opt.dataset.lang === lang;
      opt.classList.toggle('is-selected', selected);
      opt.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function applyLanguage() {
    I18n.applyStatic(document);
    syncMeterLabel();
    syncTempoSlider();
    updatePlayButton();
    refreshSolfege();
    updateLangSelectedState();
  }

  function setTransportLocked(locked) {
    if (meterControl) meterControl.classList.toggle('transport-locked', locked);
    if (tempoSliderControl) tempoSliderControl.classList.toggle('transport-locked', locked);
    if (tempoSlider) tempoSlider.disabled = locked;
    if (btnMeter) {
      btnMeter.disabled = locked;
      btnMeter.setAttribute('aria-expanded', locked ? 'false' : btnMeter.getAttribute('aria-expanded'));
    }
    if (locked) closeMeterPopover();
  }

  function updatePlayButton() {
    const playing = Audio.getIsPlaying();
    if (!btnPlay || !playIcon) return;

    btnPlay.classList.toggle('playing', playing);
    playIcon.textContent = playing ? '■' : '▶';
    const labelKey = playing ? 'stop' : 'play';
    btnPlay.title = I18n.t(labelKey);
    btnPlay.setAttribute('aria-label', I18n.t(labelKey));
  }

  function positionMeterPopover() {
    if (!meterPopover || !btnMeter) return;
    const rect = btnMeter.getBoundingClientRect();
    meterPopover.style.left = `${rect.left + rect.width / 2}px`;
    meterPopover.style.top = `${rect.top - 10}px`;
  }

  function positionLangPopover() {
    if (!langPopover || !btnLang) return;
    const rect = btnLang.getBoundingClientRect();
    const margin = 8;
    const top = rect.bottom + 8;

    langPopover.style.top = `${top}px`;

    const width = langPopover.offsetWidth || langPopover.getBoundingClientRect().width;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    left = Math.max(margin, left);
    langPopover.style.left = `${left}px`;

    const arrowLeft = rect.left + rect.width / 2 - left;
    langPopover.style.setProperty('--lang-arrow-left', `${arrowLeft}px`);
  }

  function closeMeterPopover() {
    if (!meterPopover || !btnMeter) return;
    meterPopover.classList.add('hidden');
    btnMeter.setAttribute('aria-expanded', 'false');
    meterControl?.classList.remove('is-open');
  }

  function openMeterPopover() {
    if (!meterPopover || !btnMeter || Audio.getIsPlaying()) return;
    closeLangPopover();
    positionMeterPopover();
    meterPopover.classList.remove('hidden');
    btnMeter.setAttribute('aria-expanded', 'true');
    meterControl?.classList.add('is-open');
  }

  function toggleMeterPopover() {
    if (!meterPopover || Audio.getIsPlaying()) return;
    if (meterPopover.classList.contains('hidden')) {
      openMeterPopover();
    } else {
      closeMeterPopover();
    }
  }

  function closeLangPopover() {
    if (!langPopover || !btnLang) return;
    langPopover.classList.add('hidden');
    btnLang.setAttribute('aria-expanded', 'false');
    langControl?.classList.remove('is-open');
  }

  function openLangPopover() {
    if (!langPopover || !btnLang) return;
    closeMeterPopover();
    langPopover.classList.remove('hidden');
    positionLangPopover();
    btnLang.setAttribute('aria-expanded', 'true');
    langControl?.classList.add('is-open');
  }

  function toggleLangPopover() {
    if (!langPopover) return;
    if (langPopover.classList.contains('hidden')) {
      openLangPopover();
    } else {
      closeLangPopover();
    }
  }

  function onSongChange(updated) {
    song = updated || Grid.getSong();
    song.tempo = normalizeTempo(song.tempo);
    Storage.saveToLocalStorage(song);
    syncMeterLabel();
    syncTempoSlider();
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  Audio.onStateChange = () => {
    setTransportLocked(Audio.getIsPlaying());
    updatePlayButton();
  };

  I18n.onChange(() => {
    applyLanguage();
  });

  Grid.initGrid(song, onSongChange);

  applyLanguage();

  let audioPreloaded = false;
  function preloadAudioOnce() {
    Audio.unlockFromUserGesture();
    if (audioPreloaded) return;
    audioPreloaded = true;
    Audio.preloadAudio().catch(() => {
      audioPreloaded = false;
    });
  }

  const appEl = document.querySelector('.app');
  if (appEl) {
    appEl.addEventListener('pointerdown', preloadAudioOnce, { once: true, passive: true });
    appEl.addEventListener('touchstart', preloadAudioOnce, { once: true, passive: true });
  }

  btnPlay?.addEventListener('pointerdown', () => {
    Audio.unlockFromUserGesture();
  }, { passive: true });

  btnLang?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLangPopover();
  });

  document.querySelectorAll('.lang-option').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      I18n.setLang(opt.dataset.lang);
      closeLangPopover();
    });
  });

  btnMeter?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMeterPopover();
  });

  document.querySelectorAll('#meter-popover .meter-option').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      if (Audio.getIsPlaying()) return;

      const [num, den] = opt.dataset.value.split('/').map(Number);
      song = Grid.getSong();
      if (setTimeSignature(song, num, den)) {
        Grid.setSong(song);
        onSongChange(song);
        showToast(I18n.t('toastMeterChanged', num, den));
      }
      closeMeterPopover();
    });
  });

  document.addEventListener('click', (e) => {
    if (meterPopover && !meterPopover.classList.contains('hidden')) {
      if (!e.target.closest('#meter-control')) closeMeterPopover();
    }
    if (langPopover && !langPopover.classList.contains('hidden')) {
      if (!e.target.closest('#lang-control')) closeLangPopover();
    }
  });

  window.addEventListener('resize', () => {
    if (meterPopover && !meterPopover.classList.contains('hidden')) {
      positionMeterPopover();
    }
    if (langPopover && !langPopover.classList.contains('hidden')) {
      positionLangPopover();
    }
  });

  tempoSlider?.addEventListener('input', (e) => {
    if (Audio.getIsPlaying()) return;

    const idx = Number(e.target.value);
    const preset = TEMPO_PRESETS[idx];
    if (!preset) return;

    updateTempoDisplay(preset, idx);
  });

  tempoSlider?.addEventListener('change', (e) => {
    if (Audio.getIsPlaying()) return;

    const idx = Number(e.target.value);
    const preset = TEMPO_PRESETS[idx];
    if (!preset) return;

    song = Grid.getSong();
    song.tempo = preset.bpm;
    syncTempoSlider();
    onSongChange(song);
  });

  btnPlay?.addEventListener('click', async () => {
    Audio.unlockFromUserGesture();
    try {
      await Audio.preloadAudio();
    } catch {
      /* preload optional */
    }
    if (Audio.getIsPlaying()) {
      Audio.stopPlayback();
      return;
    }
    song = Grid.getSong();
    if (trimTrailingEmptyMeasures(song) > 0) {
      Grid.setSong(song);
      onSongChange(song);
    }
    await Audio.playSong(song);
  });

  btnLoop?.addEventListener('click', () => {
    const next = !Audio.getLoopEnabled();
    Audio.setLoopEnabled(next);
    btnLoop.setAttribute('aria-checked', next ? 'true' : 'false');
    btnLoop.classList.toggle('active', next);
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    song = Grid.getSong();
    Storage.downloadJson(song);
    showToast(I18n.t('toastSaved'));
  });

  document.getElementById('file-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      song = await Storage.uploadJson(file);
      song.tempo = normalizeTempo(song.tempo);
      Grid.setSong(song);
      onSongChange(song);
      showToast(I18n.t('toastLoaded'));
    } catch {
      showToast(I18n.t('toastReadError'));
    }
    e.target.value = '';
  });

  const helpModal = document.getElementById('help-modal');
  document.getElementById('btn-help')?.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
  });
  document.getElementById('help-close')?.addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
  helpModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
})();
