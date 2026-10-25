// UI-only localization. Customer text, dates and form values are never translated.
const entries = [
  ['小时','Hour','時'],['分钟','Minute','分'],['清空','Clear','クリア'],
  ['请选择完整的小时和分钟。','Select both hour and minute.','時と分の両方を選択してください。'],
  ['分钟请选择 00、15、30 或 45。','Choose 00, 15, 30 or 45 minutes.','分は 00・15・30・45 から選択してください。'],
  ['保留原有分钟；重新选择后使用 00、15、30、45。','Original minutes retained; new choices are 00, 15, 30 and 45.','元の分を保持します。変更時は 00・15・30・45 から選択します。'],
  ['具体时间可不填；不填时仅显示上午或下午。','Time is optional; leave blank to show morning or afternoon only.','時刻は任意です。未入力の場合は午前・午後のみ表示します。'],
  ['请选择约见客户，或填写临时约见对象。','Select a contact.','顧客を選択してください。'],
  ['请选择上午或下午。','Choose morning or afternoon.','午前または午後を選択してください。'],
  ['拜访日历','Visit calendar','訪問カレンダー'],['上午 · 下午','Morning · Afternoon','午前・午後'],
  ['上午','Morning','午前'],['下午','Afternoon','午後'],['刷新','Refresh','更新'],['本周','This week','今週'],
  ['选择日期','Choose date','日付を選択'],['＋ 新增拜访','＋ New visit','＋ 訪問を追加'],['＋ 添加','＋ Add','＋ 追加'],['＋ 安排拜访','＋ Plan visit','＋ 訪問を予定'],
  ['上一周','Previous week','前の週'],['下一周','Next week','次の週'],['日历导航','Calendar navigation','カレンダー操作'],['每周上午下午拜访安排','Weekly morning and afternoon visits','週間訪問予定（午前・午後）'],
  ['新增拜访计划','New visit','訪問予定を追加'],['编辑拜访计划','Edit visit','訪問予定を編集'],['关闭','Close','閉じる'],
  ['拜访日期','Visit date','訪問日'],['时段','Period','時間帯'],['具体时间','Time','時刻'],['约见客户','Contacts','訪問先'],
  ['搜索客户机构、分类、部门或姓名','Search organization, hierarchy, department or name','組織・分類・部署・氏名で検索'],
  ['已选择客户','Selected contacts','選択済み'],['客户搜索结果','Contact search results','顧客検索結果'],
  ['取消','Cancel','キャンセル'],['保存','Save','保存'],['保存中…','Saving…','保存中…'],['删除计划','Delete visit','予定を削除'],['确认删除','Confirm deletion','削除を確定'],
  ['保存组件配置','Save widget configuration','ウィジェット設定を保存'],['组件配置已保存。','Widget configuration saved.','ウィジェット設定を保存しました。'],
  ['连接成功后，点击下方按钮将此日历加入仪表盘。不会创建新表、修改字段或更改分享权限。','After connecting, save the configuration to add this calendar. No tables, fields or sharing permissions will be changed.','接続後、設定を保存してカレンダーを追加します。テーブル・項目・共有権限は変更しません。'],
  ['正在连接飞书…','Connecting to Feishu…','Feishu に接続中…'],
  ['已连接现有拜访计划 · 上海时间','Connected · Shanghai time','接続済み・上海時間'],['已同步拜访计划 · 上海时间','Synchronized · Shanghai time','同期済み・上海時間'],
  ['已连接；当前账号仅可查看，不能新增计划。','Connected. This account is read-only.','接続済み。このアカウントは閲覧のみ可能です。'],
  ['已保存，已返回拜访日历。','Saved. Back to calendar.','保存しました。カレンダーに戻りました。'],['拜访计划已删除。','Visit deleted.','訪問予定を削除しました。'],
  ['确认删除这条拜访计划？客户信息不会删除。','Delete this visit? Contacts will not be deleted.','この予定を削除しますか？顧客情報は削除されません。'],
  ['没有匹配客户，请换用客户机构、分类、部门或姓名；不会自动新建客户。','No match. Search by organization, hierarchy, department or name. No contact is created automatically.','該当なし。組織・分類・部署・氏名を変えて検索してください。顧客は自動作成されません。'],
  ['请先核对保存结果','Check save result first','先に保存結果を確認'],
  ['暂时无法刷新飞书数据，当前显示可能不是最新。请稍后点刷新。','Unable to refresh. Displayed data may be stale; please refresh later.','更新できません。表示が古い可能性があります。後でもう一度更新してください。'],
  ['请填写完整的拜访日期和时间。','Enter a complete date and time.','日付と時刻を入力してください。'],['日期或时间不正确。','Invalid date or time.','日付または時刻が正しくありません。'],
  ['具体时间与上午/下午不一致，请重新选择。','Time does not match the selected period.','時刻と時間帯が一致しません。'],['请至少选择一位约见客户。','Select at least one contact.','訪問先を選択してください。'],
  ['客户资料已变化，请刷新后重新选择。','Contacts changed. Refresh and select again.','顧客情報が変更されました。更新して選び直してください。'],
  ['已有相同客户和时间的计划，未重复创建。','A visit with the same contacts and time already exists.','同じ顧客・時刻の予定があります。重複作成しませんでした。'],
  ['当前飞书账号没有保存此拜访计划的权限。','You do not have permission to save this visit.','この予定を保存する権限がありません。'],['当前账号没有删除权限。','You do not have deletion permission.','削除権限がありません。'],
  ['这条计划已被其他操作修改或删除，请刷新后再编辑。','This visit changed or was deleted. Refresh before editing.','予定が変更または削除されました。更新してから編集してください。'],
  ['计划已被修改，请刷新后再删除。','This visit changed. Refresh before deleting.','予定が変更されました。更新してから削除してください。'],
  ['删除结果尚未核实，请关闭窗口并刷新日历核对，不要继续保存或删除。','Deletion is unverified. Close and refresh to check; do not repeat the operation.','削除結果を確認できません。閉じて更新し、結果を確認してください。再操作しないでください。'],
];
export function translateUI(text, language) {
  const col = language.startsWith('ja') ? 2 : language.startsWith('en') ? 1 : 0;
  if (!col) return text;
  const exact = entries.find(row => row[0] === text.trim());
  if (exact) return text.replace(text.trim(), exact[col]);
  const day = /^周([一二三四五六日]) (\d{2}\/\d{2})( · 今天)?$/.exec(text);
  if (day) { const i='一二三四五六日'.indexOf(day[1]); return `${(col===1?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['月','火','水','木','金','土','日'])[i]} ${day[2]}${day[3]?(col===1?' · Today':'・今日'):''}`; }
  const count=/^共 (\d+) 位，输入关键词可缩小范围。$/.exec(text);
  if(count) return col===1?`${count[1]} contacts. Type to narrow results.`:`${count[1]} 件。キーワードで絞り込めます。`;
  const slot=/^(\d{4}-\d{2}-\d{2}) (上午|下午)安排拜访$/.exec(text);
  if(slot)return `${slot[1]} ${translateUI(slot[2],language)} ${col===1?'plan visit':'訪問を予定'}`;
  if(text.startsWith('保存结果尚未核实'))return col===1?'Save result unverified. Close and refresh the calendar before trying again.':'保存結果を確認できません。閉じて更新し、重複がないか確認してください。';
  if(text.startsWith('尚未连接成功：'))return col===1?'Connection failed. Check the existing plan table, date field and linked contacts. No writes are enabled.':'接続できません。既存の予定表・日時・顧客関連項目を確認してください。書き込みは無効です。';
  if(text.startsWith('另有 ')&&text.includes('计划未填写'))return col===1?'Some plans have no valid date. Complete them in the source table; dates are never guessed.':'日時が未入力の予定があります。元の表で補完してください。日時は推測しません。';
  if(text.startsWith('未连接飞书：')||text.startsWith('等待飞书授权'))return col===1?'Open this widget inside a Feishu dashboard. No data can be saved until connected.':'Feishu ダッシュボード内で開いてください。接続するまで保存できません。';
  return text;
}
export function localizeUI(language) {
  document.documentElement.lang = language.startsWith('ja')?'ja':language.startsWith('en')?'en':'zh-CN';
  if(document.documentElement.lang==='zh-CN')return;
  const excluded='.event span,.contact-option span,.chip';
  const run=()=>{
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let n=walker.nextNode();n;n=walker.nextNode()){
      if(n.parentElement?.closest(excluded)||n.parentElement?.closest('script,style'))continue;
      const next=translateUI(n.nodeValue,language);if(next!==n.nodeValue)n.nodeValue=next;
    }
    for(const node of document.querySelectorAll('[aria-label],[placeholder]')){
      if(node.matches('.chip,.contact-option input'))continue;
      for(const key of ['aria-label','placeholder'])if(node.hasAttribute(key)){const old=node.getAttribute(key),next=translateUI(old,language);if(old!==next)node.setAttribute(key,next);}
    }
  };
  run();const observer=new MutationObserver(run);observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder']});
}
