'use strict';

const assert=require('node:assert/strict');
require('../history-import.js');

const api=globalThis.OkaneCompassHistoryImport;
const payload={
  format:'okane-compass-history-import',
  version:1,
  category:'食費・日用品',
  source:'au PAY履歴画像',
  records:[
    {id:'aupay-20260801-001',date:'2026-08-01',amount:349,memo:'QP/セイユウ'},
    {id:'aupay-20260802-001',date:'2026-08-02',amount:1060,memo:'モスバーガー/NFC'}
  ]
};

const encoded=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
assert.deepEqual(api.decodePayload(encoded),payload);
const records=api.normalizePayload(payload);
assert.equal(records.length,2);
assert.equal(records[0].category,'食費・日用品');
assert.equal(records[0].source,'au PAY履歴画像');

const original={balances:{food:42542,pocket:37143},transactions:[records[0]],funds:[{id:'trip',balance:0}]};
const snapshot=JSON.stringify(original);
const result=api.mergeHistory(original,records);
assert.equal(JSON.stringify(original),snapshot);
assert.deepEqual(result.state.balances,{food:42542,pocket:37143});
assert.equal(result.fresh.length,1);
assert.equal(result.skipped,1);
assert.equal(result.total,1060);
assert.equal(result.state.transactions.length,2);

assert.throws(()=>api.normalizePayload({...payload,category:'不正'}));
assert.throws(()=>api.normalizePayload({...payload,records:[payload.records[0],payload.records[0]]}));
assert.throws(()=>api.normalizePayload({...payload,records:[{...payload.records[0],amount:-1}]}));

console.log('history-import tests passed');
