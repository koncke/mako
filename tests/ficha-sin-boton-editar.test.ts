// =============================================================================
// La ficha sin botones «Editar»: cada dato con su lápiz, ahí mismo (24/10/2026)
// =============================================================================
// Martín, 05/10: «Sería bueno que ya no exista el botón de "editar" en la ruta de cada lead, sino que simplemente en cada
// campo un lapiz», y lo repitió el mismo día. Las filas ya se editaban en el lugar; quedaban dos «Editar» de BLOQUE en los
// diseños de chips: «Renglón» de Contacto y Redes y web. Ahora cada chip lleva su lápiz (y lo que falta, su «+ Dato»), y ese
// dato, sólo ése, pasa a su editor ya abierto (`DatoEnChip`, app/crm/lead-view/ficha/resumen/contacto.tsx).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('ningún bloque del Resumen tiene un botón «Editar» (ni su «Listo»)', () => {
  const dir = 'app/crm/lead-view/ficha/resumen';
  for (const f of readdirSync(join(RAIZ, dir)).filter((x) => x.endsWith('.tsx'))) {
    const c = sinComentarios(leer(`${dir}/${f}`));
    assert.doesNotMatch(c, />\s*Editar\s*<\/button>|\? 'Listo' : 'Editar'|>Listo<\/button>/, `${f}: volvió un «Editar» de bloque`);
  }
});

test('los chips de Contacto («Renglón») y de Redes y web se editan uno por uno, con su lápiz', () => {
  const c = sinComentarios(leer('app/crm/lead-view/ficha/resumen/contacto.tsx'));
  // El estado es QUÉ dato se edita (uno por vez), no «el bloque en edición».
  assert.match(c, /const \[editando, setEditando\] = useState<string \| null>\(null\);/);
  assert.match(c, /const \[editando, setEditando\] = useState<Red \| null>\(null\);/);
  assert.doesNotMatch(c, /setEditar\(/, 'volvió el «modo edición» del bloque entero');
  // El chip con su lápiz, y lo que falta con «+ Dato», que abre el mismo editor.
  assert.match(c, /<button type="button" className="fr-lapiz" onClick=\{onEditar\} title=\{`Editar \$\{nombre\}`\}/);
  assert.match(c, /if \(!chip\) return <button type="button" className="fr-chip fr-chip--falta" onClick=\{onEditar\}/);
  // Editando, se abre ya: el botón del editor (teléfono, Instagram) o el texto mismo.
  assert.match(c, /const abrir = el\.querySelector<HTMLElement>\('\[data-campo-abrir\]'\);\n\s+if \(abrir\) abrir\.click\(\); else el\.querySelector<HTMLElement>\('\.edin'\)\?\.focus\(\);/);
  // Y vuelve a ser chip cuando el editor cerró y el foco salió.
  assert.match(c, /if \(!el \|\| el\.querySelector\('\[data-campo-editando\]'\) \|\| el\.contains\(document\.activeElement\)\) return;\n\s+onListo\(\);/);
  // Los dos bloques lo usan.
  assert.ok([...c.matchAll(/<DatoEnChip /g)].length >= 2, 'algún bloque de chips no usa DatoEnChip');
  const css = leer('app/crm/lead-view/ficha/resumen/estilo.ts');
  assert.match(css, /\.fr-chip-dato:hover \.fr-lapiz, \.fr-lapiz:focus-visible \{ opacity: 1; \}/);
  assert.match(css, /@media \(hover: none\) \{ \.fr-lapiz \{ opacity: 1; \} \}/, 'en una pantalla táctil el lápiz no se ve nunca');
});
