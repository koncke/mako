// =============================================================================
// landing-pulso — el pulso de cada página: tipos, topes y la parte PURA
// =============================================================================
// Los clics viven en `vsl_events` desde el snippet v6 y el scroll desde el v19, y
// hasta hoy los leía UNA sola pantalla: el recorrido de un lead
// (lib/leads.ts → app/crm/lead-view/TrackingTimelineCard.tsx). O sea que el dato
// contestaba «¿qué hizo ESTA persona?» y nunca «¿qué hace la gente en esta
// página?», que es la pregunta que mueve una decisión sobre la landing.
//
// Este módulo es esa segunda pregunta, y son solo dos:
//   · ¿LLEGAN A LA OFERTA? → profundidad de scroll por hitos (25/50/75/100).
//   · ¿QUÉ BOTÓN TOCAN?    → clics agrupados por destino, con PERSONAS distintas.
//
// ─────────────────────────────────────────────────────────────────────────────
// TRES REGLAS QUE ESTE ARCHIVO NO NEGOCIA
// ─────────────────────────────────────────────────────────────────────────────
// 1. EL CERO Y EL «NO PUDE LEER» NO SON LO MISMO. Cada bloque se lee aparte y un
//    error NO se convierte en 0: se devuelve en `fallas` y la pantalla lo dice.
//    Un 0% dibujado sobre una consulta que falló es una medición fantasma, y en
//    este producto ya costó 18 días de ceguera (ver lib/vsl-retencion.ts).
// 2. EL DENOMINADOR DE LA PROFUNDIDAD SON LAS PERSONAS CON SCROLL MEDIDO, no las
//    que entraron. El scroll existe desde el snippet v19: en un workspace que
//    todavía tiene el Pixel viejo, dividir por los visitantes daría «el 0,2%
//    llega a la oferta» cuando la verdad es «no se está midiendo». `base` viaja
//    al lado de `visitantes` justo para que la pantalla pueda mostrar el hueco.
// 3. UN EVENTO SIN `landing_url` NO SE ATRIBUYE A NINGUNA PÁGINA. Los eventos de
//    un Pixel anterior al v12 traen NULL y nunca van a traer otra cosa.
//    `landingDiagnostico` los deja pasar a propósito (allá la pregunta es «¿anda
//    mi Pixel?» y descartarlos pintaría en rojo a quien solo lo tiene viejo);
//    acá la pregunta es «¿en CUÁL de mis páginas?» y repartirlos sería inventar.
//    Se cuentan aparte, en `eventosSinPagina`, y la pantalla ofrece repegarlo.
// =============================================================================

// ⚠️ SIN `server-only`, A PROPOSITO, igual que lib/clic-ruido.ts y
// lib/landing-paginas.ts. Dos razones y las dos son duras:
//   · La PANTALLA (app/landing-analyst/PulsoPaginas.tsx, 'use client') importa de
//     aca las constantes de version del Pixel. Con `server-only` puesto, importar
//     un VALOR desde un modulo de cliente rompe el build — y lo caza
//     tests/frontera-use-client.test.ts.
//   · Y la parte que se puede equivocar es esta: partir el `detalle` de un clic,
//     agrupar por destino y leer la profundidad sin dibujar un cero. Adentro de un
//     modulo con `server-only` ningun test la puede importar, y termina siendo lo
//     unico sin red justo donde duele.
// La LECTURA (que toca Supabase) vive en lib/landing-pulso-server.ts.
// El destino de un clic ya tenía quien lo acortara, con test propio: se reusa en
// vez de escribir el segundo `new URL()` del repo sobre el mismo campo libre.
import { destinoCorto } from '@/app/crm/lead-view/clic-detalle';

/**
 * Ventana por defecto, en días.
 *
 * ⚠️ NO ES COSMÉTICA Y VIAJA A LA PANTALLA (`PulsoDatos.dias`). `landing_visits`
 * no se puede filtrar por página en la base —el beacon guarda `location.href`
 * con sus utm, así que la comparación es normalizada y en memoria—, o sea que la
 * ventana es lo ÚNICO que acota esa lectura. Sin ella, un workspace con años de
 * tráfico pagaría el barrido entero para contestar «¿llegan a la oferta?».
 *
 * 90 días y no 30 porque una landing con poco tráfico necesita juntar gente para
 * que la profundidad diga algo, y no 365 porque la página de hace un año es otra
 * página. Quien mire la pantalla tiene que ver de qué ventana habla el número:
 * un número sin su ventana no se puede comparar con nada.
 */
export const PULSO_DIAS = 90;

/** Hitos de scroll que emite el snippet (v19). No se inventan otros. */
export const HITOS_SCROLL = [25, 50, 75, 100] as const;

/**
 * Desde qué versión del Pixel existe cada medición. Viven acá y no escritas a
 * mano en la pantalla porque son la única explicación honesta de un bloque
 * vacío: sin ellas, una página con el Pixel v14 muestra la profundidad en blanco
 * y lo único que se puede decir es «no hay datos» — que suena a que nadie entró.
 * Con ellas se puede decir qué falta y dónde se arregla.
 *
 * Salen del catálogo de novedades de lib/landing-token.ts: los clics llegaron en
 * la v6 y el scroll en la v19.
 */
export const PIXEL_CLICS_DESDE = 6;
export const PIXEL_SCROLL_DESDE = 19;
/** Desde esta versión el evento dice de qué página vino (mig 0137). */
export const PIXEL_PAGINA_DESDE = 12;

/** Tope de filas de la lista de clics. Más que esto no es una lista, es un dump. */
export const MAX_CLICS = 12;

/** Qué bloque no se pudo leer. La pantalla dibuja «no pude leer» en ESE bloque. */
export type BloquePulso = 'visitas' | 'scroll' | 'clics' | 'paginas' | 'pixel';

export type FallaPulso = { bloque: BloquePulso; mensaje: string };

export type ClicAgrupado = {
  /** Identidad de la fila: el destino, o `boton: <texto>` si no tenía href. */
  clave: string;
  /** El texto que leyó la persona antes de apretar. null si el elemento no tenía. */
  texto: string | null;
  /** El destino acortado para un renglón. null cuando no hay destino que mostrar. */
  destino: string | null;
  clics: number;
  /**
   * Personas DISTINTAS que lo tocaron. Tres clics de la misma persona no son tres
   * personas, y en una landing con un CTA que scrollea es el caso normal: se
   * aprieta, se vuelve arriba, se aprieta otra vez.
   */
  personas: number;
};

export type Profundidad = {
  /**
   * Personas con scroll medido en esta página. EL DENOMINADOR. Si es 0 este
   * objeto no existe (la profundidad viaja como null): no se dibuja un 0%.
   */
  base: number;
  hitos: Array<{ hito: number; personas: number }>;
  /**
   * El escalón donde se va más gente. `desde: 0` es el primer escalón — entrar y
   * no llegar ni al 25%. null cuando no hay dos puntos que comparar.
   */
  mayorCaida: { desde: number; hasta: number; personas: number } | null;
};

export type PulsoPagina = {
  url: string;
  visitas: number;
  visitantes: number;
  /** Primera y última visita DE ESTA PÁGINA dentro de la ventana. */
  primera: string | null;
  ultima: string | null;
  /** null = NO SE MIDIÓ el scroll acá. Nunca 0%. */
  profundidad: Profundidad | null;
  clics: ClicAgrupado[];
  /** Filas de clics que no entraron en el tope. 0 = la lista está completa. */
  clicsRestantes: number;
  /** Clics descartados por ser el sello del constructor (lib/clic-ruido.ts). */
  clicsDelConstructor: number;
  /** La persona la guardó en su lista de páginas (y no solo la vimos pasar). */
  guardada: boolean;
};

export type PulsoDatos = {
  dias: number;
  /** Ordenadas por visitas, de más a menos. */
  paginas: PulsoPagina[];
  /** Clics y scrolls que no dicen de qué página son (Pixel anterior al v12). */
  eventosSinPagina: number;
  /**
   * Qué versión del Pixel reportó este workspace. null = no se pudo preguntar
   * (y entonces no se afirma nada sobre el código).
   *
   * `instalada: 0` significa que no hay código acuñado todavía: ni viejo ni al
   * día, directamente no hay Pixel. Es otro estado y la pantalla lo dice.
   */
  pixel: { instalada: number; actual: number; viejo: boolean; novedades: string | null } | null;
  /** Vacío = se leyó todo. Con algo adentro, ESE bloque no se puede afirmar. */
  fallas: FallaPulso[];
};

// ─────────────────────────────────────────────────────────────────────────────
// La parte PURA (con test): agrupar clics y leer la profundidad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parte el `detalle` de un clic en la clave con la que se agrupa y el texto.
 *
 * Los tres formatos que escribe el snippet (y son todos — ver mig 0133):
 *   · `boton: Agendar ahora`              — el elemento no tenía href
 *   · `ancla #registro — Ver precios`     — un ancla de la misma página
 *   · `https://negocioejemplo.com — Ver`  — un link, con su texto si lo había
 *
 * ⚠️ SE AGRUPA POR DESTINO Y NO POR EL CRUDO. El mismo botón puede llegar con dos
 * textos distintos —el snippet lee `innerText`, que cambia si la página lo
 * reescribe o si hay dos botones al mismo lugar («Agendar» arriba, «Empezar» al
 * final»)—, y agrupando por el crudo la lista muestra el mismo destino tres veces
 * con un tercio de los clics cada vez. El destino manda, igual que en el dato.
 *
 * Un detalle vacío NO se descarta: hubo un clic y no sabemos en qué. Esconderlo
 * sería tirar una medición real, que es la regla que ya fija lib/clic-ruido.ts.
 */
export function clavePorClic(detalle: string | null | undefined): { clave: string; texto: string | null } {
  const raw = (detalle ?? '').trim();
  if (!raw) return { clave: '(sin destino)', texto: null };
  // Se busca `boton:` SIN el espacio: el snippet manda `'boton: ' + texto`, así que
  // un botón sin texto llega como `boton: ` pelado y el `.trim()` ya se comió ese
  // espacio. Es el mismo detalle que documenta `textoDeClic`.
  if (raw.startsWith('boton:')) {
    const t = raw.slice('boton:'.length).trim();
    return { clave: t ? `boton: ${t}` : 'boton:', texto: t || null };
  }
  // El separador es la PRIMERA aparición de ` — `: ni una URL ni `ancla #x` pueden
  // tener espacios, así que lo de después es el texto —que sí puede traer su
  // propio guión largo, y entonces viaja entero.
  const corte = raw.indexOf(' — ');
  const destino = (corte === -1 ? raw : raw.slice(0, corte)).trim();
  const texto = corte === -1 ? '' : raw.slice(corte + ' — '.length).trim();
  return { clave: destino || '(sin destino)', texto: texto || null };
}

/** Lo que junta el barrido por cada destino. Lo exporta para que el lector
 *  (lib/landing-pulso-server.ts) no escriba una segunda forma del mismo acumulador. */
export type AcumClic = { clics: number; personas: Set<string>; textos: Map<string, number> };

/**
 * Arma la lista de clics de una página a partir de lo acumulado.
 *
 * El orden es por CLICS y después por personas: la pregunta es «qué botón tocan»,
 * y empatar dos destinos con 9 clics se desempata por cuánta gente distinta los
 * tocó. El tercer criterio es la clave, para que dos corridas con los mismos
 * datos devuelvan el mismo orden (sin esto, la lista se reacomoda sola entre
 * refrescos y parece que cambió algo).
 */
export function ordenarClics(acum: Map<string, AcumClic>, tope = MAX_CLICS): { filas: ClicAgrupado[]; restantes: number } {
  const todas: ClicAgrupado[] = [...acum.entries()].map(([clave, a]) => {
    // El texto que se muestra es el MÁS VISTO para ese destino, no el último que
    // llegó: un renderizado raro de una sola visita no debería renombrar la fila.
    let texto: string | null = null;
    let mejor = 0;
    for (const [t, n] of a.textos) if (n > mejor) { mejor = n; texto = t; }
    const esBoton = clave === 'boton:' || clave.startsWith('boton: ');
    return {
      clave,
      texto,
      // Un `boton:` no tiene destino: inventarle uno sería mostrar el prefijo
      // interno del snippet como si fuera una dirección.
      destino: esBoton || clave === '(sin destino)' ? null : destinoCorto(clave),
      clics: a.clics,
      personas: a.personas.size,
    };
  });
  todas.sort((x, y) => y.clics - x.clics || y.personas - x.personas || (x.clave < y.clave ? -1 : 1));
  return { filas: todas.slice(0, tope), restantes: Math.max(0, todas.length - tope) };
}

/**
 * Convierte «hasta dónde bajó cada persona» en la barra de profundidad.
 *
 * Recibe el máximo por persona porque el snippet manda un evento por hito Y uno
 * exacto al irse: contar eventos daría más gente al 25% que la que hay.
 *
 * Devuelve null con 0 personas medidas: ese es el caso de rule-of-the-house —
 * «no se midió» no se dibuja como «nadie llegó».
 */
export function profundidadDe(maxPorPersona: Iterable<number>): Profundidad | null {
  const topes = [...maxPorPersona];
  if (!topes.length) return null;
  const hitos = HITOS_SCROLL.map((h) => ({ hito: h as number, personas: topes.filter((p) => p >= h).length }));
  // El primer escalón es ENTRAR (base) y no llegar al 25%: sin él, la caída más
  // grande de una página donde la gente se va arriba queda invisible, que es
  // justamente la página que hay que arreglar.
  let mayorCaida: Profundidad['mayorCaida'] = null;
  let previoValor = topes.length;
  let previoHito = 0;
  for (const h of hitos) {
    const perdidas = previoValor - h.personas;
    if (perdidas > 0 && (!mayorCaida || perdidas > mayorCaida.personas)) {
      mayorCaida = { desde: previoHito, hasta: h.hito, personas: perdidas };
    }
    previoValor = h.personas;
    previoHito = h.hito;
  }
  return { base: topes.length, hitos, mayorCaida };
}