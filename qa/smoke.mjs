import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setContent('<h1 style="color:teal">smoke ok</h1>');
console.log(await p.textContent('h1'));
await b.close();
