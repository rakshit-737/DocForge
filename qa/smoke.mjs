import { launch } from "./_browser.mjs";
const b = await launch();
const p = await b.newPage();
await p.setContent('<h1 style="color:teal">smoke ok</h1>');
console.log(await p.textContent('h1'));
await b.close();
