// =============================================================================
// offer-plantillas — las 9 plantillas de «Nueva oferta» (lib/offer-plantillas.ts)
// =============================================================================
// Lo que fija (docs/plantillas-reales/offer.md, sección 5, tanda D):
//   · las 9, con sus ids PERMANENTES (viajan guardados en las conversaciones) y sus 5 grupos;
//   · ningún texto nombra a alguien real, ni va en voseo, ni trae regionalismos (`problemasDelEjemplo`);
//   · ningún ejemplo, chip ni insignia lleva «[completar]» ni «[DATO»;
//   · los programas de 90 días dicen la verdad: el formato empieza con «90 días» y sus semanas suman 13 (trampa 5:
//     `duracionEnDias` sólo lee el primer número, así que «8 semanas en vivo y 4 de práctica», 84 días, pasaba);
//   · el nivel que calcula el CÓDIGO con el precio del ejemplo (`nivelDeOferta`): alto, salvo la entrada y la
//     continuidad (bajo); en alto ticket, la duración entre 90 y 180 días salvo `producto`;
//   · `aplicarReglasPropuesta` no le agrega ningún aviso al ejemplo, y el diagnóstico de la 8 es el que calcula
//     `calcularDiagnostico`;
//   · `ejemploParaPrompt` queda debajo del tope y dice «ficticio».
//
// PROBADO ROMPIÉNDOLO (06/11/2026), contra una base de 9 pass / 0 fail:
//   · el mensaje corto de la plantilla 1 a «Si tenés llamadas, cierran sin presionar»: 8 pass / 1 fail (el de los
//     reales y el voseo: «programa-garantia: voseo: «tenés»»). Restaurado: 9 / 0.
//   · el formato de la 1 a «90 días: 8 semanas en vivo y 4 de práctica revisada»: 8 pass / 1 fail («las semanas
//     suman 12, no 13»). Restaurado: 9 / 0.
//   · el precio de la 9 a «USD 97 al mes; …» (la forma que `precioDe` no lee): 8 pass / 1 fail («nivelDeOferta leyó
//     nada»). Restaurado: 9 / 0.
//   · «[completar]» en la prueba de la 7: 8 pass / 1 fail. Restaurado: 9 / 0.
//   · un cambio sin efecto (renombrar la constante local `TOPE_RENGLON`): 9 pass / 0 fail.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRUPOS_OFERTA, PLANTILLAS_OFERTA, TOPE_EJEMPLO_PROMPT, ejemploParaPrompt, formaParaPrompt, mensajeDePlantilla, plantillaDeTarjeta,
  plantillaOferta, preguntasParaPrompt,
  type PlantillaOferta,
} from '../lib/offer-plantillas';
import { esPiezaKey, type PiezasSabidas } from '../lib/offer-marco';
import { aplicarReglasPropuesta, calcularDiagnostico, duracionEnDias, nivelDeOferta } from '../lib/offer-reglas';
import { problemasDelEjemplo } from './_reales';

const IDS = [
  'programa-garantia', 'cohorte-rapida', 'servicio-hecho', 'entrada-acredita', 'precio-tramos',
  'preventa-etapas', 'primera-camada', 'revisar-oferta', 'continuidad-egresados',
];

/** Todos los textos de un valor, recorriéndolo entero (objetos, listas, tuplas). */
function textos(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(textos);
  if (v && typeof v === 'object') return Object.values(v).flatMap(textos);
  return [];
}

/** Las piezas que el dueño daría, armadas con el ejemplo: el precio, el formato y lo que incluye. */
function piezasDe(p: PlantillaOferta): PiezasSabidas {
  const at = '2026-11-06T00:00:00.000Z';
  return {
    precio: { valor: p.ejemplo.inversion.precio, fuente: 'doc', at },
    formato: { valor: p.ejemplo.formato, fuente: 'doc', at },
    entregables: { valor: p.ejemplo.incluye.map((e) => e.nombre).join('; '), fuente: 'doc', at },
  };
}

/**
 * Las semanas que NOMBRA un formato («8 semanas en vivo y 5 de práctica», «12 sesiones semanales y una semana de
 * cierre»). No mira el primer «90 días», que es el total contra el que se compara.
 */
function semanasDelFormato(t: string): { total: number; partes: number } {
  let total = 0;
  let partes = 0;
  for (const m of t.matchAll(/(\d+|una?)\s+(?:semanas?\s+)?(?:en vivo|de pr[aá]ctica|de cierre|sesiones semanales)/gi)) {
    total += /^\d/.test(m[1]) ? Number(m[1]) : 1;
    partes++;
  }
  return { total, partes };
}

test('son 9, con los ids permanentes, en el orden del plan, y los 5 grupos', () => {
  assert.equal(PLANTILLAS_OFERTA.length, 9);
  assert.deepEqual(PLANTILLAS_OFERTA.map((p) => p.id), IDS, 'un id cambió de nombre o de lugar: viajan guardados en las conversaciones');
  assert.equal(new Set(PLANTILLAS_OFERTA.map((p) => p.id)).size, 9, 'hay un id repetido');
  assert.deepEqual(GRUPOS_OFERTA, ['Programas y mentorías', 'Servicios', 'Entrada y continuidad', 'Inmobiliaria', 'Revisar tu oferta']);
  assert.deepEqual([...new Set(PLANTILLAS_OFERTA.map((p) => p.grupo))].sort(), [...GRUPOS_OFERTA].sort(), 'un grupo quedó vacío o sobra');
  const grupoDe = (id: string) => PLANTILLAS_OFERTA.find((p) => p.id === id)?.grupo;
  assert.deepEqual(['programa-garantia', 'cohorte-rapida', 'precio-tramos', 'primera-camada'].map(grupoDe), Array(4).fill('Programas y mentorías'));
  assert.equal(grupoDe('servicio-hecho'), 'Servicios');
  assert.deepEqual(['entrada-acredita', 'continuidad-egresados'].map(grupoDe), ['Entrada y continuidad', 'Entrada y continuidad']);
  assert.equal(grupoDe('preventa-etapas'), 'Inmobiliaria');
  assert.equal(grupoDe('revisar-oferta'), 'Revisar tu oferta');
});

test('plantillaOferta encuentra por id y no inventa', () => {
  for (const id of IDS) assert.equal(plantillaOferta(id)?.id, id);
  for (const malo of ['no-existe', '', ' programa-garantia', null, undefined, 3, {}]) assert.equal(plantillaOferta(malo), null, `«${String(malo)}» no es una plantilla`);
});

test('ningún texto nombra a alguien real, ni va en voseo, ni trae regionalismos', () => {
  for (const p of PLANTILLAS_OFERTA) {
    const problemas = problemasDelEjemplo(textos(p).join('\n'));
    assert.deepEqual(problemas, [], `${p.id}: ${problemas.join(' · ')}`);
  }
});

test('ningún ejemplo, chip ni insignia lleva «[completar]» ni «[DATO»', () => {
  for (const p of PLANTILLAS_OFERTA) {
    const mirados = [...textos(p.ejemplo), ...textos(p.ficha), ...textos(p.diagnostico), ...textos(p.revision)];
    const con = mirados.filter((t) => /\[completar\]|\[DATO/i.test(t));
    assert.deepEqual(con, [], `${p.id}: ${con.join(' · ')}`);
    assert.equal(p.ficha.chips.length, 3, `${p.id}: la tarjeta lleva 3 chips`);
    assert.ok(p.ficha.chips.every((c) => c.trim()), `${p.id}: un chip vacío`);
  }
});

test('los programas de 90 días: el formato empieza con «90 días» y sus semanas suman 13', () => {
  const programas = PLANTILLAS_OFERTA.filter((p) => /^90 días/.test(p.ejemplo.formato));
  // Los tres del elenco corregido (Cierre Consultivo, Consulta Rentable, Voz de Líder) y la primera camada.
  for (const id of ['programa-garantia', 'cohorte-rapida', 'precio-tramos', 'primera-camada']) {
    assert.ok(programas.some((p) => p.id === id), `${id}: el formato tiene que empezar con «90 días»`);
  }
  for (const p of programas) {
    assert.equal(duracionEnDias(p.ejemplo.formato), 90, `${p.id}: duracionEnDias`);
    const s = semanasDelFormato(p.ejemplo.formato);
    assert.ok(s.partes >= 2, `${p.id}: el formato no nombra sus partes («N semanas en vivo y M de práctica»)`);
    assert.equal(s.total, 13, `${p.id}: las semanas suman ${s.total}, no 13 (91 días): «${p.ejemplo.formato}»`);
  }
});

test('el nivel lo calcula el código con el precio del ejemplo, y en alto ticket dura de 90 a 180 días', () => {
  for (const p of PLANTILLAS_OFERTA) {
    const nivel = nivelDeOferta(piezasDe(p));
    const esperado = p.id === 'entrada-acredita' || p.id === 'continuidad-egresados' ? 'bajo' : 'alto';
    assert.equal(nivel?.nivel, esperado, `${p.id}: nivelDeOferta leyó ${nivel ? `${nivel.precio.monto} ${nivel.precio.moneda}` : 'nada'} en «${p.ejemplo.inversion.precio}»`);
    assert.ok(nivel?.precio.moneda, `${p.id}: el precio va con su moneda`);
    if (esperado === 'alto' && p.forma.tipo !== 'producto') {
      const dias = duracionEnDias(p.ejemplo.formato);
      assert.ok(dias != null && dias >= 90 && dias <= 180, `${p.id}: dura ${dias} días según «${p.ejemplo.formato}»`);
    }
  }
});

test('aplicarReglasPropuesta no le agrega ningún aviso al ejemplo, y hay de 1 a 3 bonos', () => {
  for (const p of PLANTILLAS_OFERTA) {
    const r = aplicarReglasPropuesta(p.ejemplo, piezasDe(p), { negocio: p.negocio.nombre });
    assert.deepEqual(r.avisos, [], `${p.id}: ${(r.avisos ?? []).join(' · ')}`);
    assert.ok(p.ejemplo.bonos.length >= 1 && p.ejemplo.bonos.length <= 3, `${p.id}: ${p.ejemplo.bonos.length} bonos`);
  }
});

test('las preguntas usan piezas del marco, y el diagnóstico de la 8 es el que calcula el código', () => {
  for (const p of PLANTILLAS_OFERTA) {
    assert.ok(p.preguntas.length >= 4, `${p.id}: pocas preguntas`);
    for (const q of p.preguntas) assert.ok(esPiezaKey(q.pieza), `${p.id}: «${q.pieza}» no es una pieza del marco`);
  }
  const ocho = plantillaOferta('revisar-oferta');
  assert.ok(ocho?.diagnostico && ocho.revision, 'la 8 trae su diagnóstico y su antes y después');
  assert.deepEqual(ocho.diagnostico.d.dimensiones.map((d) => d.id), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']);
  assert.deepEqual(ocho.diagnostico.calculo, calcularDiagnostico(ocho.diagnostico.d.dimensiones));
  assert.equal(ocho.diagnostico.calculo.total, 49);
  assert.equal(ocho.diagnostico.calculo.cuello, 'D2');
  assert.equal(ocho.diagnostico.d.cambios.length, 3);
  assert.equal(PLANTILLAS_OFERTA.filter((p) => p.diagnostico || p.revision).length, 1, 'el diagnóstico es sólo de la 8');
});

test('lo que viaja al prompt: la forma con sus preguntas, y el ejemplo marcado ficticio y con tope', () => {
  for (const p of PLANTILLAS_OFERTA) {
    const forma = formaParaPrompt(p);
    assert.ok(forma.includes(p.forma.mueve), `${p.id}: la forma no dice qué mueve`);
    assert.ok(forma.includes(preguntasParaPrompt(p)), `${p.id}: la forma no trae sus preguntas`);
    assert.ok(!formaParaPrompt(p, { conPreguntas: false }).includes(p.preguntas[0].pregunta), `${p.id}: conPreguntas: false las sigue mandando`);
    const ej = ejemploParaPrompt(p);
    assert.ok(ej.length <= TOPE_EJEMPLO_PROMPT, `${p.id}: ${ej.length} caracteres`);
    assert.equal(TOPE_EJEMPLO_PROMPT, 1_500);
    assert.match(ej, /ficticio/i, `${p.id}: el ejemplo no dice que es ficticio`);
    assert.ok(ej.includes(p.ejemplo.nombre) && ej.includes(p.ejemplo.frase), `${p.id}: el ejemplo perdió el nombre o la frase`);
    assert.ok(ej.includes('Inversión:'), `${p.id}: el tope dejó afuera la inversión`);
  }
});

// ── «Nueva oferta»: la tarjeta y el primer mensaje (6/11/2026) ──────────────
// Probado rompiéndolo: `mensajeDePlantilla` con el nombre del negocio del ejemplo → rojo en «el primer mensaje no lleva el
// ejemplo»; `plantillaDeTarjeta` sin mirar el prefijo → rojo en «sólo con su prefijo».
test('una tarjeta de «Nueva oferta» es plantilla sólo con su prefijo', () => {
  assert.equal(plantillaDeTarjeta('plantilla:programa-garantia')?.id, 'programa-garantia');
  assert.equal(plantillaDeTarjeta('programa-garantia'), null);
  assert.equal(plantillaDeTarjeta('nueva:12'), null);
  assert.equal(plantillaDeTarjeta('plantilla:no-existe'), null);
});

test('el primer mensaje al usar una plantilla dice la forma y no lleva nada del ejemplo ficticio', () => {
  for (const p of PLANTILLAS_OFERTA) {
    const m = mensajeDePlantilla(p);
    assert.match(m, new RegExp(`«${p.nombre}»`));
    assert.ok(!m.includes(p.negocio.nombre), `${p.id}: el mensaje nombra al negocio del ejemplo`);
    assert.ok(!m.includes(p.ejemplo.nombre) || p.ejemplo.nombre === p.nombre, `${p.id}: el mensaje trae el nombre de la oferta del ejemplo`);
    assert.ok(m.includes(p.preguntas[0].pregunta), `${p.id}: no empieza por la primera pregunta de la forma`);
    assert.deepEqual(problemasDelEjemplo(m), [], `${p.id}: ${problemasDelEjemplo(m).join(', ')}`);
  }
});
