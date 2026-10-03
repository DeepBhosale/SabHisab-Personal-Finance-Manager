(async () => {
    const user = await loadUser();
    const form = document.getElementById("settings-form");
    form.name.value = user.name;
    form.email.value = user.email;
    form.currency.value = user.currency;
    form.monthly_budget.value = user.monthly_budget;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const result = await api("/api/settings",{method:"PUT",body:JSON.stringify(data)});
        form.name.value = result.user.name;
        form.monthly_budget.value = result.user.monthly_budget;
        document.getElementById("settings-message").textContent = "Settings saved.";
    });
})();
