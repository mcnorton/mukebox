/**
 * 피아노롤 UI — note-data.js API로 편집, dur 기준으로 칸 너비 렌더
 */

(function () {
  const {
    PITCHES,
    INSTRUMENTS,
    addMeasureToAllTracks,
    isBlackKey,
    getSolfege,
    getTimeSignatureConfig,
    getBeatCount,
    timeSignatureKey,
    toggleLaneCell,
    splitLaneCell,
    mergeLaneCells,
    splitCell,
    mergeCells,
    togglePercussionHit,
    getNoteLabelForCell,
    getNoteLabelFromDur,
    durToSixteenths,
    durAdd,
    dur,
  } = window.WMF;

  const BEAT_WIDTH = 48;
  const ROW_HEIGHT = 22;
  const BLACK_ROW_HEIGHT = 16;
  const KEY_WIDTH = 64;
  const RULER_HEIGHT = 32;
  const CLICK_DELAY = 250;

  let song = null;
  let onChange = null;
  let mergeSelection = null;
  let clickTimers = new Map();

  function initGrid(initialSong, changeCallback) {
    song = initialSong;
    onChange = changeCallback;
    render();
  }

  function getSong() {
    return song;
  }

  function notifyChange() {
    if (onChange) onChange(song);
  }

  function getMaxMeasures() {
    return Math.max(...song.tracks.map((t) => t.measures.length), 1);
  }

  function measureWidth() {
    const cfg = getTimeSignatureConfig(song.timeSignature);
    return BEAT_WIDTH * cfg.beatCount;
  }

  function cellFlexUnits(cell) {
    return durToSixteenths(cell.dur, song.timeSignature);
  }

  function cellMinWidth(cell) {
    const units = getTimeSignatureConfig(song.timeSignature).unitsPerMeasure;
    return (cellFlexUnits(cell) / units) * measureWidth();
  }

  function rowHeight(pitch) {
    return isBlackKey(pitch) ? BLACK_ROW_HEIGHT : ROW_HEIGHT;
  }

  function totalMelodyHeight() {
    return PITCHES.reduce((sum, pitch) => sum + rowHeight(pitch), 0);
  }

  function totalDrumHeight() {
    return ROW_HEIGHT * 2;
  }

  function render() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    container.innerHTML = '';
    clickTimers.clear();
    container.dataset.timeSig = timeSignatureKey(song.timeSignature);

    const melodicTrack = song.tracks.find((t) => t.type === 'melodic');
    const percTracks = song.tracks.filter((t) => t.type === 'percussion');
    const melodicInst = INSTRUMENTS[melodicTrack.instrument];

    const inner = document.createElement('div');
    inner.className = 'sequencer-inner';

    const labelCol = document.createElement('div');
    labelCol.className = 'label-col piano-keys';
    labelCol.style.width = `${KEY_WIDTH}px`;

    const rulerSpacer = document.createElement('div');
    rulerSpacer.className = 'ruler-spacer';
    rulerSpacer.style.height = `${RULER_HEIGHT}px`;
    labelCol.appendChild(rulerSpacer);

    PITCHES.forEach((pitch) => {
      labelCol.appendChild(createPianoKey(pitch));
    });

    percTracks.forEach((track) => {
      const inst = INSTRUMENTS[track.instrument];
      labelCol.appendChild(createDrumKeyLabel(inst));
    });

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'timeline-scroll';
    scrollWrap.id = 'timeline-scroll';

    const timeline = document.createElement('div');
    timeline.className = 'timeline-col';

    timeline.appendChild(renderBeatRuler());

    const melodyArea = document.createElement('div');
    melodyArea.className = 'melody-area';
    melodyArea.dataset.trackId = melodicTrack.id;
    PITCHES.forEach((pitch) => {
      melodyArea.appendChild(renderLaneRow(melodicTrack, pitch, melodicInst));
    });
    timeline.appendChild(melodyArea);

    percTracks.forEach((track) => {
      const inst = INSTRUMENTS[track.instrument];
      const drumArea = document.createElement('div');
      drumArea.className = 'drum-area';
      drumArea.dataset.trackId = track.id;
      drumArea.appendChild(renderDrumLaneRow(track, inst));
      timeline.appendChild(drumArea);
    });

    scrollWrap.appendChild(timeline);

    const addCol = document.createElement('div');
    addCol.className = 'add-col';
    const addSpacer = document.createElement('div');
    addSpacer.className = 'ruler-spacer';
    addSpacer.style.height = `${RULER_HEIGHT}px`;
    addCol.appendChild(addSpacer);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-measure';
    addBtn.title = '마디 추가';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => {
      addMeasureToAllTracks(song);
      notifyChange();
      render();
    });
    addCol.appendChild(addBtn);

    inner.appendChild(labelCol);
    inner.appendChild(scrollWrap);
    inner.appendChild(addCol);
    container.appendChild(inner);

    updatePlayingHighlight();
  }

  function createPianoKey(pitch) {
    const key = document.createElement('div');
    const black = isBlackKey(pitch);
    key.className = `piano-key ${black ? 'black' : 'white'}`;
    key.style.height = `${rowHeight(pitch)}px`;
    key.title = pitch;

    const solfege = document.createElement('span');
    solfege.className = 'key-solfege';
    solfege.textContent = getSolfege(pitch);

    const octave = document.createElement('span');
    octave.className = 'key-octave';
    const { octave: oct } = window.WMF.parsePitch(pitch);
    octave.textContent = String(oct);

    key.appendChild(solfege);
    if (!black) key.appendChild(octave);
    return key;
  }

  function createDrumKeyLabel(inst) {
    const key = document.createElement('div');
    key.className = 'piano-key drum-key-panel';
    key.style.height = `${totalDrumHeight()}px`;
    key.title = inst.name;

    const label = document.createElement('span');
    label.className = 'drum-key-label';
    label.textContent = inst.name;

    const icon = document.createElement('span');
    icon.className = 'drum-key-icon';
    icon.textContent = '♪';

    key.appendChild(icon);
    key.appendChild(label);
    return key;
  }

  function renderBeatRuler() {
    const ruler = document.createElement('div');
    ruler.className = 'beat-ruler';
    ruler.style.height = `${RULER_HEIGHT}px`;

    const cfg = getTimeSignatureConfig(song.timeSignature);
    const maxMeasures = getMaxMeasures();

    for (let m = 0; m < maxMeasures; m += 1) {
      const measureRuler = document.createElement('div');
      measureRuler.className = 'beat-measure';
      measureRuler.style.width = `${measureWidth()}px`;

      for (let b = 1; b <= cfg.beatCount; b += 1) {
        const beat = document.createElement('span');
        beat.className = 'beat-mark';
        beat.style.width = `${BEAT_WIDTH}px`;
        beat.textContent = b;
        measureRuler.appendChild(beat);
      }
      ruler.appendChild(measureRuler);
    }
    return ruler;
  }

  function renderLaneRow(track, pitch, inst) {
    const row = document.createElement('div');
    row.className = `lane-row ${isBlackKey(pitch) ? 'black-key-row' : 'white-key-row'}`;
    row.dataset.pitch = pitch;
    row.style.height = `${rowHeight(pitch)}px`;

    track.measures.forEach((measure, measureIndex) => {
      const seg = document.createElement('div');
      seg.className = 'lane-measure-seg';
      seg.dataset.measureIndex = measureIndex;
      seg.style.width = `${measureWidth()}px`;

      const lane = measure.lanes[pitch] || [];
      lane.forEach((cell, cellIndex) => {
        seg.appendChild(createLaneCellEl(track, measure, pitch, measureIndex, cell, cellIndex, inst));
      });
      row.appendChild(seg);
    });
    return row;
  }

  function noteLengthClass(cell) {
    const sixteenths = Math.round(cellFlexUnits(cell));
    return `note-len-${sixteenths}`;
  }

  function createLaneCellEl(track, measure, pitch, measureIndex, cell, cellIndex, inst) {
    const cellEl = document.createElement('button');
    cellEl.type = 'button';
    cellEl.className = `lane-cell ${noteLengthClass(cell)}`;
    if (cell.on) cellEl.classList.add('active');
    cellEl.dataset.cellIndex = cellIndex;
    cellEl.dataset.pitch = pitch;
    cellEl.style.flex = `${cellFlexUnits(cell)}`;
    cellEl.style.minWidth = `${cellMinWidth(cell)}px`;
    cellEl.style.setProperty('--note-color', inst.color);
    cellEl.title = `${pitch} · ${getNoteLabelForCell(cell)}음표`;

    const timerKey = `${track.id}-${pitch}-${measureIndex}-${cellIndex}`;

    cellEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (clickTimers.has(timerKey)) {
        clearTimeout(clickTimers.get(timerKey));
        clickTimers.delete(timerKey);
        return;
      }
      const timer = setTimeout(() => {
        clickTimers.delete(timerKey);
        toggleLaneCell(cell);
        notifyChange();
        render();
      }, CLICK_DELAY);
      clickTimers.set(timerKey, timer);
    });

    cellEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (clickTimers.has(timerKey)) {
        clearTimeout(clickTimers.get(timerKey));
        clickTimers.delete(timerKey);
      }
      if (splitLaneCell(measure, pitch, cellIndex)) {
        notifyChange();
        render();
      }
    });

    cellEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startMergeSelection(track.id, pitch, measureIndex, cellIndex);
    });

    cellEl.addEventListener('mouseenter', () => {
      if (
        mergeSelection
        && mergeSelection.trackId === track.id
        && mergeSelection.pitch === pitch
        && mergeSelection.measureIndex === measureIndex
      ) {
        mergeSelection.endCell = cellIndex;
        highlightMergeSelection();
      }
    });

    return cellEl;
  }

  function renderDrumLaneRow(track, inst) {
    const row = document.createElement('div');
    row.className = 'lane-row drum-lane-row white-key-row';
    row.style.height = `${totalDrumHeight()}px`;

    track.measures.forEach((measure, measureIndex) => {
      const seg = document.createElement('div');
      seg.className = 'lane-measure-seg drum-measure-seg';
      seg.dataset.measureIndex = measureIndex;
      seg.style.width = `${measureWidth()}px`;

      measure.cells.forEach((cell, cellIndex) => {
        seg.appendChild(createDrumLaneCellEl(track, measure, measureIndex, cell, cellIndex, inst));
      });
      row.appendChild(seg);
    });
    return row;
  }

  function createDrumLaneCellEl(track, measure, measureIndex, cell, cellIndex, inst) {
    const cellEl = document.createElement('button');
    cellEl.type = 'button';
    cellEl.className = `lane-cell drum-lane-cell ${noteLengthClass(cell)}`;
    if (cell.notes.includes('hit')) cellEl.classList.add('active');
    cellEl.dataset.cellIndex = cellIndex;
    cellEl.style.flex = `${cellFlexUnits(cell)}`;
    cellEl.style.minWidth = `${cellMinWidth(cell)}px`;
    cellEl.style.setProperty('--note-color', inst.color);
    cellEl.title = `${inst.name} · ${getNoteLabelForCell(cell)}음표`;

    const timerKey = `drum-${track.id}-${measureIndex}-${cellIndex}`;

    cellEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (clickTimers.has(timerKey)) {
        clearTimeout(clickTimers.get(timerKey));
        clickTimers.delete(timerKey);
        return;
      }
      const timer = setTimeout(() => {
        clickTimers.delete(timerKey);
        togglePercussionHit(cell);
        notifyChange();
        render();
      }, CLICK_DELAY);
      clickTimers.set(timerKey, timer);
    });

    cellEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (clickTimers.has(timerKey)) {
        clearTimeout(clickTimers.get(timerKey));
        clickTimers.delete(timerKey);
      }
      if (splitCell(measure, cellIndex)) {
        notifyChange();
        render();
      }
    });

    cellEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startDrumMergeSelection(track.id, measureIndex, cellIndex);
    });

    cellEl.addEventListener('mouseenter', () => {
      if (
        mergeSelection
        && mergeSelection.trackId === track.id
        && mergeSelection.isDrum
        && mergeSelection.measureIndex === measureIndex
      ) {
        mergeSelection.endCell = cellIndex;
        highlightMergeSelection();
      }
    });

    return cellEl;
  }

  function startMergeSelection(trackId, pitch, measureIndex, cellIndex) {
    mergeSelection = { trackId, pitch, measureIndex, startCell: cellIndex, endCell: cellIndex, isDrum: false };
    highlightMergeSelection();
    document.addEventListener('mouseup', onMergeMouseUp, { once: true });
  }

  function startDrumMergeSelection(trackId, measureIndex, cellIndex) {
    mergeSelection = { trackId, pitch: null, measureIndex, startCell: cellIndex, endCell: cellIndex, isDrum: true };
    highlightMergeSelection();
    document.addEventListener('mouseup', onMergeMouseUp, { once: true });
  }

  function highlightMergeSelection() {
    document.querySelectorAll('.lane-cell.selected-merge').forEach((el) => {
      el.classList.remove('selected-merge');
    });
    if (!mergeSelection) return;

    const start = Math.min(mergeSelection.startCell, mergeSelection.endCell);
    const end = Math.max(mergeSelection.startCell, mergeSelection.endCell);
    const area = document.querySelector(`[data-track-id="${mergeSelection.trackId}"]`);
    if (!area) return;

    if (mergeSelection.isDrum) {
      const row = area.querySelector('.drum-lane-row');
      if (!row) return;
      const seg = row.querySelector(`.lane-measure-seg[data-measure-index="${mergeSelection.measureIndex}"]`);
      if (!seg) return;
      seg.querySelectorAll('.lane-cell').forEach((cellEl) => {
        const idx = parseInt(cellEl.dataset.cellIndex, 10);
        if (idx >= start && idx <= end) cellEl.classList.add('selected-merge');
      });
      return;
    }

    const row = area.querySelector(`.lane-row[data-pitch="${mergeSelection.pitch}"]`);
    if (!row) return;
    const seg = row.querySelector(`.lane-measure-seg[data-measure-index="${mergeSelection.measureIndex}"]`);
    if (!seg) return;
    seg.querySelectorAll('.lane-cell').forEach((cellEl) => {
      const idx = parseInt(cellEl.dataset.cellIndex, 10);
      if (idx >= start && idx <= end) cellEl.classList.add('selected-merge');
    });
  }

  function onMergeMouseUp() {
    if (!mergeSelection) return;
    const { trackId, pitch, measureIndex, startCell, endCell, isDrum } = mergeSelection;
    const start = Math.min(startCell, endCell);
    const end = Math.max(startCell, endCell);

    document.querySelectorAll('.selected-merge').forEach((el) => el.classList.remove('selected-merge'));

    if (end > start) showMergeModal(trackId, pitch, measureIndex, start, end, isDrum);
    mergeSelection = null;
  }

  function showMergeModal(trackId, pitch, measureIndex, start, end, isDrum) {
    const modal = document.getElementById('merge-modal');
    const msg = document.getElementById('merge-modal-message');
    const track = song.tracks.find((t) => t.id === trackId);
    if (!track || !modal) return;

    let totalDur;
    let cellCount;
    if (isDrum) {
      const cells = track.measures[measureIndex].cells.slice(start, end + 1);
      totalDur = cells.reduce((acc, c) => durAdd(acc, c.dur), dur(0, 1));
      cellCount = cells.length;
    } else {
      const lane = track.measures[measureIndex].lanes[pitch];
      const cells = lane.slice(start, end + 1);
      totalDur = cells.reduce((acc, c) => durAdd(acc, c.dur), dur(0, 1));
      cellCount = cells.length;
    }

    msg.textContent = `선택한 ${cellCount}칸을 ${getNoteLabelFromDur(totalDur)}음표로 합칠까요?`;
    modal.classList.remove('hidden');

    const okBtn = document.getElementById('merge-ok');
    const cancelBtn = document.getElementById('merge-cancel');

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => {
      const beatCount = getBeatCount(song.timeSignature);
      if (isDrum) {
        mergeCells(track.measures[measureIndex], start, end, beatCount);
      } else {
        mergeLaneCells(track.measures[measureIndex], pitch, start, end, beatCount);
      }
      notifyChange();
      render();
      cleanup();
    };

    const onCancel = () => cleanup();

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  }

  function highlightPlayingCells() {
    const audio = window.WMF.Audio;
    if (!audio || !audio.getIsPlaying()) {
      document.querySelectorAll('.lane-cell.playing').forEach((el) => {
        el.classList.remove('playing');
      });
      return;
    }

    const active = audio.getActiveCells ? audio.getActiveCells() : [];
    document.querySelectorAll('.lane-cell.playing').forEach((el) => {
      el.classList.remove('playing');
    });

    active.forEach(({ pitch, measureIndex, cellIndex, isDrum }) => {
      if (isDrum) {
        const area = document.querySelector('.drum-area');
        const row = area?.querySelector('.drum-lane-row');
        const seg = row?.querySelector(`.lane-measure-seg[data-measure-index="${measureIndex}"]`);
        const cellEl = seg?.querySelector(`.lane-cell[data-cell-index="${cellIndex}"]`);
        cellEl?.classList.add('playing');
      } else {
        const area = document.querySelector('.melody-area');
        const row = area?.querySelector(`.lane-row[data-pitch="${pitch}"]`);
        const seg = row?.querySelector(`.lane-measure-seg[data-measure-index="${measureIndex}"]`);
        const cellEl = seg?.querySelector(`.lane-cell[data-cell-index="${cellIndex}"]`);
        cellEl?.classList.add('playing');
      }
    });
  }

  function updatePlayingHighlight() {
    highlightPlayingCells();
  }

  function setSong(newSong) {
    song = newSong;
    render();
  }

  window.WMF = window.WMF || {};
  window.WMF.Grid = {
    initGrid,
    getSong,
    render,
    setSong,
    updatePlayingHighlight,
    updatePlayheadPosition: updatePlayingHighlight,
  };
})();
