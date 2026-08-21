// =============================================================================
// Que la metodología esté DE VERDAD en cada prompt que puntúa
// =============================================================================
// El caso (2026-08-21). El dueño rechazó el ranking de proyectos preguntando: *«"Feature:
// Closing Analyst" o "Feature: Customer Success"… ¿qué carajos tiene que ver con lo que
// mueve la aguja? ¿En qué me acerca eso a lo que configuramos en el perro?»*
//
// La respuesta honesta era: en nada, porque **el prompt que puntuaba proyectos no tenía la
// metodología**. Le faltaba la ESCALERA DEL DINERO entera, la definición de impacto/esfuerzo
// en días, la regla de lo roto frente a un cliente, «el tamaño no es la prioridad», la
// disciplina de distribución y el formato obligatorio de la razón. Nadie lo notó porque no
// había forma de notarlo: un prompt al que le falta media metodología compila igual, corre
// igual y devuelve números igual de convincentes.
//
// Estos tests son esa forma de notarlo. NO exigen que el texto sea idéntico —los prompts
// tienen tonos distintos a propósito— sino que la SUSTANCIA esté: los cinco escalones, la
// prohibición de la paráfrasis, el esfuerzo estimado en días. Si mañana alguien escribe un
// prompt de priorización nuevo y se olvida un bloque, esto se lo dice antes de que lo vea
// un dueño en su pantalla.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ⚠️ SE LEE EL FUENTE COMO TEXTO, no se importa. `lib/mako-guardian.ts` tiene `server-only`,
// y `npm test` corre sin `--conditions react-server`: importarlo revienta con «This module
// cannot be imported from a Client Component». Es el mismo camino que ya usa
// `tests/ia-mensajes.test.ts` para sus guardas sobre el código.
//
// Y tiene una ventaja propia: leer el ARCHIVO chequea lo que está escrito, no lo que un
// import resolvió — así que también caza el caso en que alguien mueva un template a otro
// módulo y deje el nombre exportado apuntando a otra cosa.
const FUENTE = readFileSync(new URL('../lib/mako-guardian.ts', import.meta.url), 'utf8');

/** El cuerpo de un template, entre su `export const X = \`` y el backtick que lo cierra. */
function template(nombre: string): string {
  const i = FUENTE.indexOf(`export const ${nombre} = \``);
  assert.notEqual(i, -1, `no existe el template ${nombre} — ¿lo renombraron?`);
  const j = FUENTE.indexOf('`;', i);
  assert.notEqual(j, -1, `el template ${nombre} no cierra`);
  return FUENTE.slice(i, j);
}

const MET_ESCALERA = template('MET_ESCALERA');
const MET_IMPACTO_ESFUERZO = template('MET_IMPACTO_ESFUERZO');
const MET_ROTO_CLIENTE = template('MET_ROTO_CLIENTE');
const MET_TAMANO = template('MET_TAMANO');
const MET_DISTRIBUCION = template('MET_DISTRIBUCION');
const MET_RAZON = template('MET_RAZON');
const GUARDIAN_SYSTEM_TEMPLATE = template('GUARDIAN_SYSTEM_TEMPLATE');
const GUARDIAN_NUEVAS_SYSTEM_TEMPLATE = template('GUARDIAN_NUEVAS_SYSTEM_TEMPLATE');
const PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE = template('PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE');

/** Lo que hace que un texto SEA la escalera, no una alusión a ella. */
const ESCALONES = ['COBRAR', 'CONVERSACION NUEVA', 'NO PERDER UN CLIENTE', 'CONVERTIR MEJOR', 'CONSTRUIR'];

// Los prompts que producen un SCORE. Cada uno declara qué bloques tiene que traer, porque
// no todos priorizan lo mismo: el de tareas nuevas no decide nada sobre proyectos.
const PROMPTS: Array<{ nombre: string; texto: string; slots: string[]; exige: Array<[string, string]> }> = [
  {
    nombre: 'GUARDIAN_SYSTEM_TEMPLATE (re-priorización del plan entero)',
    texto: GUARDIAN_SYSTEM_TEMPLATE, slots: [],
    exige: [['escalera', 'x'], ['impacto/esfuerzo', 'x'], ['roto frente a un cliente', 'x'], ['tamaño', 'x'], ['distribución', 'x'], ['razón', 'x']],
  },
  {
    nombre: 'GUARDIAN_NUEVAS_SYSTEM_TEMPLATE (tareas nuevas — LOS DOS tableros)',
    texto: GUARDIAN_NUEVAS_SYSTEM_TEMPLATE, slots: [],
    // No juzga proyectos, así que «el tamaño de un proyecto» no le corresponde.
    exige: [['escalera', 'x'], ['impacto/esfuerzo', 'x'], ['roto frente a un cliente', 'x'], ['razón', 'x']],
  },
  {
    nombre: 'PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE (los proyectos que ya existen)',
    texto: PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE,
    slots: ['{{escalera}}', '{{impactoEsfuerzo}}', '{{rotoCliente}}', '{{tamano}}', '{{distribucion}}', '{{razon}}'],
    exige: [],
  },
];

/** El prompt tal como lo VE el modelo: con los slots ya rellenados. */
const renderizado = (p: (typeof PROMPTS)[number]): string => {
  let t = p.texto;
  const valores: Record<string, string> = {
    '{{escalera}}': MET_ESCALERA, '{{impactoEsfuerzo}}': MET_IMPACTO_ESFUERZO,
    '{{rotoCliente}}': MET_ROTO_CLIENTE, '{{tamano}}': MET_TAMANO,
    '{{distribucion}}': MET_DISTRIBUCION, '{{razon}}': MET_RAZON,
  };
  for (const [slot, v] of Object.entries(valores)) t = t.split(slot).join(v);
  return t;
};

for (const p of PROMPTS) {
  test(`${p.nombre} — trae LOS CINCO ESCALONES de la escalera del dinero`, () => {
    // Es la regla que ORDENA todo lo demás. Un prompt de priorización sin la escalera no
    // prioriza por lo que mueve la aguja: prioriza por lo que suena importante.
    const t = renderizado(p);
    for (const e of ESCALONES) {
      assert.ok(t.includes(e), `le falta el escalón «${e}» — sin él, «construir una capacidad» compite de igual a igual con «cobrar lo que ya se vendió»`);
    }
  });

  test(`${p.nombre} — prohíbe que la razón sea una paráfrasis`, () => {
    const t = renderizado(p);
    assert.match(t, /PROHIBIDO que la razón sea una paráfrasis/,
      'sin esta prohibición el modelo devuelve razones que repiten el título, y un ranking sin comparación no se puede discutir');
  });

  test(`${p.nombre} — estima el ESFUERZO en días, no por el largo de la frase`, () => {
    const t = renderizado(p);
    assert.ok(t.includes('DÍAS de UNA persona'),
      'sin la estimación en días, el modelo usa el largo del texto como proxy del esfuerzo — y lo que entra por reunión o WhatsApp llega siempre corto');
  });
}

test('el prompt que juzga PROYECTOS trae además el tamaño y la distribución', () => {
  // Las dos reglas que la fórmula revertida violaba de frente: premiaba el tamaño y
  // amontonaba doce proyectos entre 95 y 98.
  const t = renderizado(PROMPTS[2]);
  assert.ok(t.includes('EL TAMAÑO DE UN PROYECTO NO ES SU PRIORIDAD'));
  assert.ok(t.includes('PROHIBIDO empatar dos proyectos'));
  assert.ok(t.includes('El norte va en 95-100'));
});

test('el prompt de proyectos pide el ESCALÓN como dato, no adentro de una frase', () => {
  // Es lo que lo hace verificable, mostrable y discutible. Mientras vivió solo en la prosa
  // de la razón, no se podía ordenar por él ni contar cuántas cosas caen en cada uno.
  assert.match(PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE, /"escalon"/);
  assert.match(PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE, /desbloquea/);
});

test('GUARDA: la escalera no se copia a mano en un prompt nuevo', () => {
  // No se exige que los prompts VIEJOS ya la interpolen —extraerlos de los templates que
  // están en producción es una cirugía aparte, y una mal hecha se come reglas vecinas: pasó
  // mientras se escribía esto, se llevó puestas «CÓMO ELEGIR LA FECHA» y «SE HACE EN MAKO»
  // de un solo corte. Lo que sí se fija es el TECHO: si mañana aparece una cuarta copia
  // literal de los cinco escalones, este test lo dice.
  const copias = [GUARDIAN_SYSTEM_TEMPLATE, GUARDIAN_NUEVAS_SYSTEM_TEMPLATE, PUNTUAR_PROYECTOS_SYSTEM_TEMPLATE]
    .filter((t) => t.includes('COBRAR lo que ya se vendio')).length;
  assert.ok(copias <= 2,
    `hay ${copias} prompts con la escalera escrita a mano. El tercero (y los que vengan) interpolan {{escalera}} de MET_ESCALERA: si se copia, el prompt nuevo nace viejo el día que la metodología cambie.`);
});
