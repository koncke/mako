// =============================================================================
// La CARCASA de la tab Chats: bandeja, lista y drawer copiados de respond.io (app/chats/)
// =============================================================================
// Pedido de Martín (14/10/2026): una bandeja unificada de WhatsApp + Instagram + Messenger «algo como
// respond.io… sobre todo el diseño que se vea bien» (docs/diseno-chats.md). Lo que este archivo fija,
// porque ninguno de esos errores da un error:
//   · UN LINK QUE NO MATCHEA NO ABRE OTRA CONVERSACIÓN (plano §4). La bandeja vieja de /whatsapp abría el
//     primer chat de la lista con un `?lead=` que no encontraba: la conversación de OTRA persona, con el
//     composer listo para escribirle. Se EJECUTA lista-reglas.ts (resolver, esperar una lectura, soltar).
//   · La ventana del chat se monta con `key={…clave}`: sin la key, React reusa la instancia y una nota de
//     voz grabada en A sale al contacto B (tests/whatsapp-sexta-tanda.test.ts).
//   · El scope `.rio`: cada selector de chats.css empieza en la raíz de la tab y ninguno es de elemento
//     pelado; el oscuro va en `[data-tema="oscuro"] .rio`. Un `button { … }` suelto pinta TODO MaKo.
//   · Los tokens: todo `var(--rio-*)` que usa app/chats/ (incluida la ventana, que es de otro equipo y
//     estila con ESTOS tokens) está definido; un token que falta no da error, el color cae a nada.
//   · Los menús del Dropdown de la casa con el portal ADENTRO de `.rio` (AGENTS.md «portales dentro del
//     scope»): montados en <body> se dibujan sin colores, sin un solo error.
//   · Lo que se guarda en el navegador lleva el ws en la clave (AGENTS.md): el super admin abre un cliente
//     por pestaña y el filtro de uno aparecía en el otro.
//   · Sin <select> nativo (el Dropdown de la casa) y sin next/link (app/_ui/Link, que lleva el ?ws=).
//   · La hora de la fila («1:44 p. m.», «Ayer», «Viernes», «27 mar») y la segunda línea («(Imagen)»).
//   · El título de una tarjeta de «Actividad» sale del COPY que escribe lib/chats-reglas.ts: si ese copy
//     cambia, la tarjeta cae en «Actividad» con su texto; este test avisa antes de que pase callado.
// Correr: node --import tsx --test tests/chats-pantalla.test.ts
//
// ── Roturas (14/10/2026, scratchpad/romper-chats-pantalla.mjs: una por vez, restaurada de MEMORIA y
//    comparada byte a byte, nunca con git). Base: 13 pasan / 0 fallan. Cada rotura tumbó SU test
//    (pasan / fallan):
//   · resolverLinkProfundo con `?? chats[0]` en el lead      -> 12 / 1  «un link que no matchea…»
//   · pasoDelLink que nunca suelta (siempre 'esperar')       -> 12 / 1  «un link que no matchea…»
//   · ChatsApp: `setSeleccion(todos[0])` al soltar el link   -> 12 / 1  «ChatsApp resuelve los links…»
//   · VentanaChat montada sin `key={seleccion.clave}`        -> 12 / 1  «la ventana se monta con key…»
//   · VentanaChat sin `onClaveCambio`                        -> 12 / 1  «la ventana se monta con key…»
//   · `button { margin: 0 }` suelto en chats.css             -> 12 / 1  «chats.css: todo bajo .rio…»
//   · `.rio button { … }` (elemento pelado bajo el scope)    -> 12 / 1  «chats.css: todo bajo .rio…»
//   · `--rio-bubble-in` borrado del claro                    -> 12 / 1  «todo var(--rio-*)…»
//   · `--rio-danger` borrado del bloque oscuro               -> 12 / 1  «todo var(--rio-*)…»
//   · un Dropdown sin `portalTo={portalRio()}`               -> 12 / 1  «los Dropdown … llevan el portal…»
//   · claveLocalChats sin el ws                              -> 12 / 1  «lo que se guarda en el navegador…»
//   · `guardarLocal(almacenLocal(), null, …)` en ChatsApp    -> 12 / 1  «lo que se guarda en el navegador…»
//   · un `<select>` en ListaChats                            -> 12 / 1  «sin <select> nativo…»
//   · horaDeFila contando de a 24 h en vez de por calendario -> 12 / 1  «la hora de la fila…»
//   · previewDe con el nombre del documento                  -> 12 / 1  «la segunda línea…»
//   · claseDeEvento sin el caso «Asignación quitada»         -> 12 / 1  «la Actividad reconoce…»
//   · el sondeo sin mirar la pestaña visible                 -> 12 / 1  «la página y la carcasa…»
//   · page.tsx sin `await guardOnboarding()`                 -> 12 / 1  «la página y la carcasa…»
// Restaurado: 13 / 0.
//
// ⚠️ DOS TRAMPAS QUE SE VIERON ARMANDO ESTO. (1) Los archivos de app/chats/ vienen con CRLF o LF según
//    quién los escribió (el repo corre con core.autocrlf=true): una rotura que busca `…\n` en un archivo
//    CRLF «no aplica» y parece que el test no la caza. Las regex de abajo no dependen del fin de línea.
//    (2) Un `while (re.test(s)) s = s.replace(re, '()')` cuyo reemplazo vuelve a matchear NO TERMINA: el
//    test colgado se reporta a los 120 s como un «test failed» en la línea 1, sin decir cuál.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatResumen, IdentidadCanal } from '../lib/chats-tipos';
import { TIPOS_EVENTO_CHAT, partesDeAudit, partesDeEvento, textoDePartes } from '../lib/chats-reglas';
import {
  claseDeEvento, claveDelLink, claveLocalChats, filtroRecordado, guardarLocal, horaDeFila, leerLinkProfundo, leerLocal,
  pasoDelLink, previewDe, resolverLinkProfundo,
} from '../app/chats/lista-reglas';

const RAIZ = join(import.meta.dirname, '..');
const DIR = join(RAIZ, 'app', 'chats');
const leer = (archivo: string) => readFileSync(join(DIR, archivo), 'utf8');

/** Los archivos de la CARCASA (este equipo). La ventana (VentanaChat, Hilo, Composer) tiene su test. */
const CARCASA_TSX = ['ChatsApp.tsx', 'PanelBandejas.tsx', 'ListaChats.tsx', 'PanelContacto.tsx', 'iconos-canal.tsx'];

/** El código sin comentarios: un `<select>` o un `[0]` NOMBRADO en un comentario no es código. */
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/[ \t]\/\/ .*$/gm, '');

// ── Datos de prueba ──────────────────────────────────────────────────────────────────────────

function identidad(p: Partial<IdentidadCanal> & Pick<IdentidadCanal, 'canal' | 'ref'>): IdentidadCanal {
  return {
    cuenta: null, rotulo: 'WhatsApp', destino: null, telefono: null, ultimaFecha: null, puedeEscribir: true,
    motivoNoEscribir: null, bloqueado: false, ...p,
  };
}

function chat(p: Partial<ChatResumen> & Pick<ChatResumen, 'clave'>): ChatResumen {
  return {
    leadId: null, nombre: 'Ana', empresa: null, avatarTel: null, canales: [], canalUltimo: 'whatsapp', ultimoTexto: 'hola',
    ultimoTipo: 'text', ultimaFecha: '2026-10-14T15:00:00.000Z', ultimoEntrante: true, etapaKey: null, etapaLabel: null,
    asignado: null, closer: null, estado: 'abierta', pospuestaHasta: null, sinLeer: false, borrador: false, bloqueado: false, ...p,
  };
}

const ANA = chat({
  clave: 'lead:12', leadId: 12, nombre: 'Ana',
  canales: [identidad({ canal: 'whatsapp', cuenta: 'mako_ws3', ref: '5215512345678@s.whatsapp.net', telefono: '5215512345678' })],
});
const BETO = chat({
  clave: 'wa:mako_ws3_k1:5511112222', nombre: 'Beto',
  canales: [identidad({ canal: 'whatsapp', cuenta: 'mako_ws3_k1', ref: '5215511112222@s.whatsapp.net', telefono: '5215511112222' })],
});
const CARLA = chat({ clave: 'ig:77', nombre: 'Carla', canalUltimo: 'instagram', canales: [identidad({ canal: 'instagram', cuenta: 'acc1', ref: '77', rotulo: 'Instagram', destino: '@carla' })] });
const LISTA = [ANA, BETO, CARLA];

// ── Links profundos ──────────────────────────────────────────────────────────────────────────

test('un link que no matchea NO elige otra conversación: espera UNA lectura y suelta', () => {
  // Lo que matchea, matchea.
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'clave', clave: 'ig:77' })?.nombre, 'Carla');
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'lead', leadId: 12 })?.nombre, 'Ana');
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'whatsapp', linea: 'mako_ws3', chat: '5215512345678@s.whatsapp.net' })?.nombre, 'Ana');
  // El jid representante cambia de variante (521 ↔ 52, @lid…): la misma persona EN LA MISMA LÍNEA, por los 10 dígitos.
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'whatsapp', linea: 'mako_ws3', chat: '525512345678@s.whatsapp.net' })?.nombre, 'Ana');

  // Lo que NO matchea es null, nunca «el primero de la lista».
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'lead', leadId: 999 }), null);
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'clave', clave: 'lead:999' }), null);
  // Ese número existe, pero en OTRA línea: no es esa conversación.
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'whatsapp', linea: 'mako_ws3_k1', chat: '5215512345678@s.whatsapp.net' }), null);
  // Un jid sin dígitos suficientes (un grupo) no matchea por dígitos con nadie.
  assert.equal(resolverLinkProfundo(LISTA, { tipo: 'whatsapp', linea: null, chat: '123@g.us' }), null);
  // Una lista vacía no tiene a quién elegir.
  assert.equal(resolverLinkProfundo([], { tipo: 'lead', leadId: 12 }), null);

  // El paso a paso: primera lectura sin verlo → esperar; segunda → soltar. Nunca 'elegir' a otro.
  const link = { tipo: 'lead', leadId: 999 } as const;
  assert.deepEqual(pasoDelLink(LISTA, link, 0), { paso: 'esperar' });
  assert.deepEqual(pasoDelLink(LISTA, link, 1), { paso: 'soltar' });
  assert.deepEqual(pasoDelLink(LISTA, link, 5), { paso: 'soltar' });
  // Si en la segunda lectura apareció (el aviso llegó antes que la fila), se elige ÉSE.
  assert.equal((pasoDelLink([...LISTA, chat({ clave: 'lead:999', leadId: 999, nombre: 'Nuevo' })], link, 1) as { chat: ChatResumen }).chat.nombre, 'Nuevo');

  // Soltado, lo único que se pide solo es la clave EXACTA que nombra el link; un jid suelto no tiene clave.
  assert.equal(claveDelLink(link), 'lead:999');
  assert.equal(claveDelLink({ tipo: 'clave', clave: 'wa:x:1' }), 'wa:x:1');
  assert.equal(claveDelLink({ tipo: 'whatsapp', linea: 'x', chat: '1@s.whatsapp.net' }), null);
});

test('leerLinkProfundo: ?c= gana, un ?lead= que no es un id no es un link', () => {
  const de = (q: string) => leerLinkProfundo((k) => new URLSearchParams(q).get(k));
  assert.deepEqual(de('c=lead%3A12&lead=4'), { tipo: 'clave', clave: 'lead:12' });
  assert.deepEqual(de('lead=12&ws=3'), { tipo: 'lead', leadId: 12 });
  assert.equal(de('lead=abc'), null);
  assert.equal(de('lead=-3'), null);
  assert.equal(de('lead=1.5'), null);
  assert.deepEqual(de('linea=mako_ws3&chat=5215512345678%40s.whatsapp.net&n=4'), { tipo: 'whatsapp', linea: 'mako_ws3', chat: '5215512345678@s.whatsapp.net' });
  assert.deepEqual(de('chat=1%40s.whatsapp.net'), { tipo: 'whatsapp', linea: null, chat: '1@s.whatsapp.net' });
  assert.equal(de('ws=3'), null);
});

test('ChatsApp resuelve los links con pasoDelLink y no elige nunca «el primero»', () => {
  const src = sinComentarios(leer('ChatsApp.tsx'));
  assert.match(src, /pasoDelLink\(/, 'el link se resuelve con la regla probada arriba');
  assert.match(src, /leerLinkProfundo\(/);
  // Ningún `[0]` de una lista termina en la selección: era EXACTAMENTE el bug de la bandeja vieja.
  assert.doesNotMatch(src, /setSeleccion\([^)]*\[0\]/, 'la selección no sale de un [0]');
  assert.doesNotMatch(src, /\b(chats|visibles|todos|resultados|lista)\[0\]/, 'nada toma el primero de la lista');
  // Soltar = la URL vuelve a /chats y NO se elige nada.
  assert.match(src, /const soltarLink = useCallback\(\(\) => \{[\s\S]*?setSeleccion\(null\)[\s\S]*?router\.replace\(RUTA_CHATS/);
  // La selección vive en la URL (?c=<clave>): un clic en una fila la escribe ahí.
  assert.match(src, /const elegir = useCallback\(\(c: ChatResumen\) => \{[\s\S]*?router\.replace\(rutaChatsDeClave\(c\.clave\)/);
});

// ── La ventana ───────────────────────────────────────────────────────────────────────────────

test('la ventana se monta con key={…clave} y las props del plano', () => {
  const src = sinComentarios(leer('ChatsApp.tsx'));
  assert.match(src, /import VentanaChat from '\.\/VentanaChat'/);
  const m = src.match(/<VentanaChat\b([\s\S]*?)\/>/);
  assert.ok(m, 'ChatsApp monta <VentanaChat … />');
  const props = m[1];
  assert.match(props, /^\s*key=\{[\w.]+\.clave\}/, 'la PRIMERA prop es la key con la clave del chat');
  // Las props EXACTAS del contrato (docs/diseno-chats.md §3): si una falta, el otro equipo la lee undefined.
  for (const p of ['ws', 'chat', 'yo', 'equipo', 'etapas', 'productos', 'esAdmin', 'drawerAbierto', 'onToggleDrawer', 'onCambio', 'onAbrirFicha', 'onClaveCambio']) {
    assert.match(props, new RegExp(`\\b${p}=\\{`), `VentanaChat recibe ${p}`);
  }
});

// ── CSS ──────────────────────────────────────────────────────────────────────────────────────

/** Los selectores de cada regla (sin los pasos de @keyframes), con @media/@supports abiertos. */
function selectoresDe(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  const pila: Array<'regla' | 'grupo' | 'keyframes'> = [];
  let buf = '';
  for (const ch of src) {
    if (ch === '{') {
      const cab = buf.trim();
      buf = '';
      if (pila.includes('keyframes')) pila.push('keyframes');
      else if (/^@(-webkit-)?keyframes\b/.test(cab)) pila.push('keyframes');
      else if (/^@(media|supports|container|layer)\b/.test(cab)) pila.push('grupo');
      else { pila.push('regla'); out.push(cab); }
    } else if (ch === '}') { pila.pop(); buf = ''; }
    else if (ch === ';') buf = '';
    else buf += ch;
  }
  return out;
}

/** Parte una lista de selectores por las comas de afuera (no las de un `:is(a, b)`). */
function partirComas(sel: string): string[] {
  const out: string[] = [];
  let prof = 0; let cur = '';
  for (const ch of sel) {
    if (ch === '(') prof++;
    if (ch === ')') prof--;
    if (ch === ',' && prof === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const ESCOPO = /^(\[data-tema="oscuro"\]\s+)?\.rio(?=$|[\s.[:])/;

/** Por qué un selector no está bien escopado, o null. */
function problemaDeSelector(sel: string): string | null {
  if (!ESCOPO.test(sel)) return 'no empieza en .rio';
  // Sin lo de adentro de los paréntesis (`:has(+ .x)`), cada compuesto empieza con clase o atributo.
  let s = sel.replace(ESCOPO, '').trim();
  // Se BORRA el paréntesis entero: dejar «()» volvería a matchear y el while no terminaría nunca.
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, '');
  // `… .rio-x > *` (los hijos DIRECTOS de una clase de la tab) se acepta: no puede salir de esa caja. Lo
  // usa la ventana para acomodar un componente de la casa que no tiene clases propias (BotonAgregarAlCrm).
  s = s.replace(/\s*>\s*\*$/, '');
  const compuestos = s.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const pelado = compuestos.find((c) => !/^[.[]/.test(c));
  return pelado ? `compuesto sin clase «${pelado}»` : null;
}

test('chats.css: todo bajo .rio, ningún selector de elemento pelado, el oscuro en [data-tema="oscuro"] .rio', () => {
  const sels = selectoresDe(leer('chats.css')).flatMap(partirComas);
  assert.ok(sels.length > 60, `se leyeron los selectores (${sels.length})`);
  const malos = sels.map((s) => [s, problemaDeSelector(s)] as const).filter(([, p]) => p);
  assert.deepEqual(malos, [], 'cada selector empieza en la raíz de la tab y no nombra un elemento');
  assert.ok(sels.includes('.rio'), 'la raíz `.rio` declara los tokens');
  assert.ok(sels.includes('[data-tema="oscuro"] .rio'), 'el oscuro redefine los tokens');
  // La misma regla para TODA hoja de la tab (la de la ventana es de otro equipo, pero el scope es uno):
  // una regla suelta en cualquiera de ellas pinta el resto de MaKo igual.
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.css') && x !== 'chats.css')) {
    const otros = selectoresDe(leer(f)).flatMap(partirComas).map((s) => [s, problemaDeSelector(s)] as const).filter(([, p]) => p);
    assert.deepEqual(otros, [], `${f}: selectores fuera del scope .rio`);
  }
});

/** Las declaraciones `--rio-x: valor` de UN bloque exacto de chats.css. */
function tokensDelBloque(css: string, selector: string): Map<string, string> {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = src.indexOf(`\n${selector} {`);
  assert.ok(i >= 0, `existe el bloque ${selector}`);
  const cuerpo = src.slice(src.indexOf('{', i) + 1, src.indexOf('}', i));
  const out = new Map<string, string>();
  for (const m of cuerpo.matchAll(/(--rio-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

test('todo var(--rio-*) que usa app/chats/ está definido, y cada color del claro se redefine en oscuro', () => {
  const css = leer('chats.css');
  const claro = tokensDelBloque(css, '.rio');
  const oscuro = tokensDelBloque(css, '[data-tema="oscuro"] .rio');
  // Toda la carpeta, la ventana incluida: chats-ventana.css (otro equipo) estila con ESTOS tokens.
  const usados = new Set<string>();
  for (const f of readdirSync(DIR).filter((x) => /\.(css|tsx?)$/.test(x))) {
    for (const m of leer(f).matchAll(/var\((--rio-[a-z0-9-]+)/g)) usados.add(m[1]);
  }
  // `--rio-inter` no se declara en CSS: la publica next/font en la clase `inter.variable` (./fuente.ts).
  usados.delete('--rio-inter');
  const faltan = [...usados].filter((t) => !claro.has(t)).sort();
  assert.deepEqual(faltan, [], 'tokens usados sin definir en .rio');
  // El set completo de respond.io §1.0b (los que la ventana necesita aunque la bandeja no los use).
  for (const t of ['--rio-bubble-in', '--rio-bubble-out', '--rio-comment-bg', '--rio-warning', '--rio-ia', '--rio-ia-bg',
    '--rio-success', '--rio-success-bg', '--rio-danger', '--rio-danger-bg', '--rio-tooltip-bg', '--rio-tooltip-fg',
    '--rio-reply-contact', '--rio-chip', '--rio-chip-active', '--rio-bg-sel', '--rio-badge', '--rio-link']) {
    assert.ok(claro.has(t), `chats.css define ${t}`);
  }
  // La IA es MaKo (desvío deliberado): su token es --mako, no un violeta.
  assert.equal(claro.get('--rio-ia'), 'var(--mako)');
  // Un color fijo del claro que no se redefine en oscuro queda blanco sobre negro (o al revés).
  const esColor = (v: string) => /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i.test(v);
  const sinOscuro = [...claro].filter(([t, v]) => esColor(v) && !oscuro.has(t)).map(([t]) => t).sort();
  assert.deepEqual(sinOscuro, [], 'colores del claro sin su versión oscura');
});

// ── Reglas de la casa en el fuente ───────────────────────────────────────────────────────────

test('los Dropdown de la carcasa llevan el portal ADENTRO de .rio', () => {
  let vistos = 0;
  for (const f of CARCASA_TSX) {
    const src = sinComentarios(leer(f));
    // Hasta el `/>` que cierra en SU renglón: el de un ícono adentro (`botonLabel={<Plus … />}`) no corta.
    for (const m of src.matchAll(/<Dropdown\b[\s\S]*?\n\s*\/>/g)) {
      vistos++;
      assert.match(m[0], /portalTo=\{portalRio\(\)\}/, `${f}: un <Dropdown> sin portalTo={portalRio()} se dibuja sin los tokens`);
    }
  }
  assert.ok(vistos >= 3, `se revisaron los Dropdown (${vistos})`);
  // El contenedor existe ADENTRO de la raíz: sin él, portalRio() devuelve null y el menú cae a <body>.
  const app = sinComentarios(leer('ChatsApp.tsx'));
  assert.match(app, /<div id=\{ID_PORTAL_RIO\}/);
});

test('lo que se guarda en el navegador lleva el ws en la clave', () => {
  // La regla, ejecutada: dos workspaces no comparten nada.
  assert.notEqual(claveLocalChats(3, 'filtro'), claveLocalChats(4, 'filtro'));
  assert.notEqual(claveLocalChats(null, 'filtro'), claveLocalChats(3, 'filtro'));
  assert.match(claveLocalChats(3, 'filtro'), /ws3/);
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  guardarLocal(st, 3, 'drawer', '0');
  assert.equal(leerLocal(st, 3, 'drawer'), '0');
  assert.equal(leerLocal(st, 4, 'drawer'), null, 'el drawer de un cliente no aparece en otro');
  // Un navegador que no deja leer ni escribir (Safari en privado) no rompe la pantalla.
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
  assert.equal(leerLocal(roto, 3, 'drawer'), null);
  assert.doesNotThrow(() => guardarLocal(roto, 3, 'drawer', '1'));
  // El filtro recordado: un guardado roto o viejo vuelve al de siempre, y la BANDEJA no se recuerda.
  assert.deepEqual(filtroRecordado('{roto'), { mostrar: 'abiertas', orden: 'recientes', sinResponder: false });
  assert.deepEqual(filtroRecordado('{"mostrar":"cerradas","orden":"antiguas","sinResponder":true,"vista":"mios"}'),
    { mostrar: 'cerradas', orden: 'antiguas', sinResponder: true });
  assert.deepEqual(filtroRecordado('{"mostrar":"cualquiera"}'), { mostrar: 'abiertas', orden: 'recientes', sinResponder: false });

  // En el fuente: ningún `localStorage` suelto en la carcasa, y cada lectura/escritura pasa `ws`.
  for (const f of CARCASA_TSX) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /localStorage|sessionStorage/, `${f}: el navegador se toca sólo por lista-reglas.ts`);
    for (const m of src.matchAll(/\b(leerLocal|guardarLocal)\(([^,]+),\s*([^,]+),/g)) {
      assert.equal(m[3].trim(), 'ws', `${f}: ${m[1]}(…) con «${m[3].trim()}» como workspace`);
    }
  }
});

test('sin <select> nativo ni next/link en app/chats/', () => {
  for (const f of readdirSync(DIR).filter((x) => /\.tsx$/.test(x))) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /<select\b/, `${f}: el desplegable es el Dropdown de la casa`);
    assert.doesNotMatch(src, /from 'next\/link'/, `${f}: los links son app/_ui/Link (llevan el ?ws=)`);
  }
});

test('la página y la carcasa: guard de capa + onboarding, use client, sondeo sólo con la pestaña visible', () => {
  const page = sinComentarios(leer('page.tsx'));
  assert.doesNotMatch(page, /'use client'/);
  assert.match(page, /await requireCapa\('chats'\)/);
  assert.match(page, /await guardOnboarding\(\)/);
  for (const f of CARCASA_TSX) assert.match(leer(f), /^'use client';/, `${f} es de cliente`);
  const app = sinComentarios(leer('ChatsApp.tsx'));
  assert.match(app, /const SONDEO_MS = 15_000/);
  // El intervalo pregunta si la pestaña se ve ANTES de pedir: una pestaña olvidada no relee la lista.
  assert.match(app, /setInterval\(\(\) => \{ if \(visible\(\)\) void cargarLista\(\); \}, SONDEO_MS\)/);
  assert.match(app, /const visible = \(\) => document\.visibilityState === 'visible'/);
  // La ficha del lead, la de siempre, sin bajarla en el server.
  assert.match(app, /dynamic\(\(\) => import\('\.\.\/crm\/LeadEditModal'\)[^)]*\)[^)]*\), \{ ssr: false \}\)/);
  // Las insignias que importa la ventana (contrato entre equipos).
  const iconos = leer('iconos-canal.tsx');
  assert.match(iconos, /export function InsigniaCanal\(\{ canal, size/);
  assert.match(iconos, /export function IconoCanal\(\{ canal, size/);
});

// ── La fila ──────────────────────────────────────────────────────────────────────────────────

test('la hora de la fila: hoy la hora, ayer «Ayer», la semana el día, antes la fecha', () => {
  const ahora = new Date(2026, 9, 14, 0, 10); // miércoles 14/10/2026, 00:10
  const iso = (d: Date) => d.toISOString();
  assert.equal(horaDeFila(iso(new Date(2026, 9, 14, 0, 5)), ahora), '12:05 a. m.');
  assert.equal(horaDeFila(iso(new Date(2026, 9, 14, 13, 44)), new Date(2026, 9, 14, 18, 0)), '1:44 p. m.');
  // Anoche a las 23:50, visto a las 00:10: pasaron 20 minutos y es «Ayer» (días de CALENDARIO).
  assert.equal(horaDeFila(iso(new Date(2026, 9, 13, 23, 50)), ahora), 'Ayer');
  assert.equal(horaDeFila(iso(new Date(2026, 9, 9, 10, 0)), ahora), 'Viernes');
  // Hasta 6 días el nombre del día; a los 7 sería «Miércoles» otra vez, igual que hoy: ahí va la fecha.
  assert.equal(horaDeFila(iso(new Date(2026, 9, 8, 10, 0)), ahora), 'Jueves');
  assert.equal(horaDeFila(iso(new Date(2026, 9, 7, 10, 0)), ahora), '7 oct');
  assert.equal(horaDeFila(iso(new Date(2026, 2, 27, 10, 0)), ahora), '27 mar');
  assert.equal(horaDeFila(iso(new Date(2025, 2, 27, 10, 0)), ahora), '27 mar 2025');
  assert.equal(horaDeFila(null, ahora), '');
  assert.equal(horaDeFila('no es fecha', ahora), '');
});

test('la segunda línea: un adjunto se dice por su tipo, nunca por su nombre de archivo', () => {
  assert.equal(previewDe({ ultimoTexto: 'contrato_final_v3.pdf', ultimoTipo: 'document', ultimaFecha: null }), '(Archivo)');
  assert.equal(previewDe({ ultimoTexto: null, ultimoTipo: 'image', ultimaFecha: null }), '(Imagen)');
  assert.equal(previewDe({ ultimoTexto: null, ultimoTipo: 'audio', ultimaFecha: null }), '(Audio)');
  assert.equal(previewDe({ ultimoTexto: null, ultimoTipo: 'otro', ultimaFecha: null }), '(Mensaje no compatible)');
  assert.equal(previewDe({ ultimoTexto: 'hola\n\n  ¿cómo   estás?', ultimoTipo: 'text', ultimaFecha: null }), 'hola ¿cómo estás?');
  assert.equal(previewDe({ ultimoTexto: null, ultimoTipo: null, ultimaFecha: null }), '');
});

// ── Actividad ────────────────────────────────────────────────────────────────────────────────

test('la Actividad reconoce el copy que escribe lib/chats-reglas.ts', () => {
  // Los eventos de chat_eventos: cada tipo cae en SU tarjeta.
  for (const tipo of TIPOS_EVENTO_CHAT) {
    const texto = textoDePartes(partesDeEvento(tipo, 'Martín', { hasta: '2026-10-15T10:00:00Z', nota: 'listo' }));
    assert.equal(claseDeEvento(texto).clase, tipo, `«${texto}»`);
  }
  // Los del historial del lead.
  const audit = (campo: string, nuevo: string | null) => textoDePartes(partesDeAudit(campo, nuevo, 'Martín') ?? []);
  assert.equal(claseDeEvento(audit('Etapa', 'calificado')).clase, 'etapa');
  assert.equal(claseDeEvento(audit('Setter', 'Leila')).clase, 'asignada');
  assert.equal(claseDeEvento(audit('Setter', null)).clase, 'sin-asignar');
  assert.equal(claseDeEvento(audit('Closer', 'Mau')).clase, 'closer');
  // Un texto que no conoce no inventa un título: «Actividad», con su texto intacto en la tarjeta.
  assert.deepEqual(claseDeEvento('Algo nuevo'), { clase: 'otro', titulo: 'Actividad' });
  assert.deepEqual(claseDeEvento(null), { clase: 'otro', titulo: 'Actividad' });
});
