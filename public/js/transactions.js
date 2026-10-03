let allTransactions = [];
let userCurrency = "INR";

async function loadTransactionOptions() {
    const [categories, accounts] = await Promise.all([api("/api/categories"), api("/api/accounts")]);
    const expenseCategories = categories.filter(c => c.type === "expense");
    const incomeCategories = categories.filter(c => c.type === "income");

    const categorySelect = document.getElementById("category");
    const type = document.querySelector("input[name=type]:checked").value;
    categorySelect.innerHTML = (type === "income" ? incomeCategories : expenseCategories)
        .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

    document.getElementById("account").innerHTML = accounts
        .map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");

    document.getElementById("category-filter").innerHTML =
        `<option value="">All Categories</option>` +
        categories.filter(c => c.type === "expense").map(c => `<option value="${c.name}">${escapeHtml(c.name)}</option>`).join("");
}

function renderTransactions() {
    const search = document.getElementById("search").value.toLowerCase();
    const type = document.getElementById("type-filter").value;
    const category = document.getElementById("category-filter").value;
    const sort = document.getElementById("sort-filter").value;

    let rows = allTransactions.filter(t =>
        (!search || t.description.toLowerCase().includes(search)) &&
        (!type || t.type === type) &&
        (!category || t.category === category)
    );

    rows.sort((a,b) => {
        const d = a.transaction_date.localeCompare(b.transaction_date);
        return sort === "oldest" ? d : -d;
    });

    document.querySelector("[data-count]").textContent = rows.length;
    document.querySelector("[data-income]").textContent = money(rows.filter(x=>x.type==="income").reduce((s,x)=>s+x.amount,0), userCurrency);
    document.querySelector("[data-expense]").textContent = money(rows.filter(x=>x.type==="expense").reduce((s,x)=>s+x.amount,0), userCurrency);

    document.getElementById("transaction-list").innerHTML = rows.length ? rows.map(t => `
        <tr>
            <td>${escapeHtml(t.transaction_date)}</td>
            <td>${escapeHtml(t.description)}</td>
            <td><span class="category">${escapeHtml(t.category)}</span></td>
            <td>${escapeHtml(t.account)}</td>
            <td><span class="status completed">${escapeHtml(t.status)}</span></td>
            <td class="${t.type === "income" ? "income-text" : "expense-text"}">${t.type === "income" ? "+" : "-"}${money(t.amount,userCurrency)}</td>
            <td><button class="secondary-button delete-tx" data-id="${t.id}">Delete</button></td>
        </tr>`).join("") : `<tr><td colspan="7">No transactions found.</td></tr>`;
}

(async () => {
    const user = await loadUser();
    userCurrency = user.currency;
    allTransactions = await api("/api/transactions");
    await loadTransactionOptions();
    renderTransactions();

    ["search","type-filter","category-filter","sort-filter"].forEach(id =>
        document.getElementById(id).addEventListener("input", renderTransactions)
    );

    document.querySelectorAll("input[name=type]").forEach(r => r.addEventListener("change", loadTransactionOptions));

    document.getElementById("transaction-form").addEventListener("submit", async e => {
        e.preventDefault();
        const form = new FormData(e.target);
        try {
            await api("/api/transactions", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(form.entries()))
            });
            location.hash = "";
            e.target.reset();
            allTransactions = await api("/api/transactions");
            renderTransactions();
        } catch (err) {
            document.getElementById("transaction-error").textContent = err.message;
        }
    });

    document.getElementById("transaction-list").addEventListener("click", async e => {
        const btn = e.target.closest(".delete-tx");
        if (!btn) return;
        if (!confirm("Delete this transaction?")) return;
        await api(`/api/transactions/${btn.dataset.id}`, { method: "DELETE" });
        allTransactions = await api("/api/transactions");
        renderTransactions();
    });
})();
