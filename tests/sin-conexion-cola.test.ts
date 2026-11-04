// =============================================================================
// MaKo sin conexión, T2 (28/10/2026): escribir sin red, la cola y subirla con el OK de la persona
// =============================================================================
// El diseño: docs/diseno-mako-desktop-sin-conexion.md, punto 4. Lo que fija este archivo:
//   1. Lo que llega del navegador se revisa entero (`validarOperacion`): nada se adivina.
//   2. Campo por campo (`decidirCampo`): igual al «antes» se aplica, igual al «después» ya estaba, otro valor es conflicto.
//   3. Lo pendiente se dibuja ENCIMA de la copia (`conLoPendiente`) sin tocarla, y sólo lo del negocio de esa copia.
//   4. La cola cifrada por persona: en orden, otra cuenta no la lee, tiene tope, sobrevive a renovar la copia, y una copia
//      vencida con cambios sin subir NO se borra.
//   5. La subida (`subirCambio`, con un servidor de mentira): idempotente; un conflicto no se aplica sin «Aplicar el mío»;
//      lo que tiene consecuencias espera el OK; un rechazo suelta la reserva; un error a mitad la deja (nunca dos veces a
//      ciegas); otro negocio, mirando a otro o sin la tabla, no escribe nada.
//   6. Las puertas: la subida pasa por las del teléfono, nada se sube solo al volver, el cascarón sigue sin hablar con el
//      servidor.
//
// Probado rompiéndolo (28/10/2026): las roturas y lo que cada una tumbó están en docs/hallazgos-sin-conexion.md (T2).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conLoPendiente, decidirCampo, describir, sale, TOPE_COLA, validarOperacion, type Cambio, type Operacion, type Resultado } from '../lib/sin-conexion/cola';
import { subirCambio, RESERVA_PERDIDA_MS, type Deps, type Reserva } from '../lib/sin-conexion/subir';
import { abrir, activar, encolar, guardarCopia, idDeCambio, leerColaCon, type PedirLlave } from '../lib/sin-conexion/local';
import type { Almacen } from '../lib/sin-conexion/almacen';
import { importarLlave } from '../lib/sin-conexion/cifra';
import { VERSION_COPIA, type ColaGuardada, type CopiaGuardada, type CopiaV1, type LlaveGuardada } from '../lib/sin-conexion/reglas';
import { createHash } from 'node:crypto';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const op = (cambio: Cambio, extra: Partial<Operacion> = {}): Operacion => ({ id: idDeCambio(), ws: 9, hecha: '2026-10-28T15:00:00.000Z', cambio, ...extra });

// ── 1. Validar ───────────────────────────────────────────────────────────────

test('1. validarOperacion: lo válido pasa entero; lo raro, lo largo o lo que no cambia nada, no', () => {
  const nota = op({ tipo: 'nota', leadId: 12, texto: '  Llamar el jueves  ' });
  assert.deepEqual(validarOperacion(nota)?.cambio, { tipo: 'nota', leadId: 12, texto: 'Llamar el jueves' });
  assert.ok(validarOperacion(op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'contactado' })));
  assert.ok(validarOperacion(op({ tipo: 'contacto', leadId: 1, campo: 'email', antes: null, despues: 'a@b.com' })));
  assert.ok(validarOperacion(op({ tipo: 'tarea-estado', tareaId: 't_1', antes: 'por_hacer', despues: 'hecho' })));
  assert.ok(validarOperacion(op({ tipo: 'tarea-nueva', titulo: 'Subir las fotos' })));
  const malas: unknown[] = [
    null, 'x', {}, { ...nota, id: 'corto' }, { ...nota, ws: 0 }, { ...nota, hecha: 'ayer' },
    op({ tipo: 'nota', leadId: 12, texto: '   ' }),
    op({ tipo: 'nota', leadId: 12, texto: 'x'.repeat(4001) }),
    op({ tipo: 'nota', leadId: -1, texto: 'hola' }),
    op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'nuevo' }),
    op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: "x'; drop table" }),
    op({ tipo: 'contacto', leadId: 1, campo: 'workspace_id' as never, antes: null, despues: '2' }),
    op({ tipo: 'contacto', leadId: 1, campo: 'nombre', antes: 'Ana', despues: '  ' }),
    op({ tipo: 'tarea-nueva', titulo: 'x'.repeat(201) }),
    { ...nota, cambio: { tipo: 'borrar-todo' } },
  ];
  for (const m of malas) assert.equal(validarOperacion(m), null, JSON.stringify(m).slice(0, 80));
});

// ── 2. Campo por campo ───────────────────────────────────────────────────────

test('2. decidirCampo: antes → aplicar; después → ya estaba; otro → conflicto (el email sin mayúsculas, sin espacios)', () => {
  assert.equal(decidirCampo('nuevo', 'nuevo', 'contactado'), 'aplicar');
  assert.equal(decidirCampo('contactado', 'nuevo', 'contactado'), 'ya-estaba');
  assert.equal(decidirCampo('cerrado', 'nuevo', 'contactado'), 'conflicto');
  assert.equal(decidirCampo(' Ana@Mail.com ', 'ana@mail.com', 'otra@mail.com', 'email'), 'aplicar');
  assert.equal(decidirCampo('ANA@MAIL.COM', 'x@mail.com', 'ana@mail.com', 'email'), 'ya-estaba');
  assert.equal(decidirCampo('Ana', 'ana', 'Beto', 'nombre'), 'conflicto', 'en un nombre, la mayúscula cuenta');
  assert.equal(decidirCampo(null, '', 'Acme'), 'aplicar', 'vacío y nada son lo mismo');
  assert.equal(sale('aplicada') && sale('ya-estaba') && sale('borrador'), true);
  assert.equal(sale('conflicto') || sale('espera-ok') || sale('rechazada') || sale('incierta') || sale('reintentar'), false);
});

// ── 3. Lo pendiente encima de la copia ───────────────────────────────────────

const tarjeta = (id: number, col: string, nombre: string) => ({
  id, col, nombre, segunda: null, senal: { tono: null, texto: '', dice: null }, plata: null, canal: 'whatsapp', foto: null, telefono: null,
  soloInstagram: null, contacto: { email: `${nombre.toLowerCase()}@x.com`, empresa: null, origen: null, creado: null, reunion: null, monto: 0 },
});
const copiaBase = (): CopiaV1 => ({
  version: VERSION_COPIA, hecha: '2026-10-28T13:42:00.000Z', tz: 'America/Argentina/Buenos_Aires',
  negocio: { id: 9, nombre: 'Prueba' }, persona: { nombre: 'Ana' }, faltan: [],
  crm: {
    tableros: [{
      funnelId: null, funnels: [{ id: null, nombre: 'Ventas' }], proximo: null, campos: [],
      columnas: [
        { key: 'nuevo', titulo: 'Nuevo', total: null, cuantos: 2, movible: true, sale: true, camino: true },
        { key: 'contactado', titulo: 'Contactado', total: null, cuantos: 0, movible: true, sale: true, camino: true },
      ],
      tarjetas: [tarjeta(1, 'nuevo', 'Lucía'), tarjeta(2, 'nuevo', 'Diego')],
    }],
    notas: {},
  },
  plan: {
    fecha: '2026-10-28', recortado: false, prioridades: [], proyectos: [], recurrentes: [],
    columnas: [{ key: 'por_hacer', titulo: 'Por iniciar', cuantos: 1 }, { key: 'hecho', titulo: 'Completada', cuantos: 0 }],
    tareas: [{ id: 't1', titulo: 'Llamar', proyecto: null, deadline: null, cuando: 'hoy', banda: 'alta', esInstancia: false, vencida: false, linkEscritorio: '/plan', estado: 'por_hacer', col: 'por_hacer', prioridad: 'alta', motivo: null }],
  },
});

test('3. conLoPendiente: lo escrito se ve encima, la copia no se toca, y lo de otro negocio no entra', () => {
  const base = copiaBase();
  const foto = JSON.stringify(base);
  const ops = [
    op({ tipo: 'nota', leadId: 1, texto: 'Quiere ver el depto' }),
    op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'contactado' }),
    op({ tipo: 'contacto', leadId: 2, campo: 'nombre', antes: 'Diego', despues: 'Diego Pérez' }),
    op({ tipo: 'tarea-estado', tareaId: 't1', antes: 'por_hacer', despues: 'hecho' }),
    op({ tipo: 'tarea-nueva', titulo: 'Subir fotos' }),
    op({ tipo: 'nota', leadId: 2, texto: 'de otro negocio' }, { ws: 10 }),
  ];
  const { copia, pendientes } = conLoPendiente(base, ops);
  assert.equal(JSON.stringify(base), foto, 'la copia guardada no cambia');
  const t = copia.crm!.tableros[0];
  assert.equal(t.tarjetas.find((x) => x.id === 1)!.col, 'contactado');
  assert.deepEqual(t.columnas.map((c) => c.cuantos), [1, 1]);
  assert.equal(t.tarjetas.find((x) => x.id === 2)!.nombre, 'Diego Pérez');
  assert.deepEqual(copia.crm!.notas['1'][0], { texto: 'Quiere ver el depto', cuando: ops[0].hecha, autor: 'Ana', pendiente: true });
  assert.equal(copia.crm!.notas['2'], undefined, 'la nota de otro negocio no aparece');
  assert.equal(copia.plan!.tareas.find((x) => x.id === 't1')!.col, 'hecho');
  const nueva = copia.plan!.tareas.find((x) => x.id === ops[4].id)!;
  assert.equal(nueva.col, 'por_hacer');
  assert.match(nueva.motivo ?? '', /Borrador/);
  assert.deepEqual(copia.plan!.columnas.map((c) => c.cuantos), [1, 1]);
  assert.deepEqual([...pendientes.leads].sort(), [1, 2]);
  assert.ok(pendientes.tareas.has('t1') && pendientes.tareas.has(ops[4].id));
  // A una columna que el tablero no tiene no se mueve (la copia es la verdad de lo que hay).
  const rara = conLoPendiente(base, [op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'ganado' })]);
  assert.equal(rara.copia.crm!.tableros[0].tarjetas[0].col, 'nuevo');
  assert.match(describir(ops[1], copia), /Lucía: de «Nuevo» a «Contactado»/);
  assert.match(describir(ops[4]), /borrador/);
});

// ── 4. La cola cifrada ───────────────────────────────────────────────────────

function memoria(): Almacen & { cola: () => ColaGuardada[] } {
  let llave: LlaveGuardada | null = null;
  const copias = new Map<number, CopiaGuardada>();
  const cola = new Map<string, ColaGuardada>();
  return {
    leerLlave: async () => llave, guardarLlave: async (l) => { llave = l; },
    leerCopias: async () => [...copias.values()], guardarCopia: async (c) => { copias.set(c.ws, c); },
    leerCola: async () => [...cola.values()], guardarEnCola: async (c) => { cola.set(c.id, c); }, sacarDeCola: async (id) => { cola.delete(id); },
    borrar: async () => { llave = null; copias.clear(); cola.clear(); },
    cola: () => [...cola.values()],
  };
}
const servidor = (persona: string): PedirLlave => async (d) => ({ ok: true, llave: new Uint8Array(createHash('sha256').update(`${persona}|${d}`).digest()) });
const V = 1_000;

test('4. la cola: cifrada, en orden, sólo de su persona, con tope; renovar la copia no la toca; vencida con cambios no se borra', async () => {
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-larga', almacen: m, pedirLlave: servidor('ana'), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => copiaBase() });
  const r = await abrir({ email: 'ana@x.com', clave: 'clave-larga', almacen: m });
  assert.ok(r.ok);
  const ops = [op({ tipo: 'nota', leadId: 1, texto: 'primera' }), op({ tipo: 'tarea-nueva', titulo: 'segunda' }), op({ tipo: 'nota', leadId: 2, texto: 'tercera' })];
  for (const o of ops) assert.equal(await encolar({ email: 'ana@x.com', llave: r.llave, almacen: m, op: o }), true);
  assert.ok(!JSON.stringify(m.cola()).includes('primera'), 'la cola va cifrada');
  assert.deepEqual((await leerColaCon({ email: 'ana@x.com', llave: r.llave, almacen: m })).map((o) => o.id), ops.map((o) => o.id), 'en el orden en que se escribió');
  // Otra persona (otro AAD), aunque tuviera la misma llave, no la lee.
  assert.deepEqual(await leerColaCon({ email: 'beto@x.com', llave: r.llave, almacen: m }), []);
  // Renovar la copia con conexión no toca la cola.
  await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => copiaBase() });
  const r2 = await abrir({ email: 'ana@x.com', clave: 'clave-larga', almacen: m });
  assert.ok(r2.ok && r2.cola.length === 3);
  // Vencida, pero con cambios sin subir: no se borra.
  const r3 = await abrir({ email: 'ana@x.com', clave: 'clave-larga', almacen: m, ahora: Date.now() + 40 * 86_400_000 });
  assert.ok(r3.ok, 'con cambios sin subir, lo guardado no se borra aunque venza');
  // Y la copia de ese negocio tampoco vence por su fecha (verificación de 90d6410eb: cada copia vence por la suya): sin ella
  // no se puede nombrar ni revisar lo que la persona escribió.
  assert.equal(r3.ok && r3.copias.length, 1, 'la copia del negocio con cambios sin subir sigue');
  // El tope.
  const lleno = memoria();
  for (let i = 0; i < TOPE_COLA; i++) await lleno.guardarEnCola({ id: `x${String(i).padStart(9, '0')}`, ws: 9, seq: i, iv: '', datos: '' });
  assert.equal(await encolar({ email: 'ana@x.com', llave: await importarLlave(new Uint8Array(32)), almacen: lleno, op: op({ tipo: 'nota', leadId: 1, texto: 'una más' }) }), false);
});

// ── 5. La subida ─────────────────────────────────────────────────────────────

type Registro = { escrituras: string[]; reservas: Map<string, Reserva>; soltadas: string[] };

function deps(over: Partial<Deps> = {}, estado: { etapa?: string; email?: string | null; col?: string } = {}): Deps & { r: Registro } {
  const r: Registro = { escrituras: [], reservas: new Map(), soltadas: [] };
  const hecho = (q: string) => async () => { r.escrituras.push(q); return { ok: true as const }; };
  const d: Deps = {
    ws: 9, impersonando: false,
    leerReserva: async (id) => r.reservas.get(id) ?? null,
    reservar: async (o) => { if (r.reservas.has(o.id)) return 'ya'; r.reservas.set(o.id, { estado: 'en-curso', resultado: null, creado: new Date().toISOString() }); return 'ok'; },
    finalizar: async (id, res) => { r.reservas.set(id, { estado: 'final', resultado: res, creado: new Date().toISOString() }); },
    soltar: async (id) => { r.soltadas.push(id); r.reservas.delete(id); },
    etapaActual: async () => ({ ok: true, etapa: estado.etapa ?? 'nuevo', rotulo: (k) => k.toUpperCase() }),
    consecuenciaDeEtapa: async () => null,
    moverEtapa: hecho('etapa'), nota: hecho('nota'),
    contactoActual: async () => ({ ok: true, valor: estado.email === undefined ? 'viejo@x.com' : estado.email }),
    guardarContacto: hecho('contacto'),
    columnaDeTarea: async () => ({ ok: true, col: estado.col ?? 'por_hacer', rotulo: (k) => k }),
    moverTarea: hecho('tarea'),
    borrador: async (_t, ref) => { r.escrituras.push(`borrador ${ref}`); return { ok: true, link: '/plan/revisar/p1' }; },
    ahora: () => Date.now(),
    ...over,
  };
  return Object.assign(d, { r });
}

test('5a. idempotente: el mismo cambio dos veces se aplica UNA; «ya estaba» también se guarda', async () => {
  const d = deps();
  const o = op({ tipo: 'nota', leadId: 1, texto: 'hola' });
  assert.deepEqual(await subirCambio(o, {}, d), { estado: 'aplicada' });
  assert.deepEqual(await subirCambio(o, {}, d), { estado: 'aplicada' });
  assert.deepEqual(d.r.escrituras, ['nota'], 'la segunda vez no escribe');
  const ya = op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'contactado' });
  const d2 = deps({}, { etapa: 'contactado' });
  assert.equal((await subirCambio(ya, {}, d2)).estado, 'ya-estaba');
  assert.deepEqual(d2.r.escrituras, []);
  assert.equal(d2.r.reservas.get(ya.id)?.estado, 'final');
});

test('5b. conflicto: otro valor en el servidor no se pisa; «Aplicar el mío» (forzar) sí', async () => {
  const o = op({ tipo: 'contacto', leadId: 1, campo: 'email', antes: 'viejo@x.com', despues: 'nuevo@x.com' });
  const d = deps({}, { email: 'otro@x.com' });
  const r = await subirCambio(o, {}, d);
  assert.equal(r.estado, 'conflicto');
  assert.equal(r.servidor, 'otro@x.com');
  assert.deepEqual(d.r.escrituras, [], 'no escribió');
  assert.equal(d.r.reservas.size, 0, 'un conflicto no queda guardado: la persona decide');
  assert.equal((await subirCambio(o, { forzar: true }, d)).estado, 'aplicada');
  assert.deepEqual(d.r.escrituras, ['contacto']);
  const t = op({ tipo: 'tarea-estado', tareaId: 't1', antes: 'por_hacer', despues: 'hecho' });
  assert.equal((await subirCambio(t, {}, deps({}, { col: 'en_curso' }))).estado, 'conflicto');
  const e = op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'contactado' });
  const re = await subirCambio(e, {}, deps({}, { etapa: 'cerrado' }));
  assert.equal(re.estado, 'conflicto');
  assert.equal(re.servidor, 'CERRADO', 'dice dónde quedó, con el nombre de la etapa');
});

test('5c. lo que tiene consecuencias espera el OK de la persona; con el OK, sale', async () => {
  const o = op({ tipo: 'etapa', leadId: 1, funnelId: null, antes: 'nuevo', despues: 'llamada' });
  const d = deps({ consecuenciaDeEtapa: async () => 'Al entrar a esa etapa arranca «Seguimiento», que le escribe al lead.' });
  const r = await subirCambio(o, {}, d);
  assert.equal(r.estado, 'espera-ok');
  assert.match(r.motivo ?? '', /Seguimiento/);
  assert.deepEqual(d.r.escrituras, []);
  assert.equal(d.r.reservas.size, 0);
  assert.equal((await subirCambio(o, { ok: true }, d)).estado, 'aplicada');
  assert.deepEqual(d.r.escrituras, ['etapa']);
});

test('5d. un rechazo de la puerta suelta la reserva; un error a mitad la deja «en-curso» y después es «incierta»', async () => {
  const o = op({ tipo: 'nota', leadId: 1, texto: 'hola' });
  const d = deps({ nota: async () => ({ ok: false, motivo: 'Ese lead no está' }) });
  const r = await subirCambio(o, {}, d);
  assert.deepEqual(r, { estado: 'rechazada', motivo: 'Ese lead no está' });
  assert.deepEqual(d.r.soltadas, [o.id], 'se puede reintentar');
  assert.equal(d.r.reservas.size, 0);

  let ahora = Date.now();
  const tira = deps({ nota: async () => { throw new Error('se cayó la base'); }, ahora: () => ahora });
  await assert.rejects(subirCambio(o, {}, tira), /se cayó/);
  assert.equal(tira.r.reservas.get(o.id)?.estado, 'en-curso', 'no se sabe si quedó: la reserva se queda');
  assert.deepEqual(tira.r.soltadas, []);
  assert.equal((await subirCambio(o, {}, tira)).estado, 'reintentar', 'recién: otra ventana podría estar subiéndolo');
  // Con margen: la reserva se crea con el reloj de verdad DESPUÉS de leer `ahora`, y con la PC cargada esos milisegundos
  // dejaban la edad apenas por debajo del tope (el test fallaba sólo bajo carga, medido el 28/10/2026 con las roturas).
  ahora += RESERVA_PERDIDA_MS + 60_000;
  assert.equal((await subirCambio(o, {}, tira)).estado, 'incierta', 'nunca un segundo intento a ciegas');
  const vuelve = deps({ ahora: () => ahora });
  vuelve.r.reservas.set(o.id, tira.r.reservas.get(o.id)!);
  assert.equal((await subirCambio(o, { forzar: true }, vuelve)).estado, 'aplicada', '«Subirlo igual» es decisión de la persona');
});

test('5e. otro negocio, mirando a otro, sin la tabla o con otra ventana subiéndolo: no escribe nada', async () => {
  const o = op({ tipo: 'nota', leadId: 1, texto: 'hola' });
  for (const [nombre, d, esperado] of [
    ['otro negocio', deps({ ws: 10 }), 'rechazada'],
    ['sin negocio', deps({ ws: null }), 'rechazada'],
    ['mirando a otro', deps({ impersonando: true }), 'rechazada'],
    ['sin la tabla (leer)', deps({ leerReserva: async () => 'sin-tabla' }), 'reintentar'],
    ['sin la tabla (reservar)', deps({ reservar: async () => 'sin-tabla' }), 'reintentar'],
    ['otra ventana primero', deps({ reservar: async () => 'ya' }), 'reintentar'],
  ] as Array<[string, Deps & { r: Registro }, Resultado['estado']]>) {
    assert.equal((await subirCambio(o, {}, d)).estado, esperado, nombre);
    assert.deepEqual(d.r.escrituras, [], `${nombre}: escribió`);
  }
});

test('5f. una tarea nueva queda como BORRADOR con su ref (repetirla no crea otro)', async () => {
  const o = op({ tipo: 'tarea-nueva', titulo: 'Subir las fotos' });
  const d = deps();
  assert.deepEqual(await subirCambio(o, {}, d), { estado: 'borrador', link: '/plan/revisar/p1' });
  assert.deepEqual(d.r.escrituras, [`borrador sin-conexion:${o.id}`]);
  await subirCambio(o, {}, d);
  assert.equal(d.r.escrituras.length, 1);
});

// ── 6. Las puertas ───────────────────────────────────────────────────────────

test('6. la subida usa las puertas del teléfono; nada sube solo al volver; el cascarón sigue sin hablar con el servidor', () => {
  const acc = sinComentarios(leer('app/_sin-conexion/acciones.ts'));
  assert.match(acc, /^'use server';/);
  for (const puerta of ['moverEtapaAction(leadId, funnelId, etapa)', 'notaLeadAction(leadId, texto)', 'moverTareaAction(tareaId, col)', 'saveLeadMetaAction(leadId,']) {
    assert.ok(acc.includes(puerta), `falta la puerta ${puerta}`);
  }
  assert.match(acc, /crearPropuesta\(\{ tareas: \[\{ titulo \}\], resumen: 'Tarea escrita sin conexión', origen: 'sin-conexion', ref \}\)/);
  assert.match(acc, /\.eq\('usuario_id', u\.id\)/, 'la reserva se lee con la persona');
  // La etapa de hoy se cuenta IGUAL que el teléfono (si cambia allá, cambia acá).
  const tel = sinComentarios(leer('app/m/crm/acciones.ts'));
  const cuenta = /const cruda = prod\.esCasa\s*\? \(etapaCasa && keys\.includes\(etapaCasa\) \? etapaCasa : etapaVigenteDe\(lead, comoLite\(stages\)\)\)\s*: \(prod\.etapa \?\? ''\);/;
  assert.match(tel, cuenta);
  assert.match(acc, cuenta);
  // Revisar no escribe nada.
  const revisar = acc.slice(acc.indexOf('export async function revisarCambiosAction'), acc.indexOf('export async function subirCambioAction'));
  assert.doesNotMatch(revisar, /moverEtapaAction|notaLeadAction|moverTareaAction|saveLeadMetaAction|crearPropuesta|reservar/);

  // El panel: subir sólo desde un clic. Ningún efecto (al montar, al volver la red) llama a la subida.
  const panel = sinComentarios(leer('app/_components/SubirCambios.tsx'));
  const efecto = panel.slice(panel.indexOf('useEffect('), panel.indexOf('}, [contar]);'));
  assert.doesNotMatch(efecto, /subir|mandar|revisar/i);
  assert.equal([...panel.matchAll(/subirCambioAction\(/g)].length, 1, 'un solo lugar sube');
  assert.match(panel, /onClick=\{\(\) => void subir\(\)\}/);
  assert.match(panel, /aprobado: !consecuencia/, 'lo que tiene consecuencias empieza SIN marcar');
  assert.match(panel, /if \(it\.consecuencia && !it\.aprobado\)/, 'sin marcar, no se manda');

  const app = leer('public/sin-conexion/app.js');
  assert.doesNotMatch(app, /\bfetch\(|XMLHttpRequest|sendBeacon/, 'el cascarón no le habla al servidor: escribe sólo en la cola');
  assert.match(app, /Se sube al volver/);
  assert.match(leer('supabase/migrations/0346_sin_conexion_aplicadas.sql'), /id\s+text primary key/);
});
