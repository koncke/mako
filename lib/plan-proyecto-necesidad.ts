// =============================================================================
// plan-proyecto-necesidad — ¿HACE FALTA un proyecto nuevo?
// =============================================================================
// La otra mitad de `puedeSerProyectoNuevo`, que dice si el nombre TIENE FORMA de
// proyecto. Acá se decide lo otro, que es la pregunta difícil: **si el LUGAR ya existe**.
//
//   Un proyecto nace solo cuando lo que llegó CONSTRUYE un lugar que la app todavía no
//   tiene. No nace cuando USA, AMPLÍA o RENOMBRA un lugar que ya existe — y da igual si
//   trae una tarea o quince.
//
// Reemplaza al umbral `n.cuantas < Math.min(3, tareas.length)`, borrado el 12/8/2026 por
// pedido del dueño: «El filtro NO debe ser porque solo haya 1 tarea… Puede ser que 1 sola
// tarea justifique un proyecto… El filtro debe ser tener criterio».
//
// Y tenía razón medido contra el propio tablero: de 73 proyectos, 9 tienen CERO tareas y
// 14 tienen una sola, casi todos legítimos («Feature: Carousels» es una tab real del
// sidebar). Mientras tanto «Feature: Content Machine», que no debía nacer, traía DOS. El
// que tenía más tareas era el que estaba peor. Contar nunca midió lo que importaba, y
// encima hacía que el veredicto dependiera de con quién viajó la tarjeta en el mensaje de
// WhatsApp: la misma propuesta, sola o en un lote de diez, daba distinto.
//
// Los cinco chequeos son las formas VERIFICABLES de «el lugar ya existe»: no trae nada
// adentro (C0), es otro rótulo del mismo lugar (C1), es un tema que se reparte (C2), la
// tarea lo da por existente (C3), o lo único que se hace es MIRARLO (C4).
//
// ⚠️ Ninguno mira SIGNIFICADO: son caracteres. El duplicado por sinónimo —«Feature:
// Notificaciones Push» contra el transversal «Avisos y reportes»— pasa los cinco. Está
// anotado en docs/hallazgos-plan.md y no se tapa con un piso de cobertura léxica: se
// midió contra el catálogo real y reproduce el reparto por palabra suelta.
//
// SIN 'server-only' a propósito: `mako-guardian` no se puede importar desde un test y
// esta es la lógica que hay que cubrir. Mismo criterio que `tareas-dedup.ts`.
// =============================================================================

import { nucleo } from './plan-proyectos-catalogo';
import { normTitulo } from './tareas-dedup';

export type Semilla = { titulo: string; detalle?: string };
export type Veredicto = { ok: true } | { ok: false; motivo: string };

const escRx = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Palabras que NO cambian de qué lugar se habla: adjetivos de cambio y conectores. */
const MODIF = new Set([
  'mejoras', 'mejora', 'ajustes', 'ajuste', 'arreglos', 'arreglo', 'fixes', 'rediseno',
  'optimizacion', 'optimizaciones', 'avanzado', 'avanzada', 'nuevo', 'nueva', 'general',
  'v2', 'v3', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'para', 'por',
  'con', 'un', 'una', 'al', 'a', 'sobre',
]);

/**
 * Las palabras con contenido de un nombre de proyecto: sin prefijo, sin acentos y SIN
 * PUNTUACIÓN.
 *
 * Los dos normalizadores hacen falta y por eso se componen. `nucleo()` saca el prefijo
 * («Feature: ») y los acentos pero deja la puntuación; `normTitulo()` saca la puntuación
 * pero no sabe de prefijos. Usar uno solo deja la puerta abierta: con `nucleo()` a secas,
 * «Feature: Ads-Manager» tokeniza distinto que «Feature: Ads Manager» y esquiva C1.
 */
export const tokensDeNombre = (nombre: string): string[] =>
  normTitulo(nucleo(nombre)).split(' ').filter((w) => w && !MODIF.has(w));

// ─────────────────────────────────────────────────────────────────────────────
// C0 — una propuesta sin tareas no es una propuesta
// ─────────────────────────────────────────────────────────────────────────────
/**
 * El más barato y el único con cero falsos positivos. Va primero, y va explícito porque
 * hoy esta regla existía DE CONTRABANDO adentro del umbral que estamos borrando
 * (`0 < Math.min(3, n)` es siempre verdadero) y se iba con él sin que nadie lo notara.
 *
 * Lo que deja una propuesta vacía está a la vista: «Feature: Landing» nació el 11/8 y
 * quedó con 0 tareas — una columna muerta en el tablero.
 */
export function traeTareas(idx: number[]): Veredicto {
  return idx.length
    ? { ok: true }
    : { ok: false, motivo: 'la propuesta no trae ninguna tarea: nacería vacía, que es la columna muerta que dejó «Feature: Landing»' };
}

// ─────────────────────────────────────────────────────────────────────────────
// C1 — el mismo lugar con un adjetivo delante
// ─────────────────────────────────────────────────────────────────────────────
/**
 * «Mejoras del Ads Manager» es «Feature: Ads Manager» con un rótulo distinto. Tres tareas
 * sobre un filtro, el orden de las columnas y un botón se van a buscar ahí.
 *
 * Este chequeo tapa un agujero que HOY no tapa nada, y es el que refuta el conteo por sí
 * solo: «Mejoras del Ads Manager» pasa las cuatro barreras vigentes (4 palabras, «Mejoras»
 * no es un verbo de la lista, no está en `canon`, y trae TRES tareas) siendo literalmente
 * el ejemplo «NO» que el prompt tiene escrito. Tiene más tareas que los casos legítimos.
 *
 * ⚠️ LA ASIMETRÍA ES LA REGLA ENTERA. Se rechaza cuando las palabras con contenido son
 * las MISMAS, no cuando una contiene a la otra. Agregar un MODIFICADOR es la misma tab;
 * agregar un SUSTANTIVO que cambia la cosa es otro lugar: `{email, analyst}` ≠ `{email}`.
 * Un veto por contención genérica rompería el patrón de nombres de la casa, donde
 * «Feature: CRM automático» convive con «Feature: CRM» y «Feature: Landing Analyst» con
 * «Vender MaKo: Landing y VSL».
 */
export function esOtroRotulo(nombre: string, destinos: Array<{ nombre: string }>): Veredicto {
  const tp = tokensDeNombre(nombre);
  if (!tp.length) return { ok: true };
  const clave = [...tp].sort().join(' ');
  for (const d of destinos) {
    const td = tokensDeNombre(d.nombre);
    if (td.length && [...td].sort().join(' ') === clave) {
      return { ok: false, motivo: `es «${d.nombre}» con otro rótulo: sacando los adjetivos queda el mismo nombre, y ahí es donde alguien lo iría a buscar` };
    }
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// C2 — una palabra que ya vive adentro de varios nombres es un TEMA, no un lugar
// ─────────────────────────────────────────────────────────────────────────────
/**
 * «Landing» está adentro de «Feature: Landing Analyst», «Feature: Landing Generator» y
 * «Vender MaKo: Landing y VSL». Un proyecto llamado «Landing» no es un lugar que falta:
 * es un tema que ya está repartido, y abrirlo le saca trabajo a los tres.
 *
 * Solo aplica a nombres de UNA palabra, y el umbral es TRES destinos.
 *
 * ⚠️ EL TRES NO ES UNA INTUICIÓN, ESTÁ MEDIDO, y el 2 que parecía razonable estaba mal:
 * corrido contra el catálogo real, un umbral de 2 rechaza CUATRO tabs que existen y son
 * legítimas — «Feature: CRM» (por «Agente: CRM automático»), «Feature: WhatsApp» (por
 * «WhatsApp de MaKo»), «Feature: Email» (por «Sales Email») e «Feature: Instagram» (por
 * «Vender MaKo: Orgánico Instagram»). Un proyecto padre conviviendo con uno derivado es
 * el patrón de nombres de la casa, no una anomalía. Con 3, ninguna palabra de una tab
 * real llega al corte y «landing» —que está en Landing Analyst, Landing Generator y
 * Vender MaKo: Landing y VSL— sigue cayendo.
 *
 * FALSO POSITIVO QUE ASUME: una tab nueva de una sola palabra cuya palabra ya vive en
 * tres nombres compuestos. Hoy le pasaría a «Feature: VSL» y a «Feature: YouTube», y en
 * los dos casos el rechazo es correcto: son temas repartidos, no lugares que faltan.
 *
 * ⚠️ El margen se achica solo a medida que crece el catálogo. El test «el catálogo real no
 * se auto-rechaza» es el que avisa cuando se acabó: si empieza a fallar, el umbral hay que
 * recalibrarlo o el chequeo se cae, no forzar el test.
 */
export function esTemaQueAtraviesa(nombre: string, destinos: Array<{ nombre: string }>): Veredicto {
  const tp = tokensDeNombre(nombre);
  if (tp.length !== 1) return { ok: true };
  const w = tp[0];
  const dentro = destinos.filter((d) => tokensDeNombre(d.nombre).includes(w));
  if (dentro.length >= 3) {
    const cuales = dentro.slice(0, 3).map((d) => `«${d.nombre}»`).join(', ');
    return { ok: false, motivo: `«${w}» ya vive adentro de ${dentro.length} proyectos (${cuales}): es un TEMA que se reparte, no un lugar que falta` };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// C3 — la tarea dice que el trabajo va ADENTRO: para quien la escribió, el lugar existe
// ─────────────────────────────────────────────────────────────────────────────
/**
 * «Agregar un módulo de capacidad operativa EN el Focus Tracker» no funda «Focus
 * Tracker»: la tarea ya lo está dando por existente. Si la tarea dice «en X», X no es el
 * proyecto nuevo — X es el destino que hay que buscar en la lista.
 *
 * ⚠️ SOLO preposiciones LOCATIVAS. «de» y «del» quedan afuera a propósito: «Construir la
 * tab de Facturación» es la forma normal de pedir algo que NO existe, y meterlas mata el
 * caso legítimo que el prompt tiene escrito como su único ejemplo del «SÍ».
 */
const LOCATIVA = '(?:en|al|a la|a los|a las|dentro de|dentro del|adentro de)';

export function presuponeElLugar(nombre: string, semillas: Semilla[]): Veredicto {
  const nuc = normTitulo(nucleo(nombre));
  if (nuc.length < 4) return { ok: true };
  const rx = new RegExp(`\\b${LOCATIVA}\\s+(?:el |la |los |las )?(?:feature |agente )?${escRx(nuc)}\\b`);
  for (const t of semillas) {
    if (rx.test(normTitulo(`${t.titulo} ${t.detalle ?? ''}`))) {
      return { ok: false, motivo: `sus tareas dicen que el trabajo va ADENTRO de «${nombre}»: para quien las escribió ese lugar YA existe. Si de verdad falta, va al catálogo, no por acá` };
    }
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// C4 — MIRAR no funda una pantalla
// ─────────────────────────────────────────────────────────────────────────────
/**
 * La traducción ejecutable de la frase del dueño: «es evidente que la tarea de analizar a
 * la competencia NO requiere una nueva feature».
 *
 * Por qué es evidente: lo que queda cuando una tarea de MIRAR termina es un DOCUMENTO, y
 * un documento no necesita una tab — se guarda en la pantalla que lo va a usar. Mirar es
 * el USO de un lugar, no la construcción de uno. El lugar donde se analiza competencia ya
 * existe y se llama «Feature: Competitor Spy».
 *
 * Respaldo medido sobre el tablero: de 579 tareas, 69 arrancan con un verbo de investigar.
 * Se repartieron entre 35 proyectos que ya existían y **una sola parió un proyecto: la
 * mala**.
 */
const LEX_MIRAR = /^(?:analiz|investig|evalu|revis|recopil|audit|relev|estudi|explor|diagnostic|mape|document|replic)\w*$|^(?:analisis|investigacion|relevamiento|auditoria|benchmark|estudio|insights|research|comparativa|comparacion|comparativo|comparar)$/;

/**
 * Se mira SOLO el título, y solo sus DOS primeras palabras.
 *
 * El detalle queda afuera porque siempre arranca contando contexto y volvería
 * «construcción» a cualquier cosa. Las dos primeras palabras y no la primera, para que un
 * «[Ads] Analizar el creativo» no apague el chequeo con un corchete.
 *
 * Van también las formas NOMINALES («Análisis de los SaaS», «Benchmark de…»): con solo el
 * infinitivo, el chequeo se esquiva escribiendo un sustantivo, y es el mismo pedido.
 */
export const esMirar = (titulo: string): boolean =>
  normTitulo(titulo).split(' ').filter(Boolean).slice(0, 2).some((w) => LEX_MIRAR.test(w));

const TIENE_PREFIJO = /^(?:feature|agente)\s*:/i;

export function mirarNoFunda(nombre: string, semillas: Semilla[]): Veredicto {
  // ⚠️ SOLO para lo que se PROGRAMA, y esta línea no es una excepción cosmética: es lo
  // que salva a «Legal y fiscal». Un área del negocio se releva, se evalúa y se audita, y
  // sigue faltando. Su ausencia ya costó caro una vez — los Términos de Servicio cayeron
  // en «Landing y VSL» y la apertura de la LLC en «Cobros y planes», y ninguna de las dos
  // pantallas tiene nada que ver: eso no se programa, se firma y se paga.
  if (!TIENE_PREFIJO.test(nombre.trim())) return { ok: true };
  // Unanimidad, no mayoría: un lote MIXTO sí puede fundar. «Feature: YouTube Analyst» —de
  // los dos únicos proyectos que el Perro abrió con aval en todo el tablero— trae 3 tareas
  // de investigar y 2 de construir, y es legítimo.
  if (!semillas.length || !semillas.every((t) => esMirar(t.titulo))) return { ok: true };
  return { ok: false, motivo: 'todas sus tareas son de MIRAR (analizar, investigar, relevar, replicar): eso produce un documento, y un documento se guarda en la pantalla que lo va a usar. Mirar es el USO de un lugar, no la construcción de uno' };
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Los cinco, en orden: de más barato a más caro, y de más seguro a más dudoso. El primero
 * que rechaza corta, así que el motivo que sale es siempre el más confiable de los que
 * aplicaban.
 *
 * ⚠️ NINGUNO cuenta tareas ni mira el tamaño del lote, y eso es el pedido, no un detalle.
 * El veredicto no puede depender de con quién viajó la tarjeta en el mensaje de WhatsApp:
 * la misma propuesta, sola o acompañada, tiene que dar lo mismo.
 */
export function haceFaltaUnProyecto(
  n: { nombre: string; tareas: number[] },
  semillas: Semilla[],
  destinos: Array<{ nombre: string }>,
): Veredicto {
  const pasos: Veredicto[] = [
    traeTareas(n.tareas),
    esOtroRotulo(n.nombre, destinos),
    esTemaQueAtraviesa(n.nombre, destinos),
    presuponeElLugar(n.nombre, semillas),
    mirarNoFunda(n.nombre, semillas),
  ];
  return pasos.find((p) => !p.ok) ?? { ok: true };
}
