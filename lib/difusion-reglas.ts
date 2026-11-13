// =============================================================================
// difusion-reglas — mandar UN mensaje a muchos leads elegidos en el CRM (28/10/2026, pedido de Martín por Leila)
// =============================================================================
// Martín: «seleccionando a toda una columna o una cantidad de leads específicos en el CRM y apretar mandar mensaje de difusión
// … por alguno de los canales WhatsApp, email, Instagram o varios … y configurar ahí mismo el goteo o la cantidad de mensajes
// diarios por una cuestión de baneo». La regla del Cerebro: UNA DIFUSIÓN ES UNA AUTOMATIZACIÓN de una sola vez (la regla
// «Mensaje = automatización»): una fila, el mismo motor, las mismas tarjetas, y después se ve en Automations con sus métricas.
//
// ⚠️ UN HILO POR CANAL, CADA UNO CON SU CONDICIÓN (el mapa del motor, 28/10/2026): en un flujo LINEAL, una tarjeta que no puede
// llegar (sin teléfono, sin email o dado de baja, sin conversación de Instagram) es un fallo terminal y cierra la inscripción
// entera: el email de después no salía nunca. Con la tarjeta de inicio y un hilo en paralelo por canal (el patrón de «Un
// Lead Agendó Llamada»), cada hilo mira primero si el lead tiene ESE canal; si no, ese hilo termina y los otros siguen.
//
// ⚠️ WHATSAPP SÓLO POR QR (no oficial): el oficial no tiene quién lo mande hoy (`SIN_CANAL_OFICIAL`, lib/nutricion.ts), y
// mandar en masa por QR es el riesgo de baneo: por eso el goteo y el tope del día van en la misma hoja.
//
// Puro y sin `server-only`: lo usan la hoja (app/automations/difusion/HojaDifusion.tsx), el server (lib/difusion.ts), la API
// de MaKo (`difundir_a_leads`) y el test.
// =============================================================================

import { decidirSalida, salidaHastaMs, type ConversacionSocial } from './canal-social';
import { telefonoSinArreglo } from './lead-sin-arreglo';
import { ID_INICIO, type PasoGrafo, type FilaCondicion } from './flujo-grafo';
import { RANGOS_GOTEO } from './config-automatizacion';
import { arranqueLlega, diaDelTurno, type ArranqueGoteo } from './goteo';

export const CANALES_DIFUSION = ['whatsapp', 'email', 'instagram'] as const;
export type CanalDifusion = (typeof CANALES_DIFUSION)[number];
export const esCanalDifusion = (v: unknown): v is CanalDifusion => (CANALES_DIFUSION as readonly unknown[]).includes(v);

export const NOMBRE_CANAL_DIFUSION: Readonly<Record<CanalDifusion, string>> = { whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram' };

/** Hasta cuántos leads por difusión (una columna grande del CRM entra; más es otra herramienta). */
export const TOPE_DIFUSION = 2000;

/** El goteo con el que arranca la hoja: de a uno cada 3 minutos y hasta 40 por día en cada canal (el tope de una línea). */
export const GOTEO_DIFUSION_INICIAL = { minutos: 3, dia: 40 } as const;

/**
 * El arranque con el que abre la hoja por WhatsApp: 20 el primer día y sube de a 20, hasta el tope (Leila, 30/10/2026: el bloqueo de 24 h del número de Mauricio fue al
 * pasar de unos 20 a 60 por día). El goteo de una difusión: minutos, tope y, si lo tiene, su arranque, que vale sólo para WhatsApp (lib/goteo.ts).
 */
export const ARRANQUE_DIFUSION_INICIAL: ArranqueGoteo = { dia: 20, sube: 20 };
export type GoteoDifusion = { minutos: number; dia: number; arranque?: ArranqueGoteo };

/** Con arranque, si tiene de dónde subir: uno que ya empieza en el tope no arranca de a poco. */
export function goteoConArranque(g: { minutos: number; dia: number }, a: ArranqueGoteo | null | undefined): GoteoDifusion {
  return a && a.dia < g.dia ? { minutos: g.minutos, dia: g.dia, arranque: { dia: a.dia, sube: a.sube } } : { minutos: g.minutos, dia: g.dia };
}

/** Lo que se lee de cada lead para saber por dónde le llega. */
export type LeadDifusion = {
  id: number;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  emailBaja: boolean;
  /** Su conversación de Instagram (la que cuenta), o null si nunca escribió ni comentó. */
  instagram: ConversacionSocial | null;
};

/** Por qué un lead queda afuera de un canal, en palabras de persona. */
export type MotivoAfuera = 'sin_telefono' | 'telefono_invalido' | 'sin_email' | 'email_baja' | 'sin_instagram' | 'instagram_ventana' | 'instagram_turno';
export const TEXTO_AFUERA: Readonly<Record<MotivoAfuera, string>> = {
  sin_telefono: 'no tienen teléfono',
  telefono_invalido: 'el teléfono no es válido',
  sin_email: 'no tienen email',
  email_baja: 'se dieron de baja del email',
  sin_instagram: 'nunca escribieron ni comentaron por Instagram',
  instagram_ventana: 'pasaron más de 24 h desde su último mensaje (Instagram no deja escribirles)',
  instagram_turno: 'con este goteo no les toca antes de que se cierre su ventana de Instagram (sube el tope por día)',
};

/** ¿Por dónde le llega a ESTE lead? null = le llega; si no, el motivo. */
export function motivoAfuera(l: LeadDifusion, canal: CanalDifusion, ahoraMs: number): MotivoAfuera | null {
  if (canal === 'whatsapp') {
    const t = telefonoSinArreglo(l.telefono);
    return t === 'lead sin teléfono' ? 'sin_telefono' : t === 'teléfono inválido' ? 'telefono_invalido' : null;
  }
  if (canal === 'email') {
    if (!(l.email ?? '').includes('@')) return 'sin_email';
    return l.emailBaja ? 'email_baja' : null;
  }
  if (!l.instagram) return 'sin_instagram';
  // La MISMA decisión que el envío (`decidirSalida`): la ventana de 24 h o la respuesta privada a un comentario reciente.
  return decidirSalida(l.instagram, ahoraMs, 'instagram').via === null ? 'instagram_ventana' : null;
}

export type AlcanceCanal = { canal: CanalDifusion; llegan: number; afuera: Array<{ motivo: MotivoAfuera; cuantos: number }> };
export type Alcance = {
  total: number;
  /** A cuántos les llega por AL MENOS uno de los canales elegidos (los que se inscriben). */
  llegan: number;
  /** Los ids que se inscriben (con al menos un canal). */
  ids: number[];
  /** A cuántos no les llega por ninguno de los elegidos. */
  ninguno: number;
  porCanal: AlcanceCanal[];
};

/**
 * Por dónde le llega a cada lead, SIN sus datos de contacto: es lo que viaja a la hoja (recalcula al tildar un canal sin
 * volver al server, y el teléfono y el email no salen del server).
 */
export type MotivosDelLead = {
  id: number;
  motivos: Record<CanalDifusion, MotivoAfuera | null>;
  /** Hasta cuándo le puede llegar por Instagram (`salidaHastaMs`): el goteo que no le llega antes, no se le promete. */
  instagramHastaMs?: number | null;
};

export function motivosDe(l: LeadDifusion, ahoraMs: number): MotivosDelLead {
  return {
    id: l.id,
    motivos: { whatsapp: motivoAfuera(l, 'whatsapp', ahoraMs), email: motivoAfuera(l, 'email', ahoraMs), instagram: motivoAfuera(l, 'instagram', ahoraMs) },
    instagramHastaMs: salidaHastaMs(l.instagram),
  };
}

/**
 * CUÁNDO SALE EL k-ÉSIMO (desde 0) de un canal con este goteo, desde que arranca: de a uno cada `minutos` y, cumplido el tope
 * del día, cuando el más viejo sale de las 24 h móviles (`frenoDeGoteo`, lib/goteo.ts).
 */
export function demoraDelTurno(k: number, g: GoteoDifusion): number {
  const t = diaDelTurno(k, { dia: Math.max(1, Math.floor(g.dia)), arranque: g.arranque });
  return t.dia * 86_400_000 + t.enElDia * g.minutos * 60_000;
}

/** El goteo con el que va a salir y desde cuándo: con él, Instagram promete sólo a los que alcanza antes de su ventana. */
export type RitmoDifusion = { goteo: GoteoDifusion; ahoraMs: number };

/** A QUIÉN LE LLEGA, POR CANAL, Y QUIÉN QUEDA AFUERA Y POR QUÉ. Con `canales` vacío, nadie. */
export function alcanceDe(leads: readonly LeadDifusion[], canales: readonly CanalDifusion[], ahoraMs: number, goteo?: RitmoDifusion['goteo']): Alcance {
  return alcanceDeMotivos(leads.map((l) => motivosDe(l, ahoraMs)), canales, goteo ? { goteo, ahoraMs } : undefined);
}

/**
 * Lo mismo, desde lo que ya se decidió por lead (`motivosDe`): lo usa la hoja al cambiar de canales y de goteo.
 *
 * ⚠️ INSTAGRAM CON GOTEO (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): la hoja prometía «le llega a 100» con
 * 40 por día, y a los 60 de después se les cerraba la ventana de 24 h antes de su turno: el envío los daba por fallo. Con el
 * `ritmo`, a cada uno de Instagram se le cuenta su turno (`demoraDelTurno`, en el orden en que se inscriben: el del motor)
 * y el que no llega antes de su ventana queda afuera (`instagram_turno`); si Instagram era su único canal, no se inscribe.
 */
export function alcanceDeMotivos(leads: readonly MotivosDelLead[], canales: readonly CanalDifusion[], ritmo?: RitmoDifusion): Alcance {
  const elegidos = CANALES_DIFUSION.filter((c) => canales.includes(c));
  const porCanal: AlcanceCanal[] = elegidos.map((canal) => ({ canal, llegan: 0, afuera: [] }));
  const ids: number[] = [];
  let turnoIg = 0;
  for (const l of leads) {
    let alguno = false;
    for (const pc of porCanal) {
      let m = l.motivos[pc.canal];
      if (pc.canal === 'instagram' && m == null && ritmo) {
        const hasta = l.instagramHastaMs;
        // Sin el arranque: es sólo de WhatsApp, y acá dejaba gente afuera de su ventana.
        if (hasta != null && ritmo.ahoraMs + demoraDelTurno(turnoIg, { minutos: ritmo.goteo.minutos, dia: ritmo.goteo.dia }) >= hasta) m = 'instagram_turno';
        else turnoIg += 1;
      }
      if (m == null) { pc.llegan += 1; alguno = true; continue; }
      const fila = pc.afuera.find((a) => a.motivo === m);
      if (fila) fila.cuantos += 1; else pc.afuera.push({ motivo: m, cuantos: 1 });
    }
    if (alguno) ids.push(l.id);
  }
  return { total: leads.length, llegan: ids.length, ids, ninguno: leads.length - ids.length, porCanal };
}

/** Lo que se escribe en cada tarjeta de la hoja. */
export type MensajesDifusion = {
  /** `partes`: varios mensajes seguidos, como los arma la tarjeta (el `cuerpo` es el espejo de la primera). */
  whatsapp?: { cuerpo: string; partes?: unknown[]; variantes?: string[] };
  email?: { asunto: string; cuerpo: string; cuerpo_html?: string | null };
  instagram?: { cuerpo: string; partes?: unknown[] };
};

/** Las partes de una tarjeta, si las trae (el guardado las revisa: `setSecuenciaPasos`). */
const conPartes = (x: { partes?: unknown[] } | undefined): { partes?: unknown[] } => (Array.isArray(x?.partes) && x.partes.length ? { partes: x.partes } : {});

/**
 * Las otras formas de decir el mensaje de WhatsApp: el motor sortea entre el cuerpo y ellas (`textoDelPaso`, lib/nutricion-canal.ts). Son de UN texto: con varias
 * partes no van (`variantesTrasCambio`, lib/mensaje-partes.ts). Las vacías no entran al sorteo.
 */
const conVariantes = (x: { partes?: unknown[]; variantes?: string[] } | undefined): { variantes?: string[] } => {
  if (Array.isArray(x?.partes) && x.partes.length > 1) return {};
  const vs = (x?.variantes ?? []).filter((v) => typeof v === 'string' && v.trim());
  return vs.length ? { variantes: vs } : {};
};

/** Lo que le falta a la difusión para mandarse, en palabras cortas. null = está. */
export function problemaDeDifusion(o: { canales: readonly CanalDifusion[]; mensajes: MensajesDifusion; alcance: Pick<Alcance, 'llegan'> }): string | null {
  if (!o.canales.length) return 'Elige al menos un canal';
  for (const c of o.canales) {
    if (c === 'email') {
      if (!o.mensajes.email?.asunto?.trim()) return 'Falta el asunto del email';
      if (!o.mensajes.email?.cuerpo?.trim()) return 'Falta el texto del email';
    } else if (!o.mensajes[c]?.cuerpo?.trim()) return `Falta el mensaje de ${NOMBRE_CANAL_DIFUSION[c]}`;
  }
  if (o.alcance.llegan === 0) return 'A ninguno le llega por los canales elegidos';
  return null;
}

/** Las filas de la condición de cada hilo: que tenga ESE canal (y, el email, que no se haya dado de baja). */
const CONDICION_DEL_CANAL: Readonly<Record<CanalDifusion, readonly FilaCondicion[]>> = {
  whatsapp: [{ campo: 'tiene_telefono' }],
  email: [{ campo: 'tiene_email' }, { campo: 'email_baja', no: true, union: 'y' }],
  instagram: [{ campo: 'tiene_instagram' }],
};

const RELLENO = { orden: 0, delay_horas: 0, asunto: null, template_wa: null } as const;

/**
 * EL FLUJO DE LA DIFUSIÓN: la tarjeta de inicio con UN HILO POR CANAL (el primero en `siguiente`, el resto en `paralelos`),
 * y cada hilo una CONDITION «tiene ese canal» → el mensaje. Los mensajes salen solos (`revisar: false`): es una difusión, la
 * persona ya los escribió y los confirmó. El WhatsApp por QR (`proveedor: 'no_oficial'`). Con `siContesta`, el seguimiento de
 * los que contestan (`conSiContesta`, abajo).
 */
export function pasosDeDifusion(canales: readonly CanalDifusion[], m: MensajesDifusion, siContesta?: SiContestaDifusion | null): PasoGrafo[] {
  const pasos = pasosSinSeguimiento(canales, m);
  return siContesta ? conSiContesta(pasos, siContesta) : pasos;
}

function pasosSinSeguimiento(canales: readonly CanalDifusion[], m: MensajesDifusion): PasoGrafo[] {
  const elegidos = CANALES_DIFUSION.filter((c) => canales.includes(c));
  const pasos: PasoGrafo[] = [];
  for (const c of elegidos) {
    const cond = `d_c_${c}`;
    const msg = `d_${c}`;
    pasos.push({
      ...RELLENO, id: cond, canal: 'whatsapp', cuerpo: '', nodo: 'condicion', si_no: null,
      ramas: [{ id: `${cond}_si`, modo: 'todas', filas: CONDICION_DEL_CANAL[c].map((f) => ({ ...f })), siguiente: msg }],
    } as unknown as PasoGrafo);
    if (c === 'whatsapp') pasos.push({ ...RELLENO, id: msg, canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: m.whatsapp?.cuerpo ?? '', ...conPartes(m.whatsapp), ...conVariantes(m.whatsapp), siguiente: null, revisar: false } as unknown as PasoGrafo);
    else if (c === 'email') {
      pasos.push({
        ...RELLENO, id: msg, canal: 'email', asunto: m.email?.asunto ?? '', cuerpo: m.email?.cuerpo ?? '',
        ...(m.email?.cuerpo_html ? { cuerpo_html: m.email.cuerpo_html } : {}), siguiente: null, revisar: false,
      } as unknown as PasoGrafo);
    } else pasos.push({ ...RELLENO, id: msg, canal: 'instagram', cuerpo: m.instagram?.cuerpo ?? '', ...conPartes(m.instagram), siguiente: null, revisar: false } as unknown as PasoGrafo);
  }
  const hilos = elegidos.map((c) => `d_c_${c}`);
  pasos.push({ ...RELLENO, id: ID_INICIO, canal: 'whatsapp', cuerpo: '', nodo: 'inicio', siguiente: hilos[0] ?? null, paralelos: hilos.slice(1) } as unknown as PasoGrafo);
  return pasos;
}

// ── SEGUIR CON LOS QUE CONTESTAN (13/11/2026, Leila, ws11) ─────────────────────────────────────────────────────────────────
// Leila mandó «Hola corazón, ¿cómo estás?» a 143 alumnas (la #732) y quería que a las que CONTESTARAN les saliera el pedido de
// testimonio. La difusión no tenía cómo decirlo, así que lo armó aparte (la #730: «Contestó» como primera tarjeta, con la etapa
// de la columna como CRON). Esa condición se decidió al entrar, cuando nadie había contestado: los 143 flujos se cerraron sin
// mandar nada y Leila contestó todo a mano. «Contestó» es de ESA automatización: no ve lo que contestaron a otra. Lo que
// funciona es ponerlo EN la difusión: el mensaje → «Escuchar N días» → «Contestó» → lo que sigue. El motor lo corre en el
// momento en que contestan (`alContestar`, lib/nutricion.ts: la regla «Contestó corta» del 23/10), sólo a ellas.
// ⚠️ SÓLO EN UNA DIFUSIÓN POR WHATSAPP (sola): con varios canales la inscripción tiene hilos en paralelo y `alContestar` no la
// mueve (la guarda de `procesarEnvios` le corta los mensajes igual): el seguimiento no saldría nunca.

/** Lo que les sale, en orden, a los que contestan; y cuántos días se los escucha después del mensaje. */
export type SiContestaDifusion = { mensajes: string[]; dias: number };
export const DIAS_ESCUCHA_DIFUSION = 7;
export const RANGO_DIAS_ESCUCHA: readonly [number, number] = [1, 30];
export const TOPE_MENSAJES_SI_CONTESTA = 5;
export const ID_ESCUCHA_DIFUSION = 'd_escucha';
export const ID_CONTESTO_DIFUSION = 'd_contesto';
const PREFIJO_SI_CONTESTA = 'd_sc_';
const esDelSeguimiento = (id: string) => id === ID_ESCUCHA_DIFUSION || id === ID_CONTESTO_DIFUSION || id.startsWith(PREFIJO_SI_CONTESTA);

/** Lo que pidió, saneado: los mensajes no vacíos y los días (sin días, `DIAS_ESCUCHA_DIFUSION`). null = no pidió nada. */
export function siContestaDe(mensajes: unknown, dias?: unknown): SiContestaDifusion | null {
  const ms = (Array.isArray(mensajes) ? mensajes : []).filter((m): m is string => typeof m === 'string' && !!m.trim()).map((m) => m.trim());
  if (!ms.length) return null;
  return { mensajes: ms, dias: dias == null || dias === '' ? DIAS_ESCUCHA_DIFUSION : Number(dias) };
}

/** Lo que le falta (o le sobra) al seguimiento, en palabras cortas. null = está. */
export function problemaDeSiContesta(canales: readonly CanalDifusion[], sc: SiContestaDifusion | null): string | null {
  if (!sc) return null;
  if (canales.length !== 1 || canales[0] !== 'whatsapp') return 'Seguir con los que contestan va en una difusión sólo por WhatsApp';
  if (sc.mensajes.length > TOPE_MENSAJES_SI_CONTESTA) return `A los que contestan les salen hasta ${TOPE_MENSAJES_SI_CONTESTA} mensajes`;
  const [min, max] = RANGO_DIAS_ESCUCHA;
  if (!Number.isInteger(sc.dias) || sc.dias < min || sc.dias > max) return `Las respuestas se escuchan de ${min} a ${max} días`;
  return null;
}

/**
 * El flujo de la difusión CON el seguimiento: el WhatsApp → «Escuchar N días» → «Contestó» → los mensajes, en orden. Si ya
 * tenía uno, lo reemplaza (pedirlo de nuevo cambia los textos, no apila otro). Los mensajes salen solos (`revisar: false`):
 * la persona los escribió y los confirmó, y le llegan sólo a quien contestó. Sin el WhatsApp de la difusión, no cambia nada.
 */
export function conSiContesta(pasos: readonly PasoGrafo[], sc: SiContestaDifusion): PasoGrafo[] {
  const base = pasos.filter((p) => !esDelSeguimiento(String(p.id ?? '')));
  const i = base.findIndex((p) => p.id === 'd_whatsapp');
  if (i < 0) return [...pasos];
  const ids = sc.mensajes.map((_, k) => `${PREFIJO_SI_CONTESTA}${k + 1}`);
  const out: PasoGrafo[] = base.map((p, k) => (k === i ? ({ ...p, siguiente: ID_ESCUCHA_DIFUSION } as PasoGrafo) : p));
  out.push(
    { ...RELLENO, id: ID_ESCUCHA_DIFUSION, canal: 'whatsapp', cuerpo: '', nodo: 'esperar', espera: { modo: 'tiempo', minutos: sc.dias * 24 * 60 }, siguiente: ID_CONTESTO_DIFUSION } as unknown as PasoGrafo,
    {
      ...RELLENO, id: ID_CONTESTO_DIFUSION, canal: 'whatsapp', cuerpo: '', nodo: 'condicion', si_no: null,
      ramas: [{ id: `${ID_CONTESTO_DIFUSION}_si`, modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: ids[0] }],
    } as unknown as PasoGrafo,
    ...sc.mensajes.map((cuerpo, k) => ({ ...RELLENO, id: ids[k], canal: 'whatsapp', proveedor: 'no_oficial', cuerpo, siguiente: ids[k + 1] ?? null, revisar: false } as unknown as PasoGrafo)),
  );
  return out;
}

/** El seguimiento que ya tiene una difusión (para decir qué cambia), o null. */
export function siContestaDeLosPasos(pasos: readonly PasoGrafo[]): SiContestaDifusion | null {
  const espera = pasos.find((p) => p.id === ID_ESCUCHA_DIFUSION) as { espera?: { minutos?: number } } | undefined;
  const n = (p: PasoGrafo) => Number(String(p.id).slice(PREFIJO_SI_CONTESTA.length));
  const ms = pasos.filter((p) => String(p.id ?? '').startsWith(PREFIJO_SI_CONTESTA)).sort((a, b) => n(a) - n(b)).map((p) => String(p.cuerpo ?? ''));
  if (!espera || !ms.length) return null;
  return { mensajes: ms, dias: Math.round(Number(espera.espera?.minutos ?? 0) / 1440) };
}

/** El nombre de la automatización: «Difusión · Contacto nuevo · 28/10» o «Difusión · 12 leads · 28/10». */
export function nombreDeDifusion(o: { etapa?: string | null; leads: number; fecha: string }): string {
  const de = o.etapa?.trim() ? o.etapa.trim() : `${o.leads} ${o.leads === 1 ? 'lead' : 'leads'}`;
  return `Difusión · ${de} · ${o.fecha}`.slice(0, 80);
}

/** Cuánto tarda en salir todo con el goteo, en palabras: «sale todo hoy» / «unos 3 días». Por el canal más cargado. */
export function textoDeDuracion(llegan: number, goteo: GoteoDifusion): string {
  if (llegan <= 0) return '';
  const dias = diaDelTurno(llegan - 1, { dia: Math.max(1, Math.floor(goteo.dia)), arranque: goteo.arranque }).dia + 1;
  if (dias <= 1) {
    const min = (llegan - 1) * goteo.minutos;
    return min < 60 ? `sale todo en ${Math.max(1, min)} min` : `sale todo en unas ${Math.ceil(min / 60)} h`;
  }
  return `tarda unos ${dias} días (${goteo.arranque ? `arranca con ${goteo.arranque.dia} por día, hasta ${goteo.dia}` : `hasta ${goteo.dia} por día`})`;
}

/** Cuánto tarda, por el canal que más tarda: el arranque cuenta sólo en WhatsApp, así que no siempre es el que tiene más gente. */
export function textoDeDuracionPorCanal(porCanal: ReadonlyArray<{ canal: CanalDifusion; llegan: number }>, goteo: GoteoDifusion): string {
  const sin = { minutos: goteo.minutos, dia: goteo.dia };
  const con = porCanal.filter((c) => c.llegan > 0).map((c) => ({ llegan: c.llegan, g: c.canal === 'whatsapp' ? goteo : sin }));
  const peor = con.sort((a, b) => demoraDelTurno(b.llegan - 1, b.g) - demoraDelTurno(a.llegan - 1, a.g))[0];
  return peor ? textoDeDuracion(peor.llegan, peor.g) : '';
}

/**
 * LA MISMA DIFUSIÓN DOS VECES (la verificación del Cerebro sobre 69b49a31c, 29/10/2026). El server no tenía idempotencia: un
 * reintento (la hoja dice «Vuelve a intentarlo» también cuando lo que falló fue la red y la difusión ya estaba creada), dos
 * pestañas, o MaKo proponiendo otra vez después de una tanda que falló, creaban OTRA automatización con los mismos leads y les
 * llegaba dos veces. Ahora cada pedido tiene su clave (a quién, por dónde, qué y con qué goteo) y su marca (lib/difusion.ts):
 * el MISMO pedido dentro de `VENTANA_DIFUSION_REPETIDA_MIN` RETOMA la automatización que creó (suma sólo a los que faltan);
 * mientras otro la está creando, espera. Dos difusiones distintas a los mismos leads no son un defecto: otra clave.
 */
export const VENTANA_DIFUSION_REPETIDA_MIN = 24 * 60;
/** Una marca SIN automatización es alguien creándola; pasado esto, se cayó a mitad y el pedido vuelve a ser nuevo. */
export const ESPERA_DIFUSION_EN_CURSO_MIN = 5;

/** El pedido en un texto estable: el mismo pedido da el mismo texto, en cualquier orden de ids o de canales. */
export function claveDeDifusion(p: {
  seleccion: { leadIds: number[] } | { funnelId: number | null; etapa: string };
  canales: readonly CanalDifusion[]; mensajes: MensajesDifusion; goteo: GoteoDifusion; siContesta?: SiContestaDifusion | null;
}): string {
  const sel = 'leadIds' in p.seleccion
    ? { ids: [...new Set(p.seleccion.leadIds)].sort((x, y) => x - y) }
    : { funnel: p.seleccion.funnelId ?? null, etapa: p.seleccion.etapa.trim() };
  const canales = CANALES_DIFUSION.filter((c) => p.canales.includes(c));
  // El seguimiento entra en la clave SÓLO si lo hay: el mismo pedido sin él da la clave de siempre (las marcas de antes valen).
  return JSON.stringify({ sel, canales, mensajes: canales.map((c) => p.mensajes[c] ?? null), goteo: [p.goteo.minutos, p.goteo.dia, ...(p.goteo.arranque ? [p.goteo.arranque.dia, p.goteo.arranque.sube] : [])], ...(p.siContesta ? { siContesta: [p.siContesta.dias, ...p.siContesta.mensajes] } : {}) });
}

/** La marca de un pedido: cuándo se pidió y la automatización que creó (null mientras se crea). */
export type MarcaDifusion = { at: string; secuenciaId: number | null };

export function leerMarcaDifusion(raw: string | null | undefined): MarcaDifusion | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { at?: unknown; secuenciaId?: unknown };
    if (typeof o.at !== 'string') return null;
    const id = Number(o.secuenciaId);
    return { at: o.at, secuenciaId: o.secuenciaId != null && Number.isInteger(id) && id > 0 ? id : null };
  } catch { return null; }
}

export type DifusionRepetida = { es: 'nueva' } | { es: 'en_curso' } | { es: 'retomar'; secuenciaId: number };

/** ¿Este pedido ya se hizo? Nuevo, alguien lo está creando ahora, o retomar la automatización que creó. */
export function decidirRepetida(marca: MarcaDifusion | null, ahoraMs: number): DifusionRepetida {
  const t = marca ? Date.parse(marca.at) : NaN;
  if (!marca || !Number.isFinite(t)) return { es: 'nueva' };
  const min = (ahoraMs - t) / 60_000;
  if (marca.secuenciaId == null) return min < ESPERA_DIFUSION_EN_CURSO_MIN ? { es: 'en_curso' } : { es: 'nueva' };
  return min < VENTANA_DIFUSION_REPETIDA_MIN ? { es: 'retomar', secuenciaId: marca.secuenciaId } : { es: 'nueva' };
}

/**
 * UNA DIFUSIÓN TERMINADA SE PAUSA SOLA (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): quedaba prendida para
 * siempre y ocupaba un lugar del tope del plan Esencial (3 activas), y la difusión siguiente fallaba con «Llegaste al tope de
 * tu plan» por una que ya había terminado. Se reconoce por la `clave` (`PREFIJO_CLAVE_DIFUSION`: la clave no cambia nunca,
 * el nombre sí) y se pausa cuando no le queda nadie EN CURSO (`pausarDifusionesTerminadas`, lib/difusion.ts, en la corrida de
 * la hora). 'respondio' cuenta como en curso: el desenlace la cierra en la corrida siguiente, y si alguien le sumó una
 * respuesta en el lienzo, la está atendiendo.
 */
export const PREFIJO_CLAVE_DIFUSION = 'difusion-';
export const ESTADOS_DIFUSION_EN_CURSO = ['activa', 'pausada', 'respondio'] as const;
/** Se prende ANTES de inscribir: una recién creada no se mira hasta pasado esto. */
export const MIN_DIFUSION_ANTES_DE_PAUSAR = 15;

/** El goteo pedido, en rango (`RANGOS_GOTEO`): un número fuera de rango no se guarda callado, se dice. */
export function goteoValido(g: unknown): GoteoDifusion | null {
  const o = (g && typeof g === 'object' ? g : {}) as { minutos?: unknown; dia?: unknown; arranque?: { dia?: unknown; sube?: unknown } | null };
  const [mMin, mMax] = RANGOS_GOTEO.minutos;
  const [dMin, dMax] = RANGOS_GOTEO.dia;
  const minutos = Number(o.minutos);
  const dia = Number(o.dia);
  if (!Number.isInteger(minutos) || minutos < mMin || minutos > mMax) return null;
  if (!Number.isInteger(dia) || dia < dMin || dia > dMax) return null;
  if (o.arranque == null) return { minutos, dia };
  const inicio = Number(o.arranque.dia);
  const sube = Number(o.arranque.sube);
  if (![inicio, sube].every((n) => Number.isInteger(n) && n >= dMin && n <= dMax)) return null;
  if (inicio < dia && !arranqueLlega(dia, { dia: inicio, sube })) return null;
  return goteoConArranque({ minutos, dia }, { dia: inicio, sube });
}
