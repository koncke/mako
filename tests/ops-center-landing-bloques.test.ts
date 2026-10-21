// =============================================================================
// Ops Center 1.12 y 1.13 — los bloques del Web Generator en el hilo con MaKo
// =============================================================================
// Martín (20/10/2026): «quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». Las piezas 1.12
// (la tarjeta de la landing y elegir entre 3: diseños, temas, formato de Replicar) y 1.13 (publicar con Copiar y Abrir,
// y el dominio con sus registros DNS y su estado) de docs/ops-center-principal.md, sobre el marco de bloques de Ops
// Center 3 (lib/chat-bloques.ts, pieza 1.7). Se fija:
//   · lo que ARMA cada bloque (lib/editor-landing/bloques-chat.ts), contra los catálogos reales;
//   · el SANEO (lib/editor-landing/bloques-web.ts, enganchado en `sanearBloque` del marco): rutas de la app para los
//     botones, la dirección pública sólo con forma de landing publicada, y lo que no calza se descarta entero;
//   · el DIBUJO (app/web-generator/BloqueWeb.tsx): se dibuja en node, sin navegador;
//   · que las operaciones lo DEVUELVAN en `datos.bloque` al confirmar: crear desde un diseño se ejecuta con el editor
//     de mentira, en un proceso hijo con los módulos del server.
//
// PROBADO ROMPIÉNDOLO (20/10/2026; arnés que rompe UNA cosa, corre este archivo, restaura y compara el sha256; las 14
// restauradas con el mismo hash; base 9 / 0). Pasan / fallan:
//   R1  la tarjeta de un borrador lleva el link público                               → 8 / 1
//   R2  una publicada con el sitio apagado no dice «pausada»                          → 8 / 1
//   R3  dos de los tres diseños arrancan igual                                        → 8 / 1
//   R4  elegir el tema ofrece el que ya tiene                                         → 8 / 1
//   R5  el www informativo cuenta como registro que falta                             → 7 / 2
//   R6  la dirección pública acepta usuario, contraseña o puerto                      → 8 / 1
//   R7  una sección de cualquier tamaño entra al mensaje guardado                     → 8 / 1
//   R8  el saneo deja el link de un borrador                                          → 8 / 1
//   R9  el marco no engancha el saneo del Web Generator (`default: return null`)      → 6 / 3
//   R10 el saneo deja un botón a cualquier dirección                                  → 8 / 1
//   R11 elegir contesta sólo el título (MaKo no sabe qué se eligió)                   → 8 / 1
//   R12 la tabla DNS dice «Falta» del www informativo                                 → 8 / 1
//   R13 crear desde un diseño no devuelve su tarjeta                                  → 7 / 2
//   R14 el link público se abre sin `noopener`                                        → 8 / 1
//   (con la base en 9 tests; las siguientes, con las lecturas, sobre 12 / 0, y R15, R17, R19 y R21 rehechas sobre
//   13 / 0 cuando el bloque pasó al lado de `content`, el canal `ctx.aDibujar` de ola1, 061c1b74d)
//   R15 listar no deja su bloque al lado de `content`                                 → 12 / 1
//   R16 la lista lleva todas las landings, no las primeras                            → 10 / 2
//   R17 la papelera lleva tarjetas                                                    → 12 / 1
//   R18 el saneo de la lista deja una tarjeta que abre afuera                         → 11 / 1
//   R19 los diseños no dejan su G2                                                    → 11 / 2
//   R20 BloqueWeb no dibuja la lista                                                  → 11 / 1
//   R21 el G2 va también ADENTRO de lo que lee el modelo                              → 11 / 2
//   (revisión del 21/10/2026, sobre 13 / 0: el contrato del G1 y los diseños según el pedido)
//   B1  elegir se toca con MaKo trabajando → 11 / 2 · B2 marca aunque no salió → 12 / 1 · B3 lo contestado sólo al montar → 11 / 2
//   B4  BloqueWeb no le pasa `ocupado` → 12 / 1 · B5 BloqueHilo no se lo pasa → 12 / 1 · B6 conRespuestas no mira el elegir → 12 / 1
//   B7  los diseños sin el pedido → 11 / 2 · B8 dibuja aunque no sirva → 12 / 1 · B9 dibuja en una presentación → 10 / 3
//   B10 dibuja con el diseño ya nombrado → 11 / 2 · B11 «MaKo» la app como diseño → 12 / 1 · B12 sin ordenar por el pedido → 10 / 3
//   B13 sin el «No salió» → 12 / 1
//   (5ª revisión, sobre 13 / 0: una respuesta no cierra dos selectores)
//   C1  todos se cierran con el primer mensaje → 12 / 1 · C2 con uno solo, escribir no lo contesta → 12 / 1
//   C3  «mentoria» no es «Mentoría» → 12 / 1 · C4 «A, B» de varias no es suya → 12 / 1 · C5 «Saltear» no es del G2 → 12 / 1
//   C6  cuentan los selectores de turnos anteriores → 12 / 1
//
// Correr: node --import tsx --test tests/ops-center-landing-bloques.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OPCIONES_POR_BLOQUE, bloqueDeCompleta, bloqueDominio, bloqueLanding, bloqueListaLandings, bloquePublicada, elegirDiseno, elegirDisenoPara, elegirFormatoReplicar, elegirTema,
  estadoDeLanding, rutaEditor,
} from '../lib/editor-landing/bloques-chat';
import { MAX_LANDINGS_BLOQUE, esBloqueWeb, urlPublicada, type BloqueWeb as TBloqueWeb } from '../lib/editor-landing/bloques-web';
import { sanearBloque } from '../lib/chat-bloques';
import { DISENOS_LANDING } from '../lib/editor-landing/disenos-landing';
import { TEMAS } from '../lib/editor-landing/temas';
import { FORMATOS_REPLICAR } from '../lib/editor-landing/replicar-reglas';
import { plantillasDe } from '../app/web-generator/crear/tipo';
import type { JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const dibujar = async (b: TBloqueWeb, onResponder?: (t: string) => void) => {
  const { BloqueWeb } = await import('../app/web-generator/BloqueWeb');
  return renderToStaticMarkup(createElement(BloqueWeb, { b, onResponder }));
};

const PRIMERA: JsonNodo = { type: 'tarjeta', attrs: { id: 't1' }, content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hola webinar' }] }] };
const base = { id: 28, titulo: 'Landing del webinar', tema: 'mako', primera: PRIMERA, slug: null as string | null, publicadoAt: null as string | null };
const publicada = { ...base, slug: 'webinar', publicadoAt: '2026-10-20T12:00:00Z' };

// ─────────────────────────────────────────────────────────────────────────────
// Lo que arma cada bloque
// ─────────────────────────────────────────────────────────────────────────────

test('la tarjeta: su estado, el link sólo si está en internet, y «Abrir en el editor» adentro de la app', () => {
  const borrador = bloqueLanding(base, 'https://hola-mako.site/x', 'Nueva');
  assert.deepEqual([borrador.t, borrador.estado, borrador.url, borrador.nota], ['landing', 'borrador', null, 'Nueva'], 'un borrador no tiene link público');
  assert.deepEqual(borrador.abrir, { titulo: 'Abrir en el editor', href: '/web-generator/28' });
  assert.doesNotMatch(borrador.abrir.href, /^https?:|[?&]ws=/, 'la ruta es de adentro: el ?ws= lo pega el Link de la pantalla');
  assert.deepEqual(borrador.miniatura, { tarjeta: PRIMERA, tema: 'mako', proporcion: null });
  assert.deepEqual([bloqueLanding(publicada, 'https://hola-mako.site/webinar').estado, bloqueLanding(publicada, 'https://hola-mako.site/webinar').url], ['publicada', 'https://hola-mako.site/webinar']);
  assert.equal(estadoDeLanding({ ...publicada, sitioActivo: false }), 'pausada');
  assert.equal(estadoDeLanding({ slug: 'x', publicadoAt: null }), 'borrador', 'con slug pero sin publicar es un borrador');
  const presentacion = bloqueLanding({ ...base, formato: 'presentacion', proporcion: '4:3' }, null);
  assert.deepEqual([presentacion.formato, presentacion.miniatura.proporcion], ['presentacion', '4:3']);
  // Desde una landing COMPLETA (lo que devuelven crear y duplicar): la primera sección de la primera página.
  const completa = bloqueDeCompleta({ id: 9, titulo: 'X', contenido: { paginas: [{ id: 'p1', titulo: 'Inicio', doc: { type: 'doc', content: [PRIMERA] } }] } as never, config: { tema: 'eclipse' }, slug: null, publicadoAt: null }, null);
  assert.deepEqual([completa.miniatura.tarjeta, completa.miniatura.tema], [PRIMERA, 'eclipse']);
  assert.equal(rutaEditor(5), '/web-generator/5');
});

test('«armame una landing» sin diseño: tres diseños que la pantalla sabe dibujar, distintos entre sí', () => {
  const dibujables = new Set(plantillasDe('landing').filter((p) => p.pideObjetivo).map((p) => p.id));
  const b = elegirDiseno('armame una landing');
  assert.deepEqual([b.t, b.que, b.operacion, b.parametro], ['elegir', 'diseno', 'crear_landing_desde_diseno', 'diseno']);
  assert.equal(b.opciones.length, OPCIONES_POR_BLOQUE);
  for (const o of b.opciones) assert.ok(dibujables.has(o.id), `«${o.id}» no está en las plantillas que dibuja la pantalla`);
  const videos = b.opciones.map((o) => DISENOS_LANDING.find((d) => d.id === o.id)?.video ?? null);
  assert.equal(new Set(videos).size, 3, `los tres arrancan igual: ${videos.join(', ')}`);
  assert.equal(b.recomendada, b.opciones[0].id);
  assert.equal(elegirDiseno('una landing simple, sin video').opciones[0].id, 'minimal');
  assert.ok(elegirDiseno('quiero algo oscuro y elegante').opciones.some((o) => o.id === 'oscuro-moderno'));
  // El G2 sólo cuando sirve (revisión del 21/10/2026): ordenado por el pedido, y no en una presentación ni si ya nombró
  // un diseño del catálogo.
  assert.deepEqual(elegirDisenoPara(''), elegirDiseno());
  assert.equal(elegirDisenoPara('Armame una landing oscura')?.opciones[0].id, 'oscuro-moderno');
  for (const t of ['Armame una presentación de ventas', 'unas diapositivas para el webinar', 'Creame una landing con el diseño Audaz',
    'una landing Clásico claro', 'con el estilo de MaKo', 'una landing tecnológico']) assert.equal(elegirDisenoPara(t), null, t);
  assert.ok(elegirDisenoPara('MaKo, armame una landing'), '«MaKo» como nombre de la app no es el diseño');
});

test('elegir el tema: tres del catálogo, nunca el que ya tiene, dos de su grupo y uno del otro; y el formato de Replicar', () => {
  const b = elegirTema('mako', TEMAS);
  const actual = TEMAS.find((t) => t.id === 'mako')!;
  const grupos = b.opciones.map((o) => TEMAS.find((t) => t.id === o.id)?.grupo);
  assert.ok(grupos.every(Boolean), 'ofreció un tema que no está en el catálogo');
  assert.deepEqual([grupos.filter((g) => g === actual.grupo).length, grupos.filter((g) => g !== actual.grupo).length], [2, 1]);
  for (const g of ['claro', 'oscuro'] as const) {
    const primero = TEMAS.find((t) => t.grupo === g)!;
    assert.ok(!elegirTema(primero.id, TEMAS).opciones.some((o) => o.id === primero.id), `ofreció «${primero.id}», el que ya tiene`);
  }
  const f = elegirFormatoReplicar();
  assert.deepEqual(f.opciones.map((o) => o.id).sort(), [...FORMATOS_REPLICAR].sort());
  assert.deepEqual([f.opciones[0].id, f.recomendada, f.operacion], ['landing', 'landing', 'replicar_landing']);
});

test('lo publicado y el dominio: el link, la vuelta al editor, y cuántos registros faltan sin el www informativo', () => {
  const p = bloquePublicada({ id: 28, titulo: 'Webinar', url: 'https://hola-mako.site/webinar' });
  assert.deepEqual([p.t, p.url, p.editor.href], ['publicada', 'https://hola-mako.site/webinar', '/web-generator/28']);
  const registros = [
    { tipo: 'A', nombre: '@', valor: '76.76.21.21', listo: false, para: 'apuntar' },
    { tipo: 'CNAME', nombre: 'www', valor: 'cname.vercel-dns.com', listo: false, para: 'www' },
    { tipo: 'TXT', nombre: '_mako', valor: 'mako-123', listo: true, para: 'mako' },
    { tipo: 'TXT', nombre: '_vercel', valor: 'vc-456', listo: null },
  ];
  const d = bloqueDominio(28, { dominio: 'midominio.com', estado: 'pendiente', registros, falta: 'Falta el registro A.' });
  assert.deepEqual(d.registros, registros);
  assert.equal(d.faltan, 1, 'el www que MaKo suma es informativo; null (no se pudo leer) no es «falta»');
  assert.deepEqual([bloqueDominio(28, { dominio: 'midominio.com', estado: 'verificado', registros, falta: 'x' }).faltan, bloqueDominio(28, { dominio: 'midominio.com', estado: 'verificado', registros, falta: 'x' }).falta], [0, null]);
});

// ─────────────────────────────────────────────────────────────────────────────
// El saneo, enganchado en el marco
// ─────────────────────────────────────────────────────────────────────────────

test('el marco sanea los del Web Generator con su mismo criterio: lo bien armado pasa entero, lo que no calza no se dibuja', () => {
  for (const b of [bloqueLanding(publicada, 'https://hola-mako.site/webinar'), elegirDiseno(), elegirTema('mako', TEMAS), elegirFormatoReplicar(),
    bloquePublicada({ id: 28, titulo: 'W', url: 'https://hola-mako.site/webinar' }),
    bloqueDominio(28, { dominio: 'midominio.com', estado: 'pendiente', registros: [{ tipo: 'A', nombre: '@', valor: '76.76.21.21', listo: false }], falta: null })]) {
    assert.deepEqual(sanearBloque(b), b, `${b.t} no pasó entero`);
    assert.equal(esBloqueWeb(b), true);
  }
  const l = bloqueLanding(publicada, 'https://hola-mako.site/webinar');
  for (const href of ['https://otro.com/x', '//otro.com', 'javascript:alert(1)', '/a/../../b']) {
    assert.equal(sanearBloque({ ...l, abrir: { titulo: 'Abrir', href } }), null, `una tarjeta que abre «${href}»`);
  }
  for (const u of ['javascript:alert(1)', 'http://hola-mako.site/x', 'https://user:pw@hola-mako.site/x', 'https://hola-mako.site:8080/x', 'https://localhost/x']) {
    assert.equal(urlPublicada(u), null, u);
    assert.equal(sanearBloque({ ...l, url: u }), null, `una tarjeta con la dirección «${u}»`);
  }
  assert.equal(urlPublicada('https://midominio.com/'), 'https://midominio.com/');
  // Un borrador nunca muestra link aunque venga uno; una sección gigante no se guarda (la tarjeta queda sin miniatura).
  assert.equal((sanearBloque({ ...l, estado: 'borrador' }) as { url: string | null }).url, null);
  const enorme = { ...PRIMERA, attrs: { id: 't1', notas: 'x'.repeat(50_000) } };
  assert.equal((sanearBloque({ ...l, miniatura: { ...l.miniatura, tarjeta: enorme } }) as { miniatura: { tarjeta: unknown } }).miniatura.tarjeta, null);
  assert.equal(sanearBloque({ ...elegirDiseno(), opciones: elegirDiseno().opciones.slice(0, 1) }), null, 'elegir entre una no es elegir');
  assert.equal(sanearBloque({ ...elegirDiseno(), opciones: [{ id: 'a b', titulo: 'X' }, { id: 'c', titulo: 'Y' }] }), null, 'un id que no es de catálogo');
  assert.equal(sanearBloque({ t: 'dominio', id: 1, dominio: 'no es un dominio', estado: 'pendiente', registros: [] }), null);
  assert.equal(sanearBloque({ t: 'html', html: '<script>' }), null, 'un tipo que no es de nadie sigue sin dibujarse');
});

// ─────────────────────────────────────────────────────────────────────────────
// El dibujo
// ─────────────────────────────────────────────────────────────────────────────

test('se dibuja: la miniatura con la sección, el estado, el link y los botones; elegir contesta qué eligió', async () => {
  const t = await dibujar(bloqueLanding(publicada, 'https://hola-mako.site/webinar'));
  assert.match(t, /data-bloque="landing"/);
  assert.match(t, /class="gma gp ch-web__lienzo"[\s\S]*class="gp-mini"[\s\S]*Hola webinar/, 'la miniatura con su primera sección, con el Panel');
  assert.match(t, /<a class="ch-web__url" href="https:\/\/hola-mako.site\/webinar" target="_blank" rel="noopener noreferrer">hola-mako.site\/webinar<\/a>/);
  assert.match(t, /<span class="ch-pildora" data-estado="publicada">Publicada<\/span>/);
  assert.match(t, /<a class="ch-abrir" href="\/web-generator\/28[^"]*">Abrir en el editor<\/a>/);
  assert.match(await dibujar(bloqueLanding(base, null)), /Sin publicar/);

  const quieta = await dibujar(elegirFormatoReplicar());
  assert.equal((quieta.match(/class="ch-opcion ch-web__opcion" disabled=""/g) ?? []).length, 3, 'sin dónde contestar, las opciones no se tocan');
  assert.match(quieta, /data-recomendada="true"[^>]*>[\s\S]*?Landing<span class="ch-pildora">Recomendada<\/span>/);
  // Ya contestada (al recargar): se ve contestada y no se toca, como el G1 del marco.
  const { BloqueWeb } = await import('../app/web-generator/BloqueWeb');
  const vieja = renderToStaticMarkup(createElement(BloqueWeb, { b: elegirFormatoReplicar(), onResponder: () => {}, respondida: 'Formato: Landing' }));
  assert.equal((vieja.match(/class="ch-opcion ch-web__opcion" disabled=""/g) ?? []).length, 3);
  assert.match(vieja, /Respondiste: Formato: Landing/);
  // MaKo trabajando: las opciones esperan, como el G1 (lo tocado no saldría).
  const ocupada = renderToStaticMarkup(createElement(BloqueWeb, { b: elegirFormatoReplicar(), onResponder: () => true, ocupado: true }));
  assert.equal((ocupada.match(/class="ch-opcion ch-web__opcion" disabled=""/g) ?? []).length, 3, 'con MaKo trabajando, no se toca');
  assert.doesNotMatch(ocupada, /Respondiste/);
  const temas = await dibujar(elegirTema('mako', TEMAS), () => {});
  assert.equal((temas.match(/class="gp-muestra"/g) ?? []).length, 3, 'cada tema con su muestra');
  assert.doesNotMatch(temas, /disabled=""/, 'con dónde contestar, sí');

  const p = await dibujar(bloquePublicada({ id: 28, titulo: 'Webinar', url: 'https://hola-mako.site/webinar' }));
  assert.match(p, />Copiar<\/button>[\s\S]*<a class="ch-abrir" href="https:\/\/hola-mako.site\/webinar" target="_blank" rel="noopener noreferrer">Abrir<\/a>/);
  const d = await dibujar(bloqueDominio(28, { dominio: 'midominio.com', estado: 'pendiente', registros: [
    { tipo: 'A', nombre: '@', valor: '76.76.21.21', listo: false }, { tipo: 'CNAME', nombre: 'www', valor: 'cname.vercel-dns.com', listo: false, para: 'www' },
  ], falta: null }));
  assert.match(d, /<span class="ch-pildora" data-estado="pendiente">Falta 1<\/span>/);
  assert.match(d, /<tr data-listo="false"><td>A<\/td><td><code>@<\/code><\/td>[\s\S]*?<td class="ch-web__estado">Falta<\/td>/);
  assert.match(d, /data-para="www"[\s\S]*?<td class="ch-web__estado">Opcional<\/td>/, 'el www es informativo');
  assert.match(d, />Verificar ahora<\/button>/);
  assert.doesNotMatch(await dibujar(bloqueDominio(28, { dominio: 'midominio.com', estado: 'verificado', registros: [], falta: null })), /Verificar ahora/);
});

test('elegir: lo elegido sale como un mensaje que dice QUÉ se eligió, y el hilo los manda a esta pieza', async () => {
  const src = sinComentarios(leer('app/web-generator/BloqueWeb.tsx'));
  // Lo que manda cada opción sale de UN lugar (bloques-web.ts): el botón y `conRespuestas` comparan lo mismo.
  assert.match(sinComentarios(leer('lib/editor-landing/bloques-web.ts')), /export const QUE_ELEGIR: Record<BloqueElegir\['que'\], string> = \{ diseno: 'Diseño', tema: 'Tema', formato: 'Formato' \};/);
  assert.match(src, /const texto = textoDeOpcion\(b, o\);[\s\S]{0,400}onClick=\{\(\) => responder\(texto\)\}/);
  assert.match(src, /onClick=\{\(\) => responder\(ELIGE_TU\)\}>\{ELIGE_TU\}<\/button>[\s\S]{0,200}onClick=\{\(\) => responder\(SALTEAR\)\}>\{SALTEAR\}<\/button>/);
  assert.doesNotMatch(src, /import ['"][^'"]+\.css['"]/, 'sin CSS en el import: se dibuja en este test');
  // «Verificar ahora» vuelve a mirar el DNS por la MISMA ruta que el diálogo Publicar, y cambia ESTE bloque.
  assert.match(src, /postJson<RespuestaDominio>\(RUTA_DOMINIO, \{ accion: 'estado', id: d\.id, verificar: true \}, PLAZO_DOCS_MS\);[\s\S]{0,160}setD\(bloqueDominio\(d\.id, r\.dominio\)\)/);
  const hilo = sinComentarios(leer('app/_chat/BloqueHilo.tsx'));
  assert.match(hilo, /const BloqueWeb = dynamic\(\(\) => import\('@\/app\/web-generator\/BloqueWeb'\)\.then\(\(m\) => m\.BloqueWeb\)\);/, 'la hoja de las landings sólo carga con un bloque');
  assert.match(hilo, /if \(esBloqueWeb\(b\)\) return <BloqueWeb b=\{b\} onResponder=\{onResponder\} respondida=\{respondida\} ocupado=\{ocupado\} \/>;/);
  // «Respondiste» SÓLO SI SALIÓ y lo contestado en CADA render, como el G1 del marco (revisión del 21/10/2026).
  assert.match(src, /const dicha = respondida \?\? enviada;\s*const quieta = !onResponder \|\| dicha != null \|\| !!ocupado;/);
  assert.match(src, /if \(onResponder\?\.\(t\) === false\) \{ setNoSalio\(true\); return; \}\s*setNoSalio\(false\);\s*setEnviada\(t\);/, 'marca después de mandar, y sólo si salió');
  assert.match(src, /\{noSalio && dicha == null && <p className="ch-tarjeta__nota" role="alert">No salió/);
  assert.match(src, /onResponder\?: \(texto: string\) => boolean \| void;[\s\S]{0,200}ocupado\?: boolean;/);
  // Contestar ESCRIBIENDO también lo apaga, y al recargar sigue contestado.
  const { conRespuestas } = await import('../app/m/mako/chat-ui');
  const items = conRespuestas([{ k: 'bloque', id: 'e', b: elegirDiseno() }, { k: 'msg', id: 'u', role: 'user', texto: 'la minimal', at: null } as never]);
  assert.equal(items[0].k === 'bloque' ? items[0].respondida : null, 'la minimal');
  // UNA respuesta no cierra DOS selectores (5ª revisión): el G2 de diseños y el G1 del producto en el mismo mensaje.
  const producto = { t: 'pregunta' as const, pregunta: '¿Para qué producto es?', opciones: [{ titulo: 'Mentoría' }, { titulo: 'Un producto nuevo' }, { titulo: 'El negocio en general' }] };
  const conDos = (texto: string, g1: typeof producto & { varias?: boolean } = producto) => {
    const xs = conRespuestas([
      { k: 'msg', id: 'p', role: 'user', texto: 'Armame una landing', at: null } as never,
      { k: 'bloque', id: 'g2', b: elegirDiseno() }, { k: 'bloque', id: 'g1', b: g1 },
      { k: 'msg', id: 'u', role: 'user', texto, at: null } as never,
    ]);
    return xs.slice(1, 3).map((x) => (x.k === 'bloque' ? x.respondida ?? null : 'no es bloque'));
  };
  assert.deepEqual(conDos('Mentoría'), [null, 'Mentoría'], 'tocar el producto no apaga los diseños');
  assert.deepEqual(conDos('mentoria'), [null, 'mentoria'], 'escrito igual que la opción, también');
  assert.deepEqual(conDos('Diseño: Minimal'), ['Diseño: Minimal', null], 'tocar un diseño no contesta el producto');
  assert.deepEqual(conDos('Saltear'), ['Saltear', null]);
  assert.deepEqual(conDos('la que quieras, para todo'), [null, null], 'lo escrito que no es de ninguno los deja abiertos');
  assert.deepEqual(conDos('Mentoría, Un producto nuevo', { ...producto, varias: true }), [null, 'Mentoría, Un producto nuevo'], 'varias con «Listo»');
  // Los que esperan cada mensaje son los de ESE turno: uno de un turno anterior, ya contestado, no cuenta.
  const tras = conRespuestas([
    { k: 'bloque', id: 'g1', b: producto }, { k: 'msg', id: 'u1', role: 'user', texto: 'Mentoría', at: null } as never,
    { k: 'bloque', id: 'g2', b: elegirDiseno() }, { k: 'msg', id: 'u2', role: 'user', texto: 'la minimal', at: null } as never,
  ]);
  assert.deepEqual(tras.filter((x) => x.k === 'bloque').map((x) => (x.k === 'bloque' ? x.respondida : null)), ['Mentoría', 'la minimal']);
  assert.match(sinComentarios(leer('lib/chat-bloques.ts')), /default:\s*return sanearBloqueWeb\(o, rutaInterna\);/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Las operaciones lo devuelven
// ─────────────────────────────────────────────────────────────────────────────

test('crear desde un diseño deja la tarjeta en `datos.bloque` al confirmar, y no en lo que lee el modelo (se ejecuta)', () => {
  const r = hijo(`
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const primera = { type: 'tarjeta', attrs: { id: 't1' }, content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hola' }] }] };
const doc = { id: 77, titulo: 'Mentoría', contenido: { paginas: [{ id: 'p1', titulo: 'Inicio', doc: { type: 'doc', content: [primera] } }] }, config: { tema: 'pewter' }, slug: null, publicadoAt: null, sitioActivo: true, version: 1, cambiosSinPublicar: false };
mock.module(${url('lib/editor-landing/server.ts')}, { exports: { ...real(await import(${url('lib/editor-landing/server.ts')})), crear: async () => ({ ok: true, doc }) } });
const { RUNNERS } = await import(${url('lib/api-mako/areas/landing.run.ts')});
const { sanearBloque } = await import(${url('lib/chat-bloques.ts')});
const ctx = { ws: 3, canal: 'app', canalKey: 'app:prueba', alcance: 'confirmar', rol: 'admin' };
const e = await RUNNERS.crear_landing_desde_diseno.ejecutar({ diseno: 'claro-clasico', objetivo: 'agenda-llamada' }, ctx);
console.log(JSON.stringify({ e, saneado: sanearBloque(e.datos?.bloque) }));
`) as { e: { ok: boolean; resumen: string; datos: { bloque?: Record<string, unknown> } }; saneado: unknown };
  assert.equal(r.e.ok, true, JSON.stringify(r.e));
  assert.equal(r.e.datos.bloque?.t, 'landing');
  assert.deepEqual(r.saneado, r.e.datos.bloque, 'el marco no lo dibujaría');
  assert.deepEqual((r.e.datos.bloque as { abrir: unknown }).abrir, { titulo: 'Abrir en el editor', href: '/web-generator/77' });
  assert.doesNotMatch(r.e.resumen, /tarjeta|"type"|attrs/, 'la sección no va en el resumen, que lee el modelo');
});

test('las demás devuelven su bloque: duplicar, la presentación, en blanco, generar, replicar, publicar y el dominio', () => {
  const l = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const e = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  assert.equal((l.match(/bloque: bloqueDeCompleta\(r\.doc, null, 'Nueva'\)/g) ?? []).length, 2, 'crear desde diseño y la presentación');
  // `duplicar` devuelve el resumen del Panel (LandingResumen), no la completa: lo vio el tsc.
  assert.match(l, /bloque: bloqueLanding\(r\.doc, null, 'Copia'\)/, 'duplicar');
  assert.match(l, /const copia = await docsEditor\.abrir\(r\.id\)\.catch\(\(\) => null\);[\s\S]{0,700}\.\.\.\(copia\?\.ok \? \{ bloque: bloqueDeCompleta\(copia\.doc, null, 'Replicada'\) \} : \{\}\)/);
  assert.match(l, /const bloque = bloquePublicada\(\{ id, titulo: f\.titulo \?\? '', url \}\);[\s\S]{0,200}publicadaEl: r\.publicadoAt, bloque \}/);
  assert.match(e, /bloque: bloqueDeCompleta\(r\.doc, null, 'Nueva'\) \} \};/, 'en blanco');
  assert.match(e, /const creada = await docsEditor\.abrir\(r\.doc\.id\)\.catch\(\(\) => null\);[\s\S]{0,900}\.\.\.\(creada\?\.ok \? \{ bloque: bloqueDeCompleta\(creada\.doc, null, 'Nueva'\) \} : \{\}\)/, 'generar con IA');
  assert.equal((e.match(/datos: \{ id, \.\.\.registrosParaApi\(r\.dominio\), bloque: bloqueDominio\(id, r\.dominio\) \}/g) ?? []).length, 2, 'conectar y verificar el dominio');
});

// ─────────────────────────────────────────────────────────────────────────────
// Las lecturas: listar (la lista con sus tarjetas) y los diseños (el G2), por la salida de la herramienta
// ─────────────────────────────────────────────────────────────────────────────

test('la lista: las primeras con su tarjeta, cuántas hay y «Ver todas»; el saneo deja afuera la que no calza', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ d: { ...base, id: 100 + i, titulo: `L${i}` }, url: null }));
  const b = bloqueListaLandings(items, 6)!;
  assert.deepEqual([b.t, b.titulo, b.total, b.landings.length, b.abrir.href], ['landings', 'Tus landings (6)', 6, MAX_LANDINGS_BLOQUE, '/web-generator']);
  assert.deepEqual(b.landings.map((l) => l.abrir.href), ['/web-generator/100', '/web-generator/101', '/web-generator/102', '/web-generator/103']);
  assert.equal(bloqueListaLandings([], 0), null, 'una lista vacía no se dibuja');
  assert.equal(bloqueListaLandings(items.slice(0, 1), 1)!.titulo, 'Tu landing');
  assert.deepEqual(sanearBloque(b), b, 'la lista bien armada pasa entera');
  const conMala = { ...b, landings: [{ ...b.landings[0], abrir: { titulo: 'x', href: 'https://otro.com' } }, b.landings[1]] };
  assert.deepEqual((sanearBloque(conMala) as { landings: unknown[] }).landings.length, 1, 'la que abre afuera se va');
  assert.equal(sanearBloque({ ...b, landings: [] }), null);
});

test('la lista se dibuja: cada tarjeta abre su editor, y «Ver todas» dice cuántas hay', async () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ d: { ...base, id: 100 + i, titulo: `Landing ${i}` }, url: null }));
  const h = await dibujar(bloqueListaLandings(items, 6)!);
  assert.match(h, /data-bloque="landings"/);
  assert.equal((h.match(/<a class="ch-web__tarjeta" aria-label="[^"]*" href="\/web-generator\/10\d[^"]*"/g) ?? []).length, 4);
  assert.match(h, /aria-label="Landing 0: Abrir en el editor"/);
  assert.match(h, /<a class="ch-abrir" href="\/web-generator[^"]*">Ver todas en el Web Generator \(6\)<\/a>/);
});

test('listar y los diseños dejan su bloque AL LADO de lo que lee el modelo; ejecutarOperacion lo dibuja (se ejecuta)', () => {
  const r = hijo(`
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const primera = { type: 'tarjeta', attrs: { id: 't1' }, content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hola' }] }] };
const doc = (id, extra = {}) => ({ id, titulo: 'L' + id, tema: 'mako', creado: '2026-10-20T00:00:00Z', actualizado: '2026-10-20T00:00:00Z', creadoPor: null, favorito: false, carpeta: null, papelera: false, slug: null, publicadoAt: null, primera, ...extra });
const docs = [doc(1, { slug: 'uno', publicadoAt: '2026-10-20T00:00:00Z' }), doc(2), doc(3, { papelera: true })];
mock.module(${url('lib/editor-landing/server.ts')}, { exports: { ...real(await import(${url('lib/editor-landing/server.ts')})), listar: async () => ({ ok: true, docs }) } });
const { RUNNERS } = await import(${url('lib/api-mako/areas/landing.run.ts')});
const ctx = { ws: 3, canal: 'app', canalKey: 'app:prueba', alcance: 'leer', rol: 'admin' };
const lista = await RUNNERS.listar_landings_creadas.leer({}, ctx);
const enPapelera = await RUNNERS.listar_landings_creadas.leer({ papelera: true }, ctx);
const disenos = await RUNNERS.listar_disenos_landing.leer({}, ctx);
const oscura = await RUNNERS.listar_disenos_landing.leer({}, { ...ctx, mensajeUsuario: 'Armame una landing oscura' });
const presentacion = await RUNNERS.listar_disenos_landing.leer({}, { ...ctx, mensajeUsuario: 'Armame una presentación de ventas' });
const audaz = await RUNNERS.listar_disenos_landing.leer({}, { ...ctx, mensajeUsuario: 'Creame una landing con el diseño Audaz' });
console.log(JSON.stringify({ lista, enPapelera, disenos, oscura, presentacion, audaz }));
`) as Record<string, string | { content: string; bloque?: Record<string, unknown> }>;
  const lista = r.lista as { content: string; bloque: Record<string, unknown> };
  // La lista: el bloque con las dos que no están en la papelera, y la publicada con su dirección.
  assert.equal(lista.bloque?.t, 'landings', JSON.stringify(r.lista).slice(0, 300));
  const ls = lista.bloque.landings as { id: number; estado: string; url: string | null }[];
  assert.deepEqual(ls.map((l) => [l.id, l.estado]), [[1, 'publicada'], [2, 'borrador']]);
  assert.match(ls[0].url ?? '', /^https:\/\/[^/]+\/(?:l\/)?uno$/, 'la publicada lleva su dirección');
  assert.deepEqual(sanearBloque(lista.bloque), lista.bloque, 'el marco no lo dibujaría');
  // Lo que lee el modelo (`content`) no trae el bloque ni la sección: no se paga en cada paso.
  assert.doesNotMatch(lista.content, /"bloque"|"primera"|"tarjeta"/);
  assert.equal((JSON.parse(lista.content) as { landings: unknown[] }).landings.length, 2);
  assert.equal(typeof r.enPapelera, 'string', 'la papelera no lleva tarjetas: sale el texto de siempre');
  // Los diseños: el G2 de tres al lado del catálogo.
  const d = r.disenos as { content: string; bloque: Record<string, unknown> };
  assert.deepEqual([d.bloque?.t, (d.bloque?.opciones as unknown[]).length], ['elegir', 3]);
  assert.doesNotMatch(d.content, /"bloque"/);
  assert.ok((JSON.parse(d.content) as { disenos: unknown[] }).disenos.length >= 3);
  // Con lo que pidió la persona (`ctx.mensajeUsuario`): ordenados por el pedido, y sin el G2 si no sirve.
  const o = r.oscura as { bloque?: { opciones: { id: string }[] } };
  assert.equal(o.bloque?.opciones[0].id, 'oscuro-moderno', JSON.stringify(r.oscura).slice(0, 200));
  for (const k of ['presentacion', 'audaz'] as const) {
    assert.equal(typeof r[k], 'string', `${k}: dibujó el G2 de los diseños de landing`);
    assert.ok((JSON.parse(r[k] as string) as { disenos: unknown[] }).disenos.length >= 3, `${k}: al modelo le llega el catálogo igual`);
  }
});

test('por el camino REAL (ejecutarOperacion): los diseños se dibujan por `ctx.aDibujar`, saneados, y el modelo no los ve', () => {
  const r = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_dibujar-landing-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  })) as { conCanal: { ok: boolean; resultado: string }; sinCanal: { resultado: string }; dibujados: Record<string, unknown>[]; cuantos: number; trasSinCanal: number; red: string[] };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.equal(r.conCanal.ok, true, JSON.stringify(r.conCanal).slice(0, 300));
  assert.equal(r.cuantos, 1, 'con el canal de la pantalla, se dibuja una vez');
  assert.deepEqual(r.dibujados[0], elegirDiseno(), 'se dibuja el G2 de los tres diseños, saneado y entero');
  assert.doesNotMatch(r.conCanal.resultado, /"bloque"|"opciones"/, 'al modelo le llega el catálogo sin el bloque');
  assert.equal(r.trasSinCanal, 1, 'sin el canal (WhatsApp, HTTP) no se dibuja');
  assert.equal(r.sinCanal.resultado, r.conCanal.resultado);
  // Con el pedido de la persona: «oscura» ordena los tres, y una presentación no dibuja diseños de landing.
  assert.equal(r.dibujados.length, 2, 'la presentación no dibujó nada');
  assert.equal((r.dibujados[1] as { opciones: { id: string }[] }).opciones[0].id, 'oscuro-moderno');
});
