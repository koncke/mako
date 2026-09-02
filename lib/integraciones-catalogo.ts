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
  { key: 'openrouter', nombre: 'OpenRouter', categoria: 'Inteligencia', descripcion: 'Una key para decenas de modelos, varios gratis (sufijo ":free").', envs: ['OPENROUTER_API_KEY'] },
  // ⚠️ `soloPlataforma` DESDE QUE EXISTE `lib/elevenlabs.ts`. La voz clonada del
  // cliente la produce la cuenta de la PLATAFORMA, no la suya: la voz es MEDIOS
  // —US$0,045/min contra US$0,00067 del texto, 67× y en grupos distintos a
  // propósito— y el repo ya tiene escrito que cualquier diseño de imagen o video
  // que asuma la key del cliente está muerto antes de empezar. Encima el plan
  // gratis de ElevenLabs es NO COMERCIAL, así que una key de cliente en free tier
  // produce audio que no se puede poner en un anuncio.
  //
  // ⚠️ Y ESCONDER LA TARJETA NO BORRA LAS FILAS QUE YA ESTÁN. Medido el
  // 02/09/2026: hay filas de `ELEVENLABS_API_KEY` en cuatro workspaces, y tres de
  // ellos —ws1, ws4 y ws9— resuelven a LA MISMA key. `credWs` a secas las sigue
  // encontrando. Por eso `elevenKey()` resuelve siempre contra `wsSuperAdmin()`.
  { key: 'elevenlabs', nombre: 'ElevenLabs', categoria: 'IA Generativa', descripcion: 'Voz por IA: clona la voz del cliente y la pisa sobre los clips de Flow.', envs: ['ELEVENLABS_API_KEY'], soloPlataforma: true },
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
  // Clarity va SEPARADO del Pixel a propósito, aunque los dos vivan en el mismo
  // <script>. Son dos preguntas distintas: el Pixel siempre está (es nuestro y no
  // se puede apagar) y Clarity es OPCIONAL y con la cuenta del cliente. Fundirlos
  // haría que apagar uno apague el otro, y que el semáforo de la medición propia
  // dependa de una credencial ajena.
  //
  // El PROJECT_ID no es un secreto: viaja en el HTML de la página del cliente,
  // como cualquier pixel. El TOKEN de la Data Export API sí lo es —da acceso de
  // lectura a las métricas de ese proyecto— y por eso va por guardarCredencial(),
  // cifrado y por workspace. Nunca en el código ni en una env de la plataforma:
  // cada cliente trae el suyo.
  // ⚠️ `oculto`: Clarity NO tiene tarjeta propia en la grilla. Su configuración
  // vive DENTRO del modal del Pixel, como primer paso opcional — es el mismo
  // <script>, así que una tarjeta aparte obligaría a instalar dos veces y a
  // entender que son dos cosas. Sigue en el catálogo porque es lo que le dice a
  // la ruta de credenciales qué campos acepta.
  { key: 'clarity', nombre: 'Microsoft Clarity', categoria: 'Datos', descripcion: 'Mapas de calor y grabaciones de sesión de tu página, atados a cada lead.', envs: ['CLARITY_PROJECT_ID', 'CLARITY_API_TOKEN'], oculto: true },
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
    // integración — Clarity no tiene tarjeta porque se configura DENTRO del
    // modal del Pixel, y ningún workspace puede hacerla aparecer.
  ].filter((d) => !d.oculto && !o.ocultas.has(d.key));
}

/** Solo para los tests: el catálogo tal cual. */
export const DEFS_TEST = DEFS;

