// =============================================================================
// Los gurús en el Ops Center: los cinco puntos de Martín, uno por uno (3/11/2026)
// =============================================================================
// Martín, textual: «No veo el second brain de los gurus en los chats de Ops Center... Cuando le doy a "Nuevo chat" no me deja ver las
// opciones de los gurus... Cuando le doy a "Hormozi" no se abre nada... Cuando le escribo a algun guru, aun no me respondo con su base de
// conocimientos... Cuando escribo el que responde es una criatura de mako, no la foto del guru que seleccioné...».
//
// ⚠️ DOS DE LOS CINCO TENÍAN UNA CAUSA QUE NO ERA LA OBVIA:
//   · «no responde con su base»: el turno ya traía los tramos del curso, pero `CURSO_DE_REFERENTE` tenía 3 de los 22 gurús. Probado con
//     Alborna andaba, y con Hormozi no había nada que traer. Por eso el test corre el camino real con TODOS (22 el 3/11, 32 desde el 4/11: tests/_gurus-curso-hijo.ts).
//   · «una criatura de mako»: la cabecera traía su cara, y el hilo la sacaba de la fila de la lista (`filaAbierta`), que este chat no tiene.
//
// PROBADO ROMPIÉNDOLO (3/11/2026), con el archivo en 15 / 0, una rotura por vez y restaurada:
//   1. `GaleriaDeGurus` con `ASESORES.slice(0, 1)`                                          → cae «están los 32»
//      `ChatsMovil` sin `alPie` en HojaChatNuevo                                           → cae «las cuatro puertas»
//   2. (4/11/2026, el coach único: ya no hay fila del Offer Coach) `gurusDeLaBarra` que vuelve a esconder a uno → cae «Hormozi abre su chat»
//      la fila de un gurú con `onElegir={() => elegir(…)}` en vez de `abrirGuru(id)`           → cae «la fila no es un clic muerto»
//   3. borrar 'hormozi' de `CURSO_DE_REFERENTE`                                             → 13 / 2: «los 32 contestan» y «con la cuenta de un cliente»
//      `paqueteParaElTurno` que no lee el curso con `sinPlata`                             → 14 / 1: «con la cuenta de un cliente»
//   4. `useChatCliente` sin `quien` en `aspectoMuneco`                                      → cae «la burbuja lleva su cara»
//      la fila de la lista sin `guru`                                                       → cae «el historial»
//   5. `ChatDelCoach` sin `BotonSecondBrainDe` (4/11: era `BotonSuSecondBrain`, un modal)   → cae «su Second Brain, en los chats donde aconseja»
// Correr: node --import tsx --test tests/gurus-ops-center.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GaleriaDeGurus } from '../app/second-brain/GaleriaDeGurus';
import modulo from 'node:module';
import { CuerpoChatNuevo, type ChatNuevo } from '../app/admin/operaciones/ChatNuevoPiezas';
import { ASESORES, type IdAsesor } from '../lib/asesores/catalogo';
import { aspectoDeReferente } from '../lib/centro-munecos';
import { esTabConChatPropio, gurusDeLaBarra, listaDelCliente, origenDeClave, referenteDeTab } from '../lib/chat-mako-reglas';
import { tocarEnLaBarra } from '../lib/ops-center-navegar';

// El hilo trae CSS, que en node no carga: se importa adentro de su test, después de esto (como tests/aperturas.test.ts). El motor
// (useChatCliente.ts) no se dibuja acá: por sus server actions llega a lib/auth.ts, y ese árbol en node termina el proceso sin decir nada.
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Todos los elementos de un árbol de React, sin dibujarlo: para tocar un botón en un test sin navegador. */
function elementos(n: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(n, (x) => {
    if (!isValidElement(x)) return;
    const e = x as ReactElement<Record<string, unknown>>;
    out.push(e, ...elementos(e.props.children as ReactNode));
  });
  return out;
}

// ── 1. «Nuevo chat» muestra los gurús ─────────────────────────────────────────────────────────────────

test('1. están los 32, a la vista, y tocar uno lo elige', () => {
  const html = renderToStaticMarkup(createElement(GaleriaDeGurus, { onElegir: () => {} }));
  for (const a of ASESORES) assert.ok(html.includes(a.nombre.replace(/&/g, '&amp;')), `falta ${a.nombre}`);
  assert.equal(ASESORES.length, 32);
  const tocados: IdAsesor[] = [];
  const botones = elementos(GaleriaDeGurus({ onElegir: (id) => tocados.push(id) })).filter((e) => e.type === 'button');
  assert.equal(botones.length, ASESORES.length);
  (botones[0].props.onClick as () => void)();
  assert.deepEqual(tocados, ['hormozi']);
  assert.ok(html.includes('Inspirado en Alex Hormozi'), 'dice «Inspirado en»: la persona no participa');
});

test('1. en «Nuevo chat» del super admin van debajo de la portada, y se van con el primer mensaje', () => {
  const n = { enviado: null, nota: null, archivos: [], decision: null, fase: 'escribiendo', editando: null } as unknown as ChatNuevo;
  const galeria = createElement(GaleriaDeGurus, { onElegir: () => {} });
  const vacio = renderToStaticMarkup(createElement(CuerpoChatNuevo, { n, alPie: galeria }));
  assert.match(vacio, /Nuevo chat/);
  assert.match(vacio, /Hormozi/);
  const escrito = renderToStaticMarkup(createElement(CuerpoChatNuevo, { n: { ...n, enviado: 'hola' }, alPie: galeria }));
  assert.doesNotMatch(escrito, /Hormozi/);
});

test('1. las cuatro puertas: el cliente y el super admin, en la computadora y en el teléfono, y sin modal', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /<ChatNuevoCentro [^\n]*gurus=\{<GaleriaDeGurus onElegir=\{abrirGuru\} \/>\}/, 'el super admin');
  assert.match(sb, /\{enChatNuevo && !k\.items\.length && !k\.trabajo && <GaleriaDeGurus onElegir=\{abrirGuru\} \/>\}/, 'el cliente');
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /\{enChatNuevo && !k\.items\.length && !k\.trabajo && <GaleriaDeGurus onElegir=\{abrirGuru\} \/>\}/, 'el cliente en el teléfono');
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /<CuerpoChatNuevo n=\{chatNuevo\} alPie=\{<GaleriaDeGurus onElegir=\{onGuru\} \/>\} \/>/, 'el super admin en el teléfono');
  assert.doesNotMatch(sb, /eligiendoGuru|Hablar con un gurú/, '«Nuevo chat jamás debe abrir un modal»');
  assert.doesNotMatch(leer('app/second-brain/GaleriaDeGurus.tsx'), /Modal/);
});

// ── 2. El clic abre su chat ahí mismo, sin conversación previa ni cambio de ruta ───────────────────────

test('2. Hormozi abre su chat, sin conversación previa y también con una', () => {
  // Desde el 4/11/2026 no hay fila del Offer Coach (el coach es uno): la charla con Hormozi que alguien tuvo tocándola es SU fila de gurú.
  const conCharla = [{ id: 'hormozi' as const, at: '2026-11-03T00:00:00.000Z' }];
  assert.deepEqual(gurusDeLaBarra({ conCharla, abierto: null, busca: '' }).map((g) => g.id), ['hormozi'], 'nadie se esconde');
  assert.deepEqual(gurusDeLaBarra({ conCharla: [], abierto: 'hormozi', busca: '' }).map((g) => g.id), ['hormozi'], 'abierto sin haberle escrito, también');
});

test('2. la fila no es un clic muerto, y abrirlo no cambia de ruta', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /filasDeGurus\.map\(\(\{ id \}\) => \{[\s\S]{0,400}onElegir=\{\(\) => abrirGuru\(id\)\} \/>/, 'su fila abre su chat ahí mismo');
  assert.equal(tocarEnLaBarra('chat', { ticketera: false, mapa: false, nuevo: false }).ir ?? null, null, 'sin el grafo abierto, no se navega');
  const ini = sb.indexOf('const abrirGuru =');
  // Hasta la función que sigue (abrirGrupo, desde el 4/11/2026; si no está, edadDeGuru): sólo el cuerpo de abrirGuru.
  const fin = [sb.indexOf('const abrirGrupo ='), sb.indexOf('const edadDeGuru =')].filter((x) => x > ini).sort((x, y) => x - y)[0] ?? -1;
  assert.ok(ini >= 0 && fin > ini, 'abrirGuru está antes de abrirGrupo y de edadDeGuru');
  const abrir = sb.slice(ini, fin);
  assert.match(abrir, /setGuru\(id\);/);
  assert.match(abrir, /if \(paso\.ir\) \{[^}]*router\.push\(`\$\{base\}\?guru=/, 'sólo el grafo, que es de otra página, navega');
  assert.equal((abrir.match(/router\.push/g) ?? []).length, 1);
  // Se dibuja desde la lista de montados, no desde un estado que un motor sin conversación deje en null.
  assert.match(sb, /gurusMontados\.map\(\(id\) => \{[\s\S]{0,300}<ChatDelReferente referente=\{g\} visible=\{seVe\}/);
  assert.ok(esTabConChatPropio('referente-hormozi'), 'el primer mensaje crea su conversación');
  assert.ok(!esTabConChatPropio('referente-nadie'));
});

// ── 3. Contesta con SU curso, también con la cuenta de un cliente ─────────────────────────────────────

const curso = (() => {
  let r: ReturnType<typeof correr> | null = null;
  return () => (r ??= correr());
})();
function correr() {
  const s = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'tests/_gurus-curso-hijo.ts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000 });
  assert.equal(s.status, 0, s.stderr.slice(-1500));
  return JSON.parse(s.stdout.trim().split('\n').pop() ?? '{}') as {
    gurus: Array<{ id: string; clases: number; ms: number; conTramos: boolean; conAtribucion: boolean }>;
    releidas: number;
    delCliente: { conCurso: boolean; conTramos: boolean };
    sinReferente: boolean;
    deOffer: { conCurso: boolean; largo: number };
    tarde: { ms: number; vacio: boolean };
    grafo: { nodos: number; modulos: number; posiciones: number; ms: number; kb: number };
  };
}

test('3. los 32 contestan con los tramos de SU curso, leídos de verdad', { timeout: 250_000 }, () => {
  const { gurus, releidas } = curso();
  assert.equal(gurus.length, ASESORES.length);
  for (const g of gurus) {
    assert.ok(g.clases > 0, `${g.id}: sin clases, contesta con la ficha y nadie se entera`);
    assert.ok(g.conTramos, `${g.id}: el turno no trae un tramo de su curso`);
    assert.ok(g.conAtribucion, `${g.id}: el bloque no dice de qué curso sale`);
  }
  assert.equal(releidas, 0, 'leído una vez por proceso: no se abren 452 archivos en cada turno');
});

test('3. con la cuenta de un cliente: un miembro sin plata y sin negocio que responda sigue trayendo el curso', { timeout: 250_000 }, () => {
  const { delCliente, sinReferente, deOffer } = curso();
  assert.ok(delCliente.conCurso && delCliente.conTramos, 'el bloque no depende del rol ni del grafo del negocio');
  assert.equal(sinReferente, false, 'sin gurú al frente, ningún curso viaja');
  assert.ok(deOffer.conCurso && deOffer.largo < 16_000, 'una conversación de Offer también, con menos presupuesto');
  // Lo que hace gurú a la conversación es su clave, con la persona que sea: `mako-movil:u<id>` de un cliente.
  assert.equal(referenteDeTab('mako-movil:u4217:referente-hormozi'), 'hormozi');
  assert.equal(origenDeClave('mako-movil:u4217:referente-hormozi'), 'Hormozi', 'sin origen, `claveDeTab` la rechaza: «No encuentro ese chat»');
  const ruta = leer('app/api/mako/chat/route.ts');
  assert.match(ruta, /const guru = referenteDeTab\(quien\.chartKey\);/);
  assert.equal((ruta.match(/referente: delChat\.referente/g) ?? []).length, 2, 'los dos caminos: el JSON y el de los archivos');
  // La PC del cliente recibe el system entero por archivo: en la línea de comandos, Windows lo corta en 32.767 caracteres.
  assert.match(leer('scripts/ia-pc/mako-pc.mjs'), /'--system-prompt-file', sistema/);
});

test('3. un curso que no llega a tiempo no frena el turno ni lo tira', { timeout: 250_000 }, () => {
  const { tarde } = curso();
  assert.ok(tarde.vacio, 'sigue con la ficha');
  assert.ok(tarde.ms < 2_000, `tardó ${tarde.ms} ms con plazo 0`);
});

// ── 4. Su cara y su nombre en la burbuja, el historial y el teléfono ──────────────────────────────────

test('4. la burbuja lleva su cara y su nombre, no una criatura sorteada', async () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /const nombre = quien\?\.nombre \?\? filaAbierta\?\.titulo/, 'lo que dice la caja: «Escribe a Hormozi»');
  assert.match(motor, /const nombreMuneco = quien\?\.nombre \?\? filaAbierta\?\.criatura/);
  assert.match(motor, /const aspectoMuneco = quien\?\.aspecto \?\? filaAbierta\?\.aspecto \?\? null;/);
  assert.match(sinComentarios(leer('app/second-brain/useChatDelReferente.ts')), /useChatCliente\(\{[^}]*tab, quien \}\)/);
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /<HiloMako items=\{k\.items\} quien=\{\{ nombre: k\.nombreMuneco, aspecto: k\.aspectoMuneco \}\}/, 'el hilo dibuja lo que dice el motor');
  assert.deepEqual(aspectoDeReferente('hormozi').retrato, 'hormozi');

  const { HiloMako } = await import('../app/_chat/HiloMako');
  const html = renderToStaticMarkup(createElement(HiloMako, {
    items: [{ k: 'msg', id: 'm1', role: 'assistant', texto: 'Hola', at: '2026-11-03T12:00:00.000Z' }],
    quien: { nombre: 'Hormozi', aspecto: aspectoDeReferente('hormozi') }, ahora: Date.parse('2026-11-03T12:01:00.000Z'), escribiendo: null, tarjeta: null,
    onTarjeta: () => {}, onReintentar: () => {}, onRecargar: () => {}, onResponder: () => false,
  }));
  assert.match(html, /asesores\/hormozi\.png/, 'su retrato, el que aprobó Martín');
});

test('4. el Funnel Coach con un gurú al frente tampoco dibuja otra criatura', () => {
  // Su motor (el mismo de la computadora y el teléfono, 4/11/2026) le pasa su cara al chat.
  assert.match(sinComentarios(leer('app/second-brain/useChatDelCoach.ts')), /useChatCliente\(\{[^}]*tab: TAB_FUNNEL_COACH, quien \}\)/);
});

test('4. el historial: en la lista lleva su nombre y su cara, y abre su chat', () => {
  const [, fila] = listaDelCliente({ sesiones: [], offer: [], antes: [{ id: 9, titulo: 'Cómo armo mi oferta', updatedAt: '2026-11-03T12:00:00.000Z', clave: 'referente-hormozi' }], busca: '' });
  assert.equal(fila.guru, 'hormozi');
  assert.equal(fila.titulo, 'Hormozi', 'sin «› tema»: es UNA por persona, y no arma un grupo con una sola fila');
  assert.equal(fila.criatura, 'Hormozi');
  assert.deepEqual(fila.elegido, { antes: 9 });
  assert.match(leer('app/second-brain/useChatCliente.ts'), /f\.guru \? aspectoDeReferente\(f\.guru\)/);
  assert.match(leer('app/m/second-brain/ChatClienteM.tsx'), /onClick=\{\(\) => \(f\.guru \? abrirGuru\(f\.guru\) : abrir\(f\.elegido\)\)\}/, 'en el teléfono');
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /filasDeLaLista\.filter\(\(f\) => f\.origen !== 'offer' && !f\.guru\)/, 'en la computadora van debajo de los coaches, una sola vez');
});

test('4. el historial en la barra: lo más reciente arriba, el abierto aunque no le haya escrito, y ninguno escondido', () => {
  const conCharla = [{ id: 'juan-ads' as const, at: '2026-11-01T00:00:00.000Z' }, { id: 'hormozi' as const, at: '2026-11-03T00:00:00.000Z' }, { id: 'tino-mossu' as const, at: '2026-11-02T00:00:00.000Z' }];
  assert.deepEqual(gurusDeLaBarra({ conCharla, abierto: null, busca: '' }).map((g) => g.id), ['hormozi', 'tino-mossu', 'juan-ads']);
  assert.deepEqual(gurusDeLaBarra({ conCharla, abierto: 'adria-sola', busca: '' }).map((g) => g.id), ['adria-sola', 'hormozi', 'tino-mossu', 'juan-ads']);
  assert.deepEqual(gurusDeLaBarra({ conCharla, abierto: null, busca: 'mossu' }).map((g) => g.id), ['tino-mossu']);
  // Esta es la única forma de volver al suyo que tiene el super admin: su lista es la de Claude Code.
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /gurusConCharla\.map\(\(\{ id, at \}\) =>/);
});

test('4. el teléfono usa el mismo motor, con su cara en el título', () => {
  const m = sinComentarios(leer('app/m/second-brain/HojaDelGuru.tsx'));
  assert.match(m, /useChatDelReferente\(r, caja\)/);
  assert.match(m, /<Muneco titulo=\{r\.nombre\} aspecto=\{aspecto\}/);
  assert.match(m, /<HiloDelCliente k=\{k\} \/>/);
});

// ── 5. Su Second Brain, visible ───────────────────────────────────────────────────────────────────────

test('5. su Second Brain, en los chats donde aconseja un gurú, en la computadora y en el teléfono', () => {
  // «Second Brain de <gurú>» y, abierto, «Volver al chat»: lo que hace el botón y el reemplazo lo corre tests/cerebro-referente-vista.test.ts.
  assert.match(leer('app/second-brain/ChatDelReferente.tsx'), /<BotonSecondBrainDe referente=\{r\} viendo=\{viendoCerebro\}/, 'el suyo');
  assert.match(leer('app/second-brain/ChatDelCoach.tsx'), /\{r && <BotonSecondBrainDe referente=\{r\} viendo=\{mostrandoCerebro\}/, 'el Funnel Coach');
  assert.match(leer('app/second-brain/ChatSecondBrain.tsx'), /<BotonSecondBrainDe referente=\{delCoach\} viendo=\{viendoCerebroOffer\}/, 'una conversación de oferta');
  assert.match(leer('app/m/second-brain/HojaDelCoach.tsx'), /<CerebroDelGuru referente=\{r\} movil \/>/, 'el coach en el teléfono');
  const m = leer('app/m/second-brain/HojaDelGuru.tsx');
  assert.match(m, /<BotonSecondBrainDe referente=\{r\} viendo=\{false\} onCambiar=\{setViendoCerebro\} \/>/);
  assert.match(m, /<CerebroDelGuru referente=\{r\} movil \/>/, 'adentro de la hoja: una hoja sobre otra la reemplaza');
});

test('5. el grafo del curso más largo se arma, con cada clase en su lugar y sin el texto', { timeout: 250_000 }, () => {
  const { grafo } = curso();
  assert.ok(grafo.modulos > 1, 'sus módulos son las secciones del mapa');
  assert.equal(grafo.nodos, 1 + grafo.modulos + 452, 'la raíz, un nodo por módulo y las 452 clases de Marc Verdú');
  assert.equal(grafo.posiciones, grafo.nodos);
  assert.ok(grafo.kb < 900, `el grafo pesa ${grafo.kb} KB: ¿viajó el texto de las clases?`);
});
