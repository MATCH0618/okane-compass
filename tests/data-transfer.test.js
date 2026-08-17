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

const patch={balances:{pocket:37143},fundBalances:{pass:9100},fixedExpenses:[{id:'bread',name:'あんぱん',amount:200,category:'食費・日用品'}],transactionCorrections:[{idPrefix:'tx-',source:'au PAY履歴画像'},{id:'tx-1',memo:'QP/セイユウ'}]};
const patchCode=api.encodePatch(patch,new Date('2026-08-17T03:10:00.000Z'));
const patchPayload=api.decodeInput(patchCode);
const patched=api.applyPatch({...state,balances:{food:15694,pocket:0},funds:[{id:'pass',name:'定期券',balance:0,target:54310,deadline:''}],fixedExpenses:[]},patchPayload.patch);
assert.equal(patched.balances.pocket,37143);
assert.equal(patched.funds[0].balance,9100);
assert.equal(patched.fixedExpenses[0].name,'あんぱん');
assert.equal(patched.transactions[0].memo,'QP/セイユウ');
assert.equal(patched.transactions[0].source,'au PAY履歴画像');

const recovery={transactionBatch:{idPrefix:'aupay-202608-',category:'食費・日用品',source:'au PAY履歴画像',records:[[1,'2026-08-01',349,'QP/セイユウ'],[2,'2026-08-02',2178,'ドン・キホーテ']]}};
const recovered=api.applyPatch({...state,transactions:[{id:'older',date:'2026-07-01',amount:100,kind:'expense',memo:'以前の履歴'},{...state.transactions[0],id:'aupay-202608-001'}]},recovery);
assert.equal(recovered.transactions.length,3);
assert.ok(recovered.transactions.some(item=>item.id==='older'));
assert.equal(recovered.transactions.filter(item=>item.id==='aupay-202608-001').length,1);
assert.equal(recovered.transactions.find(item=>item.id==='aupay-202608-002').amount,2178);

console.log('data-transfer tests passed');
