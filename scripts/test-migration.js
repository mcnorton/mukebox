/**
 * v3 beatFraction migration + schedule smoke tests.
 * Run: node scripts/test-migration.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadWMF() {
  const root = path.join(__dirname, '..', 'js');
  const sandbox = { window: { WMF: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'model.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'note-data.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'schedule.js'), 'utf8'), sandbox);
  return sandbox.window.WMF;
}

const WMF = loadWMF();
const {
  dur,
  durKey,
  createDefaultSong,
  createDefaultMeasure,
  createLaneCell,
  createPercussionCell,
  setTimeSignature,
  getBeatCount,
  splitLaneCell,
  mergeLaneCells,
  toggleLaneCellAt,
  deserializeSong,
} = WMF;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function laneDurKeys(measure, pitch) {
  return measure.lanes[pitch].map((c) => durKey(c.dur));
}

function testDefaultV3() {
  const song = createDefaultSong();
  assert(song.version === 3, 'default song is v3');
  assert(laneDurKeys(song.tracks[0].measures[0], 'C4').join(',') === '1/1,1/1,1/1,1/1', '4/4 default durs');
  console.log('OK v3 default song');
}

function testSplitPreservesDur() {
  const song = createDefaultSong();
  const m = song.tracks[0].measures[0];
  m.lanes.C4[0].on = true;
  splitLaneCell(m, 'C4', 0);
  assert(laneDurKeys(m, 'C4').slice(0, 2).join(',') === '1/2,1/2', '8분 split');
  setTimeSignature(song, 3, 4);
  setTimeSignature(song, 4, 4);
  assert(laneDurKeys(song.tracks[0].measures[0], 'C4').slice(0, 2).join(',') === '1/2,1/2', '8분 split survives TS change');
  console.log('OK dur split preserved on TS change');
}

function testEmptyCellSplitRejected() {
  const song = createDefaultSong();
  const m = song.tracks[0].measures[0];
  assert(!splitLaneCell(m, 'C4', 0), 'empty cell split rejected');
  console.log('OK empty cell split rejected');
}

function testMergedNoteOffResetsGrid() {
  const song = createDefaultSong();
  const m = song.tracks[0].measures[0];
  m.lanes.C4[0].on = true;
  m.lanes.C4[1].on = true;
  mergeLaneCells(m, 'C4', 0, 1, 4);
  assert(durKey(m.lanes.C4[0].dur) === '2/1', 'merged 2-beat cell');
  toggleLaneCellAt(m, 'C4', 0);
  assert(laneDurKeys(m, 'C4').slice(0, 2).join(',') === '1/1,1/1', '2-beat off resets to quarter cells');
  assert(!m.lanes.C4[0].on && !m.lanes.C4[1].on, 'reset cells are off');
  console.log('OK merged note off resets to 1/1 grid');
}

function testSubdividedNoteOffKeepsGrid() {
  const song = createDefaultSong();
  const m = song.tracks[0].measures[0];
  m.lanes.C4[0].on = true;
  splitLaneCell(m, 'C4', 0);
  toggleLaneCellAt(m, 'C4', 0);
  assert(laneDurKeys(m, 'C4').slice(0, 2).join(',') === '1/2,1/2', '8th-note grid preserved on off');
  assert(!m.lanes.C4[0].on, 'first eighth cell off');
  console.log('OK subdivided note off keeps grid');
}

function testTwoBeatMerge() {
  const song = createDefaultSong();
  const m = song.tracks[0].measures[0];
  mergeLaneCells(m, 'C4', 0, 1, 4);
  assert(durKey(m.lanes.C4[0].dur) === '2/1', '2박 merge');
  setTimeSignature(song, 3, 4);
  assert(durKey(song.tracks[0].measures[0].lanes.C4[0].dur) === '2/1', '2박 merge preserved');
  console.log('OK 2-beat merge preserved');
}

function setup34TwoMeasures(song) {
  const ts = { num: 3, den: 4 };
  song.timeSignature = ts;
  song.tracks.forEach((track) => {
    track.measures = [
      createDefaultMeasure(track.type, ts),
      createDefaultMeasure(track.type, ts),
    ];
  });
  const m1 = song.tracks[0].measures[0];
  const m2 = song.tracks[0].measures[1];
  m1.lanes.C4[0].on = true;
  m1.lanes.C4[1].on = true;
  m1.lanes.D4[1].on = true;
  m1.lanes.D4[2].on = true;
  m2.lanes.E4[1].on = true;
}

function beatOn(measure, pitch, beatIndex) {
  const lane = measure.lanes[pitch];
  let beat = 0;
  for (let i = 0; i < lane.length; i += 1) {
    const cell = lane[i];
    const cellBeats = cell.dur.n / cell.dur.d;
    if (Math.floor(beat) === beatIndex && beat === beatIndex) return cell.on;
    if (beat <= beatIndex && beatIndex < beat + cellBeats) return cell.on;
    beat += cellBeats;
  }
  return false;
}

function test34TwoMeasuresTo44() {
  const song = createDefaultSong();
  setup34TwoMeasures(song);
  setTimeSignature(song, 4, 4);
  assert(song.tracks[0].measures.length === 2, '3/4 2M → 4/4: 2 measures');
  const m1 = song.tracks[0].measures[0];
  const m2 = song.tracks[0].measures[1];
  assert(beatOn(m1, 'C4', 0) && beatOn(m1, 'C4', 1), 'M1 C4');
  assert(beatOn(m2, 'E4', 0), 'M2 E4 beat1');
  console.log('OK 3/4 2M → 4/4 linear repack');
}

function testV2Upgrade() {
  const v2 = {
    version: 2,
    tempo: 100,
    timeSignature: { num: 4, den: 4 },
    tracks: [{
      id: 'piano',
      type: 'melodic',
      instrument: 'piano',
      measures: [{
        lanes: {
          C4: [
            { lengthUnits: 2, on: true },
            { lengthUnits: 2, on: true },
            { lengthUnits: 4, on: false },
            { lengthUnits: 4, on: false },
            { lengthUnits: 4, on: false },
          ],
        },
      }],
    }],
  };
  const song = deserializeSong(JSON.stringify(v2));
  assert(song.version === 3, 'v2 upgraded to v3');
  assert(laneDurKeys(song.tracks[0].measures[0], 'C4').slice(0, 2).join(',') === '1/2,1/2', 'v2 8분 → dur 1/2');
  console.log('OK v2 → v3 upgrade');
}

function testSchedule() {
  const song = createDefaultSong();
  song.tracks[0].measures[0].lanes.C4[0].on = true;
  const { events, totalDuration } = WMF.Schedule.buildSchedule(song);
  assert(events.length >= 1, 'schedule has events');
  assert(events[0].time === 0, 'first note at 0');
  assert(totalDuration > 0, 'total duration');
  console.log('OK schedule build');
}

try {
  testDefaultV3();
  testSplitPreservesDur();
  testEmptyCellSplitRejected();
  testMergedNoteOffResetsGrid();
  testSubdividedNoteOffKeepsGrid();
  testTwoBeatMerge();
  test34TwoMeasuresTo44();
  testV2Upgrade();
  testSchedule();
  console.log('\nAll v3 tests passed.');
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
}
