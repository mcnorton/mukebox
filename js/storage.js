/**
 * MukeBox — Save / load / URL share
 */

(function () {
  const { serializeSong, deserializeSong, createDefaultSong } = window.WMF;

  const STORAGE_KEY = 'mukebox-song';
  const LEGACY_STORAGE_KEY = 'web-music-factory-song';

  function saveToLocalStorage(song) {
    try {
      localStorage.setItem(STORAGE_KEY, serializeSong(song));
      if (window.location.hash.startsWith('#song=')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) {
      console.warn('localStorage save failed', e);
    }
  }

  function loadFromLocalStorage() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          const migrated = deserializeSong(raw);
          saveToLocalStorage(migrated);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return migrated;
        }
      }
      if (raw) return deserializeSong(raw);
    } catch (e) {
      console.warn('localStorage load failed', e);
    }
    return null;
  }

  function sanitizeFilename(name) {
    return (name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  function getSongFilename(song) {
    const I18n = window.WMF?.I18n;
    const displayName = (song.name || '').trim()
      || (I18n ? I18n.t('untitledSong') : 'Untitled Song');
    return `MukeBox - ${sanitizeFilename(displayName)}.json`;
  }

  function downloadJson(song) {
    const blob = new Blob([serializeSong(song)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getSongFilename(song);
    a.click();
    URL.revokeObjectURL(url);
  }

  function uploadJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(deserializeSong(reader.result));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function encodeSongForUrl(song) {
    const json = serializeSong(song);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeSongFromUrl(encoded) {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return deserializeSong(json);
  }

  function shareViaUrl(song) {
    const encoded = encodeSongForUrl(song);
    const url = `${window.location.origin}${window.location.pathname}#song=${encoded}`;
    navigator.clipboard.writeText(url).catch(() => {});
    window.location.hash = `song=${encoded}`;
    return url;
  }

  function loadFromUrlHash() {
    const hash = window.location.hash;
    const match = hash.match(/^#song=(.+)$/);
    if (!match) return null;
    try {
      return decodeSongFromUrl(match[1]);
    } catch (e) {
      console.warn('URL hash decode failed', e);
      return null;
    }
  }

  function loadInitialSong() {
    const stored = loadFromLocalStorage();
    if (stored) return stored;

    const fromHash = loadFromUrlHash();
    if (fromHash) {
      saveToLocalStorage(fromHash);
      return fromHash;
    }

    return createDefaultSong();
  }

  window.WMF = window.WMF || {};
  window.WMF.Storage = {
    saveToLocalStorage,
    loadFromLocalStorage,
    downloadJson,
    uploadJson,
    shareViaUrl,
    loadFromUrlHash,
    loadInitialSong,
  };
})();
