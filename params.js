/* 制度値は2026年所得／2027年度住民税用。未確認値は null。仮定は制度値と分離する。 */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.SetsuzeiParams = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const sources = {
    lifeTable: 'https://www.mhlw.go.jp/toukei/saikin/hw/life/life25/index.html',
    medical: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',
    selfMed: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm',
    dcOrder: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2735.htm',
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
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm 確認2026-10-31。10万円か総所得金額等の5%の低い方を引き、最高200万円。
    medical: { floor:100000, rate:0.05, cap:2000000 },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm 確認2026-10-31。12,000円を超える部分、最高88,000円。医療費控除と選択。
    selfMed: { floor:12000, cap:88000 },
    // 出典 https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2735.htm 確認2026-10-31。退職金を先に受け取ると、前年以前19年内のDC一時金で調整。
    dcAfterLumpYears: 19,
    // 出典 https://www.mhlw.go.jp/toukei/saikin/hw/life/life25/xls/life25-12.xlsx（令和7年簡易生命表）確認2026-10-31。e＝平均余命（年）、l＝生存数（10万人あたり）。0〜100歳。
    life: { year:2025, male:{ e:[81.35,80.51,79.53,78.55,77.56,76.57,75.58,74.58,73.59,72.59,71.6,70.6,69.61,68.61,67.62,66.63,65.64,64.66,63.67,62.69,61.72,60.74,59.77,58.8,57.82,56.85,55.88,54.9,53.93,52.96,51.98,51.01,50.04,49.06,48.09,47.12,46.16,45.19,44.22,43.26,42.29,41.33,40.38,39.42,38.47,37.52,36.57,35.63,34.69,33.75,32.82,31.9,30.98,30.06,29.16,28.26,27.36,26.47,25.59,24.72,23.86,23.01,22.16,21.32,20.5,19.68,18.88,18.09,17.31,16.54,15.78,15.04,14.31,13.6,12.91,12.24,11.58,10.94,10.31,9.69,9.1,8.53,7.98,7.45,6.94,6.44,5.97,5.53,5.11,4.73,4.38,4.06,3.74,3.45,3.16,2.9,2.65,2.42,2.2,2,1.81], l:[100000,99800,99770,99748,99733,99721,99712,99704,99697,99691,99686,99680,99673,99664,99652,99637,99618,99597,99571,99540,99504,99463,99419,99372,99325,99278,99231,99185,99138,99089,99038,98987,98934,98878,98818,98754,98687,98617,98543,98463,98377,98284,98184,98075,97957,97829,97690,97538,97372,97188,96984,96757,96506,96232,95932,95603,95241,94843,94403,93918,93387,92811,92183,91495,90733,89892,88971,87973,86896,85729,84453,83051,81511,79824,77986,75991,73836,71531,69079,66461,63651,60631,57407,54005,50468,46795,42972,39003,34918,30790,26705,22749,19076,15686,12616,9897,7546,5572,3968,2712,1770] },
      female:{ e:[87.33,86.48,85.51,84.52,83.53,82.54,81.54,80.55,79.55,78.56,77.56,76.57,75.57,74.58,73.59,72.6,71.61,70.62,69.64,68.66,67.67,66.69,65.71,64.73,63.75,62.77,61.78,60.8,59.82,58.83,57.85,56.87,55.88,54.9,53.92,52.94,51.96,50.98,50,49.03,48.05,47.08,46.11,45.14,44.17,43.2,42.24,41.28,40.32,39.36,38.41,37.46,36.51,35.57,34.64,33.7,32.77,31.84,30.91,29.99,29.07,28.15,27.24,26.33,25.42,24.52,23.63,22.74,21.85,20.97,20.1,19.24,18.39,17.54,16.7,15.88,15.07,14.27,13.48,12.71,11.95,11.21,10.49,9.8,9.12,8.47,7.85,7.26,6.69,6.16,5.66,5.18,4.75,4.34,3.95,3.58,3.23,2.9,2.59,2.31,2.05], l:[100000,99827,99800,99782,99771,99763,99757,99750,99744,99738,99731,99725,99718,99710,99699,99685,99668,99649,99626,99601,99574,99544,99514,99486,99459,99432,99404,99376,99349,99323,99297,99269,99240,99209,99175,99138,99099,99056,99011,98964,98913,98858,98799,98735,98665,98588,98504,98413,98314,98207,98088,97957,97811,97651,97479,97293,97095,96884,96658,96416,96157,95880,95581,95260,94912,94533,94119,93673,93190,92664,92083,91440,90733,89956,89100,88149,87087,85906,84596,83140,81514,79692,77646,75351,72795,69950,66786,63284,59444,55282,50819,46087,41153,36124,31136,26352,21769,17482,13575,10130,7212] } },
    // 以下はこのアプリの判定の目安（制度値ではない）。生活防衛資金の月数、60歳までの年数の注意ライン、
    // 計算の対象にする年収の上限（SPEC.md の「対象外：年収2,000万円超」。このアプリの対象範囲で、税制の値ではない）。
    rules: { reserveMonths:3, shortYears:5, maxSalary:20000000 },
    // 以下は制度値ではなく、このアプリの説明用仮定。社会保険料15%は実額ではない。
    assumptions: { salary:5000000, age:35, spouse:'none', under16:0, teen:0, student:0,
      pension:'none', socialRate:0.15, mortgage:'no', reserve:3, budget:30000, idecoMonthly:10000,
      matching:'no', benefits:'no', history:'unknown', insurance:'no', medical:'no', dcMatching:'unknown', dcSelect:'unknown' }
  };
});

