// =============================================================================
// /m/offer — lo que decide la pantalla Offer del teléfono, PURO (sin React, sin fetch)
// =============================================================================
// La pantalla destila app/offer (OfferApp, ChatOffer, PiezasRail, Generando, Conclusion): las mismas vistas,
// los mismos rótulos y las MISMAS acciones de /api/offer. Lo que la pantalla de escritorio ya decide en
// módulos puros se importa de ahí (app/offer/ayudas.ts, arbol.ts, adjuntos-envio.ts, offer-api.ts); acá
// vive lo que el teléfono decide distinto (el árbol como lista en una hoja, la oferta nueva como bloques
// para leer de arriba abajo) y lo que escritorio decide ADENTRO de un componente 'use client'.
//
// ⚠️ UNA COSA ES COPIA, Y UN TEST LA CRUZA CONTRA ESCRITORIO (tests/m-offer.test.ts):
//   · (los grupos de piezas ya no: `GRUPOS_PIEZAS` se mudó de PiezasRail.tsx a app/offer/ayudas.ts el 16/10/2026.)
//   · `seccionesDeOferta` es la lista de secciones de `seccionesDe` (app/offer/Conclusion.tsx, JSX
//     adentro de un componente): las claves, los títulos y los rótulos de cada campo, en el mismo orden.
//   Y `ROTULOS` son los textos de escritorio que el teléfono dibuja: el test busca cada uno en su archivo.
//   Un rótulo escrito dos veces se desvía sin error (lo pagó Avisos: docs/hallazgos-mobile.md).
// =============================================================================

import {
  DIMENSIONES, PIEZAS, avisosAfirmables, dimensionLabel,
  type ArbolOffer, type CalculoDiagnostico, type ConclusionOferta, type DiagnosticoOferta, type OfferMensaje, type OfferSesionResumen,
  type OfferSesionVista, type PiezaKey, type PiezasSabidas, type PropuestaOferta,
} from '@/lib/offer-marco';
import { TITULO_SUELTAS, titulosUnicos } from '@/app/offer/arbol';
import {
  GRUPOS_PIEZAS, VARIABLE_LABEL, contarSabidas, controlFinalDe, esOpcionArmar, esOpcionNinguna, estadoDePieza, fechaCorta, linksDe, piezasAgrupadas, reemplaza,
  textoDeEstado, tiene, tonoDeNota, type EstadoPieza, type TonoNota,
} from '@/app/offer/ayudas';

// ── Los rótulos de escritorio ────────────────────────────────────────────────

/**
 * Lo que el teléfono dibuja con el MISMO texto que escritorio, y el archivo de app/offer donde vive ese texto
 * (el test lo busca ahí). Lo que es sólo del teléfono no va acá: va escrito donde se dibuja.
 */
export const ROTULOS = {
  selector: 'Funnel y oferta', // SelectorFunnel.tsx (ariaLabel)
  elegirFunnel: 'Elige un funnel', // SelectorFunnel.tsx (el botón sin conversación)
  nuevaOferta: 'Nueva oferta', // arbol.ts
  analizar: 'Analizar', // arbol.ts
  principal: 'Principal', // arbol.ts
  sinTitulo: 'Oferta sin título', // arbol.ts
  tuOferta: 'Tu oferta', // PiezasRail.tsx
  verMiOferta: 'Ver mi oferta', // PiezasRail.tsx
  diagnostico: 'Diagnóstico', // Generando.tsx y Conclusion.tsx
  ofertaNueva: 'Oferta nueva', // Generando.tsx y Conclusion.tsx
  puedeTardar: 'Puede tardar unos minutos.', // Generando.tsx
  reintentarDiagnostico: 'Reintentar el diagnóstico', // Generando.tsx
  reintentarOferta: 'Reintentar la oferta', // Generando.tsx
  volverAlChat: 'Volver al chat', // Generando.tsx
  descargarPdf: 'Descargar PDF', // Conclusion.tsx
  seguirAfinando: 'Seguir afinando', // Conclusion.tsx
  guardarEnFunnel: 'Guardar en este funnel', // Conclusion.tsx
  guardarComoMia: 'Guardar como mi oferta', // Conclusion.tsx
  guardada: 'Guardada', // Conclusion.tsx
  queFalta: 'Qué falta para venderla', // Conclusion.tsx
  masFuerte: 'Lo más fuerte', // Conclusion.tsx
  primeroCambiaria: 'Lo primero que cambiaría', // Conclusion.tsx
  propusoMako: 'Lo que propuso MaKo', // Conclusion.tsx
  supuestos: 'Supuestos', // Conclusion.tsx
  provisional: 'Provisional', // Conclusion.tsx
  paraSubirla: 'Para subirla: ', // Conclusion.tsx (lo que sube la nota de una dimensión)
  probarlo: 'Probarlo', // Conclusion.tsx (un cambio, a Experiments)
  noContesto: 'MaKo no contestó tu último mensaje.', // ChatOffer.tsx
  marcarVarias: 'Puedes marcar varias', // ChatOffer.tsx (una pregunta con `varias`)
  fotoVideo: 'Foto o video', // ChatOffer.tsx (el menú del clip)
  documento: 'Documento', // ChatOffer.tsx
  enviarAudio: 'Enviar audio', // ChatOffer.tsx (la nota que no salió)
  noCargaron: 'No cargaron tus funnels.', // OfferApp.tsx
  volverACargar: 'Volver a cargar', // OfferApp.tsx
  sinFunnels: 'Para empezar, crea un funnel en el CRM.', // OfferApp.tsx
  irAlCrm: 'Ir al CRM', // OfferApp.tsx
  elegirArriba: 'Elige un funnel arriba para crear o analizar una oferta.', // OfferApp.tsx
} as const;

/** Dónde vive cada rótulo en escritorio (lo lee el test). */
export const DONDE_VIVE: Record<keyof typeof ROTULOS, readonly string[]> = {
  selector: ['app/offer/SelectorFunnel.tsx'],
  elegirFunnel: ['app/offer/SelectorFunnel.tsx'],
  nuevaOferta: ['app/offer/arbol.ts'],
  analizar: ['app/offer/arbol.ts'],
  principal: ['app/offer/arbol.ts'],
  sinTitulo: ['app/offer/arbol.ts'],
  tuOferta: ['app/offer/PiezasRail.tsx'],
  verMiOferta: ['app/offer/PiezasRail.tsx'],
  diagnostico: ['app/offer/Generando.tsx', 'app/offer/Conclusion.tsx'],
  ofertaNueva: ['app/offer/Generando.tsx', 'app/offer/Conclusion.tsx'],
  puedeTardar: ['app/offer/Generando.tsx'],
  reintentarDiagnostico: ['app/offer/Generando.tsx'],
  reintentarOferta: ['app/offer/Generando.tsx'],
  volverAlChat: ['app/offer/Generando.tsx'],
  descargarPdf: ['app/offer/Conclusion.tsx'],
  seguirAfinando: ['app/offer/Conclusion.tsx'],
  guardarEnFunnel: ['app/offer/Conclusion.tsx'],
  guardarComoMia: ['app/offer/Conclusion.tsx'],
  guardada: ['app/offer/Conclusion.tsx'],
  queFalta: ['app/offer/Conclusion.tsx'],
  masFuerte: ['app/offer/Conclusion.tsx'],
  primeroCambiaria: ['app/offer/Conclusion.tsx'],
  propusoMako: ['app/offer/Conclusion.tsx'],
  supuestos: ['app/offer/Conclusion.tsx'],
  provisional: ['app/offer/Conclusion.tsx'],
  paraSubirla: ['app/offer/Conclusion.tsx'],
  probarlo: ['app/offer/Conclusion.tsx'],
  noContesto: ['app/offer/ChatOffer.tsx'],
  marcarVarias: ['app/offer/ChatOffer.tsx'],
  fotoVideo: ['app/offer/ChatOffer.tsx'],
  documento: ['app/offer/ChatOffer.tsx'],
  enviarAudio: ['app/offer/ChatOffer.tsx'],
  noCargaron: ['app/offer/OfferApp.tsx'],
  volverACargar: ['app/offer/OfferApp.tsx'],
  sinFunnels: ['app/offer/OfferApp.tsx'],
  irAlCrm: ['app/offer/OfferApp.tsx'],
  elegirArriba: ['app/offer/OfferApp.tsx'],
};

// ── El selector: el árbol de escritorio como una lista en una hoja ───────────

export type FilaConversacion = { id: number; titulo: string; segunda: string; abierta: boolean };
export type GrupoOferta = { id: number; titulo: string; principal: boolean; conversaciones: FilaConversacion[] };
export type SeccionFunnel = {
  /** null = «Sin funnel» (las conversaciones de la v1). */
  id: number | null;
  titulo: string;
  ofertas: GrupoOferta[];
  /** Las conversaciones de «oferta nueva» de este funnel (las que todavía no son de ninguna oferta suya). */
  nuevas: FilaConversacion[];
};

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/**
 * El renglón de una conversación: su título y, debajo, la fecha y el puntaje si ya se concluyó (lo mismo
 * que `opcionDeSesion` de app/offer/arbol.ts). ⚠️ La fecha depende de la zona de quien la calcula: la hoja
 * se dibuja sólo al abrirla (después de montar), como el menú de escritorio.
 */
function filaDe(s: OfferSesionResumen, abiertaId: number | null): FilaConversacion {
  const segunda = [fechaCorta(s.updatedAt), s.total != null ? `${s.total}/100` : ''].filter(Boolean).join(' · ');
  return { id: s.id, titulo: s.titulo?.trim() || ROTULOS.sinTitulo, segunda, abierta: s.id === abiertaId };
}
const masNuevasPrimero = (l: readonly OfferSesionResumen[]): OfferSesionResumen[] => [...l].sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));

/**
 * El árbol de escritorio (`seccionesDelArbol`: funnel → sus ofertas → sus conversaciones) aplanado para una
 * hoja: una sección por funnel, adentro un grupo por oferta (la principal primero) con sus conversaciones y
 * «Analizar», y al final las de «oferta nueva» con «Nueva oferta». Los títulos de un mismo nivel se
 * desambiguan igual que allá (`titulosUnicos`), así el teléfono y la computadora nombran lo mismo.
 */
export function seccionesDelSelector(a: ArbolOffer, abiertaId: number | null): SeccionFunnel[] {
  const raiz = titulosUnicos(a.funnels.map((f) => f.nombre), 'Funnel sin nombre', a.sueltas.length ? [TITULO_SUELTAS] : []);
  const funnels: SeccionFunnel[] = a.funnels.map((f, i) => {
    const ofertas = [...f.ofertas.filter((o) => o.principal), ...f.ofertas.filter((o) => !o.principal)];
    const titulos = titulosUnicos(ofertas.map((o) => o.nombre), 'Oferta sin nombre');
    return {
      id: f.id,
      titulo: raiz[i],
      ofertas: ofertas.map((o, j) => ({
        id: o.id, titulo: titulos[j], principal: o.principal,
        conversaciones: masNuevasPrimero(o.sesiones).map((s) => filaDe(s, abiertaId)),
      })),
      nuevas: masNuevasPrimero(f.sesionesNuevas).map((s) => filaDe(s, abiertaId)),
    };
  });
  const sueltas: SeccionFunnel[] = a.sueltas.length
    ? [{ id: null, titulo: TITULO_SUELTAS, ofertas: [], nuevas: masNuevasPrimero(a.sueltas).map((s) => filaDe(s, abiertaId)) }]
    : [];
  return [...funnels, ...sueltas];
}


/** Cuántos renglones dibuja la hoja (conversaciones y salidas «Nueva oferta» / «Analizar»): decide si abre alta. */
export function renglonesDelSelector(ss: readonly SeccionFunnel[]): number {
  return ss.reduce((n, s) => n + s.nuevas.length + (s.id != null ? 1 : 0)
    + s.ofertas.reduce((m, o) => m + o.conversaciones.length + 1, 0), 0);
}

/** El camino del botón del selector, en una línea: «Funnel › Oferta» (como el de escritorio, `caminoDeSesion`). */
export const caminoEnUnaLinea = (c: { funnel: string; oferta: string }): string => `${c.funnel} › ${c.oferta}`;

// ── Las piezas («Tu oferta») ─────────────────────────────────────────────────

// Los grupos son los del riel de escritorio: `GRUPOS_PIEZAS` y `piezasAgrupadas` viven en app/offer/ayudas.ts
// (puro; PiezasRail.tsx los re-exporta). Se re-exportan aquí para quien ya los leía de este módulo.
export { GRUPOS_PIEZAS };

export type PiezaVisible = { key: PiezaKey; label: string; estado: EstadoPieza };

/** Los grupos con sus piezas, en el orden de GRUPOS_PIEZAS, más «Más» con lo que nadie agrupó (lo mismo que escritorio). */
export function piezasEnGrupos(piezas: PiezasSabidas): Array<{ titulo: string; piezas: PiezaVisible[] }> {
  return piezasAgrupadas(PIEZAS).map((g) => ({
    titulo: g.titulo,
    piezas: g.piezas.map((p): PiezaVisible => ({ key: p.key, label: p.label, estado: estadoDePieza(piezas, p.key) })),
  }));
}

/** «9/20» y cuánto de la barra se llena (0-100, recortado). El total sale del marco, no de un número escrito. */
export function progresoDePiezas(piezas: PiezasSabidas): { sabidas: number; total: number; pct: number } {
  const total = PIEZAS.length;
  const sabidas = contarSabidas(piezas);
  return { sabidas, total, pct: total ? Math.max(0, Math.min(100, Math.round((sabidas / total) * 100))) : 0 };
}

/** Lo que lee el lector de pantalla de una pieza (escritorio: `${label}: ${ESTADO_TEXTO}`). */
export const ESTADO_PIEZA: Record<EstadoPieza, string> = { vacia: 'falta', negocio: 'del negocio', confirmada: 'confirmada' };

// ── El chat ──────────────────────────────────────────────────────────────────

/** `marcable` = con un toque se marca y se desmarca (una pregunta de varias), en vez de mandarse sola. */
export type OpcionRapida = { t: string; idx: number; armar: boolean; marcable: boolean };

/**
 * Las respuestas rápidas: cuelgan SÓLO del último mensaje y sólo si es de MaKo (las de una pregunta ya
 * contestada no contestan nada). Se guarda el índice ORIGINAL: en una pregunta del diagnóstico la opción N es
 * la respuesta N. `armar` = la que arma la oferta (va en dorado): nunca en una pregunta del diagnóstico, y
 * sólo si ya se puede concluir. Lo mismo que ChatOffer.tsx.
 *
 * Con `varias` en el mensaje (16/10/2026: «¿qué otras ofertas tienes?»), cada opción se marca y «Enviar (N)» las
 * manda juntas; la de armar y la que dice que no hay ninguna («No, sólo ésta») siguen saliendo con un toque. Nunca
 * en una pregunta del diagnóstico: ahí la opción N es la respuesta N, y dos juntas no son ninguna. Lo mismo que
 * `varias`/`marcable` de ChatOffer.tsx.
 */
export function opcionesRapidas(s: Pick<OfferSesionVista, 'mensajes' | 'puedeConcluir'>, hayPendiente: boolean, opcionArmar: string, opcionActualizar: string): OpcionRapida[] {
  const ultimo = s.mensajes[s.mensajes.length - 1];
  if (hayPendiente || ultimo?.de !== 'mako') return [];
  const varias = ultimo.varias === true && !ultimo.pregunta;
  return (ultimo.opciones ?? [])
    .map((t, idx) => ({ t: (t ?? '').trim(), idx }))
    .filter((o) => o.t)
    .map((o) => {
      const armar = !ultimo.pregunta && (esOpcionArmar(o.t, opcionArmar) || esOpcionArmar(o.t, opcionActualizar)) && !!s.puedeConcluir;
      return { ...o, armar, marcable: varias && !armar && !esOpcionNinguna(o.t) };
    });
}

/** Marcar o desmarcar una opción: las marcadas quedan en el orden en que están, no en el que se tocaron (escritorio). */
export function alternarMarcada(marcadas: readonly number[], idx: number): number[] {
  return marcadas.includes(idx) ? marcadas.filter((i) => i !== idx) : [...marcadas, idx].sort((a, b) => a - b);
}

/**
 * ¿Hay un mensaje del dueño sin contestar? Se CALCULA del estado (el último es del dueño y nadie contesta), no
 * del error: así «Reintentar» también aparece si el fallo pasó en otra pestaña o antes de recargar.
 */
export function sinContestar(s: Pick<OfferSesionVista, 'mensajes'> | null, respondiendo: boolean): boolean {
  if (!s || respondiendo) return false;
  return s.mensajes[s.mensajes.length - 1]?.de === 'yo';
}

/** «2 archivos»: qué está leyendo MaKo mientras contesta. */
export const cuantosArchivos = (n: number): string => `${n} ${n === 1 ? 'archivo' : 'archivos'}`;

/** La fuente de un mensaje escrito: si trae un link, MaKo lo lee primero («tu link»). */
export const fuenteDelTexto = (t: string): string => (linksDe(t).length ? 'tu link' : 'tu respuesta');

/**
 * Tirar hacia abajo vuelve a correr la página, que trae el árbol y la conversación MÁS RECIENTE (o la del
 * link). Lo que llega se usa así:
 *   · algo en curso (un turno, una lectura, el armado) → nada: su respuesta ya trae la sesión entera;
 *   · nada abierto y llegó una → se abre ésa;
 *   · llegó LA abierta → se toma si es más nueva (`reemplaza`, el mismo criterio de cada respuesta);
 *   · llegó otra (la más reciente es otra conversación) → se relee la abierta con 'abrir' (una lectura, sin
 *     IA): refrescar no puede cambiarle la conversación a nadie.
 */
export function trasRefrescar(e: {
  abierta: Pick<OfferSesionVista, 'id' | 'updatedAt'> | null;
  llegada: OfferSesionVista | null;
  ocupado: boolean;
}): 'adoptar' | 'releer' | 'nada' {
  if (e.ocupado) return 'nada';
  if (!e.abierta) return e.llegada ? 'adoptar' : 'nada';
  if (e.llegada && e.llegada.id === e.abierta.id) return reemplaza(e.abierta as OfferSesionVista, e.llegada) ? 'adoptar' : 'nada';
  return 'releer';
}

/** El PDF que viaja en un mensaje de MaKo (`pdf: { version }`), leído a la defensiva (como `pdfDeMensaje`). */
export function versionDelPdf(m: Pick<OfferMensaje, 'pdf'> | null | undefined): number | null {
  const v = m?.pdf?.version;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;
}

// ── Armar la oferta (Generando) ──────────────────────────────────────────────

export type PasoGeneracion = 'diagnostico' | 'oferta' | 'listo';
export type EstadoPaso = 'pendiente' | 'activo' | 'hecho' | 'fallo';

/** Las marcas de los dos pasos (Diagnóstico · Oferta nueva), como app/offer/Generando.tsx. */
export function estadoDePasos(paso: PasoGeneracion, corriendo: boolean, error: string | null): { diagnostico: EstadoPaso; oferta: EstadoPaso } {
  const fallo = !!error && !corriendo;
  return {
    diagnostico: paso === 'diagnostico' ? (fallo ? 'fallo' : 'activo') : 'hecho',
    oferta: paso === 'oferta' ? (fallo ? 'fallo' : 'activo') : paso === 'listo' ? 'hecho' : 'pendiente',
  };
}

// ── La conclusión ────────────────────────────────────────────────────────────

const txt = (x: unknown): string => (typeof x === 'string' ? x : '');
const lista = <X,>(x: X[] | null | undefined): X[] => (Array.isArray(x) ? x : []);

/** El bloque de arriba: el nombre (si no es la frase), la frase, el puntaje y el chip de estado. */
export function heroeDe(c: Pick<ConclusionOferta, 'propuesta' | 'calculo'>): { nombre: string | null; frase: string; total: number; lista: boolean; estado: string } {
  const nombre = txt(c.propuesta?.nombre).trim();
  const frase = txt(c.propuesta?.frase).trim() || nombre;
  const n = Number(c.calculo?.total);
  const total = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  const listaV = !!c.calculo?.lista;
  const faltan = controlFinalDe(c.calculo).filter((x) => !x.ok).length;
  return {
    nombre: nombre && nombre !== frase ? nombre : null,
    frase,
    total,
    lista: listaV,
    estado: textoDeEstado({ lista: listaV, faltan, cuello: c.calculo?.cuello ? dimensionLabel(c.calculo.cuello) : '' }),
  };
}

export type FilaDimension = { id: string; label: string; nota: number | null; tono: TonoNota | null; porque: string; mejora: string };

/**
 * Las 9 dimensiones en el ORDEN del marco (no en el que las devolvió el modelo), con su nota, su tono y lo que
 * se lee al abrirlas (el porqué y «Para subirla»): así dos diagnósticos se comparan renglón por renglón.
 */
export function filasDimensiones(d: Pick<DiagnosticoOferta, 'dimensiones'> | null | undefined): FilaDimension[] {
  const notas = lista(d?.dimensiones);
  return DIMENSIONES.map((dim) => {
    const n = notas.find((x) => x?.id === dim.id);
    const v = n && Number.isFinite(n.nota) ? Math.round(n.nota) : null;
    return { id: dim.id, label: dim.label, nota: v, tono: v == null ? null : tonoDeNota(v), porque: txt(n?.porque).trim(), mejora: txt(n?.mejora).trim() };
  });
}

/**
 * «Probarlo»: un cambio es una HIPÓTESIS (regla 10 del marco) y se prueba en Experiments, que abre el alta con
 * ella escrita (app/m/experimentos lee `?hipotesis=`, como escritorio). El mismo link de app/offer/Conclusion.tsx.
 */
export const hrefProbarlo = (hipotesis: string): string => `/m/experimentos?tab=experiments&hipotesis=${encodeURIComponent(hipotesis)}`;

/** Lo que el Diagnóstico dibuja además de las notas, saneado (viene de un modelo). */
export function lecturaDelDiagnostico(d: DiagnosticoOferta | null | undefined, calculo: CalculoDiagnostico | null | undefined) {
  return {
    tesis: txt(d?.tesis).trim(),
    faltan: calculo?.lista ? [] : controlFinalDe(calculo).filter((x) => !x.ok),
    fuerte: txt(d?.fuerte).trim(),
    alertas: avisosAfirmables(lista(calculo?.alertas).map(txt)).filter(tiene),
    cambios: lista(d?.cambios).filter((c) => c && tiene(txt(c.titulo))).map((c) => ({ titulo: txt(c.titulo).trim(), porque: txt(c.porque).trim(), hipotesis: txt(c.hipotesis).trim() })),
  };
}

/** Un trozo de una sección de la oferta nueva, listo para dibujar. */
export type Bloque =
  | { t: 'campo'; etiqueta?: string; texto: string }
  | { t: 'lista'; etiqueta?: string; items: string[]; numerada: boolean }
  | { t: 'chips'; etiqueta: string; items: string[] }
  /** Renglones con un título y líneas debajo (la ruta, lo que incluye, los bonos, la ecuación). */
  | { t: 'items'; items: Array<{ titulo: string; lineas: string[] }>; numerada: boolean };

export type SeccionOferta = { key: string; titulo: string; bloques: Bloque[] };

const campo = (etiqueta: string | undefined, v: unknown): Bloque[] => (tiene(txt(v)) ? [{ t: 'campo', ...(etiqueta ? { etiqueta } : {}), texto: txt(v).trim() }] : []);
const listaDe = (etiqueta: string | undefined, xs: unknown, numerada = false): Bloque[] => {
  const items = lista(xs as unknown[]).map(txt).filter(tiene).map((s) => s.trim());
  return items.length ? [{ t: 'lista', ...(etiqueta ? { etiqueta } : {}), items, numerada }] : [];
};
const itemsDe = (xs: Array<{ titulo: string; lineas: string[] }>, numerada = false): Bloque[] => {
  const limpios = xs.map((x) => ({ titulo: x.titulo.trim(), lineas: x.lineas.filter(tiene).map((l) => l.trim()) })).filter((x) => x.titulo || x.lineas.length);
  return limpios.length ? [{ t: 'items', items: limpios, numerada }] : [];
};
const con = (prefijo: string, v: unknown): string => (tiene(txt(v)) ? `${prefijo}${txt(v).trim()}` : '');

/**
 * Las secciones de la oferta nueva, en el orden de la plantilla del marco (las de `seccionesDe`,
 * app/offer/Conclusion.tsx: la MISMA clave, el mismo título y los mismos rótulos). Una sección sin nada
 * adentro no se dibuja: una tarjeta que se despliega a la nada se lee como algo roto.
 */
export function seccionesDeOferta(p: PropuestaOferta | null | undefined): SeccionOferta[] {
  if (!p) return [];
  const s: SeccionOferta[] = [
    { key: 'mensajes', titulo: 'Mensajes', bloques: [...campo('Corto', p.mensajes?.corto), ...campo('Largo', p.mensajes?.largo), ...campo('Entrada', p.mensajes?.entrada)] },
    { key: 'para-quien', titulo: 'Para quién es', bloques: [...campo('Perfil', p.paraQuien?.perfil), ...campo('Mínimo para entrar', p.paraQuien?.minimo), ...campo('No es para', p.paraQuien?.noEs)] },
    {
      key: 'problema', titulo: 'Problema y destino',
      bloques: [...campo('Hoy', p.problema?.hoy), ...campo('Después', p.problema?.despues), ...listaDe('Lo que lo frena', p.problema?.obstaculos), ...campo('Ya probó', p.problema?.yaProbo)],
    },
    {
      key: 'metodo', titulo: 'Método',
      bloques: [
        ...((): Bloque[] => { const n = lista(p.mecanismo?.nombres).map(txt).filter(tiene).map((x) => x.trim()); return n.length ? [{ t: 'chips', etiqueta: 'Nombres propuestos', items: n }] : []; })(),
        ...listaDe('Pasos', p.mecanismo?.pasos, true),
        ...campo('Por qué es distinto', p.mecanismo?.distinto),
      ],
    },
    { key: 'ruta', titulo: 'Ruta', bloques: itemsDe(lista(p.ruta).map((f) => ({ titulo: txt(f?.fase), lineas: [txt(f?.objetivo), con('Hito: ', f?.hito)] })), true) },
    { key: 'incluye', titulo: 'Qué incluye', bloques: itemsDe(lista(p.incluye).map((e) => ({ titulo: txt(e?.nombre), lineas: [txt(e?.beneficio)] }))) },
    { key: 'formato', titulo: 'Formato', bloques: campo(undefined, p.formato) },
    { key: 'prueba', titulo: 'Prueba', bloques: campo(undefined, p.prueba) },
    {
      key: 'garantia', titulo: 'Garantía',
      bloques: [...campo('Nombre', p.garantia?.nombre), ...campo('Condiciones', p.garantia?.condiciones), ...campo('Plazo', p.garantia?.plazo), ...campo('Si no cumple', p.garantia?.siNoCumple)],
    },
    { key: 'bonos', titulo: 'Bonos', bloques: itemsDe(lista(p.bonos).map((b) => ({ titulo: txt(b?.nombre), lineas: [con('Ataca: ', b?.objecion), con('Valor: ', b?.valor)] }))) },
    {
      key: 'inversion', titulo: 'Inversión',
      bloques: [
        ...campo('Valor total', p.inversion?.valorTotal), ...campo('Precio', p.inversion?.precio), ...campo('De contado', p.inversion?.contado),
        ...campo('En cuotas', p.inversion?.plan), ...campo('Cómo decirlo', p.inversion?.comoDecirlo),
      ],
    },
    { key: 'urgencia', titulo: 'Urgencia', bloques: campo(undefined, p.urgencia) },
    { key: 'escenarios', titulo: 'Mejor y peor escenario', bloques: [...campo('Mejor', p.escenarios?.mejor), ...campo('Peor', p.escenarios?.peor)] },
    {
      key: 'ecuacion', titulo: 'Ecuación de valor',
      bloques: itemsDe(lista(p.ecuacion).filter((f) => tiene(txt(f?.antes)) || tiene(txt(f?.despues))).map((f) => ({
        titulo: VARIABLE_LABEL[f.variable] ?? txt(f.variable),
        lineas: [[txt(f.antes).trim(), txt(f.despues).trim()].filter(Boolean).join(' → ')],
      }))),
    },
    { key: 'numeros', titulo: 'Números', bloques: listaDe(undefined, p.numeros) },
    { key: 'validar', titulo: 'Cómo validarla', bloques: listaDe(undefined, p.validar, true) },
    { key: 'siguiente', titulo: 'Siguiente escalón', bloques: campo(undefined, p.siguiente) },
  ];
  return s.filter((x) => x.bloques.length > 0);
}

/** Lo que la oferta nueva dibuja ARRIBA de sus secciones, saneado: los avisos del motor, lo que falta y los supuestos. */
export function arribaDeLaOferta(p: PropuestaOferta | null | undefined) {
  return {
    avisos: lista(p?.avisos).map(txt).filter(tiene),
    completar: lista(p?.completar).map(txt).filter(tiene),
    supuestos: lista(p?.supuestos).map(txt).filter(tiene),
  };
}

/** «3 datos para completar» (el rótulo de la caja ámbar de escritorio). */
export const datosParaCompletar = (n: number): string => `${n} ${n === 1 ? 'dato para completar' : 'datos para completar'}`;
