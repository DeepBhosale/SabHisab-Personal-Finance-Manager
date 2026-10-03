(async () => {
    const user = await loadUser();
    const month = new Date().toISOString().slice(0,7);
    const rows = await api(`/api/budgets?month=${month}`);

    const total = rows.reduce((s,x)=>s+x.amount,0);
    const spent = rows.reduce((s,x)=>s+x.spent,0);

    document.querySelector("[data-total-budget]").textContent = money(total,user.currency);
    document.querySelector("[data-total-spent]").textContent = money(spent,user.currency);
    document.querySelector("[data-remaining]").textContent = money(Math.max(0,total-spent),user.currency);

    document.getElementById("budget-list").innerHTML = rows.length ? rows.map(x => {
        const pct = x.amount ? Math.min(100, x.spent/x.amount*100) : 0;
        return `<article class="card budget-card">
            <div class="budget-title"><h3>${escapeHtml(x.category)}</h3><span class="muted">${pct.toFixed(0)}%</span></div>
            <div class="budget-values"><span>${money(x.spent,user.currency)} spent</span><span>${money(x.amount,user.currency)} budget</span></div>
            <div class="progress-bar"><div class="progress ${pct>=90?"warning":""}" style="width:${pct}%"></div></div>
        </article>`;
    }).join("") : "<p class='muted'>No budgets yet. Create them through the API or add a budget form next.</p>";
})();
