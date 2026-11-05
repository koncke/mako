// =============================================================================
// «Vincular evento» y «Vincular cobro»: el feedback de Martín del 22/10/2026 (segunda vuelta, con capturas del ws1)
// =============================================================================
// Textual: «"Asignar evento" pasa a llamarse "VINCULAR EVENTO". Lo mismo vale para "Vincular cobro"», «Lento... Mostrá
// lo que ya se sabe mientras carga lo demás», «en vez de "Esta etapa", el nombre de la etapa. Y falta el nombre del
// CRM», «Fuera textos... Si hace falta decir algo de Google, que sea un ⓘ», «una etapa de tipo Reunión sin evento
// vinculado muestra un warning en el ⋯ de la columna y en el botón "Vincular evento". Lo mismo una etapa Ganado sin
// cobro», «Que MaKo pueda hacer todo eso y que quede en la API de MaKo».
// Lo puro: lib/vinculos-de-columnas-reglas.ts y app/crm/vincular-etapa.ts. La pantalla: los dos pop-ups, el «⋯» y el menú.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 9 / 0, una rotura por vez y restaurada:
//   · `faltaVincular` sin el `if (!v) return null`                                  → 8 / 1
//   · el renglón del menú sin `aviso` (conDatos sin `d.avisos?.[id]`)                → 8 / 1
//   · MenuContextual sin dibujar el punto del aviso                                  → 8 / 1
//   · el «⋯» de la columna sin `data-falta`                                          → 8 / 1
//   · `ordenarEventos` con lo de otra etapa antes que lo libre                       → 8 / 1
//   · el chip de la etapa diciendo «Esta etapa» otra vez                             → 8 / 1
//   · `cambiar` del pop-up de eventos llamando a `leer()` al final                   → 8 / 1
//   · `desvincular_cobro_etapa` sin decir QUÉ producto saca                          → 8 / 1
//   · `vincular_cobro_etapa` fuera de su lugar (después de las otras tres)           → 8 / 1
// Y lo de la revisión adversarial (23/10/2026), con el archivo en 10 / 0:
//   · `cobraDeVerdad` que cuenta un vínculo sin ninguna cuenta conectada             → 9 / 1
//   · `vincular_cobro_etapa` que propone un producto que ya cobra en otro CRM        → 9 / 1
//   · `ver_cobro_etapa` que ofrece en el catálogo lo que cobra en otro CRM           → 9 / 1
//   · `desvincular_cobro_etapa` sin `plata: true`                                     → 9 / 1
//   · crear un producto que cierra el formulario DESPUÉS de vincular                  → 9 / 1
//   · las cuentas de MaKo sólo de la principal (con la fase A de Cobros, 23/10/2026)    → 9 / 1
// Correr: node --import tsx --test tests/crm-vincular-22-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cobraDeVerdad, faltaVincular } from '../lib/vinculos-de-columnas-reglas';
import { ordenarEventos, ubicacionDe } from '../app/crm/vincular-etapa';
import { AVISO_VINCULO, itemsCrm } from '../app/crm/menu-contextual-crm';
import { ListaMenuContextual, type ItemMenuContextual } from '../app/_ui/MenuContextual';
import { porArea, porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de un archivo, hasta la siguiente al mismo nivel. */
const cuerpo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré ${desde}`);
  const f = src.indexOf(hasta, i + desde.length);
  return src.slice(i, f > i ? f : undefined);
};
const DATOS = { etapas: [], equipo: [], etiquetas: null, funnels: [] };

test('a una columna le falta su vínculo: la de reunión sin evento, Ganado sin cobro; sin la lectura, nada', () => {
  const v = { eventos: ['r1'], cobro: false };
  assert.equal(faltaVincular({ key: 'r1', kind: 'reunion' }, v), null, 'con su evento no avisa');
  assert.equal(faltaVincular({ key: 'r2', kind: 'reunion' }, v), 'evento');
  assert.equal(faltaVincular({ key: 'ganado', kind: 'terminal' }, v), 'cobro');
  assert.equal(faltaVincular({ key: 'ganado', kind: 'terminal' }, { eventos: [], cobro: true }), null);
  assert.equal(faltaVincular({ key: 'contactado', kind: 'etapa' }, { eventos: [], cobro: true }), null, 'una etapa común no tiene vínculo');
  // Sin poder leer: no se avisa (un aviso que miente es peor que ninguno).
  assert.equal(faltaVincular({ key: 'r2', kind: 'reunion' }, null), null);
  assert.equal(faltaVincular({ key: 'ganado' }, undefined), null);
  // Ganado «cobra» si algún vínculo tiene una cuenta TODAVÍA conectada (revisión del 23/10/2026): con Mercado Pago
  // desconectado, el vínculo sigue pero ningún pago pasa a Ganado.
  const stripe = { id: 'stripe:principal', proveedor: 'stripe' as const, nombre: 'Stripe', principal: true };
  assert.equal(cobraDeVerdad([{ cuentas: ['mercadopago:principal'] }], [stripe]), false);
  assert.equal(cobraDeVerdad([{ cuentas: ['mercadopago:principal'] }, { cuentas: ['stripe:principal'] }], [stripe]), true);
  assert.equal(cobraDeVerdad([], [stripe]), false);
  assert.equal(cobraDeVerdad([{ cuentas: ['stripe:principal'] }], []), false, 'sin ninguna pasarela no cobra nada');
});

test('el renglón que lo arregla lleva el aviso, y el menú lo dibuja como un punto con su texto', () => {
  const items = itemsCrm(['col_evento', 'col_cobro'], { ...DATOS, avisos: { col_evento: AVISO_VINCULO.evento } });
  const [evento, cobro] = items as ItemMenuContextual[];
  assert.equal(evento.label, 'Vincular evento');
  assert.equal(evento.aviso, 'Sin evento vinculado');
  assert.equal(cobro.aviso, undefined, 'el aviso de otra opción no se contagia');
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, { items, onElegir: () => {} }));
  assert.match(html, /role="img" aria-label="Sin evento vinculado" title="Sin evento vinculado"/);
  assert.equal((html.match(/role="img"/g) ?? []).length, 1);
});

test('el «⋯» de la columna: punto ámbar y el aviso en su nombre; el tablero lo lee en la primera ola, de la base', () => {
  const board = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(board, /const falta = faltaVincular\(c, vinculados\);/);
  assert.match(board, /className="mk-col-mas" aria-haspopup="menu" data-falta=\{falta \?\? undefined\}/);
  assert.match(board, /avisos: c \? avisosDeColumna\(c\) : undefined,/, 'el menú del «⋯» y del clic derecho, con el aviso');
  assert.match(leer('app/globals.css'), /\.mk-col-mas\[data-falta\]::after \{[^}]*background: var\(--warn\)/);
  const page = sinComentarios(leer('app/crm/page.tsx'));
  assert.match(page, /const pVinculados = vinculadosDelCrm\(/);
  // Desde el 23/10/2026 la ola trae también el tope del plan (`pTope`, tests/crm-topes-plan-23-10.test.ts).
  assert.match(page, /camposTarjeta, vinculados(, tope)?\] = await Promise\.all\(\[[^\]]*pVinculados(, pTope)?\]\)/, 'en la ola, no después');
  assert.match(page, /vinculados=\{vinculados\}/);
  // Lecturas de la base (los vínculos y qué pasarelas tienen claves), nunca la API de las agendas ni de las pasarelas, y
  // nunca tira.
  const srv = sinComentarios(leer('lib/vinculos-de-columnas.ts'));
  assert.match(srv, /leerVinculos\(\), vinculosDeEtapa\(funnelId, 'ganado'\),/);
  assert.match(srv, /cobro: cobraDeVerdad\(cobros, conectadas\),/);
  assert.match(srv, /\} catch \{\s*return null;\s*\}/);
  assert.doesNotMatch(srv, /listarEventosDeAgenda|fetch\(|api\.stripe|api\.mercadopago/);
});

test('la lista de eventos: lo de esta etapa, lo libre, y lo de otra con «CRM › Etapa»', () => {
  const ev = (nombre: string, vinculo: { funnelId: number; etapa: string } | null) => ({ nombre, vinculo });
  const orden = ordenarEventos([ev('Zeta otra', { funnelId: 2, etapa: 'r1' }), ev('Beta libre', null), ev('Alfa libre', null),
    ev('Demo aquí', { funnelId: 1, etapa: 'r1' }), ev('Misma etapa otro CRM', { funnelId: 2, etapa: 'r1' })], 1, 'r1');
  assert.deepEqual(orden.map((e) => e.nombre), ['Demo aquí', 'Alfa libre', 'Beta libre', 'Misma etapa otro CRM', 'Zeta otra']);
  assert.equal(ubicacionDe({ funnel: 'Ventas', etapaNombre: 'Llamada 1' }), 'Ventas › Llamada 1');
  assert.equal(ubicacionDe({ funnel: '  ', etapaNombre: 'Llamada 1' }), 'Llamada 1');
  assert.equal(ubicacionDe(null), null);
});

test('los dos pop-ups: «Vincular …», el CRM › la etapa arriba, el nombre de la etapa en vez de «Esta etapa», sin textos largos', () => {
  for (const [archivo, titulo] of [['app/crm/EventosDeEtapaModal.tsx', 'Vincular evento'], ['app/crm/CobroDeEtapaModal.tsx', 'Vincular cobro']] as const) {
    const m = sinComentarios(leer(archivo));
    assert.match(m, new RegExp(`/> ${titulo}</span>\\}`), `${archivo}: el título`);
    assert.match(m, /encabezado=\{<span className="vx-donde-titulo">\{crmNombre\} › \{etapaNombre\}<\/span>\}/, `${archivo}: el CRM y la etapa`);
    assert.match(m, /<style>\{CSS_VINCULAR\}<\/style>/, `${archivo}: la misma hoja (computadora y teléfono)`);
    assert.doesNotMatch(m, /Esta etapa/, `${archivo}: volvió «Esta etapa»`);
    assert.match(m, /className="vx-info" role="img"/, `${archivo}: lo que se explica, en una ⓘ`);
  }
  const ev = sinComentarios(leer('app/crm/EventosDeEtapaModal.tsx'));
  assert.match(ev, /<span className="vx-chip vx-chip--aqui">\{etapaNombre\}<\/span>/);
  assert.doesNotMatch(ev, /Quien se agende|Google no comparte/);
  assert.match(leer('app/crm/vincular-etapa.ts'), /@media \(max-width: 560px\)/, 'el teléfono');
});

test('lo lento: lo vinculado sale de la base al toque, y vincular, crear y editar no vuelven a leer la agenda entera', () => {
  const ev = sinComentarios(leer('app/crm/EventosDeEtapaModal.tsx'));
  assert.match(ev, /void vinculadosDeEtapaAction\(funnelId, etapa\)\.then\(\(r\) => \{ if \(r\.ok\) setRapidos\(r\.eventos\); \}\)/);
  for (const [fn, sig] of [['const cambiar = ', 'const crear = '], ['const crear = ', 'const guardarEdicion = '], ['const guardarEdicion = ', 'const duraciones = ']] as const) {
    const c = cuerpo(ev, fn, sig);
    assert.doesNotMatch(c, /\bleer\(\)|listarEventosAgendaAction/, `${fn.trim()} vuelve a leer la agenda`);
    assert.match(c, /ponerVinculo\(|setAgenda\(/, `${fn.trim()} no pone lo nuevo en el lugar`);
  }
  // La acción rápida: sólo la base, con la puerta del admin.
  const a = sinComentarios(leer('app/crm/agenda-evento-actions.ts'));
  const rapida = cuerpo(a, 'export async function vinculadosDeEtapaAction', 'export async function');
  assert.match(rapida, /await exigirSesion\(\);\s*if \(!\(await esAdmin\(\)\)\) return \{ ok: false, error: SOLO_ADMIN \};/);
  assert.match(rapida, /await leerVinculos\(\)/);
  assert.doesNotMatch(rapida, /listarEventosDeAgenda/);
  // El de cobro: cada cambio pone lo que contestó el server; leer, sólo al abrir.
  const co = sinComentarios(leer('app/crm/CobroDeEtapaModal.tsx'));
  assert.equal((co.match(/leerCobroDeEtapaAction\(/g) ?? []).length, 1, 'el pop-up de cobro vuelve a leer todo');
  assert.match(co, /aria-pressed=\{marcada\}/, 'las cuentas, como pastillas que se prenden');
});

test('la API de MaKo: ver, vincular, fijar las cuentas y quitar el cobro de Ganado; sólo el admin, con «sí», al final del área', () => {
  const ids = ['ver_cobro_etapa', 'vincular_cobro_etapa', 'cuentas_cobro_etapa', 'desvincular_cobro_etapa'];
  for (const id of ids) {
    const d = porId(id);
    assert.ok(d, `la API no declara ${id}`);
    assert.equal(d.area, 'crm');
    assert.deepEqual(d.gating, porId('vincular_evento_etapa')!.gating, `${id}: sólo el admin, como vincular un evento`);
    if (id !== 'ver_cobro_etapa') assert.equal(esAccion(d) && d.confirmacion, 'chat', `${id} sin el «sí»`);
  }
  // Al final, antes de armar_tab_ficha: una op nueva no deja afuera a las de antes en el presupuesto del turno. Juntas y en
  // este orden; las que se declararon DESPUÉS (las de en bloque del 28/10/2026, lo que se borró, del 30/10, y el primer contacto, del 5/11) van entre éstas y armar_tab_ficha.
  const orden = porArea('crm').map((d) => d.id);
  const fin = orden.indexOf('armar_tab_ficha');
  const desde = orden.indexOf(ids[0]);
  assert.deepEqual(orden.slice(desde, desde + ids.length), ids);
  assert.ok(desde + ids.length <= fin, 'quedaron después de armar_tab_ficha');
  assert.ok(orden.slice(desde + ids.length, fin).every((id) => /_en_bloque_|_papelera_crm$|^ver_bajas_de_leads$|^ver_nombres_del_crm$|^marcar_palabra_no_nombre$|^tiempo_primer_contacto$/.test(id)), 'entre éstas y armar_tab_ficha se metió una que no es de las de en bloque');
  for (const id of ids) {
    const d = porId(id)!;
    assert.doesNotMatch(`${d.titulo} ${d.descripcion}`, /\bcambi(a|ar)\b|\blead\b/i, `${id}: palabras que el clasificador suma a todo un tipo de pedido`);
  }
});

test('lo que se confirma dice QUÉ se toca, y no se propone lo que va a fallar', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const vincular = cuerpo(run, '  vincular_cobro_etapa: {', '  cuentas_cobro_etapa: {');
  assert.match(vincular, /if \(p\.montoUsd == null\) return \{ error:/, 'un producto sin precio llega hasta el «sí»');
  // Desde 5782ff0d0 (24/10/2026, la limpieza de tipos) los números del payload van con `Number()`, como en todo el archivo:
  // el payload entra de afuera. La regex fijaba la línea vieja y quedó roja sin que nada cambiara de comportamiento.
  assert.match(vincular, /vincularCobro\(\{ funnelId: Number\(payload\.embudoId\), etapa: ETAPA_COBRO,/, 'las mismas funciones del pop-up');
  const cuentas = cuerpo(run, '  cuentas_cobro_etapa: {', '  desvincular_cobro_etapa: {');
  const quitar = cuerpo(run, '  desvincular_cobro_etapa: {', '  armar_tab_ficha: {');
  for (const [nombre, c] of [['cuentas', cuentas], ['quitar', quitar]] as const) {
    assert.match(c, /const v = await vinculoDeCobro\(input\.vinculoId\);\s*if \('error' in v\) return v;/, `${nombre}: sin leer el vínculo`);
    assert.match(c, /resumen: `[^`]*«\$\{v\.producto\}»[^`]*«\$\{v\.crm\}»/, `${nombre}: el «sí» sin decir qué producto ni qué CRM`);
    assert.match(c, /payload: \{ vinculoId: v\.id/, `${nombre}: el id del pedido sin validar`);
  }
  assert.match(sinComentarios(leer('lib/cobro-etapa-server.ts')), /export async function vinculoPorId\(id: number\)/);
});

test('la revisión adversarial (23/10/2026): un producto cobra en UN solo CRM, las tres que escriben son de plata, crear no duplica', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  // MaKo no propone lo que va a chocar con el índice único (un producto, un CRM): ni el catálogo lo ofrece.
  const vincular = cuerpo(run, '  vincular_cobro_etapa: {', '  cuentas_cobro_etapa: {');
  assert.match(vincular, /if \(!ganado\) return \{ error:/, 'un CRM sin Ganado llega hasta el «sí»');
  assert.match(vincular, /const ya = todos\.find\(\(v\) => v\.productoId === p\.id\);/);
  assert.match(vincular, /if \(ya\?\.funnelId === crm\.id\) return \{ error: .*, yaEstaba: true \};/);
  assert.match(vincular, /if \(ya\) \{[\s\S]*?quítalo de ahí primero/);
  const ver = cuerpo(run, '  ver_cobro_etapa: {', '  vincular_cobro_etapa: {');
  assert.match(ver, /catalogo: productos\.filter\(\(p\) => !todos\.some\(\(v\) => v\.productoId === p\.id\)\)/, 'el catálogo ofrece lo que cobra en otro CRM');
  assert.match(ver, /cobran_en_otro_crm:/);
  // Deciden si un pago gana el trato y arma su plan: por WhatsApp, sólo con un «sí» (tests/confirmacion-terceros.test.ts).
  for (const id of ['vincular_cobro_etapa', 'cuentas_cobro_etapa', 'desvincular_cobro_etapa']) assert.equal((() => { const d = porId(id)!; return esAccion(d) && d.plata; })(), true, `${id} sin plata`);
  assert.equal(porId('ver_cobro_etapa')!.tipo, 'lectura');
  // Crear un producto cierra el formulario ANTES de vincular: si vincular se cae, reintentar no crea otro igual.
  const co = sinComentarios(leer('app/crm/CobroDeEtapaModal.tsx'));
  const guardar = cuerpo(co, 'const guardarProducto = ', 'const formProducto = ');
  const iCerrar = guardar.indexOf('setSumando(null);');
  const iVincular = guardar.indexOf('await vincularProductoAEtapaAction(');
  assert.ok(iCerrar > 0 && iVincular > iCerrar, 'el formulario sigue abierto mientras vincula');
  assert.match(guardar, /\.catch\(\(\) => \(\{ ok: false as const, error: 'no contestó' \}\)\)/);
  // Las cuentas: VARIAS por pasarela desde la fase A de Cobros, las mismas que ofrece el pop-up (`cuentasConectadas`).
  // Con `cuentasDePasarelas`, sólo la principal: MaKo rechazaba la secundaria y el aviso del «⋯» no la contaba.
  assert.match(run, /\(await cuentasDePago\(ws\)\)\.filter\(\(c\) => c\.conectada\)/);
  assert.match(sinComentarios(leer('lib/vinculos-de-columnas.ts')), /return cuentasDePago\(ws\); \}\)\.then\(\(cs\) => cs\.filter\(\(c\) => c\.conectada\)\)/);
  assert.doesNotMatch(run + leer('lib/vinculos-de-columnas.ts'), /cuentasDePasarelas\(/);
});

test('«Asignar evento» ya no se dice en ningún lado', () => {
  for (const archivo of ['app/crm/menu-contextual-crm.ts', 'app/crm/EventosDeEtapaModal.tsx', 'lib/etapa-reunion.ts']) {
    assert.doesNotMatch(sinComentarios(leer(archivo)), /Asignar evento|asignar un evento/, archivo);
  }
});
