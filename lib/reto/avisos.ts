// =============================================================================
// LOS AVISOS DEL RETO: qué sale cada hora y por dónde (20/11/2026)
// =============================================================================
// La auditoría del 20/11 (wa-01, wa-06, d24-02/03/04, R57-04/05/11, D1-04): lo único que salía era un correo a las 10:00 de
// Argentina, a la misma hora para todos, y el chat prometía «mañana a las {hora} te escribo». La especificación es la maqueta
// (C:/dev/artefactos-onboarding/cuerpo.html, `nuevoDia` y `waMomentoHtml`):
//
//   · CADA MAÑANA, cuando el día se abre POR CALENDARIO a la hora que eligió (o a las 9:00): el WhatsApp de MaKo («¡Buen día,
//     {n}! Ya está tu día {k} del reto: … Te espera en MaKo.»), SÓLO si ya eligió la hora por WhatsApp (le escribió primero el
//     día 2: la maqueta lo manda sólo con `d.horaWa`); el aviso en la app («Día {k} de tu reto») y el correo «Día {k} del reto
//     de MaKo» («Tu video de hoy ya está en MaKo.»). Un día ADELANTADO no se avisa: lo abrió ella.
//   · A LAS 20:00, si al día le falta algo y mañana se abre otro: «Te falta: …» en la app y en el teléfono. Nunca por WhatsApp.
//   · A LOS 2 DÍAS SIN ENTRAR: el WhatsApp de Martín («Vi que tu reto quedó en el día N. ¿Te trabaste en algo?», con «respóndeme
//     BAJA»). Uno por semana como mucho; con BAJA, nunca más.
//
// Puro, sin base: lo corre lib/reto/avisos-salida.ts desde el cron de cada hora (app/api/cron/reto-avisos). Lo que ya salió va en
// OTRA clave (`reto.avisos`), no en `reto.estado`: el cron escribía el estado entero que había leído, y una tarea marcada en el medio
// se perdía.
// =============================================================================
import { DIAS_RETO, claveTarea, desfaseHoras, diaAbierto, proximaTarea, type EstadoReto } from './dias';

/** Lo que ya salió, por negocio (`app_settings` → `reto.avisos`). */
export type AvisosReto = {
  v: 1;
  /** El último día que se avisó (o que se dio por avisado: adelantado, o abierto hace rato). */
  dia: number;
  /** El día de calendario (de Argentina) del último aviso de las 20:00. */
  noche?: number;
  /** Cuándo salió el último WhatsApp de Martín por abandono. */
  abandono?: string;
  /** Cuándo contestó BAJA: desde ahí, ningún WhatsApp del reto. */
  baja?: string;
  /** Cuándo se reclamó su audio del día 7 para pasárselo a Martín (uno solo: con dos líneas de la misma cuenta llega dos veces). */
  cierre?: string;
  /** El día (de su zona) en que salió «MaKo atendió a N clientes por ti»: una sola vez, como la maqueta (`vioRespuestas`). */
  atendio?: number;
};

export const CLAVE_AVISOS = 'reto.avisos';

/** Un día que se abrió hace más que esto no se avisa: llegaría tarde (el cron no corrió). Se da por avisado. */
export const VENTANA_AVISO_MS = 3 * 3_600_000;
/** El aviso de lo que falta: a las 20:00, con una vuelta de margen. */
export const HORA_NOCHE = 20;
/** El WhatsApp de Martín: a los 2 días sin entrar, al mediodía, uno por semana como mucho. */
export const DIAS_SIN_ENTRAR = 2;
export const ABANDONO_CADA_DIAS = 7;
export const HORA_ABANDONO = 12;
/** Pasado esto desde el inicio, el reto ya no escribe más. */
export const RETO_DURA_DIAS = 21;

export const PREHEADER_DIA = 'Tu video de hoy ya está en MaKo.';
export const RUTA_RETO = '/second-brain?reto=1';

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;
/** El día de calendario (días desde 1970) y la hora (con minutos, en horas) de un instante en la zona de la persona
 *  (`reto.estado.zona`, 20/11); sin zona, la de Argentina. Con el mismo desfase que usa `diaAbierto` (lib/reto/dias.ts), así la
 *  noche y el abandono caen a SU hora, como el día que se abre. */
export const diaEnSuZona = (ms: number, zona?: string): number => Math.floor((ms + desfaseHoras(ms, zona) * HORA_MS) / DIA_MS);
export const horaEnSuZona = (ms: number, zona?: string): number =>
  ((((ms + desfaseHoras(ms, zona) * HORA_MS) % DIA_MS) + DIA_MS) % DIA_MS) / HORA_MS;

/** Lo guardado, validado. Sin nada guardado, arranca desde el `avisado` del correo de antes (lib/reto/dias.ts). */
export function leerAvisos(crudo: unknown, e: EstadoReto | null): AvisosReto {
  let x: unknown = crudo;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = null; } }
  const o = (x && typeof x === 'object' ? x : {}) as Partial<AvisosReto>;
  const dia = Number.isInteger(o.dia) ? Math.max(1, Math.min(7, Number(o.dia))) : Math.max(1, Math.min(7, e?.avisado ?? 1));
  const fecha = (s: unknown) => (typeof s === 'string' && !Number.isNaN(Date.parse(s)) ? s : undefined);
  const abandono = fecha(o.abandono), baja = fecha(o.baja), cierre = fecha(o.cierre);
  return { v: 1, dia, ...(Number.isInteger(o.noche) ? { noche: Number(o.noche) } : {}), ...(abandono ? { abandono } : {}), ...(baja ? { baja } : {}), ...(cierre ? { cierre } : {}), ...(Number.isInteger(o.atendio) ? { atendio: Number(o.atendio) } : {}) };
}

export type PlanDeAvisos = {
  /** El día que se abrió por calendario: el aviso en la app, el correo y, con `whatsapp`, el WhatsApp de MaKo. */
  manana?: { dia: number; whatsapp: boolean };
  /** Lo que falta, a las 20:00. */
  noche?: { dia: number; tarea: string };
  /** El WhatsApp de Martín: el día en que quedó. */
  abandono?: { dia: number };
  /** Con la noche: «MaKo atendió a N clientes por ti» (`conAtendidos`). */
  atendidos?: number;
  /** Lo que se guarda (antes de mandar: así dos vueltas a la vez no mandan dos veces). */
  avisos: AvisosReto;
};

/**
 * Qué sale en ESTA vuelta. `porWhatsApp`: el negocio puede recibir el WhatsApp del reto (verificó su número por el V2 y está
 * habilitado). `ultimaVisita`: la última vez que alguien del negocio entró a MaKo (null si no se sabe: entonces no hay abandono).
 */
export function queMandar(p: { e: EstadoReto; a: AvisosReto; ahora: number; ultimaVisita: number | null; porWhatsApp: boolean }): PlanDeAvisos {
  const { e, a, ahora } = p;
  const avisos: AvisosReto = { ...a };
  const plan: PlanDeAvisos = { avisos };
  const abierto = diaAbierto(e, ahora);
  const sinBaja = !a.baja;

  if (abierto > a.dia) {
    avisos.dia = abierto;
    // Adelantado: lo abrió ella. Abierto hace rato: el aviso llegaría tarde (y el de antes ya se perdió). Ninguno de los dos se avisa.
    const adelantado = abierto <= e.adelantado;
    const recien = diaAbierto(e, ahora - VENTANA_AVISO_MS) < abierto;
    if (!adelantado && recien) plan.manana = { dia: abierto, whatsapp: p.porWhatsApp && sinBaja && !!e.horaWa };
  }

  // Las 20:00 y el mediodía son los de SU zona (los de Argentina sin zona): a quien está en México no le llega a las 17:00.
  const hora = horaEnSuZona(ahora, e.zona), hoy = diaEnSuZona(ahora, e.zona);
  const pasados = hoy - diaEnSuZona(Date.parse(e.inicio), e.zona);
  const falta = proximaTarea(e, ahora);

  // A las 20:00, si falta algo y mañana se abre otro día (la maqueta: el aviso de la noche va en `nuevoDia`, del 2 al 7). No sobre un
  // día que se acaba de abrir (con la hora de las 20:00, el día nuevo sale a las 20:00 y a las 21:00 ya le «faltaría» todo).
  const quieto = diaAbierto(e, ahora - VENTANA_AVISO_MS) === abierto;
  if (falta && abierto < 7 && quieto && hora >= HORA_NOCHE && hora < HORA_NOCHE + 2 && a.noche !== hoy && !plan.manana) {
    plan.noche = { dia: falta.dia.n, tarea: falta.tarea.titulo };
    avisos.noche = hoy;
  }

  // A los 2 días sin entrar, al mediodía: el WhatsApp de Martín. Nunca con el de la mañana en la misma vuelta.
  const sinEntrar = p.ultimaVisita != null && ahora - p.ultimaVisita >= DIAS_SIN_ENTRAR * DIA_MS;
  const yaEscribio = a.abandono ? ahora - Date.parse(a.abandono) < ABANDONO_CADA_DIAS * DIA_MS : false;
  if (falta && p.porWhatsApp && sinBaja && sinEntrar && !yaEscribio && pasados >= DIAS_SIN_ENTRAR && pasados <= RETO_DURA_DIAS
    && hora >= HORA_ABANDONO && hora < HORA_ABANDONO + 2 && !plan.manana?.whatsapp) {
    plan.abandono = { dia: falta.dia.n };
    avisos.abandono = new Date(ahora).toISOString();
  }
  return plan;
}

// ── La noche, con lo que de verdad pasó (20/11/2026, d24-04) ─────────────────────────────────────────────────────────
// Lo hecho de `reto.estado` se pone al día recién cuando abre el chat del reto (app/api/reto, `leerTareasHechas`): sin releer, la
// noche (y Martín) le decían «Te falta…» de algo que ya había hecho. La vuelta relee con las señales (lib/reto/senales.ts) antes de
// decirlo, y lo leído entra como hecho sólo para decidir: `reto.estado` lo escribe el chat del reto, no el cron.
// Y la maqueta (`nuevoDia`): con la automatización ya hecha, la noche suma UNA vez «MaKo atendió a N clientes por ti», con el número
// real de hoy (los chats que atendió solo; lib/reto/avisos-salida.ts los cuenta). Con 0, nada: otra noche.

/** Lo leído por las señales del reto, como hecho (con la hora de ahora). Lo ya guardado no se toca. Sin nada nuevo, el mismo estado. */
export function conLoLeido(e: EstadoReto, leidas: Record<string, string>, ahora: number): EstadoReto {
  const nuevas = Object.keys(leidas).filter((k) => !e.hechas[k]);
  if (!nuevas.length) return e;
  const en = new Date(ahora).toISOString();
  return { ...e, hechas: { ...e.hechas, ...Object.fromEntries(nuevas.map((k) => [k, en])) } };
}

/** Las 0:00 de hoy en SU zona (ms): desde ahí se cuentan los clientes que atendió MaKo. */
export const inicioDelDia = (ms: number, zona?: string): number => ms - Math.round(horaEnSuZona(ms, zona) * HORA_MS);

/** ¿Hace falta contar los atendidos? Con la noche, la automatización hecha y nunca dicho antes. */
export const quiereAtendidos = (e: EstadoReto, a: AvisosReto, plan: PlanDeAvisos): boolean =>
  !!plan.noche && !!e.hechas[claveTarea(3, 'automatizacion')] && a.atendio == null;

/** El plan con los atendidos de hoy, si atendió a alguien (null: no se pudo contar; 0: nadie todavía). Se guarda el día: una vez. */
export function conAtendidos(plan: PlanDeAvisos, n: number | null): PlanDeAvisos {
  if (!plan.noche || plan.avisos.noche == null || n == null || n < 1) return plan;
  return { ...plan, atendidos: n, avisos: { ...plan.avisos, atendio: plan.avisos.noche } };
}

/** El aviso de los atendidos (la maqueta). */
export function avisoDeAtendidos(n: number): { titulo: string; texto: string } {
  return { titulo: `MaKo atendió a ${n} ${n === 1 ? 'cliente' : 'clientes'} por ti`, texto: 'Míralo en Chats, en «Atiende MaKo».' };
}

/** ¿Cambió algo para guardar? */
export const hayQueGuardar = (antes: AvisosReto, despues: AvisosReto): boolean => JSON.stringify(antes) !== JSON.stringify(despues);

// ── Los textos (los de la maqueta) ─────────────────────────────────────────────────────────────────────────────────────

const primeraMinuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const nombreCorto = (nombre: string | null | undefined) => (nombre ?? '').trim().split(/\s+/)[0] ?? '';
/** El saludo según la hora en que sale: «¡Buen día» a las 18:00 no va. */
export const saludoDeLaHora = (hora: number): string => (hora < 12 ? '¡Buen día' : hora < 20 ? '¡Buenas tardes' : '¡Buenas noches');

/** El WhatsApp de cada mañana: que el día está listo, sin pedirle nada (y sin link: así es en la maqueta). */
export function whatsappDelDia(nombre: string | null | undefined, dia: number, horaDeSalida: number): string {
  const d = DIAS_RETO.find((x) => x.n === dia) ?? DIAS_RETO[0];
  const n = nombreCorto(nombre);
  return `${saludoDeLaHora(horaDeSalida)}${n ? `, ${n}` : ''}! Ya está tu día ${d.n} del reto: ${primeraMinuscula(d.titulo)}. Te espera en MaKo.`;
}

/** El aviso de MaKo en la app y en el teléfono, el de cada mañana. */
export function avisoDelDia(dia: number): { titulo: string; texto: string } {
  const d = DIAS_RETO.find((x) => x.n === dia) ?? DIAS_RETO[0];
  return { titulo: `Día ${d.n} de tu reto`, texto: `${d.titulo}.` };
}

/** El de las 20:00: lo que falta. La maqueta pone «Son N minutos.» cuando lo sabe; acá no se sabe. */
export function avisoDeLaNoche(tarea: string): { titulo: string; texto: string } {
  return { titulo: `Te falta: ${primeraMinuscula(tarea)}`, texto: 'Mañana te lo dejo primero.' };
}

export const SALIDA_BAJA = 'Si prefieres que no te escriba, respóndeme BAJA.';

/** El WhatsApp de Martín a quien dejó el reto (la maqueta, `abandono`). */
export function whatsappDeAbandono(nombre: string | null | undefined, dia: number): string {
  const n = nombreCorto(nombre);
  return `Hola${n ? `, ${n}` : ''}. Soy Martín, el creador de MaKo. Vi que tu reto quedó en el día ${dia}. ¿Te trabaste en algo?\n\n${SALIDA_BAJA}`;
}

/** ¿Contestó BAJA? Sólo la palabra (con o sin punto): «no me des de baja el plan» no es esto. */
export const esBaja = (texto: string): boolean => /^\s*baja[\s.!]*$/i.test(texto);

export const RESPUESTA_BAJA = 'Listo: no te escribo más sobre el reto. Tu reto sigue en MaKo para cuando quieras.';

// ── El día 7: su audio, a Martín (20/11/2026, d24-16 y R57-10) ─────────────────────────────────────────────────────────
// La prueba del día 7 (lib/reto/dias.ts): «Cuéntale a MaKo cómo te fue con el reto: mándale un audio por WhatsApp. Lo escucha
// Martín.» Y la maqueta (`d7`): MaKo contesta «¡Gracias! Ya se lo pasé a Martín.». No necesita al bot: lo contesta el código
// (lib/reto/respuestas.ts), como la hora y BAJA.

/** Lo que MaKo le contesta cuando su audio ya le llegó a Martín. */
export const GRACIAS_DIA_7 = '¡Gracias! Ya se lo pasé a Martín.';
/** Lo que dice la tarjeta del día 7 en el chat del reto («✓ Hecho: …», `pruebaRespondida`, lib/reto/pruebas.ts). */
export const LEIDO_DIA_7 = 'Le pasé tu audio a Martín.';

/** ¿Es el audio del día 7? Un audio, con el día 7 abierto, la prueba sin responder y ninguno reclamado antes. */
export function esElAudioDelCierre(p: { e: EstadoReto; a: AvisosReto; ahora: number; esAudio: boolean }): boolean {
  return p.esAudio && diaAbierto(p.e, p.ahora) >= 7 && !p.e.pruebas?.['7'] && !p.a.cierre;
}

/** Lo que le llega a Martín, al grupo de SuperAdmin, con el audio adjunto. Sin el audio (no se pudo bajar), dónde escucharlo. */
export function audioParaMartin(nombre: string | null | undefined, ws: number, conAudio: boolean): string {
  const n = (nombre ?? '').trim() || 'Alguien';
  return `Día 7 del reto: ${n} (ws ${ws}) te cuenta cómo le fue.${conAudio ? '' : ' No pude bajar su audio: escúchalo en su chat con MaKo.'}`;
}

/**
 * LA HORA DEL DÍA 2, DE SU MENSAJE (D1-12): «Hola MaKo, prefiero que me escribas a las {hora} sobre el reto.» Vale también si lo
 * escribe a su manera («escríbeme a las 18», «a las 8:00 hs»), con una de las horas del reto. null: no es este mensaje.
 */
export function horaDelMensaje(texto: string, horas: readonly string[]): string | null {
  const m = /escr[ií]b\p{L}*\s+(?:\p{L}+\s+)?a\s+las\s+(\d{1,2})(?:[:.](\d{2}))?/iu.exec(texto);
  if (!m) return null;
  const hora = `${Number(m[1])}:${m[2] ?? '00'}`;
  return horas.includes(hora) ? hora : null;
}

/** Lo que contesta MaKo (la maqueta, `waMomentoHtml` d2). */
export function respuestaDeLaHora(nombre: string | null | undefined, hora: string): string {
  const n = nombreCorto(nombre);
  return `¡Hecho${n ? `, ${n}` : ''}! Cada día te escribo a las ${hora} con tu día del reto. Guárdame en tus contactos para que no se pierda nada.`;
}
