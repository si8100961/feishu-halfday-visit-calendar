import './style.css';
import './layout-fix.css';
import { dateKey, timeKey, halfDay, shiftDate, weekDates, matchesContact, validateVisit } from './domain.mjs';
import { VisitRepository } from './repository.mjs';
import { localizeUI } from './i18n.mjs';
import { bitable, FieldType, PermissionEntity, OperationType, DashboardState } from '@lark-base-open/js-sdk';

const $ = id => document.getElementById(id);
const repository = new VisitRepository({ bitable, FieldType, PermissionEntity, OperationType, DashboardState });
let data = { contacts: [], plans: [], canAdd: false };
let anchor = dateKey(Date.now()), original = null, selected = new Set(), busy = false, connected = false, uncertain = false, deleteArmed = false;
let loadVersion = 0, refreshTimer, refreshPending = false;

function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
function notice(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; }
function formError(message) { $('form-error').textContent = message; $('form-error').hidden = !message; }
function contactLabel(contact) { return `${contact.branch || '支行未填写'} · ${contact.department || '部门未填写'} · ${contact.name}`; }
function planLabel(plan) { return plan.customerIds.map(id => { const c = data.contacts.find(c => c.id === id); return c ? contactLabel(c) : '客户不可见或已不在可选范围'; }).join(' / ') || '未选择客户'; }

function render() {
  const dates = weekDates(anchor), today = dateKey(Date.now());
  $('range-label').textContent = `${dates[0]} — ${dates[6].slice(5)}`;
  $('jump').value = anchor;
  $('new').disabled = !connected || !data.canAdd;
  const calendar = $('calendar'); calendar.replaceChildren();
  dates.forEach((date, index) => {
    const day = el('section', undefined, `day${date === today ? ' today' : ''}`);
    day.append(el('h3', `${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index]} ${date.slice(5).replace('-', '/')}${date === today ? ' · 今天' : ''}`));
    for (const period of ['am', 'pm']) {
      const slot = el('div', undefined, `slot ${period}`);
      slot.append(el('span', period === 'am' ? '上午' : '下午', 'period'));
      const rows = data.plans.filter(p => Number.isFinite(p.timestamp) && dateKey(p.timestamp) === date && halfDay(p.timestamp) === period).sort((a, b) => a.timestamp - b.timestamp);
      for (const plan of rows) {
        const button = el('button', undefined, 'event');
        button.append(el('strong', timeKey(plan.timestamp)), el('span', planLabel(plan)));
        button.addEventListener('click', () => openEditor(date, period, plan)); slot.append(button);
      }
      const add = el('button', rows.length ? '＋ 添加' : '＋ 安排拜访', 'slot-add');
      add.setAttribute('aria-label', `${date} ${period === 'am' ? '上午' : '下午'}安排拜访`);
      add.disabled = !connected || !data.canAdd; add.addEventListener('click', () => openEditor(date, period)); slot.append(add);
      day.append(slot);
    }
    calendar.append(day);
  });
  const undated = data.plans.filter(p => !Number.isFinite(p.timestamp)).length;
  $('undated').hidden = !undated;
  $('undated').textContent = `另有 ${undated} 条计划未填写有效时间，请在左侧「拜访计划 → 计划录入」补齐；未猜测日期。`;
}

function renderContacts() {
  $('chosen').replaceChildren();
  for (const id of selected) {
    const contact = data.contacts.find(c => c.id === id);
    const chip = el('button', `${contact ? contactLabel(contact) : '不可用客户'} ×`, 'chip'); chip.type = 'button';
    chip.disabled = busy; chip.setAttribute('aria-label', `移除${contact?.name || '不可用客户'}`);
    chip.addEventListener('click', () => { selected.delete(id); renderContacts(); }); $('chosen').append(chip);
  }
  const matches = data.contacts.filter(c => matchesContact(c, $('search').value));
  $('matches').replaceChildren();
  if (!matches.length) $('matches').append(el('p', '没有匹配客户，请换用支行、部门或姓名；不会自动新建客户。', 'muted'));
  matches.slice(0, 60).forEach(contact => {
    const label = el('label', undefined, 'contact-option'), checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = selected.has(contact.id); checkbox.disabled = busy;
    checkbox.setAttribute('aria-label', contactLabel(contact));
    checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(contact.id) : selected.delete(contact.id); renderContacts(); });
    const text = el('span'); text.append(el('strong', contact.name), el('small', `${contact.branch || '支行未填写'} · ${contact.department || '部门未填写'}`)); label.append(checkbox, text); $('matches').append(label);
  });
  if (matches.length > 60) $('matches').append(el('p', `共 ${matches.length} 位，输入关键词可缩小范围。`, 'muted'));
}
function openEditor(date, period, plan) {
  if (!connected || busy) return;
  original = plan ? { ...plan, customerIds: [...plan.customerIds] } : null; uncertain = false; deleteArmed = false; $('delete').textContent = '删除计划';
  selected = new Set(plan?.customerIds || []);
  $('editor-title').textContent = plan ? '编辑拜访计划' : '新增拜访计划';
  $('visit-date').value = date; $('period').value = period; $('visit-time').value = plan ? timeKey(plan.timestamp) : period === 'am' ? '09:00' : '14:00';
  $('search').value = ''; $('delete').hidden = !plan; $('save').textContent = '保存'; formError(''); setBusy(false); renderContacts(); $('editor').showModal();
  $('search').focus();
}
function closeEditor() { if (!busy) { $('editor').close(); original = null; } }
function setBusy(value) {
  busy = value;
  for (const item of $('visit-form').querySelectorAll('input,select,button')) item.disabled = value;
  $('save').disabled = value || uncertain;
  $('delete').disabled = value || uncertain;
  if (!value && refreshPending) { refreshPending = false; clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 250); }
}
async function refresh() {
  if (!connected) return;
  if (busy) { refreshPending = true; return; }
  const version = ++loadVersion;
  try { const next = await repository.load(); if (version !== loadVersion) return; data = next; render(); notice('已同步拜访计划 · 上海时间'); }
  catch { notice('暂时无法刷新飞书数据，当前显示可能不是最新。请稍后点刷新。', true); }
}
$('visit-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || uncertain) return;
  let input;
  try { input = validateVisit({ date: $('visit-date').value, time: $('visit-time').value, period: $('period').value, customerIds: [...selected] }, data.contacts); }
  catch (error) { formError(error.message); return; }
  ++loadVersion; setBusy(true); formError(''); $('save').textContent = '保存中…';
  try {
    const saved = await repository.save(input, original);
    data.plans = data.plans.filter(p => p.id !== saved.id); data.plans.push(saved);
    anchor = dateKey(saved.timestamp); $('editor').close(); original = null; render(); notice('已保存，已返回拜访日历。');
  } catch (error) { uncertain = error.uncertain === true; formError(error.message); }
  finally { setBusy(false); $('save').textContent = uncertain ? '请先核对保存结果' : '保存'; }
});
$('delete').addEventListener('click', async () => {
  if (!original || busy || uncertain) return;
  if (!deleteArmed) { deleteArmed = true; $('delete').textContent = '确认删除'; formError('确认删除这条拜访计划？客户信息不会删除。'); return; }
  ++loadVersion; setBusy(true); formError('');
  try { await repository.remove(original); data.plans = data.plans.filter(p => p.id !== original.id); $('editor').close(); original = null; render(); notice('拜访计划已删除。'); }
  catch (error) { uncertain = error.uncertain === true; formError(error.message); }
  finally { setBusy(false); }
});
$('search').addEventListener('input', renderContacts);
$('visit-form').addEventListener('input', () => { deleteArmed = false; $('delete').textContent = '删除计划'; });
$('period').addEventListener('change', () => { const hour = Number($('visit-time').value.slice(0, 2)); if (($('period').value === 'am') !== (hour < 12)) $('visit-time').value = $('period').value === 'am' ? '09:00' : '14:00'; });
$('visit-time').addEventListener('change', () => { if ($('visit-time').value) $('period').value = Number($('visit-time').value.slice(0, 2)) < 12 ? 'am' : 'pm'; });
for (const id of ['close', 'cancel']) $(id).addEventListener('click', closeEditor);
$('editor').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('previous').addEventListener('click', () => { anchor = shiftDate(anchor, -7); render(); });
$('next').addEventListener('click', () => { anchor = shiftDate(anchor, 7); render(); });
$('today').addEventListener('click', () => { anchor = dateKey(Date.now()); render(); });
$('jump').addEventListener('change', () => { if ($('jump').value) { anchor = $('jump').value; render(); } });
$('new').addEventListener('click', () => openEditor(anchor, 'am'));
$('refresh').addEventListener('click', refresh);
$('install').addEventListener('click', async () => {
  $('install').disabled = true;
  try { await repository.install(); $('setup').hidden = true; notice('组件配置已保存。'); }
  catch (error) { notice(error.message, true); $('install').disabled = false; }
});
render();
async function start() {
  try {
    try { localizeUI(await bitable.bridge.getLanguage()); } catch { /* Chinese is the default. */ }
    try {
      const theme = await bitable.dashboard.getTheme();
      document.documentElement.dataset.theme = theme.theme === 'DARK' ? 'dark' : 'light';
      bitable.dashboard.onThemeChange(event => { document.documentElement.dataset.theme = event.data.theme === 'DARK' ? 'dark' : 'light'; });
    } catch { /* Theme support differs across Feishu host versions. */ }
    data = await repository.connect(); connected = true; render(); notice(data.canAdd ? '已连接现有拜访计划 · 上海时间' : '已连接；当前账号仅可查看，不能新增计划。');
    $('setup').hidden = !repository.isConfig();
    repository.subscribe(() => { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 250); });
    bitable.dashboard.onDataChange(() => { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 250); });
    bitable.dashboard.onConfigChange(() => { if (!repository.isConfig()) window.location.reload(); });
    // Host lifecycle signal is not a business-data write or a success assertion.
    await repository.rendered().catch(() => {});
  } catch (error) { notice(`尚未连接成功：${error.message}。请从飞书自定义插件入口打开；当前不能保存。`, true); }
}
if (window.parent === window) notice('未连接飞书：这是待接入的日历组件，不能保存或加载真实资料。请在飞书仪表盘中打开。', true);
else {
  const timer = setTimeout(() => { if (!connected) notice('等待飞书授权通道响应，尚未连接成功，当前不能保存。', true); }, 15000);
  start().finally(() => clearTimeout(timer));
}
