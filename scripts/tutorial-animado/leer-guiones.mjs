// The approved scripts (docs/reto-7-dias/tutoriales-por-pestana.md) → guiones-base.json: per tab, each "Dice" line with the
// selector its step marks (from the yaml block: the step whose `sub` contains that line).
//   node leer-guiones.mjs <tutoriales-por-pestana.md> <salida.json>
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
const md = readFileSync(inp, 'utf8');
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const secciones = md.split(/^## /m).slice(1).filter((s) => /^\d+\. /.test(s));
const res = [];
for (const s of secciones) {
  const cab = s.split('\n')[0];
  const m = cab.match(/^(\d+)\. (.+?) · `(app-[a-z-]+\.html)`/);
  if (!m) continue;
  const filas = [...s.matchAll(/^\| (\d+) \| (.+?) \| (.+?) \|$/gm)].map((f) => ({ dice: f[2].trim(), muestra: f[3].trim() }));
  const yaml = (s.match(/```yaml\n([\s\S]*?)```/) || [])[1] || '';
  const pasosYaml = yaml.split(/^- /m).slice(1).map((b) => ({
    sel: ((b.match(/^\s*sel: '(.*)'$/m) || [])[1] || '').replace(/''/g, "'"),
    sub: ((b.match(/^\s*sub: '(.*)'$/m) || [])[1] || '').replace(/''/g, "'"),
    clic: /^\s*clic: true$/m.test(b),
  }));
  const pasos = filas.map((f) => {
    const y = pasosYaml.find((p) => norm(p.sub).includes(norm(f.dice)));
    return { dice: f.dice, sel: y ? y.sel : null, clic: y ? y.clic : false };
  });
  res.push({ n: +m[1], pestana: m[2], pagina: m[3], pasos });
}
writeFileSync(out, JSON.stringify(res, null, 1));
for (const r of res) console.log(r.n, r.pestana, r.pagina, r.pasos.length, 'pasos,', r.pasos.filter((p) => p.sel).length, 'con marca');
