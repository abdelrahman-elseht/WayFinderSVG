# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wayfinding.qa.spec.ts >> forced colors and reduced motion preserve accessible directory and selection controls
- Location: tests\e2e\wayfinding.qa.spec.ts:254:5

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
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

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
          - button "Navigate" [active] [pressed] [ref=e38] [cursor=pointer]
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
              - option "Clinic — G-28" [selected]
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
          - button "Use default starting point" [ref=e56] [cursor=pointer]
          - status [ref=e57]:
            - heading "Directions" [level=3] [ref=e58]
            - strong [ref=e59]: Route on floor plan
            - paragraph [ref=e60]: Follow the route on the drawing. Physical access and distance scale are unverified.
            - paragraph [ref=e61]: "Starting point: Route ends at the source label approach in this open circulation space. No physical doorway is implied."
            - paragraph [ref=e62]: Route ends at Reception entrance; continue through Reception to Clinic.
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
              - listitem [ref=e75]: Turn left.
              - listitem [ref=e76]: Continue straight.
              - listitem [ref=e77]: Turn left.
              - listitem [ref=e78]: Continue straight.
              - listitem [ref=e79]: The mapped entrance or approach is on the right.
              - listitem [ref=e80]: You have reached the mapped entrance or approach. Follow the destination note to continue.
            - group [ref=e81]:
              - button "Start route playback" [disabled] [ref=e82]
              - button "Stop route playback" [ref=e83] [cursor=pointer]
              - button "Reset route playback" [ref=e84] [cursor=pointer]
              - progressbar [ref=e85]
          - button "Clear route" [ref=e86] [cursor=pointer]
        - paragraph [ref=e94]: Directory listing does not confirm public access.
      - region "Floor map" [ref=e95]:
        - generic:
          - generic [ref=e96]:
            - paragraph [ref=e97]: Floor overview
            - heading "Ground Floor" [level=2] [ref=e98]
            - paragraph [ref=e99]: 54 rooms on this floor · B03
          - generic [ref=e100]:
            - generic [ref=e105]: Floor
            - combobox "Floor" [ref=e106] [cursor=pointer]:
              - option "Ground Floor · GF" [selected]
              - option "First Floor · 01"
        - generic "Floor map" [ref=e110]:
          - button "Main Entrance, G-01" [ref=e114] [cursor=pointer]:
            - generic [ref=e116]: Main Entrance
            - generic [ref=e117]: G-01
          - button "Corridor 1, G-02" [ref=e119] [cursor=pointer]:
            - generic [ref=e121]: Corridor 1
          - button "Corridor 2, G-03" [ref=e123] [cursor=pointer]:
            - generic [ref=e125]: Corridor 2
          - button "Corridor 3, G-04" [ref=e127] [cursor=pointer]:
            - generic [ref=e129]: Corridor 3
            - generic [ref=e130]: G-04
          - button "Auditorium, G-05" [ref=e132] [cursor=pointer]:
            - generic [ref=e134]: Auditorium
          - button "Storage, G-06" [ref=e136] [cursor=pointer]:
            - generic [ref=e138]: Storage
          - button "Vip Salon, G-07" [ref=e140] [cursor=pointer]:
            - generic [ref=e142]: Vip Salon
          - button "Stairs 3, G-08" [ref=e144] [cursor=pointer]:
            - generic [ref=e146]: Stairs 3
          - button "Elevator Lobby, G-09" [ref=e148] [cursor=pointer]:
            - generic [ref=e150]: Elevator Lobby
            - generic [ref=e151]: G-09
          - button "Valve Room, G-10" [ref=e153] [cursor=pointer]:
            - generic [ref=e155]: Valve Room
            - generic [ref=e156]: G-10
          - button "Storage, G-11" [ref=e158] [cursor=pointer]:
            - generic [ref=e160]: Storage
          - button "Female Toilets, G-12" [ref=e162] [cursor=pointer]:
            - generic [ref=e164]: Female Toilets
          - button "Male Toilets, G-13" [ref=e166] [cursor=pointer]:
            - generic [ref=e168]: Male Toilets
          - button "Lobby, G-14" [ref=e170] [cursor=pointer]:
            - generic [ref=e172]: Lobby
          - button "Translation Room, G-15" [ref=e174] [cursor=pointer]:
            - generic [ref=e176]: Translation Room
          - button "Audio Visual, G-16" [ref=e178] [cursor=pointer]:
            - generic [ref=e180]: Audio Visual
          - button "Stairs 4, G-17" [ref=e182] [cursor=pointer]:
            - generic [ref=e184]: Stairs 4
          - button "Cafeteria, G-18" [ref=e186] [cursor=pointer]:
            - generic [ref=e188]: Cafeteria
            - generic [ref=e189]: G-18
          - button "Service, G-19" [ref=e191] [cursor=pointer]:
            - generic [ref=e193]: Service
          - button "Kitchen, G-20" [ref=e195] [cursor=pointer]:
            - generic [ref=e197]: Kitchen
          - button "Storage, G-21" [ref=e199] [cursor=pointer]:
            - generic [ref=e201]: Storage
          - button "Security Room, G-22" [ref=e203] [cursor=pointer]:
            - generic [ref=e205]: Security Room
            - generic [ref=e206]: G-22
          - button "Stair 02, G-23" [ref=e208] [cursor=pointer]:
            - generic [ref=e210]: Stair 02
            - generic [ref=e211]: G-23
          - button "Exhibition Room, G-24" [ref=e213] [cursor=pointer]:
            - generic [ref=e215]: Exhibition Room
            - generic [ref=e216]: G-24
          - button "Operations Office, G-25" [ref=e218] [cursor=pointer]:
            - generic [ref=e220]: Operations Office
          - button "Skylight, G-26" [ref=e222] [cursor=pointer]:
            - generic [ref=e224]: Skylight
            - generic [ref=e225]: G-26
          - button "Reception, G-27" [ref=e227] [cursor=pointer]:
            - generic [ref=e229]: Reception
            - generic [ref=e230]: G-27
          - button "Clinic, G-28" [pressed] [ref=e232] [cursor=pointer]:
            - generic [ref=e234]: Clinic
            - generic [ref=e235]: G-28
          - button "Lounge, G-29" [ref=e237] [cursor=pointer]:
            - generic [ref=e239]: Lounge
          - button "Meeting Room, G-30" [ref=e241] [cursor=pointer]:
            - generic [ref=e243]: Meeting Room
          - button "Lobby, G-31" [ref=e245] [cursor=pointer]:
            - generic [ref=e247]: Lobby
          - button "Stairs 1, G-32" [ref=e249] [cursor=pointer]:
            - generic [ref=e251]: Stairs 1
          - button "Prayer Room, G-33" [ref=e253] [cursor=pointer]:
            - generic [ref=e255]: Prayer Room
          - button "Storage, G-34" [ref=e257] [cursor=pointer]:
            - generic [ref=e259]: Storage
          - button "Copy Room, G-35" [ref=e261] [cursor=pointer]:
            - generic [ref=e263]: Copy Room
          - button "Archives Room, G-36" [ref=e265] [cursor=pointer]:
            - generic [ref=e267]: Archives Room
          - button "Garbage Chute, G-37" [ref=e269] [cursor=pointer]:
            - generic [ref=e271]: Garbage Chute
          - button "Control Room, G-38" [ref=e273] [cursor=pointer]:
            - generic [ref=e275]: Control Room
          - button "Services, G-39" [ref=e277] [cursor=pointer]:
            - generic [ref=e279]: Services
          - button "Storage, G-40" [ref=e281] [cursor=pointer]:
            - generic [ref=e283]: Storage
          - button "Female Toilet, G-41" [ref=e285] [cursor=pointer]:
            - generic [ref=e287]: Female Toilet
          - button "Male Toilet, G-42" [ref=e289] [cursor=pointer]:
            - generic [ref=e291]: Male Toilet
          - button "Mechanical Lab, G-43" [ref=e293] [cursor=pointer]:
            - generic [ref=e295]: Mechanical Lab
          - button "Av Control Room, G-44" [ref=e297] [cursor=pointer]:
            - generic [ref=e299]: Av Control Room
          - button "Physical Training Lab 1, G-45" [ref=e301] [cursor=pointer]:
            - generic [ref=e303]: Physical Training Lab 1
          - button "Physical Training Lab 2, G-46" [ref=e305] [cursor=pointer]:
            - generic [ref=e307]: Physical Training Lab 2
          - button "Av Studio, G-47" [ref=e309] [cursor=pointer]:
            - generic [ref=e311]: Av Studio
            - generic [ref=e312]: G-47
          - button "Service Room, G-48" [ref=e314] [cursor=pointer]:
            - generic [ref=e316]: Service Room
          - button "Hvac Cabinet, G-49" [ref=e318] [cursor=pointer]:
            - generic [ref=e320]: Hvac Cabinet
          - button "Visual Training Lab 1, G-50" [ref=e322] [cursor=pointer]:
            - generic [ref=e324]: Visual Training Lab 1
            - generic [ref=e325]: G-50
          - button "It Room, G-51" [ref=e327] [cursor=pointer]:
            - generic [ref=e329]: It Room
          - button "Elect Room, G-52" [ref=e331] [cursor=pointer]:
            - generic [ref=e333]: Elect Room
          - button "Elevator Lobby, G-53" [ref=e335] [cursor=pointer]:
            - generic [ref=e337]: Elevator Lobby
            - generic [ref=e338]: G-53
          - button "Stairs 5, G-54" [ref=e340] [cursor=pointer]:
            - generic [ref=e342]: Stairs 5
        - generic: Outlines under review
        - group "Map controls" [ref=e343]:
          - button "Zoom in" [ref=e344] [cursor=pointer]
          - button "Zoom out" [ref=e346] [cursor=pointer]
          - button "Reset map view" [ref=e349] [cursor=pointer]
        - complementary "Room details" [ref=e353]:
          - generic [ref=e354]:
            - paragraph [ref=e355]: DESTINATION DETAILS
            - button "Close" [ref=e356] [cursor=pointer]
          - generic [ref=e360]:
            - 'img "Source floor drawing: Clinic · G-28" [ref=e361]'
            - generic [ref=e364]: Drawing detail
          - generic [ref=e365]:
            - generic [ref=e366]:
              - text: Other
              - generic [ref=e368]: G-28
            - heading "Clinic" [level=2] [ref=e369]
            - paragraph [ref=e370]: العيادة
            - button "Sign language description شرح بلغة الإشارة" [ref=e371] [cursor=pointer]:
              - generic [ref=e379]:
                - strong [ref=e380]: Sign language description
                - generic [ref=e381]: شرح بلغة الإشارة
            - paragraph [ref=e384]:
              - text: Building
              - generic [ref=e389]: B03
              - generic [ref=e390]: ·
              - text: Ground Floor
            - paragraph [ref=e391]: Verified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.
            - generic [ref=e392]: Candidate room outline — awaiting review
            - paragraph [ref=e396]: Route ends at Reception entrance; continue through Reception to Clinic.
            - generic [ref=e397]:
              - button "Go here" [ref=e398] [cursor=pointer]
              - button "Start here" [ref=e403] [cursor=pointer]
            - generic [ref=e407]:
              - button "Replay description" [ref=e408] [cursor=pointer]:
                - generic [ref=e411]: Listen to description
              - button "Stop audio" [ref=e412] [cursor=pointer]
        - generic [ref=e415]:
          - generic [ref=e416]:
            - generic [ref=e417]: Room marker
            - generic [ref=e419]: Selected
          - button "Reset route / start" [ref=e421] [cursor=pointer]
    - contentinfo [ref=e425]:
      - generic [ref=e426]: B03 / Ground Floor
      - generic [ref=e429]: Kiosk position not configured
      - generic [ref=e430]: Physical accessibility has not been verified.
    - generic [ref=e434]: "Selected room: Clinic, G-28."
  - alert [ref=e435]
```

# Test source

```ts
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
> 266 |  await page.getByTestId('reset-kiosk').click();
      |                                        ^ Error: locator.click: Test timeout of 60000ms exceeded.
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