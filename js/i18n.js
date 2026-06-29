/**
 * MukeBox — i18n (ko / en)
 */

(function () {
  const STORAGE_KEY = 'mukebox-lang';
  const SUPPORTED_LANGS = ['ko', 'en'];

  const STRINGS = {
    ko: {
      save: '저장',
      load: '불러오기',
      export: '보내기',
      import: '가져오기',
      rename: '이름 변경',
      saveState: '저장',
      savedState: '저장됨',
      untitledSong: '이름없송',
      library: '악보목록',
      newScore: '새 악보',
      open: '불러오기',
      delete: '삭제',
      deleteScoreTitle: '악보 삭제',
      deleteScoreMessage: '악보를 지우면 되살릴 수 없어요.',
      confirm: '확인',
      cancel: '취소',
      libraryEmpty: '저장된 악보가 없어요.',
      help: '사용 방법',
      install: '설치',
      installHintIOS: '공유 메뉴에서 "홈 화면에 추가"를 눌러 설치하세요',
      installTitleIOS: '홈 화면에 추가',
      installStepShare: 'Safari 도구막대에서 <strong>공유</strong> 버튼 <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-4px" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> 을 누르세요.',
      installStepAdd: '메뉴에서 <strong>홈 화면에 추가</strong>를 선택하세요.',
      installStepDone: '오른쪽 위 <strong>추가</strong>를 누르면 끝!',
      language: '언어',
      meter: '박자',
      selectMeter: '박자 선택',
      tempo: '템포',
      repeatLabel: '반복연주',
      play: '재생',
      stop: '정지',
      close: '닫기',
      helpTitle: '사용 방법',
      helpMelody: '<strong>음표넣기</strong> — 칸을 탭해 음표를 넣습니다.',
      helpSplit: '<strong>음표 나누기</strong> — 칸을 길게 누르기 (또는 더블클릭) → 4분→8분→16분음표.',
      helpMerge: '<strong>음표 합치기</strong> — 같은 음의 인접 칸을 드래그하면 즉시 합쳐집니다.',
      helpMeasures: '<strong>마디 추가</strong> — 오른쪽 <strong>+</strong> 버튼으로 마디 4개 추가. 재생 시 끝의 빈 마디는 4개 단위로 정리됩니다.',
      toastMeterChanged: (num, den) => `박자를 ${num}/${den}(으)로 변경했습니다 (음표 유지)`,
      toastSaved: 'JSON 파일을 저장했습니다',
      toastExported: '보내기 완료',
      toastLoaded: '악보를 불러왔습니다',
      toastImported: '악보를 가져왔습니다',
      toastReadError: '파일을 읽을 수 없습니다',
      toastScoreOpened: '악보를 불러왔습니다',
      toastScoreDeleted: '악보를 삭제했습니다',
      toastNewScore: '새 악보를 만들었습니다',
      toastStorageFull: '저장 공간이 부족합니다',
      tempoName60: '아다지오',
      tempoName90: '안단테',
      tempoName120: '모데라토',
      tempoName140: '알레그로',
      tempoName160: '프레스토',
    },
    en: {
      save: 'Save',
      load: 'Load',
      export: 'Export',
      import: 'Import',
      rename: 'Rename',
      saveState: 'Save',
      savedState: 'Saved',
      untitledSong: 'Untitled Song',
      library: 'Scores',
      newScore: 'New score',
      open: 'Open',
      delete: 'Delete',
      deleteScoreTitle: 'Delete score',
      deleteScoreMessage: 'Deleted scores cannot be recovered.',
      confirm: 'Confirm',
      cancel: 'Cancel',
      libraryEmpty: 'No saved scores.',
      help: 'Help',
      install: 'Install',
      installHintIOS: 'Tap the Share button, then "Add to Home Screen" to install',
      installTitleIOS: 'Add to Home Screen',
      installStepShare: 'Tap the <strong>Share</strong> button <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-4px" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> in the Safari toolbar.',
      installStepAdd: 'Choose <strong>Add to Home Screen</strong> from the menu.',
      installStepDone: 'Tap <strong>Add</strong> in the top-right. Done!',
      language: 'Language',
      meter: 'Meter',
      selectMeter: 'Select meter',
      tempo: 'Tempo',
      repeatLabel: 'Repeat',
      play: 'Play',
      stop: 'Stop',
      close: 'Close',
      helpTitle: 'How to use',
      helpMelody: '<strong>Add notes</strong> — Tap cells to add notes.',
      helpSplit: '<strong>Split notes</strong> — Long-press (or double-click) a cell → quarter → eighth → sixteenth notes.',
      helpMerge: '<strong>Merge notes</strong> — Drag across adjacent cells with the same note to merge instantly.',
      helpMeasures: '<strong>Add measures</strong> — Use the <strong>+</strong> button on the right to add 4 measures. Empty trailing measures are trimmed in groups of 4 on play.',
      toastMeterChanged: (num, den) => `Changed meter to ${num}/${den} (notes preserved)`,
      toastSaved: 'JSON file saved',
      toastExported: 'JSON file exported',
      toastLoaded: 'Score loaded',
      toastImported: 'Score imported',
      toastReadError: 'Could not read file',
      toastScoreOpened: 'Score opened',
      toastScoreDeleted: 'Score deleted',
      toastNewScore: 'New score created',
      toastStorageFull: 'Storage is full',
      tempoName60: 'Adagio',
      tempoName90: 'Andante',
      tempoName120: 'Moderato',
      tempoName140: 'Allegro',
      tempoName160: 'Presto',
    },
  };

  let currentLang = 'ko';
  const listeners = [];

  function loadLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGS.includes(stored)) {
        currentLang = stored;
      }
    } catch {
      /* ignore */
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
    currentLang = lang;
    saveLang(lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'ko';
    listeners.forEach((fn) => fn(lang));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function t(key, ...args) {
    const dict = STRINGS[currentLang] || STRINGS.ko;
    const val = dict[key];
    if (typeof val === 'function') return val(...args);
    if (val !== undefined) return val;
    const fallback = STRINGS.ko[key];
    if (typeof fallback === 'function') return fallback(...args);
    return fallback ?? key;
  }

  function tempoName(bpm) {
    return t(`tempoName${bpm}`) || String(bpm);
  }

  function applyStatic(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
  }

  loadLang();
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'ko';

  window.WMF = window.WMF || {};
  window.WMF.I18n = {
    getLang,
    setLang,
    onChange,
    t,
    tempoName,
    applyStatic,
    SUPPORTED_LANGS,
  };
})();
