import test from 'node:test';
import assert from 'node:assert/strict';
import { CalendarNavigation } from '../src/calendar-navigation.mjs';
import { dateKey, weekDates } from '../src/domain.mjs';

const sunday=Date.parse('2026-10-25T23:59:59+08:00');
const monday=Date.parse('2026-10-26T00:00:01+08:00');
test('Sunday defaults to next week and Monday does not skip another week',()=>{
  const n=new CalendarNavigation(sunday);
  assert.equal(n.today,'2026-10-25');assert.equal(n.anchor,'2026-10-26'); assert.equal(n.sync(monday),true);
  assert.equal(n.anchor,'2026-10-26');
  assert.deepEqual([weekDates(n.anchor)[0],weekDates(n.anchor)[6]],['2026-10-26','2026-11-01']);
  assert.equal(n.sync(monday),false);
});
test('business dates do not switch an hour early with Tokyo midnight',()=>{
  const instant=Date.parse('2026-10-25T00:30:00+09:00');
  assert.equal(dateKey(instant),'2026-10-24');
  assert.equal(new CalendarNavigation(instant).anchor,'2026-10-24');
});
test('explicit browsing retains the chosen week but refreshes today',()=>{
  const n=new CalendarNavigation(sunday); n.shift(-7); n.sync(monday);
  assert.equal(n.anchor,'2026-10-19'); assert.equal(n.today,'2026-10-26');
  n.current(monday); assert.equal(n.anchor,'2026-10-26'); assert.equal(n.followToday,true);
});
test('returning after sleep catches multiple missed days and month/year boundaries',()=>{
  const n=new CalendarNavigation(sunday);n.sync(Date.parse('2027-01-01T10:00:00+08:00'));
  assert.equal(n.anchor,'2027-01-01');assert.equal(weekDates(n.anchor)[0],'2026-12-28');
});
test('normal save within Sunday default week preserves follow mode',()=>{
  const n=new CalendarNavigation(sunday);n.saved('2026-10-28',sunday);n.sync(monday);
  assert.equal(n.anchor,'2026-10-26');assert.equal(n.followToday,true);
});

test('Saturday midnight advances to the coming Monday, including a year boundary',()=>{
  for(const [sat,sun,next] of [['2026-10-24','2026-10-25','2026-10-26'],['2023-12-30','2023-12-31','2024-01-01']]){
    const n=new CalendarNavigation(Date.parse(sat+'T23:59:59+08:00'));
    assert.equal(n.anchor,sat);assert.equal(n.sync(Date.parse(sun+'T00:00:00+08:00')),true);
    assert.equal(n.today,sun);assert.equal(n.anchor,next);
    assert.equal(new CalendarNavigation(Date.parse(sun+'T12:00:00+08:00')).anchor,next);
  }
});

test('Monday through Saturday retain this week as the default',()=>{
  for(const day of ['19','20','21','22','23','24']){
    const date='2026-10-'+day,n=new CalendarNavigation(Date.parse(date+'T12:00:00+08:00'));
    assert.equal(n.anchor,date);assert.equal(weekDates(n.anchor)[0],'2026-10-19');
  }
});

test('This week on Sunday explicitly shows the current Sunday without auto-bouncing',()=>{
  const n=new CalendarNavigation(sunday);n.current(sunday);
  assert.equal(n.anchor,'2026-10-25');assert.equal(n.followToday,false);
  n.sync(monday);assert.equal(n.anchor,'2026-10-25');
  n.current(monday);assert.equal(n.anchor,'2026-10-26');assert.equal(n.followToday,true);
});

test('saving a Sunday visit keeps its week visible instead of forcing next week',()=>{
  const n=new CalendarNavigation(sunday);n.saved('2026-10-25',sunday);
  assert.equal(n.anchor,'2026-10-25');assert.equal(n.followToday,false);
  n.sync(monday);assert.equal(n.anchor,'2026-10-25');
});
test('future-week save and deliberately selected week remain deliberate',()=>{
  const n=new CalendarNavigation(sunday);n.saved('2026-11-03',sunday);n.sync(monday);
  assert.equal(n.anchor,'2026-11-03');assert.equal(n.followToday,false);
  n.move('2026-10-25');n.saved('2026-10-25',sunday);assert.equal(n.followToday,false);
});
