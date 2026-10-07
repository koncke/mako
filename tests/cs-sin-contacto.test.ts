// =============================================================================
// #109 — «el último contacto» como UNA regla, y la alerta de baja AL DUEÑO
// =============================================================================
// Decisión de Martín (06/10/2026, «Columnas + alerta»): la tabla de Clientes suma «Último contacto»
// y «Vencidas», y se arma ya la alerta de baja al DUEÑO, sin IA: un cliente ganado que no está
// dado de baja ni graduado y lleva 21 días sin contacto ni movimiento de etapa → un aviso con quién
// es, los días y qué hacer. Uno por cliente y por RACHA, no uno por día. Nunca al cliente.
//
// Lo que se fija acá, y cada cosa falla en silencio si se rompe:
//   · `ultimoContacto` es la regla de la cartera de MaKo, de la columna y del cron: una sola;
//   · contacto es lo que escribió EL CLIENTE: un saliente, automático o a mano, no reinicia el reloj;
//   · la regla de a quién se avisa (umbral, estados que no avisan, el ancla de la racha);
//   · «no pude leer» no decide sobre nadie (una lectura caída = cero avisos, no catorce);
//   · la clave del dedup es la racha, no el día;
//   · el envío va al dueño y no toca ningún camino que le escriba a un lead.
//
// PROBADO ROMPIÉNDOLO (07/10/2026, arnés del scratchpad que restaura de MEMORIA, nunca con git).
// La tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ultimoContacto, decidirSinContacto, avisosSinContacto, claveRacha, textoSinContacto, haceCuanto,
  DIAS_SIN_CONTACTO, TIPO_AVISO_SIN_CONTACTO, TOPE_AVISOS_POR_CORRIDA, DEDUP_RACHA_MIN, CATEGORIA_SIN_CONTACTO,
  type LecturasSinContacto, type ClienteParaAviso,
} from '../lib/cs-contacto';
import { DIAS_TRABADO } from '../app/customer-success/en-etapa';
import { CATALOGO_AVISOS, areaDeAviso, encabezadoAviso } from '../lib/avisos-catalogo';
import { AVISOS_AGRUPABLES } from '../lib/avisos-agrupables';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que arranca en `desde` y termina en el primer `hasta` después de él. */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

const DIA = 86_400_000;
/** Un «ahora» fijo: el test no depende del reloj. */
const AHORA = Date.parse('2026-10-07T15:00:00Z');
const hace = (dias: number, horas = 0) => new Date(AHORA - dias * DIA - horas * 3_600_000).toISOString();

// ── 1. La regla del último contacto ───────────────────────────────────────────

test('ultimoContacto: una sesión SIN fecha no le gana a una con fecha, y el empate lo decide el id', () => {
  // ⚠️ Las sin fecha van ANTES y DESPUÉS de las fechadas, y con el id más alto: con una sola, al
  // principio, la rotura «la sin fecha gana» pasaba en VERDE (19/0) porque la primera fechada la
  // pisaba igual. El orden de la entrada es parte del caso.
  const r = ultimoContacto([
    { recording_id: 9, call_date: null },
    { recording_id: 3, call_date: '2026-09-01' },
    { recording_id: 5, call_date: '2026-09-01' },
    { recording_id: 1, call_date: '2026-08-01' },
    { recording_id: 12, call_date: null },
  ], []);
  assert.equal(r.sesion?.recording_id, 5, 'la más nueva, y entre dos del mismo día la que entró después');
  assert.equal(r.fecha, '2026-09-01');
  assert.equal(r.via, 'sesion');
});

test('ultimoContacto: el WhatsApp más nuevo por FECHA, no por orden de llegada; sin fecha no cuenta', () => {
  const r = ultimoContacto([], [
    { wa_timestamp: hace(1), from_me: false },
    { wa_timestamp: null, from_me: false },
    { wa_timestamp: hace(0, 2), from_me: false },   // llegó después en la lista pero es lo más nuevo
    { wa_timestamp: hace(10), from_me: false },     // un backfill: id nuevo, fecha vieja
  ]);
  assert.equal(r.mensaje?.wa_timestamp, hace(0, 2));
  assert.equal(r.fecha, hace(0, 2));
  assert.equal(r.via, 'whatsapp');
});

test('ultimoContacto: el más reciente de los dos, y sin ninguno es «nunca» (fecha null), no un error', () => {
  const sesionVieja = ultimoContacto([{ call_date: '2026-09-01' }], [{ wa_timestamp: hace(2), from_me: false }]);
  assert.equal(sesionVieja.via, 'whatsapp');
  assert.equal(sesionVieja.fecha, hace(2));
  const sesionNueva = ultimoContacto([{ call_date: '2026-10-06' }], [{ wa_timestamp: '2026-09-20T10:00:00Z', from_me: false }]);
  assert.equal(sesionNueva.via, 'sesion');
  const nada = ultimoContacto([], []);
  assert.deepEqual({ fecha: nada.fecha, via: nada.via }, { fecha: null, via: null });
});

// ── 1b. Lo que le MANDAMOS no es contacto (revisión de #109, 07/10/2026) ──────
// En el ws1 el envío está prendido: el recordatorio de clases (#780), los avisos del curso y la
// nutrición le escriben SOLOS al cliente que no entra al portal. Contados como contacto, cada uno
// reiniciaba el ancla, y la alerta de baja no salía justo para el desenganchado.

test('un saliente (automático o a mano) NO mueve el último contacto; el más nuevo de todos sigue en `mensaje`', () => {
  const r = ultimoContacto([], [
    { wa_timestamp: hace(30), from_me: false },   // lo último que escribió él
    { wa_timestamp: hace(3), from_me: true },     // el recordatorio de clases
    { wa_timestamp: hace(1), from_me: true },     // la nutrición
  ]);
  assert.equal(r.fecha, hace(30), 'el reloj sigue en lo que escribió EL CLIENTE');
  assert.equal(r.via, 'whatsapp');
  assert.equal(r.entrante?.wa_timestamp, hace(30));
  // «Espera respuesta» (la cartera de MaKo) necesita saber quién habló último: eso no se pierde.
  assert.equal(r.mensaje?.wa_timestamp, hace(1));
  assert.equal(r.mensaje?.from_me, true);
  // Sólo salientes = nunca escribió: «Nunca» en la tabla, y el reloj lo pone la venta o la etapa.
  const soloNuestros = ultimoContacto([], [{ wa_timestamp: hace(1), from_me: true }]);
  assert.deepEqual({ fecha: soloNuestros.fecha, via: soloNuestros.via }, { fecha: null, via: null });
  // Y una fila leída SIN la columna no cuenta como suya: `=== false`, no `!from_me`.
  const sinColumna = ultimoContacto([], [{ wa_timestamp: hace(1) } as { wa_timestamp: string; from_me: boolean }]);
  assert.equal(sinColumna.fecha, null, 'un from_me ausente leído como «del cliente» devuelve el bug entero');
});

test('el caso que trajo el arreglo: le escribimos solos cada 3 días y él no contesta hace 25 → la alerta SALE', () => {
  const u = ultimoContacto([], [
    { wa_timestamp: hace(25), from_me: false },
    ...[22, 19, 16, 13, 10, 7, 4, 1].map((d) => ({ wa_timestamp: hace(d), from_me: true })),
  ]);
  const r = avisosSinContacto(
    [{ leadId: 7, nombre: 'Ana Ruiz', cierre: '2026-05-01' }],
    { contacto: { 7: { fecha: u.fecha, via: u.via } }, estado: {}, movimiento: {} },
    AHORA,
  )!;
  assert.deepEqual(r.map((a) => [a.leadId, a.dias, a.desde]), [[7, 25, 'contacto']]);
});

test('haceCuanto: hoy, ayer, hace N días; una fecha del futuro o ilegible no se dibuja', () => {
  assert.equal(haceCuanto(hace(0, 3), AHORA)?.texto, 'hoy');
  assert.equal(haceCuanto(hace(1, 1), AHORA)?.texto, 'ayer');
  assert.equal(haceCuanto(hace(23), AHORA)?.texto, 'hace 23 días');
  assert.equal(haceCuanto(new Date(AHORA + DIA).toISOString(), AHORA), null, 'un reloj corrido no es «hoy»');
  assert.equal(haceCuanto('no es una fecha', AHORA), null);
  assert.equal(haceCuanto(null, AHORA), null);
});

// ── 2. ¿A quién se le avisa? ──────────────────────────────────────────────────

const H = (p: Partial<Parameters<typeof decidirSinContacto>[0]>) =>
  ({ estado: null, contacto: null, movimiento: null, cierre: null, ...p });

test('el umbral es el de «trabado» del kanban (21), importado y no copiado', () => {
  assert.equal(DIAS_SIN_CONTACTO, DIAS_TRABADO);
  assert.equal(DIAS_SIN_CONTACTO, 21);
  assert.equal(decidirSinContacto(H({ contacto: hace(20, 23) }), AHORA).avisar, false, '20 días y 23 h todavía no');
  const d = decidirSinContacto(H({ contacto: hace(21) }), AHORA);
  assert.ok(d.avisar && d.dias === 21 && d.desde === 'contacto');
});

test('baja y graduado no avisan; «pausado» y «sin fila» SÍ (la decisión nombra baja y graduado, nada más)', () => {
  const viejo = { contacto: hace(40) };
  assert.equal(decidirSinContacto(H({ ...viejo, estado: 'baja' }), AHORA).avisar, false);
  assert.equal(decidirSinContacto(H({ ...viejo, estado: 'graduado' }), AHORA).avisar, false);
  assert.equal(decidirSinContacto(H({ ...viejo, estado: 'pausado' }), AHORA).avisar, true);
  assert.equal(decidirSinContacto(H({ ...viejo, estado: 'activo' }), AHORA).avisar, true);
  assert.equal(decidirSinContacto(H({ ...viejo, estado: null }), AHORA).avisar, true);
});

test('el reloj arranca en lo ÚLTIMO que pasó: un cambio de etapa o la venta frenan igual que un contacto', () => {
  assert.equal(decidirSinContacto(H({ contacto: hace(40), movimiento: hace(3) }), AHORA).avisar, false,
    'lo movieron de etapa hace 3 días: no está abandonado');
  assert.equal(decidirSinContacto(H({ cierre: '2026-10-02' }), AHORA).avisar, false,
    'cerró hace 5 días: no lleva 21 sin contacto aunque nadie le haya escrito todavía');
  const d = decidirSinContacto(H({ contacto: hace(50), movimiento: hace(30), cierre: '2026-06-01' }), AHORA);
  assert.ok(d.avisar && d.desde === 'movimiento' && d.dias === 30, 'cuenta desde el más nuevo de los tres');
});

test('sin una sola fecha no se inventa el número, y una fecha del futuro no avisa', () => {
  assert.deepEqual(decidirSinContacto(H({}), AHORA), { avisar: false, porque: 'sin-fecha' });
  assert.equal(decidirSinContacto(H({ contacto: new Date(AHORA + 3 * DIA).toISOString() }), AHORA).avisar, false);
});

// ── 3. La lista: fail-closed, el orden y la racha ─────────────────────────────

const CLIENTES: ClienteParaAviso[] = [
  { leadId: 1, nombre: 'Ana Ruiz', cierre: '2026-05-01' },
  { leadId: 2, nombre: 'Beto Paz', cierre: '2026-05-01' },
  { leadId: 3, nombre: '  ', cierre: '2026-10-01' },
];
const LECTURA: LecturasSinContacto = {
  contacto: { 1: { fecha: hace(25), via: 'whatsapp' }, 2: { fecha: hace(60), via: 'sesion' } },
  estado: {},
  movimiento: {},
};

test('«no pude leer» NO decide sobre nadie: cualquiera de las tres lecturas caída = ningún aviso', () => {
  assert.equal(avisosSinContacto(CLIENTES, { ...LECTURA, contacto: null }, AHORA), null,
    'con el WhatsApp sin leer, todos parecerían en silencio');
  assert.equal(avisosSinContacto(CLIENTES, { ...LECTURA, estado: null }, AHORA), null,
    'con cs_clientes sin leer, un cliente dado de baja recibiría el aviso');
  assert.equal(avisosSinContacto(CLIENTES, { ...LECTURA, movimiento: null }, AHORA), null,
    'con la entrega sin leer, uno que se movió ayer');
});

test('los de más días primero (el tope corta a los que menos esperaron), y un nombre vacío no sale vacío', () => {
  const r = avisosSinContacto(CLIENTES, LECTURA, AHORA)!;
  assert.deepEqual(r.map((a) => [a.leadId, a.dias]), [[2, 60], [1, 25]]);
  assert.equal(r[0].via, 'sesion');
  const sinNombre = avisosSinContacto([{ leadId: 9, nombre: ' ', cierre: '2026-01-01' }], { contacto: {}, estado: {}, movimiento: {} }, AHORA)!;
  assert.equal(sinNombre[0].nombre, 'Un cliente');
});

test('UNO POR RACHA, NO UNO POR DÍA: la misma racha da la misma clave; un contacto nuevo abre otra', () => {
  const dia22 = avisosSinContacto(CLIENTES, LECTURA, AHORA)!.find((a) => a.leadId === 1)!;
  const dia30 = avisosSinContacto(CLIENTES, LECTURA, AHORA + 8 * DIA)!.find((a) => a.leadId === 1)!;
  assert.equal(dia22.clave, dia30.clave, 'correr el cron todos los días no puede cambiar la clave');
  const otraRacha = avisosSinContacto(CLIENTES, {
    ...LECTURA, contacto: { ...LECTURA.contacto!, 1: { fecha: hace(-10), via: 'whatsapp' } },
  }, AHORA + 40 * DIA)!.find((a) => a.leadId === 1)!;
  assert.notEqual(otraRacha.clave, dia22.clave, 'le escribieron: la racha siguiente vuelve a avisar');
  // La misma marca escrita de dos formas no abre dos rachas.
  assert.equal(claveRacha(1, Date.parse('2026-09-12T10:00:00Z')), claveRacha(1, Date.parse('2026-09-12T10:00:00.000+00:00')));
  // Y el TTL es largo: lo que separa dos avisos es un contacto, no el tiempo.
  assert.ok(DEDUP_RACHA_MIN >= 60 * 24 * 300, `el dedup dura ${DEDUP_RACHA_MIN} min: con poco, la misma racha avisaría otra vez`);
});

// ── 4. El mensaje ─────────────────────────────────────────────────────────────

test('el texto: quién, cuántos días, qué hacer y el link; corto, de tú y sin afirmar de más', () => {
  const t = textoSinContacto({ nombre: 'Ana Ruiz', dias: 23, link: 'https://x.test/customer-success?cliente=1&ws=4' });
  // «sin mensajes SUYOS»: lo que le mandamos no cuenta, así que «sin contacto» a secas sería falso
  // sobre un cliente al que el dueño le escribió ayer a mano.
  assert.match(t, /\*Ana Ruiz\* lleva 23 días sin mensajes suyos ni sesión registrada, ni cambio de etapa\./);
  assert.match(t, /Escríbele hoy o agenda una sesión\./);
  assert.match(t, /\?cliente=1&ws=4$/);
  assert.deepEqual(marcasDeVoseo(t), [], 'el dueño es mexicano: nada de voseo');
  assert.ok(t.split('\n').slice(0, 2).join(' ').length <= 120, 'dos renglones cortos: es un WhatsApp');
  assert.doesNotMatch(textoSinContacto({ nombre: 'Ana', dias: 21, link: null }), /http/);
});

test('el catálogo: la entrada existe, nace PRENDIDA, con rótulo de CLIENTE, y puede esperar al resumen', () => {
  const cat = CATALOGO_AVISOS.find((c) => c.id === TIPO_AVISO_SIN_CONTACTO);
  assert.ok(cat, 'sin la entrada sale igual, pero como «SISTEMA» y sin poder apagarse desde /mensajes');
  assert.equal(cat!.porDefecto, 'on', 'sin porDefecto nace apagado: la decisión del dueño no se cumpliría');
  assert.equal(cat!.categoria, 'aviso', 'una «acción» o «pregunta» espera un sí y no puede esperar al resumen');
  assert.equal(areaDeAviso(TIPO_AVISO_SIN_CONTACTO), 'cliente');
  assert.match(encabezadoAviso(TIPO_AVISO_SIN_CONTACTO), /CLIENTE/);
  assert.ok(AVISOS_AGRUPABLES.has(TIPO_AVISO_SIN_CONTACTO));
  assert.deepEqual(marcasDeVoseo(cat!.ejemplo), []);
});

// ── 5. El cableado: una lectura, un envío, y nunca al cliente ─────────────────

const LIB = sinComentarios(leer('lib/cs-sin-contacto.ts'));
const RUTA = sinComentarios(leer('app/api/cron/cs-sin-contacto/route.ts'));
const CARTERA = sinComentarios(leer('lib/cs-cartera.ts'));

test('el envío va al DUEÑO por emitirAviso, con la clave de la racha, y nada de acá le escribe a un lead', () => {
  const llamada = bloque(LIB, 'await emitirAviso({', '});');
  assert.match(llamada, /dedupKey: a\.clave,/, 'sin la clave de la racha, el dedup es por tipo y un cliente se come el aviso de otro');
  assert.match(llamada, /dedupTtlMin: DEDUP_RACHA_MIN,/, 'sin TTL no hay dedup: un aviso por día');
  assert.match(llamada, /tipo: TIPO_AVISO_SIN_CONTACTO,/);
  assert.doesNotMatch(llamada, /alDueno/, '`alDueno` es el grupo del SUPER ADMIN, no el del dueño del negocio');
  // Ningún camino que le escriba a un lead (WhatsApp de la línea, mail a una persona).
  assert.doesNotMatch(LIB, /enviarYEspejar|enviarMediaYEspejar|enviarTexto|enviarMedia|enviarBorrador|sendEmail|enviarAPersonaMaKo/,
    'la alerta es AL DUEÑO: nada de acá le escribe al cliente');
  assert.equal((LIB.match(/emitirAviso\(/g) ?? []).length, 1, 'un solo envío');
});

test('el tope cuenta los que SALEN: los ya avisados no ocupan su lugar para siempre', () => {
  const vuelta = bloque(LIB, 'for (const a of plan) {', 'const enEspera');
  assert.match(vuelta, /if \(avisados >= TOPE_AVISOS_POR_CORRIDA\) break;/);
  assert.match(vuelta, /if \(r\.deduped\) \{ yaAvisados\+\+; continue; \}/, 'un ya avisado no cuenta contra el tope');
  assert.match(vuelta, /if \(r\.apagado\) \{ apagado = true; break; \}/, 'apagado es del TIPO: los demás saldrían igual de apagados');
  assert.ok(TOPE_AVISOS_POR_CORRIDA >= 1 && TOPE_AVISOS_POR_CORRIDA <= 5, `tope ${TOPE_AVISOS_POR_CORRIDA}: la primera corrida no puede inundar el grupo`);
  // Y una lectura caída tira (el cron la cuenta como workspace caído), no sigue con un vacío.
  assert.match(LIB, /if \(!plan\) \{[^}]*throw new Error\(/);
});

test('el cron: la auth de la casa, sólo los workspaces con la tab, cada uno en su contexto y con su try', () => {
  assert.match(RUTA, /const denied = checkCronAuth\(req\);\s*if \(denied\) return denied;/);
  assert.match(RUTA, /tabEnCapa\('customer-success', w\.capa\)/, 'sin la tab, no hay a quién mostrarle esos clientes');
  assert.match(RUTA, /w\.estado === 'activo'/);
  assert.match(RUTA, /runWithWorkspace\(w\.id, \(\) => avisarClientesSinContacto\(w\.id, \{ ahora, dry \}\)\)/);
  const vuelta = bloque(RUTA, 'for (const w of conTab) {', 'const ok = ');
  assert.match(vuelta, /try \{[\s\S]*\} catch \(e\) \{/, 'un workspace roto no le apaga la corrida a los demás');
  assert.match(RUTA, /status: ok \? 200 : 500/);
});

test('UNA regla del contacto: la cartera de MaKo y el lector de la tabla y el cron llaman a `ultimoContacto`', () => {
  const cartera = bloque(CARTERA, 'export async function cartera()', 'export async function ultimoContactoDeClientes(');
  assert.match(cartera, /ultimoContacto\(ses, mensajesDe\.get\(l\.id\) \?\? \[\]\)/);
  assert.doesNotMatch(cartera, /\.sort\(\(a, b\) => \(b\.wa_timestamp/, 'volvió una copia de «el último WhatsApp» adentro de la cartera');
  assert.doesNotMatch(cartera, /masReciente\(/);
  const lector = CARTERA.slice(CARTERA.indexOf('export async function ultimoContactoDeClientes('));
  assert.match(lector, /ultimoContacto\(sesionesDe\.get\(id\) \?\? \[\], mensajesDe\.get\(id\) \?\? \[\]\)/);
  // Las dos lecturas sin las llamadas de prueba, con la misma constante.
  assert.equal(CATEGORIA_SIN_CONTACTO, 'test');
  assert.equal((CARTERA.match(/\.neq\('category', CATEGORIA_SIN_CONTACTO\)/g) ?? []).length, 2);
  // Y el cron no tiene una tercera: lee por el mismo lector que la pantalla.
  assert.match(LIB, /ultimoContactoDeClientes\(ids\)/);
  assert.doesNotMatch(LIB, /from\('(wa_mensajes|closing_analyses)'\)|'wa_mensajes'|'closing_analyses'/);
});

test('el lector PAGINA (wa_mensajes del ws1 pasa las mil filas), por `id`, de a tandas y sin las filas sin fecha', () => {
  const lector = CARTERA.slice(CARTERA.indexOf('export async function ultimoContactoDeClientes('));
  assert.match(lector, /leerTodo<T>\(db, tabla, cols, \{ orden, filtros: \(q\) => filtro\(q\.in\('lead_id', t\)\) \}\)/);
  // `from_me` viaja (la regla lo mira) y se filtra en la consulta: sólo lo que escribió el cliente.
  assert.match(lector, /'wa_mensajes', 'id, lead_id, from_me, wa_timestamp', 'id',/);
  assert.match(lector, /q\.eq\('from_me', false\)\.not\('wa_timestamp', 'is', null\)/,
    'sin el filtro, un recordatorio automático reinicia el reloj de la alerta');
  assert.match(lector, /tandas\(ids, TANDA_IDS\)/);
  assert.match(lector, /catch \(e\) \{[\s\S]*return null;/, '«no pude leer» vuelve null, nunca un mapa vacío');
});

test('la página trae el último contacto por ESE lector y distingue «nunca» de «no pude»', () => {
  const page = sinComentarios(leer('app/customer-success/page.tsx'));
  assert.match(page, /const lecturaContacto = ultimoContactoDeClientes\(clientes\.map\(\(c\) => c\.leadId\)\);/);
  assert.match(page, /contactoUltimo: contactos \? \(contactos\[c\.leadId\] \?\? \{ fecha: null, via: null \}\) : null,/);
});

// ── Las roturas (07/10/2026), cada una restaurada de memoria (nunca con git) ────
// Base de este archivo: 19 pass / 0 fail. Cada rotura tumbó UN test (18 / 1):
//   1. el WhatsApp por orden de llegada (sin comparar fechas)       → «…por FECHA, no por orden…»
//   2. una sesión sin fecha le gana a una con fecha                 → «…SIN fecha no le gana…»
//      ⚠️ La primera versión del caso daba VERDE (19/0): la sin fecha iba sólo al principio y la
//      primera fechada la pisaba igual. Con una sin fecha al FINAL y con el id más alto, cae.
//   2b. el empate de fecha sin desempatar por recording_id           → el mismo
//   3. el umbral copiado a mano (14 en vez de DIAS_TRABADO)          → «el umbral es el de "trabado"…»
//   4. «pausado» sumado a los que no avisan                          → «baja y graduado no avisan…»
//   5. el cambio de etapa sacado del ancla                           → «el reloj arranca en lo ÚLTIMO…»
//   6. fail-closed sólo con la lectura del contacto                  → «"no pude leer" NO decide…»
//   7. la clave del dedup por DÍA y no por racha                     → «UNO POR RACHA…»
//   8. el texto con voseo («Escribile… agendá»)                      → «el texto: quién, cuántos días…»
//   9. el envío sin `dedupKey: a.clave`                              → «el envío va al DUEÑO…»
//  10. el envío con `alDueno: true`                                  → el mismo
//  11. el tope contando también los ya avisados                      → «el tope cuenta los que SALEN…»
//  12. el cron sin el filtro de la tab                               → «el cron: la auth de la casa…»
//  13. el lector sin excluir las llamadas de prueba                  → «UNA regla del contacto…»
//  14. la entrada del catálogo sin `porDefecto: 'on'`                → «el catálogo: la entrada existe…»
//  15. la página trae «nunca» como «no pude» (`?? null`)             → «la página trae el último contacto…»
// Restaurado: 19 pass / 0 fail. Y la action nueva sin su puerta la caza el guard que ya existía
// (tests/cs-acciones-puerta.test.ts: 6/0 → 5/1), porque enumera los exports.
//
// ── Revisión del 07/10/2026: lo que le MANDAMOS no es contacto ──────────────────
// Base: 21 pass / 0 fail (corrido junto con tests/cs-cartera-columnas.test.ts: 34 / 0). Arnés del
// scratchpad, restaurando de memoria. Cada rotura, sobre los dos archivos juntos:
//  16. un saliente cuenta como contacto (sin el `from_me === false`) → 32 / 2: «un saliente… NO
//      mueve el último contacto» y «el caso que trajo el arreglo»
//  17. `!m.from_me` en vez de `=== false` (una fila sin la columna cuenta) → 33 / 1: «un saliente…»
//  18. el lector sin `.eq('from_me', false)`                         → 33 / 1: «el lector PAGINA…»
//  19. el texto vuelve a «sin contacto registrado»                    → 33 / 1: «el texto: quién…»
//  20. `mensaje` (lo que mira «espera respuesta») sólo con lo entrante → 33 / 1: «un saliente…»
// Restaurado: 34 / 0.
