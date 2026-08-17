'use strict';

const assert=require('node:assert/strict');
require('../data-transfer.js');

const api=globalThis.OkaneCompassDataTransfer;
const state={version:2,balances:{food:15694,pocket:37143},funds:[{id:'pass',name:'定期券',balance:9100,target:54310,deadline:''}],transactions:[{id:'tx-1',date:'2026-08-01',amount:349,kind:'expense',memo:'QP/セイユウ',source:'au PAY履歴画像'}]};
const snapshot=JSON.stringify(state);
const code=api.encodeTransfer(state,new Date('2026-08-17T03:00:00.000Z'));
assert.ok(code.startsWith(api.PREFIX));
const decoded=api.decodeTransfer(code);
assert.equal(JSON.stringify(state),snapshot);
assert.deepEqual(decoded.state,state);
assert.equal(decoded.exportedAt,'2026-08-17T03:00:00.000Z');
assert.equal(decoded.state.transactions[0].memo,'QP/セイユウ');
assert.equal(decoded.state.transactions[0].source,'au PAY履歴画像');
assert.throws(()=>api.decodeTransfer('invalid'));

console.log('data-transfer tests passed');
