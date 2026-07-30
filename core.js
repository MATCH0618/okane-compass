'use strict';
const STORAGE_KEY='okane_compass_v1';
const BROKEN_KEY='okane_compass_broken_backup';
const MAX_AMOUNT=100000000;
const clone=v=>JSON.parse(JSON.stringify(v));
const DEFAULT_STATE={version:1,balances:{food:0,pocket:0},funds:[{id:'trip',name:'旅行費',balance:0,target:0,deadline:''},{id:'pass',name:'定期券',balance:0,target:54310,deadline:''},{id:'emergency',name:'生活防衛資金',balance:0,target:300000,deadline:''},{id:'cohabit',name:'同棲資金',balance:0,target:1000000,deadline:''}],transactions:[],updatedAt:''};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const yen=n=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(Number(n)||0);
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
function amount(value,{allowZero=false}={}){const n=Number(value);if(!Number.isFinite(n)||!Number.isInteger(n))return null;if(n<0||n>MAX_AMOUNT)return null;if(!allowZero&&n===0)return null;return n}
function normalizeState(raw){const s=raw&&typeof raw==='object'?raw:{};const out=clone(DEFAULT_STATE);out.version=1;out.balances.food=amount(s?.balances?.food,{allowZero:true})??0;out.balances.pocket=amount(s?.balances?.pocket,{allowZero:true})??0;out.funds=Array.isArray(s.funds)?s.funds.map((f,i)=>({id:String(f.id||`fund-${Date.now()}-${i}`),name:String(f.name||'目的別資金').slice(0,30),balance:amount(f.balance,{allowZero:true})??0,target:amount(f.target,{allowZero:true})??0,deadline:/^\d{4}-\d{2}-\d{2}$/.test(f.deadline||'')?f.deadline:''})):clone(DEFAULT_STATE.funds);out.transactions=Array.isArray(s.transactions)?s.transactions.map((t,i)=>({id:String(t.id||`tx-${Date.now()}-${i}`),date:/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')?t.date:today(),amount:amount(t.amount)??0,category:String(t.category||''),memo:String(t.memo||'').slice(0,80),kind:t.kind==='income'?'income':'expense',createdAt:Number(t.createdAt)||Date.now()})).filter(t=>t.amount>0):[];out.updatedAt=new Date().toISOString();return out}
function load(){const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return clone(DEFAULT_STATE);try{return normalizeState(JSON.parse(raw))}catch(e){localStorage.setItem(BROKEN_KEY,raw);return clone(DEFAULT_STATE)}}
let state=load();
function save(){state=normalizeState(state);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function cycleText(){const d=new Date(),day=d.getDate();const end=day<=24?new Date(d.getFullYear(),d.getMonth(),24):new Date(d.getFullYear(),d.getMonth()+1,24);const days=Math.max(0,Math.ceil((end-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000));return `給料サイクル 25日〜24日・残り${days}日`}
function hero(){const spend=state.balances.food+state.balances.pocket;let tone='今日の確認',title=`あと使えるのは ${yen(spend)}`,detail=`食費・日用品 ${yen(state.balances.food)}、お小遣い ${yen(state.balances.pocket)}。`;if(state.balances.food<5000){tone='食費';title=`食費・日用品があと ${yen(state.balances.food)}`;detail='残り日数と予定を確認して、無理のない範囲で使おう。'}else if(state.balances.pocket<3000){tone='お小遣い';title=`お小遣いがあと ${yen(state.balances.pocket)}`;detail='予定している遊びや買い物があるなら先に確保しよう。'}return{tone,title,detail}}
