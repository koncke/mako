// =============================================================================
// ia-permiso-reglas — el permiso para mandarle datos a una IA de terceros (Apple 5.1.2(i), 3/11/2026)
// =============================================================================
// Apple, 5.1.2(i): antes de compartir datos personales con terceros, «including with third-party AI», hay que decir con quién
// y pedir permiso explícito. Se pide UNA vez por persona y queda en `usuarios.perfil`, que es de la persona.
//
// ⚠️ SÓLO SE EXIGE EN LA APP DE IPHONE (lib/tienda.ts). Es lo único que la regla pide, y lo único que se puede distinguir: la TWA
//    de Android es Chrome (mismo user agent), y un corte en la computadora o en el navegador rompería la IA de los clientes
//    que ya la usan todos los días. Sin la marca del user agent, nada cambia.
// ⚠️ LO AUTOMÁTICO NO PASA POR ACÁ: un cron o un webhook no tienen persona ni pedido. Lo que un negocio configuró para correr solo
//    (sus automatizaciones, su bot) lo decide el negocio, y lo cuenta la política de privacidad. Está en docs/hallazgos-mobile.md.
// ⚠️ PURO: lo que frena de verdad está en lib/ia-permiso.ts, y se prueba rompiéndolo en tests/ia-permiso.test.ts.
// =============================================================================

export const VERSION_PERMISO_IA = 1;
export const CLAVE_PERMISO_IA = 'iaPermiso';

export type DecisionIa = 'si' | 'no';
export type PermisoIa = { decision: DecisionIa; at: string; version: number };

/** Lo guardado en `usuarios.perfil`. Un dato que no se entiende no es un permiso. */
export function leerPermisoIa(perfil: unknown): PermisoIa | null {
  const v = perfil && typeof perfil === 'object' ? (perfil as Record<string, unknown>)[CLAVE_PERMISO_IA] : null;
  if (!v || typeof v !== 'object') return null;
  const { decision, at, version } = v as Record<string, unknown>;
  if ((decision !== 'si' && decision !== 'no') || typeof at !== 'string' || typeof version !== 'number') return null;
  return { decision, at, version };
}

/** ¿Dijo que sí a ESTA versión del texto? Si se suma un proveedor que cambia lo que se le dijo, sube la versión y se vuelve a pedir. */
export const tienePermisoIa = (perfil: unknown): boolean => {
  const p = leerPermisoIa(perfil);
  return p?.decision === 'si' && p.version >= VERSION_PERMISO_IA;
};

/** ¿Hay que preguntarle? Una vez: quien dijo «ahora no» no ve la hoja en cada apertura, y lo cambia en Tu cuenta. */
export const faltaPreguntarIa = (perfil: unknown): boolean => {
  const p = leerPermisoIa(perfil);
  return !p || p.version < VERSION_PERMISO_IA;
};

/** Lo que dice una pantalla cuando lo pedido necesita IA y no hay permiso. */
export const TEXTO_SIN_PERMISO_IA = 'Para usar esto, permite la IA en Tu cuenta › IA de terceros.';

export class SinPermisoIa extends Error {
  constructor() {
    super(TEXTO_SIN_PERMISO_IA);
    this.name = 'SinPermisoIa';
  }
}

export const esSinPermisoIa = (e: unknown): boolean => e instanceof Error && e.name === 'SinPermisoIa';

/** Con quién se comparte. Lo mismo que /privacidad › «Con quién se comparten los datos». */
export const TEXTO_PERMISO_IA = {
  titulo: 'MaKo usa IA de otras empresas',
  que: 'Para contestarte, dictar y crear, MaKo le manda lo que pides a servicios de IA. Según el pedido, puede incluir tus mensajes, los datos de tus contactos, audio y fotos.',
  quienes: 'Anthropic (Claude), OpenAI (ChatGPT), Google (Gemini), Groq, Mistral, Cerebras, OpenRouter y ElevenLabs. Si conectaste tu propia IA, va a esa.',
  despues: 'Lo cambias cuando quieras en Tu cuenta. Sin tu permiso, lo demás de la app sigue andando.',
  si: 'Permitir',
  no: 'Ahora no',
} as const;

export const ROTULO_FILA_IA = 'IA de terceros';
