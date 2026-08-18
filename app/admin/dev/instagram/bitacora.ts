// =============================================================================
// Instagram — el registro de construcción del área
// =============================================================================
// Alcance: el canal de Instagram del producto. La cuenta se conecta por Zernio
// (que envuelve la Graph API de Meta), los DMs entran por webhook firmado y se
// contestan como borrador del Chat Agent, y las publicaciones (feed, reel,
// story, carrusel) se programan con la programación nativa del proveedor.
// Vive en: app/instagram/, lib/zernio.ts, lib/ig-chatbot.ts, lib/ig-contenido.ts,
// app/api/webhooks/zernio/route.ts y la migración 0136.
//
// De dónde salió esto: los mensajes de commit de las dos corridas del 15/08 y de
// la evaluación de factibilidad del 14/08 (`git log` sobre esas rutas); las
// trampas del proveedor, en docs/hallazgos-comunicacion.md → «Zernio: el canal
// Instagram implementado» y «Instagram: lo que hay que saber antes de abrir el
// canal»; el guard de la key de plataforma, en docs/hallazgos-seguridad.md.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El canal detrás de UN proveedor', detalle: 'Zernio envuelve la Graph API · un profile de Zernio por workspace aísla los datos de cada cliente · BYOK con fallback de plataforma', estado: 'hecha' },
  { titulo: 'DMs → borrador del Chat Agent', detalle: 'Webhook HMAC fail-closed, ruteo por profileId acuñado por el server · el flag ig_auto_respuesta nace APAGADO', estado: 'hecha' },
  { titulo: 'Publicaciones programadas', detalle: 'Compositor de feed/reel/story/carrusel con la programación NATIVA de Zernio · sin cron propio', estado: 'hecha' },
  { titulo: 'Onboarding Zernio-first', detalle: 'Primero la decisión de cuenta (plataforma o key propia), después el OAuth de Instagram · la elección sale de señales vivas, nunca de un flag', estado: 'hecha' },
  { titulo: 'Las piezas de Content Machine caen acá', detalle: 'Reels, Carousels y Stories mandan lo generado a /instagram como borrador de contenido_posts con un clic', estado: 'hecha' },
  { titulo: 'BYOK completo (con su propio webhook)', detalle: 'Hoy el endpoint valida SOLO el secret de plataforma: el cliente con cuenta propia publica y envía, pero no recibe nada en tiempo real', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── julio: la promesa ──────────────────────────────────────────────────────
  {
    fecha: '1 jul', hora: '03:53', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab nace vacía: Instagram entra al sidebar como «coming soon»',
    puntos: [
      'Instagram apareció en el grupo **Chats** junto a WhatsApp y Email, con la vista de `ComingSoon` que se armó ese mismo día para las 10 features en desarrollo. Es la fecha en que el área existe como **promesa**: hay ruta, hay ícono y hay proyecto en el catálogo, y no hay una línea de canal.',
      'Sirve para leer todo lo de abajo: entre esta fecha y agosto el área fue **exactamente lo que decía el registro** —un ComingSoon con guard de rol—, y lo que cambió el 15/08 no fue una mejora sino el canal entero de una sentada.',
    ],
    commits: [{ sha: 'db038a13', msg: 'Sidebar en grupos + coming-soon + header de Graphics (feedback)', lineas: 227, archivos: 17 }],
  },

  // ── agosto: qué se sabía antes de escribir una línea ───────────────────────
  {
    fecha: '14 ago', hora: '23:15', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Antes de abrir el canal: qué NO se podía usar, y el bug de Chatwoot que sí existía',
    puntos: [
      '**ManyChat no es una arquitectura, es una demo.** Su propio contrato dice que una cuenta enlaza **un** canal de cada tipo, así que 30 clientes son 30 suscripciones (~US$870/mes anual), 30 API keys a mano, sin white-label ni OAuth. Y el timeout de External Request es de **10 segundos, no configurable**: no alcanza para un LLM con tool-use. Se descartó por eso, no por precio.',
      '**Chatwoot no distinguía de qué canal venía el mensaje**, y ese sí era un bug vivo: su webhook es uno para toda la cuenta, así que el día que entrara un inbox de Instagram cada DM iba a caer con el teléfono vacío y a disparar `wa-mensaje-entrante` —que es incondicional— rotulado como WhatsApp. El filtro se escribió en **positivo** (enumerar lo que NO es WhatsApp deja pasar cada canal nuevo) y los DOS valores de Instagram viven en `lib/chatwoot-canales.ts`, porque los inboxes legacy «Instagram via Facebook Login» emiten `Channel::FacebookPage` y el `instagram_id` que los desambigua **no viaja en el webhook**.',
      '⚠️ **`normalizarTelefono` acepta un IGSID sin chistar**: es numérico y de 17 dígitos, pasa el normalizador sin error y matchearía como teléfono. Es la razón por la que después el canal se construyó con tablas propias y el IGSID **nunca** pasa por el camino telefónico.',
      '**GOTCHA de investigación:** no se puede leer la doc de Meta con WebFetch a secas — `developers.facebook.com` se sirve geolocalizada en español y con el contenido dentro del payload JS, y el resumen devolvió enums que no existen. Agregarle `.md` a la URL devuelve el markdown fuente en inglés.',
      'La corrida fue **evaluación de factibilidad: no se tocó una línea del canal**. El commit lleva la cosecha porque el working tree ya la traía.',
    ],
    commits: [{ sha: '375768d7', msg: 'Chatwoot: filtrar por canal, y la autopsia del bug que no existía', lineas: 560, archivos: 7 }],
    archivos: ['docs/hallazgos-comunicacion.md → «Instagram: lo que hay que saber antes de abrir el canal»'],
  },

  // ── agosto: el canal ───────────────────────────────────────────────────────
  {
    fecha: '15 ago', hora: '01:38', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El canal entero detrás de un solo proveedor: DMs al Chat Agent y posts programados',
    puntos: [
      '⚠️ **El diagnóstico obvio era el equivocado, y era el spec.** `github.com/zernio-dev/openapi-specs` parece la fuente canónica y es una **trampa de nombre**: el `instagram.yaml` de ahí es el spec de la **Graph API de Meta** (server `graph.instagram.com`), porque el repo documenta las APIs que Zernio *envuelve*. Codear contra eso es codear contra Meta con otro nombre. Las fuentes reales son `docs.zernio.com/api/openapi` (OpenAPI 3.1, con la sección `webhooks` y los 49 eventos) y `docs.zernio.com/llms-full.txt`.',
      '**Dos mecanismos de idempotencia DISTINTOS según el endpoint**, y no es un detalle: inbox y profiles van con `Idempotency-Key` (replay del response original), pero posts van con `x-request-id` y el replay devuelve `200 {existingPost}` — **un shape distinto del `201` tipado, descrito solo en prosa**. El envío de borradores usa `Idempotency-Key: ig_borrador_<id>`, así un reintento replay-ea en Zernio en vez de duplicar el DM.',
      '**El IGSID jamás pasa por el camino telefónico.** Las conversaciones de IG van en tablas propias (mig 0136) y el `lead_id` se ata solo por vínculo manual — es la respuesta directa al hallazgo de la víspera sobre `normalizarTelefono`.',
      '`ig_auto_respuesta` **nace apagado**: el webhook genera el borrador del Chat Agent y una persona lo manda con un clic. Es la regla de la casa aplicada al canal nuevo — un canal PROPONE, una persona confirma.',
      '⚠️ **`attachments[].url` de Instagram EXPIRA**: es CDN de Meta firmada, guardarla es guardar un link muerto. Lo único persistible es `refreshUrl`. El corolario en la otra dirección: la URL firmada de la media de un post programado tiene que sobrevivir **hasta `programado_at`**, no 3600 s — acá se firma con +7 días de margen sobre la fecha.',
      '⚠️ **En un evento SALIENTE el `sender` es el NEGOCIO, no el lead.** El upsert de conversación tomaba `message.sender` también en `message.sent`: pisaba la identidad del participante con la de la propia cuenta del cliente, y el aviso habría dicho «@su_propia_cuenta escribió». El participante de un saliente sale de `conversation.participant*`, y los campos de identidad se escriben solo cuando HAY valor, para que un payload parcial no borre con `null` lo ya sabido.',
      "⚠️ **`'x' in OBJETO` matchea la cadena de prototipos** (`'toString' in {}` es `true`): un evento basura firmado caía al procesador de posts con `estado = Function`. Para un mapa literal usado como catálogo va `Object.hasOwn`.",
      '⚠️ **Queda vivo, y es estructural:** el endpoint del webhook valida SOLO el secret de PLATAFORMA. Un cliente con su propia cuenta de Zernio firma sus eventos con SU secret → 401 → **sus DMs entrantes y estados de post nunca entran**. No es fuga: es canal muerto para BYOK. Hoy la key propia sirve para lo SALIENTE y el tiempo real solo funciona con la de plataforma.',
      '⚠️ **La otra bomba dormida:** al conectar una cuenta, el inbox de Zernio trae hasta **500 conversaciones** de historia pre-conexión, ya leídas. El webhook no las ve, así que hoy no muerde; el día que se agregue un poll de backfill, tratarlas como nuevas dispara 500 borradores del chatbot y 500 avisos al dueño.',
    ],
    commits: [{ sha: '3bb7b466', msg: 'Instagram via Zernio: DMs al Chat Agent + publicaciones programadas', lineas: 3501, archivos: 19 }],
    archivos: [
      'lib/zernio.ts — el cliente BYOK (credWs con fallback de plataforma) y el profile por workspace',
      'lib/ig-chatbot.ts — el DM entrante se vuelve borrador del Chat Agent',
      'app/api/webhooks/zernio/route.ts — firma HMAC fail-closed y ruteo por profileId',
      'app/instagram/InboxDms.tsx · Publicaciones.tsx — la bandeja y el compositor',
      'supabase/migrations/0136_instagram_zernio.sql — las tablas propias del canal',
      'docs/hallazgos-comunicacion.md → «Zernio: el canal Instagram implementado (y sus trampas)»',
    ],
  },
  {
    fecha: '15 ago', hora: '10:44', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La consulta de estado ESCRIBÍA, y la key de la agencia entraba como key propia',
    puntos: [
      '⚠️ **`ensureProfile` materializaba la elección de cuenta con solo ABRIR la tab.** Bug reportado por el dueño: el cliente veía «Conectar Instagram» directo, sin que nadie le preguntara si operaba con la cuenta de la plataforma o con la suya. La causa es que **la CONSULTA de estado escribía**: `estadoConexionIg → listAccounts → profileIdEfectivo → ensureProfile` creaba el profile `mako_ws_<ws>` y su fila, o sea tomaba la decisión de plataforma en silencio con solo montar la page. **La regla: una lectura de estado no puede pasar por un camino que ESCRIBE.** Si la decisión no está resuelta por una señal VIVA (key propia o fila en `zernio_workspace`), no se toca la API y `cuenta` vuelve `null`.',
      'Detalle fino del mismo arreglo: para `OWNER_WS` la caída de `credWs` a env **no cuenta como key propia** — ese env ES la cuenta de plataforma. Y `estadoZernioIg` **lanza** ante un error de base: un fallo de infra no se puede leer como «sin resolver» ni reabrir pasos que el cliente ya cerró.',
      '⚠️ **El guard BYOK estaba bien escrito y era bypasseable igual: hay cinco caminos de guardado.** Pegar la key de la PLATAFORMA como key «propia» hacía que `cfg()` marcara `byok: true`, y BYOK **saltea el aislamiento por profile** (`profile_id NULL` → el profile **Default de la agencia**) — o sea, las cuentas y conversaciones de la agencia servidas a un cliente. El rechazo se movió al choke point: `guardarCredencial()` tira `KeyDePlataformaError` si un ws ≠ dueño guarda una clave de `BYOK_NUNCA_PLATAFORMA` con el valor exacto de la plataforma. **Es la misma regla del veto de Claude: cerrar cuatro caminos deja el quinto.**',
      'Y el corolario del reparto: las claves de plataforma pura quedan **excluidas de `migrarEnvACredenciales`**. La cuenta de Zernio es de MaKo, no del ws1 — que es `OWNER_WS` y es **un cliente**, no la plataforma.',
      'Las tres tabs de Content Machine (Reels, Carousels, Stories) dejaron de ser ComingSoon en la misma corrida, y lo que las ata a esta área es `lib/ig-contenido.ts`: toda pieza generada se manda a /instagram como **borrador** de `contenido_posts` con un clic. Los límites técnicos y la metodología viven en `lib/ig-formatos.ts`, citados por curso.',
    ],
    commits: [{ sha: 'a3d0ffb0', msg: 'Content Machine IG (Reels/Carousels/Stories) + onboarding Zernio-first', lineas: 3613, archivos: 29 }],
    archivos: [
      'app/instagram/ig-datos.ts — `estadoZernioIg`: las señales vivas que deciden si hay cuenta',
      'app/instagram/actions.ts — `conectarInstagramAction` y `guardarZernioKeyAction`: el que rechaza es el SERVER',
      'lib/credenciales.ts — `BYOK_NUNCA_PLATAFORMA` + `KeyDePlataformaError`, el choke point',
      'lib/ig-contenido.ts — el puente: la pieza generada entra como borrador de /instagram',
      'docs/hallazgos-seguridad.md → «Un guard BYOK que vive en UNA action no cubre la credencial»',
    ],
  },
];
