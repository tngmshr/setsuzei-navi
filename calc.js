(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./params.js'));
  else root.SetsuzeiCalc = factory(root.SetsuzeiParams);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P) {
  'use strict';
  const band = (value, bands) => bands.find(row => value <= row[0])?.[1] ?? null;
  const floor = (value, unit = P.tax.unit) => Math.floor(Math.max(0, value) / unit) * unit;
  function salaryIncome(salary, p = P) {
    const s = p.salary;
    if (salary < s.lowZeroEnd) return 0;
    if (salary < s.lowTableStart) return salary - s.minimum;
    if (salary < 2200000) return s.lowTable.find(row => salary < row[0])[1];
    const base = salary < 6600000 ? floor(salary, s.roundingUnit) : salary;
    const row = s.brackets.find(row => salary <= row[0]);
    return Math.max(0, Math.round(base * (1 - row[1]) - row[2]));
  }
  function incomeTax(taxable, p = P) {
    const amount = floor(taxable, p.tax.unit);
    if (!amount) return { taxable:0, rate:0, base:0, total:0 };
    const row = p.tax.brackets.find(row => amount < row[0]);
    const base = Math.max(0, amount * row[1] - row[2]);
    return { taxable:amount, rate:row[1], base, total:Math.floor(base * (1 + p.tax.surtax)) };
  }
  // 退職所得控除と退職所得の目安。勤続年数の1年未満の端数は切り上げる。
  function retirementDeduction(years, disability = false, p = P) {
    const r = p.retirement, y = Math.max(1, Math.ceil(years));
    const base = y <= r.longYears ? Math.max(r.minimum, r.perYear * y) : r.longBase + r.perYearLong * (y - r.longYears);
    return base + (disability ? r.disability : 0);
  }
  function retirementIncome(amount, years, disability = false, p = P) {
    const deduction = retirementDeduction(years, disability, p);
    return { deduction, income: Math.floor(Math.max(0, amount - deduction) * p.retirement.half / 1000) * 1000,
      short: Math.ceil(years) <= p.retirement.shortYears };
  }
  const numberFields = {
    salary:[0,100000000,false], age:[18,100,true], under16:[0,20,true], teen:[0,20,true], student:[0,20,true],
    dc:[0,200000,false], db:[0,200000,false], social:[0,100000000,false], mortgageAnnual:[0,10000000,false],
    reserve:[0,120,false], budget:[0,10000000,false], idecoMonthly:[0,200000,false]
  };
  const choices = { spouse:['none','dependent','dual'], pension:['none','db','dc','both','unknown'],
    mortgage:['no','yes'], matching:['no','yes','unknown'], benefits:['no','yes','unknown'],
    history:['yes','no','unknown'], insurance:['no','yes'], medical:['no','yes'],
    dcMatching:['no','yes','unknown'], dcSelect:['no','yes','unknown'] };
  function normalize(raw = {}, p = P) {
    const input = {}, assumed = [], errors = [];
    for (const [key, bounds] of Object.entries(numberFields)) {
      if (raw[key] === '' || raw[key] === null || raw[key] === undefined) {
        input[key] = p.assumptions[key] ?? null;
        assumed.push(key);
      } else {
        const v = Number(raw[key]);
        if (!Number.isFinite(v) || v < bounds[0] || v > bounds[1] || (bounds[2] && !Number.isInteger(v))) {
          errors.push(key); input[key] = null;
        } else input[key] = v;
      }
    }
    for (const [key, values] of Object.entries(choices)) {
      if (raw[key] === '' || raw[key] === null || raw[key] === undefined) {
        input[key] = p.assumptions[key]; assumed.push(key);
      } else if (values.includes(raw[key])) input[key] = raw[key];
      else { errors.push(key); input[key] = null; }
    }
    if (input.social === null && !errors.includes('social')) input.social = Math.round(input.salary * p.assumptions.socialRate);
    if (input.social > input.salary) errors.push('social');
    if (input.mortgage === 'no') input.mortgageAnnual = 0;
    return { input, assumed, errors:[...new Set(errors)] };
  }
  // 分からない項目があるときは amount を null にし、最も有利な場合（企業年金なし・会社掛金0円・加入要件を満たす）の上限を upper に入れる。
  function idecoLimit(input, after, p = P) {
    const exact = idecoLimitExact(input, after, p);
    if (exact.amount !== null) return exact;
    const best = {...input, matching:input.matching === 'unknown' ? 'no' : input.matching, benefits:input.benefits === 'unknown' ? 'no' : input.benefits,
      history:'yes', pension:input.pension === 'unknown' ? 'none' : input.pension, dc:input.dc ?? 0, db:input.db ?? 0};
    return {...exact, upper:idecoLimitExact(best, after, p).amount};
  }
  function idecoLimitExact(input, after, p = P) {
    const policy = after ? p.idecoAfter : p.idecoBefore;
    if (input.age >= policy.ageExclusive || input.matching === 'yes' || input.benefits === 'yes') return { amount:0, status:'対象外' };
    if (input.matching === 'unknown' || input.benefits === 'unknown') return { amount:null, status:'加入条件を確認' };
    if (input.age >= p.idecoEligibility.conditionalAge && input.history === 'no') return { amount:0, status:'加入要件を満たさない' };
    if (input.age >= p.idecoEligibility.conditionalAge && input.history !== 'yes') return { amount:null, status:'60歳以上の加入条件を確認' };
    if (input.pension === 'unknown') return { amount:null, status:'企業年金を確認' };
    const hasDC = ['dc','both'].includes(input.pension), hasDB = ['db','both'].includes(input.pension);
    if ((hasDC && input.dc === null) || (hasDB && input.db === null)) return { amount:null, status:'勤務先の掛金額を確認' };
    const company = (hasDC ? input.dc : 0) + (hasDB ? input.db : 0);
    let limit = input.pension === 'none' ? (after ? policy.combined : policy.none) : Math.max(0, policy.combined - company);
    if (!after && input.pension !== 'none') limit = Math.min(policy.company, limit);
    limit = floor(limit, p.idecoContribution.unit);
    if (limit < p.idecoContribution.minimum) limit = 0;
    return { amount:limit, status:limit ? (input.age >= 60 ? '条件付き・加入資格の確認が必要' : '加入資格の確認が必要') : '最低掛金未満' };
  }
  function residentAdjustment(taxable, input, totalIncome, p = P) {
    const a = p.resident.adjustment;
    if (!a) return null;
    const spouse = input.spouse === 'dependent' ? band(totalIncome, a.spouse) : 0;
    if (spouse === null) return null;
    const difference = a.basicDifference + spouse + input.teen * a.teenDifference + input.student * a.studentDifference;
    return taxable <= a.threshold ? Math.min(difference, taxable) * a.rate : Math.max(a.minimumBase, difference - (taxable - a.threshold)) * a.rate;
  }
  function taxScenario(input, monthly, p = P) {
    const childCount = input.under16 + input.teen + input.student;
    const adjustment = childCount > 0 ? Math.ceil(Math.max(0, Math.min(input.salary, p.incomeAdjustment.ceiling) - p.incomeAdjustment.start) * p.incomeAdjustment.rate) : 0;
    const income = Math.max(0, salaryIncome(input.salary, p) - adjustment);
    const spouseI = input.spouse === 'dependent' ? band(income, p.spouseIncome) : 0;
    const spouseR = input.spouse === 'dependent' ? band(income, p.resident.spouse) : 0;
    const basic = band(income, p.basic.bands);
    const familyI = spouseI + input.teen * p.dependentIncome.teen + input.student * p.dependentIncome.student;
    const familyR = spouseR === null ? null : spouseR + input.teen * p.resident.dependent.teen + input.student * p.resident.dependent.student;
    const it = incomeTax(income - input.social - basic - familyI - monthly * 12, p);
    const taxableResident = familyR === null ? null : floor(income - input.social - p.resident.basic - familyR - monthly * 12);
    const adjustmentResident = taxableResident === null ? null : residentAdjustment(taxableResident, input, income, p);
    const resident = adjustmentResident === null ? null : Math.max(0, taxableResident * p.resident.rate - adjustmentResident);
    return { income, incomeAdjustment:adjustment, basic, familyI, familyR, incomeTax:it, taxableResident, adjustmentResident, resident };
  }
  function donationLimit(scenario, p = P) {
    if (scenario.resident === null) return null;
    // 特例上限の逆算。所得税の税率境界・非課税判定等は簡易モデルのため別途注記。
    if (scenario.resident <= 0 || scenario.incomeTax.rate === 0) return 0;
    return Math.max(0, Math.floor(Math.min(
      p.donation.ownCost + scenario.resident * p.donation.specialCap / (1 - p.resident.rate - scenario.incomeTax.rate * (1 + p.tax.surtax)),
      scenario.income * p.donation.incomeLimit
    )));
  }
  function priorities(input, rate) {
    const emergency = { title:'生活防衛資金を確保する', reason:'急な出費に備えるお金。生活費の3か月分未満なら、積立より先に現金を確保します。' };
    const list = [{ title:'11月：年末調整で控除の漏れを防ぐ', reason:'書類を出すだけで使える控除から。保険料・iDeCoの証明書と扶養の申告を確認します。' }];
    if (input.reserve < 3) list.unshift({...emergency,title:'最優先：'+emergency.title}); else list.push(emergency);
    list.push({title:'ふるさと納税は毎年並行して確認',reason:'税金の前払いです。投資の積立額とは別に、寄付する現金を準備します。'});
    list.push({title:'NISA：'+(input.reserve < 3 ? '防衛資金が貯まってから' : '資産形成はまずここから検討'),reason:'利益に税金がかからない制度。売却して引き出せますが、価格変動で元本割れすることがあります。'});
    list.push({title:'iDeCo：'+(input.reserve < 3 ? '防衛資金が貯まってから' : '老後まで使わないお金で検討'),reason:'掛金を所得から差し引ける年金。原則60歳まで引き出せません。'+(rate <= 0.05 ? '所得税率5%以下では節税効果が小さめです。' : '手数料や受取時の税金も比較します。')});
    if (input.insurance === 'yes') list.push({title:'保険料控除を確認',reason:'加入中の保険の証明書を使います。控除のための新規契約は必要ありません。'});
    if (input.medical === 'yes') list.push({title:'医療費控除を確認',reason:'その年に支払った医療費と補てん額を集計。確定申告するとワンストップ特例は無効になります。'});
    if (input.mortgage === 'yes') list.push({title:'住宅ローン控除を確認',reason:'初年度は原則確定申告。所得税・住民税の控除枠とふるさと納税の併用を確認します。'});
    return list;
  }
  const LABELS = { now:'今すぐ始めよう', ready:'条件がそろったら', later:'急がなくてよい', na:'対象外', ok:'できています' };
  const yenText = v => Math.round(v).toLocaleString('ja-JP') + '円';
  // 「あなたの順番」。一般的な目安の順に、入力と結びつけた理由を付ける。個別の投資助言ではない。
  function recommend(input, result, p = P) {
    const r = p.rules, low = input.reserve < r.reserveMonths, rate = result.base.incomeTax.rate;
    const item = (id, label, title, reason, figures = [], guide = id) => ({ id, label, labelText:LABELS[label], title, reason, figures, guide });
    const list = [];
    list.push(low ? item('reserve','now','生活防衛資金を貯める',`いまの備えは生活費の${input.reserve}か月分。${r.reserveMonths}か月分たまるまでは、積立より先に現金を貯めるのが一般的な順番です。`)
      : item('reserve','ok','生活防衛資金',`生活費の${input.reserve}か月分あります。この分は投資に回さず、すぐ使える形で残します。`));
    const docs = [];
    if (input.spouse === 'dependent' || input.under16 + input.teen + input.student > 0) docs.push('家族の扶養の申告');
    if (input.insurance === 'yes') docs.push('生命保険料の証明書');
    if (input.mortgage === 'yes') docs.push('住宅ローン控除の書類（2年目以降）');
    docs.push('iDeCoに入っていれば掛金の証明書');
    list.push(item('nencho','now','年末調整で控除の漏れを防ぐ',`勤務先に書類を出すだけで使える控除から。あなたの場合：${docs.join('、')}。`));
    const d = result.donation.baseline;
    if (d === 0) list.push(item('furusato','na','ふるさと納税','所得税・住民税がほとんどかからない見込みのため、寄付しても控除の効果がありません。'));
    else if (d === null) list.push(item('furusato','ready','ふるさと納税','上限が計算できない条件です。寄付の前に上限を確かめてください。'));
    else list.push(item('furusato', low ? 'ready' : 'now', 'ふるさと納税（毎年並行して）',
      low ? '寄付は先に払い、税金が減るのは翌年です。手元の現金に余裕ができてから始めます。'
        : `投資のお金とは別枠で考えます。上限の範囲なら、自己負担は年間合計で${yenText(p.donation.ownCost)}が目安です。`,
      [{ label:'寄付上限', value:d, unit:'年' }]));
    if (low) list.push(item('nisa','ready','NISA（ニーサ）','生活防衛資金がたまってから。投資のお金は値下がりすることがあるためです。'));
    else if (!input.budget) list.push(item('nisa','ready','NISA（ニーサ）','毎月の積立予算が0円です。余裕ができたら少額から始められます。'));
    else list.push(item('nisa','now','NISA（ニーサ）','いつでも売って引き出せ、利益に税金がかかりません。資産形成はまずここから検討するのが一般的です。',
      result.nisaMonthly === null ? [] : [{ label:'NISA等に回せる額', value:result.nisaMonthly, unit:'月' }]));
    const before = result.before.amount, after = result.after.amount ?? result.after.upper;
    const cut = Math.round((rate * (1 + p.tax.surtax) + p.resident.rate) * 1000) / 10;
    if (before === 0 && after === 0) {
      const why = input.matching === 'yes' ? '企業型DCのマッチング拠出を使っていると、iDeCoとは併用できません。'
        : input.benefits === 'yes' ? '老齢基礎年金などを受け取っていると加入できません。'
        : input.age >= p.idecoAfter.ageExclusive ? '年齢の条件で加入できません。'
        : result.before.status === '加入要件を満たさない' ? '60歳以上の加入要件を満たさない入力です。'
        : '会社の掛金が多く、上限が最低掛金を下回ります。';
      list.push(item('ideco','na','iDeCo（イデコ）',why));
    } else {
      let label, reason;
      if (low) { label = 'ready'; reason = '生活防衛資金がたまってから。原則60歳まで引き出せないお金になるためです。'; }
      else if (!input.budget) { label = 'ready'; reason = '毎月の積立予算が0円です。NISAの次に、余裕ができたら検討します。'; }
      else if (rate <= 0.05) { label = 'later'; reason = `所得税率が${rate * 100}%の見込みで、税金が減るのは掛金の約${cut}%（住民税の分が中心）。原則60歳まで引き出せないことと比べ、NISAを先にするのが一般的です。`; }
      else { label = 'now'; reason = `所得税率${rate * 100}%の見込み。掛金が全額所得から差し引かれ、掛金の約${cut}%分の税金が減る目安です。原則60歳まで引き出せないので、老後まで使わないお金で。`; }
      if (before === 0 && after > 0) reason += `今の条件では、${p.idecoAfter.effective.replace('-','年')}月拠出分からの新しい上限で加入できる見込みです。`;
      if (input.age < p.idecoEligibility.firstWithdrawalAge && result.yearsTo60 < r.shortYears) reason += `60歳まであと${result.yearsTo60}年。加入期間が短いと受け取り開始が遅くなるので、受け取り時期を確認してください。`;
      if (result.tentative) reason += '上限は、勤務先の企業年金を確かめると確定します（今は最大の場合）。';
      const figures = result.monthly ? [{ label:'試算の掛金', value:result.monthly, unit:'月' }, { label:'節税の目安', value:result.simpleSaving, unit:'年' }] : [];
      list.push(item('ideco',label,'iDeCo（イデコ）',reason,figures));
    }
    if (input.insurance === 'yes') list.push(item('insurance','now','生命保険料控除','年末調整で証明書を出すだけで使えます。控除のために新しく保険に入る必要はありません。',[],'nencho'));
    if (input.medical === 'yes') list.push(item('medical','later','医療費控除','翌年2〜3月の確定申告で。確定申告すると、ふるさと納税のワンストップ特例は使えなくなるので寄付も一緒に申告します。',[],'nencho'));
    if (input.mortgage === 'yes') list.push(item('mortgage','now','住宅ローン控除','初年度は確定申告、2年目以降は年末調整で。ふるさと納税の上限が変わることがあります。',[],'nencho'));
    return list;
  }
  function calculate(raw = {}, p = P) {
    const n = normalize(raw, p);
    if (raw.period !== undefined && !['before','after'].includes(raw.period)) n.errors.push('period');
    if (n.errors.length) return {...n, valid:false};
    const i = n.input;
    if (i.salary > 20000000) return {...n, valid:false, unsupported:true};
    const before = idecoLimit(i, false, p), after = idecoLimit(i, true, p);
    const scenarioLimit = raw.period === 'after' ? after : before;
    const requested = floor(i.idecoMonthly, p.idecoContribution.unit);
    // 上限が確定しないときは、最も有利な場合の上限 upper で仮に計算し tentative で知らせる。
    const tentative = scenarioLimit.amount === null;
    const usableLimit = tentative ? scenarioLimit.upper : scenarioLimit.amount;
    let monthly = usableLimit === null || usableLimit === undefined ? null : Math.min(usableLimit, requested, floor(i.budget, p.idecoContribution.unit));
    if (monthly !== null && monthly < p.idecoContribution.minimum) monthly = 0;
    if (i.reserve < 3) monthly = 0;
    const base = taxScenario(i, 0, p), withIdeco = monthly === null ? null : taxScenario(i, monthly, p);
    const baseline = donationLimit(base, p), withIdecoLimit = withIdeco ? donationLimit(withIdeco, p) : null;
    // 入居年・契約条件・申告方法がないため、住宅控除後の実効上限は推測しない。
    const withMortgage = i.mortgage === 'yes' && (i.mortgageAnnual === null || i.mortgageAnnual > 0) ? null : withIdecoLimit;
    const simpleSaving = monthly === null ? null : base.incomeTax.taxable === 0 && base.taxableResident === 0 ? 0 : Math.round(monthly * 12 * (base.incomeTax.rate * (1 + p.tax.surtax) + p.resident.rate));
    const differenceSaving = !withIdeco || base.resident === null || withIdeco.resident === null ? null : Math.round(base.incomeTax.total - withIdeco.incomeTax.total + base.resident - withIdeco.resident);
    const out = {...n, valid:true, before, after, monthly, tentative, base, withIdeco,
      donation:{baseline,withIdeco:withIdecoLimit,withMortgage}, simpleSaving, differenceSaving,
      nisaMonthly:i.reserve < 3 ? 0 : monthly === null ? null : Math.max(0,i.budget - monthly),
      yearsTo60:Math.max(0,60-i.age), priorities:priorities(i,base.incomeTax.rate)};
    out.recommendations = recommend(i, out, p);
    return out;
  }
  function calendar(year = P.year) {
    const date = (y,m,d) => `${y}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}`;
    return [
      ['adjustment','11月','年末調整の書類を確認',date(year,11,1),date(year,11,2),'提出期限は勤務先で確認。保険料・iDeCoの証明書、扶養を確認。'],
      ['ideco','12月上旬','iDeCoの掛金変更期限を確認',date(year,12,1),date(year,12,2),'この日は確認用。締め日は自分の運営管理機関で確認。2026年12月拠出分の改正は2027年1月引落から。'],
      ['donation','12月31日','ふるさと納税の寄付の締め',date(year,12,31),date(year+1,1,1),'決済が年内に完了する条件を寄付先で確認。'],
      ['onestop','翌年1月10日','ワンストップ特例の申請期限',date(year+1,1,10),date(year+1,1,11),'原則翌年1月10日必着。休日等の取扱いは寄付先で確認。確定申告する場合は寄付分も申告。'],
      ['return','翌年2月16日〜3月15日','確定申告の期間を確認',date(year+1,2,16),date(year+1,3,16),'一般的な期間の仮予定。土日祝による変更を国税庁で確認。医療費控除、住宅ローン控除初年度、ワンストップを使わない場合など。'],
      ['resident','翌年6月','住民税決定通知書を確認',date(year+1,6,1),date(year+1,6,2),'勤務先等から届く通知書で、ふるさと納税の控除額を確認。']
    ].map(([id,label,title,start,end,description])=>({id,label,title,start,end,description}));
  }
  const icsEscape = value => String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  function foldLine(line) {
    const result = []; let current = '', size = 0;
    for (const ch of line) {
      const bytes = new TextEncoder().encode(ch).length;
      if (size + bytes > 75) {result.push(current); current = ' '; size = 1;}
      current += ch; size += bytes;
    }
    result.push(current); return result.join('\r\n');
  }
  function makeICS(events, stamp = '20261031T000000Z') {
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SetsuzeiNavi//JA','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    for (const e of events) lines.push('BEGIN:VEVENT',`UID:${e.id}-${e.start}@setsuzei-navi.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${e.start}`,`DTEND;VALUE=DATE:${e.end}`,`SUMMARY:${icsEscape(e.title)}`,`DESCRIPTION:${icsEscape(e.description)}`,'END:VEVENT');
    lines.push('END:VCALENDAR'); return lines.map(foldLine).join('\r\n')+'\r\n';
  }
  function googleCalendarURL(e) {
    const q = new URLSearchParams({action:'TEMPLATE',text:e.title,dates:`${e.start}/${e.end}`,details:e.description});
    return 'https://calendar.google.com/calendar/render?'+q;
  }
  return {retirementDeduction, retirementIncome, salaryIncome,incomeTax,normalize,idecoLimit,taxScenario,donationLimit,priorities,recommend,LABELS,calculate,calendar,makeICS,googleCalendarURL};
});
