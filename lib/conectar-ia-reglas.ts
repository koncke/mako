// =============================================================================
// conectar-ia-reglas — «Conectar tu IA»: Claude, ChatGPT o Gemini, por la computadora o por clave (IA4, 22/10/2026)
// =============================================================================
// El relevamiento del 22/10: el modal del Ops Center ofrecía sólo la computadora con Claude y, al admin, la clave de
// Claude. La clave de OpenAI se cargaba sólo desde /integraciones. Ahora, un paso por pantalla (la regla de Martín):
//   1. ¿Qué IA usas? Claude o ChatGPT.
//   2. ¿Cómo la conectas? Mi computadora (su suscripción: contesta este chat con la PC prendida) o una clave de API (para
//      que MaKo trabaje solo; la carga el admin). A quien no es admin: «Pídele a <admin> que conecte la IA del negocio».
//
// Las dos vías no son lo mismo y la pantalla lo dice en una línea: la suscripción corre en SU computadora (D6a) y sólo
// contesta lo que la persona pide —el chat de la app y, desde el 25/10/2026, su grupo de MaKo en WhatsApp cuando escribe
// ella—; lo que MaKo hace solo (contestar leads, Automations, nutrición, análisis de fondo) va con la clave de API, porque
// Anthropic no deja que otra app use los tokens de la suscripción. Claude Max trae crédito de API.
// Martín, 25/10/2026: «dijimos que todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». El grupo
// del DUEÑO es él escribiéndole a su MaKo, como el chat: la puerta prueba que quien escribe es quien conectó la computadora
// (`encolarTurno` con `delGrupo`, lib/ia-pc.ts; docs/conexiones-y-ayuda.md, decisión 2).
//
// GEMINI (IA16, 22/10/2026). Martín, textual: «Cada usuario debe poder pagar su token, su propia IA de gemini». Va sólo por
// clave (la de AI Studio: no hay suscripción que corra en la PC, medido el 24/10/2026 — ver `iaDeLaPcPara`) y la pantalla dice dónde sacarla en una línea. Y SIEMPRE el
// aviso del plan gratis: Google no dice el plan de una clave sin gastarla (medido el 22/10: la lista de modelos, el modelo y
// countTokens contestan igual en el gratis y en el pago), así que no se puede avisar sólo a quien está en el gratis.
//
// Puro (sin `server-only`): lo dibuja app/integraciones/TusCuentasIA.tsx y lo fija tests/conectar-ia.test.ts.
// =============================================================================

export type IaDelCliente = 'claude' | 'chatgpt' | 'gemini';
export const IAS_DEL_CLIENTE: readonly IaDelCliente[] = ['claude', 'chatgpt', 'gemini'];

/** La integración de /integraciones que guarda la clave de cada IA (lib/integraciones-catalogo.ts). */
export const SERVICIO_DE_CLAVE: Record<IaDelCliente, 'anthropic' | 'openai' | 'gemini'> = { claude: 'anthropic', chatgpt: 'openai', gemini: 'gemini' };

export const NOMBRE_IA: Record<IaDelCliente, string> = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini' };

/**
 * ChatGPT en la computadora (Codex, IA11 / ola 3 de docs/ia-del-cliente.md). Hasta que el programa de la PC lo corra, la
 * opción se ve y dice «Pronto»: así el cliente sabe que existe y que hoy su GPT entra por la clave.
 */
export const CHATGPT_EN_LA_PC = false;
/**
 * La IA de la PC que corresponde a una IA del cliente, o null si esa IA no tiene computadora. Gemini no tiene, y no por falta
 * de código (24/10/2026): Google cerró el login personal de Gemini CLI el 18/06/2026 y Antigravity prohíbe el uso desde otro
 * producto (lib/ia-pc-reglas.ts → `PROVEEDORES_PC`).
 */
export const iaDeLaPcPara = (ia: IaDelCliente): 'claude' | 'chatgpt' | null => (ia === 'gemini' ? null : ia);
/** Si la computadora ya se ofrece para esa IA (Claude, siempre; ChatGPT, con `CHATGPT_EN_LA_PC`; Gemini, nunca). */
export const pcListaPara = (ia: IaDelCliente): boolean => ia === 'claude' || (ia === 'chatgpt' && CHATGPT_EN_LA_PC);

export type OpcionConectar = {
  que: 'pc' | 'clave' | 'pedir';
  titulo: string;
  detalle: string;
  habilitada: boolean;
};

/** «Pídele a Mauricio…» o, sin nombre, «Pídele al admin de tu negocio…». */
export const pedirleAlAdmin = (admin?: string | null): string =>
  `Pídele ${admin?.trim() ? `a ${admin.trim()}` : 'al admin de tu negocio'} que conecte la IA del negocio.`;

/** Las opciones del paso 2, en orden: la computadora y la clave (o «pídele», a quien no es admin). Gemini, sólo la clave. */
export function comoConectar(ia: IaDelCliente, quien: { esAdmin: boolean; admin?: string | null }): OpcionConectar[] {
  const pcLista = pcListaPara(ia);
  return [
    ...(iaDeLaPcPara(ia) == null ? [] : [{
      que: 'pc', titulo: 'Mi computadora',
      detalle: pcLista ? 'Con tu suscripción. Contesta este chat mientras esté prendida.' : 'Pronto',
      habilitada: pcLista,
    } satisfies OpcionConectar]),
    quien.esAdmin
      ? { que: 'clave', titulo: 'Una clave de API', detalle: 'MaKo trabaja solo, las 24 horas.', habilitada: true }
      : { que: 'pedir', titulo: 'Una clave de API', detalle: pedirleAlAdmin(quien.admin), habilitada: false },
  ];
}

/** El aviso del plan gratis de Gemini: va siempre (ver la cabecera). */
export const AVISO_GEMINI_GRATIS = 'Con la gratis, Google puede usar tus datos para mejorar sus modelos: activa la facturación en AI Studio para que no.';

/** La nota debajo de las opciones. La de Claude: el crédito que trae Max (entra como clave de API). La de Gemini: el plan gratis. */
export const notaDeConectar = (ia: IaDelCliente): string | null =>
  ia === 'claude' ? 'Claude Max trae crédito de API: úsalo como clave.' : ia === 'gemini' ? AVISO_GEMINI_GRATIS : null;

/** Dónde se saca la clave, en una línea y con su link. Sólo Gemini: es la única que se conecta sólo por clave. */
export const dondeSacarLaClave = (ia: IaDelCliente): { url: string; texto: string } | null =>
  ia === 'gemini' ? { url: 'https://aistudio.google.com/apikey', texto: 'Créala gratis en AI Studio: «Create API key» y cópiala.' } : null;
