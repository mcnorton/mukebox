/**
 * 피아노롤 UI — note-data.js API로 편집, dur 기준으로 칸 너비 렌더
 * Pointer Events: 탭=토글, 드래그=즉시 병합, 롱프레스=분할
 */

(function () {
  const {
    PITCHES,
    INSTRUMENTS,
    addMeasuresToAllTracks,
    isBlackKey,
    getSolfege,
    getTimeSignatureConfig,
    getBeatCount,
    timeSignatureKey,
    toggleLaneCellAt,
    splitLaneCell,
    mergeLaneCells,
    splitCell,
    mergeCells,
    togglePercussionHitAt,
    getNoteLabelForCell,
    durToSixteenths,
  } = window.WMF;

  let BEAT_WIDTH = 48;
  let ROW_HEIGHT = 22;
  let BLACK_ROW_HEIGHT = 16;
  let KEY_WIDTH = 64;
  let RULER_HEIGHT = 28;
  let ADD_COL_WIDTH = 44;

  // 빈 영역이 생기지 않도록 악보를 가로세로 동일 비율로 확대할 때의 한계
  const MIN_FILL_SCALE = 1;
  const MAX_FILL_SCALE = 4;

  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 8;
  const TOGGLE_DELAY_MOUSE = 250;

  let song = null;
  let onChange = null;
  let mergeSelection = null;

  function isCoarsePointer() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function isFinePointer() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function clearRowHoverHighlight() {
    document.querySelectorAll('.lane-row.row-hover-highlight, .piano-key.row-hover-highlight').forEach((el) => {
      el.classList.remove('row-hover-highlight');
    });
  }

  function setRowHoverHighlight(rowEl) {
    clearRowHoverHighlight();
    if (!rowEl) return;

    rowEl.classList.add('row-hover-highlight');

    const pitch = rowEl.dataset.pitch;
    if (pitch) {
      const key = document.querySelector(`.melody-label-area .piano-key[data-pitch="${pitch}"]`);
      key?.classList.add('row-hover-highlight');
      return;
    }

    const instrument = rowEl.dataset.instrument;
    if (instrument) {
      const key = document.querySelector(`.drum-key-panel[data-instrument="${instrument}"]`);
      key?.classList.add('row-hover-highlight');
    }
  }

  function attachRowHoverListeners(areaEl) {
    if (!isFinePointer()) return;

    areaEl.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const row = e.target.closest('.lane-row');
      if (row && areaEl.contains(row)) {
        setRowHoverHighlight(row);
      }
    });

    areaEl.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearRowHoverHighlight();
    });
  }

  function baseLayoutSizes() {
    const coarse = isCoarsePointer();
    return {
      beat: coarse ? 44 : 48,
      key: coarse ? 60 : 64,
      ruler: coarse ? 30 : 28,
      row: coarse ? 16 : 22,
      blackRow: coarse ? 12 : 16,
      addCol: coarse ? 52 : 44,
    };
  }

  function applyLayoutSizes(base, scale) {
    BEAT_WIDTH = Math.round(base.beat * scale);
    KEY_WIDTH = Math.round(base.key * scale);
    RULER_HEIGHT = Math.round(base.ruler * scale);
    ROW_HEIGHT = Math.round(base.row * scale);
    BLACK_ROW_HEIGHT = Math.round(base.blackRow * scale);
    ADD_COL_WIDTH = Math.round(base.addCol * scale);
  }

  function updateLayoutSizes() {
    applyLayoutSizes(baseLayoutSizes(), 1);
  }

  /** base 크기로 그렸을 때의 악보 콘텐츠 자연 크기(px) */
  function naturalContentSize(base) {
    const melodyH = PITCHES.reduce(
      (sum, pitch) => sum + (isBlackKey(pitch) ? base.blackRow : base.row),
      0,
    );
    let drumH = 0;
    (song?.tracks || [])
      .filter((t) => t.type === 'percussion')
      .forEach((t) => {
        const inst = INSTRUMENTS[t.instrument];
        drumH += base.row * (inst?.drumUnits || 2);
      });
    const height = base.ruler + melodyH + drumH;

    const cfg = getTimeSignatureConfig(song.timeSignature);
    const measureCount = getMaxMeasures();
    const width = base.key + measureCount * base.beat * cfg.beatCount + base.addCol;
    return { width, height };
  }

  /**
   * 사용 가능한 영역을 빈 공간 없이 채우도록, 가로·세로 동일 비율의 확대 배율을 계산.
   * 두 비율 중 큰 값을 사용해 한쪽이 정확히 들어차고 다른 쪽은 스크롤되도록 한다(축소는 안 함).
   */
  function computeFillScale(container) {
    if (!song || !container) return 1;
    const availW = container.clientWidth;
    const availH = container.clientHeight;
    if (!availW || !availH) return 1;

    const base = baseLayoutSizes();
    const { width, height } = naturalContentSize(base);
    if (!width || !height) return 1;

    const ratio = Math.max(availW / width, availH / height);
    return Math.min(MAX_FILL_SCALE, Math.max(MIN_FILL_SCALE, ratio));
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

  function getScoreScrollEl() {
    return document.getElementById('score-scroll');
  }

  function isMergeDragValid(clientX, clientY, pitch, measureIndex, isDrum) {
    const target = document.elementFromPoint(clientX, clientY);
    const targetCell = target?.closest('.lane-cell');
    if (!targetCell) return false;
    const targetSeg = targetCell.closest('.lane-measure-seg');
    const targetMeasureIdx = parseInt(targetSeg?.dataset.measureIndex, 10);
    if (Number.isNaN(targetMeasureIdx) || targetMeasureIdx !== measureIndex) return false;
    if (isDrum) {
      if (!targetCell.classList.contains('drum-lane-cell')) return false;
    } else if (targetCell.dataset.pitch !== pitch) {
      return false;
    }
    return true;
  }

  function applyScorePan(scrollEl, startX, startY, clientX, clientY, originScrollLeft, originScrollTop) {
    scrollEl.scrollLeft = originScrollLeft - (clientX - startX);
    scrollEl.scrollTop = originScrollTop - (clientY - startY);
  }

  function initScorePan(scrollEl) {
    scrollEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.lane-cell')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const pan = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scrollEl.scrollLeft,
        scrollTop: scrollEl.scrollTop,
      };

      const onMove = (ev) => {
        if (ev.pointerId !== pan.pointerId) return;
        applyScorePan(scrollEl, pan.startX, pan.startY, ev.clientX, ev.clientY, pan.scrollLeft, pan.scrollTop);
      };

      const onUp = (ev) => {
        if (ev.pointerId !== pan.pointerId) return;
        scrollEl.removeEventListener('pointermove', onMove);
        scrollEl.removeEventListener('pointerup', onUp);
        scrollEl.removeEventListener('pointercancel', onUp);
      };

      scrollEl.addEventListener('pointermove', onMove);
      scrollEl.addEventListener('pointerup', onUp);
      scrollEl.addEventListener('pointercancel', onUp);
    });
  }

  let scorePanBound = false;

  function bindScorePanOnce(scrollEl) {
    if (!scrollEl || scorePanBound) return;
    initScorePan(scrollEl);
    scorePanBound = true;
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
    applyLayoutSizes(baseLayoutSizes(), computeFillScale(container));
    const scoreScrollPrev = document.getElementById('score-scroll');
    const savedScrollLeft = scoreScrollPrev?.scrollLeft ?? 0;
    const savedScrollTop = scoreScrollPrev?.scrollTop ?? 0;
    scorePanBound = false;
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
    attachRowHoverListeners(melodyArea);
    timeline.appendChild(melodyArea);

    percTracks.forEach((track) => {
      const inst = INSTRUMENTS[track.instrument];
      const drumArea = document.createElement('div');
      drumArea.className = 'drum-area';
      drumArea.dataset.trackId = track.id;
      drumArea.style.setProperty('--drum-color', inst.color);
      drumArea.appendChild(renderDrumLaneRow(track, inst));
      attachRowHoverListeners(drumArea);
      timeline.appendChild(drumArea);
    });

    scrollWrap.appendChild(timeline);

    const addCol = document.createElement('div');
    addCol.className = 'add-col';
    addCol.style.width = `${ADD_COL_WIDTH}px`;
    const addSpacer = document.createElement('div');
    addSpacer.className = 'ruler-spacer';
    addSpacer.style.height = `${RULER_HEIGHT}px`;
    addCol.appendChild(addSpacer);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-measure';
    addBtn.title = '마디 4개 추가';
    addBtn.setAttribute('aria-label', '마디 4개 추가');
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => {
      addMeasuresToAllTracks(song);
      notifyChange();
      render();
    });
    addCol.appendChild(addBtn);

    inner.appendChild(labelCol);
    inner.appendChild(scrollWrap);
    inner.appendChild(addCol);

    const scoreScroll = document.createElement('div');
    scoreScroll.className = 'score-scroll';
    scoreScroll.id = 'score-scroll';
    scoreScroll.appendChild(inner);
    container.appendChild(scoreScroll);

    scoreScroll.scrollLeft = savedScrollLeft;
    scoreScroll.scrollTop = savedScrollTop;

    bindScorePanOnce(scoreScroll);

    updatePlayingHighlight();
  }

  function createPianoKey(pitch) {
    const key = document.createElement('div');
    const black = isBlackKey(pitch);
    key.className = `piano-key ${black ? 'black' : 'white'}`;
    key.style.height = `${rowHeight(pitch)}px`;
    key.dataset.pitch = pitch;
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

      key.appendChild(solfege);
    }

    return key;
  }

  function createDrumKeyLabel(inst) {
    const key = document.createElement('div');
    key.className = 'piano-key drum-key-panel';
    key.style.height = `${totalDrumHeight(inst)}px`;
    key.style.setProperty('--drum-color', inst.color);
    key.dataset.instrument = inst.id;
    key.title = inst.name;
    key.setAttribute('aria-label', inst.name);

    const icon = document.createElement('span');
    icon.className = 'drum-key-icon';
    icon.textContent = inst.symbol || '♪';
    icon.setAttribute('aria-hidden', 'true');

    key.appendChild(icon);
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
    return isDrum
      ? mergeCells(measure, start, end, beatCount)
      : mergeLaneCells(measure, pitch, start, end, beatCount);
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
      window.WMF.Audio?.unlockFromUserGesture?.();
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
        panMode: false,
        panScrollLeft: 0,
        panScrollTop: 0,
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
          if (!gesture.panMode) {
            const mergeValid = isMergeDragValid(ev.clientX, ev.clientY, pitch, measureIndex, isDrum);
            if (Math.abs(dy) > Math.abs(dx) || !mergeValid) {
              gesture.panMode = true;
              clearMergeHighlight();
              mergeSelection = null;
              const scrollEl = getScoreScrollEl();
              if (scrollEl) {
                gesture.panScrollLeft = scrollEl.scrollLeft;
                gesture.panScrollTop = scrollEl.scrollTop;
              }
            }
          }

          if (gesture.panMode) {
            const scrollEl = getScoreScrollEl();
            if (scrollEl) {
              applyScorePan(
                scrollEl,
                gesture.startX,
                gesture.startY,
                ev.clientX,
                ev.clientY,
                gesture.panScrollLeft,
                gesture.panScrollTop,
              );
            }
            return;
          }

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

        if (gesture.panMode) {
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
            if (toggleTimer) {
              clearTimeout(toggleTimer);
              toggleTimer = null;
            }
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
    const keyNoteClass = isBlackKey(pitch) ? 'black-key-note' : 'white-key-note';
    cellEl.type = 'button';
    cellEl.className = `lane-cell ${keyNoteClass} ${noteLengthClass(cell)}`;
    if (cell.on) cellEl.classList.add('active');
    cellEl.dataset.cellIndex = cellIndex;
    cellEl.dataset.pitch = pitch;
    cellEl.style.flex = `${cellFlexUnits(cell)}`;
    cellEl.style.minWidth = `${cellMinWidth(cell)}px`;
    cellEl.style.setProperty(
      '--note-color',
      isBlackKey(pitch) ? 'var(--note-black-key)' : 'var(--note-white-key)',
    );
    cellEl.title = `${pitch} · ${getNoteLabelForCell(cell)}음표`;

    attachCellGestures(cellEl, {
      trackId: track.id,
      pitch,
      measureIndex,
      cellIndex,
      isDrum: false,
      measure,
      onToggle: () => {
        window.WMF.Audio?.unlockFromUserGesture?.();
        toggleLaneCellAt(measure, pitch, cellIndex);
        if (cell.on) {
          window.WMF.Audio?.previewPitch?.(pitch);
        }
      },
      onSplit: () => splitLaneCell(measure, pitch, cellIndex),
    });

    return cellEl;
  }

  function renderDrumLaneRow(track, inst) {
    const row = document.createElement('div');
    row.className = 'lane-row drum-lane-row white-key-row';
    row.dataset.instrument = track.instrument;
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
    if (cell.notes.includes('hit')) {
      cellEl.classList.add('active');
      const sym = document.createElement('span');
      sym.className = 'drum-cell-symbol';
      sym.textContent = inst.symbol || '♪';
      sym.setAttribute('aria-hidden', 'true');
      cellEl.appendChild(sym);
    }
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
      onToggle: () => {
        window.WMF.Audio?.unlockFromUserGesture?.();
        togglePercussionHitAt(measure, cellIndex);
        if (cell.notes.includes('hit')) {
          window.WMF.Audio?.previewDrum?.(track.instrument);
        }
      },
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
