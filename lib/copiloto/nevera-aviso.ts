// =============================================================================
// Marketing CoPilot — la nevera avisa SOLA (14/11/2026)
// =============================================================================
// Martín a Julio (llamada del 13/11, min 00:14:34): si te quedas sin contenido, MaKo «te va mandando mensajes por WhatsApp y por
// email». Hasta hoy el aviso sólo nacía como tarea del Plan cuando alguien ABRÍA /ads-manager/copiloto (el useEffect de CoPilot.tsx):
// sin abrir la pantalla, no pasaba nada. Esto lo hace el cron diario (app/api/cron/copiloto-nevera), negocio por negocio:
//   1. lee la nevera con el ritmo que respondió en el CoPilot (./nevera.ts; sin ritmo no hay aviso: no se inventa cuánto publica);
//   2. pone en el Plan las tareas de la semana (la MISMA clave que la pantalla: ./tareas.ts → tareasDeLaNevera);
//   3. avisa por la línea de MaKo y por email (`copiloto-nevera` en lib/avisos-catalogo.ts, que el negocio puede apagar o dejar en
//      un solo canal desde Notificaciones). Una vez por semana y por juego de formatos: la huella lleva el lunes.
// =============================================================================

import 'server-only';
import { emitirAviso } from '@/lib/avisos';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { leerNevera } from './nevera';
import { huellaAvisoNevera, lunesDe, textoAvisoNevera } from './nevera-reglas';
import { tareasDeLaNevera } from './tareas';
import { sincronizarConElPlan } from './tareas-plan';

/** Una semana: con la misma huella (lunes + formatos) no se repite; el lunes siguiente es otra huella. */
const TTL_MIN = 60 * 24 * 7;

export type ResultadoAvisoNevera = { ws: number; avisos: number; tareas: number; enviado: boolean; email: boolean; motivo?: string };

export async function avisarNevera(ws: number): Promise<ResultadoAvisoNevera> {
  const perfil = await leerPerfilCopiloto(ws);
  if (perfil.ritmo == null) return { ws, avisos: 0, tareas: 0, enviado: false, email: false, motivo: 'sin ritmo en el CoPilot' };
  const nevera = await leerNevera(ws, perfil);
  const lunes = lunesDe(nevera.hoy);
  const { tareas, resueltas } = tareasDeLaNevera({ lunes, avisos: nevera.avisos });
  // El Plan, aunque nadie abra la pantalla: crea lo que falta esta semana y cierra lo que ya se cubrió.
  await sincronizarConElPlan(ws, tareas, resueltas);
  const msg = textoAvisoNevera(nevera.avisos);
  if (!msg) return { ws, avisos: 0, tareas: 0, enviado: false, email: false, motivo: 'la nevera alcanza' };
  const r = await emitirAviso({
    tipo: 'copiloto-nevera',
    dedupKey: huellaAvisoNevera(lunes, nevera.avisos),
    dedupTtlMin: TTL_MIN,
    titulo: msg.titulo,
    texto: msg.texto,
    categoria: 'aviso',
    semaforo: 'amarillo',
    link: '/ads-manager/copiloto?tarjeta=instagram',
    ws,
  });
  return {
    ws, avisos: nevera.avisos.length, tareas: tareas.length, enviado: r.wa, email: !!r.email,
    motivo: r.deduped ? 'ya avisado esta semana' : r.apagado ? 'apagado en Notificaciones' : r.waError,
  };
}
