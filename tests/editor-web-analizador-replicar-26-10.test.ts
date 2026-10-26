// =============================================================================
// El analizador de otras landings y «Replicar», probados con una de la competencia (26/10/2026)
// =============================================================================
// Martín: «Que funcione bien también el analizador de otras landing, que si le doy al botón de aplicar lo haga... El
// tema de replicar landing, prueba en traer una landing de alguna competencia y ver si la duplica bien».
// Medido en producción con 100ads.ai: el análisis dejó 2 comentarios; «Aplicar» replicó (#46), pasó los comentarios y
// aplicó el que tenía sección. Lo que falló:
//   · el comentario SIN sección (su cita estaba en el título de la pestaña) no tenía «Aplicar», ni en la pantalla ni en la
//     API, y el que se mandaba a aplicar desde afuera terminaba en «No ubiqué esa sección»;
//   · la réplica: la IA del negocio no contestó a tiempo (17 de 20 secciones sin IA) y el respaldo dejaba los botones
//     como texto en una viñeta («[BOTÓN] Ver todo lo que incluye»).
// Correr: node --import tsx --test tests/editor-web-analizador-replicar-26-10.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hrefDeDestinoLeido, tarjetaDesdeEsquema } from '../lib/editor-landing/ia-reglas';
import { NODO, type JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tipos = (t: JsonNodo) => (t.content ?? []).map((n) => n.type);
const texto = (n: JsonNodo): string => (n.text ?? '') + (n.content ?? []).map(texto).join('');

test('el respaldo de la réplica: un botón leído es un botón, un desplegable es un desplegable', () => {
  const t = tarjetaDesdeEsquema({
    titulo: 'Precios',
    puntos: [
      'Acceso Pro · mensual',
      '$ 57 USD / mes',
      '[BOTÓN] Quiero ver la demo gratis → https://100ads.ai/demo',
      '[BOTÓN] Ver el plan anual → #planes',
      '[DESPLEGABLE] ¿Cómo cancelo? → Cuando quieras / desde tu cuenta',
      '• 600 créditos por mes',
    ],
  }, false);
  assert.deepEqual(tipos(t), ['heading', 'bulletList', NODO.botones, NODO.desplegable, 'paragraph']);
  const fila = t.content![2];
  assert.equal(fila.content!.length, 2, 'dos botones seguidos van en la misma fila');
  assert.deepEqual(fila.content!.map((b) => [texto(b), b.attrs?.href, b.attrs?.variante]), [
    ['Quiero ver la demo gratis', 'https://100ads.ai/demo', 'primario'],
    ['Ver el plan anual', '#planes', 'secundario'],
  ]);
  const des = t.content![3];
  assert.equal(texto(des.content![0]), '¿Cómo cancelo?');
  assert.deepEqual(des.content![1].content!.map(texto), ['Cuando quieras', 'desde tu cuenta']);
  assert.equal(texto(t.content![4]), '600 créditos por mes', 'la viñeta del lector no queda escrita');
  assert.doesNotMatch(JSON.stringify(t), /\[BOT[ÓO]N\]|\[DESPLEGABLE\]/, 'ninguna marca del lector queda como texto');
  // Sin marcas, igual que siempre: uno es un párrafo, varios son viñetas (lo usa también agregar_seccion_landing).
  assert.deepEqual(tipos(tarjetaDesdeEsquema({ titulo: 'B', puntos: ['Rápido', 'Barato'] }, false)), ['heading', 'bulletList']);
  assert.deepEqual(tipos(tarjetaDesdeEsquema({ titulo: 'B', puntos: ['Uno'] }, false)), ['heading', 'paragraph']);
  // Un destino en palabras («sale a otra página») no inventa una dirección.
  assert.equal(hrefDeDestinoLeido('sale a otra página'), '#');
  assert.equal(hrefDeDestinoLeido('https://x.com/a b'), 'https://x.com/a');
  assert.equal(hrefDeDestinoLeido(undefined), '#');
});

test('«Aplicar» sin sección: a toda la landing, en el server, en la pantalla y en la API', () => {
  const s = sinComentarios(leer('lib/editor-landing/diagnostico-aplicar.ts'));
  assert.doesNotMatch(s, /if \(!seccionId\) return falla/, 'el server rechaza un comentario sin sección');
  assert.match(s, /alcance: enSeccion \? 'seccion' : 'landing',/);
  assert.match(s, /tarjetas: aEditar,/);
  const p = sinComentarios(leer('app/web-generator/diagnostico/PanelDiagnostico.tsx'));
  assert.match(p, /const puedeAplicar = \(s: Sugerencia\) => s\.estado === 'pendiente' && \(deNuestra \|\| !!urlPegada\);/);
  assert.match(p, /grupos\.push\(\{ seccionId: null, ids: sinUbicar\.slice\(/, '«Aplicar todos» deja afuera los sin sección');
  assert.doesNotMatch(p, /No ubiqué esa sección/, 'el aplicar de la copia vuelve a cortarse sin sección');
  assert.match(leer('lib/api-mako/areas/landing-editor.helpers.ts'), /se_puede_aplicar: op\.deNuestra && s\.estado === 'pendiente',/);
});
