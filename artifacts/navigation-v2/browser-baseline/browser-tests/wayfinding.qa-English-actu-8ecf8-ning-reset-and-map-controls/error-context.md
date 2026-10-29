# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wayfinding.qa.spec.ts >> English actual entrance and cross-wing routes, keyboard, planning reset and map controls
- Location: tests\e2e\wayfinding.qa.spec.ts:74:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByTestId('reset-kiosk')
    - locator resolved to <button class="reset-kiosk" data-testid="reset-kiosk">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button class="secondary-button">…</button> from <aside class="detail-card" aria-label="Room details" data-testid="room-details">…</aside> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button class="secondary-button">…</button> from <aside class="detail-card" aria-label="Room details" data-testid="room-details">…</aside> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    78 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button class="secondary-button">…</button> from <aside class="detail-card" aria-label="Room details" data-testid="room-details">…</aside> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - link "Skip to room directory" [ref=e3] [cursor=pointer]:
      - /url: "#directory"
    - banner [ref=e4]:
      - link "Academy wayfinding" [ref=e5] [cursor=pointer]:
        - /url: "#directory"
        - generic [ref=e7]:
          - strong [ref=e8]: ACADEMY
          - generic [ref=e9]: CAMPUS WAYFINDING
      - generic [ref=e11]:
        - generic [ref=e12]: Building B03
        - generic [ref=e13]: Ground Floor
      - generic [ref=e14]:
        - generic [ref=e15]: Source-based floor plan
        - button "Switch to Arabic" [ref=e17] [cursor=pointer]:
          - generic [ref=e18]: EN
          - generic [ref=e20]: العربية
        - button "Mute audio" [ref=e21] [cursor=pointer]
    - main [ref=e26]:
      - complementary "Room directory" [ref=e27]:
        - generic [ref=e28]:
          - paragraph [ref=e29]: Building B03 · Ground Floor
          - heading "Where would you like to go?" [level=1] [ref=e30]
          - paragraph [ref=e31]: One floor. Every destination.
        - group "Plan your visit" [ref=e32]:
          - button "Browse" [ref=e33] [cursor=pointer]
          - button "Navigate" [pressed] [ref=e38] [cursor=pointer]
        - generic [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]: Starting point
            - combobox "Starting point" [ref=e45]:
              - option "Main Entrance (default)" [selected]
              - option "Main Entrance — G-01"
              - option "Corridor 1 — G-02"
              - option "Corridor 2 — G-03"
              - option "Corridor 3 — G-04"
              - option "Auditorium — G-05"
              - option "Storage — G-06"
              - option "Vip Salon — G-07"
              - option "Stairs 3 — G-08"
              - option "Elevator Lobby — G-09"
              - option "Valve Room — G-10"
              - option "Storage — G-11"
              - option "Female Toilets — G-12"
              - option "Male Toilets — G-13"
              - option "Lobby — G-14"
              - option "Translation Room — G-15"
              - option "Audio Visual — G-16"
              - option "Stairs 4 — G-17"
              - option "Cafeteria — G-18"
              - option "Service — G-19"
              - option "Kitchen — G-20"
              - option "Storage — G-21"
              - option "Security Room — G-22"
              - option "Stair 02 — G-23"
              - option "Exhibition Room — G-24"
              - option "Operations Office — G-25"
              - option "Skylight — G-26"
              - option "Reception — G-27"
              - option "Clinic — G-28"
              - option "Lounge — G-29"
              - option "Meeting Room — G-30"
              - option "Lobby — G-31"
              - option "Stairs 1 — G-32"
              - option "Prayer Room — G-33"
              - option "Storage — G-34"
              - option "Copy Room — G-35"
              - option "Archives Room — G-36"
              - option "Garbage Chute — G-37"
              - option "Control Room — G-38"
              - option "Services — G-39"
              - option "Storage — G-40"
              - option "Female Toilet — G-41"
              - option "Male Toilet — G-42"
              - option "Mechanical Lab — G-43"
              - option "Av Control Room — G-44"
              - option "Physical Training Lab 1 — G-45"
              - option "Physical Training Lab 2 — G-46"
              - option "Av Studio — G-47"
              - option "Service Room — G-48"
              - option "Hvac Cabinet — G-49"
              - option "Visual Training Lab 1 — G-50"
              - option "It Room — G-51"
              - option "Elect Room — G-52"
              - option "Elevator Lobby — G-53"
              - option "Stairs 5 — G-54"
            - generic [ref=e46]: Destination
            - combobox "Destination" [ref=e50]:
              - option "Choose a destination"
              - option "Main Entrance — G-01"
              - option "Corridor 1 — G-02" [selected]
              - option "Corridor 2 — G-03"
              - option "Corridor 3 — G-04"
              - option "Auditorium — G-05"
              - option "Storage — G-06"
              - option "Vip Salon — G-07"
              - option "Stairs 3 — G-08"
              - option "Elevator Lobby — G-09"
              - option "Valve Room — G-10"
              - option "Storage — G-11"
              - option "Female Toilets — G-12"
              - option "Male Toilets — G-13"
              - option "Lobby — G-14"
              - option "Translation Room — G-15"
              - option "Audio Visual — G-16"
              - option "Stairs 4 — G-17"
              - option "Cafeteria — G-18"
              - option "Service — G-19"
              - option "Kitchen — G-20"
              - option "Storage — G-21"
              - option "Security Room — G-22"
              - option "Stair 02 — G-23"
              - option "Exhibition Room — G-24"
              - option "Operations Office — G-25"
              - option "Skylight — G-26"
              - option "Reception — G-27"
              - option "Clinic — G-28"
              - option "Lounge — G-29"
              - option "Meeting Room — G-30"
              - option "Lobby — G-31"
              - option "Stairs 1 — G-32"
              - option "Prayer Room — G-33"
              - option "Storage — G-34"
              - option "Copy Room — G-35"
              - option "Archives Room — G-36"
              - option "Garbage Chute — G-37"
              - option "Control Room — G-38"
              - option "Services — G-39"
              - option "Storage — G-40"
              - option "Female Toilet — G-41"
              - option "Male Toilet — G-42"
              - option "Mechanical Lab — G-43"
              - option "Av Control Room — G-44"
              - option "Physical Training Lab 1 — G-45"
              - option "Physical Training Lab 2 — G-46"
              - option "Av Studio — G-47"
              - option "Service Room — G-48"
              - option "Hvac Cabinet — G-49"
              - option "Visual Training Lab 1 — G-50"
              - option "It Room — G-51"
              - option "Elect Room — G-52"
              - option "Elevator Lobby — G-53"
              - option "Stairs 5 — G-54"
          - paragraph [ref=e51]: The main entrance is the default starting point for planning, not your current location.
          - generic [ref=e54]:
            - checkbox "Verified accessible routes only" [ref=e55]
            - text: Verified accessible routes only
          - button "Use default starting point" [active] [ref=e56] [cursor=pointer]
          - status [ref=e57]:
            - heading "Directions" [level=3] [ref=e58]
            - strong [ref=e59]: Route on floor plan
            - paragraph [ref=e60]: Follow the route on the drawing. Physical access and distance scale are unverified.
            - paragraph [ref=e61]: "Starting point: Route ends at the source label approach in this open circulation space. No physical doorway is implied."
            - paragraph [ref=e62]: Route ends at the source label approach in this open circulation space. No physical doorway is implied.
            - list [ref=e63]:
              - listitem [ref=e64]: Start here and follow the route.
              - listitem [ref=e65]: Enter the corridor.
              - listitem [ref=e66]: Turn right.
              - listitem [ref=e67]: Turn right.
              - listitem [ref=e68]: Continue straight.
              - listitem [ref=e69]: Bear slightly right.
              - listitem [ref=e70]: Bear slightly right.
              - listitem [ref=e71]: Continue straight.
              - listitem [ref=e72]: Bear slightly right.
              - listitem [ref=e73]: Bear slightly left.
              - listitem [ref=e74]: Continue straight.
              - listitem [ref=e75]: Bear slightly left.
              - listitem [ref=e76]: Bear slightly right.
              - listitem [ref=e77]: Continue straight.
              - listitem [ref=e78]: You have reached the mapped entrance or approach. Follow the destination note to continue.
            - group [ref=e79]:
              - button "Start route playback" [disabled] [ref=e80]
              - button "Stop route playback" [ref=e81] [cursor=pointer]
              - button "Reset route playback" [ref=e82] [cursor=pointer]
              - progressbar [ref=e83]
          - button "Clear route" [ref=e84] [cursor=pointer]
        - paragraph [ref=e92]: Directory listing does not confirm public access.
      - region "Floor map" [ref=e93]:
        - generic:
          - generic [ref=e94]:
            - paragraph [ref=e95]: Floor overview
            - heading "Ground Floor" [level=2] [ref=e96]
            - paragraph [ref=e97]: 54 rooms on this floor · B03
          - generic [ref=e98]:
            - generic [ref=e103]: Floor
            - combobox "Floor" [ref=e104] [cursor=pointer]:
              - option "Ground Floor · GF" [selected]
              - option "First Floor · 01"
        - generic "Floor map" [ref=e108]:
          - button "Main Entrance, G-01" [ref=e112] [cursor=pointer]:
            - generic [ref=e114]: Main Entrance
            - generic [ref=e115]: G-01
          - button "Corridor 1, G-02" [pressed] [ref=e117] [cursor=pointer]:
            - generic [ref=e119]: Corridor 1
            - generic [ref=e120]: G-02
          - button "Corridor 2, G-03" [ref=e122] [cursor=pointer]:
            - generic [ref=e124]: Corridor 2
            - generic [ref=e125]: G-03
          - button "Corridor 3, G-04" [ref=e127] [cursor=pointer]:
            - generic [ref=e129]: Corridor 3
            - generic [ref=e130]: G-04
          - button "Auditorium, G-05" [ref=e132] [cursor=pointer]:
            - generic [ref=e134]: Auditorium
          - button "Storage, G-06" [ref=e136] [cursor=pointer]:
            - generic [ref=e138]: Storage
          - button "Vip Salon, G-07" [ref=e140] [cursor=pointer]:
            - generic [ref=e142]: Vip Salon
            - generic [ref=e143]: G-07
          - button "Stairs 3, G-08" [ref=e145] [cursor=pointer]:
            - generic [ref=e147]: Stairs 3
            - generic [ref=e148]: G-08
          - button "Elevator Lobby, G-09" [ref=e150] [cursor=pointer]:
            - generic [ref=e152]: Elevator Lobby
          - button "Valve Room, G-10" [ref=e154] [cursor=pointer]:
            - generic [ref=e156]: Valve Room
            - generic [ref=e157]: G-10
          - button "Storage, G-11" [ref=e159] [cursor=pointer]:
            - generic [ref=e161]: Storage
          - button "Female Toilets, G-12" [ref=e163] [cursor=pointer]:
            - generic [ref=e165]: Female Toilets
          - button "Male Toilets, G-13" [ref=e167] [cursor=pointer]:
            - generic [ref=e169]: Male Toilets
          - button "Lobby, G-14" [ref=e171] [cursor=pointer]:
            - generic [ref=e173]: Lobby
          - button "Translation Room, G-15" [ref=e175] [cursor=pointer]:
            - generic [ref=e177]: Translation Room
          - button "Audio Visual, G-16" [ref=e179] [cursor=pointer]:
            - generic [ref=e181]: Audio Visual
          - button "Stairs 4, G-17" [ref=e183] [cursor=pointer]:
            - generic [ref=e185]: Stairs 4
          - button "Cafeteria, G-18" [ref=e187] [cursor=pointer]:
            - generic [ref=e189]: Cafeteria
            - generic [ref=e190]: G-18
          - button "Service, G-19" [ref=e192] [cursor=pointer]:
            - generic [ref=e194]: Service
          - button "Kitchen, G-20" [ref=e196] [cursor=pointer]:
            - generic [ref=e198]: Kitchen
          - button "Storage, G-21" [ref=e200] [cursor=pointer]:
            - generic [ref=e202]: Storage
          - button "Security Room, G-22" [ref=e204] [cursor=pointer]:
            - generic [ref=e206]: Security Room
            - generic [ref=e207]: G-22
          - button "Stair 02, G-23" [ref=e209] [cursor=pointer]:
            - generic [ref=e211]: Stair 02
            - generic [ref=e212]: G-23
          - button "Exhibition Room, G-24" [ref=e214] [cursor=pointer]:
            - generic [ref=e216]: Exhibition Room
            - generic [ref=e217]: G-24
          - button "Operations Office, G-25" [ref=e219] [cursor=pointer]:
            - generic [ref=e221]: Operations Office
          - button "Skylight, G-26" [ref=e223] [cursor=pointer]:
            - generic [ref=e225]: Skylight
            - generic [ref=e226]: G-26
          - button "Reception, G-27" [ref=e228] [cursor=pointer]:
            - generic [ref=e230]: Reception
            - generic [ref=e231]: G-27
          - button "Clinic, G-28" [ref=e233] [cursor=pointer]:
            - generic [ref=e235]: Clinic
            - generic [ref=e236]: G-28
          - button "Lounge, G-29" [ref=e238] [cursor=pointer]:
            - generic [ref=e240]: Lounge
            - generic [ref=e241]: G-29
          - button "Meeting Room, G-30" [ref=e243] [cursor=pointer]:
            - generic [ref=e245]: Meeting Room
            - generic [ref=e246]: G-30
          - button "Lobby, G-31" [ref=e248] [cursor=pointer]:
            - generic [ref=e250]: Lobby
            - generic [ref=e251]: G-31
          - button "Stairs 1, G-32" [ref=e253] [cursor=pointer]:
            - generic [ref=e255]: Stairs 1
            - generic [ref=e256]: G-32
          - button "Prayer Room, G-33" [ref=e258] [cursor=pointer]:
            - generic [ref=e260]: Prayer Room
          - button "Storage, G-34" [ref=e262] [cursor=pointer]:
            - generic [ref=e264]: Storage
            - generic [ref=e265]: G-34
          - button "Copy Room, G-35" [ref=e267] [cursor=pointer]:
            - generic [ref=e269]: Copy Room
          - button "Archives Room, G-36" [ref=e271] [cursor=pointer]:
            - generic [ref=e273]: Archives Room
          - button "Garbage Chute, G-37" [ref=e275] [cursor=pointer]:
            - generic [ref=e277]: Garbage Chute
          - button "Control Room, G-38" [ref=e279] [cursor=pointer]:
            - generic [ref=e281]: Control Room
            - generic [ref=e282]: G-38
          - button "Services, G-39" [ref=e284] [cursor=pointer]:
            - generic [ref=e286]: Services
          - button "Storage, G-40" [ref=e288] [cursor=pointer]:
            - generic [ref=e290]: Storage
          - button "Female Toilet, G-41" [ref=e292] [cursor=pointer]:
            - generic [ref=e294]: Female Toilet
          - button "Male Toilet, G-42" [ref=e296] [cursor=pointer]:
            - generic [ref=e298]: Male Toilet
            - generic [ref=e299]: G-42
          - button "Mechanical Lab, G-43" [ref=e301] [cursor=pointer]:
            - generic [ref=e303]: Mechanical Lab
            - generic [ref=e304]: G-43
          - button "Av Control Room, G-44" [ref=e306] [cursor=pointer]:
            - generic [ref=e308]: Av Control Room
          - button "Physical Training Lab 1, G-45" [ref=e310] [cursor=pointer]:
            - generic [ref=e312]: Physical Training Lab 1
            - generic [ref=e313]: G-45
          - button "Physical Training Lab 2, G-46" [ref=e315] [cursor=pointer]:
            - generic [ref=e317]: Physical Training Lab 2
          - button "Av Studio, G-47" [ref=e319] [cursor=pointer]:
            - generic [ref=e321]: Av Studio
            - generic [ref=e322]: G-47
          - button "Service Room, G-48" [ref=e324] [cursor=pointer]:
            - generic [ref=e326]: Service Room
            - generic [ref=e327]: G-48
          - button "Hvac Cabinet, G-49" [ref=e329] [cursor=pointer]:
            - generic [ref=e331]: Hvac Cabinet
            - generic [ref=e332]: G-49
          - button "Visual Training Lab 1, G-50" [ref=e334] [cursor=pointer]:
            - generic [ref=e336]: Visual Training Lab 1
          - button "It Room, G-51" [ref=e338] [cursor=pointer]:
            - generic [ref=e340]: It Room
          - button "Elect Room, G-52" [ref=e342] [cursor=pointer]:
            - generic [ref=e344]: Elect Room
          - button "Elevator Lobby, G-53" [ref=e346] [cursor=pointer]:
            - generic [ref=e348]: Elevator Lobby
            - generic [ref=e349]: G-53
          - button "Stairs 5, G-54" [ref=e351] [cursor=pointer]:
            - generic [ref=e353]: Stairs 5
            - generic [ref=e354]: G-54
        - generic: Outlines under review
        - group "Map controls" [ref=e355]:
          - button "Zoom in" [ref=e356] [cursor=pointer]
          - button "Zoom out" [ref=e358] [cursor=pointer]
          - button "Reset map view" [ref=e361] [cursor=pointer]
        - complementary "Room details" [ref=e365]:
          - generic [ref=e366]:
            - paragraph [ref=e367]: DESTINATION DETAILS
            - button "Close" [ref=e368] [cursor=pointer]
          - generic [ref=e372]:
            - 'img "Source floor drawing: Corridor 1 · G-02" [ref=e373]'
            - generic [ref=e376]: Drawing detail
          - generic [ref=e377]:
            - generic [ref=e378]:
              - text: Circulation
              - generic [ref=e380]: G-02
            - heading "Corridor 1" [level=2] [ref=e381]
            - paragraph [ref=e382]: الممر ١
            - button "Sign language description شرح بلغة الإشارة" [ref=e383] [cursor=pointer]:
              - generic [ref=e391]:
                - strong [ref=e392]: Sign language description
                - generic [ref=e393]: شرح بلغة الإشارة
            - paragraph [ref=e396]:
              - text: Building
              - generic [ref=e401]: B03
              - generic [ref=e402]: ·
              - text: Ground Floor
            - paragraph [ref=e403]: Verified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.
            - generic [ref=e404]: Room outline not yet verified
            - paragraph [ref=e408]: Route ends at the source label approach in this open circulation space. No physical doorway is implied.
            - generic [ref=e409]:
              - button "Go here" [ref=e410] [cursor=pointer]
              - button "Start here" [ref=e415] [cursor=pointer]
            - generic [ref=e419]:
              - button "Replay description" [ref=e420] [cursor=pointer]:
                - generic [ref=e423]: Listen to description
              - button "Stop audio" [ref=e424] [cursor=pointer]
        - generic [ref=e427]:
          - generic [ref=e428]:
            - generic [ref=e429]: Room marker
            - generic [ref=e431]: Selected
          - button "Reset route / start" [ref=e433] [cursor=pointer]
    - contentinfo [ref=e437]:
      - generic [ref=e438]: B03 / Ground Floor
      - generic [ref=e441]: Kiosk position not configured
      - generic [ref=e442]: Physical accessibility has not been verified.
    - generic [ref=e446]: "Selected room: Corridor 1, G-02."
  - alert [ref=e447]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import {mkdirSync, writeFileSync} from 'node:fs';
  4   | const artifactDirectory = process.env.QA_ARTIFACT_DIR || 'artifacts/qa';
  5   | mkdirSync(artifactDirectory, {recursive:true});
  6   | 
  7   | async function ready(page:Page) {
  8   |  await page.goto('/');
  9   |  // The current application opens in Navigate mode; switch to Browse for
  10  |  // directory/search journeys used by this suite.
  11  |  if (await page.getByTestId('room-directory').count() === 0) {
  12  |   await page.getByRole('button',{name:'Browse',exact:true}).click();
  13  |  }
  14  |  await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(54);
  15  |  await expect(page.locator('.map-label')).toHaveCount(54);
  16  |  await page.evaluate(()=>document.fonts.ready);
  17  | }
  18  | 
  19  | async function showNavigation(page:Page) {
  20  |  if (await page.getByTestId('start-select').count() === 0) {
  21  |   await page.getByRole('button',{name:/^(Navigate|التنقل)$/}).click();
  22  |  }
  23  | }
  24  | 
  25  | test('route playback progressively reveals, pauses, stops, and resets', async ({page}) => {
  26  |  await page.emulateMedia({reducedMotion:'no-preference'});
  27  |  await ready(page);
  28  |  const time = new Date('2026-10-10T12:00:00Z');
  29  |  await page.clock.install({time});
  30  |  await page.clock.pauseAt(time);
  31  |  await page.getByRole('button',{name:'Navigate',exact:true}).click();
  32  |  await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
  33  |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  34  |  const progress = page.getByTestId('route-status').locator('progress');
  35  |  await expect(progress).toHaveAttribute('value','0');
  36  |  // Selecting a destination starts playback automatically.
  37  |  await expect(page.getByTestId('playback-toggle')).toHaveText('Pause route playback');
  38  |  await page.clock.runFor(100);
  39  |  await expect.poll(async()=>Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
  40  |  const mid = Number(await progress.getAttribute('value'));
  41  |  expect(mid).toBeLessThan(1);
  42  |  await page.getByTestId('playback-toggle').click();
  43  |  await expect(page.getByTestId('playback-toggle')).toHaveText('Start route playback');
  44  |  await page.getByTestId('playback-stop').click();
  45  |  await expect(progress).toHaveAttribute('value','0');
  46  |  await expect(page.getByTestId('playback-stop')).toBeDisabled();
  47  |  await page.getByTestId('playback-toggle').click();
  48  |  await page.clock.runFor(100);
  49  |  await expect.poll(async()=>Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
  50  |  await page.getByTestId('playback-reset').click();
  51  |  await expect(progress).toHaveAttribute('value','0');
  52  | });
  53  | 
  54  | test('reduced motion completes route without progressive animation', async ({page}) => {
  55  |  await page.emulateMedia({reducedMotion:'reduce'});
  56  |  await ready(page);
  57  |  await page.getByRole('button',{name:'Navigate',exact:true}).click();
  58  |  await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
  59  |  await expect(page.getByTestId('playback-toggle')).toBeDisabled();
  60  |  await expect(page.getByTestId('route-status').locator('progress')).toHaveAttribute('value','1');
  61  | });
  62  | 
  63  | test('unavailable destination remains discoverable but blocks route start (US2)', async ({page}) => {
  64  |  test.fail(true, 'Known product gap: WayfindingApp does not gate route actions on Room.availability.status.');
  65  |  await ready(page);
  66  |  await page.getByRole('searchbox').fill('G-28');
  67  |  const room = page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');
  68  |  await expect(room).toBeVisible();
  69  |  await room.click();
  70  |  await expect(page.getByTestId('room-details')).toContainText('Clinic');
  71  |  await expect(page.getByTestId('room-details')).toContainText('Temporarily unavailable');
  72  |  await expect(page.getByRole('button',{name:'Go here',exact:true})).toBeDisabled();
  73  | });
  74  | test('English actual entrance and cross-wing routes, keyboard, planning reset and map controls',async({page})=>{
  75  |  await ready(page);
  76  |  await page.getByRole('searchbox').fill('G-28');
  77  |  const clinic=page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');
  78  |  await page.getByRole('searchbox').focus();
  79  |  for(let i=0;i<4;i++){if(await clinic.evaluate(e=>e===document.activeElement))break;await page.keyboard.press('Tab');}
  80  |  await expect(clinic).toBeFocused();
  81  |  await expect(clinic).toHaveCSS('outline-style','solid');
  82  |  await page.keyboard.press('Enter');
  83  |  await expect(page.getByTestId('room-details')).toContainText('Clinic');
  84  |  await page.getByRole('button',{name:'Go here',exact:true}).click();
  85  |  await showNavigation(page);
  86  |  await expect(page.getByTestId('route-status')).toContainText('Route on floor plan');
  87  |  await expect(page.getByTestId('arrival-note')).toContainText('Reception');
  88  |  await expect(page.getByTestId('route-status')).not.toContainText('You have arrived at your destination.');
  89  |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  90  |  await expect(page.getByTestId('kiosk-status')).toContainText('not your current location');
  91  |  await expect(page.getByTestId('start-select').locator('option:checked')).toContainText('Main Entrance');
  92  |  await page.getByTestId('start-select').selectOption('B03-GF-G-45');
  93  |  await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
  94  |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  95  |  await page.getByTestId('start-select').selectOption('B03-GF-G-54');
  96  |  await page.getByTestId('destination-select').selectOption('B03-GF-G-02');
  97  |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  98  |  await page.getByRole('button',{name:'Use default starting point',exact:true}).click();
  99  |  await expect(page.getByTestId('start-select')).toHaveValue('');
> 100 |  await page.getByTestId('reset-kiosk').click();
      |                                        ^ Error: locator.click: Test timeout of 60000ms exceeded.
  101 |  await expect(page.getByTestId('room-details')).toHaveCount(0);
  102 |  await expect(page.getByTestId('destination-select')).toHaveValue('');
  103 |  await page.getByRole('button',{name:'Browse',exact:true}).click();
  104 |  await expect(page.getByRole('searchbox')).toHaveValue('');
  105 |  await page.locator('.map-label[aria-label="Main Entrance, G-01"]').click();
  106 |  await expect(page.getByTestId('room-details')).toContainText('Main Entrance');
  107 |  await page.getByRole('button',{name:'Close',exact:true}).click();
  108 |  const before=await page.locator('.map-label[aria-label="Main Entrance, G-01"]').boundingBox();
  109 |  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  110 |  await expect.poll(async()=>JSON.stringify(await page.locator('.map-label[aria-label="Main Entrance, G-01"]').boundingBox())).not.toBe(JSON.stringify(before));
  111 |  await page.getByRole('button',{name:'Zoom out',exact:true}).click();
  112 |  await page.getByRole('button',{name:'Reset map view',exact:true}).click();
  113 | });
  114 | 
  115 | test('Arabic actual route, popup and language switch preserve selected endpoints',async({page})=>{
  116 |  await ready(page); await page.getByTestId('language-toggle').click();
  117 |  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  118 |  await expect(page.locator('html')).toHaveAttribute('lang','ar');
  119 |  await page.getByRole('searchbox').fill('الْعِيَادَة');
  120 |  await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
  121 |  await expect(page.getByTestId('room-details')).toContainText('العيادة');
  122 |  await page.getByRole('button',{name:'اذهب إلى هنا',exact:true}).click();
  123 |  await showNavigation(page);
  124 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  125 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  126 |  await page.getByTestId('start-select').selectOption('B03-GF-G-45');
  127 |  await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
  128 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  129 |  await page.getByTestId('language-toggle').click();
  130 |  await expect(page.getByTestId('start-select')).toHaveValue('B03-GF-G-45');
  131 |  await expect(page.getByTestId('destination-select')).toHaveValue('B03-GF-G-05');
  132 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  133 |  await expect(page.getByTestId('room-details')).toContainText('Auditorium');
  134 | });
  135 | 
  136 | test('destination labels lead with source room names in English and Arabic',async({page})=>{
  137 |  await ready(page);
  138 |  await page.getByRole('button',{name:'Navigate',exact:true}).click();
  139 |  const destination=page.getByTestId('destination-select');
  140 |  await expect(destination.locator('option[value="B03-GF-G-43"]')).toHaveText('Mechanical Lab — G-43');
  141 |  await destination.selectOption('B03-GF-G-43');
  142 |  await expect(page.locator('.map-label[aria-label="Mechanical Lab, G-43"]')).toHaveCount(1);
  143 |  await page.getByTestId('language-toggle').click();
  144 |  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  145 |  await expect(page.getByTestId('destination-select').locator('option[value="B03-GF-G-43"]')).toContainText('G-43');
  146 |  await expect(page.getByTestId('destination-select').locator('option[value="B03-GF-G-43"]')).not.toHaveText('G-43');
  147 |  await expect(page.locator('.map-label[aria-label="المعمل الميكانيكي, G-43"]')).toHaveCount(1);
  148 | });
  149 | 
  150 | test('browser speech autoplays details and replay/stop/mute honor current language',async({page})=>{
  151 |  await page.addInitScript(()=>{
  152 |   const state={spoken:[] as {text:string,lang:string}[], cancels:0};
  153 |   Object.assign(window,{qaSpeech:state});
  154 |   Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{lang='';constructor(public text:string){}}});
  155 |   Object.defineProperty(window,'speechSynthesis',{value:{speak:(u:{text:string,lang:string})=>state.spoken.push({text:u.text,lang:u.lang}),cancel:()=>state.cancels++,getVoices:()=>[]}});
  156 |  });
  157 |  await ready(page);
  158 |  await page.getByRole('searchbox').fill('G-28');
  159 |  await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
  160 |  await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:{text:string}[]}}).qaSpeech.spoken.at(-1)?.text)).toContain('Clinic');
  161 |  await page.getByRole('button',{name:'Replay description',exact:true}).click();
  162 |  await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:unknown[]}}).qaSpeech.spoken.length)).toBe(2);
  163 |  await page.getByRole('button',{name:'Stop audio',exact:true}).click();
  164 |  await page.getByRole('button',{name:'Mute audio',exact:true}).click();
  165 |  await page.getByTestId('language-toggle').click();
  166 |  await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:unknown[]}}).qaSpeech.spoken.length)).toBe(2);
  167 |  await page.getByRole('button',{name:'إلغاء كتم الصوت',exact:true}).click();
  168 |  await page.getByRole('button',{name:'إعادة تشغيل الوصف',exact:true}).click();
  169 |  await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:{lang:string}[]}}).qaSpeech.spoken.at(-1)?.lang)).toBe('ar');
  170 | });
  171 | 
  172 | test('WCAG AA contrast and semantics on English/Arabic default and popup states',async({page})=>{
  173 |  test.setTimeout(180000);
  174 |  await ready(page);
  175 |  const violations=[];
  176 |  for(const state of ['en-default','en-popup','en-route','ar-popup','ar-mobile']) {
  177 |   if(state==='en-popup') {await page.getByRole('searchbox').fill('G-28');await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();}
  178 |   if(state==='ar-popup') await page.getByTestId('language-toggle').click();
  179 |   if(state==='en-route') { await page.getByRole('button',{name:'Go here',exact:true}).click(); await showNavigation(page); }
  180 |   if(state==='ar-mobile') await page.setViewportSize({width:390,height:844});
  181 |   await page.evaluate(()=>document.fonts.ready);
  182 |   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  183 |   violations.push({state,violations:result.violations});
  184 |  }
  185 |  await test.info().attach('axe-results',{body:JSON.stringify(violations,null,2),contentType:'application/json'});
  186 |  expect(violations.flatMap(s=>s.violations.map(v=>({state:s.state,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})))).toEqual([]);
  187 | });
  188 | 
  189 | test('mobile and 200 percent text retain usable controls without horizontal overflow',async({page})=>{
  190 |  await page.setViewportSize({width:390,height:844}); await ready(page);
  191 |  await page.getByRole('searchbox').fill('G-28');
  192 |  await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
  193 |  await page.getByRole('button',{name:'Go here',exact:true}).click();
  194 |  await showNavigation(page);
  195 |  await expect(page.getByTestId('route-status')).toBeVisible();
  196 |  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  197 |  await page.getByTestId('language-toggle').click();
  198 |  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  199 |  await page.setViewportSize({width:1440,height:1000});
  200 |  await page.evaluate(()=>{const sizes=[...document.querySelectorAll<HTMLElement>('body *')].map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const {e,size} of sizes)e.style.fontSize=`${size*2}px`;});
```