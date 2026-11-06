// =============================================================================
// Marketing CoPilot — la primera entrada: una charla que termina en un funnel propuesto (PURO: lo prueban los tests)
// =============================================================================
// Martín, 6/11/2026: «Cuando alguien entra por primera vez, que sea diferente el diseño… Que MaKo te vaya preguntando las cosas
// que hagan falta… que te proponga funnel, que investigue tu presupuesto, que te proponga investigar a la competencia, si se elige
// funnel de anuncios, ¿cuál? VSL, Campaña de Mensajes, de Formulario, compra carrito… Si se elige orgánico, ¿qué estrategia?
// ¿Cuánto se va a publicar? ¿Viralidad o ventas? ¿Stories, Reels?… al iniciar un nuevo marketing copilot proponerle al usuario que
// diga: quiero seguir la estrategia de Frandoglio, de Sofía Contreras… o quiero hacer el funnel de anuncios de VSL, el de webinar,
// el de lead magnets».
//
// Lo que se decide con REGLAS va acá (qué funnel conviene según ticket, presupuesto y equipo): el modelo habla, pero no decide
// solo. Las reglas salen de docs/conocimiento/anuncios-high-ticket.md (las cifras de ahí son de otras personas, sin auditar:
// acá se usan como umbrales de criterio, nunca como promesa) y se dicen como criterio de MaKo, sin nombrar a nadie de ese documento.
// Un referente de lib/asesores sí se nombra, siempre con «Inspirado en».
//
// ⚠️ NADA SE PROMETE: lo que la propuesta cuenta son órdenes de magnitud con su condición («como referencia, entre US$100 y
//    US$300 por agenda; el tuyo puede ser otro»), nunca un resultado.
// =============================================================================

import type { OfferMensaje } from '@/lib/offer-marco';
import { asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { fmtDinero } from '@/lib/format';
import { montoDelTexto } from './monto';

export const CLAVE_COPILOTO = 'marketing-copilot.perfil';

export type IdFunnel = 'vsl-llamada' | 'mensajes' | 'formulario' | 'carrito' | 'webinar' | 'lead-magnet' | 'youtube' | 'organico';
export type Llamadas = 'yo' | 'equipo' | 'nadie';
export type ObjetivoOrganico = 'viralidad' | 'ventas' | 'mixto';
export type FormatoOrganico = 'reels' | 'stories' | 'carruseles' | 'mezcla' | 'largos' | 'shorts';

export type PerfilCopiloto = {
  entrada?: 'funnel' | 'referente';
  referente?: IdAsesor;
  funnel?: IdFunnel;
  /** En US$ por mes; 0 = «nada por ahora». */
  presupuestoMes?: number;
  /** Lo que deja una venta, en US$. */
  ticket?: number;
  llamadas?: Llamadas;
  /** Qué hizo con el aviso de que el funnel elegido no le sirve: cambió al propuesto o siguió con el suyo. */
  ajuste?: 'cambio' | 'sigo';
  objetivo?: ObjetivoOrganico;
  /** Piezas (o videos) por semana. */
  ritmo?: number;
  formato?: FormatoOrganico;
  competencia?: 'si' | 'luego';
  aceptado?: true;
};

export type Funnel = {
  id: IdFunnel;
  nombre: string;
  /** Una línea para la pastilla y la tarjeta. */
  que: string;
  /** ¿Se alimenta de anuncios? Define si la pantalla muestra Campañas (lib/media-buyer/copiloto.ts → seccionesDe). */
  conAnuncios: boolean;
  /** ¿Termina en una llamada o una conversación con una persona? */
  conLlamada: boolean;
};

export const FUNNELS: readonly Funnel[] = [
  { id: 'vsl-llamada', nombre: 'Anuncios a un VSL con llamada', que: 'Anuncio, video de venta, agenda y llamada', conAnuncios: true, conLlamada: true },
  { id: 'mensajes', nombre: 'Anuncios a mensajes', que: 'Anuncio que abre una conversación por WhatsApp o Instagram', conAnuncios: true, conLlamada: true },
  { id: 'formulario', nombre: 'Anuncios a un formulario', que: 'Anuncio, formulario con filtro y seguimiento', conAnuncios: true, conLlamada: true },
  { id: 'carrito', nombre: 'Anuncios a compra directa', que: 'Anuncio, página y carrito: se compra sin llamada', conAnuncios: true, conLlamada: false },
  { id: 'webinar', nombre: 'Webinar', que: 'Una clase en vivo o grabada que prepara la venta', conAnuncios: true, conLlamada: true },
  { id: 'lead-magnet', nombre: 'Lead magnets', que: 'Un regalo útil a cambio del contacto, y secuencia de seguimiento', conAnuncios: true, conLlamada: false },
  { id: 'youtube', nombre: 'YouTube', que: 'Videos que educan y llevan a tu oferta', conAnuncios: false, conLlamada: false },
  { id: 'organico', nombre: 'Orgánico en Instagram', que: 'Reels, stories y carruseles que atraen y venden', conAnuncios: false, conLlamada: false },
];
export const funnelPorId = (id: unknown): Funnel | null => FUNNELS.find((f) => f.id === id) ?? null;

/** Los referentes que se ofrecen al empezar: el funnel con el que cada uno trabaja. El resto de lib/asesores sigue en el Funnel Coach. */
export const REFERENTES_COPILOTO: ReadonlyArray<{ id: IdAsesor; funnel: IdFunnel; frase: string }> = [
  { id: 'francisco-doglio', funnel: 'webinar', frase: 'webinars que preparan la venta' },
  { id: 'sofia-contreras', funnel: 'lead-magnet', frase: 'marketing perpetuo, sin lanzamientos' },
  { id: 'juan-ads', funnel: 'formulario', frase: 'anuncios en Meta, empezando chico' },
  { id: 'emilio-puigrredon', funnel: 'organico', frase: 'el perfil como embudo, cerrando por mensaje' },
  { id: 'julian-otalora', funnel: 'organico', frase: 'contenido orgánico con objetivo' },
  { id: 'guille-collado', funnel: 'organico', frase: 'contenido viral en Instagram' },
  { id: 'derek-chamizo', funnel: 'youtube', frase: 'canales de YouTube' },
];

export const usaAnuncios = (f: IdFunnel | undefined) => !!f && f !== 'youtube' && f !== 'organico';
const usaLlamadas = (f: IdFunnel | undefined) => f === 'vsl-llamada' || f === 'mensajes' || f === 'formulario' || f === 'webinar';

// ── Las reglas: qué conviene ─────────────────────────────────────────────────

/** Lo mínimo para decidir. */
export type DatosDeDecision = { ticket: number; presupuestoMes: number; llamadas: Llamadas };

/** Umbrales (criterio de MaKo, sacados de lo que pide cada funnel; no son promesas). */
export const UMBRALES = {
  /** La llamada con VSL pide un ticket de unos US$3.000 para pagar a quien llama. */
  ticketVsl: 3000,
  /** Con ticket de este monto para abajo, comprar sin hablar con nadie es lo normal. */
  ticketCarrito: 500,
  /** Piso para una llamada con VSL: al menos un ticket por mes, y unos US$50 por día. */
  presupuestoVsl: 1500,
  /** Piso para que un anuncio junte datos con los que aprender (unos US$10 por día). */
  presupuestoMinimo: 300,
  /** Un webinar necesita gente que llegue a verlo: con menos no se llena. */
  presupuestoWebinar: 1000,
} as const;

export type Recomendacion = { funnel: IdFunnel; porque: string; masAdelante?: IdFunnel };

/** El funnel que conviene con esos tres datos, y por qué ese. Siempre devuelve uno: con poca plata, el que no la necesita. */
export function recomendarFunnel(d: DatosDeDecision): Recomendacion {
  const { ticket, presupuestoMes: p, llamadas } = d;
  if (p < UMBRALES.presupuestoMinimo) {
    return { funnel: ticket >= UMBRALES.ticketVsl ? 'organico' : 'lead-magnet', masAdelante: 'formulario',
      porque: `Con ${fmtDinero(p)} al mes un anuncio no junta los datos para aprender. Antes de pagar, atrae con contenido y arma una lista propia.` };
  }
  if (ticket <= UMBRALES.ticketCarrito) {
    return { funnel: 'carrito', porque: `Con una venta de ${fmtDinero(ticket)} no hay margen para una llamada por cliente: la compra tiene que ser directa.` };
  }
  if (llamadas === 'nadie') {
    return { funnel: 'lead-magnet', masAdelante: ticket >= UMBRALES.ticketVsl ? 'vsl-llamada' : 'formulario',
      porque: 'Nadie toma llamadas todavía y a este precio se vende hablando. Junta contactos y, mientras, sé tú quien llame: 20 o 30 llamadas enseñan más que cualquier panel.' };
  }
  if (ticket >= UMBRALES.ticketVsl) {
    if (p >= UMBRALES.presupuestoVsl) return { funnel: 'vsl-llamada', porque: `Con ${fmtDinero(ticket)} por venta y alguien que llama, el video de venta con agenda es el camino más directo.` };
    return { funnel: 'formulario', masAdelante: 'vsl-llamada', porque: `Con ${fmtDinero(p)} al mes no alcanza para llenar un calendario de llamadas. Un formulario con filtro aprende más barato; el VSL viene cuando llegues a ${fmtDinero(UMBRALES.presupuestoVsl)}.` };
  }
  if (llamadas === 'equipo' && p >= UMBRALES.presupuestoWebinar && ticket >= 1000) {
    return { funnel: 'webinar', porque: 'Con equipo que llama y un ticket medio, un webinar educa antes y quien llama recibe gente más lista.' };
  }
  // Ticket medio o bajo-medio, llamadas hechas por el dueño o con presupuesto corto: la conversación directa.
  return { funnel: 'mensajes', masAdelante: 'formulario', porque: `Con ${fmtDinero(ticket)} por venta y presupuesto de decenas de dólares por día, conviene que el anuncio abra una conversación y tú la sigas.` };
}

export type Veredicto = { sirve: boolean; motivo: string | null; mejor: Recomendacion | null };

/** ¿El funnel que eligió le sirve a este negocio? Si no, dice por qué y cuál propone. Es un aviso, no un bloqueo: la persona decide. */
export function evaluarFunnel(f: IdFunnel, d: DatosDeDecision): Veredicto {
  const mejor = recomendarFunnel(d);
  const no = (motivo: string): Veredicto => ({ sirve: false, motivo, mejor: mejor.funnel === f ? null : mejor });
  const { ticket, presupuestoMes: p, llamadas } = d;
  if (usaAnuncios(f) && p < UMBRALES.presupuestoMinimo) return no(`Con ${fmtDinero(p)} al mes los anuncios no juntan datos para aprender.`);
  switch (f) {
    case 'vsl-llamada':
      if (ticket < UMBRALES.ticketVsl) return no(`El VSL con llamada pide una venta de unos ${fmtDinero(UMBRALES.ticketVsl)} o más para pagar la llamada. La tuya es de ${fmtDinero(ticket)}.`);
      if (llamadas === 'nadie') return no('Sin alguien que tome las llamadas, la agenda se llena y nadie vende.');
      if (p < UMBRALES.presupuestoVsl) return no(`Para llenar un calendario hacen falta unos ${fmtDinero(UMBRALES.presupuestoVsl)} al mes, y tienes ${fmtDinero(p)}.`);
      break;
    case 'carrito':
      if (ticket > 1500) return no(`Comprar sin hablar con nadie casi no funciona con una venta de ${fmtDinero(ticket)}: a ese precio la gente quiere una conversación.`);
      break;
    case 'webinar':
      if (ticket < 500) return no(`Un webinar cuesta preparar y llenar; con una venta de ${fmtDinero(ticket)} no se paga.`);
      if (llamadas === 'nadie' && ticket >= 1000) return no('El webinar prepara la venta, pero alguien tiene que cerrarla después.');
      if (p < UMBRALES.presupuestoWebinar) return no(`Un webinar necesita gente que llegue a verlo: con ${fmtDinero(p)} al mes no se llena.`);
      break;
    case 'mensajes':
    case 'formulario':
      if (llamadas === 'nadie' && ticket >= 1000) return no('Los contactos llegan, pero a este precio alguien tiene que hablarles. Empieza tú.');
      break;
    default: break;
  }
  return { sirve: true, motivo: null, mejor: null };
}

// ── La charla ────────────────────────────────────────────────────────────────

export type PasoCopiloto = 'entrada' | 'referente' | 'funnel' | 'ticket' | 'presupuesto' | 'llamadas' | 'ajuste' | 'objetivo' | 'ritmo' | 'formato'
  | 'competencia' | 'propuesta' | 'listo';

const funnelDe = (p: PerfilCopiloto): IdFunnel | undefined => p.funnel ?? (p.referente ? REFERENTES_COPILOTO.find((r) => r.id === p.referente)?.funnel : undefined);
export const funnelElegido = (p: PerfilCopiloto): Funnel | null => funnelPorId(funnelDe(p));

const datosDe = (p: PerfilCopiloto): DatosDeDecision | null =>
  p.ticket != null && p.presupuestoMes != null && p.llamadas ? { ticket: p.ticket, presupuestoMes: p.presupuestoMes, llamadas: p.llamadas } : null;

/** El aviso pendiente (el funnel elegido no sirve y no contestó), o null. */
export function avisoPendiente(p: PerfilCopiloto): Veredicto | null {
  const f = funnelDe(p);
  const d = datosDe(p);
  if (!f || !d || p.ajuste) return null;
  const v = evaluarFunnel(f, d);
  return v.sirve || !v.mejor ? null : v;
}

/** El paso que toca: el primero que falta. */
export function pasoDeCopiloto(p: PerfilCopiloto): PasoCopiloto {
  if (!p.entrada) return 'entrada';
  if (p.entrada === 'referente' && !p.referente && !p.funnel) return 'referente';
  if (p.entrada === 'funnel' && !p.funnel) return 'funnel';
  const f = funnelDe(p);
  if (p.ticket == null) return 'ticket';
  if (usaAnuncios(f) && p.presupuestoMes == null) return 'presupuesto';
  // Lo que no se pregunta (orgánico y YouTube no llevan plata ni llamadas) se completa en `completar`.
  if (usaLlamadas(f) && !p.llamadas) return 'llamadas';
  const d = datosDe(completar(p));
  if (d && !p.ajuste && !evaluarFunnel(f!, d).sirve && evaluarFunnel(f!, d).mejor) return 'ajuste';
  if (f === 'organico' && !p.objetivo) return 'objetivo';
  if ((f === 'organico' || f === 'youtube') && p.ritmo == null) return 'ritmo';
  if ((f === 'organico' || f === 'youtube') && !p.formato) return 'formato';
  if (!p.competencia) return 'competencia';
  if (!p.aceptado) return 'propuesta';
  return 'listo';
}

/** Para decidir con lo que se sabe: un funnel sin anuncios o sin llamadas no pregunta esos datos, y valen lo que no gastan. */
function completar(p: PerfilCopiloto): PerfilCopiloto {
  const f = funnelDe(p);
  return { ...p, presupuestoMes: p.presupuestoMes ?? (usaAnuncios(f) ? undefined : 0), llamadas: p.llamadas ?? (usaLlamadas(f) ? undefined : 'yo') };
}

const us = (n: number) => fmtDinero(n);
export const TICKETS = [200, 500, 1000, 3000, 5000, 10000] as const;
export const PRESUPUESTOS = [300, 600, 1000, 2000, 5000] as const;
const NADA = 'Nada por ahora';
const RITMOS_ORGANICO = [3, 5, 7] as const;
const RITMOS_YOUTUBE = [1, 2] as const;

const TXT_ENTRADA = ['Elegir un tipo de funnel', 'Seguir la estrategia de un referente'] as const;
const nombreDelReferente = (id: IdAsesor) => asesorPorId(id)?.completo ?? id;
const pastillaReferente = (r: { id: IdAsesor; frase: string }) => `${nombreDelReferente(r.id)}: ${r.frase}`;

/** Las respuestas rápidas del paso. */
export function opcionesDeCopiloto(paso: PasoCopiloto, p: PerfilCopiloto): string[] {
  const f = funnelDe(p);
  switch (paso) {
    case 'entrada': return [...TXT_ENTRADA];
    case 'referente': return REFERENTES_COPILOTO.map(pastillaReferente);
    case 'funnel': return FUNNELS.map((x) => x.nombre);
    case 'ticket': return TICKETS.map(us);
    case 'presupuesto': return [NADA, ...PRESUPUESTOS.map((n) => `${us(n)} al mes`)];
    case 'llamadas': return ['Yo', 'Un equipo', 'Nadie todavía'];
    case 'ajuste': {
      const v = avisoPendiente(completar(p));
      return v?.mejor ? [`Sí, ${funnelPorId(v.mejor.funnel)!.nombre.toLowerCase()}`, 'Sigo con el mío'] : [];
    }
    case 'objetivo': return ['Viralidad', 'Ventas', 'Un poco de cada'];
    case 'ritmo': return (f === 'youtube' ? RITMOS_YOUTUBE : RITMOS_ORGANICO).map((n) => (f === 'youtube' ? `${n} por semana` : `${n} piezas por semana`));
    case 'formato': return f === 'youtube' ? ['Videos largos', 'Shorts', 'Los dos'] : ['Reels', 'Stories', 'Carruseles', 'Una mezcla'];
    case 'competencia': return ['Sí, investígala', 'Más adelante'];
    case 'propuesta': return ['Me sirve, empecemos', 'Cambiar el funnel', 'Cambiar los números'];
    default: return [];
  }
}

/** Lo que pregunta MaKo. */
export function preguntaDeCopiloto(paso: PasoCopiloto, p: PerfilCopiloto, nombre = 'equipo'): string {
  const f = funnelElegido(p);
  switch (paso) {
    case 'entrada': return `Hola, ${nombre}. Soy tu copiloto de marketing: armamos juntos qué hacer para conseguir clientes. ¿Cómo quieres empezar?`;
    case 'referente': return '¿A quién seguimos? Uso su método como guía: no soy esa persona ni participa en MaKo.';
    case 'funnel': return '¿Qué funnel quieres armar? Si no lo sabes, elige cualquiera: te aviso si no te conviene.';
    case 'ticket': return f ? `Para ${f.nombre.toLowerCase()}: ¿cuánto te deja una venta, en dólares?` : '¿Cuánto te deja una venta, en dólares?';
    case 'presupuesto': return '¿Cuánto puedes poner en anuncios por mes? Es lo que puedes perder sin quedar afuera, no lo que te gustaría.';
    case 'llamadas': return '¿Quién toma las llamadas o contesta los mensajes de quien se interesa?';
    case 'ajuste': {
      const v = avisoPendiente(completar(p));
      const alt = v?.mejor ? funnelPorId(v.mejor.funnel) : null;
      return v && alt ? `${v.motivo} Con lo que me cuentas, propongo ${alt.nombre.toLowerCase()}. ${v.mejor!.porque}` : '¿Seguimos?';
    }
    case 'objetivo': return '¿Qué buscas con el contenido: que te conozca mucha gente (viralidad) o que te compren (ventas)? Una cosa pesa más que la otra, y sin elegir no sé qué publicar.';
    case 'ritmo': return f?.id === 'youtube' ? '¿Cuántos videos puedes subir por semana, sin dejarlo a las dos semanas?' : '¿Cuántas piezas puedes publicar por semana? Mejor menos y constante.';
    case 'formato': return f?.id === 'youtube' ? '¿Qué videos quieres hacer?' : '¿Con qué formato empezamos?';
    case 'competencia': return '¿Quieres que investigue a tu competencia? Veo qué anuncian y qué publican, para no empezar a ciegas.';
    case 'propuesta': return 'Esto te propongo:';
    case 'listo': return 'Listo. Dejé tu plan guardado; te llevo a tu panel.';
    default: return '';
  }
}

function respuestaDeCopiloto(paso: PasoCopiloto, p: PerfilCopiloto): string | null {
  switch (paso) {
    case 'entrada': return p.entrada === 'funnel' ? TXT_ENTRADA[0] : p.entrada === 'referente' ? TXT_ENTRADA[1] : null;
    case 'referente': { const r = REFERENTES_COPILOTO.find((x) => x.id === p.referente); return r ? pastillaReferente(r) : null; }
    case 'funnel': return funnelPorId(p.funnel)?.nombre ?? null;
    case 'ticket': return p.ticket != null ? us(p.ticket) : null;
    case 'presupuesto': return p.presupuestoMes != null ? (p.presupuestoMes === 0 ? NADA : `${us(p.presupuestoMes)} al mes`) : null;
    case 'llamadas': return p.llamadas ? { yo: 'Yo', equipo: 'Un equipo', nadie: 'Nadie todavía' }[p.llamadas] : null;
    case 'ajuste': return p.ajuste === 'cambio' ? 'Sí, cambiemos' : p.ajuste === 'sigo' ? 'Sigo con el mío' : null;
    case 'objetivo': return p.objetivo ? { viralidad: 'Viralidad', ventas: 'Ventas', mixto: 'Un poco de cada' }[p.objetivo] : null;
    case 'ritmo': return p.ritmo != null ? (funnelDe(p) === 'youtube' ? `${p.ritmo} por semana` : `${p.ritmo} piezas por semana`) : null;
    case 'formato': return p.formato ? { reels: 'Reels', stories: 'Stories', carruseles: 'Carruseles', mezcla: 'Una mezcla', largos: 'Videos largos', shorts: 'Shorts' }[p.formato] : null;
    case 'competencia': return p.competencia === 'si' ? 'Sí, investígala' : p.competencia === 'luego' ? 'Más adelante' : null;
    case 'propuesta': return p.aceptado ? 'Me sirve, empecemos' : null;
    default: return null;
  }
}

const ORDEN: PasoCopiloto[] = ['entrada', 'referente', 'funnel', 'ticket', 'presupuesto', 'llamadas', 'ajuste', 'objetivo', 'ritmo', 'formato', 'competencia', 'propuesta', 'listo'];

/** La charla hasta el paso de hoy: cada pregunta con la respuesta dada, y la que toca con sus pastillas. */
export function mensajesDeCopiloto(p: PerfilCopiloto, nombre = 'equipo'): OfferMensaje[] {
  const actual = pasoDeCopiloto(p);
  const out: OfferMensaje[] = [];
  for (const paso of ORDEN) {
    const dijo = respuestaDeCopiloto(paso, p);
    const sePregunto = paso === actual || dijo != null;
    if (!sePregunto) continue;
    out.push({ id: `cp-${paso}`, de: 'mako', texto: preguntaDeCopiloto(paso, p, nombre), at: '', ...(paso === actual ? { opciones: opcionesDeCopiloto(paso, p) } : {}) });
    if (paso === actual) break;
    if (dijo) out.push({ id: `cp-${paso}-r`, de: 'yo', texto: dijo, at: '' });
  }
  return out;
}

/** Lo que eligió la persona (pastilla o texto). null = no se entendió. Devuelve lo que cambia; una clave en `undefined` se borra. */
export function leerRespuestaCopiloto(paso: PasoCopiloto, texto: string, p: PerfilCopiloto): Partial<PerfilCopiloto> | null {
  const t = texto.trim();
  const l = t.toLowerCase();
  const num = montoDelTexto(t);
  switch (paso) {
    case 'entrada':
      if (/referente|estrategia|seguir/i.test(t)) return { entrada: 'referente' };
      if (/funnel|tipo|elegir/i.test(t)) return { entrada: 'funnel' };
      return null;
    case 'referente': {
      const r = REFERENTES_COPILOTO.find((x) => l.includes(nombreDelReferente(x.id).toLowerCase()) || l.includes((asesorPorId(x.id)?.nombre ?? '').toLowerCase()));
      return r ? { referente: r.id } : null;
    }
    case 'funnel': {
      const f = FUNNELS.find((x) => x.nombre.toLowerCase() === l) ?? FUNNELS.find((x) => l.includes(x.id.replace('-llamada', '')) || l.includes(x.nombre.toLowerCase()));
      return f ? { funnel: f.id } : null;
    }
    case 'ticket': return num && num > 0 ? { ticket: num } : null;
    case 'presupuesto':
      if (/nada|ning|^0$/.test(l)) return { presupuestoMes: 0 };
      return num && num > 0 ? { presupuestoMes: num } : null;
    case 'llamadas':
      if (/nadie|ning/.test(l)) return { llamadas: 'nadie' };
      if (/equipo|closer|setter|vendedor/.test(l)) return { llamadas: 'equipo' };
      if (/^yo|yo mism|yo las|^tú|^tu\b/.test(l)) return { llamadas: 'yo' };
      return null;
    case 'ajuste': {
      const v = avisoPendiente(completar(p));
      if (!v?.mejor) return null;
      if (/sigo|mío|mio|igual|^no\b/.test(l)) return { ajuste: 'sigo' };
      if (/^s[ií]|cambi/.test(l) || l.includes(funnelPorId(v.mejor.funnel)!.nombre.toLowerCase())) {
        return { funnel: v.mejor.funnel, referente: undefined, ajuste: 'cambio' };
      }
      return null;
    }
    case 'objetivo':
      if (/viral/.test(l)) return { objetivo: 'viralidad' };
      if (/venta/.test(l)) return { objetivo: 'ventas' };
      if (/cada|mixt|las dos|ambas/.test(l)) return { objetivo: 'mixto' };
      return null;
    case 'ritmo': return num && num >= 1 && num <= 21 ? { ritmo: Math.round(num) } : null;
    case 'formato': {
      if (funnelDe(p) === 'youtube') {
        if (/los dos|ambos/.test(l)) return { formato: 'mezcla' };
        if (/short/.test(l)) return { formato: 'shorts' };
        if (/largo/.test(l)) return { formato: 'largos' };
        return null;
      }
      if (/mezcla|todos|varios/.test(l)) return { formato: 'mezcla' };
      if (/reel/.test(l)) return { formato: 'reels' };
      if (/stor|histori/.test(l)) return { formato: 'stories' };
      if (/carrusel/.test(l)) return { formato: 'carruseles' };
      return null;
    }
    case 'competencia':
      if (/^s[ií]|investig/.test(l)) return { competencia: 'si' };
      if (/adelante|luego|despu|no/.test(l)) return { competencia: 'luego' };
      return null;
    case 'propuesta':
      if (/sirve|empec|ok|dale/.test(l)) return { aceptado: true };
      if (/funnel/.test(l)) return { funnel: undefined, referente: undefined, entrada: undefined, ajuste: undefined, ticket: undefined, presupuestoMes: undefined, llamadas: undefined, objetivo: undefined, ritmo: undefined, formato: undefined, competencia: undefined };
      if (/n[uú]mero/.test(l)) return { ticket: undefined, presupuestoMes: undefined, llamadas: undefined, ajuste: undefined };
      return null;
    default: return null;
  }
}

/** Aplica un cambio al perfil (las claves en `undefined` se borran). */
export function aplicarCambio(p: PerfilCopiloto, cambio: Partial<PerfilCopiloto>): PerfilCopiloto {
  const sig: PerfilCopiloto = { ...p, ...cambio };
  for (const [k, v] of Object.entries(cambio)) if (v === undefined) delete (sig as Record<string, unknown>)[k];
  return sig;
}

// ── La propuesta ─────────────────────────────────────────────────────────────

export type Propuesta = {
  titulo: string;
  /** «Inspirado en X» si eligió un referente y el funnel sigue siendo el suyo. */
  inspirado: string | null;
  /** Lo que implica, en frases cortas. */
  puntos: string[];
  /** Qué hacer primero, con la pantalla donde se hace. */
  pasos: Array<{ texto: string; href?: string }>;
};

export const RUTAS_COPILOTO = {
  calendario: '/calendario', carruseles: '/image-editor/carruseles', copywriter: '/copywriter', leadMagnets: '/lead-magnet-generator',
  competencia: '/competitor-spy', web: '/web-generator', video: '/video-editor', avatar: '/ai-avatar',
} as const;

/** Los números con su condición, nunca como promesa. */
function numerosDeAnuncios(f: IdFunnel, presupuestoMes: number): string[] {
  if (presupuestoMes <= 0) return [];
  const dia = Math.round(presupuestoMes / 30);
  const out = [`${us(presupuestoMes)} al mes son unos ${us(dia)} por día.`];
  if (f === 'vsl-llamada' || f === 'formulario' || f === 'mensajes') {
    out.push(`Como referencia conservadora, una agenda cuesta entre ${us(100)} y ${us(300)}; con tu presupuesto serían entre ${Math.floor(presupuestoMes / 300)} y ${Math.floor(presupuestoMes / 100)} al mes. El tuyo puede ser otro, y se mide por llamada calificada, no por contacto.`);
  }
  if (dia < 50 && f === 'vsl-llamada') out.push('Con menos de US$50 por día un VSL con llamada tarda en aprender.');
  return out;
}

export function propuestaDe(p: PerfilCopiloto): Propuesta | null {
  const f = funnelElegido(p);
  if (!f) return null;
  const R = RUTAS_COPILOTO;
  const ref = p.referente && REFERENTES_COPILOTO.find((r) => r.id === p.referente)?.funnel === f.id ? asesorPorId(p.referente) : null;
  const inspirado = ref ? inspiradoEn(ref) : null;
  const plata = numerosDeAnuncios(f.id, p.presupuestoMes ?? 0);
  const investigar = p.competencia === 'si' ? [{ texto: 'Mirar qué anuncia y publica tu competencia', href: R.competencia }] : [];
  let puntos: string[] = [];
  let pasos: Propuesta['pasos'] = [];
  switch (f.id) {
    case 'vsl-llamada':
      puntos = ['Anuncio que filtra, página con el video de venta y la agenda en el mismo paso.', 'Entre la agenda y la llamada: confirmación con un video y correos con valor.', ...plata];
      pasos = [...investigar, { texto: 'Escribir el guion del video de venta', href: R.copywriter }, { texto: 'Armar la página con la agenda', href: R.web }, { texto: 'Lanzar el primer anuncio, en pausa hasta que lo revises' }];
      break;
    case 'mensajes':
      puntos = ['El anuncio abre una conversación y alguien responde rápido.', 'Se mide por conversación calificada, no por mensaje.', ...plata];
      pasos = [...investigar, { texto: 'Escribir el mensaje que abre el anuncio', href: R.copywriter }, { texto: 'Crear el video o la imagen', href: R.video }, { texto: 'Lanzar el primer anuncio, en pausa hasta que lo revises' }];
      break;
    case 'formulario':
      puntos = ['Formulario con hasta tres preguntas: una confirma que es el lugar, otra filtra por plata y otra por tiempo.', 'Más fricción trae menos gente y mejor.', ...plata];
      pasos = [...investigar, { texto: 'Escribir el anuncio y las preguntas', href: R.copywriter }, { texto: 'Lanzar el primer anuncio, en pausa hasta que lo revises' }];
      break;
    case 'carrito':
      puntos = ['Anuncio, página de venta y carrito: no hay llamada.', 'Retargeting a quien miró y no compró.', ...plata];
      pasos = [...investigar, { texto: 'Armar la página de venta', href: R.web }, { texto: 'Crear los anuncios', href: R.video }, { texto: 'Lanzar el primero, en pausa hasta que lo revises' }];
      break;
    case 'webinar':
      puntos = ['Anuncio al registro, la clase y la oferta al final.', 'Se mide registro, asistencia y agendas: dónde se cae la gente dice qué arreglar.', ...plata];
      pasos = [...investigar, { texto: 'Armar la página de registro', href: R.web }, { texto: 'Escribir los correos de recordatorio', href: R.copywriter }, { texto: 'Lanzar el anuncio, en pausa hasta que lo revises' }];
      break;
    case 'lead-magnet':
      puntos = ['Un regalo útil a cambio del contacto, y una secuencia que lo prepara para comprar.', 'Los anuncios, si los hay, llevan al regalo, no a la venta.', ...plata];
      pasos = [...investigar, { texto: 'Crear el regalo', href: R.leadMagnets }, { texto: 'Escribir la secuencia de correos', href: R.copywriter }, { texto: 'Armar la página donde se pide', href: R.web }];
      break;
    case 'youtube': {
      const r = p.ritmo ?? 1;
      puntos = [`${r} video${r > 1 ? 's' : ''} por semana, ${p.formato === 'shorts' ? 'cortos' : p.formato === 'mezcla' ? 'largos y cortos' : 'largos que educan'}.`, 'Cada video lleva a un solo próximo paso: tu regalo o tu agenda.', 'YouTube tarda en dar frutos; se mide en meses, no en días.'];
      pasos = [...investigar, { texto: 'Escribir los guiones', href: R.copywriter }, { texto: 'Planear el calendario de publicación', href: R.calendario }];
      break;
    }
    case 'organico': {
      const plan = planOrganico(p);
      puntos = plan.puntos;
      pasos = [...investigar, { texto: 'Hacer los carruseles de la semana', href: R.carruseles }, { texto: 'Escribir los guiones de los reels', href: R.copywriter }, { texto: 'Programar todo en el calendario', href: R.calendario }];
      break;
    }
  }
  const aviso = p.ajuste === 'sigo' ? avisoPrevio(p) : null;
  return { titulo: f.nombre, inspirado, puntos: aviso ? [...puntos, aviso] : puntos, pasos };
}

function avisoPrevio(p: PerfilCopiloto): string | null {
  const d = datosDe(completar(p));
  const f = funnelDe(p);
  if (!d || !f) return null;
  const v = evaluarFunnel(f, d);
  return v.sirve ? null : `Ojo: ${v.motivo} Lo seguimos como pediste y lo revisamos con los primeros números.`;
}

/** Cuánto publicar y de qué, según lo que busca. Criterio de MaKo, no una fórmula medida. */
export function planOrganico(p: Pick<PerfilCopiloto, 'objetivo' | 'ritmo' | 'formato'>): { reparto: Record<'reels' | 'carruseles' | 'stories', number>; puntos: string[] } {
  const n = Math.max(1, Math.round(p.ritmo ?? 3));
  const objetivo = p.objetivo ?? 'mixto';
  // Viralidad: casi todo reels (llegan a gente nueva). Ventas: carruseles y casos (convencen a quien ya te sigue). Mixto: mitad y mitad.
  const pesoReels = objetivo === 'viralidad' ? 0.7 : objetivo === 'ventas' ? 0.3 : 0.5;
  let reels = Math.round(n * pesoReels);
  let carruseles = n - reels;
  if (p.formato === 'reels') { reels = n; carruseles = 0; }
  if (p.formato === 'carruseles') { carruseles = n; reels = 0; }
  const stories = p.formato === 'stories' || objetivo !== 'viralidad' ? 5 : 0;
  const puntos = [
    `${n} pieza${n > 1 ? 's' : ''} por semana: ${reels} reel${reels === 1 ? '' : 's'} y ${carruseles} carrusel${carruseles === 1 ? '' : 'es'}.`,
    objetivo === 'viralidad' ? 'Los reels buscan gente nueva: un gancho en los primeros segundos y un solo tema por pieza.'
      : objetivo === 'ventas' ? 'Cada pieza lleva a un mensaje directo: ahí se cierra, no en la publicación.'
        : 'Una de cada dos piezas atrae, la otra invita a escribirte.',
    stories > 0 ? 'Stories casi todos los días: son para quien ya te sigue, con preguntas y respuestas a mensajes.' : 'Stories no hacen falta al principio: pesan más en quien ya te sigue.',
  ];
  return { reparto: { reels, carruseles, stories }, puntos };
}

// ── Qué ve cada funnel en la pantalla (tanda 4) ──────────────────────────────

export type SeccionCopiloto = 'hoy' | 'campanas' | 'biblioteca' | 'plan' | 'medir';

/** Las secciones de la pantalla normal. «Campañas» sólo con anuncios: un funnel sin ellos no tiene qué mostrar ahí. */
export function seccionesDe(funnel: IdFunnel | null | undefined): SeccionCopiloto[] {
  const f = funnelPorId(funnel);
  if (!f) return ['hoy', 'campanas', 'biblioteca'];
  return f.conAnuncios ? ['hoy', 'plan', 'campanas', 'biblioteca', 'medir'] : ['hoy', 'plan', 'medir'];
}

/** Lo que llega del navegador, con su forma: lo demás se descarta. */
export function sanearPerfil(x: unknown): PerfilCopiloto {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const n = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : undefined);
  const out: PerfilCopiloto = {};
  if (o.entrada === 'funnel' || o.entrada === 'referente') out.entrada = o.entrada;
  if (typeof o.referente === 'string' && REFERENTES_COPILOTO.some((r) => r.id === o.referente)) out.referente = o.referente as IdAsesor;
  if (funnelPorId(o.funnel)) out.funnel = o.funnel as IdFunnel;
  const pm = n(o.presupuestoMes, 0, 1e8); if (pm !== undefined) out.presupuestoMes = pm;
  const tk = n(o.ticket, 0.01, 1e8); if (tk !== undefined) out.ticket = tk;
  if (o.llamadas === 'yo' || o.llamadas === 'equipo' || o.llamadas === 'nadie') out.llamadas = o.llamadas;
  if (o.ajuste === 'cambio' || o.ajuste === 'sigo') out.ajuste = o.ajuste;
  if (o.objetivo === 'viralidad' || o.objetivo === 'ventas' || o.objetivo === 'mixto') out.objetivo = o.objetivo;
  const rt = n(o.ritmo, 1, 21); if (rt !== undefined) out.ritmo = Math.round(rt);
  if (typeof o.formato === 'string' && ['reels', 'stories', 'carruseles', 'mezcla', 'largos', 'shorts'].includes(o.formato)) out.formato = o.formato as FormatoOrganico;
  if (o.competencia === 'si' || o.competencia === 'luego') out.competencia = o.competencia;
  if (o.aceptado === true) out.aceptado = true;
  return out;
}

/** ¿Terminó la primera entrada? */
export const copilotoListo = (p: PerfilCopiloto): boolean => pasoDeCopiloto(p) === 'listo';
