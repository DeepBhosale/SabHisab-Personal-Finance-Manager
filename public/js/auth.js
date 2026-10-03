let mode = "login";

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        mode = tab.dataset.mode;
        document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === tab));
        document.querySelector(".register-only").classList.toggle("hidden", mode !== "register");
        document.getElementById("auth-submit").textContent = mode === "login" ? "Login" : "Create Account";
    });
});

document.getElementById("auth-form").addEventListener("submit", async e => {
    e.preventDefault();

    const error = document.getElementById("auth-error");
    error.textContent = "";

    try {
        const body = {
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        };

        await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
            method: "POST",
            body: JSON.stringify(body)
        });

        location.href = "/index.html";
    } catch (err) {
        error.textContent = err.message;
    }
});

api("/api/auth/me").then(() => location.href = "/index.html").catch(() => {});
