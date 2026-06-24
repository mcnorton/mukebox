/**
 * Web Music Factory — App entry point
 */

(function () {
  const { Grid, Audio, Storage, setTimeSignature, timeSignatureKey } = window.WMF;

  let song = Storage.loadInitialSong();

  function syncTimeSignatureSelect() {
    const select = document.getElementById('time-signature-select');
    if (select && song.timeSignature) {
      select.value = timeSignatureKey(song.timeSignature);
    }
  }

  function onSongChange(updated) {
    song = updated;
    Storage.saveToLocalStorage(song);
    const tempoEl = document.getElementById('tempo-display');
    if (tempoEl) tempoEl.textContent = song.tempo;
    syncTimeSignatureSelect();
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  Grid.initGrid(song, onSongChange);

  const tempoEl = document.getElementById('tempo-display');
  if (tempoEl) tempoEl.textContent = song.tempo;
  syncTimeSignatureSelect();

  document.getElementById('time-signature-select').addEventListener('change', (e) => {
    const [num, den] = e.target.value.split('/').map(Number);
    song = Grid.getSong();
    if (setTimeSignature(song, num, den)) {
      Grid.setSong(song);
      onSongChange(song);
      showToast(`박자를 ${num}/${den}(으)로 변경했습니다 (음표 유지)`);
    }
  });

  document.getElementById('btn-play').addEventListener('click', async () => {
    song = Grid.getSong();
    await Audio.playSong(song);
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    Audio.stopPlayback();
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    song = Grid.getSong();
    Storage.downloadJson(song);
    showToast('JSON 파일을 저장했습니다');
  });

  document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      song = await Storage.uploadJson(file);
      Grid.setSong(song);
      onSongChange(song);
      showToast('악보를 불러왔습니다');
    } catch {
      showToast('파일을 읽을 수 없습니다');
    }
    e.target.value = '';
  });

  document.getElementById('btn-share').addEventListener('click', () => {
    song = Grid.getSong();
    Storage.shareViaUrl(song);
    showToast('공유 URL이 클립보드에 복사되었습니다');
  });

  const helpModal = document.getElementById('help-modal');
  document.getElementById('btn-help').addEventListener('click', () => {
    helpModal.classList.remove('hidden');
  });
  document.getElementById('help-close').addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
  helpModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
})();
