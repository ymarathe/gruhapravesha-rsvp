const records = JSON.parse(localStorage.getItem("gruhapraveshaRsvps") || "[]");
const total = (prefix) => records.reduce((sum, r) => sum + Number(r[`${prefix}Adults`] || 0) + Number(r[`${prefix}Children`] || 0), 0);
const attending = records.filter((r) => r.attendance === "attending").length;
document.querySelector("#stats").innerHTML = [
  ["Attending households", attending], ["Ceremony guests", total("ceremony")], ["Breakfast guests", total("breakfast")], ["Lunch guests", total("lunch")]
].map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${value}</strong></article>`).join("");
document.querySelector("#responses").innerHTML = records.length ? records.map((r) => `<tr><td>${safe(r.householdName)}</td><td>${r.attendance === "attending" ? "Attending" : "Declined"}</td><td>${count(r,"ceremony")}</td><td>${count(r,"breakfast")}</td><td>${count(r,"lunch")}</td><td>${safe(r.dietaryNotes || "—")}</td></tr>`).join("") : `<tr><td colspan="6">No prototype responses yet.</td></tr>`;
function count(r, prefix) { return Number(r[`${prefix}Adults`] || 0) + Number(r[`${prefix}Children`] || 0); }
function safe(value) { const d=document.createElement("div");d.textContent=value;return d.innerHTML; }
document.querySelector("#export").addEventListener("click", () => {
  const keys=["householdName","attendance","ceremonyAdults","ceremonyChildren","breakfastAdults","breakfastChildren","lunchAdults","lunchChildren","dietaryNotes","email","phone","updatedAt"];
  const csv=[keys.join(","),...records.map(r=>keys.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="gruhapravesha-rsvps.csv";a.click();URL.revokeObjectURL(a.href);
});
