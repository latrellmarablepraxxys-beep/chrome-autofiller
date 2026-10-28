# QA checklist

Run after each `npm run build` and before shipping a change to the engine.

## Setup

```bash
npm run build
# chrome://extensions -> reload "PRAXXYS Autofill"
python3 -m http.server 8090   # for demo/form-zoo.html
```

## 1. Form zoo (no backend)

Open `http://localhost:8090/demo/form-zoo.html` and press `⌥⇧B` / `Alt+Shift+B`.

- [ ] Right-click the page → **PRAXXYS Autofill: Fill form** fills without opening the popup.
- [ ] Right-click → **PRAXXYS Autofill: Inspect fields** outlines fields and changes nothing.
- [ ] The shortcut `⌥⇧B` (Mac) / `Alt+Shift+B` (Windows) triggers the same fill.
- [ ] Title, native status, date, number filled; no console errors.
- [ ] Category (reka-shaped combobox) opens and selects an option; trigger text changes.
- [ ] Tags (vue-multiselect-shaped) selects 1–2 entries.
- [ ] Author (vue-select-shaped) opens, filters, and selects.
- [ ] TipTap-shaped and CKEditor-shaped editors receive HTML; `PRAXXYS QA` is visible.
- [ ] Image upload shows a preview; the file is PNG/JPEG matching `accept`.
- [ ] Published switch turns on; the negative switch stays off.
- [ ] Radio group selects exactly one option.
- [ ] Inspect outlines every field and changes nothing.

## 2. File zoo (no backend)

Open `http://localhost:8090/demo/file-zoo.html`, Scope = **All fields**, Fill.

- [ ] `image/*` gets PNG/JPEG/WebP (not GIF unless explicitly accepted).
- [ ] `application/pdf` gets a PDF; `.docx,.xlsx,.pptx` gets one of those, with the matching MIME.
- [ ] `video/*` gets WebM or MP4 when the browser can record it.
- [ ] “Photo (mixed accept)” stays an image even though PDF is allowed.
- [ ] Multiple input gets two different accepted formats.
- [ ] Every generated `type` is listed in that input's `accept`; no validation errors.

## 3. URL zoo (no backend)

Open `http://localhost:8090/demo/url-zoo.html`, Scope = **All fields**, Fill.

- [ ] Video Link → `youtube.com/watch?v=…`; Video Embed → `youtube.com/embed/…`.
- [ ] Vimeo URL → `vimeo.com/…`; Facebook Page → that platform’s domain.
- [ ] Google Maps Link and Map Embed use the same coordinates.
- [ ] Latitude / Longitude / Coordinates match the map coordinates.
- [ ] Website → `https://www.praxxystech.com`.
- [ ] Inspect reports `video_url`, `map_url`, `latitude`, `longitude`, `coordinates`.

## 4. Module names (no backend)

- [ ] `/demo/products/create.html`: Name = a product (e.g. “Signature Linen Tote Bag Pack of 6”), Category = “Beverages”, Price + SKU filled.
- [ ] `/demo/customers/create.html`: Name = a realistic person (e.g. “Paolo Arellano”), Email, Role = “HR Coordinator”.
- [ ] Inspect shows `entity_name` on the product page and `full_name` on the customer page.
- [ ] Two consecutive fills use different names; with **Repeatable** ticked, they match.

## 5. Randomness (no backend)

Open `http://localhost:8090/demo/randomness.html`.

- [ ] Fill twice with **Repeatable** unticked: Name, Mobile, PhilSys and Email all change.
- [ ] Tick **Repeatable** and fill twice: the same four values return.
- [ ] The popup seed still changes the base values in Repeatable mode.

## 6. dswd-admin (local)

```bash
cd dswd-admin && php artisan serve --port=8000 && npm run dev
```

- [ ] Login page: Fill does not touch the password field.
- [ ] Content page create: reka `BaseSelector`, CKEditor, image upload.
- [ ] Settings form: vue-select async options; report shows the selected option or a timeout reason.
- [ ] A module with region/province/city: second pass fills dependent selects.
- [ ] Edit an existing record: Fill then Save changes, no validation errors.
- [ ] Inspect on an unfamiliar page: every field has a sensible semantic.

## 6. dunkin-admin (TipTap)

- [ ] Any `BaseTiptapEditor` receives heading/list/link/image.
- [ ] Report strategy says `bridge:tiptap` once the bridge patch is applied, otherwise `paste`/`execCommand`.

- [ ] Product create (`/admin/management/products/create`): with Required scope and Video Featured off, the optional **Video Link** still receives a YouTube URL.
- [ ] With Video Featured on, Video Title, Video Link and Video Thumbnail are filled.

## 7. GlobaEight staging

Open `https://globaleight-web-staging.praxxystech.com/` and Fill.

- [ ] First name, last name, mobile (10 digits), email, business name filled.
- [ ] **Business Type** shows a selected value (e.g. “Corporation”) — the reka Combobox with a separate “Show popup” trigger.
- [ ] Tenure is 1–20 years; no failures in the report.

## 8. dswd-web-app

Start at `https://dswd-web.praxxystech.com/auth/register` (or the local Nuxt app).

- [ ] Click “Person with disability” → Continue → “New PWD” → Continue (cards are manual).
- [ ] Personal/address step: Fill → PhilSys 16 digits, names, birthdate in the past, gender selected, province → city → barangay → LGU chained.
- [ ] Report shows `Gender` once with `Female` — no “skipped: radio group already filled” rows.
- [ ] Run Fill again: dropdowns report “already selected”, no failures.
- [ ] Next → Contact: phones (10-digit local), email, emergency contact filled.
- [ ] Next → Disability: report shows one `disabilities` row with 1–2 randomly checked options.
- [ ] Run Fill again on the same step: the group reports “already selected” and does not add options.
- [ ] Next → Delivery: “Use my current address” selected, one report row.
- [ ] Next → Documents: five files uploaded (PNG, tens of KB), ID type selected, no validation errors.
- [ ] No field is filled on the confirmation/submit step; you submit manually.
- [ ] Multi-step form: only the visible step is filled; the extension never clicks Continue/Next.

## Report a problem

Copy the HUD report and attach it. It includes field key, label, semantic kind, status, reason, and strategy — enough to reproduce without a screenshot.

## Known limitations to confirm on purpose

- Canvas-only and shadow-DOM widgets are skipped.
- `type=password` is skipped unless the profile provides a value.
- Video uploads depend on the browser's `MediaRecorder` codecs; if `accept` lists only a codec the browser cannot record, the field reports a clear failure instead of a mismatch.
- Right-click and the shortcut fill the **current step** only; Continue/Next and Submit stay manual.
