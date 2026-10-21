// =============================================================================
// «Otra activa ya le escribe lo mismo a la misma gente»: en TODOS los caminos que prenden una automatización
// =============================================================================
// Revisión del Cerebro del 21/10/2026 (notas: revision-automations-seguimiento-21-10.md): el aviso de duplicada —el que
// habría frenado #282 y el d2 de #284 del ws11— seguía faltando en el TELÉFONO (/m/automations activaba y publicaba sin
// preguntar), en /email («MaKo escribe tu nutrición» › Aprobar prendía la secuencia), y en la API de MaKo. Pedido: «Test
// que recorra TODOS los caminos que prenden algo (la lista de llamadores, no los que te acordás)».
//
// Por eso la pregunta vive en el SERVER, en la única puerta que prende (`setSecuenciaActiva`, lib/nutricion.ts): tira
// `DuplicadaError` sin `aunqueDuplique`, las rutas contestan 409 `duplicada`, y cada pantalla pregunta y vuelve con
// `aunqueDuplique` recién después de «… igual». Publicar una ACTIVA es prender lo nuevo: la ruta pregunta lo mismo.
//
// Este test BARRE el repo (git ls-files), no una lista de memoria:
//   (a) cada llamador de `setSecuenciaActiva` que no pasa `false` está en la lista y maneja `DuplicadaError`;
//   (b) nadie más escribe `activa: true` / `.update({ activa` en una automatización (salvo la puerta y el script de plan);
//   (c) cada pantalla que hace PATCH con `activa` a las rutas de secuencias maneja `duplicada` y manda `aunqueDuplique`.
// Un camino NUEVO hace fallar el test hasta que alguien lo mire.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés `romper.py` + `roturas-activar.json`): ver el pie.
//
// Correr: node --import tsx --test tests/automations-activar-todos-los-caminos.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const cuerpo = (src: string, firma: string, fin = '\n}\n'): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `falta «${firma}»`);
  return src.slice(i, src.indexOf(fin, i));
};
/** El código de la app (lib, app y scripts), sin tests ni los textos de la landing. */
const ARCHIVOS = execFileSync('git', ['ls-files', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter((f) => /\.(tsx?|mjs)$/.test(f) && !f.startsWith('app/vsl/'));
const FUENTE = new Map(ARCHIVOS.map((f) => [f, sinComentarios(leer(f))]));

// ── (a) La puerta y quién la llama ──────────────────────────────────────────────────────────

/** Los que pueden PRENDER (no pasan un `false` literal), cada uno con su manejo de la duplicada. */
const PRENDEN = ['app/api/email/secuencias/route.ts', 'app/api/whatsapp/secuencias/route.ts', 'lib/mako-doer-acciones.ts'];

test('(a) la puerta: `setSecuenciaActiva` pregunta por la duplicada salvo con `aunqueDuplique`', () => {
  const n = FUENTE.get('lib/nutricion.ts')!;
  const p = cuerpo(n, 'export async function setSecuenciaActiva(');
  assert.match(p, /if \(activa && !o\.aunqueDuplique\) \{\n\s+const otra = await duplicadaDeLaActivacion\(id\);\n\s+if \(otra\) throw new DuplicadaError\(otra\);\n\s+\}/);
  // ANTES de escribir: la pregunta no puede llegar con la fila ya prendida.
  assert.ok(p.indexOf('throw new DuplicadaError(otra)') < p.indexOf(".update({ activa, updated_at: ahoraISO() })"));
  // La misma regla que la pantalla, con lo PUBLICADO de las otras.
  const d = cuerpo(n, 'export async function duplicadaDeLaActivacion(');
  assert.match(d, /return duplicadaAlActivar\(esta, vistas, \(v\) => v\.crons, o\.pasos \? \{ pasos: o\.pasos \} : \{\}\);/);
  assert.match(d, /if \(!esta \|\| \(o\.soloSiActiva && !esta\.activa\)\) return null;/);
});

test('(a) cada llamador de `setSecuenciaActiva` que puede prender maneja la duplicada (la lista sale del repo)', () => {
  const prenden: string[] = [];
  for (const [f, src] of FUENTE) {
    for (const m of src.matchAll(/\bsetSecuenciaActiva\(([^)]*)\)/g)) {
      if (f === 'lib/nutricion.ts') continue; // la definición
      const args = m[1].split(',').map((x) => x.trim());
      if (args[1] === 'false') continue;
      prenden.push(f);
    }
  }
  assert.deepEqual([...new Set(prenden)].sort(), PRENDEN, 'un camino nuevo prende automatizaciones: que pregunte por la duplicada y súmalo acá');
  for (const f of PRENDEN) {
    const src = FUENTE.get(f)!;
    assert.match(src, /DuplicadaError/, `${f} no maneja la duplicada`);
    assert.match(src, /aunqueDuplique/, `${f} no deja confirmar «… igual»`);
  }
  // Las rutas contestan 409 con `duplicada` (la pantalla pregunta con eso).
  for (const f of ['app/api/whatsapp/secuencias/route.ts', 'app/api/email/secuencias/route.ts']) {
    assert.match(FUENTE.get(f)!, /instanceof DuplicadaError\) return Response\.json\(\{ ok: false, error: [a-z.]+, duplicada: [a-z]+\.otra \}, \{ status: 409 \}\);/, f);
    assert.match(FUENTE.get(f)!, /setSecuenciaActiva\(id, body\.activa, \{ aunqueDuplique: body\.aunqueDuplique === true \}\);/, f);
  }
  // La API de MaKo: la PROPUESTA lo dice y sólo entonces el «sí» lleva `aunqueDuplique`.
  const doer = FUENTE.get('lib/mako-doer-acciones.ts')!;
  assert.match(doer, /const otra = activa \? await runWithWorkspace\(ws, \(\) => duplicadaDeLaActivacion\(secuenciaId\)\) : null;/);
  assert.match(doer, /proponer\('nutricion_toggle', \{ secuenciaId, activa, \.\.\.\(otra \? \{ aunqueDuplique: true \} : \{\}\) \},/);
  assert.match(doer, /await setSecuenciaActiva\(id, activa, \{ aunqueDuplique: payload\.aunqueDuplique === true \}\);/);
});

test('(a) Publicar una ACTIVA pregunta lo mismo, ANTES de escribir los pasos', () => {
  const ruta = FUENTE.get('app/api/whatsapp/secuencias/route.ts')!;
  const i = ruta.indexOf("const otra = await duplicadaDeLaActivacion(id, { pasos: body.pasos as PasoSecuencia[], soloSiActiva: true });");
  assert.ok(i > 0, 'Publicar una activa no pregunta');
  assert.ok(i < ruta.indexOf('await setSecuenciaPasos(id, body.pasos as PasoSecuencia[]);'), 'pregunta después de escribir');
  assert.match(ruta, /if \(body\.aunqueDuplique !== true\) \{\n\s+const otra = await duplicadaDeLaActivacion/);
});

// ── (b) Nadie más prende ────────────────────────────────────────────────────────────────────

test('(b) nadie más escribe `activa: true` ni `.update({ activa` en una automatización', () => {
  const escriben: string[] = [];
  for (const [f, src] of FUENTE) {
    // Lo que escribe en la base (lib, las rutas, los scripts); el cuerpo de un PATCH de una pantalla lo mira (c).
    if (!/^(lib|app\/api|scripts)\//.test(f)) continue;
    if (/\.update\(\{ activa\b(?!: false)/.test(src) || /\bactiva: true\b/.test(src)) escriben.push(f);
  }
  // La puerta, y el plan de la undécima (un script que se corrió UNA vez, con su revisión; no es un camino de la app).
  assert.deepEqual(escriben.sort(), ['lib/nutricion.ts', 'lib/undecima-flujos-plan.ts']);
  const n = FUENTE.get('lib/nutricion.ts')!;
  assert.equal((n.match(/\.update\(\{ activa\b(?!: false)/g) ?? []).length, 1, 'lib/nutricion.ts prende por otro lado que `setSecuenciaActiva`');
});

// ── (c) Cada pantalla que prende pregunta ───────────────────────────────────────────────────

/** Las pantallas que prenden por PATCH a las rutas de secuencias. */
const PANTALLAS = [
  'app/_components/NutricionGenerar.tsx', 'app/automations/SecuenciaPerfil.tsx', 'app/automations/SimuladorWhatsApp.tsx',
  'app/email/EmailApp.tsx', 'app/m/automations/AutomationsM.tsx',
];

test('(c) cada pantalla que hace PATCH con `activa` a las secuencias pregunta por la duplicada (la lista sale del repo)', () => {
  const prenden: string[] = [];
  for (const [f, src] of FUENTE) {
    if (!f.startsWith('app/') || f.startsWith('app/api/')) continue;
    if (!/\/api\/(whatsapp|email)\/secuencias/.test(src)) continue;
    for (const m of src.matchAll(/'PATCH'/g)) {
      if (/\bactiva\b/.test(src.slice(m.index!, m.index! + 300))) { prenden.push(f); break; }
    }
  }
  assert.deepEqual(prenden.sort(), PANTALLAS, 'una pantalla nueva prende automatizaciones: que pregunte por la duplicada y súmala acá');
  for (const f of PANTALLAS) {
    const src = FUENTE.get(f)!;
    assert.match(src, /duplicada/, `${f} no se entera de que el server la frenó`);
    assert.match(src, /aunqueDuplique: true/, `${f} no deja «… igual»`);
  }
});

test('(c) el teléfono: Activar y Publicar una activa preguntan en una hoja, y «… igual» vuelve con `aunqueDuplique`', () => {
  const m = FUENTE.get('app/m/automations/AutomationsM.tsx')!;
  const alt = cuerpo(m, 'const alternar = async (a: AutomatizacionM, activa: boolean, deshaciendo = false, aunqueDuplique = false) => {', '\n  };');
  assert.match(alt, /if \(!r\.ok && r\.duplicada\) \{\n\s+poner\(a\.id, \{ activa: antes \}\);\n\s+haptico\('medium'\);\n\s+setAActivar\(\{ a, texto: r\.error \?\? '' \}\);\n\s+return;/);
  assert.match(m, /onClick=\{\(\) => \{ const x = aActivar; setAActivar\(null\); void alternar\(x\.a, true, false, true\); \}\}>Activar igual<\/Button>/);
  const pub = cuerpo(m, 'const publicar = async () => {', '\n  };');
  assert.match(pub, /const aunqueDuplique = dupPublicar != null;/);
  assert.match(pub, /if \(!r\.ok && r\.duplicada\) \{ haptico\('medium'\); setDupPublicar\(r\.error \?\? ''\); setOcupado\(null\); return; \}/);
  assert.match(m, /onClick=\{publicar\}>\n\s+\{dupPublicar != null \? 'Publicar igual' : 'Publicar los cambios'\}/);
  // `pedir` deja pasar la marca del server.
  assert.match(m, /duplicada: !!j\?\.duplicada/);
});

test('(c) /email: «MaKo escribe tu nutrición» › Aprobar y el interruptor de una secuencia de email preguntan', () => {
  const g = FUENTE.get('app/_components/NutricionGenerar.tsx')!;
  assert.match(g, /if \(!activada && act\?\.duplicada\) \{\n\s+setMsg\(\{ t: 'err', x: `El copy de «\$\{sel\.nombre\}» se guardó, pero no la activé: \$\{String\(act\.error\)\}\.` \}\);\n\s+setActivarIgual\(true\);\n\s+return;/);
  assert.match(g, /onClick=\{\(\) => void aplicar\(\{ aunqueDuplique: true \}\)\}/);
  const e = FUENTE.get('app/email/EmailApp.tsx')!;
  assert.match(e, /if \(!j\.ok && j\.duplicada\) \{\n\s+if \(await confirm\(String\(j\.error\), \{ confirmLabel: 'Activar igual' \}\)\) await toggle\(true\);\n\s+return;/);
});

test('(c) el escritorio: el interruptor, Publicar y el «⋯» vuelven a preguntar si el server la frena', () => {
  const p = FUENTE.get('app/automations/SecuenciaPerfil.tsx')!;
  assert.match(p, /\} else if \(r\.duplicada\) \{\n\s+setAvisoDup\(\{ texto: String\(r\.error\), boton: 'Activar igual', seguir: \(\) => void toggle\(\) \}\);/);
  assert.match(p, /if \(rp\.duplicada\) \{ setAvisoDup\(\{ texto: String\(rp\.error\), boton: 'Publicar igual', seguir: \(\) => void publicar\(\) \}\); setBusy\(null\); return; \}/);
  // «… igual» (el de la pantalla o el del 409) marca la respuesta; el pedido que sigue la lleva UNA vez y la consume.
  assert.match(p, /onConfirm=\{\(\) => \{ const s = avisoDup\.seguir; setAvisoDup\(null\); respondioIgual\.current = true; s\(\); \}\}/);
  for (const f of ['const toggle = async () => {', 'const publicar = async () => {']) {
    assert.match(cuerpo(p, f, '\n  };'), /const aunqueDuplique = respondioIgual\.current;\n\s+respondioIgual\.current = false;/, f);
  }
  const l = FUENTE.get('app/automations/SimuladorWhatsApp.tsx')!;
  assert.match(l, /\{ id: j\.id, activa: !j\.activa, \.\.\.\(o\?\.sinAviso \? \{ aunqueDuplique: true \} : \{\}\) \}\);\n\s+if \(!r\.ok && r\.duplicada\) \{ setAvisoActivar\(\{ j, texto: String\(r\.error\) \}\); return; \}/);
});

// PROBADO ROMPIÉNDOLO (21/10/2026, arnés `romper.py` + `roturas-activar.json`, una rotura por vez y restaurada con md5
// igual). Base 8 / 0. Cada una → 7 / 1 (salvo donde se dice):
//    1. la puerta no pregunta                          12. el teléfono publica sin preguntar
//    2. sin `soloSiActiva`                             13. «Activar igual» del teléfono sin la marca
//    3. un llamador nuevo prende                       14. Aprobar en /email ignora la duplicada        → 6 / 2
//    4. la ruta sin el 409 `duplicada`                 15. el interruptor de /email la ignora
//    5. la ruta de email siempre con `aunqueDuplique`  16. el lienzo ignora el 409 al activar
//    6. el «sí» de la API ignora la propuesta          17. el lienzo ignora el 409 al publicar
//    7. la propuesta de la API sin el aviso            18. «Activar igual» del lienzo sin la marca
//    8. Publicar una activa no pregunta                19. la lista sin la marca                        → 6 / 2
//    9. otro escritor prende (desarchivar)             20. la lista ignora el 409
//   10. el teléfono ignora la duplicada al activar     21. la marca no se consume
//   11. `pedir` del teléfono pierde la marca           22. «Publicar igual» del teléfono sin la marca
// Restaurado: 8 / 0. Y el aviso de una activa (tests/automations-aviso-todos-caminos.test.ts, `roturas-chip.json`): sin
// calcularlo → 6 / 1; sin dibujarlo → 6 / 1 (base 7 / 0).
