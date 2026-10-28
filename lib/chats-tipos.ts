// =============================================================================
// chats-tipos — los tipos de la tab Chats (la bandeja unificada copiada de respond.io)
// =============================================================================
// El CONTRATO entre la pantalla (app/chats/), los datos (lib/chats.ts, app/api/chats/**) y la API de
// MaKo. Es el §2.1 de docs/diseno-chats.md, al pie de la letra: tres equipos codifican contra esto en
// paralelo, así que un cambio acá se extiende (campos opcionales) y se avisa; nunca se cambia callado.
//
// Puro y sin `server-only`: lo importan el cliente y el servidor. Sólo tipos.
//
// El modelo es el de respond.io: una conversación de la lista es un CONTACTO, no un canal. Con lead,
// su clave es `lead:<id>` y junta todas sus identidades (WhatsApp en cada línea, Instagram, Messenger);
// sin lead, cada identidad es su propio contacto (`wa:<linea>:<id>`, `ig:<conv>`, `fb:<conv>`). Las
// claves las arma y las parsea lib/chats-reglas.ts.

// `email` desde el 17/10/2026 (Martín: «eliminar las tabs de Email y WhatsApp y unificarlo todo en Chats»): lo que llega
// y lo que se contesta por email, con su hilo y sus adjuntos (lib/chats-email.ts, mig 0312).
export type CanalChat = 'whatsapp' | 'instagram' | 'messenger' | 'email';
export type EstadoChat = 'abierta' | 'cerrada' | 'pospuesta';
export type FormatoMsg = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'otro';

export type IdentidadCanal = {
  canal: CanalChat;
  /** whatsapp: instance_name de la línea · instagram/messenger: zernio_account_id · email: el dominio del negocio (o null) */
  cuenta: string | null;
  /** 'WhatsApp (Ventas)' · 'Instagram' · 'Messenger' */
  rotulo: string;
  /** '+52 55 1234 5678' · '@usuario' · null */
  destino: string | null;
  /** whatsapp: chatJid · instagram/messenger: ig_conversaciones.id (string) · email: la dirección del contacto */
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
  /**
   * Dónde está su lead: su funnel (la casa) y cada funnel al que se lo agregó, con la etapa EN ESE funnel (27/10/2026,
   * Mauricio: el filtro sólo mostraba el funnel principal, y el Sprint no se podía elegir). Sin lead, vacío. Opcional: una
   * respuesta vieja no lo trae, y entonces el filtro cae a `etapaKey` (la etapa en su casa).
   */
  funnels?: EtapaEnFunnel[];
};

/** La etapa de un lead en UN funnel (su casa, o uno agregado por `lead_funnel`). */
export type EtapaEnFunnel = { funnelId: number; etapaKey: string };

/** Un funnel del negocio con sus etapas, para el filtro «Funnel» y «Etapa» de Chats. */
export type FunnelChat = { id: number; nombre: string; esDefault: boolean; etapas: EtapaChat[] };

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
  /** Sólo email: el asunto. */
  asunto?: string | null;
  /** Sólo email: sus adjuntos (un email trae varios; `url` firmada por 10 minutos, null si no se pudo bajar). */
  adjuntos?: AdjuntoChat[];
};

export type AdjuntoChat = { nombre: string; mime: string; url: string | null };

export type BorradorChat = { id: number; texto: string; linea: string | null; createdAt: string; origen: string | null };

export type EtapaChat = { key: string; label: string; color: string };

export type CuentaSocial = { canal: 'instagram' | 'messenger'; cuenta: string; rotulo: string };
export type LineaChat = { linea: string; rotulo: string; estado: string; esDefault: boolean };
