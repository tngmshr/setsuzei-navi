// 計算ツールの画面。index.html の本体が用意した window.NaviUI を使う。入力は端末内（localStorage）だけに保存する。
window.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const U = window.NaviUI; if (!U) return;
  const {C, P, $, text, yen, man, svgEl, chartBox} = U;
  const key = 'setsuzeiNavi.tools.v1', inputs = [...document.querySelectorAll('[data-tool]')];
  const num = id => { const v = $(id).value; return v === '' ? null : Number(v); };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const kpi = (id, list) => $(id).replaceChildren(...list.map(([label, value]) => { const d = el('div'); d.append(el('span', '', label), el('b', '', value)); return d; }));
  const manYen = v => (Math.round(v/1000)/10).toLocaleString('ja-JP') + '万円';
  let events = [];

  function save() {
    const data = {events};
    for (const i of inputs) data[i.id] = i.type === 'checkbox' ? i.checked : i.value;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      for (const i of inputs) if (i.id in data) { if (i.type === 'checkbox') i.checked = data[i.id] === true; else if (typeof data[i.id] === 'string') i.value = data[i.id]; }
      if (Array.isArray(data.events)) events = data.events.filter(e => e && typeof e === 'object').slice(0, 12).map(e => ({age:String(e.age ?? ''), name:String(e.name ?? '').slice(0, 20), amount:String(e.amount ?? ''), kind:e.kind === 'in' ? 'in' : 'out'}));
    } catch {}
  }

  // 老後資金の置き場所の順番：診断の入力と税率を使う。
  const guides = {dcAuto:'asset-dc', db:'asset-db', reserve:'reserve', choose:'asset-ideco', match:'asset-ideco', ideco:'asset-ideco', dcselect:'asset-w-sentaku', nisa:'nisa'};
  function priority() {
    const r = C.calculate(U.read()), notice = $('rpNotice');
    if (!r.valid) { notice.hidden = false; notice.replaceChildren('先に診断の入力（年収・年齢・会社の年金など）を入れてください。', el('br'), Object.assign(el('a', '', '診断の入力へ'), {href:'#input'})); $('rpList').replaceChildren(); $('rpNotes').replaceChildren(); return; }
    notice.hidden = true;
    const res = C.retirementPriority(r.input, r.base.incomeTax.rate, {lockable:num('rpLock') || 0, idecoFee:num('rpFee') || 0, matchingCap:num('rpCap') || 0, needBefore60:$('rpBefore60').checked});
    $('rpList').replaceChildren(...res.items.map(item => {
      const li = el('li'), head = el('div', 'head');
      head.append(el('h2', '', item.title), el('span', 'badge b-' + item.label, item.labelText)); li.append(head, el('p', '', item.reason));
      if (item.figures.length) { const figs = el('p', 'figs'); for (const f of item.figures) { const s = el('span'); s.append(f.label + ' ', el('b', '', yen(f.value)), '／' + f.unit); figs.append(s); } li.append(figs); }
      if (guides[item.id]) { const b = el('button', 'more', '解説を読む'); b.type = 'button'; b.dataset.guide = guides[item.id]; li.append(b); }
      return li;
    }));
    $('rpNotes').replaceChildren(...res.notes.map(n => el('li', '', n)));
  }

  // キャッシュフロー表
  function eventRow(e, i) {
    const row = el('div', 'ev-row');
    const age = Object.assign(el('input'), {type:'number', min:18, max:90, inputMode:'numeric', value:e.age, placeholder:'年齢'}), name = Object.assign(el('input'), {type:'text', maxLength:20, value:e.name, placeholder:'例 車の買い替え'});
    const amount = Object.assign(el('input'), {type:'number', min:0, max:100000, inputMode:'numeric', value:e.amount, placeholder:'万円'}), kind = el('select'), del = el('button', 'btn ev-del', '削除');
    age.setAttribute('aria-label', '年齢'); name.setAttribute('aria-label', '内容'); amount.setAttribute('aria-label', '金額（万円）'); kind.setAttribute('aria-label', '出費か収入か');
    kind.append(Object.assign(el('option', '', '出費'), {value:'out'}), Object.assign(el('option', '', '収入'), {value:'in'})); kind.value = e.kind; del.type = 'button';
    const sync = () => { events[i] = {age:age.value, name:name.value, amount:amount.value, kind:kind.value}; save(); cashflow(); };
    [age, name, amount, kind].forEach(x => x.addEventListener('input', sync));
    del.addEventListener('click', () => { events.splice(i, 1); renderEvents(); save(); cashflow(); });
    row.append(age, name, amount, kind, del); return row;
  }
  function renderEvents() { $('cfEvents').replaceChildren(...events.map(eventRow)); $('cfAdd').disabled = events.length >= 12; }
  function cashflow() {
    const main = C.calculate(U.read()), age = num('cfAge') ?? (main.valid ? main.input.age : 40), m = id => (num(id) ?? 0)*10000;
    const retireAge = num('cfRetire') ?? 65, pensionAge = num('cfPensionAge') ?? 65;
    $('cfAge').placeholder = main.valid ? main.input.age + '（診断の値）' : '例 40';
    if (!(age >= 18 && age <= 89) || !(retireAge >= 40) || !(pensionAge >= 60)) { kpi('cfKpi', [['入力を確認', '—']]); $('cfChart').textContent = ''; $('cfTable').tBodies[0].replaceChildren(); return; }
    const ev = events.map(e => ({age:Number(e.age), name:e.name || (e.kind === 'in' ? '収入' : '出費'), amount:(Number(e.amount) || 0)*10000*(e.kind === 'in' ? -1 : 1)})).filter(e => e.age >= age && e.amount);
    if (m('cfLump')) ev.push({age:retireAge, name:'退職金', amount:-m('cfLump')});
    const rows = C.cashflow({age, income:m('cfIncome'), expense:m('cfExpense'), retireExpense:num('cfRetireExpense') === null ? null : m('cfRetireExpense'), savings:m('cfSavings'),
      incomeGrowth:(num('cfIncomeGrowth') ?? 0)/100, expenseGrowth:(num('cfExpenseGrowth') ?? 0)/100, rate:(num('cfRate') ?? 0)/100, years:91 - age, retireAge, pensionAge, pension:m('cfPension'), events:ev});
    const low = rows.reduce((a, b) => b.balance < a.balance ? b : a), neg = rows.find(r => r.balance < 0), last = rows[rows.length - 1];
    kpi('cfKpi', [['90歳の貯蓄', manYen(last.balance)], ['いちばん少ない年', `${low.age}歳 ${manYen(low.balance)}`], ['マイナスになる年', neg ? neg.age + '歳から' : '90歳までなし']]);
    const W = 340, H = 200, L = 40, R = 6, T = 14, B = 26, max = Math.max(1, ...rows.map(r => r.balance)), min = Math.min(0, ...rows.map(r => r.balance));
    const y = v => T + (H - T - B)*(max - v)/(max - min), bw = (W - L - R)/rows.length;
    const {svg, showTip} = chartBox('cfChart', W, H, `${age}歳から90歳までの貯蓄の推移。90歳で${manYen(last.balance)}。${neg ? neg.age + '歳でマイナスになります。' : 'マイナスになる年はありません。'}`);
    for (let k = 0; k <= 4; k++) { const v = min + (max - min)*k/4; svgEl('line', {x1:L, x2:W - R, y1:y(v), y2:y(v), stroke:'#e3e8e3'}, svg); svgEl('text', {x:L - 4, y:y(v) + 3, 'text-anchor':'end', class:'ax'}, svg).textContent = Math.round(v/10000).toLocaleString('ja-JP'); }
    svgEl('text', {x:L - 4, y:T - 4, 'text-anchor':'end', class:'ax'}, svg).textContent = '万円';
    svgEl('line', {x1:L, x2:W - R, y1:y(0), y2:y(0), stroke:'#8a9a92'}, svg);
    rows.forEach((r, i) => {
      const x0 = L + i*bw, h = Math.abs(y(r.balance) - y(0));
      if (h > 0.5) svgEl('rect', {x:x0 + 0.5, y:r.balance > 0 ? y(r.balance) : y(0), width:Math.max(1, bw - 1), height:h, fill:r.balance < 0 ? '#b5761a' : '#00826b'}, svg);
      if (r.events.length) svgEl('circle', {cx:x0 + bw/2, cy:T + 2, r:2.5, fill:'#b5761a'}, svg);
      if (r.age % 10 === 0) svgEl('text', {x:x0 + bw/2, y:H - 8, 'text-anchor':'middle', class:'ax'}, svg).textContent = r.age + '歳';
      const hit = svgEl('rect', {x:x0, y:T, width:bw, height:H - T - B, class:'hit'}, svg);
      hit.addEventListener('pointerenter', () => showTip(`${r.age}歳 貯蓄 ${manYen(r.balance)}${r.events.length ? '（' + r.events.join('・') + '）' : ''}`, x0 + bw/2, y(Math.max(0, r.balance))));
    });
    const fmt = v => (Math.round(v/1000)/10).toLocaleString('ja-JP');
    $('cfTable').tBodies[0].replaceChildren(...rows.map(r => {
      const tr = el('tr', r.events.length ? 'hl' : ''); tr.append(el('td', '', r.age + '歳'), el('td', '', r.events.join('・')), el('td', '', fmt(r.income)), el('td', '', fmt(r.expense)), el('td', r.net < 0 ? 'minus' : 'plus', fmt(r.net)), el('td', r.balance < 0 ? 'minus' : '', fmt(r.balance))); return tr;
    }));
  }

  // 目標から逆算
  function goal() {
    const target = (num('glTarget') ?? 0)*10000, years = num('glYears'), rate = (num('glRate') ?? 0)/100;
    if (!(target > 0) || !(years >= 1 && years <= 50) || !(rate >= 0 && rate <= 0.1)) { kpi('glKpi', [['入力を確認', '—']]); $('glTable').tBodies[0].replaceChildren(); return; }
    const mo = C.requiredMonthly(target, rate, years), principal = mo*12*years;
    kpi('glKpi', [['毎月の積立額', yen(mo)], ['元本の合計', manYen(principal)], ['運用で増える分（仮定）', manYen(Math.max(0, target - principal))]]);
    const rates = [...new Set([0, 0.01, 0.02, 0.03, 0.04, 0.05, rate])].sort((a, b) => a - b);
    $('glTable').tBodies[0].replaceChildren(...rates.map(r => { const m = C.requiredMonthly(target, r, years), tr = el('tr', r === rate ? 'hl' : ''); tr.append(el('td', '', Math.round(r*1000)/10 + '%'), el('td', '', yen(m)), el('td', '', manYen(m*12*years))); return tr; }));
  }

  // ねんきん定期便
  function pension() {
    const annual = (num('pnAnnual') ?? 0)*10000, cmp = Math.round(num('pnCompare') ?? 70);
    if (!(annual > 0) || !(cmp >= 60 && cmp <= 75)) { kpi('pnKpi', [['入力を確認', '—']]); $('pnChart').textContent = ''; return; }
    const list = C.pensionByAge(annual), c = list.find(r => r.age === cmp), base = list.find(r => r.age === P.pension.base);
    const pct = v => (v > 0 ? '+' : '') + Math.round(v*1000)/10 + '%';
    let even = '同じ（65歳）';
    if (cmp !== P.pension.base) {
      const x = (cmp*c.annual - P.pension.base*base.annual)/(c.annual - base.annual), yr = Math.floor(x), mo = Math.floor((x - yr)*12);
      even = cmp > P.pension.base ? `${yr}歳${mo}か月より長生きすると${cmp}歳開始が多い` : `${yr}歳${mo}か月より長生きすると65歳開始が多い`;
    }
    kpi('pnKpi', [[`${cmp}歳から受け取ると（年額）`, manYen(c.annual)], ['65歳開始との差', pct(c.change)], ['受け取り総額の比較（額面）', even]]);
    const W = 340, H = 190, L = 34, R = 6, T = 18, B = 24, max = Math.max(...list.map(r => r.annual)), y = v => T + (H - T - B)*(1 - v/max), bw = (W - L - R)/list.length;
    const {svg, showTip} = chartBox('pnChart', W, H, `受け取り開始年齢ごとの年金の年額。65歳で${manYen(base.annual)}、${cmp}歳で${manYen(c.annual)}`);
    for (let k = 0; k <= 4; k++) { const v = max*k/4; svgEl('line', {x1:L, x2:W - R, y1:y(v), y2:y(v), stroke:'#e3e8e3'}, svg); svgEl('text', {x:L - 4, y:y(v) + 3, 'text-anchor':'end', class:'ax'}, svg).textContent = Math.round(v/10000); }
    svgEl('text', {x:L - 4, y:T - 6, 'text-anchor':'end', class:'ax'}, svg).textContent = '万円';
    list.forEach((r, i) => {
      const x0 = L + i*bw + 1, on = r.age === cmp || r.age === P.pension.base;
      svgEl('rect', {x:x0, y:y(r.annual), width:bw - 2, height:y(0) - y(r.annual), rx:3, fill:r.age < P.pension.base ? '#b5761a' : '#00826b', opacity:on ? 1 : .45}, svg);
      if (r.age % 5 === 0) svgEl('text', {x:x0 + bw/2 - 1, y:H - 8, 'text-anchor':'middle', class:'ax'}, svg).textContent = r.age + '歳';
      if (on) svgEl('text', {x:x0 + bw/2 - 1, y:y(r.annual) - 4, 'text-anchor':'middle', class:'lb'}, svg).textContent = Math.round(r.annual/10000);
      const hit = svgEl('rect', {x:L + i*bw, y:T, width:bw, height:H - T - B, class:'hit'}, svg);
      hit.addEventListener('pointerenter', () => showTip(`${r.age}歳から：年 ${manYen(r.annual)}（${r.change ? pct(r.change) : '増減なし'}）`, L + i*bw + bw/2, y(r.annual)));
    });
  }

  // 必要保障額
  function protect() {
    const m = id => (num(id) ?? 0)*10000, g = C.protectionGap({living:m('pgLiving'), years:num('pgYears') ?? 0, education:m('pgEducation'), other:m('pgOther'), survivor:m('pgSurvivor'), savings:m('pgSavings'), cover:m('pgCover')});
    kpi('pgKpi', [['必要なお金', manYen(g.need)], ['用意できるお金', manYen(g.have)], [g.gap ? '足りない額（必要保障額）' : '上回っている額', manYen(g.gap || g.surplus)]]);
    const W = 340, H = 110, L = 92, R = 10, max = Math.max(1, g.need, g.have), x = v => (W - L - R)*v/max;
    const {svg, showTip} = chartBox('pgChart', W, H, `必要なお金${manYen(g.need)}、用意できるお金${manYen(g.have)}、足りない額${manYen(g.gap)}`);
    [['必要なお金', g.need, '#c9d6d0', 18], ['用意できるお金', g.have, '#00826b', 62]].forEach(([label, v, fill, top]) => {
      svgEl('text', {x:L - 6, y:top + 17, 'text-anchor':'end', class:'t'}, svg).textContent = label;
      if (v > 0) svgEl('rect', {x:L, y:top, width:x(v), height:26, rx:4, fill}, svg);
      const hit = svgEl('rect', {x:0, y:top, width:W, height:26, class:'hit'}, svg); hit.addEventListener('pointerenter', () => showTip(`${label} ${manYen(v)}`, L + x(v)/2, top));
    });
    if (g.gap > 0) { svgEl('rect', {x:L + x(g.have) + 2, y:62, width:Math.max(0, x(g.gap) - 2), height:26, rx:4, fill:'none', stroke:'#b5761a', 'stroke-width':2, 'stroke-dasharray':'4 3'}, svg); svgEl('text', {x:Math.min(L + x(g.have) + x(g.gap)/2, W - 40), y:104, 'text-anchor':'middle', class:'lb'}, svg).textContent = '不足 ' + manYen(g.gap); }
  }

  // 保存・印刷・見直し
  const status = t => text('dataStatus', t);
  $('exportData').addEventListener('click', () => {
    let main = null, tools = null; try { main = JSON.parse(localStorage.getItem(U.key) || 'null'); tools = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    const blob = new Blob([JSON.stringify({app:'setsuzei-navi', version:1, exported:new Date().toISOString().slice(0, 10), inputs:main, tools}, null, 2)], {type:'application/json'});
    const a = Object.assign(el('a'), {href:URL.createObjectURL(blob), download:'setsuzei-navi-input.json'}); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    status('書き出しました。ファイルには年収などの入力が入っているので、扱いに気をつけてください。');
  });
  $('importData').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text()), ok = v => v === null || (typeof v === 'object' && !Array.isArray(v));
      if (!d || d.app !== 'setsuzei-navi' || !ok(d.inputs) || !ok(d.tools)) throw Error();
      if (!confirm('今の入力を、ファイルの内容で置き換えます。よろしいですか？')) return;
      if (d.inputs) localStorage.setItem(U.key, JSON.stringify(d.inputs)); if (d.tools) localStorage.setItem(key, JSON.stringify(d.tools));
      location.reload();
    } catch { status('このファイルは読み込めません。このアプリで書き出したファイルを選んでください。'); }
  });
  $('printPage').addEventListener('click', () => window.print());
  let opened = [];
  window.addEventListener('beforeprint', () => { opened = [...document.querySelectorAll('.screen:not([hidden]) details:not([open])')]; opened.forEach(d => d.open = true); });
  window.addEventListener('afterprint', () => { opened.forEach(d => d.open = false); opened = []; });
  $('reviewIcs').addEventListener('click', () => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1); const ymd = x => x.toISOString().slice(0, 10).replace(/-/g, ''), e = new Date(d); e.setDate(e.getDate() + 1);
    const ics = C.makeICS([{id:'yearly-review', start:ymd(d), end:ymd(e), title:'節税・資産形成ナビ：年1回の見直し', description:'年収・家族・会社の制度の変化を入力し直す。iDeCo・DCの掛金と運用先、NISAの積立額、生活防衛資金、保険の保障額を確認する。'}], new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')).replace('END:VEVENT', 'RRULE:FREQ=YEARLY\r\nEND:VEVENT');
    const a = Object.assign(el('a'), {href:URL.createObjectURL(new Blob([ics], {type:'text/calendar;charset=utf-8'})), download:'setsuzei-navi-review.ics'}); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    status('毎年の見直しの予定（.ics）を保存しました。カレンダーで開くと登録できます。');
  });

  load(); renderEvents();
  $('cfAdd').addEventListener('click', () => { events.push({age:'', name:'', amount:'', kind:'out'}); renderEvents(); save(); $('cfEvents').lastElementChild.firstElementChild.focus(); });
  const all = () => { priority(); cashflow(); goal(); pension(); protect(); };
  for (const i of inputs) i.addEventListener('input', () => { save(); all(); });
  document.getElementById('conditions').addEventListener('input', () => { priority(); cashflow(); });
  U.onShow = n => { if (n === U.toolsIndex) all(); };
  all();
});
