// =============================================================================
// La lista de /automations: los tres puntos de cada fila y «Nueva» al instante
// (app/automations/SimuladorWhatsApp.tsx + ChatAgentApp.tsx) — tercera tanda, 09/10/2026
// =============================================================================
// Pedido de Martín, textual:
//   6. «Me falta un botón para eliminar la secuencia, te pido que en la sidebar donde están todas
//      las secuencias pongas los típicos 3 puntos para poder hacer estas acciones, como activarla,
//      eliminarla, etc...»
//   7. «El botón de "Nueva" si le paso el cursor debería tener una animación... Y al apretarlo
//      debería hacer otra cosa y si se tarda en crearlo, un loader... Mejor si se crea
//      automáticamente la tarjeta en la sidebar y se abre el lienzo, y que el loader en todo caso
//      esté al entrar al lienzo».
// Decisiones 6 y 7 de docs/chatbot-flujo-ramas-diseno.md.
//
// Lo que se puede DIBUJAR se dibuja (renderToStaticMarkup): la fila que se está creando, el loader
// adentro del lienzo, el «⋯» de cada fila. Lo que vive en handlers y en estado (las acciones, la
// selección que sigue al id real) se fija en el fuente sin comentarios, recortado a su función.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SimuladorWhatsApp, filaCreando, listaConCreando, claveCreando, esFilaCreando, opcionesDeFila, NOMBRE_CREANDO,
} from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LISTA = () => sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
const APP = () => sinComentarios(leer('app/automations/ChatAgentApp.tsx'));

/** El bloque de `firma` hasta `hasta` (su cierre real), con un tope de largo que lo delata si se desborda. */
function recorte(src: string, firma: string, hasta: string, tope = 2500): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no está «${firma}»`);
  const fin = src.indexOf(hasta, ini + firma.length);
  assert.ok(fin > ini, `no está «${hasta}» después de «${firma}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte de «${firma}» mide ${b.length}`);
  return b;
}

const SECUENCIA = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
  activa: true, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

const dibujar = (secuencias: SecuenciaDto[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias, objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null,
  ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

// ── «Nueva» al instante (decisión 7) ─────────────────────────────────────────────

test('la fila que se está creando va AL FINAL (donde el server pone la nueva) y se va sola cuando llega la de verdad', () => {
  assert.deepEqual(listaConCreando([SECUENCIA], null), [SECUENCIA]);
  const conTemporal = listaConCreando([SECUENCIA], { temporal: -5, id: null });
  assert.equal(conTemporal.length, 2);
  assert.equal(conTemporal[1].id, -5);
  assert.ok(esFilaCreando(conTemporal[1]));
  // El server contestó: la fila toma el id real, con la MISMA clave (la selección la sigue por ahí).
  const conId = listaConCreando([SECUENCIA], { temporal: -5, id: 900 });
  assert.equal(conId[1].id, 900);
  assert.equal(conId[1].clave, claveCreando(-5));
  // Llegó la de verdad (mismo id): la fila de mentira no se duplica.
  const real = { ...SECUENCIA, id: 900, clave: 'automatizacion-abc', nombre: NOMBRE_CREANDO, activa: false };
  assert.deepEqual(listaConCreando([SECUENCIA, real], { temporal: -5, id: 900 }), [SECUENCIA, real]);
  assert.ok(!esFilaCreando(SECUENCIA));
});

test('la fila de mentira es la MISMA cara que crea el server: vacía, pausada, «Nueva automatización»', () => {
  const f = filaCreando(-1);
  assert.equal(f.activa, false);
  assert.deepEqual(f.pasos, []);
  assert.equal(f.etapa, 'manual');
  assert.equal(f.trigger_tipo, 'manual');
  const server = sinComentarios(leer('lib/setting-secuencias.ts'));
  assert.ok(server.includes(`export const NOMBRE_PROVISORIO = '${NOMBRE_CREANDO}';`), 'el nombre de la fila no es el que pone el server');
  assert.match(server, /\.insert\(\{ clave, nombre: n, etapa: 'manual', trigger_tipo: 'manual', activa: false, pasos: \[\] \}\)/);
});

test('con la fila que se está creando elegida, el lienzo está abierto con su loader adentro', () => {
  const html = dibujar([filaCreando(-5)]);
  assert.match(html, /aria-busy="true"[^>]*>[\s\S]*?Creando…/, 'sin el loader adentro del lienzo');
  assert.doesNotMatch(html, /Elige una automatización/);
  // La fila: el giro en vez del emoji, el nombre, elegida, y SIN «⋯» (todavía no existe en el server).
  assert.match(html, /aria-current="true"[^>]*><span[^>]*><span class="mk-spin"/);
  assert.ok(html.includes(`>${NOMBRE_CREANDO}</span>`));
  assert.doesNotMatch(html, new RegExp(`aria-label="Opciones de ${NOMBRE_CREANDO}"`));
});

test('crearNueva pone la fila y la abre ANTES de pedirle nada al server; el id real ANTES del load', () => {
  // Sin `pedido` desde el 10/10/2026: lo mandaba «Armar una» del pie de la lista, que salió. Y sin `clase` desde la
  // décima tanda (11/10/2026): era el tipo de CRON de «¿Qué la dispara?» del modal, que se fue («eso ya lo hacemos
  // dentro en el CRON»); con él se fue el `const id` que lo acompañaba, y el id real va directo a la fila.
  const c = recorte(APP(), 'const crearNueva = async () => {', '\n  };', 1700);
  const iFila = c.indexOf('setCreando({ temporal, id: null });\n    setAbrirSec({ id: temporal });');
  const iPost = c.indexOf("fetch('/api/chat-agent/secuencias'");
  const iReal = c.indexOf('setCreando({ temporal, id: Number(r.secuenciaId) });');
  const iLoad = c.indexOf('await load();');
  assert.ok(iFila >= 0 && iPost > iFila, 'la fila aparece después del POST: vuelve a tardar');
  assert.ok(iReal > iPost && iLoad > iReal, 'el id real tiene que llegar antes del load');
  assert.match(c, /const temporal = -Date\.now\(\);/);
  // La lista que se dibuja es la del server más la que se está creando, en los dos lugares.
  // (Desde la quinta tanda hasta el 11/10/2026 los dos lugares miraban también si había Mensajes de MaKo de los
  // de antes, `hayAvisos`. Hoy un mensaje de «MaKo en WhatsApp» es una automatización: viene en `visibles`.)
  const app = APP();
  assert.match(app, /const visibles = secuencias === null \? null : listaConCreando\(secuencias, creando\);/);
  assert.match(app, /\{visibles !== null && visibles\.length === 0 && !error && \(/);
  assert.match(app, /\{visibles !== null && visibles\.length > 0 && \(\n\s+<SimuladorWhatsApp\n\s+secuencias=\{visibles\}/);
});

test('la selección SIGUE a la fila cuando toma su id real (por su clave), y si falla vuelve la de antes', () => {
  const lista = LISTA();
  assert.match(lista, /if \(typeof elegida === 'number' && elegida < 0\) \{\n\s+const fila = secuencias\.find\(\(j\) => j\.clave === claveCreando\(elegida\)\);\n\s+if \(fila && fila\.id !== elegida\) \{ elegidaViva = fila\.id; setSelId\(fila\.id\); \}/);
  assert.match(lista, /const selId = existe\(elegidaViva\) \? elegidaViva : existe\(volverA\) \? volverA : \(secuencias\[0\]\?\.id \?\? ''\);/);
  const cambiar = recorte(lista, 'const cambiarA = (id: number) => {', '\n  };', 600);
  assert.match(cambiar, /if \(typeof id === 'number' && id < 0\) setVolverA\(selId\);/);
  // La nueva nace pausada: con «Activas» o un texto en el buscador no se vería. (Quinta tanda, punto
  // 4: el filtro pasó a ser VARIOS valores, `filtros`; la regla es la misma.)
  assert.match(lista, /if \(creandoSel && \(filtros\.length > 0 \|\| busq\)\) \{ setFiltros\(\[\]\); setBusq\(''\); \}/);
});

test('«Nueva» tiene su animación al pasar el cursor (el ＋ gira), quieta con reduced-motion, y el hover le gana al estilo', () => {
  const lista = LISTA();
  const css = leer('app/automations/SimuladorWhatsApp.tsx').match(/const CSS_LISTA = `([\s\S]*?)`;/)?.[1] ?? '';
  assert.match(css, /\.chb-nueva:hover \.chb-nueva__mas,\.chb-nueva:focus-visible \.chb-nueva__mas\{transform:rotate\(90deg\) scale\(1\.06\)/);
  assert.match(css, /\.chb-nueva:hover,\.chb-nueva:focus-visible\{opacity:1;color:var\(--primary\);border-color:var\(--primary\);background:var\(--primary-bg\)\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.chb-nueva__mas\{transition:none\}/);
  // ⚠️ Un estilo en línea le gana a cualquier :hover: el botón y su ＋ no llevan fondo, color, borde ni opacidad en línea.
  // «＋ Nueva automatización» desde el 10/10/2026 (Martín: «que en lugar de "+ Nueva" sea "+ Nueva automatización"»).
  const boton = lista.slice(lista.indexOf('className="chb-nueva"'), lista.indexOf('>Nueva automatización</span>'));
  assert.ok(boton.length > 0 && boton.length < 900, `el recorte de «Nueva» mide ${boton.length}`);
  assert.doesNotMatch(boton, /\b(background|color|border|opacity):/);
  assert.match(lista, /<style>\{CSS_LISTA\}<\/style>/);
  assert.doesNotMatch(css, /`/);
});

// ── Los tres puntos (decisión 6) ─────────────────────────────────────────────────

test('cada fila tiene su «⋯» (el menú de la casa): Activar o Pausar, Duplicar y Eliminar', () => {
  // «Copiar flujo» desde el 10/10/2026 (copiar y pegar flujos, lib/flujo-copia.ts); «Renombrar» desde la undécima
  // tanda (punto 5: «Quiero que en los 3 puntos exista la opción de renombrar»), segunda. Rotura (11/10/2026,
  // wf-undecima/w1-lista-ui/romper.mjs R3, `opcionesDeFila` sin «Renombrar»): base 10 / 0 → 9 / 1.
  assert.deepEqual(opcionesDeFila(true).map((o) => o.label), ['Pausar', 'Renombrar', 'Duplicar', 'Copiar flujo', 'Eliminar']);
  assert.deepEqual(opcionesDeFila(false).map((o) => o.label), ['Activar', 'Renombrar', 'Duplicar', 'Copiar flujo', 'Eliminar']);
  const html = dibujar([SECUENCIA]);
  assert.match(html, /aria-label="Opciones de Bienvenida"/);
  // Su columna PROPIA, al lado del botón que abre: no tapa el nombre (y un botón no va adentro de otro).
  const fila = html.slice(html.lastIndexOf('<div class="chb-fila', html.indexOf('>Bienvenida</span>')), html.indexOf('aria-label="Opciones de Bienvenida"'));
  assert.match(fila, /<\/button><span class="chb-menu"/, 'el «⋯» no está en su columna, después del botón de la fila');
  // Sin admin, sin menú (el POST es sólo del admin).
  assert.doesNotMatch(dibujar([SECUENCIA], { rolAdmin: false }), /Opciones de Bienvenida/);
  const lista = LISTA();
  // Cuarta tanda, punto 13: el menú abre hacia AFUERA de la lista, sin tapar la tarjeta.
  assert.match(lista, /<Dropdown value="" placeholder="⋯" align="afuera" resetAfterSelect sinFlecha search=\{false\}/);
  assert.match(lista, /options=\{opcionesDeFila\(j\.activa, sinPublicarDe\(j, j\.id === selId && sinPublicar\)\)\}/);
});

test('las acciones: Activar/Pausar por la puerta de siempre, Duplicar por `duplicar`, Eliminar ARCHIVA con la confirmación de la casa', () => {
  const lista = LISTA();
  const accion = recorte(lista, 'const accionFila = async (j: SecuenciaDto, accion: string) => {', '\n  };', 2000);
  assert.match(accion, /if \(accion === 'eliminar'\) \{ setErrFila\(null\); setAEliminar\(j\); return; \}/, 'Eliminar sin preguntar');
  assert.match(accion, /pedir\('\/api\/whatsapp\/secuencias', 'PATCH', \{ id: j\.id, activa: !j\.activa \}\)/);
  assert.match(accion, /pedir\(API_SECUENCIAS, 'POST', \{ action: 'duplicar', secuenciaId: j\.id \}\)/);
  // Lo que contesta mal queda pegado a ESA fila.
  assert.match(accion, /setErrFila\(\{ id: j\.id, texto: r\.error \|\| 'No se pudo cambiar' \}\)/);
  assert.match(lista, /\{errFila\?\.id === j\.id && <div role="alert"/);
  const eliminar = recorte(lista, 'const eliminar = async () => {', '\n  };', 1200);
  assert.match(eliminar, /pedir\(API_SECUENCIAS, 'POST', \{ action: 'archivar', ids: \[j\.id\] \}\)/);
  assert.match(lista, /<Confirm\n\s+message=\{`«\$\{aEliminar\.nombre\}» deja de enviar y sale de la lista\.`\}\n\s+confirmLabel="Eliminar automatización" cancelLabel="No eliminar" tone="danger" loading=\{eliminando\}/);
  // Mientras corre, el «⋯» de esa fila se apaga.
  assert.match(lista, /disabled=\{ocupada === j\.id\}/);
});

test('la copia se abre cuando llega en la lista, pero NO si hay algo sin publicar', () => {
  const lista = LISTA();
  assert.match(lista, /if \(abrirCopia != null && secuencias\.some\(\(j\) => j\.id === abrirCopia\)\) \{\n\s+setAbrirCopia\(null\);\n\s+if \(!sinPublicar\) cambiarA\(abrirCopia\);/);
});

// ROTURAS (09/10/2026), una por vez sobre SimuladorWhatsApp.tsx y ChatAgentApp.tsx, con un arnés que
// rompe, corre este archivo y restaura DE MEMORIA (nunca con git checkout) verificando con md5. Sin
// romper: 9 pass / 0 fail. Las 12 cayeron, cada una con 8 pass / 1 fail:
//   · L1 la fila nueva arriba (el server la pone al final); L2 la de mentira no se va cuando llega
//     la de verdad; L3 sin loader (el lienzo de verdad sobre la de mentira); L4 la de mentira con
//     «⋯»; L5 la selección no sigue al id real; L6 Eliminar sin preguntar; L7 el hover de «Nueva»
//     perdiendo contra un fondo en línea; L8 la copia se abre aunque haya algo sin publicar; L9 con
//     «Activas» la nueva no se ve; L10 el «⋯» adentro del botón de la fila.
//   · A1 la fila aparece después del POST; A2 la lista dibujada sin la fila nueva.

// ⚠️ CAMBIADO POR LA QUINTA TANDA, PUNTO 4. Este test fijaba el filtro de la cuarta (punto 13): un
// Dropdown de UN valor (estado o un emoji) de 104 px con «Quitar filtro» como su PRIMER renglón.
// Martín lo devolvió: «debería ser más chico, con el ícono de filtro […] Replica el desplegable de
// Filtro que tenemos en el plan... "Quitar filtros" es un texto sutil abajo del todo... Y hay
// secciones». Lo que se sigue cuidando: que vaya en la MISMA fila que el buscador. Lo nuevo (las
// secciones, varias marcadas, el canal derivado de los pasos, «Quitar filtros» abajo) lo ejecuta
// tests/chatbot-lista-filtro.test.ts.
test('el filtro de la lista va al lado del buscador, y es el botón chico del Plan (quinta tanda, punto 4)', () => {
  const lista = LISTA();
  const fila = lista.slice(lista.indexOf('aria-label="Buscar por nombre"') - 200, lista.indexOf('<FiltroLista filas={todasLasFilas} valores={filtros} onCambio={setFiltros} />'));
  assert.ok(fila.length > 0 && fila.length < 900, 'el filtro no está al lado del buscador');
  // El de la cuarta tanda no volvió: ni el Dropdown de un valor, ni «Quitar filtro» arriba.
  assert.doesNotMatch(lista, /ariaLabel="Filtrar secuencias"|QUITAR_FILTRO|opcionesDeFiltro/);
});
