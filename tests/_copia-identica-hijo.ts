// =============================================================================
// Hijo de tests/web-generator-copia-identica.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/editor-landing/html-editable-seguro.ts lleva `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server`, sanea lo que le llega por argv (un JSON) y le contesta al test con otro JSON.
// =============================================================================

import { sanearEditablesDe, sanearEnvoltorios, sanearHtmlEditable } from '../lib/editor-landing/html-editable-seguro';
import type { LandingContenido } from '../lib/editor-landing/doc';

const e = JSON.parse(process.argv[2] ?? '{}') as { html?: string; envoltorios?: unknown; contenido?: LandingContenido };
process.stdout.write(JSON.stringify({
  html: sanearHtmlEditable(e.html ?? ''),
  envoltorios: sanearEnvoltorios(e.envoltorios),
  ...(e.contenido ? { contenido: sanearEditablesDe(e.contenido) } : {}),
}));
