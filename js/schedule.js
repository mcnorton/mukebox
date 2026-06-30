/**
 * 재생 스케줄 — note-data(dur)를 절대 초 이벤트로 변환 (재생은 audio.js가 담당)
 */

(function () {
  const { INSTRUMENTS, PITCHES, getTimeSignatureConfig, durToFloat } = window.WMF;

  /** 한 박의 길이(초) = 마디 길이 / beatCount */
  function beatDurationSec(tempo, timeSignature) {
    const cfg = getTimeSignatureConfig(timeSignature);
    const measureSec = (60 / tempo) * cfg.num * (4 / cfg.den);
    return measureSec / cfg.beatCount;
  }

  function cellDurationSec(cell, tempo, timeSignature) {
    return durToFloat(cell.dur) * beatDurationSec(tempo, timeSignature);
  }

  /** 곡 전체를 순회하며 연주 이벤트·셀 하이라이트 스케줄 생성 */
  function buildSchedule(song) {
    const events = [];
    const cells = [];
    const cfg = getTimeSignatureConfig(song.timeSignature);
    const beatSec = beatDurationSec(song.tempo, song.timeSignature);
    const measureSec = beatSec * cfg.beatCount;
    const measureCount = Math.max(...song.tracks.map((t) => t.measures.length), 1);

    for (let m = 0; m < measureCount; m += 1) {
      const measureStart = m * measureSec;

      song.tracks.forEach((track) => {
        const measure = track.measures[m];
        if (!measure) return;
        const inst = INSTRUMENTS[track.instrument];

        if (inst.type === 'melodic' && measure.lanes) {
          PITCHES.forEach((pitch) => {
            const lane = measure.lanes[pitch];
            if (!lane) return;
            let beatOffset = 0;

            lane.forEach((cell, cellIndex) => {
              const time = measureStart + beatOffset * beatSec;
              const duration = cellDurationSec(cell, song.tempo, song.timeSignature);

              if (cell.on) {
                events.push({
                  time,
                  type: 'melodic',
                  pitch,
                  duration: duration * 0.95,
                  measureIndex: m,
                  cellIndex,
                });
                cells.push({
                  time,
                  endTime: time + duration,
                  pitch,
                  measureIndex: m,
                  cellIndex,
                  isDrum: false,
                });
              }

              beatOffset += durToFloat(cell.dur);
            });
          });
        }

        if (inst.type === 'percussion' && measure.cells) {
          let beatOffset = 0;

          measure.cells.forEach((cell, cellIndex) => {
            const time = measureStart + beatOffset * beatSec;
            const duration = cellDurationSec(cell, song.tempo, song.timeSignature);

            if (cell.notes.includes('hit')) {
              events.push({
                time,
                type: 'percussion',
                instrument: track.instrument,
                pitch: 'C2',
                duration: 0.1,
                measureIndex: m,
                cellIndex,
              });
              cells.push({
                time,
                endTime: time + duration,
                trackId: track.id,
                measureIndex: m,
                cellIndex,
                isDrum: true,
              });
            }

            beatOffset += durToFloat(cell.dur);
          });
        }
      });
    }

    const totalDuration = measureCount * measureSec;
    return { events, cellSchedule: cells, totalDuration };
  }

  /** 오디오 워밍업 — C3→C5 크로매틱 32분음표 @ 120 BPM */
  function buildWarmupRecipe() {
    const tempo = 120;
    const timeSignature = { num: 4, den: 4 };
    const beatSec = beatDurationSec(tempo, timeSignature);
    const noteDur = beatSec / 8;

    const pitches = [...PITCHES].reverse();
    const events = [];

    events.push({ time: 0, type: 'percussion', instrument: 'bassDrum', duration: 0.05 });
    events.push({ time: 0.01, type: 'percussion', instrument: 'snareDrum', duration: 0.05 });
    events.push({ time: 0.02, type: 'percussion', instrument: 'triangle', duration: 0.05 });

    pitches.forEach((pitch, i) => {
      events.push({
        time: i * noteDur,
        type: 'melodic',
        pitch,
        duration: noteDur * 0.95,
      });
    });

    const totalDuration = pitches.length * noteDur + noteDur;
    return { events, totalDuration };
  }

  window.WMF = window.WMF || {};
  window.WMF.Schedule = { buildSchedule, buildWarmupRecipe, beatDurationSec, cellDurationSec };
})();
