const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const fs = require("fs");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, "sabhisab.db"));
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    monthly_budget REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name, type)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    description TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    transaction_date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    month TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL CHECK(target_amount > 0),
    saved_amount REAL NOT NULL DEFAULT 0 CHECK(saved_amount >= 0),
    target_date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Authentication required" });
    }
    next();
}

function currentUser(req) {
    return db.prepare("SELECT id, name, email, currency, monthly_budget FROM users WHERE id = ?")
        .get(req.session.userId);
}

function seedUserDefaults(userId) {
    const categories = [
        ["Salary", "income"], ["Food", "expense"], ["Housing", "expense"],
        ["Transport", "expense"], ["Entertainment", "expense"], ["Shopping", "expense"],
        ["Bills", "expense"], ["Investment", "expense"]
    ];
    const addCategory = db.prepare("INSERT OR IGNORE INTO categories (user_id,name,type) VALUES (?,?,?)");
    const addAccount = db.prepare("INSERT INTO accounts (user_id,name,type,balance) VALUES (?,?,?,0)");
    const tx = db.transaction(() => {
        for (const c of categories) addCategory.run(userId, ...c);
        addAccount.run(userId, "Cash", "cash");
    });
    tx();
}

app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
        return res.status(400).json({ error: "Name, email and an 8+ character password are required." });
    }

    try {
        const hash = await bcrypt.hash(password, 12);
        const result = db.prepare(
            "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)"
        ).run(name.trim(), email.trim().toLowerCase(), hash);

        seedUserDefaults(result.lastInsertRowid);
        req.session.userId = result.lastInsertRowid;
        res.status(201).json({ user: currentUser(req) });
    } catch (err) {
        if (String(err.message).includes("UNIQUE")) {
            return res.status(409).json({ error: "An account with that email already exists." });
        }
        res.status(500).json({ error: "Registration failed." });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?")
        .get((email || "").trim().toLowerCase());

    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.userId = user.id;
    res.json({ user: currentUser(req) });
});

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", auth, (req, res) => {
    res.json({ user: currentUser(req) });
});

app.get("/api/categories", auth, (req, res) => {
    res.json(db.prepare("SELECT id,name,type FROM categories WHERE user_id=? ORDER BY type,name")
        .all(req.session.userId));
});

app.get("/api/accounts", auth, (req, res) => {
    res.json(db.prepare("SELECT id,name,type,balance FROM accounts WHERE user_id=? ORDER BY name")
        .all(req.session.userId));
});

app.post("/api/accounts", auth, (req, res) => {
    const { name, type, balance = 0 } = req.body;
    if (!name || !type) return res.status(400).json({ error: "Name and type are required." });

    const result = db.prepare(
        "INSERT INTO accounts (user_id,name,type,balance) VALUES (?,?,?,?)"
    ).run(req.session.userId, name.trim(), type, Number(balance) || 0);

    res.status(201).json(
        db.prepare("SELECT id,name,type,balance FROM accounts WHERE id=?").get(result.lastInsertRowid)
    );
});

app.delete("/api/accounts/:id", auth, (req, res) => {
    try {
        db.prepare("DELETE FROM accounts WHERE id=? AND user_id=?")
            .run(req.params.id, req.session.userId);
        res.json({ ok: true });
    } catch {
        res.status(400).json({ error: "Account cannot be deleted while it has transactions." });
    }
});

app.get("/api/transactions", auth, (req, res) => {
    const rows = db.prepare(`
        SELECT t.id,t.description,t.amount,t.type,t.transaction_date,t.notes,t.status,
               a.name AS account, c.name AS category
        FROM transactions t
        JOIN accounts a ON a.id=t.account_id
        JOIN categories c ON c.id=t.category_id
        WHERE t.user_id=?
        ORDER BY t.transaction_date DESC,t.id DESC
    `).all(req.session.userId);
    res.json(rows);
});

app.post("/api/transactions", auth, (req, res) => {
    const { type, description, amount, category_id, account_id, transaction_date, notes = "" } = req.body;
    if (!type || !description || !amount || !category_id || !account_id || !transaction_date) {
        return res.status(400).json({ error: "All required transaction fields must be provided." });
    }

    const userId = req.session.userId;
    const category = db.prepare("SELECT * FROM categories WHERE id=? AND user_id=?")
        .get(category_id, userId);
    const account = db.prepare("SELECT * FROM accounts WHERE id=? AND user_id=?")
        .get(account_id, userId);

    if (!category || !account) return res.status(400).json({ error: "Invalid category or account." });
    if (category.type !== type) return res.status(400).json({ error: "Category type does not match transaction type." });

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: "Amount must be greater than zero." });

    const tx = db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO transactions
            (user_id,account_id,category_id,type,description,amount,transaction_date,notes)
            VALUES (?,?,?,?,?,?,?,?)
        `).run(userId, account_id, category_id, type, description.trim(), value, transaction_date, notes);

        const delta = type === "income" ? value : -value;
        db.prepare("UPDATE accounts SET balance=balance+? WHERE id=? AND user_id=?")
            .run(delta, account_id, userId);

        return result.lastInsertRowid;
    });

    const id = tx();
    res.status(201).json({ id });
});

app.delete("/api/transactions/:id", auth, (req, res) => {
    const userId = req.session.userId;
    const row = db.prepare(`
        SELECT * FROM transactions WHERE id=? AND user_id=?
    `).get(req.params.id, userId);

    if (!row) return res.status(404).json({ error: "Transaction not found." });

    const tx = db.transaction(() => {
        const delta = row.type === "income" ? -row.amount : row.amount;
        db.prepare("UPDATE accounts SET balance=balance+? WHERE id=? AND user_id=?")
            .run(delta, row.account_id, userId);
        db.prepare("DELETE FROM transactions WHERE id=? AND user_id=?")
            .run(row.id, userId);
    });

    tx();
    res.json({ ok: true });
});

app.get("/api/dashboard", auth, (req, res) => {
    const userId = req.session.userId;
    const income = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE user_id=? AND type='income'")
        .get(userId).total;
    const expense = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE user_id=? AND type='expense'")
        .get(userId).total;
    const budget = currentUser(req).monthly_budget;

    const recent = db.prepare(`
        SELECT t.id,t.description,t.amount,t.type,t.transaction_date,c.name category,a.name account
        FROM transactions t
        JOIN categories c ON c.id=t.category_id
        JOIN accounts a ON a.id=t.account_id
        WHERE t.user_id=?
        ORDER BY t.transaction_date DESC,t.id DESC LIMIT 5
    `).all(userId);

    res.json({
        income,
        expense,
        savings: income - expense,
        budget,
        recent
    });
});

app.get("/api/budgets", auth, (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const rows = db.prepare(`
        SELECT b.id,b.amount,b.month,c.id category_id,c.name category,
               COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) spent
        FROM budgets b
        JOIN categories c ON c.id=b.category_id
        LEFT JOIN transactions t
          ON t.category_id=b.category_id
         AND t.user_id=b.user_id
         AND substr(t.transaction_date,1,7)=b.month
        WHERE b.user_id=? AND b.month=?
        GROUP BY b.id
        ORDER BY c.name
    `).all(req.session.userId, month);
    res.json(rows);
});

app.post("/api/budgets", auth, (req, res) => {
    const { category_id, amount, month } = req.body;
    if (!category_id || !amount || !month) return res.status(400).json({ error: "All fields are required." });

    db.prepare(`
        INSERT INTO budgets (user_id,category_id,amount,month)
        VALUES (?,?,?,?)
        ON CONFLICT(user_id,category_id,month)
        DO UPDATE SET amount=excluded.amount
    `).run(req.session.userId, category_id, Number(amount), month);

    res.json({ ok: true });
});

app.get("/api/goals", auth, (req, res) => {
    res.json(db.prepare(`
        SELECT id,name,target_amount,saved_amount,target_date
        FROM goals WHERE user_id=? ORDER BY target_date
    `).all(req.session.userId));
});

app.post("/api/goals", auth, (req, res) => {
    const { name, target_amount, saved_amount = 0, target_date = null } = req.body;
    if (!name || !target_amount) return res.status(400).json({ error: "Name and target amount are required." });

    const result = db.prepare(`
        INSERT INTO goals (user_id,name,target_amount,saved_amount,target_date)
        VALUES (?,?,?,?,?)
    `).run(req.session.userId, name.trim(), Number(target_amount), Number(saved_amount) || 0, target_date || null);

    res.status(201).json({ id: result.lastInsertRowid });
});

app.put("/api/goals/:id", auth, (req, res) => {
    const { name, target_amount, saved_amount, target_date } = req.body;
    db.prepare(`
        UPDATE goals
        SET name=?,target_amount=?,saved_amount=?,target_date=?
        WHERE id=? AND user_id=?
    `).run(name, Number(target_amount), Number(saved_amount), target_date || null, req.params.id, req.session.userId);
    res.json({ ok: true });
});

app.delete("/api/goals/:id", auth, (req, res) => {
    db.prepare("DELETE FROM goals WHERE id=? AND user_id=?")
        .run(req.params.id, req.session.userId);
    res.json({ ok: true });
});

app.get("/api/reports", auth, (req, res) => {
    const userId = req.session.userId;
    const categories = db.prepare(`
        SELECT c.name,
               COALESCE(SUM(t.amount),0) amount
        FROM categories c
        LEFT JOIN transactions t
          ON t.category_id=c.id AND t.user_id=? AND t.type='expense'
        WHERE c.user_id=? AND c.type='expense'
        GROUP BY c.id
        ORDER BY amount DESC
    `).all(userId, userId);

    const monthly = db.prepare(`
        SELECT substr(transaction_date,1,7) month,type,SUM(amount) amount
        FROM transactions
        WHERE user_id=?
        GROUP BY month,type
        ORDER BY month DESC
        LIMIT 12
    `).all(userId);

    res.json({ categories, monthly });
});

app.put("/api/settings", auth, (req, res) => {
    const { name, currency, monthly_budget } = req.body;
    db.prepare(`
        UPDATE users SET name=?,currency=?,monthly_budget=?
        WHERE id=?
    `).run(name.trim(), currency, Number(monthly_budget) || 0, req.session.userId);

    res.json({ user: currentUser(req) });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => {
    console.log(`SabHisab running at http://localhost:${PORT}`);
});
