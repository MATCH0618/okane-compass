(() => {
  "use strict";

  const MAX_AMOUNT = 100000000;
  const VALID_CATEGORIES = new Set(["食費・日用品", "お小遣い"]);

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function toSafeAmount(value, { allowZero = false } = {}) {
    const amount = Number(value);
    const minimum = allowZero ? 0 : 1;
    if (!Number.isSafeInteger(amount) || amount < minimum || amount > MAX_AMOUNT) {
      return null;
    }
    return amount;
  }

  function normalizeText(value, maxLength = 120) {
    return String(value ?? "").trim().slice(0, maxLength);
  }

  function normalizeDate(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
    const parsed = new Date(`${text}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? "" : text;
  }

  function expenseFingerprint(expense) {
    return [
      normalizeDate(expense.date),
      expense.category,
      toSafeAmount(expense.amount),
      normalizeText(expense.memo).toLowerCase()
    ].join("|");
  }

  function isDuplicateExpense(expense, transactions, windowMs = 15000) {
    const fingerprint = expenseFingerprint(expense);
    const now = Date.now();
    return (Array.isArray(transactions) ? transactions : []).some(transaction => {
      if (expenseFingerprint(transaction) !== fingerprint) return false;
      const recordedAt = Number(transaction.recordedAt || transaction.createdAt || 0);
      return recordedAt > 0 && Math.abs(now - recordedAt) <= windowMs;
    });
  }

  function validateExpense(input, transactions = []) {
    if (!isPlainObject(input)) return { ok: false, error: "支出データの形式が正しくありません。" };

    const amount = toSafeAmount(input.amount);
    if (amount === null) return { ok: false, error: "金額は1円以上の整数で入力してください。" };

    const category = normalizeText(input.category, 30);
    if (!VALID_CATEGORIES.has(category)) return { ok: false, error: "支出元を選択してください。" };

    const date = normalizeDate(input.date);
    if (!date) return { ok: false, error: "日付を正しく入力してください。" };

    const expense = {
      ...input,
      amount,
      category,
      date,
      memo: normalizeText(input.memo),
      recordedAt: Number(input.recordedAt) || Date.now()
    };

    if (isDuplicateExpense(expense, transactions)) {
      return { ok: false, error: "同じ支出が続けて登録されています。内容を確認してください。", duplicate: true };
    }

    return { ok: true, value: expense };
  }

  function validateBackup(candidate) {
    if (!isPlainObject(candidate)) return { ok: false, error: "バックアップの形式が正しくありません。" };
    if (!isPlainObject(candidate.balances)) return { ok: false, error: "残高データが見つかりません。" };
    if (!Array.isArray(candidate.funds) || !Array.isArray(candidate.transactions)) {
      return { ok: false, error: "目的別資金または支出履歴の形式が正しくありません。" };
    }

    const food = toSafeAmount(candidate.balances.food, { allowZero: true });
    const pocket = toSafeAmount(candidate.balances.pocket, { allowZero: true });
    if (food === null || pocket === null) return { ok: false, error: "残高に不正な金額が含まれています。" };

    const seen = new Set();
    const transactions = [];
    for (const transaction of candidate.transactions) {
      const result = validateExpense(transaction, []);
      if (!result.ok) return { ok: false, error: `支出履歴に不正なデータがあります：${result.error}` };
      const fingerprint = expenseFingerprint(result.value);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      transactions.push(result.value);
    }

    return {
      ok: true,
      value: {
        ...candidate,
        version: "0.19",
        balances: { ...candidate.balances, food, pocket },
        transactions,
        funds: candidate.funds.map(fund => ({
          name: normalizeText(fund?.name, 40),
          balance: toSafeAmount(fund?.balance, { allowZero: true }) ?? 0,
          target: toSafeAmount(fund?.target, { allowZero: true }) ?? 0,
          deadline: normalizeDate(fund?.deadline)
        })).filter(fund => fund.name)
      }
    };
  }

  window.CompassDataSafety = Object.freeze({
    validateExpense,
    validateBackup,
    isDuplicateExpense,
    toSafeAmount
  });
})();
