'use strict';

(()=>{
  const DAY=86400000;

  function longestStreak(dateValues){
    const dates=[...new Set(dateValues.filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
    let best=0,current=0,previous=null;
    for(const value of dates){
      const day=Date.parse(`${value}T00:00:00Z`);
      current=previous!==null&&day-previous===DAY?current+1:1;
      best=Math.max(best,current);previous=day;
    }
    return best;
  }

  function gameProgress(sourceState){
    const source=sourceState&&typeof sourceState==='object'?sourceState:{};
    const expenses=(Array.isArray(source.transactions)?source.transactions:[]).filter(item=>item?.kind!=='income');
    const recordDays=[...new Set(expenses.map(item=>item.date).filter(Boolean))];
    const streak=longestStreak(recordDays);
    const funds=Array.isArray(source.funds)?source.funds:[];
    const hasGoal=funds.some(fund=>Number(fund.target)>0);
    const hasSavings=funds.some(fund=>Number(fund.balance)>0);
    const hasQuarter=funds.some(fund=>Number(fund.target)>0&&Number(fund.balance)/Number(fund.target)>=.25);
    const badges=[
      expenses.length>0?'初航海':null,
      recordDays.length>=7?'7日記録':null,
      streak>=7?'7日連続':null,
      hasGoal?'目的地設定':null,
      hasSavings?'積立開始':null,
      hasQuarter?'25%到達':null
    ].filter(Boolean);
    const xp=recordDays.length*8+Math.min(streak,14)*2+badges.length*20;
    const level=Math.floor(xp/100)+1;
    const levelXp=xp%100;
    const titles=['起動準備','フィールドスカウト','ルートファインダー','ヴァンガード','キャプテン'];
    let mission='最初の支出を1件記録する';
    if(expenses.length&&recordDays.length<7)mission=`記録した日をあと${7-recordDays.length}日増やす`;
    else if(recordDays.length>=7&&!hasSavings)mission='目的別資金へ最初の積立をする';
    else if(hasSavings&&!hasQuarter)mission='目的別資金を25%まで進める';
    else if(hasQuarter)mission='今のペースで記録を続ける';
    return{xp,level,levelXp,title:titles[Math.min(level-1,titles.length-1)],recordDays:recordDays.length,streak,badges,mission};
  }

  function ensureCard(){
    const home=document.querySelector('#homeView'),grid=home?.querySelector('.grid');
    if(!home||!grid)return null;
    let card=document.querySelector('#compassGameCard');
    if(card)return card;
    card=document.createElement('section');
    card.id='compassGameCard';card.className='card compassGameCard';
    grid.after(card);
    return card;
  }

  function renderGame(){
    const card=ensureCard();if(!card)return;
    const game=gameProgress(typeof state!=='undefined'?state:{});
    card.innerHTML=`<div class="compassGameMain"><img src="compass-kun-v2.webp?v=1.5.0" alt="オレンジのスカーフとコンパス付きポシェットを身につけたデフォルメドラゴン、コンパスくん"><div class="compassGameInfo"><div class="row"><div><span class="gameEyebrow">NAVIGATOR-01</span><h3>コンパスくん</h3></div><span class="gameLevel">LV.${game.level}</span></div><b class="gameTitle">${game.title}</b><div class="gameXp"><span style="width:${game.levelXp}%"></span></div><div class="muted">EXP ${game.levelXp}/100 ・ 記録 ${game.recordDays}日 ・ 最長連続 ${game.streak}日</div></div></div><button class="linkBtn gameToggle" type="button" aria-expanded="false">航海ログを見る</button><div class="gameDetails" hidden><div class="gameMission"><span>今のミッション</span><b>${game.mission}</b></div><div class="gameBadges">${game.badges.length?game.badges.map(label=>`<span class="gameBadge">◆ ${label}</span>`).join(''):'<span class="muted">最初の記録でバッジを獲得</span>'}</div><p class="note">使った金額ではなく、記録した日数と目的別資金の進捗で成長します。</p></div>`;
    const toggle=card.querySelector('.gameToggle'),details=card.querySelector('.gameDetails');
    toggle.onclick=()=>{const open=details.hidden;details.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'航海ログを閉じる':'航海ログを見る'};
  }

  function bind(){
    if(globalThis.__compassGameBound)return;globalThis.__compassGameBound=true;
    const style=document.createElement('style');
    style.textContent='.compassGameCard{margin-top:14px;overflow:hidden;background:linear-gradient(135deg,rgba(15,118,110,.18),rgba(245,158,11,.08)),var(--card)}.compassGameMain{display:grid;grid-template-columns:104px 1fr;gap:14px;align-items:center}.compassGameMain img{width:104px;height:104px;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.3))}.compassGameInfo h3{margin:2px 0 0}.gameEyebrow{font-size:10px;letter-spacing:.16em;color:#14b8a6;font-weight:800}.gameLevel{border:1px solid rgba(20,184,166,.45);border-radius:999px;padding:4px 8px;color:#14b8a6;font-weight:800;font-size:12px}.gameTitle{display:block;margin:7px 0 6px;font-size:13px}.gameXp{height:7px;background:rgba(100,116,139,.22);border-radius:999px;overflow:hidden;margin-bottom:5px}.gameXp span{display:block;height:100%;background:linear-gradient(90deg,#0f766e,#2dd4bf,#f59e0b);border-radius:inherit}.gameToggle{width:100%;margin-top:8px}.gameDetails{border-top:1px solid var(--line);margin-top:8px;padding-top:12px}.gameMission{display:grid;gap:3px;padding:10px 12px;border-radius:12px;background:rgba(15,118,110,.1)}.gameMission span{font-size:11px;color:var(--muted)}.gameBadges{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.gameBadge{font-size:11px;font-weight:800;padding:6px 9px;border-radius:999px;background:rgba(245,158,11,.13);color:#d97706;border:1px solid rgba(245,158,11,.25)}@media(max-width:390px){.compassGameMain{grid-template-columns:86px 1fr}.compassGameMain img{width:86px;height:86px}.compassGameInfo .muted{font-size:10px}}';
    document.head.appendChild(style);
    if(typeof render==='function'){
      const original=render;globalThis.render=function(){original();renderGame()};
    }
    renderGame();
  }

  globalThis.OkaneCompassGame={longestStreak,gameProgress};
  if(typeof document!=='undefined')bind();
})();
