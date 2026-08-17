'use strict';

const assert=require('node:assert/strict');
require('../calendar-spend.js');

const api=globalThis.OkaneCompassCalendarSpend;
const transactions=[
  {date:'2026-08-01',amount:349,kind:'expense'},
  {date:'2026-08-01',amount:651,kind:'expense'},
  {date:'2026-08-02',amount:200,kind:'income'},
  {date:'2026-07-31',amount:500,kind:'expense'},
  {date:'invalid',amount:999,kind:'expense'}
];
assert.deepEqual(api.dailyExpenseTotals(transactions),{'2026-08-01':1000,'2026-07-31':500});
assert.equal(api.monthExpenseTotal(transactions,'2026-08'),1000);
assert.equal(api.monthExpenseTotal(transactions,'2026-07'),500);

console.log('calendar-spend tests passed');
