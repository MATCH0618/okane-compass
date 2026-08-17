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
    const records=payload.records.map((raw,index)=>{
      const id=String(raw?.id||'').slice(0,100);
      const date=typeof safeDate==='function'?safeDate(String(raw?.date||'')):(/^\d{4}-\d{2}-\d{2}$/.test(raw?.date||'')?raw.date:'');
      const value=typeof amount==='function'?amount(raw?.amount):Number(raw?.amount);
      const memo=String(raw?.memo||'').trim().slice(0,80);
      if(!id||seen.has(id)||!date||!Number.isInteger(value)||value<=0||value>100000000||!memo)throw new Error(`${index+1}件目の履歴が正しくありません。`);
      seen.add(id);
      return{id,date,amount:value,category,memo,kind:'expense',source,createdAt:Date.parse(`${date}T12:00:00+09:00`)+index};
    });
    const balanceUpdates={};
    if(payload.balanceUpdates!==undefined){
      if(!payload.balanceUpdates||typeof payload.balanceUpdates!=='object'||Array.isArray(payload.balanceUpdates))throw new Error('残高更新の形式が正しくありません。');
      for(const key of ['food','pocket']){
        if(!Object.prototype.hasOwnProperty.call(payload.balanceUpdates,key))continue;
        const rawValue=payload.balanceUpdates[key];
        const value=typeof amount==='function'?amount(rawValue,{allowZero:true}):Number(rawValue);
        if(!Number.isInteger(value)||value<0||value>100000000)throw new Error('更新後の残高が正しくありません。');
        balanceUpdates[key]=value;
      }
    }
    return{records,balanceUpdates};
  }

  function mergeHistory(sourceState,records,balanceUpdates={}){
    const next=JSON.parse(JSON.stringify(sourceState&&typeof sourceState==='object'?sourceState:{}));
    next.balances=next.balances&&typeof next.balances==='object'?next.balances:{};
    const transactions=Array.isArray(next.transactions)?next.transactions:[];
    const existing=new Set(transactions.map(item=>String(item?.id||'')));
    const fresh=records.filter(item=>!existing.has(item.id));
    next.transactions=[...transactions,...fresh];
    if(fresh.length)Object.assign(next.balances,balanceUpdates);
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
      const normalized=normalizePayload(decodePayload(location.hash.slice(HASH_PREFIX.length)));
      clearImportHash();
      const result=mergeHistory(typeof state!=='undefined'?state:{},normalized.records,normalized.balanceUpdates);
      if(!result.fresh.length){
        alert('この履歴はすべて登録済みです。二重登録はしていません。');
        return;
      }
      const first=result.fresh.map(item=>item.date).sort()[0]||'-';
      const last=result.fresh.map(item=>item.date).sort().at(-1)||'-';
      const category=result.fresh[0]?.category||'-';
      const balanceLabels=[];
      if(Object.prototype.hasOwnProperty.call(normalized.balanceUpdates,'food'))balanceLabels.push(`食費・日用品残高：${yen(normalized.balanceUpdates.food)}へ更新`);
      if(Object.prototype.hasOwnProperty.call(normalized.balanceUpdates,'pocket'))balanceLabels.push(`お小遣い残高：${yen(normalized.balanceUpdates.pocket)}へ更新`);
      const message=[
        `${result.fresh.length}件・合計 ${yen(result.total)} の履歴を追加します。`,
        `期間：${first}〜${last}`,
        `分類：${category}`,
        result.skipped?`登録済みのため除外：${result.skipped}件`:'',
        ...balanceLabels,
        '',
        'この内容で反映しますか？'
      ].filter(Boolean).join('\n');
      if(!confirm(message))return;
      state.transactions=result.state.transactions;
      Object.assign(state.balances,result.state.balances);
      save();
      for(const [key,value] of Object.entries(normalized.balanceUpdates))if(state.balances[key]!==value)throw new Error('残高更新の確認に失敗しました。');
      render();
      switchView('historyView');
      toast(`${result.fresh.length}件の履歴を追加しました`);
      alert(`履歴の追加が完了しました。\n\n${result.fresh.length}件・合計 ${yen(result.total)}${balanceLabels.length?`\n${balanceLabels.join('\n')}`:''}`);
    }catch(error){
      clearImportHash();
      alert(error?.message||'履歴を取り込めませんでした。');
    }
  }

  globalThis.OkaneCompassHistoryImport={HASH_PREFIX,FORMAT,VERSION,decodePayload,normalizePayload,mergeHistory};
  if(typeof document!=='undefined')run();
})();
