// =============================================================================
// Las pruebas del EXPERTO del Copywriter (evals): lib/copywriter/experto.ts (18/11/2026)
// =============================================================================
// Lo que faltaba (docs/plantillas-reales/copywriter.md, «Sin hacer»): «los evals del experto (un pedido, la salida esperada y
// las verificaciones, como marketingskills)». Los casos viven en tests/_copywriter-experto-evals.ts; acá corre lo DETERMINISTA,
// de verdad, y nunca un modelo:
//   1. cada verificación sale de una regla ESCRITA del método (`copywriter.experto`) o del pedido de adaptar
//      (`copywriter.adaptar.user`): si alguien borra la regla, la verificación queda sin respaldo y esto da rojo;
//   2. el pedido de adaptar se arma entero para cada caso (renderTemplate con `pideParaIA` y `guionParaIA`): ninguna ranura
//      sin llenar, lo que pide la plantilla en su orden y cada sección de la página con su id;
//   3. cada salida del modelo pasa por el MISMO saneo que «Editar» (lib/copywriter/ia.ts: sanearOperaciones → al «tú» → al
//      español → sin lo que nadie pidió → aplicarTodo) y recién ahí se verifica: la buena pasa todas, cada mala da rojo en la
//      que rompe, y lo que el código corrige solo (voseo, inglés, notas, el renglón de la sección) pasa igual;
//   4. la batería cubre cada verificación (verde con una buena, rojo con al menos una mala);
//   5. los pasos del saneo de acá son los de `editar`, en el mismo orden (si `editar` cambia, esto no puede quedar midiendo otro).
// El título de respaldo y el tipo que pone ia.ts después del saneo NO corren acá, a propósito: se mide si el MODELO los puso.
//
// Correr: node --import tsx --test tests/copywriter-experto-evals.test.ts
// PROBADO ROMPIÉNDOLO (18/11/2026), ver el pie.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTAR_USER, DATOS_NEGOCIO, EXPERTO_COPY, PREGUNTA_DE, pideParaIA } from '../lib/copywriter/experto';
import { bloquesDelDoc, textoDeNodo, textoDelDoc } from '../lib/copywriter/doc';
import { aplicarTodo, sanearOperaciones, type Descartada, type OperacionIA, type ResultadoOps } from '../lib/copywriter/operaciones';
import { bloqueIdiomaCopy, cifrasSinFuente, cortaParaSuDuracion, guionParaIA, operacionesAlEspanol, operacionesAlTuteo, sinExtrasNoPedidos, sinIdsDeBloque } from '../lib/copywriter/ia-reglas';
import { bibliotecaParaIA, estructuraParaIA } from '../lib/copywriter/ia-editar';
import { alEspanol } from '../lib/copywriter/al-espanol';
import { alTuteo } from '../lib/al-tuteo';
import { palabrasDe } from '../lib/copywriter/outliers';
import { plantillaPorId, restosDelEjemplo, type Plantilla } from '../lib/copywriter/plantillas';
import { GUIAS } from '../lib/copywriter/plantillas-guias';
import { catalogosLite, conVsl, estructurasDelTipo } from '../lib/copywriter/catalogos';
import type { JsonNodo } from '../lib/copywriter/tipos';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { marcasDeVoseo } from '../lib/puestas-data';
import { contenidoNoConfiable, renderTemplate } from '../lib/prompt-render-pure';
import { slotsDe } from '../lib/editor-landing/ia-reglas';
import { problemasDelEjemplo, sinAcentos } from './_reales';
import { CASOS, IDS_VERIFICACION, type CasoEval, type IdVerificacion, type SalidaModelo } from './_copywriter-experto-evals';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const ESTRUCTURAS = conVsl(ESTRUCTURAS_GUION_DEFAULT);
const lite = catalogosLite(ANGULOS_GUION_DEFAULT, ESTRUCTURAS);
const catalogo = { angulos: new Set(lite.angulos.map((a) => a.id)), estructuras: new Set(lite.estructuras.map((e) => e.id)) };
const casoPorId = (id: string): CasoEval => { const c = CASOS.find((x) => x.id === id); assert.ok(c, `no hay un caso ${id}`); return c!; };
const plantillaDe = (c: CasoEval): Plantilla => { const p = plantillaPorId(lite, c.plantilla); assert.ok(p, `${c.id}: no hay una plantilla ${c.plantilla}`); return p!; };

// ── La página, el saneo y lo que se mide (lo de `editar`, lib/copywriter/ia.ts) ─────────────────────────────────────

type Medida = {
  caso: CasoEval; pl: Plantilla; antes: JsonNodo; despues: JsonNodo;
  ops: OperacionIA[]; descartadas: Descartada[]; titulo: string | null; props: ResultadoOps['props'];
  /** Lo que escribió MaKo: los bloques nuevos, sin los títulos de sección (el `dicho` de ia.ts), y el título de la página. */
  escrito: string; dicho: string; respuesta: string;
  /** Lo que MaKo leyó: el negocio, el pedido y el guion de antes (las fuentes de `cifrasSinFuente` en ia.ts). */
  fuentes: string;
};

const etiquetas = (doc: JsonNodo): string[] => bloquesDelDoc(doc).filter((b) => b.tipo === 'seccion').map((b) => b.seccion!);
/** El texto de una sección (null = lo que hay antes de la primera). */
const seccionDe = (doc: JsonNodo, s: string | null): string => bloquesDelDoc(doc).filter((b) => b.seccion === s && b.tipo !== 'seccion').map((b) => b.texto).join('\n');

const paginas = new Map<string, JsonNodo>();
function paginaDe(c: CasoEval): JsonNodo {
  if (!paginas.has(c.id)) paginas.set(c.id, c.sobre ? correr(casoPorId(c.sobre), casoPorId(c.sobre).buena).despues : plantillaDe(c).esqueleto());
  return paginas.get(c.id)!;
}

function correr(caso: CasoEval, salida: SalidaModelo): Medida {
  const pl = plantillaDe(caso);
  const antes = paginaDe(caso);
  // Lo que el negocio LLAMA así (sus ofertas, el pedido): sus palabras no se pasan al español (ia.ts, `permitido`).
  const permitido = [...caso.ofertas, caso.prompt].join('\n');
  const s = sanearOperaciones(salida.operaciones, antes, catalogo);
  s.ops = operacionesAlTuteo(s.ops);
  s.ops = operacionesAlEspanol(s.ops, permitido);
  s.ops = sinExtrasNoPedidos(s.ops, etiquetas(antes), caso.prompt);
  const r = aplicarTodo(antes, s.ops);
  const nuevos = new Set(r.nuevos);
  const escrito = (r.doc.content ?? []).filter((b) => nuevos.has(b.attrs?.bid as string) && b.type !== 'heading').map(textoDeNodo).join('\n');
  return {
    caso, pl, antes, despues: r.doc, ops: s.ops, descartadas: [...s.descartadas, ...r.descartadas], titulo: r.titulo, props: r.props,
    escrito, dicho: `${r.titulo ?? ''}\n${escrito}`,
    respuesta: alEspanol(alTuteo(salida.respuesta, { citas: true }), permitido),
    fuentes: [caso.negocio, caso.prompt, guionParaIA(antes)].join('\n'),
  };
}

// ── Las verificaciones (marketingskills: `assertions`) ──────────────────────────────────────────────────────────────

const digitos = (t: string) => t.replace(/[.,]/g, '');
/** Los números de un texto, sin los dígitos de los ids de bloque de `guionParaIA` (son al azar: no son una fuente). */
const numerosDe = (t: string): string[] => (sinIdsDeBloque(t).match(/\d+(?:[.,]\d+)*/g) ?? []).map(digitos);
/** Las cifras de 100 o más (las chicas son minutos, segundos y pasos de cualquier pieza). */
const grandes = (t: string): string[] => numerosDe(t).filter((n) => Number(n) >= 100);
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** ¿El texto nombra esa palabra o frase? Sin tildes ni mayúsculas, y entera (`\b` no ve las tildes: AGENTS.md). */
const nombra = (texto: string, frase: string): boolean => new RegExp(`(?<!\\p{L})${escapar(sinAcentos(frase))}(?!\\p{L})`, 'u').test(sinAcentos(texto));

/** Las muletillas que prohíbe el MÉTODO, leídas de su propio renglón (si el método cambia la lista, la verificación la sigue). */
const MULETILLAS: string[] = (() => {
  const linea = EXPERTO_COPY.split('\n').find((l) => l.includes('Escribir con muletillas de máquina')) ?? '';
  return [...linea.slice(linea.indexOf(':') + 1, linea.indexOf('tres adjetivos')).matchAll(/«([^»]+)»/g)].map((m) => m[1]);
})();
const PLATA = /(?:USD|US\$|MXN|\$)\s?(\d(?:[\d.,]*\d)?)|(\d(?:[\d.,]*\d)?)\s*(?:dólares|pesos)/gi;
/** «Quedan 6 lugares» en lo escrito tiene que ser un cupo que el negocio DICE («6 lugares»), no un número cualquiera suyo. */
const CUPO = /quedan\s+(\d+)\s+(?:lugares|cupos|espacios)/gi;
const LUGARES = /(\d+)\s+(?:lugares|cupos|espacios)/gi;
/** «Comenta GUIA», «escríbeme JUNTA»: el verbo y una palabra en MAYÚSCULA (sin la bandera i: con ella \p{Lu} toma minúsculas). */
const PIDE_PALABRA = new RegExp('(?<!\\p{L})(?:[Cc]omenta|[Ee]scr[ií]be(?:me|nos)?|[Ee]nv[ií]a(?:me|nos)?|[Mm][aá]nda(?:me|nos)?)(?!\\p{L})\\s+(?:la palabra\\s+)?[«"]?\\p{Lu}{3,}(?!\\p{L})', 'u');

type Verificacion = { regla: string; en: 'experto' | 'adaptar' | 'idioma'; falla: (m: Medida) => string | null };

const V: Record<IdVerificacion, Verificacion> = {
  'escribe-entera': {
    regla: 'Escribe la pieza ENTERA con escribir_seccion', en: 'adaptar',
    falla: (m) => {
      const sinEscribir = etiquetas(m.antes).filter((s) => !m.ops.some((op) => op.op === 'escribir_seccion' && op.seccion === s) || !seccionDe(m.despues, s).trim());
      if (sinEscribir.length) return `sin escribir: ${sinEscribir.join(', ')}`;
      const guia = Object.values(GUIAS[m.caso.plantilla] ?? {}).find((g) => textoDelDoc(m.despues).includes(g));
      return guia ? `quedó la guía «${guia}»` : null;
    },
  },
  'nada-del-ejemplo': {
    regla: 'y NINGUNO puede quedar en la versión nueva', en: 'adaptar',
    falla: (m) => {
      const restos = restosDelEjemplo(m.despues, m.pl).bloques;
      if (restos) return `${restos} bloque(s) iguales a los del ejemplo`;
      const marca = [m.pl.ejemplo?.negocio ?? '', ...m.caso.delEjemplo].filter(Boolean).find((t) => nombra(m.dicho, t) && !nombra(m.fuentes, t));
      if (marca) return `nombra «${marca}», del negocio ficticio`;
      const delEjemplo = new Set(grandes(textoDelDoc(m.pl.contenido())));
      const leidas = new Set(grandes(m.fuentes));
      const cifra = grandes(m.dicho).find((n) => delEjemplo.has(n) && !leidas.has(n));
      return cifra ? `usa la cifra ${cifra} del ejemplo` : null;
    },
  },
  'sin-cifras-inventadas': {
    regla: 'Inventar cifras, testimonios, nombres de clientes, garantías, fechas o cupos', en: 'experto',
    falla: (m) => {
      const c = cifrasSinFuente(m.dicho, m.fuentes);
      if (c.cifras.length) return `cifras sin fuente: ${c.cifras.join(', ')}`;
      if (c.garantia) return 'promete una garantía que el negocio no da';
      const leidas = new Set(numerosDe(m.fuentes));
      for (const x of m.dicho.matchAll(PLATA)) if (!leidas.has(digitos(x[1] ?? x[2]))) return `un precio sin fuente: «${x[0].trim()}»`;
      const cupos = new Set([...m.fuentes.matchAll(LUGARES)].map((x) => x[1]));
      for (const x of m.dicho.matchAll(CUPO)) if (!cupos.has(x[1])) return `un cupo sin fuente: «${x[0]}»`;
      return null;
    },
  },
  'dato-donde-falta': {
    regla: 'va como [DATO: qué falta]', en: 'adaptar',
    falla: (m) => {
      if (!m.caso.falta.length) return null;
      const datos = [...m.escrito.matchAll(/\[DATO:\s*([^\]]*)\]/g)];
      if (!datos.length) return `el negocio no dice ${m.caso.falta.join(', ')} y no quedó ningún [DATO: …]`;
      return datos.some((d) => !d[1].trim()) ? 'un [DATO: …] vacío' : null;
    },
  },
  'una-pregunta': {
    regla: 'UNA pregunta por el dato que más falta', en: 'adaptar',
    falla: (m) => { const n = (m.respuesta.match(/¿/g) ?? []).length; return n === 1 ? null : `${n} preguntas en la respuesta`; },
  },
  'destacado-arriba': {
    regla: 'Arriba de todo, un destacado de una línea', en: 'adaptar',
    falla: (m) => {
      const primero = (m.despues.content ?? [])[0];
      if (primero?.type !== 'callout') return 'arriba de todo no hay un destacado';
      const t = textoDeNodo(primero);
      if (t.includes('\n') || [...t].length > 200) return 'el destacado no es de una línea';
      return /ejemplo ficticio/i.test(t) || (m.pl.ejemplo && nombra(t, m.pl.ejemplo.negocio)) ? 'el destacado es el del ejemplo' : null;
    },
  },
  'titulo-y-angulo': {
    regla: 'ponle un título propio con {"op": "titulo"}', en: 'adaptar',
    falla: (m) => {
      if (!m.titulo) return 'sin título propio';
      if (sinAcentos(m.titulo) === sinAcentos(m.pl.nombre)) return 'el título es el nombre de la plantilla';
      if (m.pl.ejemplo && nombra(m.titulo, m.pl.ejemplo.negocio)) return 'el título nombra al negocio ficticio';
      return m.props.angulo ? null : 'sin un ángulo de la biblioteca';
    },
  },
  'conserva-la-forma': {
    regla: 'las tablas como tablas', en: 'adaptar',
    falla: (m) => {
      for (const s of etiquetas(m.antes)) {
        const antes = bloquesDelDoc(m.antes).filter((b) => b.seccion === s && b.tipo !== 'seccion');
        const despues = bloquesDelDoc(m.despues).filter((b) => b.seccion === s && b.tipo !== 'seccion');
        if (antes.some((b) => b.tipo === 'tabla') && !despues.some((b) => b.tipo === 'tabla')) return `${s}: la tabla quedó en párrafos`;
        // Los rótulos del esqueleto («- Texto principal: », «- Palabra clave: ») siguen en lo escrito.
        const rotulos = antes.flatMap((b) => [...b.texto.matchAll(/^- ([^:\n]{2,30}):\s*$/gm)].map((x) => x[1]));
        const texto = despues.map((b) => b.texto).join('\n');
        const falta = rotulos.find((r) => !texto.includes(`${r}:`));
        if (falta) return `${s}: sin «${falta}:»`;
      }
      return null;
    },
  },
  'sin-muletillas': {
    regla: 'Escribir con muletillas de máquina', en: 'experto',
    falla: (m) => { const x = MULETILLAS.find((w) => nombra(m.dicho, w)); return x ? `la muletilla «${x}»` : null; },
  },
  'sin-voseo': {
    regla: 'tratando a la audiencia de «tú»', en: 'idioma',
    falla: (m) => { const v = [...marcasDeVoseo(m.dicho), ...marcasDeVoseo(m.respuesta)]; return v.length ? `voseo: ${v.join(', ')}` : null; },
  },
  'reglas-de-meta': {
    regla: 'un título de unos 40', en: 'experto',
    falla: (m) => {
      const titulo = seccionDe(m.despues, 'TEXTO DEL ANUNCIO').match(/Título:\s*«?([^»\n]+)/)?.[1]?.trim();
      if (!titulo) return 'el anuncio no tiene título';
      if ([...titulo].length > 45) return `el título del anuncio tiene ${[...titulo].length} caracteres`;
      return /garantiz/i.test(m.dicho) ? 'promete algo garantizado' : null;
    },
  },
  'palabra-clave': {
    regla: 'solo si el negocio tiene la automatización que la contesta', en: 'experto',
    falla: (m) => {
      if (m.caso.automatizacion !== false) return null;
      const pide = m.escrito.match(PIDE_PALABRA);
      if (pide) return `pide «${pide[0]}» sin la automatización que lo contesta`;
      const valor = m.escrito.match(/Palabra clave:\s*([^\n]*)/)?.[1]?.trim() ?? '';
      return valor && !valor.startsWith('[DATO:') ? `palabra clave «${valor}» sin automatización` : null;
    },
  },
  'reglas-del-email': {
    regla: 'un asunto claro de 40 a 60 caracteres, un solo enlace', en: 'experto',
    falla: (m) => {
      const n = [...seccionDe(m.despues, 'ASUNTO').trim()].length;
      if (n < 40 || n > 60) return `el asunto tiene ${n} caracteres`;
      const enlaces = m.escrito.match(/https?:\/\/\S+/g) ?? [];
      if (enlaces.length > 1) return `${enlaces.length} enlaces`;
      return /P\.\s?D\./.test(seccionDe(m.despues, 'CUERPO')) ? null : 'sin P. D.';
    },
  },
  'largo-de-la-duracion': {
    regla: 'EL LARGO lo da la DURACIÓN de la pieza', en: 'adaptar',
    falla: (m) => {
      const segundos = m.props.duracion ?? m.pl.duracion ?? null;
      const palabras = palabrasDe(m.escrito);
      return cortaParaSuDuracion(palabras, segundos) ? `${palabras} palabras para una pieza de ${segundos} s` : null;
    },
  },
  'toca-solo-lo-pedido': {
    regla: 'Un cambio puntual: tocas solo eso', en: 'experto',
    falla: (m) => {
      const tocar = new Set(m.caso.tocar ?? []);
      for (const s of [null, ...etiquetas(m.antes)]) {
        if (s && tocar.has(s)) continue;
        if (seccionDe(m.antes, s) !== seccionDe(m.despues, s)) return `cambió ${s ?? 'lo de arriba'}, que no se pidió`;
      }
      return [...tocar].some((s) => seccionDe(m.antes, s) !== seccionDe(m.despues, s)) ? null : 'no cambió lo que se pidió';
    },
  },
  'responde-en-una-linea': {
    regla: 'dices qué cambiaste y por qué, en una línea', en: 'experto',
    falla: (m) => (m.respuesta.includes('\n') || [...m.respuesta].length > 200 ? 'la respuesta es más de una línea' : null),
  },
};

/** Las verificaciones de un caso que dan rojo con esa salida: [id, motivo]. */
const rojas = (c: CasoEval, s: SalidaModelo): [IdVerificacion, string][] => {
  const m = correr(c, s);
  return c.assertions.flatMap((id): [IdVerificacion, string][] => { const f = V[id].falla(m); return f ? [[id, f]] : []; });
};
/** Todo el texto que trae una salida, tal cual la escribió el modelo. */
const textoCrudo = (s: SalidaModelo): string => {
  const out: string[] = [];
  const ir = (v: unknown) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(ir); else if (v && typeof v === 'object') Object.values(v).forEach(ir); };
  ir(s.operaciones);
  return out.join('\n');
};

// ── 1 · El método ───────────────────────────────────────────────────────────────────────────────────────────────────

test('1. cada verificación sale de una regla escrita del método o del pedido de adaptar', () => {
  assert.deepEqual(Object.keys(V).sort(), [...IDS_VERIFICACION].sort(), 'una verificación sin su id, o un id sin verificación');
  const fuentes = { experto: EXPERTO_COPY, adaptar: ADAPTAR_USER, idioma: bloqueIdiomaCopy(null) };
  for (const [id, v] of Object.entries(V)) assert.ok(fuentes[v.en].includes(v.regla), `${id}: «${v.regla}» ya no está en ${v.en}`);
  // La lista de muletillas sale del renglón del método: si no se pudo leer, la verificación no mira nada.
  assert.ok(MULETILLAS.length >= 4 && MULETILLAS.includes('descubre'), `las muletillas del método: ${MULETILLAS.join(', ')}`);
  assert.deepEqual(slotsDe(EXPERTO_COPY), [], 'el método va entero, sin ranuras');
});

test('1b. lo que el ejemplo usa del negocio: una pregunta con su ejemplo por dato, en su orden', () => {
  for (const d of DATOS_NEGOCIO) {
    assert.match(PREGUNTA_DE[d].pregunta, /^¿.+\?$/, `${d}: la pregunta`);
    assert.ok(PREGUNTA_DE[d].ejemplo.length > 3, `${d}: el ejemplo de respuesta`);
    assert.deepEqual(problemasDelEjemplo(`${PREGUNTA_DE[d].pregunta} ${PREGUNTA_DE[d].ejemplo}`), [], d);
  }
  assert.equal(pideParaIA([]), '—');
  const tres = pideParaIA(['recurso', 'oferta', 'accion']).split('\n');
  assert.deepEqual(tres.map((l) => l.slice(0, 3)), ['1. ', '2. ', '3. '], 'numeradas');
  assert.ok(tres[0].includes(PREGUNTA_DE.recurso.pregunta) && tres[1].includes(PREGUNTA_DE.oferta.pregunta) && tres[2].includes(PREGUNTA_DE.accion.pregunta), 'en el orden de la plantilla');
  assert.ok(tres[0].includes(`«${PREGUNTA_DE.recurso.ejemplo}»`), 'con su ejemplo');
});

// ── 2 · El pedido de adaptar ────────────────────────────────────────────────────────────────────────────────────────

test('2. el pedido de adaptar se arma entero: sin ranuras vacías, con lo que pide la plantilla y cada sección de la página', () => {
  for (const c of CASOS.filter((x) => x.adaptar)) {
    const pl = plantillaDe(c);
    assert.ok(pl.ejemplo && pl.pide?.length, `${c.id}: la plantilla no tiene ejemplo ni lo que pide`);
    for (const d of c.falta) assert.ok(pl.pide!.includes(d), `${c.id}: «${d}» falta, pero la plantilla no lo pide`);
    const esqueleto = paginaDe(c);
    // La estructura elegida o, sin ella, la primera de su tipo, como en `editar` (lib/copywriter/ia.ts).
    const estructura = pl.estructura ? ESTRUCTURAS.find((e) => e.id === pl.estructura && e.activo) ?? null : null;
    const delTipo = estructurasDelTipo(lite, pl.tipo);
    const idSugerida = estructura ? null : delTipo.propias ? delTipo.estructuras[0]?.id ?? null : null;
    const sugerida = idSugerida ? ESTRUCTURAS.find((e) => e.id === idSugerida) ?? null : null;
    // Las MISMAS variables que arma `editar` con `adaptar`.
    const user = renderTemplate(ADAPTAR_USER, {
      plantilla: pl.nombre,
      ejemplo: `${pl.ejemplo!.negocio}, ${pl.ejemplo!.rubro}`,
      pide: pideParaIA(pl.pide ?? []),
      guion: contenidoNoConfiable(guionParaIA(esqueleto), 'guion'),
      estructura: `${estructuraParaIA(estructura ?? sugerida, !estructura)}${bibliotecaParaIA(lite)}EL EJEMPLO COMPLETO (de ${pl.ejemplo!.negocio}, un negocio FICTICIO: sólo la forma, ningún dato):\n${textoDelDoc(pl.contenido())}\n\n`,
      negocio: `EL NEGOCIO (del Second Brain, sólo lo que hace falta):\n${contenidoNoConfiable(c.negocio, 'negocio')}`,
      charla: `\n\nLA CHARLA HASTA AHORA (lo último):\n${contenidoNoConfiable(`LA PERSONA, AHORA: ${c.prompt}`, 'charla')}`,
    });
    assert.deepEqual(slotsDe(user), [], `${c.id}: una ranura sin llenar`);
    let desde = 0;
    for (const d of pl.pide!) {
      const i = user.indexOf(PREGUNTA_DE[d].pregunta, desde);
      assert.ok(i >= 0, `${c.id}: falta la pregunta de «${d}», o no va en su orden`);
      desde = i;
    }
    for (const b of bloquesDelDoc(esqueleto).filter((x) => x.tipo === 'seccion')) assert.ok(user.includes(`[${b.bid}] ## SECCIÓN ${b.seccion}`), `${c.id}: la sección ${b.seccion} no viaja con su id`);
    assert.ok(user.includes(`<negocio>\n${c.negocio}\n</negocio>`), `${c.id}: el negocio, como datos`);
    assert.ok(user.includes(c.prompt), `${c.id}: lo que pidió la persona`);
    if (estructura) assert.ok(user.includes(estructura.guia.split('\n')[0]), `${c.id}: la guía de su estructura`);
  }
});

// ── 3 · Las salidas ─────────────────────────────────────────────────────────────────────────────────────────────────

test('3. la salida buena de cada caso pasa todas sus verificaciones, después del mismo saneo que «Editar»', () => {
  for (const c of CASOS) {
    assert.deepEqual(rojas(c, c.buena), [], `${c.id}: la buena da rojo`);
    const m = correr(c, c.buena);
    assert.deepEqual(m.descartadas, [], `${c.id}: el saneo descartó operaciones de la buena`);
    assert.deepEqual(problemasDelEjemplo(`${m.dicho}\n${m.respuesta}`), [], `${c.id}: la buena no está en español neutro o nombra a alguien real`);
  }
});

test('3b. cada salida mala da rojo en la verificación que rompe', () => {
  let n = 0;
  for (const c of CASOS) {
    for (const mala of c.malas) {
      assert.ok(c.assertions.includes(mala.rompe), `${c.id}: «${mala.rompe}» no es una verificación del caso`);
      const r = rojas(c, mala.salida);
      assert.ok(r.some(([id]) => id === mala.rompe), `${c.id}: «${mala.porque}» pasó «${mala.rompe}» (rojas: ${JSON.stringify(r)})`);
      n++;
    }
  }
  assert.ok(n >= 20, `sólo ${n} malas`);
});

test('3c. lo que el código corrige solo: con el defecto adentro, después del saneo la salida pasa igual', () => {
  let n = 0;
  for (const c of CASOS) {
    for (const a of c.arregladas ?? []) {
      assert.ok(a.queTiene(textoCrudo(a.salida)).length > 0, `${c.id}: «${a.porque}»: la salida no trae el defecto`);
      const m = correr(c, a.salida);
      assert.deepEqual(a.queTiene(`${m.titulo ?? ''}\n${textoDelDoc(m.despues)}`), [], `${c.id}: «${a.porque}»: el defecto sigue en la página`);
      assert.deepEqual(rojas(c, a.salida), [], `${c.id}: «${a.porque}»: da rojo`);
      n++;
    }
  }
  assert.ok(n >= 5, `sólo ${n} arregladas`);
});

test('4. la batería cubre cada verificación: alguna buena la pasa y alguna mala la rompe', () => {
  for (const id of IDS_VERIFICACION) {
    assert.ok(CASOS.some((c) => c.assertions.includes(id)), `«${id}» no está en ningún caso`);
    assert.ok(CASOS.some((c) => c.malas.some((m) => m.rompe === id)), `«${id}» no tiene una mala que la rompa`);
  }
});

// ── 5 · El saneo de acá es el de «Editar» ───────────────────────────────────────────────────────────────────────────

test('5. los pasos del saneo de acá son los de `editar` (lib/copywriter/ia.ts), en el mismo orden', () => {
  // Sólo los NOMBRES de los pasos, de la primera a la última (renombrar una variable no cambia el saneo, y partir `medir` en
  // dos funciones tampoco: el 18/11/2026 quedó `procesar` + `medirS`, por las piezas largas de ./por-secciones.ts).
  const ia = leer('lib/copywriter/ia.ts');
  const veces = (paso: string) => ia.split(paso).length - 1;
  // UN solo saneo y UN solo «aplicar»: si «Editar» suma otro camino, este test tiene que mirarlo.
  assert.equal(veces('sanearOperaciones('), 1, 'ia.ts sanea en más (o en ningún) lugar: el saneo de este test mide otra cosa');
  assert.equal(veces('aplicarTodo('), 1, 'ia.ts aplica en más (o en ningún) lugar: el saneo de este test mide otra cosa');
  const ini = ia.indexOf('sanearOperaciones(');
  const fin = ia.indexOf('aplicarTodo(', ini);
  assert.ok(fin > ini && fin - ini < 2_500, `del saneo al «aplicar» hay ${fin - ini} caracteres: el recorte mira otra cosa`);
  const saneo = ia.slice(ini, fin + 'aplicarTodo('.length);
  let desde = 0;
  for (const paso of ['sanearOperaciones(', 'operacionesAlTuteo(', 'operacionesAlEspanol(', 'sinExtrasNoPedidos(', 'aplicarTodo(']) {
    const i = saneo.indexOf(paso, desde);
    assert.ok(i >= 0, `«${paso}» ya no está entre el saneo y el «aplicar» de ia.ts, o cambió de lugar: el saneo de este test mide otra cosa`);
    desde = i;
  }
});

// PROBADO ROMPIÉNDOLO (18/11/2026, base 8/0; cada rotura restaurada antes de la siguiente):
//   · `nada-del-ejemplo` siempre en verde (return null)                       → 1 fallo (el 3b: la mala de Andrea y los USD 8,000)
//   · el saneo de acá sin `operacionesAlTuteo`                                 → 1 fallo (el 3c: la del voseo del anuncio)
//   · `sinExtrasNoPedidos` (lib/copywriter/ia-reglas.ts) devolviendo las ops   → 1 fallo (el 3c: las notas de producción)
//   · `pideParaIA` (lib/copywriter/experto.ts) con las preguntas al revés      → 2 fallos (el 1b y el 2)
//   · la regla de la palabra clave cambiada en EXPERTO_COPY                    → 1 fallo (el 1)
//   · ia.ts sin el paso del «tú» (`operacionesAlTuteo`)                         → 1 fallo (el 5)
// El 5 ya sirvió: al mezclar main el mismo día, `medir` se partió en `procesar` + `medirS` (lib/copywriter/por-secciones.ts) y el 5
// dio rojo. El saneo seguía igual; se reescribió para mirar del saneo al «aplicar», sin depender del nombre de la función.
// Y una rotura de verdad que salió escribiendo los casos: con «Hola, {nombre}:» y «Agenda tu llamada de admisión» en la buena
// del email, `nada-del-ejemplo` dio rojo (2 bloques iguales al ejemplo de Voz de Líder), igual que lo diría la página.
// Y otra del producto, que salió corriendo esto: daba rojo UNA vez cada tantas corridas («el 73 %» pasaba sin aviso) porque el
// «73» de un id de bloque al azar de `guionParaIA` contaba como fuente. Se arregló en `cifrasSinFuente` (`sinIdsDeBloque`, con su
// caso en tests/copywriter.test.ts); `numerosDe` de acá saca los ids igual. Después: 25 corridas seguidas, 0 fallos.
