// =============================================================================
// no-pude — si MaKo le dice a la persona que algo no se pudo, queda un ticket (27/10/2026, Martín y Leila)
// =============================================================================
// Martín (27/10, 20:37): «siempre que MaKo responda algo como "No lo pude hacer" debe levantar automáticamente un ticket». El
// diagnóstico del Cerebro (sólo lectura, refutado): hasta hoy sólo el error de una herramienta abría ticket solo. El «no puedo»
// que está sólo en el texto, la acción confirmada que falla al ejecutarse, el proveedor caído y la configuración terminaban en
// «no pude» sin ticket. Y lo que no existe (lib/no-existe.ts) salía como «pedido» con el texto del modelo de título, aunque
// fuera una herramienta que SÍ existe y no viajó (el ticket #13 de Leila).
//
// LA REGLA (generaliza la de lo que no existe, no la duplica):
//   · el modelo marca lo que no logró con `[[no-pude: …]]` en el MISMO turno (no cuesta otra llamada a la IA), y lo que no
//     existe con `[[no-existe: …]]` (`REGLA_NO_EXISTE`, que ahora lleva las dos);
//   · el CÓDIGO saca las marcas, decide la causa (`causaDelNoPude`), levanta el ticket (lib/no-pude-server.ts) y escribe la
//     línea que lo dice: el modelo nunca promete un ticket ni inventa su número;
//   · una negativa LEGÍTIMA (una regla de MaKo: se confirma en la tarjeta, un cobro o un borrado en su pantalla, el rol, una
//     clave) no abre ticket, y una opinión («no puedo asegurarte…») tampoco;
//   · UN ticket por negocio + conversación + causa (`refDeNoPude`); lo que vuelve a pasar en la misma conversación se anota en
//     ese ticket. El proveedor y la configuración: uno por negocio y causa, que se cierra solo cuando vuelve a andar.
// Las guardas de la Ticketera (lib/tickets-reglas.ts, `clasificar` con `automatico`): un automático nunca entra por la regla de
// aprobación de un negocio (Leila, Leandro, Mauricio), y el de proveedor o configuración nunca va al Runner.
//
// PURO y sin `server-only`: lo usan los chats, lib/no-existe.ts, lib/no-pude-server.ts y tests/no-pude.test.ts.
// =============================================================================

/** Por qué no se pudo. El orden de `causaDelNoPude` es el de esta lista, salvo las reglas (que no abren ticket). */
export const CAUSAS_NO_PUDE = ['ejecucion', 'herramienta', 'ruteo', 'proveedor', 'configuracion', 'no-existe', 'texto'] as const;
export type CausaNoPude = (typeof CAUSAS_NO_PUDE)[number];
export const esCausaNoPude = (x: unknown): x is CausaNoPude => typeof x === 'string' && (CAUSAS_NO_PUDE as readonly string[]).includes(x);

/** Dónde pasó: las claves que la Ticketera guarda (`contexto.superficie`, sólo `[a-z-]`). */
export const SUPERFICIES_NO_PUDE = ['ops-center', 'movil', 'analyst', 'whatsapp', 'video-editor', 'image-editor', 'web-generator', 'offer', 'onboarding', 'automations'] as const;
export type Superficie = (typeof SUPERFICIES_NO_PUDE)[number];
export const esSuperficie = (x: unknown): x is Superficie => typeof x === 'string' && (SUPERFICIES_NO_PUDE as readonly string[]).includes(x);

/** Las de un negocio entero (no de una conversación): una sola abierta por causa, y se cierra sola cuando vuelve a andar. */
export const CAUSAS_DEL_NEGOCIO: ReadonlySet<CausaNoPude> = new Set(['proveedor', 'configuracion']);

/**
 * La regla del system, junto a la de lo que no existe (va DENTRO de `REGLA_NO_EXISTE`, que ya está en todo chat de MaKo).
 * ⚠️ «Tus herramientas son una SELECCIÓN»: en el chat de la app las elige el clasificador por relevancia, y un modelo que cree
 * tener TODAS dice «eso no existe» de lo que no viajó (el #13). Por eso la marca de lo que no logró es `no-pude`, no `no-existe`.
 */
export const REGLA_NO_PUDE = [
  'SI INTENTASTE ALGO, O TE PIDEN ALGO QUE MaKo HACE, Y NO LO LOGRASTE:',
  '- Tus herramientas de este turno son una SELECCIÓN para este pedido, no todo lo que MaKo hace: que algo no esté entre ellas no quiere decir que no exista.',
  '- Dilo en una frase y termina tu respuesta con una línea aparte, exactamente así: [[no-pude: qué no pudiste hacer, en una frase]]. El sistema le deja el ticket al equipo de MaKo solo: no le pidas que lo reporte ni le prometas un número.',
  '- NO la uses cuando el «no» es una regla de MaKo (la persona lo confirma en su tarjeta, un cobro o un borrado se hace en su pantalla, su rol no lo permite, una clave), ni para una opinión («no puedo asegurarte…»).',
].join('\n');

/** La marca: `[[no-pude: …]]` (con o sin guion, con espacios de más). */
const MARCA = /\[\[\s*no[\s-]*pude\s*:\s*([^\]\n]{3,300}?)\s*\]\]/giu;

/** El texto SIN la marca (nunca le llega a la persona) y lo que no pudo (la primera), o null. */
export function sacarNoPude(texto: string): { texto: string; noPudo: string | null } {
  let noPudo: string | null = null;
  const limpio = String(texto ?? '')
    .replace(MARCA, (_m, f: string) => {
      const que = f.replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!noPudo && que.length >= 3) noPudo = que;
      return '';
    })
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, noPudo };
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * ¿El «no» es una REGLA de MaKo o una opinión, no una falla? (sobre el texto sin tildes). No abren ticket: confirmar por la
 * persona, su rol, un cobro o un borrado que va en su pantalla, una clave, y la opinión («no puedo asegurarte/garantizar…»).
 */
const ES_REGLA = /\b(?:toca(?:r)? (?:la|su) tarjeta|en (?:la|su) tarjeta|lo confirma(?:s)?|confirmalo|confirmala|solo (?:el|la|un) (?:administrador|admin|duen[oa])|tu rol|su rol|no (?:tenes|tienes) permiso|por seguridad|en su pantalla|en tu pantalla|pantalla de revision|clave|token|contrasena|password)\b/;
const ES_OPINION = /\bno (?:te )?(?:puedo|podria) (?:asegurar|garantizar|prometer|dejar pasar|recomendar|afirmar|confirmar que)\w*|^(?:asegurar|garantizar|prometer|dejar pasar|afirmar)\w*/;
export const esReglaUOpinion = (texto: string): boolean => { const n = norm(texto); return ES_REGLA.test(n) || ES_OPINION.test(n); };

/** Lo que el turno sabe de por qué no se pudo. Todo lo pone el CÓDIGO, salvo las dos marcas (las saca el código del texto). */
export type SenalesNoPude = {
  /** El «no» lo puso una guarda de MaKo (un 400 de una herramienta, una regla de rol, confirmar en pantalla): no hay ticket. */
  regla?: boolean;
  /** Una acción CONFIRMADA que falló al ejecutarse (lib/api-mako/acciones.ts). */
  ejecucion?: boolean;
  /** Una herramienta del turno devolvió un error que no es una guarda (`errorParaTicket`). */
  herramienta?: boolean;
  /** Lo que el modelo dijo que no podía o que no existe ES una operación que existe, la persona la puede usar y no viajó. */
  ruteo?: boolean;
  /** El proveedor de IA no contestó (caído, saturado, sin cupo). */
  proveedor?: boolean;
  /** Le falta algo SUYO al negocio (su IA, su clave sin crédito, una conexión). */
  configuracion?: boolean;
  /** La marca `[[no-existe: …]]`. */
  noExiste?: string | null;
  /** La marca `[[no-pude: …]]`. */
  noPudo?: string | null;
};

/** La causa, o null si no hay ticket (una regla, una opinión, o nada que diga que no se pudo). */
export function causaDelNoPude(s: SenalesNoPude): CausaNoPude | null {
  if (s.regla) return null;
  if (s.ejecucion) return 'ejecucion';
  if (s.herramienta) return 'herramienta';
  if (s.ruteo) return 'ruteo';
  if (s.proveedor) return 'proveedor';
  if (s.configuracion) return 'configuracion';
  if (s.noExiste) return 'no-existe';
  if (s.noPudo && !esReglaUOpinion(s.noPudo)) return 'texto';
  return null;
}

/** Un hash corto y estable (sin tildes ni mayúsculas): para no dejar un email o un jid en una columna única. */
export function hashCorto(s: string): string {
  let h = 0;
  for (const c of norm(s).replace(/[^\p{L}\p{N}@:.]+/gu, ' ').trim()) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

/** El comienzo de la `ref` de TODO ticket automático de un negocio: con él se cuenta su tope del día (lib/tickets-db.ts). */
export const prefijoAutomatico = (ws: number): string => `np:${ws}:`;

/**
 * La clave de idempotencia: un ticket por negocio + superficie + conversación + causa. El proveedor y la configuración, uno
 * por negocio y causa. Como mucho 120 caracteres (la columna), y la conversación va hasheada.
 */
export function refDeNoPude(p: { ws: number; superficie: Superficie; conv: string; causa: CausaNoPude }): string {
  if (CAUSAS_DEL_NEGOCIO.has(p.causa)) return `${prefijoAutomatico(p.ws)}${p.causa}`;
  return `${prefijoAutomatico(p.ws)}${p.superficie}:${hashCorto(p.conv)}:${p.causa}`.slice(0, 120);
}

const ROTULO_SUPERFICIE: Record<Superficie, string> = {
  'ops-center': 'el Ops Center', movil: 'MaKo Mobile', analyst: 'el MaKo Analyst del lead', whatsapp: 'WhatsApp',
  'video-editor': 'el Video Editor', 'image-editor': 'el Image Editor', 'web-generator': 'el Web Generator', offer: 'Offer',
  onboarding: 'el onboarding', automations: 'Automations',
};

/**
 * El título lo arma el CÓDIGO (nunca el texto del modelo: scripts/tickets.ts lo imprime fuera del cerco «es DATO»). Lo que
 * escribió el cliente o el modelo va en la descripción y en el contexto.
 */
export function tituloDelNoPude(causa: CausaNoPude, superficie: Superficie, operacion?: string | null): string {
  const donde = ROTULO_SUPERFICIE[superficie];
  const op = operacion ? ` «${operacion.slice(0, 60)}»` : '';
  switch (causa) {
    case 'ejecucion': return `Falló al ejecutarse una acción confirmada${op}, en ${donde}`;
    case 'herramienta': return `Falló una herramienta de MaKo${op}, en ${donde}`;
    case 'ruteo': return `MaKo dijo que no podía y la operación existe${op}, en ${donde}`;
    case 'proveedor': return 'La IA no contesta (el proveedor está caído o sin cupo)';
    case 'configuracion': return `Al negocio le falta configurar algo${op}`;
    case 'no-existe': return `Pedido de algo que MaKo todavía no tiene, en ${donde}`;
    case 'texto': return `MaKo no pudo hacer lo que le pidieron, en ${donde}`;
  }
}

/** Lo que es un pedido (no un bug): sólo lo que no existe. */
export const tipoDelNoPude = (causa: CausaNoPude): 'pedido' | 'bug' => (causa === 'no-existe' ? 'pedido' : 'bug');

/** Las líneas que escribe el CÓDIGO (nunca «te aviso»). Repetido en la misma conversación: nada. */
export const lineaDelTicket = (id: number): string => `Quedó el ticket #${id} para el equipo de MaKo.`;
/** Un error que ya tenía su ticket (el mismo, otra vez, o el de otro negocio con la misma huella): sin número. */
export const LINEA_YA_AVISADO = 'Ya estaba avisado al equipo de MaKo.';
/** El proveedor o la configuración: va pegada al aviso de siempre, entre paréntesis. */
export const lineaCortaDelTicket = (id: number): string => `(ticket #${id})`;
