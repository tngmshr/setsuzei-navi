'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../calc.js'), P=require('../params.js');
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
