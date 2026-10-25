import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, timeKey, halfDay, timestampOf, weekDates, shiftDate, matchesContact, validateVisit, sameVisit, linkedIds, plainText, planSchedule, contactHierarchy, contactLabel } from '../src/domain.mjs';
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

test('generic customer hierarchy omits empty levels and never requires a bank branch', () => {
  const c={name:'演示联系人',organization:'示例电商',level1:'企业平台',level2:'',department:'大商超'};
  assert.equal(contactHierarchy(c),'示例电商 · 企业平台 · 大商超');
  assert.equal(contactLabel(c),'示例电商 · 企业平台 · 大商超 · 演示联系人');
  for(const q of ['示例电商','企业平台','大商超','示例电商大商超','企业平台大商超','示例电商 企业平台 演示联系人'])assert.equal(matchesContact(c,q),true,q);
  assert.equal(matchesContact(c,'其他机构'),false);
  assert.equal(contactHierarchy({name:'演示联系人'}),'');
  assert.equal(contactLabel({name:'演示联系人'}),'演示联系人');
});

test('full three-level bank path and legacy branch remain searchable and correctly ordered', () => {
  const c={organization:'示例银行',level1:'示例分行',level2:'张江科技支行',department:'综合管理部',name:'演示客户'};
  assert.equal(contactHierarchy(c),'示例银行 · 示例分行 · 张江科技支行 · 综合管理部');
  for(const q of ['张江综管','示例银行 综管','示例分行 张江 演示客户'])assert.equal(matchesContact(c,q),true,q);
  assert.equal(contactLabel({branch:'旧支行',department:'旧部门',name:'演示人'}),'旧支行 · 旧部门 · 演示人');
  assert.equal(contactHierarchy({organization:'示例银行',level1:'示例省分行',level2:''}),'示例银行 · 示例省分行');
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

test('SDK single-select labels preserve plain text and formula-wrapper behavior', () => {
  // js-sdk 1.0.2 IOpenSingleSelect is { id, text }, not an option metadata object.
  const option = { id: 'option-demo-bank', text: '示例银行' };
  assert.equal(plainText(option), '示例银行');
  assert.equal(plainText({ value: option }), '示例银行');
  assert.equal(plainText([{ id: 'option-demo-branch', text: '示例分行' }]), '示例分行');
  assert.equal(plainText('示例银行'), '示例银行');
  assert.equal(plainText([{ type: 'text', text: '示例银行' }]), '示例银行');
  assert.equal(plainText(null), '');
  assert.equal(plainText({ id: 'empty-option', text: '' }), '');
  assert.equal(plainText(0), '0');
});

test('half-day-only appointment never invents an exact meeting timestamp', () => {
  const value = validateVisit({date:'2030-02-14',period:'pm',timePending:true,time:'',customerIds:['demo']}, [{id:'demo'}]);
  assert.equal(value.timestamp, null);
  assert.equal(value.pendingDate, '2030-02-14');
  assert.equal(planSchedule(value).period, 'pm');
  assert.equal(planSchedule(value).label, '下午');
  assert.throws(()=>validateVisit({...value,date:'2030-02-30',period:'pm',timePending:true},[]));
  assert.throws(()=>validateVisit({date:'2030-02-14',period:'am',timePending:true,customerIds:[],temporaryContact:'  '},[]));
  assert.equal(planSchedule({timestamp:null,pendingDate:'2030-02-14',pendingPeriod:''}), null);
});

test('pending and exact appointments are distinct; legacy label changes are conflicts', () => {
  const pending = {timestamp:null,pendingDate:'2030-02-14',pendingPeriod:'pm',customerIds:[],temporaryContact:'演示采购团队'};
  assert.equal(sameVisit(pending,{...pending}),true);
  for (const change of [{pendingPeriod:'am'},{pendingDate:'2030-02-15'},{temporaryContact:'演示团队乙'},{timestamp:timestampOf('2030-02-14','14:00')}]) assert.equal(sameVisit(pending,{...pending,...change}),false);
});
