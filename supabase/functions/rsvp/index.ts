import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type RsvpInput = {
  householdName?: unknown;
  attendance?: unknown;
  ceremonyAdults?: unknown;
  ceremonyChildren?: unknown;
  breakfastAdults?: unknown;
  breakfastChildren?: unknown;
  lunchAdults?: unknown;
  lunchChildren?: unknown;
  email?: unknown;
  phone?: unknown;
  dietaryNotes?: unknown;
  message?: unknown;
  editToken?: unknown;
  website?: unknown;
};

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });

function corsHeaders(origin: string | null) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function isAllowedOrigin(origin: string | null) {
  return Boolean(origin && allowedOrigins.includes(origin));
}

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const count = (value: unknown) => {
  const number = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(number) ? Math.min(20, Math.max(0, number)) : 0;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createEditToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validate(input: RsvpInput) {
  const householdName = cleanText(input.householdName, 100);
  const attendance = input.attendance === "attending" ? "attending" : input.attendance === "declined" ? "declined" : "";
  const email = cleanText(input.email, 200);
  const phone = cleanText(input.phone, 30);
  if (!householdName) throw new Error("Household name is required.");
  if (!attendance) throw new Error("Attendance selection is required.");
  if (!email && !phone) throw new Error("An email address or mobile number is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email address is invalid.");

  const values = {
    ceremonyAdults: count(input.ceremonyAdults),
    ceremonyChildren: count(input.ceremonyChildren),
    breakfastAdults: count(input.breakfastAdults),
    breakfastChildren: count(input.breakfastChildren),
    lunchAdults: count(input.lunchAdults),
    lunchChildren: count(input.lunchChildren),
  };
  if (attendance === "declined") Object.keys(values).forEach((key) => values[key as keyof typeof values] = 0);
  if (attendance === "attending" && values.ceremonyAdults + values.ceremonyChildren < 1) {
    throw new Error("At least one ceremony guest is required.");
  }

  return {
    household_name: householdName,
    attendance_status: attendance,
    ceremony_adults: values.ceremonyAdults,
    ceremony_children: values.ceremonyChildren,
    breakfast_adults: values.breakfastAdults,
    breakfast_children: values.breakfastChildren,
    lunch_adults: values.lunchAdults,
    lunch_children: values.lunchChildren,
    email: email || null,
    phone: phone || null,
    dietary_notes: cleanText(input.dietaryNotes, 500) || null,
    message: cleanText(input.message, 500) || null,
    updated_at: new Date().toISOString(),
  };
}

function toClient(record: Record<string, unknown>) {
  return {
    householdName: record.household_name,
    attendance: record.attendance_status,
    ceremonyAdults: record.ceremony_adults,
    ceremonyChildren: record.ceremony_children,
    breakfastAttending: Number(record.breakfast_adults) + Number(record.breakfast_children) > 0,
    breakfastAdults: record.breakfast_adults,
    breakfastChildren: record.breakfast_children,
    lunchAttending: Number(record.lunch_adults) + Number(record.lunch_children) > 0,
    lunchAdults: record.lunch_adults,
    lunchChildren: record.lunch_children,
    email: record.email,
    phone: record.phone,
    dietaryNotes: record.dietary_notes,
    message: record.message,
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed." }, 403, origin);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Service configuration is incomplete." }, 500, origin);

  try {
    if (request.method === "GET") {
      const token = new URL(request.url).searchParams.get("token") ?? "";
      if (token.length < 32) return json({ error: "Invalid edit token." }, 400, origin);
      const hash = await sha256(token);
      const { data, error } = await db.from("rsvps")
        .select("household_name,attendance_status,ceremony_adults,ceremony_children,breakfast_adults,breakfast_children,lunch_adults,lunch_children,email,phone,dietary_notes,message")
        .eq("edit_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "RSVP not found." }, 404, origin);
      return json(toClient(data), 200, origin);
    }

    if (request.method === "POST") {
      const input = await request.json() as RsvpInput;
      // A filled honeypot is treated as a successful no-op to avoid helping bots tune submissions.
      if (cleanText(input.website, 200)) return json({ editToken: createEditToken() }, 200, origin);
      const values = validate(input);
      const suppliedToken = cleanText(input.editToken, 128);

      if (suppliedToken) {
        const hash = await sha256(suppliedToken);
        const { data, error } = await db.from("rsvps").update(values).eq("edit_token_hash", hash).select("id").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "RSVP not found." }, 404, origin);
        return json({ editToken: suppliedToken }, 200, origin);
      }

      const editToken = createEditToken();
      const editTokenHash = await sha256(editToken);
      const { error } = await db.from("rsvps").insert({ ...values, edit_token_hash: editTokenHash });
      if (error) throw error;
      return json({ editToken }, 201, origin);
    }

    return json({ error: "Method not allowed." }, 405, origin);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && !String(error.message).includes("duplicate key")
      ? error.message
      : "We could not save your RSVP. Please try again.";
    return json({ error: message }, 400, origin);
  }
});
