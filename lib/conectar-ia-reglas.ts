// =============================================================================
// conectar-ia-reglas — «Conectar tu IA»: Claude o ChatGPT, por la computadora o por clave (IA4, 22/10/2026)
// =============================================================================
// El relevamiento del 22/10: el modal del Ops Center ofrecía sólo la computadora con Claude y, al admin, la clave de
// Claude. La clave de OpenAI se cargaba sólo desde /integraciones. Ahora, un paso por pantalla (la regla de Martín):
//   1. ¿Qué IA usas? Claude o ChatGPT.
//   2. ¿Cómo la conectas? Mi computadora (su suscripción: contesta este chat con la PC prendida) o una clave de API (para
//      que MaKo trabaje solo; la carga el admin). A quien no es admin: «Pídele a <admin> que conecte la IA del negocio».
//
// Las dos vías no son lo mismo y la pantalla lo dice en una línea: la suscripción corre en SU computadora (D6a) y sólo
// contesta lo que la persona pide; lo que MaKo hace solo (contestar leads, Hola MaKo, análisis) va con la clave de API,
// porque Anthropic no deja que otra app use los tokens de la suscripción. Claude Max trae crédito de API.
//
// Puro (sin `server-only`): lo dibuja app/integraciones/TusCuentasIA.tsx y lo fija tests/conectar-ia.test.ts.
// =============================================================================

export type IaDelCliente = 'claude' | 'chatgpt';
export const IAS_DEL_CLIENTE: readonly IaDelCliente[] = ['claude', 'chatgpt'];

/** La integración de /integraciones que guarda la clave de cada IA (lib/integraciones-catalogo.ts). */
export const SERVICIO_DE_CLAVE: Record<IaDelCliente, 'anthropic' | 'openai'> = { claude: 'anthropic', chatgpt: 'openai' };

export const NOMBRE_IA: Record<IaDelCliente, string> = { claude: 'Claude', chatgpt: 'ChatGPT' };

/**
 * ChatGPT en la computadora (Codex, IA11 / ola 3 de docs/ia-del-cliente.md). Hasta que el programa de la PC lo corra, la
 * opción se ve y dice «Pronto»: así el cliente sabe que existe y que hoy su GPT entra por la clave.
 */
export const CHATGPT_EN_LA_PC = false;

export type OpcionConectar = {
  que: 'pc' | 'clave' | 'pedir';
  titulo: string;
  detalle: string;
  habilitada: boolean;
};

/** «Pídele a Mauricio…» o, sin nombre, «Pídele al admin de tu negocio…». */
export const pedirleAlAdmin = (admin?: string | null): string =>
  `Pídele ${admin?.trim() ? `a ${admin.trim()}` : 'al admin de tu negocio'} que conecte la IA del negocio.`;

/** Las opciones del paso 2, en orden: la computadora y la clave (o «pídele», a quien no es admin). */
export function comoConectar(ia: IaDelCliente, quien: { esAdmin: boolean; admin?: string | null }): OpcionConectar[] {
  const pcLista = ia === 'claude' || CHATGPT_EN_LA_PC;
  return [
    {
      que: 'pc', titulo: 'Mi computadora',
      detalle: pcLista ? 'Con tu suscripción. Contesta este chat mientras esté prendida.' : 'Pronto',
      habilitada: pcLista,
    },
    quien.esAdmin
      ? { que: 'clave', titulo: 'Una clave de API', detalle: 'MaKo trabaja solo, las 24 horas.', habilitada: true }
      : { que: 'pedir', titulo: 'Una clave de API', detalle: pedirleAlAdmin(quien.admin), habilitada: false },
  ];
}

/** La nota debajo de las opciones. La de Claude: el crédito que trae Max (entra como clave de API). */
export const notaDeConectar = (ia: IaDelCliente): string | null =>
  ia === 'claude' ? 'Claude Max trae crédito de API: úsalo como clave.' : null;
