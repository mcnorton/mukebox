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
      help: '사용 방법',
      language: '언어',
      meter: '박자',
      selectMeter: '박자 선택',
      tempo: '템포',
      repeatLabel: '반복연주',
      play: '재생',
      stop: '정지',
      close: '닫기',
      helpTitle: '사용 방법',
      helpMelody: '<strong>멜로디</strong> — 칸을 탭해 음을 켜고 끕니다. (C3~C5, 반음 포함)',
      helpBassDrum: '<strong>큰북</strong> — 아래 행의 칸을 탭해 타격 on/off.',
      helpSplit: '<strong>분할</strong> — 칸을 길게 누르기 (또는 더블클릭) → 4분→8분→16분음표.',
      helpMerge: '<strong>병합</strong> — 같은 음의 인접 칸을 드래그하면 즉시 합쳐집니다.',
      helpScroll: '<strong>스크롤</strong> — 눈금·건반·빈 영역을 드래그해 상하좌우로 이동합니다.',
      helpMeasures: '<strong>마디</strong> — 오른쪽 <strong>+</strong> 버튼으로 마디 4개 추가. 재생 시 끝의 빈 마디는 4개 단위로 정리됩니다.',
      toastMeterChanged: (num, den) => `박자를 ${num}/${den}(으)로 변경했습니다 (음표 유지)`,
      toastSaved: 'JSON 파일을 저장했습니다',
      toastLoaded: '악보를 불러왔습니다',
      toastReadError: '파일을 읽을 수 없습니다',
      tempoName60: '아다지오',
      tempoName90: '안단테',
      tempoName120: '모데라토',
      tempoName140: '알레그로',
      tempoName160: '프레스토',
    },
    en: {
      save: 'Save',
      load: 'Load',
      help: 'Help',
      language: 'Language',
      meter: 'Meter',
      selectMeter: 'Select meter',
      tempo: 'Tempo',
      repeatLabel: 'Repeat',
      play: 'Play',
      stop: 'Stop',
      close: 'Close',
      helpTitle: 'How to use',
      helpMelody: '<strong>Melody</strong> — Tap cells to turn notes on/off. (C3–C5, including sharps)',
      helpBassDrum: '<strong>Bass drum</strong> — Tap cells in the row below to toggle hits.',
      helpSplit: '<strong>Split</strong> — Long-press (or double-click) a cell → quarter → eighth → sixteenth notes.',
      helpMerge: '<strong>Merge</strong> — Drag across adjacent cells with the same note to merge instantly.',
      helpScroll: '<strong>Scroll</strong> — Drag the ruler, keys, or empty area to pan.',
      helpMeasures: '<strong>Measures</strong> — Use the <strong>+</strong> button on the right to add 4 measures. Empty trailing measures are trimmed in groups of 4 on play.',
      toastMeterChanged: (num, den) => `Changed meter to ${num}/${den} (notes preserved)`,
      toastSaved: 'JSON file saved',
      toastLoaded: 'Score loaded',
      toastReadError: 'Could not read file',
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
