/**
 * 공유 상수 — 박자 설정, 음역, 악기 레지스트리
 * (곡 데이터 CRUD는 note-data.js)
 */

const TIME_SIGNATURES = {
  '2/4': { num: 2, den: 4, unitsPerMeasure: 8, beatCount: 2, beatUnits: 4 },
  '3/4': { num: 3, den: 4, unitsPerMeasure: 12, beatCount: 3, beatUnits: 4 },
  '4/4': { num: 4, den: 4, unitsPerMeasure: 16, beatCount: 4, beatUnits: 4 },
  '6/8': { num: 6, den: 8, unitsPerMeasure: 12, beatCount: 6, beatUnits: 2 },
};

function timeSignatureKey(timeSignature) {
  return `${timeSignature.num}/${timeSignature.den}`;
}

function getTimeSignatureConfig(timeSignature) {
  return TIME_SIGNATURES[timeSignatureKey(timeSignature)] || TIME_SIGNATURES['4/4'];
}

const SOLFEGE = {
  C: '도', 'C#': '도#', D: '레', 'D#': '레#', E: '미', F: '파',
  'F#': '파#', G: '솔', 'G#': '솔#', A: '라', 'A#': '라#', B: '시',
};

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildPitches() {
  const list = [];
  for (let octave = 3; octave <= 5; octave += 1) {
    for (let i = 0; i < CHROMATIC.length; i += 1) {
      if (octave === 5 && i > 0) break;
      list.push(`${CHROMATIC[i]}${octave}`);
    }
  }
  return list.reverse();
}

const PITCHES = buildPitches();

function parsePitch(pitch) {
  const match = pitch.match(/^([A-G]#?)(\d)$/);
  if (!match) return { note: pitch, octave: 4 };
  return { note: match[1], octave: parseInt(match[2], 10) };
}

function isBlackKey(pitch) {
  return pitch.includes('#');
}

function getSolfege(pitch) {
  return SOLFEGE[parsePitch(pitch).note] || parsePitch(pitch).note;
}

const INSTRUMENTS = {
  piano: {
    id: 'piano',
    name: '피아노',
    type: 'melodic',
    section: 'melody',
    color: '#f06292',
    pitches: PITCHES,
  },
  bassDrum: {
    id: 'bassDrum',
    name: '큰북',
    type: 'percussion',
    section: 'percussion',
    color: '#ff9800',
    pitches: ['hit'],
    pitchLabels: { hit: '♪' },
    drumUnits: 2,
  },
  snareDrum: {
    id: 'snareDrum',
    name: '작은북',
    type: 'percussion',
    section: 'percussion',
    color: '#26a69a',
    pitches: ['hit'],
    pitchLabels: { hit: '♪' },
    drumUnits: 1,
  },
  triangle: {
    id: 'triangle',
    name: '트라이앵글',
    type: 'percussion',
    section: 'percussion',
    color: '#ab47bc',
    pitches: ['hit'],
    pitchLabels: { hit: '♪' },
    drumUnits: 1,
  },
};

if (typeof window !== 'undefined') {
  window.WMF = window.WMF || {};
  Object.assign(window.WMF, {
    TIME_SIGNATURES,
    timeSignatureKey,
    getTimeSignatureConfig,
    PITCHES,
    SOLFEGE,
    CHROMATIC,
    INSTRUMENTS,
    isBlackKey,
    getSolfege,
    parsePitch,
  });
}
