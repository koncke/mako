// Dibuja las hojas del Dashboard (las plantillas con diseño propio) con los MISMOS datos de ejemplo que la miniatura de
// «Nueva hoja» (app/dashboard/disenos/DisenoEnMiniatura.tsx), para meterlas en «Métricas» de la maqueta del CoPilot.
// Uso: npx tsx --tsconfig C:/dev/wt-copilot-pruebas/tsconfig.json ssr-hojas.mts <carpeta-salida>
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = 'C:/dev/wt-copilot-pruebas';
const de = (r: string) => import(pathToFileURL(join(REPO, r)).href);
const React = (await de('node_modules/react/index.js')).default;
const { renderToStaticMarkup } = (await de('node_modules/react-dom/server.node.js')).default ?? (await de('node_modules/react-dom/server.node.js'));
const { DisenoEnMiniatura } = await de('app/dashboard/disenos/DisenoEnMiniatura.tsx');
const { PLANTILLAS_HOJA, instanciarPlantilla } = await de('lib/graficos-plantillas.ts');
const { PLANTILLAS_GENERAL } = await de('lib/general-plantillas.ts');

const QUIERO = new Set(['marketing', 'anuncio', 'landing', 'instagram', 'vsl', 'hooks']);
const hoy = '2026-11-12';
const salida = process.argv[2];
// Los gráficos miden su caja en el navegador (useState({ w: 0, h: 0 }) + ResizeObserver) y sin navegador salen vacíos. Las medidas
// de cada caja, en el orden de la hoja, las midió la maqueta en «Métricas» a 1440 (hojas-tam.json): se le dan al primer render.
const TAM = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
let cola: number[][] = [];
const useStateOriginal = React.useState;
React.useState = (ini: unknown) => {
  if (ini && typeof ini === 'object' && Object.keys(ini).length === 2 && (ini as { w?: number }).w === 0 && (ini as { h?: number }).h === 0) {
    const t = cola.shift() || [600, 240];
    return useStateOriginal({ w: t[0], h: t[1] });
  }
  return useStateOriginal(ini);
};
mkdirSync(salida, { recursive: true });
for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
  let h;
  try { h = instanciarPlantilla(p); } catch { continue; }
  const id = h?.diseno?.id;
  if (!id || !QUIERO.has(id)) continue;
  cola = (TAM[id] || []).map((x: number[]) => [...x]);
  try {
    const html = renderToStaticMarkup(React.createElement(DisenoEnMiniatura, { hoja: h, hoy })).split('Buenos días, Ana').join('Buenos días, Federico');
    writeFileSync(join(salida, `${id}.html`), html);
    console.log(id, p.id, html.length);
  } catch (e) {
    console.log('FALLA', id, String(e).slice(0, 300));
  }
}
