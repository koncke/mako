// =============================================================================
// Ads Analyst se mudó: sus tareas a Ads Writer → «Analizar guion», su análisis al Dashboard
// =============================================================================
// Decisión de Martín (11/10/2026): lo de Ads Analyst que EJECUTA (valorar un guion nuevo, sincronizar,
// ángulos y avatares) va a la tab Ads Writer; lo que es análisis, a la hoja «Ads Analyst» del Dashboard;
// y /ads-analyst se retira con un redirect.
//
// Lo que este archivo persigue es lo que una mudanza rompe SIN avisar:
//   · un `?tab=` que no se lee en el server (el link de MaKo a /ads-writer?tab=analizar caería en
//     Anuncios) o que se lee importando un valor de un módulo 'use client' (el bug que dejó
//     /onboarding roto en producción con el build en verde);
//   · la vista nueva detrás del wizard SIN salida del onboarding de Copy Generator (decisión: no pasa);
//   · un redirect que pierde el ?ws= del cliente que mira el super admin;
//   · la ficha de un anuncio del Ads Manager (app/marketing/ad-charts.tsx) sin lo que importa de
//     ScriptsBrowser.tsx, o pintando los bloques con otros colores que la valoración;
//   · un contrato entre la vista y su ruta que se desfasa (el piso de 80 caracteres, los topes);
//   · el «Actualizar igual» que volvía a cobrar los mismos seis guiones (ver app/ads-writer/AnalizarGuion.tsx).
//
// ⚠️ Los guards del repo (voseo, frontera use-client, rutas retiradas) barren `git ls-files`: los
// archivos NUEVOS de este cambio son invisibles para ellos hasta el `git add`. Por eso los últimos tests
// de acá los miden a mano.
//
// Probado rompiéndolo (11/10/2026; base en verde: 14 pasan, 0 fallan). Cada rotura se aplicó, se corrió
// este archivo y se restauró de memoria (pasan / fallan):
//   · tabs.ts: `tabDeUrl` acepta cualquier string                                         -> 13 / 1
//   · tabs.ts: `hrefDeVista` deja `tab=anuncios` en vez de sacarlo                         -> 13 / 1
//   · analizar.ts: `puertaSync` con `mins < 30` en vez de `< 60`                          -> 13 / 1
//   · analizar.ts: MIN_GUION = 60 (la ruta sigue pidiendo 80)                              -> 13 / 1
//   · page.tsx: el return de «analizar» movido DESPUÉS del guard del onboarding             -> 13 / 1
//   · page.tsx: `tabDeUrl` importado de './AdsWriterApp' (con 'use client')                 -> 13 / 1
//   · AdsWriterApp.tsx: la vista se escribe con `window.history.replaceState`                -> 13 / 1
//   · AnalizarGuion.tsx: el fetch de sync sin `signal`                                      -> 13 / 1
//   · AnalizarGuion.tsx: «reciente» vuelve a `sincronizar(true)`                            -> 13 / 1
//   · app/ads-analyst/page.tsx: `redirect('/dashboard?hoja=ads-analyst')` sin rutaConWs      -> 13 / 1
//   · ScriptsBrowser.tsx: `applyAvatares` sin `export`                                       -> 13 / 1
//   · ScriptsBrowser.tsx: vuelve a declarar su propio `const KIND`                           -> 13 / 1
//   · ValoracionGuion.tsx: el chip del ángulo pinta un gris fijo en vez del color del ángulo -> 13 / 1
//   · ads.helpers.ts: vuelve «revísala en Ads Analyst»                                      -> 13 / 1
//   · tab-activacion.ts: el título de 'script' vuelve a 'Ads Analyst'                        -> 13 / 1
//   · AnalizarGuion.tsx: un «Pegá aquí el guion» en el placeholder                           -> 13 / 1
//   · tab-activacion.ts: el título de 'closing' vuelve a 'Closing Analyst'                   -> 13 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tabDeUrl, hrefDeVista, VISTAS_ADS_WRITER, VISTA_POR_DEFECTO } from '../app/ads-writer/tabs';
import {
  MIN_GUION, TOPE_SYNC_MS, TOPE_VALORAR_MS, SIN_CONTEO,
  faltaParaValorar, haceCuanto, lineaConteo, mensajeDeFallo, puertaSync, textoResultadoSync,
} from '../app/ads-writer/analizar';
import { ValoracionView, BLOQUES_GUION, chipBloque, veredictoDe } from '../app/ads-writer/ValoracionGuion';
import { tabActivacion } from '../lib/tab-activacion';
import { marcasDeVoseo } from '../lib/puestas-data';
import type { Valoracion } from '../lib/ads-analyst';

const RAIZ = join(import.meta.dirname, '..');
/** Todo test que lee fuente normaliza los saltos: varios de estos archivos están en CRLF. */
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas PRIMERO y los bloques después: un `/*` dentro de un `//` se comería el código. */
const sinComentarios = (src: string) => src
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
  .replace(/(^|[^A-Za-z0-9_])\/\*[\s\S]*?\*\//g, '$1');

const AHORA = Date.parse('2026-10-11T15:00:00Z');
const haceMin = (m: number) => new Date(AHORA - m * 60_000).toISOString();

// ── La vista viaja en ?tab= ─────────────────────────────────────────────────────────────────

test('tabDeUrl: sólo las tres vistas; lo demás abre Anuncios', () => {
  assert.deepEqual([...VISTAS_ADS_WRITER], ['anuncios', 'guiones', 'analizar']);
  assert.equal(VISTA_POR_DEFECTO, 'anuncios');
  assert.equal(tabDeUrl('analizar'), 'analizar');
  assert.equal(tabDeUrl('guiones'), 'guiones');
  assert.equal(tabDeUrl('anuncios'), 'anuncios');
  for (const raro of [undefined, '', 'Analizar', 'valorar', 'analizar ', '__proto__', 'constructor']) {
    assert.equal(tabDeUrl(raro), 'anuncios', `«${raro}» no es una vista`);
  }
  // ?tab=a&tab=b llega como lista: no se elige una al azar.
  assert.equal(tabDeUrl(['analizar', 'guiones']), 'anuncios');
});

test('hrefDeVista: cambia sólo `tab`, conserva el ?ws= y la vista por defecto saca el parámetro', () => {
  assert.equal(hrefDeVista('https://app.x/ads-writer?ws=3', 'analizar'), '/ads-writer?ws=3&tab=analizar');
  assert.equal(hrefDeVista('https://app.x/ads-writer?tab=analizar&ws=3', 'anuncios'), '/ads-writer?ws=3');
  assert.equal(hrefDeVista('https://app.x/ads-writer?tab=guiones', 'analizar'), '/ads-writer?tab=analizar');
  assert.equal(hrefDeVista('https://app.x/ads-writer', 'anuncios'), '/ads-writer');
  // Ida y vuelta: lo que se escribe es lo que el server vuelve a leer.
  for (const v of VISTAS_ADS_WRITER) {
    const u = new URL(hrefDeVista('https://app.x/ads-writer?ws=7', v), 'https://app.x');
    assert.equal(tabDeUrl(u.searchParams.get('tab') ?? undefined), v, v);
    assert.equal(u.searchParams.get('ws'), '7', `${v}: se perdió el ?ws=`);
  }
});

// ── La lógica de la vista, con números ─────────────────────────────────────────────────────

test('puertaSync: la pregunta antes de gastar IA (nada / reciente / ok), y `pend` suma sin fila + pendientes', () => {
  const c = { ...SIN_CONTEO, analizadas: 40, enVista: 30, sinTranscript: 2, pendientes: 1 };
  assert.deepEqual(puertaSync({ ...c, sinTranscript: 0, pendientes: 0 }, haceMin(5), AHORA), { pend: 0, nivel: 'nada' });
  assert.deepEqual(puertaSync(c, haceMin(10), AHORA), { pend: 3, nivel: 'reciente' });
  assert.deepEqual(puertaSync(c, haceMin(59), AHORA), { pend: 3, nivel: 'reciente' });
  assert.deepEqual(puertaSync(c, haceMin(61), AHORA), { pend: 3, nivel: 'ok' });
  assert.deepEqual(puertaSync(c, null, AHORA), { pend: 3, nivel: 'ok' }, 'sin sync previa no hay «recién»');
  assert.deepEqual(puertaSync(c, 'no-es-fecha', AHORA), { pend: 3, nivel: 'ok' }, 'una fecha rota no inventa un «recién»');
});

test('haceCuanto, lineaConteo y textoResultadoSync dicen lo que pasó, con su unidad', () => {
  assert.equal(haceCuanto(haceMin(12), AHORA), 'hace 12m');
  assert.equal(haceCuanto(haceMin(180), AHORA), 'hace 3h');
  assert.equal(haceCuanto(haceMin(60 * 50), AHORA), 'hace 2d');
  assert.equal(haceCuanto(null, AHORA), 'sin registro');
  assert.equal(haceCuanto(haceMin(-30), AHORA), 'sin registro', 'una fecha en el futuro no es «hace»');
  assert.equal(lineaConteo({ ...SIN_CONTEO, analizadas: 1 }), '1 guion analizado');
  assert.equal(lineaConteo({ ...SIN_CONTEO, analizadas: 12, sinTranscript: 4, errores: 2 }), '12 guiones analizados · 4 sin analizar · 2 con error');
  assert.equal(textoResultadoSync({ analizados: 1, restantes: 0 }), '1 analizado.');
  assert.equal(textoResultadoSync({ analizados: 6, restantes: 9 }), '6 analizados · quedan 9.');
  assert.equal(textoResultadoSync({}), '0 analizados.', 'una respuesta sin números no dibuja «undefined»');
});

test('el corte dice dónde quedó el trabajo; un error normal, su mensaje', () => {
  const corte = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
  assert.match(mensajeDeFallo('sync', corte), /proceso diario/);
  assert.match(mensajeDeFallo('valorar', corte), /historial/);
  assert.match(mensajeDeFallo('borrar', Object.assign(new Error('x'), { name: 'AbortError' })), /Vuelve a intentarlo/);
  assert.equal(mensajeDeFallo('valorar', new Error('Sin cuota en Gemini')), 'Sin cuota en Gemini');
  assert.equal(mensajeDeFallo('sync', new Error('   ')), 'No se pudo completar.');
});

test('la vista y sus rutas comparten el contrato: el piso del guion y los topes', () => {
  const valorar = leer('app/api/ads-analyst/valorar/route.ts');
  const sync = leer('app/api/ads-analyst/sync/route.ts');
  const piso = Number(/guion\.length < (\d+)/.exec(valorar)?.[1]);
  assert.equal(MIN_GUION, piso, `la vista pide ${MIN_GUION} caracteres y la ruta ${piso}`);
  assert.equal(faltaParaValorar('x'.repeat(MIN_GUION - 1)), 'Pega el guion completo (unas líneas) para poder valorarlo.');
  assert.equal(faltaParaValorar(`  ${'x'.repeat(MIN_GUION - 1)}   `), faltaParaValorar('x'), 'los espacios no cuentan, como en la ruta (trim)');
  assert.equal(faltaParaValorar('x'.repeat(MIN_GUION)), null);
  const dur = (src: string) => Number(/export const maxDuration = (\d+)/.exec(src)?.[1]) * 1000;
  assert.ok(TOPE_VALORAR_MS > dur(valorar) && TOPE_VALORAR_MS <= dur(valorar) + 15_000, 'el tope de valorar no acompaña al maxDuration de su ruta');
  assert.ok(TOPE_SYNC_MS > dur(sync) && TOPE_SYNC_MS <= dur(sync) + 15_000, 'el tope de sync no acompaña al maxDuration de su ruta');
});

// ── La page, la vista y la puerta ──────────────────────────────────────────────────────────

test('page.tsx: lee ?tab= de un módulo puro y «Analizar guion» no pasa por la puerta del onboarding', () => {
  const page = sinComentarios(leer('app/ads-writer/page.tsx'));
  assert.match(page, /import \{ tabDeUrl \} from '\.\/tabs';/, 'tabDeUrl tiene que venir de ./tabs (puro)');
  assert.doesNotMatch(leer('app/ads-writer/tabs.ts'), /^\s*['"]use client['"]/m, 'tabs.ts no puede ser un módulo de cliente');
  assert.doesNotMatch(leer('app/ads-writer/analizar.ts'), /^\s*['"]use client['"]/m, 'analizar.ts no puede ser un módulo de cliente');
  assert.match(page, /const tab = tabDeUrl\(\(await searchParams\)\.tab\);/);

  const iPuente = page.indexOf('await puentearPasosCopyGen(');
  const iAnalizar = page.indexOf("if (tab === 'analizar') return <AdsWriterApp tabInicial={tab} analizar={await vistaAnalizar()} />;");
  const iGuard = page.indexOf("await onboardingTabPendiente('ads-writer')");
  assert.ok(iPuente >= 0 && iAnalizar >= 0 && iGuard >= 0, 'no encontré el puente, la rama de analizar o el guard');
  assert.ok(iPuente < iAnalizar, 'el puente tiene que seguir corriendo primero');
  assert.ok(iAnalizar < iGuard, '«Analizar guion» quedó detrás de la puerta del onboarding');

  // Sin Meta, lo mismo que Ads Analyst: el panel que la pide (y no una vista con todo en cero).
  const vista = page.slice(page.indexOf('async function vistaAnalizar'), page.indexOf('export default'));
  assert.match(vista, /const tab = tabActivacion\('script'\);\s*if \(tab && !\(await integracionConectada\('meta'\)\)\) return <PanelActivacion tab=\{tab\} \/>;/);
  assert.match(vista, /Promise\.allSettled\(\[/, 'una lectura que falla no puede apagar a las otras');
  assert.doesNotMatch(vista, /scripts=|vista\.value\.scripts/, 'la lista entera de guiones no viaja al navegador: esta vista no la dibuja');
});

test('AdsWriterApp: la tercera vista, escrita de vuelta con el router de la casa y montada una sola vez', () => {
  const app = sinComentarios(leer('app/ads-writer/AdsWriterApp.tsx'));
  assert.match(app, /\{ k: 'analizar', label: 'Analizar guion' \}/);
  assert.match(app, /import \{ useRouter \} from '\.\.\/_ui\/Link';/, 'el router tiene que ser el de la casa (conserva el ?ws=)');
  assert.match(app, /router\.replace\(destino, \{ scroll: false \}\)/);
  assert.match(app, /destino = hrefDeVista\(window\.location\.href, v\)/);
  assert.doesNotMatch(app, /history\.(replaceState|pushState)/, 'con history.* el árbol del router queda con la vista vieja');
  assert.doesNotMatch(app, /onClick=\{\(\) => setVista\(/, 'una vista que se cambia sin escribir la URL no se puede compartir');
  // Se guarda la última que mandó el server y se esconde con display: no se desmonta.
  assert.match(app, /if \(analizar != null\) setAnalizarVivo\(analizar\);/);
  assert.match(app, /display: enAnalizar \? 'block' : 'none'/);
});

test('AnalizarGuion: las mismas rutas, cada fetch con su tope, y «Actualizar igual» sólo con todo al día', () => {
  const src = sinComentarios(leer('app/ads-writer/AnalizarGuion.tsx'));
  for (const ruta of ["fetch('/api/ads-analyst/valorar'", 'fetch(`/api/ads-analyst/valorar?id=', "fetch('/api/ads-analyst/sync'"]) {
    assert.ok(src.includes(ruta), `falta ${ruta}`);
  }
  const fetches = src.split('fetch(').slice(1).map((s) => s.slice(0, s.indexOf(');')));
  assert.equal(fetches.length, 3);
  for (const f of fetches) assert.match(f, /signal: AbortSignal\.timeout\(TOPE_[A-Z]+_MS\)/, `un fetch sin tope: ${f.slice(0, 60)}`);
  assert.match(src, /<TaxonomyManager angles=\{angulos\} avatares=\{avatares\}/);
  // `force` re-analiza los primeros seis por ad_id (lib/ads-analyst.ts): sólo cuando lo pide «Actualizar igual».
  assert.equal(src.split('sincronizar(true)').length - 1, 1, 'sincronizar(true) tiene que aparecer UNA vez');
  const iForzado = src.indexOf('sincronizar(true)');
  assert.ok(src.lastIndexOf("confirmLabel: 'Actualizar igual'", iForzado) > src.lastIndexOf("confirmLabel: 'Analizar igual'", iForzado),
    'el único sincronizar(true) tiene que ser el de «Actualizar igual» con todo al día');
  assert.match(src, /confirm\('Se borra del historial/, 'borrar del historial pregunta antes, como el resto de Ads Writer');
});

// ── El redirect y lo que queda de ScriptsBrowser ──────────────────────────────────────────

test('/ads-analyst y /ads-analyst/guiones redirigen a la hoja del Dashboard, con rutaConWs', () => {
  for (const p of ['app/ads-analyst/page.tsx', 'app/ads-analyst/guiones/page.tsx']) {
    const src = sinComentarios(leer(p));
    assert.match(src, /redirect\(await rutaConWs\('\/dashboard\?hoja=ads-analyst'\)\);/, `${p}: no redirige con rutaConWs`);
    assert.doesNotMatch(src, /ScriptsBrowser|getScriptAnalystView/, `${p}: sigue armando la pantalla vieja`);
  }
});

test('ScriptsBrowser sigue exportando lo que importa la ficha del Ads Manager, y la valoración es UNA copia', () => {
  const charts = leer('app/marketing/ad-charts.tsx');
  const m = /import \{([^}]+)\} from '\.\.\/ads-analyst\/ScriptsBrowser';/.exec(charts);
  assert.ok(m, 'ad-charts ya no importa de ScriptsBrowser: revisar si el archivo sigue haciendo falta');
  const nombres = m![1].split(',').map((s) => s.replace(/\btype\b/, '').trim()).filter(Boolean);
  assert.ok(nombres.length >= 5, nombres.join(','));
  const sb = sinComentarios(leer('app/ads-analyst/ScriptsBrowser.tsx'));
  for (const n of nombres) assert.match(sb, new RegExp(`export (function|type|const) ${n}\\b`), `ScriptsBrowser dejó de exportar ${n}`);
  // Una copia: ScriptsBrowser importa de Ads Writer y no redeclara.
  assert.match(sb, /from '\.\.\/ads-writer\/ValoracionGuion';/);
  for (const decl of [/\bconst KIND\b/, /\bconst VV\b/, /function ValoracionView\b/, /function rgba\b/, /function kindChip\b/]) {
    assert.doesNotMatch(sb, decl, `ScriptsBrowser volvió a declarar ${decl}`);
  }
  // Ninguna cadena del producto arranca con la ruta retirada (las /api/ads-analyst no se renombran).
  for (const p of ['app/ads-analyst/ScriptsBrowser.tsx', 'app/ads-writer/AnalizarGuion.tsx', 'app/ads-writer/AdsWriterApp.tsx', 'app/ads-writer/page.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(p)), /['"`]\/ads-analyst(?:[/?'"`])/, `${p} enlaza /ads-analyst`);
  }
});

test('ValoracionView pinta el ángulo con el vocabulario de quien la dibuja, y los bloques con los colores compartidos', () => {
  const v: Valoracion = {
    clasificacion: { angle: 'autoridad', hook_type: 'pregunta', tags: ['caso-real'], format: 'talking head', short: 'Guion de prueba' },
    beats: [{ kind: 'gancho', t0: 0, text: '¿Cuánto te cuesta un lead?' }, { kind: 'cta', t0: 20, text: 'Agenda tu llamada.' }],
    lectura_estructural: { title: 'Gancho fuerte', text: 'Arranca con una pregunta concreta.', punto_de_fuga: { beat_index: 1, motivo: 'CTA sin urgencia' } },
    patrones_match: [{ patron: 'Pregunta directa', evidencia: 'hook 31%' }],
    patrones_miss: [],
    prediccion: { verdicto: 'mejorar-gancho', hook_rate_estimado: { min: 18, max: 24 }, retencion_cta_estimada: { min: 6, max: 9 }, razon: 'Se parece a los que frenan poco.' },
    reescrituras: [{ que_cambiar: 'El gancho', propuesta: 'Empieza por el número.' }],
    plan_validacion: { presupuesto_usd: 150, dias_minimos: 5, impresiones_objetivo: 12000, control: 'el ganador actual', nota: '' },
    perfil: { n_total: 42, n_confiables: 17, angulo_saturado: null, under_testing_share: 0.3 },
  };
  const angulo = (k: string) => (k === 'autoridad' ? { label: 'Autoridad', c: '#123456' } : { label: k, c: '#6B675C' });
  const html = renderToStaticMarkup(createElement(ValoracionView, { v, angulo }));
  assert.match(html, />Autoridad</, 'el ángulo sale con su NOMBRE del vocabulario, no con su clave');
  assert.match(html, /color:#123456/, 'el chip del ángulo no usa el color del vocabulario');
  assert.match(html, />Mejorar gancho</);
  assert.match(html, /tus 42 guiones reales \(17 con señal suficiente\)/);
  assert.match(html, /punto de fuga: CTA sin urgencia/);
  assert.match(html, />Gancho</);
  assert.equal(BLOQUES_GUION.gancho.c, '#C8870C', 'el color del gancho cambió: la ficha del Ads Manager lo comparte');
  assert.equal(chipBloque('gancho').color, '#C8870C');
  assert.equal(chipBloque('raro').color, '#6B675C', 'un tipo de bloque desconocido sale gris');
  assert.deepEqual(veredictoDe('promesa-pero-validar').label, 'Promesa — validar');
  assert.deepEqual(veredictoDe(null), { label: '—', c: '#6B675C' });
});

// ── Textos que nombran la tab ──────────────────────────────────────────────────────────────

test('la API y el panel de activación ya no mandan a una tab que no existe', () => {
  const t = tabActivacion('script');
  assert.ok(t, 'la entrada script de TABS_ACTIVACION tiene que seguir (la key está en la base)');
  assert.equal(t!.key, 'script');
  assert.equal(t!.servicio, 'meta');
  assert.equal(t!.titulo, 'Analizar guion');
  // Closing Analyst también se retiró (fue entera a la hoja Closing del Dashboard): mismo archivo, mismo criterio.
  const c = tabActivacion('closing');
  assert.equal(c?.key, 'closing', 'la key closing se queda (está en la base)');
  assert.equal(c?.titulo, 'Closing en el Dashboard');
  const helpers = sinComentarios(leer('lib/api-mako/areas/ads.helpers.ts'));
  const run = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  const def = sinComentarios(leer('lib/api-mako/areas/ads.def.ts'));
  for (const [nombre, src] of [['ads.helpers', helpers], ['ads.run', run], ['ads.def', def]] as const) {
    assert.doesNotMatch(src, /(en|de) Ads Analyst\b/, `${nombre} sigue mandando a la tab Ads Analyst`);
    assert.doesNotMatch(src, /['"`]\/ads-analyst/, `${nombre} enlaza /ads-analyst`);
  }
  assert.match(helpers, /revísala en Ads Writer \(Analizar guion → Ángulos y avatares\)/);
  assert.match(def, /valorados en Ads Writer \(«Analizar guion»\)/);
  // Las claves de gating no se renombran con la pantalla.
  assert.match(def, /const G_ANALYST: Gating = \{ tab: 'script', rolMinimo: 'admin' \};/);
});

// ── Lo que los guards del repo todavía no ven (archivos nuevos sin `git add`) ─────────────────

/** Las palabras terminadas en á/é/í (o ás/és/ís) que SÍ son de tú o neutras. */
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país', 'quizá']);
const CON_TEXTO = [
  'app/ads-writer/AnalizarGuion.tsx', 'app/ads-writer/ValoracionGuion.tsx', 'app/ads-writer/analizar.ts',
  'app/ads-writer/tabs.ts', 'app/ads-writer/AdsWriterApp.tsx', 'app/ads-writer/page.tsx',
  'app/ads-analyst/page.tsx', 'app/ads-analyst/guiones/page.tsx',
];

test('sin voseo en lo que se dibuja, y ningún archivo de cliente importa un valor de un módulo server-only', () => {
  const malas: Record<string, string[]> = {};
  for (const ruta of CON_TEXTO) {
    assert.ok(existsSync(join(RAIZ, ruta)), `${ruta} no existe`);
    const codigo = sinComentarios(leer(ruta));
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    const todas = [...marcasDeVoseo(codigo).map(String), ...raras];
    if (todas.length) malas[ruta] = todas;
  }
  assert.deepEqual(malas, {}, 'voseo, o palabras con su forma («pegá», «tenés»…)');

  // La frontera de datos: un 'use client' sólo trae TIPOS de un módulo server-only.
  for (const ruta of ['app/ads-writer/AnalizarGuion.tsx', 'app/ads-writer/ValoracionGuion.tsx', 'app/ads-writer/AdsWriterApp.tsx', 'app/ads-writer/analizar.ts', 'app/ads-writer/tabs.ts']) {
    const src = sinComentarios(leer(ruta));
    for (const m of src.matchAll(/import\s+(type\s+)?[^;]*?from\s+'@\/(lib\/[^']+)';/g)) {
      if (m[1]) continue;
      const destino = ['.ts', '.tsx'].map((e) => join(RAIZ, `${m[2]}${e}`)).find(existsSync);
      if (!destino) continue;
      assert.doesNotMatch(readFileSync(destino, 'utf8'), /^import 'server-only';/m, `${ruta} importa un VALOR de ${m[2]}, que es server-only`);
    }
  }
});
