// =============================================================================
// grupo-reglas — quién entra al grupo de un negocio y qué ve (lo PURO, 3/11/2026)
// =============================================================================
// El grupo de MaKo dentro de la app: uno por negocio, con invitados de otros negocios. Acá sólo el juicio sobre datos ya leídos: la
// lectura vive en lib/grupo-puerta.ts. SIN `server-only` a propósito, con el criterio de lib/agencia-cartera.ts: la condición que
// abre los datos de un inquilino a otra persona tiene que poder preguntarse en un test sin base.
//
// ⚠️ SE AUTORIZA A LA PERSONA, NO AL WORKSPACE. Y en positivo: hace falta una razón para entrar; sin ninguna, no entra.
// =============================================================================

import { administraActivo } from './agencia-equipo-grupo';
import { esAvisoParaAgencia } from './avisos-catalogo';

export const TOPE_INVITADOS = 30;
/** Cuántos mensajes viajan por pedido. */
export const POR_PAGINA = 60;
/** Por persona y por minuto. El limitador es por instancia: corta un bucle, no un ataque repartido. */
export const TOPE_MENSAJES_POR_MINUTO = 30;
/** Cuántos turnos de MaKo gasta un invitado por día, con la IA del negocio dueño del grupo. Contado en la base. */
export const TOPE_TURNOS_INVITADO_POR_DIA = 60;
export const TOPE_INVITACIONES_POR_HORA = 20;
export const AVISO_DE_INVITACION_CADA_MS = 24 * 3600_000;
/** Lo que un mensaje espejado puede tardar en llegar y seguir sonando: lo viejo que reentrega Evolution al reconectar, no. */
export const PUSH_DEL_ESPEJO_HASTA_MS = 10 * 60_000;

/** Lo que se le dice a quien invita. */
export const FRASE_AL_INVITAR = 'Ve lo que cae en este grupo desde hoy, también avisos de ventas y cobros, y puede hablar con MaKo aquí. No entra al resto del negocio.';

/** El nombre del grupo: el mismo del grupo de WhatsApp. */
export const tituloDelGrupo = (nombre: string): string => `MaKo <> ${(nombre ?? '').trim()}`;
/**
 * El nombre para un INVITADO, sin el prefijo `MaKo <>`: el nombre del negocio lo controla el inquilino, y «MaKo <> Soporte de MaKo»
 * con mail de MaKo sirve para pedirle una clave a otro cliente. La identidad de MaKo la da el producto, no un texto del negocio.
 */
export const tituloParaInvitado = (nombre: string, abrio: boolean): string => (abrio ? `Grupo de ${(nombre ?? '').trim()}` : `Invitación de ${(nombre ?? '').trim()}`);
/** El mail a quien todavía no tiene cuenta en MaKo: quién invita, y que el grupo le aparece al entrar con ese email. Sin el nombre del negocio de nadie más. */
export const textoInvitacionSinCuenta = (quien: string): string =>
  `${quien.trim() || 'Alguien'} te invitó a su grupo de MaKo. Cuando entres a MaKo con este email, lo vas a ver arriba de todo.`;

export type TipoDeAcceso = 'admin' | 'agencia' | 'invitado' | 'soporte';
export type AccesoJuzgado = { tipo: TipoDeAcceso; administra: boolean; desdeId: number };
/** Lo que hay que saber de la persona, leído de `usuarios` en este pedido. */
export type PersonaLeida = { id: number; rol?: string | null; rol_ws?: string | null; estado?: string | null; workspace_id?: number | null };

/**
 * LA CONDICIÓN. En positivo, con cuatro razones y nada más. null = no entra, y a quien no entra se le contesta 404, siempre el mismo.
 *
 * ⚠️ `esPlataforma` true también si NO se pudo saber cuál es la plataforma: ese grupo trae datos de todos los clientes, y en la duda
 * entra sólo quien tiene el rol global.
 * ⚠️ `agenciasAprobadas` null = no se pudo leer: ese camino dice que no, y los otros siguen.
 */
export function juzgarAcceso(e: {
  ws: number; esPlataforma: boolean; negocioPausado: boolean;
  persona: PersonaLeida | null;
  invitacion: { desdeId: number } | null;
  agenciasAprobadas: readonly number[] | null;
}): AccesoJuzgado | null {
  const p = e.persona;
  if (!p || !Number.isSafeInteger(p.id) || p.id <= 0) return null;
  if (p.estado === 'suspendido') return null;
  const esGlobal = p.rol === 'admin';
  // EL GRUPO DE LA PLATAFORMA NO ES UNO MÁS: recibe los avisos `alDueno` y las respuestas al equipo de VARIOS negocios, y su turno corre
  // con `plataforma: true`. Ni invitados ni nadie sin el rol global, aunque sea admin de ese workspace.
  if (e.esPlataforma) return esGlobal ? { tipo: 'soporte', administra: false, desdeId: 0 } : null;
  // Por soporte: entra a cualquiera, no figura como participante y no recibe push. Es el único que entra a un negocio pausado.
  if (esGlobal) return { tipo: 'soporte', administra: true, desdeId: 0 };
  if (e.negocioPausado) return null;
  if (Number(p.workspace_id) === e.ws && administraActivo(p)) return { tipo: 'admin', administra: true, desdeId: 0 };
  // La agencia: se calcula en cada pedido, así que revocar la cartera la saca sola. Closer y setter de la agencia, no.
  if (p.workspace_id != null && administraActivo(p) && (e.agenciasAprobadas ?? []).includes(Number(p.workspace_id))) return { tipo: 'agencia', administra: true, desdeId: 0 };
  if (e.invitacion && Number.isFinite(e.invitacion.desdeId)) return { tipo: 'invitado', administra: false, desdeId: e.invitacion.desdeId };
  return null;
}

export type LetraGrupo = 'm' | 'i';
/** `m` (corre con todo) sólo con la prueba positiva; cualquier otra cosa, `i`. */
export const letraDeAcceso = (a: AccesoJuzgado | null): LetraGrupo => (a && a.tipo !== 'invitado' ? 'm' : 'i');

// ── La identidad de la app en el mensaje del doer ─────────────────────────────────────────────────────────────

const PARTICIPANTE = /^(.+)#([mi])@app\.mako$/;
/**
 * QUIÉN ESCRIBE EN LA APP, en el `participant` del mensaje. Va ahí y no en un campo nuevo porque los dos sintéticos del lote ya lo
 * copian (un campo nuevo se pierde en todo lote: ya pasó con `participant`). Sale de la SESIÓN, nunca del teléfono del perfil, que se
 * edita a mano: `telefonoDelParticipante` no lo reconoce, así que no hay DEBUG ni computadora del dueño por un dato que escribe la persona.
 */
export const participanteDeApp = (email: string, letra: LetraGrupo): string => `${email.trim().toLowerCase()}#${letra}@app.mako`;
/** ⚠️ Anclada al final: `EMAIL_RE` acepta `#`, y un `x#m@y.com` leído por el primer `#` correría con todas las herramientas. */
export function leerParticipanteDeApp(p: string | null | undefined): { email: string; letra: LetraGrupo } | null {
  const m = PARTICIPANTE.exec(String(p ?? '').trim());
  return m ? { email: m[1], letra: m[2] as LetraGrupo } : null;
}

// ── Las filas ─────────────────────────────────────────────────────────────────────────────────────────────────

export type TipoAdjuntoGrupo = 'imagen' | 'pdf' | 'audio';
export type AdjuntoGrupo = { tipo: TipoAdjuntoGrupo; path: string | null; nombre?: string; mime?: string; bytes?: number; secs?: number };
export type FilaGrupo = {
  id: number; workspace_id: number; autor_tipo: 'persona' | 'mako' | 'equipo' | 'sistema'; usuario_id: number | null; autor_nombre: string;
  canal: 'app' | 'whatsapp'; texto: string; adjunto: AdjuntoGrupo | null; responde_a: number | null; reaccion: string | null;
  aviso_tipo: string | null; wa_message_id: string | null; wa_at?: string | null; cliente_id?: string | null; created_at: string;
};

/** ¿Es un archivo de este grupo? El `path` no viene de afuera, y aun así se mira antes de firmar. */
export const esPathDelGrupo = (ws: number, path: unknown): path is string =>
  typeof path === 'string' && path.startsWith(`grupos/${ws}/`) && !path.includes('..');

/**
 * El autor de una persona. Se puede llamar «MaKo» en su perfil o en su pushName, y en un hilo donde MaKo habla eso sirve para pedir
 * una clave: la identidad de MaKo la da sólo `autor_tipo`. El teléfono nunca: lo leería alguien de otro negocio.
 */
export function autorDePersona(nombre: string | null | undefined, sinNombre = 'Alguien'): string {
  const n = String(nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!n || /^\+?\d[\d\s()-]{6,}$/.test(n)) return sinNombre;
  return /^(hola[\s,]+)?mako\b/iu.test(n.normalize('NFD').replace(/\p{Diacritic}/gu, '')) ? `${n.slice(0, 100)} (persona)` : n;
}

/** Las URLs a MaKo de un texto, para un INVITADO: abrirían SU negocio. El resto lo ve igual. */
export function sinLinksParaInvitado(texto: string, hosts: readonly string[]): string {
  if (!texto) return texto;
  const unidos = hosts.map((h) => h.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|');
  if (!unidos) return texto;
  return texto.replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:${unidos})(?:\\/[^\\s<>]*)?`, 'gi'), '(en MaKo)');
}

/** ¿Esta fila la puede ver un invitado? Los avisos «a la agencia» (cuenta frenada de un cliente) no: es lo que Martín prohibió el 31/10. */
export const laVeUnInvitado = (f: Pick<FilaGrupo, 'id' | 'aviso_tipo'>, desdeId: number): boolean =>
  f.id > desdeId && !(f.aviso_tipo && esAvisoParaAgencia(f.aviso_tipo));

export type MensajeDelHilo = {
  id: number;
  autor: { tipo: FilaGrupo['autor_tipo']; nombre: string; propio: boolean };
  canal: FilaGrupo['canal'];
  texto: string;
  adjunto: { tipo: TipoAdjuntoGrupo; nombre: string | null; mime: string | null; bytes: number | null; secs: number | null; listo: boolean } | null;
  respondeA: number | null;
  reaccion: string | null;
  avisoTipo: string | null;
  creadoEn: string;
};

/** Lo que viaja al navegador. Sin el `path` del archivo (se pide por la ruta, que comprueba al miembro), sin el id de WhatsApp, sin ids de usuario. */
export function filaAlHilo(f: FilaGrupo, quien: { usuarioId: number; invitado: boolean; hosts: readonly string[] }): MensajeDelHilo {
  const a = f.adjunto;
  return {
    id: Number(f.id),
    autor: { tipo: f.autor_tipo, nombre: f.autor_nombre, propio: f.autor_tipo === 'persona' && Number(f.usuario_id) === quien.usuarioId },
    canal: f.canal,
    texto: quien.invitado ? sinLinksParaInvitado(f.texto, quien.hosts) : f.texto,
    adjunto: a ? { tipo: a.tipo, nombre: a.nombre ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, secs: a.secs ?? null, listo: !!a.path } : null,
    respondeA: f.responde_a == null ? null : Number(f.responde_a),
    reaccion: f.reaccion ?? null,
    avisoTipo: f.aviso_tipo ?? null,
    creadoEn: f.created_at,
  };
}

/** Lo que el hilo guarda como texto porque no lo dibuja (`copiarAlGrupo`), y lo que dice su eco (lib/grupo-espejo.ts): el mismo video o archivo, con otras palabras. */
const ARCHIVO_COMO_TEXTO = /\((?:un video|video en WhatsApp|un archivo(?:: [^)]*)?|archivo en WhatsApp(?:: [^)]*)?)\)$/;
/** El texto de un mensaje para comparar la copia con su eco: lo que no es contenido no cuenta. Sin igualar los archivos, una tarjeta con video salía con una burbuja de más. */
export const textoParaComparar = (t: string | null | undefined): string => String(t ?? '').trim().replace(ARCHIVO_COMO_TEXTO, '(archivo)').replace(/\s+/g, ' ').trim();

/**
 * El mensaje de la app con la forma del de WhatsApp (molde: la acción «probar» de /api/admin/mako-doer). Sin base64: el doer lo baja de
 * Storage por su id (`fetchMediaBase64EnInstancia`, lib/mako-doer-in.ts). La cita viaja en el `contextInfo` que leen `citaDe`, `citaDelMensaje`
 * y `audioCitadoDe`, con el id de WhatsApp si la fila lo tiene.
 */
export function msgDeFila(f: FilaGrupo, o: { clave: string; email: string; letra: LetraGrupo; nombre: string; citada?: FilaGrupo | null }): {
  key: { remoteJid: string; id: string; fromMe: boolean; participant: string }; pushName: string; message: Record<string, unknown>;
} {
  const contextInfo = o.citada ? {
    stanzaId: o.citada.wa_message_id ?? `app:${o.citada.id}`,
    ...(o.citada.autor_tipo === 'mako' ? {} : { participant: 'alguien@app.mako' }),
    quotedMessage: o.citada.adjunto?.tipo === 'audio'
      ? { audioMessage: { mimetype: o.citada.adjunto.mime ?? 'audio/mpeg', ...(o.citada.adjunto.secs ? { seconds: o.citada.adjunto.secs } : {}) } }
      : { conversation: o.citada.texto },
  } : undefined;
  const conCita = contextInfo ? { contextInfo } : {};
  const a = f.adjunto;
  let message: Record<string, unknown>;
  if (a?.tipo === 'audio') message = { audioMessage: { mimetype: a.mime ?? 'audio/mpeg', ...(a.secs ? { seconds: a.secs } : {}) }, ...conCita };
  else if (a?.tipo === 'imagen') message = { imageMessage: { mimetype: a.mime ?? 'image/jpeg', ...(f.texto ? { caption: f.texto } : {}) }, ...conCita };
  else if (a?.tipo === 'pdf') message = { documentMessage: { mimetype: 'application/pdf', fileName: a.nombre ?? 'archivo.pdf', ...(f.texto ? { caption: f.texto } : {}) }, ...conCita };
  else if (contextInfo) message = { extendedTextMessage: { text: f.texto, contextInfo }, contextInfo };
  else message = { conversation: f.texto };
  return { key: { remoteJid: o.clave, id: `app:${f.id}`, fromMe: false, participant: participanteDeApp(o.email, o.letra) }, pushName: o.nombre, message };
}

/** ¿Lo nombra? La misma regla que el doer (`nombraAMaKo`, lib/mako-doer-in.ts), que no se puede importar acá: lo nombra al principio. */
export const nombraAMaKoEnElTexto = (texto: string): boolean => /\bmako\b/.test(texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().slice(0, 60));

/** Lo que se le pasa a la cola del doer. */
export const tieneMediaLaFila = (f: Pick<FilaGrupo, 'adjunto'>): boolean => f.adjunto?.tipo === 'imagen' || f.adjunto?.tipo === 'pdf';
export const tieneAudioLaFila = (f: Pick<FilaGrupo, 'adjunto'>): boolean => f.adjunto?.tipo === 'audio';
