// =============================================================================
// «Entender el pedido» en el chat «Editar con IA» del Video Editor (16/10/2026)
// =============================================================================
// Martín (textual en docs/diseno-mako-pedidos.md): que todo chat entienda «feedback sobre lo actual… y también créame
// otra…», «la otra» y un pedido de otra tab. El chat le pregunta a POST /api/mako/pedidos antes de su IA, con los
// proyectos del NAVEGADOR (`objetos`). Fija, con el núcleo de VERDAD (lib/mako-pedidos.ts, sólo reglas):
//   · lo del proyecto abierto va a la IA del chat, y lo demás vuelve como burbuja de MaKo con su link;
//   · borrar un proyecto NO se hace desde el chat (no hay papelera: se va con su material): se dice dónde;
//   · «la otra» con dos candidatos pregunta cuál, y nunca elige el primero;
//   · si la ruta falla, el mensaje entero va a la IA, como antes; las sugerencias no pasan por la ruta;
//   · los links de una burbuja son de ADENTRO de la app, también al volver de la base.
//
// PROBADO ROMPIÉNDOLO: ver el final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interpretarCon, type ContextoPedidos, type ObjetoChat, type OperacionChat } from '../lib/mako-pedidos';
import { REGISTRO, ordenarPorRelevancia, porId } from '../lib/api-mako/registro';
import { esAccion, esLectura, type OperacionDef } from '../lib/api-mako/tipos';
import {
  RUTA_INICIO, RUTA_NUEVO, TEXTOS, burbujasDe, cuerpoPedidos, interpretacionDe, objetosDeProyectos, textoActual,
} from '../app/video-editor/_opencut/chat/pedidos';
import { hiloParaGuardar } from '../lib/editor-video/chat-hilo';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const ACTUAL: ObjetoChat = { id: 'p-abierto', nombre: 'Anuncio octubre', tocadoAt: '2026-10-16T10:00:00Z' };
const OTRO: ObjetoChat = { id: 'p-otro', nombre: 'Testimonio María', tocadoAt: '2026-10-15T10:00:00Z' };
const TERCERO: ObjetoChat = { id: 'p-tercero', nombre: 'Oferta 48 horas', tocadoAt: '2026-10-14T10:00:00Z' };

/** El contexto que arma la ruta, con las operaciones del registro y su relevancia (como app/api/mako/pedidos). */
function contexto(objetos: ObjetoChat[]): ContextoPedidos {
  const operaciones: OperacionChat[] = REGISTRO.filter((d) => esAccion(d) || esLectura(d))
    .map((d) => ({ id: d.id, area: d.area, tipo: esLectura(d) ? 'lectura' : 'accion', titulo: d.titulo, descripcion: d.descripcion }));
  const ordenar = (ops: readonly OperacionChat[], texto: string) => {
    const porIdChat = new Map(ops.map((o) => [o.id, o]));
    return ordenarPorRelevancia(ops.map((o) => porId(o.id)).filter((d): d is OperacionDef => !!d), texto)
      .map((d) => porIdChat.get(d.id)).filter((o): o is OperacionChat => !!o);
  };
  return { tab: 'video', actual: ACTUAL, objetos, operaciones, ws: 9, ordenar };
}
/** Como el chat: la respuesta de la ruta (las reglas del núcleo), validada, y lo que sigue a la IA y las burbujas. */
async function chat(texto: string, objetos: ObjetoChat[] = [ACTUAL, OTRO]) {
  const r = await interpretarCon(texto, contexto(objetos), null);
  const i = interpretacionDe({ ok: true, ...r }, texto);
  return { aLaIA: textoActual(i), burbujas: burbujasDe(i, ACTUAL.id) };
}

// ── Lo que manda el chat ─────────────────────────────────────────────────────

test('1: los proyectos del navegador van como `objetos`, el último tocado arriba, y el cuerpo es de la tab video', () => {
  const metas = [
    { id: 'a', name: 'Viejo', updatedAt: new Date('2026-10-01T00:00:00Z') },
    { id: 'b', name: 'Nuevo', updatedAt: new Date('2026-10-16T00:00:00Z') },
  ];
  assert.deepEqual(objetosDeProyectos(metas).map((o) => o.id), ['b', 'a']);
  assert.equal(objetosDeProyectos(Array.from({ length: 250 }, (_, i) => ({ id: `p${i}`, name: 'x', updatedAt: new Date(0) }))).length, 200);
  const c = cuerpoPedidos('  hola  ', { id: 'p1', nombre: ' Mi anuncio ' }, []);
  assert.deepEqual(c, { texto: 'hola', tab: 'video', actualId: 'p1', actualNombre: 'Mi anuncio', objetos: [] });
});

test('2: si la ruta falla o vuelve rota, el mensaje ENTERO va a la IA del chat, como antes', () => {
  for (const r of [null, { ok: false }, { ok: true, pedidos: [] }, { ok: true, pedidos: [{ sobre: 'raro', texto: 'x' }] }]) {
    const i = interpretacionDe(r, 'pon transiciones');
    assert.equal(textoActual(i), 'pon transiciones');
    assert.deepEqual(burbujasDe(i, ACTUAL.id), []);
  }
});

// ── Lo que contesta, con el núcleo de verdad ─────────────────────────────────

test('3: «edita esto y también créame otro proyecto»: lo actual a la IA, y lo otro con la pregunta y el link', async () => {
  const r = await chat('Ponle transiciones suaves a los cortes. Y también créame otro proyecto para mi otro producto');
  assert.match(r.aLaIA ?? '', /transiciones suaves/);
  assert.doesNotMatch(r.aLaIA ?? '', /otro proyecto/);
  assert.equal(r.burbujas.length, 1);
  assert.match(r.burbujas[0].texto, /^¿Terminamos esto y después/);
  assert.deepEqual(r.burbujas[0].links, [{ texto: TEXTOS.crear, href: RUTA_NUEVO }]);
});

test('4: sólo «créame otro proyecto»: no se llama a la IA, y la burbuja va directa', async () => {
  const r = await chat('Créame otro proyecto para el lanzamiento');
  assert.equal(r.aLaIA, null, 'sin nada del abierto no se gasta la IA');
  assert.equal(r.burbujas[0].texto, TEXTOS.directa);
});

test('5: borrar NO se hace desde el chat: el otro y el abierto dicen dónde se borra', async () => {
  const otro = await chat('Borra el otro proyecto');
  assert.equal(otro.aLaIA, null);
  assert.match(otro.burbujas[0].texto, /«Testimonio María» se borra desde el inicio del editor/);
  assert.deepEqual(otro.burbujas[0].links, [{ texto: TEXTOS.inicio, href: RUTA_INICIO }]);
  const abierto = await chat('Elimina este proyecto');
  assert.equal(abierto.burbujas[0].texto, TEXTOS.abiertoBorrar);
});

test('6: «la otra» con dos candidatos pregunta cuál, con un link a cada uno; nunca elige el primero', async () => {
  const r = await chat('Cambia el título del otro proyecto', [ACTUAL, OTRO, TERCERO]);
  assert.equal(r.aLaIA, null);
  assert.match(r.burbujas[0].texto, /^¿Cuál: «Testimonio María» o «Oferta 48 horas»\?$/);
  assert.deepEqual(r.burbujas[0].links.map((l) => l.href), ['/video-editor/p-otro', '/video-editor/p-tercero']);
  const sinOtros = await chat('Cambia el título del otro proyecto', [ACTUAL]);
  assert.equal(sinOtros.burbujas[0].texto, TEXTOS.cual);
});

test('6b: «proyecto» es el objeto de ESTA tab sólo en el Video Editor; en otra tab sigue siendo del Plan', async () => {
  // Visto al engancharlo: sin `OBJETOS_DE_LA_TAB` (lib/mako-pedidos.ts), «créame otro proyecto» en el editor era «Eso se hace en Plan».
  const enElEditor = await chat('Créame otro proyecto');
  assert.equal(enElEditor.burbujas[0].links[0].href, RUTA_NUEVO);
  const enLanding = await interpretarCon('Créame otro proyecto', { ...contexto([]), tab: 'landing', actual: { id: '7', nombre: 'Mi landing' } }, null);
  assert.equal(enLanding.pedidos[0].sobre, 'otra-tab');
  assert.equal(enLanding.pedidos[0].sobre === 'otra-tab' && enLanding.pedidos[0].area, 'plan');
});

test('7: lo de las PARTES del proyecto (un clip, una escena) es del abierto: va todo a la IA, sin burbujas', async () => {
  const r = await chat('Borra el clip del final y crea una escena nueva');
  assert.equal(r.aLaIA, 'Borra el clip del final y crea una escena nueva');
  assert.deepEqual(r.burbujas, []);
});

test('8: un pedido de otra tab deja el link de esa tab, de adentro de la app', async () => {
  const r = await chat('Agéndame una reunión con Juan para mañana');
  assert.equal(r.aLaIA, null);
  assert.equal(r.burbujas.length, 1);
  assert.match(r.burbujas[0].texto, /^Eso se hace en /);
  assert.match(r.burbujas[0].links[0].href, /^\/(?!\/)/);
  // Un link de afuera que viniera de la ruta no se dibuja: lo frena la validación de la respuesta y, por si una
  // interpretación llegara armada por otro lado, también la burbuja (las dos, a propósito).
  const rara = interpretacionDe({ ok: true, pedidos: [{ sobre: 'otra-tab', texto: 'x', area: 'crm', titulo: 'CRM', link: '//malo.com', operacion: null }], propuesta: null, origen: 'reglas' }, 'x');
  assert.deepEqual(burbujasDe(rara, ACTUAL.id), []);
  const armada = { pedidos: [{ sobre: 'otra-tab' as const, texto: 'x', area: 'crm' as const, titulo: 'CRM', link: '//malo.com', operacion: null, confirmar: false }], propuesta: null, origen: 'reglas' as const };
  assert.deepEqual(burbujasDe(armada, ACTUAL.id), []);
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('9: el chat pregunta ANTES de su IA, con los proyectos del navegador, y a la IA le manda sólo lo actual', () => {
  const p = leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx');
  const pedir = p.slice(p.indexOf('async function pedirEdicion'), p.indexOf('const rotuloSeleccion'));
  const pregunta = pedir.indexOf('await pedirPedidos(');
  const ia = pedir.indexOf('await pedirIA(');
  assert.ok(pregunta > 0 && ia > pregunta, 'primero qué se pide, después la IA');
  assert.match(pedir, /paraEditar = textoActual\(interp\);/);
  assert.match(pedir, /if \(!paraEditar\) \{\s*terminar\(null\);/, 'sin nada del abierto, no se llama a la IA');
  assert.match(pedir, /await pedirIA\(\{ instruccion: paraEditar,/);
  assert.match(p, /objetosDeProyectos\(await storageService\.loadAllProjectsMetadata\(\)/);
  assert.match(p, /enviar\(s\.instruccion, s\.necesitaSeleccion \? "seleccion" : alcanceReal, \{ interpretar: false \}\);/, 'una sugerencia no pasa por la ruta');
  assert.match(p, /<Link key=\{l\.href\} href=\{l\.href\}/, 'los links con el Link de la app (pega el ?ws=)');
});

test('10: los links de una burbuja vuelven de la base sólo si son de adentro de la app', () => {
  const [m] = hiloParaGuardar([{
    id: 'a', c: 1, t: 1, de: 'mako', texto: 'Eso va en un proyecto nuevo.',
    links: [{ texto: 'Crear', href: '/video-editor/nuevo' }, { texto: 'Malo', href: '//otro.com' }, { texto: 'Peor', href: 'javascript:alert(1)' }],
  }]) as Array<{ links?: unknown }>;
  assert.deepEqual(m.links, [{ texto: 'Crear', href: '/video-editor/nuevo' }]);
});

// Probado rompiéndolo (16/10/2026), cada rotura restaurada (base 11/0), todas -> 10/1 salvo las marcadas:
//   · los proyectos sin ordenar / sin el tope de 200 / el cuerpo con otra tab
//   · crear sin la pregunta / borrar el abierto sin decir dónde / con dos candidatos elige el primero
//   · un link de afuera se dibuja (SOBREVIVÍA: la validación de la respuesta ya lo frenaba antes; ahora se prueba
//     también la burbuja sola)
//   · el núcleo sin los objetos de la tab (-> 6/5) / «el otro proyecto» no es «el otro» (-> 9/2)
//   · la IA del chat recibe el mensaje entero / sin nada del abierto igual llama a la IA / sin los proyectos del
//     navegador / las sugerencias pasan por la ruta / los links sin el Link de la app
//   · el hilo guarda links de afuera
