// =============================================================================
// spy-seguidos-reglas: los competidores SEGUIDOS, su número por red y sus alertas (13/11/2026, PURO)
// =============================================================================
// Martín, 13/11/2026, para Marketing CoPilot:
//   1. Una vista de competidores SEGUIDOS en Spy: la persona elige a cuáles seguir. En CoPilot es una tarea («Selecciona a tus
//      competidores»).
//   2. El número de los seguidos, por red. Con eso CoPilot propone «con qué número se publica» un reel de prueba, y la persona
//      lo sube o lo baja. Nunca «graduar».
//   3. Alertas de los seguidos: lo nuevo, y cuando aparece un outlier, con qué ángulo le está funcionando y «¿Creamos uno
//      parecido?».
// El contrato con CoPilot está en docs/hallazgos-competitors-spy.md («Seguidos»). Lo del servidor: lib/spy-seguidos.ts.
//
// EL NÚMERO NO ES EL PROMEDIO DE TODAS SUS PIEZAS JUNTAS: es el promedio de lo que suele hacer CADA cuenta (la mediana de sus
// últimas 20 piezas de ese formato, con al menos 7). Si fuera el de todas juntas, una cuenta con 500 reels pesaría por diez y
// un reel que explotó movería el número de todas.
// Cada pieza entra con las reglas del múltiplo (`numeroParaComparar`, lib/multiplo-rendimiento.ts): sin lo de menos de una
// semana (sus números todavía crecen), sin lo pago, sin los sorteos.
//
// ⚠️ YOUTUBE NO TIENE NÚMERO mientras `ENMIENDA_III_L` sea false (lib/spy-reglas.ts): los Developer Policies prohíben calcular
// sobre sus vistas sin ese trámite. Se dice con `FALTA_LA_ENMIENDA`, nunca con un número inventado.
// ⚠️ HISTORIAS NO HAY: Spy no lee las historias de Instagram de nadie. Las alertas dicen lo que Spy sí lee.
//
// Puro (sin `server-only`): lo usan el servidor, la pantalla, la API de MaKo y los tests.
// =============================================================================

import {
  MAXIMO_PARA_COMPARAR, MINIMO_PARA_COMPARAR, chipDeMultiplo, esFuerte, formatoDeMultiplo, mediana, multiplosDe, numeroParaComparar,
  type FormatoMultiplo, type Multiplo, type PiezaParaMultiplo,
} from './multiplo-rendimiento';
import { ENMIENDA_III_L, FALTA_LA_ENMIENDA, dibujarContador } from './spy-reglas';

const DIA = 86_400_000;

// ─────────────────────────────────────────────────────────────────────────────
// A quién sigue el negocio
// ─────────────────────────────────────────────────────────────────────────────

/** Dónde se guarda, por negocio (app_settings). Sin migración: es una lista corta que cambia a mano. */
export const CLAVE_SEGUIDOS = 'spy.seguidos';
/** La ruta de la vista de seguidos: la tarea «Selecciona a tus competidores» de CoPilot lleva acá. */
export const RUTA_SEGUIDOS = '/competitor-spy?ver=seguidos';

/** Por id de competidor: desde cuándo lo sigue. */
export type RegistroSeguidos = Readonly<Record<string, { desde: string }>>;

/** Lee lo guardado. Lo que no se entiende se descarta (nunca tira): un registro roto es «no sigue a nadie», no un error. */
export function leerRegistroSeguidos(crudo: string | null | undefined): RegistroSeguidos {
  if (!crudo) return {};
  let datos: unknown;
  try { datos = JSON.parse(crudo); } catch { return {}; }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return {};
  const out: Record<string, { desde: string }> = {};
  for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
    const id = Number(k);
    const desde = (v as { desde?: unknown } | null)?.desde;
    if (!Number.isInteger(id) || id <= 0 || typeof desde !== 'string' || !Number.isFinite(Date.parse(desde))) continue;
    out[String(id)] = { desde };
  }
  return out;
}

/** Seguir o dejar de seguir. Seguir a quien ya sigue no le cambia el «desde». */
export function cambiarSeguido(r: RegistroSeguidos, id: number, seguir: boolean, ahora: string): RegistroSeguidos {
  const k = String(id);
  if (seguir) return r[k] ? r : { ...r, [k]: { desde: ahora } };
  if (!r[k]) return r;
  const { [k]: _fuera, ...resto } = r;
  return resto;
}

/** Los ids seguidos, del más viejo al más nuevo. Con `existen`, sólo los que siguen en la lista (un borrado no se sigue). */
export function idsSeguidos(r: RegistroSeguidos, existen?: Iterable<number>): number[] {
  const hay = existen ? new Set(existen) : null;
  return Object.entries(r)
    .map(([k, v]) => ({ id: Number(k), t: Date.parse(v.desde) }))
    .filter((x) => !hay || hay.has(x.id))
    .sort((a, b) => a.t - b.t || a.id - b.id)
    .map((x) => x.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo nuevo de un seguido, más seguido: cada día en vez de cada semana
// ─────────────────────────────────────────────────────────────────────────────

/** Cada cuántos días la traída larga (Instagram y anuncios, lib/spy-todo.ts) mira lo nuevo de un SEGUIDO. Los demás, a la semana. */
export const DIAS_ENTRE_CORRIDAS_SEGUIDO = 1;
/** Cada cuántas horas el cron relee el YouTube de un seguido (es de la cuota de YouTube, no de Apify). */
export const HORAS_ENTRE_YOUTUBE = 20;
/** Cuándo se leyó por última vez el YouTube de cada seguido (por negocio). Lo escribe sólo el cron. */
export const CLAVE_YOUTUBE_SEGUIDOS = 'spy.seguidos.youtube';

/** ¿Toca releer su YouTube? Nunca leído, o hace más de `HORAS_ENTRE_YOUTUBE`. */
export function tocaYoutube(ultima: string | null | undefined, ahora: number): boolean {
  const t = Date.parse(ultima ?? '');
  return !Number.isFinite(t) || ahora - t >= HORAS_ENTRE_YOUTUBE * 3_600_000;
}

/** Lee el registro de las lecturas de YouTube (id → ISO). Nunca tira. */
export function leerLecturasYoutube(crudo: string | null | undefined): Record<string, string> {
  if (!crudo) return {};
  try {
    const d = JSON.parse(crudo) as unknown;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
    return Object.fromEntries(Object.entries(d as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
  } catch { return {}; }
}

// ─────────────────────────────────────────────────────────────────────────────
// El número de los seguidos, por red: «con qué número se publica»
// ─────────────────────────────────────────────────────────────────────────────

export type RedDelNumero = 'reel' | 'publicacion' | 'short' | 'video';
export type MotivoSinNumero = 'falta-enmienda' | 'pocas' | 'sin-seguidos';

/** Las redes que tienen número, en el orden en que se muestran. Cada una es un canal y un formato del múltiplo. */
export const REDES_DEL_NUMERO: ReadonlyArray<{ red: RedDelNumero; nombre: string; canal: 'instagram' | 'youtube'; formato: FormatoMultiplo; metrica: 'vistas' | 'interaccion' }> = [
  { red: 'reel', nombre: 'Reels', canal: 'instagram', formato: 'corto', metrica: 'vistas' },
  { red: 'publicacion', nombre: 'Carruseles e imágenes', canal: 'instagram', formato: 'imagenes', metrica: 'interaccion' },
  { red: 'short', nombre: 'Shorts', canal: 'youtube', formato: 'corto', metrica: 'vistas' },
  { red: 'video', nombre: 'Videos de YouTube', canal: 'youtube', formato: 'largo', metrica: 'vistas' },
];

export type NumeroDeCompetidor = {
  id: number; nombre: string;
  /** Lo que suele hacer: la mediana de sus últimas piezas de ese formato. null con menos de `MINIMO_PARA_COMPARAR`. */
  mediana: number | null;
  /** Cuántas piezas entraron (hasta `MAXIMO_PARA_COMPARAR`). */
  piezas: number;
  /** La fecha de la más nueva que entró: de cuándo es su número. */
  hasta: string | null;
};

export type NumeroDeRed = {
  red: RedDelNumero; nombre: string; metrica: 'vistas' | 'interaccion';
  /** El promedio de las medianas de los seguidos que tienen número. null = no hay (el motivo lo dice). */
  promedio: number | null;
  motivo: MotivoSinNumero | null;
  /** Lo que se le dice a la persona, en una frase. */
  explicacion: string;
  competidores: NumeroDeCompetidor[];
};

export type NumeroDeSeguidos = { seguidos: number; redes: NumeroDeRed[] };

/** Lo que hace falta de una pieza para el número y las alertas (una fila de `spy_piezas`). */
export type PiezaSeguida = PiezaParaMultiplo & {
  ref: string;
  url: string | null;
  miniatura?: string | null;
  visto_primera_vez: string;
  analisis?: { gancho?: string | null; angulo?: string | null; formato?: string | null } | null;
};

const UNIDAD: Record<'vistas' | 'interaccion', string> = { vistas: 'vistas', interaccion: 'me gusta y comentarios' };

/** Lo que se cuenta, en palabras: «vistas», «me gusta y comentarios». */
export const unidadDelNumero = (metrica: 'vistas' | 'interaccion'): string => UNIDAD[metrica];

/** «12 mil vistas», «850 me gusta y comentarios». Sin número, null. */
export function rotuloDelNumero(n: Pick<NumeroDeRed, 'promedio' | 'metrica'>): string | null {
  return n.promedio == null ? null : `${dibujarContador(n.promedio)} ${UNIDAD[n.metrica]}`;
}

function explicacionDe(motivo: MotivoSinNumero | null, contadas: number): string {
  if (motivo === 'falta-enmienda') return FALTA_LA_ENMIENDA;
  if (motivo === 'sin-seguidos') return 'Todavía no sigues a ninguna cuenta.';
  if (motivo === 'pocas') return `Ninguna de las cuentas que sigues tiene ${MINIMO_PARA_COMPARAR} publicaciones de este formato con números.`;
  return contadas === 1
    ? `Lo que suele hacer la única cuenta que sigues con este formato.`
    : `Lo que suele hacer una cuenta que sigues: el promedio de ${contadas}.`;
}

/**
 * El número de los seguidos en cada red. `piezas` son las de los seguidos (las de otros se ignoran: se filtra por
 * `competidores`). `conYouTube` es SÓLO para los tests, como en `multiplosDe`: la app usa `ENMIENDA_III_L`.
 */
export function numeroDeSeguidos(
  piezas: readonly PiezaParaMultiplo[],
  competidores: ReadonlyArray<{ id: number; nombre: string }>,
  ahora: number = Date.now(),
  o: { conYouTube?: boolean } = {},
): NumeroDeSeguidos {
  const conYouTube = o.conYouTube ?? ENMIENDA_III_L;
  const ids = new Set(competidores.map((c) => c.id));
  // Por competidor y red: los números que entran, con su fecha.
  const grupos = new Map<string, Array<{ v: number; t: number }>>();
  for (const p of piezas) {
    if (!ids.has(p.competidor_id)) continue;
    const r = numeroParaComparar(p, ahora, { conYouTube });
    if (!('valor' in r)) continue;
    const red = REDES_DEL_NUMERO.find((x) => x.canal === p.canal && x.formato === r.formato);
    if (!red) continue;
    const k = `${p.competidor_id}|${red.red}`;
    const g = grupos.get(k);
    if (g) g.push({ v: r.valor, t: r.t }); else grupos.set(k, [{ v: r.valor, t: r.t }]);
  }
  const redes = REDES_DEL_NUMERO.map((red): NumeroDeRed => {
    const porCompetidor = competidores.map((c): NumeroDeCompetidor => {
      const ultimas = [...(grupos.get(`${c.id}|${red.red}`) ?? [])].sort((a, b) => b.t - a.t).slice(0, MAXIMO_PARA_COMPARAR);
      return {
        id: c.id, nombre: c.nombre, piezas: ultimas.length,
        mediana: ultimas.length >= MINIMO_PARA_COMPARAR ? mediana(ultimas.map((x) => x.v)) : null,
        hasta: ultimas.length ? new Date(ultimas[0].t).toISOString() : null,
      };
    });
    const con = porCompetidor.filter((c) => c.mediana != null);
    const motivo: MotivoSinNumero | null = !competidores.length ? 'sin-seguidos'
      : red.canal === 'youtube' && !conYouTube ? 'falta-enmienda'
        : !con.length ? 'pocas' : null;
    const promedio = motivo ? null : Math.round(con.reduce((s, c) => s + (c.mediana as number), 0) / con.length);
    return { red: red.red, nombre: red.nombre, metrica: red.metrica, promedio, motivo, explicacion: explicacionDe(motivo, con.length), competidores: porCompetidor };
  });
  return { seguidos: competidores.length, redes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las alertas: lo nuevo y los outliers de los seguidos
// ─────────────────────────────────────────────────────────────────────────────

/** Lo nuevo: lo publicado en los últimos días. */
export const DIAS_NOVEDADES = 14;
/** Un outlier es «nuevo» si se publicó en este plazo (el múltiplo recién existe a la semana: `DIAS_PARA_COMPARAR`). */
export const DIAS_OUTLIER = 30;
/** Como mucho, cuántas alertas: los outliers primero, después lo nuevo. */
export const TOPE_ALERTAS = 60;
/**
 * De lo nuevo, como mucho cuántas piezas por cuenta: Dave Ramsey sube varios videos por día y, sin tope, lo nuevo de los demás
 * no se veía (medido con el ws 9 el 13/11/2026: 40 de las 50 eran suyas). Los outliers no tienen tope: son la alerta.
 */
export const TOPE_NUEVAS_POR_CUENTA = 6;

export type FormatoAlerta = 'reel' | 'carrusel' | 'imagen' | 'publicacion' | 'short' | 'video' | 'anuncio';

/** El formato de una pieza para la alerta. Una publicación vieja (sin `medio`, antes de la mig 0391) es «publicacion». */
export function formatoDeAlerta(p: Pick<PiezaParaMultiplo, 'canal' | 'tipo' | 'medio' | 'duracion'>): FormatoAlerta | null {
  if (p.canal === 'anuncios') return 'anuncio';
  if (p.canal === 'instagram') return p.tipo === 'reel' || p.medio === 'video' ? 'reel' : p.medio === 'carrusel' ? 'carrusel' : p.medio === 'imagen' ? 'imagen' : 'publicacion';
  if (p.canal === 'youtube') return formatoDeMultiplo(p) === 'corto' ? 'short' : 'video';
  return null;
}

/** Cuándo apareció: cuando se publicó, o (un anuncio pegado sin fecha) cuando Spy lo vio por primera vez. */
export const cuandoDePieza = (p: Pick<PiezaSeguida, 'publicada_en' | 'visto_primera_vez'>): string => p.publicada_en ?? p.visto_primera_vez;

export type AlertaDeSeguido<T extends PiezaSeguida = PiezaSeguida> = {
  tipo: 'nueva' | 'outlier';
  pieza: T;
  formato: FormatoAlerta;
  /** El múltiplo de toda la app (sobre TODAS las piezas de su cuenta). null o sin número en lo nuevo de menos de una semana. */
  multiplo: Multiplo | null;
};

/**
 * Las alertas de los seguidos, sobre TODAS sus piezas (el múltiplo compara cada una con su cuenta). Los outliers primero (desde
 * 2×, publicados en los últimos `DIAS_OUTLIER` días), después lo nuevo de los últimos `dias`; en cada grupo, lo más nuevo
 * primero. Una pieza que es las dos cosas sale una vez, como outlier.
 */
export function alertasDe<T extends PiezaSeguida>(
  piezas: readonly T[],
  ahora: number = Date.now(),
  o: { dias?: number; tope?: number; conYouTube?: boolean } = {},
): AlertaDeSeguido<T>[] {
  const dias = o.dias ?? DIAS_NOVEDADES;
  const multiplos = multiplosDe(piezas, ahora, { conYouTube: o.conYouTube ?? ENMIENDA_III_L });
  const outliers: AlertaDeSeguido<T>[] = [];
  const nuevas: AlertaDeSeguido<T>[] = [];
  for (const p of piezas) {
    const formato = formatoDeAlerta(p);
    if (!formato) continue;
    const t = Date.parse(cuandoDePieza(p));
    if (!Number.isFinite(t) || t > ahora + DIA) continue;
    const m = multiplos.get(p.id) ?? null;
    if (esFuerte(m) && ahora - t <= DIAS_OUTLIER * DIA) outliers.push({ tipo: 'outlier', pieza: p, formato, multiplo: m });
    else if (ahora - t <= dias * DIA) nuevas.push({ tipo: 'nueva', pieza: p, formato, multiplo: m });
  }
  const porFecha = (a: AlertaDeSeguido<T>, b: AlertaDeSeguido<T>) => Date.parse(cuandoDePieza(b.pieza)) - Date.parse(cuandoDePieza(a.pieza)) || b.pieza.id - a.pieza.id;
  const porCuenta = new Map<number, number>();
  const variadas = nuevas.sort(porFecha).filter((a) => {
    const n = (porCuenta.get(a.pieza.competidor_id) ?? 0) + 1;
    porCuenta.set(a.pieza.competidor_id, n);
    return n <= TOPE_NUEVAS_POR_CUENTA;
  });
  return [...outliers.sort(porFecha), ...variadas].slice(0, o.tope ?? TOPE_ALERTAS);
}

/** El título de la pieza en la alerta: su gancho (de la IA), su título, o la primera línea de su texto. */
export function tituloDeAlerta(p: Pick<PiezaSeguida, 'analisis' | 'titulo' | 'texto'>): string | null {
  const t = p.analisis?.gancho?.trim() || p.titulo?.trim() || p.texto?.split('\n')[0]?.trim() || '';
  return t ? t.slice(0, 160) : null;
}

/** El id con que Copywriting replica una pieza de Spy (lib/copywriter/outliers-servidor.ts, `outlierCopyPorId`). */
export const idParaReplicar = (piezaId: number): string => `spy:${piezaId}`;

/** El chip del múltiplo para la alerta («3,2×», «4× activo»), o null. */
export const chipDeAlerta = (a: Pick<AlertaDeSeguido, 'multiplo'>): string | null => chipDeMultiplo(a.multiplo);

// ─────────────────────────────────────────────────────────────────────────────
// La alerta como la lee CoPilot y la API de MaKo (sin la fila entera)
// ─────────────────────────────────────────────────────────────────────────────

export type Alerta = {
  tipo: 'nueva' | 'outlier';
  competidor: { id: number; nombre: string; avatar: string | null };
  pieza: { id: number; canal: string; formato: FormatoAlerta; titulo: string | null; url: string | null; miniatura: string | null; publicadaEn: string };
  multiplo: { veces: number; chip: string } | null;
  /** Con qué ángulo le está funcionando (lo que leyó la IA de Spy). null si todavía no se analizó. */
  angulo: string | null;
  gancho: string | null;
  /** Para «¿Creamos uno parecido?»: el id que replica Copywriting (`pedirReplicar`). */
  replicar: string;
};

/** La alerta compacta. `miniatura` llega ya resuelta (`miniaturaDePieza`, lib/spy-vista.ts: la que vence no se manda). */
export function alertaCompacta(
  a: AlertaDeSeguido,
  competidor: { id: number; nombre: string; avatar?: string | null } | undefined,
  miniatura: string | null,
): Alerta {
  const p = a.pieza;
  const chip = chipDeAlerta(a);
  return {
    tipo: a.tipo,
    competidor: { id: p.competidor_id, nombre: competidor?.nombre ?? '', avatar: competidor?.avatar ?? null },
    pieza: { id: p.id, canal: p.canal, formato: a.formato, titulo: tituloDeAlerta(p), url: p.url, miniatura, publicadaEn: cuandoDePieza(p) },
    multiplo: a.multiplo && a.multiplo.veces != null && chip ? { veces: a.multiplo.veces, chip } : null,
    angulo: p.analisis?.angulo?.trim() || null,
    gancho: p.analisis?.gancho?.trim() || null,
    replicar: idParaReplicar(p.id),
  };
}
