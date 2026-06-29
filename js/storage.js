/**
 * MukeBox — Save / load / library / URL share
 */

(function () {
  const { serializeSong, deserializeSong, createDefaultSong } = window.WMF;

  const LEGACY_SONG_KEY = 'mukebox-song';
  const LEGACY_WMF_KEY = 'web-music-factory-song';
  const INDEX_KEY = 'mukebox-library-index';
  const SONG_KEY_PREFIX = 'mukebox-song-';
  const INDEX_VERSION = 1;

  function songKey(id) {
    return `${SONG_KEY_PREFIX}${id}`;
  }

  function generateId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.entries)) return null;
      return data;
    } catch (e) {
      console.warn('library index read failed', e);
      return null;
    }
  }

  function writeIndex(index) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  function emptyIndex() {
    return { version: INDEX_VERSION, activeId: null, entries: [] };
  }

  function getIndex() {
    return readIndex() || emptyIndex();
  }

  // --- 마이그레이션: 레거시 단일 저장 → 라이브러리 1항목 ---

  function migrateToLibrary() {
    if (readIndex()) return;

    const index = emptyIndex();
    let legacyRaw = null;
    try {
      legacyRaw = localStorage.getItem(LEGACY_SONG_KEY) || localStorage.getItem(LEGACY_WMF_KEY);
    } catch {
      legacyRaw = null;
    }

    if (legacyRaw) {
      try {
        const song = deserializeSong(legacyRaw);
        const now = Date.now();
        const id = generateId();
        index.entries.push({
          id,
          name: (song.name || '').trim(),
          createdAt: now,
          updatedAt: now,
        });
        index.activeId = id;
        localStorage.setItem(songKey(id), serializeSong(song));
        writeIndex(index);
        try {
          localStorage.removeItem(LEGACY_SONG_KEY);
          localStorage.removeItem(LEGACY_WMF_KEY);
        } catch {
          /* ignore */
        }
        return;
      } catch (e) {
        console.warn('legacy migration failed', e);
      }
    }

    writeIndex(index);
  }

  // --- 라이브러리 CRUD ---

  /** createdAt 내림차순 (최근 → 오래된) */
  function listLibraryEntries() {
    const index = getIndex();
    return [...index.entries].sort((a, b) => b.createdAt - a.createdAt);
  }

  function getActiveId() {
    return getIndex().activeId;
  }

  function setActiveId(id) {
    const index = getIndex();
    index.activeId = id;
    writeIndex(index);
  }

  /**
   * 동일 기본명 그룹에서 생성 순으로 (2), (3)... 접미사를 붙인 표시명.
   * 저장된 name은 변경하지 않는다.
   */
  function getDisplayName(entry, allEntries) {
    const I18n = window.WMF?.I18n;
    const untitled = I18n ? I18n.t('untitledSong') : 'Untitled Song';
    const baseOf = (e) => (e.name || '').trim() || untitled;
    const base = baseOf(entry);

    const sameBase = allEntries
      .filter((e) => baseOf(e) === base)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (sameBase.length <= 1) return base;
    const ordinal = sameBase.findIndex((e) => e.id === entry.id);
    return ordinal === 0 ? base : `${base} (${ordinal + 1})`;
  }

  function loadSongById(id) {
    try {
      const raw = localStorage.getItem(songKey(id));
      if (!raw) return null;
      return deserializeSong(raw);
    } catch (e) {
      console.warn('loadSongById failed', e);
      return null;
    }
  }

  /** 활성 악보 저장 + 인덱스 name/updatedAt 갱신 */
  function saveActiveSong(song) {
    const index = getIndex();
    let id = index.activeId;

    if (!id || !index.entries.some((e) => e.id === id)) {
      return createLibraryEntry(song);
    }

    try {
      localStorage.setItem(songKey(id), serializeSong(song));
      const entry = index.entries.find((e) => e.id === id);
      if (entry) {
        entry.name = (song.name || '').trim();
        entry.updatedAt = Date.now();
      }
      writeIndex(index);
      if (window.location.hash.startsWith('#song=')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return id;
    } catch (e) {
      console.warn('saveActiveSong failed', e);
      throw e;
    }
  }

  /** 새 라이브러리 항목 생성 후 활성으로 설정. id 반환. */
  function createLibraryEntry(song) {
    const index = getIndex();
    const now = Date.now();
    const id = generateId();
    localStorage.setItem(songKey(id), serializeSong(song));
    index.entries.push({
      id,
      name: (song.name || '').trim(),
      createdAt: now,
      updatedAt: now,
    });
    index.activeId = id;
    writeIndex(index);
    return id;
  }

  function deleteLibraryEntry(id) {
    const index = getIndex();
    index.entries = index.entries.filter((e) => e.id !== id);
    if (index.activeId === id) index.activeId = null;
    writeIndex(index);
    try {
      localStorage.removeItem(songKey(id));
    } catch {
      /* ignore */
    }
  }

  // --- 파일 보내기 / 가져오기 ---

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

  // --- URL 공유 ---

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

  // --- 초기 로드 ---

  function loadInitialSong() {
    migrateToLibrary();

    const fromHash = loadFromUrlHash();
    if (fromHash) {
      createLibraryEntry(fromHash);
      return fromHash;
    }

    const index = getIndex();
    if (index.activeId) {
      const active = loadSongById(index.activeId);
      if (active) return active;
    }

    const entries = listLibraryEntries();
    if (entries.length) {
      const newest = entries[0];
      const song = loadSongById(newest.id);
      if (song) {
        setActiveId(newest.id);
        return song;
      }
    }

    const fresh = createDefaultSong();
    createLibraryEntry(fresh);
    return fresh;
  }

  window.WMF = window.WMF || {};
  window.WMF.Storage = {
    downloadJson,
    uploadJson,
    shareViaUrl,
    loadFromUrlHash,
    loadInitialSong,
    listLibraryEntries,
    getDisplayName,
    getActiveId,
    setActiveId,
    loadSongById,
    saveActiveSong,
    createLibraryEntry,
    deleteLibraryEntry,
  };
})();
