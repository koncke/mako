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
  duracionReal, clipsParaDuracion, segundosDe, DURACIONES_VIDEO,
  ACENTOS, acentoPrompt, acentoEsVoseante,
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

test('el reparto nunca produce un clip fuera del rango de la puesta', () => {
  for (const p of CATALOGO_PUESTAS) {
    for (const d of DURACIONES_VIDEO) {
      const total = segundosDe(d.value);
      const clips = clipsParaDuracion(p, total);
      for (const seg of repartirDuracion(p, clips, total)) {
        assert.ok(
          seg >= p.segundosClip[0] && seg <= p.segundosClip[1],
          `${p.id} @${total}s → clip de ${seg}s, rango [${p.segundosClip}]`,
        );
      }
    }
  }
});

test('la cantidad de clips nunca sale del rango de la puesta', () => {
  for (const p of CATALOGO_PUESTAS) {
    for (const d of DURACIONES_VIDEO) {
      const n = clipsParaDuracion(p, segundosDe(d.value));
      assert.ok(n >= p.clips[0] && n <= p.clips[1], `${p.id} @${d.value}s → ${n} clips`);
    }
  }
});

// La pantalla muestra la duración REAL, no la del selector, y avisa cuando difiere.
// Si `duracionReal` dejara de coincidir con lo que reparte el motor, el aviso
// mentiría — que es peor que no tenerlo.
test('la duración que anuncia la pantalla es la que reparte el motor', () => {
  for (const p of CATALOGO_PUESTAS) {
    for (const d of DURACIONES_VIDEO) {
      const total = segundosDe(d.value);
      const anunciada = duracionReal(p, total);
      const repartida = repartirDuracion(p, anunciada.clips, total).reduce((a, b) => a + b, 0);
      assert.equal(anunciada.segundos, repartida, `${p.id} @${total}s`);
    }
  }
});

test('una puesta con piso alto NO finge que entrega una duración corta', () => {
  const p = puestaPorId('plano-secuencia')!; // 7 clips × 8 s = 56 s de piso
  assert.ok(duracionReal(p, 30).segundos > 30);
});

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

test('el acento argentino es el ÚNICO donde el voseo no se marca', () => {
  const voseantes = ACENTOS.filter((a) => acentoEsVoseante(a.value)).map((a) => a.value);
  assert.deepEqual(voseantes, ['ar']);
});

test('cada acento del catálogo lleva su texto para el prompt, en inglés', () => {
  for (const a of ACENTOS) {
    const p = acentoPrompt(a.value);
    assert.ok(p.length > 8, `${a.value}: «${p}»`);
    assert.match(p, /Spanish/, `${a.value} no nombra el idioma: «${p}»`);
  }
});

test('un acento desconocido cae en México neutro, no en vacío', () => {
  // La audiencia del negocio es de México: el default no puede ser un string vacío
  // que deje al modelo eligiendo el acento por su cuenta.
  assert.equal(acentoPrompt('no-existe'), acentoPrompt('mx-neutro'));
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
  // Los paréntesis y los acentos de «(norteño)» no pueden perderse por el camino.
  for (const a of ACENTOS) {
    const p = acentoPrompt(a.value);
    assert.ok(conAcento('Static camera.', p).includes(p), `${a.value}: ${p}`);
  }
});

// ── El router de proveedor ───────────────────────────────────────────────────

test('el clip mudo va al proveedor barato y el hablado al caro', () => {
  // La regla del curso: un plano de recurso consume la misma cuota y no aporta nada.
  assert.equal(proveedorDeClip(false), 'barato');
  assert.equal(proveedorDeClip(true), 'caro');
});
