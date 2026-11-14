// =============================================================================
// Replicar un carrusel, GUIADO: qué pregunta MaKo antes de generar, en qué orden y qué sale de ahí (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026, probando «crear un carrusel»: «me llevó directamente al editor y no está bueno eso» y «directamente empieza
// a replicarlo y dice lo voy a hacer con tu oferta, pero ni siquiera me pregunta qué oferta, si el usuario puede tener muchas
// ofertas». Lo que pidió: al elegir un carrusel, MaKo pregunta en su chat qué oferta (las suyas, cliqueables), qué avatar —«SÓLO
// si el carrusel tiene una persona: si es solo texto, que lo detecte y no le pregunte eso»— y qué quiere cambiar. El diseño:
// docs/relevo/nube-carruseles-guiado.md.
//
// LO DECIDE EL CÓDIGO, SIN IA. Cada pregunta es una APERTURA de la casa (lib/aperturas/reglas.ts: una pregunta de hecho, de 2 a 4
// botones, el primero recomendado, uno de callar) y la dibuja `AperturaMako`, la pieza de todos los chats. Lo que NO se usa es la
// memoria de las aperturas: un guiado es de ESTA réplica, y lo contestado viaja en el estado de acá (`RespuestasGuiado`), no en
// el perfil. Con la memoria por persona, volver a replicar el mismo carrusel no volvía a preguntar (una `respondida` calla).
//
// LA FORMA ES LA DE UNA MÁQUINA DE PASOS a propósito (el chat «Tab Video» arma el mismo patrón para el video): `pasoDe` dice cuál
// toca, `preguntaDe` la arma, `responder` y `escribir` avanzan, `pedidoDelGuiado` es lo que sale. Nada de React ni de la red.
//
// Copy de la persona: español neutro, de tú (lo mira tests/puente-panel-copy.test.ts). Y ninguna primera persona del pretérito
// de un verbo en -ar («miré», «anoté»): el guard del voseo la lee como un imperativo de vos.
// =============================================================================

import type { Apertura, Boton } from '../aperturas/reglas';
import { TOPE_ROTULO } from '../aperturas/reglas';

// ── Lo que se sabe al abrir la pestaña ────────────────────────────────────────────────────────────────────────────────

/** Una oferta que se puede elegir: las ACTIVAS del negocio, con la principal marcada. */
export type OfertaElegible = { id: number; nombre: string; principal: boolean };

/**
 * Lo que la pestaña sabe del carrusel y del negocio. Todo «no sé» es `null`, nunca un `false` ni un `[]`:
 *   · `ofertas: null` = no se pudo leer (no es «no tiene ofertas»);
 *   · `persona: null` = la lectura no lo dijo (sin IA, o falló); `leyendo` = todavía la está haciendo.
 */
export type HechosGuiado = {
  laminas: number;
  /** «@growithalex»: de quién es el original (va en el resumen). */
  creador: string;
  ofertas: readonly OfertaElegible[] | null;
  persona: boolean | null;
  leyendo: boolean;
  /** Qué foto del negocio hay para poner en lugar de la persona: la de su cara de marca y la de su último look de AI Avatar. */
  fotos: { cara: boolean; look: boolean };
  /** ¿Tiene un kit de marca con colores? Sin él, «Textos y mis colores» no se ofrece. */
  kit: boolean;
};

// ── Lo que contesta la persona ────────────────────────────────────────────────────────────────────────────────────────

export type OfertaRespuesta = { id: number; nombre: string } | { libre: string };
export type AvatarRespuesta = 'cara' | 'look' | 'ninguno';
export type CambioRespuesta = 'textos' | 'marca' | { libre: string };

export type RespuestasGuiado = {
  oferta?: OfertaRespuesta;
  avatar?: AvatarRespuesta;
  cambio?: CambioRespuesta;
  /** Qué página de ofertas se ve (de a `OFERTAS_POR_PREGUNTA`). */
  paginaOfertas?: number;
  /** La caja del chat contesta ESTA pregunta (después de «Lo escribo yo»). */
  escribiendo?: 'oferta' | 'cambio' | null;
  /** Lo que escribió fuera de una pregunta: se anota y va con el pedido. */
  extras?: readonly string[];
  /** «Ahora no»: las preguntas se pausan (la pestaña sigue; «Seguir» las vuelve a abrir). */
  pausado?: boolean;
  /** Tocó «Generar»: la pantalla arranca. */
  listo?: boolean;
  /** Cuántas veces se rehízo desde el armado («Para otra oferta», «Sin mi foto»…): cambia la llave del armado y arranca de nuevo. */
  vuelta?: number;
  /** Arrancó solo, con lo de por defecto (12/11/2026): el saludo dice qué hizo, no que va a preguntar. */
  porDefecto?: boolean;
  /**
   * Lo de por defecto MENOS la oferta (14/11/2026): con dos o más ofertas y ninguna marcada principal, elegir «la primera» es
   * adivinar. Se pregunta SÓLO cuál, y al contestar arranca (`hayQuePreguntarOferta`).
   */
  soloOferta?: boolean;
  /** Lo que ya se dijo, en orden: lo que preguntó MaKo y lo que contestó la persona (el hilo lo dibuja). */
  charla?: readonly { mako: string; yo: string }[];
};

export const SIN_RESPUESTAS: RespuestasGuiado = {};

// ── Los pasos ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PasoGuiado = 'oferta' | 'leyendo' | 'avatar' | 'cambio' | 'resumen' | 'pausado' | 'listo';

/** De a cuántas ofertas se ofrecen (con «Ver más» y «Ahora no» son 4 botones: el tope de una apertura). */
export const OFERTAS_POR_PREGUNTA = 2;
/** Lo más largo que se escribe como respuesta libre (es un dato para el prompt, no un ensayo). */
export const TOPE_LIBRE = 300;
/** Cuántos extras se guardan (lo de más se pierde: el pedido entero tiene un tope en la ruta). */
export const TOPE_EXTRAS = 4;

/** ¿Se pregunta por el avatar? Sí cuando hay una persona Y cuando no se sabe: preguntar de más cuesta un toque; no preguntar
 *  deja la cara del competidor. Sólo un «no» MEDIDO de la lectura lo saltea («si es solo texto, que no le pregunte eso»). */
export const preguntaAvatar = (h: HechosGuiado): boolean => h.persona !== false;

/** El paso de ahora. El avatar espera a la lectura sólo si todavía corre: la oferta se pregunta mientras tanto. */
export function pasoDe(h: HechosGuiado, r: RespuestasGuiado): PasoGuiado {
  if (r.listo) return 'listo';
  if (r.pausado) return 'pausado';
  if (!r.oferta) return 'oferta';
  if (r.avatar == null && h.persona == null && h.leyendo) return 'leyendo';
  if (r.avatar == null && preguntaAvatar(h)) return 'avatar';
  if (!r.cambio) return 'cambio';
  return 'resumen';
}

// ── Los valores de los botones (lo que vuelve en `responder`) ────────────────────────────────────────────────────────

export const VALOR = {
  ofertaMas: 'oferta:mas',
  ofertaLibre: 'oferta:libre',
  oferta: (id: number) => `oferta:${id}`,
  avatar: (a: AvatarRespuesta) => `avatar:${a}`,
  cambio: (c: 'textos' | 'marca') => `cambio:${c}`,
  cambioLibre: 'cambio:libre',
  generar: 'generar',
  cambiar: 'cambiar',
} as const;

/** El rótulo de un botón cabe en `TOPE_ROTULO`: lo que sobra se corta con «…», nunca a la mitad de un emoji. */
export function cortarRotulo(s: string, tope = TOPE_ROTULO): string {
  const t = s.replace(/\s+/g, ' ').trim();
  const cps = Array.from(t);
  return cps.length <= tope ? t : `${cps.slice(0, tope - 1).join('').trimEnd()}…`;
}

/** Los rótulos de las ofertas, únicos aunque dos se llamen igual o se corten igual (dos botones no dicen lo mismo). */
function rotulosDeOfertas(ofs: readonly OfertaElegible[]): Map<number, string> {
  const out = new Map<number, string>();
  const usados = new Set<string>();
  for (const o of ofs) {
    let base = cortarRotulo(o.nombre || 'Oferta sin nombre');
    let n = 2;
    while (usados.has(base)) base = cortarRotulo(`${o.nombre} (${n++})`);
    usados.add(base);
    out.set(o.id, base);
  }
  return out;
}

/** Las ofertas en el orden en que se ofrecen: la principal primero, después las demás como vinieron. */
export const ofertasEnOrden = (ofs: readonly OfertaElegible[]): OfertaElegible[] =>
  [...ofs].map((o, i) => ({ o, i })).sort((a, b) => Number(b.o.principal) - Number(a.o.principal) || a.i - b.i).map((x) => x.o);

/** A dónde va «Cargar una oferta» y «Subir mi foto» (links de la app: el `Link` de la casa les pega el `?ws=`). */
export const RUTA_OFERTAS = '/offer';
export const RUTA_FOTO = '/ai-avatar';

const callar: Boton<never> = { tipo: 'callar', rotulo: 'Ahora no' };
const respuesta = (rotulo: string, valor: string): Boton<never> => ({ tipo: 'respuesta', rotulo, valor });

/** El nombre que se dice de lo elegido, en el resumen y en la burbuja de la persona. */
const nombreOferta = (o: OfertaRespuesta) => ('libre' in o ? o.libre : o.nombre);
const DICHO_AVATAR: Record<AvatarRespuesta, string> = { cara: 'con tu cara de marca', look: 'con tu último look', ninguno: 'sin persona' };

/** El resumen de lo que se va a generar, en una frase («9 láminas para «Mentoría», con tu cara de marca y sólo con tus textos»). */
export function resumenDe(h: HechosGuiado, r: RespuestasGuiado): string {
  const n = Math.max(1, Math.round(h.laminas) || 1);
  const que = n === 1 ? 'Una lámina' : `${n} láminas`;
  const para = r.oferta ? ` para «${cortarRotulo(nombreOferta(r.oferta), 40)}»` : '';
  const quien = r.avatar && preguntaAvatar(h) ? `, ${DICHO_AVATAR[r.avatar]}` : '';
  const cambio = !r.cambio || r.cambio === 'textos' ? ' y cambiando sólo los textos'
    : r.cambio === 'marca' ? ' con los textos y los colores de tu marca'
    : ` y además: ${cortarRotulo(r.cambio.libre, 50)}`;
  return `${que}${para}${quien}${cambio}.`;
}

/**
 * La pregunta de ahora, como una apertura (la dibuja `AperturaMako`). `null` cuando no hay nada que preguntar: leyendo (la
 * pantalla dice que mira), pausado (dibuja «Seguir») o listo (arranca).
 */
export function preguntaDe(h: HechosGuiado, r: RespuestasGuiado): Apertura<never> | null {
  const paso = pasoDe(h, r);
  const id = (p: string) => `carrusel-guiado:${p}`;
  switch (paso) {
    case 'oferta': {
      if (r.escribiendo === 'oferta') {
        // La vuelta atrás: a sus ofertas si tiene, a cargar una si no.
        const volver: Boton<never> = h.ofertas?.length ? respuesta('Elegir una oferta', VALOR.ofertaMas) : { tipo: 'ir', rotulo: 'Cargar una oferta', href: RUTA_OFERTAS };
        return { id: id('oferta-libre'), alcance: 'entidad', texto: 'Escríbelo abajo: qué vendes con este carrusel.', botones: [volver, callar] };
      }
      if (h.ofertas == null) {
        return { id: id('oferta'), alcance: 'entidad', texto: 'No pude leer tus ofertas. ¿Qué vendes con este carrusel?', botones: [respuesta('Lo escribo yo', VALOR.ofertaLibre), callar] };
      }
      if (!h.ofertas.length) {
        return {
          id: id('oferta'), alcance: 'entidad', texto: 'Todavía no tienes ofertas cargadas. ¿Qué vendes con este carrusel?',
          botones: [{ tipo: 'ir', rotulo: 'Cargar una oferta', href: RUTA_OFERTAS }, respuesta('Lo escribo yo', VALOR.ofertaLibre), callar],
        };
      }
      const orden = ofertasEnOrden(h.ofertas);
      const rotulos = rotulosDeOfertas(orden);
      const paginas = Math.ceil(orden.length / OFERTAS_POR_PREGUNTA);
      const pagina = ((r.paginaOfertas ?? 0) % paginas + paginas) % paginas;
      const estas = orden.slice(pagina * OFERTAS_POR_PREGUNTA, (pagina + 1) * OFERTAS_POR_PREGUNTA);
      const botones: Boton<never>[] = estas.map((o) => respuesta(rotulos.get(o.id)!, VALOR.oferta(o.id)));
      // Con más ofertas de las que entran, «Ver más» da la vuelta; con las justas, «Lo escribo yo» (una que no está cargada).
      botones.push(paginas > 1 ? respuesta('Ver más', VALOR.ofertaMas) : respuesta('Lo escribo yo', VALOR.ofertaLibre));
      botones.push(callar);
      return { id: id('oferta'), alcance: 'entidad', texto: orden.length === 1 ? '¿Este carrusel es para tu oferta?' : '¿Para cuál de tus ofertas es este carrusel?', botones };
    }
    case 'avatar': {
      const hay = h.fotos.cara || h.fotos.look;
      const sinFoto: Boton<never> = { tipo: 'ir', rotulo: 'Subir mi foto', href: RUTA_FOTO };
      const opciones: Boton<never>[] = [];
      if (h.fotos.cara) opciones.push(respuesta('Mi cara de marca', VALOR.avatar('cara')));
      if (h.fotos.look) opciones.push(respuesta('Mi último look', VALOR.avatar('look')));
      if (!hay) opciones.push(sinFoto);
      if (h.persona == null) {
        // No se sabe si la tiene: la pregunta lo dice, y «No tiene persona» es una respuesta.
        return {
          id: id('avatar'), alcance: 'entidad',
          texto: hay ? 'No pude ver si tiene una persona. Si la tiene, ¿quién va en su lugar?' : 'No pude ver si tiene una persona. Si la tiene, ¿con qué foto tuya la cambio?',
          botones: [...opciones.slice(0, 2), respuesta('No tiene persona', VALOR.avatar('ninguno')), callar],
        };
      }
      return {
        id: id('avatar'), alcance: 'entidad',
        texto: hay ? 'Este carrusel tiene una persona. ¿Quién va en su lugar?' : 'Tiene una persona y todavía no tienes una foto tuya. ¿Con qué foto la cambio?',
        botones: [...opciones.slice(0, 2), respuesta('Sin persona', VALOR.avatar('ninguno')), callar],
      };
    }
    case 'cambio': {
      if (r.escribiendo === 'cambio') {
        return { id: id('cambio-libre'), alcance: 'entidad', texto: 'Escríbelo abajo: qué quieres distinto del original.', botones: [respuesta('Sólo los textos', VALOR.cambio('textos')), callar] };
      }
      const botones: Boton<never>[] = [respuesta('Sólo los textos', VALOR.cambio('textos'))];
      if (h.kit) botones.push(respuesta('Textos y mis colores', VALOR.cambio('marca')));
      botones.push(respuesta('Lo escribo yo', VALOR.cambioLibre), callar);
      // «Conservo la imagen» era falso (12/11/2026): las fotos del original no se usan (son de otro; lib/carruseles/replica.ts),
      // van fotos PARECIDAS o la tuya donde hay una persona. Se dice lo que de verdad pasa.
      return { id: id('cambio'), alcance: 'entidad', texto: 'Copio el diseño del original, con fotos parecidas en lugar de las suyas. ¿Qué cambio además de los textos?', botones };
    }
    case 'resumen': {
      const n = Math.max(1, Math.round(h.laminas) || 1);
      return {
        id: id('resumen'), alcance: 'entidad', texto: `Listo: ${resumenDe(h, r).replace(/^./, (c) => c.toLowerCase())}`,
        botones: [respuesta(n === 1 ? 'Generarla' : `Generar las ${n} láminas`, VALOR.generar), respuesta('Cambiar algo', VALOR.cambiar), callar],
      };
    }
    default:
      return null;
  }
}

// ── Avanzar ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const conCharla = (r: RespuestasGuiado, mako: string, yo: string): readonly { mako: string; yo: string }[] => [...(r.charla ?? []), { mako, yo }];

/** Lo que pasa con un toque. Un valor que no se entiende (o una oferta que ya no está) no cambia nada. */
export function responder(h: HechosGuiado, r: RespuestasGuiado, b: Boton<never>): RespuestasGuiado {
  const pregunta = preguntaDe(h, r);
  if (!pregunta) return r;
  const dijo = (x: RespuestasGuiado) => ({ ...x, charla: conCharla(r, pregunta.texto, b.rotulo) });
  if (b.tipo === 'callar') return { ...r, pausado: true, escribiendo: null };
  if (b.tipo !== 'respuesta') return r;
  const v = b.valor;
  if (v === VALOR.ofertaMas) return { ...r, paginaOfertas: (r.paginaOfertas ?? 0) + (r.escribiendo === 'oferta' ? 0 : 1), escribiendo: null };
  if (v === VALOR.ofertaLibre) return { ...r, escribiendo: 'oferta' };
  if (v === VALOR.cambioLibre) return { ...r, escribiendo: 'cambio' };
  if (v.startsWith('oferta:')) {
    const id = Number(v.slice('oferta:'.length));
    const o = h.ofertas?.find((x) => x.id === id);
    return o ? dijo({ ...r, oferta: { id: o.id, nombre: o.nombre }, escribiendo: null, ...arrancaSiEraLoUnico(r) }) : r;
  }
  if (v.startsWith('avatar:')) {
    const a = v.slice('avatar:'.length);
    if (a !== 'cara' && a !== 'look' && a !== 'ninguno') return r;
    if ((a === 'cara' && !h.fotos.cara) || (a === 'look' && !h.fotos.look)) return r;
    return dijo({ ...r, avatar: a });
  }
  if (v === VALOR.cambio('textos') || v === VALOR.cambio('marca')) {
    if (v === VALOR.cambio('marca') && !h.kit) return r;
    return dijo({ ...r, cambio: v === VALOR.cambio('marca') ? 'marca' : 'textos', escribiendo: null });
  }
  if (v === VALOR.generar) return dijo({ ...r, listo: true });
  // «Cambiar algo»: de nuevo desde la oferta, con lo dicho y lo escrito a la vista.
  if (v === VALOR.cambiar) return { charla: conCharla(r, pregunta.texto, b.rotulo), extras: r.extras };
  return r;
}

/** Lo que se escribe en la caja: la respuesta de «Lo escribo yo», o un pedido extra (la pregunta sigue). */
export function escribir(h: HechosGuiado, r: RespuestasGuiado, texto: string): RespuestasGuiado {
  const t = Array.from(texto.replace(/\s+/g, ' ').trim()).slice(0, TOPE_LIBRE).join('');
  if (!t) return r;
  const pregunta = preguntaDe(h, r);
  const charla = pregunta ? conCharla(r, pregunta.texto, t) : [...(r.charla ?? []), { mako: '', yo: t }];
  if (r.escribiendo === 'oferta') return { ...r, oferta: { libre: t }, escribiendo: null, charla, ...arrancaSiEraLoUnico(r) };
  if (r.escribiendo === 'cambio') return { ...r, cambio: { libre: t }, escribiendo: null, charla };
  // Sin ofertas que elegir, lo escrito en la pregunta de la oferta ES la oferta.
  if (pasoDe(h, r) === 'oferta' && (h.ofertas == null || !h.ofertas.length)) return { ...r, oferta: { libre: t }, charla };
  return { ...r, extras: [...(r.extras ?? []), t].slice(-TOPE_EXTRAS), pausado: false, charla };
}

/** «Seguir» después de «Ahora no». */
export const seguir = (r: RespuestasGuiado): RespuestasGuiado => ({ ...r, pausado: false });

// ── Sin preguntar: escribe con lo de por defecto, y se cambia DESPUÉS (12/11/2026) ─────────────────────────────────────
// Martín, 11/11 (memoria `replicar-deja-todo-escrito`): «Replicar» deja la pieza ENTERA hecha, sin preguntas ni «Aceptar» de
// por medio; usa lo que haya por defecto (la oferta principal) y deja cambiarlo DESPUÉS, con botones al lado del resultado.
// Copywriting lo hizo así el 11/11 (702d1baa9). Las preguntas de arriba siguen para «Cambiar algo».

/**
 * ¿Hay que preguntar la oferta antes de arrancar? Sí con DOS o más ofertas y ninguna marcada principal: «la primera» es adivinar.
 *
 * ⚠️ La demo del 13/11/2026 con Julio (min 42): el negocio de Martín tiene «WhatsApp Ads Funnel», «MaKo Acelerador» y una
 * newsletter, ninguna principal, y «Editar» arrancó solo para «WhatsApp Ads Funnel» (la de `orden` 0), que es un embudo que
 * armó para Mauricio. Martín, en vivo: «no sé por qué no dice MaKo… te dice que no es tu embudo, es el de Mauricio». No estaba
 * inspeccionando a nadie: era SU negocio con una oferta elegida a ciegas (docs/hallazgos-carruseles.md). Con una sola oferta, o con
 * una principal, no hay nada que adivinar: arranca.
 */
export const hayQuePreguntarOferta = (ofertas: readonly OfertaElegible[] | null | undefined): boolean =>
  (ofertas?.length ?? 0) > 1 && !(ofertas ?? []).some((o) => o.principal);

/** Contestada la oferta que faltaba (`soloOferta`), arranca: lo demás ya estaba por defecto (13/11: después de preguntar, la pieza entera). */
const arrancaSiEraLoUnico = (r: RespuestasGuiado): Partial<RespuestasGuiado> => (r.soloOferta ? { listo: true, soloOferta: false } : {});

/**
 * Lo de por defecto: la oferta principal (o la única), su cara de marca (o su último look), sólo los textos, y arranca. Con varias
 * ofertas y ninguna principal, todo eso MENOS la oferta: pregunta cuál (`hayQuePreguntarOferta`).
 */
export function respuestasPorDefecto(base: Pick<HechosGuiado, 'ofertas' | 'fotos'>): RespuestasGuiado {
  const preguntar = hayQuePreguntarOferta(base.ofertas);
  const oferta = !preguntar && base.ofertas?.length ? ofertasEnOrden(base.ofertas)[0] : null;
  return {
    ...(oferta ? { oferta: { id: oferta.id, nombre: oferta.nombre } } : {}),
    avatar: base.fotos.cara ? 'cara' : base.fotos.look ? 'look' : 'ninguno',
    cambio: 'textos', listo: !preguntar, porDefecto: true, vuelta: 0,
    ...(preguntar ? { soloOferta: true } : {}),
  };
}

/** Una opción para rehacer lo armado, al lado de «Abrir el diseño». */
export type Rehacer = { rotulo: string; valor: string };

/**
 * Lo que se puede cambiar DESPUÉS de armar, como botones: otra oferta (hasta dos), la foto (sacarla o ponerla, sólo si puede
 * haber una persona) y los colores de la marca (con kit). Cada uno rehace la pieza entera con ese cambio.
 */
export function opcionesParaRehacer(h: HechosGuiado, r: RespuestasGuiado): Rehacer[] {
  const out: Rehacer[] = [];
  const actual = r.oferta && 'id' in r.oferta ? r.oferta.id : null;
  const otras = ofertasEnOrden(h.ofertas ?? []).filter((o) => o.id !== actual).slice(0, 2);
  const rotulos = rotulosDeOfertas(ofertasEnOrden(h.ofertas ?? []));
  for (const o of otras) out.push({ rotulo: cortarRotulo(`Para «${rotulos.get(o.id) ?? o.nombre}»`), valor: VALOR.oferta(o.id) });
  if (preguntaAvatar(h)) {
    if (r.avatar && r.avatar !== 'ninguno') out.push({ rotulo: 'Sin mi foto', valor: VALOR.avatar('ninguno') });
    else if (h.fotos.cara) out.push({ rotulo: 'Con mi foto', valor: VALOR.avatar('cara') });
    else if (h.fotos.look) out.push({ rotulo: 'Con mi último look', valor: VALOR.avatar('look') });
  }
  if (h.kit && r.cambio !== 'marca') out.push({ rotulo: 'Con mis colores', valor: VALOR.cambio('marca') });
  if (r.cambio === 'marca') out.push({ rotulo: 'Con sus colores', valor: VALOR.cambio('textos') });
  return out;
}

/** Rehacer con una opción: el cambio, y otra vuelta del armado. Una opción que no se ofrecía no cambia nada. */
export function rehacerCon(h: HechosGuiado, r: RespuestasGuiado, valor: string): RespuestasGuiado {
  if (!opcionesParaRehacer(h, r).some((o) => o.valor === valor)) return r;
  const otra = { ...r, listo: true, vuelta: (r.vuelta ?? 0) + 1 };
  if (valor.startsWith('oferta:')) {
    const o = h.ofertas?.find((x) => x.id === Number(valor.slice('oferta:'.length)));
    return o ? { ...otra, oferta: { id: o.id, nombre: o.nombre } } : r;
  }
  if (valor.startsWith('avatar:')) return { ...otra, avatar: valor.slice('avatar:'.length) as AvatarRespuesta };
  if (valor === VALOR.cambio('marca')) return { ...otra, cambio: 'marca' };
  if (valor === VALOR.cambio('textos')) return { ...otra, cambio: 'textos' };
  return r;
}

// ── Lo que sale ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** El pedido de la réplica: lo que viaja a la ruta (y a la API de MaKo). */
export type PedidoGuiado = {
  ofertaId: number | null;
  /** La oferta escrita a mano (no está cargada): va como dato para la IA. */
  ofertaLibre: string | null;
  avatar: AvatarRespuesta | null;
  cambio: 'textos' | 'marca' | 'libre';
  /** Lo escrito: el cambio a mano y los extras, en una frase para el prompt (ya acotada). */
  pedido: string | null;
};

/**
 * Lo que viaja a la ruta, o `null` si todavía falta contestar algo. Por las preguntas, sin oferta no se genera; arrancando solo
 * (`porDefecto`), sin ofertas cargadas se escribe con lo que se sabe del negocio.
 */
export function pedidoDelGuiado(h: HechosGuiado, r: RespuestasGuiado): PedidoGuiado | null {
  if (!r.oferta && (!r.porDefecto || r.soloOferta)) return null;
  const libres = [
    r.cambio && typeof r.cambio === 'object' ? r.cambio.libre : null,
    ...(r.extras ?? []),
  ].filter((x): x is string => !!x && !!x.trim());
  return {
    ofertaId: r.oferta && 'id' in r.oferta ? r.oferta.id : null,
    ofertaLibre: r.oferta && 'libre' in r.oferta ? r.oferta.libre : null,
    // Sin persona medida, el avatar no viaja (no hay dónde ponerlo). Arrancando solo, viaja igual: el server la pone sólo donde
    // la IA ve una persona, y así el pedido no cambia cuando termina la lectura (cambiarlo reiniciaba el armado).
    avatar: r.porDefecto || preguntaAvatar(h) ? r.avatar ?? null : null,
    cambio: !r.cambio || r.cambio === 'textos' ? 'textos' : r.cambio === 'marca' ? 'marca' : 'libre',
    pedido: libres.length ? libres.join(' · ').slice(0, TOPE_PEDIDO) : null,
  };
}

/**
 * Qué foto del negocio se busca para poner donde el original tiene una persona: la que eligió, `null` con «Sin persona» (no se
 * pone ninguna), y su cara de marca si no hubo guiado (la API vieja, que la ponía siempre que hubiera).
 */
export const fotoDelGuiado = (g: PedidoGuiado | null | undefined): 'cara' | 'look' | null =>
  g?.avatar === 'ninguno' ? null : g?.avatar === 'look' ? 'look' : 'cara';

/** El tope de lo escrito que viaja (el de la ruta de la réplica es 400; se deja lugar para la oferta escrita). */
export const TOPE_PEDIDO = 360;

/**
 * El pedido que manda el NAVEGADOR, leído en el server: nada se cree. Un id que no es entero es `null`, un avatar o un cambio que
 * no se conoce es el default, y los textos se acotan. La oferta se vuelve a leer de la base del negocio en el server (un id de
 * otro negocio no existe ahí).
 */
export function leerPedidoGuiado(crudo: unknown): PedidoGuiado {
  const o = crudo && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : {};
  const id = typeof o.ofertaId === 'number' && Number.isSafeInteger(o.ofertaId) && o.ofertaId > 0 ? o.ofertaId : null;
  const texto = (v: unknown, tope: number) => (typeof v === 'string' && v.trim() ? Array.from(v.replace(/\s+/g, ' ').trim()).slice(0, tope).join('') : null);
  const avatar = o.avatar === 'cara' || o.avatar === 'look' || o.avatar === 'ninguno' ? o.avatar : null;
  const cambio = o.cambio === 'marca' || o.cambio === 'libre' ? o.cambio : 'textos';
  return { ofertaId: id, ofertaLibre: id ? null : texto(o.ofertaLibre, TOPE_LIBRE), avatar, cambio, pedido: texto(o.pedido, TOPE_PEDIDO) };
}

// ── La lectura: ¿tiene una persona? (la IA del negocio mira las primeras láminas) ─────────────────────────────────────

/** Cuántas láminas mira la lectura (la portada casi siempre trae a la persona; con tres alcanza y no pesa). */
export const LAMINAS_DE_LA_LECTURA = 3;

/**
 * Lo que se le pregunta a la IA del negocio con las primeras láminas a la vista. Dos sí-o-no y nada más: la lectura decide QUÉ
 * se pregunta (el avatar), no escribe nada. «Una persona» es alguien que se ve (una foto, una cara, un cuerpo): un dibujo de
 * una persona también cuenta, porque también hay que reemplazarlo; un nombre escrito, no.
 */
export const PROMPT_LECTURA = [
  'Mira estas láminas de un carrusel de Instagram y contesta dos cosas:',
  '1. ¿Alguna lámina muestra a una PERSONA (una foto o un dibujo de alguien: su cara o su cuerpo)? Un nombre escrito no cuenta.',
  '2. ¿Algún texto es un LETTERING DIBUJADO (letras en 3D, hechas de nubes, de objetos o pintadas a mano), y no una tipografía común?',
  'Devuelve SÓLO este JSON: {"persona": true|false, "lettering": true|false}',
].join('\n');

export type Lectura = { persona: boolean | null; lettering: boolean | null };

/** Lo que contestó la IA, sin creerle: un sí o un no de verdad, o `null` (no se sabe). Nunca un `false` por no entender. */
export function leerLectura(crudo: string): Lectura {
  const si = (v: unknown): boolean | null => (v === true || v === 'true' || v === 'sí' || v === 'si' ? true : v === false || v === 'false' || v === 'no' ? false : null);
  const m = /\{[\s\S]*\}/.exec(crudo ?? '');
  if (!m) return { persona: null, lettering: null };
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    return { persona: si(j.persona), lettering: si(j.lettering) };
  } catch { return { persona: null, lettering: null }; }
}
