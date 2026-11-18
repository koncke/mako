'use client';

// =============================================================================
// «Usar la plantilla» de la apertura de Image (18/11/2026, F18; lib/aperturas/image.ts → `image:sugerida`)
// =============================================================================
// La plantilla real sugerida para el lugar elegido entra en la página como desde el panel «Diseño» (`applyTemplate`, sin IA), en
// un paso de deshacer, y el diseño recuerda de qué plantilla nació (`conPlantilla`). Va aparte del chat: lo que aplica una
// PROPUESTA del chat vive en ./chat/acciones.ts, en UN lugar (tests/image-editor-chat.test.ts, 20).
// =============================================================================

import type { EditorEngine } from '../_doory/editor/extensions';
import { applyTemplate } from '../_doory/editor/panels/templateOps';
import { migrateDocument } from '../_doory/editor/engine/migrations';
import { sugeridaDe, type AccionImage } from '@/lib/aperturas/image';
import { PREFIJO_PLANTILLA_REAL, conPlantilla } from '@/lib/image-editor/reglas';

/** Pone la sugerida de `familia` en la página abierta. false si no hay sugerida o no entra (el tope de páginas). */
export function usarPlantillaSugerida(editor: EditorEngine, familia: AccionImage | null): boolean {
  const s = familia ? sugeridaDe(familia) : null;
  if (!s) return false;
  const aplicada = applyTemplate(editor.getDocument(), editor.state.activePageId, migrateDocument(s.estructura()), 'replace');
  if (!aplicada) return false;
  editor.applyDocument(conPlantilla(aplicada.doc, `${PREFIJO_PLANTILLA_REAL}${s.id}`), { label: 'Aplicar plantilla', activePageId: aplicada.activePageId });
  return true;
}
