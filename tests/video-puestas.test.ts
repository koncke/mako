// =============================================================================
// Video Generator: la SEGUNDA capa de las reglas que gobiernan la salida del modelo
// =============================================================================
// El prompt de `lib/video-planner.ts` le pide al modelo que respete el ritmo
// habla/off y el tope de palabras por clip. Eso no alcanza — «una regla en un
// prompt no es una regla» (AGENTS.md). Acá vive la validación determinista, y
// estos tests son la red que impide que se degrade sin que nadie se entere.
//
// Las funciones bajo prueba viven en módulos SIN `server-only` a propósito, por
// la misma razón que `exigirClienteDePrueba`: si la condición vive adentro del
// módulo que llama al modelo, ningún test la puede importar y la guarda queda
// sin red justo donde más duele.
// =============================================================================

import { test } from 'node:test';
import { ACENTOS_ES, resolverAcento } from '../lib/acento-workspace';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Todo sale de módulos SIN `server-only`. `lib/video-planner.ts` las re-exporta
// para quien use el motor, pero importarlas de ahí arrastra el server-only y el
// test no arranca — que es exactamente el motivo por el que viven separadas.
import {
  CATALOGO_PUESTAS, puestaPorId, ritmoDeClips, palabrasQueEntran, proveedorDeClip,
  contarPalabras, repartirDuracion, marcasDeVoseo, puestasOfrecidas, conAcento,
} from '../lib/puestas-data';
import {
  guionATexto,
} from '../app/video-generator/video-pedido';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── El catálogo ──────────────────────────────────────────────────────────────

test('cada puesta tiene id único', () => {
  const ids = CATALOGO_PUESTAS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('los rangos están bien ordenados: el mínimo no supera al máximo', () => {
  for (const p of CATALOGO_PUESTAS) {
    assert.ok(p.clips[0] <= p.clips[1], `${p.id}: clips [${p.clips}]`);
    assert.ok(p.segundosClip[0] <= p.segundosClip[1], `${p.id}: segundos [${p.segundosClip}]`);
    assert.ok(p.densidad > 0, `${p.id}: densidad ${p.densidad}`);
  }
});

test('solo las puestas MIXTAS declaran ritmo, y el ritmo solo usa H y O', () => {
  for (const p of CATALOGO_PUESTAS) {
    if (p.habla === 'mixto') {
      assert.ok(p.ritmo, `${p.id} es mixto y no declara ritmo`);
      assert.match(p.ritmo!, /^[HO](\s+[HO])*$/, `${p.id}: ritmo «${p.ritmo}»`);
    } else {
      assert.equal(p.ritmo, undefined, `${p.id} no es mixto y declara ritmo`);
    }
  }
});

test('toda puesta declara de dónde salieron sus números', () => {
  for (const p of CATALOGO_PUESTAS) {
    assert.ok(['medido', 'curso'].includes(p.confianza), `${p.id}: confianza ${p.confianza}`);
    assert.ok(p.fuente.length > 10, `${p.id} sin fuente`);
  }
});

// El copy visible va en español neutro con «tú», nunca voseo (AGENTS.md → reglas
// de voz). Ya se coló una vez: tres tarjetas decían «querés» y «no vos».
test('el copy visible del catálogo no tiene voseo', () => {
  const VOSEO = /\b(querés|podés|tenés|sabés|hacés|elegís|ponés|necesitás|mirá|fijate|dale)\b|\bvos\b|\bacá\b/i;
  for (const p of CATALOGO_PUESTAS) {
    for (const [campo, texto] of [['descripcion', p.descripcion], ['cuando', p.cuando]] as const) {
      assert.ok(!VOSEO.test(texto), `${p.id}.${campo}: «${texto}»`);
    }
    for (const r of p.reglas) {
      assert.ok(!VOSEO.test(r), `${p.id}.reglas: «${r}»`);
    }
  }
});

// ── Lo que se OFRECE: solo lo que tiene un anuncio real para mostrar ─────────
// Un formato elegido desde una descripción es un formato elegido a ciegas. Y una
// ruta a un archivo que no está no rompe nada: deja un cuadro negro donde tenía
// que haber un ejemplo, que es peor que no ofrecerlo.

test('solo se ofrecen las puestas que tienen ejemplo en video', () => {
  for (const p of puestasOfrecidas()) {
    assert.ok(p.ejemplo, `${p.id} se ofrece sin ejemplo`);
  }
  const sinEjemplo = CATALOGO_PUESTAS.filter((p) => !p.ejemplo).map((p) => p.id);
  const ofrecidas = puestasOfrecidas().map((p) => p.id);
  for (const id of sinEjemplo) {
    assert.ok(!ofrecidas.includes(id), `${id} no tiene ejemplo y se está ofreciendo`);
  }
});

test('se ofrece al menos una: un menú vacío deja la tab sin entrada', () => {
  assert.ok(puestasOfrecidas().length >= 1);
});

test('toda puesta con ejemplo es una MEDIDA, no una del curso', () => {
  // El ejemplo es el anuncio que se produjo con ella: si existe, se produjo.
  for (const p of puestasOfrecidas()) {
    assert.equal(p.confianza, 'medido', `${p.id} tiene ejemplo pero dice confianza «${p.confianza}»`);
  }
});

test('EL PEDIDO: el video y el poster de cada ejemplo existen en disco', () => {
  const faltan: string[] = [];
  for (const p of CATALOGO_PUESTAS) {
    if (!p.ejemplo) continue;
    for (const ruta of [p.ejemplo.video, p.ejemplo.poster]) {
      // Las rutas son públicas («/formatos/x.mp4») y se sirven desde public/.
      if (!existsSync(resolve(RAIZ, 'public', ruta.replace(/^\//, '')))) {
        faltan.push(`${p.id} → ${ruta}`);
      }
    }
  }
  assert.deepEqual(faltan, [], `ejemplos que apuntan a la nada:\n${faltan.join('\n')}`);
});

// ── El ritmo habla/off ───────────────────────────────────────────────────────

test('el ritmo del plano secuencia se expande al patrón medido en el anuncio 4', () => {
  const p = puestaPorId('plano-secuencia')!;
  // H O H O H O H H — el del GUION-04, 8 clips.
  assert.deepEqual(ritmoDeClips(p, 8), [true, false, true, false, true, false, true, true]);
});

test('una puesta que habla siempre no devuelve ningún clip mudo', () => {
  const p = puestaPorId('selfie-movimiento')!;
  assert.deepEqual(ritmoDeClips(p, 4), [true, true, true, true]);
});

test('una puesta de voz en off no devuelve ningún clip hablado', () => {
  const p = puestaPorId('voz-en-off')!;
  assert.deepEqual(ritmoDeClips(p, 3), [false, false, false]);
});

test('un anuncio más largo que el patrón lo REPITE en vez de quedarse mudo al final', () => {
  const p = puestaPorId('plano-secuencia')!;
  const r = ritmoDeClips(p, 10);
  assert.equal(r.length, 10);
  // Los dos que exceden el patrón de 8 reinician el ciclo: H, O.
  assert.equal(r[8], true);
  assert.equal(r[9], false);
  // Y no puede quedar un anuncio entero sin nadie hablando.
  assert.ok(r.some(Boolean));
});

// ── El tope de palabras ──────────────────────────────────────────────────────

test('el tope sale de la densidad de la puesta y redondea HACIA ABAJO', () => {
  const plano = puestaPorId('plano-secuencia')!;   // 2,1 p/s
  const selfie = puestaPorId('selfie-movimiento')!; // 3 p/s
  // Pasarse obliga a regenerar; quedarse corto solo deja aire, que sí se recorta.
  assert.equal(palabrasQueEntran(plano, 10), 21);
  assert.equal(palabrasQueEntran(selfie, 10), 30);
});

test('con acción física entra un tercio menos de texto que en plano fijo', () => {
  const plano = puestaPorId('plano-secuencia')!;
  const selfie = puestaPorId('selfie-movimiento')!;
  assert.ok(palabrasQueEntran(plano, 10) < palabrasQueEntran(selfie, 10));
});

test('contarPalabras ignora los asteriscos del énfasis y la puntuación suelta', () => {
  // Sin esto, `**palabra**` contaría de más y el aviso saltaría sobre texto que entra.
  assert.equal(contarPalabras('A ver, **la regla era muy sencilla.**'), 7);
  assert.equal(contarPalabras('  —  ¿Sí?  '), 1);
  assert.equal(contarPalabras(''), 0);
});

// ── El reparto de duración ───────────────────────────────────────────────────
//
// ⚠️ Acá había cuatro tests más —del reparto por duración elegida, de la cantidad
// de clips y de `duracionReal`— y se borraron con las funciones que probaban
// (28/08/2026). Probaban el flujo viejo, donde la duración se elegía de un menú
// de 30/60/90; hoy sale del guion. Lo que los reemplaza son los de
// `cabidaDeGuion`, más abajo, que verifican lo mismo desde la otra punta: que la
// cantidad de clips caiga en el rango de la puesta y que un guion que no entra lo
// DIGA.

// ── El voseo, que es la segunda capa de una regla del PROMPT ─────────────────
// El primer plan que generó esta tab salió con «sos vos», «¿y vos qué vas a
// hacer?» y «Tocá el botón» para un cliente norteño de México: la voz de MaKo es
// rioplatense y se filtra a lo que escribe PARA el cliente. La prohibición ya
// estaba escrita en `campaign-structurer.ts:83`, en otro writer.

test('detecta las formas de voseo que se colaron en el primer plan real', () => {
  assert.deepEqual(marcasDeVoseo('el cuello de botella sos vos'), ['sos', 'vos']);
  assert.deepEqual(marcasDeVoseo('Tocá el botón abajo'), ['tocá']);
  assert.deepEqual(marcasDeVoseo('¿y vos qué vas a hacer?'), ['vos']);
});

test('el mismo texto en mexicano pasa limpio', () => {
  assert.deepEqual(marcasDeVoseo('el cuello de botella eres tú'), []);
  assert.deepEqual(marcasDeVoseo('Da clic en el botón de abajo'), []);
  assert.deepEqual(marcasDeVoseo('Mira, si tu equipo te busca para todo, tienes un problema.'), []);
});

test('no marca palabras que existen en las dos variedades', () => {
  // «dale» es común en México y marcarlo daría un falso positivo en cada CTA.
  assert.deepEqual(marcasDeVoseo('Dale una oportunidad a este método'), []);
  // «mira» sin tilde es la forma mexicana y NO es voseo.
  assert.deepEqual(marcasDeVoseo('Mira lo que pasó después'), []);
});

test('no repite la misma marca y no distingue mayúsculas', () => {
  assert.deepEqual(marcasDeVoseo('Vos sabés que vos podés'), ['vos', 'sabés', 'podés']);
});

// ── El acento lo pone el CÓDIGO ──────────────────────────────────────────────
// Medido el 25/08/2026: se pidió `Mexican Spanish with a northern (norteño)
// accent` y los SIETE clips salieron con «Spoken in neutral Latin American
// Spanish». El modelo no lo parafraseó: lo ignoró. Es la regla de AGENTS.md
// sobre datos exactos — si tiene que llegar intacto, no lo transporta el modelo.

const NORTE = 'Mexican Spanish with a northern (norteño) accent';

test('EL CASO REAL: reemplaza el acento que el modelo puso por su cuenta', () => {
  const delModelo =
    'Camera tracks backwards. The person walks toward the camera.\n' +
    'Dialogue: "A ver, el otro día visité la planta." Spoken in neutral Latin American Spanish.';
  const out = conAcento(delModelo, NORTE);
  assert.ok(out.includes(NORTE), out);
  assert.ok(!out.includes('neutral Latin American Spanish'), out);
});

test('borra las tres formas con que el modelo cierra el prompt', () => {
  for (const cola of [
    'Spoken in Argentine (Rioplatense) accent.',
    'Spoken naturally with an authentic Argentine accent.',
    'Accent: Neutral Latin American Spanish.',
  ]) {
    const out = conAcento(`Camera is static. Dialogue: "Hola." ${cola}`, NORTE);
    assert.ok(!/Argentine|Rioplatense|Neutral Latin/i.test(out), `quedó: ${out}`);
    assert.ok(out.includes(NORTE), out);
  }
});

test('un prompt sin acento igual sale con el acento puesto', () => {
  const out = conAcento('Static camera. The person does not speak.', NORTE);
  assert.equal(out, `Static camera. The person does not speak.\nSpoken in ${NORTE}.`);
});

test('no se acumulan dos acentos al pasarlo dos veces', () => {
  const una = conAcento('Camera is static. Dialogue: "Hola."', NORTE);
  const dos = conAcento(una, NORTE);
  assert.equal(dos, una);
  assert.equal(dos.match(/Spoken in/g)?.length, 1);
});

test('no se come el guion ni la acción al limpiar', () => {
  const out = conAcento(
    'Camera moves backwards smoothly. The person walks forward.\nDialogue: "El cuello de botella eres tú." Spoken in neutral Spanish.',
    NORTE,
  );
  assert.ok(out.includes('El cuello de botella eres tú'), out);
  assert.ok(out.includes('The person walks forward'), out);
});

test('todo acento del catálogo sobrevive intacto al inyectarse', () => {
  // Los paréntesis y los acentos de «(Baja California, Sonora…)» no pueden
  // perderse por el camino. El catálogo se mudó a lib/acento-workspace.ts cuando
  // el acento dejó de ser una pregunta del wizard y pasó a ser un atributo del
  // cliente; este test lo sigue.
  for (const [id, prompt] of Object.entries(ACENTOS_ES)) {
    assert.ok(conAcento('Static camera.', prompt).includes(prompt), `${id}: ${prompt}`);
  }
});

test('el acento de un workspace se RESUELVE, y dice si lo está adivinando', () => {
  // Mauricio está en Tijuana: norte de México. Sale de su zona horaria, que se
  // resuelve sola contra su calendario — o sea que es una inferencia, y el tipo
  // lo dice. Un dato inferido presentado como declarado es cómo se cuela un error
  // que nadie audita.
  const tijuana = resolverAcento(null, 'America/Tijuana');
  assert.equal(tijuana.id, 'mx-norte');
  assert.equal(tijuana.seguro, false);
  assert.equal(tijuana.origen, 'zona-horaria');

  // Lo declarado GANA siempre: un dato que alguien escribió le gana a cualquier
  // inferencia nuestra, por buena que sea.
  const declarado = resolverAcento('ar', 'America/Tijuana');
  assert.equal(declarado.id, 'ar');
  assert.equal(declarado.seguro, true);

  // Y una zona que no está en la tabla NO cae en «entonces es mexicano»: cae en
  // el neutro, marcado como lo que es. El guard va en positivo.
  const raro = resolverAcento(null, 'Asia/Tokyo');
  assert.equal(raro.id, 'latam');
  assert.equal(raro.seguro, false);
});

// ── El PROMPT no sale a pantalla, nunca ──────────────────────────────────────
// «Jamás debe ver prompts»: el prompt es cómo MaKo fabrica el video, del mismo
// orden que la query SQL detrás de una tabla. El cliente compró que le hagan el
// anuncio, no instrucciones para pegar en otra herramienta.

test('el guion que copia el cliente no lleva una sola línea del prompt', () => {
  const plan = {
    puestaId: 'plano-secuencia',
    titulo: 'El incendio del lunes',
    duracionTotalSeg: 16,
    ritmo: 'H O',
    deCorrido: 'A ver, el otro día. Nadie avisó.',
    imagenesNecesarias: [],
    clips: [
      {
        n: 1, segundos: 8, habla: true, voz: 'A ver, **el otro día**.',
        queSeVe: 'Camina por un pasillo', camara: 'Retrocede frente a él',
        prompt: 'Handheld camera tracks backward. Spoken in Mexican Spanish.',
        palabras: 4, tope: 16, voseo: [],
      },
      {
        n: 2, segundos: 8, habla: false, voz: 'Nadie avisó.',
        queSeVe: 'Se sirve un café', camara: 'Orbita de lado a frente',
        prompt: 'Static camera. The person does not speak.',
        palabras: 2, tope: 16, voseo: [],
      },
    ],
  };

  const texto = guionATexto(plan as Parameters<typeof guionATexto>[0]);

  // Lo que SÍ tiene: el título y lo que se dice.
  assert.ok(texto.includes('El incendio del lunes'));
  assert.ok(texto.includes('el otro día'));
  assert.ok(texto.includes('Nadie avisó'));

  // Lo que NO puede tener, ni una palabra.
  for (const fuga of ['Handheld', 'camera', 'Spoken', 'Static', 'Retrocede frente', 'Orbita', 'Camina por un pasillo']) {
    assert.ok(!texto.includes(fuga), `se filtró «${fuga}» al guion del cliente:\n${texto}`);
  }

  // Y los asteriscos del énfasis se van: en pantalla van en negrita, copiados
  // son ruido.
  assert.ok(!texto.includes('**'), texto);
});

// ── El router de proveedor ───────────────────────────────────────────────────

test('el clip mudo va al proveedor barato y el hablado al caro', () => {
  // La regla del curso: un plano de recurso consume la misma cuota y no aporta nada.
  assert.equal(proveedorDeClip(false), 'barato');
  assert.equal(proveedorDeClip(true), 'caro');
});

// ── La duración sale del guion ───────────────────────────────────────────────
// El dueño: «Tampoco tiene que preguntar cuanto debe durar, no tiene sentido.
// Durará lo que dure el guion. Punto.»

import { cabidaDeGuion, soloHablado } from '../lib/puestas-data';

const CIEN = Array.from({ length: 100 }, (_, i) => `palabra${i}`).join(' ');

test('un guion corto NO estira: la puesta impone su piso', () => {
  // Sin piso, tres palabras darían un video de dos segundos. La puesta tiene un
  // mínimo de clips y eso manda.
  const p = puestaPorId('plano-secuencia')!;
  const c = cabidaDeGuion(p, 'Hola, mira esto.');
  assert.equal(c.desborda, false);
  assert.ok(c.segundosReales >= p.clips[0] * p.segundosClip[0], 'respeta el piso de la puesta');
  assert.ok(c.clips >= p.clips[0], 'y el piso de clips');
});

test('un guion que NO entra lo DICE, no se recorta en silencio', () => {
  // Era el modo de falla viejo: repartirDuracion devolvía el techo sin avisar y
  // el guion se grababa cortado.
  const p = puestaPorId('plano-secuencia')!;
  const enorme = Array.from({ length: 900 }, (_, i) => `palabra${i}`).join(' ');
  const c = cabidaDeGuion(p, enorme);
  assert.equal(c.desborda, true);
  assert.ok(c.palabrasDeMas > 0, 'dice CUÁNTAS sobran, que es lo accionable');
  assert.ok(c.segundosReales <= p.clips[1] * p.segundosClip[1], 'nunca promete más de lo que la puesta da');
});

test('la cantidad de clips SIEMPRE cae dentro del rango de la puesta', () => {
  // El saneo del plan tira error si el modelo devuelve otra cantidad, así que un
  // número fuera de rango acá rompe la generación entera más adelante.
  for (const p of puestasOfrecidas()) {
    for (const texto of ['Hola.', CIEN, CIEN + ' ' + CIEN + ' ' + CIEN]) {
      const c = cabidaDeGuion(p, texto);
      assert.ok(c.clips >= p.clips[0] && c.clips <= p.clips[1], `${p.id}: ${c.clips} fuera de ${p.clips}`);
      assert.ok(Number.isInteger(c.clips), `${p.id}: clips no entero`);
    }
  }
});

test('más palabras nunca dan MENOS segundos', () => {
  // Una monotonía que suena obvia y que un redondeo mal puesto rompe.
  const p = puestaPorId('selfie-movimiento')!;
  let previo = 0;
  for (const n of [10, 50, 120, 250, 400]) {
    const t = Array.from({ length: n }, (_, i) => `p${i}`).join(' ');
    const c = cabidaDeGuion(p, t);
    assert.ok(c.segundosReales >= previo, `${n} palabras dio menos que el anterior`);
    previo = c.segundosReales;
  }
});

test('soloHablado saca los rótulos, que no se pronuncian', () => {
  // Si se cuelan, inflan el largo y un guion que entra parece que no — y un aviso
  // de «esto no entra» sobre algo que entra manda a recortar lo que estaba bien.
  const guion = [
    'GANCHO', 'Si tu negocio factura pero no te deja dormir, mira esto.',
    '', 'HISTORIA', 'El año pasado un cliente me dijo lo mismo.',
    '', 'CTA', 'Entra al enlace.',
  ].join('\n');
  const h = soloHablado(guion);
  assert.doesNotMatch(h, /GANCHO|HISTORIA|CTA/, 'no puede quedar ningún rótulo');
  assert.match(h, /factura pero no te deja dormir/);
  assert.equal(h.split(/\s+/).filter(Boolean).length, 23);
});

test('una frase corta en mayúsculas DENTRO del texto no es un rótulo', () => {
  // El corte es por línea sola, no por «está en mayúsculas»: una línea hablada
  // que grita algo sigue siendo hablada.
  const h = soloHablado('GANCHO\nY ahí me dijo: BASTA, no puedo más con esto.');
  assert.match(h, /BASTA/);
  assert.doesNotMatch(h, /^GANCHO/);
});

test('un guion sin rótulos pasa entero', () => {
  const t = 'Hola, te cuento algo que me pasó la semana pasada con un cliente.';
  assert.equal(soloHablado(t), t);
});
