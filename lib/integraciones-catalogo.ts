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

// 25/10/2026, Martín (docs/feedback-25-10-tarde.md): «Fijate los nombres, no inventes nombres como "MaKo AI", pon los nombres
// correctamente» → el NOMBRE REAL de cada producto («Anthropic API», «OpenAI API», «Resend»). Y «elimina las IA dentro de las
// integraciones, para eso tenemos el bloque que dice "Tus cuentas de IA" arriba del todo»: las cuatro IA van `oculto` (no son
// tarjetas de la grilla; se conectan desde «Tus cuentas de IA», con el MISMO modal: `getIntegracion` no mira `oculto`).
// «Depreca Hotmart, Skool... Elimina Apify» (mismo día): salieron, con su ruta y su API. «Elimina la de Google Calendar»:
// `oculto`, porque la agenda sigue (ver su entrada).
export const DEFS: Def[] = [
  { key: 'meta', nombre: 'Meta Ads', categoria: 'Publicidad', descripcion: 'Campañas, insights y estado de la cuenta publicitaria.', envs: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], tieneDetalle: true },
  // WhatsApp (Chatwoot) salió el 09/10/2026: ver tests/sin-chatwoot.test.ts.
  { key: 'email', nombre: 'Resend', categoria: 'Mensajería', descripcion: 'Envío de emails de nutrición y reportes.', envs: ['RESEND_API_KEY'] },
  // Instagram y Messenger como canales de las automatizaciones (09/10/2026, sexta tanda): salió el
  // 06/10 con la tab y vuelve como canal. BYOK SIN respaldo de plataforma desde el 23/10/2026 (lib/zernio.ts): cada
  // negocio con SU key de Zernio. Desde esa fecha también conecta Facebook y los anuncios de Meta (lib/zernio-conectar.ts).
  { key: 'zernio', nombre: 'Facebook, Instagram y anuncios (Zernio)', categoria: 'Mensajería', descripcion: 'Conecta tu Facebook, Instagram y anuncios de Meta con tu cuenta de Zernio.', envs: ['ZERNIO_API_KEY'] },
  // IA = BYOK por cliente (ya NO global): cada workspace usa su propia key y su
  // gasto corre contra su cuenta. Para el dueño, credWs cae al env de respaldo.
  { key: 'anthropic', nombre: 'Anthropic API', oculto: true, categoria: 'Inteligencia', descripcion: 'Tu Claude: con tu clave, MaKo trabaja solo con tu cuenta (contesta, escribe y analiza). Sirve el crédito de API de Claude Max.', envs: ['ANTHROPIC_API_KEY'] },
  { key: 'openai', nombre: 'OpenAI API', oculto: true, categoria: 'Inteligencia', descripcion: 'Tu GPT: con tu clave, MaKo trabaja solo con tu cuenta, escucha audios y mira fotos.', envs: ['OPENAI_API_KEY'] },
  { key: 'groq', nombre: 'Groq API', oculto: true, categoria: 'Inteligencia', descripcion: 'Pasa a texto tus notas de voz. Con tu Claude, tu GPT o tu Gemini conectado, no se usa.', envs: ['GROQ_API_KEY'] },
  { key: 'gemini', nombre: 'Gemini API', oculto: true, categoria: 'Inteligencia', descripcion: 'Tu Gemini: con tu clave de AI Studio, MaKo trabaja solo con tu cuenta, lee documentos largos y busca en tu conocimiento.', envs: ['GEMINI_API_KEY'] },
  // IA8 (22/10/2026): Cerebras, Mistral y OpenRouter se sacaron (0, 0 y 12 llamadas útiles en 30 días). Sus filas
  // guardadas en `credenciales` quedan huérfanas e inertes: borrarlas es SQL, y la Cerebras del ws1 la decide Martín.  // ⚠️ ES BYOK DESDE EL 02/09/2026: la key la trae el CLIENTE.
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
  // La pasarela de pagos (11/10/2026, docs/diseno-pasarela-pagos.md). BYOK: cada negocio pega SU
  // clave, y MaKo se vende con la del workspace de la plataforma, pegada aquí como la de cualquiera.
  // Las `envs` son lo que hace FUNCIONAR el cobro, no sólo la clave: sin la cuenta (el ruteo) y sin
  // la firma del aviso, un link se crea bien y su pago no vuelve nunca al CRM — que es lo mismo que
  // dice `credStripe` en lib/cobros.ts. La firma del aviso de Mercado Pago no está: es opcional
  // (la relectura del pago con el token es lo que protege; ver lib/metodo-catalogo.ts).
  // Son ALTERNATIVAS y opcionales: sin configurar no piden atención ni bajan el medidor
  // (app/integraciones/IntegracionesBoard.tsx).
  { key: 'stripe', nombre: 'Stripe', categoria: 'Pagos', descripcion: 'Cobra con un link de pago y cada pago entra solo a tu CRM.', envs: ['STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT_ID', 'STRIPE_WEBHOOK_SECRET'] },
  { key: 'mercadopago', nombre: 'Mercado Pago', categoria: 'Pagos', descripcion: 'Cobra en tu moneda con un link de Mercado Pago y cada pago entra solo a tu CRM.', envs: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_USER_ID'] },
  // ⚠️ ACÁ ESTABAN Hotmart, Skool y Apify (el Leads Scraper del 14/10/2026): se fueron el 25/10/2026, Martín: «Depreca
  // Hotmart, Skool... Elimina Apify». Medido antes, en producción: 0 claves, 0 ruteos, 0 leads y 0 búsquedas.
  // Ver tests/leads-scraper-retirado.test.ts.
  // Google Calendar: no se mide por env — GOOGLE_CLIENT_ID/SECRET son la app
  // OAuth de la agencia (siempre puesta), así que chequearlos diría "conectada"
  // para todos sin que nadie haya autorizado su agenda. Se mide por señal REAL
  // (ver estadoGoogleCalendar), como la landing.
  // `oculto` desde el 25/10/2026 (Martín: «Elimina la de Google Calendar, entiendo que cuando se registran con Google ya le
  // podríamos preguntar esos permisos»): la agenda se conecta donde se usa (Calendario, el CRM) y, con la app de Google
  // verificada, al entrar con Google (`GOOGLE_LOGIN_CON_AGENDA`, app/api/auth/google/route.ts). Las agendas ya conectadas
  // siguen: el estado, el modal suelto (`getIntegracion` no mira `oculto`) y `?abrir=google` andan igual.
  { key: 'google', nombre: 'Google Calendar', oculto: true, categoria: 'Reuniones', descripcion: 'Cruza las reuniones de tu agenda para detectar juntas automáticamente.', envs: [] },
  // ⚠️ ACÁ ESTABA LA PLATAFORMA DE CURSOS DE TERCEROS, y se fue el 06/10/2026
  // («que utilicemos directamente MaKo»). El curso vive en MaKo: las clases, los
  // videos (link o subido al bucket `curso-videos`), cuánto vio cada cliente y sus
  // tareas (mig 0202, lib/curso*.ts). No se vuelve a conectar una plataforma
  // externa para eso: lo que su API no dejaba leer —las respuestas de la tarea—
  // era justo lo que el avance de etapa necesita. El porqué completo, con el
  // nombre del proveedor, en docs/hallazgos-customer-success.md. Con esto la
  // categoría «Contenido» quedó sin tarjetas: el tablero no dibuja una vacía.
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
 * responde «¿qué tipo de negocio corre este workspace?» —hasta el 08/10/2026 le
 * escondía Publicidad y Mensajería al super-admin— y esa pregunta no aplica al token
 * del repo.
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

// ── El orden de las categorías (24/10/2026) ──────────────────────────────────────────────────────────────────────────
// El de /integraciones (su desplegable y cada sección, app/integraciones/IntegracionesBoard.tsx) y el del teléfono
// (app/m/configuraciones/integraciones/page.tsx): el mismo. Hasta el 24/10 vivía en el tablero como `CAT_ORDER` y además
// hacía de LISTA BLANCA: una categoría que no estaba ahí no se pintaba, sin ningún error (GitHub y Whop quedaron invisibles
// por eso). Ya no filtra: una categoría nueva va al final, en orden alfabético, y agregar una integración sigue siendo tres
// registros más el logo.
// 'Pagos' (Stripe y Mercado Pago, 11/10/2026) va después de Mensajería: es lo que cierra la venta que las dos de arriba empezaron.
export const ORDEN_CATEGORIAS = ['Publicidad', 'Mensajería', 'Pagos', 'Inteligencia', 'IA Generativa', 'Agentes', 'Reuniones', 'Contenido', 'Datos', 'Desarrollo'] as const;

/** El lugar de una categoría: las que no están en ORDEN_CATEGORIAS, al final (y entre ellas, como las ordene quien llama). */
export function ordenCategoria(cat: string): number {
  const n = (ORDEN_CATEGORIAS as readonly string[]).indexOf(cat);
  return n < 0 ? ORDEN_CATEGORIAS.length : n;
}
