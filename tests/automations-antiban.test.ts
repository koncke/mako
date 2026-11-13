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
// 23/10/2026 (Martín): «elimina "Misma persona"» y «en Email también pon goteo y tope por día... que el botón de "on-off" esté
// al lado de donde se configuran el resto de cosas no es muy intuitivo». Hoy quedan Goteo y Tope por día en WhatsApp y en
// Email, cada fila como en Ajustes de iOS (el interruptor en la fila del nombre, el número debajo sólo prendida). «Misma
// persona» ya no existe en ninguna parte. Los topes de la LÍNEA no se apagan.
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
import { configParaGuardar, sanearConfigAutomatizacion, tieneConfigPropia } from '../lib/config-automatizacion';
import { FilaOpcion, GrupoOpciones, Unidad, Info } from '../app/automations/FilasOpciones';
import { FILAS_LINEA } from '../lib/limites-envio';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `falta «${desde}»`);
  return src.slice(i, src.indexOf(hasta, i + desde.length));
};

// ── 2. «Misma persona» se fue (23/10/2026) ─────────────────────────────────────────────────────────

// Antes (22/10/2026) «Misma persona» apagado = 0 h (`PERSONA_SIN_ESPERA`), guardado como propio. Martín (23/10/2026): «elimina
// "Misma persona"». Se fue de la pantalla, de la API de MaKo y del motor; lo guardado en `personaHoras` se ignora al leer.
test('«Misma persona» ya no existe: no se guarda, lo guardado se ignora al leer, y la API de MaKo no la ofrece', () => {
  // Pedir guardarla (con horas, apagada o con null) da error: un escritor viejo se entera en vez de creer que quedó.
  for (const v of [{ whatsapp: 0, email: 0 }, { whatsapp: 20 }, null]) {
    const r = configParaGuardar({}, { personaHoras: v });
    assert.equal(r.ok, false, `guardar personaHoras ${JSON.stringify(v)} tendría que dar error`);
    assert.match(!r.ok ? r.error : '', /«Misma persona» ya no existe/);
  }
  // Lo guardado antes (19 activas la tenían prendida, medido el 23/10) se ignora, y no cuenta como «algo propio».
  assert.deepEqual(sanearConfigAutomatizacion('{"personaHoras":{"whatsapp":0,"email":0}}'), {});
  assert.deepEqual(sanearConfigAutomatizacion('{"personaHoras":{"whatsapp":20},"goteo":{"minutos":5}}'), { goteo: { minutos: 5 } });
  assert.equal(tieneConfigPropia({ personaHoras: { whatsapp: 0 } } as never), false, 'una clave vieja dejaba la configuración «con algo propio»');
  // La API de MaKo ya no tiene sus tres parámetros, ni dice «horas_a_la_misma_persona» al leer.
  const def = fuente('lib/api-mako/areas/chatbot.def.ts');
  for (const viejo of ['horasWhatsapp', 'horasEmail', 'personaNegocio']) assert.doesNotMatch(def, new RegExp(viejo), `la API volvió a ofrecer ${viejo}`);
  assert.doesNotMatch(fuente('lib/api-mako/areas/chatbot.run.ts'), /horas_a_la_misma_persona|PERSONA_SIN_ESPERA|personaHorasDeLaAutomatizacion|nacerConfigAutomatizacion/);
  // El motor no lee ninguna hora de «Misma persona» (el detalle, en tests/automations-misma-persona-pasos.test.ts).
  assert.doesNotMatch(fuente('lib/nutricion.ts'), /personaHoras|personaHorasDeLaAutomatizacion/);
});

// ── 2. Cada fila con su interruptor en la fila y el número DEBAJO, sólo prendida; sin «Quitar» ──────

test('el anti-ban de la automatización: goteo y tope por día UNA vez, para todos los canales, con su interruptor y sin «Quitar»', () => {
  const p = fuente('app/automations/ConfigAutomatizacionPanel.tsx');
  // 23/10/2026: un hook (`useAntibanDeLaAutomatizacion`) con las filas; desde el 24/10 (f21), las de UN bloque para todos.
  const a = tramo(p, 'export function useAntibanDeLaAutomatizacion(', '\n}\n');
  // Las dos filas: Goteo y Tope por día (24/10/2026, Martín: «un solo interruptor de goteo (y uno de tope por día)»).
  assert.match(a, /filas: d \? \[\s*filaGoteo\('minutos', 'Goteo', 'el goteo', 'Uno cada', 'min',[\s\S]*filaGoteo\('dia', 'Tope por día', 'el tope por día', 'Hasta', 'por día',[\s\S]*\] : \[\],/);
  // Apagar SACA el campo; prender arranca con el número sugerido. El número va DEBAJO y sólo con la opción prendida.
  const g = tramo(a, 'const filaGoteo = ', '\n  };');
  assert.match(g, /const on = v !== undefined;/);
  assert.match(g, /onCambio=\{\(x\) => guardar\(\{ \[campo\]: x \? sugerido : null \}\)\}/);
  assert.match(g, /debajo=\{on \? \(/);
  // Desde el ticket #93 (13/11/2026) con los rangos de la cuenta del negocio (`rangosGoteo`), que trae la lectura.
  assert.match(g, /<Numero valor=\{v\} min=\{rangos\[campo\]\[0\]\} max=\{rangos\[campo\]\[1\]\}/);
  assert.match(g, /\) : undefined\} \/>/, 'apagada tiene que quedar sin número debajo');
  assert.doesNotMatch(g, /apagado=\{!on\}|apagada=\{!on\}/, 'el número apagado ya no se dibuja gris: no se dibuja');
  // Con el interruptor de la casa (el de «Horario de oficina» y «Activar»), uno solo: lo comparten las dos filas.
  assert.equal((a.match(/interruptor=\{<Interruptor on=\{on\}/g) ?? []).length, 1, 'filaGoteo es la única fila, con el interruptor de la casa');
  for (const viejo of [/>\s*Quitar\s*</, /Poner \{/, /Como el negocio/, /GoteoDeLaAutomatizacion|PersonaDeLaAutomatizacion/, /filaPersona|filaVistaPrevia|PERSONA_SIN_ESPERA|personaNegocio/]) assert.doesNotMatch(p, viejo, `volvió ${viejo}`);
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
      createElement('input', { value: '5', readOnly: true }), createElement(Unidad, { apagada: true, children: 'min' })),
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
  // 23/10/2026 («"propio" se dice "Horario de oficina"»): el horario ES el panel «Horario de oficina», sin «Horario propio».
  assert.match(tramo(auto, 'export function HorarioDeLaAutomatizacion(', '\n}\n'), /return <HorarioEnvioPanel fuente=\{fuente\} onSucio=\{onSucio\} \/>;/);
  assert.doesNotMatch(auto, /Horario propio/, 'volvió «Horario propio»');
  // La línea (23/10/2026, «nada para todas»): ni sus filas ni su uso en la pantalla. «Primero lo que entra», que sigue
  // frenando por dentro, va en el ⓘ del bloque (`info`, desde el 24/10 el de «Todos los canales»), no como línea suelta.
  const lim = fuente('app/automations/LimitesEnvioPanel.tsx');
  assert.doesNotMatch(lim, /data-uso|data-prioridad|title=\{f\.ayuda\}|<FilaOpcion|useLimitesDeLaLinea/, 'volvieron los topes de la línea');
  assert.match(auto, /<GrupoOpciones titulo="Todos los canales" info=\{auto\.info\} primero \/>/);
  // El huso de la tuerca: en el ⓘ de «Horario de oficina», no como línea.
  const hor = fuente('app/configuraciones/HorarioEnvioPanel.tsx');
  assert.doesNotMatch(hor, /data-zona-del-negocio/);
  // 23/10/2026: el huso va en la fila de las horas, editable, con la línea de que es del negocio (tests/automations-config-revision.test.ts).
  assert.match(hor, /\{fuente\.zonaDelNegocio && h\.activo && \(/);
});

// ── El modal: UNA pantalla, sin pestañas (23/10/2026) ─────────────────────────────────────────────

test('el modal: una sola pantalla sin pestañas ni nombre de pestaña, «Horario de oficina» y «Todos los canales»', () => {
  const src = fuente('app/automations/ConfiguracionesBoton.tsx');
  assert.doesNotMatch(src, /<Tabs |PESTANAS_CONFIGURACIONES|Anti-ban|'Límites'/, 'volvieron las pestañas');
  const modal = tramo(src, '<Modal titulo="Configuraciones"', '</Modal>');
  assert.doesNotMatch(modal, /\{nombre\}/, 'volvió el subtítulo con el nombre');
  assert.match(modal, /<div data-config-automatizacion=\{secuenciaId\} style=\{\{ paddingTop: 0 \}\}>\s*<AjustesDeLaAutomatizacion secuenciaId=\{secuenciaId\} onSucioHorario=\{alSucioHorario\} onSucioAntiban=\{alSucioAntiban\} \/>\s*<\/div>/);
  assert.match(src, /const ocupado = sucios\.horario \|\| sucios\.antiban;/, 'un guardado en vuelo deja cerrar el modal');
  // La pantalla: el horario y UN bloque para todos los canales (24/10/2026, f21), con lo de ESTA automatización y nada más.
  const aj = tramo(fuente('app/automations/ConfigAutomatizacionPanel.tsx'), 'export function AjustesDeLaAutomatizacion(', '\n}\n');
  assert.match(aj, /<HorarioDeLaAutomatizacion secuenciaId=\{secuenciaId\} onSucio=\{onSucioHorario\} \/>/);
  assert.match(aj, /<GrupoOpciones titulo="Todos los canales" [^\n]*\/>\s*\{auto\.filas\}\s*<\/TarjetaOpciones>/);
  assert.doesNotMatch(aj, /titulo="WhatsApp"|titulo="Email"|titulo="Instagram"/, 'volvió un bloque por canal: Martín pidió uno solo');
  assert.doesNotMatch(aj, /linea\.|MaKo contesta sola|data-restaurar/, 'volvió lo «para todas»');
});

test('«Misma persona» no está en la pantalla ni en la línea; «Restaurar» y los topes de la línea tampoco', () => {
  assert.ok(!FILAS_LINEA.some((f) => f.campo === 'personaHoras'), 'volvió la «Misma persona, por defecto» de la línea');
  assert.deepEqual(FILAS_LINEA.map((f) => `${f.grupo}.${f.campo}:${f.rotulo}`), ['wa.dia:Línea por día', 'wa.hora:Línea por hora', 'email.dia:Línea por día', 'mako.solasPor24h:Por persona', 'mako.diasCharla:Charla abierta']);
  // 23/10/2026: sin «Restaurar» (era de la línea, que ya no está en la pantalla) y sin «Misma persona» (Martín: «elimínala»).
  const panel = fuente('app/automations/ConfigAutomatizacionPanel.tsx');
  assert.doesNotMatch(panel, /Restaurar|Línea por día|Línea por hora/);
  assert.doesNotMatch(panel, /Misma persona/, 'volvió «Misma persona» a la pantalla de Configuraciones');
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
