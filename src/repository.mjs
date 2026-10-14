import { plainText, linkedIds, sameVisit, dateKey, timestampOf, planSchedule } from './domain.mjs';
import { savedSource, dashboardConfig, oneNamed } from './config.mjs';

export const EXTRA_FIELDS = {
  pendingDateField: ['拜访日期（时间待定）', 5],
  pendingPeriodField: ['拜访时段（时间待定）', 1]
};

export async function readAll(table) {
  const rows = [], tokens = new Set();
  let pageToken;
  do {
    const page = await table.getRecordsByPage({ pageSize: 200, ...(pageToken === undefined ? {} : { pageToken }) });
    if (!Array.isArray(page.records)) throw new Error('飞书没有返回有效的记录列表。');
    rows.push(...page.records);
    if (!page.hasMore) return rows;
    if (page.pageToken === undefined || tokens.has(page.pageToken)) throw new Error('读取分页异常，未使用不完整数据。');
    pageToken = page.pageToken;
    tokens.add(pageToken);
  } while (true);
}

export class VisitRepository {
  constructor(sdk) { Object.assign(this, sdk); }
  async connect() {
    this.ready = false;
    const { bitable, FieldType } = this;
    // Feishu rejects getConfig while creating a component: nothing is saved yet.
    const hostConfig = bitable.dashboard.state === this.DashboardState.Create ? null : await bitable.dashboard.getConfig();
    const saved = savedSource(hostConfig);
    if (!saved && !this.isConfig()) throw new Error('此组件尚未保存数据源，请在仪表盘中配置后使用。');
    const planTableId = saved?.planTableId || oneNamed(await bitable.base.getTableMetaList(), '拜访计划').id;
    this.plan = await bitable.base.getTableById(planTableId);
    const planFields = await this.plan.getFieldMetaList();
    const date = saved?.dateField ? planFields.find(f => f.id === saved.dateField) : oneNamed(planFields, '拜访时间');
    const link = saved?.linkField ? planFields.find(f => f.id === saved.linkField) : oneNamed(planFields, '约见客户');
    const contactTableId = saved?.contactTableId || link?.property?.tableId;
    if (date?.type !== FieldType.DateTime || ![FieldType.DuplexLink, FieldType.SingleLink].includes(link?.type) || !contactTableId || link.property?.tableId !== contactTableId || planTableId === contactTableId) {
      throw new Error('拜访时间或约见客户字段配置与现有系统不符，已停止写入。');
    }
    this.contact = await bitable.base.getTableById(contactTableId);
    const contactFields = await this.contact.getFieldMetaList();
    const fieldNamed = (key, name) => {
      const field = saved?.[key] ? contactFields.find(f => f.id === saved[key]) : oneNamed(contactFields, saved?.contactFieldNames?.[key] || name);
      if (!field) throw new Error(`客户字段「${name}」已删除，已停止读写。`);
      return field.id;
    };
    this.source = {
      planTableId, contactTableId, dateField: date.id, linkField: link.id,
      nameField: fieldNamed('nameField', '姓名'), branchField: fieldNamed('branchField', '当前所属支行'),
      departmentField: fieldNamed('departmentField', '当前所属部门'), testField: fieldNamed('testField', '测试记录'),
      keywordField: saved?.keywordField || contactFields.find(f => f.name === '客户搜索关键词')?.id
    };
    this.source.contactFieldNames=Object.fromEntries(['nameField','branchField','departmentField','testField'].map(key=>[key,contactFields.find(f=>f.id===this.source[key]).name]));
    if (contactFields.find(f => f.id === this.source.testField)?.type !== FieldType.Checkbox) throw new Error('测试记录隔离字段类型已变化，停止加载候选。');
    Object.assign(this, this.source);
    this.extra = {};
    for (const [key, [name, type]] of Object.entries({...EXTRA_FIELDS, temporaryContactField:['临时约见对象',1]})) {
      const savedId = saved?.extraFields?.[key];
      const matches = planFields.filter(f => savedId ? f.id === savedId : f.name === name);
      if (matches.length > 1 || (matches.length && matches[0].type !== type) || (savedId && !matches.length)) throw new Error(`扩展字段「${name}」配置不正确，已停止读写。`);
      if (matches.length) this.extra[key] = matches[0].id;
    }
    if (Object.keys(this.extra).length) this.source.extraFields = { ...this.extra };
    this.ready = true;
    try { return await this.load(); } catch (error) { this.ready = false; throw error; }
  }
  permission(type, recordId) {
    if (!this.ready) throw new Error('数据源尚未验证，禁止写入。');
    return this.bitable.base.getPermission({ entity: this.PermissionEntity.Record, type, param: { tableId: this.planTableId, ...(recordId ? { recordId } : {}) } });
  }
  parsePlan(row) {
    const plan = { id: row.recordId, timestamp: row.fields[this.dateField], customerIds: linkedIds(row.fields[this.linkField]) };
    const pending = row.fields[this.extra.pendingDateField];
    const period = plainText(row.fields[this.extra.pendingPeriodField]);
    if (!Number.isFinite(plan.timestamp) && Number.isFinite(pending)) {
      plan.timestamp = null; plan.pendingDate = dateKey(pending);
      plan.pendingPeriod = period === '上午' ? 'am' : period === '下午' ? 'pm' : '';
    }
    for (const key of ['temporaryContact']) {
      const value = plainText(row.fields[this.extra[`${key}Field`]]).trim();
      if (value) plan[key] = value;
    }
    return plan;
  }
  async load() {
    if (!this.ready) throw new Error('数据源尚未验证，禁止读取。');
    const [people, rows, canAdd] = await Promise.all([readAll(this.contact), readAll(this.plan), this.permission(this.OperationType.Addable)]);
    this.contacts = people.filter(r => r.fields[this.testField] !== true && plainText(r.fields[this.nameField]).trim()).map(r => ({
      id: r.recordId, name: plainText(r.fields[this.nameField]), branch: plainText(r.fields[this.branchField]), department: plainText(r.fields[this.departmentField]), keywords: plainText(r.fields[this.keywordField])
    }));
    return { contacts: this.contacts, plans: rows.map(row => this.parsePlan(row)), canAdd,
      supportsFlexible: Object.keys(EXTRA_FIELDS).every(key => this.extra[key]) };
  }
  async save(input, original) {
    if (!input || !planSchedule(input) || !Array.isArray(input.customerIds) || (!input.customerIds.length && !input.temporaryContact?.trim())) throw new Error('请先填写有效日期、时段和约见对象。');
    if (input.temporaryContact != null && (typeof input.temporaryContact !== 'string' || input.temporaryContact.length > 200)) throw new Error('原有约见对象格式不正确。');
    if (input.temporaryContact && (!original || input.temporaryContact !== original.temporaryContact)) throw new Error('仅保留原有约见对象文字；新增计划请使用原有客户选择。');
    if (!await this.permission(original ? this.OperationType.Editable : this.OperationType.Addable, original?.id)) throw new Error('当前飞书账号没有保存此拜访计划的权限。');
    // Refresh allowed people immediately before writing; never link by a name string.
    const fresh = await this.load();
    if (!Number.isFinite(input.timestamp) && !fresh.supportsFlexible) throw new Error('尚未配置模糊时间扩展字段，未保存；请由管理员先配置。');
    if (input.customerIds.some(id => !fresh.contacts.some(c => c.id === id))) throw new Error('客户资料已变化，请刷新后重新选择。');
    if (original) {
      const current = fresh.plans.find(p => p.id === original.id);
      if (!current || !sameVisit(current, original)) throw new Error('这条计划已被其他操作修改或删除，请刷新后再编辑。');
    }
    if (fresh.plans.some(p => p.id !== original?.id && sameVisit(p, input))) {
      throw new Error('已有相同客户和时间的计划，未重复创建。');
    }
    const cells = {
      [this.dateField]: Number.isFinite(input.timestamp) ? input.timestamp : null,
      [this.linkField]: { recordIds: input.customerIds }
    };
    if (fresh.supportsFlexible) {
      cells[this.extra.pendingDateField] = Number.isFinite(input.timestamp) ? null : timestampOf(input.pendingDate, '00:00');
      cells[this.extra.pendingPeriodField] = Number.isFinite(input.timestamp) ? null : [{ type: 'text', text: input.pendingPeriod === 'am' ? '上午' : '下午' }];
    }
    let id = original?.id;
    try {
      if (original) {
        const ok = await this.plan.setRecord(id, { fields: cells });
        if (!ok) throw new Error('更新接口未确认成功。');
      } else {
        id = await this.plan.addRecord({ fields: cells });
        if (typeof id !== 'string' || !id) throw new Error('未收到新记录标识。');
      }
      const saved = this.parsePlan({ recordId: id, ...(await this.plan.getRecordById(id, true)) });
      if (!sameVisit(saved, input)) throw new Error('保存后的客户或时间不一致。');
      return saved;
    } catch (error) {
      // No automatic create retry: a network failure can occur after the server saved the row.
      const uncertain = new Error(`保存结果尚未核实，请先关闭窗口并刷新日历核对，不要重复提交。${id ? `记录号：${id}` : ''}`);
      uncertain.uncertain = true;
      uncertain.cause = error;
      throw uncertain;
    }
  }
  async remove(original) {
    if (!await this.permission(this.OperationType.Deletable, original.id)) throw new Error('当前账号没有删除权限。');
    const current = this.parsePlan({ recordId: original.id, ...(await this.plan.getRecordById(original.id, true)) });
    if (!sameVisit(current, original)) throw new Error('计划已被修改，请刷新后再删除。');
    try {
      const ok = await this.plan.deleteRecord(original.id);
      if (!ok || (await readAll(this.plan)).some(row => row.recordId === original.id)) throw new Error('未确认记录已删除。');
    } catch (error) {
      const uncertain = new Error('删除结果尚未核实，请关闭窗口并刷新日历核对，不要继续保存或删除。');
      uncertain.uncertain = true; uncertain.cause = error; throw uncertain;
    }
  }
  isConfig() { return [this.DashboardState.Create, this.DashboardState.Config].includes(this.bitable.dashboard.state); }
  async install() {
    if (!this.ready || !this.isConfig()) throw new Error('请先连接并验证现有数据源，再保存组件配置。');
    const ok = await this.bitable.dashboard.saveConfig(dashboardConfig(this.source));
    if (!ok) throw new Error('飞书未确认组件配置保存成功。');
  }
  rendered() { return this.bitable.dashboard.setRendered(); }
  subscribe(callback) {
    const off = [this.plan, this.contact].flatMap(table => [table.onRecordAdd(callback), table.onRecordModify(callback), table.onRecordDelete(callback)]);
    return () => off.forEach(fn => fn());
  }
}
