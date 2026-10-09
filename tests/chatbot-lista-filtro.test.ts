// =============================================================================
// El filtro de la lista de /chatbot — quinta tanda, punto 4
// (lib/chatbot-lista-filtro.ts, app/chatbot/FiltroLista.tsx, app/chatbot/SimuladorWhatsApp.tsx,
// app/components/Dropdown.tsx)
// =============================================================================
// Pedido de Martín (09/10/2026), textual: «El filtro al lado del buscador en la sidebar, debería ser
// más chico, con el ícono de filtro como ya lo tenemos en otros lados, así la barra de busqueda
// tiene más espacio. Y haz la sidebar más ancha. Replica el desplegable de Filtro que tenemos en el
// plan... Por ejemplo, "Quitar filtros" es un texto sutil abajo del todo... Y hay secciones, quiero
// que haya una sección de "Emojis" y que ahí aparezcan los emojis disponibles. Una sección de
// "Estado", y también quiero un filtro de "Canal" para WhatsApp y Email, ese filtro, como otros
// deberían claro poder seleccionar varios. Y dentro de la sección canal, luego de WhatsApp y Email,
// un divider y las opciones "A clientes" y "Al WhatsApp de MaKo", para filtrar los que envian solo a
// clientes, solo al whatsapp de MaKo o ambos...»
//
// Las decisiones se EJECUTAN (funciones puras); el botón y la lista se DIBUJAN
// (renderToStaticMarkup); lo que el Dropdown hace abierto (vive en un portal y en estado) se fija
// en su fuente sin comentarios.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  enviosDePasos, enviosDeAviso, filaDeMensaje, pasaFiltroLista, seccionesDelFiltro, alternarFiltro, contarFiltros, VALOR, SECCION,
  type FilaFiltrable,
} from '../lib/chatbot-lista-filtro';
import { SimuladorWhatsApp, filaDeSecuencia } from '../app/chatbot/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/chatbot/ChatAgentApp';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));

const wa = (cuerpo = 'hola'): PasoGrafo => ({ canal: 'whatsapp', cuerpo });
const mail = (): PasoGrafo => ({ canal: 'email', cuerpo: 'hola', asunto: 'Asunto' });
const mako = (): PasoGrafo => ({ canal: 'whatsapp', accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'Agendó' } } });

// ── Por dónde y a quién: se DERIVA de los pasos ─────────────────────────────────

test('los envíos salen de los pasos: un mensaje le escribe al LEAD por su canal; la tarjeta MAKO, al grupo por WhatsApp', () => {
  assert.deepEqual(enviosDePasos([wa()]), [{ canal: 'whatsapp', destino: 'clientes' }]);
  assert.deepEqual(enviosDePasos([mail()]), [{ canal: 'email', destino: 'clientes' }]);
  assert.deepEqual(enviosDePasos([mako()]), [{ canal: 'whatsapp', destino: 'mako' }]);
  // Sin repetir: dos WhatsApp al lead son UN envío del filtro.
  assert.deepEqual(enviosDePasos([wa(), wa('otro'), mako(), mail()]), [
    { canal: 'whatsapp', destino: 'clientes' }, { canal: 'whatsapp', destino: 'mako' }, { canal: 'email', destino: 'clientes' },
  ]);
});

test('lo que NO manda nada no cuenta, aunque traiga `canal`: las tarjetas de control y las otras acciones', () => {
  // Las secuencias convertidas traen `canal` también en las tarjetas de control: la clase la decide
  // `claseDe` (la del motor y el lienzo), no la presencia del campo.
  const control: PasoGrafo[] = [
    { nodo: 'esperar', canal: 'whatsapp', espera: { modo: 'tiempo', minutos: 60 } },
    { nodo: 'condicion', canal: 'whatsapp' }, { nodo: 'respuesta', canal: 'whatsapp' }, { nodo: 'ir_a', canal: 'whatsapp' },
    { nodo: 'inicio', canal: 'whatsapp' },
    { canal: 'whatsapp', accion: { operacion: 'poner_etiqueta_lead' } },
    { canal: 'email', accion: {} },
  ];
  assert.deepEqual(enviosDePasos(control), []);
  assert.deepEqual(enviosDePasos([]), []);
});

test('un Mensaje de MaKo le escribe al NEGOCIO: por WhatsApp, «Al WhatsApp de MaKo»; por email, a ninguno de los dos destinos', () => {
  assert.deepEqual(enviosDeAviso({ wa: true, email: false }), [{ canal: 'whatsapp', destino: 'mako' }]);
  assert.deepEqual(enviosDeAviso({ wa: false, email: true }), [{ canal: 'email', destino: 'negocio' }]);
  assert.deepEqual(enviosDeAviso({ wa: true, email: true }).length, 2);
  assert.deepEqual(enviosDeAviso(null), []);
  // La fila: un fijo cuenta como activo aunque su interruptor diga otra cosa, y el emoji es el de su categoría.
  assert.deepEqual(filaDeMensaje({ categoria: 'reporte', enabled: false, fijo: true, canales: { wa: true, email: false } }),
    { activa: true, emoji: '📊', envios: [{ canal: 'whatsapp', destino: 'mako' }] });
});

test('la fila de una automatización: el emoji que se VE y los envíos de SUS pasos', () => {
  const j = { activa: false, emoji: '🧲', estrategia: null, pasos: [mail(), mako()] } as unknown as SecuenciaDto;
  assert.deepEqual(filaDeSecuencia(j), {
    activa: false, emoji: '🧲', envios: [{ canal: 'email', destino: 'clientes' }, { canal: 'whatsapp', destino: 'mako' }],
  });
});

// ── Quién pasa ──────────────────────────────────────────────────────────────────

const FILA = (activa: boolean | null, emoji: string, ...envios: FilaFiltrable['envios'][number][]): FilaFiltrable => ({ activa, emoji, envios });
const WA_LEAD = { canal: 'whatsapp', destino: 'clientes' } as const;
const WA_MAKO = { canal: 'whatsapp', destino: 'mako' } as const;
const MAIL_LEAD = { canal: 'email', destino: 'clientes' } as const;

test('sin nada marcado pasa todo; dentro de una sección es «o», entre secciones es «y»', () => {
  const f = FILA(true, '📅', WA_LEAD);
  assert.equal(pasaFiltroLista(f, []), true);
  // «o» adentro: dos emojis.
  assert.equal(pasaFiltroLista(f, [VALOR.emoji('🎯'), VALOR.emoji('📅')]), true);
  assert.equal(pasaFiltroLista(f, [VALOR.emoji('🎯')]), false);
  // «y» entre secciones: el emoji sí, el estado no.
  assert.equal(pasaFiltroLista(f, [VALOR.emoji('📅'), VALOR.pausadas]), false);
  assert.equal(pasaFiltroLista(f, [VALOR.emoji('📅'), VALOR.activas, VALOR.whatsapp]), true);
  // Las dos de Estado marcadas: todo lo que tiene estado.
  assert.equal(pasaFiltroLista(FILA(false, '📅'), [VALOR.activas, VALOR.pausadas]), true);
  // Un estado que no se sabe (el recordatorio antes de leerlo) no pasa ningún «Estado».
  assert.equal(pasaFiltroLista(FILA(null, '⏰', WA_LEAD), [VALOR.activas]), false);
  // ⚠️ Y tampoco «Pausadas»: sin la guarda, `null` caía en el lado de «pausada» y pasaba ESE filtro.
  assert.equal(pasaFiltroLista(FILA(null, '⏰', WA_LEAD), [VALOR.pausadas]), false);
  assert.equal(pasaFiltroLista(FILA(null, '⏰', WA_LEAD), [VALOR.whatsapp]), true);
});

test('«Canal»: por dónde y a quién se contestan sobre el MISMO envío, y la que hace las dos cosas pasa los dos destinos', () => {
  // La tarjeta MAKO (WhatsApp al grupo) + un email al lead: NO le manda un WhatsApp a nadie de afuera.
  const mezcla = FILA(true, '📅', WA_MAKO, MAIL_LEAD);
  assert.equal(pasaFiltroLista(mezcla, [VALOR.whatsapp, VALOR.clientes]), false);
  assert.equal(pasaFiltroLista(mezcla, [VALOR.email, VALOR.clientes]), true);
  assert.equal(pasaFiltroLista(mezcla, [VALOR.whatsapp, VALOR.mako]), true);
  // Le escribe al lead Y al grupo: pasa «A clientes», pasa «Al WhatsApp de MaKo» y pasa los dos.
  const ambas = FILA(true, '📅', WA_LEAD, WA_MAKO);
  assert.equal(pasaFiltroLista(ambas, [VALOR.clientes]), true);
  assert.equal(pasaFiltroLista(ambas, [VALOR.mako]), true);
  assert.equal(pasaFiltroLista(ambas, [VALOR.clientes, VALOR.mako]), true);
  // Sólo al lead: no pasa «Al WhatsApp de MaKo». Sin envíos (nada armado): no pasa ningún canal.
  assert.equal(pasaFiltroLista(FILA(true, '📅', WA_LEAD), [VALOR.mako]), false);
  assert.equal(pasaFiltroLista(FILA(true, '📅'), [VALOR.whatsapp]), false);
  // Un Mensaje de MaKo sólo por email pasa «Email» y no «Al WhatsApp de MaKo» (le llega al correo).
  const soloMail = filaDeMensaje({ categoria: 'aviso', enabled: true, fijo: false, canales: { wa: false, email: true } });
  assert.equal(pasaFiltroLista(soloMail, [VALOR.email]), true);
  assert.equal(pasaFiltroLista(soloMail, [VALOR.mako]), false);
});

// ── Qué ofrece el desplegable ───────────────────────────────────────────────────

const FILAS: FilaFiltrable[] = [
  FILA(true, '📅', WA_LEAD), FILA(false, '📅', MAIL_LEAD), FILA(true, '🎯', WA_LEAD, WA_MAKO), FILA(null, '⏰', WA_LEAD),
];

test('tres secciones, en el orden del pedido: Emojis (los que se ven), Estado y Canal con su línea antes de «A clientes»', () => {
  const s = seccionesDelFiltro(FILAS, []);
  assert.deepEqual(s.map((g) => g.title), [SECCION.emojis, SECCION.estado, SECCION.canal]);
  assert.deepEqual(s.map((g) => g.title), ['Emojis', 'Estado', 'Canal']);
  // Los emojis que HAY, en el orden en que aparecen, con cuántas filas tiene cada uno.
  assert.deepEqual(s[0].options.map((o) => o.label), ['📅 · 2', '🎯 · 1', '⏰ · 1']);
  assert.deepEqual(s[1].options.map((o) => o.label), ['Activas · 2', 'Pausadas · 1']);
  assert.deepEqual(s[2].options.map((o) => o.label), ['WhatsApp · 3', 'Email · 1', 'A clientes · 4', 'Al WhatsApp de MaKo · 1']);
  // La línea: SÓLO arriba de «A clientes» (separa por dónde de a quién).
  assert.deepEqual(s[2].options.map((o) => Boolean(o.lineaArriba)), [false, false, true, false]);
  // Sin «Todas» como opción ni «Quitar filtro» como renglón: eso es el pie.
  assert.ok(!s.some((g) => g.options.some((o) => /Todas|Quitar/.test(o.label))));
  // Un emoji marcado que ya no está en ninguna fila se sigue ofreciendo (con 0), para poder sacarlo.
  assert.ok(seccionesDelFiltro(FILAS, [VALOR.emoji('🧲')])[0].options.some((o) => o.label === '🧲 · 0'));
});

test('en la raíz cada sección dice lo que tiene puesto, como el filtro del Plan: «Todos», lo marcado o cuántos', () => {
  const vacio = seccionesDelFiltro(FILAS, []);
  assert.deepEqual(vacio.map((g) => g.resumen), ['Todos', 'Todas', 'Todos']);
  assert.deepEqual(vacio.map((g) => g.activo), [false, false, false]);
  const uno = seccionesDelFiltro(FILAS, [VALOR.emoji('🎯'), VALOR.pausadas, VALOR.mako]);
  assert.deepEqual(uno.map((g) => g.resumen), ['🎯', 'Pausadas', 'Al WhatsApp de MaKo']);
  assert.deepEqual(uno.map((g) => g.activo), [true, true, true]);
  // Varios: los emojis se dicen a sí mismos; el resto, cuántos.
  const varios = seccionesDelFiltro(FILAS, [VALOR.emoji('📅'), VALOR.emoji('⏰'), VALOR.whatsapp, VALOR.clientes]);
  assert.equal(varios[0].resumen, '📅 ⏰');
  assert.equal(varios[2].resumen, '2 elegidos');
  assert.equal(varios[1].activo, false);
});

test('tocar un renglón lo prende o lo apaga (la regla del Dropdown), y el número del botón es cuántos hay marcados', () => {
  assert.deepEqual(alternarFiltro([], VALOR.activas), [VALOR.activas]);
  assert.deepEqual(alternarFiltro([VALOR.activas, VALOR.whatsapp], VALOR.activas), [VALOR.whatsapp]);
  assert.equal(contarFiltros([VALOR.activas, VALOR.whatsapp, VALOR.emoji('📅')]), 3);
  assert.equal(contarFiltros([]), 0);
});

// ── El botón y el desplegable ───────────────────────────────────────────────────

const SECUENCIA = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
  activa: true, pasos: [wa()], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;
const dibujar = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias: [SECUENCIA], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null,
  ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

test('el botón es CHICO: sólo el embudo de la casa, cuadrado y del alto del buscador, que se lleva el resto de la fila', () => {
  const html = dibujar();
  const i = html.indexOf('aria-label="Filtrar"');
  assert.ok(i > 0, 'no está el botón de filtrar');
  const boton = html.slice(html.lastIndexOf('<button', i), html.indexOf('</button>', i));
  for (const m of [/;width:38px;/, /;height:38px;/, /;padding:0;/]) assert.match(boton, m);
  // Sólo el ícono: el embudo de `Icon name="funnel"` y ninguna palabra.
  assert.ok(boton.includes('<path d="M3 5h18l-6.5 8v5.5l-5-2.5V13L3 5Z"'), 'no es el embudo de la casa');
  assert.doesNotMatch(boton.replace(/<[^>]+>/g, ''), /[A-Za-zÁ-ú]/, 'el botón volvió a tener texto');
  // El buscador estira y mide lo mismo de alto.
  assert.match(html, /aria-label="Buscar por nombre" style="flex:1;min-width:0;height:38px/);
  // Sin nada marcado no hay número.
  assert.doesNotMatch(html.slice(i, i + 2000), /title="Quitar filtros"/);
});

test('el desplegable es el del Plan: el Dropdown de la casa por secciones, con varias marcadas y «Quitar filtros» abajo, abriendo hacia afuera', () => {
  const f = fuente('app/chatbot/FiltroLista.tsx');
  assert.match(f, /value="" varios=\{valores\} onChange=\{\(v\) => onCambio\(alternarFiltro\(valores, v\)\)\}/);
  assert.match(f, /secciones=\{seccionesDelFiltro\(filas, valores\)\} search=\{false\} sinFlecha/);
  assert.match(f, /align="afuera"/);
  assert.match(f, /pie=\{n > 0 \? \{ label: 'Quitar filtros', onClick: \(\) => onCambio\(\[\]\) \} : undefined\}/);
  // El número arriba a la derecha, que también quita (el molde del Plan y del CRM).
  assert.match(f, /\{n > 0 && \(\n\s+<span aria-hidden onClick=\{\(\) => onCambio\(\[\]\)\} title="Quitar filtros"/);
  // La lista le pasa TODAS sus filas (automatizaciones, recordatorio, mensajes) y filtra con la misma función.
  const lista = fuente('app/chatbot/SimuladorWhatsApp.tsx');
  assert.match(lista, /<FiltroLista filas=\{todasLasFilas\} valores=\{filtros\} onCambio=\{setFiltros\} \/>/);
  const filas = lista.slice(lista.indexOf('const todasLasFilas: FilaFiltrable[] = ['), lista.indexOf('];', lista.indexOf('const todasLasFilas: FilaFiltrable[] = [')));
  assert.match(filas, /\.\.\.filasSec\.values\(\),\n\s+\.\.\.\(rolAdmin \? \[filaDeRecordatorio\(recordatorioActivo\)\] : \[\]\),\n\s+\.\.\.avisosLista\.map\(filaDeMensaje\),/,
    'el desplegable no cuenta todas las filas de la lista');
  assert.match(lista, /pasaFiltroLista\(filasSec\.get\(j\.id\) \?\? filaDeSecuencia\(j\), filtros\)/);
  assert.match(lista, /&& pasaFiltroLista\(filaDeRecordatorio\(recordatorioActivo\), filtros\)/);
  assert.match(lista, /avisosLista\.filter\(\(a\) => pasaFiltroLista\(filaDeMensaje\(a\), filtros\)/);
});

test('el Dropdown aprendió lo que le faltaba del filtro del Plan: el resumen de la sección, la línea y el pie que no cierra', () => {
  const dd = fuente('app/components/Dropdown.tsx');
  // La fila de la sección dice su resumen (en el color de lo elegido) y la › aparte; sin resumen, el conteo de siempre.
  assert.match(dd, /\{g\.resumen != null \? \(/);
  assert.match(dd, /color: g\.activo \? 'var\(--primary\)' : 'var\(--faint\)', fontWeight: g\.activo \? 600 : 500/);
  assert.match(dd, /\{g\.grupos\?\.length \? '›' : `\$\{g\.options\.length\} ›`\}/);
  // La línea de `lineaArriba`, adentro de una sección y en la lista plana.
  assert.match(dd, /\{abierta\.options\.map\(\(o\) => conLinea\(o, renderOption\(/);
  assert.match(dd, /\{optsVisibles\.map\(\(o\) => conLinea\(o, renderOption\(/);
  // El pie: abajo del todo, con la cara del renglón sutil, y sin cerrar el menú.
  const pie = dd.slice(dd.indexOf('{pie && !buscando && ('), dd.indexOf('</button>', dd.indexOf('{pie && !buscando && (')));
  assert.ok(pie.length > 0 && pie.length < 1500, `el recorte del pie mide ${pie.length}`);
  assert.match(pie, /onClick=\{pie\.onClick\}/);
  assert.doesNotMatch(pie, /setOpen\(false\)/, '«Quitar filtros» cierra el menú');
  assert.match(pie, /borderTop: '1px solid var\(--border\)'/);
  assert.match(pie, /color: 'var\(--faint\)', opacity: 0\.7/);
  // Y va DESPUÉS de todo lo demás del menú.
  assert.ok(dd.indexOf('{pie && !buscando && (') > dd.indexOf('{sinResultados && ('), 'el pie no va abajo del todo');
});

// ROTURAS (09/10/2026), una por vez, con un arnés que rompe, corre ESTE archivo,
// tests/chatbot-mensajes-mako.test.ts y tests/chatbot-lista-nueva.test.ts (33 tests entre los tres), y
// restaura DE MEMORIA (nunca con git checkout) verificando con md5 que cada archivo volviera idéntico.
// Sin romper: 33 pass / 0 fail. Las de este archivo (pass / fail):
//   · F1 un paso con `canal` cuenta aunque sea de control (sin `claseDe`): 30 / 3
//   · F2 la tarjeta MAKO no cuenta: 31 / 2 · F3 canal y destino sueltos (no el MISMO envío): 32 / 1
//   · F4 «y» adentro de Emojis: 32 / 1 · F5 un estado que no se sabe pasa «Estado»: 32 / 1 (la primera
//     versión del test daba VERDE: sólo probaba «Activas», y `null` caía del lado de «Pausadas»)
//   · F6 sin la línea antes de «A clientes»: 32 / 1 · F7 la raíz dice «Todas» en Emojis: 32 / 1
//   · F8 un email al negocio cuenta como «Al WhatsApp de MaKo»: 31 / 2 · F9 un fijo apagado cuenta
//     como pausado: 31 / 2
//   · U1 sin «Quitar filtros»: 32 / 1 · U2 «Quitar filtros» cierra el menú: 32 / 1 · U3 la sección del
//     Dropdown sin resumen: 32 / 1 · U4 el botón con texto: 32 / 1 · U5 el desplegable sin contar los
//     mensajes: 32 / 1
// Las del punto 5 (M1-M14), al pie de tests/chatbot-mensajes-mako.test.ts.
