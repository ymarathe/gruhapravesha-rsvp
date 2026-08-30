import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

function headers(origin: string | null) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
const respond = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: headers(origin) });

const toClient = (record: Record<string, unknown>) => ({
  id: record.id,
  householdName: record.household_name,
  attendance: record.attendance_status,
  ceremonyAdults: record.ceremony_adults,
  ceremonyChildren: record.ceremony_children,
  breakfastAdults: record.breakfast_adults,
  breakfastChildren: record.breakfast_children,
  lunchAdults: record.lunch_adults,
  lunchChildren: record.lunch_children,
  email: record.email,
  phone: record.phone,
  dietaryNotes: record.dietary_notes,
  message: record.message,
  submittedAt: record.submitted_at,
  updatedAt: record.updated_at,
});

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins.includes(origin)) return respond({ error: "Origin not allowed." }, 403, origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "GET") return respond({ error: "Method not allowed." }, 405, origin);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return respond({ error: "Authentication required." }, 401, origin);

  const { data: userResult, error: userError } = await db.auth.getUser(token);
  if (userError || !userResult.user) return respond({ error: "Invalid session." }, 401, origin);
  const { data: organizer, error: organizerError } = await db.from("organizers").select("user_id").eq("user_id", userResult.user.id).maybeSingle();
  if (organizerError) return respond({ error: "Authorization check failed." }, 500, origin);
  if (!organizer) return respond({ error: "Organizer access required." }, 403, origin);

  const { data, error } = await db.from("rsvps")
    .select("id,household_name,attendance_status,ceremony_adults,ceremony_children,breakfast_adults,breakfast_children,lunch_adults,lunch_children,email,phone,dietary_notes,message,submitted_at,updated_at")
    .order("submitted_at", { ascending: false });
  if (error) return respond({ error: "Responses could not be loaded." }, 500, origin);
  return respond({ records: (data ?? []).map(toClient) }, 200, origin);
});
