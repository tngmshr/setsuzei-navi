'use strict';
// ふるさと納税ナビとの連携（localStorage の読み書き）のテスト。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../link.js'), C=require('../calc.js');

// localStorage と同じ呼び方ができる最小の入れ物。値は文字列で持つ。
function memory(initial={}){
  const m=new Map(Object.entries(initial));
  return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v));},removeItem:k=>{m.delete(k);},map:m};
}
// 保存を拒否する環境（Safari のプライベートモード・容量超過など）。
const broken={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};

// ふるさと納税ナビ（index.html の addLog / saveLog）が実際に保存する形。
const furusatoSaved={limit:60000,items:[
  {id:'mh1a2b3c',city:'〇〇県△△町',amount:20000,date:'2026-03-01',one:false},
  {id:'mh1a2b3d',city:'□□市',amount:15000,date:'2026-11-02',one:true},
  {id:'mh1a2b3e',city:'××村',amount:30000,date:'2025-12-20',one:false}
]};

test('ふるさと納税ナビの保存形式 {limit, items} を読み、今年分を集計する',()=>{
  const s=memory({[L.KEYS.log]:JSON.stringify(furusatoSaved)});
  const log=L.readFurusatoLog(s);
  assert.equal(log.limit,60000);assert.equal(log.items.length,3);
  assert.deepEqual(C.furusatoProgress(log,2026,50000),{count:2,total:35000,limit:50000,remaining:15000,exceeded:false});
  assert.deepEqual(C.furusatoProgress(log,2025,null),{count:1,total:30000,limit:null,remaining:null,exceeded:false});
});
test('配列だけの古い形式も受け付ける',()=>{
  const s=memory({[L.KEYS.log]:JSON.stringify(furusatoSaved.items)});
  const log=L.readFurusatoLog(s);
  assert.equal(log.limit,null);assert.equal(log.items.length,3);
  assert.equal(C.furusatoProgress(log,2026,0).total,35000);
});
test('記録なし・空・壊れた JSON・想定外の形・保存領域なしでも落ちず、記録なしとして扱う',()=>{
  const cases=[memory(),memory({[L.KEYS.log]:''}),memory({[L.KEYS.log]:'{"limit":1,'}),memory({[L.KEYS.log]:'null'}),
    memory({[L.KEYS.log]:'"文字列"'}),memory({[L.KEYS.log]:'42'}),memory({[L.KEYS.log]:'{}'}),memory({[L.KEYS.log]:'{"items":"x"}'}),
    memory({[L.KEYS.log]:'{"items":null,"limit":"60000"}'}),broken,null,undefined];
  for(const s of cases){
    const log=L.readFurusatoLog(s);
    assert.deepEqual(log,{limit:null,items:[]});
    assert.deepEqual(C.furusatoProgress(log,2026,50000),{count:0,total:0,limit:50000,remaining:50000,exceeded:false});
  }
});
test('記録の中の壊れた行は集計しない',()=>{
  const s=memory({[L.KEYS.log]:JSON.stringify({limit:-1,items:[null,{},{date:'2026-02-30',amount:100},{date:'2026-01-01',amount:'1000'},{city:'A',amount:5000,date:'2026-05-05'}]})});
  const log=L.readFurusatoLog(s);
  assert.equal(log.limit,null);
  assert.deepEqual(C.furusatoProgress(log,2026,4000),{count:1,total:5000,limit:4000,remaining:0,exceeded:true});
});
test('localStorage の参照自体が例外になる環境では null を返す',()=>{
  assert.equal(L.storage({get localStorage(){throw Error('SecurityError');}}),null);
  assert.equal(L.storage(undefined),null);
  const s=memory();assert.equal(L.storage({localStorage:s}),s);
});

// ふるさと納税ナビ index.html の sharedLimit() と同じ受け入れ条件。
const accepted=(v,year)=>!!(v && v.year===year && Number.isSafeInteger(v.donationLimit) && v.donationLimit>=0);

test('上限の目安をふるさと納税ナビが受け取れる形で書く',()=>{
  const r=C.calculate({salary:5000000,age:40,reserve:6,budget:30000,idecoMonthly:10000});
  assert.ok(Number.isSafeInteger(r.donation.withIdeco)&&Number.isSafeInteger(r.donation.baseline));
  const s=memory(), now=new Date('2026-11-02T03:04:05.000Z');
  assert.equal(L.writeShare(s,r,2026,now),'saved');
  const v=JSON.parse(s.getItem(L.KEYS.share));
  assert.deepEqual(v,{year:2026,donationLimit:r.donation.withIdeco,donationLimitNoIdeco:r.donation.baseline,updatedAt:'2026-11-02T03:04:05.000Z'});
  assert.ok(accepted(v,2026));
  assert.ok(!accepted(v,2027));
});
test('上限の目安が出せないときは古い共有値を消す',()=>{
  const s=memory({[L.KEYS.share]:JSON.stringify({year:2026,donationLimit:99999})});
  assert.equal(L.writeShare(s,{valid:false},2026),'removed');
  assert.equal(s.getItem(L.KEYS.share),null);
  s.setItem(L.KEYS.share,'x');
  assert.equal(L.writeShare(s,{valid:true,donation:{withIdeco:null,baseline:null}},2026),'removed');
  assert.equal(s.getItem(L.KEYS.share),null);
  for(const bad of [null,undefined,{},{valid:true},{valid:true,donation:{withIdeco:-1,baseline:0}},{valid:true,donation:{withIdeco:1.5,baseline:2}},{valid:true,donation:{withIdeco:1,baseline:'2'}}])
    assert.equal(L.shareRecord(bad,2026),null);
  assert.equal(L.shareRecord({valid:true,donation:{withIdeco:1,baseline:2}},'2026'),null);
});
test('共有の書き込み・削除は保存できない環境でも例外を出さない',()=>{
  const r={valid:true,donation:{withIdeco:50000,baseline:60000}};
  for(const s of [broken,null,undefined]){
    assert.equal(L.writeShare(s,r,2026,new Date(0)),'failed');
    assert.equal(L.writeShare(s,{valid:false},2026),'failed');
    assert.equal(L.clearShare(s),false);
  }
  assert.equal(L.shareRecord(r,2026,'不正な日時').updatedAt,null);
});
test('連携に使うキー名はふるさと納税ナビと同じ',()=>{
  assert.equal(L.KEYS.log,'furusatoNavi.log');
  assert.equal(L.KEYS.share,'setsuzeiNavi.share.v1');
});

test('前年分を出す時期：制度の値が今年のもので1〜3月のときだけ',()=>{
  assert.equal(L.previousYear(new Date(2027,0,15),2027),2026);
  assert.equal(L.previousYear(new Date(2027,2,31,23,59),2027),2026);
  assert.equal(L.previousYear(new Date(2027,3,1),2027),null);
  assert.equal(L.previousYear(new Date(2027,0,15),2026),null);   // 制度の値がまだ前年版なら、その年の分をそのまま比べる
  assert.equal(L.previousYear(new Date('不正'),2027),null);
  assert.equal(L.previousYear(new Date(2027,0,15),'2027'),null);
});
