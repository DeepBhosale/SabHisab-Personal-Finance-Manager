async function renderGoals() {
    const user = await loadUser();
    const goals = await api("/api/goals");
    document.getElementById("goal-list").innerHTML = goals.length ? goals.map(g => {
        const pct = Math.min(100, g.saved_amount / g.target_amount * 100);
        return `<article class="card goal-card">
            <div class="goal-header"><div><h3>${escapeHtml(g.name)}</h3><p>${g.target_date || "No target date"}</p></div><div class="goal-icon">₹</div></div>
            <div class="goal-amount"><strong>${money(g.saved_amount,user.currency)}</strong><span>${money(g.target_amount,user.currency)}</span></div>
            <div class="progress-bar"><div class="progress" style="width:${pct}%"></div></div>
            <button class="secondary-button delete-goal" data-id="${g.id}">Delete</button>
        </article>`;
    }).join("") : "<p class='muted'>No goals yet. Create your first goal.</p>";
}
(async () => {
    await renderGoals();
    document.getElementById("goal-form").addEventListener("submit", async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        await api("/api/goals",{method:"POST",body:JSON.stringify(data)});
        location.hash="";
        e.target.reset();
        await renderGoals();
    });
    document.getElementById("goal-list").addEventListener("click", async e => {
        const btn=e.target.closest(".delete-goal");
        if(!btn)return;
        await api(`/api/goals/${btn.dataset.id}`,{method:"DELETE"});
        await renderGoals();
    });
})();
