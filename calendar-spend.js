'use strict';

(()=>{
  function dailyExpenseTotals(transactions){
    const totals={};
    for(const item of Array.isArray(transactions)?transactions:[]){
      if(item?.kind==='income'||!/^\d{4}-\d{2}-\d{2}$/.test(item?.date||''))continue;
      totals[item.date]=(totals[item.date]||0)+(Number(item.amount)||0);
    }
    return totals;
  }

  function monthExpenseTotal(transactions,month){
    const totals=dailyExpenseTotals(transactions);
    return Object.entries(totals).filter(([date])=>date.startsWith(month)).reduce((sum,[,value])=>sum+value,0);
  }

  function decorateCalendar(){
    const transactions=Array.isArray(state?.transactions)?state.transactions:[];
    const totals=dailyExpenseTotals(transactions);
    document.querySelectorAll('[data-cal-date]').forEach(cell=>{
      const value=totals[cell.dataset.calDate]||0;
      if(!value)return;
      const spend=document.createElement('small');
      spend.className='calSpend';spend.textContent=`-${value.toLocaleString('ja-JP')}`;
      cell.appendChild(spend);
    });
    const label=document.querySelector('#monthLabel');
    const match=label?.textContent?.match(/(\d{4})年\s*(\d{1,2})月/);
    if(match){
      const month=`${match[1]}-${String(match[2]).padStart(2,'0')}`;
      let summary=document.querySelector('#calendarMonthSpend');
      if(!summary){summary=document.createElement('div');summary.id='calendarMonthSpend';summary.className='calendarMonthSpend';document.querySelector('#calendarGrid')?.before(summary)}
      summary.textContent=`この月の確定支出 ${yen(monthExpenseTotal(transactions,month))}`;
    }
    const date=document.querySelector('[data-cal-date].selected')?.dataset.calDate;
    const target=document.querySelector('#selectedDateEvents');
    if(!date||!target)return;
    const list=transactions.filter(item=>item.kind!=='income'&&item.date===date).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const section=document.createElement('div');
    section.className='calendarSpendDetails';
    section.innerHTML=`<div class="item row"><b>確定支出</b><b>${yen(totals[date]||0)}</b></div>${list.length?list.map(item=>`<div class="item row"><div><b>${escapeHtml(item.memo||'支出')}</b><div class="muted">${escapeHtml(item.category||'カテゴリ未入力')}・確定</div></div><b>${yen(item.amount)}</b></div>`).join(''):'<div class="empty">この日の支出はありません。</div>'}`;
    target.prepend(section);
    const title=document.querySelector('#selectedDateLabel');
    if(title)title.textContent=`${date} の支出・予定`;
  }

  function bind(){
    if(typeof renderCalendar!=='function'||globalThis.__calendarSpendBound)return;
    globalThis.__calendarSpendBound=true;
    const original=renderCalendar;
    globalThis.renderCalendar=function(){original();decorateCalendar()};
    const style=document.createElement('style');
    style.textContent='.calCell{min-height:58px;position:relative}.calSpend{display:block;margin-top:3px;color:#d84a3a;font-size:9px;font-weight:700;line-height:1.1}.calendarMonthSpend{margin:8px 0 10px;text-align:right;color:var(--muted);font-size:13px;font-weight:700}.calendarSpendDetails{border-bottom:1px solid var(--line);margin-bottom:4px}.calendarSpendDetails .item:last-child{border-bottom:0}';
    document.head.appendChild(style);
    renderCalendar();
  }

  globalThis.OkaneCompassCalendarSpend={dailyExpenseTotals,monthExpenseTotal};
  if(typeof document!=='undefined')bind();
})();
