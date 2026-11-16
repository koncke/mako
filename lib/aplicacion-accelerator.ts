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
// DESPUÉS DE APLICAR, NADIE AGENDA SOLO (16/11/2026). Martín: «no tiene sentido de que automaticemos… yo estoy prometiendo de que
// voy a revisar personalmente sus aplicaciones… siempre debería ser gracias, voy a revisar tu aplicación, te responderé en máximo
// 24 horas… estate atento a tu WhatsApp y a tu email» (en la pantalla, neutro: «Revisa tu WhatsApp y tu email»). Hasta esa tarde
// quien calificaba elegía su horario en la agenda de Martín ahí mismo. Ahora TODOS ven lo mismo: el gracias, el video de Martín y su
// siguiente paso, crear su cuenta de MaKo o «Ya tengo cuenta» (y «Entrar a MaKo» si contestó que ya la tiene, `cuenta`; Martín, esa
// noche: «tu siguiente paso es crear cuenta de MaKo o ya tengo cuenta»). `califica` queda para Martín: el asunto del correo, su primera línea con lo que falta
// (`porQueNoCalifica`) y la ficha del CRM (lib/aplicacion-accelerator-servidor.ts). La agenda ya contestada (`linkDeLaAgenda`) va
// en ese correo, para mandársela si hay match.
//
// UN SOLO LUGAR: lo usan el formulario (app/accelerator/aplicar/), que valida cada paso, y la ruta (app/api/accelerator/aplicar/),
// que vuelve a validar TODO: es pública y nunca confía en lo que manda el navegador. Las respuestas de opción viajan como ÍNDICES y
// el servidor guarda el TEXTO de la opción. Sin imports de servidor: este archivo va también al navegador.
// =============================================================================

import { PROGRAMA_ACELERADOR } from './planes-mako';
import { TEXTO_FALTA_EL_AREA, faltaAlWhatsapp, whatsappNormalizado } from './paises';

/** La página del formulario y la ruta que lo recibe. */
export const RUTA_APLICAR = '/accelerator/aplicar';
export const API_APLICAR = '/api/accelerator/aplicar';

/**
 * La agenda de Martín (Calendly, «asesoria», 60 minutos). La misma que `AGENDA_ACELERADOR` (app/planes/Tarjetas.tsx), que la
 * toma de acá.
 */
export const AGENDA_DE_LA_LLAMADA = 'https://calendly.com/koncke/asesoria';

export type TipoCampo = 'texto' | 'email' | 'whatsapp' | 'link' | 'canal' | 'largo' | 'una' | 'varias' | 'confirmo';

/** Las dos redes que se piden (16/11/2026, Martín: «el link de tu Instagram y el link de tu YouTube… pero no… TikTok ni LinkedIn»). */
export type RedDeLaAplicacion = 'instagram' | 'youtube';

export type Campo = {
  id: string;
  /** La pregunta, como la lee quien aplica. */
  rotulo: string;
  tipo: TipoCampo;
  /** De `canal`: cuál de las dos redes (el buscador de Competitor Spy la busca, app/api/accelerator/canal). */
  red?: RedDeLaAplicacion;
  /** Se pregunta SÓLO si en `id` se eligió una de `opciones` (el email de la cuenta, si es otro). Escondido, ni se valida ni se guarda. */
  soloSi?: { id: string; opciones: readonly number[] };
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
  texto: 120, email: 200, whatsapp: 30, link: 300, canal: 300, largo: 2000, una: 0, varias: 0, confirmo: 0,
};
/** Lo mínimo que se pide en una respuesta larga: con una palabra no se prepara una llamada. */
export const LARGO_MINIMO_LARGO = 15;

const pr = PROGRAMA_ACELERADOR;
const usd = (v: number) => `US$ ${v.toLocaleString('es-AR')}`;

/**
 * ¿YA TIENE CUENTA EN MaKo? (16/11/2026, Martín: «en el formulario le podríamos preguntar en algún momento si ya tiene cuenta y que
 * nos ponga su email»). Con cuenta, el botón de la pantalla final es «Entrar a MaKo»; sin cuenta, «Crear cuenta de MaKo». El email
 * de la cuenta se pide sólo si es OTRO (`emailCuenta`): el mismo no se escribe dos veces.
 */
export const OPCIONES_CUENTA = ['Sí, con este mismo email', 'Sí, con otro email', 'Todavía no'] as const;
/** Las opciones de `cuenta` que dicen que ya tiene cuenta. */
export const CON_CUENTA: readonly number[] = [0, 1];
export const tieneCuentaDeMako = (r: Respuestas): boolean => typeof r.cuenta === 'number' && CON_CUENTA.includes(r.cuenta);

// LAS OPCIONES DE LA AGENDA, TEXTUALES Y EN SU ORDEN. Leídas el 16/11/2026 en la consulta pública de Calendly
// (calendly.com/api/booking/event_types/lookup?event_type_slug=asesoria&profile_slug=koncke, `custom_fields`). Son las
// preguntas 6 y 7 de esa agenda, y el formulario las pregunta con las mismas palabras. A la agenda viajan por su NÚMERO (el
// índice + 1, `linkDeLaAgenda`): si Martín cambia una tilde en Calendly siguen marcándose; si cambia el ORDEN, hay que cambiarlo
// acá (tests/aplicacion-accelerator.test.ts lo recuerda).
// ⚠️ SALVO LA PRIMERA DE «EMPEZAR», NEUTRA (16/11/2026, Martín: «para una mujer atento no aplica… que sea neutro»): en Calendly dice
//    «De inmediato: estoy listo para arrancar ya», y acá «puedo arrancar ya». Como viaja por su número, la agenda la sigue marcando.
export const OPCIONES_DECISION = [
  'Sí, soy la única persona que toma decisiones en mi negocio.',
  'No, necesito consultar con alguien más (invítalo a la llamada).',
] as const;
export const OPCIONES_EMPEZAR = [
  'De inmediato: puedo arrancar ya',
  'La próxima semana: sólo ajusto agenda',
  'El próximo mes: estoy planeando arranque',
  'En 2-3 meses: tengo barreras que resolver antes',
] as const;

export const SECCIONES: readonly Seccion[] = [
  {
    // SIN BAJADA (16/11/2026, Martín: «en tus datos no debería decir te escribo por WhatsApp, porque en este caso no le vamos a
    // escribir por WhatsApp»). Decía «Te escribo por WhatsApp: revisa que el código de país y el número estén bien.»; el código de
    // país se ve y se elige al lado del número, y lo que no va bien lo dice su error.
    id: 'datos', titulo: 'Tus datos',
    campos: [
      { id: 'nombre', rotulo: 'Nombre', tipo: 'texto', obligatorio: true, autoComplete: 'given-name' },
      { id: 'apellido', rotulo: 'Apellido', tipo: 'texto', obligatorio: true, autoComplete: 'family-name' },
      // El código de país se ELIGE (`TelefonoConPais`, el del checkout): el campo de al lado es el número sin él.
      { id: 'whatsapp', rotulo: 'WhatsApp', corto: 'WhatsApp', tipo: 'whatsapp', obligatorio: true, autoComplete: 'tel' },
      { id: 'email', rotulo: 'Email', tipo: 'email', obligatorio: true, autoComplete: 'email', placeholder: 'tu@email.com' },
      { id: 'cuenta', rotulo: '¿Ya tienes cuenta en MaKo?', corto: 'Cuenta de MaKo', tipo: 'una', obligatorio: true, opciones: OPCIONES_CUENTA },
      {
        id: 'emailCuenta', rotulo: 'El email de tu cuenta de MaKo', corto: 'Email de su cuenta de MaKo', tipo: 'email', obligatorio: true,
        autoComplete: 'off', placeholder: 'el email con el que entras', soloSi: { id: 'cuenta', opciones: [1] },
      },
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
      // INSTAGRAM Y YOUTUBE, LOS DOS OPCIONALES (16/11/2026). Martín: «en lugar del link de tu red social principal sea el link de tu
      // Instagram y el link de tu YouTube. Ambos sí pueden ser opcionales, pero no… TikTok ni LinkedIn. Y… reutilicemos lo que ya
      // tenemos en Competitor Spy… Entonces la persona puede como seleccionarse su propio canal». Escribe su @, su nombre o pega el
      // link, y elige su cuenta de la lista (app/api/accelerator/canal); si la búsqueda no anda, lo que escribió vale igual.
      { id: 'instagram', rotulo: 'Tu Instagram', corto: 'Instagram', tipo: 'canal', red: 'instagram', obligatorio: false, placeholder: '@tu.usuario o el link de tu perfil' },
      { id: 'youtube', rotulo: 'Tu canal de YouTube', corto: 'YouTube', tipo: 'canal', red: 'youtube', obligatorio: false, placeholder: '@tucanal o el link de tu canal' },
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
    // «Cuanto más concreto, mejor» → «cuanto más detalle, mejor» (16/11/2026, neutro: «concreto» se podía leer como de quien escribe).
    id: 'diagnostico', titulo: 'Tu diagnóstico',
    bajada: 'Con esto preparo la llamada: cuanto más detalle, mejor.',
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
        // El precio de verdad, el de la columna de /planes: Martín, 16/11, «es mi política de que ya tenga todo el precio». SIN
        // CUOTAS (esa misma tarde: «elimínalo bien en el formulario. Sería sí de contado o sí en cuotas»): cuántas, en la llamada.
        id: 'inversion', rotulo: `${pr.nombre} cuesta ${usd(pr.precioUsd)} ${pr.periodo}. Si hay match, ¿puedes invertirlo?`,
        corto: 'Inversión', tipo: 'una', obligatorio: true,
        opciones: ['Sí, de contado', 'Sí, en cuotas', 'Lo tendría que conseguir', 'Hoy no puedo invertir eso'],
      },
      { id: 'decision', rotulo: '¿Tomas tú las decisiones de tu negocio?', corto: 'Decisión', tipo: 'una', obligatorio: true, opciones: OPCIONES_DECISION },
      { id: 'empezar', rotulo: 'Si hay match, ¿cuándo quieres empezar?', corto: 'Cuándo empezar', tipo: 'una', obligatorio: true, opciones: OPCIONES_EMPEZAR },
      // NEUTRO (16/11/2026). Antes → «…y que, si hay match, estoy listo para comprometerme con el programa.»
      { id: 'compromiso', rotulo: 'Confirmo que lo que respondí es real y que, si hay match, me comprometo con el programa.', corto: 'Compromiso', tipo: 'confirmo', obligatorio: true },
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
/** Las marcas invisibles que pegan las apps de contactos alrededor de un número (las mismas que saca `numeroTecleado`, lib/paises.ts). */
const MARCAS_INVISIBLES = /[‎‏‪-‮⁦-⁩]/g;

/**
 * El WhatsApp: los dígitos CON el código de país, de 10 a 15 (E.164), o null. Tiene que llegar con su país: con «+» (lo que manda el
 * formulario, que lo elige con `TelefonoConPais`) o con «00». ⚠️ UN NÚMERO LOCAL NO PASA (revisión del 16/11/2026): sólo se
 * contaban los dígitos y se le ponía un «+» adelante, así que «55 1234 5678» (un celular de México) quedaba +5512345678, de Brasil;
 * «(212) 555-1234», de Marruecos; «0412…», un +0412 que no existe. El WhatsApp con que contesta Martín no llegaba, el `wa.me` del
 * correo abría otro país y la agenda recibía ese número. Ningún código de país empieza con 0.
 * ⚠️ CON +54, EL CELULAR CON SU 9 Y CON SU CÓDIGO DE ÁREA (revisión del 16/11/2026, hallazgo 3): el servidor también lo normaliza
 * (`whatsappNormalizado`: una pestaña de antes, o un POST directo, lo mandaban sin el 9), y uno sin el código de área («+54 15 2345
 * 6789») o que no es 549 y 10 dígitos no pasa (`faltaAlWhatsapp`, lib/paises.ts): ese número no es de nadie.
 */
export function whatsappDeLaAplicacion(v: unknown): string | null {
  const s = (typeof v === 'string' ? v : '').replace(MARCAS_INVISIBLES, '').trim();
  const conPais = s.startsWith('+') ? s.slice(1) : s.startsWith('00') ? s.slice(2) : null;
  if (conPais == null) return null;
  const d = whatsappNormalizado(conPais.replace(/\D/g, ''));
  return /^[1-9]\d{9,14}$/.test(d) && !faltaAlWhatsapp(d) ? d : null;
}
export const TEXTO_WHATSAPP_INCOMPLETO = 'Ese número no parece completo: revisa el código de país y el número.';
export const TEXTO_WHATSAPP_SIN_PAIS = 'Falta el código de país: elígelo a la izquierda del número.';

/**
 * LOS CARACTERES DE CONTROL SE VAN (revisión del 16/11/2026): un `\u0000` pegado de un PDF pasaba la validación y Postgres no lo
 * guarda en un `text`, así que el lead y «Quieren entrar» fallaban y quedaba sólo el correo (y si el correo también fallaba, un
 * 503 en cada reintento). Se quedan el tabulador y los saltos de línea, que son texto (como `origenLimpio`, lib/compra-plan-reglas.ts).
 */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const limpio = (v: unknown) => (typeof v === 'string' ? v.replace(CONTROL, '').replace(/\s+/g, ' ').trim() : '');
const limpioLargo = (v: unknown) => (typeof v === 'string' ? v.replace(CONTROL, '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '');

/**
 * Lo que va después de instagram.com/ y NO es un usuario: el link de una publicación, un reel o una historia. Sin esto,
 * instagram.com/p/Cx… llegaba a la agenda como «@p» (16/11/2026).
 */
const RUTAS_DE_INSTAGRAM = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 's']);
const conProtocolo = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

/**
 * EL INSTAGRAM DE LA APLICACIÓN, como «@usuario» en minúscula: de un @, del usuario solo o del link de su perfil (con o sin https y
 * con o sin `?igsh=`). null = no es un Instagram: un nombre con espacios, el link de una publicación, otra red.
 */
export function instagramDeLaAplicacion(v: unknown): string | null {
  const s = limpio(v).replace(MARCAS_INVISIBLES, '');
  if (!s) return null;
  if (/instagram\.com|instagr\.am/i.test(s)) {
    let u: URL;
    try { u = new URL(conProtocolo(s.replace(/^(https?:\/\/)?instagr\.am\//i, 'https://instagram.com/'))); } catch { return null; }
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const usuario = u.pathname.split('/').filter(Boolean)[0] ?? '';
    return /^[A-Za-z0-9._]{1,30}$/.test(usuario) && !RUTAS_DE_INSTAGRAM.has(usuario.toLowerCase()) ? `@${usuario.toLowerCase()}` : null;
  }
  const m = /^@?([A-Za-z0-9._]{1,30})$/.exec(s);
  return m && /[a-z0-9]/i.test(m[1]) ? `@${m[1].toLowerCase()}` : null;
}

/**
 * EL CANAL DE YOUTUBE DE LA APLICACIÓN, como su link: el @ del canal, su id (UC…) o el link del canal (/@x, /channel/UC…, /user/x
 * o /c/x). null = no es un canal: un nombre con espacios, el link de un VIDEO (youtu.be/…, /watch), otra red.
 */
export function youtubeDeLaAplicacion(v: unknown): string | null {
  const s = limpio(v).replace(MARCAS_INVISIBLES, '');
  if (!s) return null;
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(s)) return `https://www.youtube.com/${s}`;
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(s)) return `https://www.youtube.com/channel/${s}`;
  if (!/youtube\.com/i.test(s)) return null;
  let u: URL;
  try { u = new URL(conProtocolo(s)); } catch { return null; }
  if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return null;
  const [a, b] = u.pathname.split('/').filter(Boolean);
  if (a && /^@[A-Za-z0-9._-]{3,30}$/.test(a)) return `https://www.youtube.com/${a}`;
  if (a === 'channel' && b && /^UC[A-Za-z0-9_-]{20,}$/.test(b)) return `https://www.youtube.com/channel/${b}`;
  if ((a === 'user' || a === 'c') && b && /^[A-Za-z0-9._-]{1,100}$/.test(b)) return `https://www.youtube.com/${a}/${b}`;
  return null;
}

/** La búsqueda del Instagram y el YouTube de quien aplica (la de Competitor Spy: lib/aplicacion-accelerator-canal.ts). */
export const API_CANAL = '/api/accelerator/canal';
/** Lo que se busca: con menos letras no se gasta una corrida; más largo que esto, no es un @ ni un nombre. */
export const MINIMO_PARA_BUSCAR = 3;
export const MAXIMO_PARA_BUSCAR = 120;

/**
 * Lo escrito en un campo `canal`, como lo lee la búsqueda: una cuenta EXACTA (el usuario de Instagram sin @; de YouTube, lo que lee
 * `leerCanalHallado`: `@handle`, `UC…` o `user:x`) o un NOMBRE (con espacios). Nada = no se busca. Lo usan el formulario (para no
 * pedir de más) y la ruta.
 */
export function queBuscarDelCanal(red: RedDeLaAplicacion, q: string): { exacto: string | null; nombre: string | null } {
  const t = q.replace(/\s+/g, ' ').trim().slice(0, MAXIMO_PARA_BUSCAR);
  if (t.replace(/[@\s]/g, '').length < MINIMO_PARA_BUSCAR) return { exacto: null, nombre: null };
  const nombre = /\s/.test(t) && !/[/:@]/.test(t) ? t : null;
  if (red === 'instagram') {
    const ig = instagramDeLaAplicacion(t);
    return ig ? { exacto: ig.slice(1), nombre: null } : { exacto: null, nombre };
  }
  // Una palabra sola puede ser el @ del canal; un /c/ no tiene cómo leerse (vale como link, pero no se busca).
  const yt = youtubeDeLaAplicacion(t) ?? (/^[A-Za-z0-9._-]{3,30}$/.test(t) ? `https://www.youtube.com/@${t}` : null);
  if (yt) {
    const [a, b] = new URL(yt).pathname.split('/').filter(Boolean);
    return { exacto: a?.startsWith('@') ? a : a === 'channel' ? b : a === 'user' ? `user:${b}` : null, nombre: null };
  }
  return { exacto: null, nombre };
}

/** El canal de un campo `canal`, ya leído (`@usuario` o el link del canal), o null. */
export const canalDeLaAplicacion = (c: Pick<Campo, 'red'>, v: unknown): string | null =>
  c.red === 'youtube' ? youtubeDeLaAplicacion(v) : instagramDeLaAplicacion(v);

export const TEXTO_CANAL_INVALIDO: Record<RedDeLaAplicacion, string> = {
  instagram: 'Escribe tu @ o pega el link de tu perfil de Instagram.',
  youtube: 'Escribe el @ de tu canal o pega su link de YouTube.',
};

/** ¿Este campo se pregunta, con lo que ya contestó? (`soloSi`: el email de la cuenta, sólo si es otro). */
export function campoVisible(c: Campo, r: Respuestas): boolean {
  if (!c.soloSi) return true;
  const v = r[c.soloSi.id];
  return typeof v === 'number' && c.soloSi.opciones.includes(v);
}

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
    case 'canal': {
      const s = limpio(v);
      if (!s) return c.obligatorio ? 'Completa este campo.' : null;
      if (s.length > LARGO_MAXIMO.canal) return `Es muy largo: hasta ${LARGO_MAXIMO.canal} caracteres.`;
      return canalDeLaAplicacion(c, s) ? null : TEXTO_CANAL_INVALIDO[c.red ?? 'instagram'];
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
      if (whatsappDeLaAplicacion(s)) return null;
      // Sin «+» ni «00» no hay país: lo manda alguien que no usa el formulario, o un borrador de antes del selector.
      const sinMarcas = s.replace(MARCAS_INVISIBLES, '');
      if (!/^(\+|00)/.test(sinMarcas)) return TEXTO_WHATSAPP_SIN_PAIS;
      // Con +54 y sin el código de área, se dice cuál falta (lib/paises.ts).
      return faltaAlWhatsapp(sinMarcas.replace(/^00/, '').replace(/\D/g, '')) === 'area' ? TEXTO_FALTA_EL_AREA : TEXTO_WHATSAPP_INCOMPLETO;
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

/** Los errores de una sección (para el botón «Siguiente»): id del campo → texto. Vacío = se puede seguir. Lo escondido no cuenta. */
export function erroresDeLaSeccion(s: Seccion, r: Respuestas): Record<string, string> {
  const e: Record<string, string> = {};
  for (const c of s.campos) {
    if (!campoVisible(c, r)) continue;
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
    case 'canal': return canalDeLaAplicacion(c, v) ?? '';
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
 * Por qué NO califica, en palabras de Martín (la primera línea de su correo): lo que le falta del corte de `califica`, en su
 * orden. Vacío = califica.
 */
export function porQueNoCalifica(r: Respuestas): string[] {
  const falta: string[] = [];
  if (elegida(r, 'facturacion') < 1) falta.push('factura menos de US$ 5.000 por mes');
  if (elegida(r, 'clientes') < 1) falta.push('todavía no tiene clientes');
  if (![0, 1].includes(elegida(r, 'situacion'))) falta.push('su oferta todavía no está validada');
  if (![0, 1].includes(elegida(r, 'inversion'))) falta.push('hoy no puede invertir el programa');
  return falta;
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

/** Las opciones de a4 y a5 en la agenda de Martín, en su orden (las de a6 y a7 son `OPCIONES_DECISION` y `OPCIONES_EMPEZAR`). */
export const OPCIONES_A4 = ['Si', 'No'] as const;
export const OPCIONES_A5 = ['Menos de $1000', 'Entre $1000 y $3000', 'Entre $3000 y $10000'] as const;
/** El número con que Calendly marca una opción: la primera es 1. */
const numeroDe = (lista: readonly string[], opcion: string): string => String(lista.indexOf(opcion) + 1);

/** Lo que va en el @ de la agenda si no dejó ni su Instagram ni su YouTube: la pregunta es obligatoria allá y opcional acá. */
export const SIN_RED_EN_LA_AGENDA = 'No lo indicó';

/**
 * LA AGENDA, YA CONTESTADA (16/11/2026). La agenda de Martín pide nombre, email y siete respuestas obligatorias antes de
 * confirmar; quien ya aplicó no tiene por qué escribirlas otra vez. Calendly acepta las respuestas en el link (`name`,
 * `email` y `a1`…`a7`, en el ORDEN de sus preguntas, leído el 16/11 en la consulta pública):
 *   a1 Número de WhatsApp (teléfono) · a2 ¿Cuál es tu @ en Instagram? · a3 ¿Qué quieres lograr…? · a4 ¿Tienes posibilidad de
 *   invertir…? (`OPCIONES_A4`) · a5 ¿Cuánto estarías dispuesto a invertir? (`OPCIONES_A5`) · a6 ¿Tenés autonomía…?
 *   (`OPCIONES_DECISION`) · a7 ¿Cuándo quieres empezar? (`OPCIONES_EMPEZAR`)
 * LAS DE OPCIÓN VAN POR NÚMERO (revisión del 16/11/2026): Calendly marca la opción con su texto exacto o con su número (la primera
 * es 1; medido ese día en su formulario: a4=2 marcó «No», y a5=3, a6=2 y a7=4 también, scratchpad/aplicacion/
 * informe-investigacion-agenda.md). Por texto, una tilde que Martín cambiara allá («Si» va sin tilde en a4 y «Sí,» con tilde en
 * a6) la dejaba sin marcar y sin aviso. EL @ VA SIEMPRE: allá es obligatorio y acá opcional, y quien califica sin red social
 * chocaba con un campo vacío antes de «Programar evento» (`SIN_RED_EN_LA_AGENDA`). Los textos, en un renglón y dentro de sus
 * topes (`TOPE_AGENDA`). Lo demás que no se sabe, no se marca (la persona lo elige ahí).
 * DESDE EL 16/11/2026 A LA TARDE LO LEE MARTÍN, NO QUIEN APLICA: nadie ve la agenda al aplicar (Martín: «no tiene sentido de que
 * automaticemos»). Va en su correo, para mandársela por WhatsApp si hay match: quien la abre ya la encuentra contestada. En el @
 * va su Instagram; si no dejó, su YouTube.
 */
export function linkDeLaAgenda(r: Respuestas): string {
  const q = new URLSearchParams();
  const nombre = enUnRenglon(`${limpio(r.nombre)} ${limpio(r.apellido)}`, TOPE_AGENDA.nombre);
  if (nombre) q.set('name', nombre);
  const email = limpio(r.email).toLowerCase();
  if (EMAIL_RE.test(email)) q.set('email', email);
  const wa = whatsappDeLaAplicacion(r.whatsapp);
  if (wa) q.set('a1', `+${wa}`);
  const red = instagramDeLaAplicacion(r.instagram) ?? youtubeDeLaAplicacion(r.youtube);
  q.set('a2', red ? enUnRenglon(red, TOPE_AGENDA.linea) : SIN_RED_EN_LA_AGENDA);
  // La meta y lo que la frena, seguidas en un renglón (la respuesta entera llega a Martín por el correo y la ficha).
  const meta = limpio(r.meta);
  const frena = limpio(r.obstaculo) ? `Lo que me frena hoy: ${limpio(r.obstaculo)}` : '';
  const lograr = meta && frena ? `${meta}${/[.!?…]$/.test(meta) ? '' : '.'} ${frena}` : meta || frena;
  if (lograr) q.set('a3', enUnRenglon(lograr, TOPE_AGENDA.linea));
  const inv = elegida(r, 'inversion');
  if (inv >= 0) q.set('a4', numeroDe(OPCIONES_A4, inv <= 1 ? 'Si' : 'No'));
  // El programa cuesta US$ 1.500: quien puede invertirlo está «Entre $1000 y $3000». Si no, no se adivina.
  if (inv === 0 || inv === 1) q.set('a5', numeroDe(OPCIONES_A5, 'Entre $1000 y $3000'));
  const dec = elegida(r, 'decision');
  if (dec >= 0 && OPCIONES_DECISION[dec]) q.set('a6', String(dec + 1));
  const emp = elegida(r, 'empezar');
  if (emp >= 0 && OPCIONES_EMPEZAR[emp]) q.set('a7', String(emp + 1));
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
 * EL CAMPO TRAMPA LLENO (`bot`) SE LEE IGUAL (revisión del 16/11/2026): un autocompletado o una extensión pueden llenarlo en el
 * navegador de una persona de verdad, y su aplicación se perdía sin rastro. Si el resto es una aplicación válida, viene en
 * `aplicacion` (la ruta se la manda a Martín como «posible bot», sin guardarla); un error de un campo no se le dice al bot.
 */
export function leerAplicacion(body: unknown):
  | { ok: true; aplicacion: AplicacionLimpia }
  | { ok: false; error: string; campo?: string; bot?: true; aplicacion?: AplicacionLimpia } {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const trampa = typeof b.web === 'string' && b.web.trim() !== '';
  const crudas = b.respuestas && typeof b.respuestas === 'object' && !Array.isArray(b.respuestas) ? (b.respuestas as Record<string, unknown>) : {};
  const valores: Respuestas = {};
  for (const c of CAMPOS) {
    // Lo escondido (el email de la cuenta si no dijo «con otro email») ni se valida ni se guarda. `cuenta` va antes: ya está leído.
    if (!campoVisible(c, valores)) continue;
    const v = crudas[c.id];
    const leido: Valor | undefined =
      c.tipo === 'una' ? (typeof v === 'number' ? v : undefined)
        : c.tipo === 'varias' ? (Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : undefined)
          : c.tipo === 'confirmo' ? v === true
            : typeof v === 'string' ? v : undefined;
    const error = errorDelCampo(c, leido);
    if (error) return trampa ? { ok: false, error: 'bot', bot: true } : { ok: false, error: `${c.corto ?? c.rotulo}: ${error}`, campo: c.id };
    if (leido !== undefined) valores[c.id] = leido;
  }
  const respuestas = SECCIONES.flatMap((s) => s.campos.map((c) => ({ seccion: s.titulo, id: c.id, rotulo: c.corto ?? c.rotulo, respuesta: respuestaEnTexto(c, valores[c.id]) })))
    .filter((x) => x.respuesta);
  const aplicacion: AplicacionLimpia = {
    nombre: respuestaEnTexto(campo('nombre'), valores.nombre),
    apellido: respuestaEnTexto(campo('apellido'), valores.apellido),
    email: respuestaEnTexto(campo('email'), valores.email),
    whatsapp: whatsappDeLaAplicacion(valores.whatsapp) ?? '',
    respuestas, valores, califica: califica(valores),
  };
  return trampa ? { ok: false, error: 'bot', bot: true, aplicacion } : { ok: true, aplicacion };
}

/** La aplicación en texto, por sección (el correo del equipo y el historial de la ficha). */
export function aplicacionEnTexto(a: Pick<AplicacionLimpia, 'respuestas' | 'califica'> & { valores?: Respuestas }): string {
  // Sin «se le abrió tu agenda» (16/11/2026): nadie agenda solo. Lo que leyó en la pantalla final es la promesa de las 24 horas.
  const falta = a.califica ? [] : porQueNoCalifica(a.valores ?? {});
  const lineas: string[] = [
    a.califica
      ? 'CALIFICA: factura más de US$ 5.000 por mes, con clientes y oferta validada, y puede invertir.'
      : `NO califica${falta.length ? `: ${falta.join('; ')}` : ''}.`,
    'En la pantalla final leyó que le respondes en máximo 24 horas, por WhatsApp o por email.',
  ];
  let seccion = '';
  for (const x of a.respuestas) {
    if (x.seccion !== seccion) { seccion = x.seccion; lineas.push('', seccion.toUpperCase()); }
    lineas.push(x.respuesta.includes('\n') ? `· ${x.rotulo}:\n${x.respuesta}` : `· ${x.rotulo}: ${x.respuesta}`);
  }
  return lineas.join('\n');
}
