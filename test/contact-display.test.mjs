import test from 'node:test';
import assert from 'node:assert/strict';
import { contactLabel, contactDisplayHierarchy, fullContactLabel, matchesContact } from '../src/domain.mjs';
import { readDisplayValues } from '../src/repository.mjs';

test('short association label is reused verbatim without changing full hierarchy or identity',()=>{
  const c={id:'same-person-id',name:'示例客户',organization:'中国工商银行',level1:'上海市分行',level2:'闵行支行',department:'个金部',shortHierarchy:'工·上海·闵行·个金部'};
  const before=structuredClone(c);
  assert.equal(contactLabel(c),'工·上海·闵行·个金部·示例客户');
  assert.equal(fullContactLabel(c),'中国工商银行 · 上海市分行 · 闵行支行 · 个金部 · 示例客户');
  for(const q of ['中国工商银行','上海市分行','闵行支行','工上海闵行','工·上海·闵行·个金部 示例客户'])assert(matchesContact(c,q),q);
  assert.deepEqual(c,before);
});
test('custom labels, other banks and unlinked clients are not guessed or collapsed',()=>{
  assert.equal(contactLabel({name:'甲',shortHierarchy:'交·上海'}),'交·上海·甲');
  assert.equal(contactDisplayHierarchy({shortHierarchy:'自定义名称'}),'自定义名称');
  assert.equal(contactLabel({name:'乙',organization:'未知机构',department:'业务部'}),'未知机构 · 业务部 · 乙');
});
test('linked display pagination requests host-rendered text and rejects partial paging',async()=>{
  const args=[];const field={async getFieldValueListByPage(p){args.push(p);return p.pageToken?{fieldValues:[{recordId:'b',value:'交·上海'}],hasMore:false}:{fieldValues:[{recordId:'a',value:'工·上海'}],hasMore:true,pageToken:'next'};}};
  assert.deepEqual([...await readDisplayValues(field)],[['a','工·上海'],['b','交·上海']]);
  assert(args.every(p=>p.stringValue===true));
  await assert.rejects(readDisplayValues({getFieldValueListByPage:async()=>({fieldValues:[],hasMore:true,pageToken:'same'})}),/分页/);
});
