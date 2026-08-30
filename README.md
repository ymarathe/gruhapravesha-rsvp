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
3. Add a server-side RSVP Edge Function that validates payloads, hashes edit tokens, and inserts or updates records.
4. Add organizer authentication and a read policy restricted to the organizer account.
5. Change `config.js` to `mode: "supabase"` and set `functionUrl`.
6. Add rate limiting and a bot-protection challenge before public launch.

## Still intentionally undecided

- Final arch, mandala, or blended visual treatment
- Host/family names
- Breakfast and lunch serving times
- RSVP deadline
- Confirmation email delivery

The form and database model do not depend on those decisions.
