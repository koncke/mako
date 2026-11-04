// =============================================================================
// cerebro-referente-vista — el Second Brain de un gurú tal como se MIRA (4/11/2026)
// =============================================================================
// Martín, mirando el grafo de un gurú: «los nodos son todos iguales, no está bien diseñado como el que ya hicimos, que tienen
// diferentes colores, tamaños y que los títulos van apareciendo y desapareciendo por "sección"».
//
// ⚠️ LA CAUSA NO ERA EL DIBUJO, ERA LA FORMA DEL GRAFO. `armarReferente` (lib/cerebro-referente.ts) cuelga TODAS las clases de una
// raíz, en UNA sola área y encadenadas: el grafo del negocio da colores, tamaños y secciones porque tiene carpetas madre (`n1:`),
// áreas con su color y hubs que crecen con lo que tienen adentro. Con una sola área todo sale de un color; con todas las clases de
// grado 3, todas del mismo tamaño; y sin nodos de nivel 1, no hay «sección» cuyo título quede de lejos. El componente es el mismo
// (app/second-brain/Grafo.tsx): lo que cambia es esto.
//
// LA FORMA, copiada de la construcción de MaKo (lib/cerebro-construccion.ts), que también dibuja algo que no es un negocio:
//   · la RAÍZ (`raiz`) es el curso;
//   · cada MÓDULO del curso es una carpeta madre (`n1:<área>`, nivel 1: su título queda de lejos) y un área con su color;
//   · cada CLASE cuelga de su módulo, encadenada con la anterior del mismo módulo (el método se construye encima);
//   · la SECCIÓN es el módulo; si el curso tiene menos de 4, la sección de adentro (scripts/generar-clases-de-referentes.mjs);
//   · dos clases de MÓDULOS DISTINTOS cuyos títulos comparten una palabra propia se unen, con esa palabra de motivo: sacan al
//     mapa de la forma de estrella y es lo que el panel lista en «Conectado con».
//   · el TAMAÑO: la raíz es la más grande, un módulo más que cualquier clase, y una clase según cuánto enseña (su texto).
//
// ⚠️ LOS IDS DE LAS CLASES SON LOS DE LA CAPA (`ref:<id>:<video>`): lo que el chat cita y pide por id es lo mismo que se toca acá.
// ⚠️ ES PURO: recibe la capa ya leída y no toca el disco ni la red. El texto de una clase NO viaja: sólo su principio, de muestra.
// =============================================================================

import { TIPO_CLASE, type ReferenteDelCerebro } from './cerebro-referente';
import { paraBuscar } from './buscar-tareas';
import type { AreaGrafo, AristaCerebro, Cerebro, NodoCerebro, Taxonomia } from './cerebro-modelo';

/** Los colores de las secciones: los del lienzo del grafo (medidos contra su fondo oscuro), en un orden que separa vecinos. */
export const COLORES_DE_MODULO = [
  'var(--grafo-oferta)', 'var(--grafo-cliente)', 'var(--grafo-razones)', 'var(--grafo-documentos)', 'var(--grafo-funnel)',
  'var(--grafo-voz)', 'var(--grafo-productos)', 'var(--grafo-norte)', 'var(--grafo-avatares)', 'var(--grafo-entregables)',
  'var(--grafo-panorama)',
] as const;

/** Lo que se ve de una clase en el panel: un tramo del principio, nunca la clase entera (el curso más largo son 740 KB). */
export const LARGO_TRAMO_VISTA = 280;
/** Cuántas uniones entre módulos puede tener una clase: más, y el mapa vuelve a ser una telaraña. */
export const TOPE_RELACIONADAS = 2;

/** Los pesos (lib/cerebro-modelo.ts → `radioNodo`): la raíz ~22 px, un módulo al menos ~13, una clase de 8 a ~11. */
const PESO_RAIZ = 53;
const PESO_MODULO = 18;
const PESO_CLASE_TOPE = 12;
const CARACTERES_POR_PESO = 2_500;

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'para', 'con', 'por', 'tu', 'tus', 'su', 'sus', 'que', 'un', 'una', 'sin', 'vs', 'como', 'cómo', 'mi', 'mis', 'of', 'the', 'and', 'to', 'your', 'in']);

/** Una palabra en MAYÚSCULAS de un título todo en mayúsculas: las siglas cortas quedan (PUV, SEO, CTA, ADN, IA). */
function palabraSinGritos(w: string, primera: boolean): string {
  const minus = w.toLocaleLowerCase('es');
  if (!primera && MINUSCULAS.has(minus)) return minus;
  if (/^[\p{Lu}\d]{2,4}$/u.test(w) && !MINUSCULAS.has(minus)) return w;
  return primera ? minus.charAt(0).toLocaleUpperCase('es') + minus.slice(1) : minus;
}

/**
 * El nombre de un módulo para el mapa, sin su numeración: «MODULO 2 - ATENCION» → «Atención» no (no se inventan tildes):
 * → «Atencion»; «Módulo 1_ Génesis Fundacional» → «Génesis Fundacional»; «(3) Systems & Processes» → «Systems & Processes».
 * El número no se pierde: va en el dato «Módulo N de M». Si no queda nada, «Módulo N».
 */
export function nombreDeModulo(g: string, i: number): string {
  let t = g.replace(/\s+/g, ' ').trim();
  for (let k = 0; k < 3; k++) {
    const antes = t;
    t = t
      .replace(/^(?:g\d+\s*[-–_:.]\s*)/i, '')
      .replace(/^(?:m[oó]dulo|modulo|module|fase|semana|parte|sesi[oó]n|bloque|m)\s*\d+(?:\.\d+)?\s*(?:[-–_:.)|]+\s*|\s+(?=\S)|$)/i, '')
      .replace(/^\(?\d+(?:\.\d+)?\)?\s*(?:[-–_:.)]+\s*|\s+(?=\D)|$)/, '')
      .trim();
    if (t === antes) break;
  }
  t = t.replace(/\s*[-–_]\s*M\d+$/i, '').replace(/\s*[-–_:]\s*$/, '').trim();
  if (!t) return `Módulo ${i + 1}`;
  const letras = t.replace(/[^\p{L}]/gu, '');
  if (letras.length > 4 && letras === letras.toLocaleUpperCase('es')) t = t.split(' ').map((w, j) => palabraSinGritos(w, j === 0)).join(' ');
  return t.length > 60 ? `${t.slice(0, 58).trimEnd()}…` : t;
}

/** El id del área de un módulo; su nodo es `n1:<área>` (nivel 1: su título queda de lejos). */
export const areaDeModulo = (i: number): string => `mod-${i + 1}`;
/** La única carpeta del grafo de un curso. */
export const CARPETA_DEL_CURSO = 'curso';

/** Una etiqueta corta para dibujar, cortada en una palabra. */
function corto(s: string, max = 40): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const esp = c.lastIndexOf(' ');
  return `${(esp > max * 0.6 ? c.slice(0, esp) : c).trimEnd()}…`;
}

/** Un tramo del principio de la clase, cortado en un punto si se puede. */
export function tramoDeVista(texto: string, largo = LARGO_TRAMO_VISTA): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (t.length <= largo) return t;
  const c = t.slice(0, largo);
  const punto = c.lastIndexOf('. ');
  return `${(punto > largo * 0.6 ? c.slice(0, punto + 1) : c.slice(0, c.lastIndexOf(' '))).trimEnd()} …`;
}

/** Cuánto pesa una clase en el mapa: más texto, punto más grande (con tope: nunca más que un módulo). */
export const pesoDeClase = (largo: number): number => Math.min(PESO_CLASE_TOPE, Math.floor(largo / CARACTERES_POR_PESO));

/** Minutos aproximados de una clase hablada (~900 caracteres por minuto de transcripción). Un dato, no un rótulo de precisión. */
const minutosDe = (largo: number): number => Math.max(1, Math.round(largo / 900));

/** Las palabras que no dicen de qué trata una clase: están en el título de casi todas. */
const GENERICAS = new Set([
  'clase', 'clases', 'modulo', 'module', 'parte', 'sesion', 'sesiones', 'video', 'videos', 'introduccion', 'bienvenida', 'bienvenido',
  'bienvenidos', 'como', 'para', 'tus', 'que', 'con', 'una', 'los', 'las', 'del', 'por', 'mas', 'paso', 'pasos', 'final', 'resumen',
  'preguntas', 'respuestas', 'pregunta', 'respuesta', 'live', 'vivo', 'directo', 'masterclass', 'workshop', 'semana', 'fase', 'bonus',
  'extra', 'leccion', 'tema', 'the', 'and', 'your', 'how', 'with', 'from', 'what', 'esto', 'este', 'esta', 'todo', 'todos', 'hacer',
  'curso', 'nuevo', 'nueva', 'dia', 'dias', 'grabacion', 'recording', 'tips', 'vamos', 'cosas', 'forma', 'formas', 'manera',
  'ejemplo', 'ejemplos', 'mejor', 'mejores', 'primer', 'primera', 'primero', 'segunda', 'segundo', 'tercera', 'nuestro', 'nuestra',
  'nuestros', 'algunos', 'algunas', 'antes', 'despues', 'sobre', 'entre', 'desde', 'hasta', 'cuando', 'donde', 'porque', 'siempre',
  'nunca', 'mucho', 'muchos', 'nadie', 'tienes', 'puedes', 'debes', 'quieres', 'importante', 'importantes', 'general', 'completo',
  'completa', 'basico', 'basicos', 'avanzado', 'avanzada', 'avanzados', 'herramientas', 'estrategia', 'estrategias', 'replay',
  'introduction', 'welcome', 'lesson', 'part', 'about', 'their', 'there', 'these', 'those', 'which', 'would', 'should',
  'vimos', 'buenas', 'buenos', 'numero', 'otros', 'otras',
]);

/**
 * Las palabras propias de un título: de 5 letras o más, sin números, sin las genéricas y sin VERBOS (un infinitivo o un gerundio:
 * «creando», «vender», «escalar»). Dos clases que comparten «vamos» no tienen nada que ver; dos que comparten «objeciones», sí.
 */
export function palabrasDeTitulo(titulo: string): string[] {
  return [...new Set(paraBuscar(titulo).split(' ').filter((w) =>
    w.length >= 5 && !/\d/.test(w) && !GENERICAS.has(w) && !/(?:ar|er|ir|ando|iendo|endo)$/.test(w)))];
}

const ordenDe = (n: NodoCerebro<string>): number => Number(n.datos?.find((d) => d.k === 'Clase')?.v) || 0;
const moduloDe = (n: NodoCerebro<string>): string => n.datos?.find((d) => d.k === 'Módulo')?.v?.trim() ?? '';

/**
 * El Second Brain de un gurú para MIRARLO: la misma capa que lee el chat (sus clases, con sus ids), con la forma del grafo del
 * negocio. Sin posiciones: las calcula quien la sirve (`layoutCerebro`), igual que la de antes.
 */
export function vistaDeReferente(r: ReferenteDelCerebro, capa: Pick<Cerebro<string>, 'nodos'>): Cerebro<string> {
  const clases = capa.nodos.filter((n) => n.tipo === TIPO_CLASE).sort((a, b) => ordenDe(a) - ordenDe(b));
  // Los módulos, en el orden en que aparecen en el curso. Una clase sin módulo va al de la anterior (o a uno solo).
  const modulos: string[] = [];
  const moduloDeClase = new Map<string, number>();
  for (const c of clases) {
    const g = moduloDe(c) || modulos[modulos.length - 1] || r.curso;
    let i = modulos.indexOf(g);
    if (i < 0) { modulos.push(g); i = modulos.length - 1; }
    moduloDeClase.set(c.id, i);
  }

  const areas: AreaGrafo[] = modulos.map((g, i) => {
    const cuantas = clases.filter((c) => moduloDeClase.get(c.id) === i).length;
    // Un curso de un solo módulo lo nombra como el curso («Social Funnel - Emilio Puigrredó»): repetirlo al lado de la raíz no dice nada.
    const base = modulos.length === 1 ? 'Las clases' : nombreDeModulo(g, i);
    // Dos módulos que se llaman igual una vez limpios («FASE 1 - PREPARACIÓN - M2» y «… - M3») se distinguen por su número.
    const nombre = modulos.some((h, j) => j !== i && nombreDeModulo(h, j) === base) ? `${base} · ${i + 1}` : base;
    return {
      id: areaDeModulo(i), padre: CARPETA_DEL_CURSO, nombre, color: COLORES_DE_MODULO[i % COLORES_DE_MODULO.length],
      que: `Módulo ${i + 1} de ${modulos.length}: ${cuantas} ${cuantas === 1 ? 'clase' : 'clases'}.`,
    };
  });
  // Una sola carpeta, el curso, con sus módulos como secciones: es lo que la barra lateral lista («Módulos»).
  const tax: Taxonomia = {
    carpetas: [{ id: CARPETA_DEL_CURSO, nombre: r.curso, que: `El curso de ${r.completo}, módulo por módulo.` }],
    areas,
  };

  const nodos: NodoCerebro<string>[] = [];
  const aristas: AristaCerebro[] = [];
  nodos.push({
    id: 'raiz', area: areas[0]?.id ?? areaDeModulo(0), tipo: 'Curso', etiqueta: corto(r.curso, 44),
    detalle: `El curso de ${r.completo}: ${clases.length} ${clases.length === 1 ? 'clase' : 'clases'} en ${modulos.length} ${modulos.length === 1 ? 'módulo' : 'módulos'}.`,
    fuente: `«${r.curso}», en Knowledge`, autoria: 'mako', peso: PESO_RAIZ,
  });
  areas.forEach((a, i) => {
    nodos.push({
      id: `n1:${a.id}`, area: a.id, tipo: 'Módulo', etiqueta: corto(a.nombre, 36), detalle: a.que,
      datos: [{ k: 'Módulo', v: `${i + 1} de ${modulos.length}` }],
      fuente: `«${r.curso}»`, autoria: 'mako', peso: PESO_MODULO,
    });
    aristas.push({ de: 'raiz', a: `n1:${a.id}`, motivo: `Un módulo de «${corto(r.curso, 40)}»` });
  });

  const anteriorEnModulo = new Map<number, string>();
  clases.forEach((c, k) => {
    const i = moduloDeClase.get(c.id) ?? 0;
    const a = areas[i];
    const largo = c.cuerpo?.length ?? 0;
    const enModulo = clases.filter((x) => moduloDeClase.get(x.id) === i);
    nodos.push({
      id: c.id, area: a.id, tipo: 'Clase', etiqueta: corto(c.etiqueta, 46),
      // Un tramo del principio, nunca la clase: el curso más largo son 452 clases y 740 KB, y esto viaja al teléfono.
      detalle: c.cuerpo ? tramoDeVista(c.cuerpo) : 'Esta clase no tiene transcripción.',
      datos: [
        { k: 'Clase', v: `${k + 1} de ${clases.length}` },
        { k: 'Módulo', v: a.nombre },
        { k: 'Duración', v: largo ? `unos ${minutosDe(largo)} min` : '' },
      ],
      fuente: `«${r.curso}», clase ${k + 1}`, autoria: 'mako', peso: pesoDeClase(largo),
    });
    aristas.push({ de: `n1:${a.id}`, a: c.id, motivo: `Una clase de ${a.nombre} (${enModulo.indexOf(c) + 1} de ${enModulo.length})` });
    const antes = anteriorEnModulo.get(i);
    // El motivo se lee desde las DOS puntas («Conectado con» de una y de la otra): «la siguiente» mentía en la anterior.
    if (antes) aristas.push({ de: antes, a: c.id, motivo: 'Van seguidas en el curso' });
    anteriorEnModulo.set(i, c.id);
  });

  // Dos clases de módulos distintos cuyos títulos comparten una palabra propia: el motivo es esa palabra, que se puede verificar.
  const palabras = clases.map((c) => ({ c, i: moduloDeClase.get(c.id) ?? 0, ws: palabrasDeTitulo(c.etiqueta) }));
  // Una palabra que está en muchos títulos tampoco dice nada («ventas» en un curso de ventas), ni la que nombra al curso o a su autor.
  const enCuantos = new Map<string, number>();
  for (const p of palabras) for (const w of p.ws) enCuantos.set(w, (enCuantos.get(w) ?? 0) + 1);
  const delCurso = new Set(paraBuscar(`${r.curso} ${r.completo} ${r.nombre}`).split(' '));
  const tope = Math.max(3, Math.ceil(clases.length * 0.04));
  // Y un techo para el mapa entero: con 452 clases salían 318 uniones y el mapa volvía a ser una telaraña.
  const techo = Math.ceil(clases.length / 4);
  let cuantas = 0;
  const usadas = new Map<string, number>();
  const unidas = new Set<string>();
  for (let x = 0; x < palabras.length; x++) {
    for (let y = x + 1; y < palabras.length; y++) {
      const p = palabras[x];
      const q = palabras[y];
      if (p.i === q.i) continue;
      if ((usadas.get(p.c.id) ?? 0) >= TOPE_RELACIONADAS || (usadas.get(q.c.id) ?? 0) >= TOPE_RELACIONADAS) continue;
      if (cuantas >= techo) break;
      const comun = p.ws.find((w) => q.ws.includes(w) && !delCurso.has(w) && (enCuantos.get(w) ?? 0) <= tope);
      if (!comun) continue;
      const clave = `${p.c.id}|${q.c.id}`;
      if (unidas.has(clave)) continue;
      unidas.add(clave);
      usadas.set(p.c.id, (usadas.get(p.c.id) ?? 0) + 1);
      usadas.set(q.c.id, (usadas.get(q.c.id) ?? 0) + 1);
      aristas.push({ de: p.c.id, a: q.c.id, motivo: `Las dos hablan de «${comun}»` });
      cuantas++;
    }
  }

  return {
    negocio: r.curso,
    nodos, aristas,
    cuenta: { total: clases.length, mako: clases.length, usuario: 0, pendientes: 0 },
    vacias: [],
    posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
    taxonomia: tax,
    curso: { nombre: r.curso, de: r.completo, modulos: modulos.length },
  };
}
