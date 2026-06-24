/**
 * Web Music Factory — Save / load / URL share
 */

(function () {
  const { serializeSong, deserializeSong, createDefaultSong } = window.WMF;

  const STORAGE_KEY = 'web-music-factory-song';

  function saveToLocalStorage(song) {
    try {
      localStorage.setItem(STORAGE_KEY, serializeSong(song));
    } catch (e) {
      console.warn('localStorage save failed', e);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return deserializeSong(raw);
    } catch (e) {
      console.warn('localStorage load failed', e);
    }
    return null;
  }

  function downloadJson(song) {
    const blob = new Blob([serializeSong(song)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-song.json';
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
    return loadFromUrlHash() || loadFromLocalStorage() || createDefaultSong();
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
