# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wayfinding.qa.spec.ts >> mobile and 200 percent text retain usable controls without horizontal overflow
- Location: tests\e2e\wayfinding.qa.spec.ts:189:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Go here', exact: true })
    - locator resolved to <button class="primary-button">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
      - waiting 100ms
    95 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - element is outside of the viewport
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
      - generic [ref=e10]:
        - button "Switch to Arabic" [ref=e11] [cursor=pointer]:
          - generic [ref=e12]: EN
          - generic [ref=e14]: العربية
        - button "Mute audio" [ref=e15] [cursor=pointer]
    - main [ref=e20]:
      - complementary "Room directory" [ref=e21]:
        - generic [ref=e22]:
          - paragraph [ref=e23]: Building B03 · Ground Floor
          - heading "Where would you like to go?" [level=1] [ref=e24]
          - paragraph [ref=e25]: One floor. Every destination.
        - group "Plan your visit" [ref=e26]:
          - button "Browse" [pressed] [ref=e27] [cursor=pointer]
          - button "Navigate" [ref=e32] [cursor=pointer]
        - generic [ref=e35]:
          - generic [ref=e39]: Search rooms
          - searchbox "Search rooms" [ref=e40]: G-28
          - button "Clear search" [ref=e41] [cursor=pointer]
        - generic [ref=e45]:
          - generic [ref=e46]: Filter by category
          - combobox "Filter by category" [ref=e47]:
            - option "All spaces" [selected]
            - option "Circulation"
            - option "Other"
            - option "Service"
            - option "Restroom"
            - option "Office"
            - option "Laboratory"
          - generic [ref=e48]: 1 spaces
        - generic "Search results" [ref=e49]:
          - button "Clinic G-28 · Other" [active] [pressed] [ref=e50] [cursor=pointer]:
            - generic [ref=e55]:
              - strong [ref=e56]: Clinic
              - generic [ref=e57]: G-28 · Other
      - region "Floor map" [ref=e60]:
        - generic:
          - generic [ref=e61]:
            - paragraph [ref=e62]: Floor overview
            - heading "Ground Floor" [level=2] [ref=e63]
            - paragraph [ref=e64]: 54 rooms on this floor · B03
          - generic [ref=e65]:
            - generic [ref=e70]: Floor
            - combobox "Floor" [ref=e71] [cursor=pointer]:
              - option "Ground Floor · GF" [selected]
              - option "First Floor · 01"
        - generic "Floor map" [ref=e75]:
          - button "Main Entrance, G-01" [ref=e79] [cursor=pointer]:
            - generic [ref=e81]: Main Entrance
          - button "Corridor 1, G-02" [ref=e83] [cursor=pointer]:
            - generic [ref=e85]: Corridor 1
          - button "Corridor 2, G-03" [ref=e87] [cursor=pointer]:
            - generic [ref=e89]: Corridor 2
            - generic [ref=e90]: G-03
          - button "Corridor 3, G-04" [ref=e92] [cursor=pointer]:
            - generic [ref=e94]: Corridor 3
          - button "Auditorium, G-05" [ref=e96] [cursor=pointer]:
            - generic [ref=e98]: Auditorium
          - button "Storage, G-06" [ref=e100] [cursor=pointer]:
            - generic [ref=e102]: Storage
            - generic [ref=e103]: G-06
          - button "Vip Salon, G-07" [ref=e105] [cursor=pointer]:
            - generic [ref=e107]: Vip Salon
          - button "Stairs 3, G-08" [ref=e109] [cursor=pointer]:
            - generic [ref=e111]: Stairs 3
          - button "Elevator Lobby, G-09" [ref=e113] [cursor=pointer]:
            - generic [ref=e115]: Elevator Lobby
          - button "Valve Room, G-10" [ref=e117] [cursor=pointer]:
            - generic [ref=e119]: Valve Room
          - button "Storage, G-11" [ref=e121] [cursor=pointer]:
            - generic [ref=e123]: Storage
          - button "Female Toilets, G-12" [ref=e125] [cursor=pointer]:
            - generic [ref=e127]: Female Toilets
          - button "Male Toilets, G-13" [ref=e129] [cursor=pointer]:
            - generic [ref=e131]: Male Toilets
          - button "Lobby, G-14" [ref=e133] [cursor=pointer]:
            - generic [ref=e135]: Lobby
          - button "Translation Room, G-15" [ref=e137] [cursor=pointer]:
            - generic [ref=e139]: Translation Room
          - button "Audio Visual, G-16" [ref=e141] [cursor=pointer]:
            - generic [ref=e143]: Audio Visual
          - button "Stairs 4, G-17" [ref=e145] [cursor=pointer]:
            - generic [ref=e147]: Stairs 4
          - button "Cafeteria, G-18" [ref=e149] [cursor=pointer]:
            - generic [ref=e151]: Cafeteria
          - button "Service, G-19" [ref=e153] [cursor=pointer]:
            - generic [ref=e155]: Service
            - generic [ref=e156]: G-19
          - button "Kitchen, G-20" [ref=e158] [cursor=pointer]:
            - generic [ref=e160]: Kitchen
          - button "Storage, G-21" [ref=e162] [cursor=pointer]:
            - generic [ref=e164]: Storage
          - button "Security Room, G-22" [ref=e166] [cursor=pointer]:
            - generic [ref=e168]: Security Room
          - button "Stair 02, G-23" [ref=e170] [cursor=pointer]:
            - generic [ref=e172]: Stair 02
          - button "Exhibition Room, G-24" [ref=e174] [cursor=pointer]:
            - generic [ref=e176]: Exhibition Room
          - button "Operations Office, G-25" [ref=e178] [cursor=pointer]:
            - generic [ref=e180]: Operations Office
          - button "Skylight, G-26" [ref=e182] [cursor=pointer]:
            - generic [ref=e184]: Skylight
          - button "Reception, G-27" [ref=e186] [cursor=pointer]:
            - generic [ref=e188]: Reception
          - button "Clinic, G-28" [pressed] [ref=e190] [cursor=pointer]:
            - generic [ref=e192]: Clinic
            - generic [ref=e193]: G-28
          - button "Lounge, G-29" [ref=e195] [cursor=pointer]:
            - generic [ref=e197]: Lounge
          - button "Meeting Room, G-30" [ref=e199] [cursor=pointer]:
            - generic [ref=e201]: Meeting Room
          - button "Lobby, G-31" [ref=e203] [cursor=pointer]:
            - generic [ref=e205]: Lobby
          - button "Stairs 1, G-32" [ref=e207] [cursor=pointer]:
            - generic [ref=e209]: Stairs 1
          - button "Prayer Room, G-33" [ref=e211] [cursor=pointer]:
            - generic [ref=e213]: Prayer Room
          - button "Storage, G-34" [ref=e215] [cursor=pointer]:
            - generic [ref=e217]: Storage
          - button "Copy Room, G-35" [ref=e219] [cursor=pointer]:
            - generic [ref=e221]: Copy Room
          - button "Archives Room, G-36" [ref=e223] [cursor=pointer]:
            - generic [ref=e225]: Archives Room
          - button "Garbage Chute, G-37" [ref=e227] [cursor=pointer]:
            - generic [ref=e229]: Garbage Chute
          - button "Control Room, G-38" [ref=e231] [cursor=pointer]:
            - generic [ref=e233]: Control Room
          - button "Services, G-39" [ref=e235] [cursor=pointer]:
            - generic [ref=e237]: Services
          - button "Storage, G-40" [ref=e239] [cursor=pointer]:
            - generic [ref=e241]: Storage
          - button "Female Toilet, G-41" [ref=e243] [cursor=pointer]:
            - generic [ref=e245]: Female Toilet
          - button "Male Toilet, G-42" [ref=e247] [cursor=pointer]:
            - generic [ref=e249]: Male Toilet
          - button "Mechanical Lab, G-43" [ref=e251] [cursor=pointer]:
            - generic [ref=e253]: Mechanical Lab
            - generic [ref=e254]: G-43
          - button "Av Control Room, G-44" [ref=e256] [cursor=pointer]:
            - generic [ref=e258]: Av Control Room
          - button "Physical Training Lab 1, G-45" [ref=e260] [cursor=pointer]:
            - generic [ref=e262]: Physical Training Lab 1
          - button "Physical Training Lab 2, G-46" [ref=e264] [cursor=pointer]:
            - generic [ref=e266]: Physical Training Lab 2
          - button "Av Studio, G-47" [ref=e268] [cursor=pointer]:
            - generic [ref=e270]: Av Studio
          - button "Service Room, G-48" [ref=e272] [cursor=pointer]:
            - generic [ref=e274]: Service Room
          - button "Hvac Cabinet, G-49" [ref=e276] [cursor=pointer]:
            - generic [ref=e278]: Hvac Cabinet
          - button "Visual Training Lab 1, G-50" [ref=e280] [cursor=pointer]:
            - generic [ref=e282]: Visual Training Lab 1
          - button "It Room, G-51" [ref=e284] [cursor=pointer]:
            - generic [ref=e286]: It Room
          - button "Elect Room, G-52" [ref=e288] [cursor=pointer]:
            - generic [ref=e290]: Elect Room
          - button "Elevator Lobby, G-53" [ref=e292] [cursor=pointer]:
            - generic [ref=e294]: Elevator Lobby
          - button "Stairs 5, G-54" [ref=e296] [cursor=pointer]:
            - generic [ref=e298]: Stairs 5
        - group "Map controls" [ref=e299]:
          - button "Zoom in" [ref=e300] [cursor=pointer]
          - button "Zoom out" [ref=e302] [cursor=pointer]
          - button "Reset map view" [ref=e305] [cursor=pointer]
        - complementary "Room details" [ref=e309]:
          - generic [ref=e310]:
            - paragraph [ref=e311]: DESTINATION DETAILS
            - button "Close" [ref=e312] [cursor=pointer]
          - generic [ref=e316]:
            - 'img "Source floor drawing: Clinic · G-28" [ref=e317]'
            - generic [ref=e320]: Drawing detail
          - generic [ref=e321]:
            - generic [ref=e322]:
              - text: Other
              - generic [ref=e324]: G-28
            - heading "Clinic" [level=2] [ref=e325]
            - paragraph [ref=e326]: العيادة
            - button "Sign language description شرح بلغة الإشارة" [ref=e327] [cursor=pointer]:
              - generic [ref=e335]:
                - strong [ref=e336]: Sign language description
                - generic [ref=e337]: شرح بلغة الإشارة
            - paragraph [ref=e340]:
              - text: Building
              - generic [ref=e345]: B03
              - generic [ref=e346]: ·
              - text: Ground Floor
            - paragraph [ref=e347]: Verified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.
            - generic [ref=e348]: Candidate room outline — awaiting review
            - paragraph [ref=e352]: Route ends at Reception entrance; continue through Reception to Clinic.
            - generic [ref=e353]:
              - button "Go here" [ref=e354] [cursor=pointer]
              - button "Start here" [ref=e359] [cursor=pointer]
            - generic [ref=e363]:
              - button "Replay description" [ref=e364] [cursor=pointer]:
                - generic [ref=e367]: Listen to description
              - button "Stop audio" [ref=e368] [cursor=pointer]
        - generic [ref=e371]:
          - generic [ref=e372]:
            - generic [ref=e373]: Room marker
            - generic [ref=e375]: Selected
          - button "Reset route / start" [ref=e377] [cursor=pointer]
    - contentinfo [ref=e381]:
      - generic [ref=e382]: B03 / Ground Floor
      - generic [ref=e385]: Kiosk position not configured
    - generic [ref=e386]: "Selected room: Clinic, G-28."
  - alert [ref=e387]
```

# Test source

```ts
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
> 193 |  await page.getByRole('button',{name:'Go here',exact:true}).click();
      |                                                             ^ Error: locator.click: Test timeout of 60000ms exceeded.
  194 |  await showNavigation(page);
  195 |  await expect(page.getByTestId('route-status')).toBeVisible();
  196 |  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  197 |  await page.getByTestId('language-toggle').click();
  198 |  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  199 |  await page.setViewportSize({width:1440,height:1000});
  200 |  await page.evaluate(()=>{const sizes=[...document.querySelectorAll<HTMLElement>('body *')].map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const {e,size} of sizes)e.style.fontSize=`${size*2}px`;});
  201 |  await expect(page.getByTestId('language-toggle')).toBeVisible();
  202 |  await page.getByTestId('reset-kiosk').click();
  203 |  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  204 |  await ready(page); await page.getByRole('searchbox').fill('G-28');
  205 |  await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
  206 |  await page.getByTestId('language-toggle').click();
  207 |  await page.evaluate(()=>{const sizes=[...document.querySelectorAll<HTMLElement>('body *')].map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const {e,size} of sizes)e.style.fontSize=`${size*2}px`;});
  208 |  await page.getByRole('button',{name:'اذهب إلى هنا',exact:true}).click();
  209 |  await showNavigation(page);
  210 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  211 |  await expect(page.getByTestId('floor-map')).toBeVisible();
  212 |  expect((await page.getByTestId('floor-map').boundingBox())!.height).toBeGreaterThan(150);
  213 |  await page.screenshot({path:`${artifactDirectory}/r2-text-200-percent-ar.png`,fullPage:true});
  214 |  const brand=await page.locator('.brand').boundingBox();
  215 |  expect(brand?.y).toBeGreaterThanOrEqual(0);
  216 | });
  217 | 
  218 | test('reviewed raised-scene visual baselines: default, popup, successful route, Arabic, mobile',async({page})=>{
  219 |  const start=Date.now();await ready(page);
  220 |  const performanceData=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),scripts:performance.getEntriesByType('resource').filter(e=>(e as PerformanceResourceTiming).initiatorType==='script').map(e=>({name:e.name,transferSize:(e as PerformanceResourceTiming).transferSize,duration:e.duration}))}));
  221 |  writeFileSync(`${artifactDirectory}/performance-observation.json`,JSON.stringify({baseURL:test.info().project.use.baseURL,mapAndFontsReadyMs:Date.now()-start,...performanceData,scope:'One local headless Edge observation, not a kiosk hardware benchmark'},null,2));
  222 |  const snapshot=async(name:string)=>{await expect(page).toHaveScreenshot(name,{fullPage:true,maxDiffPixelRatio:.005,animations:'disabled'});await page.screenshot({path:`${artifactDirectory}/${name}`,fullPage:true});};
  223 |  await snapshot('r2-default-en.png');
  224 |  await page.getByRole('searchbox').fill('G-28');await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
  225 |  await snapshot('r2-popup-en.png');
  226 |  await page.getByRole('button',{name:'Go here',exact:true}).click();
  227 |  await showNavigation(page);
  228 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  229 |  await snapshot('r2-route-success-en.png');
  230 |  await page.getByTestId('start-select').selectOption('B03-GF-G-45');
  231 |  await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
  232 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  233 |  await snapshot('r2-cross-wing-en.png');
  234 |  await page.getByTestId('language-toggle').click();
  235 |  await page.evaluate(()=>document.fonts.ready);
  236 |  expect(await page.evaluate(()=>document.fonts.check('16px "Noto Sans Arabic"'))).toBe(true);
  237 |  await expect(page.locator('.wayfinding-app')).toHaveCSS('font-family',/Noto Sans Arabic/);
  238 |  await snapshot('r2-popup-route-ar.png');
  239 |  await page.setViewportSize({width:390,height:844});
  240 |  await snapshot('r2-mobile-ar.png');
  241 | });
  242 | 
  243 | test('WebGL-unavailable fallback preserves source plan and usable keyboard directory',async({page})=>{
  244 |  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type==='webgl2')return null;return Reflect.apply(original,this,[type,...args]);} as typeof original;});
  245 |  await page.goto('/');
  246 |  await expect(page.locator('.map-fallback img')).toBeVisible();
  247 |  await page.getByRole('button',{name:'Browse',exact:true}).click();
  248 |  await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(54);
  249 |  await page.getByRole('searchbox').fill('G-28');
  250 |  const room=page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');await room.focus();await page.keyboard.press('Enter');
  251 |  await expect(page.getByTestId('room-details')).toContainText('Clinic');
  252 | });
  253 | 
  254 | test('forced colors and reduced motion preserve accessible directory and selection controls',async({page})=>{
  255 |  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce',contrast:'more'});
  256 |  await ready(page);
  257 |  await page.getByRole('searchbox').fill('G-28');
  258 |  const room=page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');
  259 |  await room.focus();await page.keyboard.press('Enter');
  260 |  await expect(page.getByTestId('room-details')).toContainText('Clinic');
  261 |  await expect(page.getByRole('button',{name:'Go here',exact:true})).toHaveCSS('transition-duration','0s');
  262 |  await page.getByRole('button',{name:'Go here',exact:true}).click();
  263 |  await showNavigation(page);
  264 |  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  265 |  await page.screenshot({path:`${artifactDirectory}/forced-colors-reduced-motion.png`,fullPage:true});
  266 |  await page.getByTestId('reset-kiosk').click();
  267 |  await expect(page.getByTestId('room-details')).toHaveCount(0);
  268 | });
  269 | 
  270 | 
  271 | 
  272 | test('three exterior destinations and reversed starts clearly retain partial source coverage',async({page})=>{
  273 |  await ready(page);await page.getByRole('button',{name:'Navigate',exact:true}).click();
  274 |  for(const code of ['06','17','23']) {
  275 |   await page.getByTestId('destination-select').selectOption(`B03-GF-G-${code}`);
  276 |   await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  277 |   await expect(page.getByTestId('route-status')).toContainText('Partial route');
  278 |   await expect(page.getByTestId('route-status')).not.toContainText('You have arrived at your destination.');
  279 |   await expect(page.getByTestId('room-details')).toContainText('Partial route');
  280 |  }
  281 |  await page.getByTestId('start-select').selectOption('B03-GF-G-06');
  282 |  await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
  283 |  await expect(page.getByTestId('route-status')).toContainText('Partial route');
  284 |  await page.getByTestId('language-toggle').click();
  285 |  await expect(page.getByTestId('route-status')).toContainText('مسار جزئي');
  286 |  await expect(page.getByTestId('route-status')).not.toContainText('لقد وصلت إلى وجهتك.');
  287 |  await page.screenshot({path:`${artifactDirectory}/r2-partial-route-ar.png`,fullPage:true});
  288 | });
  289 | 
```