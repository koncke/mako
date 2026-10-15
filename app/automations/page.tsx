// =============================================================================
// Chatbot — el cockpit del agente que conversa: secuencias con estrategia, prueba
// en vivo y métricas. Spec: docs/superpowers/specs/2026-07-31-tab-setting-design.md
// Sin gate de integración a propósito: las secuencias de mensajes se diseñan ANTES de conectar
// canales; los pasos de prueba/activación avisan qué falta.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { esWsPlataforma } from '@/lib/api-mako/areas/integraciones.helpers';
import { getSettingEstricto } from '@/lib/settings';
import { horarioVigente, KEY_HORARIO_ENVIO } from '@/lib/horario-envio';
import { zonaDelNegocioDetalle } from '@/lib/timezone';
import { ChatAgentApp } from './ChatAgentApp';
import { PlataformaProvider } from './plataforma';
import { HorarioOficinaProvider, type HorarioOficina } from './horario-oficina';

/**
 * EL HORARIO DE OFICINA DEL NEGOCIO, para la tarjeta «MaKo en WhatsApp» (15/10/2026): lo mismo que lee Configuraciones ›
 * Horario (`getHorarioEnvioAction`), una vez para todo el lienzo. Sin poder leerlo, null: la tarjeta no ofrece lo que no
 * se sabe (el motor, aparte, no manda fuera de un horario que no pudo leer).
 */
async function horarioOficina(ws: number | null): Promise<HorarioOficina | null> {
  if (ws == null) return null;
  try {
    const [raw, zona] = await Promise.all([getSettingEstricto(KEY_HORARIO_ENVIO), zonaDelNegocioDetalle(ws).then((d) => d.tz)]);
    return { horario: horarioVigente(raw), zona };
  } catch {
    return null;
  }
}

export default async function Page() {
  await requireRolWs(['setter'], { nav: 'setting' });
  // ¿Es el ws de la plataforma? Lo que sólo existe ahí (el evento de una persona, la plantilla de SuperAdmin) se
  // ofrece sólo ahí. Sin poder saberlo, no (`esWsPlataforma` es fail-closed).
  const ws = await getWorkspaceActual().catch(() => null);
  const [plataforma, oficina] = await Promise.all([ws != null ? esWsPlataforma(ws) : Promise.resolve(false), horarioOficina(ws)]);
  return (
    <PlataformaProvider valor={plataforma}>
      <HorarioOficinaProvider valor={oficina}><ChatAgentApp /></HorarioOficinaProvider>
    </PlataformaProvider>
  );
}
