// =============================================================================
// El horario de envío AHÍ MISMO en Automations (app/automations/HorarioLista.tsx + HorarioBoton.tsx,
// montado por ChatAgentApp en la cabecera de la lista de SimuladorWhatsApp) — 10/10/2026
// =============================================================================
// Pedido de Martín, textual: «El horario de oficina si se configura en la tab de configuraciones,
// pero haz que se pueda configurar allí mismo, sin redirigir.»
//
// Lo que se fija:
//   · la lista dibuja el control en el renglón de «Chatbot», arriba de «＋ Nueva»;
//   · el control monta el MISMO editor de Configuraciones (HorarioEnvioPanel) con la MISMA lectura
//     (`getHorarioEnvioAction`), y no un link a /configuraciones;
//   · sólo un admin lo abre; el resto ve el estado sin botón;
//   · el panel es una capa de la casa: anidada en la pila, Escape con `stopImmediatePropagation`,
//     por portal, abriendo hacia afuera de la lista;
//   · el rótulo corto y la cuenta de dónde cae el panel, ejecutados;
//   · el contrato con el panel: la palabra con que confirma que guardó (el puente de `AVISO_GUARDADO`).
//
// HorarioLista NO se puede importar acá: las acciones de Configuraciones arrastran `server-only`, que
// tira bajo tsx. Por eso lo que vive ahí se fija en el fuente sin comentarios, y lo que se puede
// dibujar (el botón, la lista) se dibuja.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import {
  AVISO_GUARDADO, BotonHorario, describirHorario, rotuloHorario, ubicarAfuera, SEPARACION_AFUERA, type EstadoHorario,
} from '../app/automations/HorarioBoton';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));

const LISTO = (h: Partial<{ activo: boolean; desde: number; hasta: number; dias: Array<0 | 1 | 2 | 3 | 4 | 5 | 6> }>): EstadoHorario => ({
  t: 'listo', zona: 'America/Mexico_City',
  horario: { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6], ...h },
});

// ── El rótulo corto y la frase ────────────────────────────────────────────────────────────

test('el rótulo: «Sin horario», «9 a 21», nada mientras carga y nunca «Sin horario» si no se pudo leer', () => {
  assert.equal(rotuloHorario({ t: 'cargando' }), '', 'un «Cargando…» escrito no es un loader');
  assert.equal(rotuloHorario({ t: 'error' }), 'Horario', '«no pude leer» no es «sin horario»');
  assert.equal(rotuloHorario(LISTO({ activo: false })), 'Sin horario');
  assert.equal(rotuloHorario(LISTO({})), '9 a 21');
  assert.equal(rotuloHorario(LISTO({ desde: 8, hasta: 18 })), '8 a 18');
  // La frase del `title` dice lo que el rótulo no: los días y la zona.
  assert.equal(describirHorario(LISTO({})), 'Horario de envío: de 9 a 21, todos los días (hora de America/Mexico_City)');
  assert.equal(describirHorario(LISTO({ dias: [5, 1, 2] })), 'Horario de envío: de 9 a 21, lunes, martes y viernes (hora de America/Mexico_City)');
  assert.match(describirHorario({ t: 'error' }), /No pude leer/);
  assert.match(describirHorario(LISTO({ activo: false })), /sin horario/);
});

// ── El botón: sólo un admin abre; el resto ve el estado ───────────────────────────────────

test('el botón: un admin tiene un botón que abre un diálogo; quien no es admin ve el estado sin botón; ninguno es un link', () => {
  const dibujar = (editable: boolean) => renderToStaticMarkup(createElement(BotonHorario, {
    estado: LISTO({ activo: false }), editable, abierto: false, onAlternar: () => {},
  }));
  const admin = dibujar(true);
  assert.match(admin, /<button[^>]*data-horario-boton[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"/);
  assert.match(admin, />Sin horario<\/span>/);
  const otro = dibujar(false);
  assert.doesNotMatch(otro, /<button/, 'quien no es admin no edita el horario: no hay botón');
  assert.match(otro, /data-horario-estado/);
  assert.match(otro, />Sin horario<\/span>/, 'el estado se ve igual');
  for (const html of [admin, otro]) {
    assert.doesNotMatch(html, /<a[\s>]|href=/, 'el horario se configura ahí mismo, sin redirigir');
    assert.match(html, /<svg/, 'el reloj es un ícono de línea del set de la casa, no un emoji');
  }
});

// ── La lista lo dibuja en la cabecera de «Chatbot», arriba de «＋ Nueva» ──────────────────

test('la lista dibuja el control en el renglón de «Chatbot», arriba de «＋ Nueva»', () => {
  const secuencia = {
    id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
    activa: true, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
  } as unknown as SecuenciaDto;
  const html = renderToStaticMarkup(createElement(SimuladorWhatsApp, {
    secuencias: [secuencia], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
    rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
    productos: [], disparadores: [], tz: null,
    horario: createElement('span', { 'data-prueba-horario': '' }, 'H'),
  } as Parameters<typeof SimuladorWhatsApp>[0]));
  const iCabecera = html.indexOf('data-cabecera-chatbot');
  const iRotulo = html.indexOf('>Chatbot</div>');
  const iHorario = html.indexOf('data-prueba-horario');
  const iNueva = html.indexOf('>Nueva</span>');
  assert.ok(iCabecera >= 0 && iRotulo > iCabecera, 'falta el renglón de «Chatbot»');
  assert.ok(iHorario > iRotulo && iHorario < iNueva, 'el horario no va en el renglón de «Chatbot», arriba de «＋ Nueva»');
});

test('la tab le pasa a la lista el control del horario, y la lista no importa las acciones (los tests la dibujan)', () => {
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.match(app, /import \{ HorarioLista \} from '\.\/HorarioLista';/);
  assert.match(app, /horario=\{<HorarioLista rolAdmin=\{rolAdmin\} \/>\}/, 'la tab no le pasa el horario a la lista');
  const lista = fuente('app/automations/SimuladorWhatsApp.tsx');
  assert.match(lista, /<div data-cabecera-chatbot[^>]*>\s*<div data-grupo-chatbot[^>]*>\{ROTULO_CHATBOT\}<\/div>\s*\{horario\}\s*<\/div>/);
  for (const r of ['app/automations/SimuladorWhatsApp.tsx', 'app/automations/HorarioBoton.tsx']) {
    assert.doesNotMatch(fuente(r), /configuraciones\/(horario-actions|HorarioEnvioPanel)/, `${r} arrastraría server-only a los tests`);
  }
});

// ── El control monta el MISMO editor, con la MISMA lectura, sólo para admin ───────────────

test('el control monta el editor de Configuraciones con sus acciones, sólo para admin, y no un link a /configuraciones', () => {
  const src = fuente('app/automations/HorarioLista.tsx');
  assert.match(src, /import \{ HorarioEnvioPanel \} from '@\/app\/configuraciones\/HorarioEnvioPanel';/, 'no es el MISMO editor');
  assert.match(src, /import \{ getHorarioEnvioAction \} from '@\/app\/configuraciones\/horario-actions';/, 'no es la MISMA lectura');
  // El panel, una sola vez y adentro de la rama del admin.
  assert.equal(src.split('<HorarioEnvioPanel').length - 1, 1);
  assert.match(src, /\{rolAdmin && ancla && \(\s*<PanelAnclado [^>]*>\s*<div ref=\{setCuerpo\}>\s*<HorarioEnvioPanel \/>\s*<\/div>\s*<\/PanelAnclado>\s*\)\}/,
    'el editor no está montado en el panel, o no sólo para admin');
  assert.match(src, /<BotonHorario estado=\{estado\} editable=\{rolAdmin\} /, 'quien no es admin no abre el editor');
  // El estado del botón sale de la misma lectura, y se vuelve a pedir al cerrar y al guardar.
  assert.match(src, /getHorarioEnvioAction\(\)\s*\.then\(\(d\) => \{ if \(n === pedido\.current\) setEstado\(\{ t: 'listo', horario: d\.horario, zona: d\.zona \}\); \}\)/);
  assert.match(src, /const cerrar = useCallback\(\(\) => \{ setAncla\(null\); leer\(\); \}, \[leer\]\);/);
  assert.match(src, /if \(ahora && !visto\) leer\(\);/);
  // Sin redirigir: ninguna ruta a /configuraciones, ningún link ni navegación en estas piezas.
  for (const r of ['app/automations/HorarioLista.tsx', 'app/automations/HorarioBoton.tsx']) {
    const s = fuente(r);
    assert.doesNotMatch(s, /['"`]\/configuraciones/, `${r} manda a Configuraciones`);
    assert.doesNotMatch(s, /href=|<Link\b|router\.(push|replace)|window\.location/, `${r} navega a otro lado`);
  }
});

// ── El panel es una capa de la casa ───────────────────────────────────────────────────────

test('el panel anclado: anidado en la pila, Escape que no cierra lo de atrás, por portal y hacia afuera de la lista', () => {
  const src = fuente('app/automations/HorarioBoton.tsx');
  const ini = src.indexOf('export function PanelAnclado(');
  assert.ok(ini > 0);
  const panel = src.slice(ini);
  assert.match(panel, /useCapaModal\(true, \{ anidada: true \}\)/);
  assert.match(panel, /if \(e\.key !== 'Escape'\) return;\s*if \(hayMenuAbiertoEn\(panel\.current\)\) return;\s*if \(!arriba\(\)\) return;\s*e\.stopImmediatePropagation\(\);/);
  assert.match(panel, /document\.addEventListener\('keydown', onKey, true\)/, 'los Escape de la casa viven en document y en captura');
  assert.match(panel, /return createPortal\(/);
  assert.match(panel, /document\.body,\s*\);/);
  assert.match(panel, /zIndex: capa\.z/);
  assert.match(panel, /setPos\(ubicarAfuera\(a, borde, /, 'el panel no se ubica afuera de la lista');
  assert.match(panel, /ancla\?\.closest\('aside'\)/);
});

test('dónde cae: a la derecha de la LISTA (no del botón), a la altura del botón, adentro de la ventana; si no entra, debajo', () => {
  const boton = { left: 300, right: 330, top: 100, bottom: 124 };
  const panel = { ancho: 392, alto: 300 };
  const ancha = ubicarAfuera(boton, 342, panel, { ancho: 1440, alto: 900 });
  assert.deepEqual(ancha, { left: 342 + SEPARACION_AFUERA, top: 94 }, 'medido desde el botón, el panel nace encima de la lista');
  // Cerca del pie de la ventana no se sale por abajo.
  assert.equal(ubicarAfuera({ ...boton, top: 800, bottom: 824 }, 342, panel, { ancho: 1440, alto: 900 }).top, 900 - 300 - 10);
  // En una ventana angosta no entra a la derecha: cuelga debajo del botón, adentro de la ventana.
  const angosta = ubicarAfuera(boton, 342, panel, { ancho: 600, alto: 900 });
  assert.deepEqual(angosta, { left: 10, top: 124 + 8 });
});

// ── El contrato del puente con el panel de Configuraciones ────────────────────────────────

test('el puente: la palabra con que el panel confirma que guardó es la que espera el botón para volver a leer', () => {
  const panel = leer('app/configuraciones/HorarioEnvioPanel.tsx');
  assert.ok(panel.includes(`setAviso('${AVISO_GUARDADO}')`),
    `HorarioEnvioPanel ya no dice «${AVISO_GUARDADO}» al guardar: el botón sólo se pone al día al cerrar el panel`);
});

// ── ROTURAS (10/10/2026) ──────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA (un script que guarda el original, lo reescribe y comprueba que
// quedó igual; nunca `git checkout`), con este archivo solo. Base: 8 pass / 0 fail.
//   R1. HorarioLista monta el panel para todos (`{ancla && (` sin `rolAdmin`)         → 7 / 1
//   R2. HorarioLista cambia el editor por `<a href="/configuraciones">Configurar</a>` → 7 / 1
//   R3. BotonHorario dibuja el botón también para quien no es admin (`{true ? (`)      → 7 / 1
//   R4. SimuladorWhatsApp no dibuja `{horario}` en el renglón de «Chatbot»            → 6 / 2
//   R5. ChatAgentApp no le pasa `horario` a la lista                                   → 7 / 1
//   R6. El Escape del panel con `stopPropagation` en vez de `stopImmediatePropagation` → 7 / 1
//   R7. `useCapaModal(true)` sin `anidada`                                             → 7 / 1
//   R8. `rotuloHorario` dice «Sin horario» cuando no se pudo leer                      → 7 / 1
//   R9. `ubicarAfuera` mide desde el botón y no desde el borde de la lista             → 7 / 1
//   R10. El botón espera otra palabra («Guardada») que la del panel                    → 7 / 1
// Restaurado: 8 / 0.
