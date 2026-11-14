# DARK ADMIN — visitor analytics starter

A dark, neon-green visitor analytics site with a private admin dashboard.

## What it records
A visitor is recorded only after they choose **ALLOW BASIC ANALYTICS**.
The app stores:
- visit timestamp
- broad device category (desktop / mobile / tablet)
- browser family

It does **not** collect or store IP addresses, names, phone numbers, home addresses, precise location, or account credentials. Visitors can decline analytics and still use the page.

## Run locally
1. Install Node.js 20 or newer.
2. In this folder, run `npm install`.
3. Set environment variables:
   - `ADMIN_PASSWORD` — choose a strong, unique admin password.
   - `SESSION_SECRET` — use a long random secret.
4. Run `npm start`.
5. Open `http://localhost:3000` for the public page.
6. Open `http://localhost:3000/admin.html` for the admin dashboard.

## Deploy
This project includes `render.yaml` for Render.
1. Create a private GitHub repository and upload these project files.
2. In Render, create a new Blueprint from that repository.
3. Set the `ADMIN_PASSWORD` secret when prompted.
4. Deploy. Render will provide a public URL.
5. Visit `/admin.html` on that URL to sign in.

The included persistent disk keeps the SQLite database between deploys. Check the host's current pricing and free-tier limits before deploying; persistent storage may require a paid plan.

## Important
This is a starter project, not a substitute for a security review. Use HTTPS, keep dependencies updated, use a strong admin password, and do not publish secrets in your repository. Add a privacy policy appropriate to your audience and location before public launch.
