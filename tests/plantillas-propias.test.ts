// =============================================================================
// Plantillas propias: una PÚBLICA nunca lleva datos del negocio de quien la comparte (6/11/2026)
// =============================================================================
// lib/plantillas-propias-reglas.ts: `limpiarTextos` (la capa 1) y `fugasDe` (la capa 2, la red que frena al server). Se
// prueba con CENTINELAS: datos inventados de un negocio que comparte (su nombre, su gente, su email, su teléfono, su link, su
// @ y su precio), metidos en una definición con la forma de cada tab, que NO pueden aparecer en lo que se publica.
//
// Probado rompiéndolo (base: 9 verdes, 0 rojos; 6/11/2026):
//   · sin la línea de RE_EMAIL en `sinDatosDelNegocio` → 6/3 (el centinela, la marca y «una pública no tiene fugas»);
//   · sin el bucle de las personas → 6/3;
//   · `fugasDe` devolviendo siempre [] → 8/1 («la red ve lo que la capa 1 no limpió»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATO, fugasDe, limpiarTextos, sinDatosDelNegocio, type NegocioQueComparte } from '../lib/plantillas-propias-reglas';

// Un negocio INVENTADO (no es del elenco ni de la lista REALES): sus datos son los centinelas.
const NEGOCIO: NegocioQueComparte = { nombres: ['Estudio Brújula Norte'], personas: ['Renata Villaseñor', 'Octavio Puga'] };
const CENTINELAS = [
  'Brújula Norte', 'Renata', 'Villaseñor', 'Octavio', 'renata@brujulanorte.mx', '+52 33 1234 5678', 'brujulanorte.mx',
  'https://agenda.brujulanorte.mx/llamada', '@brujula.norte', 'USD 2,750', '3,900 pesos',
] as const;

/** Lo que trae una plantilla de verdad: un guion del Copywriter, una capa de Image, una oferta. */
const DEFINICION = {
  tipo: 'doc',
  content: [
    { tipo: 'titulo', texto: 'GANCHO' },
    { tipo: 'p', texto: 'Hola, soy Renata Villaseñor, de Estudio Brújula Norte. ¿Tu equipo cierra 2 de cada 10 llamadas?' },
    { tipo: 'p', texto: 'Agenda en https://agenda.brujulanorte.mx/llamada o escríbeme a renata@brujulanorte.mx.' },
    { tipo: 'p', texto: 'WhatsApp: +52 33 1234 5678 · Instagram @brujula.norte · brujulanorte.mx' },
    { tipo: 'p', texto: 'El programa cuesta USD 2,750 o 3,900 pesos al mes. Octavio te cuenta el resto.' },
  ],
  capas: [{ nombre: 'Titular', texto: 'ESTUDIO BRUJULA NORTE', x: 120, y: 80 }],
  duracion: 45,
};

const negocio = () => NEGOCIO;

test('la capa 1 saca cada centinela de una definición pública', () => {
  const limpio = JSON.stringify(limpiarTextos(DEFINICION, negocio()));
  for (const c of CENTINELAS) assert.ok(!limpio.toLowerCase().includes(c.toLowerCase()), `quedó «${c}» en lo público`);
});

test('la capa 1 deja la FORMA: las claves, los números y lo que no es del negocio', () => {
  const limpio = limpiarTextos(DEFINICION, negocio());
  assert.equal(limpio.duracion, 45);
  assert.equal(limpio.capas[0].x, 120);
  assert.equal(limpio.content[0].texto, 'GANCHO');
  assert.match(limpio.content[1].texto, /¿Tu equipo cierra 2 de cada 10 llamadas\?/);
});

test('cada dato se reemplaza por su marca, para saber qué completar', () => {
  const t = sinDatosDelNegocio('Soy Renata Villaseñor de Estudio Brújula Norte, escríbeme a renata@brujulanorte.mx', negocio());
  assert.equal(t, `Soy ${DATO.persona} de ${DATO.negocio}, escríbeme a ${DATO.email}`);
});

test('el nombre se encuentra sin importar mayúsculas ni tildes', () => {
  assert.equal(sinDatosDelNegocio('ESTUDIO BRUJULA NORTE', negocio()), DATO.negocio);
  assert.equal(sinDatosDelNegocio('estudio brújula   norte', negocio()), DATO.negocio);
});

test('no se come lo que se parece y no es: años, cifras sin moneda, una palabra que contiene el nombre', () => {
  assert.equal(sinDatosDelNegocio('Cohortes 2024-2025', negocio()), 'Cohortes 2024-2025');
  assert.equal(sinDatosDelNegocio('Empieza el 2026-11-06 o el 06/11/2026', negocio()), 'Empieza el 2026-11-06 o el 06/11/2026');
  assert.equal(sinDatosDelNegocio('52 alumnas en 4 cohortes', negocio()), '52 alumnas en 4 cohortes');
  // «Renatas» no es «Renata»: el borde es por letra.
  assert.equal(sinDatosDelNegocio('Renatas', negocio()), 'Renatas');
});

test('una pública limpia no tiene fugas', () => {
  assert.deepEqual(fugasDe(limpiarTextos(DEFINICION, negocio()), negocio()), []);
});

test('la red ve lo que la capa 1 no limpió (una tab que se olvida de un campo)', () => {
  const f = fugasDe(DEFINICION, negocio());
  for (const x of ['negocio', 'persona', 'email', 'telefono', 'link', 'usuario', 'precio'] as const) assert.ok(f.includes(x), `la red no vio ${x}`);
});

test('una privada no se limpia: el server guarda la definición tal cual (limpiar devuelve una copia)', () => {
  const antes = JSON.stringify(DEFINICION);
  limpiarTextos(DEFINICION, negocio());
  assert.equal(JSON.stringify(DEFINICION), antes);
});

test('el negocio se encuentra también como se lo nombra: sin «Estudio» adelante ni la forma legal atrás', () => {
  assert.equal(sinDatosDelNegocio('Anuncio de Brújula Norte', negocio()), `Anuncio de ${DATO.negocio}`);
  assert.equal(sinDatosDelNegocio('Pulso Dental S.A. de C.V. y Pulso Dental', { nombres: ['Pulso Dental S.A. de C.V.'], personas: [] }), `${DATO.negocio} y ${DATO.negocio}`);
  // Lo que queda corto y genérico no es el negocio: «Estudio Norte» no vuelve «Norte» un dato.
  assert.equal(sinDatosDelNegocio('Mira al norte', { nombres: ['Estudio Norte'], personas: [] }), 'Mira al norte');
});

test('un nombre de negocio corto no se lleva pedazos de palabras', () => {
  assert.equal(sinDatosDelNegocio('Al final del mes', { nombres: ['Al'], personas: [] }), 'Al final del mes');
});
