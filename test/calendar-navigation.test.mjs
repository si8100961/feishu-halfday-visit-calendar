import test from 'node:test';
import assert from 'node:assert/strict';
import { CalendarNavigation } from '../src/calendar-navigation.mjs';
import { dateKey, weekDates } from '../src/domain.mjs';

const sunday=Date.parse('2026-10-25T23:59:59+08:00');
const monday=Date.parse('2026-10-26T00:00:01+08:00');
test('default calendar follows Shanghai midnight into the new week',()=>{
  const n=new CalendarNavigation(sunday);
  assert.equal(n.anchor,'2026-10-25'); assert.equal(n.sync(monday),true);
  assert.equal(n.anchor,'2026-10-26');
  assert.deepEqual([weekDates(n.anchor)[0],weekDates(n.anchor)[6]],['2026-10-26','2026-11-01']);
  assert.equal(n.sync(monday),false);
});
test('business dates do not switch an hour early with Tokyo midnight',()=>{
  const instant=Date.parse('2026-10-26T00:30:00+09:00');
  assert.equal(dateKey(instant),'2026-10-25');
  assert.equal(new CalendarNavigation(instant).anchor,'2026-10-25');
});
test('explicit browsing retains the chosen week but refreshes today',()=>{
  const n=new CalendarNavigation(sunday); n.shift(-7); n.sync(monday);
  assert.equal(n.anchor,'2026-10-18'); assert.equal(n.today,'2026-10-26');
  n.current(monday); assert.equal(n.anchor,'2026-10-26'); assert.equal(n.followToday,true);
});
test('returning after sleep catches multiple missed days and month/year boundaries',()=>{
  const n=new CalendarNavigation(sunday);n.sync(Date.parse('2027-01-01T10:00:00+08:00'));
  assert.equal(n.anchor,'2027-01-01');assert.equal(weekDates(n.anchor)[0],'2026-12-28');
});
test('normal save within current week preserves default follow mode',()=>{
  const n=new CalendarNavigation(sunday);n.saved('2026-10-20',sunday);n.sync(monday);
  assert.equal(n.anchor,'2026-10-26');assert.equal(n.followToday,true);
});
test('future-week save and deliberately selected week remain deliberate',()=>{
  const n=new CalendarNavigation(sunday);n.saved('2026-11-03',sunday);n.sync(monday);
  assert.equal(n.anchor,'2026-11-03');assert.equal(n.followToday,false);
  n.move('2026-10-25');n.saved('2026-10-25',sunday);assert.equal(n.followToday,false);
});
