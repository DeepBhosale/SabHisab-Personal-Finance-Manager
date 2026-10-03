async function api(url, options = {}) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    });

    if (res.status === 401) {
        if (!location.pathname.endsWith("login.html")) location.href = "/login.html";
        throw new Error("Authentication required");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

function money(value, currency = "INR") {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
}

async function loadUser() {
    const { user } = await api("/api/auth/me");
    document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = user.name);
    document.querySelectorAll("[data-user-initials]").forEach(el => {
        el.textContent = user.name.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase();
    });
    return user;
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!location.pathname.endsWith("login.html")) {
        try { await loadUser(); } catch {}
    }

    document.querySelectorAll(".modal-backdrop").forEach(el => {
        el.addEventListener("click", () => location.hash = "");
    });
});
