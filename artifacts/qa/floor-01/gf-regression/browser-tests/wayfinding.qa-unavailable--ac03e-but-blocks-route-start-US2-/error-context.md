# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wayfinding.qa.spec.ts >> unavailable destination remains discoverable but blocks route start (US2)
- Location: tests\e2e\wayfinding.qa.spec.ts:63:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('room-details')
Expected substring: "Temporarily unavailable"
Received string:    "DESTINATION DETAILSDrawing detailOtherG-28ClinicالعيادةBuilding B03·Ground FloorVerified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.Candidate room outline — awaiting reviewRoute ends at Reception entrance; continue through Reception to Clinic.Go hereStart hereListen to description"
Timeout: 15000ms

Call log:
  - Expect "toContainText" getByTestId('room-details') with timeout 15000ms
  - waiting for getByTestId('room-details')
    33 × locator resolved to <aside class="detail-card" aria-label="Room details" data-testid="room-details">…</aside>
       - unexpected value "DESTINATION DETAILSDrawing detailOtherG-28ClinicالعيادةBuilding B03·Ground FloorVerified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.Candidate room outline — awaiting reviewRoute ends at Reception entrance; continue through Reception to Clinic.Go hereStart hereListen to description"

```

```yaml
- complementary "Room details":
  - paragraph: DESTINATION DETAILS
  - button "Close":
    - img
  - 'img "Source floor drawing: Clinic · G-28"'
  - text: Drawing detail Other G-28
  - heading "Clinic" [level=2]
  - paragraph: العيادة
  - paragraph:
    - img
    - text: Building B03 · Ground Floor
  - paragraph: Verified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.
  - img
  - text: Candidate room outline — awaiting review
  - paragraph: Route ends at Reception entrance; continue through Reception to Clinic.
  - button "Go here":
    - img
    - text: Go here
    - img
  - button "Start here":
    - img
    - text: Start here
  - button "Replay description":
    - img
    - text: Listen to description
  - button "Stop audio":
    - img
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
> 71  |  await expect(page.getByTestId('room-details')).toContainText('Temporarily unavailable');
      |                                                 ^ Error: expect(locator).toContainText(expected) failed
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
  100 |  await page.getByTestId('reset-kiosk').click();
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
```