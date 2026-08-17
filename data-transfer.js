'use strict';

(()=>{
  const PREFIX='OKANE_COMPASS_TRANSFER_V1:';
  const FORMAT='okane-compass-state-transfer';
  const VERSION=1;

  function encodeUtf8Base64Url(value){
    const bytes=new TextEncoder().encode(value);
    let binary='';
    for(const byte of bytes)binary+=String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  function decodeUtf8Base64Url(value){
    const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
    const binary=atob(normalized+'='.repeat((4-normalized.length%4)%4));
    return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));
  }

  function encodeTransfer(sourceState,exportedAt=new Date()){
    const source=sourceState&&typeof sourceState==='object'?sourceState:{};
    const safeState=typeof normalizeState==='function'?normalizeState(source):JSON.parse(JSON.stringify(source));
    return PREFIX+encodeUtf8Base64Url(JSON.stringify({format:FORMAT,version:VERSION,exportedAt:exportedAt.toISOString(),state:safeState}));
  }

  function decodeTransfer(raw){
    const value=String(raw||'').trim();
    const encoded=value.startsWith(PREFIX)?value.slice(PREFIX.length):value;
    const payload=JSON.parse(decodeUtf8Base64Url(encoded));
    if(!payload||payload.format!==FORMAT||payload.version!==VERSION||!payload.state||typeof payload.state!=='object')throw new Error('引越しコードの形式が正しくありません。');
    return payload;
  }

  async function writeClipboard(value){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true}
    prompt('この引越しコードをコピーしてください',value);
    return false;
  }

  async function readClipboard(){
    if(navigator.clipboard?.readText){
      try{const value=await navigator.clipboard.readText();if(value)return value}catch{}
    }
    return prompt('コピーした引越しコードを貼り付けてください','')||'';
  }

  function summary(next){
    const expenses=(next.transactions||[]).filter(item=>item.kind!=='income');
    return [
      `食費・日用品：${yen(next.balances?.food||0)}`,
      `お小遣い：${yen(next.balances?.pocket||0)}`,
      `支出履歴：${expenses.length}件`,
      `目的別資金：${(next.funds||[]).length}件`,
      `予定：${(next.calendarEvents||[]).length}件`
    ].join('\n');
  }

  async function copyCurrent(){
    try{
      const code=encodeTransfer(typeof state!=='undefined'?state:{});
      const direct=await writeClipboard(code);
      if(typeof toast==='function')toast(direct?'端末データをコピーしました':'引越しコードを表示しました');
    }catch{alert('端末データをコピーできませんでした。')}
  }

  async function restoreCurrent(){
    try{
      const raw=await readClipboard();
      if(!raw)return;
      const payload=decodeTransfer(raw);
      const next=typeof normalizeState==='function'?normalizeState(payload.state):payload.state;
      if(!confirm(`コピー元のデータで現在のデータを置き換えます。\n\n${summary(next)}\n\n反映しますか？`))return;
      state=next;
      save();
      render();
      if(typeof switchView==='function')switchView('homeView');
      if(typeof toast==='function')toast('端末データを復元しました');
    }catch(error){alert(error?.message||'端末データを復元できませんでした。')}
  }

  function bind(){
    const grid=document.querySelector('#settingsView .settingsGrid');
    const anchor=document.querySelector('#exportBtn');
    if(!grid||!anchor||document.querySelector('#copyDeviceData'))return;
    const copy=document.createElement('button');
    copy.className='iconBtn';copy.id='copyDeviceData';copy.textContent='端末データをコピー';
    const restore=document.createElement('button');
    restore.className='iconBtn';restore.id='restoreDeviceData';restore.textContent='コピーしたデータを復元';
    const note=document.createElement('div');
    note.className='note';note.style.gridColumn='1/-1';note.textContent='ChatGPT内ブラウザとホーム画面版のデータ引越しに使います。ファイル保存は不要です。';
    grid.insertBefore(copy,anchor);grid.insertBefore(restore,anchor);grid.insertBefore(note,anchor);
    copy.onclick=copyCurrent;restore.onclick=restoreCurrent;
  }

  globalThis.OkaneCompassDataTransfer={PREFIX,FORMAT,VERSION,encodeTransfer,decodeTransfer};
  if(typeof document!=='undefined')bind();
})();
