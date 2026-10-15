// =============================================================================
// Chatbot — el cockpit del agente que conversa: secuencias con estrategia, prueba
// en vivo y métricas. Spec: docs/superpowers/specs/2026-07-31-tab-setting-design.md
// Sin gate de integración a propósito: las secuencias de mensajes se diseñan ANTES de conectar
// canales; los pasos de prueba/activación avisan qué falta.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { esWsPlataforma } from '@/lib/api-mako/areas/integraciones.helpers';
import { ChatAgentApp } from './ChatAgentApp';
import { PlataformaProvider } from './plataforma';

export default async function Page() {
  await requireRolWs(['setter'], { nav: 'setting' });
  // ¿Es el ws de la plataforma? Lo que sólo existe ahí (el evento de una persona, la plantilla de SuperAdmin) se
  // ofrece sólo ahí. Sin poder saberlo, no (`esWsPlataforma` es fail-closed).
  const ws = await getWorkspaceActual().catch(() => null);
  const plataforma = ws != null && (await esWsPlataforma(ws));
  return <PlataformaProvider valor={plataforma}><ChatAgentApp /></PlataformaProvider>;
}
