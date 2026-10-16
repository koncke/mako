// =============================================================================
// La ficha del TELÉFONO sigue a la ficha del funnel del lead, destilada; y «N sin marcar» es el de escritorio
// =============================================================================
// Pedido del 15/10/2026 (frente celular de la ficha por bloques): debajo del encabezado, la ficha de MaKo
// Mobile (app/m/crm/[id]) sigue la ELECCIÓN y el ORDEN de bloques de la ficha del funnel del lead
// (`fichaEfectiva`), con sólo los bloques que tienen versión de teléfono, y el encabezado dice «N sin marcar»
// con el MISMO número que la cabecera de escritorio. Sin editor en el teléfono (§3 del diseño).
// Lo puro (app/m/crm/ficha-bloques.ts) se EJECUTA; el cableado (que el teléfono lea con las mismas funciones
// que escritorio) se lee del fuente, sin comentarios.
//
// Correr: node --import tsx --test tests/m-ficha-bloques.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (15/10/2026, base 6/0), cada rotura restaurada de memoria antes de la siguiente:
//   · `origen` fuera de PIEZA_DE_BLOQUE («Llegó por» no sale en ninguna plantilla)              → 3 / 3
//   · `piezasDelTelefono` sin mirar las tabs que el lead ve (Reuniones siempre)                  → 3 / 3
//   · las tabs en otro orden (Reuniones antes que el Resumen)                                    → 3 / 3
//   · una pieza repetida (sin el `!out.some(…)`)                                                  → 5 / 1
//   · `piezasQueSeDibujan` sin la regla del catálogo (todo se dibuja, aun vacío)                  → 5 / 1
//   · `gruposDeLaFicha` sin «Datos» arriba cuando la ficha empieza por las notas                  → 5 / 1
//   · fichaV2 contando «N sin marcar» con `faltantesDeLead` por su cuenta                         → 5 / 1
//   · la página sin `piezasQueSeDibujan` (le pasa a la ficha las piezas tal cual)                 → 5 / 1
//   · FichaLead dibujando «Datos» fijo, sin `gruposDeLaFicha`                                     → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aplicarCambio, fichaEfectiva, RESPALDO_VACIO, type FichaGuardada } from '../lib/ficha/config';
import { PLANTILLAS_FICHA, type PlantillaId } from '../lib/ficha/plantillas';
import type { TabFicha } from '../lib/ficha/catalogo';
import {
  gruposDeLaFicha, piezasDelTelefono, piezasQueSeDibujan, tabsQueVe, type PiezaFicha, type PiezaPuesta,
} from '../app/m/crm/ficha-bloques';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const piezas = (xs: readonly PiezaPuesta[]): PiezaFicha[] => xs.map((x) => x.pieza);
const delFunnel = (plantilla: PlantillaId, guardada: FichaGuardada | null, ve: readonly TabFicha[]) =>
  piezas(piezasDelTelefono(fichaEfectiva(plantilla, guardada, RESPALDO_VACIO).tabs, ve));
const conReunion = tabsQueVe({ verTracking: true, verReuniones: true });
const sinReunion = tabsQueVe({ verTracking: true, verReuniones: false });

// Lo que ve el teléfono con cada plantilla, sin que nadie la toque. Las de llamada y el respaldo tienen etapa
// de reunión (la misma regla elige la plantilla y saca la tab Reuniones); las demás no.
const ESPERADO: Record<PlantillaId, { ve: readonly TabFicha[]; piezas: PiezaFicha[] }> = {
  // Resumen: proxima-reunion → contacto → … → lo-que-contesto → origen → … → notas. Reuniones: lo que salió.
  'respaldo': { ve: conReunion, piezas: ['proxima', 'contacto', 'contesto', 'llego-por', 'notas', 'llamada'] },
  'dos-reuniones': { ve: conReunion, piezas: ['proxima', 'contacto', 'contesto', 'llego-por', 'notas', 'llamada'] },
  'una-llamada': { ve: conReunion, piezas: ['proxima', 'contacto', 'contesto', 'llego-por', 'notas', 'llamada'] },
  // Reuniones: reunion-1 y ciclo-de-venta, sin «lo que salió de la llamada».
  'evento': { ve: conReunion, piezas: ['proxima', 'contacto', 'contesto', 'llego-por', 'notas'] },
  // La próxima reunión va al final: «se calla salvo que reserve por Cal.com» (§4).
  'formulario-meta': { ve: sinReunion, piezas: ['contacto', 'contesto', 'llego-por', 'proxima', 'notas'] },
  'landing': { ve: sinReunion, piezas: ['contacto', 'contesto', 'llego-por', 'proxima', 'notas'] },
  // La charla va arriba en escritorio; en el teléfono es el botón WhatsApp (fijo), no una pieza.
  'te-escriben': { ve: sinReunion, piezas: ['contacto', 'llego-por', 'notas'] },
  'prospeccion': { ve: sinReunion, piezas: ['contacto', 'notas'] },
  // El origen antes que lo que contestó, como en la plantilla del carrito.
  'carrito': { ve: sinReunion, piezas: ['contacto', 'llego-por', 'contesto', 'notas'] },
};

test('con cada plantilla, el teléfono ve los bloques que tienen versión de teléfono, en su orden', () => {
  assert.deepEqual(Object.keys(ESPERADO).sort(), PLANTILLAS_FICHA.map((p) => p.id).sort(), 'una plantilla nueva tiene que decir qué ve el teléfono');
  for (const [id, e] of Object.entries(ESPERADO) as Array<[PlantillaId, (typeof ESPERADO)[PlantillaId]]>) {
    assert.deepEqual(delFunnel(id, null, e.ve), e.piezas, `plantilla «${id}»`);
  }
});

test('las tabs de escritorio van una debajo de la otra, y sólo las que el lead ve', () => {
  // Te escriben no trae lista de Reuniones: usa la del respaldo, que tiene «lo que salió de la llamada». Sin
  // etapa de reunión la tab no sale en escritorio, y el teléfono tampoco la muestra.
  assert.ok(!delFunnel('te-escriben', null, sinReunion).includes('llamada'));
  // Con la plantilla elegida a mano en un funnel con reunión, la tab sale, y la llamada va después del Resumen.
  assert.deepEqual(delFunnel('te-escriben', null, conReunion), ['contacto', 'llego-por', 'notas', 'llamada']);
  assert.deepEqual(tabsQueVe({ verTracking: false, verReuniones: false }), ['resumen']);
  assert.deepEqual(tabsQueVe({ verTracking: true, verReuniones: true }), ['resumen', 'tracking', 'reuniones']);
});

test('sigue lo que el admin armó en «Personalizar»: el orden, lo que sacó y lo que mudó de tab', () => {
  const cambio = (g: FichaGuardada, c: Parameters<typeof aplicarCambio>[1]): FichaGuardada => {
    const r = aplicarCambio(g, c, 'una-llamada', RESPALDO_VACIO);
    assert.ok(r.ok && r.cambio, `el cambio ${c.op} no se aplicó`);
    return r.ok ? r.ficha : g;
  };
  // Las notas arriba de todo.
  const notasArriba = cambio({}, { op: 'mover', tab: 'resumen', bloque: 'notas', lugar: 1 });
  assert.deepEqual(delFunnel('una-llamada', notasArriba, conReunion), ['notas', 'proxima', 'contacto', 'contesto', 'llego-por', 'llamada']);
  // Sin el origen en el Resumen, no hay «Llegó por».
  const sinOrigen = cambio({}, { op: 'quitar', tab: 'resumen', bloque: 'origen' });
  assert.deepEqual(delFunnel('una-llamada', sinOrigen, conReunion), ['proxima', 'contacto', 'contesto', 'notas', 'llamada']);
  // El origen mudado a Tracking: sale sólo si el lead ve Tracking, y después de lo del Resumen.
  const enTracking = cambio(sinOrigen, { op: 'poner', tab: 'tracking', bloque: 'origen' });
  assert.deepEqual(delFunnel('una-llamada', enTracking, tabsQueVe({ verTracking: true, verReuniones: true })), ['proxima', 'contacto', 'contesto', 'notas', 'llego-por', 'llamada']);
  assert.ok(!delFunnel('una-llamada', enTracking, tabsQueVe({ verTracking: false, verReuniones: true })).includes('llego-por'));
  // «Lo que salió de la llamada» puesto también en el Resumen: va donde está ahí, una sola vez.
  const llamadaArriba = cambio({}, { op: 'poner', tab: 'resumen', bloque: 'lo-que-salio-de-la-llamada', lugar: 1 });
  assert.deepEqual(delFunnel('una-llamada', llamadaArriba, conReunion), ['llamada', 'proxima', 'contacto', 'contesto', 'llego-por', 'notas']);
});

test('lo que se calla vacío en escritorio, se calla en el teléfono; el contacto y las notas, siempre', () => {
  const todas: PiezaPuesta[] = [
    { pieza: 'proxima', bloque: 'proxima-reunion' }, { pieza: 'contacto', bloque: 'contacto' },
    { pieza: 'contesto', bloque: 'lo-que-contesto' }, { pieza: 'llego-por', bloque: 'origen' },
    { pieza: 'notas', bloque: 'notas' }, { pieza: 'llamada', bloque: 'lo-que-salio-de-la-llamada' },
  ];
  const nada = { proxima: null, llegoPor: null, respuestas: 0, llamada: false };
  assert.deepEqual(piezas(piezasQueSeDibujan(todas, nada)), ['contacto', 'notas']);
  const todo = { proxima: 'Hoy, 10:30', llegoPor: 'Anuncio · Verano', respuestas: 3, llamada: true };
  assert.deepEqual(piezas(piezasQueSeDibujan(todas, todo)), ['proxima', 'contacto', 'contesto', 'llego-por', 'notas', 'llamada']);
});

test('en pantalla: «Datos» con la etapa siempre arriba, las filas seguidas juntas y las notas en su sección', () => {
  assert.deepEqual(gruposDeLaFicha(['proxima', 'contacto', 'contesto', 'llego-por', 'notas', 'llamada']), [
    { tipo: 'filas', piezas: ['proxima', 'contacto', 'contesto', 'llego-por'], primero: true },
    { tipo: 'notas' },
    { tipo: 'filas', piezas: ['llamada'], primero: false },
  ]);
  // La ficha que empieza por las notas: «Datos» queda arriba sólo con la etapa (es del encabezado).
  assert.deepEqual(gruposDeLaFicha(['notas', 'contacto']), [
    { tipo: 'filas', piezas: [], primero: true },
    { tipo: 'notas' },
    { tipo: 'filas', piezas: ['contacto'], primero: false },
  ]);
  assert.deepEqual(gruposDeLaFicha([]), [{ tipo: 'filas', piezas: [], primero: true }]);
});

test('CABLEADO: el teléfono lee la ficha y «N sin marcar» con las MISMAS funciones que escritorio', () => {
  const datos = sinComentarios(leer('app/m/crm/datos.ts'));
  assert.match(datos, /fichaDelFunnelDelLead\(lead\.funnel_id \?\? null\)/, 'la ficha de SU funnel, la misma lectura que getLeadFullAction');
  assert.match(datos, /leerInsumosDatosLead\(lead\)/);
  assert.match(datos, /\(await datosSinMarcarDeLead\(lead, insumos\)\)\.datos\.avisar\.length/, '«N sin marcar» es `datos.avisar.length`, como DatosSinMarcarCard');
  assert.doesNotMatch(datos, /faltantesDeLead\(|estadoDatosDeLead\(/, 'el teléfono cuenta «N sin marcar» por su cuenta');
  assert.match(datos, /tieneEtapaDeReunion\(insumos\.stages\)/, 'Reuniones con las etapas DEL LEAD, como FichaPorBloques');
  assert.match(datos, /verTrackingDeLead\(lead\.funnel_id\)/, 'Tracking con la regla de escritorio');
  // Y escritorio, con las mismas (lo fijan también tests/ficha-armador.test.ts y tests/ficha-avisos.test.ts).
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  const cuerpo = acc.slice(acc.indexOf('export async function getLeadFullAction'), acc.indexOf('\nexport ', acc.indexOf('export async function getLeadFullAction') + 10));
  for (const f of [/fichaDelFunnelDelLead\(lead\.funnel_id \?\? null\)/, /leerInsumosDatosLead\(lead\)/, /datosSinMarcarDeLead\(lead, insumos\)/]) assert.match(cuerpo, f);

  const pagina = sinComentarios(leer('app/m/crm/[id]/page.tsx'));
  assert.match(pagina, /piezas=\{piezasQueSeDibujan\(d\.piezas, \{/, 'la página le pasa a la ficha sólo lo que se dibuja');
  assert.match(pagina, /\$\{sinMarcar\} sin marcar/);
  const ficha = sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx'));
  assert.match(ficha, /gruposDeLaFicha\(p\.piezas\)\.map\(/, 'la ficha del teléfono dibuja en el orden de la ficha del funnel');
  assert.equal((ficha.match(/titulo="Datos"/g) ?? []).length, 1);
  // Sin editor en el teléfono (§3 del diseño): nada de la edición de escritorio entra a /m.
  for (const f of [datos, pagina, ficha]) {
    assert.doesNotMatch(f, /cambiarFichaFunnelAction|useFichaDelFunnel|lead-view\/ficha\/Armador|Personalizar/, 'el teléfono no edita la ficha');
  }
});
