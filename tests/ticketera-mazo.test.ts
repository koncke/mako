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
//   F. la tarjeta se entiende en 3 segundos: qué pasó, quién, qué hay que hacer, el tipo, y lo técnico plegado (render);
//   G. el contrato de la pantalla: «Volver» siempre (en la fila de botones), la decisión ESPERA antes de salir, «1 de N»,
//      un botón por gesto (redondo, sólo el ícono), sin «Actualizar», la vista se recuerda por persona, y la foto sale de
//      la base;
//   H. lo que DICE la tarjeta, por reglas: la frase, la tabla de errores, quién y dónde, el tipo de la fila, la nota en una
//      línea y el botón que se marca al arrastrar.
// Probado ROMPIÉNDOLO (22/10/2026, cada rotura contra este archivo):
//   · `linkDeOrigen` sin el `&ws=`                                           → A2 falla
//   · el mazo manda la decisión en el acto (`void salir(p)` sin ventana)    → G2 falla
//   · `veredictoGesto` sin el caso de arriba                                 → C2 falla
//   · `refrescarMazo` rearma por prioridad (devuelve `ordenDelMazo(ts)`)     → D1 falla
//   · la tarjeta sin la foto (`foto={null}`)                                 → F1 falla
//   · `bandeja()` sin `usuarios(foto_url)`                                   → G5 falla
//   · «Volver» escondido cuando no hay nada (`hidden` en vez de `disabled`)   → G1 falla
//   (y sin el `&ws=` también cae F1: el link de la tarjeta es el mismo)
// La revisión (22/10/2026, tarde) sumó A2b, C3, D2 y D3, probados ROMPIENDO cada arreglo:
//   · `linkDeOrigen` sin mirar el camino ya resuelto (`/.//malo.test` → `//malo.test`), o sin cortar `/api/` → A2b
//   · `refrescarMazo` con «ya lo vi» por número, sin la versión (lo que vuelve a esperar a Martín no volvía) → D2
//   · `teclaDelMazo` sin `repeat`, sin las pestañas o sin la caja abierta                                → C3
//   · `lectorDeBandeja` que descarta lo pedido en el medio, o da la vista por sabida si la lectura falló  → D3
//   · J / K de la tabla otra vez con `ORDEN_INICIAL` (no el orden que se ve)                             → E3
// La tarjeta CLARA (22/10/2026, 17:25: «no se entiende ni de qué es el bug, ni qué hay que hacer, ni cómo se originó, o
// si lo levantó Mauricio o si lo detectó MaKo»; «las tarjetas siempre en el medio»; botones redondos sin texto) sumó el
// bloque H y rehízo B1, F1 y G1. Probado ROMPIENDO cada regla (22/10/2026, cada rotura contra este archivo):
//   · `quePaso` devuelve el título del cliente (`t.titulo`) también en los automáticos               → H1, H7 y F1
//   · «Claude vetado» fuera de la tabla de errores (cae al genérico «Algo falló en el código»)       → H2 y F1
//   · `estadoDeLaNota` devuelve la nota entera                                                        → H5
//   · el error técnico a la vista otra vez (la tarjeta dibuja `<code>` cerrada)                       → F1
//   · la lista de «lo que sigue» al costado otra vez (`tickets-bandeja__siguen`)                      → G1
//   · el botón «Hacer» con su texto visible (`<span>{a.rotulo}</span>`)                               → G3
//   · `gestoMarcado` sin el umbral (marca con 1 px)                                                   → H6
// La revisión de la tarjeta clara (22/10/2026, noche) sumó H8 y rehízo B1, F1, H4 y H7, probados ROMPIENDO cada arreglo:
//   · otra vez «automático con error = Bug» por encima del tipo de la fila (pisa el veredicto del Cerebro) → H4, B1, F1 y H7
//   · `quePaso` con el nombre de la identidad del sistema («A MaKo le falló el servidor»)                  → H8
//   · `quePaso` sin el «Volvió a pasar» de una regresión                                                   → H8
//   · `errorFrecuente` sobre el error con su «· 429 veces» pegado                                          → H8
//   · «permission denied» a secas otra vez como permiso de la base                                         → H8
//   · «Arreglar el código» sobre lo que el Cerebro devolvió como «no es un bug»                            → H8
//   · el negocio de la plataforma en un ticket sin persona                                                 → H8
//   · la tarjeta nombrada con el título del cliente para un lector de pantalla                             → F1

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FilaTicket } from '../lib/tickets-db';
import { fotoDePersonaSegura } from '../lib/foto-perfil';
import { accionesDe, errorCorto, errorFrecuente, estadoDeLaNota, estadoObvio, gestoMarcado, leerTicket, lectorDeBandeja, linkDeOrigen, nombreDe, ordenDelMazo, ordenarTabla, origenDe, primerNombre, quePaso, refrescarMazo, siguienteOrden, teclaDelMazo, textoDeLaPersona, veredictoGesto, versionesDe, EMAIL_DEL_SISTEMA, ERROR_GENERICO, MARCA_PX, ORDEN_INICIAL, VENTANA_DESHACER_MS, queDecide, dondeDelChat } from '../app/tickets/bandeja/mazo-reglas';
import { DetalleDeLaTarjeta, TarjetaTicket } from '../app/tickets/bandeja/TarjetaTicket';
import { TablaTickets } from '../app/tickets/bandeja/TablaTickets';

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

/** El #5 de producción, como lo lee `bandeja()` (22/10/2026): el error «Claude vetado» y la nota REAL del Cerebro. */
const ERROR_5 = 'responder: Claude vetado — «…» no está en la lista blanca de lib/veto-claude.ts. Claude está prohibido salvo excepción explícita (pedido del dueño, 13/8/2026).';
const NOTA_5 = 'El arreglo de código ya salió: el error decía «Claude vetado» y era la IA gratis que no contestó. Que MaKo le conteste al ws1 depende de con qué IA lo hace: desde el 16/10 las claves de la plataforma no reciben datos de sus clientes. Decide Martín: que el negocio cargue su propia clave o que MaKo la pague.';
const NOTA_6 = 'Mismo caso que el #5, ahora con el motivo real: el ws1 no tiene ninguna IA disponible para el chat de MaKo (sin proveedor gratis disponible). No se arregla con código; decide Martín si el negocio carga su propia clave o si MaKo la paga.';
const ticket5 = () => ticket({
  id: 5, contexto: { chat: { donde: 'error-mako', hilo: '40' }, error: ERROR_5, herramienta: 'responder' },
  nota: { actor: 'cerebro', tipo: 'reclasificado', texto: NOTA_5, at: '2026-10-18T03:58:55.930Z' },
});
/** Una persona que lo levantó ella (no MaKo solo). */
const dePersona = (p: Partial<FilaTicket> = {}) => ticket({
  id: 102, canal: 'formulario', tipo: 'bug', usuario_nombre: 'Laura Gómez', negocio: 'Estudio Gómez', titulo: 'No se guardan los cambios del funnel',
  descripcion: 'Moví una etapa y al otro día estaba como antes.', contexto: { ruta: '/crm?funnel=3', chat: { donde: 'reportar-problema-movil' } },
  nota: null, foto: 'https://fotos.prueba.test/laura.jpg', ...p,
});

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

test('A2b: una ruta del cliente que el parser resuelve a OTRO SITIO (`/.//malo.test`) o a la API no da link', () => {
  // La ruta la manda el navegador del cliente y `sanearContexto` sólo mira la primera barra: estas pasan y se guardan.
  for (const ruta of ['/.//malo.test/x', '/..//malo.test', '/a/..//malo.test/x?y=1', '/%2e//malo.test', '/\\malo.test/x']) {
    const l = linkDeOrigen(ticket({ contexto: { ruta, chat: { donde: 'error-navegador' } } }));
    assert.ok(l === null || (l.href.startsWith('/') && !l.href.startsWith('//')), `${ruta} → ${l?.href}`);
    if (l) assert.equal(new URL(l.href, 'https://hola-mako.com').host, 'hola-mako.com', `${ruta} → ${l.href}`);
  }
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '/.//malo.test/x', chat: { donde: 'error-navegador' } } })), null);
  // Un GET a la API con la sesión de Martín no es «ver la pantalla».
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '/api/perfil?x=1', chat: { donde: 'error-navegador' } } })), null);
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '/crm/../api/x', chat: { donde: 'error-navegador' } } })), null);
  // Lo normal sigue andando, con sus puntos resueltos.
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '/crm/./leads', chat: { donde: 'error-navegador' } }, workspace_id: 7 }))?.href, '/crm/leads?ws=7');
  assert.equal(linkDeOrigen(ticket({ contexto: { ruta: '/apis-de-meta', chat: { donde: 'error-navegador' } }, workspace_id: 7 }))?.href, '/apis-de-meta?ws=7');
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
  const bug = accionesDe(dePersona({ tipo: 'bug' }));
  assert.deepEqual([bug.derecha?.decision, bug.derecha?.rotulo, bug.derecha?.pideTexto], ['arreglar', 'Arreglar', false]);
  assert.deepEqual([bug.izquierda?.decision, bug.izquierda?.pideTexto], ['rechazar', true]);
  assert.deepEqual([bug.arriba?.decision, bug.arriba?.rotulo, bug.arriba?.pideTexto], ['preguntar', 'Preguntar', true]);
  assert.deepEqual([accionesDe(dePersona({ tipo: 'pedido' })).derecha?.decision, accionesDe(dePersona({ tipo: 'pedido' })).derecha?.rotulo], ['hacer', 'Hacer']);
  // El #6 real: automático con un error, que el Cerebro devolvió como «pedido» («no es de código»). Aprobar sale del tipo de
  // la FILA, su veredicto: Hacer, nunca «ARREGLARLO (es un bug)» sobre lo que él dijo que no lo es.
  assert.deepEqual([accionesDe(ticket()).derecha?.decision, accionesDe(ticket()).derecha?.rotulo], ['hacer', 'Hacer']);
  // Si lo devolvió como pregunta, el ✓ responde (con texto).
  assert.deepEqual([accionesDe(ticket({ tipo: 'pregunta' })).derecha?.decision, accionesDe(ticket({ tipo: 'pregunta' })).derecha?.pideTexto], ['responder', true]);
  // Una pregunta no se aprueba: se responde (con texto).
  const pregunta = accionesDe(dePersona({ tipo: 'pregunta' })).derecha!;
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

test('C3: las teclas: una SOSTENIDA no decide otra vez; en las pestañas, las flechas son de las pestañas', () => {
  const libre = { enCampo: false, enFlechas: false, cajaAbierta: false };
  assert.equal(teclaDelMazo({ key: 'ArrowRight' }, libre), 'derecha');
  assert.equal(teclaDelMazo({ key: 'ArrowLeft' }, libre), 'izquierda');
  assert.equal(teclaDelMazo({ key: 'ArrowUp' }, libre), 'arriba');
  assert.equal(teclaDelMazo({ key: 'ArrowDown' }, libre), null);
  // Dejarla apretada: la primera decide, las repetidas no (antes aprobaba un ticket detrás de otro).
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp']) assert.equal(teclaDelMazo({ key, repeat: true }, libre), 'comer', key);
  // El foco en las pestañas Mazo / Tabla: ← → cambian de pestaña, no aprueban.
  assert.equal(teclaDelMazo({ key: 'ArrowRight' }, { ...libre, enFlechas: true }), null);
  // Con la caja abierta (lo que lee el cliente) las flechas no deciden otra cosa.
  assert.equal(teclaDelMazo({ key: 'ArrowRight' }, { ...libre, cajaAbierta: true }), 'comer');
  // En un campo de texto, las teclas son del texto: sólo Escape (cierra la caja).
  assert.equal(teclaDelMazo({ key: 'ArrowRight' }, { ...libre, enCampo: true }), null);
  assert.equal(teclaDelMazo({ key: 'Backspace' }, { ...libre, enCampo: true }), null);
  assert.equal(teclaDelMazo({ key: 'Escape' }, { ...libre, enCampo: true }), 'cerrar');
  // Volver y recorrer, como antes.
  assert.equal(teclaDelMazo({ key: 'Backspace' }, libre), 'volver');
  assert.equal(teclaDelMazo({ key: 'z', ctrlKey: true }, libre), 'volver');
  assert.equal(teclaDelMazo({ key: 'Z', metaKey: true }, libre), 'volver');
  assert.equal(teclaDelMazo({ key: 'ArrowRight', altKey: true }, libre), null);
  assert.equal(teclaDelMazo({ key: 'j' }, libre), 'siguiente');
  assert.equal(teclaDelMazo({ key: 'k' }, libre), 'anterior');
});

// ── D ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('D1: el mazo: lo urgente primero; al refrescar no se rearma, lo nuevo va al final y lo decidido se va', () => {
  const a = ticket({ id: 1, prioridad: 'media', created_at: hace(300) });
  const b = ticket({ id: 2, prioridad: 'urgente', created_at: hace(10) });
  const c = ticket({ id: 3, prioridad: 'media', created_at: hace(600) });
  const cerrado = ticket({ id: 4, estado: 'resuelto' });
  assert.deepEqual(ordenDelMazo([a, b, c, cerrado]), [2, 3, 1]);
  const orden = [2, 3, 1];
  const vistos = versionesDe([a, b, c, cerrado]);
  // Llega uno urgente nuevo y al 3 lo decidió otro: el 3 se va, el nuevo va AL FINAL (aunque sea urgente).
  const nuevo = ticket({ id: 5, prioridad: 'urgente', created_at: hace(1) });
  assert.deepEqual(refrescarMazo(orden, [a, b, ticket({ id: 3, estado: 'rechazado' }), nuevo], vistos, new Set()), [2, 1, 5]);
  // Lo decidido acá que todavía no salió sigue «por decidir» en la base: no vuelve a aparecer.
  assert.deepEqual(refrescarMazo([1, 3], [a, b, c], versionesDe([a, b, c]), new Set([2])), [1, 3]);
  // La lectura VIEJA de lo que se acaba de decidir acá (salió antes de que la decisión llegara a la base): la misma
  // versión que ya se vio, no vuelve (si la decisión falló, la tarjeta vuelve sola adelante).
  assert.deepEqual(refrescarMazo([], [a], versionesDe([a]), new Set()), []);
});

test('D2: lo que VUELVE a esperar a Martín vuelve al mazo con la pantalla abierta (y la tabla y el mazo dicen lo mismo)', () => {
  // El #7: Martín le preguntó al cliente desde el mazo. Salió, y la lectura siguiente lo trae esperando al cliente.
  const pregunto = ticket({ id: 7, estado: 'esperando_decision', updated_at: '2026-10-22T15:00:00.000Z' });
  const esperaCliente = ticket({ id: 7, estado: 'esperando_cliente', updated_at: '2026-10-22T15:00:09.000Z' });
  let vistos = versionesDe([pregunto]);
  let orden = refrescarMazo([], [esperaCliente], vistos, new Set());
  assert.deepEqual(orden, []);
  vistos = versionesDe([esperaCliente]);
  // El cliente contesta (`comentarComoCliente`: vuelve a «por decidir» y toca updated_at).
  const contesto = ticket({ id: 7, estado: 'esperando_decision', updated_at: '2026-10-22T15:20:00.000Z' });
  orden = refrescarMazo(orden, [contesto], vistos, new Set());
  assert.deepEqual(orden, [7], 'volvió al mazo');
  // Lo mismo si el Cerebro lo devuelve (`reclasificar`), aunque la lectura en el medio no se haya visto nunca.
  const aprobado = ticket({ id: 8, estado: 'nuevo', updated_at: '2026-10-22T14:00:00.000Z' });
  const devuelto = ticket({ id: 8, estado: 'esperando_decision', updated_at: '2026-10-22T14:30:00.000Z' });
  assert.deepEqual(refrescarMazo([], [devuelto], versionesDe([aprobado]), new Set()), [8]);
  // El mazo cuenta lo mismo que el filtro «Por decidir» de la tabla.
  const ts = [contesto, devuelto, ticket({ id: 9, estado: 'en_curso' })];
  assert.equal(refrescarMazo([], ts, versionesDe([pregunto, aprobado]), new Set()).length, ts.filter((t) => t.estado === 'esperando_decision' || t.estado === 'nuevo').length);
});

test('D3: la lectura de la bandeja no pierde un pedido que llega en el medio, y pide la vista hasta que la trae', async () => {
  const pedidos: boolean[] = [];
  const aplicados: Array<[boolean | null, boolean]> = [];
  const enVuelo: Array<{ res: (r: { ok: boolean }) => void; rej: (e: Error) => void }> = [];
  const leer = (conVista: boolean) => { pedidos.push(conVista); return new Promise<{ ok: boolean }>((res, rej) => enVuelo.push({ res, rej })); };
  const cargar = lectorDeBandeja(leer, (r, conVista) => aplicados.push([r ? r.ok : null, conVista]));
  const tanda = async () => { for (let k = 0; k < 5; k++) await Promise.resolve(); };
  // La primera falla: la vista no llegó.
  const uno = cargar();
  enVuelo.shift()!.res({ ok: false });
  await uno;
  // La siguiente (un refresco) la vuelve a pedir; mientras está en vuelo llegan dos pedidos (la decisión, el foco).
  const dos = cargar();
  void cargar(); void cargar();
  assert.equal(pedidos.length, 2, 'una lectura a la vez');
  enVuelo.shift()!.res({ ok: true });
  await tanda();
  assert.equal(pedidos.length, 3, 'lo pedido en el medio se lee al terminar (una sola vez)');
  enVuelo.shift()!.res({ ok: true });
  await dos;
  assert.deepEqual(pedidos, [true, true, false], 'la vista se pide hasta que una lectura que anda la trae');
  assert.deepEqual(aplicados, [[false, true], [true, true], [true, false]]);
  // Si se cae la red, se aplica como error (null), no se tira.
  const tres = cargar();
  enVuelo.shift()!.rej(new Error('red'));
  await tres;
  assert.deepEqual(aplicados.at(-1), [null, false]);
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

test('E3: J / K recorren el ticket abierto en el MISMO orden que muestra la tabla (el que eligió, no el de llegada)', () => {
  const ts = [
    ticket({ id: 1, created_at: hace(30), negocio: 'Beta' }),
    ticket({ id: 2, created_at: hace(5), negocio: 'Alfa' }),
    ticket({ id: 3, created_at: hace(90), negocio: 'Gama' }),
  ];
  // La tabla dibuja en el orden que le da la bandeja (no en uno propio).
  const filas = (orden: { col: 'negocio' | 'cuando'; dir: 'asc' | 'desc' }) => [...renderToStaticMarkup(createElement(TablaTickets, {
    tickets: ts, ahoraLista: AHORA, grupo: 'decidir', onGrupo: () => {}, orden, setOrden: () => {}, elegido: null, onAbrir: () => {}, barra: null,
  })).matchAll(/data-ticket="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(filas({ col: 'negocio', dir: 'asc' }), [2, 1, 3]);
  assert.deepEqual(filas({ col: 'negocio', dir: 'desc' }), [3, 1, 2]);
  assert.deepEqual(filas({ col: 'cuando', dir: 'asc' }), [3, 1, 2]);
  // Y J / K usan ESE orden: el mismo estado que recibe la tabla.
  const src = leer('app/tickets/bandeja/BandejaTickets.tsx');
  assert.match(src, /const visibles = ordenarTabla\(\(tickets \?\? \[\]\)\.filter\(\(t\) => enGrupo\(t, grupo\)\), ordenDeTabla\);/);
  assert.match(src, /<TablaTickets [\s\S]*?orden=\{ordenDeTabla\} setOrden=\{setOrdenDeTabla\}/);
  assert.doesNotMatch(leer('app/tickets/bandeja/TablaTickets.tsx'), /useState<Orden>/, 'la tabla no guarda un orden propio');
});

// ── F ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('F1: la tarjeta se entiende en 3 segundos: qué pasó, quién, qué hacer, el tipo; nada de código a la vista', () => {
  // El #5 real, el de la captura de Martín.
  const html = renderToStaticMarkup(createElement(TarjetaTicket, { t: ticket5(), ahora: AHORA, onVerTodo: () => {} }));
  // Desde el 23/10/2026 (feedback 7): el por qué en palabras y QUÉ hay que decidir, como pregunta que se contesta con el ✓.
  const orden = ['MaKo no le pudo contestar a Mauricio en su chat', 'No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya', 'Lo detectó MaKo solo',
    '¿Le pedimos a Mauricio que conecte su IA?', '<b>Estado:</b> el código ya está arreglado · lo decides tú', '>Pedido<', 'Detalle'];
  let desde = 0;
  for (const x of orden) {
    const k = html.indexOf(x, desde);
    assert.ok(k >= 0, `falta (o está fuera de orden): ${x}`);
    desde = k;
  }
  assert.match(html, /aria-label="MaKo"/, 'lo detectó MaKo: su logo, no la cara de la persona');
  assert.doesNotMatch(html, /<img/, 'el automático no lleva la foto de quien lo sufrió');
  assert.doesNotMatch(html, /contestarte/, 'el título que lee el cliente no es lo que lee Martín');
  // Lo técnico PLEGADO: ni el código ni la nota larga a la vista, y «Detalle» cerrado.
  assert.doesNotMatch(html, /<code|veto-claude|lista blanca/);
  assert.doesNotMatch(html, /depende de con qué IA lo hace/);
  assert.match(html, /aria-expanded="false"[^>]*>Detalle/);
  assert.doesNotMatch(html, />Bug</, 'el tipo es el veredicto del Cerebro («pedido»), no «automático con error = Bug»');
  assert.match(html, /#5/);
  // DÓNDE (feedback 7): con el chat que suma la bandeja (`conChatDeLosTickets`), la frase no repite «en su chat» y el
  // renglón dice cuál; de una tab, el de esa tab.
  const enOps = renderToStaticMarkup(createElement(TarjetaTicket, { t: { ...ticket5(), chatDelTicket: { titulo: 'Plan de la semana', clave: 'mako-movil:u1' } }, ahora: AHORA }));
  assert.match(enOps, />MaKo no le pudo contestar a Mauricio</);
  assert.match(enOps, /En su chat «Plan de la semana» del Ops Center/);
  const enCrm = renderToStaticMarkup(createElement(TarjetaTicket, { t: { ...ticket5(), chatDelTicket: { titulo: 'Ana Pérez', clave: 'mako-movil:u1:crm:12' } }, ahora: AHORA }));
  assert.match(enCrm, /En el chat de CRM «Ana Pérez»/);
  // Una persona: su foto, por dónde lo levantó, la pantalla y el negocio.
  const laura = renderToStaticMarkup(createElement(TarjetaTicket, { t: dePersona(), ahora: AHORA }));
  assert.match(laura, /<img src="https:\/\/fotos\.prueba\.test\/laura\.jpg"/, 'la foto de perfil de quien lo levantó');
  assert.match(laura, /Lo levantó Laura desde «Reportar problema»/);
  assert.match(laura, /<span>En «CRM» · Estudio Gómez · <\/span><time/, 'la pantalla primero, en un solo texto');
  assert.match(laura, /No se guardan los cambios del funnel/);
  assert.match(laura, /¿Lo arreglamos\?/, 'qué hay que decidir, como pregunta');
  // Sin foto: las iniciales (la familia de tarjetas), nunca un <img> roto.
  const sinFoto = renderToStaticMarkup(createElement(TarjetaTicket, { t: dePersona({ foto: null, usuario_nombre: 'Mauricio Bustos Eguia' }), ahora: AHORA }));
  assert.doesNotMatch(sinFoto, /<img/);
  assert.match(sinFoto, /class="tk-ini[^"]*"[^>]*>ME</, 'las iniciales de la familia de tarjetas (primera y última palabra)');
  // «Detalle» abierto: el error técnico, la nota entera, el link y «Ver todo». Y ahí el dedo es del scroll, no del gesto.
  const det = renderToStaticMarkup(createElement(DetalleDeLaTarjeta, { t: ticket5(), onVerTodo: () => {} }));
  assert.match(det, /<code>responder: Claude vetado/);
  assert.match(det, /<b>Cerebro<\/b> El arreglo de código ya salió/);
  assert.match(det, /href="\/second-brain\?chat=40&amp;ws=1"[^>]*target="_blank"/);
  assert.match(det, />Ver todo</);
  assert.match(det, /data-sin-gesto=""/);
  assert.match(leer('app/tickets/bandeja/MazoTickets.tsx'), /el\.closest\('textarea, input, a, button, select, \[data-sin-gesto\]'\)/);
  // El nombre de la tarjeta para un lector de pantalla es la MISMA frase, no el título que lee el cliente.
  assert.match(leer('app/tickets/bandeja/MazoTickets.tsx'), /aria-label=\{`Ticket #\$\{t\.id\}: \$\{quePaso\(t\)\}`\}/);
  assert.match(leer('app/tickets/bandeja/bandeja.css'), /\.tickets-bandeja__tecnico \{[^}]*overflow-y: auto;[^}]*touch-action: pan-y;/);
});

// ── G ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('G1: la tarjeta en el CENTRO, sin nada al costado; el «Deshacer» arriba y sutil, fuera de la fila de botones, y «1 de N»', () => {
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  const css = leer('app/tickets/bandeja/bandeja.css');
  assert.doesNotMatch(src + css, /tickets-bandeja__siguen/, 'lo que sigue no se corre al costado');
  assert.match(css, /\.tickets-bandeja__mesa \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.tickets-bandeja__pila \{[^}]*margin: 0 auto;/);
  assert.doesNotMatch(css, /@container tickets \(min-width: 780px\)/, 'ningún ancho la corre del centro');
  // El deshacer NO va con los botones (23/10/2026, Martín: «no va con los otros cuatro: arriba de las tarjetas, sutil, como
  // "Deshacer"»): en la franja de arriba, sólo con algo para deshacer.
  const fila = src.slice(src.indexOf('<div className="tickets-bandeja__pulgar">'));
  assert.doesNotMatch(fila, /tickets-bandeja__gesto--volver|onClick=\{volver\}/, 'fuera de la fila de botones');
  const franja = src.slice(src.indexOf('<header className="tickets-bandeja__franja">'), src.indexOf('</header>'));
  assert.match(franja, /\{hayVuelta && \(\n\s*<button type="button" className="tickets-bandeja__deshacer" onClick=\{volver\}[^>]*>\n\s*<Icon name="regenerar" size=\{14\} \/>Deshacer/);
  assert.match(css, /\.tickets-bandeja__deshacer \{[^}]*background: none;[^}]*color: var\(--dim\);/, 'sutil');
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

test('G3: cada gesto tiene su botón (redondo, del mismo tamaño, sólo el ícono, lo que hace en el title) y su tecla', () => {
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  for (const s of ['izquierda', 'arriba', 'derecha']) assert.match(src, new RegExp(`<BotonGesto s="${s}" a=\\{acciones\\.${s}\\} marcado=\\{marca === '${s}'\\}`));
  // Sin texto visible: lo que hace cada uno va en el title (el «placeholder») y el aria-label.
  const boton = src.slice(src.indexOf('function BotonGesto('), src.indexOf('function CartaArriba('));
  assert.match(boton, /aria-label=\{dice\} title=\{dice\}/);
  assert.doesNotMatch(boton, /<span>|<kbd/);
  // El MISMO tamaño: una sola medida para todos (ninguna variante la pisa).
  const css = leer('app/tickets/bandeja/bandeja.css');
  assert.match(css, /\.tickets-bandeja__gesto \{[^}]*width: 60px; height: 60px;[^}]*border-radius: 50%;/);
  assert.doesNotMatch(css, /\.tickets-bandeja__gesto--(derecha|izquierda|arriba|volver)[^{]*\{[^}]*(width|height|flex):/);
  assert.match(css, /\.tickets-bandeja__gesto\.is-marcado \{/);
  // Qué hace cada tecla lo prueba C3 (`teclaDelMazo`); acá, que el mazo la escuche y que lo que dice llegue a `decidir`.
  assert.match(src, /const a = teclaDelMazo\(e, \{ enCampo, enFlechas, cajaAbierta \}\);/);
  assert.match(src, /else if \(a !== 'comer'\) decidir\(a\);/);
  assert.match(src, /if \(a === 'volver'\) volver\(\);/);
});

test('G4: sin «Actualizar»: se refresca sola; el arreglo automático, en el rayo; la vista se recuerda por persona', () => {
  const src = leer('app/tickets/bandeja/BandejaTickets.tsx');
  assert.doesNotMatch(src, />Actualizar</);
  assert.match(src, /window\.setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) void cargar\(\); \}, REFRESCO_MS\)/);
  assert.match(src, /function AutoArreglo\(/);
  assert.match(src.slice(src.indexOf('function AutoArreglo(')), /<Switch checked=\{prendido\} onChange=\{onCambio\} label="Arreglar solos los bugs evidentes" \/>/);
  assert.match(src, /void guardarVistaAction\(v\)/);
  // La lectura no pierde pedidos y pide la vista hasta tenerla (el comportamiento, en D3).
  assert.match(src, /const cargar = useMemo\(\(\) => lectorDeBandeja\(\(conVista: boolean\) => leerCentro<LecturaBandeja>\('bandeja', conVista \? \{ vista: '1' \} : \{\}\), /);
  assert.match(leer('lib/perfil.ts'), /const TICKETERA_VISTA_KEY = 'ticketeraVista';/);
  assert.match(leer('app/tickets/bandeja/acciones.ts'), /export async function guardarVistaAction\(v: VistaTicketera\)[\s\S]{0,120}if \(!\(await opera\(\)\)\) return/);
});

test('G5: la foto y la última nota salen de la base, en la lectura de Martín (no en la del cliente)', () => {
  const db = leer('lib/tickets-db.ts');
  assert.match(db, /const COLS_MARTIN = `\$\{COLS\}, workspaces\(nombre\), usuarios\(foto_url\)`;/);
  assert.match(db, /export async function bandeja\([\s\S]*?\.select\(COLS_MARTIN\)/);
  assert.match(db, /export async function ticketEntero\([\s\S]*?\.select\(COLS_MARTIN\)/);
  assert.doesNotMatch(db.slice(db.indexOf('export async function misTickets('), db.indexOf('export async function comentarComoCliente(')), /usuarios\(foto_url\)/);
  // ⚠️ ACÁ SE MIDE LA INTENCIÓN Y NO LA FORMA, y el cambio tiene fecha (6/11/2026).
  //
  // Hasta hoy este caso pedía el texto LITERAL `/^https:\/\//i.test(us.foto_url)`, con el rótulo «sólo https». Pero eso
  // no era «sólo https»: era «CUALQUIER https», que es justo el agujero —un cliente ponía de foto una URL de un servidor
  // suyo y su log le decía cuándo Martín abría la bandeja, desde qué IP y con qué navegador. Al cerrarlo con
  // `fotoDePersonaSegura`, esta guarda puso la punta ROJA: fijaba la implementación VIEJA, así que dejaba pasar el bug y
  // frenaba el arreglo. Una guarda que busca el texto del código de antes en vez de la falla hace las dos cosas.
  //
  // Ahora son tres cosas, y la del medio es la que vale: que la foto PASE por el filtro, que el filtro HAGA su trabajo
  // (se ejecuta, no se lee) y que el `https` suelto no vuelva. Los casos del filtro, en tests/foto-persona-origen.test.ts.
  assert.match(db, /const foto = us && typeof us\.foto_url === 'string' \? fotoDePersonaSegura\(us\.foto_url\) : null;/);
  const STORAGE = 'proyecto.supabase.co';
  assert.equal(fotoDePersonaSegura('https://servidor-suyo.com/pixel.gif', { storage: STORAGE }), null, 'la foto de un servidor del cliente no se dibuja');
  assert.equal(fotoDePersonaSegura('https://lh3.googleusercontent.com/a/x', { storage: STORAGE }), 'https://lh3.googleusercontent.com/a/x', 'la del login con Google sí');
  assert.doesNotMatch(db, /https[^\n]*\.test\(us\.foto_url\)/, 'que sea https no alcanza: el origen tiene que ser nuestro');
});

// ── H: lo que DICE la tarjeta, por reglas (22/10/2026, tarde) ─────────────────────────────────────────────────────
test('H1: QUÉ PASÓ en una frase de producto: del chat, de la pantalla o del servidor; la persona, con su título', () => {
  assert.equal(quePaso(ticket5()), 'MaKo no le pudo contestar a Mauricio en su chat');
  assert.equal(quePaso(ticket()), 'MaKo no le pudo contestar a Mauricio en su chat', 'el #6: la misma frase');
  // Otra herramienta: lo que intentó, en las palabras del título; si el título le habla al cliente («avisarte»), no.
  assert.equal(quePaso(ticket({ titulo: 'MaKo no pudo «Mover un lead de etapa»', contexto: { chat: { donde: 'error-mako' }, error: 'x', herramienta: 'mover_lead' } })),
    'MaKo no pudo mover un lead de etapa en el chat de Mauricio');
  assert.equal(quePaso(ticket({ titulo: 'MaKo no pudo «avisarte»', contexto: { chat: { donde: 'error-mako' }, error: 'x', herramienta: 'avisar' } })),
    'MaKo no le pudo avisar a Mauricio en su chat');
  assert.equal(quePaso(ticket({ titulo: 'MaKo no pudo', contexto: { chat: { donde: 'error-mako' }, error: 'x' } })), 'MaKo falló en el chat de Mauricio');
  // Una pantalla, por su nombre en la barra (no la ruta); el servidor.
  assert.equal(quePaso(ticket({ usuario_nombre: 'Ana Torres', titulo: 'La pantalla «CRM» se rompió', contexto: { ruta: '/crm/12', chat: { donde: 'error-navegador' }, error: 'TypeError: x' } })),
    'A Ana se le rompió la pantalla «CRM»');
  assert.equal(quePaso(ticket({ usuario_nombre: 'Ana Torres', contexto: { ruta: '/crm', chat: { donde: 'error-servidor' }, error: 'x' } })), 'A Ana le falló el servidor en «CRM»');
  assert.equal(quePaso(ticket({ usuario_nombre: 'Ana Torres', contexto: { chat: { donde: 'error-navegador' }, error: 'x' } })), 'A Ana se le rompió una pantalla');
  // La persona: su título (ya dice qué pasó, con sus palabras).
  assert.equal(quePaso(dePersona()), 'No se guardan los cambios del funnel');
  // El nombre de pila; un teléfono queda entero.
  assert.equal(primerNombre('Mauricio Bustos Eguia'), 'Mauricio');
  assert.equal(primerNombre('+5491155550000'), '+5491155550000');
  assert.equal(primerNombre('maria lopez'), 'Maria');
  assert.equal(primerNombre('pedro@prueba.test'), 'Pedro');
});

test('H2: la tabla de errores frecuentes: por qué falló y qué hay que hacer, con un genérico que cae bien', () => {
  // Desde el 22/10/2026 la plataforma no presta IA: el por qué lo dice (feedback 7, 23/10/2026).
  assert.deepEqual(errorFrecuente(ERROR_5, 'responder'), { porque: 'No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya', hacer: 'Conectar su IA' });
  assert.deepEqual(errorFrecuente('responder: falló la IA (sin proveedor gratis disponible)', 'responder'), { porque: 'No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya', hacer: 'Conectar su IA' });
  assert.equal(errorFrecuente('resumir: red gratis salteada: datos de clientes', 'resumir').porque, 'No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya');
  assert.equal(errorFrecuente('responder: tu clave de Claude: credit balance is too low').hacer, 'Cargar crédito en su Claude');
  assert.equal(errorFrecuente("TypeError: Cannot read properties of undefined (reading 'map')").hacer, 'Arreglar el código');
  assert.equal(errorFrecuente('duplicate key value violates unique constraint "leads_pkey"').porque, 'La base rechazó lo que se guardaba');
  assert.deepEqual(errorFrecuente('algo raro que nadie vio nunca'), { ...ERROR_GENERICO });
  // La lectura entera del #5: el porqué y el hacer salen de la tabla.
  const l = leerTicket(ticket5());
  assert.deepEqual([l.porque, l.hacer, l.decide], ['No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya', 'Conectar su IA', '¿Le pedimos a Mauricio que conecte su IA?']);
  // Qué hay que decidir, para todo lo de la tabla; lo que no está, como pregunta.
  assert.equal(queDecide('Cargar crédito en su Claude', 'Ana'), '¿Le avisamos a Ana que cargue crédito en su Claude?');
  assert.equal(queDecide('Conectar su IA', null), '¿Le pedimos que conecte su IA?', 'sin persona, sin nombre');
  assert.equal(queDecide('Arreglar el código', 'Ana'), '¿Lo arreglamos?');
  assert.equal(queDecide('Algo nuevo', 'Ana'), '¿Algo nuevo?');
  // El dónde del chat: el de una tab por su clave; uno del Ops Center por su título.
  assert.equal(dondeDelChat({ titulo: 'Plan de la semana', clave: 'mako-movil:u1' }), 'En su chat «Plan de la semana» del Ops Center');
  assert.equal(dondeDelChat({ titulo: null, clave: 'dashboard:marketing' }), 'En el chat de Dashboard');
  assert.equal(dondeDelChat(null), null);
  // Sin error: lo que pide el tipo. Y lo que la app no tiene es un pedido.
  assert.equal(leerTicket(dePersona({ tipo: 'pregunta' })).hacer, 'Responderle');
  assert.equal(leerTicket(dePersona({ tipo: 'pedido' })).hacer, 'Decidir si se hace');
  assert.deepEqual([leerTicket(dePersona({ contexto: { noExiste: true } })).porque, leerTicket(dePersona({ contexto: { noExiste: true } })).hacer],
    ['La app todavía no lo tiene', 'Decidir si se hace']);
});

test('H3: QUIÉN, sin ambigüedad (MaKo solo o la persona, y por dónde), y DÓNDE; el negocio sólo si suma', () => {
  assert.deepEqual(leerTicket(ticket5()).quien, { mako: true, texto: 'Lo detectó MaKo solo' });
  assert.deepEqual(leerTicket(dePersona({ canal: 'chat_app', usuario_nombre: 'Mauricio Bustos Eguia', contexto: {} })).quien,
    { mako: false, texto: 'Lo levantó Mauricio desde el chat de MaKo' });
  assert.equal(leerTicket(dePersona()).quien.texto, 'Lo levantó Laura desde «Reportar problema»');
  assert.equal(leerTicket(dePersona({ canal: 'whatsapp', usuario_nombre: '', usuario_email: 'whatsapp:5491155550000', contexto: {} })).quien.texto,
    'Lo levantó +5491155550000 por WhatsApp');
  assert.equal(leerTicket(dePersona({ canal: 'api', contexto: {} })).quien.texto, 'Lo levantó Laura por la API');
  // La pantalla de la persona; en un automático la dice la frase.
  assert.equal(leerTicket(dePersona()).donde, 'En «CRM»');
  assert.equal(leerTicket(ticket({ contexto: { ruta: '/crm', chat: { donde: 'error-navegador' }, error: 'x' } })).donde, null);
  // «Mauricio Bustos» es el negocio de Mauricio Bustos Eguia: no se repite. Otro negocio, sí; sin nombre, su número.
  assert.equal(leerTicket(ticket5()).negocio, null);
  assert.equal(leerTicket(dePersona()).negocio, 'Estudio Gómez');
  assert.equal(leerTicket(dePersona({ negocio: null, workspace_id: 34 })).negocio, 'Negocio 34');
});

test('H4: el tipo es el de la FILA, el último juicio: lo que el Cerebro devolvió como «no es un bug» no vuelve a decir Bug', () => {
  // Los #5 y #6 reales: el triage dijo bug (el error lo vio el código) y el Cerebro los devolvió con `reclasificar <n>
  // pedido` («no se arregla con código»). La tarjeta, la tabla y el ✓ dicen su veredicto.
  assert.equal(leerTicket(ticket5()).tipo, 'pedido');
  assert.equal(leerTicket(ticket()).tipo, 'pedido');
  assert.equal(leerTicket(ticket({ tipo: 'pregunta' })).tipo, 'pregunta');
  assert.equal(leerTicket(ticket({ tipo: 'bug' })).tipo, 'bug');
  // El pedido que se le firma al Cerebro lleva la fila tal cual (su `Tipo:`), desde el mazo y desde el ticket entero.
  assert.match(leer('app/tickets/bandeja/MazoTickets.tsx'), /pedidoAlCerebro\(p\.t, d, null\)/);
  const bandeja = leer('app/tickets/bandeja/BandejaTickets.tsx');
  assert.match(bandeja, /pedidoAlCerebro\(fila, decision, notaCerebro \|\| null\)/);
  assert.match(bandeja, /decisionDeAprobar\(t\.tipo\)/);
});

test('H5: la nota del Cerebro, en UNA línea («Estado: …»); la entera queda plegada', () => {
  assert.equal(estadoDeLaNota({ actor: 'cerebro', tipo: 'reclasificado', texto: NOTA_5, at: '' }), 'el código ya está arreglado · lo decides tú');
  assert.equal(estadoDeLaNota({ actor: 'cerebro', tipo: 'reclasificado', texto: NOTA_6, at: '' }), 'igual que el #5 · no es de código · lo decides tú');
  assert.equal(estadoDeLaNota({ actor: 'cliente', tipo: 'comentario', texto: 'Lo intenté desde el teléfono y no me deja: dice que falta un permiso.', at: '' }),
    'respondió «Lo intenté desde el teléfono y no me deja: dice que falta…»');
  // Sin una pieza conocida: el comienzo hasta el primer corte, nunca un párrafo.
  const otra = estadoDeLaNota({ actor: 'cerebro', tipo: 'nota', texto: 'Lo toma el jefe de CRM. Va en la tanda de mañana, con el resto de los arreglos del funnel y la ficha.', at: '' })!;
  assert.equal(otra, 'lo toma el jefe de CRM');
  assert.ok(estadoDeLaNota({ actor: 'cerebro', tipo: 'nota', texto: 'palabra '.repeat(60), at: '' })!.length <= 81);
  assert.equal(estadoDeLaNota(null), null);
  assert.equal(estadoDeLaNota({ actor: 'cerebro', tipo: 'nota', texto: '  ', at: '' }), null);
});

test('H6: al arrastrar se marca el botón del gesto: el del eje más largo, pasado el umbral; hacia abajo ninguno', () => {
  assert.equal(gestoMarcado(MARCA_PX, 0), 'derecha');
  assert.equal(gestoMarcado(-MARCA_PX, 5), 'izquierda');
  assert.equal(gestoMarcado(10, -MARCA_PX - 1), 'arriba');
  assert.equal(gestoMarcado(MARCA_PX - 1, 0), null, 'un temblor no marca');
  assert.equal(gestoMarcado(0, 200), null, 'abajo no hace nada');
  assert.equal(gestoMarcado(0, 0), null);
  // El mazo la escucha mientras se arrastra, y la marca al decidir con una tecla.
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  assert.match(src, /const m = gestoMarcado\(x\.get\(\), y\.get\(\)\);/);
  assert.match(src, /setMarca\(s\);\n\s*void \(manejo\.current\?\.volar/);
});

test('H7: la TABLA dice lo mismo: la columna «Qué pasó» con la frase de la tarjeta', () => {
  const html = renderToStaticMarkup(createElement(TablaTickets, {
    tickets: [ticket5(), dePersona()], ahoraLista: AHORA, grupo: 'decidir', onGrupo: () => {}, orden: ORDEN_INICIAL, setOrden: () => {}, elegido: null, onAbrir: () => {}, barra: null,
  }));
  assert.match(html, />Qué pasó</);
  assert.match(html, /MaKo no le pudo contestar a Mauricio en su chat/);
  assert.doesNotMatch(html, /contestarte/);
  assert.match(html, /tickets-bandeja__tipo--pedido">Pedido</, 'el #5: el tipo de la fila, el mismo de la tarjeta');
  assert.match(html, /No se guardan los cambios del funnel/);
  // Ordenar por esa columna ordena por lo que se ve.
  assert.deepEqual(ordenarTabla([dePersona({ id: 1 }), ticket5()], { col: 'titulo', dir: 'asc' }).map((t) => t.id), [5, 1]);
});

test('H8: la frase nunca dice algo FALSO: sin persona, la regresión, el contador pegado, el permiso, lo que devolvió el Cerebro', () => {
  // Sin persona (un cron, un webhook, MaKo en WhatsApp sin saber quién): la identidad del SISTEMA no es un afectado.
  const sistema = (p: Partial<FilaTicket>) => ticket({ usuario_nombre: 'MaKo (lo detectó solo)', usuario_email: EMAIL_DEL_SISTEMA, negocio: 'Plataforma', foto: null, ...p });
  assert.equal(quePaso(sistema({ titulo: 'Falló la pantalla «CRM»', contexto: { ruta: '/crm', chat: { donde: 'error-servidor' }, error: 'Error: boom' } })), 'Falló el servidor en «CRM»');
  assert.equal(quePaso(sistema({ contexto: { chat: { donde: 'error-servidor' }, error: 'MontajeCron: x' } })), 'Falló el servidor');
  assert.equal(quePaso(sistema({ contexto: { ruta: '/crm', chat: { donde: 'error-navegador' }, error: 'TypeError: x' } })), 'Se rompió la pantalla «CRM»');
  assert.equal(quePaso(sistema({})), 'MaKo no pudo contestar en un chat');
  assert.equal(quePaso(sistema({ titulo: 'MaKo no pudo «Mover un lead de etapa»', contexto: { chat: { donde: 'error-mako' }, error: 'x', herramienta: 'mover_lead' } })),
    'MaKo no pudo mover un lead de etapa en un chat');
  assert.equal(leerTicket(sistema({})).negocio, null, 'el negocio de la plataforma no es el de un cliente');
  assert.deepEqual(leerTicket(sistema({})).quien, { mako: true, texto: 'Lo detectó MaKo solo' });
  // La identidad del sistema es ésa (lib/errores-app.ts → identidadDelSistema): si cambia, esto se entera.
  assert.ok(leer('lib/errores-app.ts').includes(`email: '${EMAIL_DEL_SISTEMA}', nombre: 'MaKo (lo detectó solo)'`));

  // Una REGRESIÓN (`Volvió a pasar: …`, lib/errores-app.ts → abrirTicket): la frase lo dice, y lo que intentó se sigue leyendo.
  const ana = { usuario_nombre: 'Ana Torres', usuario_email: 'ana@prueba.test' };
  assert.equal(quePaso(ticket({ ...ana, titulo: 'Volvió a pasar: MaKo no pudo «Mover un lead de etapa»', contexto: { chat: { donde: 'error-mako' }, error: 'x', herramienta: 'mover_lead' } })),
    'Volvió a pasar: MaKo no pudo mover un lead de etapa en el chat de Ana');
  assert.equal(quePaso(ticket({ ...ana, titulo: 'Volvió a pasar: Falló la pantalla «CRM»', contexto: { ruta: '/crm', chat: { donde: 'error-servidor' }, error: 'x' } })),
    'Volvió a pasar: a Ana le falló el servidor en «CRM»');

  // El contador y el digest que le pega `ticketDeError` no son el error: un TypeError de 429 veces no es «la IA saturada».
  assert.equal(errorFrecuente("TypeError: Cannot read properties of undefined (reading 'x') · 429 veces").porque, 'Un error de programación');
  assert.deepEqual(errorFrecuente('Error: algo raro · 503 veces'), { ...ERROR_GENERICO });
  assert.deepEqual(errorFrecuente('Error: algo raro (digest 529) · 2 veces'), { ...ERROR_GENERICO });
  assert.equal(errorFrecuente('responder: overloaded_error · 3 veces').porque, 'La IA estaba saturada', 'lo que sí es saturación se sigue leyendo');

  // «Permission denied» a secas es del navegador (el micrófono); el de la base dice sobre qué.
  assert.equal(errorFrecuente('NotAllowedError: Permission denied').porque, 'El navegador no le dio permiso');
  assert.equal(errorFrecuente('Error: permission denied for table leads').porque, 'La base no le dio permiso');
  assert.equal(errorFrecuente('Error: new row violates row-level security policy for table «…»').porque, 'La base no le dio permiso');

  // Lo que el Cerebro devolvió como «no es un bug» no dice «Arreglar el código»: manda su veredicto. Lo del NEGOCIO, sí.
  const devuelto = (tipo: FilaTicket['tipo']) => leerTicket(ticket({ tipo, contexto: { chat: { donde: 'error-navegador' }, ruta: '/crm', error: 'Error: algo raro' } }));
  assert.equal(devuelto('pedido').hacer, 'Decidir si se hace');
  assert.equal(devuelto('pregunta').hacer, 'Responderle');
  assert.equal(devuelto('bug').hacer, 'Arreglar el código');
  assert.equal(leerTicket(ticket5()).hacer, 'Conectar su IA');
});

test('H9: la marca del botón no queda encendida cuando la tarjeta se va, y la fila entra en un panel muy angosto', () => {
  const src = leer('app/tickets/bandeja/MazoTickets.tsx');
  assert.match(src, /useEffect\(\(\) => \(\) => onMarca\(null\), \[onMarca\]\);/);
  const css = leer('app/tickets/bandeja/bandeja.css');
  const angosto = /@container tickets \(max-width: 300px\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(angosto, 'falta el corte de 300 px');
  const w = Number(/\.tickets-bandeja__gesto \{ width: (\d+)px; height: \1px; \}/.exec(angosto![1])?.[1]);
  const gap = Number(/\.tickets-bandeja__pulgar \{ gap: (\d+)px; \}/.exec(angosto![1])?.[1]);
  assert.ok(4 * w + 3 * gap <= 248, `4 botones de ${w} px con ${gap} px entre ellos no entran en 248 px (280 menos el margen del teléfono)`);
});
