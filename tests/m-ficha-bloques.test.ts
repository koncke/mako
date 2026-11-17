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
//
// ⚠️ REESCRITO EL 16/10/2026 (el Resumen nativo): cada bloque nuevo del Resumen tiene su fila de teléfono (la siguiente
// acción, el equipo, la calificación, cuánto lleva en la etapa, el ingreso, el motivo, el plazo, las redes, la página,
// cómo entró, la dirección y el sexo), y el Resumen de entrada de cada tipo es su plantilla ARMADA
// (lib/ficha/plantillas-resumen.ts), con los highlights arriba. Las listas esperadas cambian por eso; lo que se fija
// (el orden de la ficha del funnel, las tabs que el lead ve, una pieza una vez, lo vacío se calla) no. Lo nuevo:
// «el Resumen nativo en el teléfono», al final, con sus roturas.
//
// ⚠️ CINCO LISTAS REESCRITAS EL 16/10/2026 (verificación de la tanda 1): Evento, Formulario de Meta, Landing, Te escriben
// y Carrito traen ahora «Redes y web» e «Ingreso estimado» en su Resumen de entrada (el contacto de antes los mostraba
// ADENTRO en todos los funnels: tests/ficha-resumen-lo-de-antes.test.ts), así que el teléfono suma sus filas 'redes' e
// 'ingreso' donde escritorio las pone. Lo que se fija no cambia. Re-verificado rompiéndolo (base 8/0): 'ingreso-estimado'
// fuera de PIEZA_DE_BLOQUE → 3 / 5.
//
// ⚠️ REESCRITO EL 17/11/2026 (P25, «la suscripción mes a mes no existe en el teléfono»): Pagos entra al teléfono con DOS
// piezas, el mes a mes (`suscripcion` → 'mes-a-mes', que fuera de una suscripción se calla) y el estado de cuenta. Las
// plantillas de Pagos ponen la suscripción primero, así que el respaldo con Pagos termina en 'mes-a-mes', 'saldo'. Lo que
// se fija del estado de cuenta no cambia. Lo nuevo: «el mes a mes en el teléfono», al final.
// Probado rompiéndolo (17/11/2026, base 9/0): `suscripcion` fuera de PIEZA_DE_BLOQUE → 7 / 2 («con un deal» y «mes a mes»);
// y cada una → 8 / 1 («mes a mes»): `mesAMesDelTelefono` del más viejo al más nuevo; los cortados sin juntar; el server sin
// callar el estado de cuenta con el mes a mes puesto; la ficha sin dibujar la pieza; `estadoDeSuscripcion` sin la cancelada.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aplicarCambio, fichaEfectiva, RESPALDO_VACIO, type FichaGuardada } from '../lib/ficha/config';
import { PLANTILLAS_FICHA, type PlantillaId } from '../lib/ficha/plantillas';
import type { TabFicha } from '../lib/ficha/catalogo';
import {
  gruposDeLaFicha, mesAMesDelTelefono, piezasDelTelefono, piezasQueSeDibujan, resumenDelTelefono, saldoDelTelefono, tabsQueVe, PIEZA_DE_BLOQUE,
  type PiezaFicha, type PiezaPuesta,
} from '../app/m/crm/ficha-bloques';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';

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
// ⚠️ 17/10/2026 (#880, las plantillas del Resumen arrancan con lo esencial): las de entrada ya no traen el origen
// («Llegó por») salvo donde la bajada lo promete (formulario y carrito), ni lo cobrado («Estado de cuenta») salvo en el
// evento y el carrito, ni «lo que contestó» en el evento, ni la publicación de entrada en «Completa». Las listas
// esperadas cambian por eso; el escenario de «Personalizar» saca «lo que contestó» (que sigue en la plantilla) y pone
// el origen en Tracking (ya no hay uno que mudar). Lo que se fija, no.
// Re-medido ROMPIÉNDOLO (17/10/2026, base 8/0): `origen` fuera de PIEZA_DE_BLOQUE → 4 / 4 («Llegó por» sigue en el
// formulario, el carrito, «Completa» y el escenario de Tracking, así que la rotura se sigue cazando).
//
// ⚠️ 23/10/2026: «Automatizaciones» vuelve a las de entrada del Resumen, arriba (Martín: «un bloque... relacionado a las
// automatizaciones... para tener más claridad de lo que pasa»), y en el teléfono es una fila (`filaDeAutomatizaciones`),
// que se calla si el lead no está en ninguna. Va después de la siguiente acción en todas.
// El Resumen «Antes de la llamada» (las dos de llamada), destilado: los highlights arriba, después la reunión y el equipo.
const RESUMEN_LLAMADA: PiezaFicha[] = ['siguiente', 'automatizaciones', 'calificado', 'en-etapa', 'ingreso', 'proxima', 'equipo', 'contacto', 'contesto', 'redes', 'motivo', 'plazo', 'notas'];
const ESPERADO: Record<PlantillaId, { ve: readonly TabFicha[]; piezas: PiezaFicha[] }> = {
  // «Completa»: todo lo que el Resumen sabe dibujar. Reuniones: lo que salió de la llamada.
  'respaldo': { ve: conReunion, piezas: ['siguiente', 'automatizaciones', 'calificado', 'en-etapa', 'ingreso', 'proxima', 'equipo', 'contacto', 'redes', 'contesto', 'llego-por', 'pagina', 'motivo', 'plazo', 'notas', 'llamada'] },
  // Donde el Resumen trae `cobrado`, el estado de cuenta ('saldo') va en su lugar (la tab Pagos en bloques).
  'dos-reuniones': { ve: conReunion, piezas: [...RESUMEN_LLAMADA, 'llamada'] },
  'una-llamada': { ve: conReunion, piezas: [...RESUMEN_LLAMADA, 'llamada'] },
  // Reuniones: reunion-1 y ciclo-de-venta, sin «lo que salió de la llamada».
  'evento': { ve: conReunion, piezas: ['siguiente', 'automatizaciones', 'proxima', 'en-etapa', 'saldo', 'contacto', 'equipo', 'redes', 'ingreso', 'motivo', 'plazo', 'notas'] },
  // La próxima reunión va abajo: «se calla salvo que reserve por Cal.com» (§4).
  'formulario-meta': { ve: sinReunion, piezas: ['siguiente', 'automatizaciones', 'calificado', 'en-etapa', 'ingreso', 'contesto', 'contacto', 'redes', 'llego-por', 'equipo', 'proxima', 'motivo', 'plazo', 'notas'] },
  'landing': { ve: sinReunion, piezas: ['siguiente', 'automatizaciones', 'calificado', 'en-etapa', 'ingreso', 'contacto', 'redes', 'contesto', 'pagina', 'proxima', 'motivo', 'plazo', 'notas'] },
  // La charla va arriba en escritorio; en el teléfono es el botón WhatsApp (fijo), no una pieza. Cómo entró, sí.
  'te-escriben': { ve: sinReunion, piezas: ['siguiente', 'automatizaciones', 'entrada', 'contacto', 'redes', 'equipo', 'en-etapa', 'ingreso', 'motivo', 'plazo', 'notas'] },
  'prospeccion': { ve: sinReunion, piezas: ['siguiente', 'automatizaciones', 'contacto', 'redes', 'en-etapa', 'ingreso', 'equipo', 'motivo', 'plazo', 'notas'] },
  // Si compró: el estado de cuenta arriba, antes del contacto.
  'carrito': { ve: sinReunion, piezas: ['siguiente', 'automatizaciones', 'saldo', 'contacto', 'llego-por', 'contesto', 'redes', 'ingreso', 'motivo', 'plazo', 'notas'] },
};

test('con cada plantilla, el teléfono ve los bloques que tienen versión de teléfono, en su orden', () => {
  assert.deepEqual(Object.keys(ESPERADO).sort(), PLANTILLAS_FICHA.map((p) => p.id).sort(), 'una plantilla nueva tiene que decir qué ve el teléfono');
  for (const [id, e] of Object.entries(ESPERADO) as Array<[PlantillaId, (typeof ESPERADO)[PlantillaId]]>) {
    assert.deepEqual(delFunnel(id, null, e.ve), e.piezas, `plantilla «${id}»`);
  }
});

test('con un deal, Pagos entra al teléfono con el mes a mes y el estado de cuenta, que sin nada que contar se callan', () => {
  // 16/10/2026 (la tab Pagos en bloques): `cobrado` («Estado de cuenta») → 'saldo'. Va después de las tabs que van
  // antes en escritorio, y sin deal la tab ni entra (`verPagos`).
  // Probado rompiéndolo (16/10/2026; entero, 7 / 0): `cobrado` sin pieza → 4 / 3; Pagos nunca entra → 6 / 1; el saldo
  // no se calla vacío → 6 / 1; la ficha no lo dibuja → 6 / 1; el server lo cuenta por su lado → 6 / 1.
  const conPagos = tabsQueVe({ verTracking: true, verReuniones: true, verPagos: true });
  assert.deepEqual(conPagos, ['resumen', 'tracking', 'reuniones', 'pagos']);
  // El respaldo no lo trae en el Resumen: sale de Pagos, al final, y sólo si el lead ve Pagos. (17/11/2026, P25) Antes va
  // el mes a mes: la plantilla de Pagos pone la suscripción primero.
  assert.deepEqual(delFunnel('respaldo', null, conPagos), [...ESPERADO.respaldo.piezas, 'mes-a-mes', 'saldo']);
  assert.ok(!delFunnel('respaldo', null, conReunion).includes('mes-a-mes'), 'sin deal, tampoco el mes a mes');
  assert.ok(!delFunnel('respaldo', null, conReunion).includes('saldo'), 'sin deal, Pagos no está y el saldo tampoco');
  // Una llamada lo trae también en el Resumen: va ahí, una sola vez.
  assert.deepEqual(delFunnel('una-llamada', null, conPagos).filter((x) => x === 'saldo').length, 1);
  const puestas = piezasDelTelefono(fichaEfectiva('respaldo', null, RESPALDO_VACIO).tabs, conPagos);
  const base = { proxima: null, llegoPor: null, respuestas: 0, llamada: false };
  assert.ok(!piezas(piezasQueSeDibujan(puestas, { ...base, saldo: null })).includes('saldo'), 'el estado de cuenta se calla sin nada que contar');
  assert.ok(piezas(piezasQueSeDibujan(puestas, { ...base, saldo: { texto: 'Debe $500', tono: 'rojo' } })).includes('saldo'));
  assert.deepEqual(saldoDelTelefono({ titular: 'Debe $500', detalle: 'Cuota 2 venció el 02/10 · hace 14 días', tono: 'rojo' }),
    { texto: 'Debe $500 · Cuota 2 venció el 02/10 · hace 14 días', tono: 'rojo' });
  assert.equal(saldoDelTelefono(null), null);
  // La ficha la dibuja como una fila, y el server la cuenta con la MISMA función que el escritorio.
  assert.match(sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx')), /case 'saldo': \{[\s\S]{0,400}?\{p\.saldo && <FilaDatoM k="Estado de cuenta"/);
  assert.match(sinComentarios(leer('app/m/crm/datos.ts')), /saldoDelTelefono\(estadoDeCuenta\(\{ cobrado, pagos, ganado: lead\.estado_lead === 'ganado', hoy \}\)\)/);
});

test('las tabs de escritorio van una debajo de la otra, y sólo las que el lead ve', () => {
  // Te escriben no trae lista de Reuniones: usa la del respaldo, que tiene «lo que salió de la llamada». Sin
  // etapa de reunión la tab no sale en escritorio, y el teléfono tampoco la muestra.
  assert.ok(!delFunnel('te-escriben', null, sinReunion).includes('llamada'));
  // Con la plantilla elegida a mano en un funnel con reunión, la tab sale, y la llamada va después del Resumen.
  assert.deepEqual(delFunnel('te-escriben', null, conReunion), [...ESPERADO['te-escriben'].piezas, 'llamada']);
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
  const sin = (xs: PiezaFicha[], x: PiezaFicha) => xs.filter((y) => y !== x);
  const notasArriba = cambio({}, { op: 'mover', tab: 'resumen', bloque: 'notas', lugar: 1 });
  assert.deepEqual(delFunnel('una-llamada', notasArriba, conReunion), ['notas', ...sin(RESUMEN_LLAMADA, 'notas'), 'llamada']);
  // Sin «lo que contestó» en el Resumen, no hay «contestó».
  const sinContesto = cambio({}, { op: 'quitar', tab: 'resumen', bloque: 'lo-que-contesto' });
  assert.deepEqual(delFunnel('una-llamada', sinContesto, conReunion), [...sin(RESUMEN_LLAMADA, 'contesto'), 'llamada']);
  // El origen puesto en Tracking (la plantilla ya no lo trae en el Resumen: #880): sale sólo si el lead ve Tracking, y
  // después de lo del Resumen.
  const enTracking = cambio({}, { op: 'poner', tab: 'tracking', bloque: 'origen' });
  assert.deepEqual(delFunnel('una-llamada', enTracking, tabsQueVe({ verTracking: true, verReuniones: true })), [...RESUMEN_LLAMADA, 'llego-por', 'llamada']);
  assert.ok(!delFunnel('una-llamada', enTracking, tabsQueVe({ verTracking: false, verReuniones: true })).includes('llego-por'));
  // «Lo que salió de la llamada» puesto también en el Resumen: va donde está ahí, una sola vez.
  const llamadaArriba = cambio({}, { op: 'poner', tab: 'resumen', bloque: 'lo-que-salio-de-la-llamada', lugar: 1 });
  assert.deepEqual(delFunnel('una-llamada', llamadaArriba, conReunion), ['llamada', ...RESUMEN_LLAMADA]);
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

// 16/10/2026 — EL RESUMEN NATIVO EN EL TELÉFONO. Cada bloque del Resumen que escritorio dibuja tiene su fila (el
// teléfono DESTILA: AGENTS.md), con la MISMA regla de cuándo se calla, y la fila se lee (se llena en la computadora).
// Probado rompiéndolo (16/10/2026, base 8/0 en el archivo), cada rotura restaurada de memoria:
//   · `setter-y-closer` sin pieza en PIEZA_DE_BLOQUE (también lo ven las listas)      → 3 / 5
//   · el motivo dicho aunque el lead no salió (`salio` fuera)                      → 7 / 1
//   · el ingreso estimado dicho en un ganado                                       → 7 / 1
//   · `piezasQueSeDibujan` sin callar las del Resumen vacías                        → 7 / 1
//   · FichaLead sin el `default` que dibuja las filas del Resumen                   → 7 / 1
test('el Resumen nativo en el teléfono: una fila por bloque, y se calla lo que no aplica', () => {
  // Todo bloque del Resumen con componente tiene su versión de teléfono, salvo los que el teléfono no destila: los
  // duplicados (abrir otra ficha es de la computadora) y la respuesta destacada (necesita las respuestas de Meta y de
  // la landing, que el teléfono no lee).
  // ⚠️ CAMBIADO A PROPÓSITO el 17/10/2026 (chat «Pendientes B2: CRM»): los siete bloques de la CHARLA del Resumen
  // (app/crm/lead-view/ficha/resumen/charla.tsx) tampoco se destilan acá: leen al montarse, en la computadora, y en el
  // teléfono la charla vive en su propia pestaña (Chats). Si el teléfono los quiere, es una pieza de MaKo Mobile.
  const sinTelefono = new Set([
    'posibles-duplicados', 'respuesta-destacada',
    'charla-whatsapp', 'charla-dm', 'pase-a-humano', 'cambios-de-mako', 'mensaje-listo', 'automatizaciones-en-curso', 'lo-que-le-mandamos',
  ]);
  for (const id of Object.keys(REGLAS_RESUMEN)) {
    if (sinTelefono.has(id)) continue;
    assert.ok(PIEZA_DE_BLOQUE[id as keyof typeof PIEZA_DE_BLOQUE], `«${id}» no tiene versión de teléfono`);
  }
  const hoy = '2026-10-16';
  const ahoraMs = Date.parse('2026-10-16T15:00:00Z');
  const abierto = resumenDelTelefono({ estado_lead: 'abierto', setter: 'Ana', closer: null, calificado: true, ingreso_estimado: 1500, instagram: 'Mako.App', web: 'https://www.mako.com/' },
    { etapa: 'agenda', hoy, ahoraMs, siguiente: { titulo: '¿Vino a la reunión 1?', detalle: null }, enEtapa: { desde: '2026-10-04T15:00:00Z', plazo: 10 } });
  assert.equal(abierto.siguiente, '¿Vino a la reunión 1?');
  assert.equal(abierto.equipo, 'Ana · sin closer');
  assert.equal(abierto.calificado, 'Calificado');
  assert.equal(abierto.ingreso, '$1,500');
  assert.equal(abierto['en-etapa'], '12 días de 10');
  assert.equal(abierto.motivo, null, 'no salió: el motivo se calla');
  assert.equal(abierto.plazo, null, 'fuera de la nutrición manual, el plazo se calla');
  assert.equal(abierto.redes, 'mako.com · @mako.app');
  const ganado = resumenDelTelefono({ estado_lead: 'ganado', ingreso_estimado: 1500 }, { etapa: 'ganado', hoy, ahoraMs, enEtapa: { desde: '2026-10-01T00:00:00Z', plazo: null } });
  assert.equal(ganado.ingreso, null, 'el ingreso estimado no es una venta: en un ganado se calla');
  assert.equal(ganado['en-etapa'], null, 'en una etapa que terminó no hay reloj');
  const perdido = resumenDelTelefono({ estado_lead: 'perdido', nutricion_manual_deadline: '2026-10-14' }, { etapa: 'manual', hoy, ahoraMs });
  assert.equal(perdido.motivo, 'Sin motivo', 'salió sin motivo: se dice, para que lo completen');
  assert.equal(perdido.plazo, 'Venció hace 2 días');
  // Lo que se calla vacío no se dibuja; lo que se lee siempre (el equipo), sí.
  const puestas: PiezaPuesta[] = [{ pieza: 'motivo', bloque: 'motivo-de-salida' }, { pieza: 'equipo', bloque: 'setter-y-closer' }, { pieza: 'siguiente', bloque: 'siguiente-accion' }];
  const nada = { proxima: null, llegoPor: null, respuestas: 0, llamada: false };
  assert.deepEqual(piezas(piezasQueSeDibujan(puestas, { ...nada, resumen: resumenDelTelefono({ estado_lead: 'abierto' }, { etapa: 'lead', hoy, ahoraMs }) })), ['equipo']);
  // La ficha las dibuja como filas, y el server las arma con la misma función.
  assert.match(sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx')), /default: \{\s*const v = p\.resumen\?\.\[pz\];/);
  assert.match(sinComentarios(leer('app/m/crm/datos.ts')), /resumen: lead \? resumenDelTelefono\(lead, \{/);
});

test('el mes a mes en el teléfono: la misma cuenta que la computadora, destilada (P25, 17/11/2026)', async () => {
  const { cobradoDelLead } = await import('../lib/cobrado-lead');
  // El caso de Código Inmobiliario (lead 2474 del negocio 9, medido en producción el 17/11/2026): 146 → 238 → 426, y
  // noviembre pagado en dos pagos por Binance.
  const c = cobradoDelLead({
    ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 238, suscripcionMeses: null, fechaCierre: '2026-10-21', hoy: '2026-11-17',
    movimientos: [
      { tipo: 'monto', desde: '2026-10-01', montoUsd: 146 },
      { tipo: 'monto', desde: '2026-11-01', montoUsd: 238, dia: 5 },
      { tipo: 'monto', desde: '2026-12-01', montoUsd: 426 },
    ],
    pagos: [
      { id: 115, monto_usd: 146, pagado: true, fecha_esperada: '2026-10-21', fecha_pago: '2026-10-21', metodo: 'cripto', es_mensualidad: true, nacio_cobrada: true },
      { id: 135, monto_usd: 94, pagado: true, fecha_esperada: '2026-11-04', fecha_pago: '2026-11-04', metodo: 'cripto', es_mensualidad: true, nacio_cobrada: true, suscripcion_mes: '2026-11-01' },
      { id: 136, monto_usd: 144, pagado: true, fecha_esperada: '2026-11-05', fecha_pago: '2026-11-05', metodo: 'cripto', es_mensualidad: true, nacio_cobrada: true, suscripcion_mes: '2026-11-01' },
    ],
  });
  assert.ok(c.suscripcion, 'es una suscripción');
  const m = mesAMesDelTelefono(c.suscripcion!, '2026-11-17');
  assert.deepEqual(m.estado, { texto: 'Al día', tono: 'verde' });
  assert.equal(m.pagaHoy, '$238/mes · día 5');
  assert.deepEqual(m.leToca, { rotulo: 'Le toca', texto: '5 de diciembre · $426' });
  assert.equal(m.pagado, '$384 · 2 meses pagados');
  assert.equal(m.debe, null);
  assert.deepEqual(m.meses.map((x) => x.mes), ['diciembre', 'noviembre', 'octubre'], 'del más nuevo al más viejo');
  assert.deepEqual(m.meses[1], { mes: 'noviembre', texto: '$238 de $238', detalle: 'Subió de $146 · 2 pagos · Cripto', tono: 'verde' });
  assert.equal(m.meses[2].detalle, 'Empezó · 1 pago · Cripto');
  assert.equal(m.meses[0].tono, 'gris', 'el que viene no está en deuda');

  // Cortada desde diciembre y sin pagar noviembre: el estado lo dice, los meses cortados van en UN renglón.
  const cortada = cobradoDelLead({
    ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 100, suscripcionMeses: null, fechaCierre: '2026-08-10', hoy: '2027-02-20',
    movimientos: [{ tipo: 'monto', desde: '2026-08-01', montoUsd: 100 }, { tipo: 'corte', desde: '2026-12-01' }],
    pagos: [8, 9, 10].map((mes, i) => ({ id: 200 + i, monto_usd: 100, pagado: true, fecha_esperada: `2026-${String(mes).padStart(2, '0')}-10`, fecha_pago: `2026-${String(mes).padStart(2, '0')}-10`, metodo: 'transferencia', es_mensualidad: true, nacio_cobrada: true })),
  });
  const mc = mesAMesDelTelefono(cortada.suscripcion!, '2027-02-20');
  assert.equal(mc.pagaHoy, null, 'cortada: no paga');
  assert.deepEqual(mc.estado, { texto: 'Cortada desde diciembre 2026', tono: 'gris' }, 'la misma cuenta que la computadora (`estadoDeSuscripcion`)');
  assert.deepEqual(mc.meses.filter((x) => x.texto === 'Cortada').map((x) => x.mes), ['diciembre 2026 – marzo'], 'los meses cortados seguidos, en UN renglón');
  assert.deepEqual(mc.meses[1], { mes: 'noviembre 2026', texto: '$0 de $100', detalle: 'Vencido', tono: 'rojo' }, 'lo que quedó sin pagar antes del corte, en rojo');
  assert.equal(mc.debe, '$100');

  // Se dibuja sólo con una suscripción, y la ficha lo dibuja; con él puesto, el server calla el estado de cuenta de la casa.
  assert.equal(PIEZA_DE_BLOQUE.suscripcion, 'mes-a-mes');
  const puestas = piezasDelTelefono(fichaEfectiva('respaldo', null, RESPALDO_VACIO).tabs, tabsQueVe({ verTracking: true, verReuniones: true, verPagos: true }));
  const base = { proxima: null, llegoPor: null, respuestas: 0, llamada: false };
  assert.ok(!piezas(piezasQueSeDibujan(puestas, { ...base, mesAMes: null })).includes('mes-a-mes'), 'sin suscripción, se calla');
  assert.ok(piezas(piezasQueSeDibujan(puestas, { ...base, mesAMes: m })).includes('mes-a-mes'));
  const ficha = sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx'));
  assert.match(ficha, /case 'mes-a-mes': \{[\s\S]{0,300}?const m = p\.mesAMes/);
  assert.match(ficha, /<SheetM id="meses"/, 'los meses abren en una hoja');
  const datos = sinComentarios(leer('app/m/crm/datos.ts'));
  assert.match(datos, /mesAMes: cobrado\.suscripcion \? mesAMesDelTelefono\(cobrado\.suscripcion, hoy\) : null/, 'de la MISMA cuenta que el estado de cuenta');
  assert.match(datos, /saldo: conMesAMes \? null :/, 'con el mes a mes puesto, el estado de cuenta de la casa se calla');
});
