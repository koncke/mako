// =============================================================================
// La Ticketera otra vez en MAZO, con TABLA a elección y la tarjeta con quién, por dónde y su foto (22/10/2026)
// =============================================================================
// Martín (22/10, desde el teléfono): «La ticketera se ve horrible... vuelva la vista de tarjetas y el desplazamiento tipo
// tinder... si quiero elegir la vista tabla también... ver quién levantó el ticket con su foto de perfil, por donde lo
// levantó». Lo que fija:
//   A. por dónde entró cada ticket y su link (entrando al negocio con `?ws=`), con los tickets REALES #5 y #6 de forma;
//   B. qué hace cada gesto con cada ticket: las acciones de siempre, y las que le escriben al cliente piden texto;
//   C. cuándo cuenta un gesto (derecha, izquierda, ARRIBA; abajo no);
//   D. el mazo no se rearma al refrescar, y lo que espera salir no vuelve a aparecer;
//   E. la tabla ordena y el filtro no repite lo obvio;
//   F. la tarjeta dibuja la foto, el negocio, el canal, el error en corto y el link (render con node);
//   G. el contrato de la pantalla: «Volver» siempre, la decisión ESPERA antes de salir, «1 de N», un botón por gesto,
//      sin «Actualizar» (se refresca sola), la vista se recuerda por persona, y la foto sale de la base.
// Probado ROMPIÉNDOLO (22/10/2026, cada rotura contra este archivo):
//   · `linkDeOrigen` sin el `&ws=`                                           → A2 falla
//   · el mazo manda la decisión en el acto (`void salir(p)` sin ventana)    → G2 falla
//   · `veredictoGesto` sin el caso de arriba                                 → C2 falla
//   · `refrescarMazo` rearma por prioridad (devuelve `ordenDelMazo(ts)`)     → D1 falla
//   · la tarjeta sin la foto (`foto={null}`)                                 → F1 falla
//   · `bandeja()` sin `usuarios(foto_url)`                                   → G5 falla
//   · «Volver» escondido cuando no hay nada (`hidden` en vez de `disabled`)   → G1 falla
//   (y sin el `&ws=` también cae F1: el link de la tarjeta es el mismo)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FilaTicket } from '../lib/tickets-db';
import {
  accionesDe, errorCorto, estadoObvio, linkDeOrigen, nombreDe, ordenDelMazo, ordenarTabla, origenDe, refrescarMazo,
  siguienteOrden, textoDeLaPersona, veredictoGesto, ORDEN_INICIAL, VENTANA_DESHACER_MS,
} from '../app/tickets/bandeja/mazo-reglas';
import { TarjetaTicket } from '../app/tickets/bandeja/TarjetaTicket';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AHORA = Date.parse('2026-10-22T16:00:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();

/** Un ticket con la forma que devuelve `bandeja()`. Por defecto, el #6 de producción (Mauricio, 18/10): automático, de
 *  un chat de MaKo (hilo 40), en el negocio 1, reclasificado como pedido por el Cerebro. */
function ticket(p: Partial<FilaTicket> = {}): FilaTicket {
  return {
    id: 6, created_at: '2026-10-18T04:13:55.209Z', updated_at: '2026-10-18T04:14:50.789Z', workspace_id: 1, usuario_id: 2,
    usuario_email: 'cliente@prueba.test', usuario_nombre: 'Mauricio Bustos Eguia', rol: 'admin', plan: 'Completo',
    tipo: 'pedido', tipo_manual: false, titulo: 'MaKo no pudo «contestarte»',
    descripcion: 'MaKo lo detectó solo: intentó hacerlo y falló. El equipo ya lo está viendo.', canal: 'sistema',
    contexto: { chat: { donde: 'error-mako', hilo: '40' }, error: 'responder: falló la IA (sin proveedor gratis disponible)', herramienta: 'responder' },
    estado: 'esperando_decision', prioridad: 'alta', triage: null, decision: null, decision_nota: null, decidido_at: null,
    duplicado_de: null, respuesta: null, despacho: 'runner', pedido_id: null, despachado_at: null, aviso_estado: 'entregado',
    aviso_intentos: 0, aviso_motivo: null, aviso_at: null, arreglado_at: null, arreglo_nota: null, resuelto_at: null,
    avisado_at: null, negocio: 'Mauricio Bustos', foto: 'https://fotos.prueba.test/mauricio.jpg',
    nota: { actor: 'cerebro', tipo: 'reclasificado', texto: 'Mismo caso que el #5: el negocio no tiene ninguna IA disponible.', at: '2026-10-18T04:14:51.209Z' },
    ...p,
  };
}

// ── A ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('A1: por dónde entró: automático, chat de MaKo, Reportar problema, WhatsApp y API, cada uno con su ícono', () => {
  assert.deepEqual(origenDe(ticket()), { clave: 'automatico', rotulo: 'Automático', detalle: 'MaKo falló en un chat', icono: 'rayo' });
  assert.equal(origenDe(ticket({ contexto: { chat: { donde: 'error-navegador' } } })).detalle, 'Se rompió una pantalla');
  assert.equal(origenDe(ticket({ contexto: { chat: { donde: 'error-servidor' } } })).detalle, 'Falló el servidor');
  assert.deepEqual(origenDe(ticket({ canal: 'chat_movil', contexto: {} })), { clave: 'chat', rotulo: 'Chat de MaKo', detalle: 'Desde el teléfono', icono: 'mako' });
  assert.equal(origenDe(ticket({ canal: 'chat_app', contexto: {} })).detalle, 'Desde la computadora');
  assert.deepEqual(origenDe(ticket({ canal: 'formulario', contexto: { chat: { donde: 'reportar-problema-movil' } } })),
    { clave: 'reportar', rotulo: 'Reportar problema', detalle: 'Desde el teléfono', icono: 'soporte' });
  assert.equal(origenDe(ticket({ canal: 'whatsapp', contexto: {} })).icono, 'whatsapp');
  assert.equal(origenDe(ticket({ canal: 'api', contexto: {} })).icono, 'api');
});

test('A2: el link va a la conversación con MaKo o a la pantalla, ENTRANDO al negocio del cliente (?ws=)', () => {
  // El #6 real: el error de MaKo en el hilo 40 del negocio 1 → esa conversación.
  assert.deepEqual(linkDeOrigen(ticket()), { href: '/second-brain?chat=40&ws=1', rotulo: 'Abrir el chat' });
  assert.deepEqual(linkDeOrigen(ticket({ canal: 'chat_app', workspace_id: 13, contexto: { chat: { donde: 'crm', hilo: '77' } } })),
    { href: '/second-brain?chat=77&ws=13', rotulo: 'Abrir el chat' });
  // Una pantalla rota: la pantalla, con su query y el ?ws= sumado (no pisado).
  assert.deepEqual(linkDeOrigen(ticket({ contexto: { ruta: '/crm?funnel=3', chat: { donde: 'error-navegador' } }, workspace_id: 34 })),
    { href: '/crm?funnel=3&ws=34', rotulo: 'Ver la pantalla' });
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '/crm?ws=9', chat: { donde: 'error-navegador' } }, workspace_id: 34 }))?.href, '/crm?ws=34');
  // Sin hilo ni pantalla, o por WhatsApp (la conversación vive en el teléfono): no hay link. Nunca uno a otro host.
  assert.equal(linkDeOrigen(ticket({ canal: 'whatsapp', contexto: { chat: { donde: 'whatsapp', hilo: '1203@g.us' } } })), null);
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '//malo.test/x' } })), null);
  assert.equal(linkDeOrigen(ticket({ workspace_id: 0 })), null);
});

test('A3: quién: el nombre, o el teléfono / el nombre de WhatsApp; el error en corto; el texto de la persona', () => {
  assert.equal(nombreDe(ticket()), 'Mauricio Bustos Eguia');
  assert.equal(nombreDe(ticket({ usuario_nombre: '', usuario_email: 'whatsapp:5491155550000' })), '+5491155550000');
  assert.equal(nombreDe(ticket({ usuario_nombre: '', usuario_email: 'whatsapp:maria-lopez' })), 'maria lopez');
  assert.equal(errorCorto('TypeError: x (digest 2741998123)'), 'TypeError: x');
  const largo = errorCorto(`responder: ${'palabra '.repeat(40)}`, 60)!;
  assert.ok(largo.length <= 61 && largo.endsWith('…'), largo);
  assert.equal(errorCorto('  '), null);
  // Un ticket automático no tiene texto de la persona (el suyo es el aviso fijo del sistema); el pedido a MaKo sí.
  assert.equal(textoDeLaPersona(ticket()), null);
  assert.equal(textoDeLaPersona(ticket({ contexto: { pedido: 'Mándale el resumen a Juan' } })), 'Mándale el resumen a Juan');
  assert.equal(textoDeLaPersona(ticket({ canal: 'formulario', descripcion: 'No guarda' })), 'No guarda');
});

// ── B ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('B1: los gestos son las acciones de siempre; las que le escriben al cliente piden texto', () => {
  const bug = accionesDe(ticket({ tipo: 'bug' }));
  assert.deepEqual([bug.derecha?.decision, bug.derecha?.rotulo, bug.derecha?.pideTexto], ['arreglar', 'Arreglar', false]);
  assert.deepEqual([bug.izquierda?.decision, bug.izquierda?.pideTexto], ['rechazar', true]);
  assert.deepEqual([bug.arriba?.decision, bug.arriba?.rotulo, bug.arriba?.pideTexto], ['preguntar', 'Preguntar', true]);
  assert.deepEqual([accionesDe(ticket({ tipo: 'pedido' })).derecha?.decision, accionesDe(ticket({ tipo: 'pedido' })).derecha?.rotulo], ['hacer', 'Hacer']);
  // Una pregunta no se aprueba: se responde (con texto).
  const pregunta = accionesDe(ticket({ tipo: 'pregunta' })).derecha!;
  assert.deepEqual([pregunta.decision, pregunta.pideTexto], ['responder', true]);
});

// ── C ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('C1: derecha e izquierda: lejos o un tirón; arrepentirse la devuelve', () => {
  const g = (dx: number, vx: number) => veredictoGesto({ dx, dy: 0, vx, vy: 0, ancho: 340, alto: 560 });
  assert.equal(g(120, 0), 'derecha');
  assert.equal(g(-120, 0), 'izquierda');
  assert.equal(g(60, 0), null);
  assert.equal(g(50, 900), 'derecha');
  assert.equal(g(-50, -900), 'izquierda');
  assert.equal(g(140, -500), null, 'lejos pero tirando para atrás: se arrepintió');
});

test('C2: ARRIBA es pedirle más al cliente; abajo no hace nada', () => {
  const g = (dy: number, vy: number, dx = 0) => veredictoGesto({ dx, dy, vx: 0, vy, ancho: 340, alto: 560 });
  assert.equal(g(-130, 0), 'arriba');
  assert.equal(g(-50, -800), 'arriba');
  assert.equal(g(-60, 0), null);
  assert.equal(g(300, 0), null);
  assert.equal(g(-130, 400), null, 'arriba y tirando para abajo al soltar: vuelve');
  assert.equal(g(-60, 0, 150), 'derecha', 'manda el eje más largo');
});

// ── D ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('D1: el mazo: lo urgente primero; al refrescar no se rearma, lo nuevo va al final y lo decidido se va', () => {
  const a = ticket({ id: 1, prioridad: 'media', created_at: hace(300) });
  const b = ticket({ id: 2, prioridad: 'urgente', created_at: hace(10) });
  const c = ticket({ id: 3, prioridad: 'media', created_at: hace(600) });
  const cerrado = ticket({ id: 4, estado: 'resuelto' });
  assert.deepEqual(ordenDelMazo([a, b, c, cerrado]), [2, 3, 1]);
  const orden = [2, 3, 1];
  const vistos = new Set(orden);
  // Llega uno urgente nuevo y al 3 lo decidió otro: el 3 se va, el nuevo va AL FINAL (aunque sea urgente).
  const nuevo = ticket({ id: 5, prioridad: 'urgente', created_at: hace(1) });
  assert.deepEqual(refrescarMazo(orden, [a, b, ticket({ id: 3, estado: 'rechazado' }), nuevo], vistos, new Set()), [2, 1, 5]);
  // Lo decidido acá que todavía no salió sigue «por decidir» en la base: no vuelve a aparecer.
  assert.deepEqual(refrescarMazo([1, 3], [a, b, c], new Set([1, 2, 3]), new Set([2])), [1, 3]);
  // Lo que ya pasó por este mazo no vuelve por refrescar (si falló, la tarjeta vuelve sola adelante).
  assert.deepEqual(refrescarMazo([], [a], new Set([1]), new Set()), []);
});

// ── E ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('E1: la tabla ordena por cada columna, y tocar la misma da vuelta el orden', () => {
  const ts = [
    ticket({ id: 1, created_at: hace(30), negocio: 'Beta', usuario_nombre: 'Zoe' }),
    ticket({ id: 2, created_at: hace(5), negocio: 'alfa', usuario_nombre: 'Ana' }),
    ticket({ id: 3, created_at: hace(90), negocio: 'Ñandú', usuario_nombre: 'Luis' }),
  ];
  assert.deepEqual(ordenarTabla(ts, ORDEN_INICIAL).map((t) => t.id), [2, 1, 3]);
  assert.deepEqual(ordenarTabla(ts, { col: 'negocio', dir: 'asc' }).map((t) => t.id), [2, 1, 3]);
  assert.deepEqual(ordenarTabla(ts, { col: 'quien', dir: 'desc' }).map((t) => t.id), [1, 3, 2]);
  assert.deepEqual(siguienteOrden({ col: 'cuando', dir: 'desc' }, 'cuando'), { col: 'cuando', dir: 'asc' });
  assert.deepEqual(siguienteOrden({ col: 'cuando', dir: 'desc' }, 'titulo'), { col: 'titulo', dir: 'asc' });
});

test('E2: en la tabla, el estado que ya dice el filtro no se repite en cada fila', () => {
  assert.equal(estadoObvio('esperando_decision', 'decidir'), true);
  assert.equal(estadoObvio('nuevo', 'decidir'), false);
  assert.equal(estadoObvio('arreglado', 'curso'), false);
  assert.equal(estadoObvio('resuelto', 'cerrados'), false);
});

// ── F ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('F1: la tarjeta dibuja la foto, el nombre, el negocio, por dónde, el error en corto, la nota y el link', () => {
  const html = renderToStaticMarkup(createElement(TarjetaTicket, { t: ticket(), ahora: AHORA, onVerTodo: () => {} }));
  assert.match(html, /<img src="https:\/\/fotos\.prueba\.test\/mauricio\.jpg"/, 'la foto de perfil de quien lo levantó');
  assert.match(html, /Mauricio Bustos Eguia/);
  assert.match(html, /Mauricio Bustos<\/span>/, 'el negocio');
  assert.match(html, /Automático/);
  assert.match(html, /tickets-bandeja__insignia--automatico/, 'la insignia del canal en la cara');
  assert.match(html, /responder: falló la IA \(sin proveedor gratis disponible\)/);
  assert.match(html, /<b>Cerebro<\/b> Mismo caso que el #5/);
  assert.match(html, /href="\/second-brain\?chat=40&amp;ws=1"[^>]*target="_blank"/);
  assert.match(html, />Ver todo</);
  assert.match(html, /#6/);
  assert.doesNotMatch(html, /El equipo ya lo está viendo/, 'el aviso fijo del sistema no es texto de la persona');
  // Sin foto: las iniciales (la familia de tarjetas), nunca un <img> roto.
  const sinFoto = renderToStaticMarkup(createElement(TarjetaTicket, { t: ticket({ foto: null }), ahora: AHORA }));
  assert.doesNotMatch(sinFoto, /<img/);
  assert.match(sinFoto, /class="tk-ini[^"]*"[^>]*>ME</, 'las iniciales de la familia de tarjetas (primera y última palabra)');
});

// ── G ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('G1: «Volver» arriba y SIEMPRE (apagado sin nada que deshacer), y «1 de N»', () => {
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  const volver = src.indexOf('tickets-bandeja__volver-mazo');
  assert.ok(volver > 0);
  // No está adentro de un condicional: el JSX que lo dibuja no empieza con `{algo && (`.
  const antes = src.slice(src.lastIndexOf('<header', volver), volver);
  assert.doesNotMatch(antes, /&&\s*\(\s*$/);
  assert.match(src, /disabled=\{!hayVuelta\}/);
  assert.match(src, /<b>\{i \+ 1\}<\/b> de \{ids\.length\}/);
});

test('G2: una decisión ESPERA antes de salir, y «Volver» la saca de la espera sin mandar nada', () => {
  assert.ok(VENTANA_DESHACER_MS >= 5000 && VENTANA_DESHACER_MS <= 30_000, 'la ventana de Gmail: 5 a 30 s');
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  // decidirTicketAction sólo se llama en `salir`, y `salir` sólo corre al vencer la ventana o al irse de la pantalla.
  assert.equal(src.match(/decidirTicketAction\(/g)?.length, 1);
  const decidir = src.slice(src.indexOf('const decidir = useCallback'), src.indexOf('const volver = useCallback'));
  assert.doesNotMatch(decidir, /decidirTicketAction|salir\(p\)|salirRef\.current\(p\);/, 'decidir no manda nada en el acto');
  assert.match(decidir, /window\.setTimeout\(\(\) => void salirRef\.current\(p\), VENTANA_DESHACER_MS\)/);
  const volver = src.slice(src.indexOf('const volver = useCallback'), src.indexOf('const mover = useCallback'));
  assert.match(volver, /window\.clearTimeout\(relojes\.current\.get\(u\.t\.id\)\)/);
  assert.doesNotMatch(volver, /decidirTicketAction|salir/);
  // Irse de la pantalla manda lo que esperaba (lo decidió): pagehide, pestaña oculta y desmontar.
  assert.match(src, /addEventListener\('pagehide', vaciar\)/);
  assert.match(src, /visibilityState === 'hidden'\) vaciar\(\)/);
});

test('G3: cada gesto tiene su botón (mouse y accesibilidad) y su tecla', () => {
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  for (const s of ['izquierda', 'arriba', 'derecha']) assert.match(src, new RegExp(`<BotonGesto s="${s}"`));
  for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'Backspace']) assert.match(src, new RegExp(`e\\.key === '${k}'`));
});

test('G4: sin «Actualizar»: se refresca sola; el arreglo automático, en el rayo; la vista se recuerda por persona', () => {
  const src = leer('app/tickets/bandeja/BandejaTickets.tsx');
  assert.doesNotMatch(src, />Actualizar</);
  assert.match(src, /window\.setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) void cargar\(\); \}, REFRESCO_MS\)/);
  assert.match(src, /function AutoArreglo\(/);
  assert.match(src.slice(src.indexOf('function AutoArreglo(')), /<Switch checked=\{prendido\} onChange=\{onCambio\} label="Arreglar solos los bugs evidentes" \/>/);
  assert.match(src, /void guardarVistaAction\(v\)/);
  assert.match(leer('lib/perfil.ts'), /const TICKETERA_VISTA_KEY = 'ticketeraVista';/);
  assert.match(leer('app/tickets/bandeja/acciones.ts'), /export async function guardarVistaAction\(v: VistaTicketera\)[\s\S]{0,120}if \(!\(await opera\(\)\)\) return/);
});

test('G5: la foto y la última nota salen de la base, en la lectura de Martín (no en la del cliente)', () => {
  const db = leer('lib/tickets-db.ts');
  assert.match(db, /const COLS_MARTIN = `\$\{COLS\}, workspaces\(nombre\), usuarios\(foto_url\)`;/);
  assert.match(db, /export async function bandeja\([\s\S]*?\.select\(COLS_MARTIN\)/);
  assert.match(db, /export async function ticketEntero\([\s\S]*?\.select\(COLS_MARTIN\)/);
  assert.doesNotMatch(db.slice(db.indexOf('export async function misTickets('), db.indexOf('export async function comentarComoCliente(')), /usuarios\(foto_url\)/);
  // Sólo https: una foto que no lo es no se dibuja.
  assert.match(db, /\/\^https:\\\/\\\/\/i\.test\(us\.foto_url\)/);
});
