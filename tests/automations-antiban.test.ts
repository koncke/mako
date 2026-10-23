// =============================================================================
// Configuraciones › Anti-ban: cada opción con su interruptor, y sin texto suelto (22/10/2026)
// =============================================================================
// Martín, por el Cerebro, con captura del modal «Configuraciones» de #289, pestaña «Límites»:
//   1. «Límites» pasa a llamarse «Anti-ban».
//   2. «Cada opción se prende y se apaga con un interruptor on/off, igual que «Horario de oficina». El goteo (uno cada N
//      min), el tope por día y las horas entre mensajes a la misma persona por WhatsApp y por email. Apagada, no aplica, y
//      el número se ve gris. Chau los «Quitar».»
//   3. «Sacá el subtítulo «Sprint · apertura» y achicá el espacio entre el título «Configuraciones» y las pestañas.»
//   4. «en las opciones hay una cantidad aberrante de texto innecesario. Jamás jamás pongas todo eso... Elimina todo el
//      texto innecesario y diseñalo mejor»: cada fila, el nombre corto, el número con su unidad y el interruptor; lo que
//      necesita explicación, en un ⓘ. Lo mismo en «Horario» y en «De la línea, para todas tus automatizaciones».
//
// LA DECISIÓN DE «MISMA PERSONA» APAGADO: 0 h (`PERSONA_SIN_ESPERA`), guardado como propio. Ausente sigue siendo «la del
// negocio» (prendido, con su número): ninguna automatización que ya existía cambia. Los topes de la LÍNEA no se apagan.
//
// PROBADO ROMPIÉNDOLO: ver el pie.
//
// Correr: node --import tsx --test tests/automations-antiban.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { configParaGuardar, sanearConfigAutomatizacion, personaHorasDeLaAutomatizacion, tieneConfigPropia, PERSONA_SIN_ESPERA } from '../lib/config-automatizacion';
import { LIMITES_CONSTANTES } from '../lib/limites-envio';
import { FilaOpcion, GrupoOpciones, Unidad, Info } from '../app/automations/FilasOpciones';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `falta «${desde}»`);
  return src.slice(i, src.indexOf(hasta, i + desde.length));
};

// ── 2. «Misma persona» apagado = sin espera, sólo en esa automatización ─────────────────────────────

test('misma persona apagado: 0 h se guarda y se lee como propio; ausente sigue siendo el del negocio', () => {
  assert.equal(PERSONA_SIN_ESPERA, 0);
  const r = configParaGuardar({}, { personaHoras: { whatsapp: PERSONA_SIN_ESPERA, email: PERSONA_SIN_ESPERA } });
  assert.ok(r.ok, 'apagarla se rechazaba («van de 3 a 72»)');
  assert.deepEqual(r.ok && r.config.personaHoras, { whatsapp: 0, email: 0 });
  assert.ok(r.ok && !r.vacia && tieneConfigPropia(r.config), 'apagada quedaba como «la del negocio»: la clave se borraba');
  // Lo guardado vuelve igual (el motor lo lee con el saneo).
  assert.deepEqual(sanearConfigAutomatizacion(r.ok ? r.valor : ''), { personaHoras: { whatsapp: 0, email: 0 } }, 'el saneo tiraba el 0 y volvía la del negocio');
  // Y lo que mandan: 0 apagada; sin nada, la del negocio.
  assert.deepEqual(personaHorasDeLaAutomatizacion({ personaHoras: { whatsapp: 0 } }, LIMITES_CONSTANTES), { whatsapp: 0, email: LIMITES_CONSTANTES.email.personaHoras });
  assert.deepEqual(personaHorasDeLaAutomatizacion({}, LIMITES_CONSTANTES), { whatsapp: LIMITES_CONSTANTES.wa.personaHoras, email: LIMITES_CONSTANTES.email.personaHoras });
  // El rango de siempre para lo prendido: 1 y 2 h por WhatsApp siguen afuera (el mínimo es 3).
  for (const n of [1, 2, -1, 0.5]) assert.equal(configParaGuardar({}, { personaHoras: { whatsapp: n } }).ok, false, `${n} h se guardaba`);
  // `null` la vuelve a la del negocio (prenderla otra vez).
  const vuelta = configParaGuardar({ personaHoras: { whatsapp: 0 } }, { personaHoras: { whatsapp: null } });
  assert.ok(vuelta.ok && vuelta.vacia);
  // La API de MaKo lo apaga igual que la tuerca (`horasWhatsapp: 0`) y lo dice al leer («apagado»).
  const def = fuente('lib/api-mako/areas/chatbot.def.ts');
  assert.match(def, /\{ nombre: 'horasWhatsapp', tipo: 'number', entero: true, minimo: 0, maximo: 72,/, 'la API no puede apagarlo');
  assert.match(def, /\{ nombre: 'horasEmail', tipo: 'number', entero: true, minimo: 0, maximo: 168,/);
  assert.match(fuente('lib/api-mako/areas/chatbot.run.ts'), /h === undefined \? 'negocio' : h === PERSONA_SIN_ESPERA \? 'apagado' : 'propio'/);
  // El motor no necesita nada propio: con 0 h la ventana de «ya le escribimos» es vacía.
  const motor = fuente('lib/nutricion.ts');
  assert.match(motor, /const ventanaDe = \(secId: number\) => personaHorasDeLaAutomatizacion\(configsCorrida\.get\(secId\) \?\? \{\}, limites\);/);
  assert.match(motor, /const desde = haceHorasISO\(personaHoras\.whatsapp\);\n\s+const desdeEmail = haceHorasISO\(personaHoras\.email\);/);
});

// ── 2. Cada fila con su interruptor; apagada, el número gris; sin «Quitar» ──────────────────────────

test('el anti-ban de la automatización: goteo, por día y misma persona, cada uno con su interruptor y sin «Quitar»', () => {
  const p = fuente('app/automations/ConfigAutomatizacionPanel.tsx');
  const a = tramo(p, 'export function AntibanDeLaAutomatizacion(', '\n}\n');
  // Las cuatro filas, en dos grupos.
  assert.match(a, /<GrupoOpciones titulo="WhatsApp" primero \/>\s*\{filaGoteo\('minutos', 'Goteo', 'el goteo', 'min',[\s\S]*\{filaGoteo\('dia', 'Por día', 'el tope por día', 'mensajes',[\s\S]*\{filaPersona\('whatsapp', RANGOS_LIMITES\.wa\.personaHoras\)\}\s*<GrupoOpciones titulo="Email" \/>\s*\{filaPersona\('email', RANGOS_LIMITES\.email\.personaHoras\)\}/);
  // Goteo y tope: apagar SACA el campo; prender arranca con el número que se veía gris.
  const g = tramo(a, 'const filaGoteo = ', '\n  };');
  assert.match(g, /const on = v !== undefined;/);
  assert.match(g, /onCambio=\{\(x\) => guardar\('goteo', \{ \[campo\]: x \? sugerido : null \}\)\}/);
  assert.match(g, /<Numero valor=\{v \?\? sugerido\}[^\n]*apagado=\{!on\}/);
  assert.match(g, /<Unidad apagada=\{!on\}>\{unidad\}<\/Unidad>/);
  // Misma persona: apagar guarda 0 h; prender la vuelve a la del negocio; apagada, se ve el del negocio en gris.
  const m = tramo(a, 'const filaPersona = ', '\n  };');
  assert.match(m, /const on = propio !== PERSONA_SIN_ESPERA;/);
  assert.match(m, /onCambio=\{\(x\) => guardar\('personaHoras', \{ \[canal\]: x \? null : PERSONA_SIN_ESPERA \}\)\}/);
  assert.match(m, /const valor = propio !== undefined && propio !== PERSONA_SIN_ESPERA \? propio : d\.personaNegocio\[canal\];/);
  assert.match(m, /<Numero valor=\{valor\}[^\n]*apagado=\{!on\}/);
  // Los dos con el interruptor de la casa (el de «Horario de oficina» y «Activar»).
  assert.equal((a.match(/interruptor=\{<Interruptor on=\{on\}/g) ?? []).length, 2);
  for (const viejo of [/>\s*Quitar\s*</, /Poner \{/, /Como el negocio/, /GoteoDeLaAutomatizacion|PersonaDeLaAutomatizacion/]) assert.doesNotMatch(p, viejo, `volvió ${viejo}`);
});

test('el número apagado se ve gris y no se toca', () => {
  const lim = fuente('app/automations/LimitesEnvioPanel.tsx');
  const n = tramo(lim, 'export function Numero(', '\n}\n');
  assert.match(n, /const disabled = noEdita \|\| apagado;/, 'apagado se podía editar');
  assert.match(n, /background: apagado \? 'var\(--surface-2\)' : 'var\(--surface\)'/);
  assert.match(n, /color: apagado \? 'var\(--faint\)' : 'var\(--ink\)'/, 'apagado el número no se ve gris');
});

// ── 4. Sin texto suelto: cada fila es nombre, número, unidad e interruptor; lo demás, en el ⓘ ───────

test('las filas: nombre (con su ⓘ), número, unidad e interruptor; nada más', () => {
  const html = renderToStaticMarkup(createElement('div', null,
    createElement(GrupoOpciones, { titulo: 'WhatsApp', info: '24 h: 6 de 40', primero: true }),
    createElement(FilaOpcion, { nombre: 'Goteo', info: 'Sus WhatsApp salen de a uno.', interruptor: createElement('button', { role: 'switch' }) },
      createElement('input', { value: '5', readOnly: true }), createElement(Unidad, { apagada: true }, 'min')),
    createElement(FilaOpcion, { nombre: 'Por día', sinInterruptor: true }, createElement('input', { value: '40', readOnly: true }), createElement(Unidad, null, 'mensajes')),
  ));
  // El ⓘ es un botón (el teléfono lo toca y le da el foco, que abre el Tooltip) y dice su texto al lector de pantalla.
  assert.match(html, /<button type="button" data-info="" aria-label="Sus WhatsApp salen de a uno\."/);
  assert.match(html, /<button type="button" data-info="" aria-label="24 h: 6 de 40"/);
  // El texto del ⓘ NO está dibujado: sólo en el Tooltip.
  assert.equal(html.split('Sus WhatsApp salen de a uno.').length - 1, 1, 'la explicación se dibuja además del ⓘ');
  // La unidad apagada, más clara; la fila sin interruptor deja su hueco (el número queda en columna).
  assert.match(html, /color:var\(--faint\)">min<\/span>/);
  assert.equal((html.match(/data-fila-opcion=""/g) ?? []).length, 2);
  assert.equal((html.match(/width:46px/g) ?? []).length, 2, 'la fila sin interruptor no deja el hueco');
  assert.doesNotMatch(html, /<p[ >]/, 'una fila con un párrafo');
  // Info suelto, igual.
  assert.match(renderToStaticMarkup(createElement(Info, { texto: 'x' })), /aria-label="x"/);
});

test('sin descripciones: ni el goteo, ni la misma persona, ni el horario, ni la línea dibujan párrafos', () => {
  const auto = fuente('app/automations/ConfigAutomatizacionPanel.tsx');
  for (const viejo of [/Las horas que espera entre dos mensajes/, /prospectando en frío/, /textoDeGoteo/, /Goteo de sus WhatsApp/, /A la misma persona, en esta automatización/, /Sólo para esta automatización/])
    assert.doesNotMatch(auto, viejo, `volvió ${viejo}`);
  // «Horario propio»: una fila; lo del negocio, en su ⓘ.
  assert.match(auto, /<FilaOpcion primera nombre="Horario propio" info=\{`Apagado, usa el del negocio: \$\{textoDeHorario\(d\.horarioNegocio\)\}\.`\}/);
  // La línea: sin la línea de uso ni la de «Primero lo que entra» sueltas (van en el ⓘ del grupo), y sin `title` por fila.
  const lim = fuente('app/automations/LimitesEnvioPanel.tsx');
  assert.doesNotMatch(lim, /data-uso|data-prioridad|title=\{f\.ayuda\}/);
  assert.match(lim, /<GrupoOpciones titulo=\{b\.titulo\} info=\{infoDelGrupo\(b\.titulo, uso, l\)\} primero=\{i === 0\} \/>/);
  assert.match(lim, /<FilaOpcion key=\{clave\} nombre=\{f\.rotulo\} info=\{f\.info\} sinInterruptor /, 'los topes de la línea se apagan (o perdieron su columna)');
  // El huso de la tuerca: en el ⓘ de «Horario de oficina», no como línea.
  const hor = fuente('app/configuraciones/HorarioEnvioPanel.tsx');
  assert.doesNotMatch(hor, /data-zona-del-negocio/);
  assert.match(hor, /\{fuente\.zonaSoloLectura && <Info texto=/);
});

// ── 1 y 3. El modal: «Anti-ban», sin el subtítulo y sin el aire de arriba ─────────────────────────

test('el modal: la pestaña se llama «Anti-ban», sin el nombre de la automatización arriba y las pestañas pegadas al título', () => {
  const src = fuente('app/automations/ConfiguracionesBoton.tsx');
  assert.match(src, /\{ id: 'antiban', label: 'Anti-ban' \}/);
  assert.doesNotMatch(src, /label: 'Límites'/);
  const modal = tramo(src, '<Modal titulo="Configuraciones"', '</Modal>');
  assert.doesNotMatch(modal, /\{nombre\}/, 'volvió el subtítulo con el nombre');
  assert.match(modal, /<div data-config-automatizacion=\{secuenciaId\} style=\{\{ paddingTop: 0 \}\}>\s*<Tabs /, 'las pestañas no quedan pegadas al título');
  assert.match(modal, /<AntibanDeLaAutomatizacion secuenciaId=\{secuenciaId\} onSucio=\{alSucioAntiban\} \/>/);
  assert.match(modal, /\{TITULO_LIMITES_LINEA\}\s*<Info texto=\{INFO_LIMITES_LINEA\} \/>/);
  assert.match(src, /const ocupado = sucios\.horario \|\| sucios\.antiban \|\| sucios\.limites;/, 'un guardado del anti-ban en vuelo deja cerrar el modal');
});

// ── ROTURAS (22/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez, con el arnés romper.mjs del scratchpad (reemplaza un texto, corre este archivo, lo devuelve), base 6 / 0:
//   B1. apagar «misma persona» guarda `null` (= la del negocio) en vez de 0 h                → 5 / 1
//   B2. el saneo tira el 0 (`enRango` en vez de `enRangoPersona`)                            → 5 / 1
//   B3. vuelve «Quitar» al goteo                                                             → 5 / 1
//   B4. el número apagado con el color de siempre                                           → 5 / 1
//   B5. la pestaña vuelve a «Límites»                                                        → 5 / 1
//   B6. vuelve el nombre de la automatización arriba de las pestañas                         → 5 / 1
//   B7. la línea de «Primero lo que entra» vuelve a dibujarse suelta                          → 5 / 1
