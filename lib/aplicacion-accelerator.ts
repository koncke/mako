// =============================================================================
// LA APLICACIÓN A MAKO ACCELERATOR (16/11/2026): las preguntas, cómo se validan, quién califica y la agenda
// =============================================================================
// Martín, 16/11/2026, con el formulario de Mastery Haus adjunto: «yo no pondría el botón de agendar llamada, sino justamente el
// botón de aplicar ahora. Y ahí pondría justamente un formulario… podemos hacer algo muy similar. El formulario evidentemente
// tiene que funcionar». Y sobre la agenda: «lo del Calendly sí lo podríamos llegar a cambiar… Tal vez incluso agregar más
// preguntas».
//
// EL MOLDE: las seis secciones del de Mastery Haus (datos, negocio, facturación y equipo, situación, diagnóstico y aplicación
// final), pasadas a MaKo: los montos en dólares y con el corte de la landing (US$ 5.000 por mes, «con clientes y oferta
// validada»), la inversión con el precio de verdad (`PROGRAMA_ACELERADOR`: lo que dice la columna de /planes, así no se separan)
// y, al final, las preguntas que pedía la agenda de Martín, con SUS opciones, para que la agenda llegue ya contestada
// (`linkDeLaAgenda`). Lo que se le sumó al de Mastery Haus: cuánto paga un cliente (es un programa para vender high ticket) y
// cómo consigue clientes hoy (con eso se elige el funnel).
//
// DESPUÉS DE APLICAR (el molde «aplica → califica → agenda» de los programas high ticket): quien califica (`califica`) elige su
// horario en la agenda de Martín en el momento, con todo lo que escribió adentro; el resto recibe «la leo personalmente y, si hay
// match, te escribo por WhatsApp». Las dos quedan en el CRM de MaKo y en el correo del equipo (lib/aplicacion-accelerator-servidor.ts).
//
// UN SOLO LUGAR: lo usan el formulario (app/accelerator/aplicar/), que valida cada paso, y la ruta (app/api/accelerator/aplicar/),
// que vuelve a validar TODO: es pública y nunca confía en lo que manda el navegador. Las respuestas de opción viajan como ÍNDICES y
// el servidor guarda el TEXTO de la opción. Sin imports de servidor: este archivo va también al navegador.
// =============================================================================

import { PROGRAMA_ACELERADOR } from './planes-mako';

/** La página del formulario y la ruta que lo recibe. */
export const RUTA_APLICAR = '/accelerator/aplicar';
export const API_APLICAR = '/api/accelerator/aplicar';

/**
 * La agenda de Martín (Calendly, «asesoria», 60 minutos). La misma que `AGENDA_ACELERADOR` (app/planes/Tarjetas.tsx), que la
 * toma de acá.
 */
export const AGENDA_DE_LA_LLAMADA = 'https://calendly.com/koncke/asesoria';

export type TipoCampo = 'texto' | 'email' | 'whatsapp' | 'link' | 'largo' | 'una' | 'varias' | 'confirmo';

export type Campo = {
  id: string;
  /** La pregunta, como la lee quien aplica. */
  rotulo: string;
  tipo: TipoCampo;
  /** La ayuda debajo de la pregunta. */
  ayuda?: string;
  placeholder?: string;
  /** Las opciones de `una` y `varias`, en el orden en que se muestran. El servidor guarda este texto. */
  opciones?: readonly string[];
  /** false = se puede dejar vacía. */
  obligatorio: boolean;
  autoComplete?: string;
  /** Cómo se llama en el correo y en la ficha del CRM (si no, el rótulo entero). */
  corto?: string;
};

export type Seccion = { id: string; titulo: string; bajada?: string; campos: readonly Campo[] };

/** Lo que escribió quien aplica, por id de campo: texto, el índice de la opción, los índices elegidos o el «confirmo». */
export type Valor = string | number | number[] | boolean;
export type Respuestas = Record<string, Valor | undefined>;

/** Los topes de largo: lo que pasa de acá es un error, no un recorte silencioso. */
export const LARGO_MAXIMO: Record<TipoCampo, number> = {
  texto: 120, email: 200, whatsapp: 30, link: 300, largo: 2000, una: 0, varias: 0, confirmo: 0,
};
/** Lo mínimo que se pide en una respuesta larga: con una palabra no se prepara una llamada. */
export const LARGO_MINIMO_LARGO = 15;

const pr = PROGRAMA_ACELERADOR;
const usd = (v: number) => `US$ ${v.toLocaleString('es-AR')}`;
const CUOTA = Math.round(pr.precioUsd / pr.cuotas);

// LAS OPCIONES DE LA AGENDA, TEXTUALES. Leídas el 16/11/2026 en la consulta pública de Calendly
// (calendly.com/api/booking/event_types/lookup?event_type_slug=asesoria&profile_slug=koncke, `custom_fields`). Son las
// preguntas 6 y 7 de esa agenda: con el MISMO texto, la agenda las recibe marcadas (`linkDeLaAgenda`). Si Martín las cambia en
// Calendly, hay que cambiarlas acá (tests/aplicacion-accelerator.test.ts lo recuerda).
export const OPCIONES_DECISION = [
  'Sí, soy la única persona que toma decisiones en mi negocio.',
  'No, necesito consultar con alguien más (invítalo a la llamada).',
] as const;
export const OPCIONES_EMPEZAR = [
  'De inmediato: estoy listo para arrancar ya',
  'La próxima semana: sólo ajusto agenda',
  'El próximo mes: estoy planeando arranque',
  'En 2-3 meses: tengo barreras que resolver antes',
] as const;

export const SECCIONES: readonly Seccion[] = [
  {
    id: 'datos', titulo: 'Tus datos',
    bajada: 'Te escribo por WhatsApp: revisa que el número esté completo, con el código de país.',
    campos: [
      { id: 'nombre', rotulo: 'Nombre', tipo: 'texto', obligatorio: true, autoComplete: 'given-name' },
      { id: 'apellido', rotulo: 'Apellido', tipo: 'texto', obligatorio: true, autoComplete: 'family-name' },
      { id: 'whatsapp', rotulo: 'WhatsApp, con el código de país', corto: 'WhatsApp', tipo: 'whatsapp', obligatorio: true, autoComplete: 'tel', placeholder: '+54 9 11 1234 5678' },
      { id: 'email', rotulo: 'Email', tipo: 'email', obligatorio: true, autoComplete: 'email', placeholder: 'tu@email.com' },
    ],
  },
  {
    id: 'negocio', titulo: 'Tu negocio',
    campos: [
      { id: 'negocio', rotulo: 'El nombre de tu negocio o de tu marca', corto: 'Negocio', tipo: 'texto', obligatorio: true, autoComplete: 'organization' },
      {
        id: 'rubro', rotulo: '¿Qué vendes?', corto: 'Qué vende', tipo: 'una', obligatorio: true,
        opciones: ['Coaching o mentoría', 'Consultoría', 'Agencia o servicios de marketing', 'Formación o cursos', 'Servicios profesionales (salud, legal, finanzas, inmobiliario…)', 'Otro'],
      },
      { id: 'red', rotulo: 'El link de tu red social principal', corto: 'Red social', tipo: 'link', obligatorio: false, placeholder: 'instagram.com/tu.usuario', ayuda: 'Instagram, YouTube, TikTok o LinkedIn: la que más uses.' },
      {
        id: 'antiguedad', rotulo: '¿Hace cuánto vendes tu servicio?', corto: 'Hace cuánto vende', tipo: 'una', obligatorio: true,
        opciones: ['Todavía no empecé', 'Menos de 6 meses', 'Entre 6 meses y 1 año', 'Entre 1 y 3 años', 'Entre 3 y 10 años', 'Más de 10 años'],
      },
      {
        id: 'clientes', rotulo: '¿Cuántos clientes tuviste desde que empezaste?', corto: 'Clientes desde el inicio', tipo: 'una', obligatorio: true,
        opciones: ['Ninguno todavía', 'De 1 a 5', 'De 6 a 15', 'De 16 a 30', 'Más de 30'],
      },
      {
        id: 'ticket', rotulo: '¿Cuánto te paga un cliente, en promedio?', corto: 'Ticket promedio', tipo: 'una', obligatorio: true,
        opciones: ['Menos de US$ 500', 'Entre US$ 500 y 1.000', 'Entre US$ 1.000 y 3.000', 'Entre US$ 3.000 y 10.000', 'Más de US$ 10.000'],
      },
      {
        id: 'audiencia', rotulo: '¿Tienes una audiencia activa en redes?', corto: 'Audiencia', tipo: 'una', obligatorio: true,
        opciones: ['Sí, grande y activa', 'Sí, pero todavía chica', 'Tengo seguidores, pero casi no interactúan', 'Todavía no'],
      },
    ],
  },
  {
    id: 'facturacion', titulo: 'Facturación y equipo',
    campos: [
      {
        id: 'facturacion', rotulo: '¿Cuánto facturaste por mes, en promedio, en los últimos 3 meses?', corto: 'Facturación por mes (últimos 3 meses)', tipo: 'una', obligatorio: true,
        opciones: ['Menos de US$ 5.000', 'Entre US$ 5.000 y 10.000', 'Entre US$ 10.000 y 30.000', 'Entre US$ 30.000 y 60.000', 'Más de US$ 60.000'],
      },
      {
        id: 'equipo', rotulo: '¿Cuántas personas trabajan contigo?', corto: 'Equipo', tipo: 'una', obligatorio: true,
        opciones: ['Solo yo', '1 o 2', 'De 3 a 5', 'De 6 a 10', 'Más de 10'],
      },
      {
        id: 'implementa', rotulo: '¿Quién va a implementar lo que definamos?', corto: 'Quién implementa', tipo: 'una', obligatorio: true,
        opciones: ['Yo, y tengo tiempo para hacerlo', 'Yo, pero tengo poco tiempo', 'Alguien de mi equipo', 'Todavía no lo sé'],
      },
    ],
  },
  {
    id: 'situacion', titulo: 'Tu situación hoy',
    campos: [
      {
        id: 'situacion', rotulo: '¿Cuál describe mejor tu situación hoy?', corto: 'Situación', tipo: 'una', obligatorio: true,
        opciones: [
          'Mi oferta está validada y necesito un sistema para conseguir clientes de forma predecible',
          'Tengo clientes, pero los consigo de forma desordenada',
          'Todavía no tengo claro qué vendo ni a quién',
          'Estoy validando mi oferta',
        ],
      },
      {
        id: 'canal', rotulo: '¿Cómo consigues clientes hoy?', corto: 'Cómo consigue clientes', tipo: 'varias', obligatorio: true,
        ayuda: 'Puedes marcar más de una.',
        opciones: ['Contenido en redes', 'Anuncios', 'Referidos y boca en boca', 'Mensajes en frío', 'Eventos o charlas', 'Todavía no tengo un canal'],
      },
      {
        id: 'tecnologia', rotulo: '¿Cómo te llevas con la tecnología?', corto: 'Tecnología', tipo: 'una', obligatorio: true,
        opciones: ['Muy bien: aprendo rápido cualquier herramienta', 'Bien: me defiendo', 'Me cuesta, pero le pongo ganas', 'Prefiero que lo haga otra persona'],
      },
    ],
  },
  {
    id: 'diagnostico', titulo: 'Tu diagnóstico',
    bajada: 'Con esto preparo la llamada. Cuanto más concreto, mejor.',
    campos: [
      { id: 'queHaces', rotulo: 'Cuéntame qué haces, a quién ayudas y qué servicios ofreces', corto: 'Qué hace', tipo: 'largo', obligatorio: true },
      { id: 'meta', rotulo: '¿Cuál es tu meta más grande para los próximos 12 meses?', corto: 'Meta a 12 meses', tipo: 'largo', obligatorio: true },
      { id: 'obstaculo', rotulo: '¿Qué es lo que más te frena hoy para lograrla?', corto: 'Lo que lo frena', tipo: 'largo', obligatorio: true },
    ],
  },
  {
    id: 'final', titulo: 'Tu aplicación',
    campos: [
      { id: 'porQue', rotulo: '¿Por qué debería aceptar tu aplicación?', corto: 'Por qué aceptarla', tipo: 'largo', obligatorio: true },
      {
        id: 'horas', rotulo: '¿Cuántas horas por semana puedes dedicarle a implementar?', corto: 'Horas por semana', tipo: 'una', obligatorio: true,
        opciones: ['Más de 15', 'Entre 10 y 15', 'Entre 5 y 10', 'Menos de 5'],
      },
      {
        // El precio de verdad, el de la columna de /planes: Martín, 16/11, «es mi política de que ya tenga todo el precio».
        id: 'inversion', rotulo: `${pr.nombre} cuesta ${usd(pr.precioUsd)}, en ${pr.cuotas} cuotas de ${usd(CUOTA)}. Si hay match, ¿puedes invertirlo?`,
        corto: 'Inversión', tipo: 'una', obligatorio: true,
        opciones: ['Sí, de contado', `Sí, en las ${pr.cuotas} cuotas`, 'Lo tendría que conseguir', 'Hoy no puedo invertir eso'],
      },
      { id: 'decision', rotulo: '¿Tomas tú las decisiones de tu negocio?', corto: 'Decisión', tipo: 'una', obligatorio: true, opciones: OPCIONES_DECISION },
      { id: 'empezar', rotulo: 'Si hay match, ¿cuándo quieres empezar?', corto: 'Cuándo empezar', tipo: 'una', obligatorio: true, opciones: OPCIONES_EMPEZAR },
      { id: 'compromiso', rotulo: 'Confirmo que lo que respondí es real y que, si hay match, estoy listo para comprometerme con el programa.', corto: 'Compromiso', tipo: 'confirmo', obligatorio: true },
    ],
  },
];

/** Todos los campos, en orden. */
export const CAMPOS: readonly Campo[] = SECCIONES.flatMap((s) => s.campos);
const POR_ID = new Map(CAMPOS.map((c) => [c.id, c]));
export const campo = (id: string): Campo => {
  const c = POR_ID.get(id);
  if (!c) throw new Error(`No existe el campo «${id}» de la aplicación.`);
  return c;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** El WhatsApp: sólo dígitos, con el código de país, de 10 a 15 (E.164; con el país, ninguno tiene menos de 10). */
export function whatsappDeLaAplicacion(v: unknown): string | null {
  const d = (typeof v === 'string' ? v : '').replace(/[^\d]/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}
const limpio = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const limpioLargo = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '');

/**
 * El error de UN campo, o null. Lo usan el formulario (al pasar de paso) y el servidor (todo junto). El texto es el que lee
 * quien aplica: corto y diciendo qué hacer.
 */
export function errorDelCampo(c: Campo, v: Valor | undefined): string | null {
  switch (c.tipo) {
    case 'texto': case 'link': {
      const s = limpio(v);
      if (!s) return c.obligatorio ? 'Completa este campo.' : null;
      if (s.length > LARGO_MAXIMO[c.tipo]) return `Es muy largo: hasta ${LARGO_MAXIMO[c.tipo]} caracteres.`;
      if (c.tipo === 'texto' && s.length < 2) return 'Completa este campo.';
      return null;
    }
    case 'email': {
      const s = limpio(v).toLowerCase();
      if (!s) return c.obligatorio ? 'Escribe tu email.' : null;
      return EMAIL_RE.test(s) && s.length <= LARGO_MAXIMO.email ? null : 'Ese email no parece válido. Revísalo.';
    }
    case 'whatsapp': {
      const s = limpio(v);
      if (!s) return c.obligatorio ? 'Escribe tu WhatsApp.' : null;
      if (s.length > LARGO_MAXIMO.whatsapp) return 'Ese número es muy largo. Revísalo.';
      // El ejemplo con espacios que no cortan: en el teléfono se partía en «+54 9 / 11 1234 5678» (medido el 16/11/2026).
      return whatsappDeLaAplicacion(s) ? null : 'Ese número no parece completo: escríbelo con el código de país (por ejemplo, +54\u00a09\u00a011\u00a01234\u00a05678).';
    }
    case 'largo': {
      const s = limpioLargo(v);
      if (!s) return c.obligatorio ? 'Cuéntame un poco: con esto preparo la llamada.' : null;
      if (s.length < LARGO_MINIMO_LARGO) return 'Cuéntame un poco más.';
      if (s.length > LARGO_MAXIMO.largo) return `Es muy largo: hasta ${LARGO_MAXIMO.largo} caracteres.`;
      return null;
    }
    case 'una': {
      const ok = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < (c.opciones?.length ?? 0);
      if (ok) return null;
      return c.obligatorio || v !== undefined ? 'Elige una opción.' : null;
    }
    case 'varias': {
      const lista = Array.isArray(v) ? v : [];
      if (!lista.length) return c.obligatorio ? 'Elige al menos una opción.' : null;
      const n = c.opciones?.length ?? 0;
      const validas = lista.length <= n && lista.every((i) => Number.isInteger(i) && i >= 0 && i < n) && new Set(lista).size === lista.length;
      return validas ? null : 'Elige al menos una opción.';
    }
    case 'confirmo':
      return v === true || !c.obligatorio ? null : 'Para enviar tu aplicación, confírmalo.';
  }
}

/** Los errores de una sección (para el botón «Siguiente»): id del campo → texto. Vacío = se puede seguir. */
export function erroresDeLaSeccion(s: Seccion, r: Respuestas): Record<string, string> {
  const e: Record<string, string> = {};
  for (const c of s.campos) {
    const m = errorDelCampo(c, r[c.id]);
    if (m) e[c.id] = m;
  }
  return e;
}

/** La respuesta de un campo en TEXTO (la del correo y la ficha). Vacía = no la contestó. */
export function respuestaEnTexto(c: Campo, v: Valor | undefined): string {
  switch (c.tipo) {
    case 'una': return typeof v === 'number' ? c.opciones?.[v] ?? '' : '';
    case 'varias': return Array.isArray(v) ? v.map((i) => c.opciones?.[i]).filter(Boolean).join(' · ') : '';
    case 'confirmo': return v === true ? 'Sí' : '';
    case 'largo': return limpioLargo(v);
    case 'email': return limpio(v).toLowerCase();
    case 'whatsapp': { const d = whatsappDeLaAplicacion(v); return d ? `+${d}` : ''; }
    default: return limpio(v);
  }
}

/** El índice de la opción elegida, o -1 (lo leen `califica` y `linkDeLaAgenda`). */
const elegida = (r: Respuestas, id: string): number => (typeof r[id] === 'number' ? (r[id] as number) : -1);

/**
 * ¿CALIFICA PARA AGENDAR YA? El corte de la landing (app/accelerator/contenido.ts, «¿Esto es realmente para ti?»): factura más
 * de US$ 5.000 por mes, con clientes y la oferta validada, y puede invertir el precio. Martín, 16/11: «pon facturas más de
 * 5.000… con clientes y oferta validada». Quien no califica NO queda afuera: su aplicación llega igual y la lee Martín.
 */
export function califica(r: Respuestas): boolean {
  const facturaMasDe5k = elegida(r, 'facturacion') >= 1;
  const tieneClientes = elegida(r, 'clientes') >= 1;
  // «Mi oferta está validada…» o «Tengo clientes, pero los consigo de forma desordenada».
  const ofertaValidada = [0, 1].includes(elegida(r, 'situacion'));
  // «Sí, de contado» o «Sí, en las cuotas».
  const puedeInvertir = [0, 1].includes(elegida(r, 'inversion'));
  return facturaMasDe5k && tieneClientes && ofertaValidada && puedeInvertir;
}

/**
 * Lo que va después de instagram.com/ y NO es un usuario: el link de una publicación, un reel o una historia. Sin esto,
 * instagram.com/p/Cx… llegaba a la agenda como «@p» (16/11/2026).
 */
const RUTAS_DE_INSTAGRAM = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 's']);

/** El @ de Instagram de un link (instagram.com/usuario → @usuario); de otra red, o de una publicación, el link tal cual. */
export function arrobaDeInstagram(link: string): string {
  const s = link.trim();
  const m = /(?:^|\/\/|\.)instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(s) ?? /^instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(s);
  if (m && !RUTAS_DE_INSTAGRAM.has(m[1].toLowerCase())) return `@${m[1]}`;
  return s;
}

/**
 * LOS TOPES DEL FORMULARIO DE LA AGENDA, medidos el 16/11/2026 en el de Martín con las respuestas cargadas por el link (sin
 * agendar): el nombre admite 155 caracteres; el @ y «¿Qué quieres lograr…?» son preguntas de UNA línea (`format: "string"` en la
 * consulta pública, un `<input>` con `maxlength="255"`). ⚠️ Lo que llega por el link no lo frena el `maxlength` (sólo frena al que
 * escribe): la meta de 600 caracteres entraba entera, por encima del tope de la agenda, y sus saltos de línea se borraban al
 * dibujarse («…referidos.Lo que me frena hoy…», pegado). Por eso va en un renglón y cortado en una palabra (`enUnRenglon`).
 */
export const TOPE_AGENDA = { nombre: 155, linea: 255 } as const;

/** Un texto en un renglón y, si pasa del tope, cortado en la última palabra que entra, con «…». */
export function enUnRenglon(s: string, tope: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= tope) return t;
  const corte = t.slice(0, tope - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > tope / 2 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:·-]+$/, '')}…`;
}

/**
 * LA AGENDA, YA CONTESTADA (16/11/2026). La agenda de Martín pide nombre, email y siete respuestas obligatorias antes de
 * confirmar; quien ya aplicó no tiene por qué escribirlas otra vez. Calendly acepta las respuestas en el link (`name`,
 * `email` y `a1`…`a7`, en el ORDEN de sus preguntas, leído el 16/11 en la consulta pública):
 *   a1 Número de WhatsApp (teléfono) · a2 ¿Cuál es tu @ en Instagram? · a3 ¿Qué quieres lograr…? · a4 ¿Tienes posibilidad de
 *   invertir…? (Si / No) · a5 ¿Cuánto estarías dispuesto a invertir? (Menos de $1000 / Entre $1000 y $3000 / Entre $3000 y
 *   $10000) · a6 ¿Tenés autonomía…? · a7 ¿Cuándo quieres empezar?
 * Las de opción se marcan con el texto EXACTO de la opción: por eso la decisión y el arranque usan las de la agenda (verificado el
 * 16/11 en su formulario: las cuatro quedan marcadas y «Programar evento» queda listo para tocar). Los textos, en un renglón y
 * dentro de sus topes (`TOPE_AGENDA`). Lo que no se sabe, no se marca (la persona lo elige ahí). `embed`: el dominio de la página
 * que la muestra adentro.
 */
export function linkDeLaAgenda(r: Respuestas, opciones: { embed?: string } = {}): string {
  const q = new URLSearchParams();
  const nombre = enUnRenglon(`${limpio(r.nombre)} ${limpio(r.apellido)}`, TOPE_AGENDA.nombre);
  if (nombre) q.set('name', nombre);
  const email = limpio(r.email).toLowerCase();
  if (EMAIL_RE.test(email)) q.set('email', email);
  const wa = whatsappDeLaAplicacion(r.whatsapp);
  if (wa) q.set('a1', `+${wa}`);
  const red = limpio(r.red);
  if (red) q.set('a2', enUnRenglon(arrobaDeInstagram(red), TOPE_AGENDA.linea));
  // La meta y lo que la frena, seguidas en un renglón (la respuesta entera llega a Martín por el correo y la ficha).
  const meta = limpio(r.meta);
  const frena = limpio(r.obstaculo) ? `Lo que me frena hoy: ${limpio(r.obstaculo)}` : '';
  const lograr = meta && frena ? `${meta}${/[.!?…]$/.test(meta) ? '' : '.'} ${frena}` : meta || frena;
  if (lograr) q.set('a3', enUnRenglon(lograr, TOPE_AGENDA.linea));
  const inv = elegida(r, 'inversion');
  if (inv >= 0) q.set('a4', inv <= 1 ? 'Si' : 'No');
  // El programa cuesta US$ 1.500: quien puede invertirlo está «Entre $1000 y $3000». Si no, no se adivina.
  if (inv === 0 || inv === 1) q.set('a5', 'Entre $1000 y $3000');
  const dec = elegida(r, 'decision');
  if (dec >= 0 && OPCIONES_DECISION[dec]) q.set('a6', OPCIONES_DECISION[dec]);
  const emp = elegida(r, 'empezar');
  if (emp >= 0 && OPCIONES_EMPEZAR[emp]) q.set('a7', OPCIONES_EMPEZAR[emp]);
  if (opciones.embed) {
    q.set('embed_domain', opciones.embed);
    q.set('embed_type', 'Inline');
    q.set('hide_gdpr_banner', '1');
  }
  return `${AGENDA_DE_LA_LLAMADA}?${q.toString()}`;
}

/** Lo que llega al servidor ya leído: los datos de contacto aparte y cada respuesta con su rótulo corto y su texto. */
export type AplicacionLimpia = {
  nombre: string; apellido: string; email: string; whatsapp: string;
  /** Las respuestas en el orden del formulario (sin las vacías). */
  respuestas: Array<{ seccion: string; id: string; rotulo: string; respuesta: string }>;
  /** Los valores ya validados (para `califica` y la agenda). */
  valores: Respuestas;
  califica: boolean;
};

/**
 * Lee el cuerpo del POST (la ruta pública): el campo trampa, cada campo con `errorDelCampo` y los textos con su tope. Un campo
 * mal = el error de ESE campo (el formulario lo marca). Lo que no es un campo de la aplicación, se ignora.
 */
export function leerAplicacion(body: unknown): { ok: true; aplicacion: AplicacionLimpia } | { ok: false; error: string; campo?: string; bot?: true } {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.web === 'string' && b.web.trim()) return { ok: false, error: 'bot', bot: true };
  const crudas = b.respuestas && typeof b.respuestas === 'object' && !Array.isArray(b.respuestas) ? (b.respuestas as Record<string, unknown>) : {};
  const valores: Respuestas = {};
  for (const c of CAMPOS) {
    const v = crudas[c.id];
    const leido: Valor | undefined =
      c.tipo === 'una' ? (typeof v === 'number' ? v : undefined)
        : c.tipo === 'varias' ? (Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : undefined)
          : c.tipo === 'confirmo' ? v === true
            : typeof v === 'string' ? v : undefined;
    const error = errorDelCampo(c, leido);
    if (error) return { ok: false, error: `${c.corto ?? c.rotulo}: ${error}`, campo: c.id };
    if (leido !== undefined) valores[c.id] = leido;
  }
  const respuestas = SECCIONES.flatMap((s) => s.campos.map((c) => ({ seccion: s.titulo, id: c.id, rotulo: c.corto ?? c.rotulo, respuesta: respuestaEnTexto(c, valores[c.id]) })))
    .filter((x) => x.respuesta);
  return {
    ok: true,
    aplicacion: {
      nombre: respuestaEnTexto(campo('nombre'), valores.nombre),
      apellido: respuestaEnTexto(campo('apellido'), valores.apellido),
      email: respuestaEnTexto(campo('email'), valores.email),
      whatsapp: whatsappDeLaAplicacion(valores.whatsapp) ?? '',
      respuestas, valores, califica: califica(valores),
    },
  };
}

/** La aplicación en texto, por sección (el correo del equipo y el historial de la ficha). */
export function aplicacionEnTexto(a: Pick<AplicacionLimpia, 'respuestas' | 'califica'>): string {
  const lineas: string[] = [a.califica
    ? 'CALIFICA para agendar ya: factura más de US$ 5.000 por mes, con clientes y oferta validada, y puede invertir. Se le abrió tu agenda.'
    : 'NO califica para agendar ya: no se le abrió la agenda. Si hay match, le escribes tú por WhatsApp.'];
  let seccion = '';
  for (const x of a.respuestas) {
    if (x.seccion !== seccion) { seccion = x.seccion; lineas.push('', seccion.toUpperCase()); }
    lineas.push(x.respuesta.includes('\n') ? `· ${x.rotulo}:\n${x.respuesta}` : `· ${x.rotulo}: ${x.respuesta}`);
  }
  return lineas.join('\n');
}
