const config = window.RSVP_CONFIG || { mode: "local" };
let records = [];
const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");

const safe = (value) => {
  const node = document.createElement("div");
  node.textContent = value ?? "";
  return node.innerHTML;
};
const count = (record, prefix) => Number(record[`${prefix}Adults`] || 0) + Number(record[`${prefix}Children`] || 0);
const total = (prefix) => records.reduce((sum, record) => sum + count(record, prefix), 0);

function render() {
  const attending = records.filter((record) => record.attendance === "attending").length;
  document.querySelector("#stats").innerHTML = [
    ["Attending households", attending],
    ["Ceremony guests", total("ceremony")],
    ["Breakfast guests", total("breakfast")],
    ["Lunch guests", total("lunch")],
  ].map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${value}</strong></article>`).join("");
  document.querySelector("#responses").innerHTML = records.length
    ? records.map((record) => `<tr>
        <td>${safe(record.householdName)}</td>
        <td>${record.attendance === "attending" ? "Attending" : "Declined"}</td>
        <td>${count(record, "ceremony")}</td>
        <td>${count(record, "breakfast")}</td>
        <td>${count(record, "lunch")}</td>
        <td>${safe(record.dietaryNotes || "—")}</td>
      </tr>`).join("")
    : `<tr><td colspan="6">No responses yet.</td></tr>`;
}

async function signIn(email, password) {
  if (!config.supabaseUrl || !config.publishableKey) throw new Error("Organizer login is not configured.");
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": config.publishableKey },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error("Email or password was not accepted.");
  sessionStorage.setItem("organizerAccessToken", body.access_token);
  return body.access_token;
}

async function loadProductionRecords(token) {
  if (!config.adminFunctionUrl) throw new Error("Organizer endpoint is not configured.");
  const response = await fetch(config.adminFunctionUrl, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": config.publishableKey },
  });
  if (response.status === 401 || response.status === 403) {
    sessionStorage.removeItem("organizerAccessToken");
    showLogin();
    return;
  }
  if (!response.ok) throw new Error("The RSVP dashboard could not be loaded.");
  records = (await response.json()).records || [];
  dashboard.hidden = false;
  loginPanel.hidden = true;
  document.querySelector("#mode-note").hidden = true;
  render();
}

function showLogin(message = "") {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginError.hidden = !message;
  loginError.textContent = message;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Signing in…";
  loginError.hidden = true;
  try {
    const data = new FormData(loginForm);
    const token = await signIn(data.get("email"), data.get("password"));
    await loadProductionRecords(token);
  } catch (error) {
    showLogin(error.message || "Sign-in failed.");
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

document.querySelector("#export").addEventListener("click", () => {
  const keys = ["householdName", "attendance", "ceremonyAdults", "ceremonyChildren", "breakfastAdults", "breakfastChildren", "lunchAdults", "lunchChildren", "dietaryNotes", "email", "phone", "updatedAt"];
  const csv = [keys.join(","), ...records.map((record) => keys.map((key) => `"${String(record[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  anchor.download = "gruhapravesha-rsvps.csv";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});

async function boot() {
  if (config.mode === "local") {
    records = JSON.parse(localStorage.getItem("gruhapraveshaRsvps") || "[]");
    render();
    return;
  }
  const token = sessionStorage.getItem("organizerAccessToken");
  if (!token) return showLogin();
  try {
    await loadProductionRecords(token);
  } catch (error) {
    showLogin(error.message || "The dashboard could not be loaded.");
  }
}

boot();
