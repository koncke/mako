// =============================================================================
// «Nada por detrás», lote 3: los tres avisos del Pixel y de la landing son automatizaciones de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 3: `tracking-apagado`, `tracking-desactualizado` y `landing-cambio` los armaba el
// cron tracking-vigilante con su texto en el código, eligiendo la frase según el caso; el primero, además, lo REDACTABA una
// IA (`contexto`). Ahora son los eventos de la plataforma `tracking_apagado`, `pixel_viejo` y `landing_cambio`: el cron pasa
// sólo los hechos (lib/tracking-aviso.ts) y cada fila tiene su texto literal. Lo que el código elegía lo pregunta una
// CONDITION (si el Pixel viejo graba, si lo agregado se puede medir) y lo opcional es un renglón que se va solo.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-tracking.json`; base 6 / 0). Pasan / fallan:
//   1. los días sin su unidad («3» en vez de «3 días»)                              → 5 / 1
//   2. sin páginas nombradas, el renglón vacío en vez de faltar                       → 5 / 1
//   3. «se puede medir» es «no» con una sola pieza sin medir (y otra que sí)          → 5 / 1
//   4. la CONDITION del Pixel mira el valor al revés                                  → 5 / 1
//   5. el cron vuelve a mandar `contexto` a la IA                                     → 5 / 1
//   6. un evento sin lo que trae (sus datos no se ofrecen ni se validan)              → 4 / 2
//
// Correr: node --import tsx --test tests/tracking-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosDelEvento, pasosDelEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { datosLandingCambio, datosPixelViejo, datosTrackingApagado } from '../lib/tracking-aviso';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { variablesPara } from '../lib/variables-aviso';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';
import { decidir } from '../lib/flujo-pasos';
import { hechosDelEvento } from '../lib/dato-evento';
import { normalizar } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const LINK = 'https://hola-mako.com/integraciones?abrir=landing&ws=4';

/** Corre la plantilla con esos datos, paso por paso como el runner: el texto que sale, o null si no sale nada. */
function loQueSale(plantilla: string, evento: string, datos: Record<string, string>): string | null {
  const t = pasosDelEvento(normalizar(pasosDePlantilla(plantillaPorId(plantilla)!)), evento);
  assert.equal(t.problema, null, `la plantilla no corre: ${t.problema}`);
  const hechos = hechosDelEvento(datos, Date.now());
  const ahora = new Date();
  let paso = 0;
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const d = decidir(t.pasos, { paso, desde: ahora, respondioAt: null, ahora, hechos });
    if (d.que === 'terminar') return null;
    if (d.que === 'ejecutar') {
      const p = d.paso as { texto?: string; partes?: Array<{ cuerpo?: string }> };
      return textoConDatos(String(p.partes?.[0]?.cuerpo ?? p.texto ?? ''), datos);
    }
    if (d.que !== 'saltar') throw new Error('la fila esperó: no tiene DELAY');
    paso = d.siguiente;
  }
  throw new Error('la fila dio más vueltas que pasos');
}

test('la landing sin visitas: los días y la fecha como datos, sin IA', () => {
  const datos = datosTrackingApagado({ horas: 80, ultima: '2026-10-14T20:00:00Z', tz: 'America/Mexico_City', link: LINK });
  assert.deepEqual(datos, { tracking_dias: '3 días', tracking_ultima: '14 de octubre', tracking_link: LINK });
  const sale = loQueSale('mako-tracking-apagado', 'tracking_apagado', datos)!;
  assert.match(sale, /^🔴 \*Tu landing dejó de mandarme datos\*\n⏱️ Sin visitas hace 3 días\n🕐 La última: el 14 de octubre\n/);
  assert.match(sale, new RegExp(`Revísalo aquí:\\n${LINK.replace(/[?.]/g, '\\$&')}\\n\\n— MaKo$`));
  // Sin la fecha (no se pudo leer), el renglón se va entero.
  const sinFecha = loQueSale('mako-tracking-apagado', 'tracking_apagado', datosTrackingApagado({ horas: 50, ultima: null, tz: 'America/Mexico_City', link: LINK }))!;
  assert.match(sinFecha, /Sin visitas hace 2 días\nLos anuncios/);
  assert.doesNotMatch(sinFecha, /La última/);
});

test('el Pixel viejo: la CONDITION elige el texto según si graba, y las páginas son un renglón que se va solo', () => {
  const noGraba = loQueSale('mako-pixel-viejo', 'pixel_viejo', datosPixelViejo({ paginas: ['https://a.com/vsl', 'https://a.com/webinar'], noGraba: true, novedades: 'la grabación de cada visita', link: LINK }))!;
  assert.match(noGraba, /^🟡 \*Tu Pixel de MaKo es viejo y no graba las visitas\*\n📄 Las páginas:\n· https:\/\/a\.com\/vsl\n· https:\/\/a\.com\/webinar\n✨ Te estás perdiendo: la grabación de cada visita\n/);
  const graba = loQueSale('mako-pixel-viejo', 'pixel_viejo', datosPixelViejo({ paginas: [], noGraba: false, novedades: 'mejoras de medición', link: LINK }))!;
  assert.match(graba, /^🟡 \*Tu Pixel de MaKo es una versión vieja\*\n✨ Te estás perdiendo: mejoras de medición\n/, 'sin páginas nombradas, el renglón tiene que irse');
  assert.match(graba, /ponla en lugar del código viejo\. Con esa línea no vuelves a actualizar nada\.\n/);
});

test('la landing que cambió: lo agregado se mide o no (CONDITION), y lo agregado y lo sacado van cada uno en su renglón', () => {
  const medible = datosLandingCambio({ pagina: 'https://a.com/vsl', agregaste: 'un video', todasSinMedir: false, sacaste: null, link: LINK });
  assert.equal(medible.landing_medible, 'sí');
  assert.equal(loQueSale('mako-landing-cambio', 'landing_cambio', medible), `🟡 *Cambió tu página*\n📄 https://a.com/vsl\n➕ Le agregaste *un video*. Ya lo estoy midiendo.\n\n${LINK}\n\n— MaKo`);
  const deDrive = loQueSale('mako-landing-cambio', 'landing_cambio', datosLandingCambio({ pagina: 'https://a.com/vsl', agregaste: 'un video', todasSinMedir: true, sacaste: 'el formulario', link: LINK }))!;
  assert.match(deDrive, /➕ Le agregaste \*un video\*\. Desde ahí el reproductor no le avisa nada a la página/);
  assert.match(deDrive, /\n➖ Sacaste \*el formulario\*: dejo de pedírtelo en las pruebas, y lo que ya se registró sigue en tu CRM\.\n/);
  // Sólo se sacó algo: no hay renglón de lo agregado.
  const soloSaco = loQueSale('mako-landing-cambio', 'landing_cambio', datosLandingCambio({ pagina: 'https://a.com/vsl', agregaste: null, todasSinMedir: true, sacaste: 'la agenda', link: LINK }))!;
  assert.match(soloSaco, /^🟡 \*Cambió tu página\*\n📄 https:\/\/a\.com\/vsl\n➖ Sacaste \*la agenda\*/);
});

test('los tres son eventos de la plataforma, del super admin, y ofrecen sus datos', () => {
  for (const [subtipo, aviso, dato] of [['tracking_apagado', 'tracking-apagado', 'tracking_dias'], ['pixel_viejo', 'tracking-desactualizado', 'pixel_novedades'], ['landing_cambio', 'landing-cambio', 'landing_agregaste']] as const) {
    const ev = EVENTOS_MAKO.find((e) => e.subtipo === subtipo);
    assert.ok(ev && ev.plataforma === true && ev.aviso === aviso, subtipo);
    assert.ok(AVISOS_SOLO_SUPERADMIN.includes(aviso), aviso);
    const ofrece = variablesPara(datosDelEvento(subtipo)).map((v) => v.key);
    assert.ok(ofrece.includes(dato), `${subtipo}: falta {{${dato}}}`);
    // Cada evento ofrece SUS datos, no los de los otros dos.
    assert.ok(!ofrece.some((k) => /^(tracking|pixel|landing)_/.test(k) && !k.startsWith(dato.split('_')[0])), `${subtipo} ofrece datos ajenos`);
  }
});

test('el cron pasa sólo los hechos: ni texto escrito ahí ni `contexto` para una IA', () => {
  const src = leer('app/api/cron/tracking-vigilante/route.ts');
  assert.doesNotMatch(src, /texto:|contexto:/, 'volvió un texto armado en el cron');
  assert.match(src, /datos: datosTrackingApagado\(\{ horas, ultima, tz: await zonaDelNegocio\(w\.id\), link: linkLanding\(w\.id\) \}\)/);
  assert.match(src, /datos: datosPixelViejo\(\{/);
  assert.match(src, /datos: datosLandingCambio\(\{/);
  // «No se puede medir» sólo si NINGUNA pieza nueva se puede medir: con una que sí, ya se está midiendo.
  assert.match(src, /todasSinMedir: noMedibles\.length === nuevas\.length,/);
});

test('la mudanza crea las tres filas', () => {
  const m = leer('scripts/mudanza-avisos-plataforma.mts');
  for (const [p, e] of [['mako-tracking-apagado', 'tracking_apagado'], ['mako-pixel-viejo', 'pixel_viejo'], ['mako-landing-cambio', 'landing_cambio']]) {
    assert.ok(m.includes(`{ plantilla: '${p}', evento: '${e}' }`), p);
  }
});
