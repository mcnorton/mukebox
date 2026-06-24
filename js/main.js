/**
 * MukeBox — App entry point
 */

(function () {
  const { Grid, Audio, Storage, setTimeSignature, timeSignatureKey, normalizeTempo } = window.WMF;

  let song = Storage.loadInitialSong();
  song.tempo = normalizeTempo(song.tempo);

  const meterControl = document.getElementById('meter-control');
  const btnMeter = document.getElementById('btn-meter');
  const meterPopover = document.getElementById('meter-popover');
  const meterLabel = document.getElementById('meter-label');
  const tempoRadioGroup = document.getElementById('tempo-radio-group');
  const btnPlay = document.getElementById('btn-play');
  const playIcon = btnPlay?.querySelector('.play-icon');
  const btnLoop = document.getElementById('btn-loop');

  function syncMeterLabel() {
    if (!meterLabel || !song.timeSignature) return;
    const key = timeSignatureKey(song.timeSignature);
    meterLabel.textContent = `Meter ${key}`;

    document.querySelectorAll('.meter-option').forEach((opt) => {
      const selected = opt.dataset.value === key;
      opt.classList.toggle('is-selected', selected);
      opt.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function syncTempoRadios() {
    const bpm = String(normalizeTempo(song.tempo));
    const radio = document.querySelector(`input[name="tempo"][value="${bpm}"]`);
    if (radio) radio.checked = true;
  }

  function setTransportLocked(locked) {
    if (meterControl) meterControl.classList.toggle('transport-locked', locked);
    if (tempoRadioGroup) tempoRadioGroup.classList.toggle('transport-locked', locked);
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
    btnPlay.title = playing ? '정지' : '재생';
    btnPlay.setAttribute('aria-label', playing ? '정지' : '재생');
  }

  function closeMeterPopover() {
    if (!meterPopover || !btnMeter) return;
    meterPopover.classList.add('hidden');
    btnMeter.setAttribute('aria-expanded', 'false');
  }

  function openMeterPopover() {
    if (!meterPopover || !btnMeter || Audio.getIsPlaying()) return;
    meterPopover.classList.remove('hidden');
    btnMeter.setAttribute('aria-expanded', 'true');
  }

  function toggleMeterPopover() {
    if (!meterPopover || Audio.getIsPlaying()) return;
    if (meterPopover.classList.contains('hidden')) {
      openMeterPopover();
    } else {
      closeMeterPopover();
    }
  }

  function onSongChange(updated) {
    song = updated || Grid.getSong();
    song.tempo = normalizeTempo(song.tempo);
    Storage.saveToLocalStorage(song);
    syncMeterLabel();
    syncTempoRadios();
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

  Grid.initGrid(song, onSongChange);

  syncMeterLabel();
  syncTempoRadios();
  updatePlayButton();

  let audioPreloaded = false;
  function preloadAudioOnce() {
    if (audioPreloaded) return;
    audioPreloaded = true;
    Audio.preloadAudio().catch(() => {
      audioPreloaded = false;
    });
  }

  const appEl = document.querySelector('.app');
  if (appEl) {
    appEl.addEventListener('pointerdown', preloadAudioOnce, { once: true, passive: true });
  }

  btnMeter?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMeterPopover();
  });

  document.querySelectorAll('.meter-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      if (Audio.getIsPlaying()) return;

      const [num, den] = opt.dataset.value.split('/').map(Number);
      song = Grid.getSong();
      if (setTimeSignature(song, num, den)) {
        Grid.setSong(song);
        onSongChange(song);
        showToast(`박자를 ${num}/${den}(으)로 변경했습니다 (음표 유지)`);
      }
      closeMeterPopover();
    });
  });

  document.addEventListener('pointerdown', (e) => {
    if (!meterPopover || meterPopover.classList.contains('hidden')) return;
    if (e.target.closest('#meter-control')) return;
    closeMeterPopover();
  });

  tempoRadioGroup?.addEventListener('change', (e) => {
    if (Audio.getIsPlaying()) return;
    if (e.target.name !== 'tempo') return;

    song = Grid.getSong();
    song.tempo = normalizeTempo(Number(e.target.value));
    syncTempoRadios();
    onSongChange(song);
  });

  btnPlay?.addEventListener('click', async () => {
    preloadAudioOnce();
    if (Audio.getIsPlaying()) {
      Audio.stopPlayback();
      return;
    }
    song = Grid.getSong();
    await Audio.playSong(song);
  });

  btnLoop?.addEventListener('click', () => {
    const next = !Audio.getLoopEnabled();
    Audio.setLoopEnabled(next);
    btnLoop.setAttribute('aria-pressed', next ? 'true' : 'false');
    btnLoop.classList.toggle('active', next);
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    song = Grid.getSong();
    Storage.downloadJson(song);
    showToast('JSON 파일을 저장했습니다');
  });

  document.getElementById('file-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      song = await Storage.uploadJson(file);
      song.tempo = normalizeTempo(song.tempo);
      Grid.setSong(song);
      onSongChange(song);
      showToast('악보를 불러왔습니다');
    } catch {
      showToast('파일을 읽을 수 없습니다');
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
