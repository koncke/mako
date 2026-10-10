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
//   · (revisión, 10/10/2026) con cambios sin guardar el clic afuera, el Escape y el scroll NO cierran
//     (`onSucio` del panel + `retener`); el botón se pone al día con `onGuardado`, sin mirar el DOM;
//   · el borde del botón va en la CLASE: un `style` en línea anula el `:hover`;
//   · si el botón sale de la vista de la lista, el panel se cierra (como el `Dropdown` de la casa);
//   · sin ninguna automatización, el cartel vacío también monta el control.
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
  BotonHorario, alScrollear, describirHorario, fueraDeVista, rotuloHorario, ubicarAfuera, SEPARACION_AFUERA, type EstadoHorario,
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
  assert.match(src, /\{rolAdmin && ancla && \(\s*<PanelAnclado [^>]*>\s*<HorarioEnvioPanel onGuardado=\{leer\} onSucio=\{alSucio\} \/>\s*<\/PanelAnclado>\s*\)\}/,
    'el editor no está montado en el panel, o no sólo para admin');
  assert.match(src, /<BotonHorario estado=\{estado\} editable=\{rolAdmin\} /, 'quien no es admin no abre el editor');
  // El estado del botón sale de la misma lectura, y se vuelve a pedir al cerrar y al guardar.
  assert.match(src, /getHorarioEnvioAction\(\)\s*\.then\(\(d\) => \{ if \(n === pedido\.current\) setEstado\(\{ t: 'listo', horario: d\.horario, zona: d\.zona \}\); \}\)/);
  assert.match(src, /const cerrar = useCallback\(\(\) => \{ sucio\.current = false; setAncla\(null\); leer\(\); \}, \[leer\]\);/);
  // Al guardar lo avisa el PANEL (`onGuardado`): el puente que miraba aparecer «Guardado» en el DOM se fue.
  assert.doesNotMatch(src, /MutationObserver|AVISO_GUARDADO|setCuerpo/, 'volvió el puente que leía el DOM del panel');
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

// ── (revisión) Lo no guardado no se pierde con un clic suelto ─────────────────────────────

/** El cuerpo de una función o de un listener: desde su apertura hasta lo que abre el bloque siguiente. */
const bloque = (src: string, desde: string, hasta: string) => {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré «${desde}»`);
  const fin = src.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(ini, fin);
};

test('el panel de Configuraciones avisa si hay cambios sin guardar (antes de todo return) y cuándo guardó bien', () => {
  const src = fuente('app/configuraciones/HorarioEnvioPanel.tsx');
  // Las dos props son OPCIONALES: Configuraciones › Horario lo monta sin ninguna (tests/horario-envio.test.ts
  // fija ese montaje, `panel: <HorarioEnvioPanel />`).
  assert.match(src, /export function HorarioEnvioPanel\(\{ onGuardado, onSucio \}: \{\s*onGuardado\?: \(h: HorarioEnvio\) => void;\s*onSucio\?: \(sucio: boolean\) => void;\s*\}\)/);
  // «Sucio» se avisa con un efecto que corre ANTES del return temprano (un hook detrás de un return es
  // la pantalla en blanco), y con el horario sin leer no hay nada que perder.
  const iEfecto = src.indexOf('useEffect(() => { onSucio?.(sucio); }, [sucio, onSucio]);');
  const iReturn = src.indexOf('if (!h) return');
  assert.ok(iEfecto > 0 && iReturn > iEfecto, 'el aviso de «sucio» no está, o quedó detrás del return temprano');
  assert.match(src, /const sucio = h != null && JSON\.stringify\(h\) !== guardado;/);
  // `onGuardado`, sólo con el guardado BIEN y con lo que quedó guardado.
  const g = bloque(src, 'async function guardar()', 'const off = ');
  const iNoOk = g.indexOf('if (!r.ok)');
  const iAviso = g.indexOf("setAviso('Guardado');");
  const iAvisa = g.indexOf('onGuardado?.(quedo);');
  assert.ok(iNoOk >= 0 && iAviso > iNoOk && iAvisa > iAviso, '`onGuardado` no corre justo después de guardar bien');
  assert.match(g, /const quedo = \('horario' in r && r\.horario\) \? r\.horario : h;\s*setH\(quedo\);\s*setGuardado\(JSON\.stringify\(quedo\)\);/);
});

test('la lista lleva «sucio» en un ref, y el panel anclado no se cierra mientras diga que sí', () => {
  const lista = fuente('app/automations/HorarioLista.tsx');
  assert.match(lista, /const sucio = useRef\(false\);/);
  assert.match(lista, /const retener = useCallback\(\(\) => sucio\.current, \[\]\);/);
  assert.match(lista, /const alSucio = useCallback\(\(s: boolean\) => \{ sucio\.current = s; \}, \[\]\);/);
  assert.match(lista, /<PanelAnclado [^>]*\bretener=\{retener\}[^>]*>/, 'el panel anclado no sabe si hay cambios sin guardar');

  const panel = fuente('app/automations/HorarioBoton.tsx');
  const p = panel.slice(panel.indexOf('export function PanelAnclado('));
  // Por REF, como `onCerrar`: los listeners se registran una vez por apertura.
  assert.match(p, /const retenerRef = useRef\(retener\);\s*useEffect\(\(\) => \{ retenerRef\.current = retener; \}, \[retener\]\);/);
  // El clic afuera: con cambios sin guardar, no cierra.
  const fuera = bloque(p, 'const fuera = (e: PointerEvent) => {', "document.addEventListener('pointerdown'");
  assert.match(fuera, /if \(hayMenuAbiertoEn\(panel\.current\)\) return;\s*if \(retenerRef\.current\?\.\(\)\) return;\s*cerrarRef\.current\(\);/,
    'el clic afuera cierra con cambios sin guardar');
  // El Escape: se FRENA igual (si no, lo contesta la capa de abajo) y no cierra.
  const esc = bloque(p, 'const onKey = (e: KeyboardEvent) => {', "document.addEventListener('keydown'");
  assert.match(esc, /e\.stopImmediatePropagation\(\);\s*e\.preventDefault\(\);\s*if \(retenerRef\.current\?\.\(\)\) return;\s*cerrarRef\.current\(\);/,
    'el Escape cierra con cambios sin guardar, o los suelta a la capa de abajo');
});

// ── (revisión) El borde del botón va en la CLASE ──────────────────────────────────────────

test('el botón: el `style` en línea no pisa nada de lo que cambia el :hover (el borde incluido)', () => {
  const html = renderToStaticMarkup(createElement(BotonHorario, { estado: LISTO({}), editable: true, abierto: false, onAlternar: () => {} }));
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) ?? [])[1] ?? '';
  // Lo que cambia la regla del hover / foco / abierto.
  const hover = css.match(/button\.chb-horario:hover[^{]*\{([^}]*)\}/);
  assert.ok(hover, 'no encontré la regla del hover');
  const props = (s: string) => s.split(';').map((d) => d.split(':')[0].trim().toLowerCase()).filter(Boolean);
  const delHover = props(hover[1]);
  assert.ok(delHover.includes('border-color'), 'el hover ya no cambia el borde: este test perdió su sujeto');
  // El borde existe, y vive en la clase.
  assert.match(css, /\.chb-horario\{[^}]*border:1px solid var\(--border\)/, 'el borde salió de la clase');
  // Lo que escribe el `style` del botón: nada que pise esas propiedades (ni su atajo: `border` pisa `border-color`).
  const estilo = (html.match(/<button[^>]*\sstyle="([^"]*)"/) ?? [])[1] ?? '';
  assert.ok(estilo.length > 0, 'no encontré el style del botón');
  const pisa = (enLinea: string, deHover: string) => enLinea === deHover || deHover.startsWith(`${enLinea}-`) || enLinea.startsWith(`${deHover}-`);
  for (const enLinea of props(estilo)) {
    for (const h of delHover) assert.ok(!pisa(enLinea, h), `el style en línea pone «${enLinea}», que le gana al «${h}» del :hover`);
  }
});

// ── (revisión) El botón sale de la vista: el panel se cierra, salvo cambios sin guardar ───

test('al scrollear: si el botón salió de la vista se cierra, salvo cambios sin guardar; si se ve, se recoloca', () => {
  const franja = { top: 100, bottom: 600 };
  const boton = (top: number) => ({ left: 300, right: 330, top, bottom: top + 24 });
  // Adentro, y a medias (un píxel adentro todavía se ve): se recoloca.
  assert.equal(alScrollear(boton(300), franja, false), 'recolocar');
  assert.equal(alScrollear(boton(90), franja, false), 'recolocar', 'con un pedazo a la vista, se cerró');
  assert.equal(fueraDeVista(boton(77), franja), false);
  // Entero afuera, por arriba o por abajo: se cierra.
  assert.equal(fueraDeVista(boton(76), franja), true, 'justo en el borde ya no se ve');
  assert.equal(alScrollear(boton(40), franja, false), 'cerrar');
  assert.equal(alScrollear(boton(600), franja, false), 'cerrar');
  // Con cambios sin guardar, queda (pegado arriba, como antes).
  assert.equal(alScrollear(boton(40), franja, true), 'recolocar', 'con cambios sin guardar, el scroll tiró lo escrito');
  // Sin ancla (el botón se desmontó): no se decide nada por el scroll.
  assert.equal(alScrollear(null, franja, false), 'recolocar');

  // Y el listener del scroll le pregunta a esa función, con «sucio» y por los refs.
  const src = fuente('app/automations/HorarioBoton.tsx');
  const s = bloque(src, 'const alScroll = (e: Event) => {', "window.addEventListener('resize'");
  assert.match(s, /if \(alScrollear\(a, franja, !!retenerRef\.current\?\.\(\)\) === 'cerrar'\) \{ cerrarRef\.current\(\); return; \}\s*recolocar\(\);/,
    'el scroll no cierra cuando el botón sale de la vista');
});

// ── (revisión) Sin ninguna automatización, el cartel vacío también lo monta ───────────────

test('sin ninguna automatización: el cartel monta el control del horario al lado de su «＋ Nueva», para admin', () => {
  const app = fuente('app/automations/ChatAgentApp.tsx');
  const cartel = bloque(app, 'Todavía no hay automatizaciones.', '<SimuladorWhatsApp');
  // (`[^\n]*` y no `[^>]*` en el botón: su `onClick={() => …}` trae un `>` adentro.)
  assert.match(cartel, /\{rolAdmin && \(\s*<div [^>]*>\s*<button [^\n]*>＋ Nueva<\/button>\s*\{\}\s*<HorarioLista rolAdmin=\{rolAdmin\} \/>/,
    'el cartel vacío no tiene el horario al lado de «＋ Nueva»');
  // Una por lugar: el cartel y la lista (nunca los dos a la vez: uno es `length === 0`, el otro `> 0`).
  assert.equal(app.split('<HorarioLista ').length - 1, 2);
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
// (R10 se retiró con el puente: el panel avisa con `onGuardado`; ahora lo fija B7/B8.)
//
// ── ROTURAS de la revisión (10/10/2026, rama wip-v6f-horario) ─────────────────────────────
// Mismo método (arnés que guarda el original en memoria y comprueba que quedó idéntico), este archivo
// solo. Base: 12 pass / 0 fail.
//   B1. HorarioEnvioPanel sin el efecto de `onSucio`                                   → 11 / 1
//   B2. el efecto de `onSucio` DETRÁS del return temprano                              → 11 / 1
//   B3. guardar no llama a `onGuardado`                                                → 11 / 1
//   B4. HorarioLista no le pasa `retener` al panel anclado                             → 11 / 1
//   B5. `retener` siempre false                                                        → 11 / 1
//   B6. HorarioLista no le pasa `onSucio` al editor                                    → 11 / 1
//   B7. HorarioLista no le pasa `onGuardado` (el botón cambia recién al cerrar)        → 11 / 1
//   B8. vuelve el puente que lee el DOM (`AVISO_GUARDADO`)                             → 11 / 1
//   B9. el clic afuera cierra con cambios sin guardar                                  → 11 / 1
//   B10. el Escape cierra con cambios sin guardar                                      → 11 / 1
//   B11. el Escape retenido se SUELTA a la capa de abajo (retener antes del stop)      → 10 / 2
//   B12. el `border` vuelve al `style` en línea                                        → 11 / 1
//   B13. el borde sale de la clase (botón sin borde)                                   → 11 / 1
//   B14. `alScrollear` ignora los cambios sin guardar                                  → 11 / 1
//   B15. `fueraDeVista` cierra con el botón a medias                                   → 11 / 1
//   B16. el scroll sólo recoloca (como antes)                                          → 11 / 1
//   B17. el scroll no le pasa «sucio» a la decisión                                    → 11 / 1
//   B18. el cartel vacío sin el control del horario                                    → 11 / 1
// Restaurado: 12 / 0.
