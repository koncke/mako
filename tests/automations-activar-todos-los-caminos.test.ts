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
//   (c) cada pantalla que hace PATCH con `activa` a las rutas de secuencias maneja `duplicada` y manda `aunqueDuplique`;
//   (d) (segunda revisión, 21/10) PUBLICAR una activa también prende lo nuevo: cada quien escribe los pasos o es un camino
//       de persona y va por `publicarPasos` (que pregunta), o es del sistema y está en la lista con su motivo.
// Un camino NUEVO hace fallar el test hasta que alguien lo mire. Mira también los scripts `.mts` (las mudanzas).
//
// Y la red por HECHOS (21/10/2026, después de tres rondas de reglas sobre el texto que arreglaban unos pares y rompían
// otros): se avisa SIEMPRE que otra activa le escribe a la misma gente, por el mismo canal y con horarios que se pisan, y
// el aviso muestra el arranque de los dos mensajes. El parecido sólo ordena. Se mide con los pares del Cerebro
// (tests/_pares-duplicada.ts): 0 duplicados reales sin aviso.
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
// Con los .mts/.cts/.cjs (revisión del 21/10/2026: las mudanzas son .mts y quedaban fuera de la red).
const ARCHIVOS = execFileSync('git', ['ls-files', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter((f) => /\.(c|m)?[jt]sx?$/.test(f) && !f.startsWith('app/vsl/'));
const FUENTE = new Map(ARCHIVOS.map((f) => [f, sinComentarios(leer(f))]));

// ── (a) La puerta y quién la llama ──────────────────────────────────────────────────────────

/** Los que pueden PRENDER (no pasan un `false` literal), cada uno con su manejo de la duplicada. */
const PRENDEN = ['app/api/email/secuencias/route.ts', 'app/api/whatsapp/secuencias/route.ts', 'lib/mako-doer-acciones.ts'];
/**
 * Los scripts de mudanza que prenden lo que crean: SÓLO filas «Evento de MaKo», y sólo si el negocio no tenía NINGUNA de
 * ese evento (la saltean si ya hay, prendida o pausada). Dos del mismo evento SÍ le escriben a la misma gente (revisión del
 * 21/10/2026), pero acá no hay otra: nunca reciben `DuplicadaError`. Si uno prende otra cosa, que la maneje.
 */
const SCRIPTS_DE_EVENTOS = ['scripts/mudanza-avisos-plataforma.mts', 'scripts/mudanza-nuevo-agendado.mts'];

test('(a) la puerta: `setSecuenciaActiva` pregunta por la duplicada salvo con `aunqueDuplique`', () => {
  const n = FUENTE.get('lib/nutricion.ts')!;
  const p = cuerpo(n, 'export async function setSecuenciaActiva(');
  assert.match(p, /if \(activa && !o\.aunqueDuplique\) \{\n\s+const otra = await duplicadaDeLaActivacion\(id\);\n\s+if \(otra\) throw new DuplicadaError\(otra\);\n\s+\}/);
  // ANTES de escribir: la pregunta no puede llegar con la fila ya prendida.
  assert.ok(p.indexOf('throw new DuplicadaError(otra)') < p.indexOf(".update({ activa, updated_at: ahoraISO() })"));
  // La misma regla que la pantalla, con lo PUBLICADO de las otras.
  const d = cuerpo(n, 'export async function duplicadaDeLaActivacion(');
  assert.match(d, /return duplicadaAlActivar\(esta, vistas, \(v\) => v\.crons, \{ \.\.\.\(o\.pasos \? \{ pasos: o\.pasos \} : \{\}\), \.\.\.\(o\.crons \? \{ crons: o\.crons \} : \{\}\) \}\);/);
  assert.doesNotMatch(d, /negocio/, 'el nombre del negocio era de la firma: el aviso ya no mira el texto');
  assert.match(d, /if \(!esta \|\| \(o\.soloSiActiva && !esta\.activa\)\) return null;/);
  // Una pausada que se publica no lee todas con sus pasos: primero si está activa, y después sólo las activas.
  const pausada = d.indexOf(".select('activa').eq('id', id).maybeSingle()");
  assert.ok(pausada >= 0 && pausada < d.indexOf('leerFilasDeSecuencias('), 'lee todas las automatizaciones aunque ésta esté pausada');
  assert.match(d, /if \(!error && \(data as \{ activa\?: boolean \| null \} \| null\)\?\.activa !== true\) return null;/);
  assert.match(d, /\.is\('archivada_at', null\)\.or\(`activa\.eq\.true,id\.eq\.\$\{Number\(id\)\}`\)/);
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
  assert.deepEqual([...new Set(prenden)].sort(), [...PRENDEN, ...SCRIPTS_DE_EVENTOS].sort(), 'un camino nuevo prende automatizaciones: que pregunte por la duplicada y súmalo acá');
  for (const f of SCRIPTS_DE_EVENTOS) {
    const src = FUENTE.get(f)!;
    assert.match(src, /TRIGGER_AVISO_MAKO/, `${f} ya no prende sólo eventos de MaKo`);
    const salta = src.indexOf('if (ya.length) {');
    assert.ok(salta >= 0 && salta < src.indexOf('await setSecuenciaActiva(r.id, true);'), `${f} prende aunque ya haya otra del mismo evento`);
  }
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

test('(a) Publicar una ACTIVA pregunta lo mismo, ANTES de escribir los pasos (`publicarPasos`)', () => {
  const p = cuerpo(FUENTE.get('lib/nutricion.ts')!, 'export async function publicarPasos(');
  assert.match(p, /if \(!o\.aunqueDuplique\) \{\n\s+const otra = await duplicadaDeLaActivacion\(id, \{ pasos: pasos as unknown as PasoGrafo\[\], soloSiActiva: true \}\);\n\s+if \(otra\) throw new DuplicadaError\(otra\);\n\s+\}\n\s+await setSecuenciaPasos\(id, pasos\);/);
  assert.match(FUENTE.get('app/api/whatsapp/secuencias/route.ts')!, /await publicarPasos\(id, body\.pasos as PasoSecuencia\[\], \{ aunqueDuplique: body\.aunqueDuplique === true \}\);/);
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
  // Y el script de la undécima (una sola vez, en el ws13; revisión del 21/10/2026: era un .mts y no se veía).
  assert.deepEqual(escriben.sort(), ['lib/nutricion.ts', 'lib/undecima-flujos-plan.ts', 'scripts/undecima-flujos.mts']);
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
  assert.match(g, /if \(!activada && act\?\.duplicada\) \{\n\s+setMsg\(\{ t: 'err', x: `El copy de «\$\{sel\.nombre\}» se guardó, pero no la activé: \$\{String\(act\.error\)\}\.` \}\);\n\s+setActivarIgual\('Activar igual'\);\n\s+return;/);
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

// ── (d) Publicar una activa: los caminos de una persona preguntan ─────────────────────────────

/** Los caminos de una PERSONA que publican pasos: van por `publicarPasos` (pregunta por la duplicada). */
const PUBLICAN = [
  'app/api/email/secuencias/route.ts', 'app/api/whatsapp/secuencias/route.ts', 'lib/api-mako/areas/chatbot.run.ts',
  'lib/api-mako/areas/email.run.ts', 'lib/nutricion-generator.ts',
];
/**
 * Los que escriben `setSecuenciaPasos` directo, cada uno por algo: el sistema no tiene a quién preguntarle (el hand-off, las
 * variantes, Meta, las mudanzas), lo que nace PAUSADO no le escribe a nadie (Copiar flujo, Crear con IA), y la API cambia
 * por ahí lo que no toca el texto ni a quién (la espera, la vista previa, un caso de «Si responde», y audio ↔ texto si el
 * primer mensaje sigue por el mismo canal: si cambia, va por `publicarPasos`, test (e)).
 */
const SISTEMA = [
  'lib/api-mako/areas/chatbot.run.ts', 'lib/chat-agent-handoff.ts', 'lib/flujo-copia-negocio.ts', 'lib/flujo-ia-crear.ts',
  'lib/nutricion-plantillas.ts', 'lib/nutricion.ts', 'lib/secuencias-variantes.ts', 'scripts/reescribir-filas-plataforma.mts',
];

test('(d) quién escribe lo publicado: cada uno pregunta (`publicarPasos`) o está en la lista del sistema con su motivo', () => {
  const directos: string[] = [];
  const publican: string[] = [];
  for (const [f, src] of FUENTE) {
    if (/\bsetSecuenciaPasos\(/.test(src.replace(/export async function setSecuenciaPasos\(/, ''))) directos.push(f);
    if (/\bpublicarPasos\(/.test(src.replace(/export async function publicarPasos\(/, ''))) publican.push(f);
  }
  assert.deepEqual(directos.sort(), [...SISTEMA].sort(), 'alguien nuevo escribe los pasos sin preguntar: si es una persona, por `publicarPasos`; si es el sistema, súmalo con su motivo');
  assert.deepEqual(publican.sort(), [...PUBLICAN].sort());
  // En la API de MaKo, el de una persona («editar_pasos…») pregunta en la PROPUESTA; los directos que quedan no tocan el texto.
  const chat = FUENTE.get('lib/api-mako/areas/chatbot.run.ts')!;
  // La espera (en minutos y en horas), audio ↔ texto, la vista previa de los links y un caso de «Si responde».
  assert.equal((chat.match(/\bsetSecuenciaPasos\(/g) ?? []).length, 5, 'chatbot.run.ts escribe los pasos directo por un camino nuevo');
  for (const f of ['lib/api-mako/areas/chatbot.run.ts', 'lib/api-mako/areas/email.run.ts']) {
    const src = FUENTE.get(f)!;
    assert.match(src, /const otra = await duplicadaDeLaActivacion\(id, \{ pasos[^}]*soloSiActiva: true \}\);/, `${f}: la propuesta no lo dice`);
    assert.match(src, /\.\.\.\(otra \? \{ aunqueDuplique: true \} : \{\}\)/, f);
    assert.match(src, /await publicarPasos\(id, [^,]+, \{ aunqueDuplique: payload\.aunqueDuplique === true \}\);/, f);
    assert.match(src, /if \(e instanceof DuplicadaError\) return \{ ok: false, resumen: /, f);
  }
  // /email › Guardar: con los pasos Y la etapa o el disparador nuevos, ANTES de escribir.
  const email = FUENTE.get('app/api/email/secuencias/route.ts')!;
  assert.ok(email.indexOf('const otra = await duplicadaDeLaActivacion(id, {') < email.indexOf('await actualizarMetaEmailSecuencia('), 'pregunta después de cambiar a quién');
  // Y pregunta de verdad: con la etapa o el disparador nuevos, salvo «Guardar igual» (si no, `publicarPasos` ya no mira).
  assert.match(email, /if \(!yaPregunto && cambiaAQuien\) \{\n\s+const otra = await duplicadaDeLaActivacion\(id, \{[\s\S]{0,500}?\}\);\n\s+if \(otra\) throw new DuplicadaError\(otra\);/);
  assert.match(email, /const cambiaAQuien = typeof body\.etapa === 'string' \|\| typeof body\.trigger === 'string' \|\| 'etiquetaId' in body;/);
  assert.match(email, /if \(pasos\) await publicarPasos\(id, pasos, \{ aunqueDuplique: yaPregunto \|\| cambiaAQuien \}\);/);
  // «MaKo escribe tu nutrición» › Aprobar: la ruta lleva la marca y contesta 409.
  const nutri = FUENTE.get('app/api/mako/nutricion/route.ts')!;
  assert.match(nutri, /await aplicarSecuencia\(secuenciaId, body\.pasos, \{ aunqueDuplique: body\.aunqueDuplique === true \}\);/);
  assert.match(nutri, /if \(e instanceof DuplicadaError\) return Response\.json\(\{ ok: false, error: e\.message, duplicada: e\.otra \}, \{ status: 409 \}\);/);
  assert.match(FUENTE.get('lib/nutricion-generator.ts')!, /await publicarPasos\(secuenciaId, pasos, \{ aunqueDuplique: o\.aunqueDuplique === true \}\);/);
});

test('(d) las pantallas de /email: «Guardar igual» al guardar el copy o la secuencia de una activa', () => {
  const g = FUENTE.get('app/_components/NutricionGenerar.tsx')!;
  assert.match(g, /if \(!j\.ok && j\.duplicada\) \{\n\s+setMsg\(\{ t: 'err', x: `No guardé el copy de «\$\{sel\.nombre\}»: \$\{String\(j\.error\)\}\.` \}\);\n\s+setActivarIgual\('Guardar igual'\);\n\s+return;/);
  assert.match(g, /pasos: draft, \.\.\.\(o\.aunqueDuplique \? \{ aunqueDuplique: true \} : \{\}\) \}\);/);
  const e = FUENTE.get('app/email/EmailApp.tsx')!;
  assert.match(e, /if \(!j\.ok && j\.duplicada\) \{\n\s+setSaving\(false\);\n\s+if \(await confirm\(String\(j\.error\), \{ confirmLabel: 'Guardar igual' \}\)\) await guardar\(true\);\n\s+return;/);
});

// ── (e) Cambiar a quién le escribe una ACTIVA, o por dónde, es activarla de nuevo para esa gente ────

/**
 * Los que escriben los CRON con `guardarDisparadores` directo, cada uno por algo. La API de MaKo va por `publicarCrons`
 * (pregunta como Activar). El lienzo guarda en vivo y lo DICE al lado de «Activar» (`dupActiva`); copiar y Crear con IA
 * escriben en una que nace pausada.
 */
const CRONS_SIN_PREGUNTA = ['app/api/chat-agent/secuencias/route.ts', 'lib/flujo-copia-negocio.ts', 'lib/flujo-ia-crear.ts'];

test('(e) la API de MaKo: cambiar los CRON de una activa, o el canal de su primer mensaje, pregunta por la duplicada', () => {
  const escriben: string[] = [];
  for (const [f, src] of FUENTE) if (/\bguardarDisparadores\(/.test(src) && f !== 'lib/disparadores-guardar.ts') escriben.push(f);
  assert.deepEqual(escriben.sort(), CRONS_SIN_PREGUNTA, 'alguien nuevo escribe los CRON sin preguntar: si es una persona, por `publicarCrons`; si no, súmalo con su motivo');
  // La puerta: pregunta con los CRON NUEVOS antes de escribir, salvo con `aunqueDuplique`.
  const g = cuerpo(FUENTE.get('lib/disparadores-guardar.ts')!, 'export async function publicarCrons(');
  assert.match(g, /if \(!o\.aunqueDuplique\) \{\n\s+const otra = await duplicadaDeLaActivacion\(secuenciaId, \{ crons: sanearDisparadores\(entrada\), soloSiActiva: true \}\);\n\s+if \(otra\) throw new DuplicadaError\(otra\);\n\s+\}\n\s+return guardarDisparadores\(secuenciaId, entrada\);/);
  // La propuesta lo dice y sólo entonces el «sí» lleva `aunqueDuplique`; si la gemela aparece después, no escribe.
  const api = FUENTE.get('lib/api-mako/areas/chatbot.run.ts')!;
  const crons = cuerpo(api, '  cambiar_crons_secuencia: {', '\n  },\n');
  assert.match(crons, /const otra = s\.activa \? await duplicadaDeLaActivacion\(id, \{ crons: lista, soloSiActiva: true \}\) : null;/);
  assert.match(crons, /payload: \{ secuenciaId: id, crons: lista, \.\.\.\(otra \? \{ aunqueDuplique: true \} : \{\}\) \}/);
  assert.match(crons, /\$\{otra \? ` Ojo: \$\{avisoDuplicada\(otra\)\}\.` : ''\}/);
  assert.match(crons, /await publicarCrons\(id, payload\.crons, \{ aunqueDuplique: payload\.aunqueDuplique === true \}\);/);
  assert.match(crons, /if \(e instanceof DuplicadaError\) return \{ ok: false,/);
  // Un audio que pasa el primer mensaje de email a WhatsApp: la misma pregunta, por `publicarPasos`.
  const audio = cuerpo(api, '  asignar_audio_paso: {', '\n  },\n');
  assert.match(audio, /const otra = canalCambia\(s\.pasos, nuevos\) \? await duplicadaDeLaActivacion\(id, \{ pasos: nuevos as unknown as PasoGrafo\[\], soloSiActiva: true \}\) : null;/);
  assert.match(audio, /if \(canalCambia\(s\.pasos, pasos\)\) await publicarPasos\(id, pasos, \{ aunqueDuplique: payload\.aunqueDuplique === true \}\);\n\s+else await setSecuenciaPasos\(id, pasos\);/);
  assert.match(audio, /if \(e instanceof DuplicadaError\) return \{ ok: false,/);
  assert.match(api, /const canalCambia = \(antes: readonly PasoSecuencia\[\], despues: readonly PasoSecuencia\[\]\): boolean =>\n\s+\(primerMensajeDe\(antes as unknown as PasoGrafo\[\]\)\?\.canal \?\? null\) !== \(primerMensajeDe\(despues as unknown as PasoGrafo\[\]\)\?\.canal \?\? null\);/);
});

test('(e) con los CRON o el canal NUEVOS se ve la otra activa que ya le escribe a esa gente', async () => {
  const { duplicadaAlActivar } = await import('../lib/automatizacion-duplicada');
  const msg = (id: string, cuerpo: string, canal = 'whatsapp') => ({ id, canal, cuerpo, siguiente: null }) as never;
  const etapa = (e: string) => ({ trigger_tipo: 'etapa_actual', etapa: e, funnel_id: 4 });
  type F = { id: number; nombre: string; activa: boolean; pasos: never[]; crons: ReturnType<typeof etapa>[] };
  const A: F = { id: 1, nombre: 'A recordatorio', activa: true, pasos: [msg('a', 'Mañana es la clase')], crons: [etapa('reactivacion')] };
  const B: F = { id: 2, nombre: 'B agenda', activa: true, pasos: [msg('b', 'Tu reunión es mañana')], crons: [etapa('agenda')] };
  const E: F = { id: 3, nombre: 'E email', activa: true, pasos: [msg('e', 'Te escribo por mail', 'email')], crons: [etapa('reactivacion')] };
  const cronsDe = (f: F) => f.crons;
  assert.equal(duplicadaAlActivar(B, [A, B], cronsDe), null, 'en «agenda» nadie más le escribe');
  assert.equal(duplicadaAlActivar(B, [A, B], cronsDe, { crons: [etapa('reactivacion')] })?.nombre, 'A recordatorio', 'pasarla a «reactivacion»');
  assert.equal(duplicadaAlActivar(E, [A, E], cronsDe), null, 'por email no le escribe por donde le escribe A');
  assert.equal(duplicadaAlActivar(E, [A, E], cronsDe, { pasos: [msg('e', 'Te escribo por mail')] })?.nombre, 'A recordatorio', 'su primer mensaje pasa a WhatsApp');
});

// ── Por EVENTO también es la misma gente: el motor inscribe en TODAS las activas del disparador ──

test('por EVENTO: dos activas con el mismo disparador y el mismo evento avisan; si el motor no las dispara juntas, no', async () => {
  const { duplicadaDe, mismaCohorte } = await import('../lib/automatizacion-duplicada');
  const { disparadoresDe, disparaPorEvento } = await import('../lib/disparadores');
  const msg = (id: string, canal = 'whatsapp') => ({ id, canal, cuerpo: `Hola desde ${id}`, siguiente: null }) as never;
  type Fila = Parameters<typeof disparadoresDe>[0];
  const ev = (trigger_tipo: string, subtipo: string | null, extra: Record<string, unknown> = {}): Fila =>
    ({ trigger_tipo, disparadores: [{ id: 'd1', trigger_tipo, subtipo, ...extra }] }) as Fila;
  const avisa = (fa: Fila, fb: Fila, canal = 'whatsapp') => !!duplicadaDe(
    { id: 2, nombre: 'La copia', disparadores: disparadoresDe(fb), pasos: [msg('b', canal)] },
    [{ id: 1, nombre: 'La de siempre', activa: true, disparadores: disparadoresDe(fa), pasos: [msg('a', canal)] }],
  );
  // Un par de cada clase (los del Cerebro), y lo más común: «Duplicar» una de DM o de pago y prender la copia.
  const iguales: Array<[string, Fila, Fila, string?]> = [
    ['Instagram › Te envía un mensaje', ev('instagram', 'dm'), ev('instagram', 'dm'), 'instagram'],
    ['Messenger › Te envía un mensaje', ev('messenger', 'dm'), ev('messenger', 'dm')],
    ['Se aprueba un pago', ev('pago', 'aprobado'), ev('pago', 'aprobado')],
    ['Se agrega etiqueta (cualquiera)', ev('etiqueta_agregada', null), ev('etiqueta_agregada', null)],
    ['Se agrega etiqueta contra «Se le puso la 5»', ev('etiqueta_agregada', null), { trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 } as Fila],
    ['Recibes un email', ev('email_recibido', 'recibido'), ev('email_recibido', 'recibido'), 'email'],
    ['Agendó pero no confirmó (de antes)', { trigger_tipo: 'agendado_sin_confirmar' } as Fila, { trigger_tipo: 'agendado_sin_confirmar' } as Fila],
    ['No asistió a R1 (de antes)', { trigger_tipo: 'no_show_j1' } as Fila, { trigger_tipo: 'no_show_j1' } as Fila],
    ['Dejó el formulario sin agendar (de antes)', { trigger_tipo: 'instant_form_sin_agenda' } as Fila, { trigger_tipo: 'instant_form_sin_agenda' } as Fila],
  ];
  for (const [nombre, a, b, canal] of iguales) assert.ok(avisa(a, b, canal), `${nombre}: le escriben las dos y no avisa`);
  // El otro evento, una etiqueta ignorada, o «a mano»: el motor no las dispara juntas.
  assert.equal(avisa(ev('instagram', 'dm'), ev('instagram', 'comentario')), false, 'un DM y un comentario');
  assert.equal(avisa(ev('pago', 'aprobado'), ev('pago', 'rechazado')), false, 'aprobado y rechazado');
  assert.equal(avisa(ev('etiqueta_agregada', null, { ignorar: [5] }), { trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 } as Fila), false, 'la que ignora la 5');
  assert.equal(avisa({ trigger_tipo: 'manual' } as Fila, { trigger_tipo: 'manual' } as Fila), false, 'a mano');
  // Y la regla es la del motor: si `disparaPorEvento` dispara las dos con el MISMO evento, `mismaCohorte` las ve juntas.
  const eventos: Array<[Parameters<typeof disparaPorEvento>[1], Parameters<typeof disparaPorEvento>[2]]> = [
    ['instagram', { subtipo: 'dm' }], ['instagram', { subtipo: 'comentario' }], ['messenger', { subtipo: 'dm' }],
    ['pago', { subtipo: 'aprobado' }], ['pago', { subtipo: 'rechazado' }], ['etiqueta', { etiquetaId: 5 }], ['etiqueta', { etiquetaId: 7 }],
    ['etiqueta_quitada', { etiquetaId: 5 }], ['email_recibido', {}],
  ];
  const crons = [
    ev('instagram', 'dm'), ev('instagram', 'comentario'), ev('messenger', 'dm'), ev('pago', 'aprobado'), ev('pago', 'rechazado'),
    ev('etiqueta_agregada', null), ev('etiqueta_agregada', null, { ignorar: [5] }), ev('etiqueta_quitada', null), ev('email_recibido', 'recibido'),
    { trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 } as Fila, { trigger_tipo: 'etiqueta_puesta', etiqueta_id: 7 } as Fila,
  ].map((f) => disparadoresDe(f)[0]);
  for (const [evento, ctx] of eventos) {
    const disparan = crons.filter((d) => disparaPorEvento(d, evento, ctx));
    for (const x of disparan) for (const y of disparan) {
      assert.ok(mismaCohorte(x, y), `${evento} ${JSON.stringify(ctx)} dispara ${x.trigger_tipo}/${x.subtipo ?? x.etiqueta_id ?? ''} y ${y.trigger_tipo}/${y.subtipo ?? y.etiqueta_id ?? ''}: no se avisa`);
    }
  }
});

// ── La red por HECHOS: el texto no decide el aviso ───────────────────────────────────────────

test('por HECHOS: los 34 duplicados de verdad avisan, y los 24 mensajes distintos de la misma etapa también', async () => {
  const { duplicadaDe, avisoDuplicada, parecido } = await import('../lib/automatizacion-duplicada');
  const { PARES, CORTOS, T282, T284 } = await import('./_pares-duplicada');
  const msg = (id: string, cuerpo: string) => ({ id, canal: 'whatsapp', cuerpo, siguiente: null }) as never;
  const cron = { trigger_tipo: 'etapa_actual', etapa: 'clase', funnel_id: 4 };
  const activa = (t: string, id = 1, nombre = 'La otra') => ({ id, nombre, activa: true, disparadores: [cron], pasos: [msg('a', t)] });
  const esta = (t: string) => ({ id: 2, nombre: 'Ésta', disparadores: [cron], pasos: [msg('b', t)] });
  // Los 24 duplicados (el mismo mensaje editado o reescrito) y los 10 cortos con el nombre del negocio.
  const duplicados = [...PARES.filter((p) => p.dup).map((p) => [p.id, p.a, p.b]), ...CORTOS.map(([id, , a, b]) => [id, a, b])];
  assert.equal(duplicados.length, 34);
  assert.deepEqual(duplicados.filter(([, a, b]) => !duplicadaDe(esta(b), [activa(a)])).map(([id]) => id), [], 'un duplicado de verdad pasó sin aviso');
  // Los 24 distintos a la misma gente: también, y el aviso es cierto (le escriben las dos).
  const distintos = PARES.filter((p) => !p.dup);
  assert.equal(distintos.length, 24);
  assert.deepEqual(distintos.filter((p) => !duplicadaDe(esta(p.b), [activa(p.a)])).map((p) => p.id), [], 'a la misma gente se avisa siempre');
  // #282 y #284: los dos arranques, uno al lado del otro.
  assert.match(avisoDuplicada(duplicadaDe(esta(T284), [activa(T282)])!),
    /^A la misma gente ya le escribe «La otra»: «¡Holaa \{\{nombre\}\}! Paso a recordarte .+…»\. Ésta: «Holaa \{\{nombre\}\}! Mañana miércoles .+…»$/);
  // El parecido sólo ORDENA: con dos activas a la misma gente, se muestra la que más se parece, venga en el orden que venga.
  const grabacion = activa('Te dejo el link de la grabación de la clase', 3, 'La grabación');
  assert.equal(duplicadaDe(esta(T284), [grabacion, activa(T282)])?.nombre, 'La otra');
  assert.equal(duplicadaDe(esta('Te dejo el link de la grabación de ayer'), [activa(T282), grabacion])?.nombre, 'La grabación');
  assert.ok(parecido(T282, T284) > parecido('Te dejo el link de la grabación de la clase', T284));
  // Y ninguna regla sobre el texto vuelve a decidir: ni un umbral ni una firma.
  assert.doesNotMatch(FUENTE.get('lib/automatizacion-duplicada.ts')!, /UMBRAL_PARECIDO|palabrasDeFirma|MIN_PALABRAS|parecido\([^)]*\) *[<>]=?/,
    'volvió una regla de texto que decide el aviso');
});

test('el arranque del aviso: en una línea, cortado sin partir una palabra, y un audio lo dice', async () => {
  const { arranqueParaAviso, LARGO_ARRANQUE } = await import('../lib/automatizacion-duplicada');
  const { T282 } = await import('./_pares-duplicada');
  const corto = arranqueParaAviso(T282);
  const plano = T282.replace(/\s+/g, ' ');
  assert.ok(corto.length <= LARGO_ARRANQUE && corto.endsWith('…'), corto);
  assert.ok(plano.startsWith(corto.slice(0, -1)) && plano[corto.length - 1] === ' ', `partió una palabra: ${corto}`);
  assert.equal(arranqueParaAviso('Hola\n\n{{nombre}}  ¿venís?'), 'Hola {{nombre}} ¿venís?');
  assert.equal(arranqueParaAviso('   '), '(un audio o un archivo, sin texto)');
  // ⚠️ Sin partir un emoji (revisión del 21/10/2026): medio par suelto se veía «�» y la pendiente del Doer no se guardaba.
  const suelto = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
  const fuego = arranqueParaAviso(`Hola {{nombre}}! Mira:${'🔥'.repeat(80)}`);
  assert.ok(!suelto.test(fuego) && fuego.endsWith('🔥…'), `partió un emoji: ${JSON.stringify(fuego.slice(-4))}`);
  assert.ok(Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(fuego)).length <= LARGO_ARRANQUE);
  const familia = arranqueParaAviso(`Hola:${'👨‍👩‍👧'.repeat(80)}`);
  assert.ok(familia.endsWith('👨‍👩‍👧…'), `partió una familia: ${JSON.stringify(familia.slice(-6))}`);
});

test('«MaKo escribe tu nutrición»: el copy se queda quieto mientras guarda, y «… igual» se apaga con otro texto', () => {
  const g = FUENTE.get('app/_components/NutricionGenerar.tsx')!;
  // Un texto editado a mitad del guardado dejaba «Guardar igual» armado para el texto de ANTES: cada campo que cambia el
  // copy (la lista sale del archivo) se deshabilita mientras algo escribe.
  const editan = g.split('\n').filter((l) => /on(Change|Click)=\{\([^)]*\) => (editPaso|setProv)\(/.test(l));
  assert.equal(editan.length, 5, 'asunto, preheader, el cuerpo y los dos botones de «Se manda por»');
  for (const l of editan) assert.match(l, /disabled=\{ocupado\}/, `se edita mientras guarda: ${l.trim().slice(0, 90)}`);
  assert.match(g, /const ocupado = busy !== null \|\| submitting !== null;/);
  assert.match(g, /useEffect\(\(\) => \{ setActivarIgual\(null\); \}, \[sel\?\.id, draft\]\);/);
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
//
// Publicar una activa (21/10/2026, `roturas-publicar.json`). Base 11 / 0. Cada una → 10 / 1 (salvo donde se dice):
//   P1. `publicarPasos` no pregunta                       P8. la propuesta de la API sin el aviso
//   P2. la ruta de WhatsApp escribe directo  → 9 / 2      P9. la API de mensajes publica sin preguntar
//   P3. /email › Guardar escribe directo                  P10. la API de email publica sin preguntar
//   P4. /email no pregunta con la etapa nueva             P11. un escritor nuevo de los pasos (sin clasificar)
//   P5. Aprobar sin la marca                              P12. «MaKo escribe tu nutrición» ignora el 409 al guardar
//   P6. Aprobar sin el 409                                P13. /email › Guardar ignora el 409
//   P7. el generador publica sin preguntar                S1. el barrido sin los .mts  → 8 / 3
// Restaurado: 11 / 0. (P4 no caía con la primera versión: el test miraba el orden y no la condición; se sumó.)
// (Las roturas de la firma, F1–F4 y R1–R7, se fueron con la firma el 21/10/2026: docs/hallazgos-chatbot.md.)
//
// La red por HECHOS (21/10/2026, `roturas-hechos.json`, md5 igual al restaurar). Base 13 / 0. Cada una → 12 / 1:
//   H1. vuelve un umbral de parecido               H9. el cuerpo se edita mientras guarda
//   H4. un horario sin leer no se pisa             H11. «Guardar igual» queda colgado
//   H5. el aviso sin los dos arranques             H12. un botón de «Se manda por» se usa mientras guarda
//   H6. el parecido no ordena                      H13. el server vuelve a pasar el nombre del negocio
//   H7. el arranque parte una palabra
// Restaurado: 13 / 0. Las 17 roturas caen en al menos uno de los tres tests del aviso (tests/recurrente-no-salio.test.ts,
// tests/automations-aviso-todos-caminos.test.ts y éste).
//
// Por evento, por la API y los bajos (21/10/2026, `roturas-eventos.json`, md5 igual). Base 16 / 0. Cada una → 15 / 1:
//   E1. por evento vuelve a no compararse          A3. `publicarCrons` no pregunta
//   E2. sin mirar el evento (`subtipo`)            A4. el audio que cambia el canal no pregunta
//   E3. «cualquier etiqueta» no cruza con la de una A5. el server ignora los CRON nuevos
//   E4. «cualquier etiqueta» sin mirar «Ignorar»   A6. `duplicadaAlActivar` ignora los CRON nuevos
//   E5. «a mano» cuenta como misma gente           P1. una pausada lee todas
//   G1. el arranque por unidades UTF-16            P2. lee también las pausadas
//   G2. el arranque por puntos de código           S1. una mudanza prende aunque ya haya otra del evento
//   A1. la propuesta de CRON no pregunta
//   A2. el «sí» de CRON guarda directo
// Restaurado: 16 / 0. Las 21 caen en al menos uno de los tres (Z1–Z5, los horarios, en tests/recurrente-no-salio.test.ts).
