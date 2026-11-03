'use strict';
// 境界値・未入力・数値でない入力のテスト。画面に NaN・Infinity・負の金額・例外が出る経路がないことを確かめる。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const C=require('../calc.js'), P=require('../params.js');

// 結果の中の数値がすべて有限で0以上か（差を表す difference・増減率 change は負もありうる）。
function badNumbers(value, where='r', out=[]){
  if(typeof value==='number'){ if(!Number.isFinite(value)||(value<0&&!/difference|change/.test(where)))out.push(where+'='+value); }
  else if(typeof value==='string'){ if(/NaN|undefined|Infinity/.test(value))out.push(where+'='+value); }
  else if(value&&typeof value==='object')for(const k of Object.keys(value))badNumbers(value[k],where+'.'+k,out);
  return out;
}

test('年収0円：計算でき、税金・節税額・寄付上限は0円',()=>{
  const r=C.calculate({salary:0});
  assert.equal(r.valid,true);
  assert.equal(r.base.income,0); assert.equal(r.base.incomeTax.total,0); assert.equal(r.base.resident,0);
  assert.equal(r.simpleSaving,0); assert.equal(r.donation.baseline,0);
  assert.equal(r.recommendations.find(x=>x.id==='furusato').label,'na');
  assert.deepEqual(badNumbers(r),[]);
});
test('給与所得控除の境目（74万1千円未満は所得0円、219万1千円・220万円・660万円）',()=>{
  assert.equal(C.salaryIncome(740999),0); assert.equal(C.salaryIncome(741000),1000);
  assert.equal(C.salaryIncome(2190999),2190999-740000);
  for(const s of [2191000,2199999,2200000,6599999,6600000,8500000,8500001,20000000])assert.ok(Number.isFinite(C.salaryIncome(s))&&C.salaryIncome(s)>0,String(s));
});
test('年収の上限：アプリの対象（params の rules.maxSalary）まで計算し、超えると対象外、範囲外は入力エラー',()=>{
  assert.equal(P.rules.maxSalary,20000000);
  const top=C.calculate({salary:P.rules.maxSalary});
  assert.equal(top.valid,true); assert.deepEqual(badNumbers(top),[]);
  assert.equal(top.base.incomeTax.rate,0.33);
  const over=C.calculate({salary:P.rules.maxSalary+1});
  assert.equal(over.valid,false); assert.equal(over.unsupported,true);
  assert.equal(C.calculate({salary:100000000}).unsupported,true);
  assert.deepEqual(C.calculate({salary:100000001}).errors,['salary']);
  assert.deepEqual(C.calculate({salary:-1}).errors,['salary']);
});
test('年齢の端：18〜100歳の整数だけ受け付ける',()=>{
  for(const age of [17,101,35.5,-1])assert.deepEqual(C.calculate({age}).errors,['age'],String(age));
  for(const age of [18,100]){const r=C.calculate({age});assert.equal(r.valid,true);assert.deepEqual(badNumbers(r),[]);}
  assert.equal(C.calculate({age:100}).yearsTo60,0);
  assert.equal(C.calculate({age:18}).yearsTo60,P.idecoEligibility.firstWithdrawalAge-18);
});
test('年齢の境目とiDeCo：改正前は65歳、改正後は70歳から対象外',()=>{
  const at=age=>C.calculate({age,history:'yes'});
  assert.ok(at(64).before.amount>0);
  assert.equal(at(65).before.status,'対象外'); assert.ok(at(65).after.amount>0);
  assert.ok(at(69).after.amount>0);
  assert.equal(at(70).after.status,'対象外');
  assert.equal(at(70).recommendations.find(x=>x.id==='ideco').label,'na');
  // 60歳以上で要件が未確認なら、上限は確定させない。
  assert.equal(C.calculate({age:60}).before.amount,null);
});
test('すべて未入力：仮定値で計算し、仮定として記録する',()=>{
  for(const raw of [undefined,{},{salary:'',age:'   '}]){
    const r=C.calculate(raw);
    assert.equal(r.valid,true); assert.equal(r.input.salary,P.assumptions.salary); assert.equal(r.input.age,P.assumptions.age);
    assert.ok(r.assumed.includes('salary')&&r.assumed.includes('age'));
    assert.deepEqual(badNumbers(r),[]);
  }
});
test('想定外の入力全体（null・文字列・配列）でも例外を出さず、仮定値で計算する',()=>{
  for(const raw of [null,'abc',42,[],[1,2]]){
    const r=C.calculate(raw);
    assert.equal(r.valid,true,JSON.stringify(raw)); assert.equal(r.input.salary,P.assumptions.salary);
  }
});
test('数値でない入力は0や1として扱わず、入力エラーにする',()=>{
  for(const v of ['abc','NaN','Infinity','-Infinity','0x10','1,000','５００',true,false,[],[5],{}]){
    assert.deepEqual(C.calculate({salary:v}).errors,['salary'],JSON.stringify(v));
  }
  // 前後の空白と指数表記は数値として読む（入力欄の値として来うるため）。
  assert.equal(C.calculate({salary:' 5000000 '}).input.salary,5000000);
  assert.equal(C.calculate({budget:'3e4'}).input.budget,30000);
});
test('年収が不正なとき、社会保険料まで巻き込んでエラーにしない',()=>{
  assert.deepEqual(C.calculate({salary:'abc',social:600000}).errors,['salary']);
  assert.deepEqual(C.calculate({salary:3000000,social:3000001}).errors,['social']);
  assert.equal(C.calculate({salary:3000000,social:3000000}).valid,true);
});
test('選択肢にない値はエラー（大文字・数値・前後の空白も不可）',()=>{
  for(const v of ['NONE',' none',1,true])assert.deepEqual(C.calculate({spouse:v}).errors,['spouse'],JSON.stringify(v));
  assert.deepEqual(C.calculate({period:'later'}).errors,['period']);
});
test('生活防衛資金の判定は params の rules.reserveMonths に従う',()=>{
  const months=P.rules.reserveMonths;
  assert.equal(C.calculate({reserve:months-0.1}).monthly,0);
  assert.equal(C.calculate({reserve:months}).monthly>0,true);
  // 月数を変えた params でも、判定と文言が同じ値を使う。
  const Q={...P,rules:{...P.rules,reserveMonths:6}};
  const r=C.calculate({reserve:4},Q);
  assert.equal(r.monthly,0); assert.equal(r.nisaMonthly,0);
  assert.equal(r.recommendations[0].id,'reserve'); assert.equal(r.recommendations[0].label,'now');
  assert.match(r.priorities[0].reason,/6か月分未満/);
});
test('条件の組み合わせを総当たりしても、NaN・Infinity・負の金額・例外が出ない',()=>{
  const salaries=['',0,741000,1500000,2200000,6600000,8500001,12000000,20000000];
  const ages=['',18,59,60,64,65,69,70,100];
  let count=0;
  for(const salary of salaries)for(const age of ages)for(const pension of ['none','db','dc','both','unknown'])
    for(const reserve of [0,2.9,3,120])for(const spouse of ['none','dependent','dual'])for(const kids of [0,20]){
      const raw={salary,age,pension,reserve,spouse,under16:kids,teen:kids,student:kids,dc:'',db:'',budget:0,idecoMonthly:200000,history:'unknown',matching:'unknown',benefits:'unknown'};
      const r=C.calculate(raw); count++;
      if(!r.valid)continue;
      const where=JSON.stringify(raw);
      assert.deepEqual(badNumbers(r),[],where);
      assert.deepEqual(badNumbers(C.retirementPriority(r.input,r.base.incomeTax.rate,{lockable:1000000,idecoFee:10000,matchingCap:100000,needBefore60:true})),[],where);
    }
  assert.ok(count>9000);
});
test('計算ツールの関数：0・最大値・空の入力で NaN を返さない',()=>{
  assert.deepEqual(badNumbers(C.retirementIncome(0,1)),[]);
  assert.deepEqual(badNumbers(C.retirementIncome(1e9,60,true)),[]);
  assert.equal(C.retirementDeduction(0.1),P.retirement.minimum);
  assert.deepEqual(badNumbers(C.accumulate(0,0,1)),[]);
  assert.deepEqual(badNumbers(C.accumulate(1000000,0.1,50)),[]);
  assert.deepEqual(badNumbers(C.coefficients(0.1,50)),[]);
  assert.equal(C.requiredMonthly(1000000,0.05,0),null);
  assert.deepEqual(badNumbers(C.pensionByAge(0)),[]);
  assert.deepEqual(badNumbers(C.protectionGap({living:0,years:0,education:0,other:0,survivor:0,savings:0,cover:0})),[]);
  assert.deepEqual(badNumbers(C.medicalChoice(0,0,0,0)),[]);
  assert.deepEqual(badNumbers(C.lumpSumPlan({dc:0,dcYears:1,lump:0,workYears:1})),[]);
  assert.equal(C.lifeSpan('male',NaN),null); assert.equal(C.lifeSpan('female',101),null);
  assert.equal(C.historySummary({valid:false}),null);
  assert.equal(C.historySummary(C.calculate({}),'壊れた値').savings,null);
  assert.equal(C.historySummary(C.calculate({}),{cfSavings:'1e400'}).savings,null);
  assert.deepEqual(C.compareHistory('壊れた値',[1,2]).map(r=>r.difference),[null,null,null,null,null]);
});

// 画面の HTML と params.js・sw.js の食い違い
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
test('画面の data-p はすべて params.js の値を指している（「—」にならない）',()=>{
  const get=p=>p.split('.').reduce((o,k)=>o==null?o:o[k],P);
  const paths=[...html.matchAll(/data-p="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(paths.length>40);
  for(const p of paths)assert.notEqual(get(p),undefined,p),assert.notEqual(get(p),null,p);
  const srcs=[...html.matchAll(/data-src="([^"]+)"/g)].map(m=>m[1]);
  for(const s of srcs)assert.ok(P.sources[s],s);
});
test('index.html が読み込む同じサイト内のファイルは sw.js の ASSETS に入っている',()=>{
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
  const assets=JSON.parse(sw.match(/const ASSETS = (\[[^\]]*\])/)[1].replace(/'/g,'"'));
  const local=[...html.matchAll(/(?<![\w-])(?:src|href)="([^"#:]+)"/g)].map(m=>m[1]).filter(u=>!u.startsWith('../')&&!u.startsWith('//'));
  for(const u of new Set(local))assert.ok(assets.includes(u),u);
  for(const a of assets)if(a!=='./')assert.ok(fs.existsSync(path.join(__dirname,'..',a)),a);
});
test('所得税0円で住民税だけかかる人：寄付上限を0円とも金額とも出さず、理由を返す',()=>{
  // 年収150万円・独身：所得税の課税所得0円、住民税の課税所得はある（基礎控除の額が違うため）。
  const r=C.calculate({salary:1500000});
  assert.equal(r.base.incomeTax.rate,0); assert.ok(r.base.resident>0);
  assert.equal(r.donation.baseline,null); assert.equal(r.donation.reason,'residentOnly');
  // iDeCo（仮定の月1万円）を差し引くと住民税もかからなくなるので、iDeCo後は0円（控除の効果なし）。
  assert.equal(r.withIdeco.resident,0); assert.equal(r.donation.withIdeco,0);
  assert.equal(C.calculate({salary:1500000,idecoMonthly:0}).donation.withIdeco,null);
  const f=r.recommendations.find(x=>x.id==='furusato');
  assert.equal(f.label,'ready'); assert.match(f.reason,/住民税だけ/);
  // 住民税もかからなければ、これまでどおり0円（控除の効果なし）。
  const z=C.calculate({salary:0});
  assert.equal(z.donation.baseline,0); assert.equal(z.donation.reason,null);
  assert.equal(C.donationLimit({resident:8000,income:760000,incomeTax:{rate:0}}),null);
  // 所得税がかかる人は従来どおり金額を出す。
  assert.equal(C.calculate({salary:5000000}).donation.reason,null);
});
