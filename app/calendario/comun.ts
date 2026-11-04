// =============================================================================
// comun — lo que comparten las piezas de la copia de Google Calendar: de qué calendario es cada renglón y su color
// =============================================================================
// En la barra lateral, como en Google, cada renglón cuelga de UN calendario con su casilla de color:
//   · «Mis calendarios» (MaKo): Publicaciones, Llamadas, Bloques de trabajo, el Plan, Se repite, Cobros y los Objetivos — las capas de
//     siempre (lib/calendario-modelo.ts), con un color de la paleta de Google para que se lean como calendarios.
//   · La cuenta de Google conectada: cada uno de sus calendarios, con el color que le dio Google.
// La llave de un calendario es `mk:<capa>` o `g:<id de Google>`, y es lo que se prende y apaga.
//
// ⚠️ PURO Y SIN 'use client', A PROPÓSITO (15/10/2026): lo usa también el Calendario del teléfono (app/m/calendario).
//    Lo que vivía en VistaTiempo, Tarjetas y CalendarioApp y el teléfono necesita (la línea de la hora, el título, qué
//    se ve, cómo se arma un evento nuevo) se mudó acá, y esos archivos lo re-exportan o lo importan: una regla atrapada
//    en un módulo 'use client' arrastra la pantalla entera al bundle de quien la usa (AGENTS.md, MaKo Mobile).
// =============================================================================

import {
  CAPAS_CALENDARIO, diaDe, fechaLarga, horaDe, horaGoogle, sinDuplicarLlamadas,
  type CapaCalendario, type EntradaEvento, type FormatoPublicacion, type ItemCalendario, type TipoEvento,
} from '@/lib/calendario-modelo';
import type { CalendarioGoogle, EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import { ROTULO_RECURRENTE } from '@/lib/plan-recurrentes';
import type { EntidadChat } from '@/lib/chat-desde';

/**
 * De qué le habla la persona a MaKo con un renglón abierto (24/10/2026, la llamada con Leandro, f08: «le tenés que poder
 * decir che Maco, movéme la reunión, agendame tal o tal»): la llamada del CRM es SU lead (las herramientas de reuniones del
 * CRM lo toman por defecto: `proponer_mover_reunion`, `proponer_cambiar_reunion`…), y lo del Plan, su tarea o su proyecto.
 * Lo de Google y lo propio no tienen entidad: la agenda de Google no pasa por la IA (AGENTS.md, `datosDeGoogle`).
 */
export function entidadDelItem(it: ItemCalendario | null): EntidadChat | null {
  if (!it) return null;
  const m = /^crm:(\d{1,15}):R[12]$/.exec(it.id);
  if (m && it.fuente === 'crm') return { tipo: 'lead', id: Number(m[1]), titulo: it.titulo };
  const p = /^plan:([tp]):(.+)$/.exec(it.id);
  if (p && it.fuente === 'plan') return { tipo: p[1] === 't' ? 'tarea' : 'proyecto', id: p[2], titulo: it.titulo };
  return null;
}

/**
 * El color de cada calendario de MaKo, de la paleta de eventos de Google (los mismos hex que su web).
 * ⚠️ CUATRO COLORES, UNO POR USO (29/10/2026, «a la medida del negocio»): Publicaciones violeta, el Plan naranja (sus deadlines
 *    y lo que se repite, que son tareas del Plan), Ventas azul y Entregas verde. Lo demás (bloques, cobros, objetivos) va en
 *    gris: «Otros» no compite con los cuatro. Las ediciones del newsletter (29/10/2026, sólo de la plataforma mientras esté en
 *    PRONTO) también van a «Otros»: no son uno de los cuatro usos.
 */
export const COLOR_CAPA: Record<CapaCalendario, string> = {
  publicaciones: '#8e24aa',
  llamadas: '#039be5',
  entregas: '#33b679',
  bloques: '#616161',
  plan: '#f4511e',
  recurrentes: '#f4511e',
  cobros: '#616161',
  newsletters: '#616161',
  objetivos: '#616161',
};

/** El nombre de cada calendario de MaKo en la barra lateral. */
export const NOMBRE_CAPA: Record<CapaCalendario, string> = {
  publicaciones: 'Publicaciones',
  llamadas: 'Llamadas de venta',
  entregas: 'Entregas',
  bloques: 'Bloques de trabajo',
  plan: 'Plan',
  recurrentes: ROTULO_RECURRENTE,
  cobros: 'Cobros',
  newsletters: 'Newsletter',
  objetivos: 'Objetivos',
};

export const LLAVES_MAKO = CAPAS_CALENDARIO.map((c) => `mk:${c.id}`);

/**
 * LOS CUATRO USOS del Calendario (Martín, 29/10/2026: «Esa pestaña es principalmente para gestionar publicaciones, para
 * recordatorios de deadlines del propio Plan, para reuniones de llamadas de ventas, reuniones de entrega de servicio»). Cada
 * uno es un filtro con su color (la leyenda) y se crea en un clic (`crea`: el tipo propio, o `null` si vive en otra tab y
 * se crea ahí: un deadline es una tarea del Plan). Lo que no es de ninguno (bloques, cobros, objetivos) va en «Otros».
 */
export type UsoCalendario = 'publicaciones' | 'plan' | 'ventas' | 'entregas' | 'otros';
export const USOS_CALENDARIO: ReadonlyArray<{ id: UsoCalendario; nombre: string; capas: readonly CapaCalendario[]; color: string; crea: TipoEvento | null }> = [
  { id: 'publicaciones', nombre: 'Publicaciones', capas: ['publicaciones'], color: COLOR_CAPA.publicaciones, crea: 'publicacion' },
  { id: 'plan', nombre: 'Plan', capas: ['plan', 'recurrentes'], color: COLOR_CAPA.plan, crea: null },
  { id: 'ventas', nombre: 'Ventas', capas: ['llamadas'], color: COLOR_CAPA.llamadas, crea: 'llamada' },
  { id: 'entregas', nombre: 'Entregas', capas: ['entregas'], color: COLOR_CAPA.entregas, crea: 'entrega' },
  { id: 'otros', nombre: 'Otros', capas: ['bloques', 'cobros', 'newsletters', 'objetivos'], color: COLOR_CAPA.bloques, crea: null },
];
/** El uso de una capa de MaKo. */
export const usoDeCapa = (c: CapaCalendario): UsoCalendario => USOS_CALENDARIO.find((u) => u.capas.includes(c))?.id ?? 'otros';

export const llaveDe = (it: ItemCalendario): string => (it.google ? `g:${it.google.calendarioId}` : `mk:${it.capa}`);
export const colorDe = (it: ItemCalendario): string => it.google?.color ?? COLOR_CAPA[it.capa];

/** Se puede mover en la grilla: lo propio, y lo de Google que es editable. */
export const sePuedeMover = (it: ItemCalendario, googleEscribe: boolean): boolean =>
  it.fuente === 'propio' || (!!it.google && it.google.editable && googleEscribe);

// ── Qué se ve ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lo que se ve sin que la persona haya elegido nada: los calendarios de MaKo, y los de Google como estén tildados en Google. */
export const visiblesPorDefecto = (calendarios: readonly CalendarioGoogle[]): Set<string> =>
  new Set([...LLAVES_MAKO, ...calendarios.filter((c) => c.seleccionado).map((c) => `g:${c.id}`)]);

/**
 * Sin la llamada repetida: la reunión del CRM y su evento de Google son la misma; si las dos están a la vista, queda la
 * del CRM, que lleva a la ficha. `prendidos` ya viene filtrado por lo que se ve.
 */
export function sinLlamadasRepetidas(prendidos: readonly ItemCalendario[]): ItemCalendario[] {
  const crm = prendidos.filter((i) => i.fuente === 'crm');
  const google = prendidos.filter((i) => i.fuente === 'google');
  const sinRepetir = new Set(sinDuplicarLlamadas(crm, google).map((i) => i.id));
  return prendidos.filter((i) => i.fuente !== 'google' || sinRepetir.has(i.id));
}

// ── Cómo se escribe un renglón ──────────────────────────────────────────────────────────────────────────────────────

/** «10 – 11 a.m.», «10 a.m. – 1 p.m.»: un rango de horas como lo escribe Google (sin repetir el sufijo si es el mismo). */
export function rangoGoogle(ini: string, fin: string | null): string {
  if (!fin) return horaGoogle(ini);
  const sufIni = Number(ini.slice(0, 2)) < 12 ? 'a.m.' : 'p.m.';
  const sufFin = Number(fin.slice(0, 2)) < 12 ? 'a.m.' : 'p.m.';
  if (sufIni === sufFin) return `${horaGoogle(ini).replace(/ [ap]\.m\.$/, '')} – ${horaGoogle(fin)}`;
  return `${horaGoogle(ini)} – ${horaGoogle(fin)}`;
}

/** El título que se dibuja: una reunión del CRM lleva cuál es («Ana Pérez · R1»). */
export function tituloDe(it: ItemCalendario, tz: string): string {
  void tz;
  if (it.fuente === 'crm' && it.detalle) return `${it.titulo} · ${it.detalle.split(' · ')[0]}`;
  return it.titulo;
}

/** La línea de la fecha de un renglón: «miércoles, 14 de octubre · 10 – 11 a.m.». */
export function lineaDeFecha(it: ItemCalendario, tz: string): string {
  if (it.google?.diaCompleto && it.google.fecha) {
    const ini = fechaLarga(it.google.fecha);
    return it.google.fechaFin && it.google.fechaFin !== it.google.fecha ? `${ini} – ${fechaLarga(it.google.fechaFin)}` : ini;
  }
  const dia = fechaLarga(diaDe(it.inicio, tz));
  if (it.diaCompleto) return dia;
  const fin = it.fin ? horaDe(it.fin, tz) : null;
  const finDia = it.fin ? diaDe(it.fin, tz) : null;
  if (finDia && finDia !== diaDe(it.inicio, tz)) return `${dia}, ${rangoGoogle(horaDe(it.inicio, tz), null)} – ${fechaLarga(finDia)}, ${rangoGoogle(fin!, null)}`;
  return `${dia} · ${rangoGoogle(horaDe(it.inicio, tz), fin)}`;
}

/** El calendario de un renglón: el de Google donde vive, o la capa de MaKo. */
export const nombreCalendarioDe = (it: ItemCalendario, calendarios: readonly CalendarioGoogle[]): string =>
  (it.google ? calendarios.find((c) => c.id === it.google!.calendarioId)?.nombre : null) ?? NOMBRE_CAPA[it.capa];

/** El rótulo del link que lleva a donde vive un renglón que no es de acá (la ficha, el Plan, General). */
export const rotuloDeIr = (it: ItemCalendario): string =>
  it.fuente === 'crm' || it.fuente === 'cobro' ? 'Abrir la ficha' : it.fuente === 'plan' ? 'Abrir en el Plan' : it.fuente === 'objetivo' ? 'Ver en General'
    : it.fuente === 'newsletter' ? 'Abrir la edición' : 'Abrir';

// ── Crear (el «crear en el lugar» de Google) ────────────────────────────────────────────────────────────────────────

/** Qué se crea: un evento (de Google si hay dónde, si no de MaKo) o uno de MaKo de un tipo. */
export type TipoRapido = 'evento' | TipoEvento;
/**
 * Los tipos de «crear» en el lugar (computadora y teléfono). Desde el 29/10/2026, los de los cuatro usos (el Bloque de trabajo
 * se fue: no es ninguno) y el evento de Google. Un deadline no está: es una tarea del Plan y se crea en el Plan.
 */
export const TIPOS_RAPIDO: ReadonlyArray<{ id: TipoRapido; nombre: string }> = [
  { id: 'evento', nombre: 'Evento' },
  { id: 'publicacion', nombre: 'Publicación' },
  { id: 'llamada', nombre: 'Llamada de venta' },
  { id: 'entrega', nombre: 'Entrega' },
];

/** Lo que se armó en «crear»: con eso se guarda o se abre «Más opciones». */
export type BorradorNuevo = {
  tipo: TipoRapido;
  titulo: string;
  fecha: string;
  /** 'HH:MM' o null = todo el día. */
  hora: string | null;
  horaFin: string | null;
  formato: FormatoPublicacion;
  /** El calendario de Google, si el evento va a Google; null = MaKo. */
  calendarioId: string | null;
};

/** Un «Evento» va a Google si hay un calendario donde escribir; lo demás (y todo, sin Google), a MaKo. */
export const vaAGoogle = (b: Pick<BorradorNuevo, 'tipo'>, editables: readonly CalendarioGoogle[]): boolean =>
  b.tipo === 'evento' && editables.length > 0;

/** Los minutos desde la medianoche de una hora 'HH:MM'. */
export const minutosDeHora = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Cuánto dura entre dos horas del mismo día (o hasta la medianoche si el fin es anterior). */
export const duracionEntre = (ini: string, fin: string | null): number | null => {
  if (!fin) return null;
  const d = minutosDeHora(fin) - minutosDeHora(ini);
  return d > 0 ? d : 24 * 60 - minutosDeHora(ini);
};

/** El borrador como evento de MaKo (lo que manda `crearEventosAction`). Sin título, el nombre del tipo. */
export const entradaPropia = (b: BorradorNuevo): EntradaEvento => ({
  titulo: b.titulo.trim() || (b.tipo === 'publicacion' ? 'Publicación' : b.tipo === 'llamada' ? 'Llamada de venta' : b.tipo === 'entrega' ? 'Reunión de entrega' : 'Bloque de trabajo'),
  tipo: b.tipo === 'evento' ? 'bloque' : b.tipo, formato: b.tipo === 'publicacion' ? b.formato : null,
  fecha: b.fecha, hora: b.hora, duracionMin: b.hora ? duracionEntre(b.hora, b.horaFin) : null,
});

/** El borrador como evento de Google (lo que manda `crearEventoGoogleAction`). Con hora y sin fin, una hora. */
export const entradaGoogle = (b: BorradorNuevo): EntradaEventoGoogle => ({
  titulo: b.titulo, fecha: b.fecha, hora: b.hora, duracionMin: b.hora ? duracionEntre(b.hora, b.horaFin) ?? 60 : null, fechaFin: null,
});
