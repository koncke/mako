// El recorrido de lo nuevo en la ficha de un competidor (4/11/2026): el de la casa, con sus marcas puestas.
//
// Martín: «Si puedes poner la animación que ya tenemos tipo tutorial, donde se pone opaco y va señalando las cosas del feedback». El
// Cerebro: reusar la animación existente. Lo que se cuida: que cada paso tenga su marca en la pantalla (un paso sin marca se saltea
// SOLO y no avisa: el recorrido queda corto sin un error), que sea el Recorrido de la casa y no otro, y que el id sea nuevo.
//
// Verificado rompiéndolo: sacar `data-recorrido="spy-grilla"` de GrillaPiezas → 1; montar otro componente de recorrido → 2.
//
// Correr: node --import tsx --test tests/spy-recorrido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PASOS_SPY, RECORRIDO_SPY } from '../app/competitor-spy/recorrido-spy';
import { idRecorridoValido } from '../lib/recorridos';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const PANTALLA = ['SpyApp.tsx', 'GrillaPiezas.tsx', 'MejoresPiezas.tsx', 'SuFunnelTipo.tsx', 'SuOferta.tsx'].map((f) => leer(`app/competitor-spy/${f}`)).join('\n');

test('1. cada paso tiene su marca en la pantalla', () => {
  for (const p of PASOS_SPY) {
    const marca = p.objetivo.startsWith('spy-tab-')
      ? /data-recorrido=\{`spy-tab-\$\{p\.key\}`\}/.test(PANTALLA) && /key: 'funnel' as const/.test(PANTALLA)
      : PANTALLA.includes(`data-recorrido="${p.objetivo}"`) || PANTALLA.includes(`objetivo="${p.objetivo}"`);
    assert.ok(marca, `falta la marca de «${p.objetivo}»`);
    assert.ok(p.texto.length <= 60, `«${p.titulo}»: una frase corta`);
  }
});

test('2. es el Recorrido de la casa, con su «?», y un id nuevo', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /import \{ BotonRecorrido, Recorrido, useRecorrido \} from '@\/app\/_ui\/Recorrido';/);
  // Abierto sólo con la ficha quieta (tests/spy-miniaturas-recorrido.test.ts, 3).
  assert.match(app, /<Recorrido id=\{RECORRIDO_SPY\} pasos=\{PASOS_SPY\} abierto=\{recorridoAbierto\} onCerrar=\{recorrido\.onCerrar\} \/>/);
  assert.match(app, /<BotonRecorrido onClick=\{recorrido\.reabrir\} objetivo="spy-recorrido" \/>/);
  assert.ok(idRecorridoValido(RECORRIDO_SPY));
  assert.match(RECORRIDO_SPY, /\d{4}$/, 'con su fecha: quien vio otro recorrido ve éste');
});
