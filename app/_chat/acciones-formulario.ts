'use client';

// =============================================================================
// Las acciones del formulario del chat: las MISMAS de /mako/revisar/<id> (20/10/2026, pieza 1.10)
// =============================================================================
// Confirmar o descartar adentro del chat va por `confirmarAccionAction` y `descartarAccionAction`, las de la pantalla de
// revisión: validan de nuevo contra los `parametros`, miran que quien confirma sea el admin (`ctxDeBandeja`), vuelven a
// preparar contra la base y, al terminar, anotan el resultado en el hilo de donde salió (lib/chat-hilo-origen.ts).
// Viven acá, aparte de FormularioEnChat.tsx, para que la pieza se dibuje en un test (el módulo lleva `server-only`).

import { confirmarAccionAction, descartarAccionAction } from '@/app/mako/revisar/[id]/acciones';
import type { AccionesFormulario } from './FormularioEnChat';

export const ACCIONES_FORMULARIO: AccionesFormulario = { confirmar: confirmarAccionAction, descartar: descartarAccionAction };
