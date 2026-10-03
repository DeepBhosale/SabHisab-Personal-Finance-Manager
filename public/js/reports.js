(async () => {
    const user = await loadUser();
    const data = await api("/api/reports");
    const max = Math.max(...data.categories.map(x=>x.amount),1);

    document.getElementById("report-categories").innerHTML = data.categories.length
        ? data.categories.map(x => `<div class="category-row"><span>${escapeHtml(x.name)}</span><div class="progress-bar"><div class="progress" style="width:${x.amount/max*100}%"></div></div><strong>${money(x.amount,user.currency)}</strong></div>`).join("")
        : "<p class='muted'>No expense data yet.</p>";

    document.getElementById("report-monthly").innerHTML = data.monthly.length
        ? data.monthly.map(x => `<div class="setting-row"><div><h3>${escapeHtml(x.month)}</h3><p>${escapeHtml(x.type)}</p></div><strong>${money(x.amount,user.currency)}</strong></div>`).join("")
        : "<p class='muted'>No report data yet.</p>";
})();
