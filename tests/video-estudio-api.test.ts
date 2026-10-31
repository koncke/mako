// =============================================================================
// El estudio de video por prompt (27/10/2026): cada botón ↔ su operación del chat, y lo que filmar no puede hacer
// =============================================================================
// Martín: «todo lo que se hace a mano se puede hacer por prompt». La lista de botones son las server actions que exporta la
// tab (app/video-generator/estudio/inventario.ts); cada una tiene su operación del registro o su motivo escrito. Las
// operaciones nuevas (lib/api-mako/areas/video-estudio.def.ts) llaman a LA MISMA acción que el botón, sólo por el chat de la
// app, nunca en una automatización, y filmar (que gasta créditos de Google) se confirma en pantalla y de a una toma.
//
// Probado rompiéndolo: ver el bloque «PROBADO ROMPIÉNDOLO» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INVENTARIO, BOTONES_SIN_ACCION, ARCHIVOS_DE_ACCIONES, opsDelInventario } from '../app/video-generator/estudio/inventario';
import { porQueNoFilmar, SIN_PUENTE, PUENTE_VIEJO } from '../app/video-generator/estudio/filmar';
import { DEFS } from '../lib/api-mako/areas/video-estudio.def';
import { REGISTRO } from '../lib/api-mako/registro';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const IDS_NUEVOS = new Set(DEFS.map((d) => d.id));

/** Las server actions que exporta cada archivo de la tab. */
const exportadas = (): string[] => ARCHIVOS_DE_ACCIONES.flatMap((a) =>
  [...sinComentarios(leer(`app/video-generator/${a}`)).matchAll(/^export async function (\w+)/gm)].map((m) => m[1]));

/** El cuerpo de UN runner de video-estudio.run.ts: desde `  <id>: {` hasta el runner siguiente. */
function runner(id: string): string {
  const src = sinComentarios(leer('lib/api-mako/areas/video-estudio.run.ts'));
  const ini = src.search(new RegExp(`^  ${id}: \\{`, 'm'));
  assert.ok(ini >= 0, `no encontré el runner «${id}»`);
  const resto = src.slice(ini + 3);
  const fin = resto.search(/^ {2}[a-z][a-z0-9_]*: \{/m);
  return fin < 0 ? resto : resto.slice(0, fin);
}

test('cada server action de la tab está en el inventario, y el inventario no nombra acciones que ya no existen', () => {
  const hay = exportadas();
  assert.ok(hay.length >= 45, `leí sólo ${hay.length} acciones: el barrido no está mirando`);
  const faltan = hay.filter((a) => !(a in INVENTARIO));
  assert.deepEqual(faltan, [], `botones sin su operación ni su motivo en estudio/inventario.ts: ${faltan.join(', ')}`);
  const sobran = Object.keys(INVENTARIO).filter((a) => !hay.includes(a));
  assert.deepEqual(sobran, [], `el inventario nombra acciones que ya no existen: ${sobran.join(', ')}`);
  for (const [a, e] of [...Object.entries(INVENTARIO), ...Object.entries(BOTONES_SIN_ACCION)]) {
    if ('motivo' in e) assert.ok(e.motivo.trim().length >= 20, `«${a}»: el motivo tiene que decir por qué`);
  }
});

test('toda operación del inventario existe en el registro, y toda operación nueva tiene su botón', () => {
  const ids = new Set(REGISTRO.map((d) => d.id));
  for (const op of opsDelInventario()) assert.ok(ids.has(op), `«${op}» no está en el registro de la API`);
  for (const d of DEFS) assert.ok(opsDelInventario().includes(d.id), `«${d.id}» no corresponde a ningún botón del inventario`);
  for (const d of DEFS) assert.ok(REGISTRO.some((r) => r.id === d.id), `«${d.id}» no entró al registro (registro.ts → video)`);
});

test('cada operación nueva llama a LA MISMA acción que su botón', () => {
  for (const [accion, e] of Object.entries(INVENTARIO)) {
    if (!('op' in e) || !IDS_NUEVOS.has(e.op)) continue;
    assert.match(runner(e.op), new RegExp(`\\b${accion}\\(`), `«${e.op}» no llama a ${accion}: el chat haría otra cosa que el botón`);
  }
});

test('sólo por el chat de la app, del admin, y nunca en una automatización', () => {
  for (const d of DEFS) {
    assert.equal(d.area, 'video', d.id);
    assert.deepEqual(d.canales, ['app'], `${d.id}: las acciones leen la sesión de la persona; por WhatsApp o HTTP no hay`);
    assert.equal(d.gating?.tab, 'video-generator', d.id);
    assert.equal(d.gating?.rolMinimo, 'admin', `${d.id}: la tab es del admin`);
  }
  const flujo = leer('lib/api-mako/flujo.ts');
  assert.match(flujo, /import \{ DEFS as DEL_ESTUDIO_DE_VIDEO \} from '\.\/areas\/video-estudio\.def';/);
  assert.match(flujo, /export const NO_EN_FLUJOS: ReadonlySet<string> = new Set\(\[[^\]]*\.\.\.DEL_ESTUDIO_DE_VIDEO\.map\(\(d\) => d\.id\)\]\);/,
    'fuera de la lista de «⚡ Acción» de los lienzos');
  const run = sinComentarios(leer('lib/api-mako/areas/video-estudio.run.ts'));
  assert.match(run, /const sinPersona = \(ctx: Ctx\): boolean => ctx\.canal !== 'app' \|\| ctx\.canalKey\.startsWith\(PREFIJO_FLUJO\);/);
  assert.match(run, /export const RUNNERS: Runners = soloDesdeLaApp\(\{/, 'y un paso viejo de un flujo también se rechaza');
  // El registro lo importan WhatsApp, los crons y los webhooks: las acciones de la tab se cargan al usarlas, nunca con un import fijo.
  assert.doesNotMatch(run, /^import [^;]*from '@\/app\/video-generator\/[a-z-]*actions?';/m);
  assert.match(run, /const deVideo = \(\) => import\('@\/app\/video-generator\/video-action'\);/);
});

test('filmar gasta créditos: se confirma en pantalla, de a una toma, y se vuelve a preguntar al confirmar', () => {
  const f = DEFS.find((d) => d.id === 'filmar_toma_anuncio');
  assert.ok(f && f.tipo === 'accion');
  assert.equal(f.costo, 'dinero');
  assert.equal(f.confirmacion, 'pantalla');
  assert.equal(f.plata, true);
  assert.deepEqual(f.parametros.map((p) => p.nombre), ['planId', 'toma'], 'una toma por confirmación, nunca una lista');
  const r = runner('filmar_toma_anuncio');
  assert.match(r, /faltaParaConfirmar: async/);
  assert.equal((r.match(/porQueNoFilmar\(/g) ?? []).length, 2, 'la misma pregunta al proponer y al confirmar');
  // generarTomaAction contesta ok: true sin filmar sobre una toma ya filmada o en vuelo: el runner mira la marca.
  assert.match(r, /if \(!m\?\.trabajoId && !m\?\.operacion && !m\?\.url\) return \{ ok: false/);
  // Lo demás no cuesta plata: ninguna otra es `dinero`.
  for (const d of DEFS) if (d.id !== 'filmar_toma_anuncio') assert.notEqual(d.costo, 'dinero', d.id);
});

/** Un anuncio de mentira con la toma 1 en el escenario 1. */
function anuncio(confirmada: boolean): Pick<PlanGuardado, 'escenas' | 'imagenes'> {
  return {
    escenas: [{ n: 1, desde: 1, hasta: 2 }] as unknown as PlanGuardado['escenas'],
    imagenes: { '1': { confirmada } } as unknown as PlanGuardado['imagenes'],
  };
}
const ANDA = { anda: true, vieja: false };

test('porQueNoFilmar: lo filmado, lo que se filma, sin texto, sin escenario aprobado y sin navegador', () => {
  assert.equal(porQueNoFilmar(anuncio(true), 1, 'sin_filmar', ANDA), null);
  assert.equal(porQueNoFilmar(anuncio(true), 2, 'con_error', ANDA), null, 'una toma que falló se puede volver a filmar');
  assert.match(porQueNoFilmar(anuncio(true), 1, 'filmada', ANDA) ?? '', /ya está filmada/);
  assert.match(porQueNoFilmar(anuncio(true), 1, 'generando', ANDA) ?? '', /se está filmando/);
  assert.match(porQueNoFilmar(anuncio(true), 1, 'sin_poder_leer', ANDA) ?? '', /se está filmando/, 'sin poder leerla no es un error: refilmar cobraría otro clip');
  assert.match(porQueNoFilmar(anuncio(true), 1, 'sin_texto', ANDA) ?? '', /no tiene texto/);
  assert.match(porQueNoFilmar(anuncio(false), 1, 'sin_filmar', ANDA) ?? '', /aprueba la imagen/);
  assert.match(porQueNoFilmar(anuncio(true), 3, 'sin_filmar', ANDA) ?? '', /aprueba la imagen/, 'una toma sin escenario no se filma');
  assert.match(porQueNoFilmar({}, 1, 'sin_filmar', ANDA) ?? '', /aprueba la imagen/, 'sin escenarios todavía, tampoco');
  assert.equal(porQueNoFilmar(anuncio(true), 1, 'sin_filmar', { anda: false, vieja: false }), SIN_PUENTE);
  assert.equal(porQueNoFilmar(anuncio(true), 1, 'sin_filmar', { anda: true, vieja: true }), PUENTE_VIEJO);
});

test('las respuestas no devuelven el anuncio crudo (prompts, fotos, urls firmadas): sólo su id y el link', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/video-estudio.run.ts'));
  // `item` suelto (el objeto entero), no `item.id`.
  assert.doesNotMatch(run, /datos: \{[^}]*\bitem\b(?![.?])/, 'el item del historial no viaja en `datos`');
  assert.doesNotMatch(run, /JSON\.stringify\([^)]*\bitem\b(?![.?])/);
  assert.match(run, /JSON\.stringify\(\{ planId: a\.item\.id,/, 'la lectura devuelve campos sueltos');
});

// PROBADO ROMPIÉNDOLO (27/10/2026, base 7/0):
//   · una acción nueva en video-action.ts sin su fila en el inventario                         → 6/1
//   · `editar_texto_toma` sin la llamada a escribirVozTomaAction                               → 6/1
//   · `filmar_toma_anuncio` con `canales: ['app', 'whatsapp']`                                 → 6/1
//   · NO_EN_FLUJOS sin las operaciones del estudio                                             → 6/1
//   · `porQueNoFilmar` sin mirar si el escenario está aprobado                                 → 6/1
//   · el runner de filmar sin el chequeo de la marca (ok: true sin filmar)                     → 6/1
//   · el run con `import { generarTomaAction } from '@/app/video-generator/video-action'` fijo  → 6/1
