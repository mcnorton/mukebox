/**
 * MukeBox — App entry point
 */

(function () {
  const {
    Grid, Audio, Storage, setTimeSignature, timeSignatureKey, normalizeTempo, TEMPO_PRESETS,
    trimTrailingEmptyMeasures, getSolfege, createDefaultSong,
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
  const songNameEl = document.getElementById('song-name');
  const btnRename = document.getElementById('btn-rename');
  const btnAutosave = document.getElementById('btn-autosave');
  const btnExport = document.getElementById('btn-export');
  const appTopLeft = document.querySelector('.app-top-left');
  const libraryControl = document.getElementById('library-control');
  const btnLibrary = document.getElementById('btn-library');
  const libraryPopover = document.getElementById('library-popover');
  const btnNewScore = document.getElementById('btn-new-score');
  const deleteModal = document.getElementById('delete-score-modal');
  const welcomeModal = document.getElementById('welcome-modal');
  const welcomeStart = document.getElementById('welcome-start');

  const AUTOSAVE_DELAY_MS = 10000;
  let autosaveTimer = null;
  let isDirty = false;
  let isRenaming = false;
  let cancelActiveRename = null;
  let selectedLibraryId = null;
  let pendingDeleteId = null;

  function updateSongNameDisplay() {
    if (!songNameEl || isRenaming) return;
    const name = (song.name || '').trim();
    if (name) {
      songNameEl.textContent = name;
      songNameEl.classList.remove('is-untitled');
    } else {
      songNameEl.textContent = I18n.t('untitledSong');
      songNameEl.classList.add('is-untitled');
    }
  }

  function updateAutosaveButton() {
    if (!btnAutosave) return;
    if (isDirty) {
      btnAutosave.textContent = I18n.t('saveState');
      btnAutosave.classList.remove('is-saved');
      btnAutosave.classList.add('is-dirty');
    } else {
      btnAutosave.textContent = I18n.t('savedState');
      btnAutosave.classList.remove('is-dirty');
      btnAutosave.classList.add('is-saved');
    }
  }

  function setAutosaveDirty() {
    isDirty = true;
    updateAutosaveButton();
  }

  function setAutosaveSaved() {
    isDirty = false;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    updateAutosaveButton();
  }

  function performAutosave() {
    song = Grid.getSong();
    song.tempo = normalizeTempo(song.tempo);
    try {
      Storage.saveActiveSong(song);
      setAutosaveSaved();
      return true;
    } catch {
      showToast(I18n.t('toastStorageFull'));
      return false;
    }
  }

  /** 현재 악보를 저장하고 다른 악보로 전환 (재생 중이면 정지) */
  function switchToSong(nextSong) {
    if (isRenaming && cancelActiveRename) cancelActiveRename();
    if (Audio.getIsPlaying()) Audio.stopPlayback();
    song = nextSong;
    song.tempo = normalizeTempo(song.tempo);
    if (typeof song.name !== 'string') song.name = '';
    Grid.setSong(song);
    syncMeterLabel();
    syncTempoSlider();
    updateSongNameDisplay();
    setAutosaveSaved();
  }

  function scheduleAutosave() {
    setAutosaveDirty();
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      performAutosave();
    }, AUTOSAVE_DELAY_MS);
  }

  /** 탭 이탈·숨김 시 보류 중인 변경을 즉시 저장 (디바운스 유실 방지) */
  function flushAutosave() {
    if (isDirty) performAutosave();
  }

  function startRenameEdit() {
    if (!songNameEl || isRenaming) return;
    isRenaming = true;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'song-name-input';
    input.value = (song.name || '').trim();
    input.setAttribute('aria-label', I18n.t('rename'));
    input.maxLength = 64;

    const commitRename = () => {
      if (!isRenaming) return;
      isRenaming = false;
      cancelActiveRename = null;
      const newName = input.value.trim();
      input.replaceWith(songNameEl);
      if (newName !== (song.name || '').trim()) {
        song = Grid.getSong();
        song.name = newName;
        onSongChange(song);
      }
      updateSongNameDisplay();
    };

    const cancelRename = () => {
      if (!isRenaming) return;
      isRenaming = false;
      cancelActiveRename = null;
      input.replaceWith(songNameEl);
      updateSongNameDisplay();
    };

    cancelActiveRename = cancelRename;

    songNameEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    });

    input.addEventListener('blur', () => {
      commitRename();
    });
  }

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
    updateSongNameDisplay();
    updateAutosaveButton();
    if (libraryPopover && !libraryPopover.classList.contains('hidden')) {
      renderLibraryList();
    }
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

  const PLAY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="m238.23 342.43 89.09-74.13a16 16 0 0 0 0-24.6l-89.09-74.13A16 16 0 0 0 212 181.86v148.28a16 16 0 0 0 26.23 12.29" fill="currentColor"/><path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192Z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/></svg>';
  const STOP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="176" y="176" width="160" height="160" rx="16" fill="currentColor"/><path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192Z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/></svg>';

  function updatePlayButton() {
    const playing = Audio.getIsPlaying();
    if (!btnPlay || !playIcon) return;

    btnPlay.classList.toggle('playing', playing);
    playIcon.innerHTML = playing ? STOP_ICON_SVG : PLAY_ICON_SVG;
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
    closeLibraryPopover();
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

  function positionLibraryPopover() {
    if (!libraryPopover || !btnLibrary) return;
    const rect = btnLibrary.getBoundingClientRect();
    const margin = 8;
    libraryPopover.style.top = `${rect.bottom + 8}px`;

    const width = libraryPopover.offsetWidth || libraryPopover.getBoundingClientRect().width;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    left = Math.max(margin, left);
    libraryPopover.style.left = `${left}px`;
    libraryPopover.style.setProperty('--library-arrow-left', `${rect.left + rect.width / 2 - left}px`);
  }

  function renderLibraryList() {
    if (!libraryPopover) return;
    libraryPopover.innerHTML = '';

    const entries = Storage.listLibraryEntries();
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'library-empty';
      empty.textContent = I18n.t('libraryEmpty');
      libraryPopover.appendChild(empty);
      return;
    }

    const activeId = Storage.getActiveId();

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'library-row';
      row.dataset.id = entry.id;
      row.setAttribute('role', 'option');
      if (entry.id === activeId) row.classList.add('is-active');
      if (entry.id === selectedLibraryId) row.classList.add('is-selected');

      const nameEl = document.createElement('span');
      nameEl.className = 'library-row-name';
      nameEl.textContent = Storage.getDisplayName(entry, entries);
      row.appendChild(nameEl);

      const actions = document.createElement('div');
      actions.className = 'library-row-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'library-open-btn';
      openBtn.textContent = I18n.t('open');
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openLibrarySong(entry.id);
      });
      actions.appendChild(openBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'library-delete-btn';
      deleteBtn.textContent = '🗑️';
      deleteBtn.setAttribute('aria-label', I18n.t('delete'));
      deleteBtn.title = I18n.t('delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(entry.id);
      });
      actions.appendChild(deleteBtn);

      row.appendChild(actions);

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedLibraryId = selectedLibraryId === entry.id ? null : entry.id;
        renderLibraryList();
      });

      libraryPopover.appendChild(row);
    });
  }

  function closeLibraryPopover() {
    if (!libraryPopover || !btnLibrary) return;
    libraryPopover.classList.add('hidden');
    btnLibrary.setAttribute('aria-expanded', 'false');
    appTopLeft?.classList.remove('is-open');
  }

  function openLibraryPopover() {
    if (!libraryPopover || !btnLibrary) return;
    closeLangPopover();
    closeMeterPopover();
    selectedLibraryId = null;
    renderLibraryList();
    libraryPopover.classList.remove('hidden');
    positionLibraryPopover();
    btnLibrary.setAttribute('aria-expanded', 'true');
    appTopLeft?.classList.add('is-open');
  }

  function toggleLibraryPopover() {
    if (!libraryPopover) return;
    if (libraryPopover.classList.contains('hidden')) {
      openLibraryPopover();
    } else {
      closeLibraryPopover();
    }
  }

  function openLibrarySong(id) {
    performAutosave();
    const next = Storage.loadSongById(id);
    if (!next) return;
    Storage.setActiveId(id);
    switchToSong(next);
    closeLibraryPopover();
    showToast(I18n.t('toastScoreOpened'));
  }

  function openDeleteModal(id) {
    pendingDeleteId = id;
    deleteModal?.classList.remove('hidden');
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    deleteModal?.classList.add('hidden');
  }

  function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    const wasActive = Storage.getActiveId() === id;
    Storage.deleteLibraryEntry(id);
    if (selectedLibraryId === id) selectedLibraryId = null;

    if (wasActive) {
      const entries = Storage.listLibraryEntries();
      if (entries.length) {
        const next = Storage.loadSongById(entries[0].id);
        if (next) {
          Storage.setActiveId(entries[0].id);
          switchToSong(next);
        }
      } else {
        const fresh = createDefaultSong();
        Storage.createLibraryEntry(fresh);
        switchToSong(fresh);
      }
    }

    closeDeleteModal();
    if (!libraryPopover?.classList.contains('hidden')) renderLibraryList();
    showToast(I18n.t('toastScoreDeleted'));
  }

  function createNewScore() {
    performAutosave();
    const fresh = createDefaultSong();
    fresh.name = Storage.previewUntitledName(Storage.listLibraryEntries());
    const id = Storage.createLibraryEntry(fresh);
    const reloaded = Storage.loadSongById(id) || fresh;
    switchToSong(reloaded);
    closeLibraryPopover();
    showToast(I18n.t('toastNewScore'));
  }

  const newScoreModal = document.getElementById('new-score-modal');

  function openNewScoreModal() {
    newScoreModal?.classList.remove('hidden');
  }

  function closeNewScoreModal() {
    newScoreModal?.classList.add('hidden');
  }

  function onSongChange(updated) {
    song = updated || Grid.getSong();
    song.tempo = normalizeTempo(song.tempo);
    scheduleAutosave();
    syncMeterLabel();
    syncTempoSlider();
    updateSongNameDisplay();
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
  updateSongNameDisplay();
  setAutosaveSaved();

  let welcomeCompleted = false;

  function showWelcomeModal() {
    welcomeModal?.classList.remove('hidden');
  }

  function closeWelcomeModal() {
    welcomeModal?.classList.add('hidden');
  }

  async function onWelcomeStart() {
    if (welcomeCompleted || !welcomeStart) return;
    welcomeStart.disabled = true;
    try {
      await Audio.startWithWarmup();
      welcomeCompleted = true;
      closeWelcomeModal();
    } catch {
      welcomeStart.disabled = false;
    }
  }

  welcomeStart?.addEventListener('click', onWelcomeStart);
  showWelcomeModal();

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

  document.addEventListener('pointerdown', (e) => {
    if (!libraryPopover || libraryPopover.classList.contains('hidden')) return;
    if (!e.target.closest('#library-control')) closeLibraryPopover();
  }, true);

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
    if (libraryPopover && !libraryPopover.classList.contains('hidden')) {
      positionLibraryPopover();
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

  btnRename?.addEventListener('click', (e) => {
    e.stopPropagation();
    startRenameEdit();
  });

  btnAutosave?.addEventListener('click', () => {
    performAutosave();
  });

  btnExport?.addEventListener('click', () => {
    song = Grid.getSong();
    Storage.downloadJson(song);
    showToast(I18n.t('toastExported'));
  });

  document.getElementById('file-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      performAutosave();
      const imported = await Storage.uploadJson(file);
      if (typeof imported.name !== 'string') imported.name = '';
      Storage.createLibraryEntry(imported);
      switchToSong(imported);
      showToast(I18n.t('toastImported'));
    } catch {
      showToast(I18n.t('toastReadError'));
    }
    e.target.value = '';
  });

  btnLibrary?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLibraryPopover();
  });

  btnNewScore?.addEventListener('click', (e) => {
    e.stopPropagation();
    openNewScoreModal();
  });

  document.getElementById('new-score-confirm')?.addEventListener('click', () => {
    closeNewScoreModal();
    createNewScore();
  });
  document.getElementById('new-score-cancel')?.addEventListener('click', closeNewScoreModal);
  newScoreModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeNewScoreModal);

  document.getElementById('delete-confirm')?.addEventListener('click', confirmDelete);
  document.getElementById('delete-cancel')?.addEventListener('click', closeDeleteModal);
  deleteModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeDeleteModal);

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

  window.addEventListener('pagehide', flushAutosave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutosave();
  });

  window.WMF.saveActiveScoreNow = () => performAutosave();
})();
