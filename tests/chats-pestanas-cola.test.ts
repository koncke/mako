// =============================================================================
// Los chats de las pestañas: el scroll y la cola de salida (auditoría de chats del 20/11, pestanas-1 a 13)
// =============================================================================
// La auditoría (auditoria-chats-pestanas-movil-admin-20-11.md) encontró dos males repetidos en los chats de las pestañas:
//   R1. El hilo no baja: el scroll dependía de una CUENTA (`items.length + escribiendo`, `mensajes.length`) que no cambia cuando la
//       respuesta reemplaza a los puntitos, ni cuando entra una nota de voz, ni cuando crece la caja o lo que va arriba de ella.
//   R2-R4. Todo sale de golpe: la respuesta de la persona, la pregunta que sigue y sus pastillas (o el texto y su tarjeta) en el
//       mismo cuadro, sin puntitos.
// El arreglo usa SÓLO las piezas comunes (el Cerebro: «nada propio»): el gancho `useBajarAlUltimo` (app/_chat/useBajarAlUltimo.ts,
// por la clave de la ÚLTIMA fila, nunca una cuenta, y con su ResizeObserver para lo que crece mientras está abajo) y la cola
// `useColaDeSalida` (app/_chat/useColaDeSalida.ts) con `msEscribiendo` y `MS_PAUSA_PIEZA`, a través de un adaptador fino para los
// hilos de ítems: app/_chat/useColaDelHilo.ts.
// Correr: node --import tsx --test tests/chats-pestanas-cola.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 16/0): ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasDeItems } from '../app/_chat/useColaDelHilo';
import { filasVisibles, pasoDeLaCola, msEscribiendo, MS_PAUSA_PIEZA, type EstadoCola } from '../app/_chat/useColaDeSalida';
import { leerConfig } from '../lib/newsletter-reglas';
import type { ItemHilo } from '../app/m/mako/chat-ui';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const leer = (f: string) => sinComentarios(readFileSync(f, 'utf8'));

const msg = (id: string, role: 'user' | 'assistant', texto: string) => ({ k: 'msg', id, role, texto }) as unknown as ItemHilo;
const tarjeta = (id: string) => ({ k: 'tarjeta', id }) as unknown as ItemHilo;

test('el adaptador: lo de MaKo con su texto y su pieza, lo de la persona y las tarjetas sueltas ya, lo ya visto de una', () => {
  const filas = filasDeItems([msg('y1', 'user', 'hola'), msg('m1', 'assistant', 'Te pregunto algo'), tarjeta('t1'), msg('m2', 'assistant', 'Ya')],
    (id) => id === 'm2');
  assert.deepEqual(filas, [
    { id: 'y1', de: 'yo', texto: 'hola', pieza: false },
    { id: 'm1', de: 'mako', texto: 'Te pregunto algo', pieza: true },
    { id: 't1', de: 'tarjeta', texto: '' },
    { id: 'm2', de: 'ya-visto', texto: '' },
  ]);
});

test('sobre la cola común: la pregunta con sus puntitos, después el texto, y la pieza (las pastillas, la tarjeta) a su pausa', () => {
  const filas = filasDeItems([msg('y1', 'user', 'Sí'), msg('m1', 'assistant', 'Y tu presupuesto?'), tarjeta('t1')]);
  const vacio: EstadoCola = { mostrados: new Set(), piezas: new Set(), ultimo: null, desde: null };
  // Lo de la persona, ya; la pregunta de MaKo no se dibuja todavía, y la tarjeta que viene detrás tampoco.
  assert.deepEqual(filasVisibles(filas, vacio.mostrados).map((f) => f.id), ['y1']);
  const e1: EstadoCola = { ...vacio, mostrados: new Set(['y1']) };
  const p1 = pasoDeLaCola(filas, e1, () => false, 1000);
  assert.equal(p1.tipo, 'esperar');
  assert.ok(p1.tipo === 'esperar' && p1.escribiendo && p1.ms === msEscribiendo('Y tu presupuesto?'), 'los puntitos, lo que dura según su largo');
  const p2 = pasoDeLaCola(filas, { ...e1, desde: 1000 }, () => false, 1000 + msEscribiendo('Y tu presupuesto?'));
  assert.deepEqual(p2, { tipo: 'mostrar', id: 'm1', conPieza: false }, 'el texto sale sin su pieza');
  const e3: EstadoCola = { ...e1, mostrados: new Set(['y1', 'm1']), ultimo: { id: 'm1', en: 5000 }, desde: null };
  assert.deepEqual(pasoDeLaCola(filas, e3, () => false, 5000 + MS_PAUSA_PIEZA - 1), { tipo: 'esperar', ms: 1, escribiendo: false });
  assert.deepEqual(pasoDeLaCola(filas, e3, () => false, 5000 + MS_PAUSA_PIEZA), { tipo: 'pieza', id: 'm1' }, 'la pieza, después de la pausa');
});

// Offer (pestanas-2 y pestanas-12) lo cubre el chat del onboarding (coaches-7 y coaches-8, tests/chats-de-a-uno.test.ts).
test('pestanas-1 y 2: Automations y MaKo Analyst bajan por la ÚLTIMA fila con el gancho común, sin `abajo` propio', () => {
  const vista = leer('app/automations/ChatMakoVista.tsx');
  assert.match(vista, /useBajarAlUltimo\(seguir, `\$\{ultimo \? ultimo\.id : ''\}\|/);
  assert.doesNotMatch(vista, /items\.length \+ \(|estaAbajo|onScroll=/, 'volvió la cuenta de filas o el `abajo` propio');
  const analyst = leer('app/crm/lead-view/MakoAnalystLead.tsx');
  assert.match(analyst, /useBajarAlUltimo\(seguirHilo, `\$\{leadId\}\|\$\{ultimaFila \? ultimaFila\.id : ''\}\|/);
  assert.doesNotMatch(analyst, /if \(abajo\.current|estaAbajo\(/, 'MakoAnalystLead: el `abajo` propio frena también los mensajes nuevos');
});

// Las siete pantallas con notas de voz: el hilo que se dibuja ES `nota.conNotas(items)` (por la cola, donde la hay) y la clave del
// gancho es su última fila. Sin su scroll propio (el `scrollTop = scrollHeight` de cada una, o el `scrollIntoView` del Dashboard).
const CON_NOTAS = [
  ['app/_components/MakoChat.tsx', 'sin cola'],
  ['app/whatsapp/WhatsAppAdvisor.tsx', 'sin cola'],
  ['app/copywriter/PanelMaKo.tsx', 'cola'],
  ['app/dashboard/PanelEditarMako.tsx', 'cola'],
  ['app/image-editor/mako/chat/PanelMakoIA.tsx', 'cola'],
  ['app/video-editor/_opencut/chat/PanelChat.tsx', 'cola'],
  ['app/web-generator/editor/paneles/PanelAgente.tsx', 'cola'],
] as const;

test('pestanas-3 y 4: la nota de voz y lo que crece (la caja, lo de arriba de la caja) los sigue el gancho común', () => {
  for (const [f, tipo] of CON_NOTAS) {
    const s = leer(f);
    if (tipo === 'cola') {
      assert.match(s, /const cola = useColaDelHilo\(nota\.conNotas\(items\), \{ ocupado: /, `${f}: la cola, sobre las notas`);
      assert.match(s, /const filasDelHilo = cola\.items;/, `${f}: el hilo es lo que ya salió de la cola`);
    } else assert.match(s, /const filasDelHilo = nota\.conNotas\(items\);/, `${f}: la clave sobre las notas`);
    assert.match(s, /useBajarAlUltimo\(seguirHilo, `\$\{filasDelHilo\[filasDelHilo\.length - 1\]\?\.id \?\? (''|"")\}/, `${f}: la clave es la ÚLTIMA fila del hilo con notas`);
    // El `scrollIntoView({ block: "center" })` del Video Editor no es bajar: centra la propuesta que abre un link (`?propuesta=`).
    assert.doesNotMatch(s, /\.scrollTop = [a-zA-Z.]+\.scrollHeight|scrollIntoView\(\{ block: ['"]end['"]/, `${f}: volvió el scroll propio`);
  }
});

test('pestanas-5: la réplica del Copywriter baja con lo que aparece después de la tarjeta (las ofertas, los datos, «Guardando…»)', () => {
  const s = leer('app/copywriter/PanelMaKo.tsx');
  const clave = s.slice(s.indexOf('useBajarAlUltimo(seguirHilo, `'), s.indexOf('`);', s.indexOf('useBajarAlUltimo(seguirHilo, `')));
  for (const parte of ['pasoActual?.id', 'replicaHecha?.mensaje', 'guardandoDato', 'datosRep', 'pildorasGuion']) {
    assert.ok(clave.includes(parte), `la clave del scroll no mira ${parte}`);
  }
});

test('pestanas-6: Media Buyer, CoPilot y Newsletter por la cola; las pastillas después de su mensaje; la primera visita, con puntitos', () => {
  for (const [f, chat] of [['app/ads-manager/ArranqueMediaBuyer.tsx', 'media-buyer'], ['app/ads-manager/PrimeraEntrada.tsx', 'copilot'], ['app/newsletters/NewslettersApp.tsx', 'newsletter']] as const) {
    const s = leer(f);
    assert.match(s, new RegExp(`const primeraVez = usePrimeraVisita\\('${chat}'\\);`), `${f}: la marca de la primera visita`);
    assert.match(s, /const cola = useColaDelHilo\(items, \{ ocupado[^\n]*, deUnaAlAbrir: !primeraVez \}\);/, `${f}: el hilo por la cola`);
    assert.match(s, /<HiloMako items=\{cola\.items\}/, `${f}: dibuja lo que ya salió`);
  }
  const mb = leer('app/ads-manager/ArranqueMediaBuyer.tsx');
  assert.match(mb, /const opciones = ultimo\?\.de === 'mako' && cola\.conPieza\(`of-\$\{ultimo\.id\}`\) \? ultimo\.opciones \?\? \[\] : \[\];/);
  assert.match(mb, /const enMensaje = \(m: \{ id: string \}\): EnMensaje \| null => \(cola\.conPieza\(m\.id\) \? enMensajeDelPaso\(m\) : null\);/, 'la tarjeta del plan, después de su texto');
  const cp = leer('app/ads-manager/PrimeraEntrada.tsx');
  assert.match(cp, /const opciones = piezaLista && !conOpcionesDeNota/);
  assert.match(cp, /const enMensaje = \(m: \{ id: string \}\): EnMensaje \| null => \(cola\.conPieza\(m\.id\) \? enMensajeDelPaso\(m\) : null\);/);
  // Newsletter: lo que contestó la persona, ANTES de la acción del servidor (los puntitos salían debajo de la pregunta).
  const nl = leer('app/newsletters/NewslettersApp.tsx');
  assert.match(nl, /setDicho\(\{ id: `nl-\$\{pregunta\.id\}-r`, texto: t \}\);\n\s*setTexto\(''\);\n\s*const r = await responderAperturaAction\(pregunta\.id, t\);/);
});

test('pestanas-7: las preguntas guionadas del Copywriter salen por la cola, y sus pastillas después', () => {
  const s = leer('app/copywriter/PanelMaKo.tsx');
  assert.match(s, /const colaGuion = useColaDeSalida\(filasGuion, \{ historial: \(\) => filasGuion\.map\(\(x\) => x\.id\) \}\);/);
  assert.equal((s.match(/\{verGuion && <div className="nt-mako-bienvenida">/g) ?? []).length, 2, 'la de la plantilla y la de la réplica');
  assert.equal((s.match(/\{pildorasGuion && <div className="nt-mako-pildoras">/g) ?? []).length, 2);
  assert.match(s, /guionYaVisto\.current\.add\(String\(qa\[0\]\.id\)\);/, 'la pregunta contestada pasa al hilo ya vista: sin puntitos otra vez');
  assert.match(s, /deUna: \(x\) => guionYaVisto\.current\.has\(x\)/);
});

test('pestanas-8: lo que llega junto (varias burbujas, el texto y su tarjeta) sale de a uno, y la tarjeta después del texto', () => {
  for (const [f] of CON_NOTAS.filter(([, t]) => t === 'cola')) {
    const s = leer(f);
    assert.match(s, /const enMensajeConCola = \(x: Extract<ItemHilo, \{ k: ['"]msg['"] \}>\): EnMensaje \| null => \{ const e = enMensaje\(x\); return e && !cola\.conPieza\(x\.id\) \? \{ \.\.\.e, abajo: null \} : e; \};/, `${f}: la tarjeta antes de tiempo`);
    assert.match(s, /enMensaje=\{enMensajeConCola\}/, `${f}: el hilo no usa el hueco con la pausa`);
    assert.match(s, /\|\| cola\.escribiendo/, `${f}: sin los puntitos de la cola`);
  }
  const vista = leer('app/automations/ChatMakoVista.tsx');
  assert.match(vista, /const cola = useColaDelHilo\(p\.items, \{ ocupado: !!p\.escribiendo, cargado: p\.cargado \?\? true \}\);/);
  assert.match(vista, /return e && !cola\.conPieza\(x\.id\) \? \{ \.\.\.e, abajo: null \} : e;/, 'la tarjeta de la pregunta, después');
});

test('pestanas-9: Automations con puntitos mientras arma en el servidor; la nota por la cola; lo guardado, de una al leerse', () => {
  const s = leer('app/automations/ChatMako.tsx');
  assert.match(s, /escribiendo=\{trabajando \|\| interpretando \|\| enServidor \? \{ segs: segundos \} : null\}\n\s*cargado=\{chatLeido\}/);
  assert.match(s, /setMensajes\(\(ms\) => \[\.\.\.ms, \{ id: nota\.id, de: 'mako', texto: nota\.texto,/, 'la nota entra al hilo (y sale por la cola de la vista)');
  assert.doesNotMatch(s, /setTimeout\([^]{0,200}msEscribiendo/, 'una espera propia en vez de la cola');
  assert.match(s, /finally \{ if \(sigue\(\)\) setChatLeido\(true\); \}/);
});

test('pestanas-10: el gráfico lee su charla con el cargador de la casa, no con los puntitos de MaKo', () => {
  const s = leer('app/_components/MakoChat.tsx');
  assert.match(s, /\{cargando && <CargandoMako que="la conversación" \/>\}/);
  const abrir = s.slice(s.indexOf('const abrirSesion'), s.indexOf('\n  };', s.indexOf('const abrirSesion')));
  assert.match(abrir, /setCargando\(true\)/);
  assert.match(abrir, /setMessages\(\[\]\)/, 'la conversación anterior queda debajo de la carga');
  assert.doesNotMatch(abrir, /setPensando\(true\)/, 'leer no es pensar');
});

test('pestanas-11: Newsletter guarda sus propuestas; al recargar se redibujan sin pedirlas y «Otra idea» queda en el hilo', () => {
  const PRO = [{ asunto: 'Uno', idea: 'La idea uno' }, { asunto: 'Dos', idea: 'La idea dos' }];
  assert.deepEqual(leerConfig({ tema: 'x', propuestas: PRO }).propuestas, PRO);
  assert.equal('propuestas' in leerConfig({ tema: 'x' }), false, 'sin propuestas, la config de siempre');
  assert.equal(leerConfig({ propuestas: Array.from({ length: 9 }, (_, i) => ({ asunto: `a${i}`, idea: 'i' })) }).propuestas?.length, 6);
  assert.deepEqual(leerConfig({ propuestas: [{ asunto: 1 }, null, PRO[0]] }).propuestas, [PRO[0]], 'lo roto no entra');
  const acc = leer('app/newsletters/actions.ts');
  assert.match(acc, /if \(p\.ok\) await guardarConfigNewsletter\(\{ propuestas: \[\.\.\.\(cfg\.propuestas \?\? \[\]\), \{ asunto: p\.asunto, idea: p\.idea \}\] \}\)/);
  const nl = leer('app/newsletters/NewslettersApp.tsx');
  assert.match(nl, /if \(pregunta \|\| pedida\.current \|\| propuestas\.length\) return;/, 'al recargar pedía otra');
  assert.match(nl, /cierres\.push\(\{ id: `nl-otra-\$\{i\}`, de: 'yo', texto: OTRA, at: '' \}\);/, '«Otra idea», como mensaje de la persona');
});

test('pestanas-13: la charla de la apertura del Image Editor la sigue el gancho (lo que crece mientras está abajo)', () => {
  const s = leer('app/image-editor/mako/chat/PanelMakoIA.tsx');
  assert.match(s, /const seguirHilo = useCallback\(\(\) => [a-zA-Z]+\.current, \[\]\);/);
  assert.match(s, /useBajarAlUltimo\(seguirHilo, /);
  // El gancho observa el hilo y sus hijos (app/_chat/useBajarAlUltimo.ts, `bajarAlCrecer`): la apertura crece adentro.
  assert.match(leer('app/_chat/useBajarAlUltimo.ts'), /mirarHijos\(\)/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 12/0; al restaurar, 12/0 otra vez). Cada rotura, de a una:
//   - el adaptador sin la pieza de MaKo (`pieza: false`) → 10/2
//   - pestanas-1: Automations por la cuenta de ítems (`${cola.items.length}`) → 11/1
//   - pestanas-2: Analyst con una clave que no cambia (`ultimaFila.k`) → 11/1; con su `estaAbajo` de vuelta → 11/1
//   - pestanas-3: MakoChat sin las notas en la clave (`filasDelHilo = items`) → 11/1
//   - pestanas-4: WhatsApp Advisor con su `scrollTop = scrollHeight` → 11/1; el Video Editor con un `scrollIntoView({ block: "end" })` → 11/1
//   - pestanas-5: la clave del Copywriter sin `guardandoDato` → 11/1
//   - pestanas-6: las pastillas del Media Buyer sin esperar `conPieza` → 11/1; Newsletter dibuja la respuesta después del servidor → 11/1
//   - pestanas-7: las pastillas guionadas del Copywriter sin esperar la cola → 11/1
//   - pestanas-8: el Image Editor con `enMensaje` sin la cola → 11/1
//   - pestanas-9: Automations sin puntitos con `enServidor` → 11/1
//   - pestanas-10: el gráfico con `setPensando(true)` al leer → 11/1
//   - pestanas-11: la config con `propuestas` siempre (vacías también) → 11/1
//   - pestanas-13: `seguirHilo` sin `useCallback` → 11/1
// Offer (pestanas-2 y 12) no está acá: es del chat del onboarding (coaches-7 y 8).
