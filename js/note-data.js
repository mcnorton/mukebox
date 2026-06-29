/**
 * MukeBox — Note data v3 (beat-fraction cells + I/O)
 * 1 beat = dur { n: 1, d: 1 }
 */

(function () {
  const {
    PITCHES,
    INSTRUMENTS,
    TIME_SIGNATURES,
    timeSignatureKey,
    getTimeSignatureConfig,
  } = window.WMF;

  const SONG_VERSION = 3;

  const TEMPO_PRESETS = [
    { bpm: 60, label: '아다지오' },
    { bpm: 90, label: '안단테' },
    { bpm: 120, label: '모데라토' },
    { bpm: 140, label: '알레그로' },
    { bpm: 160, label: '프레스토' },
  ];

  const DEFAULT_TEMPO = 120;

  function normalizeTempo(tempo) {
    const bpm = Number(tempo);
    if (!Number.isFinite(bpm)) return DEFAULT_TEMPO;

    let nearest = TEMPO_PRESETS[0].bpm;
    let minDiff = Math.abs(bpm - nearest);
    TEMPO_PRESETS.forEach(({ bpm: presetBpm }) => {
      const diff = Math.abs(bpm - presetBpm);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = presetBpm;
      }
    });
    return nearest;
  }

  // --- 박 기준 분수 (dur) 연산: 부동소수점 없이 음표 길이 표현 ---

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      [x, y] = [y, x % y];
    }
    return x || 1;
  }

  function dur(n, d) {
    if (d === 0) throw new Error('dur denominator cannot be 0');
    if (d < 0) return dur(-n, -d);
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function durToFloat(d) {
    return d.n / d.d;
  }

  function cloneDur(d) {
    return { n: d.n, d: d.d };
  }

  function durCmp(a, b) {
    return a.n * b.d - b.n * a.d;
  }

  function durAdd(a, b) {
    return dur(a.n * b.d + b.n * a.d, a.d * b.d);
  }

  function durSub(a, b) {
    return dur(a.n * b.d - b.n * a.d, a.d * b.d);
  }

  function getBeatCount(timeSignature) {
    return getTimeSignatureConfig(timeSignature).beatCount;
  }

  function durToSixteenths(d, timeSignature) {
    const beatUnits = getTimeSignatureConfig(timeSignature).beatUnits;
    return (d.n * beatUnits) / d.d;
  }

  const NOTE_LABELS_BY_DUR = {
    '1/4': '16분',
    '1/2': '8분',
    '1/1': '4분',
    '2/1': '2분',
    '4/1': '온',
  };

  function durKey(d) {
    return `${d.n}/${d.d}`;
  }

  function getNoteLabelFromDur(d) {
    return NOTE_LABELS_BY_DUR[durKey(d)] || `${d.n}/${d.d}박`;
  }

  function getNoteLabelForCell(cell) {
    return getNoteLabelFromDur(cell.dur);
  }

  // --- 곡·마디·칸 생성 ---

  function createLaneCell(durVal, on = false) {
    const d = durVal || dur(1, 1);
    return { dur: cloneDur(d), on };
  }

  function createPercussionCell(durVal, notes = []) {
    const d = durVal || dur(1, 1);
    return { dur: cloneDur(d), notes: [...notes] };
  }

  function createDefaultLane(timeSignature = { num: 4, den: 4 }) {
    const beatCount = getBeatCount(timeSignature);
    return Array.from({ length: beatCount }, () => createLaneCell(dur(1, 1), false));
  }

  function createMelodyMeasure(timeSignature = { num: 4, den: 4 }) {
    const lanes = {};
    PITCHES.forEach((pitch) => {
      lanes[pitch] = createDefaultLane(timeSignature);
    });
    return { lanes };
  }

  function createPercussionMeasure(timeSignature = { num: 4, den: 4 }) {
    const beatCount = getBeatCount(timeSignature);
    return {
      cells: Array.from({ length: beatCount }, () => createPercussionCell(dur(1, 1))),
    };
  }

  function createDefaultMeasure(type, timeSignature = { num: 4, den: 4 }) {
    return type === 'melodic'
      ? createMelodyMeasure(timeSignature)
      : createPercussionMeasure(timeSignature);
  }

  function createTrack(instrumentId, timeSignature = { num: 4, den: 4 }) {
    const inst = INSTRUMENTS[instrumentId];
    if (!inst) throw new Error(`Unknown instrument: ${instrumentId}`);
    return {
      id: inst.id,
      type: inst.type,
      instrument: instrumentId,
      measures: [createDefaultMeasure(inst.type, timeSignature)],
    };
  }

  function createDefaultSong() {
    const timeSignature = { num: 4, den: 4 };
    return {
      version: SONG_VERSION,
      tempo: DEFAULT_TEMPO,
      timeSignature,
      tracks: [
        createTrack('piano', timeSignature),
        createTrack('bassDrum', timeSignature),
        createTrack('snareDrum', timeSignature),
        createTrack('triangle', timeSignature),
      ],
    };
  }

  function addMeasure(track, timeSignature) {
    const ts = timeSignature || { num: 4, den: 4 };
    track.measures.push(createDefaultMeasure(track.type, ts));
  }

  function addMeasureToAllTracks(song) {
    song.tracks.forEach((track) => addMeasure(track, song.timeSignature));
  }

  function cloneMelodyCell(cell) {
    return createLaneCell(cell.dur, cell.on);
  }

  function clonePercussionCell(cell) {
    return createPercussionCell(cell.dur, cell.notes);
  }

  function collectLinearMelodyCells(measures, pitch) {
    return measures.flatMap((measure) => (
      (measure.lanes?.[pitch] || []).map(cloneMelodyCell)
    ));
  }

  function collectLinearPercussionCells(measures) {
    return measures.flatMap((measure) => (
      (measure.cells || []).map(clonePercussionCell)
    ));
  }

  /**
   * 선형 칸 배열을 beatCount 단위로 마디에 재포장.
   * dur 값은 유지하고, 마디 경계에서만 분할한다.
   */
  function repackCellsToLanes(cells, beatCount, isPercussion) {
    const target = dur(beatCount, 1);
    const measures = [];
    let idx = 0;
    const pending = cells.map((c) => (isPercussion ? clonePercussionCell(c) : cloneMelodyCell(c)));

    while (idx < pending.length || measures.length === 0) {
      const lane = [];
      let filled = dur(0, 1);

      while (durCmp(filled, target) < 0 && idx < pending.length) {
        const cell = pending[idx];
        const space = durSub(target, filled);

        if (durCmp(cell.dur, space) <= 0) {
          lane.push(isPercussion ? clonePercussionCell(cell) : cloneMelodyCell(cell));
          filled = durAdd(filled, cell.dur);
          idx += 1;
        } else {
          if (isPercussion) {
            lane.push(createPercussionCell(space, [...cell.notes]));
            pending[idx] = createPercussionCell(durSub(cell.dur, space), cell.notes);
          } else {
            lane.push(createLaneCell(space, cell.on));
            pending[idx] = createLaneCell(durSub(cell.dur, space), cell.on);
          }
          filled = target;
        }
      }

      if (durCmp(filled, target) < 0) {
        const pad = durSub(target, filled);
        lane.push(isPercussion ? createPercussionCell(pad) : createLaneCell(pad, false));
      }

      measures.push(lane);
      if (idx >= pending.length) break;
    }

    return measures.length ? measures : [createDefaultLane({ num: 4, den: 4 })];
  }

  function migrateMelodyTrack(track, oldTimeSignature, newTimeSignature) {
    const newBeatCount = getBeatCount(newTimeSignature);
    const pitchLanes = {};
    let maxMeasures = 0;

    PITCHES.forEach((pitch) => {
      const linear = collectLinearMelodyCells(track.measures, pitch);
      const repacked = repackCellsToLanes(linear, newBeatCount, false);
      pitchLanes[pitch] = repacked;
      maxMeasures = Math.max(maxMeasures, repacked.length);
    });

    const measures = [];
    for (let m = 0; m < maxMeasures; m += 1) {
      const lanes = {};
      PITCHES.forEach((pitch) => {
        lanes[pitch] = pitchLanes[pitch][m] || createDefaultLane(newTimeSignature);
      });
      measures.push({ lanes });
    }

    return measures.length ? measures : [createMelodyMeasure(newTimeSignature)];
  }

  function migratePercussionTrack(track, oldTimeSignature, newTimeSignature) {
    const newBeatCount = getBeatCount(newTimeSignature);
    const linear = collectLinearPercussionCells(track.measures);
    const repacked = repackCellsToLanes(linear, newBeatCount, true);
    return repacked.map((cells) => ({ cells }));
  }

  // --- 박자 변경: 트랙 전체 dur 선형화 → 새 beatCount로 재포장 ---

  function setTimeSignature(song, num, den) {
    const key = `${num}/${den}`;
    if (!TIME_SIGNATURES[key]) return false;

    const oldTimeSignature = { ...song.timeSignature };
    const newTimeSignature = { num, den };
    if (timeSignatureKey(oldTimeSignature) === key) return true;

    song.timeSignature = newTimeSignature;
    song.version = SONG_VERSION;
    song.tracks.forEach((track) => {
      track.measures = track.type === 'melodic'
        ? migrateMelodyTrack(track, oldTimeSignature, newTimeSignature)
        : migratePercussionTrack(track, oldTimeSignature, newTimeSignature);
    });
    return true;
  }

  // --- 편집: 분할(더블클릭) · 병합(드래그) · on/off 토글 ---

  function canSplitDur(d) {
    if (d.n >= 2 && d.d === 1) return true;
    return d.d < 16;
  }

  function splitDurInHalf(d) {
    if (d.n >= 2 && d.d === 1 && d.n % 2 === 0) {
      const half = dur(d.n / 2, 1);
      return [cloneDur(half), cloneDur(half)];
    }
    if (d.d < 16) {
      const half = dur(d.n, d.d * 2);
      return [cloneDur(half), cloneDur(half)];
    }
    return null;
  }

  function isMergedLongDur(d) {
    return d.d === 1 && d.n > 1;
  }

  function expandToBeatCells(durVal, isPercussion) {
    const count = durVal.n;
    return Array.from({ length: count }, () => (
      isPercussion ? createPercussionCell(dur(1, 1)) : createLaneCell(dur(1, 1), false)
    ));
  }

  function toggleLaneCellAt(measure, pitch, cellIndex) {
    const lane = measure.lanes[pitch];
    if (!lane) return false;
    const cell = lane[cellIndex];
    if (!cell) return false;

    if (cell.on) {
      cell.on = false;
      if (isMergedLongDur(cell.dur)) {
        lane.splice(cellIndex, 1, ...expandToBeatCells(cell.dur, false));
      }
    } else {
      cell.on = true;
    }
    return true;
  }

  function splitLaneCell(measure, pitch, cellIndex) {
    const lane = measure.lanes[pitch];
    if (!lane) return false;
    const cell = lane[cellIndex];
    if (!cell || !cell.on || !canSplitDur(cell.dur)) return false;

    const halves = splitDurInHalf(cell.dur);
    if (!halves) return false;

    const wasOn = cell.on;
    lane.splice(cellIndex, 1, createLaneCell(halves[0], wasOn), createLaneCell(halves[1], wasOn));
    return true;
  }

  function mergeLaneCells(measure, pitch, startIndex, endIndex, beatCountLimit) {
    const lane = measure.lanes[pitch];
    if (!lane) return false;

    const cells = lane.slice(startIndex, endIndex + 1);
    if (cells.length < 2) return false;
    if (!cells.some((c) => c.on)) return false;

    const maxBeats = beatCountLimit ?? getBeatCount({ num: 4, den: 4 });
    const totalDur = cells.reduce((acc, c) => durAdd(acc, c.dur), dur(0, 1));
    if (durCmp(totalDur, dur(maxBeats, 1)) > 0) return false;

    const merged = createLaneCell(totalDur, cells.some((c) => c.on));
    lane.splice(startIndex, cells.length, merged);
    return true;
  }

  function splitCell(measure, cellIndex) {
    const cell = measure.cells[cellIndex];
    if (!cell || !cell.notes.includes('hit') || !canSplitDur(cell.dur)) return false;

    const halves = splitDurInHalf(cell.dur);
    if (!halves) return false;

    measure.cells.splice(
      cellIndex,
      1,
      createPercussionCell(halves[0], [...cell.notes]),
      createPercussionCell(halves[1], []),
    );
    return true;
  }

  function mergeCells(measure, startIndex, endIndex, beatCountLimit) {
    const cells = measure.cells.slice(startIndex, endIndex + 1);
    if (cells.length < 2) return false;
    if (!cells.some((c) => c.notes.includes('hit'))) return false;

    const maxBeats = beatCountLimit ?? getBeatCount({ num: 4, den: 4 });
    const totalDur = cells.reduce((acc, c) => durAdd(acc, c.dur), dur(0, 1));
    if (durCmp(totalDur, dur(maxBeats, 1)) > 0) return false;

    measure.cells.splice(startIndex, cells.length, createPercussionCell(totalDur, [...cells[0].notes]));
    return true;
  }

  function togglePercussionHitAt(measure, cellIndex) {
    const cell = measure.cells[cellIndex];
    if (!cell) return false;

    if (cell.notes.includes('hit')) {
      cell.notes = [];
      if (isMergedLongDur(cell.dur)) {
        measure.cells.splice(cellIndex, 1, ...expandToBeatCells(cell.dur, true));
      }
    } else {
      cell.notes = ['hit'];
    }
    return true;
  }

  // --- 직렬화: v2 자동 업그레이드 포함 ---

  function upgradeV2LaneCell(cell, beatUnits) {
    return createLaneCell(dur(cell.lengthUnits, beatUnits), !!cell.on);
  }

  function upgradeV2PercussionCell(cell, beatUnits) {
    return createPercussionCell(dur(cell.lengthUnits, beatUnits), cell.notes || []);
  }

  function upgradeV2Measure(measure, trackType, timeSignature) {
    const beatUnits = getTimeSignatureConfig(timeSignature).beatUnits;
    if (trackType === 'melodic' && measure.lanes) {
      const lanes = {};
      PITCHES.forEach((pitch) => {
        const lane = measure.lanes[pitch];
        lanes[pitch] = lane
          ? lane.map((c) => upgradeV2LaneCell(c, beatUnits))
          : createDefaultLane(timeSignature);
      });
      return { lanes };
    }
    if (measure.cells) {
      return { cells: measure.cells.map((c) => upgradeV2PercussionCell(c, beatUnits)) };
    }
    return createDefaultMeasure(trackType, timeSignature);
  }

  function upgradeV2Song(data) {
    const timeSignature = data.timeSignature || { num: 4, den: 4 };
    return {
      version: SONG_VERSION,
      tempo: normalizeTempo(data.tempo ?? DEFAULT_TEMPO),
      timeSignature,
      tracks: (data.tracks || []).map((track) => ({
        ...track,
        measures: (track.measures || []).map((m) => upgradeV2Measure(m, track.type, timeSignature)),
      })),
    };
  }

  function normalizeV3Cell(cell, isPercussion) {
    if (cell.dur && typeof cell.dur.n === 'number') {
      return isPercussion
        ? createPercussionCell(cell.dur, cell.notes || [])
        : createLaneCell(cell.dur, !!cell.on);
    }
    return isPercussion ? createPercussionCell(dur(1, 1)) : createLaneCell(dur(1, 1), false);
  }

  function ensureDefaultPercussionTracks(song) {
    const timeSignature = song.timeSignature || { num: 4, den: 4 };
    const maxMeasures = Math.max(...song.tracks.map((t) => t.measures.length), 1);
    const requiredPercussion = ['bassDrum', 'snareDrum', 'triangle'];

    requiredPercussion.forEach((instrumentId) => {
      const exists = song.tracks.some((t) => t.instrument === instrumentId);
      if (exists) return;

      const track = createTrack(instrumentId, timeSignature);
      while (track.measures.length < maxMeasures) {
        addMeasure(track, timeSignature);
      }
      song.tracks.push(track);
    });
  }

  function normalizeV3Song(data) {
    const timeSignature = data.timeSignature || { num: 4, den: 4 };
    const song = {
      version: SONG_VERSION,
      tempo: normalizeTempo(data.tempo ?? DEFAULT_TEMPO),
      timeSignature,
      tracks: (data.tracks || []).map((track) => ({
        ...track,
        measures: (track.measures || []).map((m) => {
          if (track.type === 'melodic') {
            const lanes = {};
            PITCHES.forEach((pitch) => {
              lanes[pitch] = (m.lanes?.[pitch] || []).map((c) => normalizeV3Cell(c, false));
            });
            return { lanes };
          }
          return { cells: (m.cells || []).map((c) => normalizeV3Cell(c, true)) };
        }),
      })),
    };
    ensureDefaultPercussionTracks(song);
    return song;
  }

  function serializeSong(song) {
    return JSON.stringify(song);
  }

  function deserializeSong(json) {
    const data = JSON.parse(json);
    if (!data.version || !data.tracks) throw new Error('Invalid song data');
    if (data.version === 2) return normalizeV3Song(upgradeV2Song(data));
    if (data.version === SONG_VERSION) return normalizeV3Song(data);
    return createDefaultSong();
  }

  window.WMF = window.WMF || {};
  Object.assign(window.WMF, {
    SONG_VERSION,
    TEMPO_PRESETS,
    DEFAULT_TEMPO,
    normalizeTempo,
    dur,
    durAdd,
    durToFloat,
    durToSixteenths,
    getNoteLabelFromDur,
    getNoteLabelForCell,
    getBeatCount,
    durKey,
    createLaneCell,
    createPercussionCell,
    createDefaultLane,
    createMelodyMeasure,
    createPercussionMeasure,
    createDefaultMeasure,
    createTrack,
    createDefaultSong,
    addMeasure,
    addMeasureToAllTracks,
    setTimeSignature,
    toggleLaneCellAt,
    splitLaneCell,
    mergeLaneCells,
    splitCell,
    mergeCells,
    togglePercussionHitAt,
    serializeSong,
    deserializeSong,
  });
})();
