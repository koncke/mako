// =============================================================================
// conexiones-catalogo — CÓMO se conecta cada cosa, en un solo lugar (25/10/2026)
// =============================================================================
// Martín, 25/10/2026, por Florencia (ws21): «que si detecta que alguien le falta una conexión o algo que le ofrezca ayuda,
// que le de el link y que le pregunte si quiere que le ayude con eso... Revisa si MaKo tiene la info de toda la app de como
// conectar cada cosa, y mas ahora que vamos implementando nuevas cosas como Zernio». Plan: docs/conexiones-y-ayuda.md.
//
// ⚠️ NO ES UNA NOVENA LISTA. Lo que MaKo sabía de cómo conectar cada cosa estaba escrito en ocho lugares que ya se
// contradecían (integraciones-catalogo, metodo-catalogo, servicio-slides, tab-activacion, hechos-mako, mako-capacidades, los
// `DEEP_LINKS` del doer y la expresión de intención, que todavía nombra el inbox oficial que se retiró el 09/10). Éste se MONTA sobre `DEFS`
// (lib/integraciones-catalogo.ts: las tarjetas de /integraciones) y suma sólo lo que no es una tarjeta: la computadora
// (MaKo Desktop), «Tus cuentas de IA» y el número de WhatsApp. Una tarjeta nueva entra sola.
//
// ⚠️ LOS PASOS DE UNA TARJETA NO VIVEN ACÁ: son el tutorial de lib/metodo-catalogo.ts, que es `server-only` (145 KB que no
// pueden viajar al navegador). Los lee quien corre en el servidor (el runner de `como_conectar`). Acá van sólo los pasos de lo
// que no es una tarjeta, y salen de las pantallas reales (app/integraciones/TusCuentasIA.tsx, app/perfil/instalar).
//
// Los links son CONTRATO (AGENTS.md): `/integraciones?abrir=<key>` abre el modal de esa tarjeta, `/perfil/ia?computadora=1`
// abre «Conecta MaKo» y `/chats?conectar=whatsapp` el QR. Un rediseño los conserva.
//
// Puro (sin `server-only`): lo usan la API de MaKo, el doer y sus tests.
// =============================================================================

import { esGrabador } from './grabadores/reunion';
import { CATALOGO_GRABADORES } from './grabadores/catalogo';
import { DEFS, type Def } from './integraciones-catalogo';
import { RUTA_TRAS_INSTALAR } from './ia-pc-reglas';

export type Conexion = {
  /** La key de la tarjeta (`?abrir=<key>`), o la de lo que no es tarjeta: 'pc', 'ia', 'whatsapp'. */
  key: string;
  nombre: string;
  /** Cómo la nombra la gente, en minúscula y sin tildes: «grabaciones», «mi claude», «instagram». */
  sinonimos: readonly string[];
  /** La pantalla donde se conecta, con lo que abre su modal: sin base y sin `?ws=` (eso lo pone quien manda el link). */
  ruta: string;
  /** Lo que destraba, en una frase para la persona. */
  destraba: string;
  /** Desde el teléfono no se conecta nada de esto (app/m/configuraciones/integraciones: «Conectar en la computadora»). */
  donde: 'computadora';
  /** La conecta quien administra el negocio, o cualquiera (su computadora es SUYA). */
  quien: 'admin' | 'cualquiera';
  /** Cómo se sabe que quedó: probar la credencial guardada, que la computadora esté en línea, o el permiso de Google. */
  verifica: 'probar_conexion' | 'pc_en_linea' | 'google' | null;
  /**
   * Los pasos de lo que NO es una tarjeta (las tarjetas traen su tutorial de lib/metodo-catalogo.ts), o los de una tarjeta que se
   * conecta en OTRA (Meta, en la de Zernio): ganan sobre el tutorial, que es el de su propio modal.
   */
  pasos?: readonly string[];
  /** Cómo se conecta, cuando no es lo que la persona espera (Meta: «con tu Facebook, por Zernio»). Va en el prompt y en la API. */
  aclaracion?: string;
  /** No se le ofrece a nadie: se explica sólo si la persona lo pide por su nombre (Gemini, Martín 25/10/2026). */
  noSeOfrece?: true;
  /** Sólo la ve el negocio de la plataforma (GitHub). */
  soloPlataforma?: true;
};

/** La ruta del modal de una tarjeta de /integraciones. */
export const rutaDeTarjeta = (key: string): string => `/integraciones?abrir=${encodeURIComponent(key)}`;

/**
 * Cómo nombra la gente cada cosa. Sin tildes y en minúscula (se compara contra `normalizar`). Lo que no está acá se encuentra
 * igual por su key y por su nombre.
 */
const SINONIMOS: Record<string, readonly string[]> = {
  fathom: ['fathom', 'grabaciones', 'grabacion de llamadas', 'mis llamadas grabadas'],
  // Los otros grabadores de reuniones (26/10/2026, lib/grabadores). «Grabaciones» a secas sigue llevando a Fathom.
  tldv: ['tldv', 'tl;dv', 'tl dv'],
  fireflies: ['fireflies', 'fireflies.ai', 'fred de fireflies'],
  zoom: ['zoom', 'grabaciones de zoom', 'mi zoom'],
  otter: ['otter', 'otter.ai'],
  loom: ['loom', 'mis loom', 'videos de loom'],
  readai: ['read ai', 'read.ai', 'readai'],
  meet: ['google meet', 'meet', 'transcripciones de meet'],
  openai: ['openai', 'gpt', 'chatgpt', 'chat gpt', 'mi gpt'],
  anthropic: ['anthropic', 'clave de claude', 'api de claude', 'key de claude'],
  gemini: ['gemini', 'ai studio'],
  groq: ['groq'],
  zernio: ['zernio', 'instagram', 'facebook', 'redes', 'mis redes', 'messenger'],
  // «token de meta» y «access token» se quedan A PROPÓSITO (27/10/2026): quien pregunta por el token de antes tiene que caer en
  // Meta, que lo manda a conectar por Zernio (`META_POR_ZERNIO`).
  meta: ['meta ads', 'token de meta', 'access token', 'app de meta', 'anuncios de meta', 'facebook ads', 'ads manager', 'cuenta publicitaria'],
  email: ['email', 'correo', 'mails', 'resend'],
  google: ['google calendar', 'calendario de google', 'mi agenda de google', 'google'],
  calendly: ['calendly'],
  calcom: ['cal.com', 'calcom'],
  stripe: ['stripe'],
  mercadopago: ['mercado pago', 'mercadopago'],
  creem: ['creem', 'creem.io'],
  // Hotmart, Skool y el Apify de los leads salieron el 25/10/2026 (el Leads Scraper, tests/leads-scraper-retirado.test.ts); entran los
  // alojadores de video que se sumaron ese día.
  panda: ['panda', 'panda video'],
  vimeo: ['vimeo'],
  wistia: ['wistia'],
  bunny: ['bunny stream', 'bunny'],
  cloudflare: ['cloudflare stream', 'cloudflare'],
  youtube: ['youtube'],
  'apify-instagram': ['apify'],
  // «pixel» solo, no: el de Meta no es de MaKo (lib/hechos-mako.ts).
  landing: ['pixel de mako', 'codigo de la landing', 'codigo de mako'],
  agente: ['skill de mako', 'claude con mi negocio'],
  elevenlabs: ['elevenlabs', 'eleven labs', 'mi voz'],
  pc: ['mako desktop', 'app de escritorio', 'computadora', 'mi compu', 'mi pc', 'mi claude', 'suscripcion de claude', 'claude pro', 'claude max'],
  ia: ['tus cuentas de ia', 'mi ia', 'mis cuentas de ia'],
  instalar: ['instalar la app', 'instalar mako', 'bajar la app', 'descargar mako', 'la app del telefono', 'la extension'],
  perfil: ['mi perfil', 'mi numero en el perfil', 'mis datos'],
  whatsapp: ['whatsapp', 'mi numero', 'qr', 'numero de empresa'],
};

/**
 * Martín, 25/10/2026: «le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos que todo eso se hace con la app de
 * escritorio de MaKo y conectado a su claude o GPT». La tarjeta sigue (un negocio que ya lo tiene, lo usa; y el buscador de
 * conocimiento embebe con Gemini: lib/embeddings.ts), pero ningún texto lo ofrece. Groq tampoco: sólo escucha audios, y con
 * su IA conectada no se usa.
 */
const NO_SE_OFRECEN = new Set(['gemini', 'groq']);

/**
 * META SE CONECTA EN LA TARJETA DE ZERNIO (27/10/2026). Joan preguntó en el grupo de Código Inmobiliario (ws13) si el proceso de
 * conectar «la app de Meta, generar el access token» seguía igual, y MaKo le contestó «Sí» con el link a `?abrir=meta`. Martín:
 * «ya no existe TOKEN de meta, todo por zernio con un simple login de facebook». La tarjeta de Meta Ads sigue (la cuenta, el
 * píxel, la salud), pero CONECTAR es en la de Zernio: «Anuncios de Meta» → «Conectar» (app/integraciones/ConectarRedes.tsx), que
 * guarda la conexión de Meta igual que el botón del modal de Meta (`conectada-meta`, app/_components/ConectarViaZernio.tsx).
 * Los pasos usan los rótulos de esa pantalla; la API key de Zernio, sólo si el negocio no la tiene (sin ella la fila no aparece).
 * tests/meta-sin-token.test.ts los fija con la pregunta textual de Joan.
 */
const META_POR_ZERNIO = {
  ruta: rutaDeTarjeta('zernio'),
  aclaracion: 'con tu Facebook, por Zernio',
  // 29/10/2026 (ticket #28): la tarjeta de Zernio va en dos pasos, y «Anuncios de Meta» es el bloque del paso 2.
  pasos: [
    'Desde tu computadora, abre el link: es la tarjeta de Zernio.',
    'Si te pide la "API key de Zernio" (paso 1): sácala en zernio.com → "Settings" → "API Keys" y pégala.',
    'En "Anuncios de Meta" (paso 2), toca "Conectar con Facebook" y entra con tu Facebook.',
    'Acepta en la ventana de Facebook y elige tu cuenta publicitaria y tu píxel, si tienes varios.',
  ],
} as const;

const deTarjeta = (d: Def): Conexion => ({
  key: d.key,
  nombre: d.nombre,
  sinonimos: SINONIMOS[d.key] ?? [],
  ruta: d.key === 'meta' ? META_POR_ZERNIO.ruta : rutaDeTarjeta(d.key),
  ...(d.key === 'meta' ? { aclaracion: META_POR_ZERNIO.aclaracion, pasos: META_POR_ZERNIO.pasos } : {}),
  destraba: d.descripcion,
  donde: 'computadora',
  quien: 'admin',
  verifica: d.envs.length ? 'probar_conexion' : d.key === 'google' ? 'google' : null,
  // Un grabador que hoy no se conecta (Loom sin API; Read AI y Meet sin su inicio de sesión) tampoco se ofrece: se explica si
  // la persona lo nombra, y su tarjeta dice por qué (lib/grabadores/catalogo.ts, `conectable`).
  ...(NO_SE_OFRECEN.has(d.key) || (esGrabador(d.key) && !CATALOGO_GRABADORES[d.key].conectable) ? { noSeOfrece: true as const } : {}),
  ...(d.soloPlataforma ? { soloPlataforma: true as const } : {}),
});

/**
 * Lo que no es una tarjeta. Los pasos usan los rótulos REALES de cada pantalla (en una línea, ≤120 caracteres, como los
 * tutoriales de lib/metodo-catalogo.ts): un paso con un botón que no existe es peor que no tener pasos.
 */
const FUERA_DE_LAS_TARJETAS: readonly Conexion[] = [
  {
    key: 'pc', nombre: 'MaKo en tu computadora (MaKo Desktop)', sinonimos: SINONIMOS.pc,
    // Directo en «Conecta MaKo» (app/perfil/ia/page.tsx): ahí mismo está «Descargar MaKo» para quien no la tiene.
    ruta: RUTA_TRAS_INSTALAR,
    destraba: 'Que el chat de MaKo en la app te conteste con tu Claude, desde tu computadora.',
    donde: 'computadora', quien: 'cualquiera', verifica: 'pc_en_linea',
    pasos: [
      'Desde tu computadora, abre el link y toca «Descargar MaKo».',
      'Instálalo: en Windows, Siguiente y después Instalar; en Mac, doble clic en MaKo.app.',
      'En «Conecta esta computadora», toca «Conectar» y contesta «Sí» en MaKo.',
      'Si te pide «Iniciar sesión», entra con tu cuenta de Claude.',
      'Cuando diga «Tu computadora está en línea», ya está.',
    ],
  },
  {
    key: 'ia', nombre: 'Tus cuentas de IA', sinonimos: SINONIMOS.ia,
    // `?abrir=ia` lo abre la rama de MaKo Desktop (lib/ia-pc-reglas.ts, `LINK_TUS_CUENTAS_IA`, 25/10/2026).
    ruta: rutaDeTarjeta('ia'),
    destraba: 'Ver con qué IA trabaja tu negocio: tu computadora y tus claves.',
    donde: 'computadora', quien: 'cualquiera', verifica: null,
  },
  {
    // Las rutas de Settings (su rediseño, 25/10/2026): cada pestaña es su ruta y el detalle va por query (AGENTS.md, el contrato).
    key: 'instalar', nombre: 'Instalar la app', sinonimos: SINONIMOS.instalar,
    ruta: '/perfil/instalar',
    destraba: 'MaKo en tu computadora, en tu teléfono y la extensión de Chrome.',
    donde: 'computadora', quien: 'cualquiera', verifica: null,
  },
  {
    key: 'perfil', nombre: 'Tu perfil', sinonimos: SINONIMOS.perfil,
    // Tu número de WhatsApp vive ahí: es lo que la computadora mira para contestarte en el grupo (`delGrupo`, lib/ia-pc.ts).
    ruta: '/perfil',
    destraba: 'Tu número de WhatsApp: con él tu computadora te reconoce en el grupo de MaKo.',
    donde: 'computadora', quien: 'cualquiera', verifica: null,
  },
  {
    key: 'whatsapp', nombre: 'Tu número de WhatsApp', sinonimos: SINONIMOS.whatsapp,
    // app/chats/ChatsApp.tsx: `?conectar=whatsapp` abre el modal del QR.
    ruta: '/chats?conectar=whatsapp',
    destraba: 'Que tus chats y tus automatizaciones salgan por tu número.',
    donde: 'computadora', quien: 'admin', verifica: null,
  },
];

/**
 * Todas, las tarjetas primero. ⚠️ Menos la tarjeta de WhatsApp de /integraciones (29/10/2026): «Tu número de WhatsApp» (abajo) es la
 * MISMA conexión con el link de contrato `/chats?conectar=whatsapp`, que abre el QR en un paso. Con las dos, la tarjeta ganaba por ir
 * primero y la API de MaKo y el doer mandaban al modal de la tarjeta en vez de al QR (tests/conexiones-api.test.ts).
 */
export const CONEXIONES: readonly Conexion[] = [...DEFS.filter((d) => d.key !== 'whatsapp').map(deTarjeta), ...FUERA_DE_LAS_TARJETAS];

/** La conexión de una key, o undefined. */
export const conexion = (key: string): Conexion | undefined => CONEXIONES.find((c) => c.key === key);

/** Minúsculas, sin tildes, espacios simples. */
export const normalizar = (s: string): string =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nombra = (texto: string, frase: string): boolean => new RegExp(`(^|[^a-z0-9])${escapar(frase)}($|[^a-z0-9])`).test(texto);

/**
 * La conexión que nombra un texto («¿cómo conecto mi Fathom?», «quiero conectar instagram», «zernio»), o undefined. La key
 * exacta gana; después, el sinónimo o el nombre MÁS LARGO que aparece como palabra (así «google calendar» le gana a «google»).
 * `esPlataforma`: GitHub existe sólo para el negocio de la plataforma.
 */
export function buscarConexion(texto: string, o: { esPlataforma?: boolean } = {}): Conexion | undefined {
  const t = normalizar(texto);
  if (!t) return undefined;
  const visibles = CONEXIONES.filter((c) => o.esPlataforma || !c.soloPlataforma);
  const exacta = visibles.find((c) => c.key === t);
  if (exacta) return exacta;
  let mejor: { c: Conexion; largo: number } | null = null;
  for (const c of visibles) {
    for (const frase of [c.key, normalizar(c.nombre), ...c.sinonimos]) {
      if (frase.length > (mejor?.largo ?? 0) && nombra(t, frase)) mejor = { c, largo: frase.length };
    }
  }
  return mejor?.c;
}

/**
 * LAS QUE VAN EN EL PROMPT DE MaKo (lib/hechos-mako.ts), con su link: las que más se piden. Todas no: `hechosMako` viaja en
 * cada turno de cada canal, y las otras se encuentran con `como_conectar` o `ver_integraciones`. Hasta el 25/10/2026 el prompt
 * tenía tres links escritos a mano (meta, anthropic, landing) y le prohibía a MaKo dar otros: no sabía dar el de Fathom, el de
 * Zernio ni el de su computadora.
 */
export const EN_EL_PROMPT = ['openai', 'pc', 'ia', 'fathom', 'zernio', 'meta', 'google', 'calendly', 'whatsapp', 'email', 'landing'] as const;

/** Las líneas «· nombre: link» de `EN_EL_PROMPT`, con la base que pone el código (nunca el modelo). */
export function conexionesParaElPrompt(base: string): string {
  return EN_EL_PROMPT.map((k) => conexion(k)).filter((c): c is Conexion => !!c)
    .map((c) => `  - ${c.nombre}${c.aclaracion ? ` (${c.aclaracion})` : ''}: ${base}${c.ruta}`).join('\n');
}

/**
 * Lo que el MODELO tiene que respetar de una conexión con `aclaracion` (Meta). «No lo nombres»: la respuesta a Joan que confirmó el
 * proceso del token salió de explicar lo de antes; una que dice «ya no hace falta el token» igual le hace buscar un token.
 */
export const importanteDe = (c: Conexion): string | null =>
  c.aclaracion ? `Se conecta ${c.aclaracion}, y sólo así: lo de antes se retiró. No lo expliques ni lo nombres: pasa el link y los pasos.` : null;

/**
 * La línea que el CÓDIGO le agrega a la persona cuando le falta una conexión (`falta.servicio` de una operación, la API de
 * MaKo): qué falta y su link. Desde el teléfono no se conecta: lo dice.
 */
export function lineaParaConectar(c: Conexion, link: string): string {
  return `Para esto falta conectar ${c.nombre} (desde tu computadora) 👇\n${link}`;
}
