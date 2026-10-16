// =============================================================================
// «Editar con MaKo»: una frase cambia la hoja abierta del Dashboard o de General (lib/graficos-ia-edicion.ts)
// =============================================================================
// Martín, 16/10/2026: «en dashboard y general no está la edición con IA, y debería... quiero que la app sea AI NATIVE».
// Fija lo que hace `aplicarEdicion` (el `validar` de la cascada) con hojas de verdad: lo que el pedido no nombra queda
// como estaba, lo nuevo va abajo (o arriba) sin mover lo demás, lo que no existe se anota y, con más de la mitad mal, se
// rechaza. El ALCANCE de General (sus tipos, sus conjuntos, sus bloques) vale para editar y para «Pídeselo». Y el
// cableado: la ruta no escribe, el panel aplica por `mutar` sólo si la hoja no cambió, la cascada es la de «Pídeselo»
// (gratis, los mismos escalones) y la API aplica con el compare-and-set de la hoja.
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada de memoria (base 16/0):
//   · lo nuevo sin bajar abajo de todo                       -> 15 / 1
//   · lo nuevo arriba sin bajar lo de antes                  -> 15 / 1
//   · cambiar un gráfico le pisa el lugar                    -> 15 / 1
//   · sin el rechazo por «más de la mitad mal»               -> 14 / 2
//   · cambiar el conjunto sin decir las métricas             -> 15 / 1
//   · sin cambios igual rehace la hoja                       -> 14 / 2
//   · sin el tope de lo que se agrega de una vez             -> 15 / 1
//   · al modelo le llega el componente entero                -> 15 / 1
//   · todo lo hablado viaja (sin el corte de turnos)         -> 15 / 1
//   · General acepta cualquier tipo                          -> 14 / 2
//   · un bloque de General entra en el Dashboard             -> 15 / 1
//   · el catálogo de General sin el recorte de tipos         -> 15 / 1
//   · la cascada sin la red de plataforma                    -> 15 / 1
//   · la ruta usa la hoja sin sanear                         -> 15 / 1
//   · el panel aplica sin mirar si la hoja cambió            -> 15 / 1
//   · el editor aplica por fuera de mutar                    -> 15 / 1
//   · la galería no dice de qué informe es                   -> 15 / 1
//   · la API aplica aunque hayan tocado la hoja              -> 15 / 1
//   · General por la API aplica aunque la hayan tocado       -> 15 / 1
//
// Correr: npx tsx --test tests/graficos-ia-edicion.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_PROMPT_EDITAR, EDITAR_HOJA_IA_SYSTEM_TEMPLATE, TOPE_AGREGAR_IA, TURNOS_IA, aplicarEdicion, firmaDeHoja, hojaParaIA, userDeEdicion,
} from '../lib/graficos-ia-edicion';
import { ALCANCE_GENERAL, catalogoParaIA, deIAHoja } from '../lib/graficos-ia';
import { esElemento, esGrafico, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { TIPOS_GENERAL } from '../lib/general-piezas';
import { aplicarCambio } from '../lib/api-mako/areas/dashboard.helpers';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const marketing = (): Hoja => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'marketing')!);
const general = (): Hoja => instanciarPlantilla(PLANTILLAS_GENERAL[0]);
const graficosDe = (h: Hoja) => h.componentes.filter(esGrafico);
const abajo = (h: Hoja) => Math.max(0, ...h.componentes.map((c) => c.y + c.h));
const LEADS_SEMANA = { tipo: 'columnas', fuente: 'leads', metricas: ['leads'], dimension: 'semana', desglose: null, titulo: 'Leads por semana' };

// ── Lo que hace con la hoja ──────────────────────────────────────────────────────────────────

test('agregar: va ABAJO de todo con un id nuevo, y lo que estaba no se mueve', () => {
  const h = marketing();
  const r = aplicarEdicion(h, { respuesta: 'Listo.', agregar: [LEADS_SEMANA] });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.cambios, ['Agregué «Leads por semana»']);
  const nuevo = r.hoja.componentes.find((c) => !h.componentes.some((x) => x.id === c.id))!;
  assert.ok(nuevo && esGrafico(nuevo));
  assert.equal(nuevo.y, abajo(h), 'abajo de todo');
  for (const c of h.componentes) {
    const d = r.hoja.componentes.find((x) => x.id === c.id)!;
    assert.deepEqual([d.x, d.y, d.w, d.h], [c.x, c.y, c.w, c.h], `${c.id} se movió`);
  }
});

test('agregar arriba: va primero y lo de antes baja lo que mide lo nuevo', () => {
  const h = marketing();
  const r = aplicarEdicion(h, { respuesta: 'ok', agregar: [{ ...LEADS_SEMANA, arriba: true }] });
  const nuevo = r.hoja.componentes.find((c) => !h.componentes.some((x) => x.id === c.id))!;
  assert.equal(nuevo.y, 0);
  const primero = h.componentes[0];
  assert.equal(r.hoja.componentes.find((x) => x.id === primero.id)!.y, primero.y + nuevo.h);
});

test('quitar y cambiar: sólo lo que nombra; un cambio de título no toca lo demás del gráfico', () => {
  const h = marketing();
  const [a, b] = graficosDe(h);
  const r = aplicarEdicion(h, { respuesta: 'ok', quitar: [a.id], cambiar: [{ id: b.id, titulo: 'Otro título' }] });
  assert.deepEqual(r.errores, []);
  assert.ok(!r.hoja.componentes.some((c) => c.id === a.id), 'quitó');
  const cb = r.hoja.componentes.find((c) => c.id === b.id)!;
  assert.ok(esGrafico(cb));
  assert.equal(cb.titulo, 'Otro título');
  assert.deepEqual([cb.tipo, cb.fuente, cb.metricas, cb.x, cb.y, cb.w, cb.h], [b.tipo, b.fuente, b.metricas, b.x, b.y, b.w, b.h]);
  assert.equal(r.hoja.componentes.length, h.componentes.length - 1);
});

test('lo que no existe se anota y, con más de la mitad mal, se rechaza (para el reintento)', () => {
  const h = marketing();
  const [a] = graficosDe(h);
  const una = aplicarEdicion(h, { respuesta: 'ok', quitar: [a.id, 'no-existe'], agregar: [LEADS_SEMANA] });
  assert.deepEqual(una.errores, [], 'uno de tres mal todavía pasa');
  assert.ok(una.correcciones.some((x) => x.includes('no-existe')));
  assert.deepEqual(una.avisos, ['Un cambio quedó afuera']);
  const mal = aplicarEdicion(h, { respuesta: 'ok', quitar: ['x', 'y'], agregar: [{ tipo: 'nada', fuente: 'leads', metricas: ['leads'] }] });
  assert.ok(mal.errores.length > 0);
  assert.ok(aplicarEdicion(h, {}).errores.length > 0, 'sin respuesta ni cambios');
});

test('cambiar el conjunto sin decir las métricas no se hace (las de antes no son de él)', () => {
  const h = marketing();
  const [, b] = graficosDe(h);
  const r = aplicarEdicion(h, { respuesta: 'ok', cambiar: [{ id: b.id, fuente: 'pagos' }] });
  assert.ok(r.correcciones.some((x) => x.includes('sin decir sus métricas')));
  assert.equal(r.hoja, h, 'no cambió nada: la MISMA hoja');
});

test('una respuesta sin cambios (una pregunta) se acepta y devuelve la MISMA hoja', () => {
  const h = marketing();
  const r = aplicarEdicion(h, { respuesta: '¿Qué gráfico quieres que cambie?' });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.cambios, []);
  assert.equal(r.hoja, h);
});

test('el nombre de la hoja, y el tope de lo que se agrega de una vez', () => {
  const h = marketing();
  const r = aplicarEdicion(h, { respuesta: 'ok', nombre: 'Pauta' });
  assert.equal(r.hoja.nombre, 'Pauta');
  assert.deepEqual(r.cambios, ['Le puse «Pauta» a la hoja']);
  const muchos = aplicarEdicion(h, { respuesta: 'ok', agregar: Array.from({ length: TOPE_AGREGAR_IA + 3 }, () => LEADS_SEMANA) });
  assert.equal(muchos.hoja.componentes.length, h.componentes.length + TOPE_AGREGAR_IA);
  assert.ok(muchos.avisos.includes(`Agregué los primeros ${TOPE_AGREGAR_IA}`));
});

// ── General: lo que General ofrece, en las dos capas ─────────────────────────────────────────

test('General: un tipo del Dashboard se descarta y un bloque de General entra; en el Dashboard, al revés', () => {
  const g = general();
  const r = aplicarEdicion(g, { respuesta: 'ok', agregar: [{ bloque_general: 'tareas' }, { tipo: 'sankey', fuente: 'leads', metricas: ['leads'] }] }, ALCANCE_GENERAL);
  assert.deepEqual(r.cambios, ['Agregué «Tareas prioritarias»']);
  assert.ok(r.correcciones.some((x) => /el tipo "sankey" no va en esta hoja/.test(x)));
  const d = aplicarEdicion(marketing(), { respuesta: 'ok', agregar: [{ bloque_general: 'tareas' }] });
  assert.ok(d.errores.length > 0, 'en el Dashboard un bloque de General no entra');
});

test('«Pídeselo» en General: el catálogo trae sólo lo de General y sus bloques, y la traducción descarta lo demás', () => {
  const cat = catalogoParaIA(undefined, ALCANCE_GENERAL);
  assert.match(cat, /BLOQUES DE GENERAL/);
  assert.doesNotMatch(cat, /^- sankey/m, 'un tipo que General no ofrece');
  for (const t of TIPOS_GENERAL) assert.match(cat, new RegExp(`^- ${t}\\b`, 'm'));
  assert.doesNotMatch(catalogoParaIA(), /BLOQUES DE GENERAL/, 'el Dashboard no ofrece bloques de General');
  const r = deIAHoja({ nombre: 'Hoy', componentes: [{ bloque_general: 'agenda' }, { tipo: 'sankey', fuente: 'leads', metricas: ['leads'] }] }, ALCANCE_GENERAL);
  assert.ok(r.hoja.componentes.some((c) => esElemento(c) && c.tipo === 'general'));
  assert.ok(!r.hoja.componentes.some((c) => esGrafico(c) && c.tipo === 'sankey'));
});

// ── Lo que viaja al modelo ───────────────────────────────────────────────────────────────────

test('al modelo le llega la ESTRUCTURA de la hoja, nunca un valor; y todo como dato', () => {
  const h = marketing();
  const j = JSON.parse(hojaParaIA(h)) as { componentes: Array<Record<string, unknown>> };
  const permitidas = new Set(['id', 'tipo', 'fuente', 'metricas', 'dimension', 'desglose', 'titulo', 'periodo', 'comparar', 'seccion', 'bloque_general', 'elemento']);
  for (const c of j.componentes) for (const k of Object.keys(c)) assert.ok(permitidas.has(k), `«${k}» no es estructura`);
  const u = userDeEdicion({ hoja: h, pedido: 'agrega el CPL', historial: Array.from({ length: 10 }, (_, i) => ({ quien: 'persona' as const, texto: `turno ${i}` })) });
  assert.match(u, /<hoja>[\s\S]*<\/hoja>/);
  assert.match(u, /<pedido>\nagrega el CPL\n<\/pedido>/);
  assert.match(u, new RegExp(`turno ${10 - TURNOS_IA}\\b`));
  assert.doesNotMatch(u, new RegExp(`turno ${10 - TURNOS_IA - 1}\\b`), 'sólo los últimos turnos');
});

test('el system: registrado en /configuraciones sin slots, y la única interpolación son los períodos', () => {
  assert.equal(CLAVE_PROMPT_EDITAR, 'dashboard.editar-ia.system');
  const reg = leer('lib', 'prompt-registry.ts');
  const i = reg.indexOf("key: 'dashboard.editar-ia.system'");
  assert.ok(i > 0, 'falta en el registro');
  const fila = reg.slice(i, reg.indexOf('},', i));
  assert.match(fila, /default: EDITAR_HOJA_IA_SYSTEM_TEMPLATE,/);
  assert.match(fila, /variables: \[\],/);
  assert.doesNotMatch(EDITAR_HOJA_IA_SYSTEM_TEMPLATE, /\{\{/);
  assert.match(EDITAR_HOJA_IA_SYSTEM_TEMPLATE, /"agregar"[\s\S]*"quitar"[\s\S]*"cambiar"/);
});

// ── El cableado ──────────────────────────────────────────────────────────────────────────────

test('la ruta: la puerta (admin y la tab de su informe), sanea la hoja que llega, y no escribe', () => {
  const r = leer('app', 'api', 'graficos', 'editar', 'route.ts');
  assert.match(r, /if \(rol == null\) return err\(401/);
  assert.match(r, /if \(rol !== 'admin'\) return err\(403/);
  assert.match(r, /if \(!tabEnCapa\(general \? 'general' : 'graphics', await getCapaActual\(\)\)\) return err\(404/);
  assert.match(r, /const hoja = sanearHoja\(body\?\.hoja, 0\);/);
  assert.match(r, /alcance: general \? ALCANCE_GENERAL : undefined/);
  assert.doesNotMatch(r, /guardarTablero|\.from\(|getTenantDb|setSetting/, 'no guarda: la hoja la mete el editor con mutar');
});

test('la cascada: la de «Pídeselo», gratis y con los mismos escalones en el mismo orden', () => {
  const ed = leer('lib', 'graficos-ia-editar.ts');
  const gen = leer('lib', 'graficos-ia-generar.ts');
  assert.doesNotMatch(ed, /chatClaude|anthropic|chatCheapTools/i, 'nada que cobre');
  assert.match(ed, /const \{ provs, modelos \} = await proveedoresHojaIA\(\);/);
  assert.match(gen, /const \{ provs, modelos \} = await proveedoresHojaIA\(\);/, 'los dos eligen a los mismos');
  assert.match(ed, /validar: \(t\) => \{[\s\S]*?aplicarEdicion\(p\.hoja, obj, p\.alcance\)[\s\S]*?if \(r\.errores\.length\)/);
  const orden = (src: string, marcas: string[]) => marcas.map((m) => src.indexOf(m));
  const enEd = orden(ed, ["motivo: 'reparar el JSON de la edición'", "motivo: 'Corregir la edición de la hoja con IA'", 'await porLaRedDePlataforma(', 'falloDeIA(errores, hayIA)']);
  const enGen = orden(gen, ["motivo: 'reparar el JSON de la hoja'", "motivo: 'Corregir la hoja del Dashboard con IA'", 'await porLaRedDePlataforma(', 'falloDeIA(errores, hayIA)']);
  for (const [src, xs] of [['editar', enEd], ['generar', enGen]] as const) {
    assert.ok(xs.every((x) => x > 0), `${src}: falta un escalón`);
    assert.deepEqual([...xs].sort((a, b) => a - b), xs, `${src}: los escalones fuera de orden`);
  }
});

test('el panel: aplica por el editor sólo si la hoja no cambió, re-sanea lo que llega, y deshace sólo lo suyo', () => {
  const p = leer('app', 'dashboard', 'PanelEditarMako.tsx');
  assert.match(p, /fetch\('\/api\/graficos\/editar', \{[\s\S]*?body: JSON\.stringify\(\{ hoja: enviada, pedido, historial, informe \}\)/);
  assert.match(p, /const nueva = sanearHoja\(j\.hoja, 0\);/);
  const i = p.indexOf('if (leerHoja(enviada.id) !== enviada)');
  assert.ok(i > 0 && i < p.indexOf('onAplicar(nueva);'), 'se compara ANTES de aplicar');
  assert.match(p, /if \(!m\.antes \|\| !m\.hojaId \|\| leerHoja\(m\.hojaId\) !== m\.aplicada\) return;/);
  const ed = leer('app', 'dashboard', 'EditorInforme.tsx');
  assert.match(ed, /const ponerHojaDeMako = useCallback\(\(h: Hoja\) => mutarHoja\(\(\) => h, h\.id\), \[mutarHoja\]\);/, 'por mutar: deshacer y autoguardado');
  assert.match(ed, /\{guardable && !enBlanco && !compartido && \(\s*<BotonMako lado=\{30\} title="Editar con MaKo"/);
  assert.match(ed, /const alternarAnalista = useCallback\(\(\) => \{ setMenu\(null\); setMakoEditar\(false\);/, 'un panel cierra al otro');
});

test('«Pídeselo» y las plantillas en General: la galería dice de qué informe es, y las rutas pasan el alcance', () => {
  assert.match(leer('app', 'dashboard', 'NuevaHoja.tsx'), /body: JSON\.stringify\(\{ pedido: texto, informe \}\)/);
  const ia = leer('app', 'api', 'graficos', 'ia', 'route.ts');
  assert.match(ia, /generarHojaIA\(pedido, inicio, general \? \{ alcance: ALCANCE_GENERAL \} : \{\}\)/);
  assert.match(ia, /if \(general\) \{ if \(!tabEnCapa\('general', await getCapaActual\(\)\)\) return err\(404/);
  assert.match(leer('lib', 'graficos-con-datos-server.ts'), /soloFuentes: conDatos, alcance: o\.alcance \}/);
});

test('la API: propone la hoja que armó MaKo y la aplica sólo si nadie la tocó en el medio', () => {
  const h = marketing();
  const otra = aplicarEdicion(h, { respuesta: 'ok', agregar: [LEADS_SEMANA] }).hoja;
  const t: Tablero = { v: 3, nombre: 'Informe', hojas: [h] } as Tablero;
  const bien = aplicarCambio(t, { op: 'editar_con_ia', hojaId: h.id, antes: firmaDeHoja(h), hoja: otra });
  assert.ok(bien.ok && bien.tablero.hojas[0].componentes.length === h.componentes.length + 1);
  const tocada: Tablero = { ...t, hojas: [{ ...h, nombre: 'La tocó alguien' }] };
  const mal = aplicarCambio(tocada, { op: 'editar_con_ia', hojaId: h.id, antes: firmaDeHoja(h), hoja: otra });
  assert.ok(!mal.ok && /cambió desde que MaKo la leyó/.test(mal.error));
  const run = leer('lib', 'api-mako', 'areas', 'dashboard.run.ts');
  assert.match(run, /cambio: \{ op: 'editar_con_ia', hojaId: h\.id, antes: firmaDeHoja\(h\), hoja: e\.hoja \}/);
  const gen = leer('lib', 'api-mako', 'areas', 'general.run.ts');
  assert.match(gen, /editarHojaIA\(\{ hoja, pedido: pedido\.slice\(0, TOPE_PEDIDO_IA\), alcance: ALCANCE_GENERAL,/);
  assert.match(gen, /if \(firmaDeHoja\(actual\.tablero\.hojas\[i\]\) !== payload\.antes\)/);
  assert.match(gen, /generarHojaIA\(pedido\.slice\(0, TOPE_PEDIDO_IA\), Date\.now\(\), \{ alcance: ALCANCE_GENERAL,/, 'crear_hoja_general con pedido, con el alcance');
});
