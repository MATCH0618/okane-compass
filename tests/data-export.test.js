'use strict';

const assert=require('node:assert/strict');
require('../data-export.js');

const api=globalThis.OkaneCompassExport;
const sample={
  version:2,
  balances:{food:30650,pocket:14500},
  funds:[{id:'trip',name:'旅行費',balance:20000,target:60000,deadline:'2026-12-31'}],
  transactions:[
    {id:'tx-1',date:'2026-08-01',amount:1200,category:'食費・日用品',memo:'昼食',kind:'expense',source:'app'},
    {id:'tx-2',date:'2026-07-20',amount:500,category:'お小遣い',memo:'=危険な式',kind:'expense',source:'app'}
  ],
  allocations:[{id:'a-1',date:'2026-07-25',income:100000,items:[{targetId:'trip',name:'旅行費',amount:20000},{targetId:'food',name:'食費・日用品',amount:50000}]}],
  calendarEvents:[
    {id:'e-1',date:'2026-08-24',title:'カード引落',amount:30000,type:'bill',memo:''},
    {id:'e-2',date:'2026-08-25',title:'給与',amount:220000,type:'income',memo:''}
  ],
  fixedExpenses:[{id:'f-1',name:'会社食堂',amount:450,category:'食費・日用品'}],
  updatedAt:'2026-08-16T12:34:56.000Z',
  accountNumber:'1234567',
  password:'do-not-export'
};

const sourceSnapshot=JSON.stringify(sample);
const exported=api.buildExport(sample,new Date(2026,7,17,9,8,7));
assert.equal(JSON.stringify(sample),sourceSnapshot);
assert.deepEqual(exported.metadata.aggregationPeriod,{start:'2026-07-25',end:'2026-08-24'});
assert.equal(exported.metadata.counts.expensesInPeriod,1);
assert.equal(exported.expenses[0].status,'確定');
assert.equal(exported.expenses[0].fixedOrVariableStatus,'未確認');
assert.equal(exported.futurePayments[0].status,'予定');
assert.equal(exported.appCalculatedValues.availableAmount.value,45150);
assert.equal(exported.verification.periodExpenseDetailTotal,1200);
assert.equal(exported.verification.allocationChecks[0].difference,30000);
assert.equal(exported.savingsContributions.actual[0].amount,20000);
assert.equal(exported.appCalculatedValues.monthlyCashflow.value,null);
assert.equal(exported.accounts.length,0);
assert.equal(exported.creditCards.length,0);

const json=JSON.stringify(exported);
assert.equal(json.includes('1234567'),false);
assert.equal(json.includes('do-not-export'),false);

const csv=api.toCsv(exported);
assert.ok(csv.startsWith('\uFEFFrecord_type'));
assert.ok(csv.includes("'=危険な式"));
assert.equal(api.localStamp(new Date(2026,7,17,9,8,7)),'2026-08-17_090807');

const empty=api.buildExport({version:2,balances:{food:0,pocket:0},funds:[],transactions:[],allocations:[],calendarEvents:[],fixedExpenses:[]},new Date(2026,7,17));
assert.equal(empty.metadata.counts.expenses,0);
assert.equal(empty.verification.periodExpenseDetailTotal,0);
assert.equal(empty.appCalculatedValues.availableAmount.value,0);

console.log('data-export tests passed');
