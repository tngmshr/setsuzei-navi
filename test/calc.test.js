'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../calc.js'), P=require('../params.js');
test('平均余命と4人に1人が生きている年齢',()=>{
  const m=C.lifeSpan('male',65), f=C.lifeSpan('female',65);
  assert.equal(m.e,19.68); assert.equal(f.e,24.52);
  assert.ok(m.quarter>m.average && m.quarter<=100); assert.ok(f.quarter>m.quarter);
  const t=P.life.male.l; assert.ok(t[m.quarter]<=t[65]/4 && t[m.quarter-1]>t[65]/4);
  assert.equal(C.lifeSpan('none',65),null);
});
test('医療費控除とセルフメディケーションの比較',()=>{
  // 総所得金額等300万円：医療費15万円→控除5万円。市販薬3万円→控除1.8万円。所得税10%。
  const r=C.medicalChoice(150000,30000,3000000,0.10);
  assert.equal(r.normal.deduction,50000); assert.equal(r.self.deduction,18000);
  assert.equal(r.normal.saving,Math.floor(50000*0.1*1.021)+5000); assert.equal(r.better,'normal');
  // 総所得金額等150万円：足切りは5%の7.5万円。
  assert.equal(C.medicalChoice(80000,0,1500000,0.05).normal.deduction,5000);
  // 医療費が少なく市販薬が多いとセルフメディケーション。上限は8.8万円と200万円。
  assert.equal(C.medicalChoice(90000,60000,3000000,0.1).better,'self');
  assert.equal(C.medicalChoice(0,200000,3000000,0.1).self.deduction,88000);
  assert.equal(C.medicalChoice(5000000,0,3000000,0.1).normal.deduction,2000000);
  assert.equal(C.medicalChoice(0,0,3000000,0.1).better,'none');
});
test('一時金と退職金：同じ年と間隔を空けた場合',()=>{
  // DC 500万円（加入20年）、退職金 1,500万円（勤続30年）。
  const r=C.lumpSumPlan({dc:5000000,dcYears:20,lump:15000000,workYears:30});
  assert.equal(r.together.deduction,15000000); assert.equal(r.together.income,2500000);
  assert.equal(r.apart.deduction,8000000+15000000); assert.equal(r.apart.income,0);
  assert.equal(r.apart.tax,0); assert.ok(r.difference>0);
  assert.equal(r.dcFirstGap,10); assert.equal(r.lumpFirstGap,20);
});
/* 期待値の手計算（2026-10-31確認）
 * 給与所得の表 https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/114.pdf
 * 基礎・扶養・税率 https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/115.pdf
 * 所得金額調整控除 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm
 * 住民税 https://www.cao.go.jp/zei-cho/content/8life4kai2.pdf
 * iDeCo https://www.mhlw.go.jp/content/12500000/001726959.pdf
 * 扶養あり＝配偶者＋17歳の子1人。社保は年収15%の仮定。
 * 課税所得＝給与所得−社保−基礎−配偶者38万−子38万。
 * 1000万円・扶養ありは(1000万−850万)×10%=15万円を給与所得から控除。
 */
const cases=[
 // 年収、給与所得[扶養なし,あり]、基礎、課税所得、税率、所得税本税、住民税課税所得
 [3000000,[2020000,2020000],1040000,[530000,0],[.05,0],[26500,0],[1140000,480000]],
 [5000000,[3560000,3560000],1040000,[1770000,1010000],[.05,.05],[88500,50500],[2380000,1720000]],
 [8000000,[6100000,6100000],670000,[4230000,3470000],[.2,.2],[418500,266500],[4470000,3810000]],
 [10000000,[8050000,7900000],620000,[5930000,5020000],[.2,.2],[758500,576500],[6120000,5310000]]
];
for(const [salary,incomes,basic,taxables,rates,taxes,residents] of cases)
 for(const dependent of [false,true])for(const company of [false,true]){
  test('年収'+salary/10000+'万円・扶養'+(dependent?'あり':'なし')+'・企業年金'+(company?'あり':'なし'),()=>{
   const k=Number(dependent),r=C.calculate({salary,spouse:dependent?'dependent':'none',teen:k,pension:company?'both':'none',dc:10000,db:5000});
   assert.equal(r.valid,true);assert.equal(r.base.income,incomes[k]);assert.equal(r.base.basic,basic);
   assert.equal(r.base.incomeTax.taxable,taxables[k]);assert.equal(r.base.incomeTax.rate,rates[k]);
   assert.equal(r.base.incomeTax.base,taxes[k]);assert.equal(r.base.taxableResident,residents[k]);
   assert.equal(r.before.amount,company?20000:23000); // min(2万,5.5万−1万−0.5万)
   assert.equal(r.after.amount,company?47000:62000); // 6.2万−1万−0.5万
   assert.equal(r.simpleSaving,Math.round(120000*(rates[k]*1.021+.1)));
   if(P.resident.adjustment===null){assert.equal(r.base.resident,null);assert.equal(r.donation.baseline,null);}
   else{
    // 調整控除の人的差[単身5万,扶養15万]。200万円超は差−超過額、最低2500円。
    const diff=dependent?150000:50000,t=residents[k];
    const adj=t<=2000000?Math.min(diff,t)*.05:Math.max(50000,diff-(t-2000000))*.05;
    assert.equal(r.base.adjustmentResident,adj);assert.equal(r.base.resident,t*.1-adj);
    assert.equal(r.donation.baseline,rates[k]===0?0:Math.floor(2000+(t*.1-adj)*.2/(.9-rates[k]*1.021)));
    assert.ok(r.donation.withIdeco<=r.donation.baseline);
   }
  });
 }
test('給与所得の低額特例・4千円刻み・境界',()=>{
 for(const [s,v] of [[0,0],[740999,0],[741000,1000],[2190999,1450999],[2191000,1451000],[2193000,1453000],[2196000,1456000],[2199999,1456000],[2200000,1460000],[3003999,2020000],[3004000,2022800],[3600000,2440000],[6600000,4840000],[8500000,6550000],[8500001,6550001]])assert.equal(C.salaryIncome(s),v,String(s));
});
test('基礎控除の特例加算の境界',()=>{
 assert.equal(C.calculate({salary:6600000}).base.basic,1040000);
 assert.equal(C.calculate({salary:6655557}).base.basic,670000);
 assert.equal(C.calculate({salary:8500000}).base.basic,670000);
 assert.equal(C.calculate({salary:8500001}).base.basic,620000);
});
test('所得税の全税率境界・千円未満切捨て',()=>{
 // 国税庁No2260。課税所得×税率−速算控除額。
 for(const [x,rate,base]of[[-1,0,0],[999,0,0],[1949999,.05,97450],[1950000,.1,97500],[3300000,.2,232500],[6950000,.23,962500],[9000000,.33,1434000],[18000000,.4,4404000],[40000000,.45,13204000]]){
  assert.equal(C.incomeTax(x).rate,rate);assert.equal(C.incomeTax(x).base,base);
 }
});
test('子の年齢区分と高収入の所得金額調整控除',()=>{
 assert.equal(C.calculate({under16:1}).base.familyI,0);
 assert.equal(C.calculate({salary:10000000,under16:1}).base.incomeAdjustment,150000);
 assert.equal(C.calculate({salary:8500000,under16:1}).base.incomeAdjustment,0);
 const r=C.calculate({student:1});assert.equal(r.base.familyI,630000);assert.equal(r.base.familyR,450000);
});
test('配偶者控除は本人所得で逓減',()=>{
 assert.equal(C.calculate({salary:11000000,spouse:'dependent'}).base.familyI,260000);
 assert.equal(C.calculate({salary:11500000,spouse:'dependent'}).base.familyI,130000);
 assert.equal(C.calculate({salary:12000000,spouse:'dependent'}).base.familyI,0);
});
test('企業年金不明・掛金ゼロ・無関係な掛金を区別',()=>{
 for(const pension of ['db','dc','both','unknown'])assert.equal(C.calculate({pension}).after.amount,null);
 assert.equal(C.calculate({pension:'both',dc:0,db:0}).after.amount,62000);
 assert.equal(C.calculate({pension:'db',db:20000,dc:99999}).after.amount,42000);
 assert.equal(C.calculate({pension:'dc',dc:20000,db:99999}).after.amount,42000);
});
test('iDeCo最低額・千円単位・予算と上限',()=>{
 assert.equal(C.calculate({pension:'dc',dc:57501}).after.amount,0);
 assert.equal(C.calculate({pension:'dc',dc:57000}).after.amount,5000);
 assert.equal(C.calculate({pension:'dc',dc:56999}).after.amount,5000);
 assert.equal(C.calculate({idecoMonthly:1}).monthly,0);
 assert.equal(C.calculate({idecoMonthly:9999}).monthly,9000);
 assert.equal(C.calculate({idecoMonthly:62000,budget:30000,period:'after'}).monthly,30000);
 assert.equal(C.calculate({idecoMonthly:62000,budget:70000,period:'before'}).monthly,23000);
});
test('iDeCo年齢・加入歴・受給・マッチング拠出条件',()=>{
 assert.equal(C.calculate({age:59}).before.amount,23000);
 assert.equal(C.calculate({age:60}).before.amount,null);
 assert.equal(C.calculate({age:64,history:'yes'}).before.amount,23000);
 assert.equal(C.calculate({age:65,history:'yes'}).before.amount,0);
 assert.equal(C.calculate({age:69,history:'yes'}).after.amount,62000);
 assert.equal(C.calculate({age:70,history:'yes'}).after.amount,0);
 assert.equal(C.calculate({age:60,history:'no'}).after.amount,0);
 assert.equal(C.calculate({matching:'yes'}).after.amount,0);
 assert.equal(C.calculate({benefits:'yes'}).after.amount,0);
 assert.equal(C.calculate({matching:'unknown'}).after.amount,null);
});
test('生活防衛資金と該当控除の優先順',()=>{
 const r=C.calculate({reserve:2.9});assert.equal(r.monthly,0);assert.equal(r.nisaMonthly,0);assert.match(r.priorities[0].title,/最優先/);
 assert.equal(C.calculate({reserve:3}).monthly,10000);assert.equal(C.calculate({}).priorities.length,5);
 const full=C.calculate({insurance:'yes',medical:'yes',mortgage:'yes'});assert.equal(full.priorities.length,8);assert.equal(full.donation.withMortgage,null);
});
test('任意入力の仮定・明示ゼロ・不正入力・対象外',()=>{
 const r=C.calculate({});assert.equal(r.input.salary,5000000);assert.equal(r.input.social,750000);assert.ok(r.assumed.includes('social'));
 const zero=C.calculate({salary:0,budget:0,social:0});assert.equal(zero.base.incomeTax.total,0);assert.equal(zero.monthly,0);
 for(const raw of [{salary:-1},{salary:Infinity},{age:35.5},{teen:-1},{student:1.5},{social:6000000},{salary:'abc'},{pension:'<script>'},{period:'nonsense'}])assert.equal(C.calculate(raw).valid,false);
 assert.equal(C.calculate({salary:20000001}).unsupported,true);
});
test('未確認はnullを伝播、入力・制度値を変更しない',()=>{
 const p=structuredClone(P);p.resident.adjustment=null;
 const raw={salary:5000000},before=JSON.stringify(raw),paramsBefore=JSON.stringify(p),r=C.calculate(raw,p);
 assert.equal(r.donation.baseline,null);assert.equal(r.differenceSaving,null);
 assert.equal(JSON.stringify(raw),before);assert.equal(JSON.stringify(p),paramsBefore);
});
test('寄付上限の逆算式は国税庁No1155に一致',()=>{
 // 2000+200000×20%/(90%−20%×1.021)=59487円（小数切捨て）
 assert.equal(C.donationLimit({resident:200000,income:5000000,incomeTax:{rate:.2}}),59487);
 assert.equal(C.donationLimit({resident:0,income:0,incomeTax:{rate:0}}),0);
});
test('カレンダー6件・年またぎ・排他的終了日・個人値なし',()=>{
 const events=C.calendar(2026);assert.equal(events.length,6);assert.equal(events[2].end,'20270101');assert.equal(events[3].start,'20270110');assert.equal(events[4].end,'20270316');
 const ics=C.makeICS(events);assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,6);
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.match(ics.replace(/\r\n /g,''),/DTSTART;VALUE=DATE:20270110/);assert.ok(!ics.includes('5000000'));
 const q=new URL(C.googleCalendarURL(events[0]));assert.equal(q.searchParams.get('dates'),'20261101/20261102');
 assert.doesNotMatch(events.map(C.googleCalendarURL).join(''),/salary|budget|income/);
});
test('予定文字列のエスケープ',()=>{
 const ics=C.makeICS([{id:'sample',start:'20260101',end:'20260102',title:'見出し,;\\',description:'1行目\n2行目'}]);
 assert.match(ics,/SUMMARY:見出し\\,\\;\\\\/);assert.match(ics,/DESCRIPTION:1行目\\n2行目/);
});




test('所得税も住民税課税所得もゼロなら簡易節税額はゼロ',()=>{
 const r=C.calculate({salary:0,social:0});assert.equal(r.simpleSaving,0);
});

test('企業年金や掛金が分からなくても、最大の上限で仮に計算する',()=>{
 // 会社掛金0円とみなした上限: 改正前 DB/DC あり 20,000円・なし 23,000円、改正後 62,000円（厚生労働省）。
 const db=C.calculate({pension:'db',idecoMonthly:15000});
 assert.equal(db.before.amount,null);assert.equal(db.before.upper,20000);assert.equal(db.after.upper,62000);
 assert.equal(db.tentative,true);assert.equal(db.monthly,15000);
 const unknown=C.calculate({pension:'unknown',idecoMonthly:30000,budget:30000});
 assert.equal(unknown.before.upper,23000);assert.equal(unknown.monthly,23000);
 const known=C.calculate({pension:'none'});assert.equal(known.tentative,false);
});
// v0.2「あなたの順番」。判定は一般的な目安で、SPEC.md v0.2 の条件どおりかを確かめる。
const rec=(raw)=>Object.fromEntries(C.calculate(raw).recommendations.map(x=>[x.id,x]));
test('順番：並びは 生活防衛資金→年末調整→ふるさと納税→NISA→iDeCo',()=>{
  assert.deepEqual(C.calculate({}).recommendations.map(x=>x.id),['reserve','nencho','furusato','nisa','ideco']);
  const all=C.calculate({insurance:'yes',medical:'yes',mortgage:'yes'}).recommendations.map(x=>x.id);
  assert.deepEqual(all.slice(5),['insurance','medical','mortgage']);
  for(const x of C.calculate({}).recommendations){assert.equal(x.labelText,C.LABELS[x.label]);assert.ok(x.reason.length>10);}
});
test('順番：生活防衛資金が3か月分未満なら NISA・iDeCo は条件がそろったら',()=>{
  const r=rec({reserve:2});
  assert.equal(r.reserve.label,'now');assert.match(r.reserve.reason,/2か月分/);
  assert.equal(r.nisa.label,'ready');assert.equal(r.ideco.label,'ready');assert.equal(r.furusato.label,'ready');
  assert.equal(rec({reserve:3}).reserve.label,'ok');
});
test('順番：所得税率5%は iDeCo 急がなくてよい、20%は今すぐ',()=>{
  // 年収500万円単身・社保15%：所得356万−社保75万−基礎控除104万＝課税177万 → 5%（国税庁No2260）。
  const r=rec({salary:5000000});assert.equal(r.ideco.label,'later');assert.match(r.ideco.reason,/15\.1%/);
  // 年収800万円：所得610万−社保120万−基礎控除67万＝423万 → 20%。節税率 20%×1.021＋10%＝30.4%。
  const h=rec({salary:8000000});assert.equal(h.ideco.label,'now');assert.match(h.ideco.reason,/30\.4%/);
  assert.equal(h.nisa.label,'now');assert.equal(h.ideco.figures.length,2);
});
test('順番：iDeCo 対象外・60歳まで5年未満・上限が未確定',()=>{
  assert.equal(rec({matching:'yes'}).ideco.label,'na');assert.match(rec({matching:'yes'}).ideco.reason,/マッチング/);
  assert.equal(rec({benefits:'yes'}).ideco.label,'na');assert.equal(rec({age:70}).ideco.label,'na');
  assert.match(rec({age:57,salary:8000000}).ideco.reason,/あと3年/);assert.doesNotMatch(rec({age:50}).ideco.reason,/あと/);
  assert.match(rec({pension:'unknown',salary:8000000}).ideco.reason,/確定/);
  assert.match(rec({age:66}).ideco.reason,/2026年12月拠出分から/);
});
test('順番：予算0円・税金がかからない人・該当控除',()=>{
  const z=rec({budget:0});assert.equal(z.nisa.label,'ready');assert.equal(z.ideco.label,'ready');
  assert.equal(rec({salary:1000000}).furusato.label,'na');
  const f=rec({spouse:'dependent',insurance:'yes'});assert.match(f.nencho.reason,/扶養/);assert.match(f.nencho.reason,/生命保険料/);
  assert.equal(f.insurance.guide,'nencho');
});
// 退職所得控除（国税庁 No.1420 確認2026-10-31）
test('退職所得控除の目安',()=>{
  assert.equal(C.retirementDeduction(1),800000);
  assert.equal(C.retirementDeduction(10.2),4400000); // 端数切り上げ11年×40万
  assert.equal(C.retirementDeduction(20),8000000);
  assert.equal(C.retirementDeduction(30),15000000);
  assert.equal(C.retirementDeduction(30,true),16000000);
  const r=C.retirementIncome(20000000,30);assert.equal(r.income,2500000);assert.equal(r.short,false);
  assert.equal(C.retirementIncome(1000000,3).short,true);
});
test('順番：会社の年金の項目',()=>{
  assert.equal(rec({}).dc,undefined);
  const dc=rec({pension:'dc',dc:10000});assert.equal(dc.dc.label,'now');assert.equal(dc.dc.guide,'asset-dc');assert.match(dc.dc.reason,/62,000円|6\.2万円/);
  assert.equal(rec({pension:'both',dc:10000,db:5000,matching:'yes'}).dc.label,'ok');
  assert.match(rec({pension:'dc',dc:10000,dcMatching:'yes'}).dc.reason,/どちらか一方/);
  assert.equal(rec({pension:'db',db:5000}).db.label,'ready');
  assert.equal(rec({pension:'dc',dcSelect:'yes'}).dcselect.label,'ready');
  assert.equal(rec({pension:'dc',dcSelect:'no'}).dcselect,undefined);
});
test('6つの係数と積立の試算',()=>{
  const k=C.coefficients(0.03,10), near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,a+' vs '+b);
  near(k.shuka,1.343916);near(k.genka,0.744094);near(k.nenkinShuka,11.463879);near(k.gensai,0.087231);near(k.shihonKaishu,0.117231);near(k.nenkinGenka,8.530203);
  near(k.shihonKaishu-k.gensai,0.03);
  const z=C.coefficients(0,10);assert.equal(z.shuka,1);assert.equal(z.nenkinShuka,10);assert.equal(z.nenkinGenka,10);near(z.shihonKaishu,0.1);
  const a=C.accumulate(10000,0,20);assert.equal(a.length,21);assert.equal(a[20].principal,2400000);assert.equal(a[20].value,2400000);
  const b=C.accumulate(10000,0.03,1);assert.ok(b[1].value>120000 && b[1].value<122000);
});
test('逆算・年金の受け取り年齢・必要保障額・キャッシュフロー',()=>{
  assert.equal(C.requiredMonthly(2400000,0,20),10000);
  const a=C.accumulate(C.requiredMonthly(5000000,0.03,20),0.03,20);assert.ok(a[20].value>=5000000 && a[20].value<5001000);
  const p=C.pensionByAge(1000000);assert.equal(p[0].age,60);assert.equal(p[0].annual,760000);assert.equal(p.find(r=>r.age===65).annual,1000000);assert.equal(p.at(-1).annual,1840000);
  const g=C.protectionGap({living:200000,years:10,education:5000000,other:0,survivor:100000,savings:3000000,cover:0});assert.equal(g.need,29000000);assert.equal(g.gap,14000000);
  const cf=C.cashflow({age:64,income:3000000,expense:2000000,savings:0,incomeGrowth:0,expenseGrowth:0,rate:0,years:2,retireAge:65,pensionAge:65,pension:1500000,events:[{age:64,amount:500000,name:'車'}]});
  assert.deepEqual(cf.map(r=>[r.income,r.expense,r.balance]),[[3000000,2500000,500000],[1500000,2000000,0]]);
});
test('老後資金の器の優先順位',()=>{
  const n=raw=>C.normalize(raw).input;
  const dc=C.retirementPriority(n({salary:6000000,age:35,pension:'dc',dc:20000,dcMatching:'yes',reserve:6,budget:50000}),0.1,{lockable:20000});
  assert.equal(dc.matchMax,42000);assert.deepEqual(dc.items.map(i=>i.id),['dcAuto','choose','nisa']);assert.match(dc.items[1].title,/まずマッチング拠出/);assert.equal(dc.saving,Math.round(20000*12*(0.1*1.021+0.1)));
  const big=C.retirementPriority(n({salary:6000000,age:35,pension:'dc',dc:20000,dcMatching:'yes',reserve:6,budget:50000}),0.1,{lockable:30000,matchingCap:10000});
  assert.match(big.items[1].title,/まずiDeCo/);
  const low=C.retirementPriority(n({salary:3000000,age:52,pension:'none',reserve:6,budget:30000}),0.05,{lockable:10000});
  assert.equal(low.items[0].label,'later');assert.equal(low.startAge,61);
  const fee=C.retirementPriority(n({salary:3000000,age:35,pension:'none',reserve:6,budget:30000}),0.05,{lockable:5000,idecoFee:1000});
  assert.equal(fee.items[0].label,'later');
  const early=C.retirementPriority(n({salary:6000000,age:30,pension:'both',dc:30000,db:10000,reserve:1}),0.1,{needBefore60:true});
  assert.equal(early.idecoMax,22000);assert.deepEqual(early.items.map(i=>i.id),['dcAuto','db','reserve','nisa','ideco']);assert.equal(early.items[4].label,'ready');
  const using=C.retirementPriority(n({salary:6000000,age:40,pension:'dc',dc:10000,matching:'yes',reserve:6,budget:30000}),0.1,{});
  assert.equal(using.items[1].label,'ok');
});

test('今年の寄付だけを合計し、上限までの残りと超過を求める',()=>{
  const log=[{date:'2026-01-01',amount:10000},{date:'2026-12-31',amount:20000},{date:'2025-12-31',amount:90000}];
  const before=JSON.stringify(log);
  assert.deepEqual(C.furusatoProgress(log,2026,50000),{count:2,total:30000,limit:50000,remaining:20000,exceeded:false});
  assert.equal(C.furusatoProgress(log,2026,30000).remaining,0);
  assert.equal(C.furusatoProgress(log,2026,30000).exceeded,false);
  assert.equal(C.furusatoProgress(log,2026,20000).exceeded,true);
  assert.equal(C.furusatoProgress(log,2026,20000).remaining,0);
  assert.equal(JSON.stringify(log),before);
});
test('ふるさと納税ナビの保存形式（limit と items）をそのまま読める',()=>{
  const saved={limit:60000,items:[{id:'a',city:'A町',amount:20000,date:'2026-03-01',one:false},{id:'b',city:'B市',amount:15000,date:'2025-12-01',one:true}]};
  assert.deepEqual(C.furusatoProgress(saved,2026,50000),{count:1,total:20000,limit:50000,remaining:30000,exceeded:false});
  assert.equal(C.furusatoProgress({limit:1},2026,0).count,0);
});
test('寄付記録の欠損・壊れた日付や金額・未確認の上限を扱う',()=>{
  for(const value of [null,{},'',undefined])assert.equal(C.furusatoProgress(value,2026,0).count,0);
  const log=[null,{}, {date:'2026-02-30',amount:100},{date:'2026-13-01',amount:100},{date:'2026-1-01',amount:100},{date:'2026-01-01',amount:'100'},{date:'2026-01-01',amount:-1},{date:'2026-01-01',amount:0},{date:'2026-01-01',amount:NaN},{date:'2026-01-01',amount:1.5}];
  assert.equal(C.furusatoProgress(log,2026,50000).count,0);
  const valid=[{date:'2024-02-29',amount:1000}];
  assert.equal(C.furusatoProgress(valid,2024,null).remaining,null);
  assert.equal(C.furusatoProgress(valid,2024,0).exceeded,true);
  assert.equal(C.furusatoProgress(valid,2026,5000).total,0);
});
test('比較用の要約は既存の計算結果と貯蓄入力を使う',()=>{
  const r=C.calculate({salary:5000000,age:40,reserve:6,budget:30000,idecoMonthly:10000});
  const s=C.historySummary(r,{cfSavings:'300'},2026);
  assert.equal(s.year,2026);assert.equal(s.salary,5000000);assert.equal(s.idecoMonthly,r.monthly);
  assert.equal(s.saving,r.simpleSaving);assert.equal(s.donationLimit,r.donation.withIdeco);assert.equal(s.savings,3000000);
  for(const cfSavings of ['',null,undefined,'不正',-1])assert.equal(C.historySummary(r,{cfSavings}).savings,null);
  assert.equal(C.historySummary(r,{cfSavings:'0'}).savings,0);
  assert.equal(C.historySummary(C.calculate({salary:-1})),null);
});
test('前回との比較は増減・ゼロ・記録なしを区別して元データを変えない',()=>{
  const a={salary:5000000,idecoMonthly:10000,saving:30000,donationLimit:60000,savings:null};
  const b={salary:5200000,idecoMonthly:0,saving:30000,donationLimit:55000,savings:1000000};
  const old=JSON.stringify([a,b]), rows=C.compareHistory(a,b);
  assert.deepEqual(rows.map(r=>r.difference),[200000,-10000,0,-5000,null]);
  assert.ok(C.compareHistory(null,b).every(r=>r.previous===null&&r.difference===null));
  assert.ok(C.compareHistory(a,null).every(r=>r.current===null&&r.difference===null));
  assert.equal(C.compareHistory({salary:'5000000'},{salary:Infinity})[0].difference,null);
  assert.equal(JSON.stringify([a,b]),old);
});
