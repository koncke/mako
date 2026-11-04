// =============================================================================
// La portada (el bloque épico) sigue el color de la hoja (#859)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:12:30): «los bloques que hicimos para que sean épicos… no están reaccionando con la
// edición del estilo de la hoja como el cambio de color». Con un acento elegido en «Estilo de la hoja», la portada se
// pinta de ese color. Lo que se puede romper sin que se vea: uno de los tres que dibujan una tarjeta (el editor, el
// gráfico de adentro, la miniatura) que sigue con el color de la plantilla —la tarjeta de un color y su gráfico de
// otro—, y una tinta que no se lee sobre un color que eligió la persona (no está en la tabla curada).
//
// Correr: node --import tsx --test tests/graficos-identidad-acento.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): `identidadEfectiva` sin mirar el acento → 3 / 1; la tinta siempre blanca
// → 3 / 1; el gráfico de adentro con el color de la plantilla → 3 / 1; el bloque de General sin el acento → 3 / 1.
// Y la primera versión de `tintaSobre` (92 % de negro) la tiró el propio test: 4,47 sobre #338833.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDENTIDADES, acentoDeBloque, contraste, identidadDe, identidadEfectiva, marcoDePortada, paletaDePortada, tintaSobre } from '../lib/graficos-identidad';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

test('con un acento, la portada es de ese color (y la forma, la de su identidad); sin acento, la de la plantilla', () => {
  const coral = identidadDe('coral')!;
  assert.deepEqual(identidadEfectiva('coral', null), coral);
  assert.deepEqual(identidadEfectiva('coral', 'rojo'), coral, 'un acento que no es un hex no pinta nada');
  const x = identidadEfectiva('coral', '#1F5FE0')!;
  assert.equal(x.fondo, '#1F5FE0');
  assert.equal(x.forma, coral.forma);
  assert.equal(identidadEfectiva('no-existe', '#1F5FE0'), null, 'sin portada no hay color que seguir');
  assert.deepEqual(marcoDePortada({ portada: 'coral' }, '#1F5FE0')?.estilo, { '--portada-fondo': '#1F5FE0', '--portada-tinta': x.tinta });
  assert.equal(paletaDePortada('coral', '#1F5FE0')?.[0], x.tinta.toLowerCase(), 'las series del gráfico van en la tinta del color de la hoja');
});

test('la tinta se lee sobre CUALQUIER color que se elija (no sólo los de la tabla)', () => {
  const canal = [0x00, 0x33, 0x66, 0x77, 0x88, 0x99, 0xcc, 0xff];
  const fondos = [...IDENTIDADES.map((i) => i.fondo), '#757575', '#7A7A7A', '#808080', '#767676'];
  for (const r of canal) for (const g of canal) for (const b of canal) fondos.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  const peor = fondos.map((f) => ({ f, c: contraste(tintaSobre(f), f) })).sort((a, b) => a.c - b.c)[0];
  assert.ok(peor.c >= 4.5, `sobre ${peor.f} la tinta tiene contraste ${peor.c.toFixed(2)} (< 4,5)`);
});

test('los tres que dibujan una tarjeta le pasan el color de la hoja', () => {
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /const portada = pintaPortada\(c, hoja\.tema\) \? marcoDePortada\(c, acentoDePortada\(hoja\.tema\)\) : null;/);
  assert.match(leer('app/dashboard/MiniaturaHoja.tsx'), /const portada = pintaPortada\(c, hoja\.tema\) \? marcoDePortada\(c, acentoDePortada\(hoja\.tema\)\) : null;/);
  const graf = leer('app/dashboard/Grafico.tsx');
  assert.match(graf, /const acentoPortada = acentoDePortada\(tema\);\n\s*const portada = pintaPortada\(g, tema\) \? identidadEfectiva\(g\.portada, acentoPortada\) : null;/);
  assert.match(graf, /paletaDePortada\(portada\.id, acentoPortada\)/);
  assert.doesNotMatch(graf, /identidadDe\(g\.portada\)/, 'el gráfico de adentro volvió al color de la plantilla');
});

test('los bloques de General pintan lo RELLENO con el color de la hoja (también en el teléfono); los links de texto, no', () => {
  assert.equal(acentoDeBloque(null), null);
  assert.deepEqual(acentoDeBloque('#B5DD4C'), { '--gb-acento': '#B5DD4C', '--gb-acento-tinta': tintaSobre('#B5DD4C') });
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /const acento = esElemento\(c\) && c\.tipo === 'general' && !portada \? acentoDeBloque\(hoja\.tema\.acento\) : null;/);
  assert.match(ed, /\.\.\.\(portada\?\.estilo \?\? \{\}\), \.\.\.\(acento \?\? \{\}\) \} as CSSProperties;/, 'el acento no llega al estilo de la tarjeta');
  assert.match(leer('app/m/hoy/GeneralM.tsx'), /acentoDeBloque\(hoja\.tema\.acento\)/);
  const comun = readFileSync(join(RAIZ, 'app/general/bloques/comun.tsx'), 'utf8');
  assert.match(comun, /\.gb-boton\{[^}]*background:var\(--gb-acento,var\(--primary\)\)/);
  assert.match(comun, /\.gb-cab-link\{[^}]*color:var\(--primary\)/, 'un link de texto tomó el acento: uno claro no se lee sobre la tarjeta');
});
