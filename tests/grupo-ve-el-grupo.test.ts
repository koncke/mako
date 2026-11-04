// =============================================================================
// El turno del grupo VE el grupo (28/10/2026, el diagnóstico del Cerebro: tanda 2, F2)
// =============================================================================
// Lo que el turno no veía, y le costó a Leandro y a Joan:
//   F2a. lo que mandan el equipo y las automatizaciones (`enviarAlGrupoMaKo` sólo anotaba el anti-eco: de 30 avisos del
//        equipo en 7 grupos, ninguno llegó a un turno; Joan oyó «sí» a lo contrario del aviso «sólo con Zernio»);
//   F2b. los tickets del negocio (el pedido de Leandro ya estaba EN CURSO y MaKo habría abierto un duplicado);
//   F2c. lo que hace MaKo (`listar_capacidades_mako` viajaba sólo si el mensaje nombraba MaKo, y la lista de herramientas
//        decía «y NINGUNA otra»).
// Lo que fija este test:
//   1. `enviarAlGrupoMaKo` REAL (tests/_grupo-memoria-hijo.ts): 'mako' a la conversación, 'equipo' al anillo del equipo y
//      nunca como turno de MaKo, null a ningún lado; la memoria es obligatoria y cada llamador la declara;
//   2. el bloque del equipo: los de 7 días, hasta 6, con su fecha; va en el system del turno;
//   3. los pedidos del negocio y la marca [[ya-pedido: #N]]: se suma al ticket abierto de ESE negocio, se lleva el
//      [[no-existe]] duplicado, y se saca siempre (nunca le llega al cliente);
//   4. lo que hace MaKo viaja en todo turno que consulta, actúa o piensa (en capturar y en charla, no).
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bloqueDelEquipo, conElNuevo, TOPE_GUARDADOS } from '../lib/doer-equipo';
import { bloqueDePedidos, sacarYaPedido } from '../lib/pedidos-del-negocio';
import { NUCLEO_GRUPO, funcionesParaElGrupo, TOPE_FUNCIONES_DEL_GRUPO } from '../lib/nucleo-grupo';
import { funcionDeKey } from '../lib/funciones-mako';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TZ = 'America/Argentina/Buenos_Aires';

function hijo(archivo: string, marca: string, extra: string[] = []): any {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', ...extra, fileURLToPath(new URL(archivo, import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith(marca));
  assert.ok(linea, `${archivo} no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const out = JSON.parse(linea.slice(marca.length));
  assert.equal(out.error, undefined, String(out.error));
  return out;
}

test('1. F2a: lo que se manda al grupo queda donde corresponde; lo del equipo NUNCA como turno de MaKo', () => {
  const r = hijo('./_grupo-memoria-hijo.ts', '@@MEMORIA@@');
  for (const k of ['mako', 'equipo', 'nulo']) assert.equal(r[k].ok, true, `${k}: no salió (${JSON.stringify(r[k])})`);
  assert.deepEqual(r.convTrasMako, ['assistant:🔔 Entró Elida: ¿la contactaron?'], 'la automatización no quedó en la conversación');
  assert.deepEqual(r.anilloTrasMako, []);
  assert.deepEqual(r.convTrasEquipo, r.convTrasMako, 'lo del equipo quedó como turno de MaKo: un «sí» a su pregunta sería una confirmación');
  assert.deepEqual(r.anilloTrasEquipo, ['Ya quedó listo: en Automations ya puedes sumar botones a los DM de Instagram.']);
  assert.deepEqual([r.convTrasNulo, r.anilloTrasNulo], [r.convTrasEquipo, r.anilloTrasEquipo], 'null guardó algo (quien llama ya lo guarda)');
  // Obligatoria, y cada llamador la declara.
  const grupo = sinComentarios(leer('lib/mako-grupo.ts'));
  // (`texto0`: el texto crudo, antes de sumarle el `?ws=` a los links; tests/links-con-ws.test.ts fija esa línea.)
  assert.match(grupo, /export async function enviarAlGrupoMaKo\(ws: number, texto0?: string, memoria: MemoriaDelEnvio\): Promise<EnvioGrupo> \{/, 'la memoria volvió a ser opcional');
  assert.match(leer('lib/aviso-arreglo.ts'), /enviarAlGrupoMaKo\(p\.ws, t\.texto, 'equipo'\)/);
  assert.match(leer('lib/tickets-cierre.ts'), /enviarAlGrupoMaKo\(ws, sanearSalida\(texto, \{ corrioHerramientas: true \}\)\.texto, \{ de: 'equipo', ticket: Number\(f\.id\) \}\)/, 'la respuesta del equipo a un ticket quedó como turno de MaKo');
  assert.match(leer('lib/insistencias.ts'), /enviarAlGrupoMaKo\(ws, row\.texto, 'mako'\)/);
  assert.equal((leer('lib/flujos.ts').match(/enviarAlGrupoMaKo\([^\n]*, 'mako'\)/g) ?? []).length, 4, 'una salida de una automatización sin su memoria');
  assert.match(leer('lib/avisos.ts'), /enviarAlGrupoMaKo\(ws, texto, null\)/);
});

test('2. F2a: el bloque del equipo, los de 7 días y hasta 6, con su fecha; va en el system del turno', () => {
  const ahora = new Date('2026-10-28T13:30:00Z');
  let g: string | null = null;
  for (let i = 0; i < 12; i++) g = JSON.stringify(conElNuevo(g, { at: new Date(ahora.getTime() - (11 - i) * 43_200_000).toISOString(), texto: `aviso ${i}` }));
  assert.equal(JSON.parse(g!).length, TOPE_GUARDADOS, 'el anillo crece sin tope');
  const b = bloqueDelEquipo(g, ahora, TZ);
  assert.match(b, /^LO QUE EL EQUIPO DE MaKo ESCRIBIÓ EN ESTE GRUPO/);
  assert.equal(b.split('\n').length, 7, 'más de 6 en el bloque');
  assert.match(b, /- hoy 10:30 — «aviso 11»$/m);
  assert.doesNotMatch(b, /«aviso 4»/, 'entró uno de hace más de 7 días');
  assert.equal(bloqueDelEquipo(null, ahora, TZ), '');
  assert.equal(bloqueDelEquipo('no es json', ahora, TZ), '');
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /\[bloqueQuienEscribe\(data\.pushName\), (?:ctxCita, )?(?:ctxParaElEquipo, )?ctxContacto, ctxEquipo, ctxPedidos, ctxYaSeHablo, ctxMostrado\]/, 'el turno no ve lo del equipo o los pedidos');
  assert.match(NUCLEO_GRUPO, /el bloque LO QUE EL EQUIPO DE MaKo ESCRIBIÓ EN ESTE GRUPO/);
});

test('3. F2b: los pedidos del negocio y [[ya-pedido: #N]]: al ticket de ESE negocio, sin duplicado, y nunca al cliente', () => {
  const b = bloqueDePedidos([{ id: 18, titulo: 'Responder en público los comentarios de Instagram', estado: 'en_curso', respuesta: 'Es lo que estamos construyendo ahora mismo en Automations.', updated_at: '2026-10-28T13:44:00Z' }], new Date('2026-10-28T15:00:00Z'), TZ);
  assert.match(b, /^PEDIDOS ABIERTOS DE ESTE NEGOCIO/);
  assert.match(b, /- #18 «Responder en público los comentarios de Instagram» — En curso \(act\. hoy 10:44\) · el equipo dijo: «Es lo que estamos construyendo/);
  assert.equal(bloqueDePedidos([], new Date(), TZ), '');
  assert.deepEqual(sacarYaPedido('Ya está pedido: #18, en curso. [[ya-pedido: #18]]', [18]), { texto: 'Ya está pedido: #18, en curso.', ids: [18] });
  assert.deepEqual(sacarYaPedido('Pedido #18. [[ya-pedido:#18]]\n[[no-existe: responder en público]]', [18]), { texto: 'Pedido #18.', ids: [18] }, 'el [[no-existe]] del mismo pedido abriría el duplicado');
  // Con espacio o guion bajo (la verificación de 5b7a1917d): la variante también le llegaba al cliente.
  for (const marca of ['[[ya pedido: #18]]', '[[ya_pedido: #18]]', '[[ Ya-Pedido #18 ]]', '[[ya—pedido: #18]]', '[[ya–pedido #18]]', '[ya-pedido: #18]']) {
    assert.deepEqual(sacarYaPedido(`En curso. ${marca}`, [18]), { texto: 'En curso.', ids: [18] }, `«${marca}» le llega al cliente`);
  }
  const ajeno = sacarYaPedido('Eso ya lo pediste [[ya-pedido: #99]] [[no-existe: responder comentarios]]', [18]);
  assert.deepEqual(ajeno.ids, [], 'se sumó al ticket de otro negocio o a uno cerrado');
  assert.doesNotMatch(ajeno.texto, /ya-pedido/, 'la marca le llega al cliente');
  assert.match(ajeno.texto, /\[\[no-existe:/, 'sin un pedido abierto de verdad, lo que no existe tiene que abrir su ticket');
  // En el doer: la marca se saca SIEMPRE, antes de los tickets de las marcas; sólo con los pedidos abiertos de este negocio.
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const i = doer.indexOf('const yaPedido = sacarYaPedido(respuesta, pedidosDelNegocio.filter((p) => p.estado !== \'resuelto\').map((p) => p.id));');
  assert.ok(i > 0 && i < doer.indexOf('const np = await conTicketsDeMaKo(respuesta'), 'la marca no se saca, o se saca después de abrir los tickets');
  assert.match(doer.slice(i - 80, i), /if \(respuesta\) \{\s*$/, 'la marca se saca sólo en algunas respuestas');
  assert.match(doer, /for \(const id of yaPedido\.ids\) await sumarAlPedidoDelNegocio\(wsData, id, sinPrefijoDeLote\(texto\)\)/);
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  const fn = db.slice(db.indexOf('export async function sumarAlPedidoDelNegocio('), db.indexOf('export async function comentarComoCliente('));
  assert.match(fn, /\.eq\('id', id\)\.eq\('workspace_id', ws\)\.maybeSingle\(\);\n\s*if \(!tk \|\| CERRADOS\.includes\(tk\.estado as EstadoTicket\)\) return false;/, 'se puede escribir en el ticket de otro negocio o en uno cerrado');
  assert.match(db, /export async function ticketsDelNegocio\(ws: number, diasResueltos = 3, tope = 8\)/);
  assert.match(NUCLEO_GRUPO, /marca \[\[ya-pedido: #N\]\]/);
});

test('4. F2c: lo que hace MaKo viaja en todo turno que consulta, actúa o piensa; la lista ya no dice «y NINGUNA otra»', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /const toolsDeSiempre = \[\.\.\.MAKO_TOOLS, \.\.\.MAKO_ACCION_TOOLS, \.\.\.TICKET_TOOLS, \.\.\.CAPACIDADES_TOOLS\];/);
  assert.match(doer, /const CAPACIDADES_TOOLS = \(\(\) => \{ const d = porId\('listar_capacidades_mako'\);/);
  assert.doesNotMatch(doer, /y NINGUNA otra/, 'el modelo cree que tiene todas las herramientas de MaKo');
  assert.match(doer, /son una selección para este pedido, no todo lo que MaKo hace/);
  assert.doesNotMatch(leer('lib/hechos-mako.ts'), /es lo ÚNICO que puedes afirmar/, 'los hechos vuelven a cerrar lo que MaKo puede afirmar');
  // El banco (tests/_banco-grupo.ts, con las de siempre del doer): una consulta lo lleva; capturar y charla, no.
  const codigo = `const { correrBanco, ticketTools } = await import(${JSON.stringify(new URL('./_banco-grupo.ts', import.meta.url).href)});
    const { MAKO_TOOLS } = await import(${JSON.stringify(new URL('../lib/mako-tools.ts', import.meta.url).href)});
    const { MAKO_ACCION_TOOLS } = await import(${JSON.stringify(new URL('../lib/mako-doer-acciones.ts', import.meta.url).href)});
    process.stdout.write('@@BANCO@@' + JSON.stringify(correrBanco([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS, ...(await ticketTools())])) + '\\n');`;
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@BANCO@@'));
  assert.ok(linea, `el banco no corrió: ${(r.stderr ?? '').slice(-800)}`);
  const banco = JSON.parse(linea.slice('@@BANCO@@'.length)) as Array<{ n: string; intencion: string; tools: string[]; pulgar: boolean }>;
  for (const f of banco.filter((x) => !x.pulgar && ['consultar', 'actuar', 'pensar'].includes(x.intencion))) {
    assert.ok(f.tools.includes('listar_capacidades_mako'), `${f.n} (${f.intencion}) sin listar_capacidades_mako`);
  }
  for (const f of banco.filter((x) => !x.pulgar && ['capturar', 'charlar'].includes(x.intencion))) {
    assert.ok(!f.tools.includes('listar_capacidades_mako'), `${f.n} (${f.intencion}) lleva listar_capacidades_mako`);
  }
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   E1 'equipo' guarda como turno de MaKo                                                → falla el 1
//   E2 'mako' no guarda                                                                  → falla el 1
//   E3 la memoria opcional (`memoria?: MemoriaDelEnvio`)                                 → falla el 1
//   E4 la respuesta de un ticket como 'mako'                                             → falla el 1
//   E5 el anillo sin tope                                                                → falla el 2
//   E6 el turno sin `ctxEquipo`                                                          → falla el 2
//   E7 `sacarYaPedido` deja el [[no-existe]] del mismo pedido                            → falla el 3
//   E8 `sacarYaPedido` acepta un número que no es de un pedido abierto                   → falla el 3
//   E9 `sumarAlPedidoDelNegocio` sin el workspace                                        → falla el 3
//   E10 sin `CAPACIDADES_TOOLS` en las de siempre                                        → falla el 4
//   E11 `MARCA_YA_PEDIDO` sólo con guion (`ya-pedido`)                                   → falla el 3
//   X2 `MARCA_YA_PEDIDO` sin raya ni corchete solo                                       → falla el 3

test('5. F2c: lo que hace MaKo sale del catálogo de MaKo inteligente, compacto; Automations dice Instagram y «manychat»', () => {
  const t = funcionesParaElGrupo();
  assert.ok(t.length <= TOPE_FUNCIONES_DEL_GRUPO, `el bloque de funciones pesa ${t.length} caracteres`);
  assert.match(t, /^LO QUE HACE MaKo/);
  assert.match(t, /\n- Automations: /);
  assert.match(t, /\n- Chats: /);
  // Del catálogo (lib/funciones-mako.ts), no de uno propio: la entrada de Automations, con lo que le faltó a Leandro.
  const auto = funcionDeKey('setting');
  assert.ok(auto, 'Automations no está en el catálogo');
  assert.ok(auto!.hace.some((h) => /Instagram o Messenger: un comentario en la publicación, el Reel o el En vivo/.test(h)), 'el catálogo no dice que Automations arranca con un comentario de Instagram');
  assert.ok(auto!.hace.some((h) => /botones/.test(h)), 'el catálogo no dice que el DM lleva botones');
  assert.ok(auto!.alias.includes('manychat'), '«como lo hace manychat» no lleva a Automations');
  assert.match(sinComentarios(leer('lib/mako-context.ts')), /if \(grupo\) base \+= `\\n\\n\$\{funcionesParaElGrupo\(\)\}`;/);
});
