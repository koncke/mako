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
//   · Email — key de Resend y un remitente PROPIO del negocio (`emailConectado`, lib/resend.ts: el que pasa
//     `remitenteDelNegocio`, lib/email-remitente.ts).
//   · Instagram / Messenger (un paso que MANDA) — Zernio y una cuenta de esa plataforma.
//
// ⚠️ EL CRON TAMBIÉN USA UN MEDIO (duodécima tanda, docs/diseno-duodecima-tanda.md §2.11). Un CRON de Instagram o de
// Messenger llega SÓLO por el webhook de Zernio: con tarjetas de WhatsApp y sin Instagram conectado, la automatización
// se publicaba y se ACTIVABA y no arrancaba nunca, sin un error. Publicar y Activar pasan la lista de CRON
// (`mediosQueUsa(pasos, disparadores)`); la tarjeta no la pasa: su chip es de ELLA (el del CRON lo pinta su editor).
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
import { SIN_EMAIL_PROPIO } from './email-remitente';
import { claseDeDisparador, type Disparador } from './disparadores';

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
  // El MISMO texto con el que `sendEmail` se niega sin remitente propio (lib/email-remitente.ts): así
  // `medioDelError` reconoce el error del envío como «falta conectar el email».
  email: SIN_EMAIL_PROPIO,
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

/** Lo que hace falta de un CRON para saber su medio (la lista `disparadores`, lib/disparadores.ts). */
export type CronDeMedio = Pick<Disparador, 'trigger_tipo' | 'cron'>;

/**
 * El medio por el que LLEGA un CRON, o null. Instagram y Messenger, por la MISMA función que dibuja el editor del
 * CRON (`claseDeDisparador`). El email recibido y los pagos no son medios de esta lista: el buzón de entrada no
 * existe y los pagos tienen su propio aviso (lib/cobros.ts).
 */
export function medioDeDisparador(d: CronDeMedio | null | undefined): Medio | null {
  if (!d || typeof d !== 'object' || typeof d.trigger_tipo !== 'string') return null;
  const c = claseDeDisparador(d);
  return c === 'instagram' || c === 'messenger' ? c : null;
}

/**
 * Los medios que usa un flujo, sin repetir y en el orden de `MEDIOS`. Con `disparadores` (Publicar y Activar),
 * también el del CRON.
 */
export function mediosQueUsa(pasos: readonly PasoGrafo[] | null | undefined, disparadores?: readonly CronDeMedio[] | null): Medio[] {
  const usa = new Set<Medio>();
  for (const p of pasos ?? []) {
    if (!p || typeof p !== 'object') continue;
    const m = medioDePaso(p);
    if (m) usa.add(m);
  }
  for (const d of disparadores ?? []) {
    const m = medioDeDisparador(d);
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

/** Lo que usa el flujo, por medio y por línea, sin repetir y en el orden de `MEDIOS`. Con `disparadores`, el CRON. */
export function usosDeMedios(
  pasos: readonly PasoGrafo[] | null | undefined, lineaAutomatizacion: string | null | undefined, disparadores?: readonly CronDeMedio[] | null,
): UsoMedio[] {
  const vistos = new Map<string, UsoMedio>();
  for (const p of pasos ?? []) {
    if (!p || typeof p !== 'object') continue;
    const m = medioDePaso(p);
    if (!m) continue;
    const linea = m === 'whatsapp' ? lineaDePaso(p, lineaAutomatizacion) : null;
    vistos.set(`${m}|${linea ?? ''}`, { medio: m, linea });
  }
  for (const d of disparadores ?? []) {
    const m = medioDeDisparador(d);
    if (m) vistos.set(`${m}|`, { medio: m, linea: null });
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

/**
 * EL MEDIO QUE FRENA UN FLUJO, de punta a punta: lo que usan sus tarjetas y su CRON (`usosDeMedios`), lo que falta
 * (`faltantes`) y el primero que se SABE sin conectar (`frenoDeMedios`), con la línea de WhatsApp de ESA tarjeta (para
 * abrir el QR de la que hace falta). null = nada que frenar, también con «no pude comprobarlo» o sin la lectura.
 *
 * UNA cuenta para las tres puertas: Publicar y Activar en el server (`medioSinConectar`, lib/disparadores-canales.ts) y
 * «Probar» en la pantalla (decimotercera tanda, punto 3: «Me dice "Sin zernio"... Pero me permite probarlo, eso no
 * debería pasar... debe decirme que me falta conectar X cosa»; SecuenciaPerfil.tsx, `probar`).
 */
export function medioQueFrena(
  pasos: readonly PasoGrafo[] | null | undefined, lineaAutomatizacion: string | null | undefined,
  disparadores: readonly CronDeMedio[] | null | undefined, estado: EstadoMedios | null | undefined,
): { medio: Medio; linea: string | null; error: string } | null {
  const faltan = faltantes(usosDeMedios(pasos, lineaAutomatizacion, disparadores), estado);
  const freno = frenoDeMedios(faltan);
  if (!freno) return null;
  const f = faltan.find((x) => x.conectado === false && x.medio === freno.medio);
  return { medio: freno.medio, linea: f?.linea ?? null, error: freno.error };
}

/**
 * Los medios de Zernio (Instagram, Messenger) que el flujo usa y están CONECTADOS: los que necesitan que Zernio le
 * avise a MaKo (`asegurarAvisosSociales`, lib/disparadores-canales.ts). «No pude comprobarlo» no cuenta.
 */
export function socialesConectados(usa: readonly Medio[], estado: EstadoMedios | null | undefined): Medio[] {
  return usa.filter((m) => esCanalSocial(m) && estado?.[m]?.conectado === true);
}

/** El aviso corto cuando el webhook de Zernio no quedó: publicar salió igual. */
export function avisoSinWebhook(sociales: readonly Medio[]): string | null {
  const nombres = sociales.filter(esCanalSocial).map((m) => (m === 'instagram' ? 'Instagram' : 'Messenger'));
  return nombres.length ? `Los avisos de ${nombres.join(' y ')} no se activaron` : null;
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
 * Los medios cuyo «Conectar» SALTA SOLO al crear una tarjeta (duodécima tanda, decisión 10): WhatsApp (el QR),
 * Instagram y Messenger. El email no: su chip queda, y conectarlo es un dominio con DNS, no un clic.
 */
export const MEDIOS_QUE_SALTAN: ReadonlySet<Medio> = new Set<Medio>(['whatsapp', 'instagram', 'messenger']);

/**
 * EL QR SALTA AL CREAR (duodécima tanda, §2.12; Martín, 12/10/2026: «cuando creás un paso que requiera WhatsApp y
 * te diga que tu WhatsApp no está conectado, ahí que salte el QR. Que no haya ninguna fricción»).
 *
 * Salta SÓLO si la tarjeta recién creada frena Publicar: `chipDeTarjeta(...).frena`, la MISMA regla del chip
 * «Sin conectar» y de `frenoDeMedios`. Así nunca salta con «no pude comprobarlo» (`conectado: null`) ni sin la
 * lectura (`estado` null). `ofrecidos` = los medios que ya saltaron en esta visita: salta UNA vez por medio.
 * Devuelve lo que abre el modal del chip (`ConectarMedio`): el medio y, en WhatsApp, la línea de ese paso.
 */
export function medioAConectarAlCrear(
  paso: PasoGrafo, estado: EstadoMedios | null | undefined, lineaAutomatizacion: string | null | undefined, ofrecidos: ReadonlySet<Medio>,
): UsoMedio | null {
  const chip = chipDeTarjeta(paso, estado, lineaAutomatizacion);
  if (chip?.frena !== true || !MEDIOS_QUE_SALTAN.has(chip.medio) || ofrecidos.has(chip.medio)) return null;
  return { medio: chip.medio, linea: chip.medio === 'whatsapp' ? lineaDePaso(paso, lineaAutomatizacion) : null };
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
