// =============================================================================
// Las Métricas de una automatización: el análisis programado y «Compartir» (24/10/2026)
// =============================================================================
// Dos defectos que encontró la medición de «Analizar con MaKo», antes de tocar el botón:
//   1. EL ANÁLISIS PROGRAMADO DE UNA HOJA DE MÉTRICAS SE BORRABA SOLO. La hoja era 'am-hoja' en TODAS las automatizaciones
//      y el cron la buscaba sólo en el Dashboard y en General: no la encontraba, decía «La hoja ya no existe» y le sacaba el
//      horario. Quien programaba un informe semanal nunca lo recibía, y la programación desaparecía. Y como el análisis se
//      guarda por persona y hoja, el de una automatización salía en las Métricas de otra.
//   2. «COMPARTIR» EN LAS MÉTRICAS ENTREGABA EL DASHBOARD ENTERO: el server comparte el informe del Dashboard de quien
//      mira (todas sus hojas), con un `?hoja=` que ahí no existe. Se saca de ahí (y «Copiar dashboard» del clic derecho).
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hojaDeMetricas, hojaInicialDeMetricas, idDeHojaDeMetricas, HOJA_DE_METRICAS_VIEJA } from '../lib/automatizacion-metricas';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const FLUJO = [
  { id: 'ini', nodo: 'inicio', siguiente: 'm1' },
  { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: null },
] as unknown as PasoGrafo[];

test('cada automatización tiene SU hoja de Métricas: ids distintos, y de la hoja se sabe la automatización', () => {
  const a = hojaInicialDeMetricas(FLUJO, 'Sprint · apertura', 289);
  const b = hojaInicialDeMetricas(FLUJO, 'Bienvenida', 300);
  assert.equal(a.id, 'am-289');
  assert.equal(b.id, 'am-300');
  assert.equal(hojaDeMetricas(289), 'am-289');
  const ids = (h: typeof a) => h.componentes.map((c) => c.id);
  assert.equal(ids(a).filter((x) => ids(b).includes(x)).length, 0, 'dos automatizaciones comparten ids de gráficos');
  assert.equal(idDeHojaDeMetricas('am-289'), 289);
  assert.equal(idDeHojaDeMetricas(HOJA_DE_METRICAS_VIEJA), null, 'la vieja no dice de qué automatización es');
  assert.equal(idDeHojaDeMetricas('h-abc123'), null);
  assert.equal(idDeHojaDeMetricas('am-289-por-dia'), null, 'un gráfico no es una hoja');
});

test('el cron busca la hoja de Métricas en el informe de SU automatización (o la que arma MaKo), antes que en el Dashboard', () => {
  const an = leer('lib/graficos-analisis-server.ts');
  const corr = an.slice(an.indexOf('export function drenarVencidos('), an.indexOf('\n}\n', an.indexOf('export function drenarVencidos(')));
  assert.match(corr, /const deMetricas = await hojaDeMetricasGuardada\(f\.usuario, f\.hoja_id\);\n\s+hoja = deMetricas !== undefined \? deMetricas : \(await leerInformeGuardado\(f\.usuario\)\)\.hojas\.find\(\(h\) => h\.id === f\.hoja_id\) \?\? null;/);
  const srv = leer('lib/automatizacion-metricas-server.ts');
  const g = srv.slice(srv.indexOf('export async function hojaDeMetricasGuardada('), srv.indexOf('\n}\n', srv.indexOf('export async function hojaDeMetricasGuardada(')));
  assert.match(g, /if \(id == null\) return undefined;/, 'una hoja que no es de Métricas la tiene que buscar el Dashboard');
  assert.match(g, /const raw = await getSettingEstricto\(claveInformeAutomatizacion\(id, usuario\)\);/, 'el informe guardado de ESA persona para ESA automatización');
  assert.match(g, /: informeInicialDeMetricas\(a\.pasos, a\.nombre, a\.id\);/, 'sin informe guardado, la hoja de MaKo (la que vio al programar)');
  // Lo guardado antes del arreglo ('am-hoja') se lee con la hoja de su automatización.
  assert.match(srv, /deMaKo \? informeInicialDeMetricas\(a\.pasos, a\.nombre, a\.id\) : conLaAutomatizacion\(conHojaRenombrada\(l\.tablero, a\.id\), a\.nombre\)/);
  // El aviso «El AI Analyst Terminó» de una hoja de Métricas lleva a su automatización, no a un Dashboard que no la tiene.
  assert.match(an, /link: linkApp\(sec != null \? `\/automations\?sec=\$\{sec\}` : `\/dashboard\?hoja=\$\{encodeURIComponent\(p\.hoja\.id\)\}`, p\.ws\),/);
});

test('«Compartir» y «Copiar dashboard» no se ofrecen en las Métricas de una automatización', () => {
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /\{guardable && !esGeneral && !esAutomatizacion && \(\s*<>\s*<RenglonCompartir onClick=\{abrirCompartir\} \/>/);
  assert.match(ed, /enGeneral: esGeneral, fueraDelDashboard: esAutomatizacion,/);
  assert.match(leer('app/dashboard/MenuContextual.tsx'), /const delDashboard: IdOpcion\[\] = c\.enGeneral \|\| c\.fueraDelDashboard \? \[\] : \['copiar_dashboard', 'compartir'\];/);
});

// ── Las roturas (3 tests; sin romper nada: 3 pases, 0 fallos). Cada una: 1 fallo / 2 pases. ──────────────────────────
// 1. La hoja vuelve a ser la misma en todas ('am-hoja').   2. El cron vuelve a buscar sólo en el Dashboard y General.
// 3. Sin informe guardado, el cron no arma la de MaKo.     4. Lo guardado con 'am-hoja' no se renombra al leer.
// 5. El aviso «Terminó» vuelve a llevar al Dashboard.      6. «Compartir» vuelve al ⋮ de las Métricas.
// 7. El clic derecho vuelve a ofrecer «Compartir» y «Copiar dashboard».
