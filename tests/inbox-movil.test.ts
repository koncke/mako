// =============================================================================
// inbox-movil — el «Para decidir» del teléfono: quién ve qué, qué se confirma ahí y qué no
// =============================================================================
// Lo puro de lib/inbox-movil-reglas.ts EJECUTADO, más cuatro guards de cableado sobre el
// fuente (la extracción de lib/bandeja-filas.ts, las acciones de app/m/inbox, el descarte
// de contactos y la voz neutra de lo que se dibuja).
//
// Verificado ROMPIÉNDOLO (11/10/2026), de a una y restaurando de memoria, con la base en
// 19 pases / 0 fallos:
//   · `tiposVisibles` sin el `rol === 'admin'` de pendiente/accion → 2 fallos (el closer
//     recibía las acciones de MaKo del admin).
//   · `complejidadDe` mirando sólo 'object' (sin 'object[]') → 1 fallo.
//   · `sumarConteos` sumando `n ?? 0` → 1 fallo (un badge en 0 sobre una lectura caída).
//   · `lineasDelPayload` sin el filtro de ids → 1 fallo.
//   · `opcionesDeConfirmacion` sin el `if (!c.aplicado) return ops` → 1 fallo.
//   · devolviendo `function plano` local a app/mako/revisar/[id]/page.tsx → 1 fallo.
//   · sacando `noPuede(` de `resolverConfirmacionMovil` → 1 fallo.
//   · sacando el `prop.tipo !== 'lead'` de `descartarLeadsAction` → 1 fallo.
//   · el error «Revísala en la computadora» escrito «Revisala acá» → 1 fallo (voseo).
// Y en la integración v2 (11/10/2026, base 20 / 0, scratchpad/integ/romper.py):
//   · `lineasDelPayload` cortando otra vez el texto aprobado en 160 → 19 / 1.
//   · `detalleDeBorrador` con las tareas de otra persona de la reunión → 19 / 1.
//   · `detalleDeLeads` sin la forma del contacto suelto de WhatsApp → 19 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  complejidadDe, decisionValida, detalleDeBorrador, detalleDeLeads, esParametroComplejo, etiquetaDeOrigen, idDePropuesta, idNumerico,
  lineasDeCambios, lineasDelPayload, opcionesDeConfirmacion, ordenarItems, resumenDeBorrador, sumarConteos,
  tiposVisibles, tituloDeBorrador, TIPOS_DECISION, NOMBRE_TIPO, type TipoDecision,
} from '../lib/inbox-movil-reglas';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función exportada, hasta el próximo `export` (o el final). */
const cuerpoDe = (src: string, firma: string): string => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\nexport ', ini + firma.length);
  return src.slice(ini, fin < 0 ? undefined : fin);
};

// ── Quién ve qué ─────────────────────────────────────────────────────────────

test('el admin de un negocio completo ve las cinco bandejas, en el orden de la lista', () => {
  assert.deepEqual(tiposVisibles('admin', 'completo'), [...TIPOS_DECISION]);
});

test('un closer o un setter NO reciben las acciones de MaKo del admin', () => {
  for (const rol of ['closer', 'setter'] as const) {
    const ve = tiposVisibles(rol, 'completo');
    assert.ok(!ve.includes('pendiente') && !ve.includes('accion'), `${rol}: ${ve.join(',')}`);
    assert.deepEqual(ve, ['confirmacion', 'lead', 'borrador'], `${rol} decide lo del CRM y del Plan`);
  }
});

test('la capa manda: sin CRM no hay contactos ni cambios del CRM, sin rol no hay nada', () => {
  // pm: Plan y MaKo, sin CRM.
  assert.deepEqual(tiposVisibles('admin', 'pm'), ['pendiente', 'accion', 'borrador']);
  // superadmin (ws9): su barra lateral no tiene CRM, pero `tabEnCapa` une los dos menús y
  // el de la foto es `null` (ve todo): /crm le abre igual (requireCapa), así que lo decide.
  assert.deepEqual(tiposVisibles('admin', 'superadmin'), [...TIPOS_DECISION]);
  assert.deepEqual(tiposVisibles('closer', 'pm'), ['borrador']);
  assert.deepEqual(tiposVisibles(null, 'completo'), []);
});

test('cada bandeja tiene su nombre para la pantalla', () => {
  for (const t of TIPOS_DECISION) assert.ok(NOMBRE_TIPO[t]?.trim(), t);
});

// ── Acción simple o compleja ─────────────────────────────────────────────────

test('una acción con algún parámetro object u object[] se revisa en la computadora', () => {
  assert.equal(esParametroComplejo({ tipo: 'object' }), true);
  assert.equal(esParametroComplejo({ tipo: 'object[]' }), true);
  assert.equal(esParametroComplejo({ tipo: 'string[]' }), false);
  assert.equal(complejidadDe([]), 'simple');
  assert.equal(complejidadDe([{ tipo: 'string' }, { tipo: 'number' }, { tipo: 'boolean' }, { tipo: 'string[]' }]), 'simple');
  assert.equal(complejidadDe([{ tipo: 'string' }, { tipo: 'object[]' }]), 'compleja');
  assert.equal(complejidadDe([{ tipo: 'object' }]), 'compleja');
  // Una operación que ya no existe en MaKo no se confirma en ningún lado.
  assert.equal(complejidadDe(null), 'compleja');
});

// ── Lo que se ejecuta, legible ───────────────────────────────────────────────

test('lineasDelPayload: en el orden de los parámetros, con su rótulo, sin vacíos ni ids', () => {
  const params = [
    { nombre: 'leadId' }, { nombre: 'etapa', rotulo: 'Etapa' }, { nombre: 'motivo' }, { nombre: 'avisar' },
    { nombre: 'etiquetas' },
  ];
  const l = lineasDelPayload({ avisar: true, leadId: 123, etapa: 'Agendado', motivo: '', etiquetas: ['caliente', 'r1'], extra: 'x' }, params);
  assert.deepEqual(l, [
    { rotulo: 'Etapa', valor: 'Agendado' },
    { rotulo: 'Avisar', valor: 'Sí' },
    { rotulo: 'Etiquetas', valor: 'caliente, r1' },
    { rotulo: 'Extra', valor: 'x' },
  ]);
  // Sin parámetros (el payload preparado de una pendiente): el orden del payload.
  assert.deepEqual(lineasDelPayload({ funnel_id: 9, nombre: 'Ana', items: [{ a: 1 }, { a: 2 }] }), [
    { rotulo: 'Nombre', valor: 'Ana' },
    { rotulo: 'Ítems', valor: '2 elementos' },
  ]);
  // Lo que se APRUEBA no se recorta (v2): un WhatsApp de 400 caracteres se ve entero en el sheet.
  assert.equal(lineasDelPayload({ texto: 'a'.repeat(400) })[0].valor, 'a'.repeat(400));
  // Sólo el tope de peso (2000) y la pista de un objeto crudo (160) cortan.
  const enorme = lineasDelPayload({ texto: 'a'.repeat(5000) })[0].valor;
  assert.ok(enorme.length <= 2001 && enorme.endsWith('…'), 'el tope de peso corta');
  const objeto = lineasDelPayload({ extra: { k: 'x'.repeat(400) } })[0].valor;
  assert.ok(objeto.length <= 161 && objeto.endsWith('…'), 'un objeto crudo es una pista corta');
  assert.deepEqual(lineasDelPayload(null), []);
});

test('el sheet de un borrador y de un lote de contactos MUESTRA qué trae (v2)', () => {
  // Borrador: las tareas de quien mira (las de otra persona de la reunión no), sin vacías, con tope.
  const b = { tareas: [{ titulo: ' Mandar la propuesta ' }, { titulo: 'La de Pedro', esDeOtro: true }, { titulo: '' }, { titulo: 'Llamar al banco' }] };
  assert.deepEqual(detalleDeBorrador(b).map((l) => l.valor), ['Mandar la propuesta', 'Llamar al banco']);
  assert.equal(detalleDeBorrador({ tareas: Array.from({ length: 30 }, (_, i) => ({ titulo: `T${i}` })) }).length, 12);
  // Contactos: las DOS formas de la base (el lote y el contacto suelto de WhatsApp).
  assert.deepEqual(detalleDeLeads({ leads: [{ nombre: 'Ana', empresa: 'Acme' }, { nombre: '' }, { nombre: 'Luis' }] }).map((l) => l.valor),
    ['Ana · Acme', 'Luis']);
  assert.deepEqual(detalleDeLeads({ nombre: 'Ana', telefono: '+52 1' }).map((l) => l.valor), ['Ana']);
  assert.deepEqual(detalleDeLeads(null), []);
});

test('lineasDeCambios: el «antes» sólo cuando dice algo', () => {
  assert.deepEqual(lineasDeCambios([
    { campo: 'Asistió', antes: 'Sin marcar', despues: 'Sí' },
    { campo: 'Etapa', antes: 'Agendado', despues: 'Facturando' },
    { campo: 'Nota', antes: null, despues: null },
  ]), [
    { rotulo: 'Asistió', valor: 'Sí' },
    { rotulo: 'Etapa', valor: 'Agendado → Facturando' },
    { rotulo: 'Nota', valor: '—' },
  ]);
});

test('de dónde vino: el idioma de etiquetaDeCanal, y lo desconocido no se inventa', () => {
  assert.equal(etiquetaDeOrigen('whatsapp'), 'vino por WhatsApp');
  assert.equal(etiquetaDeOrigen('claude'), 'vino por la API');
  assert.equal(etiquetaDeOrigen('landing'), 'vino de la landing');
  assert.equal(etiquetaDeOrigen('fathom'), 'vino de una reunión');
  assert.equal(etiquetaDeOrigen('flujo:aviso:7'), 'vino de una automatización');
  assert.equal(etiquetaDeOrigen(null), 'vino de MaKo');
  assert.equal(etiquetaDeOrigen('algo-nuevo'), 'vino de MaKo');
});

test('resumenDeBorrador: cuenta las tareas TUYAS y los cierres', () => {
  assert.equal(resumenDeBorrador({ tareas: [{}, {}, { esDeOtro: true }], cerrar: [1] }), '2 tareas · 1 para cerrar');
  assert.equal(resumenDeBorrador({ tareas: [{}], cerrar: [] }), '1 tarea');
  assert.equal(resumenDeBorrador({ tareas: [], cerrar: [1, 2] }), '2 para cerrar');
  assert.equal(resumenDeBorrador({ tareas: [{ esDeOtro: true }] }), 'Tareas de otras personas');
});

test('tituloDeBorrador: la reunión de la que salió, o la primera frase; nunca el párrafo', () => {
  assert.equal(tituloDeBorrador({ resumen: 'MaKo leyó tu reunión.', fuenteTitulo: '  Junta con Ana ' }), 'Junta con Ana');
  assert.equal(tituloDeBorrador({ resumen: 'Cierre del proyecto (06-07/10). Las 7 hechas ya se cerraron.' }), 'Cierre del proyecto (06-07/10).');
  const largo = tituloDeBorrador({ resumen: `${'palabra '.repeat(40)}fin.` });
  assert.ok(largo.length <= 140 && largo.endsWith('…') && !/\s…$/.test(largo), largo);
  assert.equal(tituloDeBorrador({ resumen: '  ' }), 'Borrador del plan');
});

// ── Las confirmaciones del CRM automático ────────────────────────────────────

test('un cambio que MaKo YA aplicó se deja o se deshace; uno sin aplicar, sólo sus opciones', () => {
  const opciones = [{ key: 'perdido', label: 'Marcar Perdido', tone: 'danger' as const }, { key: 'x', label: '  ' }];
  const aplicado = opcionesDeConfirmacion({ aplicado: true, opciones });
  assert.deepEqual(aplicado.map((o) => o.decision), ['confirmar', 'op:perdido', 'rechazar']);
  assert.deepEqual(opcionesDeConfirmacion({ aplicado: false, opciones }).map((o) => o.decision), ['op:perdido']);
  assert.deepEqual(opcionesDeConfirmacion({ aplicado: false, opciones: null }), []);
  // Ningún botón a secas (AGENTS: «Un contrato de datos no es un layout»).
  for (const o of aplicado) assert.ok(!/^(sí|no|aceptar|cancelar|descartar|confirmar|deshacer)$/i.test(o.label), o.label);
});

test('decisionValida acepta sólo la forma que entiende resolverConfirmacion', () => {
  assert.equal(decisionValida('confirmar'), 'confirmar');
  assert.equal(decisionValida('rechazar'), 'rechazar');
  assert.equal(decisionValida('op:perdido_1'), 'op:perdido_1');
  for (const malo of ['op:', 'op:a b', 'borrar', '', null, 3, 'op:' + 'x'.repeat(61)]) assert.equal(decisionValida(malo), null, String(malo));
});

// ── Conteos e ids ────────────────────────────────────────────────────────────

test('sumarConteos: una bandeja visible que no se pudo leer deja el total en null, nunca en 0', () => {
  const vis: TipoDecision[] = ['pendiente', 'accion'];
  assert.equal(sumarConteos({ pendiente: 2, accion: 3 }, vis), 5);
  assert.equal(sumarConteos({ pendiente: null, accion: 3 }, vis), null);
  assert.equal(sumarConteos({ pendiente: 0, accion: 0 }, vis), 0);
  // Lo que el rol no ve no cuenta, aunque haya fallado.
  assert.equal(sumarConteos({ pendiente: 1, accion: 1, lead: null }, vis), 2);
  assert.equal(sumarConteos({}, []), 0);
});

test('ids: lo que llega de una server action se valida', () => {
  assert.equal(idNumerico(5), 5);
  assert.equal(idNumerico(' 12 '), 12);
  for (const malo of [0, -1, 1.5, 'abc', '1e3', '', null, '9999999999999999']) assert.equal(idNumerico(malo), null, String(malo));
  assert.equal(idDePropuesta('prop8w7w4nq722ch'), 'prop8w7w4nq722ch');
  for (const malo of ['', 'a/b', 'x'.repeat(81), 7, null]) assert.equal(idDePropuesta(malo), null, String(malo));
});

test('ordenarItems: lo que vence primero; los cambios del CRM del más viejo; el resto, lo más nuevo', () => {
  const it = (tipo: TipoDecision, key: string, extra: { venceAt?: string; creadaAt?: string }) => ({ tipo, key, ...extra });
  const orden = ordenarItems([
    it('borrador', 'b1', { creadaAt: '2026-10-01T00:00:00Z' }),
    it('lead', 'l1', { creadaAt: '2026-10-01T00:00:00Z' }),
    it('lead', 'l2', { creadaAt: '2026-10-05T00:00:00Z' }),
    it('confirmacion', 'c2', { creadaAt: '2026-10-05T00:00:00Z' }),
    it('confirmacion', 'c1', { creadaAt: '2026-10-01T00:00:00Z' }),
    it('pendiente', 'p2', { venceAt: '2026-10-11T12:00:00Z' }),
    it('pendiente', 'p1', { venceAt: '2026-10-11T11:00:00Z' }),
    it('accion', 'a1', { creadaAt: '2026-10-02T00:00:00Z' }),
  ]).map((x) => x.key);
  assert.deepEqual(orden, ['p1', 'p2', 'c1', 'c2', 'a1', 'l2', 'l1', 'b1']);
});

// ── Guards de cableado ───────────────────────────────────────────────────────

test('las dos bandejas de escritorio usan la fila de lib/bandeja-filas.ts, no una copia', () => {
  const pend = sinComentarios(leer('app/mako/pendientes/page.tsx'));
  const rev = sinComentarios(leer('app/mako/revisar/[id]/page.tsx'));
  assert.match(pend, /import \{ aFila \} from '@\/lib\/bandeja-filas'/);
  assert.match(rev, /import \{ plano \} from '@\/lib\/bandeja-filas'/);
  for (const [donde, src] of [['pendientes', pend], ['revisar', rev]] as const) {
    for (const fn of ['aFila', 'plano', 'fmtHora', 'enCuanto']) {
      assert.doesNotMatch(src, new RegExp(`function ${fn}\\(`), `${donde} volvió a tener su propia ${fn}: va en lib/bandeja-filas.ts`);
    }
  }
  const lib = sinComentarios(leer('lib/bandeja-filas.ts'));
  assert.match(lib, /^import 'server-only';/m, 'lee el registro: no puede viajar al navegador');
  for (const fn of ['aFila', 'plano', 'fmtHora', 'enCuanto']) assert.match(lib, new RegExp(`export function ${fn}\\(`));
});

test('cada acción del Inbox pregunta quién puede (rol + capa) antes de delegar', () => {
  const src = sinComentarios(leer('app/m/inbox/acciones.ts'));
  assert.match(src.trimStart(), /^'use server';/);
  const pares: Array<[string, TipoDecision, string]> = [
    ['confirmarPendienteMovil', 'pendiente', 'confirmarPendienteAction('],
    ['cancelarPendienteMovil', 'pendiente', 'cancelarPendienteAction('],
    ['confirmarAccionMovil', 'accion', 'confirmarAccionAction('],
    ['descartarAccionMovil', 'accion', 'descartarAccionAction('],
    ['resolverConfirmacionMovil', 'confirmacion', 'resolverConfirmacionAction('],
  ];
  for (const [fn, tipo, delega] of pares) {
    const cuerpo = cuerpoDe(src, `export async function ${fn}(`);
    const guard = cuerpo.indexOf(`noPuede('${tipo}')`);
    const llamada = cuerpo.indexOf(delega);
    assert.ok(guard > 0, `${fn} tiene que preguntar noPuede('${tipo}')`);
    assert.ok(llamada > guard, `${fn}: el guard va ANTES de ${delega}`);
    assert.match(cuerpo, /refrescar\(\)/, `${fn} tiene que refrescar la pantalla del teléfono`);
  }
  // La regla del guard es la MISMA que arma la lista.
  assert.match(cuerpoDe(src, 'async function noPuede('), /tiposVisibles\(rol, capa\)\.includes\(tipo\)/);
  // Una compleja no se confirma en el teléfono.
  assert.match(cuerpoDe(src, 'export async function confirmarAccionMovil('), /complejidadDe\(/);
  // Sólo funciones async exportadas (AGENTS: «En un archivo 'use server' SOLO se exportan funciones async»).
  for (const l of src.split('\n')) assert.doesNotMatch(l, /^export\s+(const|let|var|class|enum|function\s)/, l);
});

test('descartar contactos sólo descarta propuestas de CONTACTOS que siguen pendientes', () => {
  const cuerpo = cuerpoDe(sinComentarios(leer('app/crm/revisar/[id]/acciones.ts')), 'export async function descartarLeadsAction(');
  const tipo = cuerpo.indexOf("prop.tipo !== 'lead'");
  const estado = cuerpo.indexOf("prop.estado !== 'pendiente'");
  const descarta = cuerpo.indexOf('descartarPropuesta(');
  assert.ok(tipo > 0 && estado > 0, 'tiene que mirar el tipo y el estado de la propuesta');
  assert.ok(descarta > tipo && descarta > estado, 'los chequeos van ANTES de descartar');
});

test('lo que el Inbox escribe para una persona va en español neutro (sin voseo)', () => {
  // El guard de la casa (tests/puente-panel-copy.test.ts) barre con `git ls-files` y no ve
  // un archivo nuevo hasta el `git add`: éste mira estos por su ruta.
  for (const r of ['lib/inbox-movil-reglas.ts', 'lib/inbox-movil.ts', 'app/m/inbox/acciones.ts', 'lib/bandeja-filas.ts']) {
    const marcas = marcasDeVoseo(sinComentarios(leer(r)));
    assert.deepEqual(marcas, [], `${r}: ${marcas.join(', ')}`);
  }
});
