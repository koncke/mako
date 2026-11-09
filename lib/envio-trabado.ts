// =============================================================================
// envio-trabado — cuando un envío no sale por un AJUSTE DEL NEGOCIO, se le avisa (9/11/2026)
// =============================================================================
// ⚠️ EL CASO QUE ESTO ARREGLA: nueve días rotos y el único que lo notó fue el cliente.
// Los tickets #63 y #64 de Leandro (8/11/2026): Meta devolvía `not_thread_owner` —otra app era la
// dueña del hilo de la Página— y el motor reintentaba en silencio. Reintentar era lo correcto
// (el ajuste se destraba solo cuando el negocio saca la app rival, y tratarlo como permanente ya
// había costado 17 leads), pero NADIE SE ENTERABA. A 17 de 19 leads se les pasó la ventana de 24 h
// mientras tanto, y quedaron inalcanzables para siempre.
//
// La pieza que faltaba no es registrar el error —el Cerebro no puede cambiar la configuración de la
// Página de otro—: es **avisarle al negocio, en SU grupo**, porque es el único que puede arreglarlo.
//
// ⚠️ Y NO TODO FALLO MERECE UN AVISO. La mayoría son normales y el negocio no puede hacer nada:
// la ventana de 24 h se cerró, la respuesta privada ya se gastó, el lead nunca le escribió. Avisar
// de eso es ruido, y el ruido hace que se apaguen los avisos que sí importan. Acá entra SÓLO lo que
// el negocio puede destrabar con las manos.
//
// SIN `server-only`: lo de acá es puro y lo prueba tests/envio-trabado.test.ts.
// =============================================================================

/** Lo que el negocio —y sólo el negocio— puede destrabar. */
export type CausaDelNegocio = 'otra_app';

export type AvisoDeEnvioTrabado = {
  /** El id del catálogo (`lib/avisos-catalogo.ts`). */
  id: string;
  /** Las notas para el redactor del aviso: qué pasó y qué tiene que tocar. */
  contexto: string;
  /**
   * ⚠️ LLEVA LA CAUSA Y EL CANAL, NO EL LEAD. Con el lead adentro, cien leads trabados por el MISMO
   * ajuste son cien avisos: el negocio apaga la notificación y se pierde el próximo que sí importa.
   * Es un problema de la cuenta, así que se cuenta una vez por cuenta.
   */
  dedupKey: string;
  dedupTtlMin: number;
};

/** Doce horas: si el ajuste sigue mal al otro día, se lo vuelve a decir una vez. */
export const TTL_AVISO_TRABADO_MIN = 12 * 60;

/**
 * El aviso que le corresponde a un envío trabado, o `null` si esta causa no es del negocio.
 *
 * `canal` es el nombre que ve la persona («Instagram», «Messenger»), no el id interno: el aviso lo
 * lee alguien que no sabe qué es un `not_thread_owner`.
 */
export function avisoDeEnvioTrabado(causa: CausaDelNegocio | null | undefined, canal: string): AvisoDeEnvioTrabado | null {
  if (causa !== 'otra_app') return null;
  const nombre = canal.trim() || 'tu cuenta';
  return {
    id: 'envio-trabado-otra-app',
    contexto: [
      `Meta no deja que MaKo le escriba a tus leads por ${nombre}: otra aplicación figura como la que`,
      'atiende las conversaciones de tu Página (el "receptor primario" del traspaso de Meta).',
      'Lo arregla el negocio desde la configuración de la Página, sacando o bajando de prioridad esa',
      'otra app. Mientras tanto MaKo sigue reintentando: en cuanto se destrabe, los mensajes salen',
      'solos. Pero a cada lead se le vence la ventana de 24 h, y después ya no se le puede escribir.',
    ].join(' '),
    dedupKey: `envio-trabado:otra_app:${nombre.toLowerCase()}`,
    dedupTtlMin: TTL_AVISO_TRABADO_MIN,
  };
}
