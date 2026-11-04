// =============================================================================
// «Reportar» una respuesta de MaKo: en el menú del mensaje, no debajo de cada una (4/11/2026, ticket #57)
// =============================================================================
// Martín: «Debajo del mensaje de funnel coach me aparecia un botón de "reportar" eso no tiene sentido». El botón lo había puesto
// el chat de Tiendas el 3/11 porque Play pide denunciar una respuesta de IA sin salir de la app (app/_chat/ReportarRespuesta.tsx).
// Se mudó al menú del mensaje (clic derecho o mantener apretado), como «Reportar» en WhatsApp o en Gemini. Esto fija:
//   1. el menú ofrece «Reportar» sólo si quien lo monta lo pide, y nunca sobre lo propio (un chat de Claude Code no lo pide);
//   2. el hilo dibuja una respuesta de MaKo sin «Reportar» debajo;
//   3. el reporte sale por el camino de «Reportar a Soporte»: un pedazo del mensaje, y dice si no salió;
//   4. el menú lo resuelve él (ningún chat lo suma a su `elegirEnMenu`), en la computadora y en la hoja del teléfono;
//   5. todo chat con MaKo lo pide; los que no, son de Claude Code y lo dicen. El botón suelto sólo queda en Community.
// Correr: node --import tsx --test tests/reportar-en-el-menu.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import modulo from 'node:module';
import { opcionesDelMensaje, SIN_MARCAS } from '../lib/centro-mensajes';
import { TOPE_ERROR } from '../lib/soporte-reporte';

// El hilo trae CSS, que en node no carga: se importa adentro de su test, después de esto (como tests/gurus-ops-center.test.ts).
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.tsx?$/.test(n)) out.push(rel);
  }
  return out;
}

const DE_MAKO = { id: 't:m20261104', propio: false };
const MIO = { id: 't:u20261104', propio: true };

test('1. el menú ofrece «Reportar» sólo si quien lo monta lo pide, y nunca sobre lo propio', () => {
  const ids = (m: typeof DE_MAKO, reportable?: boolean) => opcionesDelMensaje(m, SIN_MARCAS, false, reportable).map((o) => o.id);
  const conReporte = ids(DE_MAKO, true);
  assert.ok(conReporte.includes('reportar'), 'una respuesta de MaKo se reporta');
  assert.equal(conReporte.indexOf('reportar'), conReporte.indexOf('eliminar') - 1, 'justo antes de «Eliminar para mí», como en WhatsApp');
  assert.equal(opcionesDelMensaje(DE_MAKO, SIN_MARCAS, false, true).find((o) => o.id === 'reportar')?.label, 'Reportar');
  assert.ok(!ids(MIO, true).includes('reportar'), 'lo que escribió la persona no se reporta');
  assert.ok(!ids(DE_MAKO).includes('reportar'), 'sin pedirlo (un chat de Claude Code), no está');
});

test('2. el hilo dibuja una respuesta de MaKo sin «Reportar» debajo', async () => {
  const { HiloMako } = await import('../app/_chat/HiloMako');
  const html = renderToStaticMarkup(createElement(HiloMako, {
    items: [
      { k: 'msg', id: 'u1', role: 'user', texto: '¿Qué hago con mi oferta?', at: '2026-11-04T12:00:00.000Z' },
      { k: 'msg', id: 'm1', role: 'assistant', texto: 'Empecemos por tu oferta.', at: '2026-11-04T12:00:30.000Z' },
    ],
    quien: { nombre: 'MaKo' }, ahora: Date.parse('2026-11-04T12:01:00.000Z'), escribiendo: null, tarjeta: null,
    onTarjeta: () => {}, onReintentar: () => {}, onRecargar: () => {}, onResponder: () => false,
  }));
  assert.match(html, /Empecemos por tu oferta\./, 'el hilo se dibujó');
  assert.doesNotMatch(html, />Reportar</, 'ni un «Reportar» debajo de la respuesta');
  assert.doesNotMatch(html, /data-soporte/, 'ni el botón de soporte suelto');
});

test('3. el reporte sale por «Reportar a Soporte»: un pedazo del mensaje, y si no salió lo dice', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const antes = { window: g.window, fetch: g.fetch };
  const cuerpos: Array<Record<string, unknown>> = [];
  let falla = false;
  g.window = { location: { pathname: '/second-brain', search: '?coach=funnel' }, innerWidth: 1280, innerHeight: 800 };
  g.fetch = async (_url: string, init: { body: string }) => {
    if (falla) throw new Error('sin red');
    cuerpos.push(JSON.parse(init.body) as Record<string, unknown>);
    return new Response(JSON.stringify({ ok: true, id: 57, yaExistia: false }));
  };
  try {
    const { mandarReporte, REPORTE_NO_SALIO } = await import('../app/_chat/ReportarRespuesta');
    assert.deepEqual(await mandarReporte('Tu oferta ya está cargada. '.repeat(40)), { ok: true });
    const error = String(cuerpos[0].error);
    assert.ok(error.startsWith('Reportó una respuesta de MaKo: Tu oferta ya está cargada.'), error.slice(0, 80));
    assert.ok(error.length <= TOPE_ERROR, 'un pedazo, no la conversación');
    assert.equal(cuerpos[0].accion, 'Reportar una respuesta de MaKo');
    await mandarReporte('Hola', 'un mensaje del grupo');
    assert.equal(cuerpos[1].accion, 'Reportar un mensaje del grupo', 'en el grupo dice qué es');
    falla = true;
    assert.deepEqual(await mandarReporte('Hola'), { ok: false });
    assert.match(REPORTE_NO_SALIO, /^No salió el reporte: vuelve a tocar «Reportar»/, 'dice qué hacer');
  } finally {
    g.window = antes.window;
    g.fetch = antes.fetch;
  }
});

test('4. el menú resuelve «Reportar» él, en la computadora y en la hoja del teléfono', () => {
  const wa = sinComentarios(leer('app/admin/operaciones/MensajeWA.tsx'));
  assert.match(wa, /if \(id === 'reportar'\) \{ onCerrar\(\); void rep\.reportar\(m\.texto\); return; \}/, 'ningún chat lo suma a su elegirEnMenu');
  assert.match(wa, /opcionesDelMensaje\(m, marcas, transcripcionAbierta\(m\.trabajo\?\.id \?\? ''\), !!reportable\?\.\(m\)\)/, 'el menú de la computadora');
  assert.match(wa, /<HojaMensajeWA m=\{abierto\.m\} marcas=\{marcas\} onCerrar=\{onCerrar\} onElegir=\{elegir\} [^/]*reportable=\{!!reportable\?\.\(abierto\.m\)\} \/>/, 'la hoja del teléfono');
  assert.match(wa, /opcionesDelMensaje\(m, marcas, transcripcionAbierta\(m\.trabajo\?\.id \?\? ''\), reportable\)/, 'la hoja lo ofrece');
  // El menú mínimo de los chats embebidos (sin ContextoWA de afuera) también lo tiene.
  const hilo = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  assert.match(hilo, /\.\.\.\(esRespuestaDeMaKo\(abierto\.m\) \? \[\{ id: 'reportar', label: 'Reportar', icono: 'bandera' as const \}\] : \[\]\)/);
  assert.match(hilo, /else if \(id === 'reportar'\) void rep\.reportar\(m\.texto\);/);
});

// Los menús que no lo piden son los de los chats de Claude Code (el Ops Center del super admin): ahí no habla MaKo, y un reporte a
// Soporte no tiene a quién llegarle.
const SIN_REPORTE: Record<string, string> = {
  'app/admin/operaciones/Conversacion.tsx': 'un chat de Claude Code de la computadora',
  'app/m/operaciones/ChatsMovil.tsx': 'los chats de Claude Code en el teléfono',
};

test('5. todo chat con MaKo pide «Reportar»; el botón suelto sólo queda en Community', () => {
  const sinPedirlo: string[] = [];
  const conBoton: string[] = [];
  for (const f of archivos('app')) {
    const src = sinComentarios(leer(f));
    for (const m of src.matchAll(/<MenuMensajeWA\b[\s\S]*?\/>/g)) if (!/\breportable=\{/.test(m[0])) sinPedirlo.push(relative(RAIZ, join(RAIZ, f)));
    if (/<ReportarRespuesta\b/.test(src)) conBoton.push(f);
  }
  assert.deepEqual([...new Set(sinPedirlo)].sort(), Object.keys(SIN_REPORTE).sort(), 'un chat con MaKo nuevo pasa `reportable`, o va acá con su porqué');
  assert.deepEqual(conBoton, ['app/m/comunidad/PostM.tsx'], 'lo de otra persona en Community no tiene menú de mensaje');
});

// ⚠️ PROBADO ROMPIÉNDOLO (4/11/2026, base 5 / 0, Node 24; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · lo propio también se reporta                         → 4 / 1 (1)
//   · el botón vuelve debajo de la respuesta               → 3 / 2 (2 y 5)
//   · el reporte no dice qué se reporta                    → 4 / 1 (3)
//   · un reporte que no salió dice que salió               → 4 / 1 (3)
//   · el menú no resuelve «Reportar» (cae al elegirEnMenu) → 4 / 1 (4)
//   · el Funnel Coach sin `reportable`                     → 4 / 1 (5)
//   Sacar el `.slice(0, TOPE_ERROR)` NO lo pone rojo: `reportarASoporte` recorta igual (`limpio`, app/_ui/ReportarASoporte.tsx).
