// =============================================================================
// Pausar una automatización frena TODO, se ve en la fila y en el lienzo, y desde el CRM se sabe y se frena a un lead
// =============================================================================
// Martín, 22/10/2026 (la campaña del Sprint, por el Cerebro): «Y se puede pausar el envío desde Automations... Y en el CRM
// debería indicar en la tarjeta o en algún lugar que esos leads están en una automatización activa, y que desde el CRM
// también se pueda frenar».
//   · MEDIDO: pausar ya congelaba la cola (el motor saca las pausadas: `idsDePausadas`, lib/nutricion.ts), pero un borrador
//     suyo ya escrito se podía aprobar y salía. Ahora la puerta de aprobar lo frena (lib/borrador-camino.ts).
//   · Se ve: en el interruptor «Activar» del pie del lienzo, y ⏸ en la fila de la lista. SIN chip arriba del lienzo
//     (22/10/2026, Martín: «elimina el texto "Pausada, no sale nada", eso es completamente innecesario... Para eso ya tenemos
//     el "ACTIVAR" de abajo»).
//   · Para el CRM: en qué automatizaciones VIVAS está cada lead y en qué tarjeta (lib/automatizaciones-del-lead-reglas.ts),
//     y «Frenar» (sacarlo, con sus borradores pendientes descartados).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enAutomatizacionesDe, textoDeFrenar, textoDeFrenarLote, ESTADOS_VIVOS } from '../lib/automatizaciones-del-lead-reglas';

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const wa = (id: string, cuerpo: string, siguiente: string | null) => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo, siguiente });
const PASOS = [
  { id: 'c1', nodo: 'condicion', canal: 'whatsapp', delay_horas: 0, cuerpo: '', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'ya_contactado', no: true }], siguiente: 'm1' }], si_no: null },
  wa('m1', 'Hola {{nombre}}, soy Mauricio Ejemplo. ¿Sigues al frente de tu empresa?', null),
];

// roturas (sin las archivadas fuera; `automatizacionActiva` siempre true; sin el paso) → 1 rojo de 5 cada una (éste).
test('en qué automatizaciones vivas está cada lead, en qué tarjeta, y si la automatización está pausada', () => {
  const m = enAutomatizacionesDe([
    { lead_id: 7, secuencia_id: 289, estado: 'activa', paso_actual: 1, nodo_actual: 'm1', proximo_envio_at: '2026-10-24T13:05:00Z' },
    { lead_id: 7, secuencia_id: 198, estado: 'respondio', paso_actual: 0, nodo_actual: null, proximo_envio_at: null },
    { lead_id: 7, secuencia_id: 300, estado: 'completada', paso_actual: 2, nodo_actual: null, proximo_envio_at: null },
    { lead_id: 8, secuencia_id: 268, estado: 'activa', paso_actual: 0, nodo_actual: null, proximo_envio_at: null },
  ], [
    { id: 289, nombre: 'Sprint · apertura', activa: false, archivada_at: null, pasos: PASOS },
    { id: 198, nombre: 'Un Lead Entró', activa: true, archivada_at: null, pasos: [] },
    { id: 300, nombre: 'Vieja', activa: true, archivada_at: null, pasos: [] },
    { id: 268, nombre: 'Archivada', activa: true, archivada_at: '2026-10-01T00:00:00Z', pasos: [] },
  ]);
  assert.deepEqual([...m.keys()], [7], 'el 8 sólo está en una archivada');
  const [sprint, entro] = m.get(7)!;
  assert.equal(sprint.automatizacionActiva, false, 'la pausada lo dice');
  assert.equal(sprint.estado, 'activa');
  // En palabras de persona desde el 24/10/2026 (`pasoEnPalabras`), no como la nombra el lienzo («WHATSAPP: Hola {{nombre}}…»):
  // lo leen el tablero, el teléfono y la ficha. Sin el nombre del lead (la lista es de muchos), el saludo queda «Hola,».
  assert.deepEqual(sprint.paso, { numero: 2, titulo: '«Hola, soy Mauricio Ejemplo. ¿Sigues al frente de tu empresa?»' }, 'el paso no está en palabras de persona');
  assert.equal(sprint.link, '/automations?sec=289');
  assert.equal(entro.estado, 'respondio');
  assert.equal(entro.paso, null, 'sin pasos, no se inventa un paso');
  assert.equal(m.get(7)!.length, 2, 'la completada ya no corre');
  assert.deepEqual([...ESTADOS_VIVOS], ['activa', 'respondio']);
});

test('«Frenar» lo dice en palabras', () => {
  assert.deepEqual(textoDeFrenar({ sale: true, secuencia: { nombre: 'Sprint · apertura' }, lead: { nombre: 'Ana' } }), { ok: true, resumen: 'Frené a Ana en «Sprint · apertura»: no le sale nada más.' });
  assert.deepEqual(textoDeFrenar({ sale: false, porque: 'ya_cancelada', secuencia: { nombre: 'Sprint · apertura' }, lead: { nombre: 'Ana' } }), { ok: false, error: 'Ana ya no estaba corriendo en «Sprint · apertura».' });
  assert.match((textoDeFrenar({ sale: false, porque: 'carrera', secuencia: { nombre: 'X' }, lead: { nombre: 'Ana' } }) as { error: string }).error, /prueba de nuevo/);
});

// roturas (la puerta de aprobar sin la pausa; `sacarDeSecuencia` sin descartar borradores; frenar sin pedir admin) → 1 rojo de 5 cada una (éste).
test('el cableado: la pausa frena la cola y lo que espera aprobación; frenar descarta borradores y es del admin', () => {
  const motor = leer('lib/nutricion.ts');
  assert.match(motor, /if \(pausadas\.length\) q = q\.not\('secuencia_id', 'in', `\(\$\{pausadas\.join\(','\)\}\)`\);/, 'la cola sin las pausadas');
  const puerta = leer('lib/borrador-camino.ts');
  const freno = puerta.slice(puerta.indexOf('export async function frenoDelGoteoAlAprobar('));
  assert.ok(freno.indexOf("if (fila && fila.activa !== true) return") > 0 && freno.indexOf("if (fila && fila.activa !== true) return") < freno.indexOf('leerConfigAutomatizacion(secuenciaId)'), 'la pausa, antes que el goteo');
  assert.match(freno, /está pausada: no sale nada hasta que la actives en Automations\./);
  const salida = leer('lib/nutricion-salida-manual.ts');
  assert.match(salida, /\.from\('wa_borradores'\)\.update\(\{ estado: 'descartado' \}\)\s*\.eq\('lead_id', lead\.id\)\.eq\('secuencia_id', secuencia\.id\)\.eq\('estado', 'pendiente'\)/);
  const acciones = leer('app/automations/automatizaciones-del-lead-actions.ts');
  assert.match(acciones, /^'use server';/);
  assert.match(acciones, /const rol = await requireSesion\(\);\n\s+if \(rol !== 'admin'\) return \{ ok: false, error: 'Sólo el administrador puede frenarlo\.' \};/);
});

// roturas (el chip de vuelta arriba del lienzo; el interruptor sin «aria-pressed»; la fila con el punto gris de antes) → 1 rojo
// de 5 cada una (éste).
test('se ve: el estado en el interruptor «Activar» (sin chip arriba del lienzo), y ⏸ en la fila de la lista', () => {
  const perfil = leer('app/automations/SecuenciaPerfil.tsx');
  assert.ok(!perfil.includes('EstadoDeLaAutomatizacion'), 'sin el chip de estado arriba del lienzo');
  assert.ok(!perfil.includes('Pausada · no sale nada'), 'sin «Pausada · no sale nada» en el lienzo');
  // Prendida dice «Activa» y apagada «Activar» (recorrido visual del 30/10/2026, A3).
  assert.match(perfil, /\{activa \? 'Activa' : 'Activar'\}<\/span>\s*<button onClick=\{\(\) => \(activa \? void toggle\(\)[^\n]*aria-pressed=\{activa\}/);
  const fila = leer('app/automations/SimuladorWhatsApp.tsx');
  assert.match(fila, /<span data-pausada role="img" aria-label="Pausada" title="Pausada: no sale nada"[\s\S]{0,400}>⏸<\/span>/);
});

// «Frenar automatización» sobre varios tildados (la barra de lote del CRM): UNA escritura, sólo el admin, y lo dice en palabras.
// roturas (el lote sin el filtro de las vivas; sin descartar sus borradores; sin pedir admin) → 1 rojo de 5 cada una (éste).
test('frenar varios de una: una escritura sobre las vivas, sus borradores descartados, sólo el admin', () => {
  const lib = leer('lib/automatizaciones-del-lead.ts');
  const lote = lib.slice(lib.indexOf('export async function frenarLeadsEnAutomatizaciones('));
  assert.match(lote, /\.update\(\{ estado: 'cancelada', proximo_envio_at: null, updated_at: new Date\(\)\.toISOString\(\) \}\)\s*\.in\('lead_id', ids\)\.in\('estado', \[\.\.\.ESTADOS_VIVOS\]\);/);
  assert.match(lote, /if \(secuenciaId != null\) q = q\.eq\('secuencia_id', secuenciaId\);/, 'con una automatización, sólo ésa');
  assert.match(lote, /\.from\('wa_borradores'\)\.update\(\{ estado: 'descartado' \}\)\s*\.in\('lead_id', leads\)\.eq\('secuencia_id', sec\)\.eq\('estado', 'pendiente'\)/);
  const acciones = leer('app/automations/automatizaciones-del-lead-actions.ts');
  const accion = acciones.slice(acciones.indexOf('export async function frenarLeadsEnAutomatizacionesAction('));
  assert.match(accion, /const rol = await requireSesion\(\);\n\s+if \(rol !== 'admin'\) return \{ ok: false, error: 'Sólo el administrador puede frenarlos\.' \};/);
  assert.equal(textoDeFrenarLote({ pedidos: 12, frenados: 10, nombre: 'Sprint · apertura' }), 'Frené a 10 leads en «Sprint · apertura»: no les sale nada más. 2 ya no estaban corriendo.');
  assert.equal(textoDeFrenarLote({ pedidos: 3, frenados: 3, nombre: null }), 'Frené a 3 leads de sus automatizaciones: no les sale nada más.');
  assert.equal(textoDeFrenarLote({ pedidos: 1, frenados: 1, nombre: 'X' }), 'Frené a 1 lead en «X»: no les sale nada más.');
  assert.equal(textoDeFrenarLote({ pedidos: 4, frenados: 0, nombre: 'X' }), 'Ninguno estaba corriendo en «X».');
});
