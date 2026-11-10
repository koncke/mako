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
import type { Desde } from '@/lib/chat-desde';
import { ASESORES, asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { QUE_ENSENA, ensenaElFunnel, queEnsena, quienesEnsenan } from './copiloto-referentes';
import { fmtDinero } from '@/lib/format';
import { montoDelTexto } from './monto';

export const CLAVE_COPILOTO = 'marketing-copilot.perfil';

/** La pestaña desde la que escribe la persona (MakoEnLaTab → `tab`): con ella el chat arma el contexto del CoPilot (copiloto-contexto.ts). */
export const ORIGEN_COPILOTO = 'Marketing CoPilot';

/** El `desde` con que escribe el teléfono (app/m/ads/HojaDelCopiloto.tsx): el MISMO que la estrella de la computadora, para que el
 *  servidor arme el contexto del CoPilot (app/api/mako/chat/route.ts mira `desde.tab === ORIGEN_COPILOTO`). */
export const desdeDelCopiloto = (pantalla?: string | null): Desde => ({ tab: ORIGEN_COPILOTO, entidad: null, modo: null, ...(pantalla ? { pantalla } : {}) });

export type IdFunnel = 'vsl-llamada' | 'mensajes' | 'formulario' | 'carrito' | 'webinar' | 'lead-magnet' | 'email' | 'youtube' | 'organico';
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
  /** Lo que había elegido antes de aceptar el funnel que propuso MaKo: con «Volver» se recupera (sin esto, volver dejaba el propuesto). */
  antesDelAjuste?: { funnel?: IdFunnel; referente?: IdAsesor };
  objetivo?: ObjetivoOrganico;
  /** Piezas (o videos) por semana. */
  ritmo?: number;
  formato?: FormatoOrganico;
  competencia?: 'si' | 'luego';
  aceptado?: true;
  // ── Lo que se descubre charlando (9/11/2026, la batería de docs/relevo/marketing-copilot-pruebas.md) ──
  // Sin esto el agente recomendaba un funnel sin saber la meta, lo que vende hoy ni si tiene casos, y en un e-commerce sin el margen.
  // Lo guarda MaKo con `copiloto_media_buyer` (con el «sí» de la persona) o el panel de la tab, y lo leen los dos (`fichaDelNegocio`).
  /** Qué vende: un servicio (consultoría, coaching, agencia), un curso o programa, productos en una tienda, o un negocio local. */
  vende?: TipoDeNegocio;
  /** Cuántos clientes (o pedidos) quiere por mes. */
  meta?: number;
  /** Cuántos consigue hoy por mes. */
  ventasMes?: number;
  /** ¿Tiene casos reales de clientes para mostrar? */
  casos?: 'si' | 'no';
  /** País o países donde vende (los costos de España y EE. UU. no son los de LATAM). */
  pais?: string;
  /** En una tienda: lo que le queda de cada venta, en % (sin esto no se sabe cuánto puede costar una venta). */
  margen?: number;
  /** Contactos en su lista de email. */
  lista?: number;
  /** Horas por semana para hacer contenido. */
  horas?: number;
};

export type TipoDeNegocio = 'servicio' | 'curso' | 'tienda' | 'local';
export const TIPOS_DE_NEGOCIO: Readonly<Record<TipoDeNegocio, string>> = {
  servicio: 'Un servicio', curso: 'Un curso o programa', tienda: 'Productos en una tienda online', local: 'Un negocio local',
};

export type Funnel = {
  id: IdFunnel;
  nombre: string;
  /** El nombre corto: el chip de la tarjeta de un referente («Webinar», «Instagram orgánico»). */
  corto: string;
  /** Una línea para la pastilla y la tarjeta. */
  que: string;
  /** ¿Lleva anuncios? 'si': es un funnel de anuncios. 'opcional': puede correr sin ellos (un webinar o un regalo se difunden también en orgánico). 'no': nunca.
   *  Define si se pregunta el presupuesto y si la pantalla muestra Campañas (`conCampanas`). */
  anuncios: 'si' | 'opcional' | 'no';
  /** ¿Termina en una llamada o una conversación con una persona? */
  conLlamada: boolean;
};

export const FUNNELS: readonly Funnel[] = [
  { id: 'vsl-llamada', nombre: 'Anuncios a un VSL con llamada', corto: 'VSL con llamada', que: 'Anuncio, video de venta, agenda y llamada', anuncios: 'si', conLlamada: true },
  { id: 'mensajes', nombre: 'Anuncios a mensajes', corto: 'Anuncios a mensajes', que: 'Anuncio que abre una conversación por WhatsApp o Instagram', anuncios: 'si', conLlamada: true },
  { id: 'formulario', nombre: 'Anuncios a un formulario', corto: 'Anuncios a formulario', que: 'Anuncio, formulario con filtro y seguimiento', anuncios: 'si', conLlamada: true },
  { id: 'carrito', nombre: 'Anuncios a compra directa', corto: 'Compra directa', que: 'Anuncio, página y carrito: se compra sin llamada', anuncios: 'si', conLlamada: false },
  { id: 'webinar', nombre: 'Webinar', corto: 'Webinar', que: 'Una clase en vivo o grabada que prepara la venta', anuncios: 'opcional', conLlamada: true },
  { id: 'lead-magnet', nombre: 'Lead magnets', corto: 'Lead magnets', que: 'Un regalo útil a cambio del contacto, y secuencia de seguimiento', anuncios: 'opcional', conLlamada: false },
  // 9/11/2026, Martín: «¿qué pasa si una persona quiere hacer un funnel de anuncios, después un orgánico, después un YouTube, después
  // email…?». Email es escribirle a la lista que YA tiene; juntar una lista nueva es el de lead magnets.
  { id: 'email', nombre: 'Email a tu lista', corto: 'Email', que: 'Correos a tu lista que educan y llevan a tu oferta', anuncios: 'no', conLlamada: false },
  { id: 'youtube', nombre: 'YouTube', corto: 'YouTube', que: 'Videos que educan y llevan a tu oferta', anuncios: 'no', conLlamada: false },
  { id: 'organico', nombre: 'Orgánico en Instagram', corto: 'Instagram orgánico', que: 'Reels, stories y carruseles que atraen y venden', anuncios: 'no', conLlamada: false },
];
export const funnelPorId = (id: unknown): Funnel | null => FUNNELS.find((f) => f.id === id) ?? null;

/**
 * Los referentes que se ofrecen al empezar: TODOS los de lib/asesores (los que tienen su cara y su ficha), con lo que enseña cada uno
 * MEDIDO en su curso (./copiloto-referentes.ts). Primero los que enseñan un funnel para conseguir clientes; después los que enseñan
 * otra parte de la venta (la oferta, la llamada, la voz). Martín, 6/11/2026: «no creo que hayas puesto a todos, pusiste a pocos».
 */
export const REFERENTES_COPILOTO: ReadonlyArray<{ id: IdAsesor; funnels: readonly IdFunnel[]; frase: string }> = [...ASESORES]
  .map((a) => ({ id: a.id, funnels: QUE_ENSENA[a.id].funnels, frase: QUE_ENSENA[a.id].tema }))
  .sort((a, b) => Number(b.funnels.length > 0) - Number(a.funnels.length > 0));

/** Las estrategias del CoPilot que enseña un referente (vacía: enseña otra parte de la venta). */
export const funnelsDelReferente = (id: IdAsesor | null | undefined): readonly IdFunnel[] => queEnsena(id)?.funnels ?? [];

export const usaAnuncios = (f: IdFunnel | undefined) => !!f && funnelPorId(f)?.anuncios !== 'no';
export const usaLlamadas = (f: IdFunnel | undefined) => f === 'vsl-llamada' || f === 'mensajes' || f === 'formulario' || f === 'webinar';

// ── Las reglas: qué conviene ─────────────────────────────────────────────────

/** Lo mínimo para decidir. `vende` y `lista` afinan (9/11/2026): una tienda compra en la página y una lista grande se trabaja antes de pagar. */
export type DatosDeDecision = { ticket: number; presupuestoMes: number; llamadas: Llamadas; vende?: TipoDeNegocio; lista?: number };

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
  /** Con una lista de este tamaño hay a quién escribirle antes de pagar anuncios; con menos de la mitad, primero se junta. */
  listaEmail: 1000,
  /** Debajo de este ticket una conversación por chat ya no se paga (en un curso o un servicio que alguien atiende). */
  ticketChat: 150,
} as const;

export type Recomendacion = { funnel: IdFunnel; porque: string; masAdelante?: IdFunnel };

/** El funnel que conviene con esos tres datos, y por qué ese. Siempre devuelve uno: con poca plata, el que no la necesita. */
export function recomendarFunnel(d: DatosDeDecision): Recomendacion {
  const { ticket, presupuestoMes: p, llamadas } = d;
  if (p < UMBRALES.presupuestoMinimo) {
    if ((d.lista ?? 0) >= UMBRALES.listaEmail) {
      return { funnel: 'email', masAdelante: d.vende === 'tienda' ? 'carrito' : 'lead-magnet',
        porque: `Tienes ${d.lista} contactos en tu lista: antes de pagar un anuncio, escríbeles. Es la gente que ya levantó la mano.` };
    }
    if (d.vende === 'tienda') {
      return { funnel: 'organico', masAdelante: 'carrito', porque: `Con ${fmtDinero(p)} al mes un anuncio no junta los datos para aprender. Muestra el producto en uso con contenido y junta compradoras para escribirles.` };
    }
    return { funnel: ticket >= UMBRALES.ticketVsl ? 'organico' : 'lead-magnet', masAdelante: 'formulario',
      porque: `Con ${fmtDinero(p)} al mes un anuncio no junta los datos para aprender. Antes de pagar, atrae con contenido y arma una lista propia.` };
  }
  // Una tienda: la compra es en la página, sin conversación, y lo que manda es cuánto cuesta cada venta contra el margen.
  if (d.vende === 'tienda') {
    return { funnel: 'carrito', porque: 'En una tienda la compra es directa: el anuncio lleva al producto y cada venta se mide contra lo que te queda de ella (tu margen).' };
  }
  if (ticket <= UMBRALES.ticketCarrito) {
    // Un curso o un servicio de unos cientos de dólares, con alguien que contesta: en LATAM una conversación corta por chat vende más que
    // una página en frío, y lo que preguntan enseña qué poner en la página de compra después.
    if ((d.vende === 'curso' || d.vende === 'servicio') && llamadas !== 'nadie' && ticket >= UMBRALES.ticketChat) {
      return { funnel: 'mensajes', masAdelante: 'carrito', porque: `Con ${fmtDinero(ticket)} por venta y alguien que contesta, una conversación corta por chat vende más que una página en frío. Cuando sepas qué te preguntan, la compra directa viene después.` };
    }
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
  if (d.vende === 'tienda' && usaLlamadas(f)) return no('En una tienda la gente compra en la página: una llamada, un formulario o un chat por pedido frenan la compra y no se pagan.');
  switch (f) {
    case 'email':
      if (d.lista != null && d.lista < UMBRALES.listaEmail / 2) return no(`Con ${d.lista} contactos hay pocos a quién escribirle: primero junta la lista con un regalo útil.`);
      break;
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

/** El funnel: el elegido, o el ÚNICO que enseña el referente. Si enseña varios (o ninguno), se pregunta cuál. */
const funnelDe = (p: PerfilCopiloto): IdFunnel | undefined => {
  if (p.funnel) return p.funnel;
  const fs = funnelsDelReferente(p.referente);
  return p.referente && fs.length === 1 ? fs[0] : undefined;
};

/** Los funnels que se ofrecen en el paso «funnel»: con un referente que enseña alguno, SÓLO los suyos; si no, todos. */
export function funnelsOfrecidos(p: PerfilCopiloto): Funnel[] {
  const suyos = p.entrada === 'referente' ? funnelsDelReferente(p.referente) : [];
  return suyos.length ? suyos.map((id) => funnelPorId(id)!) : [...FUNNELS];
}
export const funnelElegido = (p: PerfilCopiloto): Funnel | null => funnelPorId(funnelDe(p));

const datosDe = (p: PerfilCopiloto): DatosDeDecision | null =>
  p.ticket != null && p.presupuestoMes != null && p.llamadas
    ? { ticket: p.ticket, presupuestoMes: p.presupuestoMes, llamadas: p.llamadas, ...(p.vende ? { vende: p.vende } : {}), ...(p.lista != null ? { lista: p.lista } : {}) }
    : null;
/**
 * Para quien decide afuera (el contexto del agente, el panel): los datos para decidir SÓLO con lo que la persona dijo. Lo que el funnel
 * elegido no pregunta se completa (orgánico no lleva plata); lo que todavía no contestó, no: sin funnel, un presupuesto que no dijo NO
 * es «nada» (si lo fuera, toda comparación saldría «no le sirve» a los anuncios). En una tienda nadie atiende: se compra en la página.
 */
export function datosDeDecision(p: PerfilCopiloto): DatosDeDecision | null {
  const f = funnelDe(p);
  const dijoLaPlata = p.presupuestoMes != null || (!!f && !usaAnuncios(f));
  const dijoQuien = !!p.llamadas || p.vende === 'tienda' || (!!f && !usaLlamadas(f));
  if (p.ticket == null || !dijoLaPlata || !dijoQuien) return null;
  return datosDe(completar({ ...p, llamadas: p.llamadas ?? (p.vende === 'tienda' ? 'nadie' : undefined) }));
}

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
  const f = funnelDe(p);
  if (!f) return 'funnel';
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
/** La salida del paso de los referentes para quien prefiere elegir el funnel (la «otra opción» del primer paso). */
export const SIN_REFERENTE = 'Prefiero elegir el funnel yo';
/** Su nombre, y el que usa si es otro («Juan Osorio (Juan ADS)»). */
export const nombreDelReferente = (id: IdAsesor): string => {
  const a = asesorPorId(id);
  if (!a) return id;
  return plano(a.completo).includes(plano(a.nombre)) ? a.completo : `${a.completo} (${a.nombre})`;
};

/** Sin tildes y en minúsculas: para reconocer lo que la persona escribe («julian otalora», «sofia»). */
/** Un nombre de funnel adentro de una frase: baja sólo la primera letra, y no la de una marca o una sigla («orgánico en Instagram»,
 *  «anuncios a un VSL con llamada», «YouTube»). Con `toLowerCase()` entero salía «Para orgánico en instagram». */
export function enFrase(nombre: string): string {
  const primera = nombre.split(' ')[0];
  if (/^(Instagram|WhatsApp|TikTok|YouTube|Meta|Google)$/.test(primera) || /[A-ZÁÉÍÓÚÑ]/.test(primera.slice(1))) return nombre;
  return nombre.charAt(0).toLowerCase() + nombre.slice(1);
}

export const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * El referente que nombra un texto: por su nombre completo, el que se usa (Juan ADS) o su apellido si nadie más lo tiene. Gana la
 * coincidencia más larga («Julián Otálora» antes que cualquier «Julián»).
 */
export function referenteDelTexto(texto: string): IdAsesor | null {
  const t = ` ${plano(texto).replace(/[^a-z0-9 ]+/g, ' ')} `;
  const apellidos = new Map<string, number>();
  for (const a of ASESORES) { const ap = plano(a.completo).split(/\s+/).at(-1)!; apellidos.set(ap, (apellidos.get(ap) ?? 0) + 1); }
  let mejor: { id: IdAsesor; largo: number } | null = null;
  for (const a of ASESORES) {
    const ap = plano(a.completo).split(/\s+/).at(-1)!;
    const claves = [plano(a.completo), plano(a.nombre), ...(ap.length >= 5 && apellidos.get(ap) === 1 ? [ap] : [])];
    for (const c of claves) if (t.includes(` ${c} `) && (!mejor || c.length > mejor.largo)) mejor = { id: a.id, largo: c.length };
  }
  return mejor?.id ?? null;
}

/** Las respuestas rápidas del paso. */
export function opcionesDeCopiloto(paso: PasoCopiloto, p: PerfilCopiloto): string[] {
  const f = funnelDe(p);
  switch (paso) {
    case 'entrada': return [...TXT_ENTRADA];
    case 'referente': return [...REFERENTES_COPILOTO.map((r) => nombreDelReferente(r.id)), SIN_REFERENTE];
    case 'funnel': return funnelsOfrecidos(p).map((x) => x.nombre);
    case 'ticket': return TICKETS.map(us);
    case 'presupuesto': return [NADA, ...PRESUPUESTOS.map((n) => `${us(n)} al mes`)];
    case 'llamadas': return ['Yo', 'Un equipo', 'Nadie todavía'];
    case 'ajuste': {
      const v = avisoPendiente(completar(p));
      return v?.mejor ? [`Sí, ${enFrase(funnelPorId(v.mejor.funnel)!.nombre)}`, 'Sigo con el mío'] : [];
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
    case 'funnel': {
      const ref = p.entrada === 'referente' && p.referente ? asesorPorId(p.referente) : null;
      const q = ref ? queEnsena(ref.id) : null;
      if (ref && q?.funnels.length) return `${ref.completo} enseña ${q.tema}. ¿Cuál de sus estrategias armamos?`;
      if (ref && q) return `${ref.completo} enseña ${q.tema}. No es un funnel para conseguir clientes, así que lo uso para esa parte. ¿Con qué funnel los conseguimos?`;
      return '¿Qué funnel quieres armar? Si no lo sabes, elige cualquiera: te aviso si no te conviene.';
    }
    case 'ticket': return f ? `Para ${enFrase(f.nombre)}: ¿cuánto te deja una venta, en dólares?` : '¿Cuánto te deja una venta, en dólares?';
    case 'presupuesto': return '¿Cuánto puedes poner en anuncios por mes? Es lo que puedes perder sin quedar afuera, no lo que te gustaría.';
    case 'llamadas': return '¿Quién toma las llamadas o contesta los mensajes de quien se interesa?';
    case 'ajuste': {
      const v = avisoPendiente(completar(p));
      const alt = v?.mejor ? funnelPorId(v.mejor.funnel) : null;
      return v && alt ? `${v.motivo} Con lo que me cuentas, propongo ${enFrase(alt.nombre)}. ${v.mejor!.porque}` : '¿Seguimos?';
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

export function respuestaDeCopiloto(paso: PasoCopiloto, p: PerfilCopiloto): string | null {
  switch (paso) {
    case 'entrada': return p.entrada === 'funnel' ? TXT_ENTRADA[0] : p.entrada === 'referente' ? TXT_ENTRADA[1] : null;
    // Lo que eligió en su momento: si después aceptó el funnel que propuso MaKo, el original queda en `antesDelAjuste`.
    case 'referente': { const id = p.ajuste === 'cambio' && p.antesDelAjuste ? p.antesDelAjuste.referente : p.referente; return id ? nombreDelReferente(id) : null; }
    case 'funnel': return funnelPorId(p.ajuste === 'cambio' && p.antesDelAjuste ? p.antesDelAjuste.funnel : p.funnel)?.nombre ?? null;
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
      const id = referenteDelTexto(t);
      if (id) return { referente: id };
      if (/funnel|sin referente|ninguno|prefiero elegir|elijo yo/.test(plano(t))) return { entrada: 'funnel' };
      return null;
    }
    case 'funnel': {
      // Sólo lo que se ofrece: con un referente, sus estrategias (lo demás lo explica `interpretarEscrito`, «no lo enseña»).
      const f = funnelDelTexto(t);
      return f && funnelsOfrecidos(p).some((x) => x.id === f) ? { funnel: f } : null;
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
        // El referente se queda si también enseña el funnel nuevo; lo de antes se guarda para poder volver.
        const antes = { ...(p.funnel ? { funnel: p.funnel } : {}), ...(p.referente ? { referente: p.referente } : {}) };
        return { funnel: v.mejor.funnel, referente: ensenaElFunnel(p.referente, v.mejor.funnel) ? p.referente : undefined, ajuste: 'cambio', antesDelAjuste: antes };
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
      if (/^s[ií](?![a-záéíóúñ])|investig/.test(l)) return { competencia: 'si' };
      if (/adelante|luego|despu|^no\b|todav[ií]a no|ahora no/.test(l)) return { competencia: 'luego' };
      return null;
    case 'propuesta': {
      // Aceptar termina la charla y guarda: sólo con un sí claro, sin un «no» en la frase («No sé si me sirve» va a MaKo).
      const pl = plano(t).replace(/[¡!¿?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!/\bno\b|\bnada\b/.test(pl) && /^(si\b|ok\b|okay\b|dale\b|perfecto\b|listo\b|de acuerdo\b|me sirve\b|empecemos\b|vamos\b|acepto\b)/.test(pl)) return { aceptado: true };
      if (/cambi\w* (el )?funnel|otro funnel/.test(pl)) return { funnel: undefined, referente: undefined, entrada: undefined, ajuste: undefined, antesDelAjuste: undefined, ticket: undefined, presupuestoMes: undefined, llamadas: undefined, objetivo: undefined, ritmo: undefined, formato: undefined, competencia: undefined };
      if (/cambi\w* (los )?numeros|otros numeros/.test(pl)) return { ticket: undefined, presupuestoMes: undefined, llamadas: undefined, ajuste: undefined, antesDelAjuste: undefined };
      return null;
    }
    default: return null;
  }
}

/** Aplica un cambio al perfil (las claves en `undefined` se borran). */
export function aplicarCambio(p: PerfilCopiloto, cambio: Partial<PerfilCopiloto>): PerfilCopiloto {
  const sig: PerfilCopiloto = { ...p, ...cambio };
  for (const [k, v] of Object.entries(cambio)) if (v === undefined) delete (sig as Record<string, unknown>)[k];
  return sig;
}

// ── Lo que se escribe: volver atrás, empezar de nuevo y lo que un referente no enseña (sin IA) ──
// Martín, 6/11/2026: «le dije "Volvamos a empezar" porque seleccioné por error a un influencer y quería la otra opción y no funcionó».
// Lo escrito se lee en este orden: un pedido de volver o de empezar de nuevo (antes que la respuesta, porque «no era eso» lleva un
// «no» que el paso de la competencia tomaría por «más adelante»), la respuesta del paso, un «cambiar» suelto, un funnel que el
// referente elegido no enseña, y recién lo que queda va a MaKo (el chat de la charla, con la IA del negocio).

/** El funnel que nombra un texto, si nombra uno solo. */
export function funnelDelTexto(texto: string): IdFunnel | null {
  const l = plano(texto);
  const exacto = FUNNELS.find((x) => plano(x.nombre) === l || plano(x.corto) === l);
  if (exacto) return exacto.id;
  const PISTAS: Array<[IdFunnel, RegExp]> = [
    ['vsl-llamada', /\bvsl\b|video de venta/], ['formulario', /formulario/], ['carrito', /carrito|compra directa|checkout/],
    ['webinar', /webinar|clase en vivo|masterclass/], ['lead-magnet', /lead ?magnet|regalo/], ['youtube', /youtube/],
    ['email', /\be-?mails?\b|\bcorreos?\b|newsletter|mi lista/],
    ['organico', /organico|instagram|\breels?\b|stories|historias|carrusel/], ['mensajes', /anuncios? a mensajes|whatsapp|\bmensajes\b/],
  ];
  const nombrados = [...new Set(PISTAS.filter(([, re]) => re.test(l)).map(([id]) => id))];
  return nombrados.length === 1 ? nombrados[0] : null;
}

export type ComandoCopiloto = 'volver' | 'empezar';

/**
 * ¿Pide volver atrás o empezar de nuevo? `fuerte` = lo que se dice sólo para eso («me equivoqué», «volvamos a empezar», «la otra
 * opción»); se mira ANTES que la respuesta del paso. Un «cambiar» suelto es débil: en el aviso y en la propuesta «cambiar» es una
 * respuesta, así que se mira DESPUÉS.
 */
export function comandoDeCopiloto(texto: string, fuerza: 'fuerte' | 'debil'): ComandoCopiloto | null {
  const l = plano(texto).replace(/[¡!¿?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const corto = l.split(' ').length <= 6;
  if (fuerza === 'fuerte') {
    // «Empezar» sólo con la forma de un PEDIDO (volvamos, empecemos, empezar, arrancamos…), nunca un gerundio ni un presente que
    // cuenta algo del negocio: «estoy empezando de cero en esto» o «3000 y arranco de cero» no borran la charla (revisión, 6/11).
    const verbo = '(volv(amos|er|emos)|vuelvo|empec(emos|e)|empez(ar|amos)|arranqu(emos|e)|arranc(ar|amos)|comenc(emos|e)|comenz(ar|amos))';
    if (new RegExp(`\\b${verbo} (a empezar|a arrancar|de nuevo|de cero|otra vez|desde (el )?(principio|cero|inicio))\\b`).test(l)
      || /^(quiero |podemos |vamos a )?(reiniciar|resetear|borrar todo|desde (el )?(principio|cero))$/.test(l)
      || (corto && /\breinici(ar|emos|a)\b|\bresete(ar|emos|a)\b|\bborr(a|ar|emos) todo\b/.test(l))) return 'empezar';
    // Una PREGUNTA no pide volver («¿hay otra opción para el ticket?» va a MaKo), salvo que pregunte justo eso («¿podemos volver?»).
    if (esPregunta(texto)) return /^(podemos |puedo |se puede )?(volver|volvamos|volvemos)( atras| para atras| al paso anterior| a la pregunta anterior)?$/.test(l) ? 'volver' : null;
    // «Volver» sólo como pedido de moverse («volver», «volvamos atrás»): «quiero volver a vender como antes» es una charla. Y «la otra
    // opción» en un mensaje corto: «me gusta otra opción de pago para mis clientes» es charla.
    if (/\bme equivoqu\w*|\bme confund\w*|\beleg\w* mal\b|\btoqu\w* mal\b|\bsin querer\b|\bpor error\b|^(no )?(quiero |prefiero )?la otra( opcion)?$|\bno era (eso|esa|ese|asi)\b|^(quiero |podemos |vamos a )?(volver|volvamos|vuelvo)( atras| para atras| a la (pregunta|opcion) anterior| al paso anterior)?$|\bvolv(er|amos|emos) (atras|para atras|a la anterior|al paso anterior|a la pregunta anterior)\b|^atras$|\bir atras\b|\bpaso anterior\b|^deshac\w*$|\bcorreg(ir|i)\b/.test(l)
      || (corto && /\botra opcion\b/.test(l))) return 'volver';
    return null;
  }
  return /^(quiero |prefiero |me gustaria |puedo )?(cambiar|cambiarlo|cambi[aá]lo|cambiarla|cambiar eso|cambiar esto|cambiar la respuesta|otra cosa|eso no)$/.test(l) ? 'volver' : null;
}

/** Los campos que contesta cada paso. Volver a un paso borra los suyos y los de los pasos siguientes. */
const CAMPOS: Record<PasoCopiloto, Array<keyof PerfilCopiloto>> = {
  entrada: ['entrada'], referente: ['referente'], funnel: ['funnel'], ticket: ['ticket'], presupuesto: ['presupuestoMes'], llamadas: ['llamadas'],
  ajuste: ['ajuste', 'antesDelAjuste'], objetivo: ['objetivo'], ritmo: ['ritmo'], formato: ['formato'], competencia: ['competencia'], propuesta: ['aceptado'], listo: [],
};

/** Los pasos que ya contestó, en orden. */
export function pasosRespondidos(p: PerfilCopiloto): PasoCopiloto[] {
  const actual = pasoDeCopiloto(p);
  const out: PasoCopiloto[] = [];
  for (const paso of ORDEN) {
    if (paso === actual) break;
    if (respuestaDeCopiloto(paso, p) != null) out.push(paso);
  }
  return out;
}

/** Vuelve al último paso contestado: lo deja sin contestar (y todo lo que vino después). null = no hay nada antes. */
export function volverUnPaso(p: PerfilCopiloto): { perfil: PerfilCopiloto; paso: PasoCopiloto } | null {
  const ultimo = pasosRespondidos(p).at(-1);
  if (!ultimo) return null;
  const sig: PerfilCopiloto = { ...p };
  for (const k of ORDEN.slice(ORDEN.indexOf(ultimo)).flatMap((x) => CAMPOS[x])) delete (sig as Record<string, unknown>)[k];
  // Volver del «Sí, cambiemos» devuelve lo que había elegido: si no, el funnel propuesto quedaba como si lo hubiera elegido.
  if (ultimo === 'ajuste' && p.ajuste === 'cambio' && p.antesDelAjuste) {
    delete sig.funnel; delete sig.referente;
    if (p.antesDelAjuste.funnel) sig.funnel = p.antesDelAjuste.funnel;
    if (p.antesDelAjuste.referente) sig.referente = p.antesDelAjuste.referente;
  }
  return { perfil: sig, paso: ultimo };
}

/** Lo que un referente no enseña: quién sí, para ofrecerlo (sin IA). */
export type FueraDelReferente = { referente: IdAsesor; funnel: IdFunnel; quienes: IdAsesor[] };

/** Lo que MaKo dice al volver por lo escrito, en una línea: sin eso, lo escrito queda debajo de la pregunta de antes y no se sabe si se
 *  entendió. Si con lo escrito ya se contestó el paso al que se volvió («quiero la otra opción»), dice qué quedó. */
export function acuseDeVolver(antes: PerfilCopiloto, despues: PerfilCopiloto): string {
  const atras = volverUnPaso(antes)?.paso;
  const quedo = atras && atras !== pasoDeCopiloto(despues) ? respuestaDeCopiloto(atras, despues) : null;
  return quedo ? `Listo, cambiado: ${quedo}.` : 'Volvemos un paso.';
}

export type Interpretado =
  | { tipo: 'respuesta' | 'volver' | 'empezar'; perfil: PerfilCopiloto }
  | { tipo: 'fuera'; fuera: FueraDelReferente }
  | { tipo: 'nada' }
  | { tipo: 'libre' };

/** El funnel nombrado no lo enseña el referente que eligió. */
function fueraDe(p: PerfilCopiloto, texto: string): FueraDelReferente | null {
  if (p.entrada !== 'referente' || !p.referente) return null;
  // Sólo cuando lo PIDE (el nombre del funnel solo, o «quiero…», «mejor…»): «tengo muchos seguidores en instagram, qué hago» es una
  // charla y va a MaKo, que tiene la tabla de quién enseña qué. Una pregunta, también.
  const l = plano(texto).replace(/[¡!¿?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (esPregunta(texto) || !(l.split(' ').length <= 4 || /\b(quiero|prefiero|hagamos|armemos|mejor|elijo|vamos con|usar|usemos|me interesa|vender con|armar)\b/.test(l))) return null;
  const f = funnelDelTexto(texto);
  if (!f || !funnelsDelReferente(p.referente).length || ensenaElFunnel(p.referente, f)) return null;
  return { referente: p.referente, funnel: f, quienes: quienesEnsenan(f, p.referente) };
}

/** ¿Es una pregunta? Con signo, o empezando por una palabra que pregunta. */
export const esPregunta = (t: string): boolean => /\?/.test(t) || /^(que|como|cual|cuales|cuanto|cuanta|cuantos|cuantas|por que|para que|donde|cuando|quien|sirve|conviene|puedo|se puede|es mejor)\b/.test(plano(t).replace(/^[¿¡\s]+/, ''));

/** Lo que la persona escribió en la charla, leído sin IA. `libre` = va a MaKo. */
export function interpretarEscrito(p: PerfilCopiloto, texto: string): Interpretado {
  const t = texto.trim();
  if (!t) return { tipo: 'nada' };
  const fuerte = comandoDeCopiloto(t, 'fuerte');
  if (fuerte === 'empezar') return { tipo: 'empezar', perfil: {} };
  const volver = (): Interpretado => {
    const v = volverUnPaso(p);
    if (!v) return { tipo: 'nada' };
    // Lo que viene con el pedido se lee en el paso al que se volvió: «me equivoqué, son 3.000» corrige el ticket de una.
    const ahora = pasoDeCopiloto(v.perfil);
    let c = leerRespuestaCopiloto(ahora, t, v.perfil);
    // «La otra opción» en un paso de dos: la que no había elegido.
    if (!c && /\botra\b/.test(plano(t))) {
      const ops = opcionesDeCopiloto(ahora, v.perfil);
      const antes = respuestaDeCopiloto(ahora, p);
      const otra = ops.length === 2 && antes ? ops.find((o) => o !== antes) : undefined;
      if (otra) c = leerRespuestaCopiloto(ahora, otra, v.perfil);
    }
    return { tipo: 'volver', perfil: c ? aplicarCambio(v.perfil, c) : v.perfil };
  };
  if (fuerte === 'volver') return volver();
  const paso = pasoDeCopiloto(p);
  // Una PREGUNTA no es una respuesta («¿qué es un webinar?» no elige el webinar): va a MaKo, salvo que sea una pastilla tal cual.
  const esPastilla = opcionesDeCopiloto(paso, p).some((o) => plano(o) === plano(t));
  const c = esPregunta(t) && !esPastilla ? null : leerRespuestaCopiloto(paso, t, p);
  if (c) return { tipo: 'respuesta', perfil: aplicarCambio(p, c) };
  if (comandoDeCopiloto(t, 'debil') === 'volver') return volver();
  const fuera = fueraDe(p, t);
  if (fuera) return { tipo: 'fuera', fuera };
  return { tipo: 'libre' };
}

/** Lo que dice MaKo cuando el referente no enseña lo que se pidió, y lo que ofrece (cada opción con su cambio; null = seguir igual). */
export function textoDeFuera(x: FueraDelReferente): { texto: string; opciones: Array<{ texto: string; cambio: Partial<PerfilCopiloto> | null }> } {
  const ref = asesorPorId(x.referente)!;
  const f = funnelPorId(x.funnel)!;
  const quienes = x.quienes.slice(0, 3);
  const lista = quienes.map(nombreDelReferente);
  const de = lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}` : lista[0];
  const texto = `${ref.completo} no enseña ${enFrase(f.corto)} en «${ref.curso}». ${quienes.length ? `Lo enseña${quienes.length > 1 ? 'n' : ''} ${de}.` : 'Ningún referente de MaKo lo enseña.'}`;
  return {
    texto,
    opciones: [
      // Cambiar de funnel deja atrás el aviso que se había aceptado: si no, la charla seguiría mostrando el funnel de antes del aviso.
      ...quienes.map((id) => ({ texto: `Seguir a ${nombreDelReferente(id)}`, cambio: { entrada: 'referente' as const, referente: id, funnel: x.funnel, ajuste: undefined, antesDelAjuste: undefined } })),
      { texto: `${f.corto} sin referente`, cambio: { entrada: 'funnel' as const, referente: undefined, funnel: x.funnel, ajuste: undefined, antesDelAjuste: undefined } },
      { texto: `Seguir con ${ref.nombre}`, cambio: null },
    ],
  };
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
  email: '/email', chats: '/chats', crm: '/crm', integraciones: '/integraciones',
} as const;

/** Los números con su condición, nunca como promesa. */
function numerosDeAnuncios(f: IdFunnel, presupuestoMes: number): string[] {
  if (presupuestoMes <= 0) return [];
  const dia = Math.round(presupuestoMes / 30);
  const out = [`${us(presupuestoMes)} al mes son unos ${us(dia)} por día.`];
  if (f === 'vsl-llamada' || f === 'formulario' || f === 'mensajes') {
    out.push(`Como referencia conservadora, una agenda cuesta entre ${us(100)} y ${us(300)}; con tu presupuesto serían entre ${Math.floor(presupuestoMes / 300)} y ${Math.floor(presupuestoMes / 100)} agendas al mes. El tuyo puede ser otro, y se mide por llamada calificada, no por contacto.`);
  }
  if (dia < 50 && f === 'vsl-llamada') out.push('Con menos de US$50 por día un VSL con llamada tarda en aprender.');
  return out;
}

export function propuestaDe(p: PerfilCopiloto): Propuesta | null {
  const f = funnelElegido(p);
  if (!f) return null;
  const R = RUTAS_COPILOTO;
  // «Inspirado en» sólo si el referente enseña ESTE funnel (medido en su curso: ./copiloto-referentes.ts).
  const ref = ensenaElFunnel(p.referente, f.id) ? asesorPorId(p.referente) : null;
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
    case 'email':
      puntos = [
        p.lista != null ? `Tu lista: ${p.lista} contactos. Si hace meses que no les escribes, el primer correo es para reconectar, no para vender.` : 'El primer correo a una lista dormida reconecta, no vende: una pregunta que inviten a contestar.',
        'Una secuencia corta (valor, un caso real, la oferta con una fecha de cierre real) y después un correo por semana.',
        'Se mide por respuestas y ventas por envío, no por aperturas.',
      ];
      pasos = [...investigar, { texto: 'Escribir el correo para reconectar', href: R.copywriter }, { texto: 'Armar la secuencia', href: R.email }, { texto: 'Mandarlo en tandas, no todo de una vez', href: R.email }];
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

export type SeccionCopiloto = 'hoy' | 'plan' | 'campanas' | 'biblioteca' | 'semana' | 'medir';

/**
 * ¿La pantalla muestra Campañas? Sólo si el funnel lleva anuncios: los cuatro de anuncios, siempre; el webinar y los lead magnets
 * sólo si el negocio puso plata (puedes difundirlos sin pagar); YouTube y orgánico, nunca. Quien no eligió funnel (un negocio de
 * antes de la primera entrada) conserva lo de siempre.
 */
export function conCampanas(funnel: IdFunnel | null | undefined, presupuestoMes?: number | null): boolean {
  const f = funnelPorId(funnel);
  if (!f) return true;
  return f.anuncios === 'si' || (f.anuncios === 'opcional' && (presupuestoMes ?? 0) > 0);
}

/**
 * Las secciones de la pantalla. Con anuncios: Hoy (lo que hizo el Media Buyer), Plan, Campañas y Biblioteca. Sin anuncios no hay
 * cuenta que mirar: Esta semana (qué hacer y dónde), Plan y Qué medir. «Campañas» en un funnel orgánico no tiene sentido (Martín, 6/11).
 */
export function seccionesDe(funnel: IdFunnel | null | undefined, presupuestoMes?: number | null): SeccionCopiloto[] {
  if (!funnelPorId(funnel)) return ['hoy', 'campanas', 'biblioteca'];
  return conCampanas(funnel, presupuestoMes) ? ['hoy', 'plan', 'campanas', 'biblioteca'] : ['semana', 'plan', 'medir'];
}

/**
 * Las secciones del TELÉFONO con un funnel de anuncios (app/m/ads/MediaBuyerM.tsx): Hoy y, si el negocio eligió su funnel en la
 * primera entrada, su Plan. Campañas y Biblioteca quedan en la computadora (no entran en una columna). Sin funnel elegido (un negocio
 * de antes) o con la charla sin terminar, sólo Hoy: no hay plan que mostrar. Sin anuncios el teléfono dibuja otra pantalla
 * (app/m/ads/page.tsx → SinAnuncios), así que esto no se pregunta ahí.
 */
export function seccionesDelTelefono(p: PerfilCopiloto | null | undefined): Array<'hoy' | 'plan'> {
  if (!p || !copilotoListo(p)) return ['hoy'];
  const f = funnelElegido(p);
  return f && seccionesDe(f.id, p.presupuestoMes).includes('plan') && conCampanas(f.id, p.presupuestoMes) ? ['hoy', 'plan'] : ['hoy'];
}

export type Tarea = { titulo: string; detalle: string; accion: string; href: string };

/** Qué hacer ESTA semana y dónde se hace (las pantallas de MaKo que ya existen: se enlazan, no se rehacen). */
export function tareasDeLaSemana(p: PerfilCopiloto): Tarea[] {
  const f = funnelElegido(p);
  const R = RUTAS_COPILOTO;
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  switch (f?.id) {
    case 'organico': {
      const { reparto } = planOrganico(p);
      const t: Tarea[] = [];
      if (reparto.reels > 0) t.push({ titulo: plural(reparto.reels, 'reel', 'reels'), detalle: p.objetivo === 'ventas' ? 'Cada uno termina invitando a escribirte.' : 'Un gancho en los primeros segundos y un solo tema.', accion: 'Escribir los guiones', href: R.copywriter });
      if (reparto.carruseles > 0) t.push({ titulo: plural(reparto.carruseles, 'carrusel', 'carruseles'), detalle: 'Un tema que enseñe algo y un cierre que invite a escribirte.', accion: 'Hacer los carruseles', href: R.carruseles });
      if (reparto.stories > 0) t.push({ titulo: 'Stories casi todos los días', detalle: 'Para quien ya te sigue: preguntas, respuestas, un detrás de escena.', accion: 'Escribir las ideas', href: R.copywriter });
      t.push({ titulo: 'Programar la semana', detalle: 'Lo que está programado se publica aunque tengas un mal día.', accion: 'Abrir el Calendario', href: R.calendario });
      return t;
    }
    case 'youtube': {
      const n = p.ritmo ?? 1;
      return [
        { titulo: plural(n, 'video', 'videos'), detalle: p.formato === 'shorts' ? 'Cortos, con un gancho en el primer segundo.' : 'Un tema que educa y un solo próximo paso al final.', accion: 'Escribir el guion', href: R.copywriter },
        { titulo: 'Un próximo paso en cada video', detalle: 'Tu regalo o tu agenda: sin eso, los videos no llegan a venta.', accion: 'Crear el regalo', href: R.leadMagnets },
        { titulo: 'Programar la semana', detalle: 'La constancia pesa más que cada video.', accion: 'Abrir el Calendario', href: R.calendario },
      ];
    }
    case 'webinar':
      return [
        { titulo: 'La página de registro', detalle: 'Una promesa clara, la fecha y un solo botón.', accion: 'Armar la página', href: R.web },
        { titulo: 'Los correos', detalle: 'Recordatorios con valor, no sólo la hora.', accion: 'Escribirlos', href: R.copywriter },
        { titulo: 'La fecha en vivo', detalle: 'Ponla en tu agenda y en la de quien llama.', accion: 'Abrir el Calendario', href: R.calendario },
      ];
    case 'lead-magnet':
      return [
        { titulo: 'El regalo', detalle: 'Algo que resuelva un problema chico y lleve al servicio grande.', accion: 'Crearlo', href: R.leadMagnets },
        { titulo: 'La página donde se pide', detalle: 'Una promesa, una imagen y el formulario.', accion: 'Armar la página', href: R.web },
        { titulo: 'La secuencia de correos', detalle: 'Tres o cuatro mensajes que terminan en una conversación.', accion: 'Escribirla', href: R.copywriter },
      ];
    case 'email':
      return [
        { titulo: 'El correo para reconectar', detalle: 'Corto, sin vender: una pregunta que inviten a contestar.', accion: 'Escribirlo', href: R.copywriter },
        { titulo: 'La secuencia', detalle: 'Valor, un caso real y la oferta con una fecha de cierre real.', accion: 'Armarla', href: R.email },
        { titulo: 'Contestar a quien responde', detalle: 'Quien contesta es el lead más caliente que tienes: se le escribe uno por uno.', accion: 'Abrir Chats', href: R.chats },
      ];
    default: return [];
  }
}

export type Medida = { nombre: string; que: string; contexto?: string };

/** Qué medir según el funnel, y qué número manda. Las cifras son de referencia (de otros negocios, sin auditar), nunca una meta. */
export function medirDe(funnel: IdFunnel | null | undefined, p: Pick<PerfilCopiloto, 'objetivo'> = {}): { manda: string; medidas: Medida[] } {
  switch (funnel) {
    case 'organico':
      return p.objetivo === 'viralidad'
        ? { manda: 'Gente nueva que te ve y te sigue.', medidas: [
          { nombre: 'Alcance a no seguidores', que: 'cuánta gente nueva vio cada reel' },
          { nombre: 'Retención', que: 'cuántos llegan al final: si caen al principio, el gancho no funciona' },
          { nombre: 'Compartidos y guardados', que: 'lo que la gente reenvía vale más que un me gusta' },
          { nombre: 'Seguidores nuevos por semana', que: 'el resultado de la viralidad' }] }
        : { manda: 'Conversaciones calificadas por semana: gente que te escribe interesada en lo que vendes.', medidas: [
          { nombre: 'Mensajes directos', que: 'cuántos te escriben tras una pieza, y de cuál' },
          { nombre: 'Llamadas agendadas desde Instagram', que: 'las ventas se cierran afuera de la publicación' },
          { nombre: 'Guardados y compartidos', que: 'señal de que la pieza sirvió' },
          { nombre: 'Alcance', que: 'sirve de contexto, no de meta: mucho alcance sin mensajes no vende' }] };
    case 'youtube':
      return { manda: 'Gente que ve tus videos y da el siguiente paso (tu regalo o tu agenda).', medidas: [
        { nombre: 'Retención de audiencia', que: 'dónde se va la gente en cada video' },
        { nombre: 'Clics a tu regalo o tu agenda', que: 'el próximo paso de cada video' },
        { nombre: 'Suscriptores nuevos', que: 'se miden por mes: YouTube tarda en dar frutos' },
        { nombre: 'Clic en la miniatura', que: 'si el título y la imagen prometen lo que el video cumple' }] };
    case 'lead-magnet':
      return { manda: 'Contactos que terminan en una conversación o una llamada, no contactos a secas.', medidas: [
        { nombre: 'Registro en la página del regalo', que: 'cuántos de los que llegan lo piden' },
        { nombre: 'Apertura y clic de la secuencia', que: 'si lo siguen leyendo' },
        { nombre: 'Agendas desde la secuencia', que: 'el paso que importa' },
        { nombre: 'Fuente de cada contacto', que: 'de dónde vienen, en el CRM' }] };
    case 'email':
      return { manda: 'Ventas (o conversaciones) por cada envío, no aperturas.', medidas: [
        { nombre: 'Respuestas', que: 'quién contesta: es tu lead más caliente' },
        { nombre: 'Clics a la oferta', que: 'si el correo lleva a algún lado' },
        { nombre: 'Bajas y rebotes', que: 'si suben mucho, la lista está fría o el ritmo es alto' },
        { nombre: 'Ventas por envío', que: 'lo que importa; las aperturas sólo dan contexto' }] };
    case 'webinar':
      return { manda: 'Agendas con llamada tras el webinar.', medidas: [
        { nombre: 'Registro', que: 'visitas que se anotan', contexto: 'referencia de un practicante: 20 a 50%' },
        { nombre: 'Asistencia en vivo', que: 'de los registrados, cuántos llegan', contexto: 'referencia: alrededor de 30%' },
        { nombre: 'Agenda', que: 'de los que ven, cuántos piden llamada', contexto: 'referencia: alrededor de 30%' },
        { nombre: 'Cierre', que: 'de las llamadas, cuántas compran', contexto: 'referencia: 35% o más; son cifras de otros negocios, no una meta' }] };
    default:
      return { manda: 'El costo por llamada calificada, no por lead ni por clic.', medidas: [
        { nombre: 'Costo por llamada calificada', que: 'el número que manda' },
        { nombre: 'Asistencia a la llamada', que: 'si no llegan, falta educar entre la agenda y la llamada' },
        { nombre: 'Cierre por persona que llama', que: 'si está bajo, entra gente equivocada o falta educar' },
        { nombre: 'Costo por lead', que: 'sólo de contexto: abaratarlo suele traer a los peores' }] };
  }
}

/** Lo que llega del navegador, con su forma: lo demás se descarta. */
export function sanearPerfil(x: unknown): PerfilCopiloto {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const n = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : undefined);
  const out: PerfilCopiloto = {};
  if (o.entrada === 'funnel' || o.entrada === 'referente') out.entrada = o.entrada;
  if (asesorPorId(o.referente)) out.referente = o.referente as IdAsesor;
  if (funnelPorId(o.funnel)) out.funnel = o.funnel as IdFunnel;
  const pm = n(o.presupuestoMes, 0, 1e8); if (pm !== undefined) out.presupuestoMes = pm;
  const tk = n(o.ticket, 0.01, 1e8); if (tk !== undefined) out.ticket = tk;
  if (o.llamadas === 'yo' || o.llamadas === 'equipo' || o.llamadas === 'nadie') out.llamadas = o.llamadas;
  if (o.ajuste === 'cambio' || o.ajuste === 'sigo') out.ajuste = o.ajuste;
  if (o.antesDelAjuste && typeof o.antesDelAjuste === 'object' && !Array.isArray(o.antesDelAjuste)) {
    const a = o.antesDelAjuste as Record<string, unknown>;
    const antes = { ...(funnelPorId(a.funnel) ? { funnel: a.funnel as IdFunnel } : {}), ...(asesorPorId(a.referente) ? { referente: a.referente as IdAsesor } : {}) };
    if (Object.keys(antes).length) out.antesDelAjuste = antes;
  }
  if (o.objetivo === 'viralidad' || o.objetivo === 'ventas' || o.objetivo === 'mixto') out.objetivo = o.objetivo;
  const rt = n(o.ritmo, 1, 21); if (rt !== undefined) out.ritmo = Math.round(rt);
  if (typeof o.formato === 'string' && ['reels', 'stories', 'carruseles', 'mezcla', 'largos', 'shorts'].includes(o.formato)) out.formato = o.formato as FormatoOrganico;
  if (o.competencia === 'si' || o.competencia === 'luego') out.competencia = o.competencia;
  if (o.aceptado === true) out.aceptado = true;
  if (typeof o.vende === 'string' && o.vende in TIPOS_DE_NEGOCIO) out.vende = o.vende as TipoDeNegocio;
  const meta = n(o.meta, 1, 1e6); if (meta !== undefined) out.meta = Math.round(meta);
  const vm = n(o.ventasMes, 0, 1e6); if (vm !== undefined) out.ventasMes = Math.round(vm);
  if (o.casos === 'si' || o.casos === 'no') out.casos = o.casos;
  if (typeof o.pais === 'string' && o.pais.trim()) out.pais = o.pais.trim().replace(/\s+/g, ' ').slice(0, 40);
  const mg = n(o.margen, 1, 95); if (mg !== undefined) out.margen = Math.round(mg);
  const li = n(o.lista, 0, 1e8); if (li !== undefined) out.lista = Math.round(li);
  const hs = n(o.horas, 0, 80); if (hs !== undefined) out.horas = hs;
  return out;
}

// ── Lo que MaKo sabe y lo que le falta (9/11/2026) ───────────────────────────
// UNA pieza para el agente (lo que viaja en su system: «LO QUE YA SABES / LO QUE TE FALTA») y para el panel de la tab (las fichas de
// arriba). Si el agente y la pantalla lo calcularan cada uno, uno diría «falta la meta» y el otro no.

export type ClaveDato = 'vende' | 'ticket' | 'margen' | 'ventasMes' | 'meta' | 'presupuestoMes' | 'llamadas' | 'casos' | 'lista' | 'horas' | 'pais';
export type DatoSabido = { clave: ClaveDato; etiqueta: string; valor: string };
export type DatoFaltante = { clave: ClaveDato; etiqueta: string; pregunta: string; opciones: string[]; imprescindible: boolean };

const ETIQUETAS: Readonly<Record<ClaveDato, string>> = {
  vende: 'Vendes', ticket: 'Cada venta', margen: 'Margen', ventasMes: 'Hoy', meta: 'Meta', presupuestoMes: 'Anuncios', llamadas: 'Quién vende',
  casos: 'Casos', lista: 'Lista de email', horas: 'Contenido', pais: 'País',
};

/** Las preguntas, con respuestas rápidas que el panel y el agente usan igual. La respuesta se lee con `leerDato`. */
export const PREGUNTAS_DE_DATO: Readonly<Record<ClaveDato, { pregunta: string; opciones: string[] }>> = {
  vende: { pregunta: '¿Qué vendes?', opciones: Object.values(TIPOS_DE_NEGOCIO) },
  ticket: { pregunta: '¿Cuánto te deja una venta, en dólares?', opciones: TICKETS.map((x) => us(x)) },
  margen: { pregunta: '¿Qué parte de cada venta te queda después del costo del producto y el envío?', opciones: ['20%', '40%', '60%', '80%'] },
  ventasMes: { pregunta: '¿Cuántas ventas haces hoy por mes, más o menos?', opciones: ['Ninguna todavía', '1 a 5', '6 a 20', 'Más de 20'] },
  meta: { pregunta: '¿Cuántos clientes quieres por mes?', opciones: ['5', '10', '20', '50'] },
  presupuestoMes: { pregunta: '¿Cuánto puedes poner en anuncios por mes, sin quedar afuera si sale mal?', opciones: ['Nada por ahora', 'US$300', 'US$600', 'US$1.000', 'US$2.000'] },
  llamadas: { pregunta: '¿Quién atiende a quien se interesa (llamadas o mensajes)?', opciones: ['Yo', 'Un equipo', 'Nadie todavía'] },
  casos: { pregunta: '¿Tienes casos reales de clientes que puedas mostrar?', opciones: ['Sí', 'Todavía no'] },
  lista: { pregunta: '¿Tienes una lista de email? ¿De cuántos contactos?', opciones: ['No tengo', 'Menos de 500', '500 a 3.000', 'Más de 3.000'] },
  horas: { pregunta: '¿Cuántas horas por semana puedes dedicarle al contenido?', opciones: ['1 a 2', '3 a 5', '6 a 10', 'Más de 10'] },
  pais: { pregunta: '¿En qué país vendes?', opciones: ['Argentina', 'México', 'Colombia', 'Chile', 'España', 'Otro'] },
};

const valorDe = (p: PerfilCopiloto, k: ClaveDato): string | null => {
  switch (k) {
    case 'vende': return p.vende ? TIPOS_DE_NEGOCIO[p.vende] : null;
    case 'ticket': return p.ticket != null ? us(p.ticket) : null;
    case 'margen': return p.margen != null ? `${p.margen}%` : null;
    case 'ventasMes': return p.ventasMes != null ? `${p.ventasMes} por mes` : null;
    case 'meta': return p.meta != null ? `${p.meta} por mes` : null;
    case 'presupuestoMes': return p.presupuestoMes != null ? (p.presupuestoMes > 0 ? `${us(p.presupuestoMes)} al mes` : 'Sin anuncios') : null;
    case 'llamadas': return p.llamadas ? { yo: 'Tú', equipo: 'Un equipo', nadie: 'Nadie todavía' }[p.llamadas] : null;
    case 'casos': return p.casos ? (p.casos === 'si' ? 'Sí, reales' : 'Todavía no') : null;
    case 'lista': return p.lista != null ? (p.lista > 0 ? `${p.lista} contactos` : 'No tiene') : null;
    case 'horas': return p.horas != null ? `${p.horas} h por semana` : null;
    case 'pais': return p.pais ?? null;
  }
};

/**
 * Qué se sabe y qué falta, en el orden en que conviene preguntarlo. Lo IMPRESCINDIBLE para recomendar un funnel: qué vende, cuánto le
 * deja una venta (en una tienda, también el margen), cuánto vende hoy, cuánto quiere, cuánto puede poner en anuncios y quién atiende.
 * El resto depende del funnel: los casos para un VSL o un webinar, la lista para el email, las horas para el contenido, el país para
 * cualquier cifra de anuncios. Con un funnel sin anuncios no se pide el presupuesto; sin llamadas, no se pregunta quién llama.
 */
export function fichaDelNegocio(p: PerfilCopiloto): { sabe: DatoSabido[]; falta: DatoFaltante[] } {
  const f = funnelDe(p);
  const tienda = p.vende === 'tienda';
  const imprescindibles: ClaveDato[] = ['vende', 'ticket', ...(tienda ? ['margen' as const] : []), 'ventasMes', 'meta',
    ...(!f || usaAnuncios(f) ? ['presupuestoMes' as const] : []), ...(!tienda && (!f || usaLlamadas(f) || f === 'lead-magnet') ? ['llamadas' as const] : [])];
  const segun: ClaveDato[] = [
    ...(f === 'vsl-llamada' || f === 'webinar' || f === 'mensajes' || f === 'formulario' ? ['casos' as const] : []),
    ...(f === 'email' || f === 'lead-magnet' ? ['lista' as const] : []),
    ...(f === 'organico' || f === 'youtube' ? ['horas' as const] : []),
    ...(!f || usaAnuncios(f) ? ['pais' as const] : []),
  ];
  const todas: ClaveDato[] = [...imprescindibles, ...segun.filter((k) => !imprescindibles.includes(k))];
  // Lo sabido se muestra aunque el funnel ya no lo pida (lo dijo la persona: no se esconde).
  const conValor = (Object.keys(ETIQUETAS) as ClaveDato[]).filter((k) => valorDe(p, k) != null);
  const sabe = [...todas.filter((k) => conValor.includes(k)), ...conValor.filter((k) => !todas.includes(k))]
    .map((k) => ({ clave: k, etiqueta: ETIQUETAS[k], valor: valorDe(p, k)! }));
  const falta = todas.filter((k) => valorDe(p, k) == null)
    .map((k) => ({ clave: k, etiqueta: ETIQUETAS[k], ...PREGUNTAS_DE_DATO[k], imprescindible: imprescindibles.includes(k) }));
  return { sabe, falta };
}

/** Lee la respuesta a una pregunta de `PREGUNTAS_DE_DATO` (la pastilla tal cual o un número escrito). null = no se entendió. */
export function leerDato(k: ClaveDato, texto: string): Partial<PerfilCopiloto> | null {
  const l = plano(texto);
  // El lector de montos de la casa (./monto.ts: «1.500», «1,500», «US$600»), más el «3 mil» / «3k» de un chat.
  const base = montoDelTexto(l);
  const num = base == null ? null : /\d\s*(k|mil)\b/.test(l) ? base * 1000 : base;
  switch (k) {
    case 'vende': {
      const t = (Object.entries(TIPOS_DE_NEGOCIO) as Array<[TipoDeNegocio, string]>).find(([, txt]) => plano(txt) === l)?.[0]
        ?? (/tienda|producto|e-?commerce|shop/.test(l) ? 'tienda' : /curso|programa|mentoria|formacion/.test(l) ? 'curso' : /local|inmobiliaria|clinica|restaurante|consultorio/.test(l) ? 'local' : /servicio|consultor|coach|agencia/.test(l) ? 'servicio' : null);
      return t ? { vende: t } : null;
    }
    case 'llamadas': return /^yo\b|^tu\b/.test(l) ? { llamadas: 'yo' } : /equipo/.test(l) ? { llamadas: 'equipo' } : /nadie/.test(l) ? { llamadas: 'nadie' } : null;
    case 'casos': return /^s[ií]|tengo/.test(l) && !/no tengo|todavia no/.test(l) ? { casos: 'si' } : /no/.test(l) ? { casos: 'no' } : null;
    case 'pais': return l && l !== 'otro' ? { pais: texto.trim() } : null;
    case 'ventasMes': return /ninguna/.test(l) ? { ventasMes: 0 } : /1 a 5/.test(l) ? { ventasMes: 3 } : /6 a 20/.test(l) ? { ventasMes: 12 } : /mas de 20/.test(l) ? { ventasMes: 25 } : num != null ? { ventasMes: num } : null;
    case 'lista': return /no tengo/.test(l) ? { lista: 0 } : /menos de 500/.test(l) ? { lista: 300 } : /500 a 3/.test(l) ? { lista: 1500 } : /mas de 3/.test(l) ? { lista: 4000 } : num != null ? { lista: num } : null;
    case 'horas': return /1 a 2/.test(l) ? { horas: 2 } : /3 a 5/.test(l) ? { horas: 4 } : /6 a 10/.test(l) ? { horas: 8 } : /mas de 10/.test(l) ? { horas: 12 } : num != null ? { horas: num } : null;
    case 'presupuestoMes': return /nada|cero|sin/.test(l) ? { presupuestoMes: 0 } : num != null ? { presupuestoMes: num } : null;
    case 'margen': return num != null && num > 0 && num < 100 ? { margen: num } : null;
    case 'ticket': return num != null && num > 0 ? { ticket: num } : null;
    case 'meta': return num != null && num > 0 ? { meta: num } : null;
  }
}

// ── El recorrido del cliente, la cuenta y la comparación (el panel de la tab y el agente leen lo mismo) ─────────────

export type Etapa = { id: 'atraer' | 'captar' | 'convencer' | 'cerrar'; titulo: string; que: string; accion?: { texto: string; href: string } };

/** Las cuatro etapas del funnel elegido, en palabras del negocio: por dónde llega la gente, dónde levanta la mano, qué la convence, dónde paga. */
export function recorridoDe(p: PerfilCopiloto): Etapa[] {
  const f = funnelDe(p);
  const R = RUTAS_COPILOTO;
  if (!f) return [];
  const dia = p.presupuestoMes ? Math.round(p.presupuestoMes / 30) : 0;
  const anuncio = dia ? `Anuncios en Meta (unos ${us(dia)} por día)` : 'Anuncios en Meta';
  const conCasos = p.casos === 'si' ? 'tus casos reales' : 'casos reales (cuando los tengas: nunca se inventan)';
  const quien = p.llamadas === 'equipo' ? 'tu equipo' : 'tú';
  switch (f) {
    case 'vsl-llamada': return [
      { id: 'atraer', titulo: 'Atraer', que: `${anuncio} que filtran desde el texto.`, accion: { texto: 'Escribir los anuncios', href: R.copywriter } },
      { id: 'captar', titulo: 'Agendar', que: 'Página con el video de venta y la agenda en el mismo paso.', accion: { texto: 'Armar la página', href: R.web } },
      { id: 'convencer', titulo: 'Preparar', que: `Confirmación con un video corto y ${conCasos} antes de la llamada.`, accion: { texto: 'Escribir los correos', href: R.copywriter } },
      { id: 'cerrar', titulo: 'Cerrar', que: `Llamada de venta con ${quien}.`, accion: { texto: 'Ver el CRM', href: R.crm } }];
    case 'mensajes': return [
      { id: 'atraer', titulo: 'Atraer', que: `${anuncio} que abren una conversación.`, accion: { texto: 'Escribir los anuncios', href: R.copywriter } },
      { id: 'captar', titulo: 'Conversar', que: 'WhatsApp o Instagram con un mensaje ya escrito. Responder rápido es la regla.', accion: { texto: 'Abrir Chats', href: R.chats } },
      { id: 'convencer', titulo: 'Convencer', que: `En la charla, ${conCasos} y una pregunta que filtre.` },
      { id: 'cerrar', titulo: 'Cobrar', que: p.ticket != null && p.ticket <= UMBRALES.ticketCarrito ? 'Link de pago en la misma charla y un seguimiento a las 24 horas.' : `Llamada corta con ${quien} o link de pago.`, accion: { texto: 'Ver el CRM', href: R.crm } }];
    case 'formulario': return [
      { id: 'atraer', titulo: 'Atraer', que: `${anuncio} con un formulario dentro de Meta.`, accion: { texto: 'Escribir los anuncios', href: R.copywriter } },
      { id: 'captar', titulo: 'Filtrar', que: 'Hasta tres preguntas: que es el lugar, la plata y el tiempo. Teléfono obligatorio.' },
      { id: 'convencer', titulo: 'Contactar', que: 'Llamar o escribir en minutos, no en horas: un lead frío no contesta.', accion: { texto: 'Abrir Chats', href: R.chats } },
      { id: 'cerrar', titulo: 'Cerrar', que: `Llamada o visita con ${quien}.`, accion: { texto: 'Ver el CRM', href: R.crm } }];
    case 'carrito': return [
      { id: 'atraer', titulo: 'Atraer', que: `${anuncio} optimizados a compra, con el producto en uso.`, accion: { texto: 'Crear los anuncios', href: R.video } },
      { id: 'captar', titulo: 'Mostrar', que: 'Página del producto con fotos reales, precio claro y envío.', accion: { texto: 'Armar la página', href: R.web } },
      { id: 'convencer', titulo: 'Recuperar', que: 'Volver a mostrarle el producto a quien miró y no compró.' },
      { id: 'cerrar', titulo: 'Volver a vender', que: p.vende === 'tienda' ? 'Correos de recompra a quien ya compró: vender otra vez cuesta menos que conseguir a alguien nuevo.' : 'Correo a quien compró, con el siguiente paso.', accion: { texto: 'Abrir Email', href: R.email } }];
    case 'webinar': return [
      { id: 'atraer', titulo: 'Atraer', que: dia ? `${anuncio} al registro.` : 'Tu contenido y tu lista, al registro.', accion: { texto: 'Armar el registro', href: R.web } },
      { id: 'captar', titulo: 'Registrar', que: 'Correos y recordatorios con valor, no sólo la hora.', accion: { texto: 'Escribirlos', href: R.copywriter } },
      { id: 'convencer', titulo: 'Enseñar', que: `Una clase de 45 a 60 minutos con ${conCasos} y la oferta al final.` },
      { id: 'cerrar', titulo: 'Cerrar', que: `Llamada con ${quien} para quien levantó la mano.`, accion: { texto: 'Ver el CRM', href: R.crm } }];
    case 'lead-magnet': return [
      { id: 'atraer', titulo: 'Atraer', que: dia ? `${anuncio} al regalo, no a la venta.` : 'Tu contenido, con el regalo como llamado.', accion: { texto: 'Crear el regalo', href: R.leadMagnets } },
      { id: 'captar', titulo: 'Captar', que: 'Una página con una promesa, una imagen y el formulario.', accion: { texto: 'Armar la página', href: R.web } },
      { id: 'convencer', titulo: 'Nutrir', que: 'Tres o cuatro correos que enseñan y terminan en una conversación.', accion: { texto: 'Escribir la secuencia', href: R.email } },
      { id: 'cerrar', titulo: 'Cerrar', que: p.llamadas && p.llamadas !== 'nadie' ? `Conversación o llamada con ${quien}.` : 'Una oferta directa al final de la secuencia.', accion: { texto: 'Ver el CRM', href: R.crm } }];
    case 'email': return [
      { id: 'atraer', titulo: 'Reconectar', que: p.lista ? `Un correo corto a tus ${p.lista} contactos, en tandas, que invite a contestar.` : 'Un correo corto, en tandas, que invite a contestar.', accion: { texto: 'Escribirlo', href: R.copywriter } },
      { id: 'captar', titulo: 'Escuchar', que: 'Quien contesta es tu lead más caliente: se le escribe uno por uno.', accion: { texto: 'Abrir Chats', href: R.chats } },
      { id: 'convencer', titulo: 'Educar', que: `Una secuencia corta: valor, ${conCasos} y la oferta.`, accion: { texto: 'Armar la secuencia', href: R.email } },
      { id: 'cerrar', titulo: 'Cerrar', que: 'La oferta con una fecha de cierre real (una cohorte, un cupo que existe).', accion: { texto: 'Ver el CRM', href: R.crm } }];
    case 'youtube': return [
      { id: 'atraer', titulo: 'Atraer', que: `${p.ritmo ?? 1} video${(p.ritmo ?? 1) > 1 ? 's' : ''} por semana sobre lo que tu cliente ya busca.`, accion: { texto: 'Escribir el guion', href: R.copywriter } },
      { id: 'captar', titulo: 'Captar', que: 'En cada video, un solo próximo paso: tu regalo o tu WhatsApp, en la descripción y al medio.', accion: { texto: 'Crear el regalo', href: R.leadMagnets } },
      { id: 'convencer', titulo: 'Convencer', que: `Videos con ${conCasos}; los cortos llevan al largo.` },
      { id: 'cerrar', titulo: 'Cerrar', que: p.llamadas === 'equipo' ? 'Tu equipo contesta a quien escribe.' : 'Contestas tú a quien escribe.', accion: { texto: 'Abrir Chats', href: R.chats } }];
    case 'organico': {
      const pl = planOrganico(p);
      return [
        { id: 'atraer', titulo: 'Atraer', que: `${pl.reparto.reels} reel${pl.reparto.reels === 1 ? '' : 's'} por semana para gente nueva.`, accion: { texto: 'Escribir los guiones', href: R.copywriter } },
        { id: 'captar', titulo: 'Conectar', que: `${pl.reparto.carruseles} carrusel${pl.reparto.carruseles === 1 ? '' : 'es'} y stories para quien ya te sigue.`, accion: { texto: 'Hacer los carruseles', href: R.carruseles } },
        { id: 'convencer', titulo: 'Conversar', que: 'Cada pieza invita a escribirte (una palabra clave por mensaje directo).', accion: { texto: 'Abrir Chats', href: R.chats } },
        { id: 'cerrar', titulo: 'Cerrar', que: 'La venta se cierra en la conversación, no en la publicación.', accion: { texto: 'Ver el CRM', href: R.crm } }];
    }
  }
}

/**
 * La cuenta, con lo que dijo la persona y sin tasas inventadas: cuánto entra con la meta y cuánto puede costar cada venta con su
 * presupuesto (y en una tienda, cuánto le deja). Es una cuenta, no una promesa: las tasas de cada etapa se miden con sus datos.
 */
export function cuentaDe(p: PerfilCopiloto): { lineas: Array<{ etiqueta: string; valor: string }>; nota: string } | null {
  if (p.meta == null || p.ticket == null) return null;
  const lineas: Array<{ etiqueta: string; valor: string }> = [{ etiqueta: 'Entra por mes', valor: us(p.meta * p.ticket) }];
  const deja = p.margen != null ? (p.ticket * p.margen) / 100 : null;
  if (deja != null) lineas.push({ etiqueta: 'Te deja cada venta', valor: us(deja) });
  if (p.presupuestoMes) {
    lineas.push({ etiqueta: 'Cada venta puede costar hasta', valor: us(p.presupuestoMes / p.meta) });
    if (deja != null && p.presupuestoMes / p.meta > deja) lineas.push({ etiqueta: 'Ojo', valor: 'con esa meta, cada venta cuesta más de lo que te deja' });
  }
  if (p.ventasMes != null) lineas.push({ etiqueta: 'Hoy', valor: `${p.ventasMes} por mes (${p.ventasMes >= p.meta ? 'ya llegas' : `te faltan ${p.meta - p.ventasMes}`})` });
  return { lineas, nota: 'Una cuenta con tus números, no una promesa: cuánto convierte cada paso se mide con tus primeros datos.' };
}

/** Cómo se compara cada funnel para ESTE negocio: si le sirve (las mismas reglas de siempre), qué pide y cuánto tarda. */
export type Comparacion = { funnel: Funnel; sirve: boolean | null; motivo: string | null; pide: string; tarda: string };
const TARDA: Readonly<Record<IdFunnel, string>> = {
  'vsl-llamada': 'semanas, si el presupuesto alcanza', mensajes: 'días a semanas', formulario: 'días a semanas', carrito: 'días a semanas',
  webinar: 'un mes por edición', 'lead-magnet': 'semanas a meses', email: 'días, si la lista existe', youtube: 'meses (de 6 a 24)', organico: 'dos o tres meses',
};
const PIDE: Readonly<Record<IdFunnel, string>> = {
  'vsl-llamada': 'presupuesto, casos y alguien que llame', mensajes: 'presupuesto y responder rápido', formulario: 'presupuesto y llamar en minutos',
  carrito: 'presupuesto y una página que venda', webinar: 'preparar la clase y alguien que cierre', 'lead-magnet': 'un regalo útil y una secuencia',
  email: 'una lista que te conozca', youtube: 'horas por semana y paciencia', organico: 'constancia y horas por semana',
};
export function compararFunnels(p: PerfilCopiloto): Comparacion[] {
  const d = datosDeDecision(p);
  return FUNNELS.map((f) => {
    const v = d ? evaluarFunnel(f.id, d) : null;
    return { funnel: f, sirve: v ? v.sirve : null, motivo: v?.motivo ?? null, pide: PIDE[f.id], tarda: TARDA[f.id] };
  });
}

/** ¿Terminó la primera entrada? */
export const copilotoListo = (p: PerfilCopiloto): boolean => pasoDeCopiloto(p) === 'listo';
