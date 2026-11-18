// =============================================================================
// El «⋯» de una fila del Ops Center del cliente (F96, 18/11/2026): Renombrar y Cambiar su criatura
// =============================================================================
// El menú es el del super admin (app/admin/operaciones/PiezasCentro.tsx → MenusCentro, con la `FilaDeChat` de siempre: el «⋯»
// y el clic derecho de lo mismo son UN menú, AGENTS.md); lo que escribe va por /api/mako/chat (`renombrar`, `criatura`), con
// la persona de `personaDelRequest` (su sesión y su negocio). Lo que se fija:
//   1. CORRIENDO la ruta de verdad (tests/_ops-menu-cliente-hijo.ts: una cookie firmada, un PostgREST de mentira): renombra y
//      elige la criatura de UN chat suyo; el Cerebro no; el de otra persona y el de otro negocio no existen (404); un nombre
//      vacío o largo y una criatura que no existe se rechazan sin tocar nada; la lista devuelve las criaturas, por persona; y
//      si no se pudieron leer, la lista sale igual (`munecos: null`). Sin sesión, 401. Nada sale a la red.
//   2. Qué fila ofrece el «⋯» (`idConMenu`): sólo una conversación con MaKo que no es el Cerebro ni la fila jefe de un grupo.
//   3. La pantalla monta ESA pieza: la fila del cliente pasa `onMenu`, y `MenusCentro` recibe el motor del cliente.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, base 3 / 0), una rotura por vez, restaurada:
//   R1  `delMenuDeLaPersona` sin el chequeo del jefe (`esJefe: false`)                  → 2 / 1 (el Cerebro se renombraba)
//   R2  buscar la conversación con `getSession` (sin mirar de quién es)                  → 2 / 1 (la de otra persona se renombraba)
//   R3  el GET de la lista sin `munecos`                                                 → 2 / 1
//   R4  `ponerMunecoDeSesion` sin `sanearAspecto` (guarda lo que llega)                  → 2 / 1
//   R5  `idConMenu` sin mirar la clave (cualquier fila con `{ id }`: el Cerebro también)  → 2 / 1
//   R5b `idConMenu` sin el `jefeDeGrupo`                                                 → 2 / 1
//   R7  `conCriaturaElegida` sin pasar por `idConMenu` (por el id de cualquier fila)      → 2 / 1
//   R8  la lista de la pantalla sin `conCriaturaElegida`                                → 2 / 1
//   R6  la fila del cliente sin `onMenu`                                                  → 2 / 1
//
// Correr: node --import tsx --test tests/ops-menu-cliente.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conCriaturaElegida, idConMenu, listaDelCliente, jefeDelGrupo } from '../lib/chat-mako-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

type Pedido = { status: number; cuerpo: Record<string, unknown> };
let medido: Record<string, unknown> | null = null;
const correr = (): Record<string, unknown> => {
  medido ??= (() => {
    const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ops-menu-cliente-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000,
    });
    const i = out.indexOf('@@RESULTADO@@');
    assert.ok(i >= 0, `el hijo no devolvió nada:\n${out.slice(-2000)}`);
    return JSON.parse(out.slice(i + '@@RESULTADO@@'.length).trim()) as Record<string, unknown>;
  })();
  return medido;
};

test('la ruta de verdad: renombra y elige la criatura de UN chat suyo, y nada más', () => {
  const R = correr();
  const p = (k: string) => R[k] as Pedido;
  assert.equal(p('sinSesion').status, 401, 'sin sesión no se toca nada');

  // Renombrar: el suyo sí (con el nombre limpio de espacios), el Cerebro no, el de otra persona y el de otro negocio no existen.
  assert.equal(p('renombrarSuyo').status, 200);
  assert.equal(R.tituloSuyo, 'Ventas del mes', 'el nombre se guarda limpio (nombreValido)');
  assert.equal(p('renombrarJefe').status, 400, 'el Cerebro no se renombra');
  assert.equal(R.tituloJefe, null);
  assert.equal(p('renombrarDeOtra').status, 404, 'la conversación de otra persona no existe para ésta');
  assert.equal(R.tituloDeOtra, 'De otra');
  assert.equal(p('renombrarOtroNegocio').status, 404, 'con su clave pero en otro negocio, tampoco');
  assert.equal(R.tituloOtroNegocio, 'Ajeno');
  assert.equal(p('renombrarVacio').status, 400, 'un nombre vacío se rechaza');
  assert.equal(p('renombrarLargo').status, 400, 'un nombre largo se rechaza, no se recorta');
  assert.equal(R.tituloTrasLosMalos, 'Ventas del mes', 'lo rechazado no tocó nada');

  // La criatura: por conversación, en la fila de la persona y en su negocio.
  const A = { forma: 'gota', color: '--grafo-documentos', cara: 'sonrisa' };
  assert.equal(p('criaturaSuya').status, 200);
  assert.deepEqual(R.guardadoTrasElegir, { ws: 3, valor: { 11: A } }, 'se guarda por id, en chats.munecos:<persona> de SU negocio');
  assert.equal(p('criaturaJefe').status, 400, 'el Cerebro lleva siempre la estrella');
  assert.equal(p('criaturaDeOtra').status, 404, 'la de otra persona no existe');
  assert.equal(p('criaturaInvalida').status, 400, 'una criatura que no existe se rechaza');
  assert.deepEqual(R.guardadoTrasLosMalos, { ws: 3, valor: { 11: A } }, 'lo rechazado no tocó nada');

  // La lectura: la lista trae las criaturas de quien mira, y las de otra persona no.
  const lista = p('listaDespues').cuerpo as { sesiones: Array<{ id: number; titulo: string | null }>; munecos: unknown };
  assert.deepEqual(lista.sesiones.map((s) => s.id).sort(), [10, 11], 'sólo sus conversaciones, en su negocio');
  assert.equal(lista.sesiones.find((s) => s.id === 11)?.titulo, 'Ventas del mes');
  assert.deepEqual(lista.munecos, { 11: A }, 'la lista devuelve la criatura elegida');
  assert.deepEqual((p('listaDeOtra').cuerpo as { munecos: unknown }).munecos, {}, 'las criaturas son de cada persona');
  assert.deepEqual((p('listaAntes').cuerpo as { munecos: unknown }).munecos, {}, 'sin elegir, ninguna');
  // Si no se pudieron leer, la lista sale igual (cada fila con la de su nombre), nunca un error de la lista entera.
  const sinCriaturas = p('listaSinCriaturas');
  assert.equal(sinCriaturas.status, 200);
  assert.equal((sinCriaturas.cuerpo as { munecos: unknown }).munecos, null, '«no pude leer» no es «no eligió ninguna»');
  assert.equal((sinCriaturas.cuerpo as { sesiones: unknown[] }).sesiones.length, 2);

  // Quitarla la devuelve a la de su nombre. Y nada salió a la red (no hay IA en esto).
  assert.equal(p('quitarCriatura').status, 200);
  assert.deepEqual(R.guardadoTrasQuitar, { ws: 3, valor: {} });
  assert.deepEqual(R.red, []);
});

test('qué fila ofrece el «⋯»: sólo una conversación con MaKo que no es el Cerebro', () => {
  const ahora = new Date().toISOString();
  const filas = listaDelCliente({
    sesiones: [{ id: 5, titulo: null, pinned: false, updatedAt: ahora }, { id: 6, titulo: 'Precios', pinned: false, updatedAt: ahora }],
    offer: [{ id: 7, titulo: 'Mi oferta', updatedAt: ahora }], antes: [{ id: 8, titulo: 'CRM', updatedAt: ahora, clave: 'mako-movil:u1:crm:3' }], busca: '',
  });
  const por = (clave: string) => filas.find((f) => f.clave === clave)!;
  assert.equal(idConMenu(por('jefe')), null, 'el Cerebro no');
  assert.equal(idConMenu(por('s6')), 6, 'un chat suyo con MaKo sí');
  assert.equal(idConMenu(por('o7')), null, 'una conversación de Offer se cambia en Offer');
  assert.equal(idConMenu(por('a8')), null, 'un chat de antes tampoco');
  // La fila jefe de un grupo lleva el `elegido` de su primer chat (abre el más reciente): con la clave de verdad de un grupo
  // (`jefe:<nombre>`, lib/centro-chats.ts → porJefe) no es un chat, y tampoco con la marca aunque la clave cambiara.
  const jefe = jefeDelGrupo({ clave: 'jefe:Ventas', jefe: 'Ventas', subs: [por('s6')] });
  assert.ok(jefe && 'id' in jefe.elegido && jefe.elegido.id === 6, 'el grupo tiene su fila jefe, con el elegido de su chat');
  assert.equal(idConMenu(jefe), null, 'la fila jefe de un grupo no es un chat');
  assert.equal(idConMenu({ ...jefe, clave: 's6' }), null, 'la marca `jefeDeGrupo` la deja afuera aunque la clave se pareciera');

  // La criatura elegida le gana a la de su nombre, sólo en una fila con el «⋯»: el Cerebro sigue con la estrella (null).
  const A = { forma: 'gota', color: '--grafo-documentos', cara: 'sonrisa' } as const;
  const B = { forma: 'circulo', color: '--grafo-documentos', cara: 'risa' } as const;
  const munecos = { 5: A, 6: A, 7: A };
  assert.deepEqual(conCriaturaElegida({ ...por('s6'), aspecto: B }, munecos).aspecto, A, 'la elegida, en su chat');
  assert.equal(conCriaturaElegida({ ...por('jefe'), aspecto: null }, munecos).aspecto, null, 'el Cerebro, la estrella, aunque haya una con su id');
  assert.deepEqual(conCriaturaElegida({ ...por('o7'), aspecto: B }, munecos).aspecto, B, 'Offer con la suya: el id 7 de Offer no es el chat 7');
  assert.deepEqual(conCriaturaElegida({ ...por('s6'), aspecto: B }, {}).aspecto, B, 'sin elegida, la de su nombre');
  // Y el motor de la pantalla la usa sobre la lista que dibuja (la de su nombre primero, la elegida después).
  assert.match(sinComentarios(leer('app/second-brain/useChatCliente.ts')), /aspectoDeChat\(f\.clave\) \}\)\)\s*\.map\(\(f\) => conCriaturaElegida\(f, munecos\)\)/);
});

test('la pantalla monta ESA pieza: la fila del cliente pasa onMenu y MenusCentro recibe el motor del cliente', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  const fila = sb.slice(sb.indexOf('const fila = (f: (typeof k.lista)[number]'), sb.indexOf('const abrirGuru = '));
  assert.ok(fila.length > 200 && fila.length < 2000, `el recorte de la fila mide ${fila.length}`);
  assert.match(fila, /<FilaDeChat [\s\S]*onMenu=\{k\.menuDeFila\(f\)\}/, 'la fila del cliente ofrece el «⋯» y el clic derecho');
  assert.match(sb, /<MenusCentro chats=\{k\.menuDeChats\} \/>/, 'el menú es MenusCentro, con el motor del cliente');
  // UNA pieza: no hay otro menú de filas ni otra ventana de criaturas en la pantalla del cliente.
  assert.doesNotMatch(sb, /<ElegirMuneco\b/, 'la ventana de la criatura vive en MenusCentro');
  const piezas = sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx'));
  assert.match(piezas, /export function MenusCentro\(p: \{ centro: Centro \} \| \{ chats: MenuDeChats \}\)/);
  assert.match(piezas, /const k = 'chats' in p \? p\.chats : menuDelCentro\(p\.centro\);/, 'el del super admin va por el mismo JSX');
  // Lo que escribe va por la ruta, con su acción.
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /postJson<\{ sesion: SesionChat \}>\(\{ action: 'renombrar', sessionId: r\.id, nombre: v\.nombre \}\)/);
  assert.match(motor, /postJson<\{ munecos: MunecosDeChats \}>\(\{ action: 'criatura', sessionId: e\.id, aspecto \}\)/);
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const post = ruta.slice(ruta.indexOf('export async function POST'));
  assert.ok(post.indexOf('const persona = await personaDelRequest();') >= 0 && post.indexOf('const persona = await personaDelRequest();') < post.indexOf("body.action === 'renombrar'"),
    'la persona (su sesión y su negocio) se resuelve ANTES de las acciones del menú');
});
