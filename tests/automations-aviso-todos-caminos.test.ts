// =============================================================================
// El aviso de duplicada por TODOS los caminos que prenden algo, y lo que dejó la revisión de la punta 396a82847
// =============================================================================
// Revisión adversarial del Cerebro (20/10/2026, noche; detalle en sus notas, revision-automations-20-10-noche.md):
//   1. (media, confirmado) el aviso «Ojo: «X» ya le escribe algo parecido a la misma gente» —el que habría frenado #282 y
//      el d2 de #284 del ws11— no salía al Activar desde el «⋯» de la lista ni al agregarle un CRON a una activa;
//   2. al Activar comparaba el BORRADOR del lienzo, no lo publicado que manda el motor (y la nota del chat, igual);
//   3. con `ignorar_ventana` y lo propio ilegible, la corrida mandaba con las horas del negocio;
//   4. «Copiar flujo» › «Crear» en el MISMO negocio perdía la configuración propia;
//   5. con la lista al entrar, el paso au-chat del recorrido no aparecía nunca.
//
// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-todos-caminos.json`): ver el pie.
//
// Correr: node --import tsx --test tests/automations-aviso-todos-caminos.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { duplicadaAlActivar, type CronParaComparar } from '../lib/automatizacion-duplicada';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { DONDE, PASOS_AUTOMATIONS } from '../app/automations/recorrido-automations';
import { SimuladorWhatsApp } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const cuerpo = (src: string, firma: string, fin = '\n}\n'): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `falta «${firma}»`);
  return src.slice(i, src.indexOf(fin, i));
};

// #282 y #284 del ws11, con sus primeros mensajes de verdad.
const msg = (id: string, cuerpo: string): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo, siguiente: null }) as unknown as PasoGrafo;
type Fila = { id: number; nombre: string; activa: boolean; pasos: PasoGrafo[]; crons: CronParaComparar[] };
const cron = (etapa: string): CronParaComparar => ({ trigger_tipo: 'etapa_actual', etapa, funnel_id: 4 });
const S282: Fila = { id: 282, nombre: 'Recordatorio clase reactivación', activa: true, crons: [cron('reactivacion')],
  pasos: [msg('a', '¡Holaa {{nombre}}! Paso a recordarte que mañana miércoles nos vemos en la clase presencial de LíderMente en Gnius Huayacán 🔥 ¿Contamos contigo mañana?')] };
const S284: Fila = { id: 284, nombre: 'Recordatorio martes sesión LíderMente', activa: false, crons: [cron('agenda'), cron('reactivacion')],
  pasos: [msg('b', 'Holaa {{nombre}}! Mañana miércoles tenemos la sesión presencial de LíderMente a las 7:30 pm en Huayacán. ¿Cuento contigo?')] };
const cronsDe = (f: Fila) => f.crons;

test('1. al activar se compara lo PUBLICADO de las dos y sus CRON guardados', () => {
  assert.deepEqual(duplicadaAlActivar(S284, [S282, S284], cronsDe), { id: 282, nombre: S282.nombre });
  // Un borrador distinto no cambia lo que manda el motor: lo que cuenta es lo publicado (la fila).
  // Y quien pasa otros pasos u otros CRON (un CRON recién guardado), con eso.
  assert.equal(duplicadaAlActivar(S284, [S282, S284], cronsDe, { crons: [cron('agenda')] }), null, 'otra etapa: no es la misma gente');
  assert.equal(duplicadaAlActivar(S284, [S282, S284], cronsDe, { pasos: [msg('c', 'Te dejo el link de la grabación para que la veas cuando puedas')] }), null);
  // La otra pausada no cuenta; ella misma tampoco.
  assert.equal(duplicadaAlActivar(S284, [{ ...S282, activa: false }, S284], cronsDe), null);
  assert.equal(duplicadaAlActivar(S282, [S282], cronsDe), null);
});

test('1. el «⋯» de la lista pregunta antes de Activar, con lo publicado, y «Activar igual» sigue sin volver a preguntar', () => {
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  const a = cuerpo(lista, 'const accionFila = async (j: SecuenciaDto, accion: string, o?: { sinAviso?: boolean }) => {', '\n  };');
  assert.match(a, /if \(accion === 'activa' && !j\.activa && rolAdmin && !o\?\.sinAviso\) \{\n\s+const otra = duplicadaAlActivar\(j as SecuenciaConDisparadores, secuencias as readonly SecuenciaConDisparadores\[\], disparadoresDeSecuencia\);\n\s+if \(otra\) \{ setErrFila\(null\); setAvisoActivar\(\{ j, texto: avisoDuplicada\(otra\.nombre\) \}\); return; \}/);
  // Antes del PATCH: la pregunta va ANTES de prender.
  assert.ok(a.indexOf('duplicadaAlActivar(') < a.indexOf("pedir('/api/whatsapp/secuencias', 'PATCH'"));
  assert.match(lista, /if \(a\) void accionFila\(a\.j, 'activa', \{ sinAviso: true \}\);/);
  assert.match(lista, /<Confirm message=\{avisoActivar\.texto\} confirmLabel="Activar igual" cancelLabel="Cancelar" tone="primary"\n\s+onConfirm=\{activarIgual\} onCancel=\{\(\) => setAvisoActivar\(null\)\} \/>/);
});

test('1. un CRON nuevo en una ACTIVA: el aviso sale al guardarlo, sólo si recién ahí pasó a ser la misma gente', () => {
  const ed = sinComentarios(leer('app/automations/EditorDisparadores.tsx'));
  const m = cuerpo(ed, 'const mandar = async (body: Record<string, unknown>) => {', '\n  };');
  // Después de limpiar el error: si no, el aviso se borraba en el mismo tick.
  assert.ok(m.indexOf('cb.current.onError(null);') < m.indexOf('cb.current.onGuardado?.(confirmada.current, previa);'));
  assert.match(m, /const previa = confirmada\.current;\n\s+confirmada\.current = /);
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /onGuardado: \(n, p\) => alGuardarCronsRef\.current\(n, p\) \}\);/);
  const g = cuerpo(perfil, 'const alGuardarCrons = (nueva: readonly Disparador[], previa: readonly Disparador[]) => {', '\n  };');
  assert.match(g, /if \(!rolAdmin \|\| !activa\) return;/);
  assert.match(g, /\{ pasos: abiertoPublicado, crons: lista \}/);
  assert.match(g, /if \(otra && !con\(previa\)\) setErr\(avisoDuplicada\(otra\.nombre\)\);/);
  assert.match(perfil, /useEffect\(\(\) => \{ alGuardarCronsRef\.current = alGuardarCrons; \}\);/);
});

test('2. el interruptor «Activar» del lienzo y la nota del chat miran lo PUBLICADO, no el borrador', () => {
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /conAvisoDuplicada\(true, 'Activar igual', \(\) => void toggle\(\), abiertoPublicado\)/);
  assert.match(perfil, /if \(!activa && dejaBorradores\(abiertoPublicado, est\?\.envio_automatico === true\)\) \{/);
  // Publicar sí compara lo del lienzo: es lo que pasa a mandarse.
  assert.match(perfil, /conAvisoDuplicada\(activa, 'Publicar igual', \(\) => void publicar\(\)\)/);
  assert.match(perfil, /const conAvisoDuplicada = \(vaAMandar: boolean, boton: string, seguir: \(\) => void, queManda: readonly PasoSecuenciaDto\[\] = pasos\) => \{/);
  // Y lo publicado se pone al día al publicar.
  assert.match(perfil, /setAbiertoPublicado\(pasos\);/);
});

test('3. sin lo propio y sin el corte del horario (`ignorar_ventana`), la corrida no manda', () => {
  const pe = cuerpo(sinComentarios(leer('lib/nutricion.ts')), 'export async function procesarEnvios(');
  assert.match(pe, /if \(limites === 'ilegible' \|\| \(configs === 'ilegible' && fueraDeHorario == null\)\) return \{ \.\.\.res, saltado: 'limites-ilegibles' \};/);
  // El corte del horario sólo corre sin `ignorarVentana`: por eso hace falta el de arriba.
  assert.match(pe, /if \(!opts\?\.ignorarVentana\) \{\n\s+const horario = await horarioDeEnvio\(\);\n\s+if \(horario === 'ilegible' \|\| configs === 'ilegible'\) fueraDeHorario = 'horario-ilegible';/);
});

test('4. «Copiar flujo» › «Crear» en el MISMO negocio lleva la configuración propia; entre negocios, no', () => {
  const neg = sinComentarios(leer('lib/flujo-copia-negocio.ts'));
  const c = cuerpo(neg, 'export async function crearDesdeCopia(');
  // Adentro del try que borra la copia si algo falla.
  assert.match(c, /try \{\n\s+await setSecuenciaPasos\(id, pasos as unknown as PasoSecuencia\[\]\);\n\s+if \(o\.configDe\) await copiarConfigAutomatizacion\(o\.configDe, id\);\n\s+\} catch \(e\) \{\n\s+await Promise\.resolve\(db\.from\('nutricion_secuencias'\)\.delete\(\)\.eq\('id', id\)\)/);
  const o = cuerpo(neg, 'export async function origenDeCopia(');
  assert.match(o, /if \(leerCopia\(texto\)\) return null;/, 'el texto entero de una copia no dice de dónde salió');
  assert.match(o, /\.select\('workspace_origen, secuencia_origen'\)\.eq\('token', t\)\.maybeSingle\(\);/);
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /const origen = await origenDeCopia\(body\.copia\);\n\s+const r = await crearDesdeCopia\(copia, \{ configDe: origen && origen\.ws === ws \? origen\.secuenciaId : null \}\);/);
});

const sec = (id: number, nombre: string) => ({
  id, clave: `s${id}`, nombre, etapa: 'nuevo', trigger_tipo: 'manual', activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
}) as unknown as SecuenciaDto;

test('5. el paso au-chat tiene dónde mostrarse con la lista a la vista: la fila elegida', () => {
  assert.deepEqual(DONDE['au-chat'].map((b) => b.css), ['aside[aria-label="Chat con MaKo"]', 'aside[aria-label="Tus automatizaciones"] button[aria-current="true"]']);
  assert.equal(PASOS_AUTOMATIONS.find((p) => p.objetivo === 'au-chat')?.texto, 'Abre una y aquí le pides cambios a MaKo. Con ← vuelves a tu lista.');
  // Dibujada al entrar: la lista, y adentro la fila elegida con `aria-current="true"`.
  const html = renderToStaticMarkup(createElement(SimuladorWhatsApp, {
    secuencias: [sec(1, 'Bienvenida'), sec(2, 'Reactivación')], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
    rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {}, productos: [], disparadores: [], tz: null,
  } as Parameters<typeof SimuladorWhatsApp>[0]));
  const aside = html.indexOf('<aside aria-label="Tus automatizaciones"');
  assert.ok(aside >= 0);
  const fila = html.indexOf('aria-current="true"', aside);
  assert.ok(fila > aside && fila < html.indexOf('</aside>', aside), 'el paso no encuentra la fila elegida en la lista');
});

// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-todos-caminos.json`, una rotura por vez y restaurada con
// md5 igual). Base 7 / 0. Cada una → 6 / 1:
//    1. `duplicadaAlActivar` ignora los CRON de quien llama     10. el CRON compara el borrador
//    2. `duplicadaAlActivar` ignora los pasos de quien llama    11. sin el ref del render de ahora
//    3. el «⋯» de la lista activa sin preguntar                 12. Activar compara el borrador
//    4. «Activar igual» vuelve a preguntar                      13. la nota del chat con el borrador
//    5. la pregunta también al pausar                           14. `ignorar_ventana` con lo propio ilegible manda
//    6. `onGuardado` antes de limpiar el error                  15. la copia sin la configuración
//    7. `previa` = la nueva                                     16. la ruta copia también entre negocios
//    8. el CRON avisa también pausada                           17. el origen de un texto entero
//    9. el CRON avisa aunque ya fuera así                       18. au-chat sin la fila elegida
// Restaurado: 7 / 0.
