import test from 'node:test';
import assert from 'node:assert/strict';
import { VisitRepository, readAll, EXTRA_FIELDS } from '../src/repository.mjs';
import { savedSource, dashboardConfig } from '../src/config.mjs';
import { contactHierarchy, matchesContact } from '../src/domain.mjs';

const FieldType = { DateTime: 5, DuplexLink: 21, SingleLink: 18, Checkbox: 7 };
const OperationType = { Addable: 'add', Editable: 'edit', Deletable: 'delete' };
const DashboardState = { Create: 'Create', Config: 'Config', View: 'View', FullScreen: 'FullScreen' };
const visit = { timestamp: 1800000000000, customerIds: ['person-a'] };
function fixture() {
  const calls = [], handlers = new Set();
  const makeTable = (fields, records) => ({
    fields, records,
    async getFieldMetaList() { return this.fields; },
    async getRecordsByPage() { return { records: structuredClone(this.records), hasMore: false }; },
    async getRecordById(id) { const row = this.records.find(r => r.recordId === id); if (!row) throw new Error('not found'); return structuredClone(row); },
    async addRecord({ fields }) { const recordId = `plan-${this.records.length + 1}`; this.records.push({ recordId, fields: structuredClone(fields) }); calls.push(['add', fields]); return recordId; },
    async setRecord(id, { fields }) { Object.assign(this.records.find(r => r.recordId === id).fields, structuredClone(fields)); calls.push(['edit', fields]); return true; },
    async deleteRecord(id) { this.records = this.records.filter(r => r.recordId !== id); calls.push(['delete', id]); return true; },
    onRecordAdd(cb) { const item = () => cb(); handlers.add(item); return () => handlers.delete(item); },
    onRecordModify(cb) { const item = () => cb(); handlers.add(item); return () => handlers.delete(item); },
    onRecordDelete(cb) { const item = () => cb(); handlers.add(item); return () => handlers.delete(item); }
  });
  const plan = makeTable([
    { id: 'date', name: '拜访时间', type: 5 },
    { id: 'link', name: '约见客户', type: 21, property: { tableId: 'people-table' } }
  ], []);
  const people = makeTable([
    { id: 'name', name: '姓名' }, { id: 'branch', name: '当前所属支行' }, { id: 'department', name: '当前所属部门' },
    { id: 'test', name: '测试记录', type: 7 }, { id: 'keywords', name: '客户搜索关键词' }
  ], [
    { recordId: 'person-a', fields: { name: '模拟客户甲', branch: '示例支行', department: '综管部' } },
    { recordId: 'person-test', fields: { name: '测试记录', test: true } },
    { recordId: 'person-empty', fields: { name: ' ' } }
  ]);
  const tables = [{ id: 'plan-table', name: '拜访计划' }, { id: 'people-table', name: '客户信息' }];
  const sdk = { FieldType, OperationType, DashboardState, PermissionEntity: { Record: 'record' }, bitable: {
    base: {
      getTableMetaList: async () => tables,
      getTableById: async id => { if (id === 'plan-table') return plan; if (id === 'people-table') return people; throw new Error('unknown table'); },
      getPermission: async () => true
    },
    dashboard: {
      state: 'Create', config: { dataConditions: [] },
      async getConfig() { if (this.state === 'Create') throw new Error('currently in creation status, unable to invoke this API'); return structuredClone(this.config); },
      async saveConfig(config) { this.config = structuredClone(config); return true; },
      async setRendered() { return true; }
    }
  } };
  return { sdk, plan, people, calls, tables, handlers, repo: new VisitRepository(sdk) };
}

test('discover existing tables once, save identifiers, reopen even after field names change', async () => {
  const f = fixture();
  const loaded = await f.repo.connect();
  assert.deepEqual(loaded.contacts.map(p => p.id), ['person-a']);
  await f.repo.install();
  const saved = f.sdk.bitable.dashboard.config;
  assert.equal(saved.customConfig.version, 4);
  assert.equal(JSON.stringify(saved).includes('模拟客户甲'), false);
  f.plan.fields.forEach(field => field.name = `renamed-${field.id}`);
  f.people.fields.forEach(field => field.name = `renamed-${field.id}`);
  f.tables[0].name = '用户改名后的计划';
  f.sdk.bitable.dashboard.state = 'View';
  await new VisitRepository(f.sdk).connect();
  assert.equal(f.calls.length, 0);
});

test('old preview configuration migrates without a business write', async () => {
  const f = fixture();
  f.sdk.bitable.dashboard.state = 'Config';
  f.sdk.bitable.dashboard.config = { customConfig: { version: 1, calendar: 'half-day', planTableId: 'plan-table', contactTableId: 'people-table' } };
  await f.repo.connect(); await f.repo.install();
  assert.equal(f.calls.length, 0);
  assert.equal(f.sdk.bitable.dashboard.config.customConfig.version, 4);
});

function useGenericHierarchy(f){
  f.people.fields.find(x=>x.id==='branch').name='二级分类';
  f.people.fields.find(x=>x.id==='department').name='所属部门';
  f.people.fields.push({id:'organization',name:'客户机构',type:1},{id:'level1',name:'一级分类',type:1});
  Object.assign(f.people.records[0].fields,{organization:'示例企业',level1:'全国业务',branch:'',department:'采购部'});
}

test('modern hierarchy is detected without business writes or required second-level values',async()=>{
  const f=fixture();useGenericHierarchy(f);
  const loaded=await f.repo.connect();
  assert.equal(loaded.contacts[0].organization,'示例企业');
  assert.equal(loaded.contacts[0].level1,'全国业务');
  assert.equal(loaded.contacts[0].level2,'');
  await f.repo.install();
  assert.equal(savedSource(f.sdk.bitable.dashboard.config).organizationField,'organization');
  assert.equal(savedSource(f.sdk.bitable.dashboard.config).level1Field,'level1');
  assert.equal(f.calls.length,0);
});

test('three hierarchy fields can become SDK single-select without losing labels or linked IDs', async () => {
  const f = fixture(); useGenericHierarchy(f);
  Object.assign(f.people.records[0].fields, { organization: '示例银行', level1: '示例分行', branch: '张江科技支行', department: '综合管理部' });
  const before = (await f.repo.connect()).contacts;
  await f.repo.install();
  const configBefore = structuredClone(f.sdk.bitable.dashboard.config);
  const tableBefore = structuredClone(f.people.records);
  for (const id of ['organization', 'level1', 'branch']) {
    f.people.fields.find(field => field.id === id).type = 3;
    f.people.records[0].fields[id] = { id: `option-${id}`, text: f.people.records[0].fields[id] };
  }
  f.sdk.bitable.dashboard.state = 'View';
  const repo = new VisitRepository(f.sdk);
  const loaded = await repo.connect();
  assert.deepEqual(loaded.contacts, before);
  assert.equal(contactHierarchy(loaded.contacts[0]), '示例银行 · 示例分行 · 张江科技支行 · 综合管理部');
  for (const query of ['示例银行', '示例分行', '张江综管', '示例银行 示例分行 模拟客户甲']) assert.equal(matchesContact(loaded.contacts[0], query), true, query);
  assert.deepEqual(f.sdk.bitable.dashboard.config, configBefore);
  const saved = await repo.save(visit);
  assert.deepEqual(saved.customerIds, ['person-a']);
  assert.deepEqual(Object.keys(f.calls[0][1]).sort(), ['date', 'link']);
  assert.deepEqual(f.people.records[0].fields.organization, { id: 'option-organization', text: tableBefore[0].fields.organization });
});

test('single-select hierarchy still permits missing optional levels', async () => {
  const f = fixture(); useGenericHierarchy(f);
  for (const id of ['organization', 'level1', 'branch']) f.people.fields.find(field => field.id === id).type = 3;
  Object.assign(f.people.records[0].fields, { organization: { id: 'option-demo', text: '示例电商' }, level1: { id: 'option-platform', text: '企业平台' }, branch: null });
  const loaded = await f.repo.connect();
  assert.equal(contactHierarchy(loaded.contacts[0]), '示例电商 · 企业平台 · 采购部');
  assert.equal(matchesContact(loaded.contacts[0], '示例电商采购部'), true);
  assert.equal(loaded.contacts[0].level2, '');
  assert.equal(f.calls.length, 0);
});

test('already installed old configuration discovers new hierarchy without resetting saved links',async()=>{
  const f=fixture();await f.repo.connect();await f.repo.install();
  useGenericHierarchy(f);f.sdk.bitable.dashboard.state='View';
  const repo=new VisitRepository(f.sdk),loaded=await repo.connect();
  assert.equal(repo.linkField,'link');assert.equal(repo.branchField,'branch');
  assert.equal(loaded.contacts[0].organization,'示例企业');
  assert.equal(f.calls.length,0);
});

test('copied hierarchy config retains names only and resolves newly assigned IDs',async()=>{
  const f=fixture();useGenericHierarchy(f);await f.repo.connect();await f.repo.install();
  const config=structuredClone(f.sdk.bitable.dashboard.config);
  config.dataConditions[0].tableId='copy-plan';config.dataConditions[0].groups=[{fieldId:'copy-date'},{fieldId:'copy-link'}];
  assert.equal(savedSource(config).organizationField,undefined);
  assert.equal(savedSource(config).contactFieldNames.organizationField,'客户机构');
  f.plan.fields=[{id:'copy-date',name:'拜访时间',type:5},{id:'copy-link',name:'约见客户',type:21,property:{tableId:'copy-people'}}];
  f.people.fields=f.people.fields.map(x=>({...x,id:'copy-'+x.id}));
  f.people.records=f.people.records.map(r=>({...r,fields:Object.fromEntries(Object.entries(r.fields).map(([k,v])=>['copy-'+k,v]))}));
  f.sdk.bitable.base.getTableById=async id=>{if(id==='copy-plan')return f.plan;if(id==='copy-people')return f.people;throw Error('original ID must not be accessed');};
  f.sdk.bitable.dashboard.config=config;f.sdk.bitable.dashboard.state='View';
  const repo=new VisitRepository(f.sdk),loaded=await repo.connect();
  assert.equal(repo.source.organizationField,'copy-organization');assert.equal(loaded.contacts[0].organization,'示例企业');assert.equal(f.calls.length,0);
});

test('ambiguous organizational aliases and missing saved hierarchy stop instead of guessing',async()=>{
  const f=fixture();useGenericHierarchy(f);f.people.fields.push({id:'other-org',name:'所属机构',type:1});
  await assert.rejects(f.repo.connect(),/无法唯一/);assert.equal(f.calls.length,0);
  const g=fixture();useGenericHierarchy(g);await g.repo.connect();await g.repo.install();g.sdk.bitable.dashboard.state='View';
  g.people.fields=g.people.fields.filter(x=>x.id!=='organization');
  await assert.rejects(new VisitRepository(g.sdk).connect(),/已删除/);assert.equal(g.calls.length,0);
});

test('copied Base mapping uses only remapped dataConditions and fails closed if damaged', () => {
  const source = {planTableId:'p',contactTableId:'c',dateField:'d',linkField:'l',nameField:'n',branchField:'b',departmentField:'dept',testField:'t'};
  const config=dashboardConfig(source);
  config.dataConditions.forEach(condition=>{condition.tableId='copy-'+condition.tableId;condition.groups.forEach(group=>group.fieldId='copy-'+group.fieldId);});
  assert.equal(savedSource(config).planTableId,'copy-p');
  assert.equal(savedSource(config).dateField,'copy-d');
  assert.equal(savedSource(config).copied,true);
  assert.equal(savedSource(config).contactTableId,undefined);
  config.dataConditions[0].groups.pop();
  assert.throws(()=>savedSource(config),/映射/);
});

test('missing or malformed saved configuration cannot silently choose a new source', async () => {
  for (const config of [{}, { customConfig: { version: 999, calendar: 'half-day' } }, { customConfig: { version: 2, calendar: 'half-day', source: {} } }]) {
    const f = fixture(); f.sdk.bitable.dashboard.state = 'View'; f.sdk.bitable.dashboard.config = config;
    await assert.rejects(f.repo.connect());
    await assert.rejects(f.repo.save(visit)); assert.equal(f.calls.length, 0);
  }
});

test('ambiguous table, wrong link target and changed checkbox type fail closed', async () => {
  const a = fixture(); a.tables.push({ id: 'another', name: '拜访计划' }); await assert.rejects(a.repo.connect());
  const b = fixture(); await b.repo.connect(); await b.repo.install(); b.sdk.bitable.dashboard.state = 'View'; b.plan.fields[1].property.tableId = 'unexpected-table'; await assert.rejects(b.repo.connect());
  const c = fixture(); c.people.fields.find(f => f.id === 'test').type = 1; await assert.rejects(c.repo.connect());
  for (const f of [a, b, c]) { await assert.rejects(f.repo.save(visit)); assert.equal(f.calls.length, 0); }
});

test('add/edit writes only the existing date and linked IDs, then reads back', async () => {
  const f = fixture(); await f.repo.connect();
  const created = await f.repo.save(visit);
  assert.deepEqual(created, { id: 'plan-1', ...visit });
  f.plan.records[0].fields.unrelated = 'preserve me';
  const changed = await f.repo.save({ ...visit, timestamp: visit.timestamp + 3600000 }, created);
  assert.equal(changed.timestamp, visit.timestamp + 3600000);
  assert.equal(f.plan.records[0].fields.unrelated, 'preserve me');
  assert.deepEqual(f.calls.map(call => Object.keys(call[1]).sort()), [['date', 'link'], ['date', 'link']]);
});

test('duplicate creates and edits, removed customers, invalid input and conflicts do not write', async () => {
  const f = fixture(); await f.repo.connect(); const original = await f.repo.save(visit);
  await assert.rejects(f.repo.save(visit), /相同/);
  await assert.rejects(f.repo.save({ ...visit, customerIds: [] }));
  await assert.rejects(f.repo.save({ ...visit, customerIds: ['person-test'] }), /资料/);
  f.plan.records[0].fields.date += 100;
  await assert.rejects(f.repo.save({ ...visit, timestamp: visit.timestamp + 200 }, original), /修改/);
  await assert.rejects(f.repo.remove(original), /修改/);
  f.plan.records.push({ recordId: 'other', fields: { date: visit.timestamp + 300, link: { recordIds: visit.customerIds } } });
  await assert.rejects(f.repo.save({ ...visit, timestamp: visit.timestamp + 300 }, { ...original, timestamp: visit.timestamp + 100 }), /相同/);
  assert.equal(f.calls.length, 1);
});

test('lost save acknowledgement never retries a create', async () => {
  const f = fixture(); await f.repo.connect();
  const add = f.plan.addRecord.bind(f.plan);
  f.plan.addRecord = async input => { await add(input); throw new Error('network after commit'); };
  await assert.rejects(f.repo.save(visit), error => error.uncertain === true);
  assert.equal(f.calls.length, 1); assert.equal(f.plan.records.length, 1);
});

test('readback mismatch is reported uncertain, not successful', async () => {
  const f = fixture(); await f.repo.connect();
  f.plan.getRecordById = async recordId => ({ recordId, fields: { date: 123, link: { recordIds: ['person-a'] } } });
  await assert.rejects(f.repo.save(visit), error => error.uncertain === true);
});

test('delete is verified against the table; lost confirmation stays uncertain', async () => {
  const f = fixture(); await f.repo.connect(); const original = await f.repo.save(visit); await f.repo.remove(original);
  assert.equal(f.plan.records.length, 0);
  const g = fixture(); await g.repo.connect(); const remaining = await g.repo.save(visit);
  g.plan.deleteRecord = async () => true;
  await assert.rejects(g.repo.remove(remaining), error => error.uncertain === true);
  assert.equal(g.plan.records.length, 1);
});

test('permissions are checked again for every write and refresh', async () => {
  const f = fixture(); await f.repo.connect(); const original = await f.repo.save(visit);
  f.sdk.bitable.base.getPermission = async () => false;
  assert.equal((await f.repo.load()).canAdd, false);
  await assert.rejects(f.repo.save(visit), /权限/);
  await assert.rejects(f.repo.save(visit, original), /权限/);
  await assert.rejects(f.repo.remove(original), /权限/);
  assert.equal(f.calls.length, 1);
});

test('both source tables refresh and all subscriptions can be removed', async () => {
  const f = fixture(); await f.repo.connect(); let count = 0;
  const off = f.repo.subscribe(() => count++);
  assert.equal(f.handlers.size, 6); f.handlers.forEach(cb => cb()); assert.equal(count, 6);
  off(); assert.equal(f.handlers.size, 0);
});

test('pagination reads all rows and refuses incomplete or looping pages', async () => {
  const args = [];
  const rows = await readAll({ async getRecordsByPage(arg) { args.push(arg); return arg.pageToken ? { records: [2], hasMore: false } : { records: [1], hasMore: true, pageToken: 'page2' }; } });
  assert.deepEqual(rows, [1, 2]); assert.equal(args[1].pageToken, 'page2');
  await assert.rejects(readAll({ getRecordsByPage: async () => ({ records: [], hasMore: true, pageToken: 'loop' }) }), /分页/);
  await assert.rejects(readAll({ getRecordsByPage: async () => ({ hasMore: false }) }), /记录列表/);
});

test('serialized configuration discards data and unknown keys', async () => {
  const f = fixture(); await f.repo.connect();
  const config = dashboardConfig({ ...f.repo.source, secret: 'not allowed', contacts: ['not allowed'] });
  assert.equal(JSON.stringify(config).includes('not allowed'), false);
  assert.deepEqual(savedSource(config), f.repo.source);
});

const pendingVisit = {timestamp:null,pendingDate:'2030-02-14',pendingPeriod:'pm',customerIds:['person-a']};
function flexibleFixture() {
  const f=fixture();
  for (const [id,[name,type]] of Object.entries(EXTRA_FIELDS)) f.plan.fields.push({id,name,type});
  return f;
}
test('missing optional fields preserves old schema and rejects flexible writes', async()=>{
  const f=fixture(); const loaded=await f.repo.connect();
  assert.equal(loaded.supportsFlexible,false);
  await assert.rejects(f.repo.save(pendingVisit),/扩展字段/);
  assert.equal(f.calls.length,0); assert.equal(f.plan.fields.length,2);
});
test('pending time roundtrips without creating contacts or an exact time',async()=>{
  const f=flexibleFixture(); await f.repo.connect();
  const saved=await f.repo.save(pendingVisit);
  assert.deepEqual(saved,{id:'plan-1',...pendingVisit});
  assert.equal(f.plan.records[0].fields.date,null);
  assert.equal(f.people.records.length,3);
  assert.equal((await f.repo.load()).plans[0].pendingPeriod,'pm');
  await assert.rejects(f.repo.save(pendingVisit),/相同/);
  const exact=await f.repo.save(visit,saved);
  assert.equal(f.plan.records[0].fields.pendingDateField,null);
  assert.equal(f.plan.records[0].fields.pendingPeriodField,null);
  assert.equal(exact.pendingDate,undefined);
  const back=await f.repo.save(pendingVisit,exact);
  assert.equal(back.timestamp,null);
  await f.repo.remove(back); assert.equal(f.plan.records.length,0);
});
test('flexible configuration preserves identifiers and copied Base rediscovery excludes original IDs', async()=>{
  const f=flexibleFixture(); await f.repo.connect(); await f.repo.install();
  assert.deepEqual(savedSource(f.sdk.bitable.dashboard.config).extraFields,f.repo.extra);
  const copy=structuredClone(f.sdk.bitable.dashboard.config);
  copy.dataConditions[0].tableId='copied-plan';
  assert.equal(savedSource(copy).extraFields,undefined);
  f.plan.fields.find(x=>x.id==='pendingPeriodField').type=2;
  await assert.rejects(new VisitRepository(f.sdk).connect(),/扩展字段/);
});
test('a modified period prevents stale editing or deletion',async()=>{
  const f=flexibleFixture(); await f.repo.connect(); const original=await f.repo.save(pendingVisit);
  f.plan.records[0].fields.pendingPeriodField=[{text:'上午'}];
  await assert.rejects(f.repo.save({...pendingVisit,pendingPeriod:'am'},original),/修改/);
  await assert.rejects(f.repo.remove(original),/修改/);
  assert.equal(f.calls.length,1);
});

test('legacy text can be preserved but not created or changed through the calendar',async()=>{
  const f=flexibleFixture(); f.plan.fields.push({id:'legacy',name:'临时约见对象',type:1});
  f.plan.records.push({recordId:'legacy-visit',fields:{date:null,pendingDateField:Date.parse('2030-02-14T00:00:00+08:00'),pendingPeriodField:[{text:'下午'}],legacy:[{text:'已有演示对象'}]}});
  const loaded=await f.repo.connect(); const original=loaded.plans[0];
  const saved=await f.repo.save({...original,pendingPeriod:'am'},original);
  assert.equal(saved.temporaryContact,'已有演示对象');
  assert.equal(f.calls[0][1].legacy,undefined);
  await assert.rejects(f.repo.save({...saved,temporaryContact:'新对象'},saved),/仅保留/);
  await assert.rejects(f.repo.save({...saved}),/仅保留/);
});
