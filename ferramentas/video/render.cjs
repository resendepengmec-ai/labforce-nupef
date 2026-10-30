const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.goto(process.env.URL || 'http://localhost:8770/ferramentas/video/'); await pg.waitForFunction(() => window.pronto); await pg.evaluate(() => window.pronto);
const fps = 30, dur = await pg.evaluate(() => window.DURACAO), n = Math.round(dur * fps);
for (let i = 0; i < n; i++) {
  await pg.evaluate((t) => window.desenhar(t), i / fps);
  await pg.screenshot({ path: `quadros/q${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (i % 300 === 0) console.log('quadro', i, 'de', n);
}
await b.close(); console.log('fim'); })();
