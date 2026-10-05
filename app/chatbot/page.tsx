// =============================================================================
// Chatbot — el cockpit del agente que conversa: secuencias con estrategia, prueba
// en vivo y métricas. Spec: docs/superpowers/specs/2026-07-31-tab-setting-design.md
// Sin gate de integración a propósito: las secuencias de mensajes se diseñan ANTES de conectar
// canales; los pasos de prueba/activación avisan qué falta.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { ChatAgentApp } from './ChatAgentApp';

export default async function Page() {
  await requireRolWs(['setter'], { nav: 'setting' });
  return <ChatAgentApp />;
}
