// =============================================================================
// medios-automatizacion — qué MEDIOS usa una automatización y cuáles le faltan conectar
// =============================================================================
// Décima tanda (11/10/2026, GENERAL 6), textual: «Si un usuario está creando una automatización que utiliza
// un medio que aún no conectó, en la tarjeta lo debe decir, y al momento de probarlo también. Y claro, no
// dejar publicarlo hasta que no lo configure. Y esas configuraciones siempre allí mismo, sin salirse de la
// pestaña.» Diseño: docs/diseno-automations-configuraciones.md §2.
//
// UNA función dice qué usa un flujo (`mediosQueUsa`) y otra qué le falta (`faltantes`), contra el estado que
// mide el server (`estadoMedios`, lib/disparadores-canales.ts). La leen la tarjeta (el chip «Sin conectar»),
// «Probar» (el botón pasa a «Conectar»), Publicar (409) y Activar (`validarActivacion`, lib/nutricion.ts):
// las cuatro preguntan lo mismo y no pueden contestar distinto.
//
// Qué es «conectado», por medio (lo mide el server):
//   · WhatsApp — la línea de la automatización (`instance_name`; null = la de por default) con
//     `estado = 'conectado'` y número. Sólo el NO OFICIAL (Evolution): el oficial (una plantilla de Meta) no
//     pasa por una línea nuestra y no se mide acá.
//   · Email — key de Resend y un remitente que no es el sandbox NI de MaKo (`emailConectado`, lib/resend.ts).
//   · Instagram / Messenger (un paso que MANDA) — Zernio y una cuenta de esa plataforma.
//
// ⚠️ `conectado: null` («NO PUDE COMPROBARLO») AVISA Y NO FRENA: conectar no lo arregla (AGENTS.md, «una
// guarda bloquea sólo lo que se arregla haciendo lo que ella pide»).
//
// ⚠️ GUARDAR NO ES PUBLICAR: esto frena Publicar y Activar, nunca `setSecuenciaPasos`. La galería, duplicar y
// los scripts tienen que poder crear un borrador sin el medio.
//
// ⚠️ SIN `server-only`: lo importan el lienzo, «Probar», la ruta y el motor, y su test.

import { claseDe, esPasoIA, medioDe, type PasoGrafo } from './flujo-grafo';
import { proveedorDelPaso } from './nutricion-canal';
import { esCanalSocial } from './canal-social';

export type Medio = 'whatsapp' | 'email' | 'instagram' | 'messenger';
/** En el orden en que se dicen («Conecta tu WhatsApp» antes que «Conecta tu email»). */
export const MEDIOS: readonly Medio[] = ['whatsapp', 'email', 'instagram', 'messenger'];

export type EstadoMedio = { conectado: boolean | null; motivo?: string; cuenta?: string | null };

/**
 * Lo que midió el server. Un medio AUSENTE = no se midió (no se preguntó por él): no avisa ni frena.
 * WhatsApp va por LÍNEA: cada automatización sale por la suya (`instance_name`).
 */
export type EstadoMedios = {
  whatsapp?: { porDefecto: EstadoMedio; lineas: Record<string, EstadoMedio> };
  email?: EstadoMedio;
  instagram?: EstadoMedio;
  messenger?: EstadoMedio;
};

/** Lo que se le dice a quien tiene que conectarlo. Corto: va en un chip, en un botón y en un 409. */
export const MOTIVO_MEDIO: Record<Medio, string> = {
  whatsapp: 'Conecta tu WhatsApp',
  email: 'Conecta tu email',
  instagram: 'Conecta tu Instagram',
  messenger: 'Conecta tu Messenger',
};
/** El rótulo del chip de la tarjeta. */
export const CHIP_SIN_CONECTAR = 'Sin conectar';
export const CHIP_NO_SE = 'Sin comprobar';

const conCanal = (p: PasoGrafo): string | null => {
  const c = (p as { canal?: unknown }).canal;
  return typeof c === 'string' ? c : null;
};

/**
 * El medio por el que SALE (o escucha) una tarjeta, o null si no usa ninguno de los que se miden.
 *   · un mensaje: su canal (WhatsApp sólo si es el no oficial);
 *   · «Si responde» / AI Step: escucha la respuesta por el canal de la charla (WhatsApp, salvo que el paso
 *     diga Instagram o Messenger). Un email no se escucha (el buzón de entrada no existe todavía);
 *   · lo demás (una acción —incluida «MaKo en WhatsApp», que sale por la línea de MaKo—, una espera, una
 *     condición): ninguno.
 */
export function medioDePaso(p: PasoGrafo): Medio | null {
  const clase = claseDe(p);
  const canal = conCanal(p);
  if (clase === 'mensaje') {
    if (canal === 'email') return 'email';
    if (esCanalSocial(canal)) return canal;
    return proveedorDelPaso(p as Parameters<typeof proveedorDelPaso>[0]) === 'no_oficial' ? 'whatsapp' : null;
  }
  if (clase === 'respuesta') {
    // AI Step v2 (décima tanda): el medio va en su propio campo (`medio`, ausente = WhatsApp), no en `canal`.
    if (esPasoIA(p)) return medioDe(p);
    if (esCanalSocial(canal)) return canal;
    return canal === 'email' ? null : 'whatsapp';
  }
  return null;
}

/** Los medios que usa un flujo, sin repetir y en el orden de `MEDIOS`. */
export function mediosQueUsa(pasos: readonly PasoGrafo[] | null | undefined): Medio[] {
  const usa = new Set<Medio>();
  for (const p of pasos ?? []) {
    if (!p || typeof p !== 'object') continue;
    const m = medioDePaso(p);
    if (m) usa.add(m);
  }
  return MEDIOS.filter((m) => usa.has(m));
}

/** El estado de UN medio para esta automatización (WhatsApp, el de su línea). `undefined` = no se midió. */
export function estadoDe(estado: EstadoMedios | null | undefined, medio: Medio, linea: string | null | undefined): EstadoMedio | undefined {
  if (!estado) return undefined;
  if (medio === 'whatsapp') {
    const wa = estado.whatsapp;
    if (!wa) return undefined;
    if (!linea) return wa.porDefecto;
    const l = wa.lineas[linea];
    if (l) return l;
    // Sin las líneas leídas (el server no pudo: `porDefecto` en null) no se sabe si la de la automatización
    // existe: «no pude comprobarlo», no «sin conectar».
    return wa.porDefecto.conectado === null ? wa.porDefecto : { conectado: false, motivo: MOTIVO_MEDIO.whatsapp };
  }
  return estado[medio];
}

/**
 * La línea por la que sale UN paso de WhatsApp: la suya si eligió otra («Si más adelante en la automatización
 * quiero enviar otro mensaje por otro de mis números», sexta tanda; el motor la lee con `lineaDelPaso`), si no
 * la de la automatización (null = la de por default).
 */
export function lineaDePaso(p: PasoGrafo, lineaAutomatizacion: string | null | undefined): string | null {
  const l = (p as { linea?: unknown }).linea;
  return typeof l === 'string' && l.trim() ? l.trim() : (lineaAutomatizacion ?? null);
}

/** Un medio que usa el flujo, con la línea (sólo WhatsApp). */
export type UsoMedio = { medio: Medio; linea: string | null };

/** Lo que usa el flujo, por medio y por línea, sin repetir y en el orden de `MEDIOS`. */
export function usosDeMedios(pasos: readonly PasoGrafo[] | null | undefined, lineaAutomatizacion: string | null | undefined): UsoMedio[] {
  const vistos = new Map<string, UsoMedio>();
  for (const p of pasos ?? []) {
    if (!p || typeof p !== 'object') continue;
    const m = medioDePaso(p);
    if (!m) continue;
    const linea = m === 'whatsapp' ? lineaDePaso(p, lineaAutomatizacion) : null;
    vistos.set(`${m}|${linea ?? ''}`, { medio: m, linea });
  }
  return [...vistos.values()].sort((a, b) => MEDIOS.indexOf(a.medio) - MEDIOS.indexOf(b.medio));
}

export type Faltante = { medio: Medio; linea: string | null; conectado: false | null; motivo: string };

/** Lo que le falta: los usos que no están conectados (o no se pudo comprobar). */
export function faltantes(usos: readonly UsoMedio[], estado: EstadoMedios | null | undefined): Faltante[] {
  const out: Faltante[] = [];
  for (const u of usos) {
    const e = estadoDe(estado, u.medio, u.linea);
    if (!e || e.conectado === true) continue;
    out.push({ medio: u.medio, linea: u.linea, conectado: e.conectado === false ? false : null, motivo: e.conectado === false ? MOTIVO_MEDIO[u.medio] : CHIP_NO_SE });
  }
  return out;
}

/** Lo que FRENA Publicar y Activar: el primero que se sabe sin conectar. «No pude comprobarlo» no frena. */
export function frenoDeMedios(faltan: readonly Faltante[]): { medio: Medio; error: string } | null {
  const f = faltan.find((x) => x.conectado === false);
  return f ? { medio: f.medio, error: MOTIVO_MEDIO[f.medio] } : null;
}

/** El medio de un error de Publicar/Activar («Conecta tu WhatsApp» → 'whatsapp'), para abrir «Conectar». */
export function medioDelError(texto: string | null | undefined): Medio | null {
  if (!texto) return null;
  for (const m of MEDIOS) if (texto.includes(MOTIVO_MEDIO[m])) return m;
  return null;
}

/** El chip de una tarjeta, o null si su medio está conectado (o no usa ninguno, o no se midió). */
export function chipDeTarjeta(p: PasoGrafo, estado: EstadoMedios | null | undefined, lineaAutomatizacion: string | null | undefined): { texto: string; medio: Medio; frena: boolean } | null {
  const m = medioDePaso(p);
  if (!m) return null;
  const e = estadoDe(estado, m, m === 'whatsapp' ? lineaDePaso(p, lineaAutomatizacion) : null);
  if (!e || e.conectado === true) return null;
  return { texto: e.conectado === false ? CHIP_SIN_CONECTAR : CHIP_NO_SE, medio: m, frena: e.conectado === false };
}

/**
 * Lo que se le pregunta al server: los medios del flujo, para no medir lo que no usa (Zernio y Meta tardan).
 * La línea no viaja: WhatsApp vuelve medido por línea, y cada pantalla elige la suya (`estadoDe`).
 */
export function consultaDeMedios(usa: readonly Medio[]): string {
  return new URLSearchParams({ medios: usa.join(',') }).toString();
}

/** Lo inverso, del lado del server: sólo medios conocidos. */
export function mediosDeConsulta(v: string | null | undefined): Medio[] {
  const pedidos = new Set((v ?? '').split(',').map((s) => s.trim()));
  return MEDIOS.filter((m) => pedidos.has(m));
}
