// =============================================================================
// MaKo nombra las tabs como se llaman HOY (ticket 874749710-19 de Leandro, 27/10/2026)
// =============================================================================
// Leandro: MaKo lo mandó a «Customer Success», una tab que ya no existe. tests/clients-nombre-en-mako.test.ts ya frenaba ESE
// nombre en la API; quedaban otros caminos viejos en lo que MaKo lee o le llega a la persona: «Clients › Classroom» (hoy es
// Classroom, y Clients va adentro), «Configuraciones › Notificaciones» (hoy es Settings) en los avisos, el email y la API, y
// «Configuraciones › Integraciones» en los errores de Calendly.
//
// Lo que fija: toda ruta «X › Y» escrita en el código (sin comentarios) de lib/ y app/ empieza por una tab de la barra de hoy
// (los `label` de app/_components/nav.ts). Las rutas del SISTEMA del teléfono o la PC («Ajustes › Safari», «Sistema ›
// Privacidad») van en una lista aparte, con su porqué. app/admin/dev (las bitácoras) cuenta lo que pasó, con los nombres de
// entonces: no se mira.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Las tabs de hoy: lo que dice la barra. */
const TABS = new Set([...leer('app/_components/nav.ts').matchAll(/label: '([^']+)'/g)].map((m) => m[1]));
/** Rutas que NO son de MaKo: los ajustes del sistema del teléfono o de la PC, que se le explican a la persona. */
const DEL_SISTEMA = new Set(['Sistema', 'Ajustes', 'MaKo › Notificaciones']);
/** Rutas ADENTRO de un editor, no de la barra: el panel «Audio» del Video Editor (app/video-editor/_opencut/media/importar-motivo.ts). */
const DE_UN_EDITOR = new Set(['Audio › Importar']);
const RUTA = /([A-ZÁÉÍÓÚ][A-Za-záéíóúñ]+(?: [A-Z][A-Za-z]+)?) › ([A-ZÁÉÍÓÚ][A-Za-záéíóúñ]+)/g;

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { if (!/node_modules|[\\/]admin[\\/]dev$/.test(p)) out.push(...archivos(p)); continue; }
    if (/\.tsx?$/.test(f.name)) out.push(p);
  }
  return out;
}

test('toda ruta «X › Y» del código empieza por una tab de la barra de hoy', () => {
  assert.ok(TABS.has('Settings') && TABS.has('Classroom') && TABS.has('Automations'), `la barra trajo: ${[...TABS].join(', ')}`);
  const malas: string[] = [];
  for (const p of [...archivos('lib'), ...archivos('app')]) {
    for (const m of sinComentarios(leer(p)).matchAll(RUTA)) {
      if (TABS.has(m[1]) || DEL_SISTEMA.has(m[1]) || DEL_SISTEMA.has(m[0]) || DE_UN_EDITOR.has(m[0])) continue;
      malas.push(`${relative(RAIZ, join(RAIZ, p)).split(sep).join('/')}: «${m[0]}»`);
    }
  }
  assert.deepEqual(malas, [], 'una tab que ya no se llama así (o no existe)');
});

test('lo que MaKo lee de su API no nombra tabs viejas', () => {
  const VIEJAS = /Customer Success|Clients › Classroom|Clients › Community|Configuraciones ›|Integraciones › Calendly/;
  const malas = REGISTRO.filter((d) => VIEJAS.test(`${d.titulo} ${d.descripcion} ${'escribe' in d ? String(d.escribe ?? '') : ''}`)).map((d) => d.id);
  assert.deepEqual(malas, []);
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. «Configuraciones › Notificaciones» de vuelta en lib/email-html.ts (lo que lee la persona en el mail) → rojo el 1.
//   2. «Clients › Classroom» de vuelta en la descripción de listar_cursos (curso.def.ts)             → rojo el 1 y el 2.
//   3. «Ajustes» fuera de DEL_SISTEMA (la ruta del teléfono para las notificaciones)                → rojo el 1.
