// =============================================================================
// Un MaKo en VISTA asesora: sólo edita quien está editando esa hoja, y lo decide el server (17/10/2026)
// =============================================================================
// Martín, 17/10/2026 19:31 (punto 5): «ya falló con Mauricio, al estar en VISTA del dashboard debería asesorar, no
// modificar el dashboard». El botón de MaKo de la topbar abría «Editar con MaKo» también MIRANDO la hoja, y lo que
// devolvía la ruta entraba por `mutar` y lo escribía el autoguardado: el «analizar» de #862 sólo frenaba los cambios si el
// MODELO marcaba el pedido como análisis. Lo que se puede romper sin que se vea:
//   · que la ruta vuelva a armar cambios para quien no dijo que edita, o para otra hoja que la que manda;
//   · que el editor vuelva a montar el panel que cambia la hoja mirando, o a abrirlo con el botón de la topbar;
//   · que una respuesta que llega después de tocar «Ver» entre igual.
//
// Correr: node --import tsx --test tests/dashboard-mako-vista.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 5/0): `permisoEdicionMako` sin mirar `editando` → 4 / 1; la ruta llamando al
// permiso DESPUÉS de `editarHojaIA` → 4 / 1; el panel montado sin `editando` → 4 / 1; `ponerHojaDeMako` sin el guard
// → 4 / 1; el panel sin mandar `editando` → 4 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { permisoEdicionMako } from '../lib/graficos-ia-edicion';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

test('el server: sin el modo «editar», sin «editando» o con otra hoja, NO hay cambios', () => {
  const editar = { modo: 'editar', editando: true, hojaId: 'h1' };
  assert.deepEqual(permisoEdicionMako(editar, 'h1'), { ok: true });
  // Mirando (lo que pasó con Mauricio): el pedido llega sin «editando».
  assert.equal(permisoEdicionMako({ ...editar, editando: false }, 'h1').ok, false, 'en vista, MaKo cambió la hoja');
  assert.equal(permisoEdicionMako({ modo: 'editar', hojaId: 'h1' }, 'h1').ok, false, 'sin decir que edita, cambió la hoja');
  assert.equal(permisoEdicionMako({ ...editar, editando: 'true' }, 'h1').ok, false, '«editando» tiene que ser true, no algo que se le parece');
  assert.equal(permisoEdicionMako({ ...editar, modo: 'analizar' }, 'h1').ok, false, 'en modo Analizar, cambió la hoja');
  assert.equal(permisoEdicionMako({ ...editar, hojaId: 'otra' }, 'h1').ok, false, 'cambió una hoja que no es la que se edita');
  // Un cuerpo viejo (el panel de antes de este arreglo, una pestaña abierta): sin nada de esto, nada.
  assert.equal(permisoEdicionMako({}, 'h1').ok, false);
  assert.equal(permisoEdicionMako(null, 'h1').ok, false);
});

test('la ruta pregunta ANTES de gastar un token, y contesta sin hoja', () => {
  const r = leer('app/api/graficos/editar/route.ts');
  const permiso = r.indexOf('permisoEdicionMako(body, hoja.id)');
  assert.ok(permiso > 0, 'la ruta no pregunta si la persona está editando');
  assert.ok(permiso < r.indexOf('await editarHojaIA('), 'la ruta llama a la IA antes de saber si puede cambiar la hoja');
  assert.match(r, /if \(!permiso\.ok\) return NextResponse\.json\(\{ ok: false, error: permiso\.error, analizar: true \}, \{ status: 409 \}\);/);
});

test('el editor: mirando, no hay botón de MaKo en la barra (el AI Analyst va en el ⋮) y el panel que cambia la hoja no existe', () => {
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /\{makoEditar && editando && guardable && !enBlanco && !compartido && \(\s*<PanelEditarMako editando=\{editando\}/,
    'el panel que cambia la hoja se monta mirando');
  // 24/10/2026, Martín: «El botón de "Analizar con MaKo" debería eliminarse completamente y también en el dashboard, porque
  // para eso ya tenemos el chat de la criatura». En la barra queda sólo «Editar con MaKo», y sólo editando.
  assert.match(ed, /\{guardable && !enBlanco && !compartido && editando && \(\s*<BotonMako lado=\{30\} title="Editar con MaKo" encendido=\{makoEditar\} onClick=\{alternarMakoEditar\} \/>\s*\)\}/,
    'el botón de MaKo de la barra no es sólo el de editar');
  assert.doesNotMatch(ed, /title="Analizar con MaKo"/, 'volvió «Analizar con MaKo» a la barra');
  assert.match(ed, /const conModosMako = editando && /, 'mirando, la cabecera ofrece pasar a Editar');
  // Una respuesta que llega después de «Ver» no entra (el panel se desmonta, pero el guard no depende de eso).
  assert.match(ed, /const ponerHojaDeMako = useCallback\(\(h: Hoja\) => \{ if \(editandoRef\.current\) mutarHoja\(\(\) => h, h\.id\); \}, \[mutarHoja\]\);/);
  assert.match(ed, /const alternarEdicion = \(\) => \{ if \(editando && makoEditar\) \{ setMakoEditar\(false\); setProbar\(''\); setAnalista\(true\); \}/,
    'al tocar «Ver», «Editar con MaKo» queda abierto');
});

test('el panel le dice al server que edita, en qué modo y qué hoja', () => {
  assert.match(leer('app/dashboard/PanelEditarMako.tsx'),
    /body: JSON\.stringify\(\{ hoja: enviada, pedido: deEstaHoja, historial, informe, modo: 'editar', editando, hojaId: enviada\.id \}\)/);
});

test('el link «Probarlo» de Offer (un pedido de cambiar) entra editando', () => {
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /const \[editando, setEditando\] = useState\(\(\) => !!probarInicial && !soloLectura && !compartido\);/);
});
