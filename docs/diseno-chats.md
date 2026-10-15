# Chats — la bandeja unificada copiada de respond.io

> Pedido de Martín (14/10/2026), literal: «Implementar la tab "Chats" algo como "https://respond.io"
> para tener en UNA sola tab centralizado absolutamente todos los chats, WhatsApp, Instagram,
> Messenger, etc... Revisa si hay proyectos similares o algun repositorio similar y copialo, sobre
> todo el diseño que se vea bien».

Este documento es el PLANO: los contratos que comparten la pantalla, los datos y la plataforma. Lo
que se aprendió construyéndolo va a `docs/hallazgos-comunicacion.md` («Chats: la bandeja
unificada»).

## 0. Qué se copia y de dónde

- **El diseño es el de respond.io, tal cual** (regla de la casa: una app nombrada se copia igual, no
  «inspirada en»). Ningún repo open source se le parece (relevados 20, con licencia leída): el diseño
  se escribe nosotros con los tokens `--dls-*` de su CSS público
  (`cdn.respond.io/platform/web/assets/build/main-*.css`), medidos además píxel a píxel sobre sus
  capturas oficiales del help center.
- **Código de referencia** (MIT, mismo stack): `zernio-dev/unified-inbox` (lista omnicanal, insignia
  de canal, `capabilities.ts`) y `melgarafael/DeskcommCRM` (asignar/cerrar). Se leen; si se copia un
  archivo, conserva el aviso de copyright MIT.
- **Lo que NO se copia de respond.io** y por qué (va también en el comentario del archivo):
  llamadas (no hay canal de voz), Team Inbox / Custom Inbox con filtros avanzados (v2), traducción,
  snippets con «/» y variables «$» (v2), @menciones (v2), colaboradores (v2), merge de contactos
  (en MaKo el contacto ES el lead y se une por `lead_id`/teléfono, no por sugerencias).
- **Desvío deliberado de color**: la IA de respond.io es violeta (`#7370FF`); en MaKo la IA es
  **MaKo** y su color es `--mako` (dorado, «nadie define otro dorado»). Todo lo demás, los tokens
  exactos de respond.io.

## 1. El modelo: el CONTACTO, no el canal

respond.io gira en torno al contacto: sus canales van juntos en un solo hilo y el composer elige
por cuál responder. En MaKo el contacto es el **lead**:

- Una conversación de la lista = un contacto. Su `clave`:
  - `lead:<leadId>` si tiene lead: junta TODAS sus identidades (WhatsApp en cada línea donde hay
    historial + sus filas de Instagram/Messenger con ese `lead_id`).
  - Sin lead: `wa:<linea>:<tel10 o jid>` · `ig:<ig_conversaciones.id>` · `fb:<ig_conversaciones.id>`.
- ⚠️ La clave de un contacto sin lead CAMBIA cuando se agrega al CRM (pasa a `lead:<id>`): su estado
  (cerrada/pospuesta) y su marca de leído quedan en la clave vieja. Aceptado y documentado.
- Una identidad de canal (`IdentidadCanal`) es «por dónde se le puede escribir»: el selector de
  canal del composer las lista («WhatsApp (Ventas) · +52 55…», «Instagram · @usuario»).

## 2. Contratos (los tres equipos codifican contra ESTO)

### 2.1 Tipos — `lib/chats-tipos.ts` (puro: sin `server-only`, lo importan cliente y servidor)

```ts
export type CanalChat = 'whatsapp' | 'instagram' | 'messenger';
export type EstadoChat = 'abierta' | 'cerrada' | 'pospuesta';
export type FormatoMsg = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'otro';

export type IdentidadCanal = {
  canal: CanalChat;
  /** whatsapp: instance_name de la línea · instagram/messenger: zernio_account_id */
  cuenta: string | null;
  /** 'WhatsApp (Ventas)' · 'Instagram' · 'Messenger' */
  rotulo: string;
  /** '+52 55 1234 5678' · '@usuario' · null */
  destino: string | null;
  /** whatsapp: chatJid · instagram/messenger: ig_conversaciones.id (string) */
  ref: string;
  /** whatsapp: dígitos del teléfono (para el POST de envío) · social: null */
  telefono: string | null;
  ultimaFecha: string | null;
  /** WhatsApp: true salvo bloqueado. Social: decidirSalida (ventana de 24 h o respuesta privada). */
  puedeEscribir: boolean;
  /** Por qué no (corto, para el selector): 'Ventana de 24 h cerrada', 'Bloqueado'. */
  motivoNoEscribir: string | null;
  bloqueado: boolean;
};

export type ChatResumen = {
  clave: string;
  leadId: number | null;
  nombre: string;
  empresa: string | null;
  /** Teléfono para la foto de WhatsApp (proxy ?avatarimg=). null = iniciales. */
  avatarTel: string | null;
  /** Al menos una. Ordenadas por última actividad, la más reciente primero. */
  canales: IdentidadCanal[];
  /** Canal del último mensaje: la insignia del avatar en la fila. */
  canalUltimo: CanalChat;
  ultimoTexto: string | null;
  ultimoTipo: FormatoMsg | null;
  ultimaFecha: string | null;
  /** El último mensaje lo mandó el contacto (flecha ↙ naranja) o nosotros (↗ azul). */
  ultimoEntrante: boolean;
  etapaKey: string | null;
  etapaLabel: string | null;
  /** El asignado = `leads.setter` (un NOMBRE, o 'MaKo'). Sin lead: null. */
  asignado: string | null;
  closer: string | null;
  estado: EstadoChat;
  pospuestaHasta: string | null;
  /** Hay entrantes posteriores a MI marca de leído (por usuario, en el servidor). */
  sinLeer: boolean;
  /** Hay un borrador de MaKo pendiente de enviar para este contacto. */
  borrador: boolean;
  bloqueado: boolean;
};

export type ParteTexto = { t: string; b?: boolean };

export type MensajeChat = {
  /** 'wa:<id>' | 'ig:<id>' | 'nota:<id>' | 'ev:<id>' | 'audit:<id>' — único en el hilo. */
  id: string;
  tipo: 'mensaje' | 'comentario' | 'evento';
  /** null para comentario y evento. */
  canal: CanalChat | null;
  /** La línea o la cuenta por la que pasó. */
  cuenta: string | null;
  saliente: boolean;
  /** comentario: quién lo escribió · evento: el actor · mensaje: null (o el autor en un grupo). */
  autor: string | null;
  texto: string | null;
  formato: FormatoMsg;
  mediaUrl: string | null;
  mediaMime: string | null;
  fecha: string; // ISO
  status: 'sent' | 'delivered' | 'read' | 'failed' | null;
  error: string | null;
  /** Sólo tipo 'evento': el texto en partes, las negritas marcadas («Cerrada por **Martín**»). */
  partes?: ParteTexto[];
};

export type BorradorChat = { id: number; texto: string; linea: string | null; createdAt: string; origen: string | null };

export type EtapaChat = { key: string; label: string; color: string };

export type CuentaSocial = { canal: 'instagram' | 'messenger'; cuenta: string; rotulo: string };
export type LineaChat = { linea: string; rotulo: string; estado: string; esDefault: boolean };
```

### 2.2 Endpoints nuevos — `app/api/chats/**` (equipo DATOS)

Todos con sesión: `getRolWsEfectivo` (401/403) + `tabEnCapa('chats', getCapaActual())` (404),
molde `app/api/calendario/ia/route.ts`. Errores: `{ ok:false, error }` con 4xx/5xx.

| Pedido | Respuesta |
|---|---|
| `GET /api/chats` | `{ ok, chats: ChatResumen[], lineas: LineaChat[], cuentasSociales: CuentaSocial[], etapas: EtapaChat[], yo: { id:number, nombre:string }, equipo: { nombre:string, foto_url:string\|null }[], fallas: string[] }` — `fallas` = fuentes que NO se pudieron leer (`'whatsapp:<linea>'`, `'instagram'`, `'estado'`…). «No pude leer» es un tercer estado, nunca «no hay chats». |
| `GET /api/chats?buscar=<q>` (≥2 caracteres) | `{ ok, chats: ChatResumen[] }` — leads del CRM y personas de Instagram/Messenger que matchean, aunque no tengan mensajes (como hoy `buscarLeadsComoPlaceholders`). |
| `GET /api/chats/hilo?clave=<clave>` | `{ ok, chat: ChatResumen\|null, mensajes: MensajeChat[], borradores: BorradorChat[] }` — junta los mensajes de TODAS las identidades + las notas del lead (`tipo:'comentario'`) + los eventos (`chat_eventos` y los cambios de etapa/asignado de `lead_audit`), en orden ascendente por fecha. |
| `GET /api/chats/contacto?leadId=<id>` | `{ ok, lead: { id, nombre, telefono, email, empresa, instagram, etapaKey, etapaLabel, setter, closer, origen, createdAt, etiquetas: {nombre,color}[] } }` |
| `POST /api/chats/estado` `{ clave, accion:'cerrar'\|'reabrir'\|'posponer'\|'reanudar'\|'leido', hasta?:ISO, nota?:string }` | `{ ok }` — cerrar/reabrir/posponer/reanudar escriben `chat_estado` + un `chat_eventos`; `leido` escribe `chat_leidos` del usuario. |
| `POST /api/chats/asignar` `{ leadId, setter: string\|null }` | `{ ok }` — por el MISMO camino que el CRM (`saveLeadMeta`/su lib), así el CRM lo ve. |
| `POST /api/chats/etapa` `{ leadId, etapa }` | `{ ok }` o `{ ok:false, necesitaFicha:true }` cuando la etapa pide datos (la hora de una reunión): la pantalla abre la ficha. Por el MISMO choke point que el CRM. |
| `POST /api/chats/comentario` `{ leadId, texto }` | `{ ok }` — una nota del lead (`addLeadNote`, la misma del CRM). Sin lead no hay comentario: primero «Agregar al CRM». |
| `POST /api/chats/social` `{ convId:number, texto }` | `{ ok, mensaje: MensajeChat }` o `{ ok:false, error, terminal? }` — DM manual por Zernio (`decidirSalida` → `enviarDm`/respuesta privada) + fila `saliente` en `ig_mensajes`. Sólo texto en v1. |
| `POST /api/chats/lead` `{ convId:number, funnelId:number\|null }` | `{ ok, leadId }` — crea el lead de una persona de Instagram/Messenger y la une por `lead_id` (nunca por teléfono). |

### 2.3 Endpoints que se REUSAN (no se duplican)

- **Enviar por WhatsApp**: `POST /api/whatsapp/evolution/mensajes` — JSON `{ chat, telefono, texto, leadId, linea }`
  o multipart (`chat, telefono, leadId, caption, tipo:''|'audio', linea, archivo` ≤ 4 MB). Devuelve
  `{ ok, chatJid }`. **Siempre con `linea`** (la de la identidad elegida).
- **Foto de WhatsApp**: `GET /api/whatsapp/evolution/mensajes?avatarimg=<dígitos>` (el `Avatar` de `_shared`).
- **Borradores de MaKo**: `POST /api/whatsapp/evolution/borradores { id, action:'enviar'|'descartar' }`.
- **Bloquear/ocultar/sincronizar**: `POST /api/whatsapp/evolution/block { telefono, action, leadId?, chat?, linea? }`.
- **Agregar al CRM (WhatsApp)**: `BotonAgregarAlCrm` + `crearLeadDesdeWhatsappAction(nombre, telefono, funnelId)`.
- **Ficha del lead**: `LeadEditModal` (`dynamic(..., { ssr:false })`, `{ leadId, onClose }`).
- **Conectar Instagram/Messenger**: `POST /api/zernio` (sólo admin) — `estado` / `conectar`.
- **Conectar WhatsApp**: la pantalla `/whatsapp` (QR, líneas, «Chatbot: ON/OFF»).

### 2.4 Funciones de servidor — `lib/chats.ts` (equipo DATOS; las usan las rutas y la API de MaKo)

```ts
export async function listarChats(opts?: { buscar?: string; usuario?: { id: number; nombre: string } }): Promise<{ chats: ChatResumen[]; lineas: LineaChat[]; cuentasSociales: CuentaSocial[]; etapas: EtapaChat[]; fallas: string[] }>;
export async function hiloDeChat(clave: string): Promise<{ chat: ChatResumen | null; mensajes: MensajeChat[]; borradores: BorradorChat[] }>;
export async function cambiarEstadoChat(clave: string, accion: 'cerrar' | 'reabrir' | 'posponer' | 'reanudar', opts: { actor: string; hasta?: string; nota?: string }): Promise<void>;
export async function marcarChatLeido(clave: string, usuarioId: number): Promise<void>;
```

Lo puro (claves, agrupar por contacto, estado efectivo, filtros, conteos del panel) va en
`lib/chats-reglas.ts`, sin `server-only`, con tests.

### 2.5 Estado — migración `0275_chats.sql`

- `chat_estado (workspace_id, clave, estado 'abierta'|'cerrada', cerrada_at, cerrada_por, nota_cierre, pospuesta_hasta, pospuesta_at, updated_at)` PK `(workspace_id, clave)`.
- `chat_leidos (workspace_id, usuario_id, clave, leido_at)` PK `(workspace_id, usuario_id, clave)`.
- `chat_eventos (id, workspace_id, clave, tipo, actor, detalle jsonb, created_at)`.
- Las tres en `TENANT_TABLES` (`lib/workspace.ts`) y en `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts`).

**Estado efectivo** (puro, `estadoEfectivo`): una conversación cerrada se REABRE sola si entra un
mensaje del contacto después de `cerrada_at` (respond.io: «Conversation opened by Contact»); una
pospuesta vuelve a abierta al vencer `pospuesta_hasta` o si entra un mensaje después de
`pospuesta_at`. Nada escribe en el webhook: se calcula al leer.

## 3. La pantalla — `app/chats/`

Scope CSS propio **`.rio`** (como `.gh`, `.lk`, `.ce`): variables `--rio-*` adentro de `.rio`, el
oscuro en `[data-tema="oscuro"] .rio`, ningún selector de elemento pelado, los portales dentro de la
raíz (AGENTS.md «portales dentro del scope»). Fuente Inter (la de respond.io) con `next/font`.

```
┌ MaKo sidebar ┐┌ Bandeja 214 ┐┌ Lista 298 ┐┌ Ventana del chat (flex) ┐┌ Drawer 349 ┐┌ rail 44 ┐
```

| Archivo | Qué | Equipo |
|---|---|---|
| `page.tsx` | guard `requireCapa('chats')` + `guardOnboarding()`; rol, productos, ws | PANTALLA-1 |
| `ChatsApp.tsx` | raíz `.rio`, grilla, estado (lista, selección, filtros, drawer), sondeo de la lista (15 s, sólo con la pestaña visible), URL `?c=<clave>` y `?lead=<id>` | PANTALLA-1 |
| `PanelBandejas.tsx` | «Bandeja»: Todos · Míos · Sin asignar · sección MaKo (Atiende MaKo · Borradores) · Canales (cada línea, Instagram, Messenger) · Etapa · pie Bloqueados; contadores | PANTALLA-1 |
| `ListaChats.tsx` | pestaña «Chats», filtro «Abiertas, Más recientes ⌄», interruptor «Sin responder», buscador, filas de 3 líneas | PANTALLA-1 |
| `PanelContacto.tsx` | drawer + rail: Contacto (datos, Canales, Etiquetas, «Abrir ficha»), Actividad | PANTALLA-1 |
| `chats.css` | tokens `--rio-*` + layout de bandeja, lista, drawer | PANTALLA-1 |
| `iconos-canal.tsx` | insignias SVG de WhatsApp, Instagram, Messenger | PANTALLA-1 |
| `VentanaChat.tsx` | cabecera (etapa, asignado, posponer, Cerrar/Reabrir, ⋯) + hilo + composer; sondeo del hilo (8 s) | PANTALLA-2 |
| `Hilo.tsx` | burbujas respond.io, eventos centrados, chip de fecha fijo, ticks, adjuntos | PANTALLA-2 |
| `Composer.tsx` | selector de canal, MaKo, emoji, voz, adjuntar, enviar, «Agregar comentario» (modo durazno), borrador de MaKo arriba | PANTALLA-2 |
| `chats-ventana.css` | estilos de la ventana (usa los `--rio-*` de `chats.css`) | PANTALLA-2 |

**Props de `VentanaChat`** (el contrato entre PANTALLA-1 y PANTALLA-2):

```ts
export type VentanaChatProps = {
  ws: number | null;
  chat: ChatResumen;
  yo: { id: number; nombre: string };
  equipo: { nombre: string; foto_url: string | null }[];
  etapas: EtapaChat[];
  productos: ProductoAlta[]; // el mismo tipo que pide BotonAgregarAlCrm
  esAdmin: boolean;
  drawerAbierto: boolean;
  onToggleDrawer: () => void;
  /** Algo cambió (envío, cierre, asignación, etapa): la lista se vuelve a leer. */
  onCambio: () => void;
  onAbrirFicha: (leadId: number) => void;
  /** La conversación cambió de clave (se agregó al CRM: pasa a lead:<id>). */
  onClaveCambio: (nueva: string) => void;
};
```

`VentanaChat` se monta con `key={chat.clave}`, y el `Composer` adentro también con `key` por clave:
una nota de voz grabada en A no puede salir al contacto B (tests/whatsapp-sexta-tanda.test.ts:319).

## 4. Plataforma (equipo PLATAFORMA)

- `nav.ts`: `{ key:'chats', label:'Chats', href:'/chats', icon:'chats', rolesWs:['closer','setter'] }`
  PRIMERO en el bloque de conversaciones de Operate. **WhatsApp sigue en el menú** hasta que Martín
  valide que Chats lo reemplaza (decisión pendiente, ver §6).
- Capas: `chats` entra donde hoy está `whatsapp` (listas explícitas de `lib/capas.ts`); los permisos
  por usuario que dicen `whatsapp` habilitan también `chats` (si existe ese mecanismo).
- Badge del Sidebar: `chats` muestra el mismo `unreadTotal` que `whatsapp`.
- Toast de mensaje nuevo (`NotificationsProvider`) y los links muertos `?lead=` → `/chats`.
- **Links profundos** (los resuelve `ChatsApp` contra la lista): `/chats?c=<clave>` ·
  `/chats?lead=<id>` (abre `lead:<id>`) · `/chats?linea=<instance>&chat=<jid>` (busca el chat cuya
  identidad de WhatsApp tiene ese `ref` y esa `cuenta`). Un link que no matchea NO abre otra
  conversación (la trampa de `?lead=` en la bandeja vieja): espera a la próxima lectura y, si no
  aparece, no selecciona nada.
- API de MaKo: área `chats` (lecturas sin canal `http`; cerrar/reabrir/posponer con confirmación;
  NINGUNA operación manda un mensaje: regla de la casa). Regenerar `docs/api-mako.md`, snapshot y `plugin/`.
- `/admin/dev`: ficha del área, bitácora con el pedido literal, fila en la barra de dev.
- `tests/sin-instagram.test.ts`: la cabecera dice la verdad nueva (la bandeja de Instagram vuelve
  ADENTRO de Chats, 14/10) sin perder el sentido del guard; los archivos nuevos que leen
  `ig_conversaciones` van por funciones exportadas de `lib/canal-zernio.ts` (ya es del `CANAL`).
- Teléfono: `/chats` cae en «se usa en la computadora», igual que `/whatsapp` hoy (v2: `/m/chats`).

## 5. Copy (español neutro, «tú», textos cortos)

| respond.io | Chats |
|---|---|
| Inbox | Bandeja |
| All · Mine · Unassigned | Todos · Míos · Sin asignar |
| AI Agents | MaKo (Atiende MaKo · Borradores) |
| Lifecycle | Etapa |
| Blocked Contacts | Bloqueados |
| Chats (pestaña) | Chats |
| All, Newest · Unreplied | Abiertas, Más recientes · Sin responder |
| Show: All/Open/Closed/Snoozed · Sort: Newest/Oldest | Mostrar: Todas/Abiertas/Cerradas/Pospuestas · Orden: Más recientes/Más antiguas |
| Select Stage | Elegir etapa |
| Close · Open · Close with notes · Closing Notes | Cerrar · Reabrir · Cerrar con nota · Nota de cierre |
| Snooze until… · Unsnooze | Posponer hasta… · Reanudar |
| Assign · Unassign | Asignar · Quitar asignación |
| AI Assist | MaKo |
| Add comment · «Comments are only visible to your team» | Agregar comentario · «Solo lo ve tu equipo» |
| Contact details · Activities · Channels · Contact fields · Tags | Contacto · Actividad · Canales · Datos · Etiquetas |
| Today · Yesterday | Hoy · Ayer |
| Sent · Delivered · Read · Failed | Enviado · Entregado · Leído · Fallido |

## 6. Decisiones tomadas por defecto (Martín puede reabrirlas)

1. **WhatsApp sigue en el menú** al lado de Chats hasta que se valide; después `/whatsapp` queda
   sólo para conectar números (QR, líneas, «Chatbot: ON/OFF») y sale del menú.
2. **Asignado = `leads.setter`** (una cosa, un lugar: el CRM ya lo tiene y lo ve igual). Un contacto
   sin lead no se asigna hasta agregarlo al CRM.
3. **Comentario = nota del lead** (la misma del CRM). Sin lead, primero «Agregar al CRM».
4. **Instagram y Messenger: sólo texto** al responder a mano en v1, y sólo dentro de la ventana de
   24 h (o la respuesta privada a un comentario). Sin `HUMAN_AGENT` (no verificado por Zernio).
5. **No leído por persona, en el servidor** (`chat_leidos`), no en el navegador.
6. Las conversaciones de un mismo lead en varios canales van en UN hilo (el modelo de respond.io).
