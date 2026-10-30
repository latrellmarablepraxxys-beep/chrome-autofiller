# PRAXXYS Autofill

Chrome MV3 extension that fills PRAXXYS admin and web forms with deterministic, realistic data — native controls, shadcn, reka-ui, PRAXXYS Vue Kit, vue-select/vue-multiselect, `@vuepic/vue-datepicker`, CKEditor, TipTap, and file uploads that respect the frontend `accept` attribute.

It never saves, submits, or touches password fields unless you give it a password in the profile.

## Status

`0.1.0` — Phase 0/1 engine. Admin-first. See [`docs/PLAN.md`](docs/PLAN.md) for the roadmap and [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md) for the manual test pass.

## Install

```bash
npm install
npm run build
```

`chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist/`.

Reload the extension card after a rebuild. `npm run dev` watches the three bundles; the manifest is copied automatically.

## Use

1. Open an admin form (`http://127.0.0.1:8000/...`) or a web form (`http://localhost:3000/...`).
2. Fill it in any of these ways — the popup is optional:
    - **Right-click** anywhere on the page → **PRAXXYS Autofill: Fill form**
    - Press **⌥⇧B** on Mac or **Alt+Shift+B** on Windows/Linux
    - Click the toolbar icon → **Fill form**
3. Review the HUD, then save the form yourself.

The right-click action uses the saved seed/scope/profile. **PRAXXYS Autofill: Inspect fields** is the dry-run entry in the same menu.

> Chrome reserves **Cmd+Shift+B / Ctrl+Shift+B** for the bookmarks bar and **Cmd+Shift+F / Ctrl+Shift+F** for Search, so those exact chords cannot be assigned to an extension — not even manually at `chrome://extensions/shortcuts`. The extension uses **⌥⇧B / Alt+Shift+B**. The popup shows the active shortcut and **Change shortcut** opens the Chrome shortcut editor. You can rebind it at `chrome://extensions/shortcuts` if you prefer another non-reserved chord.

On the supported hosts the content script also listens for **⌥⇧B / Alt+Shift+B** directly, so the shortcut still fills even if Chrome’s command registration is missing or overridden. The listener uses the physical `KeyB` code, so it works with the Option/Alt character variants on macOS.

- **Inspect** outlines every detected control and reports its semantic kind without writing anything. Use it when a field is missed or mislabelled.
- **Scope** — *Required + content* fills required fields plus rich-text editors; *All fields* fills everything the engine understands.
- **Dropdowns** — first valid option, random valid option, or profile match first.
- **Seed** — base for the randomizer. Every fill adds a fresh salt, so values change each run; tick **Repeatable** to reuse the same values.
- **Profile overrides** — JSON keyed by field label, key, name, id, or semantic:

```json
{
    "Email": "qa+admin@praxxys.test",
    "Category": "Beverages",
    "price": "199.00"
}
```

- **Enable on this origin** — required once for non-local hosts. Localhost and `127.0.0.1` work out of the box.

### Use on a real domain

The extension is origin-scoped, not localhost-only. For `https://admin.client.com` or a staging host:

1. Open the real form in a tab.
2. Open the popup — it shows the host and **Enable on this origin**.
3. Click it and accept Chrome's prompt (one grant per hostname; all ports are covered).
4. Fill with **⌥⇧B / Alt+Shift+B** or right-click → **PRAXXYS Autofill: Fill form**.

The background injects `content.js` and `main-world.js` after the grant, so no page reload is required. If a later build changes the content script, reload the page once.

To ship this to a team without per-person prompts, add the host to `host_permissions` in `manifest.json` (for example `"https://admin.client.com/*"`) and distribute the built `dist/` folder. For an unlisted Chrome Web Store listing or an enterprise force-install, use the packaged build and the same manifest.

Caveats on real domains:

- **Uploads are real.** `BaseFileUploader` only stages the `File`, but `BaseChunkUploader` / `BaseLogoUploader` upload on selection. Prefer staging, or confirm the uploader's behaviour first.
- **No auto-submit.** The extension fills and stops; the save button is still yours.
- **Chrome blocks internal pages.** `chrome://`, the Web Store, and PDF viewer pages cannot be scripted.
- **Branded Chrome 137+ ignores `--load-extension` on the command line.** Use `chrome://extensions` → *Load unpacked*, or Chrome for Testing for automated runs.
- **One grant per hostname.** `admin.example.com` and `staging.example.com` are separate grants; `*.example.com` is not implied.
- **CSP does not block it.** Page CSP does not affect extension-injected scripts, but a site that renders forms inside a cross-origin iframe needs `all_frames` re-enabled.
- **The current build pre-allows `dswd-web.praxxystech.com`, `globaleight-web-staging.praxxystech.com`, `doxo-staging-web.praxxystech.com`, `admin.motorcentral.com.ph` and `injoy.com.ph`.** Other hosts use the popup grant.

### Current limits on multi-step registration

- The filler works on the **visible step** and does not click Continue/Next for you.
- The account-type and PWD-type cards (`AccountTypeStep`, `PwdTypeStep`) are plain buttons, not form controls; choose those two steps manually.
- Conditional optional fields (for example “Cause of Disability”) stay empty unless the step marks them required or you switch to **All fields**.

## What gets filled

| Control | Strategy |
| --- | --- |
| Text, textarea, number, percent, phone | native setter + `input`/`change`/`blur`; respects `maxlength`, `min`/`max`, `readonly`, `disabled` |
| Video / map / social URLs | YouTube/Vimeo watch or embed, Google Maps share or embed, platform-correct social URLs; real demo IDs where embedding matters. These fill even when the field is optional (e.g. a product’s Video Link). |
| Latitude / longitude / coordinates | one paired point per form; 6-decimal lat/lng, `lat,lng` for a single field; the map URL reuses the same point |
| Number-only (`inputmode=numeric`) | digits only; PhilSys uses 16 digits, numeric IDs use `maxlength` |
| Date | native `input[type=date]` (ISO), or `@vuepic/vue-datepicker` v9–v14 driven through its calendar: click the `dp-YYYY-MM-DD` cell, use the month/year overlays or nav arrows for far dates, then commit with the action row. Birthdates are always in the past. |
| Native select | first valid option (or profile match) + `change`; `<select multiple>` replaces the selection with 1–2 options |
| Admin `BaseSelector` (reka Command) | open `[role=combobox]`, pick `[role=option]`, verify trigger text |
| Web `BaseSelector` (reka Select) | keyboard: Enter opens, arrows move, Enter commits (synthetic pointer clicks do not commit) |
| reka Combobox with a separate “Show popup” trigger | detect `[data-slot=combobox-trigger]`, read the wrapper label, select the first option, verify the combobox input value |
| `PrxSelect` (PRAXXYS Vue Kit) | click the `data-testid="…-selector"` combobox button, click the reka option, verify the trigger text, close the popover |
| `PrxSearchableSelect` (PRAXXYS Vue Kit) | open the custom div/input, wait for the debounced `searchRoute` options, click a `…-option-…` button, close the popup |
| `BaseMultiselect` / `PrxMultiSelect` (vue-multiselect) | open, pick 1–2 unselected options |
| `BaseSearchableSelect` (vue-select) | open on mousedown, wait out the app's debounced fetch, pick, then explicitly close the menu; the field label comes from the wrapper, not vue-select's generic “Search for option” aria-label |
| Checkbox / radio / switch | positive labels only; an unselected radio group picks its first option; a multi-select checkbox group checks 1–2 **randomly chosen** options (optional groups too under “All fields”). Radio/checkbox groups are reported as **one row**, not one row per option |
| Button-only choice groups (“Label as”, address type) | a small set of buttons is detected from the group label; one is clicked at random and reported as a single field |
| CKEditor / TipTap | `window.__PRX_QA__` bridge when present, otherwise paste event, otherwise `execCommand` |
| File input | parses `accept` (including bare extensions like `pdf`), picks a **random allowed format** (PNG/JPEG/WebP/GIF/PDF/CSV/TXT/DOCX/XLSX/PPTX/WebM/MP4), verifies the generated MIME against `accept`, assigns via `DataTransfer`, reports validation errors |

Dependent dropdowns (region → province → city → barangay) are retried across up to four passes so async option lists can arrive.

### Randomness

Every fill adds a fresh random salt to the seed, so names, mobile numbers, PhilSys, dropdown choices and file formats differ each time. Tick **Repeatable** in the popup to pin the salt and reuse the same values. Image-labelled fields (“photo”, “signature”, “logo”) stay images even when the uploader also accepts PDFs. A “None / No disability / N/A” option is never combined with another checkbox option.

### Module-aware names

Before classifying, the engine detects what the page is editing — from the URL path, then the page heading, then field signals:

| Detected module | A bare **Name** becomes |
|---|---|
| Product (`/products`, price/SKU fields, “Create Product”) | `Signature Linen Tote Bag Pack of 6` |
| Customer / User / Admin / Employee (`/customers`, first/last/email) | `Paolo Arellano`, `Camille Reyes`, … |
| Category / Cuisine | `Beverages`, `Personal Care`, … |
| Service / Package | `Home Deep Cleaning`, `Dental Checkup Package`, … |
| Brand / Company / Merchant | `Blue Harbor`, `Sunrise Trading Co.`, … |
| Office / Branch / Store | `PRAXXYS Office — Makati`, `Cebu City Branch`, … |
| Page / Post / Article | `Privacy Policy`, `How to Register`, … |
| Event / Promo / Campaign | `Summer Sale 2026`, `Holiday Bazaar`, … |

A “Category” text field becomes a category, “Role” becomes a position, and “Title” follows the module (product title, page title, …). If no module is detected, a bare “Name” stays a realistic person name.

Detection is heuristic: the URL segment wins (`/admin/contents/products/create`), then the heading, then signals such as price/SKU or first/last/email. **Inspect** shows `entity_name` versus `full_name`, and profile overrides always win. Every fill randomizes the names by default; tick **Repeatable** to pin them to the seed.

### Modals

For forms inside a dialog, start the fill with **right-click inside the dialog → PRAXXYS Autofill: Fill form** or **⌥⇧B**. Opening the toolbar popup counts as an outside interaction and can close a dialog that auto-closes on outside clicks; the first field may fill, then the remaining fields report `not visible` because the dialog was unmounting.

The filler now waits for a stable modal, scopes the scan to the open dialog, re-resolves detached elements, retries hidden fields, and reports the concrete reason (`detached`, `display:none`, `aria-hidden ancestor`, `inert ancestor`) instead of a bare “not visible”. It also no longer blurs fields or sends Escape unless a dropdown is actually open.

### Optional QA harness

This harness is **not needed to use the extension**. For normal use, run `npm run build` and load `dist/` — no dev server. The harness only exists for manual QA and CI, and it is the only part of the repo that installs the private `@praxxys/vue-kit` package.

```bash
npm run harness   # http://localhost:8093
```

The harness mounts **real packages**, not static mocks, in five sections:

| Section | Packages |
| --- | --- |
| Native HTML | plain inputs, `<select multiple>`, radio, checkbox, date/month/time/range/color, file |
| shadcn + reka | reka-ui Select, Combobox, RadioGroup, Checkbox, Switch, ToggleGroup, Dialog, and `vue-select` |
| PRAXXYS Vue Kit | `PrxSelect`, `PrxSearchableSelect` (with a stubbed `searchRoute`), `PrxMultiSelect`, `PrxDatePicker`, `PrxFileUpload`, `PrxTextInput` |
| vue-select / vue-multiselect | `vue-select` and `vue-multiselect` shapes |
| Vue Date Picker | `@vuepic/vue-datepicker` |

The kit is loaded from `node_modules` through a Vite alias, so the markup always matches the installed package. Install the private package first:

```bash
cp <admin-repo>/.npmrc .npmrc   # GitLab @praxxys registry token, gitignored
npm install
```

Fill the page with the extension and compare the HUD against `docs/QA-CHECKLIST.md` §10. The shadcn section should reach 9/9, the dialog should stay open with its own fields filled, and each kit widget should report `prx-…` strategies.

### URL and coordinate detection

The classifier reads the label, `name`, `id`, placeholder, and `type=url`:

- `youtube`, `vimeo`, `video link`, `video embed`, `watch` → a real demo video (watch / embed / shorts).
- `google maps`, `map link`, `directions`, `map embed` → Google Maps at the form’s coordinate point.
- `latitude` / `lat` → decimal latitude; `longitude` / `lng` / `long` → decimal longitude; `coordinates` → `lat,lng`.
- `facebook`, `instagram`, `linkedin`, `tiktok`, `twitter` / `x` → that platform’s URL.
- `website` / `homepage` → the brand root; any other `link` / `url` → a generic website path.

The same form reuses one coordinate pair, so a Map URL, Latitude, Longitude, and Coordinates field all agree.

Limits: a bare **“Link”** cannot reveal a platform, so it becomes a website URL. A bare **“Location”** is treated as an address unless it says URL/link/map. Social handles are domain-correct but may not resolve. **Inspect** shows the semantic before anything is written.

## Architecture

```
popup ─► background (service worker) ─► content script (ISOLATED)
                                          │ HUD + messaging
                                          ▼ window.postMessage
                                     main-world executor (MAIN)
                                          │ scanner → classifier → faker → adapters
                                          └ window.__PRX_QA__.editors (bridge)
```

The executor runs in the page's **main world** so it can read the editor bridge registry. The content script only renders the HUD and relays messages. Bundles are self-contained (no shared chunks) because content scripts cannot import at runtime.

## Layout

```
manifest.json            MV3 manifest
popup.html               popup shell
src/background.ts        command + message routing, on-demand injection
src/content/             HUD, message bridge
src/main-world/          executor entry
src/core/                scanner, classifier, lexicon, faker, orchestrator, report
src/adapters/            text, choice, reka, vue-multiselect, vue-select, editors, file
src/fixtures/            accept-aware file generation
src/shared/              types, DOM helpers, seeded RNG, accept parser, bridge types
public/icons/            extension logo (SVG + 16/32/48/128/512 PNGs)
harness/                 real component harness for native/shadcn/reka/vue-kit/vue widgets (npm run harness)
demo/form-zoo.html       standalone harness for all adapter shapes
demo/file-zoo.html       accept-aware file generation harness
demo/url-zoo.html        platform URL and latitude/longitude harness
demo/randomness.html     two-fill randomization check
demo/products/create.html  module-aware product-name harness
demo/customers/create.html module-aware person-name harness
docs/                    plan, editor bridge, QA checklist
```

## Add an adapter

1. Add the control kind to `ControlKind` in `src/shared/types.ts`.
2. Detect it in `scanControls` (`src/core/scanner.ts`).
3. Return a `FieldOutcome` from a new file in `src/adapters/`.
4. Dispatch it in `fillControl` (`src/core/orchestrator.ts`).
5. Add the shape to `demo/form-zoo.html` and a unit test.

## Tests

```bash
npm test
npm run typecheck
```

Unit tests cover the accept parser, seeded RNG, classifier, faker, and scanner. Adapter regressions are exercised through the form zoo and, later, Playwright against the real apps.

## Security

- Permissions: `scripting`, `activeTab`, `storage`, `tabs` only.
- No network requests, no telemetry, no remote code.
- Declared only on `localhost` / `127.0.0.1`; every other origin is opt-in.
- Profile data stays in `chrome.storage.local`.
- Never auto-submits. Never fills `type=password` without an explicit profile value.
- Chunk/logo uploaders hit the real API on selection — stay on staging or local.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Popup says “Not a web page” | Chrome internal pages and the Web Store are blocked by Chrome. |
| “Could not establish connection” | Reload the page, or re-grant the origin from the popup. |
| Dropdown reported “no options” | Options are async/dependent; run Fill again after the page settles, or check the network tab. |
| Editor shows “paste” but no content | Add the bridge patch in `docs/EDITOR-BRIDGE.md` for that app. |
| Upload rejected | The generated format did not match `accept`; the report includes the format and size. |
