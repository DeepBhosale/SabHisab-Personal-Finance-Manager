(async () => {
    try {
        const user = await loadUser();
        const data = await api("/api/dashboard");

        document.querySelector("[data-income]").textContent = money(data.income, user.currency);
        document.querySelector("[data-expense]").textContent = money(data.expense, user.currency);
        document.querySelector("[data-savings]").textContent = money(data.savings, user.currency);
        document.querySelector("[data-budget-spent]").textContent = money(data.expense, user.currency);
        document.querySelector("[data-budget-total]").textContent = "/ " + money(data.budget, user.currency);

        const pct = data.budget > 0 ? Math.min(100, data.expense / data.budget * 100) : 0;
        document.querySelector("[data-budget-progress]").style.width = pct + "%";
        document.querySelector("[data-budget-message]").textContent =
            data.budget > 0 ? money(Math.max(0, data.budget - data.expense), user.currency) + " remaining" : "Set a monthly budget in Settings.";

        const list = document.querySelector("[data-recent]");
        list.innerHTML = data.recent.length ? data.recent.map(t => `
            <div class="transaction">
                <div class="transaction-icon ${t.type}">${t.type === "income" ? "↑" : "↓"}</div>
                <div class="transaction-info"><h3>${escapeHtml(t.description)}</h3><p>${escapeHtml(t.category)} · ${t.transaction_date}</p></div>
                <strong class="amount ${t.type === "income" ? "income-text" : "expense-text"}">${t.type === "income" ? "+" : "-"}${money(t.amount,user.currency)}</strong>
            </div>`).join("") : "<p class='muted'>No transactions yet.</p>";
    } catch (err) {
        console.error(err);
    }
})();
