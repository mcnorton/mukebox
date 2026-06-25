/**
 * 피아노롤 UI — note-data.js API로 편집, dur 기준으로 칸 너비 렌더
 * Pointer Events: 탭=토글, 드래그=즉시 병합, 롱프레스=분할
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
    durToSixteenths,
  } = window.WMF;

  let BEAT_WIDTH = 48;
  let ROW_HEIGHT = 22;
  let BLACK_ROW_HEIGHT = 16;
  let KEY_WIDTH = 64;
  let RULER_HEIGHT = 32;

  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 8;
  const TOGGLE_DELAY_MOUSE = 250;

  let song = null;
  let onChange = null;
  let mergeSelection = null;

  function isCoarsePointer() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function updateLayoutSizes() {
    const coarse = isCoarsePointer();
    BEAT_WIDTH = coarse ? 60 : 48;
    KEY_WIDTH = coarse ? 72 : 64;

    const wrap = document.querySelector('.sequencer-wrap');
    const availableH = wrap?.clientHeight
      || window.innerHeight - (document.querySelector('.app-top')?.offsetHeight || 44)
        - (document.querySelector('.transport-bar')?.offsetHeight || 64);

    RULER_HEIGHT = coarse ? 36 : 28;

    const whiteCount = PITCHES.filter((p) => !isBlackKey(p)).length;
    const blackCount = PITCHES.length - whiteCount;
    const blackWeight = coarse ? 28 / 38 : 16 / 22;
    const percTracks = song?.tracks.filter((t) => t.type === 'percussion') || [];
    const drumRowUnits = percTracks.length
      ? percTracks.reduce((sum, t) => sum + (INSTRUMENTS[t.instrument]?.drumUnits || 2), 0)
      : 4;
    const totalUnits = whiteCount + blackCount * blackWeight + drumRowUnits;
    const rowArea = Math.max(0, availableH - RULER_HEIGHT);
    const unitH = totalUnits > 0 ? rowArea / totalUnits : (coarse ? 38 : 22);

    ROW_HEIGHT = Math.max(coarse ? 22 : 14, Math.floor(unitH));
    BLACK_ROW_HEIGHT = Math.max(coarse ? 16 : 10, Math.floor(unitH * blackWeight));
  }

  updateLayoutSizes();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateLayoutSizes();
      if (song) render();
    }, 100);
  });

  window.matchMedia('(pointer: coarse)').addEventListener('change', () => {
    updateLayoutSizes();
    if (song) render();
  });

  function initGrid(initialSong, changeCallback) {
    song = initialSong;
    onChange = changeCallback;
    render();
    requestAnimationFrame(() => {
      updateLayoutSizes();
      render();
    });
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

  function totalDrumHeight(inst) {
    const units = inst?.drumUnits || 2;
    return ROW_HEIGHT * units;
  }

  function render() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    updateLayoutSizes();
    container.innerHTML = '';
    container.dataset.timeSig = timeSignatureKey(song.timeSignature);

    const melodicTrack = song.tracks.find((t) => t.type === 'melodic');
    const percTracks = song.tracks.filter((t) => t.type === 'percussion');
    const melodicInst = INSTRUMENTS[melodicTrack.instrument];

    const inner = document.createElement('div');
    inner.className = 'sequencer-inner';

    const labelCol = document.createElement('div');
    labelCol.className = 'label-col piano-keys';
    labelCol.style.width = `${KEY_WIDTH}px`;
    labelCol.style.setProperty('--key-black-inset', `${Math.round(KEY_WIDTH * 0.44)}px`);

    const rulerSpacer = document.createElement('div');
    rulerSpacer.className = 'ruler-spacer';
    rulerSpacer.style.height = `${RULER_HEIGHT}px`;
    labelCol.appendChild(rulerSpacer);

    const melodyLabelArea = document.createElement('div');
    melodyLabelArea.className = 'melody-label-area';
    PITCHES.forEach((pitch) => {
      melodyLabelArea.appendChild(createPianoKey(pitch));
    });
    labelCol.appendChild(melodyLabelArea);

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
      drumArea.style.setProperty('--drum-color', inst.color);
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

    if (!black) {
      const idx = PITCHES.indexOf(pitch);
      const below = idx < PITCHES.length - 1 ? PITCHES[idx + 1] : null;
      if (below && !isBlackKey(below)) {
        key.classList.add('white-adjacent-below');
      }

      const solfege = document.createElement('span');
      solfege.className = 'key-solfege';
      solfege.textContent = getSolfege(pitch);

      const octave = document.createElement('span');
      octave.className = 'key-octave';
      const { octave: oct } = window.WMF.parsePitch(pitch);
      octave.textContent = String(oct);

      key.appendChild(solfege);
      key.appendChild(octave);
    }

    return key;
  }

  function createDrumKeyLabel(inst) {
    const key = document.createElement('div');
    key.className = 'piano-key drum-key-panel';
    key.style.height = `${totalDrumHeight(inst)}px`;
    key.style.setProperty('--drum-color', inst.color);
    key.title = inst.name;

    const label = document.createElement('span');
    label.className = 'drum-key-label';
    label.textContent = inst.name;

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

  function startMergeSelection(trackId, pitch, measureIndex, cellIndex, isDrum) {
    mergeSelection = {
      trackId,
      pitch: isDrum ? null : pitch,
      measureIndex,
      startCell: cellIndex,
      endCell: cellIndex,
      isDrum,
    };
    highlightMergeSelection();
  }

  function updateMergeFromPoint(clientX, clientY, pitch, measureIndex, isDrum) {
    const target = document.elementFromPoint(clientX, clientY);
    const targetCell = target?.closest('.lane-cell');
    if (!targetCell || !mergeSelection) return;

    const targetIdx = parseInt(targetCell.dataset.cellIndex, 10);
    const targetSeg = targetCell.closest('.lane-measure-seg');
    const targetMeasureIdx = parseInt(targetSeg?.dataset.measureIndex, 10);
    if (Number.isNaN(targetIdx) || targetMeasureIdx !== measureIndex) return;

    if (isDrum) {
      if (!targetCell.classList.contains('drum-lane-cell')) return;
    } else if (targetCell.dataset.pitch !== pitch) {
      return;
    }

    mergeSelection.endCell = targetIdx;
    highlightMergeSelection();
  }

  function applyInstantMerge(measure, pitch, isDrum) {
    if (!mergeSelection) return false;

    const { startCell, endCell } = mergeSelection;
    const start = Math.min(startCell, endCell);
    const end = Math.max(startCell, endCell);
    if (end <= start) return false;

    const beatCount = getBeatCount(song.timeSignature);
    if (isDrum) {
      mergeCells(measure, start, end, beatCount);
    } else {
      mergeLaneCells(measure, pitch, start, end, beatCount);
    }
    return true;
  }

  function clearMergeHighlight() {
    document.querySelectorAll('.lane-cell.selected-merge').forEach((el) => {
      el.classList.remove('selected-merge');
    });
  }

  function attachCellGestures(cellEl, config) {
    const {
      trackId, pitch, measureIndex, cellIndex, isDrum, measure,
      onToggle, onSplit,
    } = config;

    let toggleTimer = null;

    cellEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();

      try {
        cellEl.setPointerCapture(e.pointerId);
      } catch {
        /* capture may fail on some browsers */
      }
      cellEl.classList.add('pressed');

      const gesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        splitFired: false,
        longPressTimer: null,
      };

      startMergeSelection(trackId, pitch, measureIndex, cellIndex, isDrum);

      gesture.longPressTimer = setTimeout(() => {
        if (gesture.moved) return;
        gesture.splitFired = true;
        clearMergeHighlight();
        mergeSelection = null;
        if (onSplit()) {
          notifyChange();
          render();
        }
      }, LONG_PRESS_MS);

      const onPointerMove = (ev) => {
        if (ev.pointerId !== gesture.pointerId) return;

        const dx = ev.clientX - gesture.startX;
        const dy = ev.clientY - gesture.startY;
        if (!gesture.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
          gesture.moved = true;
          if (gesture.longPressTimer) {
            clearTimeout(gesture.longPressTimer);
            gesture.longPressTimer = null;
          }
        }

        if (gesture.moved) {
          updateMergeFromPoint(ev.clientX, ev.clientY, pitch, measureIndex, isDrum);
        }
      };

      const finishGesture = (ev) => {
        if (ev.pointerId !== gesture.pointerId) return;

        try {
          cellEl.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        cellEl.classList.remove('pressed');

        if (gesture.longPressTimer) {
          clearTimeout(gesture.longPressTimer);
          gesture.longPressTimer = null;
        }

        cellEl.removeEventListener('pointermove', onPointerMove);
        cellEl.removeEventListener('pointerup', finishGesture);
        cellEl.removeEventListener('pointercancel', finishGesture);

        if (gesture.splitFired) {
          mergeSelection = null;
          return;
        }

        clearMergeHighlight();

        if (gesture.moved && mergeSelection) {
          if (applyInstantMerge(measure, pitch, isDrum)) {
            notifyChange();
            render();
          }
          mergeSelection = null;
          return;
        }

        mergeSelection = null;

        if (!gesture.moved) {
          const doToggle = () => {
            onToggle();
            notifyChange();
            render();
          };

          if (ev.pointerType === 'mouse') {
            toggleTimer = setTimeout(doToggle, TOGGLE_DELAY_MOUSE);
          } else {
            doToggle();
          }
        }
      };

      cellEl.addEventListener('pointermove', onPointerMove);
      cellEl.addEventListener('pointerup', finishGesture);
      cellEl.addEventListener('pointercancel', finishGesture);
    });

    cellEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (toggleTimer) {
        clearTimeout(toggleTimer);
        toggleTimer = null;
      }
      if (onSplit()) {
        notifyChange();
        render();
      }
    });
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

    attachCellGestures(cellEl, {
      trackId: track.id,
      pitch,
      measureIndex,
      cellIndex,
      isDrum: false,
      measure,
      onToggle: () => toggleLaneCell(cell),
      onSplit: () => splitLaneCell(measure, pitch, cellIndex),
    });

    return cellEl;
  }

  function renderDrumLaneRow(track, inst) {
    const row = document.createElement('div');
    row.className = 'lane-row drum-lane-row white-key-row';
    row.style.height = `${totalDrumHeight(inst)}px`;

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

    attachCellGestures(cellEl, {
      trackId: track.id,
      pitch: null,
      measureIndex,
      cellIndex,
      isDrum: true,
      measure,
      onToggle: () => togglePercussionHit(cell),
      onSplit: () => splitCell(measure, cellIndex),
    });

    return cellEl;
  }

  function highlightMergeSelection() {
    clearMergeHighlight();
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

    active.forEach(({ pitch, trackId, measureIndex, cellIndex, isDrum }) => {
      if (isDrum) {
        const area = document.querySelector(`[data-track-id="${trackId}"]`);
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
