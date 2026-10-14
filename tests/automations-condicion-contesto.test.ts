// =============================================================================
// «Si el lead contesta» es una CONDITION, no una opción del CRON (14/10/2026)
// =============================================================================
// Hasta el 14/10 cualquier mensaje del lead cortaba todo lo que tenía por delante, salvo el carril del recordatorio:
// una regla escondida del motor, y así no salió la bienvenida del bug 5. Esa mañana pasó a ser una opción de cada
// flecha del CRON («sigue» / «se corta»). Esa tarde, Martín: «"Si el lead contesta" NO debería ir en el CRON, debería
// ser una CONDITION... Es obvio eso». Ahora:
//   · que el lead conteste NO corta nada: `pausarPorRespuesta` sólo anota 'respondio' (con la posición y el próximo
//     envío intactos) y el motor mueve esa fila igual que una activa (`seMueveEnLaCorrida` ya no mira la respuesta);
//   · lo corta la condición «No contestó desde que entró» (`contesto` negada, lib/condiciones-catalogo.ts), que lee
//     `contestoEnEsta`: la pone el motor con el estado de la fila, «Si responde» con true y «Probar» con lo que se
//     escribió en el chat;
//   · el reintento la vuelve a pasar antes de mandar (`condicionDeArriba`, tests/motor-reintento-condicion);
//   · las plantillas la traen en cada seguimiento que da por hecho que el lead no contestó;
//   · la opción del CRON (`si_contesta`) se fue: `normalizar` la borra, y scripts/migrar-contesto-condicion.ts la
//     convirtió en condiciones.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `evaluar` de `contesto` leyendo `respondio` (lo del lead, no lo de esta automatización)   → 4 / 2
//   R2 `procesarEnvios` sin `contestoEnEsta: enRespuesta` en la resolución de las condiciones      → 5 / 1
//   R3 `pausarPorRespuesta` (el motor) volviendo a sacarle el próximo envío a la fila               → 5 / 1
//   R4 `hechosDeLeadNuevo` sin `contestoEnEsta` («Probar» nunca ve que contestó)                     → 5 / 1
//   R5 `normalizar` sin borrar `si_contesta`                                                        → 5 / 1
// Como está: 6 / 0.
//
// Correr: node --import tsx --test tests/automations-condicion-contesto.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { normalizar, indicePorId, cumpleFila, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';
import { CONDICIONES } from '../lib/condiciones-catalogo';
import { resolverControl, condicionSigueLlevando, condicionDeArriba, seMueveEnLaCorrida } from '../lib/nutricion-grafo-motor';
import { hechosDeLeadNuevo, pausarPorRespuesta, iniciar, siguiente } from '../lib/simulador-grafo';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';

const H = (o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: true, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.parse('2026-10-14T12:00:00Z'), ...o,
});
const NO_CONTESTO = { campo: 'contesto', no: true } as const;
const msg = (id: string, siguiente: string | null = null): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo: id, siguiente, delay_horas: 0 });

// m1 → DELAY 1 día → «No contestó desde que entró» → m2 («¿pudiste ver mi mensaje?»).
const F = normalizar([
  msg('m1', 'e'),
  { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'c' },
  { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_si', modo: 'todas', filas: [NO_CONTESTO], siguiente: 'm2' }], si_no: null },
  msg('m2'),
] as PasoGrafo[]);
const I = (id: string) => indicePorId(F, id);

test('la condición existe, se niega, y «no sé» no se cumple ni negada', () => {
  const c = CONDICIONES.find((x) => x.id === 'contesto');
  assert.ok(c, 'falta la condición `contesto` en el catálogo');
  assert.equal(c!.seccion, 'Mensajes');
  assert.deepEqual(c!.rotulo, ['Contestó desde que entró', 'No contestó desde que entró']);
  assert.equal(cumpleFila(NO_CONTESTO, H({ contestoEnEsta: false })), true);
  assert.equal(cumpleFila(NO_CONTESTO, H({ contestoEnEsta: true })), false);
  assert.equal(cumpleFila({ campo: 'contesto' }, H({ contestoEnEsta: true })), true);
  // Es de ESTA automatización, no del lead: alguien que escribió alguna vez entra sin haber contestado acá.
  assert.equal(cumpleFila(NO_CONTESTO, H({ respondio: true, contestoEnEsta: false })), true);
  for (const f of [NO_CONTESTO, { campo: 'contesto' as const }]) assert.equal(cumpleFila(f, H()), false, 'sin el dato no se cumple');
});

test('en el motor: después de la espera, la condición decide; y el reintento la vuelve a pasar', () => {
  const ctx = (contestoEnEsta: boolean) => ({ hechos: H({ contestoEnEsta }), ahoraMs: Date.parse('2026-10-14T12:00:00Z') });
  const sigue = resolverControl(F, I('c'), ctx(false));
  assert.equal(sigue.tipo === 'nodo' ? sigue.idx : sigue.tipo, I('m2'), 'no contestó: sale el seguimiento');
  const corta = resolverControl(F, I('c'), ctx(true));
  assert.equal(corta.tipo, 'fin', 'contestó: el camino termina');
  // Parado en m2 (un reintento): la condición de arriba se vuelve a mirar con lo de ahora.
  assert.equal(condicionDeArriba(F, I('m2')), I('c'));
  assert.equal(condicionSigueLlevando(F, I('c'), I('m2'), H({ contestoEnEsta: true })), false);
  // Y que conteste no frena nada por su cuenta: se mueve todo (dentro del horario).
  for (let i = 0; i < F.length; i++) assert.equal(seMueveEnLaCorrida(F, i, { fueraDeHorario: false }), true, String(F[i].id));
});

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const NUTRI = sinComentarios(readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8'));
const cuerpo = (src: string, firma: string) => { const i = src.indexOf(firma); assert.ok(i >= 0, firma); return src.slice(i, src.indexOf('\n}\n', i)); };

test('el cableado: la fila dice si contestó, «Si responde» también, y contestar sólo se ANOTA', () => {
  const proc = cuerpo(NUTRI, 'export async function procesarEnvios(');
  assert.match(proc, /const enRespuesta = insc\.estado === 'respondio';/);
  assert.equal((proc.match(/contestoEnEsta: enRespuesta \}/g) ?? []).length, 2, 'la resolución de las condiciones y la re-evaluación de la de arriba');
  assert.match(cuerpo(NUTRI, 'async function responderConGrafo('), /contestoEnEsta: true \}\)\.destino;/);
  const pausar = cuerpo(NUTRI, 'export async function pausarPorRespuesta(');
  assert.match(pausar, /\.update\(\{ estado: 'respondio', updated_at: ahoraISO\(\) \}\)\s*\.eq\('lead_id', leadId\)\s*\.eq\('estado', 'activa'\)/);
});

test('«Probar»: quien escribió en el chat contestó, y lo que corría queda esperando (no se corta)', () => {
  assert.equal(hechosDeLeadNuevo({ respondio: true }).contestoEnEsta, true);
  assert.equal(hechosDeLeadNuevo({}).contestoEnEsta, false);
  const uno = siguiente(F, iniciar(F));
  assert.equal(pausarPorRespuesta(uno.estado).siguen, uno.estado.hilos.length);
});

test('la opción del CRON se fue: `normalizar` borra la clave vieja y no queda pantalla ni API', () => {
  const viejo = normalizar([msg('m1'), { id: 'entrada', nodo: 'inicio', siguiente: 'm1', si_contesta: { p: 'corta' } } as unknown as PasoGrafo]);
  assert.ok(!('si_contesta' in viejo.find((p) => p.nodo === 'inicio')!), 'quedó `si_contesta` en el inicio');
  assert.ok(!existsSync(new URL('../app/automations/SiContestaCaminos.tsx', import.meta.url)));
  const def = readFileSync(new URL('../lib/api-mako/areas/chatbot.def.ts', import.meta.url), 'utf8');
  assert.ok(!def.includes('cambiar_si_contesta_secuencia'));
});

test('las plantillas la traen en los seguimientos que dan por hecho que no contestó', () => {
  const filas = (plantilla: string, cond: string) => {
    const p = PLANTILLAS.find((x) => x.id === plantilla)!.pasos.find((x) => x.id === cond)!;
    return (p.ramas ?? []).flatMap((r) => r.filas);
  };
  for (const [pl, c] of [['lead-entro', 'le_c1'], ['lead-entro', 'le_c2'], ['lead-agendo', 'la_c'], ['lead-tuvo-reunion', 'lt_c3'], ['lead-confirmo-compra', 'lc_c1']] as const) {
    assert.ok(filas(pl, c).some((f) => f.campo === 'contesto' && f.no === true), `${pl} · ${c}`);
  }
  // «¿Lo reagendamos?» sale por el «Si no»: contestó → termina.
  assert.ok(filas('lead-no-asistio', 'ln_c').some((f) => f.campo === 'contesto' && !f.no));
});
