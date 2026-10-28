# PRAXXYS Autofill — delivery plan

## Goal

Give QA and engineering a single browser tool that fills PRAXXYS admin and web forms with plausible, reproducible data — including the dropdowns, CKEditor, TipTap, and accept-aware file uploads — without adding code to every project.

## Non-goals

- No automatic submit, no record creation, no login automation by default.
- No AI generation in v1; no network calls at all.
- No support for canvas-only or shadow-DOM custom widgets in v1.
- No production rollout until the per-origin warning and staging checklist are signed off.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Delivery | Chrome MV3 extension | One install across ~20 apps, two UI stacks, no per-app build changes |
| Pilot | `dswd-admin`, then `dunkin-admin`, then `dswd-web-app` | Covers reka Command, vue-multiselect, vue-select, CKEditor, TipTap, uploads, then Nuxt/shadcn |
| Data | Seeded fixtures + JSON profiles | Reproducible, offline, no credentials |
| Editor access | Optional bridge + paste fallback | DOM-only writes are reverted by CKEditor/ProseMirror |
| Targeting | Attributes first, lexicon second | Admin emits `test-id` (not `data-testid`); web has almost none and is i18n |

## Architecture

- **ISOLATED content script** — HUD, popup messaging, result relay.
- **MAIN-world executor** — scanner, classifier, faker, adapters, editor bridge access.
- **Service worker** — command handling, on-demand injection (`content.js` then `main-world.js`).
- **Popup** — seed/scope/dropdown/profile, origin permission, run controls.
- **No shared chunks** — content and main-world are IIFE bundles; popup/background are ESM.

## Field handling

See README for the adapter matrix. Rules that matter:

1. Fill in DOM order, then retry failed dropdowns for four passes (dependent selects).
2. Re-scan between passes; Vue may replace nodes.
3. Verify every write. A write that cannot be verified is `failed`, not `filled`.
4. Never touch `type=password` without a profile value; never touch CSRF/hidden inputs.
5. Negative toggles (archive/delete/inactive/hidden) are left off; ambiguous toggles are skipped.
6. Uploads are generated locally and must satisfy `accept`; validation errors are surfaced.

## Phases and acceptance

### Phase 0 — spike (this build)

**Acceptance:** on a `dswd-admin` create page, one Fill covers text, reka selector, vue-multiselect, vue-select, date, CKEditor, and an image upload, and the HUD reports each field.

**Delivered here:** engine, all adapters, popup, HUD, form zoo, unit tests, build.

**Still manual:** run it against the real admin and record gaps in `docs/QA-CHECKLIST.md`.

### Phase 1 — admin breadth

- Cover every admin field wrapper: number, percent, phone/mobile, tag input, generate input, draggable upload, chunk upload, logo upload, date range.
- Verify Inertia `useForm` and update/edit paths.
- Confirm `BaseSearchableSelect` async behavior with real routes.
- Acceptance: three CRUD modules (content, settings, account) fill and save without validation errors.

**Live registration status (verified):** `https://dswd-web.praxxystech.com/auth/register` — personal/address step 11 filled / 0 failed (including PhilSys 16 digits, gender, province → city → barangay → LGU chain), contact step 4/0, disability group 1/0 (1–2 random options), delivery choice 1/0, documents 6/0 (five uploads, random MIME from `accept`). Re-running a filled step is idempotent (0 failed). Account-type/PWD-type cards and step navigation remain manual. URL fields use platform detection (YouTube/Vimeo/Maps/social) and coordinates are paired per form; verified in `demo/url-zoo.html`. Module-aware names are verified in `demo/products/create.html` and `demo/customers/create.html`.

### Phase 2 — web app

- Nuxt/shadcn `BaseSelector`, `BaseFileUploader` (`toAcceptTypes`), `BasePhoneInput`, `BaseRadioGroup`, `BaseToggle`.
- i18n label lexicon (EN/FIL) and dynamic form builder fields (`RegistrationForm.vue`).
- Multi-step forms: fill only the visible step, report it, do not advance.
- Acceptance: PWD registration step 1 and LGU PDA O registration fill cleanly.

### Phase 3 — reliability

- Bridge patch upstream in `praxxys-vue-kit` and `praxxys-backend` (`docs/EDITOR-BRIDGE.md`), with `data-prx-field` on shared inputs.
- Form-zoo regression suite in CI; Playwright run with `--load-extension`.
- Inspect mode polish: grouped by section, copyable JSON.

### Phase 4 — profiles

- Record-a-form profile capture (per-form signature, per-origin).
- Named personas, import/export JSON, optional credential mode (explicit, local only).
- Acceptance: replaying a recorded profile fills the same form with zero manual edits.

## Risks

| Risk | Mitigation |
| --- | --- |
| Component DOM changes break adapters | Form zoo + bridge + per-field failure reasons |
| Async/dependent dropdowns | four passes, explicit timeouts, retry reason in HUD |
| Real uploads create server records | staging warning, local-first host policy, no auto-submit |
| i18n labels | attribute-first classification, multilingual lexicon |
| Vendor copies drift | patch upstream only; per-project vendor edits are temporary and marked |
| Page scripts can spoof messages | accepted for a QA tool; no privileged data crosses the bridge |

## Definition of done for v1

- Admin and web pilots pass the QA checklist on local and staging.
- All failures are reported with a reason and a copyable report.
- No network calls from the extension; permissions unchanged.
- `npm run build`, `npm test`, `npm run typecheck` green.
