// =============================================================================
// recomendaciones-senales — lo que se MIDE para que MaKo pueda recomendar, puro (26/10/2026)
// =============================================================================
// Cada función recibe filas ya leídas de la base del negocio (lib/recomendaciones.ts las lee, con cada `error` mirado) y
// devuelve las `Senal` que se sostienen con ESOS datos. Ninguna llama a una IA: el número lo pone el código.
// El diseño, el porqué de cada umbral y de dónde sale: docs/diseno-mako-recomienda.md (§ «Las señales»).
//
// LO QUE NO SE NEGOCIA:
//   · UNA SEÑAL SIN MUESTRA NO HABLA: cada una declara su `nMinimo`. Diez casos no son una tendencia.
//   · NINGÚN NOMBRE NI TEXTO DE UNA PERSONA EN EL `dato`: sólo números y nombres de cosas del negocio (una automatización,
//     una página). El `dato` puede salir por la API y lo lee la IA del negocio.
//   · LO QUE NO SE PUDO LEER NO ES CERO: el server no llama a una función de acá con filas de una lectura que falló.
//   · LOS UMBRALES SON DEFAULTS RAZONADOS, NO MEDIDOS TODAVÍA contra producción (la lectura de producción la habilita
//     Martín). Están juntos en `UMBRALES` para medirlos en un solo lugar.
// =============================================================================

import { claveDe, type Senal } from './recomendaciones-reglas';

const DIA = 86_400_000;
const HORA = 3_600_000;

/** Los umbrales de cada señal, juntos. El porqué de cada uno, en docs/diseno-mako-recomienda.md. */
export const UMBRALES = {
  /**
   * Conversaciones nuevas (la persona escribió primero) que esperaron más de `horas` la primera respuesta. Una hora y no
   * cinco minutos: el estudio de HBR (2011) mide la caída fuerte en la primera hora, y un negocio chico que contesta a mano
   * no baja de cinco minutos sin una automatización. `grupoMinimo`: para comparar cuántos avanzaron en cada grupo.
   */
  respuestaLenta: { dias: 14, horas: 1, tasa: 0.3, nMinimo: 10, grupoMinimo: 5 },
  /** Personas cuyo último mensaje es suyo, sin respuesta hace más de `horas` (y menos de `diasMax`: lo viejo ya murió). */
  esperando: { horas: 12, diasMax: 7, minimo: 3 },
  /** No-show: llamadas marcadas de los últimos `dias`. */
  noShow: { dias: 45, tasa: 0.3, nMinimo: 8 },
  /** Un motivo de pérdida que se repite. */
  motivoPerdida: { dias: 120, parte: 0.35, nMinimo: 6, vecesMinimo: 3 },
  /** Una automatización que falla al mandar. */
  automatizacionFalla: { dias: 7, tasa: 0.15, nMinimo: 10, fallosMinimo: 5 },
  /** Una automatización que espera respuesta (tiene un «Contestó» o un AI Step) y contesta menos de uno de cada veinte. */
  // `margenDias`: sólo cuenta quien YA recibió un mensaje hace al menos esto (tuvo tiempo de contestar). Sin el margen, una
  // importación de hoy o una espera de 2 días al principio daban «no respondió ninguna» sobre un mensaje que no salió.
  automatizacionMuda: { dias: 30, tasa: 0.05, nMinimo: 25, margenDias: 2 },
  /** Una página con gente que entra y casi nadie deja sus datos. */
  landingConversion: { visitantesMinimo: 150, tasa: 0.01 },
  /** Una página donde casi nadie llega a la mitad. */
  landingScroll: { baseMinima: 100, tasa: 0.25 },
  /** Una objeción que aparece en las conversaciones y la oferta no contesta. */
  objecion: { vecesMinimo: 3, parte: 0.15 },
  /** El recolector apagado con conversaciones de las que aprender. */
  secondBrain: { conversacionesMinimo: 15 },
} as const;

const pct = (x: number): string => `${Math.round(x * 100)} %`;
const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;
/** «hace 3 días», «hace 14 horas». */
const hace = (ms: number): string => (ms >= 2 * DIA ? `hace ${Math.floor(ms / DIA)} días` : `hace ${Math.max(1, Math.floor(ms / HORA))} horas`);
/** Un nombre de una cosa del negocio, corto y sin saltos. */
const nombreCorto = (s: string, max = 60): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

// ── WhatsApp: qué tan rápido y a quién se le contesta ──────────────────────────────────────────────────────────────

export type MensajeSenal = { chat_jid: string; wa_timestamp: string; from_me: boolean; lead_id: number | null; tipo: string | null; texto: string | null };

/** ¿Es una conversación con una persona? (ni grupo, ni canal, ni estados). Igual que el recolector. */
const esPersona = (jid: string): boolean => /@(s\.whatsapp\.net|c\.us|lid)$/.test(jid) && !/^status@/.test(jid);

/** Un mensaje que no pide respuesta («gracias», «ok», un emoji solo): no cuenta como alguien esperando. */
export function noPideRespuesta(texto: string | null | undefined): boolean {
  const t = (texto ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^[!.¡¿?\s]+|[!.¡¿?\s]+$/g, '').trim();
  if (!t) return true;
  if (!/[a-z0-9]/.test(t)) return true; // sólo emojis o signos
  // «gracias a <quien sea>» y «cha[ou]» (chau y chao) cubren las formas de cada país sin listarlas una por una.
  return /^(ok(a|ey|is)?|okk+|gracias( a \S+| igual| mil)?|muchas gracias|mil gracias|dale|listo|perfecto|genial|joya|buenisimo|excelente|de nada|igualmente|sale|vale|bueno|si|no|cha[ou]|adios|saludos|👍|🙏)$/.test(t);
}

/**
 * Las conversaciones con leads, en orden de tiempo. Sólo personas y sólo las que tienen un lead del CRM (la línea de un
 * negocio puede ser el WhatsApp personal de su dueño: su familia no es «lo que el negocio vivió»).
 */
function conversaciones(msgs: readonly MensajeSenal[]): Map<string, MensajeSenal[]> {
  const por = new Map<string, MensajeSenal[]>();
  for (const m of msgs) {
    if (!esPersona(m.chat_jid) || m.tipo === 'evento' || Number.isNaN(Date.parse(m.wa_timestamp))) continue;
    (por.get(m.chat_jid) ?? por.set(m.chat_jid, []).get(m.chat_jid)!).push(m);
  }
  for (const [jid, lista] of por) {
    if (!lista.some((m) => m.lead_id != null)) { por.delete(jid); continue; }
    lista.sort((a, b) => Date.parse(a.wa_timestamp) - Date.parse(b.wa_timestamp));
  }
  return por;
}

/**
 * Velocidad de primera respuesta: de las conversaciones que la persona EMPEZÓ en la ventana (su primer mensaje es lo
 * primero que hay de esa conversación en lo leído), cuántas esperaron más de `horas` (o nunca recibieron respuesta). Las
 * que empezaron hace menos de `horas` no cuentan: todavía están a tiempo. `desdeLectura` es desde cuándo se leyó (más
 * atrás que la ventana, para saber si una conversación es nueva de verdad).
 *
 * `avanzo` (opcional): qué leads AVANZARON (agendaron o compraron). Con eso, y con `grupoMinimo` en cada lado, el dato
 * compara a los que esperaron con los que no, con los números del propio negocio (el asesor de verdad no cita a HBR: te
 * muestra lo que te pasó a ti). Sin `avanzo`, no se compara: no se afirma nada que no se midió.
 */
export function senalRespuestaLenta(msgs: readonly MensajeSenal[], ahora: Date, desdeLectura: Date, avanzo?: ReadonlySet<number>): Senal | null {
  const U = UMBRALES.respuestaLenta;
  const desdeVentana = ahora.getTime() - U.dias * DIA;
  let n = 0, tarde = 0;
  const esperas: number[] = [];
  const grupos = { tarde: { n: 0, avanzaron: 0 }, aTiempo: { n: 0, avanzaron: 0 } };
  for (const lista of conversaciones(msgs).values()) {
    const primero = lista[0];
    const t0 = Date.parse(primero.wa_timestamp);
    // Es nueva sólo si lo primero leído es de la persona, cae en la ventana y no está pegado al borde de la lectura
    // (un mensaje en el borde puede tener historia antes que no se leyó).
    if (primero.from_me || t0 < desdeVentana || t0 - desdeLectura.getTime() < DIA) continue;
    if (ahora.getTime() - t0 < U.horas * HORA) continue;
    n++;
    const resp = lista.find((m) => m.from_me && Date.parse(m.wa_timestamp) >= t0);
    const espera = resp ? Date.parse(resp.wa_timestamp) - t0 : Number.POSITIVE_INFINITY;
    const esTarde = espera > U.horas * HORA;
    if (esTarde) tarde++;
    if (Number.isFinite(espera)) esperas.push(espera);
    const lead = lista.find((m) => m.lead_id != null)?.lead_id;
    if (avanzo && lead != null) {
      const g = esTarde ? grupos.tarde : grupos.aTiempo;
      g.n++;
      if (avanzo.has(lead)) g.avanzaron++;
    }
  }
  if (!n) return null;
  esperas.sort((a, b) => a - b);
  const mediana = esperas.length ? esperas[Math.floor(esperas.length / 2)] : null;
  const medianaTxt = mediana == null ? '' : mediana < HORA ? `; la mitad recibió respuesta en menos de ${Math.max(1, Math.round(mediana / 60_000))} minutos` : `; la espera típica fue de ${Math.round(mediana / HORA)} horas`;
  const comparar = avanzo && grupos.tarde.n >= U.grupoMinimo && grupos.aTiempo.n >= U.grupoMinimo
    && grupos.aTiempo.avanzaron / grupos.aTiempo.n > grupos.tarde.avanzaron / grupos.tarde.n;
  const espera = U.horas === 1 ? 'una hora' : `${U.horas} horas`;
  const s: Senal = {
    tipo: 'respuesta-lenta', objeto: 'negocio', superficies: ['ops-center', 'automations', 'whatsapp'],
    dato: `${tarde} de ${n} personas que te escribieron por primera vez esperaron más de ${espera} tu respuesta${medianaTxt}`
      + (comparar ? `. De las que esperaron, avanzaron ${grupos.tarde.avanzaron} de ${grupos.tarde.n}; de las que no, ${grupos.aTiempo.avanzaron} de ${grupos.aTiempo.n}` : ''),
    valor: tarde / n, umbral: U.tasa, sentido: 'mayor', n, nMinimo: U.nMinimo,
    fuente: `tus conversaciones de WhatsApp con leads de los últimos ${U.dias} días${comparar ? ' y las etapas de tu CRM' : ''}`, impacto: 0.95,
    hacer: 'Responde el primer mensaje en el momento: una automatización de bienvenida que conteste y haga la primera pregunta',
    cambia: comparar ? 'En tu propio negocio, el que recibe respuesta a tiempo avanza más que el que espera' : 'Quien recibe respuesta en la primera hora sigue la conversación; el que espera ya le escribió a otro',
    accion: { tipo: 'chat', etiqueta: 'Armarla con MaKo', pedido: 'Arma una automatización de bienvenida que conteste al instante el primer mensaje de WhatsApp de un lead nuevo y le haga la primera pregunta para calificarlo' },
  };
  return s;
}

/** Personas que escribieron último y siguen sin respuesta (ni muy recientes, ni ya muertas). */
export function senalEsperando(msgs: readonly MensajeSenal[], ahora: Date): Senal | null {
  const U = UMBRALES.esperando;
  let n = 0;
  let masVieja = 0;
  for (const lista of conversaciones(msgs).values()) {
    const ultimo = lista[lista.length - 1];
    if (ultimo.from_me || noPideRespuesta(ultimo.texto)) continue;
    const espera = ahora.getTime() - Date.parse(ultimo.wa_timestamp);
    if (espera < U.horas * HORA || espera > U.diasMax * DIA) continue;
    n++;
    masVieja = Math.max(masVieja, espera);
  }
  if (!n) return null;
  return {
    tipo: 'esperando-respuesta', objeto: 'negocio', superficies: ['ops-center', 'whatsapp'],
    dato: `${plural(n, 'persona te escribió y sigue', 'personas te escribieron y siguen')} sin respuesta (la que más espera, ${hace(masVieja)})`,
    valor: n, umbral: U.minimo, sentido: 'mayor', n, nMinimo: U.minimo,
    fuente: `tus conversaciones de WhatsApp con leads de los últimos ${U.diasMax} días`, impacto: 0.85,
    hacer: 'Contéstales hoy, empezando por la que más espera',
    cambia: 'Son conversaciones que ya te eligieron; cada día sin respuesta se enfrían',
    accion: { tipo: 'link', etiqueta: 'Ver las conversaciones', href: '/chats' },
  };
}

// ── CRM: llamadas y ventas perdidas ─────────────────────────────────────────────────────────────────────────────────

export type LeadSenal = {
  junta_1_at: string | null; asistio_j1: boolean | null;
  estado_lead: string | null; motivo_perdida: string | null; created_at: string;
};

/** No-show de la primera llamada, sobre las llamadas MARCADAS (lo sin marcar no es ni una cosa ni la otra). */
export function senalNoShow(leads: readonly LeadSenal[], ahora: Date): Senal | null {
  const U = UMBRALES.noShow;
  const desde = ahora.getTime() - U.dias * DIA;
  let n = 0, faltaron = 0;
  for (const l of leads) {
    const t = Date.parse(l.junta_1_at ?? '');
    if (!Number.isFinite(t) || t < desde || t > ahora.getTime() - 2 * HORA || l.asistio_j1 == null) continue;
    n++;
    if (l.asistio_j1 === false) faltaron++;
  }
  if (!n) return null;
  return {
    tipo: 'no-show-alto', objeto: 'negocio', superficies: ['ops-center', 'automations', 'whatsapp'],
    dato: `De ${n} llamadas de los últimos ${U.dias} días, ${faltaron} no se presentaron (${pct(faltaron / n)})`,
    valor: faltaron / n, umbral: U.tasa, sentido: 'mayor', n, nMinimo: U.nMinimo,
    fuente: 'la asistencia marcada en tu CRM', impacto: 0.9,
    hacer: 'Confirma cada llamada por WhatsApp el día anterior y una hora antes, con la opción de reagendar en un toque',
    cambia: 'Menos agenda vacía: el que no puede ir reagenda en vez de desaparecer',
    accion: { tipo: 'chat', etiqueta: 'Armarlo con MaKo', pedido: 'Arma una automatización que confirme por WhatsApp cada llamada agendada el día anterior y una hora antes, con la opción de reagendar' },
  };
}

/** El texto de un motivo, para agrupar: sin mayúsculas, acentos ni signos. */
export const normalizarMotivo = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Un motivo de pérdida que se repite: la objeción más común entre las ventas perdidas con motivo escrito. */
export function senalMotivoPerdida(leads: readonly LeadSenal[], ahora: Date): Senal | null {
  const U = UMBRALES.motivoPerdida;
  const desde = ahora.getTime() - U.dias * DIA;
  const cuenta = new Map<string, { veces: number; texto: string }>();
  let n = 0;
  for (const l of leads) {
    if (l.estado_lead !== 'perdido' || !l.motivo_perdida?.trim() || Date.parse(l.created_at) < desde) continue;
    const k = normalizarMotivo(l.motivo_perdida);
    if (!k) continue;
    n++;
    const c = cuenta.get(k) ?? { veces: 0, texto: nombreCorto(l.motivo_perdida, 50) };
    c.veces++;
    cuenta.set(k, c);
  }
  if (!n) return null;
  const [k, top] = [...cuenta.entries()].sort((a, b) => b[1].veces - a[1].veces)[0];
  if (top.veces < U.vecesMinimo) return null;
  return {
    tipo: 'motivo-perdida', objeto: `motivo:${k.slice(0, 40)}`, superficies: ['ops-center', 'offer', 'landing', 'whatsapp'],
    dato: `De ${n} ventas perdidas con motivo en los últimos ${U.dias} días, ${top.veces} fueron por «${top.texto}» (${pct(top.veces / n)})`,
    valor: top.veces / n, umbral: U.parte, sentido: 'mayor', n, nMinimo: U.nMinimo,
    fuente: 'los motivos de pérdida de tu CRM', impacto: 0.8,
    hacer: `Contesta «${top.texto}» en tu oferta y en tu guion, antes de que te lo digan`,
    cambia: 'La objeción que más ventas te cuesta llega respondida a la llamada',
    accion: { tipo: 'link', etiqueta: 'Abrir la oferta', href: '/offer' },
  };
}

// ── Automations: lo que falla y lo que nadie contesta ───────────────────────────────────────────────────────────────

export type SecuenciaSenal = { id: number; nombre: string; activa: boolean; esperaRespuesta: boolean };
export type EnvioSenal = { secuencia_id: number | null; inscripcion_id: number | null; estado: string | null; error: string | null; created_at: string };
export type InscripcionSenal = { id: number; secuencia_id: number; estado: string | null; inscripto_at: string };

/** Un error de un proveedor, sin teléfonos ni ids (puede venir con el número del lead adentro). */
export const errorLimpio = (e: string): string =>
  nombreCorto(e.replace(/\+?\d[\d\s-]{5,}\d/g, '…').replace(/[0-9a-f]{16,}/gi, '…'), 70);

export function senalesDeAutomatizaciones(secs: readonly SecuenciaSenal[], envios: readonly EnvioSenal[], insc: readonly InscripcionSenal[], ahora: Date): Senal[] {
  const out: Senal[] = [];
  const F = UMBRALES.automatizacionFalla, M = UMBRALES.automatizacionMuda;
  const desdeF = ahora.getTime() - F.dias * DIA, desdeM = ahora.getTime() - M.dias * DIA;
  // El primer mensaje que le SALIÓ a cada inscripción (los envíos tienen que cubrir la ventana de `automatizacionMuda`).
  const primerEnvio = new Map<number, number>();
  for (const e of envios) {
    if (e.estado !== 'enviado' || e.inscripcion_id == null) continue;
    const t = Date.parse(e.created_at);
    const ya = primerEnvio.get(e.inscripcion_id);
    if (Number.isFinite(t) && (ya == null || t < ya)) primerEnvio.set(e.inscripcion_id, t);
  }
  for (const s of secs) {
    if (!s.activa) continue;
    const nombre = nombreCorto(s.nombre || `Automatización ${s.id}`);
    // `?sec=`: el parámetro con que /automations abre una automatización (el de todos los links del repo).
    const href = `/automations?sec=${s.id}`;
    const mios = envios.filter((e) => e.secuencia_id === s.id && Date.parse(e.created_at) >= desdeF && (e.estado === 'enviado' || e.estado === 'fallo'));
    const fallos = mios.filter((e) => e.estado === 'fallo');
    if (mios.length && fallos.length >= F.fallosMinimo) {
      const motivos = new Map<string, number>();
      for (const f of fallos) if (f.error?.trim()) motivos.set(errorLimpio(f.error), (motivos.get(errorLimpio(f.error)) ?? 0) + 1);
      const comun = [...motivos.entries()].sort((a, b) => b[1] - a[1])[0];
      out.push({
        tipo: 'automatizacion-falla', objeto: `automatizacion:${s.id}`, superficies: ['ops-center', 'automations'],
        dato: `«${nombre}» falló en ${fallos.length} de ${mios.length} envíos de los últimos ${F.dias} días${comun ? ` (lo más común: «${comun[0]}»)` : ''}`,
        valor: fallos.length / mios.length, umbral: F.tasa, sentido: 'mayor', n: mios.length, nMinimo: F.nMinimo,
        fuente: 'el registro de envíos de tus automatizaciones', impacto: 0.75,
        hacer: `Abre «${nombre}» y arregla lo que hace fallar los envíos`,
        cambia: 'Esos mensajes hoy no le llegan a nadie',
        accion: { tipo: 'link', etiqueta: 'Abrir la automatización', href },
      });
    }
    if (!s.esperaRespuesta) continue;
    // Sólo quien YA recibió algo de esta automatización hace al menos `margenDias` (revisión del tren-l, hallazgo 13): una
    // inscripción de hoy, una que espera un paso con demora o una que se creó cerrada sin mandar nada no es «no contestó».
    const conTiempo = ahora.getTime() - M.margenDias * DIA;
    const entraron = insc.filter((i) => i.secuencia_id === s.id && Date.parse(i.inscripto_at) >= desdeM && (primerEnvio.get(i.id) ?? Infinity) <= conTiempo);
    if (!entraron.length) continue;
    const respondieron = entraron.filter((i) => i.estado === 'respondio' || i.estado === 'handoff').length;
    out.push({
      tipo: 'automatizacion-muda', objeto: `automatizacion:${s.id}`, superficies: ['ops-center', 'automations'],
      dato: `De ${entraron.length} personas a las que «${nombre}» ya les escribió (hace más de ${M.margenDias} días, en los últimos ${M.dias}), ${respondieron === 0 ? 'no respondió ninguna' : `respondieron ${respondieron}`} (${pct(respondieron / entraron.length)})`,
      valor: respondieron / entraron.length, umbral: M.tasa, sentido: 'menor', n: entraron.length, nMinimo: M.nMinimo,
      fuente: 'las personas que pasaron por tus automatizaciones', impacto: 0.7,
      hacer: `Cambia el primer mensaje de «${nombre}» por una pregunta corta que se conteste con una palabra`,
      cambia: 'Un mensaje que pide algo fácil de contestar abre la conversación; uno largo se lee y se archiva',
      accion: { tipo: 'link', etiqueta: 'Abrir la automatización', href },
    });
  }
  return out;
}

// ── Landings: gente que entra y no deja sus datos, o no llega a la oferta ───────────────────────────────────────────

export type PaginaSenal = {
  url: string; visitantes: number; dias: number;
  /** Leads que entraron por esa página en la misma ventana. null = no se pudo contar (no se afirma conversión). */
  registros: number | null;
  /** Personas con scroll medido, y cuántas llegaron al 50 %. null = la página no mide scroll (Pixel viejo). */
  scroll: { base: number; mitad: number } | null;
};

/** El nombre de una página para una frase: su camino, o el dominio si es la raíz. */
export function nombreDePagina(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname && u.pathname !== '/' ? nombreCorto(u.pathname, 40) : u.hostname;
  } catch { return nombreCorto(url, 40); }
}

export function senalesDeLandings(paginas: readonly PaginaSenal[]): Senal[] {
  const out: Senal[] = [];
  const C = UMBRALES.landingConversion, S = UMBRALES.landingScroll;
  for (const p of paginas) {
    const nombre = nombreDePagina(p.url);
    // El diagnóstico de esa página en el Web Generator (`?url=`: una página de afuera o nuestra; app/web-generator/analizar).
    const href = `/web-generator/analizar?url=${encodeURIComponent(p.url)}`;
    if (p.registros != null && p.visitantes > 0) {
      out.push({
        tipo: 'landing-no-convierte', objeto: `landing:${p.url}`, superficies: ['ops-center', 'landing'],
        dato: `«${nombre}» tuvo ${p.visitantes} visitantes en ${p.dias} días y ${plural(p.registros, 'dejó sus datos', 'dejaron sus datos')} (${(p.registros / p.visitantes * 100).toFixed(1).replace('.', ',')} %)`,
        valor: p.registros / p.visitantes, umbral: C.tasa, sentido: 'menor', n: p.visitantes, nMinimo: C.visitantesMinimo,
        fuente: 'las visitas que mide tu Pixel de MaKo y los leads de tu CRM', impacto: 0.7,
        hacer: `Pon el formulario o el botón principal de «${nombre}» arriba de todo, con una sola promesa clara`,
        cambia: 'Hoy pagas el tráfico de esa página y casi nadie se convierte en lead',
        accion: { tipo: 'link', etiqueta: 'Analizar la página', href },
      });
    }
    if (p.scroll && p.scroll.base > 0) {
      out.push({
        tipo: 'landing-no-la-leen', objeto: `landing:${p.url}`, superficies: ['landing'],
        dato: `En «${nombre}», de ${p.scroll.base} personas con scroll medido sólo ${p.scroll.mitad} llegaron a la mitad de la página (${pct(p.scroll.mitad / p.scroll.base)})`,
        valor: p.scroll.mitad / p.scroll.base, umbral: S.tasa, sentido: 'menor', n: p.scroll.base, nMinimo: S.baseMinima,
        fuente: 'el scroll que mide tu Pixel de MaKo', impacto: 0.5,
        hacer: `Sube la oferta y el botón de «${nombre}» a la primera pantalla: lo que está abajo casi nadie lo ve`,
        cambia: 'Más gente ve la oferta antes de irse',
        accion: { tipo: 'link', etiqueta: 'Analizar la página', href },
      });
    }
  }
  return out;
}

// ── Offer: lo que la gente pregunta y la oferta no contesta (Second Brain + CRM) ───────────────────────────────────

/** Las familias de objeciones: qué palabras la delatan en lo que dijo la gente, y qué palabras la contestan en la oferta. */
export const OBJECIONES = [
  { id: 'precio', nombre: 'el precio o la forma de pago', dice: /\b(car[oa]s?|precio|presupuesto|no (me )?alcanza|cuotas?|financ\w*|pagar en partes|tarjeta|transferencia|descuento|plata|dinero)\b/i, contesta: /\b(cuotas?|financ\w*|pagos?|plan de pago|sin inter[eé]s|tarjeta)\b/i,
    hacer: 'Muestra en la oferta cómo se puede pagar (cuotas, plan o una versión de entrada) antes de que lo pregunten' },
  { id: 'confianza', nombre: 'la confianza (si funciona, si es real)', dice: /\b(estafa|confian\w*|funciona|resultados?|testimonios?|garant\w*|devoluci\w*|reembols\w*|seguro que|es real)\b/i, contesta: /\b(garant\w*|devoluci\w*|reembols\w*|testimonios?|casos? de [eé]xito)\b/i,
    hacer: 'Suma a la oferta una garantía concreta y dos casos reales con su resultado' },
  { id: 'tiempo', nombre: 'el tiempo que pide', dice: /\b(no tengo tiempo|tiempo|horarios?|cu[aá]nto dura|cu[aá]ntas horas|ocupad[oa])\b/i, contesta: /\b(minutos? (al|por) d[ií]a|horas? (a la|por) semana|a tu ritmo|grabad[oa]s?|cuando quieras)\b/i,
    hacer: 'Di en la oferta cuánto tiempo por semana pide y que se puede hacer a su ritmo' },
  { id: 'consultar', nombre: 'consultarlo con otra persona', dice: /\b(consult\w+ con|mi (pareja|espos[oa]|marido|socio)|lo (tengo que )?(pienso|hablo)|pensarlo)\b/i, contesta: /\b(pareja|socio|familia|decisi[oó]n)\b/i,
    hacer: 'Dale en la oferta algo para mostrarle a quien decide con él (un resumen de una página o un video corto)' },
] as const;

/** Las objeciones de UNA llamada de venta analizada (closing_analyses.objections): lo que se dijo y si se respondió. */
export type LlamadaSenal = { objeciones: ReadonlyArray<{ texto: string; respondida: boolean }> };

/**
 * Una objeción que aparece en lo que MaKo aprendió de las conversaciones (los hechos del Second Brain, uno por contacto), en
 * las llamadas de venta analizadas (con si se respondió) o en los motivos de pérdida, y que el texto de la oferta no contesta.
 * `textoOferta` null = no hay oferta que leer: no se afirma que «no la contesta».
 */
export function senalesDeObjeciones(hechosPorContacto: readonly string[][], motivos: readonly string[], textoOferta: string | null, llamadas: readonly LlamadaSenal[] = []): Senal[] {
  if (textoOferta == null) return [];
  const U = UMBRALES.objecion;
  const n = hechosPorContacto.length + motivos.length + llamadas.length;
  if (!n) return [];
  const out: Senal[] = [];
  for (const o of OBJECIONES) {
    const enCharlas = hechosPorContacto.filter((h) => h.some((x) => o.dice.test(x))).length;
    const enMotivos = motivos.filter((m) => o.dice.test(m)).length;
    const conEsta = llamadas.filter((l) => l.objeciones.some((x) => o.dice.test(x.texto)));
    const sinResponder = conEsta.filter((l) => l.objeciones.some((x) => o.dice.test(x.texto) && !x.respondida)).length;
    const veces = enCharlas + enMotivos + conEsta.length;
    if (veces < U.vecesMinimo || o.contesta.test(textoOferta)) continue;
    const partes = [
      enCharlas ? `${enCharlas} de ${hechosPorContacto.length} conversaciones` : '',
      conEsta.length ? `${conEsta.length} de ${llamadas.length} llamadas${sinResponder ? ` (en ${sinResponder} no se respondió)` : ''}` : '',
      enMotivos ? `${enMotivos} de ${motivos.length} ventas perdidas` : '',
    ].filter(Boolean);
    const de = [enCharlas ? 'tus conversaciones de WhatsApp' : '', conEsta.length ? 'tus llamadas de venta analizadas' : '', enMotivos ? 'los motivos de pérdida de tu CRM' : ''].filter(Boolean);
    out.push({
      tipo: 'objecion-sin-respuesta', objeto: `objecion:${o.id}`, superficies: ['offer', 'landing', 'ops-center', 'whatsapp'],
      dato: `${partes.join(', ').replace(/, ([^,]*)$/, ' y $1')} hablan ${o.nombre.startsWith('el ') ? `del ${o.nombre.slice(3)}` : `de ${o.nombre}`}, y tu oferta no lo contesta`,
      valor: veces / n, umbral: U.parte, sentido: 'mayor', n, nMinimo: U.vecesMinimo,
      fuente: de.join(', ').replace(/, ([^,]*)$/, ' y $1'), impacto: 0.8,
      hacer: o.hacer, cambia: 'La duda que más se repite deja de frenar la venta',
      accion: { tipo: 'link', etiqueta: 'Abrir la oferta', href: '/offer' },
    });
  }
  return out;
}

// ── El Second Brain: que MaKo esté aprendiendo de verdad ────────────────────────────────────────────────────────────

/** El recolector apagado mientras hay conversaciones con leads de las que aprender, y el negocio tiene su IA. */
export function senalSecondBrainSinAprender(o: { prendido: boolean; conIA: boolean; conversaciones: number }): Senal | null {
  if (o.prendido || !o.conIA) return null;
  const U = UMBRALES.secondBrain;
  return {
    tipo: 'second-brain-sin-aprender', objeto: 'negocio', superficies: ['ops-center'],
    dato: `Tuviste ${o.conversaciones} conversaciones de WhatsApp con leads en 14 días y MaKo no está aprendiendo de ninguna`,
    valor: o.conversaciones, umbral: U.conversacionesMinimo, sentido: 'mayor', n: o.conversaciones, nMinimo: U.conversacionesMinimo,
    fuente: 'tus conversaciones de WhatsApp y el estado de «Aprende solo»', impacto: 0.6,
    hacer: 'Prende «Aprende solo» en el Second Brain para que MaKo saque las objeciones y pedidos de tus conversaciones',
    cambia: 'Las recomendaciones de la oferta y del guion salen de lo que tu gente dice de verdad',
    accion: { tipo: 'link', etiqueta: 'Abrir el Second Brain', href: '/second-brain?vista=mapa' },
  };
}

// ── De qué fuente sale cada tipo (para no afirmar una mejora que no se midió) ───────────────────────────────────────

/** Las fuentes que lee el motor (lib/recomendaciones.ts, `senalesDelNegocio`). */
export type FuenteRec = 'whatsapp' | 'leads' | 'automatizaciones' | 'landings' | 'objeciones' | 'second-brain';

/** De qué fuente sale cada tipo de señal. Un tipo nuevo se suma acá: sin su fuente, nunca figura como «mejoró». */
export const FUENTE_DEL_TIPO: Readonly<Record<string, FuenteRec>> = {
  'respuesta-lenta': 'whatsapp', 'esperando-respuesta': 'whatsapp',
  'no-show-alto': 'leads', 'motivo-perdida': 'leads',
  'automatizacion-falla': 'automatizaciones', 'automatizacion-muda': 'automatizaciones',
  'landing-no-convierte': 'landings', 'landing-no-la-leen': 'landings',
  'objecion-sin-respuesta': 'objeciones',
  'second-brain-sin-aprender': 'second-brain',
};

/** Lo que necesita los leads para medirse bien (los registros por página, los motivos): si los leads fallan, tampoco se midió.
 *  WhatsApp no: sus conversaciones traen el `lead_id` en el mensaje, y sin leads sólo pierde la comparación de quién avanzó. */
const DEPENDEN_DE_LEADS: readonly FuenteRec[] = ['landings', 'objeciones'];

/**
 * Los TIPOS que se midieron de verdad en una lectura: los de las fuentes leídas, menos los de las que fallaron (y lo que
 * depende de los leads, si fallaron los leads). Revisión del tren-l, hallazgo 12: sin esto, «Lo que mejoró» daba por mejorado
 * lo que esta pantalla ni leyó.
 */
export function tiposMedidos(leidas: readonly FuenteRec[], fallas: ReadonlyArray<{ fuente: string }>): Set<string> {
  const fallidas = new Set(fallas.map((f) => f.fuente));
  if (fallidas.has('leads')) DEPENDEN_DE_LEADS.forEach((f) => fallidas.add(f));
  const ok = new Set(leidas.filter((f) => !fallidas.has(f)));
  return new Set(Object.entries(FUENTE_DEL_TIPO).filter(([, f]) => ok.has(f)).map(([t]) => t));
}

/** Las claves de un lote de señales (para tests y para el registro de lo dicho). */
export const clavesDe = (ss: readonly Senal[]): string[] => ss.map(claveDe);
