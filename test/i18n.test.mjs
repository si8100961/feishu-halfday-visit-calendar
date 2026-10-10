import test from 'node:test';
import assert from 'node:assert/strict';
import {translateUI} from '../src/i18n.mjs';
test('UI language supports zh/en/ja without translating contact data',()=>{
  assert.equal(translateUI('上午','en'),'Morning');
  assert.equal(translateUI('保存','ja'),'保存');
  assert.equal(translateUI('周一 10/05 · 今天','en'),'Mon 10/05 · Today');
  assert.equal(translateUI('拜访日历','zh'),'拜访日历');
  assert.equal(translateUI('示例支行 · 示例客户','en'),'示例支行 · 示例客户');
});
