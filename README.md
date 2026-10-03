# SabHisab Full Stack

Stack:
- HTML5
- CSS3
- Vanilla JavaScript
- Node.js
- Express
- SQLite
- bcryptjs
- express-session

## Run

1. Install Node.js 18+.
2. Open this folder in VS Code.
3. Run:

   npm install

4. Start:

   npm run dev

5. Open:

   http://localhost:3000

The SQLite database is created automatically at `data/sabhisab.db`.

## Important

There is no seeded transaction, budget, goal, or account data. A new user gets only the category definitions and one empty Cash account so transactions can be created immediately.

For production:
- Use a strong SESSION_SECRET environment variable.
- Use HTTPS and `secure: true` cookies.
- Use a persistent session store instead of the default MemoryStore.
- Add CSRF protection, rate limiting, email verification and password reset.
- Validate and authorize every resource on the server.
