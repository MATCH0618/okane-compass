'use strict';

(()=>{
  const HASH_PREFIX='#history-import=';
  const FORMAT='okane-compass-history-import';
  const VERSION=1;
  const VALID_CATEGORIES=new Set(['食費・日用品','お小遣い']);

  function decodePayload(encoded){
    const normalized=String(encoded||'').replace(/-/g,'+').replace(/_/g,'/');
    const padded=normalized+'='.repeat((4-normalized.length%4)%4);
    const binary=atob(padded);
    const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function normalizePayload(payload){
    if(!payload||payload.format!==FORMAT||payload.version!==VERSION)throw new Error('取込リンクの形式が正しくありません。');
    const category=String(payload.category||'');
    if(!VALID_CATEGORIES.has(category))throw new Error('支出カテゴリが正しくありません。');
    const source=String(payload.source||'履歴一括取込').slice(0,40);
    if(!Array.isArray(payload.records)||payload.records.length===0||payload.records.length>200)throw new Error('取込件数が正しくありません。');
    const seen=new Set();
    return payload.records.map((raw,index)=>{
      const id=String(raw?.id||'').slice(0,100);
      const date=typeof safeDate==='function'?safeDate(String(raw?.date||'')):(/^\d{4}-\d{2}-\d{2}$/.test(raw?.date||'')?raw.date:'');
      const value=typeof amount==='function'?amount(raw?.amount):Number(raw?.amount);
      const memo=String(raw?.memo||'').trim().slice(0,80);
      if(!id||seen.has(id)||!date||!Number.isInteger(value)||value<=0||value>100000000||!memo)throw new Error(`${index+1}件目の履歴が正しくありません。`);
      seen.add(id);
      return{id,date,amount:value,category,memo,kind:'expense',source,createdAt:Date.parse(`${date}T12:00:00+09:00`)+index};
    });
  }

  function mergeHistory(sourceState,records){
    const next=JSON.parse(JSON.stringify(sourceState&&typeof sourceState==='object'?sourceState:{}));
    const transactions=Array.isArray(next.transactions)?next.transactions:[];
    const existing=new Set(transactions.map(item=>String(item?.id||'')));
    const fresh=records.filter(item=>!existing.has(item.id));
    next.transactions=[...transactions,...fresh];
    return{
      state:next,
      fresh,
      skipped:records.length-fresh.length,
      total:fresh.reduce((sum,item)=>sum+item.amount,0)
    };
  }

  function clearImportHash(){
    if(typeof history!=='undefined'&&typeof location!=='undefined')history.replaceState({},'',`${location.pathname}${location.search}`);
  }

  function run(){
    if(typeof location==='undefined'||!location.hash.startsWith(HASH_PREFIX))return;
    try{
      const records=normalizePayload(decodePayload(location.hash.slice(HASH_PREFIX.length)));
      clearImportHash();
      const result=mergeHistory(typeof state!=='undefined'?state:{},records);
      if(!result.fresh.length){
        alert('この履歴はすべて登録済みです。二重登録はしていません。');
        return;
      }
      const first=result.fresh.map(item=>item.date).sort()[0];
      const last=result.fresh.map(item=>item.date).sort().at(-1);
      const category=result.fresh[0].category;
      const message=[
        `${result.fresh.length}件・合計 ${yen(result.total)} の履歴を追加します。`,
        `期間：${first}〜${last}`,
        `分類：${category}`,
        result.skipped?`登録済みのため除外：${result.skipped}件`:'',
        '',
        '現在残高は変更しません。よろしいですか？'
      ].filter(Boolean).join('\n');
      if(!confirm(message))return;
      const balancesBefore=JSON.stringify(state.balances);
      state.transactions=result.state.transactions;
      save();
      if(JSON.stringify(state.balances)!==balancesBefore)throw new Error('残高保護の確認に失敗しました。');
      render();
      switchView('historyView');
      toast(`${result.fresh.length}件の履歴を追加しました`);
      alert(`履歴の追加が完了しました。\n\n${result.fresh.length}件・合計 ${yen(result.total)}\n現在残高は変更していません。`);
    }catch(error){
      clearImportHash();
      alert(error?.message||'履歴を取り込めませんでした。');
    }
  }

  globalThis.OkaneCompassHistoryImport={HASH_PREFIX,FORMAT,VERSION,decodePayload,normalizePayload,mergeHistory};
  if(typeof document!=='undefined')run();
})();
