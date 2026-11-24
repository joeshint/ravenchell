# Testing & QA checklist

Two layers: **automated checks** that run anywhere (no Supabase project needed), and a
**manual checklist** to run once against a real Supabase project before a demo or deployment.

---

## 1. Automated checks

```bash
npm test            # = test:db + test:contract
npm run lint
npm run build
```

| Command | What it proves | Result |
|---|---|---|
| `npm run test:db` | Applies all 7 migrations to an in-memory Postgres (PGlite + Supabase stub) and runs `supabase/tests/rls_test.sql`: **112 checks** on roles, RLS, column grants, status transitions, notifications, audit log, storage policies and settings. | ✅ 112/112 |
| `npm run test:contract` | Calls every frontend service function (71) with Supabase replaced by a recorder, then validates each query against the migrated schema: tables, **450 selected columns**, 72 embedded relations and FK hints, 100 filters, 18 writes (columns must be granted to `authenticated`), 16 RPC calls (function exists, argument names match, required arguments present, executable by clients), storage buckets. | ✅ 0 problems |
| `node scripts/check-contract.mjs --self-test` | Injects 16 known-bad calls and confirms the contract checker reports every one (guards against a checker that always passes). | ✅ 16/16 caught |
| `npm run lint` / `npm run build` | ESLint (incl. React Hooks/Compiler rules) and a production build. | ✅ clean |

**Also run `supabase/tests/rls_test.sql` in the Supabase SQL editor** after applying the migrations
to the real project. The local stub is a simplification; this is the definitive RLS check. The last
row must read `ALL TESTS PASSED` (everything is rolled back).

**What the automated checks cannot prove** (covered by the manual checklist below): real Supabase Auth
(sign-up emails, password reset links, sessions), real Storage uploads and bucket MIME/size limits,
Realtime notification delivery, PostgREST behavior itself, and visual layout.

---

## 2. Manual checklist (live Supabase project)

### Setup
- [ ] Migrations 0001–0007 applied; `rls_test.sql` shows `ALL TESTS PASSED`
- [ ] `.env.local` filled in; `npm run dev` shows the landing page (not the "Connect a Supabase project" screen)
- [ ] Auth URL configuration: Site URL + redirect URLs for `/login` and `/reset-password` (see `supabase/README.md`)
- [ ] Test accounts registered: **Student A**, **Student B**, **Admin**, **Super Admin** (Super Admin promoted with `seed.sql`, Admin promoted from Admin → Users)

### Authentication
- [ ] Register with a non-CvSU email → blocked with a clear message
- [ ] Register with an already-used email / Student ID → the specific field shows "already registered"
- [ ] Register Student A → confirmation email arrives (if enabled) → link opens `/login` → sign in works
- [ ] Wrong password → "Incorrect email or password"
- [ ] Refresh the page while signed in → still signed in
- [ ] Forgot password → email arrives → link opens `/reset-password` → new password works; old one doesn't
- [ ] Open `/admin` as Student A → 403 "Access restricted"; open `/dashboard` signed out → redirected to sign-in, then back after signing in
- [ ] Sign out → protected pages redirect to sign-in

### Reporting (Student A)
- [ ] Report a lost item with a photo (JPG/PNG/WEBP ≤ 5 MB) → success screen shows `LST-YYYY-NNNNNN`
- [ ] Try a 6 MB image, a PDF and a GIF → rejected before upload
- [ ] Report appears in My Reports as "Pending review"; **not** in public Lost Items
- [ ] Edit it (change photo, location) → changes saved; old photo removed from Storage (Storage → item-images)
- [ ] Report a found item; the custody office list only shows custody points for the chosen campus
- [ ] Delete a pending report → gone from My Reports and its photo is removed

### Moderation (Admin)
- [ ] Admin dashboard counts match the pending reports; bell shows "New lost-item report" notifications
- [ ] Approve the lost report → Student A gets a notification (bell updates **without refresh** = Realtime working) → item appears in public Lost Items
- [ ] Reject another report without a reason → blocked; with a reason → reporter sees the reason in the notification and status history
- [ ] Verify the found item with 2 questions and a custody office → listed in Found Items; finder notified
- [ ] Private details (identifying details, contact info) visible in the Review window, never on public pages (check while signed out)

### Claims (Student B claims Student A's found item)
- [ ] Signed out on the item page → "Sign in to claim"; the finder sees "You reported this item"
- [ ] Claim form shows the admin's questions; submit with a PDF as evidence → redirected to the claim page (`CLM-…`)
- [ ] Second claim on the same item by the same user → "You already have an active claim"
- [ ] Finder is notified that a claim exists but cannot see the claim (no claim data in My Reports or via the item page)
- [ ] Admin → Claims: answers shown next to the finder's private details; evidence opens via signed link (expires after 5 min)
- [ ] With two claims on one item, approve one → the other is rejected automatically and both claimants are notified
- [ ] Record release (name defaults to the claimant) → item shows "Returned"; claimant and finder notified; claimant's linked lost report becomes "Recovered"
- [ ] Withdraw a pending claim as the claimant → status "Cancelled"

### Admin management
- [ ] Users: Admin cannot change roles (no selector); Super Admin can, with confirmation; nobody can change their own role
- [ ] Deactivate Student B → on their next visit they are signed out with a message; they cannot submit reports even with an open tab
- [ ] Categories: create (slug auto-fills), edit icon, deactivate → hidden from report forms; deleting a used category offers "Deactivate instead"
- [ ] Campus locations: add a location + mark as custody point → appears in the found-item custody list
- [ ] Reports & analytics: change the date range; charts update; Table view matches the chart; all three CSV exports open in Excel with correct accents (ñ)
- [ ] Activity logs show every action above with the right actor; filters by type and date work
- [ ] Settings: Admin sees read-only; Super Admin changes "Default claiming office" → shown on the About page and in approval notifications

### Responsive & accessibility
- [ ] Phone width (375 px): no horizontal page scroll on any page; sidebar opens as a drawer; tables scroll inside their card
- [ ] Keyboard only: tab through the report form and a dialog (focus stays inside the dialog; Escape closes only the top dialog)
- [ ] Every form error is announced next to its field; images have alt text or are decorative

### Security spot-checks (browser DevTools → Console, signed in as Student A)
Run with the app's own client, e.g. `const { supabase } = await import('/src/lib/supabase.js')`:
- [ ] `await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', '<own id>')` → permission denied
- [ ] `await supabase.from('claim_requests').select('*')` → only own claims
- [ ] `await supabase.from('found_item_private').select('*')` → only own found reports
- [ ] `await supabase.rpc('admin_update_claim', { p_claim_id: '<any>', p_action: 'approve' })` → "Administrator privileges are required"
- [ ] `await supabase.storage.from('claim-evidence').list('<another user id>')` → empty

---

## 3. Known limitations (by design)
- Accounts are deactivated, not deleted, from the app (deletion needs the service-role key; use the Supabase dashboard).
- No automatic lost ↔ found matching (the `match_suggestion` notification type is reserved).
- Notifications are in-app only (no email/SMS).
- The Supabase default mailer is rate-limited; configure SMTP before real use.
