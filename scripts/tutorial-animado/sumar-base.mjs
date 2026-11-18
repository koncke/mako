// Adds the approved scripts of the other drawn tabs (guiones-base.json) to guiones.json, with their id, route, icon and the
// steps shown on screen: the longest marked step in the middle, and the last marked step that says where to touch.
import { readFileSync, writeFileSync } from 'node:fs';
const R = 'C:/dev/tutoriales-video';
const base = JSON.parse(readFileSync(`${R}/guiones-base.json`, 'utf8'));
const guiones = JSON.parse(readFileSync(`${R}/guiones.json`, 'utf8'));
const TABS = {
  'Ticketera': ['ticketera', '/second-brain', 'lucide:ticket', 2], 'Calendar': ['calendar', '/calendario', 'lucide:calendar-days', 2],
  'Automations': ['automations', '/automations', 'lucide:workflow', 2], 'Plan': ['plan', '/plan', 'lucide:list-checks', 2],
  'Dashboard': ['dashboard', '/dashboard', 'lucide:layout-dashboard', 2], 'Classroom': ['classroom', '/classroom', 'lucide:graduation-cap', 2],
  'Competitor Spy': ['spy', '/competitor-spy', 'lucide:binoculars', 3], 'Copywriting': ['copywriting', '/copywriter', 'lucide:pen-line', 3],
  'Web Generator': ['web', '/web-generator', 'lucide:globe', 3], 'AI Avatar': ['avatar', '/ai-avatar', 'lucide:user-round', 3],
  'Video': ['video', '/video-editor', 'lucide:clapperboard', 3], 'Image': ['image', '/image-editor', 'lucide:image', 3],
};
const palabras = (s) => s.trim().split(/\s+/).length;
for (const b of base) {
  const t = TABS[b.pestana]; if (!t) continue;
  const [id, ruta, icono, tanda] = t;
  if (guiones.some((x) => x.id === id)) continue;
  const pasos = b.pasos.map((p) => (p.sel ? { dice: p.dice, sel: p.sel } : { dice: p.dice }));
  const conSel = pasos.map((p, i) => (p.sel ? i : -1)).filter((i) => i >= 0);
  let ultimo = [...conSel].reverse().find((i) => palabras(pasos[i].dice) >= 5);
  const medio = conSel.filter((i) => i > 0 && i < pasos.length - 1 && i !== ultimo && Math.abs(i - (ultimo ?? 99)) > 1)
    .sort((a, b2) => palabras(pasos[b2].dice) - palabras(pasos[a].dice))[0];
  const pantallas = [medio, ultimo].filter((i) => i != null).sort((a, b2) => a - b2);
  guiones.push({ id, pestana: b.pestana, ruta, pagina: b.pagina, icono, tanda, pantallas, pasos });
  console.log(id, 'pantallas', pantallas.map((i) => i + 1).join(','), '·', pasos.reduce((a, p) => a + palabras(p.dice), 0), 'palabras');
}
writeFileSync(`${R}/guiones.json`, JSON.stringify(guiones, null, 1));
