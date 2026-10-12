// =============================================================================
// El pop-up de etapas del CRM: el color de una etapa y el nombre del funnel
// =============================================================================
// Feedback de Martín del 12/10/2026 sobre el CRM:
//   · Punto 8: «Todas las nuevas etapas que creo, en las columnas, el circulito al lado de la
//     etapa aparece en gris, no se por que...». Nacían con `dot: '#5B6472'` y `tone: 'neutral'`.
//     Ahora nacen con uno de la paleta (`colorParaNueva`) y las viejas sin color se pintan con uno
//     DERIVADO al leer (`conColores`, en `generateFunnel`), sin escribir la base.
//   · Punto 1: «Cuando estoy cambiando el nombre de un funnel, si lo cambié y cierro la tab,
//     debería cambiarse... Lo que cambio se queda». Se guardaba sólo en el `onBlur`, y cerrar el
//     pop-up desmontaba el campo sin que el `blur` llegara.
//
// Correr: node --import tsx --test tests/etapas-color-nombre.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (12/10/2026), una rotura por vez, con el archivo entero en 7 / 0 de base
// (pases / fallos), restaurando de memoria:
//   · `conColores` sin mirar a la vecina de arriba                         → 6 / 1
//   · `generateFunnel` coloca el pipeline crudo (sin `conColores`)          → 6 / 1
//   · `conColores` escribe sobre el objeto que recibe (muta el pipeline)    → 5 / 2 (cae también
//     «se DERIVA al leer»: el pipeline crudo, el que se guarda, sale pintado)
//   · `agregar` vuelve a nacer con el gris                                  → 6 / 1
//   · `cerrar` deja de mandar lo pendiente antes de irse                    → 6 / 1
//   · el `Modal` recibe el `onCerrar` pelado del tablero                    → 6 / 1
//   · el título vuelve a `defaultValue` + `key`                             → 6 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  conColores, colorParaNueva, generateFunnel, sinColor, mergeFunnelData,
  DOT_SIN_COLOR, NEW_STAGE_PALETTE, NEW_STAGE_TONES, DEFAULT_PIPELINE, type Stage,
} from '../lib/pipeline';
import { filaAFunnel } from '../lib/funnel-fila';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const gris = (key: string, label = key): Stage => ({ key, label, dot: DOT_SIN_COLOR, tone: 'neutral', kind: 'paso' });
const color = (key: string, dot: string): Stage => ({ key, label: key, dot, tone: 'info', kind: 'paso' });

test('conColores: la etapa sin color toma uno de la paleta (punto y chip), la que tiene uno lo conserva', () => {
  const [a, b] = conColores([gris('st3'), color('x', '#E08A12')]);
  assert.equal(sinColor(a), false, 'se quedó gris');
  const i = NEW_STAGE_PALETTE.indexOf(a.dot);
  assert.ok(i >= 0, `el color ${a.dot} no es de la paleta`);
  assert.equal(a.tone, NEW_STAGE_TONES[i], 'el chip de la ficha (`tone`) no acompaña al punto');
  assert.equal(b.dot, '#E08A12', 'pisó un color elegido');
  // Sin `dot` también cuenta como sin color.
  assert.equal(sinColor({ dot: undefined }), true);
  assert.equal(sinColor({ dot: '#5b6472' }), true, 'el gris de antes, en minúsculas');
});

test('conColores: sin repetir el de la vecina, estable y sin tocar lo que recibe', () => {
  // A `st0` le toca el primero de la paleta; con ese mismo color arriba, tiene que correrse.
  const conVecina = conColores([color('a', NEW_STAGE_PALETTE[0]), gris('st0')]);
  assert.notEqual(conVecina[1].dot.toUpperCase(), NEW_STAGE_PALETTE[0].toUpperCase(), 'repitió el color de la vecina de arriba');
  // Tres seguidas sin color: ninguna repite a la de al lado.
  const tres = conColores([gris('st0'), gris('st1'), gris('st2')]);
  for (let k = 1; k < tres.length; k++) assert.notEqual(tres[k].dot, tres[k - 1].dot, `la ${k} repite a la ${k - 1}`);
  // Estable: dos lecturas, los mismos colores (es lo que hace que no «parpadee» entre lecturas).
  assert.deepEqual(conColores([gris('st0'), gris('st1')]).map((s) => s.dot), conColores([gris('st0'), gris('st1')]).map((s) => s.dot));
  // Y NO escribe: el pipeline que recibe sigue gris (lo que se guarda no se entera).
  const crudo = [gris('st0')];
  conColores(crudo);
  assert.equal(crudo[0].dot, DOT_SIN_COLOR, 'mutó el pipeline crudo');
});

test('⚠️ el color se DERIVA al leer: el tablero lo ve, la base no se escribe', () => {
  const pipeline: Stage[] = [{ ...DEFAULT_PIPELINE[0] }, gris('st0', 'Seguimiento'), ...DEFAULT_PIPELINE.slice(1)];
  const leido = filaAFunnel({ id: 1, nombre: 'X', canal: null, data: JSON.parse(JSON.stringify(mergeFunnelData({}, pipeline, []))), declarado: true });
  assert.equal(leido.pipeline.find((s) => s.key === 'st0')?.dot, DOT_SIN_COLOR, 'el pipeline crudo (lo que se guarda) cambió');
  const enTablero = leido.stages.find((s) => s.key === 'st0');
  assert.ok(enTablero && !sinColor(enTablero), 'el tablero sigue dibujando el gris');
  assert.equal(generateFunnel(pipeline).stages.find((s) => s.key === 'st0')?.dot, enTablero!.dot, 'dos lecturas, dos colores');
});

test('colorParaNueva: el primero que nadie usa; si están todos, distinto de las dos vecinas', () => {
  const base: Stage[] = [color('a', NEW_STAGE_PALETTE[0]), color('b', NEW_STAGE_PALETTE[1])];
  const n = colorParaNueva(base, 1);
  assert.equal(n.dot, NEW_STAGE_PALETTE[2], 'no eligió el primero libre');
  assert.equal(n.tone, NEW_STAGE_TONES[2]);
  // Con la paleta entera usada, mira a las vecinas del lugar donde cae.
  const llena: Stage[] = NEW_STAGE_PALETTE.map((c, k) => color(`k${k}`, c));
  const m = colorParaNueva(llena, 1);
  assert.ok(m.dot !== llena[0].dot && m.dot !== llena[1].dot, 'repitió a una vecina');
  // Una vecina vieja sin color cuenta con el color que le deriva la lectura.
  const conGris: Stage[] = [gris('st0'), color('b', NEW_STAGE_PALETTE[5])];
  const derivado = conColores(conGris)[0].dot;
  assert.notEqual(colorParaNueva(conGris, 1).dot, derivado, 'repitió el color derivado de la vecina');
});

test('la action: una etapa nueva nace con color, y una operación desconocida no agrega nada', () => {
  const src = sinComentarios(leer('app/crm/actions.ts'));
  const ini = src.indexOf("} else if (op.op === 'agregar') {");
  assert.ok(ini > 0, 'el agregar dejó de ser una rama explícita');
  const rama = src.slice(ini, src.indexOf('} else {', ini));
  assert.match(rama, /\.\.\.colorParaNueva\(pipeline, at\)/, 'la etapa nueva volvió a nacer sin color');
  assert.doesNotMatch(rama, /5B6472|tone: 'neutral'/, 'volvió el gris de relleno');
  // Lo que no es ninguna op conocida se rechaza: antes caía al `agregar` y sumaba una etapa.
  assert.match(src, /\} else \{\s*return \{ ok: false, error: 'Esa operación no existe\.' \};\s*\}/);
});

test('el nombre del funnel: cerrar manda lo pendiente ANTES de irse, y el `onCerrar` del Modal es fijo', () => {
  const md = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  const ini = md.indexOf('const cerrar = useCallback(');
  assert.ok(ini > 0, '`cerrar` dejó de tener identidad fija (useCallback)');
  const cuerpo = md.slice(ini, md.indexOf('}, [soltarNombre]);', ini));
  assert.ok(cuerpo.length > 0 && cuerpo.length < 300, `el recorte mide ${cuerpo.length}: está mirando otra cosa`);
  const iSoltar = cuerpo.indexOf('soltarNombre();');
  const iCerrar = cuerpo.indexOf('ctx.current.onCerrar();');
  assert.ok(iSoltar > 0 && iCerrar > iSoltar, 'cerrar se va sin mandar lo que se estaba escribiendo');
  assert.match(md, /onCerrar=\{cerrar\}/, 'el Modal recibe el onCerrar pelado: se pierde lo escrito y el foco salta con cada tecla');
  // Y el desmontaje por otro camino tampoco lo pierde.
  assert.match(md, /return \(\) => \{\s*document\.removeEventListener\('visibilitychange', alOcultar\);\s*n\.cerrado = true;\s*soltarNombre\(\);/);
});

test('el nombre del funnel: el título es un campo CONTROLADO con su respiro, y guarda por la action de siempre', () => {
  const md = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(md, /value=\{nombreTxt \?\? emb\?\.nombre \?\? nombre\}/, 'el título dejó de ser controlado');
  assert.match(md, /onChange=\{\(e\) => escribirNombre\(e\.target\.value\)\}/);
  assert.doesNotMatch(md, /defaultValue=\{emb\?\.nombre \?\? nombre\}|key=\{emb\?\.nombre \?\? nombre\}/,
    'volvió el `key` atado al nombre: el campo se remonta al llegar la lectura y se lleva lo escrito');
  assert.match(md, /setTimeout\(\(\) => \{[\s\S]{0,200}mandarNombre\(p, false\);\s*\}, RESPIRO_NOMBRE_MS\)/, 'sin el respiro mientras se escribe');
  assert.match(md, /renombrarEmbudoAction\(ctx\.current\.funnelId \?\? null, limpio\)/);
});

// ⚠️ LA REUNIÓN SOLA SE DICE EN LAS DOS PUERTAS (revisión del 12/10/2026). El server marca Reunión por
// el nombre al crear o renombrar desde el pop-up Y desde el «···» de la columna del tablero; el tablero
// ignoraba `reunionSola`, así que renombrar una columna «Llamada» le cambiaba el tipo en silencio.
//   ROTO A PROPÓSITO (2026-10-12), contra la base en verde (este archivo 8/0): sacando el aviso del
//   `opEtapa` del tablero, pass 7 / fail 1; con el deshacer apuntando a `tipo: 'reunion'`, pass 7 / fail 1.
test('el tablero avisa la reunión sola, con el deshacer que la deja como «Etapa»', () => {
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  const ini = b.indexOf('const opEtapa = async (op: OpEtapa) => {');
  assert.ok(ini > 0, 'no encuentro `opEtapa` en el tablero');
  const cuerpo = b.slice(ini, b.indexOf('\n  };', ini));
  assert.ok(cuerpo.length > 0 && cuerpo.length < 900, `el recorte mide ${cuerpo.length}: está mirando otra cosa`);
  assert.match(cuerpo, /const sola = r\.reunionSola;\s*if \(sola\) mostrarAviso\('Quedó como reunión', \(\) => \{ void opEtapa\(\{ op: 'tipo', key: sola, tipo: 'etapa' \}\); \}\);/);
});
