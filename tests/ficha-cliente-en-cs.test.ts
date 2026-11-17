// =============================================================================
// El bloque «Cliente en CS» de la tab Pagos: lo que dibuja (lib/cliente-en-cs.ts, `vistaClienteEnCs`)
// =============================================================================
// El bloque estaba en el catálogo y en las plantillas sin componente (docs/diseno-ficha-bloques.md, fila `cliente-en-cs`).
// Lo que se fija aquí, EJECUTANDO la función pura con lecturas armadas a mano (sin base, sin React):
//   · un activo con etapa y desde: la etapa por su RÓTULO y «entró hace N días»; el % visto honesto;
//   · sin fila en `cliente_entrega` está en la PRIMERA etapa, sin reloj (no se inventa un «entró hace»);
//   · de baja con cuotas que la cobranza le sigue recordando → el aviso, con cuántas y cuánto. La baja de Customer
//     Success no corta la cobranza (`getCuotasPendientes` no mira `cs_clientes.estado`);
//   · de baja sin cuotas vivas (pagadas, o dadas de baja / devueltas: sin vencimiento) → sin aviso; y un activo con
//     cuotas impagas tampoco avisa;
//   · el acceso que NO SE PUDO LEER no es «sin acceso»;
//   · sin entrega: ningún renglón de entrega y, si no hay nada más que decir, null; un video «sin medir» no es 0%.
//
// Correr: node --import tsx --test tests/ficha-cliente-en-cs.test.ts
//
// Probado rompiéndolo (17/11/2026), una regla por vez sobre lib/cliente-en-cs.ts, restaurada después de cada una
// (base: 12 pasan / 0 fallan; cada rotura dio 11 / 1, con el caso de su regla):
//   · `cuotasQueSeSiguenCobrando` sin `&& !!q.fecha_esperada` (cuenta las dadas de baja y las devueltas)
//     → cae «de baja sin cuotas vivas: sin aviso».
//   · el aviso sin mirar el estado (`if (st.ok)` en vez de `… === 'baja'`) → cae «un activo con cuotas impagas no avisa».
//   · el acceso no leído dibujado como «Sin acceso todavía» → cae «el acceso que no se pudo leer no es «sin acceso»».
//   · sin fila en `cliente_entrega`, con el reloj de `etapaDesde` igual → cae «sin fila está en la primera etapa, sin reloj».
//   · `pctVisto ?? 0` (un video sin medir como 0%) → cae «un video sin medir no es 0%».
//   · sin el `return null` de «nada que decir» → cae «sin entrega: ningún renglón de entrega; con nada más que decir, null».
//   · sin el `return null` de un lead que no es ganado → cae «no es ganado, o la cuenta no tiene Clients: null».
//   · la etapa por su CLAVE en vez de su rótulo (`texto: guardada`) → cae «un activo con etapa y desde…».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cuotasQueSeSiguenCobrando, hrefClienteEnCs, sinClienteEnCs, vistaClienteEnCs,
  type ClienteEnCsLeido, type CuotaParaAviso, type EntregaLeida,
} from '../lib/cliente-en-cs';

const HOY = '2026-11-17';
const AHORA = Date.parse('2026-11-17T15:00:00Z');
const D = 86_400_000;
const hace = (dias: number) => new Date(AHORA - dias * D).toISOString();

const ETAPAS = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'arranque', label: 'Arranque' },
  { key: 'hito1', label: 'Hito 1' },
];

const entrega = (x: Partial<EntregaLeida> = {}): EntregaLeida => ({
  productoId: 7, producto: 'Programa', etapaGuardada: 'arranque', etapaDesde: hace(3), etapas: ETAPAS,
  curso: { ok: true, dato: null }, ...x,
});

/** Un cliente ganado, en el programa, todo leído y vacío; cada caso cambia lo suyo. */
const leido = (x: Partial<ClienteEnCsLeido> = {}): ClienteEnCsLeido => ({
  leadId: 42, ganado: true, conClients: true,
  estado: { ok: true, dato: { estado: 'activo', motivo: null, desde: null } },
  entregas: { ok: true, dato: [entrega()] },
  acceso: { ok: true, dato: null },
  cuenta: { ok: true, dato: { clienteWs: null, altas: [] } },
  ...x,
});

const vista = (l: ClienteEnCsLeido, cuotas: CuotaParaAviso[] = [], esSuscripcion = false) =>
  vistaClienteEnCs({ leido: l, cuotas, esSuscripcion, hoy: HOY, ahora: AHORA });

const BAJA = { ok: true as const, dato: { estado: 'baja' as const, motivo: 'Se mudó', desde: '2026-11-04T10:00:00Z' } };
const parte = (v: NonNullable<ReturnType<typeof vista>>, p: string) => v.renglones.filter((r) => r.parte === p);

test('un activo con etapa y desde: la etapa por su rótulo y «entró hace N días»', () => {
  const v = vista(leido({
    entregas: { ok: true, dato: [entrega({ curso: { ok: true, dato: { pctVisto: 40, videosSinMedir: 0, tareasEnviadas: 2, tareas: 5, etapaCompleta: false } } })] },
  }));
  assert.ok(v);
  assert.deepEqual(v.estado, { texto: 'En el programa', tono: 'verde' });
  const [e] = parte(v, 'entrega');
  assert.equal(e.texto, 'Arranque', 'el rótulo, nunca la clave «arranque»');
  assert.equal(e.detalle, 'entró hace 3 días');
  assert.equal(e.tono, 'gris');
  const [c] = parte(v, 'curso');
  assert.equal(c.texto, '40% visto · 2 de 5 tareas');
  // Los chips del diseño «chips»: «Arranque · entró hace 3 días · 40%», sin el estado (va a la derecha del título).
  assert.deepEqual(v.chips.map((x) => x.texto), ['Arranque · entró hace 3 días', '40% visto · 2 de 5 tareas', 'Sin acceso al curso']);
  assert.equal(v.aviso, null);
  assert.equal(v.href, '/classroom/clients?cliente=42');
  assert.equal(v.titular.texto, 'Arranque');
});

test('trabado (21 días o más en la etapa): en ámbar, como el kanban', () => {
  const v = vista(leido({ entregas: { ok: true, dato: [entrega({ etapaDesde: hace(25) })] } }));
  assert.equal(parte(v!, 'entrega')[0].tono, 'ambar');
});

test('sin fila está en la primera etapa, sin reloj', () => {
  const v = vista(leido({ entregas: { ok: true, dato: [entrega({ etapaGuardada: null, etapaDesde: hace(10) })] } }));
  const [e] = parte(v!, 'entrega');
  assert.equal(e.texto, 'Onboarding');
  assert.equal(e.detalle, 'Sin movimientos todavía', 'sin fila el reloj no arrancó: nada de «entró hace»');
  // Una fila con una etapa borrada no cae en la primera: se dice.
  const h = vista(leido({ entregas: { ok: true, dato: [entrega({ etapaGuardada: 'hito9' })] } }));
  assert.equal(parte(h!, 'entrega')[0].texto, 'Su etapa ya no existe');
  // Y sin las etapas del producto no se muestra la clave suelta.
  const n = vista(leido({ entregas: { ok: true, dato: [entrega({ etapas: null })] } }));
  assert.equal(parte(n!, 'entrega')[0].texto, 'No se pudo leer la etapa');
  assert.ok(n!.noLeido.includes('la etapa'));
});

test('de baja con cuotas impagas: avisa que se le siguen cobrando', () => {
  const cuotas: CuotaParaAviso[] = [
    { pagado: true, fecha_esperada: '2026-10-01', monto_usd: 500 },
    { pagado: false, fecha_esperada: '2026-11-01', monto_usd: 400 },
    { pagado: false, fecha_esperada: '2026-12-01', monto_usd: '400' },
  ];
  const v = vista(leido({ estado: BAJA }), cuotas);
  assert.ok(v);
  assert.deepEqual(v.estado, { texto: 'Se dio de baja', tono: 'rojo' });
  assert.match(v.aviso ?? '', /se le siguen cobrando 2 cuotas \(\$800\)/);
  assert.match(v.aviso ?? '', /«Baja del cliente» en Cuotas/);
  assert.equal(parte(v, 'estado')[0].detalle, 'desde el 4 de noviembre · Se mudó');
  // En una suscripción no hay «Baja del cliente»: se cancela.
  assert.match(vista(leido({ estado: BAJA }), cuotas, true)?.aviso ?? '', /cancela la suscripción/);
});

test('de baja sin cuotas vivas: sin aviso', () => {
  // Pagada, dada de baja en Cuotas (impaga y sin vencimiento) o devuelta (igual): la cobranza no las ve.
  const cuotas: CuotaParaAviso[] = [
    { pagado: true, fecha_esperada: '2026-10-01', monto_usd: 500 },
    { pagado: false, fecha_esperada: null, monto_usd: 400 },
  ];
  assert.deepEqual(cuotasQueSeSiguenCobrando(cuotas), []);
  const v = vista(leido({ estado: BAJA }), cuotas);
  assert.ok(v, 'de baja hay algo que decir aunque no haya aviso');
  assert.equal(v.aviso, null);
});

test('un activo con cuotas impagas no avisa (sólo la baja)', () => {
  const v = vista(leido(), [{ pagado: false, fecha_esperada: '2026-11-01', monto_usd: 400 }]);
  assert.equal(v?.aviso, null);
});

test('el acceso que no se pudo leer no es «sin acceso»', () => {
  const conCurso = { ok: true as const, dato: [entrega({ curso: { ok: true, dato: { pctVisto: 10, videosSinMedir: 0, tareasEnviadas: 0, tareas: 3, etapaCompleta: false } } })] };
  const noLeido = vista(leido({ entregas: conCurso, acceso: { ok: false } }))!;
  const sinAcceso = vista(leido({ entregas: conCurso, acceso: { ok: true, dato: null } }))!;
  const [a] = parte(noLeido, 'acceso');
  const [b] = parte(sinAcceso, 'acceso');
  assert.equal(a.texto, 'No se pudo leer');
  assert.equal(b.texto, 'Sin acceso todavía');
  assert.notEqual(a.texto, b.texto);
  assert.equal(noLeido.pasos.find((p) => p.clave === 'acceso')?.hecho, 'no-se');
  assert.equal(sinAcceso.pasos.find((p) => p.clave === 'acceso')?.hecho, 'no');
  assert.ok(noLeido.noLeido.includes('el acceso al curso'));
  // Con acceso y entradas: cuántas veces y la última.
  const entro = vista(leido({ entregas: conCurso, acceso: { ok: true, dato: { revocado: false, ingresos: 3, ultimoIngresoAt: '2026-11-15T12:00:00Z', invitacionEnviadaAt: null, linkEnviadoAt: null } } }))!;
  assert.equal(parte(entro, 'acceso')[0].texto, 'Entró 3 veces');
  assert.equal(parte(entro, 'acceso')[0].detalle, 'la última, el 15 de noviembre');
});

test('un video sin medir no es 0%', () => {
  const v = vista(leido({ entregas: { ok: true, dato: [entrega({ curso: { ok: true, dato: { pctVisto: null, videosSinMedir: 2, tareasEnviadas: 0, tareas: 0, etapaCompleta: false } } })] } }))!;
  const [c] = parte(v, 'curso');
  assert.equal(c.texto, 'Videos sin medir');
  assert.doesNotMatch(c.texto, /0%/);
  // El avance que no se pudo leer tampoco es 0%.
  const n = vista(leido({ entregas: { ok: true, dato: [entrega({ curso: { ok: false } })] } }))!;
  assert.equal(parte(n, 'curso')[0].texto, 'No se pudo leer el avance');
});

test('sin entrega: ningún renglón de entrega; con nada más que decir, null', () => {
  const sinNada = leido({ entregas: { ok: true, dato: [] } });
  assert.equal(vista(sinNada), null, 'en el programa, sin entrega, sin acceso ni cuenta: el bloque se calla');
  // De baja sin entrega sí dice algo, y no inventa una etapa.
  const v = vista(leido({ estado: BAJA, entregas: { ok: true, dato: [] } }))!;
  assert.equal(parte(v, 'entrega').length, 0);
  assert.equal(v.pasos.find((p) => p.clave === 'entrega')?.hecho, 'no');
  // Y la entrega que no se pudo leer no es «sin entrega».
  const n = vista(leido({ entregas: { ok: false } }))!;
  assert.equal(parte(n, 'entrega')[0].texto, 'No se pudo leer');
  assert.equal(n.pasos.find((p) => p.clave === 'entrega')?.hecho, 'no-se');
});

test('no es ganado, o la cuenta no tiene Clients: null', () => {
  assert.equal(vista(leido({ ganado: false })), null);
  assert.equal(vista(leido({ conClients: false })), null);
  assert.equal(sinClienteEnCs({ estado_lead: 'en_proceso' }), true);
  assert.equal(sinClienteEnCs({ estado_lead: 'ganado' }), false);
  assert.equal(hrefClienteEnCs(5), '/classroom/clients?cliente=5');
});

test('la cuenta de MaKo: sólo si aplica, y el alta que cuenta es la más avanzada', () => {
  assert.equal(parte(vista(leido())!, 'cuenta').length, 0, 'sin plan de MaKo ni cuenta abierta no hay renglón');
  const hecha = vista(leido({
    cuenta: { ok: true, dato: { clienteWs: 88, altas: [
      { estado: 'error', motivo: 'Falta el email de quien pagó.', creadoAt: '2026-11-10T00:00:00Z' },
      { estado: 'hecha', motivo: 'El mail de acceso no salió: Resend caído', creadoAt: '2026-11-01T00:00:00Z' },
    ] } },
  }))!;
  const [c] = parte(hecha, 'cuenta');
  assert.equal(c.texto, 'Creada');
  assert.equal(c.tono, 'ambar', 'con el mail de acceso caído, en ámbar');
  assert.match(c.detalle ?? '', /no salió/);
  const noLeida = vista(leido({ cuenta: { ok: false } }))!;
  assert.equal(parte(noLeida, 'cuenta')[0].texto, 'No se pudo leer');
});

test('el checklist cuenta los pasos hechos y separa «no se pudo leer»', () => {
  const v = vista(leido({
    entregas: { ok: true, dato: [entrega({ curso: { ok: true, dato: { pctVisto: 0, videosSinMedir: 0, tareasEnviadas: 0, tareas: 1, etapaCompleta: false } } })] },
    acceso: { ok: true, dato: { revocado: false, ingresos: 0, ultimoIngresoAt: null, invitacionEnviadaAt: '2026-11-16T09:00:00Z', linkEnviadoAt: null } },
  }))!;
  assert.deepEqual(v.pasos.map((p) => [p.clave, p.hecho]), [['estado', 'si'], ['entrega', 'si'], ['acceso', 'si']]);
  assert.equal(v.listos, 3);
  assert.equal(parte(v, 'acceso')[0].detalle, 'Invitación enviada el 16 de noviembre');
});
