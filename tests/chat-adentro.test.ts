// =============================================================================
// Confirmar ADENTRO del chat (20/10/2026, ola 1, pieza 1.10)
// =============================================================================
// docs/ops-center-principal.md §2.5. Hecho = «Lo que se confirma afuera baja del 42% a menos del 10%; un test cuenta
// las acciones de pantalla que no tienen bloque». Lo que se fija:
//   1. la cuenta: de las acciones que ve el chat de la app, cuántas se confirman AFUERA (las que no son de la tarjeta ni
//      del formulario genérico). Medido el 20/10/2026: 52 de 351 (14,8%; antes de la 1.10, 148 de 350, el 42%). 45 son
//      las dos excepciones que el documento declara: las 34 ediciones de video, que se aceptan en el editor (D7a), y las
//      11 que mueven plata (D2). Sin ellas, 7 (2%): tiene que quedar debajo del 10%, y ninguna pantalla nueva se suma a
//      las de afuera sin que el test lo diga;
//   2. el formulario se dibuja con los campos de la operación, los botones de /mako/revisar, la consecuencia (en rojo si
//      no se deshace) y «Abrir en la app»; quien no es admin lo ve y no lo toca;
//   3. al reabrir el chat, sus propuestas pendientes vuelven con el formulario (el camino real, tests/_adentro-hijo.ts):
//      las de OTRO chat y las ya resueltas no; la que mueve plata vuelve SIN formulario;
//   4. las tres caras del hilo dibujan el formulario, y la pantalla de revisión usa los MISMOS campos;
//   5. (revisión del 21/10/2026) el cliente lee rótulos de persona: ni el nombre del parámetro («leadId»), ni la ayuda
//      escrita para el modelo, ni lo que escribe en la base («closing_analyses»); un id o un JSON van como los propuso MaKo.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · el formulario también para lo que mueve plata → 1 fallo (3);
//   · `propuestasPendientesDelChat` sin filtrar por el chat → 1 fallo (3);
//   · `puedeDecidir` siempre true → 1 fallo (3);
//   · el hilo de la computadora sin el formulario → 1 fallo (4);
//   · (21/10) el formulario del chat sin `paraCliente` → 1 fallo (5); `plano` sin el `rotulo` → 1 fallo (5); la
//     consecuencia con `escribe` otra vez → 1 fallo (5); el id a la vista → 1 fallo (2).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REGISTRO, visible } from '../lib/api-mako/registro';
import type { AccionDef } from '../lib/api-mako/tipos';
import type { FormularioPropuesta, PropuestaPantalla } from '../lib/mako-turno-app-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Las pantallas que todavía confirman afuera, con su motivo (docs/ops-center-principal.md §2.5, «Excepciones»). */
const AFUERA_A_PROPOSITO: Record<string, string> = {
  '/video-editor': 'la propuesta se acepta en el editor (D7a)',
  '/whatsapp': 'el borrador se manda desde la cola de Chats',
  '/crm/revisar': 'la ficha del lead tiene su vista (TablaRevisionLeads): la 1.10 b',
  '/plan/revisar': 'el borrador de tareas tiene su vista: la 1.10 b',
};

test('1. lo que se confirma afuera es menos del 10% de lo que el chat puede hacer', (t) => {
  const vista = { canal: 'app' as const, alcance: 'proponer' as const, ws: 9, rol: 'admin' as const, tabs: null, plataforma: true };
  const acciones = REGISTRO.filter((d): d is AccionDef => d.tipo === 'accion' && visible(d, vista));
  const adentro = (d: AccionDef) => d.confirmacion === 'chat' || (d.pantalla === '/mako/revisar' && d.costo !== 'dinero');
  const afuera = acciones.filter((d) => !adentro(d));
  const porQue = new Map<string, number>();
  for (const d of afuera) {
    const clave = d.costo === 'dinero' ? 'mueve plata (D2)' : String(d.pantalla);
    porQue.set(clave, (porQue.get(clave) ?? 0) + 1);
  }
  t.diagnostic(`afuera ${afuera.length} de ${acciones.length} (${((afuera.length / acciones.length) * 100).toFixed(1)}%): ${[...porQue].map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  // Las dos excepciones del documento (§2.5) no cuentan para la meta: tienen su decisión pendiente.
  const sinExcepciones = afuera.filter((d) => d.costo !== 'dinero' && d.pantalla !== '/video-editor');
  t.diagnostic(`sin las excepciones (D2, D7a): ${sinExcepciones.length} (${((sinExcepciones.length / acciones.length) * 100).toFixed(1)}%)`);
  assert.ok(sinExcepciones.length / acciones.length < 0.1, `se confirma afuera el ${((sinExcepciones.length / acciones.length) * 100).toFixed(1)}% sin las excepciones`);
  for (const d of afuera) {
    if (d.costo === 'dinero') continue;
    assert.ok(String(d.pantalla) in AFUERA_A_PROPOSITO, `«${d.id}» se confirma en ${String(d.pantalla)}, que no es una pantalla de las de afuera a propósito`);
  }
});

const FORM: FormularioPropuesta = {
  propuestaId: 'p-1', puedeDecidir: true, payload: { leadId: 101, email: 'ana@nuevo.com' },
  operacion: {
    id: 'editar_contacto_lead', titulo: 'Editar contacto de un lead', descripcion: '', escribe: 'cambia los datos de contacto del lead', reversible: true,
    parametros: [
      { nombre: 'leadId', tipo: 'number', descripcion: 'id del lead.', obligatorio: true, entero: true, minimo: 1, fijoAlRevisar: true },
      { nombre: 'email', tipo: 'string', descripcion: 'email.', max: 200 },
    ],
  },
};
const dibujar = async (f: FormularioPropuesta, conAcciones = true) => {
  const { FormularioEnChat } = await import('../app/_chat/FormularioEnChat');
  const acciones = conAcciones ? { confirmar: async () => ({ ok: true as const, resumen: 'x' }), descartar: async () => ({ ok: true as const, resumen: 'x' }) } : undefined;
  return renderToStaticMarkup(createElement(FormularioEnChat, { f, acciones, abrirEnApp: { titulo: 'Abrir en la app', href: '/mako/revisar/p-1' } }));
};

test('2. el formulario: los campos de la operación, los botones de su pantalla y la consecuencia', async () => {
  const html = await dibujar(FORM);
  assert.match(html, /value="ana@nuevo\.com"/, 'con lo que propuso MaKo');
  // Desde el 21/10 el id no se ve (test 5): va como lo propuso MaKo.
  assert.doesNotMatch(html, /value="101"/, 'el id no se muestra ni se edita');
  assert.match(html, />Confirmar acción</);
  assert.match(html, />Descartar propuesta</);
  assert.match(html, /href="\/mako\/revisar\/p-1[^"]*"[^>]*>Abrir en la app</, 'la salida secundaria');
  assert.match(html, /Se puede deshacer/);
  const irreversible = await dibujar({ ...FORM, operacion: { ...FORM.operacion, reversible: false } });
  assert.match(irreversible, /ch-tarjeta__consecuencia--irreversible">No se puede deshacer/, 'G3: en rojo');
  const miembro = await dibujar({ ...FORM, puedeDecidir: false });
  assert.doesNotMatch(miembro, />Confirmar acción</, 'quien no es admin no lo confirma');
  assert.match(miembro, /Sólo el administrador/);
  assert.match(await dibujar(FORM, false), /<button[^>]*disabled=""[^>]*>[\s\S]*?Confirmar acción/, 'sin acciones, se ve y no se toca');
});

test('3. al reabrir el chat, sus propuestas pendientes vuelven con el formulario', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_adentro-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const r = JSON.parse(salida) as { propuestaId: string; comoAdmin: PropuestaPantalla[] | null; comoMiembro: PropuestaPantalla[] | null; red: string[] };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.deepEqual(r.comoAdmin?.map((p) => p.escritorio), [`/mako/revisar/${r.propuestaId}`, '/mako/revisar/prop-plata'],
    'las dos pendientes de ESTE chat, en orden; ni la del otro chat ni la ya hecha');
  const [suya, plata] = r.comoAdmin ?? [];
  assert.equal(suya.form?.propuestaId, r.propuestaId);
  assert.deepEqual(suya.form?.payload, { leadId: 101, email: 'ana@nuevo.com' }, 'con lo que quedó propuesto');
  assert.equal(suya.form?.puedeDecidir, true);
  assert.ok(suya.form?.operacion.parametros.some((p) => p.nombre === 'email'), 'con los campos de la operación');
  assert.equal(plata.form, undefined, 'la que mueve plata vuelve SIN formulario: se confirma en su pantalla (D2)');
  assert.equal(r.comoMiembro?.[0]?.form?.puedeDecidir, false, 'un miembro la ve y no la confirma');
});

test('4. las tres caras dibujan el formulario, con los mismos campos que su pantalla', () => {
  assert.match(sinComentarios(leer('app/_chat/HiloMako.tsx')), /\{x\.p\.form \? \(\s*<FormularioEnChat f=\{x\.p\.form\} acciones=\{ACCIONES_FORMULARIO\}/, 'la computadora');
  assert.match(sinComentarios(leer('app/m/mako/ChatMako.tsx')), /if \(x\.k === 'pantalla' && x\.p\.form\) \{[\s\S]{0,300}<FormularioEnChat f=\{x\.p\.form\} acciones=\{ACCIONES_FORMULARIO\}/, 'el teléfono');
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /if \(x\.k === 'pantalla' && x\.p\.form\) \{[\s\S]{0,300}<FormularioEnChat f=\{x\.p\.form\}/, 'el MaKo Analyst de la ficha');
  // Por la ruta de 420 s desde el 21/10/2026 (tests/chat-trabajos.test.ts, 5); la ruta corre las de /mako/revisar.
  assert.match(leer('app/api/mako/propuesta/route.ts'), /await confirmarAccionAction\(id, body\.payload as Record<string, unknown>\)[\s\S]*await descartarAccionAction\(id\)/, 'las MISMAS acciones de /mako/revisar');
  assert.match(leer('app/mako/revisar/[id]/RevisarAccion.tsx'), /import \{ Campo, armarPayload, valorInicial, valorLegible, type OperacionPlana, type Valor \} from '\.\.\/formulario';/, 'la pantalla de revisión usa los mismos campos');
  for (const f of ['app/second-brain/useChatCliente.ts', 'app/crm/mako-crm/ChatMakoCrm.tsx', 'app/crm/lead-view/MakoAnalystLead.tsx', 'app/m/mako/ChatMako.tsx']) {
    assert.match(leer(f), /itemsDeSesion\([^)]*pantallas \?\? \[\]\)/, `${f}: las propuestas pendientes vuelven al abrir`);
  }
});

test('5. el formulario del chat se lee como una persona: sin nombres de parámetro, ayudas del modelo ni tablas', async () => {
  const conRotulo: FormularioPropuesta = {
    ...FORM,
    operacion: {
      ...FORM.operacion, escribe: 'upsert de análisis en closing_analyses con el lead fijado',
      parametros: [...FORM.operacion.parametros, { nombre: 'filtros', tipo: 'object', descripcion: 'filtros (de buscar_leads).' }, { nombre: 'telefonoNuevo', tipo: 'string', descripcion: 'teléfono E.164 para el modelo.', rotulo: 'Teléfono nuevo' }],
    },
  };
  const html = await dibujar(conRotulo);
  assert.match(html, />Teléfono nuevo</, 'el rótulo de una persona');
  assert.doesNotMatch(html, />(?:leadId|email|filtros|telefonoNuevo)</, 'ningún nombre de parámetro');
  assert.doesNotMatch(html, /para el modelo|de buscar_leads|id del lead/, 'ni las ayudas escritas para el modelo');
  assert.doesNotMatch(html, /closing_analyses|upsert/, 'ni lo que escribe en la base');
  assert.match(html, /Lo demás va como lo propuso MaKo/, 'el id y el JSON van como los propuso, y lo dice');
  // `plano` (lib/bandeja-filas.ts, con `server-only`) deja viajar el rótulo al formulario.
  assert.match(leer('lib/bandeja-filas.ts'), /\.\.\.\(p\.rotulo \? \{ rotulo: p\.rotulo \} : \{\}\),/, 'el rótulo viaja al formulario');
  assert.match(leer('app/admin/operaciones/AdjuntosCaja.tsx'), /title=\{children \? 'Adjuntar y elegir con qué corre' : 'Adjuntar'\}/, 'el «+» no ofrece lo que no hay');
});
