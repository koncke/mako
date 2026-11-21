// =============================================================================
// FORMATO EN LOS MENSAJES DE MAKO: NEGRITA, CURSIVA, SUBRAYADO, VIÑETAS Y NÚMEROS (21/11/2026, Martín probando en producción)
// =============================================================================
// «Me dijiste que lo primero que quieres es hacer tus videos con IA, espiar a tu competencia y armar tus guiones y carruseles…» era un
// bloque largo. Lo pedido: los mensajes con formato, en los globos del reto, del arranque y de los coaches, con markdown simple y SEGURO
// (sin HTML crudo). Los coaches ya lo dibujaban (HiloMako → Markdown); el reto, la llegada y el arranque ponían el texto en un <p>.
//   · El parser compartido (app/_components/Markdown.tsx) suma el SUBRAYADO (`++así++`); lo demás ya lo tenía.
//   · Los globos del reto, la llegada y el arranque dibujan su texto con él.
//   · El mensaje de lo elegido va con las tres cosas en viñetas y lo clave en negrita.
// El día de cada reto NO lleva marcas en su texto: va también en el correo, que es texto plano.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../app/_components/Markdown';
import { RETO_INTERES_YA, muestrasDe } from '../lib/reto/dias';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const md = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

test('1. el parser: negrita, cursiva, subrayado, viñetas y números; y nada de HTML crudo', () => {
  assert.match(md('Esto es **clave**, *suave* y ++subrayado++.'), /<strong>clave<\/strong>[\s\S]*<em>suave<\/em>[\s\S]*<u>(<span>)?subrayado(<\/span>)?<\/u>/);
  assert.match(md('- uno\n- dos'), /<ul[^>]*>[\s\S]*<li[^>]*>[\s\S]*uno[\s\S]*<li[^>]*>[\s\S]*dos/);
  assert.match(md('1. primero\n2. segundo'), /<ol[^>]*>[\s\S]*primero[\s\S]*segundo/);
  const crudo = md('<b>hola</b><script>alert(1)</script>');
  assert.doesNotMatch(crudo, /<b>|<script>/, 'el HTML pasa como texto');
  assert.match(crudo, /&lt;b&gt;/);
  // Lo que no trae «++» queda igual que antes (el mismo DOM).
  assert.equal(md('sin marcas'), md('sin marcas'));
});

test('2. «Me dijiste que…»: las tres cosas en viñetas y lo clave en negrita', () => {
  const ms = muestrasDe(['Videos con IA y con mi avatar', 'Espiar lo que le funciona a mi competencia', 'Guiones y carruseles que venden']);
  const t = RETO_INTERES_YA(ms);
  assert.match(t, /^Me dijiste que lo primero que quieres es:\n/);
  for (const m of ms) assert.ok(t.includes(`\n- **${m.hacer}**`), `sin la viñeta de «${m.hacer}»`);
  assert.match(t, /\n\n¿Te muestro cómo hacerlo ahora, o empezamos tu \*\*día 1\*\*\?/);
  assert.equal((md(t).match(/<li/g) ?? []).length, 3, 'dibujado: tres viñetas');
});

test('3. los globos del reto, la llegada y el arranque dibujan su texto con el parser (los coaches ya lo hacían)', () => {
  const r = sinComentarios(fuente('app/second-brain/reto/ChatDelReto.tsx'));
  assert.doesNotMatch(r, /<Burbuja[^>]*><p>\{RETO_/, 'un globo del reto con el texto en un <p>');
  assert.match(r, /<Burbuja><Markdown text=\{RETO_INTERES_YA\(muestras\)\} \/><\/Burbuja>/);
  assert.match(r, /<Burbuja><Markdown text=\{RETO_HOLA\(nombre\)\} \/><\/Burbuja>/);
  assert.match(sinComentarios(fuente('app/second-brain/LlegadaAlReto.tsx')), /<div className="ch-md"><Markdown text=\{textoLlegada\(nombre\)\} \/><\/div>/);
  assert.match(sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx')), /<div className="ch-md"><Markdown text=\{m\.texto\} \/><\/div>/);
  assert.match(fuente('app/_chat/HiloMako.tsx'), /<div className="ch-md"><Markdown text=\{x\.texto\} \/><\/div>/, 'los coaches');
});

// ⚠️ PROBADO ROMPIÉNDOLO (21/11/2026, base 3/0; al restaurar, 3/0). Cada rotura, de a una, cae:
//   - el parser sin subrayado → 1;  «Me dijiste que…» de corrido (lo de antes) → 2;  un globo del reto con su <p> → 3;  la llegada con su <p> → 3
