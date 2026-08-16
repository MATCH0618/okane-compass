'use strict';

(()=>{
  const EXPORT_FORMAT='okane-compass-household-ai';
  const EXPORT_VERSION='1.0.0';
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
    const expenses=transactions.filter(item=>item?.kind!=='income');
    const transactionIncomes=transactions.filter(item=>item?.kind==='income');
    const confirmedIncomes=[
      ...allocations.map((item,index)=>({
        id:recordId('allocation',item?.id,index),
        date:text(item?.date)||null,
        amount:numberOrNull(item?.income),
        status:STATUS.CONFIRMED,
        source:'入金振り分け履歴',
        note:text(item?.note)||null,
        withinAggregationPeriod:inPeriod(item?.date,period)
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
    data.savingsGoals.forEach(item=>add('savings_goal',item));
    data.savingsContributions.actual.forEach(item=>add('savings_contribution_actual',{...item,name:item.fundName}));
    data.futurePayments.forEach(item=>add('future_payment',item));
    data.calendarEvents.forEach(item=>add('calendar_event',item));
    data.unenteredOrUnconfirmed.forEach(item=>add('missing_or_unconfirmed',item));
    const lines=[columns.join(','),...rows.map(row=>row.map((value,index)=>csvCell(value,{numeric:[4,8].includes(index)})).join(','))];
    return `\uFEFF${lines.join('\r\n')}`;
  }

  const makeFiles=(data,stamp)=>[
    new File([JSON.stringify(data,null,2)],`okane_compass_export_${stamp}.json`,{type:'application/json;charset=utf-8'}),
    new File([toCsv(data)],`okane_compass_export_${stamp}.csv`,{type:'text/csv;charset=utf-8'})
  ];

  function download(file){
    const url=URL.createObjectURL(file),anchor=document.createElement('a');
    anchor.href=url;anchor.download=file.name;document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function shareOrDownload(data,exportedAt){
    const files=makeFiles(data,localStamp(exportedAt));
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files}))){
      try{
        await navigator.share({title:'お金コンパス 家計データ',text:'家計管理AIで確認するためのJSON・CSVです。',files});
        return'shared';
      }catch(error){
        if(error?.name==='AbortError')return'cancelled';
      }
    }
    download(files[0]);
    setTimeout(()=>download(files[1]),250);
    return'downloaded';
  }

  function confirmationText(data){
    const meta=data.metadata,updated=meta.dataUpdatedAt?new Date(meta.dataUpdatedAt).toLocaleString('ja-JP'):'未入力';
    return `家計管理AIへ共有しますか？\n\n対象期間: ${meta.aggregationPeriod.start}〜${meta.aggregationPeriod.end}\n支出: ${meta.counts.expensesInPeriod}件（全履歴 ${meta.counts.expenses}件）\n目的別資金: ${meta.counts.funds}件\n今後の支払予定: ${meta.counts.futurePayments}件\nデータ更新日時: ${updated}\n未入力・未確認: ${meta.counts.missingItems}項目\n\nJSONとCSVを作成します。アプリ内データは変更しません。`;
  }

  function bind(){
    const button=document.querySelector('#shareWithHouseholdAi');
    if(!button)return;
    button.addEventListener('click',async()=>{
      const sourceState=typeof state!=='undefined'?state:{};
      const exportedAt=new Date(),data=buildExport(sourceState,exportedAt);
      if(!confirm(confirmationText(data)))return;
      const result=await shareOrDownload(data,exportedAt);
      if(result==='shared'&&typeof toast==='function')toast('家計データを共有しました');
      if(result==='downloaded'&&typeof toast==='function')toast('JSON・CSVを書き出しました');
    });
  }

  globalThis.OkaneCompassExport={STATUS,salaryPeriod,buildExport,toCsv,confirmationText,localStamp};
  if(typeof document!=='undefined')bind();
})();
