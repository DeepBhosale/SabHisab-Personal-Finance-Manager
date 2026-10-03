async function renderAccounts() {
    const user = await loadUser();
    const accounts = await api("/api/accounts");
    document.getElementById("account-list").innerHTML = accounts.length ? accounts.map(a => `
        <article class="card account-card">
            <div class="account-header"><div class="account-icon">${escapeHtml(a.name[0])}</div><div><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.type)}</p></div></div>
            <p class="muted">Current Balance</p>
            <div class="account-balance">${money(a.balance,user.currency)}</div>
            <button class="secondary-button delete-account" data-id="${a.id}">Delete</button>
        </article>`).join("") : "<p class='muted'>No accounts yet.</p>";
}
(async () => {
    await renderAccounts();
    document.getElementById("account-form").addEventListener("submit", async e => {
        e.preventDefault();
        await api("/api/accounts",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});
        location.hash="";
        e.target.reset();
        await renderAccounts();
    });
    document.getElementById("account-list").addEventListener("click", async e => {
        const btn=e.target.closest(".delete-account");
        if(!btn)return;
        if(!confirm("Delete this account?"))return;
        try { await api(`/api/accounts/${btn.dataset.id}`,{method:"DELETE"}); await renderAccounts(); }
        catch(err){ alert(err.message); }
    });
})();
