import test from 'node:test';
import assert from 'node:assert/strict';
import { readStage, connectionStatus, loadFailure, CALENDAR_VERSION } from '../src/availability.mjs';
import { translateUI } from '../src/i18n.mjs';

test('bounded reads preserve success and never retry a failure', async () => {
  assert.equal(await readStage('LC-CONFIG', () => 42, 50), 42);
  let calls = 0;
  await assert.rejects(readStage('LC-PLANS', () => { ++calls; throw new Error('private payload'); }, 50), e => {
    assert.equal(e.code, 'LC-PLANS'); assert.ok(!e.message.includes('private')); return true;
  });
  assert.equal(calls, 1);
});

test('a stalled read times out and a late success cannot change the settled result', async () => {
  let finish;
  const pending = readStage('LC-CONFIG', () => new Promise(resolve => { finish = resolve; }), 10);
  await assert.rejects(pending, { code: 'LC-CONFIG' });
  finish(true);
  await assert.rejects(pending, { code: 'LC-CONFIG' });
});

test('permission uncertainty is distinct from a valid add denial', () => {
  assert.equal(connectionStatus({ canAdd: false, writePermissionUnknown: true }).error, true);
  assert.match(connectionStatus({ canAdd: false, writePermissionUnknown: true }).message, /LC-PERMISSION/);
  assert.equal(connectionStatus({ canAdd: false, writePermissionUnknown: false }).error, false);
  assert.match(connectionStatus({ canAdd: false }).message, /原权限/);
  assert.equal(CALENDAR_VERSION, '0.2.5');
});

test('diagnostics retain only allowlisted phase codes, never raw SDK payloads', () => {
  assert.match(loadFailure({ code: 'LC-CONTACTS', message: 'secret' }), /LC-CONTACTS/);
  assert.match(loadFailure({ code: 'LC-PLANS' }, true), /可能不是最新/);
  for (const e of [new Error('private person'), { code: 'secret', message: 'private person' }]) {
    assert.match(loadFailure(e), /LC-INIT/);
    assert.ok(!loadFailure(e).includes('private'));
    assert.ok(!loadFailure(e).includes('secret'));
  }
});

test('localization retains the troubleshooting phase and release marker', () => {
  for (const language of ['en', 'ja']) {
    const message = `${loadFailure({ code: 'LC-PLANS' })} · v${CALENDAR_VERSION}`;
    assert.match(translateUI(message, language), /LC-PLANS/);
    assert.match(translateUI(message, language), /v0\.2\.5/);
    assert.match(translateUI(`${connectionStatus({ writePermissionUnknown: true }).message} · v${CALENDAR_VERSION}`, language), /LC-PERMISSION/);
  }
});
