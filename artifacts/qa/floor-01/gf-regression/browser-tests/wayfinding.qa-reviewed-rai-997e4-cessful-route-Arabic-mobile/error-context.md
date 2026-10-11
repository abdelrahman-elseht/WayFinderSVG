# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wayfinding.qa.spec.ts >> reviewed raised-scene visual baselines: default, popup, successful route, Arabic, mobile
- Location: tests\e2e\wayfinding.qa.spec.ts:218:5

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  22356 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: r2-default-en.png

Call log:
  - Expect "toHaveScreenshot(r2-default-en.png)" with timeout 15000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 22356 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 22356 pixels (ratio 0.02 of all image pixels) are different.

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
          - button "Browse" [active] [pressed] [ref=e33] [cursor=pointer]
          - button "Navigate" [ref=e38] [cursor=pointer]
        - generic [ref=e41]:
          - generic [ref=e45]: Search rooms
          - searchbox "Search rooms" [ref=e46]
        - generic [ref=e47]:
          - generic [ref=e48]: Filter by category
          - combobox "Filter by category" [ref=e49]:
            - option "All spaces" [selected]
            - option "Circulation"
            - option "Other"
            - option "Service"
            - option "Restroom"
            - option "Office"
            - option "Laboratory"
          - generic [ref=e50]: 54 spaces
        - generic "Search results" [ref=e51]:
          - button "Main Entrance G-01 · Circulation" [ref=e52] [cursor=pointer]:
            - generic [ref=e57]:
              - strong [ref=e58]: Main Entrance
              - generic [ref=e59]: G-01 · Circulation
          - button "Corridor 1 G-02 · Circulation" [ref=e63] [cursor=pointer]:
            - generic [ref=e68]:
              - strong [ref=e69]: Corridor 1
              - generic [ref=e70]: G-02 · Circulation
          - button "Corridor 2 G-03 · Circulation" [ref=e74] [cursor=pointer]:
            - generic [ref=e79]:
              - strong [ref=e80]: Corridor 2
              - generic [ref=e81]: G-03 · Circulation
          - button "Corridor 3 G-04 · Circulation" [ref=e85] [cursor=pointer]:
            - generic [ref=e90]:
              - strong [ref=e91]: Corridor 3
              - generic [ref=e92]: G-04 · Circulation
          - button "Auditorium G-05 · Other" [ref=e96] [cursor=pointer]:
            - generic [ref=e101]:
              - strong [ref=e102]: Auditorium
              - generic [ref=e103]: G-05 · Other
          - button "Storage G-06 · Service" [ref=e107] [cursor=pointer]:
            - generic [ref=e112]:
              - strong [ref=e113]: Storage
              - generic [ref=e114]: G-06 · Service
          - button "Vip Salon G-07 · Other" [ref=e118] [cursor=pointer]:
            - generic [ref=e123]:
              - strong [ref=e124]: Vip Salon
              - generic [ref=e125]: G-07 · Other
          - button "Stairs 3 G-08 · Circulation" [ref=e129] [cursor=pointer]:
            - generic [ref=e134]:
              - strong [ref=e135]: Stairs 3
              - generic [ref=e136]: G-08 · Circulation
          - button "Elevator Lobby G-09 · Circulation" [ref=e140] [cursor=pointer]:
            - generic [ref=e145]:
              - strong [ref=e146]: Elevator Lobby
              - generic [ref=e147]: G-09 · Circulation
          - button "Valve Room G-10 · Service" [ref=e151] [cursor=pointer]:
            - generic [ref=e156]:
              - strong [ref=e157]: Valve Room
              - generic [ref=e158]: G-10 · Service
          - button "Storage G-11 · Service" [ref=e162] [cursor=pointer]:
            - generic [ref=e167]:
              - strong [ref=e168]: Storage
              - generic [ref=e169]: G-11 · Service
          - button "Female Toilets G-12 · Restroom" [ref=e173] [cursor=pointer]:
            - generic [ref=e178]:
              - strong [ref=e179]: Female Toilets
              - generic [ref=e180]: G-12 · Restroom
          - button "Male Toilets G-13 · Restroom" [ref=e184] [cursor=pointer]:
            - generic [ref=e189]:
              - strong [ref=e190]: Male Toilets
              - generic [ref=e191]: G-13 · Restroom
          - button "Lobby G-14 · Circulation" [ref=e195] [cursor=pointer]:
            - generic [ref=e200]:
              - strong [ref=e201]: Lobby
              - generic [ref=e202]: G-14 · Circulation
          - button "Translation Room G-15 · Office" [ref=e206] [cursor=pointer]:
            - generic [ref=e211]:
              - strong [ref=e212]: Translation Room
              - generic [ref=e213]: G-15 · Office
          - button "Audio Visual G-16 · Other" [ref=e217] [cursor=pointer]:
            - generic [ref=e222]:
              - strong [ref=e223]: Audio Visual
              - generic [ref=e224]: G-16 · Other
          - button "Stairs 4 G-17 · Circulation" [ref=e228] [cursor=pointer]:
            - generic [ref=e233]:
              - strong [ref=e234]: Stairs 4
              - generic [ref=e235]: G-17 · Circulation
          - button "Cafeteria G-18 · Other" [ref=e239] [cursor=pointer]:
            - generic [ref=e244]:
              - strong [ref=e245]: Cafeteria
              - generic [ref=e246]: G-18 · Other
          - button "Service G-19 · Service" [ref=e250] [cursor=pointer]:
            - generic [ref=e255]:
              - strong [ref=e256]: Service
              - generic [ref=e257]: G-19 · Service
          - button "Kitchen G-20 · Service" [ref=e261] [cursor=pointer]:
            - generic [ref=e266]:
              - strong [ref=e267]: Kitchen
              - generic [ref=e268]: G-20 · Service
          - button "Storage G-21 · Service" [ref=e272] [cursor=pointer]:
            - generic [ref=e277]:
              - strong [ref=e278]: Storage
              - generic [ref=e279]: G-21 · Service
          - button "Security Room G-22 · Office" [ref=e283] [cursor=pointer]:
            - generic [ref=e288]:
              - strong [ref=e289]: Security Room
              - generic [ref=e290]: G-22 · Office
          - button "Stair 02 G-23 · Circulation" [ref=e294] [cursor=pointer]:
            - generic [ref=e299]:
              - strong [ref=e300]: Stair 02
              - generic [ref=e301]: G-23 · Circulation
          - button "Exhibition Room G-24 · Other" [ref=e305] [cursor=pointer]:
            - generic [ref=e310]:
              - strong [ref=e311]: Exhibition Room
              - generic [ref=e312]: G-24 · Other
          - button "Operations Office G-25 · Office" [ref=e316] [cursor=pointer]:
            - generic [ref=e321]:
              - strong [ref=e322]: Operations Office
              - generic [ref=e323]: G-25 · Office
          - button "Skylight G-26 · Other" [ref=e327] [cursor=pointer]:
            - generic [ref=e332]:
              - strong [ref=e333]: Skylight
              - generic [ref=e334]: G-26 · Other
          - button "Reception G-27 · Other" [ref=e338] [cursor=pointer]:
            - generic [ref=e343]:
              - strong [ref=e344]: Reception
              - generic [ref=e345]: G-27 · Other
          - button "Clinic G-28 · Other" [ref=e349] [cursor=pointer]:
            - generic [ref=e354]:
              - strong [ref=e355]: Clinic
              - generic [ref=e356]: G-28 · Other
          - button "Lounge G-29 · Other" [ref=e360] [cursor=pointer]:
            - generic [ref=e365]:
              - strong [ref=e366]: Lounge
              - generic [ref=e367]: G-29 · Other
          - button "Meeting Room G-30 · Office" [ref=e371] [cursor=pointer]:
            - generic [ref=e376]:
              - strong [ref=e377]: Meeting Room
              - generic [ref=e378]: G-30 · Office
          - button "Lobby G-31 · Circulation" [ref=e382] [cursor=pointer]:
            - generic [ref=e387]:
              - strong [ref=e388]: Lobby
              - generic [ref=e389]: G-31 · Circulation
          - button "Stairs 1 G-32 · Circulation" [ref=e393] [cursor=pointer]:
            - generic [ref=e398]:
              - strong [ref=e399]: Stairs 1
              - generic [ref=e400]: G-32 · Circulation
          - button "Prayer Room G-33 · Other" [ref=e404] [cursor=pointer]:
            - generic [ref=e409]:
              - strong [ref=e410]: Prayer Room
              - generic [ref=e411]: G-33 · Other
          - button "Storage G-34 · Service" [ref=e415] [cursor=pointer]:
            - generic [ref=e420]:
              - strong [ref=e421]: Storage
              - generic [ref=e422]: G-34 · Service
          - button "Copy Room G-35 · Service" [ref=e426] [cursor=pointer]:
            - generic [ref=e431]:
              - strong [ref=e432]: Copy Room
              - generic [ref=e433]: G-35 · Service
          - button "Archives Room G-36 · Service" [ref=e437] [cursor=pointer]:
            - generic [ref=e442]:
              - strong [ref=e443]: Archives Room
              - generic [ref=e444]: G-36 · Service
          - button "Garbage Chute G-37 · Service" [ref=e448] [cursor=pointer]:
            - generic [ref=e453]:
              - strong [ref=e454]: Garbage Chute
              - generic [ref=e455]: G-37 · Service
          - button "Control Room G-38 · Office" [ref=e459] [cursor=pointer]:
            - generic [ref=e464]:
              - strong [ref=e465]: Control Room
              - generic [ref=e466]: G-38 · Office
          - button "Services G-39 · Service" [ref=e470] [cursor=pointer]:
            - generic [ref=e475]:
              - strong [ref=e476]: Services
              - generic [ref=e477]: G-39 · Service
          - button "Storage G-40 · Service" [ref=e481] [cursor=pointer]:
            - generic [ref=e486]:
              - strong [ref=e487]: Storage
              - generic [ref=e488]: G-40 · Service
          - button "Female Toilet G-41 · Restroom" [ref=e492] [cursor=pointer]:
            - generic [ref=e497]:
              - strong [ref=e498]: Female Toilet
              - generic [ref=e499]: G-41 · Restroom
          - button "Male Toilet G-42 · Restroom" [ref=e503] [cursor=pointer]:
            - generic [ref=e508]:
              - strong [ref=e509]: Male Toilet
              - generic [ref=e510]: G-42 · Restroom
          - button "Mechanical Lab G-43 · Laboratory" [ref=e514] [cursor=pointer]:
            - generic [ref=e519]:
              - strong [ref=e520]: Mechanical Lab
              - generic [ref=e521]: G-43 · Laboratory
          - button "Av Control Room G-44 · Office" [ref=e525] [cursor=pointer]:
            - generic [ref=e530]:
              - strong [ref=e531]: Av Control Room
              - generic [ref=e532]: G-44 · Office
          - button "Physical Training Lab 1 G-45 · Laboratory" [ref=e536] [cursor=pointer]:
            - generic [ref=e541]:
              - strong [ref=e542]: Physical Training Lab 1
              - generic [ref=e543]: G-45 · Laboratory
          - button "Physical Training Lab 2 G-46 · Laboratory" [ref=e547] [cursor=pointer]:
            - generic [ref=e552]:
              - strong [ref=e553]: Physical Training Lab 2
              - generic [ref=e554]: G-46 · Laboratory
          - button "Av Studio G-47 · Laboratory" [ref=e558] [cursor=pointer]:
            - generic [ref=e563]:
              - strong [ref=e564]: Av Studio
              - generic [ref=e565]: G-47 · Laboratory
          - button "Service Room G-48 · Service" [ref=e569] [cursor=pointer]:
            - generic [ref=e574]:
              - strong [ref=e575]: Service Room
              - generic [ref=e576]: G-48 · Service
          - button "Hvac Cabinet G-49 · Service" [ref=e580] [cursor=pointer]:
            - generic [ref=e585]:
              - strong [ref=e586]: Hvac Cabinet
              - generic [ref=e587]: G-49 · Service
          - button "Visual Training Lab 1 G-50 · Laboratory" [ref=e591] [cursor=pointer]:
            - generic [ref=e596]:
              - strong [ref=e597]: Visual Training Lab 1
              - generic [ref=e598]: G-50 · Laboratory
          - button "It Room G-51 · Service" [ref=e602] [cursor=pointer]:
            - generic [ref=e607]:
              - strong [ref=e608]: It Room
              - generic [ref=e609]: G-51 · Service
          - button "Elect Room G-52 · Service" [ref=e613] [cursor=pointer]:
            - generic [ref=e618]:
              - strong [ref=e619]: Elect Room
              - generic [ref=e620]: G-52 · Service
          - button "Elevator Lobby G-53 · Circulation" [ref=e624] [cursor=pointer]:
            - generic [ref=e629]:
              - strong [ref=e630]: Elevator Lobby
              - generic [ref=e631]: G-53 · Circulation
          - button "Stairs 5 G-54 · Circulation" [ref=e635] [cursor=pointer]:
            - generic [ref=e640]:
              - strong [ref=e641]: Stairs 5
              - generic [ref=e642]: G-54 · Circulation
        - paragraph [ref=e650]: Directory listing does not confirm public access.
      - region "Floor map" [ref=e651]:
        - generic:
          - generic [ref=e652]:
            - paragraph [ref=e653]: Floor overview
            - heading "Ground Floor" [level=2] [ref=e654]
            - paragraph [ref=e655]: 54 rooms on this floor · B03
          - generic [ref=e656]:
            - generic [ref=e661]: Floor
            - combobox "Floor" [ref=e662]:
              - option "Ground Floor · GF" [selected]
        - generic "Floor map" [ref=e666]:
          - button "Main Entrance, G-01" [ref=e670] [cursor=pointer]:
            - generic [ref=e672]: Main Entrance
            - generic [ref=e673]: G-01
          - button "Corridor 1, G-02" [ref=e675] [cursor=pointer]:
            - generic [ref=e677]: Corridor 1
            - generic [ref=e678]: G-02
          - button "Corridor 2, G-03" [ref=e680] [cursor=pointer]:
            - generic [ref=e682]: Corridor 2
            - generic [ref=e683]: G-03
          - button "Corridor 3, G-04" [ref=e685] [cursor=pointer]:
            - generic [ref=e687]: Corridor 3
            - generic [ref=e688]: G-04
          - button "Auditorium, G-05" [ref=e690] [cursor=pointer]:
            - generic [ref=e692]: Auditorium
            - generic [ref=e693]: G-05
          - button "Storage, G-06" [ref=e695] [cursor=pointer]:
            - generic [ref=e697]: Storage
            - generic [ref=e698]: G-06
          - button "Vip Salon, G-07" [ref=e700] [cursor=pointer]:
            - generic [ref=e702]: Vip Salon
            - generic [ref=e703]: G-07
          - button "Stairs 3, G-08" [ref=e705] [cursor=pointer]:
            - generic [ref=e707]: Stairs 3
            - generic [ref=e708]: G-08
          - button "Elevator Lobby, G-09" [ref=e710] [cursor=pointer]:
            - generic [ref=e712]: Elevator Lobby
          - button "Valve Room, G-10" [ref=e714] [cursor=pointer]:
            - generic [ref=e716]: Valve Room
            - generic [ref=e717]: G-10
          - button "Storage, G-11" [ref=e719] [cursor=pointer]:
            - generic [ref=e721]: Storage
          - button "Female Toilets, G-12" [ref=e723] [cursor=pointer]:
            - generic [ref=e725]: Female Toilets
          - button "Male Toilets, G-13" [ref=e727] [cursor=pointer]:
            - generic [ref=e729]: Male Toilets
          - button "Lobby, G-14" [ref=e731] [cursor=pointer]:
            - generic [ref=e733]: Lobby
          - button "Translation Room, G-15" [ref=e735] [cursor=pointer]:
            - generic [ref=e737]: Translation Room
          - button "Audio Visual, G-16" [ref=e739] [cursor=pointer]:
            - generic [ref=e741]: Audio Visual
          - button "Stairs 4, G-17" [ref=e743] [cursor=pointer]:
            - generic [ref=e745]: Stairs 4
          - button "Cafeteria, G-18" [ref=e747] [cursor=pointer]:
            - generic [ref=e749]: Cafeteria
            - generic [ref=e750]: G-18
          - button "Service, G-19" [ref=e752] [cursor=pointer]:
            - generic [ref=e754]: Service
            - generic [ref=e755]: G-19
          - button "Kitchen, G-20" [ref=e757] [cursor=pointer]:
            - generic [ref=e759]: Kitchen
          - button "Storage, G-21" [ref=e761] [cursor=pointer]:
            - generic [ref=e763]: Storage
          - button "Security Room, G-22" [ref=e765] [cursor=pointer]:
            - generic [ref=e767]: Security Room
            - generic [ref=e768]: G-22
          - button "Stair 02, G-23" [ref=e770] [cursor=pointer]:
            - generic [ref=e772]: Stair 02
            - generic [ref=e773]: G-23
          - button "Exhibition Room, G-24" [ref=e775] [cursor=pointer]:
            - generic [ref=e777]: Exhibition Room
            - generic [ref=e778]: G-24
          - button "Operations Office, G-25" [ref=e780] [cursor=pointer]:
            - generic [ref=e782]: Operations Office
          - button "Skylight, G-26" [ref=e784] [cursor=pointer]:
            - generic [ref=e786]: Skylight
          - button "Reception, G-27" [ref=e788] [cursor=pointer]:
            - generic [ref=e790]: Reception
          - button "Clinic, G-28" [ref=e792] [cursor=pointer]:
            - generic [ref=e794]: Clinic
          - button "Lounge, G-29" [ref=e796] [cursor=pointer]:
            - generic [ref=e798]: Lounge
          - button "Meeting Room, G-30" [ref=e800] [cursor=pointer]:
            - generic [ref=e802]: Meeting Room
          - button "Lobby, G-31" [ref=e804] [cursor=pointer]:
            - generic [ref=e806]: Lobby
            - generic [ref=e807]: G-31
          - button "Stairs 1, G-32" [ref=e809] [cursor=pointer]:
            - generic [ref=e811]: Stairs 1
          - button "Prayer Room, G-33" [ref=e813] [cursor=pointer]:
            - generic [ref=e815]: Prayer Room
            - generic [ref=e816]: G-33
          - button "Storage, G-34" [ref=e818] [cursor=pointer]:
            - generic [ref=e820]: Storage
          - button "Copy Room, G-35" [ref=e822] [cursor=pointer]:
            - generic [ref=e824]: Copy Room
          - button "Archives Room, G-36" [ref=e826] [cursor=pointer]:
            - generic [ref=e828]: Archives Room
          - button "Garbage Chute, G-37" [ref=e830] [cursor=pointer]:
            - generic [ref=e832]: Garbage Chute
          - button "Control Room, G-38" [ref=e834] [cursor=pointer]:
            - generic [ref=e836]: Control Room
          - button "Services, G-39" [ref=e838] [cursor=pointer]:
            - generic [ref=e840]: Services
          - button "Storage, G-40" [ref=e842] [cursor=pointer]:
            - generic [ref=e844]: Storage
          - button "Female Toilet, G-41" [ref=e846] [cursor=pointer]:
            - generic [ref=e848]: Female Toilet
          - button "Male Toilet, G-42" [ref=e850] [cursor=pointer]:
            - generic [ref=e852]: Male Toilet
          - button "Mechanical Lab, G-43" [ref=e854] [cursor=pointer]:
            - generic [ref=e856]: Mechanical Lab
            - generic [ref=e857]: G-43
          - button "Av Control Room, G-44" [ref=e859] [cursor=pointer]:
            - generic [ref=e861]: Av Control Room
          - button "Physical Training Lab 1, G-45" [ref=e863] [cursor=pointer]:
            - generic [ref=e865]: Physical Training Lab 1
          - button "Physical Training Lab 2, G-46" [ref=e867] [cursor=pointer]:
            - generic [ref=e869]: Physical Training Lab 2
          - button "Av Studio, G-47" [ref=e871] [cursor=pointer]:
            - generic [ref=e873]: Av Studio
          - button "Service Room, G-48" [ref=e875] [cursor=pointer]:
            - generic [ref=e877]: Service Room
            - generic [ref=e878]: G-48
          - button "Hvac Cabinet, G-49" [ref=e880] [cursor=pointer]:
            - generic [ref=e882]: Hvac Cabinet
          - button "Visual Training Lab 1, G-50" [ref=e884] [cursor=pointer]:
            - generic [ref=e886]: Visual Training Lab 1
          - button "It Room, G-51" [ref=e888] [cursor=pointer]:
            - generic [ref=e890]: It Room
          - button "Elect Room, G-52" [ref=e892] [cursor=pointer]:
            - generic [ref=e894]: Elect Room
          - button "Elevator Lobby, G-53" [ref=e896] [cursor=pointer]:
            - generic [ref=e898]: Elevator Lobby
            - generic [ref=e899]: G-53
          - button "Stairs 5, G-54" [ref=e901] [cursor=pointer]:
            - generic [ref=e903]: Stairs 5
        - generic: Outlines under review
        - group "Map controls" [ref=e904]:
          - button "Zoom in" [ref=e905] [cursor=pointer]
          - button "Zoom out" [ref=e907] [cursor=pointer]
          - button "Reset map view" [ref=e910] [cursor=pointer]
        - generic [ref=e919]:
          - strong [ref=e920]: Select a room to view details
          - paragraph [ref=e921]: Find a room in the directory or select its marker on the map.
        - generic [ref=e922]:
          - generic [ref=e923]:
            - generic [ref=e924]: Room marker
            - generic [ref=e926]: Selected
            - generic [ref=e928]: Drag to move the map
          - button "Reset route / start" [ref=e929] [cursor=pointer]
    - contentinfo [ref=e933]:
      - generic [ref=e934]: B03 / Ground Floor
      - generic [ref=e937]: Kiosk position not configured
      - generic [ref=e938]: Physical accessibility has not been verified.
  - alert [ref=e943]
```

# Test source

```ts
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
> 222 |  const snapshot=async(name:string)=>{await expect(page).toHaveScreenshot(name,{fullPage:true,maxDiffPixelRatio:.005,animations:'disabled'});await page.screenshot({path:`${artifactDirectory}/${name}`,fullPage:true});};
      |                                                         ^ Error: expect(page).toHaveScreenshot(expected) failed
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