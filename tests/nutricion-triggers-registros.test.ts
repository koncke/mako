// Un trigger de nutrición son TRES registros, y ninguno falla ruidoso
// =============================================================================
// Agregar un cohorte nuevo no es agregarlo a un lugar:
//
//   1. `leadsDeCohorte` (lib/nutricion.ts)          → A QUIÉN alcanza
//   2. `TRIGGERS` (lib/email-marketing.ts)          → cómo se LLAMA en el selector
//   3. `COHORTE_GLOSS` (lib/nutricion-generator.ts) → qué LEE MaKo al escribirla
//
// Y ninguno de los tres da error si falta:
//
// · Sin el LABEL, el selector de la secuencia cae al `value` y el dueño elige
//   entre «Agendó pero no confirmó» y `agendado_primer_contacto`. Peor: el
//   selector es cómo se cambia el disparador de una secuencia, así que una
//   opción sin nombre es una que nadie va a elegir.
// · Sin la GLOSA, MaKo escribe los mensajes de esa secuencia sin saber a quién
//   le habla — y no falla: escribe algo genérico y plausible, que es el modo de
//   falla más caro de todos porque se lee igual de bien.
//
// Es el mismo molde que `lib/metodo-verificar.ts` ya paga con las
// integraciones: tres catálogos, un comentario avisando, y el registro que
// faltaba igual.
//
// ⚠️ SE LEE EL TEXTO de los dos módulos con `server-only`. Importarlos rompe
// el test (es a propósito: no pueden viajar al cliente), así que la lista sale
// del fuente. Lo que NO se hace es escribir la lista a mano acá: una lista a
// mano se queda vieja con el próximo trigger y vuelve el mismo agujero, que es
// exactamente lo que AGENTS.md manda evitar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Del módulo SIN imports: `lib/nutricion` arrastra `lib/workspace` y con eso
// el runtime de Next, que bajo tsx no carga. Por eso las constantes viven
// aparte — ver la cabecera de lib/nutricion-familias.ts.
import { TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO, mitadPostAgenda, secuenciasParaElLead, puedeAfirmarEtapa } from '../lib/nutricion-familias';
import { TRIGGER_ENTREGA } from '../lib/nutricion-etapa';

const raiz = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8');

// Los triggers que el MOTOR sabe resolver. Salen de las comparaciones de
// `leadsDeCohorte`, que es el único lugar donde un trigger se convierte en
// leads de verdad.
function triggersDelMotor(): string[] {
  const src = leer('lib/nutricion.ts');
  const fuera = new Set<string>();
  // `triggerTipo === 'x'` — el literal.
  for (const m of src.matchAll(/triggerTipo === '([a-z0-9_]+)'/g)) fuera.add(m[1]);
  // `triggerTipo === CONSTANTE` — se resuelve importando, no adivinando.
  const consts: Record<string, string> = {
    TRIGGER_AGENDA_CONOCIDO,
    TRIGGER_AGENDA_NUEVO,
    TRIGGER_ENTREGA,
  };
  for (const m of src.matchAll(/triggerTipo === ([A-Z][A-Z0-9_]+)/g)) {
    const v = consts[m[1]];
    assert.ok(v, `leadsDeCohorte compara contra ${m[1]}, que este test no sabe resolver: agregalo al mapa \`consts\``);
    fuera.add(v);
  }
  return [...fuera];
}

test('leadsDeCohorte resuelve al menos los cohortes que ya existían', () => {
  const t = triggersDelMotor();
  // Si esto baja, o el extractor se rompió o alguien borró cohortes. Las dos
  // cosas hay que mirarlas a mano: el número no puede bajar solo.
  assert.ok(t.length >= 8, `el extractor encontró ${t.length} triggers (${t.join(', ')}): es sospechosamente poco`);
  assert.ok(t.includes('agendado_sin_confirmar'));
});

test('todo trigger que el motor resuelve tiene NOMBRE en el selector', () => {
  // TRIGGERS tampoco se puede importar: `lib/email-marketing` arrastra
  // `lib/workspace` igual que nutricion. Se lee el fuente del array.
  const src = leer('lib/email-marketing.ts');
  const bloque = src.slice(src.indexOf('export const TRIGGERS'));
  const conLabel = new Set([...bloque.slice(0, bloque.indexOf('\n];')).matchAll(/value: '([a-z0-9_]+)'/g)].map((m) => m[1]));
  assert.ok(conLabel.size >= 8, `el extractor de TRIGGERS encontro ${conLabel.size} etiquetas: se rompio`);
  const sinNombre = triggersDelMotor().filter((t) => !conLabel.has(t));
  assert.deepEqual(sinNombre, [], `estos cohortes existen en el motor y no tienen etiqueta en TRIGGERS: ${sinNombre.join(', ')}`);
});

test('todo trigger que el motor resuelve tiene GLOSA para MaKo', () => {
  // COHORTE_GLOSS vive en un módulo con server-only: se lee el fuente.
  const src = leer('lib/nutricion-generator.ts');
  const bloque = src.slice(src.indexOf('COHORTE_GLOSS'));
  const conGlosa = new Set([...bloque.matchAll(/^\s{2}([a-z0-9_]+):\s*'/gm)].map((m) => m[1]));
  // ⚠️ HAY DOS FORMAS DE TENER GLOSA, y la primera versión de este test solo
  // veía una: acusó a `etapa_actual` de dejar a MaKo a ciegas cuando ese
  // trigger tiene la glosa MEJOR de todas — `contextoDeSecuencia` se la arma
  // con la etapa real del funnel del workspace. Un chequeo que marca de más
  // sale más caro que no tenerlo: manda a "arreglar" algo que está bien.
  const dinamicos = new Set(
    [...src.matchAll(/sec\.trigger_tipo === '([a-z0-9_]+)'/g)].map((m) => m[1]),
  );
  assert.ok(dinamicos.has('etapa_actual'), 'el extractor de glosas dinámicas dejó de encontrar la de etapa_actual');
  const sinGlosa = triggersDelMotor().filter((t) => !conGlosa.has(t) && !dinamicos.has(t));
  assert.deepEqual(sinGlosa, [], `MaKo va a escribir estas secuencias sin saber a quién le habla: ${sinGlosa.join(', ')}`);
});

// ── La familia post-agenda ──────────────────────────────────────────────────
test('las dos mitades de la post-agenda son DOS triggers distintos', () => {
  assert.notEqual(TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO);
  // El reparto cubre los dos casos y nunca manda a los dos lados a la vez.
  assert.equal(mitadPostAgenda(true), TRIGGER_AGENDA_CONOCIDO);
  assert.equal(mitadPostAgenda(false), TRIGGER_AGENDA_NUEVO);
  // Y ninguna es el trigger viejo: si alguna lo fuera, las dos secuencias
  // compartirían cohorte y el lead entraría a las dos.
  assert.notEqual(TRIGGER_AGENDA_CONOCIDO, 'agendado_sin_confirmar');
  assert.notEqual(TRIGGER_AGENDA_NUEVO, 'agendado_sin_confirmar');
});

test('quien entra a una mitad queda FUERA de la otra (la exclusión de familia)', () => {
  // Lo que esto protege: partir el cohorte en dos NO alcanza, porque la
  // condición se da vuelta sola. Mandarle el audio a un lead de «primer
  // contacto» lo convierte en «ya contactado», y en la corrida siguiente cae
  // en el cohorte hermano y recibe el segundo audio — el duplicado que separar
  // las secuencias venía a evitar.
  //
  // La guarda es `leadsEnFamiliaPostAgenda`, y la propiedad que hay que fijar
  // es que se USE: sin ella el código compila igual y el bug es invisible
  // hasta que un lead real recibe dos audios.
  const src = leer('lib/nutricion.ts');
  const rama = src.slice(src.indexOf('if (triggerTipo === TRIGGER_AGENDA_CONOCIDO'));
  const cuerpo = rama.slice(0, rama.indexOf('\n  }'));
  assert.match(cuerpo, /leadsEnFamiliaPostAgenda/, 'la rama de la familia dejó de excluir a los ya inscriptos: dos audios al mismo lead');
  assert.match(cuerpo, /leadsYaContactados/, 'la rama de la familia dejó de partir el cohorte por «¿ya le hablamos?»');

  // Y el otro camino de enrolamiento, que NO pasa por leadsDeCohorte: el de
  // evento. Ahí la exclusión se hace eligiendo UNA de las dos secuencias, y la
  // regla es una función pura que se prueba de verdad — abajo.
  const evento = src.slice(src.indexOf('export async function enrolarPorEvento'));
  assert.match(evento.slice(0, 2000), /secuenciasParaElLead/, 'enrolarPorEvento inscribe en TODAS las secuencias del evento: sin el filtro de familia, el lead entra a las dos mitades');
});

test('el enrolamiento por evento mete al lead en UNA sola mitad', () => {
  const activas = [
    { clave: 'bienvenida', trigger_tipo: 'instant_form_sin_agenda' },
    { clave: 'conocido', trigger_tipo: TRIGGER_AGENDA_CONOCIDO },
    { clave: 'nuevo', trigger_tipo: TRIGGER_AGENDA_NUEVO },
  ];
  // Ya le habíamos escrito → le toca la que retoma la charla, nunca la que se
  // presenta de cero.
  assert.deepEqual(secuenciasParaElLead(activas, true).map((s) => s.clave), ['bienvenida', 'conocido']);
  assert.deepEqual(secuenciasParaElLead(activas, false).map((s) => s.clave), ['bienvenida', 'nuevo']);
  // Lo que NO puede pasar nunca: las dos.
  for (const ya of [true, false]) {
    const mitades = secuenciasParaElLead(activas, ya).filter((s) => s.trigger_tipo !== 'instant_form_sin_agenda');
    assert.equal(mitades.length, 1, `con yaLeHablamos=${ya} el lead entraría a ${mitades.length} mitades: son dos audios de apertura al mismo teléfono`);
  }
  // Lo que sale de la familia no se toca: filtrar de más deja al lead sin la
  // secuencia que sí le correspondía.
  assert.equal(secuenciasParaElLead(activas, true).some((s) => s.clave === 'bienvenida'), true);
});

test('con UNA sola mitad configurada no se filtra nada', () => {
  // El caso del dueño que grabó un audio de dos: si acá filtráramos igual, al
  // lead que no coincide con esa única mitad no le llegaría nada — y la
  // secuencia que sí existe se vería activa sin enviar nunca.
  // ⚠️ EL CASO LLEVA UNA SECUENCIA DE FUERA DE LA FAMILIA A PROPÓSITO. Sin
  // ella, `return secuencias` y `return deLaFamilia` dan lo mismo y el test
  // pasa sobre un filtro que se come todo lo demás — probado rompiéndolo: con
  // solo la mitad en la lista, la rotura daba 7 de 7 en verde.
  const soloUna = [
    { clave: 'bienvenida', trigger_tipo: 'instant_form_sin_agenda' },
    { clave: 'nuevo', trigger_tipo: TRIGGER_AGENDA_NUEVO },
  ];
  assert.deepEqual(secuenciasParaElLead(soloUna, true).map((s) => s.clave), ['bienvenida', 'nuevo']);
  assert.deepEqual(secuenciasParaElLead(soloUna, false).map((s) => s.clave), ['bienvenida', 'nuevo']);
});

// ── La glosa no puede afirmar una etapa que no sabe de qué embudo es ───────
// ⚠️ PROBADAS ROMPIENDO LA PIEZA, 04/10/2026. Las tres roturas se cazan, 1 fallo cada
// una: afirmar siempre (el código de antes) · abstenerse siempre (se pierde la glosa
// buena en los 7 workspaces de un solo embudo) · e ignorar que la secuencia declara su
// embudo, que es la única salida que esto tiene.

test('⚠️ con DOS embudos vivos y una secuencia que no dice de cuál es, no se afirma', () => {
  // Lo destapó el chat del CRM al hacer que el opt-in de una landing guarde el
  // `funnel_id` del producto: medido el mismo día, 4 de 11 workspaces ya tienen dos
  // embudos vivos y las 62 secuencias tienen `funnel_id` NULL. La glosa dice «Lead
  // parado en la etapa X del funnel del negocio» leyendo el DEFAULT, así que con dos
  // vivos puede estar describiendo el otro — y se lo afirma al modelo que escribe.
  assert.equal(puedeAfirmarEtapa({ embudosVivos: 2, secDeclaraFunnel: false }), false);
  assert.equal(puedeAfirmarEtapa({ embudosVivos: 7, secDeclaraFunnel: false }), false);
});

test('y con UNO solo sí: el default ES el del lead', () => {
  // Abstenerse siempre sería el error inverso: hoy son 7 de 11 los workspaces con un
  // embudo solo, y ahí la glosa es exacta. Lo que se perdería es contexto real.
  assert.equal(puedeAfirmarEtapa({ embudosVivos: 1, secDeclaraFunnel: false }), true);
  // Cero embudos no debería pasar, y si pasa el `find` de la etapa no encuentra nada:
  // la glosa cae a la genérica por el otro camino. Afirmar acá no rompe nada.
  assert.equal(puedeAfirmarEtapa({ embudosVivos: 0, secDeclaraFunnel: false }), true);
});

test('⚠️ y una secuencia que DECLARA su embudo puede afirmar siempre', () => {
  // Es la salida del callejón, y la que hay que recordar cuando alguien pueble
  // `nutricion_secuencias.funnel_id`: con el embudo declarado no hay ambigüedad, haya
  // dos vivos o diez. Si esta rama no existiera, poblar la columna no destrabaría nada.
  assert.equal(puedeAfirmarEtapa({ embudosVivos: 2, secDeclaraFunnel: true }), true);
  assert.equal(puedeAfirmarEtapa({ embudosVivos: 10, secDeclaraFunnel: true }), true);
});

test('⚠️ y la glosa LLAMA a esa condición, con el campo del embudo de la secuencia', () => {
  // Un guard de cableado: los tres de arriba prueban la cuenta, no que el generador la
  // use. Y el `funnel_id` tiene que llegar: la función que lee las secuencias NO lo
  // selecciona hoy, así que si alguien lo agrega al `select`, esto ya lo aprovecha.
  const src = readFileSync(new URL('../lib/nutricion-generator.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('async function contextoDeSecuencia'), src.indexOf('export async function generarSecuencia'));
  assert.ok(fn.length > 400 && fn.length < 3000, `el recorte de contextoDeSecuencia mide ${fn.length}: mira otra cosa`);
  assert.match(fn, /puedeAfirmarEtapa\(\{ embudosVivos, secDeclaraFunnel: sec\.funnel_id != null \}\)/,
    'la glosa dejó de preguntar si puede afirmar la etapa');
  assert.match(fn, /listarFunnels\(\)/, 'ya no cuenta los embudos vivos: la condición queda sin dato');
});

