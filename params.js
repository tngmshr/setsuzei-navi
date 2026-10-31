/* 制度値は2026年所得／2027年度住民税用。未確認値は null。仮定は制度値と分離する。 */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.SetsuzeiParams = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const sources = {
    salary: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm',
    salaryTable: 'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/114.pdf',
    basic: 'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/115.pdf',
    tax: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
    spouse: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm',
    dependent: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm',
    incomeAdjustment: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm',
    resident: 'https://www.cao.go.jp/zei-cho/content/8life4kai2.pdf',
    donation: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1155.htm',
    soumuDonation: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html',
    insurance: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm',
    ideco: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/kyoshutsu/ideco.html',
    idecoReform: 'https://www.mhlw.go.jp/content/12500000/001726959.pdf',
    idecoAge: 'https://www.mhlw.go.jp/web_magazine/column/20261020.html',
    idecoUnit: 'https://www.ideco-koushiki.jp/start/',
    nisa: 'https://www.fsa.go.jp/common/ronten/202401/02.pdf',
    nisaAbout: 'https://www.fsa.go.jp/policy/nisa2/about/nisa2024/index.html',
    capitalGains: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm',
    idecoOfficial: 'https://www.ideco-koushiki.jp/',
    dcLimit: 'https://www.mhlw.go.jp/content/12500000/001739467.pdf',
    dcReform: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/2025kaisei.html',
    dcSelect: 'https://www.mhlw.go.jp/content/000677933.pdf',
    retirement: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm',
    dcLumpAdjust: 'https://www.nta.go.jp/publication/pamph/shotoku/0025005-010.pdf',
    idecoReceive: 'https://www.ideco-koushiki.jp/guide/structure.html',
    idecoRetire: 'https://www.ideco-koushiki.jp/retirement/',
    kurisage: 'https://www.nenkin.go.jp/service/jukyu/seido/roureinenkin/kuriage-kurisage/20140421-02.html',
    kuriage: 'https://www.nenkin.go.jp/service/jukyu/seido/roureinenkin/kuriage-kurisage/20140421-01.html',
    teikibin: 'https://www.nenkin.go.jp/section/faq/nteikibin/teikibin/gaiyou/20140602-01.html',
    // 以下は公的保障・学び先の案内（確認2026-10-31）。金額はアプリに入れず、リンクだけ示す。
    kougaku: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/juuyou/kougakuiryou/index.html',
    shobyo: 'https://www.kyoukaikenpo.or.jp/faq/benefit/002/index.html',
    izoku: 'https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/20150401-03.html',
    shogai: 'https://www.nenkin.go.jp/service/jukyu/seido/shougainenkin/jukyu-yoken/20150514.html',
    tsumitateSim: 'https://www.fsa.go.jp/policy/nisa2/moneyplan_sim/index.html',
    jflec: 'https://www.j-flec.go.jp/'
  };
  return {
    year: 2026, checked: '2026-10-31', sources,
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm 確認2026-10-31。74万円は令和8・9年分。
    salary: { minimum: 740000, lowZeroEnd: 741000, lowTableStart: 2191000,
      lowTable: [[2193000,1451000],[2196000,1453000],[2200000,1456000]],
      brackets: [[2200000,0,740000],[3600000,0.3,80000],[6600000,0.2,440000],[8500000,0.1,1100000],[Infinity,0,1950000]],
      // 出典 https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/114.pdf 確認2026-10-31。660万円未満は4千円刻みの表。
      roundingUnit: 4000 },
    // 出典 https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/115.pdf p56 確認2026-10-31。本則62万円＋加算42/5万円。
    basic: { main:620000, bands:[[4890000,1040000],[6550000,670000],[23500000,620000],[24000000,480000],[24500000,320000],[25000000,160000],[Infinity,0]] },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm 確認2026-10-31。課税所得千円未満切捨て。
    tax: { unit:1000, surtax:0.021, brackets:[[1950000,0.05,0],[3300000,0.10,97500],[6950000,0.20,427500],[9000000,0.23,636000],[18000000,0.33,1536000],[40000000,0.40,2796000],[Infinity,0.45,4796000]] },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm 確認2026-10-31。一般配偶者・本人合計所得による。
    spouseIncome: [[9000000,380000],[9500000,260000],[10000000,130000],[Infinity,0]],
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm 確認2026-10-31。16歳未満は扶養控除なし。親族所得62万円以下を仮定。
    dependentIncome: { under16:0, teen:380000, student:630000, incomeLimit:620000 },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm 確認2026-10-31。23歳未満の扶養親族あり、給与850万円超。
    incomeAdjustment: { start:8500000, ceiling:10000000, rate:0.1 },
    // 出典 https://www.cao.go.jp/zei-cho/content/8life4kai2.pdf 総務省2026-10-06資料p3・6・8 確認2026-10-31。
    resident: { basic:430000, rate:0.10, dependent:{under16:0,teen:330000,student:450000},
      // 出典 地方税法の定める額を自治体の解説で照合 確認2026-10-31:
      // https://www.city.kobe.lg.jp/a83576/kurashi/tax/shikenminze/syotoku/cyouseikoujyo.html
      // https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/zeigakukojo/choseikojo.html
      // https://www.nishi.or.jp/kurashi/shizei/kojinshiminzei/kisotishiki/juminshotoku-sa.html （令和8年度以降の人的控除差）
      spouse:[[9000000,330000],[9500000,220000],[10000000,110000],[Infinity,0]],
      adjustment: { threshold:2000000, rate:0.05, minimumBase:50000, basicDifference:50000,
        spouse:[[9000000,50000],[9500000,40000],[10000000,20000],[Infinity,0]], teenDifference:50000, studentDifference:180000 },
      // 住宅ローン控除の住民税からの控除上限（所得税の課税総所得金額等×率、上限額）。併用時の寄付上限は画面で「確認中」のまま扱う。
      mortgage: { standard:{ rate:0.05, cap:97500 }, legacy:{ rate:0.07, cap:136500 } } },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1155.htm 確認2026-10-31。総務省ページは本文取得不可、同式を国税庁で確認。
    // ワンストップ特例は寄付先5団体以内（同ページ本文で確認 2026-10-31）。
    donation: { ownCost:2000, specialCap:0.20, incomeLimit:0.40, oneStopMax:5 },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm 確認2026-10-31。新一般生命保険料のみ。全区分合計上限は据置。
    insurance: { newGeneral:40000, newGeneralUnder23:60000, total:120000 },
    // 出典 https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/kyoshutsu/ideco.html 確認2026-10-31。現行会社員第2号。
    idecoBefore: { none:23000, company:20000, combined:55000, ageExclusive:65 },
    // 出典 https://www.mhlw.go.jp/content/12500000/001726959.pdf 確認2026-10-31。2026-12拠出分（2027-01引落）から。
    idecoAfter: { combined:62000, ageExclusive:70, effective:'2026-12', firstDebit:'2027-01' },
    // 出典 https://www.ideco-koushiki.jp/start/ 確認2026-10-31。月額最低5千円、千円単位。
    idecoContribution: { minimum:5000, unit:1000 },
    // 出典 https://www.mhlw.go.jp/web_magazine/column/20261020.html 確認2026-10-31。60歳以上は加入歴等の条件あり、受給中・マッチング拠出は不可。
    idecoEligibility: { conditionalAge:60, firstWithdrawalAge:60 },
    // 出典 https://www.fsa.go.jp/common/ronten/202401/02.pdf p2 確認2026-10-31。成人向け年間合計、生涯取得価額。
    // 枠の内訳・年齢は https://www.fsa.go.jp/policy/nisa2/about/nisa2024/index.html 確認2026-10-31。
    nisa: { annual:3600000, lifetime:18000000, tsumitate:1200000, growth:2400000, growthLifetime:12000000, minAge:18 },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm 確認2026-10-31。上場株式等の譲渡益（所得税15%＋住民税5%、別に復興特別所得税）。
    capitalGains: { incomeTax:0.15, resident:0.05 },
    // 出典 https://www.mhlw.go.jp/content/12500000/001739467.pdf 確認2026-10-31。企業型DCの月額上限（DB等の他制度掛金相当額を差し引く）。
    // マッチング拠出＝上限−事業主の拠出額。事業主掛金を超えられない制限は2026-04に撤廃（2025kaisei.html 確認2026-10-31）。
    dc: { before:55000, after:62000, effective:'2026-12', matchingRuleRemoved:'2026-04' },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm 確認2026-10-31。退職所得控除と1/2課税。
    // 前年以前9年内の老齢一時金との重複排除は令和8年1月以後の老齢一時金から（0025005-010.pdf 確認2026-10-31）。
    retirement: { perYear:400000, minimum:800000, longYears:20, longBase:8000000, perYearLong:700000,
      disability:1000000, half:0.5, shortYears:5, shortCap:3000000, noFormRate:0.2042, dcLumpPriorYears:9 },
    // 出典 https://www.ideco-koushiki.jp/guide/structure.html 確認2026-10-31。通算加入者等期間［年以上, 受け取り開始できる年齢］。
    dcReceive: { start:60, end:75, ages:[[10,60],[8,61],[6,62],[4,63],[2,64],[0,65]], annuityMin:5, annuityMax:20, lateJoinYears:5 },
    // 出典 https://www.ideco-koushiki.jp/retirement/ 確認2026-10-31。資格喪失から6か月以内に移換か脱退一時金の手続き。
    dcTransfer: { months:6 },
    // 出典 kurisage・kuriage（日本年金機構）確認2026-10-31。繰上げは昭和37年4月2日以降生まれの率。
    pension: { base:65, defer:{ rate:0.007, maxAge:75, max:0.84 }, early:{ rate:0.004, minAge:60, max:0.24 } },
    // 出典 https://www.nenkin.go.jp/section/faq/nteikibin/teikibin/gaiyou/20140602-01.html 確認2026-10-31。全期間の記録が届く年齢。
    teikibin: { sealedAges:[35,45,59] },
    // 以下はこのアプリの判定の目安（制度値ではない）。生活防衛資金の月数、60歳までの年数の注意ライン。
    rules: { reserveMonths:3, shortYears:5 },
    // 以下は制度値ではなく、このアプリの説明用仮定。社会保険料15%は実額ではない。
    assumptions: { salary:5000000, age:35, spouse:'none', under16:0, teen:0, student:0,
      pension:'none', socialRate:0.15, mortgage:'no', reserve:3, budget:30000, idecoMonthly:10000,
      matching:'no', benefits:'no', history:'unknown', insurance:'no', medical:'no', dcMatching:'unknown', dcSelect:'unknown' }
  };
});

