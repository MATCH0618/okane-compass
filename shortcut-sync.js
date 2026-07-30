'use strict';
(()=>{
  const banner=document.querySelector('#shortcutSyncBanner');
  const queueInput=document.querySelector('#shortcutQueueFile');
  const exportConfig=document.querySelector('#exportShortcutConfig');
  const importQueue=document.querySelector('#importShortcutQueue');
  const openQueue=document.querySelector('#openShortcutQueue');
  if(!banner||!queueInput||!exportConfig||!importQueue)return;

  const downloadText=(name,text,type='application/json')=>{
    const blob=new Blob([text],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=name;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const validCategory=v=>['食費・日用品','お小遣い'].includes(v);
  const parseQueue=text=>{
    const trimmed=text.trim();
    if(!trimmed)return [];
    try{
      const parsed=JSON.parse(trimmed);
      if(Array.isArray(parsed))return parsed;
      if(Array.isArray(parsed.records))return parsed.records;
      return [parsed];
    }catch{
      return trimmed.split(/\r?\n/).filter(Boolean).map((line,index)=>{
        try{return JSON.parse(line)}catch{throw new Error(`${index+1}行目の形式が正しくありません`)}
      });
    }
  };

  const normalizeRecord=(raw,index)=>{
    const value=amount(raw?.amount);
    const category=String(raw?.category||'');
    if(value===null||!validCategory(category))return null;
    const date=safeDate(String(raw?.date||''))||today();
    const memo=String(raw?.memo||raw?.name||category).slice(0,80);
    const sourceId=String(raw?.id||raw?.createdAt||`${date}-${value}-${category}-${memo}-${index}`);
    return {id:`shortcut-${sourceId}`,date,amount:value,category,memo,kind:'expense',source:'shortcut-file',createdAt:Number(raw?.createdAt)||Date.now()+index};
  };

  exportConfig.addEventListener('click',()=>{
    const data={
      format:'okane-compass-shortcut-config',
      version:1,
      updatedAt:new Date().toISOString(),
      fixedExpenses:state.fixedExpenses.map(f=>({
        id:f.id,
        name:f.name,
        amount:f.amount,
        category:f.category,
        label:`${f.name}｜${f.amount}円｜${f.category}`
      }))
    };
    downloadText('okane-compass-fixed-expenses.json',JSON.stringify(data,null,2));
    toast('固定支出設定を書き出しました');
  });

  const chooseQueue=()=>queueInput.click();
  importQueue.addEventListener('click',chooseQueue);
  openQueue?.addEventListener('click',chooseQueue);

  queueInput.addEventListener('change',async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      const records=parseQueue(await file.text()).map(normalizeRecord).filter(Boolean);
      if(!records.length)throw new Error('取り込める支出データがありません');
      const existing=new Set(state.transactions.map(t=>t.id));
      const fresh=records.filter(r=>!existing.has(r.id));
      if(!fresh.length){
        alert('このファイルの支出はすべて取込済みです。二重登録はしていません。');
        return;
      }
      const foodTotal=fresh.filter(r=>r.category==='食費・日用品').reduce((s,r)=>s+r.amount,0);
      const pocketTotal=fresh.filter(r=>r.category==='お小遣い').reduce((s,r)=>s+r.amount,0);
      if(foodTotal>state.balances.food||pocketTotal>state.balances.pocket){
        alert(`残高が不足しているため取り込めません。\n\n食費・日用品: ${yen(foodTotal)}（残高 ${yen(state.balances.food)}）\nお小遣い: ${yen(pocketTotal)}（残高 ${yen(state.balances.pocket)}）`);
        return;
      }
      const summary=fresh.slice(0,8).map(r=>`${r.date} ${r.memo} ${yen(r.amount)}［${r.category}］`).join('\n');
      const extra=fresh.length>8?`\nほか${fresh.length-8}件`:'';
      if(!confirm(`${fresh.length}件の支出を反映しますか？\n\n${summary}${extra}\n\n食費・日用品 合計 ${yen(foodTotal)}\nお小遣い 合計 ${yen(pocketTotal)}`))return;
      state.balances.food-=foodTotal;
      state.balances.pocket-=pocketTotal;
      state.transactions.push(...fresh);
      save();
      render();
      banner.hidden=true;
      localStorage.setItem('okane_compass_last_shortcut_import',new Date().toISOString());
      toast(`${fresh.length}件を取り込みました`);
      alert('取り込みが完了しました。同じ待機ファイルを再度選んでも、取込済みIDは二重登録されません。');
    }catch(error){
      alert(error?.message||'待機ファイルを読み込めませんでした。');
    }finally{
      event.target.value='';
    }
  });

  const help=document.querySelector('#shortcutHelp');
  if(help)help.onclick=()=>alert('新しい方式ではSafariを毎回開きません。\n\n1. アプリで固定支出を登録\n2. 「固定支出をショートカット用に書き出す」\n3. ファイルをiCloud DriveのShortcutsフォルダへ保存\n4. ショートカットは設定ファイルから固定支出を選択\n5. 支出をJSON形式で待機ファイルへ追記\n6. アプリ起動後「ショートカット支出を確認」から待機ファイルを選択\n\nWebアプリはiCloud Driveを無断で読めないため、ファイル選択の1操作だけ必要です。');

  banner.hidden=false;
})();
