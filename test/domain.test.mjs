import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, timeKey, halfDay, timestampOf, weekDates, shiftDate, matchesContact, validateVisit, sameVisit, linkedIds, plainText } from '../src/domain.mjs';
test('Shanghai timezone, midnight and noon boundaries', () => {
  const timestamp = timestampOf('2026-10-10', '00:00');
  assert.equal(new Date(timestamp).toISOString(), '2026-10-09T16:00:00.000Z');
  assert.equal(dateKey(timestamp), '2026-10-10'); assert.equal(timeKey(timestamp), '00:00');
  assert.equal(halfDay(timestampOf('2026-10-10', '11:59')), 'am');
  assert.equal(halfDay(timestampOf('2026-10-10', '12:00')), 'pm');
});
test('whole week including year boundary and leap year', () => {
  assert.deepEqual(weekDates('2027-01-01'), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
});
test('invalid or incomplete date cannot create a record', () => {
  for (const [date,time] of [['2026-02-30','10:00'],['2026-10-10','24:00'],['','10:00'],['2026-10-10','']]) assert.throws(() => timestampOf(date,time));
});
test('branch abbreviation, department alias, spaces and name', () => {
  const c = {name:'测试客户甲',branch:'张江科技支行',department:'综合管理部'};
  for (const term of ['张江综管','张江 综管','综管 张江','客户甲','张江科技支行']) assert.equal(matchesContact(c, term), true, term);
  assert.equal(matchesContact(c,'静安个金'),false);
  assert.equal(matchesContact({...c,branch:'张江科技支行（虚构）'},'张江综管'),true);
  assert.equal(matchesContact({name:'测试客户乙',branch:'静安支行',department:'个人金融部'},'静安 个金'),true);
});
test('visit validation requires linked customer IDs and matching half-day', () => {
  const c=[{id:'person1'}];
  const input={date:'2026-10-10',time:'14:00',period:'pm',customerIds:['person1','person1']};
  assert.deepEqual(validateVisit(input,c).customerIds,['person1']);
  assert.throws(()=>validateVisit({...input,customerIds:[]},c));
  assert.throws(()=>validateVisit({...input,customerIds:['unknown']},c));
  assert.throws(()=>validateVisit({...input,period:'am'},c));
});
test('same-visit check is independent of customer selection order', () => {
  assert.ok(sameVisit({timestamp:1,customerIds:['a','b']},{timestamp:1,customerIds:['b','a']}));
  assert.ok(!sameVisit({timestamp:1,customerIds:['a']},{timestamp:2,customerIds:['a']}));
});
test('SDK field values: text segments, formula wrapper and link IDs', () => {
  assert.equal(plainText([{text:'张江'},{text:'科技支行'}]),'张江科技支行');
  assert.equal(plainText({value:[{text:'综管部'}]}),'综管部');
  assert.deepEqual(linkedIds({recordIds:['rec1','rec2']}),['rec1','rec2']);
  assert.deepEqual(linkedIds(null),[]);
});
