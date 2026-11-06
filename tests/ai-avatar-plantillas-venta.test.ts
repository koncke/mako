// =============================================================================
// AI Avatar: las 10 plantillas de venta y sus 5 presets nuevos (tanda AV-1, docs/plantillas-reales/avatar.md)
// =============================================================================
// Una plantilla de venta es un DATO que termina en un video que cobra créditos: el preset decide si el avatar habla, la
// estructura parte el guion en tarjetas, las palabras habladas deciden cuánto dura, y el ejemplo lo lee cualquiera que abra la
// tarjeta. Un dato roto no tira error: deja un avatar mudo, un guion que se planifica corto o un ejemplo con voseo o con el
// nombre de alguien real. Todo se prueba EJECUTANDO las funciones de la casa (`soloHablado`, `cabidaDeGuion`,
// `parsearSecciones`, `problemasDelEjemplo`), no buscando texto en el fuente.
//
// Probado rompiéndolo (06/11/2026). Base: 12 verdes / 0 rojos. Cada rotura, restaurada después, dio (verdes/rojos):
//   · `presetId: 'cafe-un-dia'` en «Mañana en la cocina» (la rotura que pide el plan) → 10/2: «el preset existe y su puesta
//     HABLA» (su puesta es `voz-en-off`: el guion entero saldría en off, con el avatar mudo en cuadro) y «lo hablado… dura lo
//     que dice» (a 2,55 palabras/s ya no son 26 s).
//   · «mil quinientos dólares» → «1,500 dólares» en el guion de «Confesión en el auto» → 11/1: «lo hablado va con letras y
//     dura lo que dice» (un dígito hablado, y 96 palabras dan 32 s, no 33).
//   · «… mira esto» → «… mirá esto» en un gancho de «Mañana en la cocina» → 11/1: «ningún ejemplo nombra a un real, ni vosea…».
//   · `estructuraId: 'pas-viejo'` en «Confesión en el auto» → 9/3: «cada estructura existe», «el guion tiene las etiquetas…»
//     y «los tramos van en el orden…» (sin estructura, nada cuadra).
//   · «natural skin texture» en el prompt de `sala-de-ventas` → 11/1: «los presets nuevos cumplen las reglas de la galería».
//   · `estructuraComoGuion` con `.slice(0, -1)` (sin la última etiqueta) → 11/1: «el esqueleto vacío…».
//   · «[DATO: precio]» en un tramo de «Pizarra» → 11/1: «nada por completar».
//   · el id de «Respondo un comentario» igual al de «Confesión en el auto» → 11/1: «son las 10 del plan…».
//   · la primera etiqueta del guion de «Pantalla dividida» cambiada a DESPUES → 11/1: «el guion tiene las etiquetas de su
//     estructura, en orden».
// Y un cambio sin efecto (renombrar `etiquetasDe` y `conEstructura` en el módulo) lo deja en 12/0.
// Correr: node --import tsx --test tests/ai-avatar-plantillas-venta.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLANTILLAS_VENTA_AVATAR,
  PRESETS_NUEVOS_VENTA,
  NEGOCIOS_ELENCO,
  seccionDelGuion,
  plantillaVentaAvatar,
  estructuraComoGuion,
  type PlantillaVentaAvatar,
} from '../lib/ai-avatar/plantillas-venta';
import { PLANTILLAS_AVATAR, CATEGORIAS, vozSugerida, type PlantillaAvatar } from '../lib/ai-avatar/plantillas';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { parsearSecciones } from '../lib/guion-secciones';
import { puestaPorId, soloHablado, cabidaDeGuion } from '../lib/puestas-data';
import { marcasDeVoseo } from '../lib/voseo';
import { PROMPT_IMAGEN } from '../lib/prompts-imagen';
import { MAX_DETALLE, limpiarDetalle } from '../lib/ai-avatar/prompt-look';
import { TONO_CATEGORIA } from '../lib/ai-avatar/estudio';
import { problemasDelEjemplo } from './_reales';

/** Las mismas guardas que tests/ai-avatar.test.ts aplica a los 28 presets (no están exportadas: se repiten igual). */
const CARA = /\b(face|faces|facial|eyes?|eyebrows?|hair|beard|mustache|jaw|nose|lips?|skin|wrinkles?|freckles?|complexion)\b/i;
const VOS = /\b(tenés|contás|sentís|quedate|mostrás|hablás|anunciás|explicás|sabés|querés|podés|vos)\b/i;
/** La misma idea en español, para el `detalle` (va al prompt como «AJUSTES QUE PIDIÓ LA PERSONA»). Bordes por Unicode. */
const CARA_ES = /(?<!\p{L})(caras?|rostro|pelo|cabello|barba|bigote|piel|ojos?|cejas?|labios?|nariz|arrugas?|pecas?|maquillaje|lentes|anteojos|aretes|edad)(?!\p{L})/iu;

// Desde el 6/11/2026 los 5 presets nuevos ENTRAN a la galería (lib/ai-avatar/plantillas.ts los suma al final): están una
// sola vez en PLANTILLAS_AVATAR, y el test pide que estén ahí.
const PRESETS: readonly PlantillaAvatar[] = PLANTILLAS_AVATAR;
const presetDe = (p: PlantillaVentaAvatar) => PRESETS.find((x) => x.id === p.presetId);

/** Todo el texto de una plantilla que alguien lee o escucha. */
function textosDe(p: PlantillaVentaAvatar): string[] {
  return [
    p.nombre, p.cuando, p.negocio, p.rubro, p.detalle, p.ejemplo.guion,
    ...p.ejemplo.tramos.flatMap((t) => [t.etiqueta, t.texto, t.seVe]),
    ...p.ejemplo.ganchos.flatMap((g) => [g.disparador, g.dice, g.texto]),
    ...p.pide,
  ];
}

test('son las 10 del plan, en su orden, con ids únicos y dos por negocio del elenco', () => {
  assert.deepEqual(PLANTILLAS_VENTA_AVATAR.map((p) => p.id), [
    'confesion-auto', 'respondo-comentario', 'pizarra-metodo', 'manana-cocina', 'episodio-podcast',
    'caso-cliente-oficina', 'recorrido-preventa', 'entrevista-calle', 'carta-fundador', 'renta-o-mensualidad',
  ]);
  assert.equal(new Set(PLANTILLAS_VENTA_AVATAR.map((p) => p.id)).size, PLANTILLAS_VENTA_AVATAR.length, 'ids repetidos');
  for (const p of PLANTILLAS_VENTA_AVATAR) assert.match(p.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${p.id}: no es kebab-case`);
  for (const n of NEGOCIOS_ELENCO) {
    assert.equal(PLANTILLAS_VENTA_AVATAR.filter((p) => p.negocio === n).length, 2, `${n}: no tiene sus dos plantillas`);
  }
});

test('el preset existe y su puesta HABLA: un preset mudo deja el avatar en cuadro sin mover la boca (trampa 1)', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    const preset = presetDe(p);
    assert.ok(preset, `${p.id}: el preset «${p.presetId}» no está ni en PLANTILLAS_AVATAR ni en PRESETS_NUEVOS_VENTA`);
    const puesta = puestaPorId(preset.puestaId);
    assert.ok(puesta, `${p.id}: el formato «${preset.puestaId}» no existe`);
    assert.notEqual(puesta.habla, 'nunca', `${p.id}: el avatar no habla con «${p.presetId}» (${puesta.id})`);
  }
});

test('cada estructura existe, y `estructura` son sus etiquetas, en orden', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    const e = ESTRUCTURAS_GUION_DEFAULT.find((x) => x.id === p.estructuraId);
    assert.ok(e, `${p.id}: la estructura «${p.estructuraId}» no existe en lib/guion-estructuras.ts`);
    assert.ok(p.estructura.length > 0, `${p.id}: sin estructura`);
    assert.deepEqual([...p.estructura], e.etiquetas, `${p.id}: la estructura no son las etiquetas de «${p.estructuraId}»`);
  }
});

test('el esqueleto vacío tiene cada etiqueta, parte en las mismas tarjetas y no suma palabras', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    const esqueleto = estructuraComoGuion(p);
    for (const e of p.estructura) assert.ok(esqueleto.includes(`${e}:`), `${p.id}: el esqueleto no tiene «${e}»`);
    assert.deepEqual(parsearSecciones(esqueleto).map((s) => s.titulo), [...p.estructura], `${p.id}: el esqueleto no parte en sus secciones`);
    assert.equal(soloHablado(esqueleto), '', `${p.id}: el esqueleto tiene algo que se pronunciaría`);
  }
});

test('el guion tiene las etiquetas de su estructura, en orden, cada una con su texto', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    const secciones = parsearSecciones(p.ejemplo.guion);
    assert.deepEqual(secciones.map((s) => s.titulo), [...p.estructura], `${p.id}: las etiquetas del guion no son las de «${p.estructuraId}»`);
    for (const s of secciones) assert.ok(s.texto.trim().length > 0, `${p.id}: «${s.titulo}» vacía`);
  }
});

test('los tramos van en el orden de la estructura, y hay tres ganchos completos', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    assert.ok(p.ejemplo.tramos.length >= p.estructura.length, `${p.id}: menos tramos que secciones`);
    let antes = -1;
    for (const t of p.ejemplo.tramos) {
      const i = p.estructura.indexOf(t.etiqueta);
      assert.ok(i >= 0, `${p.id}: el tramo «${t.etiqueta}» no es una etiqueta de la estructura`);
      assert.ok(i >= antes, `${p.id}: el tramo «${t.etiqueta}» está fuera de orden`);
      antes = i;
      assert.ok(t.seVe.trim(), `${p.id}: un tramo de «${t.etiqueta}» sin lo que se ve`);
    }
    for (const e of p.estructura) assert.ok(p.ejemplo.tramos.some((t) => t.etiqueta === e), `${p.id}: «${e}» sin tramo`);
    assert.equal(p.ejemplo.ganchos.length, 3, `${p.id}: no son tres ganchos`);
    for (const g of p.ejemplo.ganchos) assert.ok(g.disparador.trim() && g.dice.trim() && g.texto.trim(), `${p.id}: un gancho incompleto`);
    assert.equal(new Set(p.ejemplo.ganchos.map((g) => g.disparador)).size, 3, `${p.id}: dos ganchos con el mismo disparador`);
    assert.ok(p.pide.length > 0, `${p.id}: sin «pide», el Director no sabe qué buscar`);
  }
});

test('lo hablado va con letras y dura lo que dice: `duracion` = `cabidaDeGuion`, entre 15 y 45 s, sin desbordar', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    const hablado = soloHablado(p.ejemplo.guion);
    assert.doesNotMatch(hablado, /\d/, `${p.id}: un número hablado en cifras (cuenta como una palabra y la voz se apura)`);
    for (const g of p.ejemplo.ganchos) assert.doesNotMatch(g.dice, /\d/, `${p.id}: el gancho «${g.disparador}» dice un número en cifras`);
    const puesta = puestaPorId(presetDe(p)!.puestaId)!;
    const c = cabidaDeGuion(puesta, hablado);
    assert.equal(c.segundosNecesarios, p.duracion, `${p.id}: dura ${c.segundosNecesarios} s, no ${p.duracion} (${c.palabras} palabras)`);
    assert.equal(c.desborda, false, `${p.id}: el guion no entra en «${puesta.id}»`);
    assert.ok(p.duracion >= 15 && p.duracion <= 45, `${p.id}: ${p.duracion} s está fuera de 15 a 45`);
  }
});

test('el detalle ajusta la escena sin la cara, entra en la barra y ya está limpio; la voz suena', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    assert.doesNotMatch(p.detalle, CARA, `${p.id}: el detalle describe la cara`);
    assert.doesNotMatch(p.detalle, CARA_ES, `${p.id}: el detalle describe la cara`);
    assert.ok(p.detalle.length <= MAX_DETALLE, `${p.id}: el detalle pasa de ${MAX_DETALLE}`);
    assert.equal(limpiarDetalle(p.detalle), p.detalle, `${p.id}: el detalle cambia al limpiarlo`);
    if (p.voz) assert.ok(vozSugerida(p.voz), `${p.id}: la voz «${p.voz}» no está en la galería`);
  }
});

test('ningún ejemplo nombra a un real, ni vosea, ni usa regionalismos', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    for (const t of textosDe(p)) assert.deepEqual(problemasDelEjemplo(t), [], `${p.id}: «${t}»`);
  }
  for (const p of PRESETS_NUEVOS_VENTA) {
    for (const t of [p.nombre, p.resumen, p.lugar, p.guion]) assert.deepEqual(problemasDelEjemplo(t), [], `${p.id}: «${t}»`);
  }
});

test('nada por completar: ningún ejemplo trae «[DATO» ni «[completar]»', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    for (const t of textosDe(p)) {
      assert.doesNotMatch(t, /\[DATO/i, `${p.id}: «${t}»`);
      assert.doesNotMatch(t, /\[completar\]/i, `${p.id}: «${t}»`);
    }
  }
});

test('los presets nuevos cumplen las reglas de la galería (las de tests/ai-avatar.test.ts)', () => {
  assert.deepEqual(PRESETS_NUEVOS_VENTA.map((p) => p.id), ['pizarra-estudio', 'cocina-manana', 'calle-microfono', 'despacho-noche', 'sala-de-ventas']);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length, 'un preset nuevo repite el id de uno de la galería');
  for (const p of PRESETS_NUEVOS_VENTA) assert.ok(PLANTILLAS_AVATAR.includes(p), `${p.id} no entró a la galería`);
  for (const p of PRESETS_NUEVOS_VENTA) {
    const puesta = puestaPorId(p.puestaId);
    assert.ok(puesta, `${p.id}: el formato «${p.puestaId}» no existe`);
    assert.equal(p.puestaId, 'ugc-sin-producto', `${p.id}: el plan los pide en la puesta donde el avatar habla siempre`);
    assert.equal(puesta.habla, 'siempre', `${p.id}: el avatar no habla siempre`);
    assert.doesNotMatch(p.prompt, CARA, `${p.id}: el prompt describe la cara`);
    assert.notEqual(typeof PROMPT_IMAGEN[p.puestaId], 'string', `${p.id}: un formato con prompt validado le ganaría a la escena`);
    for (const t of [p.nombre, p.resumen, p.lugar, p.guion]) {
      assert.doesNotMatch(t, VOS, `${p.id}: «${t}»`);
      assert.deepEqual(marcasDeVoseo(t), [], `${p.id}: «${t}»`);
    }
    assert.ok((CATEGORIAS as readonly string[]).includes(p.categoria), `${p.id}: categoría «${p.categoria}»`);
    assert.ok(TONO_CATEGORIA[p.categoria], `${p.id}: «${p.categoria}» sin su degradado`);
    assert.ok(vozSugerida(p.voz), `${p.id}: la voz «${p.voz}» no está en la galería`);
    assert.ok(p.guion.trim() && p.resumen.trim() && p.lugar.trim(), `${p.id}: incompleto`);
  }
});

test('`plantillaVentaAvatar` encuentra por id y contesta null a lo demás', () => {
  assert.equal(plantillaVentaAvatar('carta-fundador')?.negocio, 'Voz de Líder');
  assert.equal(plantillaVentaAvatar('no-existe'), null);
  assert.equal(plantillaVentaAvatar(''), null);
  assert.equal(plantillaVentaAvatar(42), null);
  assert.equal(plantillaVentaAvatar(undefined), null);
  // Un preset no es una plantilla de venta: son dos listas.
  assert.equal(plantillaVentaAvatar('auto-testimonio'), null);
});

// «Ver ejemplo» (app/ai-avatar/EjemploVenta.tsx) dibuja una fila por sección con lo que se dice en ella: cada sección del
// ejemplo tiene su texto. Probado rompiéndolo: `seccionDelGuion` devolviendo '' → rojo.
test('«Ver ejemplo» encuentra lo que se dice en cada sección del ejemplo', () => {
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    for (const e of p.estructura) assert.ok(seccionDelGuion(p.ejemplo.guion, e, p.estructura).length > 0, `${p.id}: ${e} sin texto`);
  }
});
