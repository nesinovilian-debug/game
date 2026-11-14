
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Console // DARK ADMIN</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/">DARK<span>ADMIN</span></a>
    <span class="eyebrow">PRIVATE CONSOLE</span>
  </header>

  <main class="dashboard">
    <section id="loginPanel" class="panel login">
      <div class="eyebrow">● AUTHENTICATION REQUIRED</div>
      <h1>ADMIN LOGIN<span>.</span></h1>
      <form id="loginForm">
        <label for="password">Admin password</label>
        <input id="password" type="password"
          autocomplete="current-password" required>
        <button type="submit">SIGN IN</button>
        <p id="loginError" class="error" aria-live="polite"></p>
      </form>
    </section>

    <section id="dashPanel" hidden>
      <div class="dash-head">
        <div>
          <div class="eyebrow">● ACCESS GRANTED</div>
          <h1>OVERVIEW<span>.</span></h1>
        </div>
        <button id="logout" class="secondary">LOG OUT</button>
      </div>

      <div class="stats">
        <article class="panel">
          <div class="muted">TOTAL OPT-IN VISITS</div>
          <strong id="total">—</strong>
        </article>
        <article class="panel">
          <div class="muted">OPT-IN VISITS TODAY</div>
          <strong id="today">—</strong>
        </article>
        <article class="panel">
          <div class="muted">REGISTERED ACCOUNTS</div>
          <strong id="accountTotal">—</strong>
        </article>
      </div>

      <section class="panel">
        <div class="table-head">
          <h2>REGISTERED ACCOUNTS</h2>
          <button id="refreshAccounts" class="secondary">
            REFRESH
          </button>
        </div>
        <p class="muted small">
          Accounts created through the website registration form.
          Passwords are never displayed.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>CREATED</th>
              </tr>
            </thead>
            <tbody id="accountRows">
              <tr><td colspan="3">Loading accounts...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="table-head">
          <h2>RECENT VISITS</h2>
          <button id="refresh" class="secondary">REFRESH</button>
        </div>
        <p class="muted small">
          Only visits where the visitor allowed basic analytics
          appear here.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TIME</th>
                <th>DEVICE</th>
                <th>BROWSER</th>
              </tr>
            </thead>
            <tbody id="rows">
              <tr><td colspan="3">Loading visits...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p id="dashboardError" class="error" aria-live="polite"></p>
    </section>
  </main>

  <script>
    const loginPanel = document.getElementById("loginPanel");
    const dashPanel = document.getElementById("dashPanel");
    const rows = document.getElementById("rows");
    const accountRows = document.getElementById("accountRows");

    const fmt = value => value
      ? new Date(value).toLocaleString()
      : "Not provided";

    async function loadStats() {
      const error = document.getElementById("dashboardError");
      error.textContent = "";

      try {
        const response = await fetch("/api/admin/stats");

        if (response.status === 401) {
          loginPanel.hidden = false;
          dashPanel.hidden = true;
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load dashboard information.");
        }

        const data = await response.json();

        loginPanel.hidden = true;
        dashPanel.hidden = false;

        document.getElementById("total").textContent =
          data.total ?? 0;

        document.getElementById("today").textContent =
          data.today ?? 0;

        const accounts = Array.isArray(data.accounts)
          ? data.accounts
          : [];

        document.getElementById("accountTotal").textContent =
          accounts.length;

        accountRows.replaceChildren();

        if (accounts.length === 0) {
          accountRows.innerHTML =
            '<tr><td colspan="3">No registered accounts found.</td></tr>';
        } else {
          for (const account of accounts) {
            const tr = document.createElement("tr");

            for (const value of [
              account.email || "Not provided",
              account.phone || "Not provided",
              fmt(account.created_at)
            ]) {
              const td = document.createElement("td");
              td.textContent = value;
              tr.appendChild(td);
            }

            accountRows.appendChild(tr);
          }
        }

        rows.replaceChildren();

        const visits = Array.isArray(data.visits)
          ? data.visits
          : [];

        if (visits.length === 0) {
          rows.innerHTML =
            '<tr><td colspan="3">No opted-in visits yet.</td></tr>';
        } else {
          for (const visit of visits) {
            const tr = document.createElement("tr");

            for (const value of [
              fmt(visit.visited_at),
              visit.device || "Unknown",
              visit.browser || "Unknown"
            ]) {
              const td = document.createElement("td");
              td.textContent = value;
              tr.appendChild(td);
            }

            rows.appendChild(tr);
          }
        }
      } catch (err) {
        error.textContent = err.message;
      }
    }

    document.getElementById("loginForm")
      .addEventListener("submit", async event => {
        event.preventDefault();

        const error = document.getElementById("loginError");
        error.textContent = "";

        try {
          const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              password: document.getElementById("password").value
            })
          });

          if (!response.ok) {
            error.textContent = "Login failed. Check your password.";
            return;
          }

          await loadStats();
        } catch {
          error.textContent = "Could not connect to the server.";
        }
      });

    document.getElementById("refresh")
      .addEventListener("click", loadStats);

    document.getElementById("refreshAccounts")
      .addEventListener("click", loadStats);

    document.getElementById("logout")
      .addEventListener("click", async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        dashPanel.hidden = true;
        loginPanel.hidden = false;
        document.getElementById("password").value = "";
      });

    fetch("/api/admin/check")
      .then(response => response.json())
      .then(data => {
        if (data.authenticated) loadStats();
      })
      .catch(() => {
        document.getElementById("loginError").textContent =
          "Could not connect to the server.";
      });
  </script>
</body>
</html>
