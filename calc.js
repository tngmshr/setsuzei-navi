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
  const numberFields = {
    salary:[0,100000000,false], age:[18,100,true], under16:[0,20,true], teen:[0,20,true], student:[0,20,true],
    dc:[0,200000,false], db:[0,200000,false], social:[0,100000000,false], mortgageAnnual:[0,10000000,false],
    reserve:[0,120,false], budget:[0,10000000,false], idecoMonthly:[0,200000,false]
  };
  const choices = { spouse:['none','dependent','dual'], pension:['none','db','dc','both','unknown'],
    mortgage:['no','yes'], matching:['no','yes','unknown'], benefits:['no','yes','unknown'],
    history:['yes','no','unknown'], insurance:['no','yes'], medical:['no','yes'] };
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
  function idecoLimit(input, after, p = P) {
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
  function calculate(raw = {}, p = P) {
    const n = normalize(raw, p);
    if (raw.period !== undefined && !['before','after'].includes(raw.period)) n.errors.push('period');
    if (n.errors.length) return {...n, valid:false};
    const i = n.input;
    if (i.salary > 20000000) return {...n, valid:false, unsupported:true};
    const before = idecoLimit(i, false, p), after = idecoLimit(i, true, p);
    const scenarioLimit = raw.period === 'after' ? after : before;
    const requested = floor(i.idecoMonthly, p.idecoContribution.unit);
    let monthly = scenarioLimit.amount === null ? null : Math.min(scenarioLimit.amount, requested, floor(i.budget, p.idecoContribution.unit));
    if (monthly !== null && monthly < p.idecoContribution.minimum) monthly = 0;
    if (i.reserve < 3) monthly = 0;
    const base = taxScenario(i, 0, p), withIdeco = monthly === null ? null : taxScenario(i, monthly, p);
    const baseline = donationLimit(base, p), withIdecoLimit = withIdeco ? donationLimit(withIdeco, p) : null;
    // 入居年・契約条件・申告方法がないため、住宅控除後の実効上限は推測しない。
    const withMortgage = i.mortgage === 'yes' && (i.mortgageAnnual === null || i.mortgageAnnual > 0) ? null : withIdecoLimit;
    const simpleSaving = monthly === null ? null : base.incomeTax.taxable === 0 && base.taxableResident === 0 ? 0 : Math.round(monthly * 12 * (base.incomeTax.rate * (1 + p.tax.surtax) + p.resident.rate));
    const differenceSaving = !withIdeco || base.resident === null || withIdeco.resident === null ? null : Math.round(base.incomeTax.total - withIdeco.incomeTax.total + base.resident - withIdeco.resident);
    return {...n, valid:true, before, after, monthly, base, withIdeco,
      donation:{baseline,withIdeco:withIdecoLimit,withMortgage}, simpleSaving, differenceSaving,
      nisaMonthly:i.reserve < 3 ? 0 : monthly === null ? null : Math.max(0,i.budget - monthly),
      yearsTo60:Math.max(0,60-i.age), priorities:priorities(i,base.incomeTax.rate)};
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
  return {salaryIncome,incomeTax,normalize,idecoLimit,taxScenario,donationLimit,priorities,calculate,calendar,makeICS,googleCalendarURL};
});
