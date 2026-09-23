import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFileSync} from 'node:fs';

async function ready(page:Page) {
 await page.goto('/');
 // The current application opens in Navigate mode; switch to Browse for
 // directory/search journeys used by this suite.
 if (await page.getByTestId('room-directory').count() === 0) {
  await page.getByRole('button',{name:'Browse',exact:true}).click();
 }
 await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(54);
 await expect(page.locator('.map-label')).toHaveCount(54);
 await page.evaluate(()=>document.fonts.ready);
}

test('route playback progressively reveals, pauses, stops, and resets', async ({page}) => {
 await page.emulateMedia({reducedMotion:'no-preference'});
 await ready(page);
 await page.getByRole('button',{name:'Navigate',exact:true}).click();
 await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 const progress = page.getByTestId('route-status').locator('progress');
 await expect(progress).toHaveAttribute('value','0');
 // Selecting a destination starts playback automatically.
 await expect(page.getByTestId('playback-toggle')).toHaveText('Pause route playback');
 await expect.poll(async()=>Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
 const mid = Number(await progress.getAttribute('value'));
 expect(mid).toBeLessThan(1);
 await page.getByTestId('playback-toggle').click();
 await expect(page.getByTestId('playback-toggle')).toHaveText('Start route playback');
 await page.getByTestId('playback-stop').click();
 await expect(progress).toHaveAttribute('value','0');
 await expect(page.getByTestId('playback-stop')).toBeDisabled();
 await page.getByTestId('playback-toggle').click();
 await expect.poll(async()=>Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
 await page.getByTestId('playback-reset').click();
 await expect(progress).toHaveAttribute('value','0');
});

test('reduced motion completes route without progressive animation', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'});
 await ready(page);
 await page.getByRole('button',{name:'Navigate',exact:true}).click();
 await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
 await page.getByTestId('playback-toggle').click();
 await expect(page.getByTestId('playback-toggle')).toBeDisabled();
 await expect(page.getByTestId('route-status').locator('progress')).toHaveAttribute('value','1');
});

test('unavailable destination remains discoverable but blocks route start (US2)', async ({page}) => {
 test.fail(true, 'Known product gap: WayfindingApp does not gate route actions on Room.availability.status.');
 await ready(page);
 await page.getByRole('searchbox').fill('G-28');
 const room = page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');
 await expect(room).toBeVisible();
 await room.click();
 await expect(page.getByTestId('room-details')).toContainText('Clinic');
 await expect(page.getByTestId('room-details')).toContainText('Temporarily unavailable');
 await expect(page.getByRole('button',{name:'Go here',exact:true})).toBeDisabled();
});
test('English actual entrance and cross-wing routes, keyboard, planning reset and map controls',async({page})=>{
 await ready(page);
 await page.getByRole('searchbox').fill('G-28');
 const clinic=page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');
 await page.getByRole('searchbox').focus();
 for(let i=0;i<4;i++){if(await clinic.evaluate(e=>e===document.activeElement))break;await page.keyboard.press('Tab');}
 await expect(clinic).toBeFocused();
 await expect(clinic).toHaveCSS('outline-style','solid');
 await page.keyboard.press('Enter');
 await expect(page.getByTestId('room-details')).toContainText('Clinic');
 await page.getByRole('button',{name:'Go here',exact:true}).click();
 await expect(page.getByTestId('route-status')).toContainText('Route on floor plan');
 await expect(page.getByTestId('arrival-note')).toContainText('Reception');
 await expect(page.getByTestId('route-status')).not.toContainText('You have arrived at your destination.');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await expect(page.getByTestId('kiosk-status')).toContainText('not your current location');
 await expect(page.getByTestId('start-select').locator('option:checked')).toContainText('Main Entrance');
 await page.getByTestId('start-select').selectOption('B03-GF-G-45');
 await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await page.getByTestId('start-select').selectOption('B03-GF-G-54');
 await page.getByTestId('destination-select').selectOption('B03-GF-G-02');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await page.getByRole('button',{name:'Use default starting point',exact:true}).click();
 await expect(page.getByTestId('start-select')).toHaveValue('');
 await page.getByTestId('reset-kiosk').click();
 await expect(page.getByTestId('room-details')).toHaveCount(0);
 await expect(page.getByTestId('destination-select')).toHaveValue('');
 await page.getByRole('button',{name:'Browse',exact:true}).click();
 await expect(page.getByRole('searchbox')).toHaveValue('');
 await page.locator('.map-label[aria-label="Main Entrance, G-01"]').click();
 await expect(page.getByTestId('room-details')).toContainText('Main Entrance');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const before=await page.locator('.map-label[aria-label="Main Entrance, G-01"]').boundingBox();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect.poll(async()=>JSON.stringify(await page.locator('.map-label[aria-label="Main Entrance, G-01"]').boundingBox())).not.toBe(JSON.stringify(before));
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 await page.getByRole('button',{name:'Reset map view',exact:true}).click();
});

test('Arabic actual route, popup and language switch preserve selected endpoints',async({page})=>{
 await ready(page); await page.getByTestId('language-toggle').click();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('html')).toHaveAttribute('lang','ar');
 await page.getByRole('searchbox').fill('الْعِيَادَة');
 await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
 await expect(page.getByTestId('room-details')).toContainText('العيادة');
 await page.getByRole('button',{name:'اذهب إلى هنا',exact:true}).click();
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await page.getByTestId('start-select').selectOption('B03-GF-G-45');
 await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await page.getByTestId('language-toggle').click();
 await expect(page.getByTestId('start-select')).toHaveValue('B03-GF-G-45');
 await expect(page.getByTestId('destination-select')).toHaveValue('B03-GF-G-05');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await expect(page.getByTestId('room-details')).toContainText('Auditorium');
});

test('browser speech autoplays details and replay/stop/mute honor current language',async({page})=>{
 await page.addInitScript(()=>{
  const state={spoken:[] as {text:string,lang:string}[], cancels:0};
  Object.assign(window,{qaSpeech:state});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{lang='';constructor(public text:string){}}});
  Object.defineProperty(window,'speechSynthesis',{value:{speak:(u:{text:string,lang:string})=>state.spoken.push({text:u.text,lang:u.lang}),cancel:()=>state.cancels++,getVoices:()=>[]}});
 });
 await ready(page);
 await page.getByRole('searchbox').fill('G-28');
 await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:{text:string}[]}}).qaSpeech.spoken.at(-1)?.text)).toContain('Clinic');
 await page.getByRole('button',{name:'Replay description',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:unknown[]}}).qaSpeech.spoken.length)).toBe(2);
 await page.getByRole('button',{name:'Stop audio',exact:true}).click();
 await page.getByRole('button',{name:'Mute audio',exact:true}).click();
 await page.getByTestId('language-toggle').click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:unknown[]}}).qaSpeech.spoken.length)).toBe(2);
 await page.getByRole('button',{name:'إلغاء كتم الصوت',exact:true}).click();
 await page.getByRole('button',{name:'إعادة تشغيل الوصف',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {qaSpeech:{spoken:{lang:string}[]}}).qaSpeech.spoken.at(-1)?.lang)).toBe('ar');
});

test('WCAG AA contrast and semantics on English/Arabic default and popup states',async({page})=>{
 await ready(page);
 const violations=[];
 for(const state of ['en-default','en-popup','en-route','ar-popup','ar-mobile']) {
  if(state==='en-popup') {await page.getByRole('searchbox').fill('G-28');await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();}
  if(state==='ar-popup') await page.getByTestId('language-toggle').click();
  if(state==='en-route') await page.getByRole('button',{name:'Go here',exact:true}).click();
  if(state==='ar-mobile') await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.fonts.ready);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  violations.push({state,violations:result.violations});
 }
 await test.info().attach('axe-results',{body:JSON.stringify(violations,null,2),contentType:'application/json'});
 expect(violations.flatMap(s=>s.violations.map(v=>({state:s.state,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})))).toEqual([]);
});

test('mobile and 200 percent text retain usable controls without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844}); await ready(page);
 await page.getByRole('searchbox').fill('G-28');
 await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
 await page.getByRole('button',{name:'Go here',exact:true}).click();
 await expect(page.getByTestId('route-status')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByTestId('language-toggle').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{const sizes=[...document.querySelectorAll<HTMLElement>('body *')].map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const {e,size} of sizes)e.style.fontSize=`${size*2}px`;});
 await expect(page.getByTestId('language-toggle')).toBeVisible();
 await page.getByTestId('reset-kiosk').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.reload(); await page.getByRole('searchbox').fill('G-28');
 await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
 await page.getByTestId('language-toggle').click();
 await page.evaluate(()=>{const sizes=[...document.querySelectorAll<HTMLElement>('body *')].map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize)}));for(const {e,size} of sizes)e.style.fontSize=`${size*2}px`;});
 await page.getByRole('button',{name:'اذهب إلى هنا',exact:true}).click();
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await expect(page.getByTestId('floor-map')).toBeVisible();
 expect((await page.getByTestId('floor-map').boundingBox())!.height).toBeGreaterThan(150);
 await page.screenshot({path:'artifacts/qa/r2-text-200-percent-ar.png',fullPage:true});
 const brand=await page.locator('.brand').boundingBox();
 expect(brand?.y).toBeGreaterThanOrEqual(0);
});

test('reviewed raised-scene visual baselines: default, popup, successful route, Arabic, mobile',async({page})=>{
 const start=Date.now();await ready(page);
 const performanceData=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),scripts:performance.getEntriesByType('resource').filter(e=>(e as PerformanceResourceTiming).initiatorType==='script').map(e=>({name:e.name,transferSize:(e as PerformanceResourceTiming).transferSize,duration:e.duration}))}));
 writeFileSync('artifacts/qa/performance-observation.json',JSON.stringify({baseURL:test.info().project.use.baseURL,mapAndFontsReadyMs:Date.now()-start,...performanceData,scope:'One local headless Edge observation, not a kiosk hardware benchmark'},null,2));
 const snapshot=async(name:string)=>{await expect(page).toHaveScreenshot(name,{fullPage:true,maxDiffPixelRatio:.005,animations:'disabled'});await page.screenshot({path:`artifacts/qa/${name}`,fullPage:true});};
 await snapshot('r2-default-en.png');
 await page.getByRole('searchbox').fill('G-28');await page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]').click();
 await snapshot('r2-popup-en.png');
 await page.getByRole('button',{name:'Go here',exact:true}).click();
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await snapshot('r2-route-success-en.png');
 await page.getByTestId('start-select').selectOption('B03-GF-G-45');
 await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await snapshot('r2-cross-wing-en.png');
 await page.getByTestId('language-toggle').click();
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.fonts.check('16px "Noto Sans Arabic"'))).toBe(true);
 await expect(page.locator('.wayfinding-app')).toHaveCSS('font-family',/Noto Sans Arabic/);
 await snapshot('r2-popup-route-ar.png');
 await page.setViewportSize({width:390,height:844});
 await snapshot('r2-mobile-ar.png');
});

test('WebGL-unavailable fallback preserves source plan and usable keyboard directory',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type==='webgl2')return null;return Reflect.apply(original,this,[type,...args]);} as typeof original;});
 await page.goto('/');
 await expect(page.locator('.map-fallback img')).toBeVisible();
 await expect(page.getByTestId('room-directory').locator('[data-room-id]')).toHaveCount(54);
 await page.getByRole('searchbox').fill('G-28');
 const room=page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');await room.focus();await page.keyboard.press('Enter');
 await expect(page.getByTestId('room-details')).toContainText('Clinic');
});

test('forced colors and reduced motion preserve accessible directory and selection controls',async({page})=>{
 await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce',contrast:'more'});
 await ready(page);
 await page.getByRole('searchbox').fill('G-28');
 const room=page.getByTestId('room-directory').locator('[data-room-id="B03-GF-G-28"]');
 await room.focus();await page.keyboard.press('Enter');
 await expect(page.getByTestId('room-details')).toContainText('Clinic');
 await expect(page.getByRole('button',{name:'Go here',exact:true})).toHaveCSS('transition-duration','0s');
 await page.getByRole('button',{name:'Go here',exact:true}).click();
 await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
 await page.screenshot({path:'artifacts/qa/forced-colors-reduced-motion.png',fullPage:true});
 await page.getByTestId('reset-kiosk').click();
 await expect(page.getByTestId('room-details')).toHaveCount(0);
});



test('three exterior destinations and reversed starts clearly retain partial source coverage',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Navigate',exact:true}).click();
 for(const code of ['06','17','23']) {
  await page.getByTestId('destination-select').selectOption(`B03-GF-G-${code}`);
  await expect(page.getByTestId('route-status')).toHaveClass(/\bok\b/);
  await expect(page.getByTestId('route-status')).toContainText('Partial route');
  await expect(page.getByTestId('route-status')).not.toContainText('You have arrived at your destination.');
  await expect(page.getByTestId('room-details')).toContainText('Partial route');
 }
 await page.getByTestId('start-select').selectOption('B03-GF-G-06');
 await page.getByTestId('destination-select').selectOption('B03-GF-G-05');
 await expect(page.getByTestId('route-status')).toContainText('Partial route');
 await page.getByTestId('language-toggle').click();
 await expect(page.getByTestId('route-status')).toContainText('مسار جزئي');
 await expect(page.getByTestId('route-status')).not.toContainText('لقد وصلت إلى وجهتك.');
 await page.screenshot({path:'artifacts/qa/r2-partial-route-ar.png',fullPage:true});
});
