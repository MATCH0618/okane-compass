#!/usr/bin/env python3
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / "index.html"
text = TARGET.read_text(encoding="utf-8")

replacements = []

replacements.append((
'''const emptyState={
  version:"0.18",
  configured:false,
  cycleStartDay:25,
  balances:{food:0,pocket:0},
  funds:[
    {name:"旅行費",balance:0,target:0,deadline:""},
    {name:"定期券",balance:0,target:54310,deadline:""},
    {name:"生活防衛資金",balance:0,target:300000,deadline:""},
    {name:"同棲資金",balance:0,target:1000000,deadline:""}
  ],
  events:[],
  fixedExpenses:[],
  transactions:[]
};
const legacy=JSON.parse(localStorage.getItem("moneyCompassState")||"null");
let state=legacy||JSON.parse(JSON.stringify(emptyState));
if(!state.allocationHistory) state.allocationHistory=[];
if(!Array.isArray(state.fixedExpenses)) state.fixedExpenses=[];
if(state.sources) delete state.sources;
if(Array.isArray(state.transactions)){
  state.transactions.forEach(t=>{ if("source" in t) delete t.source; });
}
if(Array.isArray(state.pendingExpenses)){
  state.pendingExpenses.forEach(t=>{ if("source" in t) delete t.source; });
}
if(!state.version){
  state.version="0.2";
  state.configured=false;
}
const save=()=>localStorage.setItem("moneyCompassState",JSON.stringify(state));''',
'''const APP_STATE_VERSION="0.19";
const STATE_KEY="moneyCompassState";
const RECOVERY_KEY="moneyCompassStateRecovery";
const emptyState={
  version:APP_STATE_VERSION,
  configured:false,
  cycleStartDay:25,
  balances:{food:0,pocket:0},
  funds:[
    {name:"旅行費",balance:0,target:0,deadline:""},
    {name:"定期券",balance:0,target:54310,deadline:""},
    {name:"生活防衛資金",balance:0,target:300000,deadline:""},
    {name:"同棲資金",balance:0,target:1000000,deadline:""}
  ],
  events:[],
  fixedExpenses:[],
  transactions:[],
  pendingExpenses:[],
  allocationHistory:[]
};
const cloneEmptyState=()=>JSON.parse(JSON.stringify(emptyState));
const safeAmount=value=>{
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?Math.round(n):0;
};
function normalizeState(candidate){
  if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))throw new Error("invalid root");
  const next=cloneEmptyState();
  next.configured=Boolean(candidate.configured);
  next.cycleStartDay=Number(candidate.cycleStartDay)===25?25:25;
  next.balances={food:safeAmount(candidate.balances?.food),pocket:safeAmount(candidate.balances?.pocket)};
  next.funds=Array.isArray(candidate.funds)?candidate.funds.filter(x=>x&&typeof x==="object").map(x=>({
    name:String(x.name||"").trim().slice(0,80),
    balance:safeAmount(x.balance),target:safeAmount(x.target),deadline:/^\d{4}-\d{2}-\d{2}$/.test(x.deadline||"")?x.deadline:""
  })).filter(x=>x.name):cloneEmptyState().funds;
  next.events=Array.isArray(candidate.events)?candidate.events.filter(x=>x&&typeof x==="object").map(x=>({
    id:String(x.id||("e"+Date.now()+Math.random())),date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||"")?x.date:today(),
    title:String(x.title||"").slice(0,120),amount:safeAmount(x.amount),category:String(x.category||"予定").slice(0,40)
  })).filter(x=>x.title):[];
  const normalizeTx=x=>({
    id:String(x.id||("t"+Date.now()+Math.random())),date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||"")?x.date:today(),
    amount:safeAmount(x.amount),category:String(x.category||"").slice(0,80),memo:String(x.memo||"").slice(0,200),
    inputMethod:String(x.inputMethod||"app").slice(0,50),kind:x.kind==="income"?"income":"expense"
  });
  next.transactions=Array.isArray(candidate.transactions)?candidate.transactions.filter(x=>x&&typeof x==="object").map(normalizeTx).filter(x=>x.amount>0&&x.category):[];
  next.pendingExpenses=Array.isArray(candidate.pendingExpenses)?candidate.pendingExpenses.filter(x=>x&&typeof x==="object").map(normalizeTx).filter(x=>x.amount>0):[];
  next.fixedExpenses=Array.isArray(candidate.fixedExpenses)?candidate.fixedExpenses.filter(x=>x&&typeof x==="object").map(x=>({
    id:String(x.id||("fx"+Date.now()+Math.random())),name:String(x.name||"").trim().slice(0,100),amount:safeAmount(x.amount),category:x.category==="pocket"?"pocket":"food"
  })).filter(x=>x.name&&x.amount>0):[];
  next.allocationHistory=Array.isArray(candidate.allocationHistory)?candidate.allocationHistory.slice(-20):[];
  next.version=APP_STATE_VERSION;
  return next;
}
function loadState(){
  const raw=localStorage.getItem(STATE_KEY);
  if(!raw)return cloneEmptyState();
  try{return normalizeState(JSON.parse(raw));}
  catch(error){
    localStorage.setItem(RECOVERY_KEY,raw);
    alert("保存データを安全に読み込めなかったため、初期状態で起動しました。元データは復旧用に端末内へ退避しています。");
    return cloneEmptyState();
  }
}
let state=loadState();
const save=()=>{
  state=normalizeState(state);
  localStorage.setItem(STATE_KEY,JSON.stringify(state));
};
const transactionFingerprint=x=>[x.kind||"expense",x.date||"",Math.round(Number(x.amount||0)),x.category||"",String(x.memo||"").trim()].join("|");
const hasTransactionDuplicate=x=>(state.transactions||[]).some(t=>transactionFingerprint(t)===transactionFingerprint(x));'''
))

replacements.append((
'''  if(amount<=0){
    alert("金額を入力してね。");
    return;
  }''',
'''  if(!Number.isFinite(amount)||!Number.isInteger(amount)||amount<=0){
    alert("金額は1円以上の整数で入力してね。");
    return;
  }'''
))

replacements.append((
'''  state.transactions.push({
    id:Date.now()+"",
    date,
    amount,
    category,
    memo,
    inputMethod,
    kind:"expense"
  });''',
'''  const transaction={
    id:"t"+Date.now()+"-"+Math.random().toString(36).slice(2,8),
    date,
    amount,
    category,
    memo,
    inputMethod,
    kind:"expense"
  };
  if(hasTransactionDuplicate(transaction)&&!confirm("同じ日付・金額・分類・メモの支出が既にあります。重複の可能性がありますが記録しますか？"))return;
  state.transactions.push(transaction);'''
))

replacements.append((
'''  for(const x of items){
    state.transactions.push({
      id:x.id||Date.now()+"-"+Math.random(),
      date:x.date||today(), amount:Number(x.amount), category:x.category,
      memo:x.memo||"", inputMethod:x.inputMethod||"shortcut_queue", kind:"expense"
    });
  }''',
'''  const duplicateItems=items.filter(x=>hasTransactionDuplicate({
    date:x.date||today(),amount:Number(x.amount),category:x.category,memo:x.memo||"",kind:"expense"
  }));
  if(duplicateItems.length&&!confirm(`${duplicateItems.length}件は既存履歴と同じ内容です。重複の可能性がありますが、まとめて記録しますか？`))return;
  for(const x of items){
    state.transactions.push({
      id:x.id||("t"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),
      date:x.date||today(), amount:Number(x.amount), category:x.category,
      memo:x.memo||"", inputMethod:x.inputMethod||"shortcut_queue", kind:"expense"
    });
  }'''
))

replacements.append((
'''document.getElementById("importBtn").onclick=()=>document.getElementById("file").click();document.getElementById("file").onchange=async e=>{try{state=JSON.parse(await e.target.files[0].text());save();render();alert("読み込みました")}catch{alert("読み込みに失敗しました")}};''',
'''document.getElementById("importBtn").onclick=()=>document.getElementById("file").click();
document.getElementById("file").onchange=async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
    const imported=normalizeState(JSON.parse(await file.text()));
    if(!confirm(`バックアップを読み込みます。現在のデータは端末内へ復旧用として退避します。\n支出履歴 ${imported.transactions.length}件\n目的別資金 ${imported.funds.length}件`))return;
    localStorage.setItem(RECOVERY_KEY,JSON.stringify(state));
    state=imported;save();render();alert("バックアップを安全に読み込みました");
  }catch(error){
    alert("バックアップの形式が正しくないため、読み込みませんでした。現在のデータは変更していません。");
  }finally{
    e.target.value="";
  }
};'''
))

replacements.append(('''  state.version="0.18";''','''  state.version=APP_STATE_VERSION;'''))

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match, found {count}: {old[:80]!r}")
    text = text.replace(old, new, 1)

TARGET.write_text(text, encoding="utf-8")
print("Applied Compass data-safety patch to index.html")
