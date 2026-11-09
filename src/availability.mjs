export const CALENDAR_VERSION = '0.2.5';
export const PERMISSION_WARNING = '写入权限暂时无法确认；日历可查看，新增、修改和删除已暂停。请点刷新重试（LC-PERMISSION）。';

// Bound SDK reads without retrying or exposing raw SDK errors/customer data.
// A timeout does not cancel the host operation; use this only for reads/signals.
export async function readStage(code, task, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })
    ]);
  } catch (cause) {
    const error = new Error(`飞书连接步骤未完成（${code}），请点刷新重试。`);
    error.code = code; error.cause = cause; throw error;
  } finally { clearTimeout(timer); }
}

export function connectionStatus(data) {
  if (data.writePermissionUnknown) return { message: PERMISSION_WARNING, error: true };
  return { message: data.canAdd ? '已连接现有拜访计划 · 上海时间' : '已连接；当前账号不能新增计划，已有计划的修改和删除按原权限执行。', error: false };
}

export function loadFailure(error, hasPreviousData = false) {
  const codes = ['LC-CONFIG', 'LC-SOURCE', 'LC-CONTACTS', 'LC-PLANS'];
  const code = codes.includes(error?.code) ? error.code : 'LC-INIT';
  return `${hasPreviousData ? '刷新失败，当前显示可能不是最新。' : '尚未连接成功。'}请点刷新重试；当前不能写入（${code}）。`;
}
