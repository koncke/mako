// =============================================================================
// «Nada por detrás»: «Leí tu reunión y te dejé las tareas en el Plan» es una automatización de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md: `reunion-tareas-al-plan` lo armaba el código (`textoAviso`, lib/reunion-auto.ts) y lo
// mandaba con `texto`, que PISA la plantilla de /mensajes. Ahora es el evento de la plataforma `reunion_tareas_al_plan`: el
// cron pasa los HECHOS (`datosReunionesAlPlan`, lib/reunion-plan-aviso.ts) y el texto es el de la fila. Lo que el código
// elegía (una reunión o varias, si completa una lectura a medias) lo preguntan dos CONDITION; lo que falta se lleva su
// renglón. Nacía apagado (sin `porDefecto`, y el ws 13 lo tenía apagado a mano): su fila nace PAUSADA.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. reunion-auto otra vez con `texto:` (el aviso armado por el código) ............ 1 fallo
//   2. `datosReunionesAlPlan` con «0 de los demás» en vez de faltar ................... 1 fallo
//   3. la CONDITION sin la rama de `plan_resto` ........................................ 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosReunionesAlPlan, type ReunionAlPlan } from '../lib/reunion-plan-aviso';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';
import { datosDelEvento } from '../lib/aviso-evento';
import { variablesPara } from '../lib/variables-aviso';
import type { PasoGrafo } from '../lib/flujo-grafo';

type Paso = PasoGrafo & { ramas?: Array<{ filas: Array<{ campo: string; valor: string; no?: boolean }>; siguiente: string | null }>; si_no?: string | null };
const pasos = (): Paso[] => pasosDePlantilla(plantillaPorId('mako-reunion-tareas-al-plan')!) as unknown as Paso[];
const cuerpo = (id: string): string => {
  const p = pasos().find((x) => x.id === id)!;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
};
/**
 * La tarjeta que elige la CONDITION con esos datos (gana la primera rama que se cumple; si no, «Si no»). El número del negocio
 * lo pone `emitirPorEvento` en todo evento de la plataforma: acá va el de un negocio cualquiera (14) si el test no dice otro.
 */
const tarjetaPara = (d0: Record<string, string | undefined>): string => {
  const d: Record<string, string | undefined> = { negocio_numero: '14', ...d0 };
  const c = pasos().find((x) => x.id === 'rp_cuantas')!;
  const cumple = (f: { campo: string; valor: string; no?: boolean }) => {
    const v = d[f.campo.replace(/^dato:/, '')];
    return v != null && (f.no ? v !== f.valor : v === f.valor);
  };
  const rama = c.ramas?.find((r) => r.filas.every(cumple));
  return rama?.siguiente ?? c.si_no ?? '';
};
const sinVacios = (d: object): Record<string, string> => Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
const LINK = (h: ReunionAlPlan) => `https://hola-mako.com/plan/revisar/${h.propId}`;
const una: ReunionAlPlan = { titulo: 'Sync semanal', fecha: '2026-10-17T15:00:00Z', conQuien: 'Ana', mias: 3, otras: 0, recordingId: 1, propId: 'p1' };

test('una reunión, sin nada de más: los renglones que no aplican no salen', () => {
  const d = datosReunionesAlPlan([una], { cuando: () => 'vie 17 oct · 12:00', link: LINK });
  assert.equal(tarjetaPara(d), 'rp_una_mk');
  assert.equal(textoConDatos(cuerpo('rp_una_mk'), sinVacios(d)),
    '📝 Leí tu reunión *Sync semanal*\n👥 Con Ana\n🗓️ vie 17 oct · 12:00\n\nSaqué *3 tareas tuyas* y te las dejé en el plan para que las confirmes:\nhttps://hola-mako.com/plan/revisar/p1\n\nEntras, revisas y con un toque quedan cargadas. — MaKo');
});

test('la que COMPLETA una lectura a medias dice que terminó; y la que sigue a medias, lo dice', () => {
  const d = datosReunionesAlPlan([{ ...una, resto: true, otras: 2, descartadas: 4, propId: 'p2' }], { cuando: () => null, link: LINK });
  assert.equal(tarjetaPara(d), 'rp_resto_mk');
  const t = textoConDatos(cuerpo('rp_resto_mk'), sinVacios(d));
  assert.match(t, /^📝 Terminé de leer tu reunión \*Sync semanal\*\n\nSaqué \*3 tareas tuyas\* más/);
  assert.match(t, /👥 Y 2 de los demás, para repartir\./);
  assert.match(t, /Otras 4 no las cargué porque tu criterio las deja afuera/);
  assert.doesNotMatch(t, /⚠️/, 'terminó: no hay nada a medias');
  assert.doesNotMatch(t, /🗓️/, 'sin fecha, su renglón no va');
  // Una vuelta que todavía no termina: la tarjeta de una reunión, con el renglón de lo leído a medias.
  const medias = datosReunionesAlPlan([{ ...una, resto: true, partesFallidas: 1, propId: 'p2' }], { cuando: () => null, link: LINK });
  assert.match(textoConDatos(cuerpo(tarjetaPara(medias)), sinVacios(medias)), /⚠️ De esta reunión no pude leer todo/);
});

test('varias reuniones: la lista con el link de cada una', () => {
  const d = datosReunionesAlPlan([una, { ...una, titulo: 'Revisión de ads', mias: 1, otras: 2, propId: 'p3' }], { cuando: () => 'hoy', link: LINK });
  assert.equal(tarjetaPara(d), 'rp_varias_mk');
  const t = textoConDatos(cuerpo('rp_varias_mk'), sinVacios(d));
  assert.match(t, /^📝 Leí tus \*2 reuniones\* nuevas:\n\n• \*Sync semanal\* — hoy\n   3 tareas tuyas\n   https:\/\/hola-mako\.com\/plan\/revisar\/p1\n\n• \*Revisión de ads\* — hoy\n   1 tarea tuya · 2 de otros\n   https:\/\/hola-mako\.com\/plan\/revisar\/p3/);
  assert.match(t, /En total \*4 tareas tuyas\*/);
  assert.match(t, /👥 Y 2 de los demás, para repartir\./);
});

test('es un evento de la plataforma, del super admin, con sus datos en el árbol', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'reunion_tareas_al_plan');
  assert.ok(ev && ev.plataforma === true && ev.aviso === 'reunion-tareas-al-plan');
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('reunion-tareas-al-plan'));
  const ofrece = variablesPara(datosDelEvento('reunion_tareas_al_plan')).map((v) => v.key);
  for (const k of ['plan_varias', 'plan_resto', 'plan_tuyas', 'plan_lista', 'plan_link']) assert.ok(ofrece.includes(k), `falta {{${k}}}`);
});

test('el cron manda los DATOS, no un texto armado por el código', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'reunion-auto.ts'), 'utf8');
  assert.match(src, /emitirDelCatalogo\('reunion-tareas-al-plan', \{ ws, datos: /);
  assert.doesNotMatch(src, /emitirDelCatalogo\('reunion-tareas-al-plan', \{[^}]*texto:/);
  assert.doesNotMatch(src, /export function textoAviso\(/);
});

// REVISIÓN DE B5 (17/10/2026), BAJA: «Terminé de leer tu reunión» salía aunque esa vuelta también quedara a medias.
// PROBADO ROMPIÉNDOLO: `plan_resto` sin mirar `partesFallidas` → 2 fallos.
test('«Terminé de leer» sólo si terminó: una vuelta que completa y sigue a medias no lo dice', () => {
  const d = datosReunionesAlPlan([{ ...una, resto: true, partesFallidas: 1, propId: 'p4' }], { cuando: () => null, link: LINK });
  assert.equal(d.plan_resto, 'no');
  assert.equal(tarjetaPara(d), 'rp_una_mk');
  const fin = datosReunionesAlPlan([{ ...una, resto: true, propId: 'p5' }], { cuando: () => null, link: LINK });
  assert.equal(fin.plan_resto, 'sí');
});

// (6/11/2026) El ws 13 lo tenía apagado en /mensajes: su fila nace con «No es el negocio número 13» en cada rama.
// PROBADO ROMPIÉNDOLO: sin la fila del negocio en la tercera rama → cae éste.
test('al negocio 13 no le sale ninguna de las tres; a otro, la de siempre', () => {
  const d = datosReunionesAlPlan([una], { cuando: () => 'vie 17 oct · 12:00', link: LINK });
  assert.equal(tarjetaPara({ ...d, negocio_numero: '13' }), '', 'al 13 no le sale nada');
  assert.equal(tarjetaPara({ ...d, negocio_numero: '14' }), 'rp_una_mk');
  assert.equal(tarjetaPara({ ...d, negocio_numero: '13', plan_varias: 'sí' }), '');
});
