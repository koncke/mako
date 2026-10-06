// =============================================================================
// integraciones-catalogo — QUÉ integraciones existen y quién ve cada una
// =============================================================================
// Sin `server-only` a propósito: es DATO, no lógica de servidor, y la regla de quién ve
// qué se equivocó dos veces seguidas — necesita test, y un test no puede importar un
// módulo `server-only`. Mismo motivo que lib/formatos-archivo.ts.
//
// `lib/integraciones.ts` lo re-exporta para no romper a quien ya lo importaba.
// =============================================================================

// `global: true` = servicio de plataforma de la agencia (no per-cliente): siempre
// disponible para todos los workspaces. El resto se chequea contra las
// credenciales del workspace actual (credWs → dueño usa env, cliente su fila).
/** `soloPlataforma` = es una credencial de LA PLATAFORMA (el repo de la agencia, no el
 *  negocio del cliente). Solo la ve el super-admin. Ver el mismo flag en
 *  lib/metodo-catalogo.ts: los DOS catálogos tienen que declarar lo mismo o la UI de uno
 *  la esconde y la del otro la muestra. */
export type Def = { key: string; nombre: string; categoria: string; descripcion: string; envs: string[]; tieneDetalle?: boolean; global?: boolean; soloPlataforma?: boolean; /** No se dibuja como tarjeta: se configura dentro de otra. */ oculto?: boolean };

export const DEFS: Def[] = [
  { key: 'meta', nombre: 'Meta Ads', categoria: 'Publicidad', descripcion: 'Campañas, insights y estado de la cuenta publicitaria.', envs: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], tieneDetalle: true },
  { key: 'whatsapp', nombre: 'WhatsApp (Chatwoot)', categoria: 'Mensajería', descripcion: 'Inbox de WhatsApp, plantillas y envíos de nutrición.', envs: ['CHATWOOT_BASE_URL', 'CHATWOOT_ACCOUNT_ID', 'CHATWOOT_API_TOKEN'] },
  { key: 'email', nombre: 'Email (Resend)', categoria: 'Mensajería', descripcion: 'Envío de emails de nutrición y reportes.', envs: ['RESEND_API_KEY'] },
  // BYOK con respaldo de plataforma: sin key propia, lib/zernio.ts cae a la env
  // ZERNIO_API_KEY de la agencia (excepción documentada estilo Resend Opción A);
  // el aislamiento por cliente lo da el PROFILE de Zernio, no la key.
  { key: 'zernio', nombre: 'Instagram (Zernio)', categoria: 'Mensajería', descripcion: 'DMs de Instagram, publicaciones programadas y automatizaciones de comentarios.', envs: ['ZERNIO_API_KEY'] },
  // IA = BYOK por cliente (ya NO global): cada workspace usa su propia key y su
  // gasto corre contra su cuenta. Para el dueño, credWs cae al env de respaldo.
  { key: 'anthropic', nombre: 'MaKo IA (Anthropic)', categoria: 'Inteligencia', descripcion: 'El cerebro de MaKo: análisis, chats y sugerencias.', envs: ['ANTHROPIC_API_KEY'] },
  { key: 'openai', nombre: 'OpenAI', categoria: 'Inteligencia', descripcion: 'Transcripción y tareas simples de IA.', envs: ['OPENAI_API_KEY'] },
  { key: 'groq', nombre: 'Groq', categoria: 'Inteligencia', descripcion: 'IA rápida y gratis para tareas simples y transcripción.', envs: ['GROQ_API_KEY'] },
  { key: 'gemini', nombre: 'Google Gemini', categoria: 'Inteligencia', descripcion: 'IA de Google con 1M de contexto (BYOK por cliente).', envs: ['GEMINI_API_KEY'] },
  { key: 'cerebras', nombre: 'Cerebras', categoria: 'Inteligencia', descripcion: 'IA gratis y MUY rápida (Llama en su chip). Rota cuando Gemini se queda sin cuota.', envs: ['CEREBRAS_API_KEY'] },
  { key: 'mistral', nombre: 'Mistral AI', categoria: 'Inteligencia', descripcion: 'IA europea con free tier, otra gratis para rotar sin gastar.', envs: ['MISTRAL_API_KEY'] },
  { key: 'openrouter', nombre: 'OpenRouter', categoria: 'Inteligencia', descripcion: 'Una key para decenas de modelos, varios gratis (sufijo ":free").', envs: ['OPENROUTER_API_KEY'] },  // ⚠️ ES BYOK DESDE EL 02/09/2026: la key la trae el CLIENTE.
  //
  // Estuvo marcada `soloPlataforma` con un porqué que sigue siendo cierto —la voz
  // es MEDIOS, US$0,045/min contra US$0,00067 del texto, 67×— y esa misma cifra es
  // la que lo dio vuelta: el dueño no puede costearla para todos. «Haz que cada
  // cliente traiga su api de eleven… no podemos nosotros costear eso.»
  //
  // ⚠️ Lo que NO deja de ser cierto, y por eso vive en el tutorial del campo: el
  // plan gratis de ElevenLabs es NO COMERCIAL. Una key en free tier produce audio
  // que no se puede poner en un anuncio, y eso no falla — sale bien.
  //
  // ⚠️ Y sacar el flag NO borra las filas que ya estaban. Medido el 02/09/2026:
  // ws1 y ws4 tenían cargada LA KEY DE MAKO en su propia fila, así que con BYOK
  // puesto habrían seguido gastando la cuenta de la casa con cara de conexión
  // propia. Se borraron a mano, y para que no vuelvan hay dos guardas:
  // `NO_MIGRAR_A_WS` (el boot) y `esCredencialDeLaCasa` en datos-mau (la copia).
  { key: 'elevenlabs', nombre: 'ElevenLabs', categoria: 'IA Generativa', descripcion: 'Voz por IA: clona tu voz y la pisa sobre los clips de Flow. Corre con tu cuenta.', envs: ['ELEVENLABS_API_KEY'] },
  // OJO: esta lista y la de lib/metodo-catalogo.ts tienen que coincidir EXACTO en los
  // `env`. Si no, credWs() devuelve null en silencio y la integración se ve cargada pero
  // no funciona — es el error clásico que la skill add-provider-integration advierte.
  { key: 'github', nombre: 'GitHub', categoria: 'Desarrollo', descripcion: 'Lee los commits de main para proponer cerrar las tareas de desarrollo ya hechas.', envs: ['GITHUB_TOKEN', 'GITHUB_REPO'], soloPlataforma: true },
  { key: 'fathom', nombre: 'Fathom', categoria: 'Reuniones', descripcion: 'Grabaciones y transcripciones de llamadas (Closing).', envs: ['FATHOM_API_KEY'] },
  { key: 'calendly', nombre: 'Calendly', categoria: 'Reuniones', descripcion: 'Agenda de reuniones (R1/R2) y asistencia.', envs: ['CALENDLY_API_TOKEN'] },
  // ⚠️ Cal.com es OTRO producto, no una variante de Calendly: otra empresa, otra API,
  // otra firma y otro payload. Un cliente que vende por Cal.com no tenía por dónde
  // conectar, y sus reservas no llegaban (24/08/2026, ws13).
  // El env que decide «conectada» es el SECRET del webhook, no la API key: la API key
  // sirve para leer la agenda y es opcional, mientras que sin secret no entra una sola
  // reserva. La tarjeta tiene que medir lo que hace funcionar la integración.
  { key: 'calcom', nombre: 'Cal.com', categoria: 'Reuniones', descripcion: 'Cada reserva de tu calendario entra sola al CRM, y si la cancelan se marca sola.', envs: ['CALCOM_WEBHOOK_SECRET'] },
  // Google Calendar: no se mide por env — GOOGLE_CLIENT_ID/SECRET son la app
  // OAuth de la agencia (siempre puesta), así que chequearlos diría "conectada"
  // para todos sin que nadie haya autorizado su agenda. Se mide por señal REAL
  // (ver estadoGoogleCalendar), como la landing.
  { key: 'google', nombre: 'Google Calendar', categoria: 'Reuniones', descripcion: 'Cruza las reuniones de tu agenda para detectar juntas automáticamente.', envs: [] },
  // Whop: la plataforma donde el cliente ve los videos del programa. De acá se
  // lee el AVANCE, nunca las respuestas de la tarea — su API no tiene endpoint
  // para leerlas (verificado 2026-08-11). Ver el comentario de lib/whop.ts.
  { key: 'whop', nombre: 'Whop', categoria: 'Contenido', descripcion: 'El programa en video, y quién completó cada clase.', envs: ['WHOP_API_KEY'] },
  { key: 'panda', nombre: 'Panda Video', categoria: 'Datos', descripcion: 'Métricas de reproducción del VSL.', envs: ['PANDA_API_KEY'] },
  { key: 'youtube', nombre: 'YouTube', categoria: 'Datos', descripcion: 'Views del VSL alojado en YouTube.', envs: ['YOUTUBE_API_KEY'] },
  // Supabase NO va acá: es la infra de la plataforma, no una integración que el
  // cliente conecte (y su credencial no puede vivir dentro de la propia base).
  // Landing: no se mide por env ni por credencial — se mide por señal REAL (ver
  // estadoLanding). El usuario no pega credenciales: copia un <script> con su
  // token y lo pega donde tenga la landing (Lovable, Framer, Webflow, WP…).
  // ⚠️ ACÁ ESTABA MICROSOFT CLARITY, y se fue el 06/10/2026: la grabación de cada
  // visita la hace MaKo (lib/replay-*), atada al lead y sin mandarle los datos de
  // los visitantes de un cliente a un tercero. Pedido de Martín: «no quiero saber
  // nada más de clarity, quiero que MaKo haga todo». Era además la ÚNICA entrada
  // con `oculto`: el mecanismo queda (es genérico) y hoy no lo usa ninguna.
  { key: 'landing', nombre: 'Pixel de MaKo', categoria: 'Datos', descripcion: 'Mide las visitas, los videos y los clics de tu página, esté donde esté.', envs: [] },
  // Claude: como la landing, no se configura con una API key — se instala una skill del
  // lado del usuario y se conecta con un token. Su estado se mide por señal REAL (¿generó
  // el token?), no por env (ver estadoAgente).
  //
  // ⚠️ SE LLAMA «Claude», NO «Claude Code». La skill es un archivo de texto y funciona en
  // cualquier Claude que lea skills, no solo en el de la terminal — y el que la usa no
  // está programando: está avanzando su funnel. Nombrarla por una de las dos puertas
  // dejaba afuera a la mayoría de los clientes, que no programan.
  { key: 'agente', nombre: 'Claude', categoria: 'Agentes', descripcion: 'Claude trabaja con tu negocio adentro: tu oferta, tu cliente, tus razones y tu plan.', envs: [] },
];

/**
 * Qué integraciones ve alguien. PURA a propósito: es la regla que decidió mal dos veces
 * seguidas, así que tiene su test (tests/integraciones-visibles.test.ts).
 *
 * OJO CON EL ORDEN. Las de PLATAFORMA NO pasan por el filtro de la capa. La capa
 * responde «¿qué tipo de negocio corre este workspace?» —por eso al super-admin le
 * esconde Publicidad y Mensajería— y esa pregunta no aplica al token del repo.
 *
 * Los dos errores, para que no vuelvan:
 *  1. Sin `soloPlataforma`, GitHub le aparecía a Mauricio: su capa es `completo` y ahí
 *     `categoriasIntegraciones` es null, o sea TODAS.
 *  2. Con `soloPlataforma` pero filtrando por capa primero, desaparecía para el
 *     super-admin: GitHub está en 'Desarrollo' y su capa solo lista Inteligencia,
 *     IA Generativa, Agentes, Reuniones y Datos. Quedaba invisible para todo el mundo.
 */
export function defsVisibles(defs: Def[], o: { cats: string[] | null; ocultas: Set<string>; esSuper: boolean }): Def[] {
  const dePlataforma = defs.filter((d) => d.soloPlataforma);
  const delNegocio = defs.filter((d) => !d.soloPlataforma);
  return [
    ...(o.esSuper ? dePlataforma : []),
    ...(o.cats == null ? delNegocio : delNegocio.filter((d) => o.cats!.includes(d.categoria))),
    // `oculto` NO es lo mismo que `ocultas`: aquello es una preferencia del
    // workspace (qué tarjetas no quiere ver) y esto es una propiedad de la
    // integración — una que no tiene tarjeta propia y ningún workspace puede
    // hacerla aparecer. (La única que lo usaba era Clarity, que se fue el
    // 06/10/2026.)
  ].filter((d) => !d.oculto && !o.ocultas.has(d.key));
}

/** Solo para los tests: el catálogo tal cual. */
export const DEFS_TEST = DEFS;

