'use strict';

const assert=require('node:assert/strict');
require('../game-mode.js');

const api=globalThis.OkaneCompassGame;
assert.equal(api.longestStreak(['2026-08-01','2026-08-02','2026-08-04']),2);
const state={
  transactions:[1,2,3,4,5,6,7].map(day=>({date:`2026-08-${String(day).padStart(2,'0')}`,amount:100,kind:'expense'})),
  funds:[{id:'pass',balance:9100,target:54310}]
};
const game=api.gameProgress(state);
assert.equal(game.recordDays,7);
assert.equal(game.streak,7);
assert.ok(game.badges.includes('7日記録'));
assert.ok(game.badges.includes('7日連続'));
assert.ok(game.badges.includes('目的地設定'));
assert.ok(game.badges.includes('積立開始'));
assert.equal(game.badges.includes('25%到達'),false);
assert.ok(game.level>=2);

const empty=api.gameProgress({transactions:[],funds:[]});
assert.equal(empty.level,1);
assert.equal(empty.recordDays,0);
assert.equal(empty.badges.length,0);

console.log('game-mode tests passed');
