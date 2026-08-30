# Gruhapravesha RSVP

Style-independent RSVP prototype for the September 12, 2026 Gruhapravesha celebration.

## What works in the prototype

- Conditional attending/declining flow
- Separate ceremony, breakfast, and lunch adult/child counts
- Dietary notes and host message
- Review-before-submit screen
- Confirmation summary and local edit link
- Local organizer totals and CSV export at `admin.html`
- Responsive, accessible form structure
- Theme tokens isolated at the top of `styles.css`

## Prototype data

`config.js` currently uses `mode: "local"`. Responses are stored only in the current browser's `localStorage`; this is intentional for reviewing the flow before backend credentials exist.

## Production connection

1. Create the Supabase project.
2. Apply `supabase/schema.sql`.
3. Replace the placeholder `project_id` in `supabase/config.toml` with the project reference.
4. Set the function secret `ALLOWED_ORIGINS=https://ymarathe.github.io`.
5. Deploy `supabase/functions/rsvp` with JWT verification disabled; the function performs its own origin and edit-token checks.
6. Change `config.js` to `mode: "supabase"` and set `functionUrl`.
7. Deploy `supabase/functions/admin-rsvps`.
8. Create one Supabase Auth user for the organizer, then insert that user's UUID into `public.organizers` using the SQL example in `schema.sql`.
9. Put the project URL, publishable key, and admin function URL into `config.js`.
10. Add rate limiting or a bot-protection challenge before public launch.

The Edge Function is already implemented. It validates all submitted fields, enforces guest-count limits, hashes private edit tokens before storage, supports authenticated-by-token edits, rejects unapproved browser origins, and keeps the service-role credential server-side.

The organizer endpoint verifies the Supabase Auth access token server-side and checks membership in the private `organizers` table before returning RSVP data. The committed publishable key can never read the RSVP tables directly.

## GitHub Pages readiness

- `.nojekyll` prevents unwanted Jekyll processing.
- `robots.txt` and the `noindex` meta tag request that search engines not index the invitation. This is not access control; the published URL is still public.
- All site asset links are relative, so the site works under `/gruhapravesha-rsvp/`.
- Do not enable Pages until `config.js` points to a deployed function and the organizer page is either secured or excluded from publication.

## Still intentionally undecided

- Final arch, mandala, or blended visual treatment
- Host/family names
- Breakfast and lunch serving times
- RSVP deadline
- Confirmation email delivery

The form and database model do not depend on those decisions.
