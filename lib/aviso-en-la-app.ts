// =============================================================================
// aviso-en-la-app — algo para el equipo o el negocio que queda en la app: la fila de la bandeja y el push
// =============================================================================
// Lo usa el bot para avisarle a Martín que alguien escribió o que pide una persona (lib/mako-bot.ts). El push va a quienes administran.
//
// Devuelve si quedó en alguna parte. La fila es lo que cuenta: el push es best-effort y puede no tener a quién.
// =============================================================================

import 'server-only';
import { crearNotificacion } from './notificaciones';
import { enviarPush } from './push';

const RUTA_AVISOS = '/m/inbox?vista=avisos';

/** La primera línea, sin marcas de WhatsApp: es el título de la fila y del push. */
function primeraLinea(texto: string): string {
  const l = texto.split('\n').map((x) => x.replace(/[*_~`]/g, '').replace(/━+/g, '').trim()).find(Boolean) ?? 'MaKo';
  return l.length > 80 ? `${l.slice(0, 79)}…` : l;
}

export async function avisoSoloEnLaApp(ws: number, texto: string, o: { tipo?: string; titulo?: string } = {}): Promise<boolean> {
  const tipo = o.tipo ?? 'mako-mensaje';
  const titulo = o.titulo ?? primeraLinea(texto);
  const feedId = await crearNotificacion({ ws, tipo, severidad: 'info', titulo, descripcion: texto, link: RUTA_AVISOS, entityType: 'aviso', payload: { texto }, origen: `app:${tipo}` });
  const r = await enviarPush(ws, { tipo, titulo, cuerpo: texto, ruta: RUTA_AVISOS, tag: `${tipo}:${Date.now().toString(36)}`, ttl: 6 * 3600, soloAdmins: true });
  if (r.fallidos || r.motivo === 'error') console.warn(`[aviso-en-la-app] ${tipo} (ws ${ws}): push ${JSON.stringify(r)}`);
  return feedId != null || r.enviados > 0;
}
