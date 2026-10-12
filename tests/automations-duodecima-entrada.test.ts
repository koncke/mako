// =============================================================================
// Duodécima tanda de Automations: entrar sin el QR, y el aviso de Probar que se ve
// =============================================================================
// Diseño: docs/diseno-duodecima-tanda.md §1.8, §2.8, §2.12 y decisiones 11 y 12. Martín, en la prueba con Fiesta
// Music (12/10/2026), textual:
//   · «hoy hay un onboarding dentro de la tab que debería quitarse... Leandro entró a la tab y lo primero que le pidió
//     es conectar WhatsApp; vos entrás en la tab por primera vez y tenés que ver el lienzo y tiene que salir el
//     tutorial... Que no haya ninguna fricción».
//   · «lo que falta en el probar es un aviso, que eso ya se lo pedí y no lo hizo: un aviso de que ya se envió y que
//     revise sus chats o notificaciones». El aviso EXISTÍA (décima tanda) y no se veía: vivía dentro del panel (z 3),
//     debajo de la barra de MaKo (z 4) y de Publicar (57), duraba 3,2 s contra ~14 s del primer envío, y se perdía
//     al cerrar Probar o tocar ↻ (el gate de `run`).
//
// Sin DOM en esta casa: lo de la pantalla se fija sobre el FUENTE (sin comentarios) y la lista se dibuja con
// renderToStaticMarkup.
//
// ── Roturas (12/10/2026, scratchpad/wf-duodecima/ui-entrada-probar/romper.mjs: una por vez, restaurada desde la copia
//    y comprobada con md5). Base 6 pass / 0 fail; restaurado 6 / 0. Cada rotura tumbó SU test:
//   · R1 vuelve `import { EvolutionConnect }` a ChatAgentApp                → 5 / 1 «la puerta del QR se fue»
//   · R2 el gancho del recorrido vuelve a pedir `visibles.length > 0`        → 5 / 1 «el recorrido se abre solo…»
//   · R3 sin `vioVacio.current = true` (la reapertura no se arma nunca)      → 5 / 1 «el recorrido se abre solo…»
//   · R4 la lista vuelve a montarse sólo con `visibles.length > 0`           → 5 / 1 «la lista se monta vacía…»
//   · R5 «Ninguna coincide» sin la condición de búsqueda o filtro            → 5 / 1 «la lista se monta vacía…»
//   · R6 `onEnviado` vuelve a ir con `&& run.current === r0`                 → 5 / 1 «onEnviado sin el gate…»
//   · R7 el <Toast> vuelve adentro de la capa de Probar (z 3)                → 5 / 1 «el <Toast> vive en la lista…»
//   · R8 el botón del aviso rojo vuelve a llevar `href="/whatsapp"`           → 5 / 1 «el aviso rojo abre ConectarMedio»
//   · R10 «Omitir» con la lista vacía igual reabre en el primer lienzo       → 5 / 1 «el recorrido se abre solo…»
// (Y la R9 del arnés, el aviso rojo sin marcar el paso al vincular, la cuenta tests/chatbot-puerta.test.ts: 4 / 1.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as puerta from '../lib/chatbot-puerta';
import { SimuladorWhatsApp } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import { DONDE, OBJETIVO_AYUDA, PASOS_AUTOMATIONS, PASOS_DEL_LIENZO } from '../app/automations/recorrido-automations';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = () => sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
const LISTA = () => sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
const PANEL = () => sinComentarios(leer('app/automations/PanelProbar.tsx'));

const dibujar = (secuencias: SecuenciaDto[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias, objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null,
  ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

// ── 1. La puerta del QR ──────────────────────────────────────────────────────────────────────────────────────

test('la puerta del QR se fue: sin EvolutionConnect, sin abreEnQR, y el spinner espera sólo la lista', () => {
  const app = APP();
  assert.doesNotMatch(app, /EvolutionConnect|abreEnQR|puertaAlRecargar|enOnboarding/, 'volvió la puerta del QR');
  assert.ok(!('abreEnQR' in puerta) && !('puertaAlRecargar' in puerta), 'lib/chatbot-puerta.ts volvió a exportar la puerta');
  // «¿Ya cargó?» es `secuencias !== null`: el spinner no espera al onboarding (que se lee sólo para el tilde).
  assert.match(app, /if \(secuencias === null\) \{\n\s+return \(\n\s+<main [^\n]*>\n[\s\S]{0,600}Abriendo Automations…/);
  assert.ok(app.includes('if (marcarWhatsappAlCargar({ onboarding, canal: estadoCanal })) {'), 'el onboarding se lee para rellenar el paso');
});

// ── 2. El recorrido, también con cero automatizaciones ───────────────────────────────────────────────────────

test('el recorrido se abre solo también con la lista vacía, y el primer lienzo de la visita lo reabre desde el CRON', () => {
  const app = APP();
  const gancho = app.indexOf('const recorrido = useRecorridoAutomations(rolAdmin && visibles !== null && !error && creando === null && !galeria);');
  assert.ok(gancho > 0, 'el autoabrir cambió');
  assert.doesNotMatch(app.slice(gancho, app.indexOf('\n', gancho)), /visibles\.length/, 'volvió a esperar la pantalla llena');
  assert.ok(gancho < app.indexOf('if (secuencias === null) {'), 'el gancho va ANTES de los return');
  // `vioVacio`: visto con la lista vacía → el primer lienzo (sin creando ni galería) lo reabre UNA vez.
  assert.match(app, /const conLienzo = visibles !== null && visibles\.length > 0 && creando === null && !galeria;/);
  assert.match(app, /if \(recorrido\.abierto && vacia\) vioVacio\.current = true;/);
  assert.match(app, /if \(!vioVacio\.current \|\| !conLienzo \|\| recorridoAbierto\) return;\n\s+vioVacio\.current = false;\n\s+setSoloLienzo\(true\);\n\s+reabrirRecorrido\(\);/);
  assert.match(app, /pasos=\{soloLienzo \? PASOS_DEL_LIENZO : undefined\}/);
  // «Omitir» con la lista vacía es «no lo quiero ver»: el primer lienzo no lo reabre.
  assert.match(app, /onCerrar=\{\(motivo\) => \{ if \(motivo === 'omitido'\) vioVacio\.current = false; setSoloLienzo\(false\); recorrido\.onCerrar\(motivo\); \}\}/);
  // Los pasos del lienzo: desde el CRON hasta el menú, en el mismo orden (no se inventa ninguno).
  assert.equal(PASOS_DEL_LIENZO[0].objetivo, 'au-cron');
  assert.equal(PASOS_DEL_LIENZO.at(-1)!.objetivo, OBJETIVO_AYUDA);
  assert.deepEqual(PASOS_DEL_LIENZO, PASOS_AUTOMATIONS.slice(PASOS_AUTOMATIONS.length - PASOS_DEL_LIENZO.length));
  assert.ok(!PASOS_DEL_LIENZO.some((p) => p.objetivo === 'au-lista' || p.objetivo === 'au-nueva'), 'repite lo que ya vio');
  // «＋ Nueva» se busca SÓLO en la lista: el cartel vacío de la tab se fue.
  assert.deepEqual(DONDE['au-nueva'].map((b) => b.vive), [['app/automations/SimuladorWhatsApp.tsx']]);
});

// ── 3. La lista y el lienzo con cero automatizaciones ────────────────────────────────────────────────────────

test('la lista se monta vacía: sin cartel, con «＋ Nueva», la cuadrícula y sin «Ninguna coincide»', () => {
  const app = APP();
  assert.doesNotMatch(app, /Todavía no hay automatizaciones/, 'volvió el cartel vacío');
  assert.match(app, /\{visibles !== null && !error && \(\s*<SimuladorWhatsApp/, 'la lista no se monta vacía');
  const html = dibujar([], { errorNueva: 'No se pudo crear' });
  assert.match(html, /<button type="button" class="chb-nueva"/, 'sin «＋ Nueva automatización»');
  assert.match(html, /role="alert"[^>]*>No se pudo crear</, 'el fallo de crear no se ve con la lista vacía');
  assert.match(html, /<div data-lienzo-vacio="true" style="[^"]*radial-gradient/, 'sin la cuadrícula vacía');
  assert.doesNotMatch(html, /Elige una automatización|Ninguna coincide/);
  assert.match(LISTA(), /\{lista\.length === 0 && \(q !== '' \|\| filtros\.length > 0\) && <div [^>]*>Ninguna coincide<\/div>\}/);
});

// ── 4. El aviso de Probar ────────────────────────────────────────────────────────────────────────────────────

test('onEnviado sin el gate del recorrido; la píldora del hilo, con el gate', () => {
  const panel = PANEL();
  const mandar = panel.slice(panel.indexOf('const mandarReal = ('), panel.indexOf('const mostrarParte = ('));
  assert.ok(mandar.length > 200 && mandar.length < 3000, `no encontré mandarReal (${mandar.length})`);
  assert.match(mandar, /\} else if \(primero\) \{\n\s+const texto = CANALES_PROBAR\[c\.canal\]\.enviado;\n\s+onEnviado\?\.\(texto\);\n\s+if \(run\.current === r0\) sistema\(texto, 'ok', true\);\n\s+\}/);
  assert.doesNotMatch(mandar, /primero && run\.current === r0/, 'el aviso volvió a depender de que la prueba siga viva');
  assert.match(panel, /onEnviado\?: \(texto: string\) => void;/);
});

test('el <Toast> vive en la lista, fuera de la capa de Probar, y no en PanelProbar', () => {
  assert.doesNotMatch(PANEL(), /useToast|<Toast/, 'PanelProbar volvió a dibujar su toast');
  const lista = LISTA();
  assert.match(lista, /const \{ toast: avisoEnviado, show: mostrarAviso, clear: cerrarAviso \} = useToast\(\);/);
  assert.equal((lista.match(/<Toast /g) ?? []).length, 1);
  const capa = lista.indexOf('<div data-muelle="probar"');
  const pasa = lista.indexOf("onEnviado={(t) => mostrarAviso(t, undefined, 'good')}");
  const toast = lista.indexOf('<Toast state={avisoEnviado} onClose={cerrarAviso} />');
  assert.ok(capa > 0 && pasa > capa, 'el panel no avisa a la lista');
  // Entre el panel y el toast se CIERRA la capa (z 3): `</div>` y el `)}` de `probarVisible && …`. (El `{}` es el
  // comentario JSX que `sinComentarios` vacía.)
  assert.match(lista.slice(pasa, toast), /^[^\n]*\n\s+\/>\n\s+<\/div>\n\s+\)\}\s*(\{\}\s*)?$/, 'el toast quedó adentro de la capa de Probar');
});

// ── 5. El aviso rojo de la línea ─────────────────────────────────────────────────────────────────────────────

test('el aviso rojo abre ConectarMedio, sin salir a /whatsapp', () => {
  const app = APP();
  assert.doesNotMatch(app, /href="\/whatsapp"|import Link/, 'volvió el link a /whatsapp');
  assert.match(app, /import \{ ConectarMedio \} from '\.\/ConectarMedio';/);
  assert.match(app, /<button type="button" onClick=\{\(\) => setConectarWa\(true\)\}/);
  assert.match(app, /\{conectarWa && \(\n\s+<ConectarMedio medio="whatsapp" onCerrar=\{\(\) => setConectarWa\(false\)\}/);
});
