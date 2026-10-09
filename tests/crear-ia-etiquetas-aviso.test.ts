// =============================================================================
// Las etiquetas que crea «Crear con IA» se anuncian (app/chatbot/SecuenciaPerfil.tsx → alListoIA)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026). La ruta de IA crea las etiquetas en el
// SERVER (`crearNuevas`) antes de mandar `listo`. `alListoIA` sólo mostraba el toast, y la lista
// compartida (`useEtiquetasTodas`, app/_components/etiquetas-cliente.tsx) se vuelve a pedir SÓLO
// con `avisarCambioEtiquetas`: la tarjeta 🏷️ decía «una etiqueta», el CRON «Se le puso «una
// etiqueta»» y el selector mostraba «Una etiqueta que ya no está», deshabilitada. Pasaba en los dos
// modos (crear y editar), porque los dos pueden crear etiquetas.
//
// Dos capas: el guard del cableado (el llamado está en `alListoIA`, FUERA del if/else de los modos y
// antes del revelado) y el contrato de `avisarCambioEtiquetas` (dispara el evento que escuchan las
// listas abiertas).
//
// PROBADO ROMPIÉNDOLO (09/10/2026): sin la línea en `alListoIA` dio 1 fallo y 2 pases; moviéndola
// adentro de la rama `crear` (el modo editar sin aviso) dio 1 fallo y 2 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de `alListoIA`, hasta su cierre real (`\n  };` a nivel del componente). */
function alListoIA(): string {
  const src = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  // Tolera el tipo de retorno (`): boolean =>`, de otro arreglo de la misma tanda).
  const ini = src.indexOf('const alListoIA = (r: ListoCrearIA)');
  assert.ok(ini >= 0, 'no está alListoIA');
  const fin = src.indexOf('\n  };', ini);
  assert.ok(fin > ini);
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length < 3500, `el recorte mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
}

test('alListoIA anuncia las etiquetas nuevas en los DOS modos, antes de revelar las tarjetas', () => {
  const cuerpo = alListoIA();
  const aviso = cuerpo.indexOf('if (r.etiquetasNuevas.length) avisarCambioEtiquetas();');
  assert.ok(aviso >= 0, 'alListoIA no llama a avisarCambioEtiquetas');
  // Después de que cierra el if/else de los modos (el `setEditandoIA(false)` es lo último del else).
  const finModos = cuerpo.indexOf('setEditandoIA(false);\n    }');
  assert.ok(finModos >= 0 && aviso > finModos, 'el aviso quedó adentro de una sola rama de los modos');
  assert.ok(aviso < cuerpo.indexOf('setRevelarIA('), 'el aviso va antes del revelado');
});

test('SecuenciaPerfil importa avisarCambioEtiquetas de la lista compartida', () => {
  const src = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  assert.match(src, /import \{[^}]*\bavisarCambioEtiquetas\b[^}]*\} from '@\/app\/_components\/etiquetas-cliente';/);
});

test('avisarCambioEtiquetas dispara el evento que escuchan las listas abiertas', async () => {
  const g = globalThis as unknown as { window?: EventTarget };
  const antes = g.window;
  const ventana = new EventTarget();
  g.window = ventana;
  try {
    const { avisarCambioEtiquetas } = await import('../app/_components/etiquetas-cliente');
    let oidos = 0;
    ventana.addEventListener('mako:etiquetas-cambiaron', () => { oidos += 1; });
    avisarCambioEtiquetas();
    assert.equal(oidos, 1);
    // Y las dos lecturas lo escuchan con ese mismo nombre (si cambia, nadie se entera).
    assert.match(leer('app/_components/etiquetas-cliente.tsx'), /const EVENTO = 'mako:etiquetas-cambiaron';/);
  } finally {
    if (antes === undefined) delete g.window; else g.window = antes;
  }
});
