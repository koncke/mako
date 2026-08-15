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
export type Def = { key: string; nombre: string; categoria: string; descripcion: string; envs: string[]; tieneDetalle?: boolean; global?: boolean; soloPlataforma?: boolean };

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
  { key: 'openrouter', nombre: 'OpenRouter', categoria: 'Inteligencia', descripcion: 'Una key para decenas de modelos, varios gratis (sufijo ":free").', envs: ['OPENROUTER_API_KEY'] },
  { key: 'elevenlabs', nombre: 'ElevenLabs', categoria: 'IA Generativa', descripcion: 'Voz por IA: locuciones y audio generativo con tu propia key.', envs: ['ELEVENLABS_API_KEY'] },
  // OJO: esta lista y la de lib/metodo-catalogo.ts tienen que coincidir EXACTO en los
  // `env`. Si no, credWs() devuelve null en silencio y la integración se ve cargada pero
  // no funciona — es el error clásico que la skill add-provider-integration advierte.
  { key: 'github', nombre: 'GitHub', categoria: 'Desarrollo', descripcion: 'Lee los commits de main para proponer cerrar las tareas de desarrollo ya hechas.', envs: ['GITHUB_TOKEN', 'GITHUB_REPO'], soloPlataforma: true },
  { key: 'fathom', nombre: 'Fathom', categoria: 'Reuniones', descripcion: 'Grabaciones y transcripciones de llamadas (Closing).', envs: ['FATHOM_API_KEY'] },
  { key: 'calendly', nombre: 'Calendly', categoria: 'Reuniones', descripcion: 'Agenda de reuniones (R1/R2) y asistencia.', envs: ['CALENDLY_API_TOKEN'] },
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
  ].filter((d) => !o.ocultas.has(d.key));
}

/** Solo para los tests: el catálogo tal cual. */
export const DEFS_TEST = DEFS;

