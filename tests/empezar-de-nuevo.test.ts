// =============================================================================
// «Empezar de nuevo» una automatización de un lead (23/10/2026)
// =============================================================================
// #289 «Sprint · apertura» del ws1: la inscripción de Martín seguía viva y no había forma de que volviera a empezar. Mover
// el lead a la etapa no la reinicia (una viva no vuelve sola) y «Frenar» la deja cancelada para siempre. Ahora una
// persona la reinicia (la acción de la ficha, que dibuja el CRM, y la operación de la API), por la MISMA inscripción
// manual (`inscribirEnSecuencia` con `empezarDeNuevo` → `reactivarInscripcion`). Cancelada y handoff siguen sin reabrirse.
//
// Correr: node --import tsx --test tests/empezar-de-nuevo.test.ts
// Probado rompiéndolo (23/10/2026, base 5/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decidirInscripcionManual } from '../lib/nutricion-inscripcion-manual';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const SEC = { activa: true, archivada: false, pasos: 5 };
const MOTOR = { aTiempo: true, sinReunion: false, fueraDelResiduo: false, enLaOtraMitad: false };
const decidir = (estado: string, extra: Record<string, unknown> = {}, desenlace: string | null = null) =>
  decidirInscripcionManual({ secuencia: SEC, previa: { estado, desenlace }, motor: MOTOR, ...extra });

test('una en curso o que contestó: sin el pedido no se toca; con él, se reinicia', () => {
  assert.deepEqual(decidir('activa'), { inscribe: false, porque: 'en_curso' });
  assert.deepEqual(decidir('respondio'), { inscribe: false, porque: 'respondio' });
  assert.deepEqual(decidir('activa', { empezarDeNuevo: true }), { inscribe: true, como: 'reinicio' });
  assert.deepEqual(decidir('respondio', { empezarDeNuevo: true }), { inscribe: true, como: 'reinicio' });
});

test('cancelada y handoff NO se reabren, ni desde un flujo, y las puertas del motor siguen valiendo', () => {
  assert.deepEqual(decidir('cancelada', { empezarDeNuevo: true }), { inscribe: false, porque: 'cancelada' });
  assert.deepEqual(decidir('activa', { empezarDeNuevo: true }, 'cancelado'), { inscribe: false, porque: 'en_curso' });
  assert.deepEqual(decidir('handoff', { empezarDeNuevo: true }), { inscribe: false, porque: 'handoff' });
  assert.deepEqual(decidir('activa', { empezarDeNuevo: true, desdeFlujo: true }), { inscribe: false, porque: 'en_curso' });
  assert.deepEqual(decidirInscripcionManual({ secuencia: SEC, previa: { estado: 'activa', desenlace: null }, motor: { ...MOTOR, aTiempo: false }, empezarDeNuevo: true }),
    { inscribe: false, porque: 'fuera_de_antiguedad' });
});

test('la acción es del admin y va por la inscripción manual, con el historial firmado', () => {
  const act = sinComentarios(leer('app/automations/automatizaciones-del-lead-actions.ts'));
  const a = act.slice(act.indexOf('export async function empezarDeNuevoEnAutomatizacionAction('), act.indexOf('export async function frenarLeadsEnAutomatizacionesAction('));
  assert.ok(a.length > 100, 'no encontré la acción');
  assert.match(a, /if \(rol !== 'admin'\) return \{ ok: false/);
  const nucleo = sinComentarios(leer('lib/automatizaciones-del-lead.ts'));
  assert.match(nucleo, /inscribirEnSecuencia\(leadId, secuenciaId, \{ empezarDeNuevo: true \}\)/);
  assert.match(nucleo, /logLeadEvent\(leadId, 'Automatización', linea, autor\)/);
  assert.match(nucleo, /ahora\?\.frenado \? `\$\{linea\} \$\{ahora\.frenado\.texto\}` : linea/, '«empezó» no dice si algo frena lo primero');
  assert.match(sinComentarios(leer('lib/nutricion.ts')), /empezarDeNuevo: opts\?\.empezarDeNuevo === true,/, 'inscribirEnSecuencia no le pasa el pedido a la decisión');
});

test('la operación de la API: sólo admin, sin http, nunca desde un flujo, y sólo si ya está en la secuencia', async () => {
  const { porId } = await import('../lib/api-mako/registro');
  const d = porId('empezar_de_nuevo_lead_secuencia');
  assert.ok(d, 'la operación no está en el registro');
  assert.equal(d!.gating?.rolMinimo, 'admin');
  assert.equal((d as unknown as { reversible?: boolean }).reversible, false);
  assert.ok(!(d!.canales as readonly string[]).includes('http'), 'sin http, como inscribir y sacar');
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const r = bloque(run);
  assert.match(r, /if \(desdeUnFlujo\(ctx\)\) return \{ error:/);
  assert.match(r, /inscribirEnSecuencia\(leadId, secuenciaId, \{ soloVer: true, empezarDeNuevo: true \}\)/);
  assert.match(r, /if \(v\.como === 'nueva'\) return \{ error:/, 'empezar de nuevo inscribiría a quien no está');
});

test('la pantalla NO vive acá: las acciones son de Automations, el bloque del CRM', () => {
  // Reparto del Cerebro (23/10/2026): app/crm/lead-view y CrmBoard son del chat del CRM.
  assert.doesNotMatch(leer('app/automations/automatizaciones-del-lead-actions.ts'), /from '@\/app\/crm\/lead-view/);
});

function bloque(run: string): string {
  const ini = run.indexOf('empezar_de_nuevo_lead_secuencia: {');
  assert.ok(ini > 0, 'no encontré el runner');
  return run.slice(ini, run.indexOf('\n  },\n', ini));
}

// ── Probado rompiéndolo (23/10/2026), de a una y restaurando. Base 5/0 ──
// R1 `decidirInscripcionManual` sin `deNuevo` (`if (previa) {`)                          → 3/2
// R2 `deNuevo` sin `!p.desdeFlujo`                                                       → 4/1
// R3 la acción sin el chequeo de admin                                                   → 4/1
// R4 el runner sin la guarda de `desdeUnFlujo`                                           → 4/1
