// =============================================================================
// «PROBAR»: CADA CASO ES UNA PERSONA FALSA, CON SU NOMBRE, SU FOTO Y SUS DATOS (23/10/2026)
// =============================================================================
// Martín, textual: «En Automations, en la parte de "Probar" el título de los "casos" debería ser el nombre de la persona
// falsa, NOMBRE Y APELLIDO, y que dentro en la prueba salga con ese nombre o con los datos falsos de ese perfil. Como
// tenemos varias fotos de perfil puedes crear varios datos falsos que se podrían utilizar en {{}}... En algún lugar debe
// decir Caso 1... Tal vez en el subtítulo.»
//
// Lo que se fija:
//   · el catálogo (lib/prueba-personas.ts): nombre, apellido y foto de cada una; las fotos son las de siempre; emails
//     de dominio de ejemplo, teléfonos del rango falso, sin repetidos;
//   · los datos: las claves EXACTAS del catálogo del «{ }» y los mismos cortes de nombre que el motor;
//   · la barra: el título es la persona, «Caso N» el subtítulo, con la foto de esa persona (columna y fila);
//   · el encabezado del caso en el chat: persona de título, «Caso N» de subtítulo y su foto;
//   · la prueba: los mensajes salen con los datos de ESA persona, y sin persona (un solo camino, el email) con el lead
//     de ejemplo de siempre.
//
// ⚠️ PROBADO ROMPIENDO (23/10/2026; base 7 pass / 0 fail, 15 roturas, todas atajadas): el resultado MEDIDO de cada
// rotura está al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PERSONAS_PRUEBA, FOTOS_PRUEBA, personaDelCaso, datosDePersona, nombreCompletoDe, urlDeFoto,
} from '../lib/prueba-personas';
import { VARIABLES_AVISO } from '../lib/variables-aviso';
import { valoresVariablesLead } from '../lib/template-vars';
import { textoDeEjemplo, correoDeEjemplo, TOPE_ESCENARIOS } from '../lib/simulador-grafo';
import { BarraEscenarios, tituloDelCaso, nombreDelCaso, fotoDelCaso, datosDelChipDelCaso, datosDeLaPrueba } from '../app/automations/PanelProbar';
import { ChipDelCaso } from '../app/automations/ChipDelCaso';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PANEL = leer('app/automations/PanelProbar.tsx');

/** Las 12 fotos que `PanelProbar` ya dibujaba el 22/10/2026, antes de que tuvieran dueño: ninguna se agregó ni se cambió. */
const FOTOS_DE_SIEMPRE = ['women/44', 'men/32', 'women/68', 'men/75', 'women/12', 'men/46', 'women/90', 'men/11', 'women/33', 'men/52', 'women/26', 'men/86'];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escenarios = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, pasos: [], cuando: ['Agendó'], mensajes: 1, elecciones: {} })) as never[];
const props = (n: number) => ({ escenarios: escenarios(n), elegido: 'e1', previas: {}, canal: 'whatsapp' as const, onElegir: () => {} });

// rotura 1 (una persona sin apellido): 4 pass / 3 fail, cae éste (y los de los datos).
// rotura 2 (el email de una persona en otro dominio): 5 pass / 2 fail, cae éste.
// rotura 3 (dos personas con la misma foto): 6 pass / 1 fail, cae éste.
test('el catálogo: una persona por foto de siempre, con nombre y apellido, y todo de ejemplo', () => {
  assert.deepEqual([...FOTOS_PRUEBA], FOTOS_DE_SIEMPRE, 'no se inventan fotos nuevas ni se reordenan las de siempre');
  assert.deepEqual(PERSONAS_PRUEBA.map((p) => p.foto), FOTOS_DE_SIEMPRE, 'cada foto tiene SU persona, en el orden de la barra');
  assert.ok(PERSONAS_PRUEBA.length >= TOPE_ESCENARIOS, 'alcanza para todos los casos de una prueba');
  for (const p of PERSONAS_PRUEBA) {
    assert.match(p.nombre, /^\p{L}+$/u, `${p.id}: un solo nombre de pila`);
    assert.match(p.apellido, /^\p{L}+$/u, `${p.id}: un solo apellido, con letras`);
    assert.ok(p.empresa.trim().length > 3, `${p.id}: empresa`);
    assert.match(p.email, /^[a-z]+\.[a-z]+@ejemplo\.com$/, `${p.id}: email de dominio de ejemplo y sin tildes`);
    assert.match(p.telefono, /^\+52 1 55 5555 01\d\d$/, `${p.id}: teléfono del rango falso`);
    assert.match(p.web, /^[a-z]+\.ejemplo\.com$/, `${p.id}: web de ejemplo`);
  }
  for (const campo of ['id', 'foto', 'email', 'telefono', 'web', 'empresa'] as const) {
    assert.equal(new Set(PERSONAS_PRUEBA.map((p) => p[campo])).size, PERSONAS_PRUEBA.length, `${campo}: sin repetidos`);
  }
  assert.equal(new Set(PERSONAS_PRUEBA.map(nombreCompletoDe)).size, PERSONAS_PRUEBA.length, 'ni un nombre y apellido repetido');
});

test('el caso k es la persona k, siempre la misma, y da la vuelta si faltaran', () => {
  assert.equal(personaDelCaso(0).foto, 'women/44');
  assert.equal(personaDelCaso(1).foto, 'men/32');
  assert.equal(personaDelCaso(PERSONAS_PRUEBA.length).id, personaDelCaso(0).id);
  assert.equal(fotoDelCaso(2), urlDeFoto('women/68'));
  assert.match(fotoDelCaso(0), /^https:\/\/randomuser\.me\/api\/portraits\/(women|men)\/\d+\.jpg$/);
});

// rotura 4 (`datosDePersona` sin el email): 5 pass / 2 fail, cae éste.
// rotura 5 (`nombre` con el nombre completo, no el de pila): 5 pass / 2 fail, cae éste.
test('los datos: las claves EXACTAS del catálogo del «{ }» y el mismo corte de nombre que el motor', () => {
  const claves = new Set(VARIABLES_AVISO.map((v) => v.key));
  for (const p of PERSONAS_PRUEBA) {
    const d = datosDePersona(p);
    for (const k of Object.keys(d)) assert.ok(claves.has(k), `«${k}» no existe en el catálogo del «{ }»`);
    for (const k of ['nombre', 'apellido', 'nombre_completo', 'empresa', 'lead_email', 'lead_telefono', 'lead_web']) assert.ok(d[k], `${p.id}: falta ${k}`);
    assert.deepEqual(
      { nombre: d.nombre, apellido: d.apellido, nombre_completo: d.nombre_completo, empresa: d.empresa, segundo_nombre: d.segundo_nombre, tercer_nombre: d.tercer_nombre },
      valoresVariablesLead({ nombre: `${p.nombre} ${p.apellido}`, empresa: p.empresa }),
    );
    assert.equal(d.nombre, p.nombre);
    assert.equal(d.apellido, p.apellido);
    assert.equal(d.lead_nombre, d.nombre_completo);
    assert.equal(d.lead_email, p.email);
    assert.equal(d.optin_quien, d.nombre_completo, 'quien «dejó sus datos» es esta misma persona');
    assert.equal(d.optin_email, p.email);
  }
});

// rotura 6 (el título de la columna vuelve a ser «Caso N»): 6 pass / 1 fail, cae éste.
// rotura 7 (se pierde el subtítulo «Caso N» de la columna): 6 pass / 1 fail, cae éste.
// rotura 8 (la foto de la fila es siempre la del caso 1): 6 pass / 1 fail, cae éste.
test('la barra: el título es la persona, «Caso N» el subtítulo, y su foto, en la columna y en la fila', () => {
  const col = renderToStaticMarkup(createElement(BarraEscenarios, props(3)));
  const fila = renderToStaticMarkup(createElement(BarraEscenarios, { ...props(3), fila: true }));
  for (const [html, modo] of [[col, 'columna'], [fila, 'fila']] as const) {
    for (let k = 0; k < 3; k++) {
      const nombre = nombreCompletoDe(PERSONAS_PRUEBA[k]);
      assert.equal(tituloDelCaso(k), nombre);
      assert.match(html, new RegExp(`>${esc(nombre)}<`), `${modo}: el título del caso ${k + 1} es ${nombre}`);
      assert.match(html, new RegExp(`data-caso-numero[^>]*>Caso ${k + 1}<`), `${modo}: el subtítulo «Caso ${k + 1}»`);
      assert.ok(html.includes(`src="${urlDeFoto(PERSONAS_PRUEBA[k].foto)}"`), `${modo}: la foto de ${nombre}`);
      // El título va ANTES que el «Caso N» de su contacto (es el título; el otro, el subtítulo).
      assert.ok(html.indexOf(`>${nombre}<`) < html.indexOf(`>Caso ${k + 1}<`), `${modo}: el nombre antes que el «Caso ${k + 1}»`);
    }
  }
  assert.equal(nombreDelCaso(0), 'Caso 1');
});

// rotura 9 (el encabezado sin subtítulo): 6 pass / 1 fail, cae éste.
test('el encabezado del caso en el chat: la persona de título, «Caso N» de subtítulo y su foto', () => {
  const datos = datosDelChipDelCaso(1, ['Agendó'], 'Pregunta el precio');
  assert.deepEqual(datos, { titulo: 'Mateo Salazar', subtitulo: 'Caso 2', foto: urlDeFoto('men/32'), hechos: ['Agendó'], contesta: 'Pregunta el precio' });
  const html = renderToStaticMarkup(createElement(ChipDelCaso, { caso: datos }));
  assert.match(html, /data-chip-titulo[^>]*>Mateo Salazar</);
  assert.match(html, /data-chip-subtitulo[^>]*>Caso 2</);
  assert.ok(html.includes(`src="${urlDeFoto('men/32')}"`));
  assert.match(html, />Agendó</);
  assert.match(html, /data-chip-contesta[^>]*>💬 Contesta: Pregunta el precio</);
  // Un caso sin subtítulo (lo de antes) se sigue dibujando como siempre.
  assert.doesNotMatch(renderToStaticMarkup(createElement(ChipDelCaso, { caso: { titulo: 'Caso 5', hechos: ['x'] } })), /data-chip-titulo|data-chip-foto/);
});

// rotura 10 (los datos de la persona no se suman): 6 pass / 1 fail, cae éste.
// rotura 11 (al sumar la persona se pierden los del recordatorio o el evento): 6 pass / 1 fail, cae éste.
// rotura 15 (el HTML del email sin los datos de la persona, `simulador-grafo.ts`): 6 pass / 1 fail, cae éste.
test('la prueba: los mensajes salen con los datos de ESA persona; sin persona, como siempre', () => {
  const texto = 'Hola {{nombre}} {{apellido}} ({{nombre_completo}}) de {{empresa}}: {{lead_email}} · {{lead_telefono}} · {{lead_web}}';
  for (const k of [0, 1, 2, 7]) {
    const p = personaDelCaso(k);
    const salio = textoDeEjemplo(texto, 'Acme', datosDeLaPrueba(p));
    assert.equal(salio, `Hola ${p.nombre} ${p.apellido} (${p.nombre} ${p.apellido}) de ${p.empresa}: ${p.email} · ${p.telefono} · ${p.web}`);
  }
  assert.notEqual(textoDeEjemplo(texto, 'Acme', datosDeLaPrueba(personaDelCaso(0))), textoDeEjemplo(texto, 'Acme', datosDeLaPrueba(personaDelCaso(1))), 'cada caso, lo suyo');
  // Sin persona: lo que ya salía (el lead de ejemplo del catálogo).
  assert.equal(datosDeLaPrueba(null), undefined);
  assert.equal(textoDeEjemplo(texto, 'Acme', datosDeLaPrueba(null)), textoDeEjemplo(texto, 'Acme'));
  assert.match(textoDeEjemplo('{{nombre_completo}}', 'Acme', datosDeLaPrueba(null)), /^Luis Pérez$/);
  // Lo que no es del lead (el recordatorio, un evento) sigue llegando.
  const extra = { reunion_cuando: 'pasado mañana a las 9' };  // distinto del ejemplo del catálogo: si se pierde, se nota
  assert.equal(datosDeLaPrueba(null, extra), extra);
  assert.equal(textoDeEjemplo('{{nombre}}: {{reunion_cuando}}', 'Acme', datosDeLaPrueba(personaDelCaso(3), extra)), 'Santiago: pasado mañana a las 9');
  // El email del flujo también sale con la persona (asunto, cuerpo y HTML).
  const correo = correoDeEjemplo({ asunto: 'Para {{nombre_completo}}', cuerpo: '{{lead_email}}', cuerpo_html: '<p>{{empresa}}</p>' }, 'Acme', datosDeLaPrueba(personaDelCaso(2)));
  assert.equal(correo.asunto, 'Para Camila Ortega');
  assert.equal(correo.cuerpo, 'camila.ortega@ejemplo.com');
  assert.match(correo.html, /Ortega Contadores/);
  assert.equal(correoDeEjemplo({ asunto: 'Para {{nombre_completo}}' }, 'Acme').asunto, 'Para Luis Pérez');
});

// rotura 12 (un `textoDeEjemplo` del panel que sigue con los datos viejos): 6 pass / 1 fail, cae éste.
// rotura 13 (la persona también en una prueba sin lista de casos): 6 pass / 1 fail, cae éste.
// rotura 14 (la persona del caso que SE VE y no la del que corre): 6 pass / 1 fail, cae éste.
test('el panel: todo lo que sale usa la persona del caso que corre, y sólo con la lista de contactos', () => {
  // Ningún mensaje se resuelve con los datos pelados del recordatorio: todos pasan por `datosDelMomento`.
  assert.doesNotMatch(PANEL, /(textoDeEjemplo|correoDeEjemplo)\([^)]*c\.datosExtra/);
  assert.equal(PANEL.match(/textoDeEjemplo\([^;]*datosDelMomento\(\)\)/g)?.length, 4, 'los cuatro textos: caption, texto, MaKo-adaptado y lo del grupo');
  assert.match(PANEL, /correoDeEjemplo\(p, c\.negocio, datosDelMomento\(\)\)/);
  assert.match(PANEL, /const personaDelMomento = \(\): PersonaPrueba \| null => \{\n\s+if \(!conBarra\) return null;\n\s+const k = escenarios\.findIndex\(\(e\) => e\.id === escRef\.current\?\.id\);\n\s+return k >= 0 \? personaDelCaso\(k\) : null;\n\s+\};/);
  assert.match(PANEL, /const datosDelMomento = \(\) => datosDeLaPrueba\(personaDelMomento\(\), ctx\.current\.datosExtra\);/);
  // El encabezado del caso y la barra dicen el nombre de la persona.
  assert.match(PANEL, /caso: datosDelChipDelCaso\(k, caso\.cuando, contesta\)/);
  assert.match(PANEL, /\{tituloDelCaso\(k\)\}<\/span>/);
});
