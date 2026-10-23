// =============================================================================
// Hijo de tests/editor-landing-html-editable.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/editor-landing/html-editable-seguro.ts lleva `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server`, sanea el HTML que le llega por argv y le contesta al test con un JSON.
// =============================================================================

import { sanearHtmlEditable } from '../lib/editor-landing/html-editable-seguro';

process.stdout.write(JSON.stringify({ limpio: sanearHtmlEditable(process.argv[2] ?? '') }));
