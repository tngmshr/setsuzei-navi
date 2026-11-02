// ふるさと納税ナビ（../furusato-navi/）との連携。同じオリジンの localStorage だけを使い、外部には送らない。
// 保存領域が使えない・空・壊れた JSON・古い形式でも例外を出さず、「記録なし」として扱う。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SetsuzeiLink = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEYS = Object.freeze({
    log:'furusatoNavi.log',          // ふるさと納税ナビの寄付の記録（読むだけ）
    share:'setsuzeiNavi.share.v1'    // 節税ナビ → ふるさと納税ナビへ渡す上限の目安
  });
  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  // 保存領域を取り出す。プライベートモードなどで localStorage の参照自体が例外になる場合は null。
  function storage(win = typeof window !== 'undefined' ? window : undefined) {
    try { return win && win.localStorage ? win.localStorage : null; } catch { return null; }
  }
  function readJSON(store, key) {
    try {
      const raw = store ? store.getItem(key) : null;
      return raw === null || raw === undefined || raw === '' ? null : JSON.parse(raw);
    } catch { return null; }
  }
  // ふるさと納税ナビの保存形式は {limit:数値, items:[{id, city, amount, date:'YYYY-MM-DD', one}]}。
  // 以前の節税ナビが想定していた「配列だけ」の形も受け付ける。行の検証は calc.js の furusatoProgress が行う。
  function normalizeLog(value) {
    const items = Array.isArray(value) ? value : isObject(value) && Array.isArray(value.items) ? value.items : [];
    const limit = isObject(value) && Number.isSafeInteger(value.limit) && value.limit > 0 ? value.limit : null;
    return {limit, items};
  }
  const readFurusatoLog = store => normalizeLog(readJSON(store, KEYS.log));
  // ふるさと納税ナビが受け取る形。相手側は year が今年で、donationLimit が0以上の整数のときだけ使う。
  function shareRecord(result, year, now = new Date()) {
    const d = result && result.valid ? result.donation : null;
    if (!d || !Number.isInteger(year) || !Number.isSafeInteger(d.withIdeco) || d.withIdeco < 0 || !Number.isSafeInteger(d.baseline) || d.baseline < 0) return null;
    const t = now instanceof Date ? now : new Date(now);
    return {year, donationLimit:d.withIdeco, donationLimitNoIdeco:d.baseline, updatedAt:Number.isFinite(t.getTime()) ? t.toISOString() : null};
  }
  // 入力は正しいが上限の目安が出せないときは、前の入力の古い値が相手側に残らないよう消す。
  function writeShare(store, result, year, now) {
    const record = shareRecord(result, year, now);
    if (!record) return clearShare(store) ? 'removed' : 'failed';
    try { store.setItem(KEYS.share, JSON.stringify(record)); return 'saved'; } catch { return 'failed'; }
  }
  function clearShare(store) {
    try { store.removeItem(KEYS.share); return true; } catch { return false; }
  }
  // 制度の値（year 年分）が今年のもので、今が1〜3月なら、前年分の寄付も確かめたい時期なので前年を返す。それ以外は null。
  function previousYear(now, year) {
    const t = now instanceof Date ? now : new Date(now);
    if (!Number.isInteger(year) || !Number.isFinite(t.getTime())) return null;
    return t.getFullYear() === year && t.getMonth() < 3 ? year - 1 : null;
  }
  return {KEYS, storage, previousYear, readJSON, normalizeLog, readFurusatoLog, shareRecord, writeShare, clearShare};
});
