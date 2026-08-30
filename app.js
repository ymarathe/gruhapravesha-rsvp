const form = document.querySelector("#rsvp-form");
const steps = [...document.querySelectorAll(".form-step")];
const nextButton = document.querySelector("#next-button");
const backButton = document.querySelector("#back-button");
const submitButton = document.querySelector("#submit-button");
const errorBox = document.querySelector("#form-error");
const confirmation = document.querySelector("#confirmation");
const welcomeScreen = document.querySelector("#welcome-screen");
const invitationScreen = document.querySelector("#invitation-screen");
const rsvpScreen = document.querySelector("#rsvp-screen");
const stepLabel = document.querySelector("#step-label");
const progressBar = document.querySelector("#progress-bar");
const title = document.querySelector("#form-title");
const intro = document.querySelector("#form-intro");
let currentStep = 1;
let currentToken = new URLSearchParams(location.search).get("edit");

function showScreen(screen) {
  welcomeScreen.hidden = screen !== "welcome";
  invitationScreen.hidden = screen !== "invitation";
  rsvpScreen.hidden = screen !== "rsvp";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const asNumber = (value) => Math.max(0, Number.parseInt(value || "0", 10) || 0);
const valueOf = (name) => new FormData(form).get(name)?.toString().trim() || "";
const partyText = (adults, children) => {
  const parts = [];
  if (adults) parts.push(`${adults} ${adults === 1 ? "adult" : "adults"}`);
  if (children) parts.push(`${children} ${children === 1 ? "child" : "children"}`);
  return parts.join(" · ") || "Not attending";
};

function collectData() {
  const data = Object.fromEntries(new FormData(form));
  const numeric = ["ceremonyAdults", "ceremonyChildren", "breakfastAdults", "breakfastChildren", "lunchAdults", "lunchChildren"];
  numeric.forEach((key) => { data[key] = asNumber(data[key]); });
  data.breakfastAttending = data.breakfastAttending === "yes";
  data.lunchAttending = data.lunchAttending === "yes";
  if (data.attendance === "declined") {
    numeric.forEach((key) => { data[key] = 0; });
    data.breakfastAttending = false;
    data.lunchAttending = false;
  }
  return data;
}

function validateStep(step) {
  errorBox.hidden = true;
  if (step === 1) {
    const household = form.elements.householdName;
    const attendance = valueOf("attendance");
    const email = valueOf("email");
    const phone = valueOf("phone");
    if (!household.value.trim()) return showError("Please enter your household or family name.", household);
    if (!attendance) return showError("Please tell us whether you will attend.");
    if (!email && !phone) return showError("Please provide either an email address or a mobile number.", form.elements.email);
    if (email && !form.elements.email.checkValidity()) return showError("Please enter a valid email address.", form.elements.email);
  }
  if (step === 2) {
    const total = asNumber(form.elements.ceremonyAdults.value) + asNumber(form.elements.ceremonyChildren.value);
    if (total < 1) return showError("Please enter at least one ceremony guest.", form.elements.ceremonyAdults);
  }
  if (step === 3) {
    for (const meal of ["breakfast", "lunch"]) {
      if (valueOf(`${meal}Attending`) === "yes") {
        const total = asNumber(form.elements[`${meal}Adults`].value) + asNumber(form.elements[`${meal}Children`].value);
        if (total < 1) return showError(`Please enter at least one guest for ${meal}.`, form.elements[`${meal}Adults`]);
      }
    }
  }
  return true;
}

function showError(message, field) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  field?.focus();
  return false;
}

function renderStep() {
  steps.forEach((step) => { step.hidden = Number(step.dataset.step) !== currentStep; });
  const isDeclined = valueOf("attendance") === "declined";
  const labels = {
    1: ["Tell us about your household", "Please provide one response for your household."],
    2: ["Who will join us?", "Help us prepare a warm welcome for everyone."],
    3: ["Reserve your meals", "Breakfast and lunch are counted separately."],
    4: ["Almost finished", "Review your response before submitting."]
  };
  title.textContent = labels[currentStep][0];
  intro.textContent = labels[currentStep][1];
  stepLabel.textContent = `Step ${currentStep} of 4`;
  progressBar.style.width = `${currentStep * 25}%`;
  backButton.hidden = currentStep === 1;
  nextButton.hidden = currentStep === 4;
  submitButton.hidden = currentStep !== 4;
  if (currentStep === 4) renderReview(isDeclined);
  errorBox.hidden = true;
  document.querySelector(".rsvp-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReview() {
  const d = collectData();
  const rows = [
    ["Household", d.householdName],
    ["Attendance", d.attendance === "attending" ? "Joyfully attending" : "Unable to attend"]
  ];
  if (d.attendance === "attending") {
    rows.push(
      ["Ceremonies", partyText(d.ceremonyAdults, d.ceremonyChildren)],
      ["Breakfast", partyText(d.breakfastAdults, d.breakfastChildren)],
      ["Lunch", partyText(d.lunchAdults, d.lunchChildren)]
    );
  }
  document.querySelector("#review-summary").innerHTML = rows.map(([label, val]) =>
    `<div class="review-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(val)}</strong></div>`
  ).join("");
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value ?? "";
  return node.innerHTML;
}

function toggleMeal(meal) {
  const attending = valueOf(`${meal}Attending`) === "yes";
  const counts = document.querySelector(`[data-meal="${meal}"]`);
  counts.hidden = !attending;
  if (attending && asNumber(form.elements[`${meal}Adults`].value) + asNumber(form.elements[`${meal}Children`].value) === 0) {
    form.elements[`${meal}Adults`].value = form.elements.ceremonyAdults.value || 1;
    form.elements[`${meal}Children`].value = form.elements.ceremonyChildren.value || 0;
  }
  if (!attending) {
    form.elements[`${meal}Adults`].value = 0;
    form.elements[`${meal}Children`].value = 0;
  }
}

async function saveRsvp(data) {
  const config = window.RSVP_CONFIG || { mode: "local" };
  if (config.mode === "supabase") {
    const response = await fetch(config.functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": config.publishableKey },
      body: JSON.stringify({ ...data, editToken: currentToken })
    });
    if (!response.ok) throw new Error("We could not save your RSVP. Please try again.");
    return response.json();
  }
  const records = JSON.parse(localStorage.getItem("gruhapraveshaRsvps") || "[]");
  const token = currentToken || crypto.randomUUID();
  const index = records.findIndex((record) => record.editToken === token);
  const record = { ...data, id: index >= 0 ? records[index].id : crypto.randomUUID(), editToken: token, updatedAt: new Date().toISOString() };
  if (index >= 0) records[index] = record; else records.push({ ...record, submittedAt: record.updatedAt });
  localStorage.setItem("gruhapraveshaRsvps", JSON.stringify(records));
  return { editToken: token };
}

async function loadRemoteEdit() {
  const config = window.RSVP_CONFIG || { mode: "local" };
  if (!currentToken || config.mode !== "supabase" || !config.functionUrl) return;
  const response = await fetch(`${config.functionUrl}?token=${encodeURIComponent(currentToken)}`, {
    headers: { "apikey": config.publishableKey },
  });
  if (!response.ok) throw new Error("This edit link is invalid or has expired.");
  const record = await response.json();
  hydrateForm(record);
}

function renderConfirmation(data) {
  form.hidden = true;
  document.querySelector(".card-heading").hidden = true;
  document.querySelector(".progress").hidden = true;
  confirmation.hidden = false;
  document.querySelector("#confirmation-title").textContent = `Thank you, ${data.householdName}!`;
  const text = data.attendance === "attending"
    ? `<p>We are delighted to celebrate with you.</p><div class="review-summary confirmation-summary">
        <div class="review-row"><span>Ceremonies</span><strong>${escapeHtml(partyText(data.ceremonyAdults, data.ceremonyChildren))}</strong></div>
        <div class="review-row"><span>Breakfast</span><strong>${escapeHtml(partyText(data.breakfastAdults, data.breakfastChildren))}</strong></div>
        <div class="review-row"><span>Lunch</span><strong>${escapeHtml(partyText(data.lunchAdults, data.lunchChildren))}</strong></div>
      </div>`
    : "<p>Thank you for letting us know. You will be with us in spirit.</p>";
  document.querySelector("#confirmation-summary").innerHTML = text;
}

function loadLocalEdit() {
  if (!currentToken || window.RSVP_CONFIG?.mode !== "local") return;
  const records = JSON.parse(localStorage.getItem("gruhapraveshaRsvps") || "[]");
  const record = records.find((item) => item.editToken === currentToken);
  if (!record) return;
  hydrateForm(record);
}

function hydrateForm(record) {
  Object.entries(record).forEach(([key, value]) => {
    const input = form.elements[key];
    if (!input) return;
    if (input instanceof RadioNodeList) {
      input.value = typeof value === "boolean" ? (value ? "yes" : "no") : value;
    } else input.value = value;
  });
  toggleMeal("breakfast");
  toggleMeal("lunch");
}

nextButton.addEventListener("click", () => {
  if (!validateStep(currentStep)) return;
  if (currentStep === 1 && valueOf("attendance") === "declined") currentStep = 4;
  else currentStep += 1;
  renderStep();
});
backButton.addEventListener("click", () => {
  if (currentStep === 4 && valueOf("attendance") === "declined") currentStep = 1;
  else currentStep -= 1;
  renderStep();
});
["breakfast", "lunch"].forEach((meal) => {
  form.elements[`${meal}Attending`].forEach((input) => input.addEventListener("change", () => toggleMeal(meal)));
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Saving…";
  try {
    const data = collectData();
    const result = await saveRsvp(data);
    currentToken = result.editToken;
    history.replaceState({}, "", `${location.pathname}?edit=${encodeURIComponent(currentToken)}`);
    renderConfirmation(data);
  } catch (error) {
    showError(error.message || "Something went wrong. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit RSVP";
  }
});
document.querySelector("#edit-button").addEventListener("click", () => {
  confirmation.hidden = true;
  form.hidden = false;
  document.querySelector(".card-heading").hidden = false;
  document.querySelector(".progress").hidden = false;
  currentStep = 1;
  renderStep();
});

document.querySelector("#open-invitation").addEventListener("click", () => showScreen("invitation"));
document.querySelector("#back-to-welcome").addEventListener("click", () => showScreen("welcome"));
document.querySelector("#start-rsvp").addEventListener("click", () => {
  showScreen("rsvp");
  currentStep = 1;
  renderStep();
});
document.querySelector("#back-to-invitation").addEventListener("click", () => showScreen("invitation"));

async function boot() {
  try {
    if (window.RSVP_CONFIG?.mode === "supabase") await loadRemoteEdit();
    else loadLocalEdit();
  } catch (error) {
    showError(error.message || "We could not load this RSVP.");
  }
  showScreen(currentToken ? "rsvp" : "welcome");
  renderStep();
}

boot();
