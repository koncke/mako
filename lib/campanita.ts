// =============================================================================
// campanita — lo que dibuja la campanita de escritorio con el feed de avisos (17/10/2026)
// =============================================================================
// El feed (`notificaciones`, mig 0250) lo leía sólo el «Avisos» de MaKo Mobile; en escritorio no había dónde verlo, y
// desde el 17/10 una tarjeta MaKo de un negocio SIN grupo «queda en la app» (`SinGrupo`, lib/mako-tarjeta.ts): esa app
// es esta campanita. Lo que sabe hacer con las filas, PURO para que lo fije un test (tests/campanita.test.ts):
//
//   · AGRUPA LOS REPETIDOS SEGUIDOS (mismo tipo, título y texto): una alerta que insiste sale una vez con «×N». Se agrupa
//     en la LECTURA, sin borrar nada: la fila es el registro (docs/hallazgos-comunicacion.md, «La campanita de escritorio»).
//   · DICE SI NO LLEGÓ (`payload.salida`, `SalidaAviso` de lib/notificaciones.ts), en tres o cuatro palabras.
//   · NO LINKEA AL DEFAULT: casi todo apunta a `/configuraciones?tab=notif` (`emitirDelCatalogo` no pasa link), y un
//     renglón que siempre lleva al mismo lugar no es un link, es ruido.
//
// La bitácora de los eventos sin automatización ni llega acá: la deja afuera la lectura (`SIN_RUIDO`).
// =============================================================================

/** La fila del feed tal como la devuelve GET /api/notificaciones (`Notificacion`, lib/notificaciones.ts). */
export type FilaFeed = {
  id: number;
  tipo: string;
  severidad: string;
  titulo: string;
  descripcion: string | null;
  link: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AvisoCampanita = {
  /** El id de la fila más nueva del grupo (la `key` del renglón). */
  id: number;
  titulo: string;
  frase: string | null;
  /** A dónde lleva, o null si es el default de Configuraciones. */
  link: string | null;
  createdAt: string;
  urgente: boolean;
  /** Posterior a la marca de agua de la persona (al menos uno del grupo). */
  nuevo: boolean;
  /** Cuántas filas iguales y seguidas junta. */
  veces: number;
  /** Lo que pasó al mandarlo, en palabras (o null si salió como siempre). */
  salida: string | null;
};

/** El link que pone el emisor cuando no pasa uno: no se dibuja como link. */
export const LINK_POR_DEFECTO = '/configuraciones?tab=notif';

const TOPE_FRASE = 140;

/** Una línea, sin marcas de WhatsApp (*negrita*, _cursiva_): el renglón es una frase. */
export function fraseDeAviso(s: string | null | undefined): string | null {
  const t = (s ?? '').replace(/[*_~`]/g, '').replace(/━+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > TOPE_FRASE ? `${t.slice(0, TOPE_FRASE - 1)}…` : t;
}

/** Lo que pasó al mandarlo (`payload.salida`), corto: es un rótulo, no una explicación. */
export function rotuloDeSalida(payload: Record<string, unknown> | null | undefined): string | null {
  switch (payload?.salida) {
    case 'sin_grupo': return payload.porEmail === true ? 'Sin grupo: fue por email' : 'Sin grupo: quedó acá';
    case 'no_llego': return 'No llegó al grupo';
    case 'apagado': return 'Apagado: quedó acá';
    default: return null;
  }
}

const esNuevo = (createdAt: string, vistoHasta: string | null): boolean =>
  !vistoHasta || Number.isNaN(Date.parse(vistoHasta)) || Date.parse(createdAt) > Date.parse(vistoHasta);

/**
 * LAS FILAS, LISTAS PARA DIBUJAR: el más nuevo primero (como llegan), y las iguales SEGUIDAS juntas en una. «Iguales» es
 * mismo tipo, título, texto y salida: dos leads distintos o una alerta que empeoró son dos renglones.
 */
export function agruparAvisos(filas: readonly FilaFeed[], vistoHasta: string | null): AvisoCampanita[] {
  const out: AvisoCampanita[] = [];
  let claveAnterior: string | null = null;
  for (const f of filas) {
    const frase = fraseDeAviso(f.descripcion);
    const salida = rotuloDeSalida(f.payload);
    const clave = JSON.stringify([f.tipo, f.titulo, frase, salida]);
    const nuevo = esNuevo(f.createdAt, vistoHasta);
    const previo = out[out.length - 1];
    if (previo && clave === claveAnterior) {
      previo.veces += 1;
      previo.nuevo ||= nuevo;
      continue;
    }
    claveAnterior = clave;
    out.push({
      id: f.id, titulo: f.titulo, frase,
      link: f.link && f.link !== LINK_POR_DEFECTO ? f.link : null,
      createdAt: f.createdAt, urgente: f.severidad === 'urgente', nuevo, veces: 1, salida,
    });
  }
  return out;
}

/**
 * HASTA DÓNDE MARCAR VISTO al abrir: la fila más nueva, sólo si es posterior a la marca. null = no hay nada que marcar, y
 * no se escribe: la marca reescribe el `perfil` entero (lib/perfil.ts, `setNotifVistoHasta`), y abrir la campanita seguido
 * no tiene por qué arriesgar un guardado ajeno.
 */
export function marcaAlAbrir(filas: readonly Pick<FilaFeed, 'createdAt'>[], vistoHasta: string | null): string | null {
  const masNuevo = filas[0]?.createdAt ?? null;
  if (!masNuevo || Number.isNaN(Date.parse(masNuevo))) return null;
  return esNuevo(masNuevo, vistoHasta) ? masNuevo : null;
}

/** «hace 5 min», «hace 3 h», «ayer», «12/10»: lo que entra al costado de un renglón. */
export function haceCuanto(iso: string, ahoraMs: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const min = Math.max(0, Math.round((ahoraMs - t) / 60_000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  const d = new Date(t);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
