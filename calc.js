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
  // 6つの係数。rate は年利（小数）、years は年数。利回りは仮定の値で、予測ではない。
  function coefficients(rate, years) {
    const g = Math.pow(1 + rate, years);
    const ann = rate === 0 ? years : (g - 1) / rate;
    return { shuka:g, genka:1/g, nenkinShuka:ann, gensai:1/ann, shihonKaishu:rate === 0 ? 1/years : rate*g/(g-1), nenkinGenka:rate === 0 ? years : (1 - 1/g)/rate };
  }
  // 毎月の積立（月末）を月複利で計算し、1年ごとの元本と評価額を返す。仮定の試算。
  function accumulate(monthly, rate, years) {
    const m = Math.pow(1 + rate, 1/12) - 1, out = [{year:0, principal:0, value:0}];
    let v = 0;
    for (let i = 1; i <= years*12; i++) { v = v*(1 + m) + monthly; if (i % 12 === 0) out.push({year:i/12, principal:monthly*i, value:Math.round(v)}); }
    return out;
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
    // 会社の年金（企業型DC・DB）。会社ごとに条件が違うため、確認先を示す。
    if (input.pension === 'dc' || input.pension === 'both') {
      let label = 'now', reason = '加入者専用サイトで、会社の掛金（事業主掛金）・運用先・iDeCoの拠出可能見込み額を確かめます。運用先を選ばないままだと、規約で決めた商品で運用されます。';
      if (input.matching === 'yes') { label = 'ok'; reason = 'マッチング拠出を利用中です。この間はiDeCoと併用できません。掛金と運用先を年1回見直します。'; }
      else if (input.dcMatching === 'yes') reason += 'マッチング拠出とiDeCoはどちらか一方です。上限・選べる商品・手数料を比べて選びます。';
      reason += `${p.dc.effective.replace('-','年')}月から、会社の掛金とあわせた上限は月${yenText(p.dc.after)}になります。`;
      list.push(item('dc',label,'企業型DC（会社の年金）を確認',reason,[],'asset-dc'));
    } else if (input.pension === 'db') {
      list.push(item('db','ready','DB（確定給付企業年金）を確認','会社が給付を決める年金です。iDeCoの上限は「他制度掛金相当額」で変わるので、勤務先に額を確かめます。',[],'asset-db'));
    }
    if (input.dcSelect === 'yes') list.push(item('dcselect','ready','選択制DCの影響を確認','給与の一部を掛金に回すしくみです。掛金に回した分は給与でなくなるため、社会保険・雇用保険の給付に影響することがあります。会社の説明で確かめてから選びます。',[],'asset-dc'));
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

  // 目標額から逆算した毎月の積立額（月末積立・月複利）。accumulate と同じ前提。
  function requiredMonthly(target, rate, years) {
    const m = Math.pow(1 + rate, 1/12) - 1, n = Math.round(years*12);
    if (n <= 0) return null;
    const fv = m === 0 ? n : (Math.pow(1 + m, n) - 1) / m;
    return Math.ceil(target / fv);
  }
  // ねんきん定期便の65歳の見込み額から、受け取り開始年齢ごとの年額を出す。月単位の増減率は params の値。
  function pensionByAge(annual65, p = P) {
    const r = p.pension, out = [];
    for (let a = r.early.minAge; a <= r.defer.maxAge; a++) {
      const ch = a < r.base ? -Math.min((r.base - a)*12*r.early.rate, r.early.max) : Math.min((a - r.base)*12*r.defer.rate, r.defer.max);
      out.push({ age:a, change:Math.round(ch*1000)/1000, annual:Math.round(annual65*(1 + ch)) });
    }
    return out;
  }
  // 必要保障額の簡易計算。金額はすべて利用者が入れた値で、制度値は使わない。
  function protectionGap(v) {
    const need = v.living*12*v.years + v.education + v.other;
    const have = v.survivor*12*v.years + v.savings + v.cover;
    return { need, have, gap:Math.max(0, need - have), surplus:Math.max(0, have - need) };
  }
  // 年ごとのキャッシュフロー表。収入・支出は手取りベース、上昇率と運用利回りは仮定。retireExpense は退職後の支出（任意）。
  function cashflow(v) {
    const rows = []; let balance = v.savings;
    for (let k = 0; k < v.years; k++) {
      const age = v.age + k, working = age < v.retireAge;
      const income = (working ? Math.round(v.income*Math.pow(1 + v.incomeGrowth, k)) : 0) + (age >= v.pensionAge ? v.pension : 0);
      const events = (v.events || []).filter(e => e.age === age), extra = events.reduce((s, e) => s + e.amount, 0);
      const expense = Math.round((!working && v.retireExpense != null ? v.retireExpense : v.expense)*Math.pow(1 + v.expenseGrowth, k)) + extra;
      balance = Math.round(balance*(1 + v.rate) + income - expense);
      rows.push({ year:k + 1, age, income, expense, net:income - expense, balance, events:events.map(e => e.name) });
    }
    return rows;
  }
  // 老後資金の器（企業型DC・マッチング拠出・iDeCo・選択制DC・NISA）の一般的な優先順位。
  // opts: lockable（60歳まで使わないと決めた毎月の額）, needBefore60（60歳前に使う予定）, idecoFee（iDeCoの毎月の手数料・利用者入力）, matchingCap（規約の上限・任意）。
  // 個別の投資助言ではなく、商品・金融機関・配分は決めない。
  function retirementPriority(input, rate, opts = {}, p = P) {
    const hasDC = ['dc','both'].includes(input.pension), hasDB = ['db','both'].includes(input.pension);
    const cut = rate === null ? null : rate*(1 + p.tax.surtax) + p.resident.rate, cutPct = cut === null ? '—' : Math.round(cut*1000)/10;
    const ideco = idecoLimit(input, true, p), idecoMax = input.matching === 'yes' ? 0 : ideco.amount ?? ideco.upper ?? 0;
    const company = (hasDC ? input.dc || 0 : 0) + (hasDB ? input.db || 0 : 0);
    let matchMax = hasDC && input.dcMatching === 'yes' ? floor(Math.max(0, p.dc.after - company), 1000) : 0;
    if (matchMax && opts.matchingCap > 0) matchMax = Math.min(matchMax, opts.matchingCap);
    const lock = Math.max(0, opts.lockable || 0), low = input.reserve < p.rules.reserveMonths, years = Math.max(0, 60 - input.age);
    const startAge = (p.dcReceive.ages.find(([y]) => years >= y) || p.dcReceive.ages[p.dcReceive.ages.length - 1])[1];
    const taxLow = rate !== null && rate <= 0.05, fee = opts.idecoFee > 0 ? opts.idecoFee : null;
    const saving = m => cut === null ? null : Math.round(m*12*cut);
    const items = [], add = (id, label, title, reason, figures = []) => items.push({ id, label, labelText:LABELS[label], title, reason, figures });
    const stage = (net) => low || (!lock && !input.budget) ? 'ready' : taxLow || (net !== null && net <= 0) ? 'later' : 'now';
    if (hasDC) add('dcAuto','now','企業型DC：会社の掛金の運用先を決める','会社が出す掛金なので、自分の手取りは減りません。加入者専用サイトで運用先を選びます。選ばないと、規約で決めた商品で運用されます。',[{label:'会社の掛金', value:input.dc || 0, unit:'月'}]);
    if (hasDB) add('db','ok','DB：自分で決めることはありません','会社が給付を決める年金です。その分、iDeCo・マッチング拠出の上限が小さくなります。');
    if (low) add('reserve','now','先に生活防衛資金を貯める',`生活費の${p.rules.reserveMonths}か月分がたまるまでは、60歳まで引き出せないお金（DC・iDeCo）にしないのが一般的な順番です。`);
    const taxText = taxLow ? `所得税率${rate*100}%の見込みで、税金が減るのは掛金の約${cutPct}%（住民税の分が中心）。60歳まで引き出せないことと比べると、NISAを先にするのが一般的です。`
      : `掛金が全額所得から差し引かれ、掛金の約${cutPct}%分の税金が減る目安です。60歳まで使わないと決めたお金の範囲で使います。`;
    const both = matchMax > 0 && idecoMax > 0, want = lock || Math.max(matchMax, idecoMax);
    let base = 0;
    if (both) {
      const first = matchMax >= Math.min(want, idecoMax) ? 'match' : 'ideco', m = Math.min(want, first === 'match' ? matchMax : idecoMax);
      const s = saving(m), net = first === 'ideco' && fee !== null && s !== null ? s - fee*12 : null; base = m;
      add('choose', stage(net), 'マッチング拠出かiDeCo：'+(first === 'match' ? 'まずマッチング拠出' : 'まずiDeCo'),
        'この2つは同時に使えません。'+(first === 'match'
          ? '税金の効果は同じで、給与天引きのため手続きが少なく、口座の手数料を会社が負担していることが多いからです（規約で確認）。商品を自分で広く選びたい、転職が多いといった場合はiDeCoも候補です。'
          : 'マッチング拠出の上限より多く掛けたいので、枠の大きいiDeCoを先にします。iDeCoは口座の手数料が自己負担です。')
        +taxText+(net !== null ? `手数料（月${fee}円）を引いた差し引きは年${net.toLocaleString('ja-JP')}円の目安です。` : ''),
        [{label:'マッチング拠出の上限', value:matchMax, unit:'月'},{label:'iDeCoの上限', value:idecoMax, unit:'月'}, ...(lock && s !== null ? [{label:'節税の目安', value:s, unit:'年'}] : [])]);
    } else if (matchMax > 0 || idecoMax > 0) {
      const id = matchMax > 0 ? 'match' : 'ideco', max = Math.max(matchMax, idecoMax), m = Math.min(want, max);
      const s = saving(m), net = id === 'ideco' && fee !== null && s !== null ? s - fee*12 : null; base = m;
      add(id, stage(net), id === 'match' ? 'マッチング拠出' : 'iDeCo（イデコ）', taxText
        + (net !== null ? `手数料（月${fee}円）を引いた差し引きは年${net.toLocaleString('ja-JP')}円の目安です。` : id === 'ideco' ? 'iDeCoは口座の手数料が自己負担です。金融機関の手数料を入れると差し引きを出します。' : ''),
        [{label:'上限', value:max, unit:'月'}, ...(lock && s !== null ? [{label:'節税の目安', value:s, unit:'年'}] : [])]);
    } else if (input.matching === 'yes') add('match','ok','マッチング拠出（利用中）','iDeCoとは併用できません。掛金と運用先を年1回見直します。');
    else add('ideco','na','iDeCo・マッチング拠出','今の入力では使える枠がありません（年齢・年金の受給・会社の掛金などの条件）。');
    if (input.dcSelect === 'yes') add('dcselect','ready','選択制DC：給与で受け取るか掛金にするか','掛金にした分は給与でなくなるので、所得税・住民税に加えて社会保険料も下がることがあります。その代わり、将来の厚生年金や、傷病手当金・出産手当金・失業給付などの計算のもとも下がることがあります。会社の掛金として扱われるので、iDeCo・マッチング拠出の上限も小さくなります。会社の説明で影響を確かめてから選びます。');
    add('nisa', low ? 'ready' : 'now', 'NISA：60歳前に使うかもしれないお金',
      (opts.needBefore60 ? '住宅・教育など60歳前に使う予定があるので、いつでも引き出せるNISAを先に使うのが一般的です。' : 'いつでも引き出せ、利益に税金がかかりません。DC・iDeCoで使い切れない分や、使い道がまだ決まっていないお金の置き場所です。')
      + '掛けるときの節税はありません。');
    if (opts.needBefore60) {
      const n = items.splice(items.findIndex(i => i.id === 'nisa'), 1)[0], at = items.findIndex(i => ['choose','match','ideco','dcselect'].includes(i.id));
      items.splice(at < 0 ? items.length : at, 0, n);
    }
    const notes = [];
    if (years < 10 && input.age < 60) notes.push(`60歳まであと${years}年。DC・iDeCoの加入期間が10年に満たないと、受け取り開始が遅くなります（この場合は${startAge}歳から）。`);
    if (lock > Math.max(matchMax, idecoMax) && Math.max(matchMax, idecoMax) > 0) notes.push('60歳まで使わない額のうち、上限を超える分はNISAなどで積み立てます。');
    return { items, matchMax, idecoMax, idecoStatus:ideco.status, saving:base ? saving(base) : 0, notes, startAge };
  }
  // 寄付記録は日付（YYYY-MM-DD）と円単位の金額の配列。壊れた行は集計しない。
  function furusatoProgress(log, year, limit) {
    const rows = Array.isArray(log) ? log : [];
    const valid = rows.filter(r => {
      if (!r || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isSafeInteger(r.amount) || r.amount <= 0) return false;
      const d = new Date(r.date + 'T00:00:00Z');
      return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === r.date && Number(r.date.slice(0,4)) === year;
    });
    const total = valid.reduce((sum, r) => sum + r.amount, 0);
    const cap = Number.isSafeInteger(limit) && limit >= 0 ? limit : null;
    return {count:valid.length, total, limit:cap, remaining:cap === null ? null : Math.max(0, cap - total), exceeded:cap !== null && total > cap};
  }
  // 制度の値は再計算せず、計算済みの目安と既存の貯蓄入力だけを残す。
  function historySummary(result, tools = {}, year = P.year) {
    if (!result?.valid || !Number.isInteger(year)) return null;
    const savings = tools?.cfSavings;
    return {year, salary:result.input.salary, idecoMonthly:result.monthly, saving:result.simpleSaving,
      donationLimit:result.donation.withIdeco,
      savings:savings !== '' && savings !== null && savings !== undefined && Number.isFinite(Number(savings)) && Number(savings) >= 0 ? Number(savings)*10000 : null};
  }
  function compareHistory(previous, current) {
    const keys = ['salary','idecoMonthly','saving','donationLimit','savings'];
    const amount = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    return keys.map(key => {
      const before = amount(previous?.[key]), now = amount(current?.[key]);
      return {key, previous:before, current:now, difference:before === null || now === null ? null : now - before};
    });
  }
  // 平均余命と、今の年齢の人のうち4人に1人がまだ生きている年齢（生命表の生存数から求める）。
  function lifeSpan(sex, age, p = P) {
    const t = p.life[sex], a = Math.floor(age);
    if (!t || !(a >= 0 && a <= 100)) return null;
    const quarter = t.l.findIndex((v, k) => k >= a && v <= t.l[a] / 4);
    return { e:t.e[a], average:a + t.e[a], quarter:quarter < 0 ? null : quarter };
  }
  // 医療費控除とセルフメディケーション税制の比較。medical は補てん後の医療費（対象の市販薬を含む）、otc はそのうち対象の市販薬。rate は所得税率。
  function medicalChoice(medical, otc, income, rate, p = P) {
    const m = p.medical, s = p.selfMed, cut = Math.min(m.floor, Math.floor(Math.max(0, income) * m.rate));
    const effect = d => Math.floor(d * rate * (1 + p.tax.surtax)) + Math.floor(d * p.resident.rate);
    const normal = Math.min(m.cap, Math.max(0, medical - cut)), self = Math.min(s.cap, Math.max(0, otc - s.floor));
    const a = { deduction:normal, saving:effect(normal) }, b = { deduction:self, saving:effect(self) };
    return { normal:a, self:b, better:a.saving === b.saving ? (a.saving ? 'same' : 'none') : a.saving > b.saving ? 'normal' : 'self', cut };
  }
  // DC・iDeCo の一時金と退職金を、同じ年に受け取る場合と、調整がかからないほど間隔を空けた場合の税の目安。
  function lumpSumPlan(v, p = P) {
    const tax = r => C_tax(r.income, p);
    const together = retirementIncome(v.dc + v.lump, Math.max(v.dcYears, v.workYears), false, p);
    const dc = retirementIncome(v.dc, v.dcYears, false, p), lump = retirementIncome(v.lump, v.workYears, false, p);
    const t = { deduction:together.deduction, income:together.income, tax:tax(together), short:together.short };
    const a = { deduction:dc.deduction + lump.deduction, income:dc.income + lump.income, tax:tax(dc) + tax(lump), short:dc.short || lump.short };
    return { together:t, apart:a, difference:t.tax - a.tax, dcFirstGap:p.retirement.dcLumpPriorYears + 1, lumpFirstGap:p.dcAfterLumpYears + 1 };
  }
  function C_tax(income, p) { return incomeTax(income, p).total + Math.floor(income * p.resident.rate); }
  return {lifeSpan, medicalChoice, lumpSumPlan, furusatoProgress, historySummary, compareHistory, requiredMonthly, pensionByAge, protectionGap, cashflow, retirementPriority, coefficients, accumulate, retirementDeduction, retirementIncome, salaryIncome,incomeTax,normalize,idecoLimit,taxScenario,donationLimit,priorities,recommend,LABELS,calculate,calendar,makeICS,googleCalendarURL};
});
