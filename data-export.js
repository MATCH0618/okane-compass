'use strict';

(()=>{
  const EXPORT_FORMAT='okane-compass-household-ai';
  const EXPORT_VERSION='1.1.0';
  const STATUS={CONFIRMED:'確定',PLANNED:'予定',ESTIMATED:'推測',UNCONFIRMED:'未確認'};

  const text=v=>String(v??'');
  const numberOrNull=v=>Number.isFinite(Number(v))?Number(v):null;
  const sum=list=>list.reduce((total,value)=>total+(numberOrNull(value)??0),0);
  const pad=value=>String(value).padStart(2,'0');
  const localDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const localStamp=date=>`${localDate(date)}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const validIso=value=>typeof value==='string'&&!Number.isNaN(Date.parse(value))?value:null;

  function salaryPeriod(reference){
    const year=reference.getFullYear(),month=reference.getMonth(),day=reference.getDate();
    const start=day>=25?new Date(year,month,25):new Date(year,month-1,25);
    const end=day>=25?new Date(year,month+1,24):new Date(year,month,24);
    return{start:localDate(start),end:localDate(end)};
  }

  const inPeriod=(date,period)=>typeof date==='string'&&date>=period.start&&date<=period.end;
  const recordId=(prefix,value,index)=>text(value)||`${prefix}-${index+1}`;

  function buildExport(sourceState,exportedAt=new Date()){
    const source=sourceState&&typeof sourceState==='object'?sourceState:{};
    const period=salaryPeriod(exportedAt);
    const balances=source.balances&&typeof source.balances==='object'?source.balances:{};
    const funds=Array.isArray(source.funds)?source.funds:[];
    const transactions=Array.isArray(source.transactions)?source.transactions:[];
    const allocations=Array.isArray(source.allocations)?source.allocations:[];
    const events=Array.isArray(source.calendarEvents)?source.calendarEvents:[];
    const fixedExpenses=Array.isArray(source.fixedExpenses)?source.fixedExpenses:[];
    const allocationHistory=allocations.map((allocation,index)=>({
      id:recordId('allocation',allocation?.id,index),
      date:text(allocation?.date)||null,
      income:numberOrNull(allocation?.income),
      status:STATUS.CONFIRMED,
      note:text(allocation?.note)||null,
      withinAggregationPeriod:inPeriod(allocation?.date,period),
      items:(Array.isArray(allocation?.items)?allocation.items:[]).map((item,itemIndex)=>({
        id:`${recordId('allocation',allocation?.id,index)}-${itemIndex+1}`,
        targetId:text(item?.targetId)||null,
        name:text(item?.name)||null,
        amount:numberOrNull(item?.amount),
        status:STATUS.CONFIRMED
      }))
    }));
    const expenses=transactions.filter(item=>item?.kind!=='income');
    const transactionIncomes=transactions.filter(item=>item?.kind==='income');
    const confirmedIncomes=[
      ...allocationHistory.map(item=>({
        id:item.id,
        date:item.date,
        amount:item.income,
        status:STATUS.CONFIRMED,
        source:'入金振り分け履歴',
        note:item.note,
        withinAggregationPeriod:item.withinAggregationPeriod
      })),
      ...transactionIncomes.map((item,index)=>({
        id:recordId('income-transaction',item?.id,index),
        date:text(item?.date)||null,
        amount:numberOrNull(item?.amount),
        status:STATUS.CONFIRMED,
        source:text(item?.source)||'アプリ',
        note:text(item?.memo)||null,
        withinAggregationPeriod:inPeriod(item?.date,period)
      }))
    ];
    const plannedIncomes=events.filter(item=>item?.type==='income').map((item,index)=>({
      id:recordId('planned-income',item?.id,index),
      date:text(item?.date)||null,
      amount:numberOrNull(item?.amount),
      status:STATUS.PLANNED,
      title:text(item?.title)||'入金予定',
      note:text(item?.memo)||null,
      withinAggregationPeriod:inPeriod(item?.date,period)
    }));
    const expenseRecords=expenses.map((item,index)=>({
      id:recordId('expense',item?.id,index),
      date:text(item?.date)||null,
      amount:numberOrNull(item?.amount),
      status:STATUS.CONFIRMED,
      category:text(item?.category)||null,
      fixedOrVariable:null,
      fixedOrVariableStatus:STATUS.UNCONFIRMED,
      note:text(item?.memo)||null,
      source:text(item?.source)||'アプリ',
      withinAggregationPeriod:inPeriod(item?.date,period)
    }));
    const fundRecords=funds.map((item,index)=>({
      id:recordId('fund',item?.id,index),
      name:text(item?.name)||'目的別資金',
      currentAmount:numberOrNull(item?.balance),
      currentAmountStatus:STATUS.CONFIRMED,
      targetAmount:numberOrNull(item?.target),
      targetAmountStatus:STATUS.CONFIRMED,
      deadline:text(item?.deadline)||null,
      scheduledContributionAmount:null,
      scheduledContributionStatus:STATUS.UNCONFIRMED
    }));
    const fundIds=new Set(fundRecords.map(item=>item.id));
    const actualContributions=allocations.flatMap((allocation,allocationIndex)=>(Array.isArray(allocation?.items)?allocation.items:[])
      .filter(item=>fundIds.has(text(item?.targetId)))
      .map((item,itemIndex)=>({
        id:`${recordId('allocation',allocation?.id,allocationIndex)}-${itemIndex+1}`,
        fundId:text(item?.targetId),
        fundName:text(item?.name)||null,
        date:text(allocation?.date)||null,
        amount:numberOrNull(item?.amount),
        status:STATUS.CONFIRMED
      })));
    const futurePayments=events.filter(item=>item?.type==='bill').map((item,index)=>({
      id:recordId('bill',item?.id,index),
      date:text(item?.date)||null,
      title:text(item?.title)||'支払予定',
      amount:numberOrNull(item?.amount),
      status:STATUS.PLANNED,
      note:text(item?.memo)||null
    }));
    const calendarEvents=events.map((item,index)=>({
      id:recordId('event',item?.id,index),
      date:text(item?.date)||null,
      title:text(item?.title)||'予定',
      amount:numberOrNull(item?.amount),
      type:text(item?.type)||'event',
      status:STATUS.PLANNED,
      fundId:text(item?.fundId)||null,
      note:text(item?.memo)||null,
      withinAggregationPeriod:inPeriod(item?.date,period)
    }));
    const fixedExpenseMasters=fixedExpenses.map((item,index)=>({
      id:recordId('fixed-expense',item?.id,index),
      name:text(item?.name)||'固定支出',
      amount:numberOrNull(item?.amount),
      category:text(item?.category)||null,
      status:STATUS.UNCONFIRMED,
      note:'固定支出の入力候補。実際の支払予定・実績との紐付けは未実装。'
    }));
    const balanceBuckets=[
      {id:'food',name:'食費・日用品',currentAmount:numberOrNull(balances.food)??0,status:STATUS.CONFIRMED},
      {id:'pocket',name:'お小遣い',currentAmount:numberOrNull(balances.pocket)??0,status:STATUS.CONFIRMED}
    ];
    const missingItems=[
      '銀行口座名と現在残高','クレジットカード名・利用額・締日・引落予定日・引落予定額','決済サービス名と残高または利用額',
      '支出ごとの固定費・変動費区分','目的別資金ごとの積立予定額','月次収支の正式計算値','積立可能額の正式計算値'
    ].map((name,index)=>({id:`missing-${index+1}`,name,status:STATUS.UNCONFIRMED,reason:'現行アプリに入力欄または正式な金融計算定義がありません。'}));
    const periodExpenses=expenseRecords.filter(item=>item.withinAggregationPeriod);
    const periodConfirmedIncomes=confirmedIncomes.filter(item=>item.withinAggregationPeriod);
    const allocatedTotals=allocations.map((allocation,index)=>{
      const income=numberOrNull(allocation?.income)??0;
      const allocated=sum((Array.isArray(allocation?.items)?allocation.items:[]).map(item=>item?.amount));
      return{id:recordId('allocation-check',allocation?.id,index),income,allocated,difference:income-allocated};
    });
    const availableAmount=sum(balanceBuckets.map(item=>item.currentAmount));

    return{
      exportSpecification:{format:EXPORT_FORMAT,version:EXPORT_VERSION,encoding:'UTF-8',currency:'JPY'},
      metadata:{
        exportedAt:exportedAt.toISOString(),
        dataUpdatedAt:validIso(source.updatedAt),
        referenceDate:localDate(exportedAt),
        aggregationPeriod:period,
        salaryCycle:{startDay:25,endDay:24,label:'25日〜24日'},
        sourceDataVersion:numberOrNull(source.version),
        counts:{
          balanceBuckets:balanceBuckets.length,funds:fundRecords.length,expenses:expenseRecords.length,
          expensesInPeriod:periodExpenses.length,confirmedIncomes:confirmedIncomes.length,
          allocations:allocationHistory.length,
          plannedIncomes:plannedIncomes.length,calendarEvents:calendarEvents.length,futurePayments:futurePayments.length,
          fixedExpenseMasters:fixedExpenseMasters.length,missingItems:missingItems.length
        }
      },
      balanceBuckets,
      accounts:[],
      creditCards:[],
      paymentServices:[],
      incomes:{confirmed:confirmedIncomes,planned:plannedIncomes,estimated:[],unconfirmed:[]},
      expenses:expenseRecords,
      expenseCategories:[...new Set(expenseRecords.map(item=>item.category).filter(Boolean))],
      fixedExpenseMasters,
      allocationHistory,
      savingsGoals:fundRecords,
      savingsContributions:{planned:[],actual:actualContributions},
      futurePayments,
      calendarEvents,
      unenteredOrUnconfirmed:missingItems,
      appCalculatedValues:{
        monthlyCashflow:{value:null,status:STATUS.UNCONFIRMED,reason:'現行アプリは月次収支を算出していません。'},
        availableAmount:{value:availableAmount,status:STATUS.CONFIRMED,definition:'食費・日用品残高とお小遣い残高の合計'},
        possibleSavingsAmount:{value:null,status:STATUS.UNCONFIRMED,reason:'現行アプリに正式な計算定義がありません。'}
      },
      verification:{
        periodExpenseDetailTotal:sum(periodExpenses.map(item=>item.amount)),
        storedExpenseSummaryTotal:null,
        expenseDifference:null,
        expenseDifferenceReason:'比較対象となる保存済み集計値がありません。',
        periodConfirmedIncomeRecordTotal:sum(periodConfirmedIncomes.map(item=>item.amount)),
        allocationChecks:allocatedTotals
      },
      privacy:{
        exportMethod:'許可リスト方式',
        excluded:['口座番号','クレジットカード番号','セキュリティコード','暗証番号','ログインID・パスワード','APIキー・秘密鍵','認証トークン']
      }
    };
  }

  function safeCsvText(value){
    const raw=text(value);
    return /^[=+\-@]/.test(raw)?`'${raw}`:raw;
  }

  function csvCell(value,{numeric=false}={}){
    if(value===null||value===undefined)return '';
    const raw=numeric&&Number.isFinite(Number(value))?String(Number(value)):safeCsvText(value);
    return /[",\r\n]/.test(raw)?`"${raw.replace(/"/g,'""')}"`:raw;
  }

  function toCsv(data){
    const columns=['record_type','id','date','name','amount','status','category','fixed_or_variable','target_amount','deadline','source','notes'];
    const rows=[];
    const add=(type,item={})=>rows.push([
      type,item.id,item.date,item.name??item.title,item.amount??item.currentAmount,item.status??item.currentAmountStatus,
      item.category,item.fixedOrVariable,item.targetAmount,item.deadline,item.source,item.note??item.reason
    ]);
    data.balanceBuckets.forEach(item=>add('balance_bucket',item));
    data.incomes.confirmed.forEach(item=>add('income_confirmed',item));
    data.incomes.planned.forEach(item=>add('income_planned',item));
    data.expenses.forEach(item=>add('expense',item));
    data.fixedExpenseMasters.forEach(item=>add('fixed_expense_master',item));
    data.allocationHistory.forEach(allocation=>{
      add('allocation_income',{id:allocation.id,date:allocation.date,name:'入金振り分け',amount:allocation.income,status:allocation.status,note:allocation.note});
      allocation.items.forEach(item=>add('allocation_item',{...item,date:allocation.date,source:allocation.id}));
    });
    data.savingsGoals.forEach(item=>add('savings_goal',item));
    data.savingsContributions.actual.forEach(item=>add('savings_contribution_actual',{...item,name:item.fundName}));
    data.futurePayments.forEach(item=>add('future_payment',item));
    data.calendarEvents.forEach(item=>add('calendar_event',item));
    data.unenteredOrUnconfirmed.forEach(item=>add('missing_or_unconfirmed',item));
    const lines=[columns.join(','),...rows.map(row=>row.map((value,index)=>csvCell(value,{numeric:[4,8].includes(index)})).join(','))];
    return `\uFEFF${lines.join('\r\n')}`;
  }

  function shareSummary(data){
    const meta=data.metadata,updated=meta.dataUpdatedAt?new Date(meta.dataUpdatedAt).toLocaleString('ja-JP'):'未入力';
    return `共有対象：支出全履歴 ${meta.counts.expenses}件（今期 ${meta.counts.expensesInPeriod}件）・入金 ${meta.counts.confirmedIncomes}件・振り分け ${meta.counts.allocations}件・目的別資金 ${meta.counts.funds}件・予定 ${meta.counts.calendarEvents}件｜対象期間 ${meta.aggregationPeriod.start}〜${meta.aggregationPeriod.end}｜更新 ${updated}`;
  }

  function toClipboardText(data){
    const money=value=>value===null||value===undefined?'未入力':`${Number(value).toLocaleString('ja-JP')}円`;
    const none=(items,label='なし')=>items.length?items:[label];
    const periodExpenses=data.expenses.filter(item=>item.withinAggregationPeriod);
    const periodIncome=data.incomes.confirmed.filter(item=>item.withinAggregationPeriod);
    const plannedIncome=data.incomes.planned.filter(item=>item.withinAggregationPeriod);
    const total=items=>items.reduce((sum,item)=>sum+(Number(item.amount)||0),0);
    const balances=data.balanceBuckets.map(item=>`・${item.name}：${money(item.currentAmount)}（${item.status}）`);
    const expenses=data.expenses.map(item=>`・${item.date||'日付未入力'}｜${money(item.amount)}｜${item.category||'カテゴリ未入力'}｜${item.status}｜${item.note||'メモなし'}｜対象期間：${item.withinAggregationPeriod?'今期':'期間外'}`);
    const goals=data.savingsGoals.map(item=>`・${item.name}：現在 ${money(item.currentAmount)}（${item.currentAmountStatus}）／目標 ${money(item.targetAmount)}（${item.targetAmountStatus}）／期限 ${item.deadline||'未入力'}／積立予定 ${money(item.scheduledContributionAmount)}（${item.scheduledContributionStatus}）`);
    const payments=data.futurePayments.map(item=>`・${item.date||'日付未入力'}｜${item.title}｜${money(item.amount)}（${item.status}）${item.note?`｜${item.note}`:''}`);
    const events=data.calendarEvents.filter(item=>item.type!=='bill').map(item=>`・${item.date||'日付未入力'}｜${item.title}｜${money(item.amount)}（${item.status}）${item.note?`｜${item.note}`:''}`);
    const fixed=data.fixedExpenseMasters.map(item=>`・${item.name}：${money(item.amount)}｜${item.category||'カテゴリ未入力'}（${item.status}・実績ではない入力候補）`);
    const missing=data.unenteredOrUnconfirmed.map(item=>`・${item.name}（${item.status}）：${item.reason}`);
    return [
      '【家計管理AIへの依頼】',
      '以下は「お金コンパス」に保存されている現在残高と全期間の履歴データです。内容を検算し、今期の収支、過去の支出傾向、今後の支払予定、目的別資金の進捗を分析してください。',
      '・確定、予定、推測、未確認を区別し、予定額と確定額を混同しないでください。',
      '・固定支出候補は実際の支出実績ではありません。',
      '・未入力項目は推測で補完せず、必要な確認事項として示してください。',
      '',
      '【データ基準】',
      `・基準日：${data.metadata.referenceDate}`,
      `・給与サイクル：${data.metadata.aggregationPeriod.start}〜${data.metadata.aggregationPeriod.end}（25日〜24日）`,
      `・データ更新日時：${data.metadata.dataUpdatedAt||'未入力'}`,
      '',
      '【現在残高】',
      ...balances,
      `・利用可能額：${money(data.appCalculatedValues.availableAmount.value)}（${data.appCalculatedValues.availableAmount.status}）`,
      '',
      '【今期集計】',
      `・確定支出：${money(total(periodExpenses))}（${periodExpenses.length}件）`,
      `・確定収入：${money(total(periodIncome))}（${periodIncome.length}件）`,
      `・予定収入：${money(total(plannedIncome))}（${plannedIncome.length}件）`,
      `・月次収支：${money(data.appCalculatedValues.monthlyCashflow.value)}（${data.appCalculatedValues.monthlyCashflow.status}）`,
      '',
      `【支出履歴・全期間 ${data.expenses.length}件】`,
      ...none(expenses,'・なし（0件）'),
      '',
      '【今後の支払予定】',
      ...none(payments,'・なし（0件）'),
      '',
      '【その他の予定】',
      ...none(events,'・なし（0件）'),
      '',
      '【目的別資金】',
      ...none(goals,'・なし（0件）'),
      '',
      '【固定支出の入力候補】',
      ...none(fixed,'・なし（0件）'),
      '',
      '【検算】',
      `・今期支出明細合計：${money(data.verification.periodExpenseDetailTotal)}`,
      `・保存済み集計値との差額：${money(data.verification.expenseDifference)}（${data.verification.expenseDifferenceReason}）`,
      '',
      '【未入力・未確認項目】',
      ...none(missing,'・なし')
    ].join('\n');
  }

  async function copyText(value){
    if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(value);
      return;
    }
    const area=document.createElement('textarea');
    area.value=value;
    area.setAttribute('readonly','');
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.select();
    const copied=document.execCommand('copy');
    area.remove();
    if(!copied)throw new Error('copy failed');
  }

  function bind(){
    const button=document.querySelector('#shareWithHouseholdAi');
    if(!button)return;
    const summary=document.querySelector('#householdAiShareSummary');
    const currentData=buildExport(typeof state!=='undefined'?state:{},new Date());
    if(summary)summary.textContent=shareSummary(currentData);
    button.addEventListener('click',async()=>{
      const sourceState=typeof state!=='undefined'?state:{};
      const exportedAt=new Date(),data=buildExport(sourceState,exportedAt);
      try{
        await copyText(toClipboardText(data));
        if(summary)summary.textContent=shareSummary(data);
        if(typeof toast==='function')toast(`全履歴${data.metadata.counts.expenses}件をコピーしました`);
      }catch(error){
        if(typeof toast==='function')toast('コピーできませんでした。Safariで再度お試しください');
      }
    });
  }

  globalThis.OkaneCompassExport={STATUS,salaryPeriod,buildExport,toCsv,toClipboardText,shareSummary,localStamp};
  if(typeof document!=='undefined')bind();
})();
