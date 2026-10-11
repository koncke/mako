// =============================================================================
// Décima tanda de Automations (11/10/2026), la parte del LIENZO: general 1, 2, 3 y 5; CRON 1, 3 y 4;
// CONDITION 1, 2 y 3; WhatsApp 1 y 4. El pedido textual, en app/admin/dev/chatbot/bitacora.ts (último hito).
// =============================================================================
//   · General 1: el botón de MaKo al lado del título es el LOGO (sin la estrella chiquita) y mide lo que el título.
//   · General 2: el lazo atenúa lo no elegido MIENTRAS se arrastra (`tocadosPorLazo`, una función para los dos momentos).
//   · General 3: los días del horario de oficina, centrados.
//   · General 5: sin «Volver a lo publicado»; «Descartar cambios» en el «⋯» de la fila con cambios sin publicar.
//   · CRON 1: los seis botones no salen del recuadro. CRON 3: la lista va hasta el CRON abierto (`scrollParaVer`).
//     CRON 4: con dos o más, «＋ Nuevo CRON» arriba de todo (`nuevoArriba`).
//   · CONDITION 1: el recuadro de la condición llena el panel; con dos o más, botones arriba y entran dos.
//     CONDITION 2: el tacho de la esquina tiene su aire (sin scroll lateral). CONDITION 3: las filas de la
//     tarjeta, a la derecha, junto a su círculo (`filaALaDerecha`).
//   · WhatsApp 1: cada mensaje en su burbuja (`burbujasDeTarjeta`). WhatsApp 4: la rueda adentro de un panel no
//     hace zoom (`queHaceLaRueda`).
//
// PROBADO ROMPIÉNDOLO (11/10/2026, base en verde; arnés en el scratchpad, restaura de memoria): ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  queHaceLaRueda, tocadosPorLazo, filaALaDerecha, scrollParaVer, ALTO_EDITOR_CONTROL, type CapaRueda,
} from '../lib/lienzo-grafo';
import { burbujasDeTarjeta, altoDeMensaje, altoDeBurbuja, RENGLONES_CON_DOS, SEP_BURBUJAS_TARJETA, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { EditorDisparadores, nuevoArriba } from '../app/automations/EditorDisparadores';
import { EditorCondicion, ALTO_CONDICION_VARIAS } from '../app/automations/EditorCondicion';
import { opcionesDeFila } from '../app/automations/SimuladorWhatsApp';
import { BotonLogoMako } from '../app/automations/SecuenciaPerfil';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string, tope = 4_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const LIENZO = sinComentarios(leer('app/_components/Lienzo.tsx'));
const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));

// ── WhatsApp 4: la rueda ─────────────────────────────────────────────────────────

const capa = (o: Partial<CapaRueda> = {}): CapaRueda => ({
  panel: false, overflowX: 'visible', overflowY: 'visible', scrollLeft: 0, scrollTop: 0,
  scrollWidth: 300, scrollHeight: 200, clientWidth: 300, clientHeight: 200, ...o,
});
// Una lista que desborda (600 de contenido en 200), a la mitad / arriba de todo / abajo de todo.
const lista = (scrollTop: number) => capa({ overflowY: 'auto', scrollHeight: 600, clientHeight: 200, scrollTop });

test('WhatsApp 4: sobre el dibujo la rueda hace zoom; adentro de un panel que desborda, scrollea el navegador', () => {
  assert.equal(queHaceLaRueda([], 0, 100), 'zoom', 'sobre el fondo del lienzo');
  assert.equal(queHaceLaRueda([capa(), capa()], 0, 100), 'zoom', 'sobre una tarjeta');
  assert.equal(queHaceLaRueda([capa(), lista(200), capa({ panel: true })], 0, 100), 'nativo', 'a la mitad, para abajo');
  assert.equal(queHaceLaRueda([capa(), lista(200), capa({ panel: true })], 0, -100), 'nativo', 'a la mitad, para arriba');
});

test('WhatsApp 4: en el borde de la lista, o en un panel que no desborda, NI zoom NI scroll de la página', () => {
  assert.equal(queHaceLaRueda([lista(0), capa({ panel: true })], 0, -100), 'nada', 'arriba de todo, para arriba');
  assert.equal(queHaceLaRueda([lista(400), capa({ panel: true })], 0, 100), 'nada', 'abajo de todo, para abajo');
  assert.equal(queHaceLaRueda([capa(), capa({ panel: true })], 0, 100), 'nada', 'un panel corto');
  // Lo de adentro que no puede moverse cede al de afuera que sí (un textarea lleno adentro de un panel que scrollea).
  assert.equal(queHaceLaRueda([lista(400), lista(100)], 0, 100), 'nativo');
});

test('WhatsApp 4: una caja con overflow auto que NO desborda no es un panel (la rueda sobre esa tarjeta hace zoom)', () => {
  assert.equal(queHaceLaRueda([capa({ overflowY: 'auto' })], 0, 100), 'zoom');
  // Y la rueda de costado mira el eje de costado.
  assert.equal(queHaceLaRueda([capa({ overflowX: 'auto', scrollWidth: 900, clientWidth: 300, scrollLeft: 10 }), capa({ panel: true })], 120, 5), 'nativo');
});

test('WhatsApp 4: el lienzo pregunta a `queHaceLaRueda` con la cadena del panel, y el editor se marca como panel', () => {
  const rueda = tramo(LIENZO, 'const onWheel = (e: WheelEvent) => {', "c.addEventListener('wheel', onWheel, { passive: false });");
  assert.match(rueda, /t\.closest\('\[data-no-pan\]'\) && c\.contains\(t\)/, 'mira toda la cadena aun sobre el dibujo');
  assert.match(rueda, /panel: el\.hasAttribute\('data-panel-lienzo'\)/);
  assert.match(rueda, /const que = queHaceLaRueda\(cadena, e\.deltaX, e\.deltaY\);\s*if \(que === 'nativo'\) return;\s*e\.preventDefault\(\);\s*if \(que === 'nada'\) return;/);
  assert.match(LIENZO, /data-no-pan\s*data-panel-lienzo\s*data-panel-forma=/, 'el editor de la tarjeta no es un panel para la rueda');
});

// ── General 2: el lazo ───────────────────────────────────────────────────────────

test('General 2: el lazo toca lo que toca aunque sea un borde, con las esquinas en cualquier orden, y sin las esperas de una flecha', () => {
  const nodos = [
    { id: 'a', x: 0, y: 0, ancho: 100, alto: 50 },
    { id: 'b', x: 200, y: 0, ancho: 100, alto: 50 },
    { id: 'p', x: 90, y: 10, ancho: 40, alto: 20, enFlecha: true },
  ];
  assert.deepEqual(tocadosPorLazo(nodos, { x: 95, y: 5 }, { x: 150, y: 40 }), ['a']);
  assert.deepEqual(tocadosPorLazo(nodos, { x: 250, y: 40 }, { x: 95, y: 5 }), ['a', 'b'], 'de abajo a la derecha hacia arriba');
  assert.deepEqual(tocadosPorLazo(nodos, { x: 140, y: 5 }, { x: 160, y: 40 }), [], 'en el hueco');
});

test('General 2: MIENTRAS se arrastra, lo que toca va al estado (sólo si cambió) y lo de afuera se atenúa; al soltar, la misma cuenta', () => {
  const mover = tramo(LIENZO, 'function onPointerMove', 'function onPointerUp');
  assert.match(mover, /const ids = tocadosPorLazo\(grafo\.nodos, aGrafo\(g\.x0, g\.y0\), aGrafo\(e\.clientX, e\.clientY\)\);/);
  assert.match(mover, /if \(clave !== lazoClave\.current\) \{ lazoClave\.current = clave; setLazoVivo\(ids\); \}/);
  const soltar = tramo(LIENZO, "if (g.modo === 'lazo') {\n      if (lazoRef.current) lazoRef.current.style.display = 'none';", 'onVarios?.(ids);');
  assert.match(soltar, /setLazoVivo\(null\);/, 'el lazo en curso queda atenuando después de soltar');
  assert.match(soltar, /const ids = tocadosPorLazo\(grafo\.nodos,/, 'al soltar se elige con otra cuenta que la que se vio');
  // Lo que se atenúa: el lazo en curso o, sin él, lo elegido. Tarjetas, flechas y la marca de elegida.
  assert.match(LIENZO, /const atenuar: readonly string\[\] \| null = lazoVivo \?\? \(hayVarios \? varios : null\);/);
  assert.match(LIENZO, /: atenuar \? \{ opacity: atenuar\.includes\(n\.id\) \? 1 : ATENUADO/);
  assert.match(LIENZO, /atenuar != null && !\(atenuar\.includes\(a\.desde\) && atenuar\.includes\(a\.hasta\)\)/);
});

// ── CONDITION 3: las filas de la tarjeta, a la derecha ───────────────────────────────

test('CONDITION 3: las filas de una CONDITION (la de la salida y la que escucha) van a la derecha, junto a su círculo', () => {
  assert.equal(filaALaDerecha({ tipo: 'condicion' }, { rotulo: 'Ya le escribiste' }), true);
  assert.equal(filaALaDerecha({ tipo: 'condicion' }, { rotulo: 'Si no' }), true);
  assert.equal(filaALaDerecha({ tipo: 'respuesta' }, { rotulo: 'Pregunta el precio' }), true);
  assert.equal(filaALaDerecha({ tipo: 'paso-ia' }, { rotulo: 'Otra cosa' }), false, 'los casos del AI Step siguen a la izquierda');
  assert.equal(filaALaDerecha({ tipo: 'mensaje', salidaAlPie: true }, {}), true, 'la salida al pie, como siempre');
  assert.equal(filaALaDerecha({ tipo: 'entrada' }, { rotulo: 'Al entrar' }), false);
  const fila = tramo(LIENZO, 'const derecha = filaALaDerecha(nodo, p);', '</div>', 2_000);
  assert.match(fila, /justifyContent: derecha \? 'flex-end' : undefined, paddingRight: derecha \? 12 : 6/);
  assert.match(fila, /marginLeft: derecha \? 6 : 'auto'/, 'la marca se lleva el aire y el rótulo vuelve a la izquierda');
});

// ── WhatsApp 1: cada mensaje en su burbuja ──────────────────────────────────────────

const wa = (extra: Record<string, unknown>): PasoParaGrafo =>
  ({ id: 'm', canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: 'Hola', ...extra }) as unknown as PasoParaGrafo;

test('WhatsApp 1: el audio con su texto guardado como antes son DOS burbujas en la tarjeta, y el alto mide las dos', () => {
  const legado = wa({ tipo: 'audio', audio_id: 3, cuerpo: 'Te dejo el link abajo https://hola-mako.com/agenda' });
  const b = burbujasDeTarjeta(legado);
  assert.deepEqual(b?.map((x) => x.tipo), ['audio', 'texto']);
  const esperado = Math.ceil(47 + altoDeBurbuja(b![0], RENGLONES_CON_DOS) + SEP_BURBUJAS_TARJETA + altoDeBurbuja(b![1], RENGLONES_CON_DOS) + 6);
  assert.equal(altoDeMensaje(legado), Math.min(260, esperado));
  // Un texto solo, o un audio sin texto, es UNA burbuja: lo de siempre.
  assert.equal(burbujasDeTarjeta(wa({})), null);
  assert.equal(burbujasDeTarjeta(wa({ tipo: 'audio', audio_id: 3, cuerpo: '' })), null);
  const vista = tramo(sinComentarios(leer('app/automations/FlujoLienzo.tsx')), 'function VistaMensaje(', '\nfunction VistaEmail(', 5_000);
  assert.match(vista, /const partes = burbujasDeTarjeta\(paso /, 'la tarjeta y su alto cuentan distinto');
});

// ── CRON 1, 3 y 4 ──────────────────────────────────────────────────────────────────

const PRODUCTOS = [{ funnelId: 5, productoId: 9, nombre: 'Curso', esDefault: true, origenEntrega: 'declarado' as const,
  etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [] }];
const panelCron = (lista: unknown[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(EditorDisparadores, {
  lista, editando: null, onEditar: () => {}, onGuardar: () => {}, productos: PRODUCTOS, etiquetas: [], disparadores: [],
  etiquetaEtapa: (k: string) => k, tz: 'America/Mexico_City', rolAdmin: true, ...extra,
} as never));

test('CRON 1: el recuadro nunca mide menos que lo que tiene adentro, y la lista scrollea siempre (sin desborde lateral)', () => {
  const html = panelCron([{ id: 'd1', trigger_tipo: 'manual' }]);
  const recuadro = html.slice(html.lastIndexOf('<div', html.indexOf('data-cron-recuadro="d1"')), html.indexOf('data-cron-clases'));
  assert.match(recuadro, /flex:1 0 auto/, 'el recuadro se puede achicar por debajo de los seis botones');
  assert.match(html, /data-cron-lista[^>]*overflow-y:auto;overflow-x:hidden/);
  assert.match(html, /min-height:76px/);
});

test('CRON 4: con DOS o más CRON, «＋ Nuevo CRON» va arriba de todo; con uno, abajo', () => {
  assert.equal(nuevoArriba(1), false);
  assert.equal(nuevoArriba(2), true);
  const uno = panelCron([{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 }]);
  assert.ok(uno.indexOf('Nuevo CRON') > uno.indexOf('data-cron-recuadro="d1"'), 'con uno, «＋ Nuevo CRON» no va abajo');
  const dos = panelCron([
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 },
    { id: 'd2', trigger_tipo: 'etiqueta_agregada' },
  ]);
  assert.ok(dos.indexOf('Nuevo CRON') < dos.indexOf('data-cron-recuadro="d1"'), 'con dos, «＋ Nuevo CRON» no va arriba de todo');
  // Y el recuadro del NUEVO (abierto), también arriba.
  const nuevo = panelCron([
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 },
    { id: 'd2', trigger_tipo: 'etiqueta_agregada' },
  ], { editando: 'nuevo' });
  assert.ok(nuevo.indexOf('data-cron-recuadro="nuevo"') < nuevo.indexOf('data-cron-recuadro="d1"'));
});

test('CRON 3: lo que hay que scrollear para ver el recuadro abierto (y nada si ya se ve)', () => {
  const caja = { scrollTop: 100, alto: 300 };
  assert.equal(scrollParaVer({ top: 150, alto: 100 }, caja), null, 'ya se ve');
  assert.equal(scrollParaVer({ top: 500, alto: 100 }, caja), 310, 'abajo: queda su borde de abajo a la vista');
  assert.equal(scrollParaVer({ top: 20, alto: 100 }, caja), 10, 'arriba: su arriba, con el margen');
  assert.equal(scrollParaVer({ top: 450, alto: 400 }, caja), 440, 'más alto que la lista: manda su ARRIBA (el editor)');
  assert.equal(scrollParaVer({ top: 0, alto: 50 }, { scrollTop: 30, alto: 300 }), 0, 'nunca negativo');
  const src = sinComentarios(leer('app/automations/EditorDisparadores.tsx'));
  const efecto = tramo(src, "const claveAbierta = editando === 'nuevo' ? 'nuevo' : (editando ?? lista[0]?.id ?? null);", '}, [claveAbierta]);', 1_500);
  assert.match(efecto, /scrollParaVer\(/);
  assert.match(efecto, /cont\.scrollTo\(\{ top: nuevo, behavior: 'smooth' \}\)/);
  assert.doesNotMatch(efecto, /scrollIntoView/, 'scrollIntoView mueve también la caja del lienzo');
  // Antes del return de quien sólo mira (un hook detrás de un return temprano).
  assert.ok(src.indexOf('}, [claveAbierta]);') < src.indexOf('if (!rolAdmin) {'), 'el efecto quedó detrás del return de quien mira');
});

// ── CONDITION 1 y 2 ─────────────────────────────────────────────────────────────────

const condicion = (filas: Array<Record<string, unknown>>) => renderToStaticMarkup(createElement(EditorCondicion, {
  paso: { ramas: [{ id: 'r', modo: 'todas', filas, siguiente: null }] } as never, cambiar: () => {}, ambito: 'adquisicion',
  etapas: [], productos: [], busy: false, onQuitarRama: () => {}, catalogos: null,
}));

test('CONDITION 1: con UNA condición su recuadro llena el panel y los botones van abajo', () => {
  const html = condicion([{ campo: 'agendo' }]);
  const fila = html.slice(html.indexOf('data-condicion-fila'), html.indexOf('>', html.indexOf('data-condicion-fila')));
  assert.match(fila, /flex:1 0 auto/, 'el recuadro de la condición no llena el panel');
  assert.ok(html.indexOf('data-condicion-botones') > html.indexOf('data-condicion-fila'), 'con una, los botones no van abajo');
});

test('CONDITION 1: con DOS o más, los botones arriba de todo y cada recuadro con su piso; entran dos en el panel', () => {
  const html = condicion([{ campo: 'agendo' }, { campo: 'agendo', union: 'o' }]);
  assert.ok(html.indexOf('data-condicion-botones') < html.indexOf('data-condicion-fila'), 'con dos, los botones no van arriba');
  assert.equal((html.match(new RegExp(`min-height:${ALTO_CONDICION_VARIAS}px`, 'g')) ?? []).length, 2);
  // La cuenta del panel (lib/lienzo-grafo.ts): cabecera 62, aire del tacho 9, botones 48 + 10, la «y» ~23 + 2 × 10.
  const adentro = ALTO_EDITOR_CONTROL.condicion! - 62 - 9;
  assert.ok(48 + 10 + 2 * ALTO_CONDICION_VARIAS + 23 + 20 <= adentro, `dos condiciones no entran en ${adentro}`);
});

test('CONDITION 2: el tacho de la esquina tiene su aire en la caja que scrollea del panel (sin scroll lateral)', () => {
  assert.match(LIENZO, /const AIRE_ESQUINA = 9;/);
  assert.match(LIENZO, /padding: `\$\{AIRE_ESQUINA\}px \$\{AIRE_ESQUINA\}px 0 0`, margin: `-\$\{AIRE_ESQUINA\}px -\$\{AIRE_ESQUINA\}px 0 0`/);
  // El tacho sigue colgando 9 de la esquina: si cuelga más, el aire no alcanza.
  assert.match(sinComentarios(leer('app/automations/EditorCondicion.tsx')), /position: 'absolute', top: -9, right: -9/);
});

// ── General 1, 3 y 5 ──────────────────────────────────────────────────────────────

test('General 1: el botón de MaKo del título es el LOGO (la chispa sola) y mide lo que el título', () => {
  const html = renderToStaticMarkup(createElement(BotonLogoMako, { lado: 44, onClick: () => {}, title: 'Pedirle un cambio a MaKo' }));
  assert.match(html, /width:44px;height:44px/);
  assert.match(html, /viewBox="0 0 48 48"/, 'no es el logo');
  assert.doesNotMatch(html, /<circle/, 'volvió la estrella chiquita de arriba');
  const chrome = tramo(PERFIL, '<div data-titulo-lienzo', '{onProbar && (', 3_000);
  assert.match(chrome, /height: ALTO_ACCION/, 'el título no tiene el alto del botón');
  assert.match(chrome, /<BotonLogoMako lado=\{ALTO_ACCION\}/, 'el botón no mide lo que el título');
  assert.doesNotMatch(chrome, /<BotonMako /);
});

test('General 3: los días del horario de oficina, centrados en su recuadro', () => {
  assert.match(leer('app/configuraciones/HorarioEnvioPanel.tsx'), /role="group" aria-label="Días" style=\{\{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' \}\}/);
});

test('General 5: «Descartar cambios» aparece en el «⋯» SÓLO con cambios sin publicar, antes de «Eliminar»', () => {
  assert.deepEqual(opcionesDeFila(true, false).map((o) => o.value), ['activa', 'duplicar', 'copiar', 'eliminar']);
  const con = opcionesDeFila(true, true);
  assert.deepEqual(con.map((o) => o.value), ['activa', 'duplicar', 'copiar', 'descartar', 'eliminar']);
  assert.equal(con.find((o) => o.value === 'descartar')!.label, 'Descartar cambios');
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  const accion = tramo(lista, "if (accion === 'descartar') {", 'return;\n    }', 600);
  // La abierta: por la ref del lienzo (vuelve a lo publicado, con Ctrl+Z). Una cerrada: con la confirmación de la casa.
  assert.match(accion, /if \(j\.id === selId && descartarBorrador\.current\) \{ descartarBorrador\.current\(\); setSinPublicar\(false\); return; \}/);
  assert.match(accion, /setADescartar\(j\);/);
  assert.match(tramo(lista, 'const descartarCerrada = async () => {', 'const accionFila'), /action: 'descartar-borrador', secuenciaId: j\.id/);
  assert.doesNotMatch(PERFIL, /Volver a lo publicado/, 'volvió el botón al lado de «Activar»');
});

// PROBADO ROMPIÉNDOLO (11/10/2026), de a una y restaurando de memoria. Base: 17 / 0.
//   R1. `queHaceLaRueda` cuenta como panel una caja con overflow auto que no desborda   → 16 / 1
//   R2. el lazo vuelve al estado SIN la guarda de «cambió el conjunto»                   → 31 / 2 (con tests/lienzo.test.ts:
//       cae acá y en «El movimiento no pasa por setState»)
//   R3. `filaALaDerecha` sin la CONDITION                                                 → 16 / 1
//   R4. `burbujasDeTarjeta` vuelve a `partesExplicitas` (el audio con su texto, en una)    → 16 / 1
//   R5. «＋ Nuevo CRON» siempre abajo (`nuevoArriba` con 99)                                → 16 / 1
