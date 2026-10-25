import test from 'node:test';
import assert from 'node:assert/strict';
import { MINUTES, HOURS, TimeSelection } from '../src/time-picker.mjs';
import { validateVisit, timeKey } from '../src/domain.mjs';

test('four minute choices and 24 hours can round-trip all 96 exact times', () => {
  assert.deepEqual(MINUTES, ['00','15','30','45']);
  assert.equal(HOURS.length, 24); assert.equal(HOURS[0], '00'); assert.equal(HOURS[23], '23');
  for (const hour of HOURS) for (const minute of MINUTES) {
    const picker = new TimeSelection(); picker.chooseHour(hour); picker.chooseMinute(minute);
    const value = validateVisit({date:'2030-02-14',time:picker.value,period:Number(hour)<12?'am':'pm',customerIds:['demo']}, [{id:'demo'}]);
    assert.equal(timeKey(value.timestamp), `${hour}:${minute}`);
  }
});
test('new visits remain half-day-only until a time is deliberately selected', () => {
  const picker = new TimeSelection(); picker.changePeriod('pm'); assert.equal(picker.value, '');
  picker.chooseHour('14'); assert.equal(picker.value, '14:00');
  picker.chooseMinute('45'); assert.equal(picker.value, '14:45');
  picker.clear(); assert.equal(picker.value, '');
  assert.equal(validateVisit({date:'2030-02-14',time:picker.value,timePending:true,period:'pm',customerIds:['demo']}, [{id:'demo'}]).timestamp, null);
});
test('partial selection is rejected, never mistaken for flexible time', () => {
  const picker = new TimeSelection(); picker.chooseMinute('15');
  assert.throws(() => picker.value, /小时和分钟/);
  picker.chooseHour('09'); assert.equal(picker.value, '09:15');
});
test('legacy minutes remain unchanged on open and changes not involving time', () => {
  for (const time of ['10:07','00:01','12:59','23:59']) {
    const picker = new TimeSelection(time); assert.equal(picker.value, time); assert.equal(picker.legacy,true);
    picker.changePeriod(Number(picker.hour)<12?'am':'pm'); assert.equal(picker.value,time);
    picker.chooseHour(picker.hour); assert.equal(picker.value,time);
  }
});
test('deliberate legacy time edits use quarter-hours', () => {
  const picker = new TimeSelection('10:07'); picker.chooseMinute('15'); assert.equal(picker.value,'10:15');
  assert.throws(() => picker.chooseMinute('07'));
  picker.set('10:07'); picker.chooseHour('11'); assert.equal(picker.value,'11:00');
  picker.set('10:07'); picker.changePeriod('pm'); assert.equal(picker.value,'14:00');
  picker.clear(); assert.equal(picker.legacy,false);
});
test('period switching keeps existing behavior without changing values within the same period', () => {
  const picker = new TimeSelection('10:30'); picker.changePeriod('am'); assert.equal(picker.value,'10:30');
  picker.changePeriod('pm'); assert.equal(picker.value,'14:00');
  picker.changePeriod('am'); assert.equal(picker.value,'09:00');
});
test('invalid choices cannot be injected through selection', () => {
  for (const time of ['24:00','10:60','9:00','bad']) assert.throws(() => new TimeSelection(time));
  const picker = new TimeSelection(); assert.throws(() => picker.chooseHour('24'));
  assert.throws(() => picker.chooseMinute('01'));
});
