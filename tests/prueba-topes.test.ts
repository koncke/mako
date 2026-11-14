// =============================================================================
// Los TOPES de la prueba gratis y «Empezar mi plan ya» (25/10/2026)
// =============================================================================
// El Cerebro (25/10): «Vale el plan elegido, con un tope de prueba en lo que alguien se puede "llevar" y después irse: videos
// generados 3, videos con avatar 1, imágenes 20, landings publicadas 1, exportar en masa sólo después del primer cobro, Media
// Buyer sólo propone. El resto del motor anda entero... cada pantalla le dice al que llega al tope "Disponible al terminar tu
// prueba" con un botón para empezar ya el plan». Lo que se cuida acá:
//   · la tabla (lib/topes-plan.ts, se ejecuta): los números, `topeDe(CAPA_PRUEBA, …)` y el menor entre plan y prueba;
//   · cada punto donde se CREA frena antes y suma después (se lee del fuente: son acciones del servidor);
//   · cada pantalla dibuja el botón junto a su error;
//   · «Empezar mi plan ya» abre un cobro nuevo atado al negocio, y la prueba se cancela recién cuando ese cobro se paga (y si la
//     prueba ya se había cobrado, se cancela el nuevo y se avisa: un mes cobrado dos veces).
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAPA_PRUEBA, esTopeDePrueba, PREFIJO_TOPE_PRUEBA, RUTA_EMPEZAR_PLAN, textoTopePrueba, topeDe, topeEnPrueba, TOPES_PRUEBA,
} from '../lib/topes-plan';
import { creadoPorEmpezarYa, pruebaDeEmpezarYa } from '../lib/prueba-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}
/** `antes` aparece antes que `despues` en el texto. */
const antes = (t: string, a: string, d: string, msg: string) => {
  const i = t.indexOf(a), j = t.indexOf(d);
  assert.ok(i >= 0, `${msg}: falta «${a}»`);
  assert.ok(j >= 0, `${msg}: falta «${d}»`);
  assert.ok(i < j, msg);
};

test('la TABLA de la prueba: los números del Cerebro, con `topeDe(CAPA_PRUEBA, …)` y el menor entre el plan y la prueba', () => {
  assert.deepEqual({ ...TOPES_PRUEBA }, {
    'prueba.videos': 3, 'prueba.tomas': 30, 'prueba.avatares': 1, 'prueba.imagenes': 20, 'web.landings_publicadas': 1, 'prueba.exportar': 0,
  });
  assert.equal(topeDe(CAPA_PRUEBA, 'prueba.videos'), 3);
  assert.equal(topeDe('agencia', 'prueba.videos'), null, 'un plan pagado no tiene tope de videos');
  assert.equal(topeEnPrueba('completo', 'web.landings_publicadas'), 1, 'Esencial publica 3, en prueba 1');
  assert.equal(topeEnPrueba('agencia', 'web.landings_publicadas'), 1, 'Pro no tiene tope, en prueba 1');
  assert.equal(topeEnPrueba('agencia', 'crm.leads'), null, 'el resto del motor, entero');
  assert.equal(topeEnPrueba('completo', 'crm.leads'), 2000, 'en prueba de Esencial, los topes de Esencial');
});

test('el TEXTO de cada tope: «Disponible al terminar tu prueba», qué topó, y cómo seguir', () => {
  assert.equal(PREFIJO_TOPE_PRUEBA, 'Disponible al terminar tu prueba');
  assert.equal(textoTopePrueba('prueba.videos', 3), 'Disponible al terminar tu prueba: en la prueba gratis van hasta 3 videos armados. Se habilita con tu plan.');
  assert.equal(textoTopePrueba('prueba.avatares', 1), 'Disponible al terminar tu prueba: en la prueba gratis va 1 video con avatar de IA. Se habilita con tu plan.');
  assert.match(textoTopePrueba('prueba.exportar', 0), /exportar y descargar en masa se habilita con tu primer cobro/);
  for (const t of Object.keys(TOPES_PRUEBA) as Array<keyof typeof TOPES_PRUEBA>) assert.ok(esTopeDePrueba(textoTopePrueba(t, TOPES_PRUEBA[t])), t);
  assert.ok(!esTopeDePrueba('Llegaste al tope de tu plan (3). Pasa a MaKo Pro para tener más.'), 'el de un plan pagado es otro');
  assert.equal(RUTA_EMPEZAR_PLAN, '/configuraciones/plan?empezar=1');
});

test('EN PRUEBA = su suscripción de MaKo es una prueba sin cobrar; fuera de la prueba, ningún tope de prueba', () => {
  const f = fuente('lib/prueba-uso.ts');
  assert.match(f, /\.eq\('workspace_id', plataforma\)\.eq\('alta_ws', ws\)\.eq\('tipo', 'suscripcion'\)\.or\(FILTRO_SUSCRIPCION_DE_MAKO\)/);
  // Desde el 28/10/2026, sin ninguna suscripción mira el plan dado a mano (tests/plan-a-mano.test.ts); con una, como siempre.
  assert.match(f, /if \(!c\) return await deUnPlanAMano\(ws, nada\);\s*if \(!esPruebaDePlan\(c\) \|\| c\.estado !== 'pendiente'\) return nada;/, 'con el primer cobro, los topes se van solos');
  assert.match(cuerpo('lib/prueba-uso.ts', 'frenoDePrueba'), /if \(!e\.enPrueba\) return \{ ok: true \};/);
  assert.match(cuerpo('lib/prueba-uso.ts', 'sumarUsoDePrueba'), /if \(!\(await estadoDePrueba\(ws\)\)\.enPrueba\) return;/, 'sólo cuenta en la prueba');
  assert.doesNotMatch(f, /from '\.\/cobros'/, 'lo llaman acciones del navegador: sin el grafo de lib/cobros (tests/d6b-rutas.test.ts)');
});

test('cada lugar donde se CREA: frena antes de crear y suma después de crear', () => {
  const vg = 'app/video-generator/video-action.ts';
  const toma = cuerpo(vg, 'generarTomaAction');
  antes(toma, "await frenoDePrueba(ctx.ws, 'prueba.tomas')", "encolar('generar_clip'", 'la toma frena antes de encolar');
  antes(toma, "encolar('generar_clip'", "await sumarUsoDePrueba(ctx.ws, 'prueba.tomas')", 'y suma después');
  const img = cuerpo(vg, 'generarImagenAction');
  antes(img, "await frenoDePrueba(ctx.ws, 'prueba.imagenes')", "encolar('generar_imagen'", 'la imagen frena antes');
  antes(img, "if (trabajoId == null) return { ok: false, error: 'No se pudo encolar la imagen.' };", "await sumarUsoDePrueba(ctx.ws, 'prueba.imagenes')", 'y suma si se encoló');
  const montaje = cuerpo(vg, 'montarAnuncioAction');
  antes(montaje, "const esNuevo = !yaArmado;", "await frenoDePrueba(ctx.ws, 'prueba.videos')", 'sólo el PRIMER montaje de un anuncio es un video');
  antes(montaje, "from('montaje_trabajos')\n    .insert(", "if (esNuevo) await sumarUsoDePrueba(ctx.ws, 'prueba.videos');", 'y suma después de crearlo');
  const av = 'app/ai-avatar/actions.ts';
  antes(cuerpo(av, 'crearLookAction'), "await frenoDePrueba(ws, 'prueba.imagenes')", "encolar('generar_imagen'", 'el look es una imagen');
  const video = cuerpo(av, 'crearVideoAction');
  antes(video, "await frenoDePrueba(ws, 'prueba.avatares')", 'await generarPlanAction(', 'el video con avatar frena antes del plan');
  antes(video, 'await guardarEnHistorial(item);', "await sumarUsoDePrueba(ws, 'prueba.avatares');", 'y suma después');
  const editor = cuerpo('app/video-editor/avatar/actions.ts', 'crearAvatarAction');
  antes(editor, "await frenoDePrueba(ws, 'prueba.avatares')", 'await generarPlanAction(', 'el avatar del editor, igual');
  // La página publicada: en el freno de siempre del Web Generator, contando las publicadas de hoy.
  const pub = cuerpo('lib/editor-landing/tope-landings-server.ts', 'frenoDeTope');
  antes(pub, "await frenoDePrueba(ws, 'web.landings_publicadas', { usadas: count ?? 0 })", 'topeParaPublicar(pedido)', 'publicar, con el tope de la prueba');
  // Exportar en masa: el modal pregunta antes (un error tirado llega sin texto en producción) y la acción vuelve a frenar.
  const crm = 'app/crm/actions.ts';
  assert.match(cuerpo(crm, 'topeDeExportarAction'), /await frenoDePrueba\(ws, 'prueba\.exportar', \{ usadas: 0 \}\)/);
  assert.match(cuerpo(crm, 'exportLeadsAction'), /const tope = await topeDeExportarAction\(\);\s*if \(tope\) throw new Error\(tope\);/);
  antes(fuente('app/crm/ExportarLeadsModal.tsx'), 'topeDeExportarAction()', 'return exportLeadsAction(f);', 'el modal pregunta antes de armar el archivo');
});

test('cada PANTALLA dibuja «Empezar mi plan ya» junto a su error', () => {
  assert.match(fuente('app/_ui/EmpezarPlanYa.tsx'), /if \(texto !== undefined && !esTopeDePrueba\(texto\)\) return null;/);
  assert.match(fuente('app/_ui/EmpezarPlanYa.tsx'), /<a href=\{RUTA_EMPEZAR_PLAN\}/);
  assert.match(fuente('app/video-generator/WizardAnuncio.tsx'), /<EmpezarPlanYa texto=\{error\} \/>/);
  assert.match(fuente('app/video-generator/PasoMontaje.tsx'), /<EmpezarPlanYa texto=\{error \|\| null\} \/>/);
  // AI Avatar es el estudio de Higgsfield desde el 29/10/2026: la barra del look y la del video, cada una con su error.
  assert.equal((fuente('app/ai-avatar/Estudio.tsx').match(/<EmpezarPlanYa texto=\{(error|errorVideo) \|\| null\} \/>/g) ?? []).length, 2, 'el look y el video');
  assert.match(fuente('app/crm/ExportarLeadsModal.tsx'), /<EmpezarPlanYa texto=\{err\} \/>/);
  assert.match(fuente('app/web-generator/editor/dialogos/DialogoPublicar.tsx'),
    /if \(esTopeDePrueba\(error\)\) return <> <Link href=\{RUTA_EMPEZAR_PLAN\} style=\{\{ fontWeight: 600 \}\}>Empezar mi plan ya<\/Link><\/>;/);
});

test('«EMPEZAR MI PLAN YA»: un cobro nuevo atado al negocio; la prueba sigue hasta que ese cobro se pague', () => {
  assert.equal(creadoPorEmpezarYa(41), 'empezar-ya:41');
  assert.equal(pruebaDeEmpezarYa('empezar-ya:41'), 41);
  assert.equal(pruebaDeEmpezarYa('planes:pro:prueba'), null);
  const f = cuerpo('lib/empezar-plan.ts', 'empezarPlanAhora');
  assert.match(f, /if \(!prueba \|\| !esPruebaDePlan\(prueba\) \|\| prueba\.estado !== 'pendiente'\) return \{ ok: false/);
  assert.match(f, /if \(inicio && Date\.parse\(inicio\) - ahoraMs < DIA_MS\) return \{ ok: false/, 'a un día del cobro, no hace falta');
  antes(f, '.update({ alta_ws: ws,', 'return { ok: true, link: r.link };', 'atado a su negocio antes de devolver el link');
  assert.doesNotMatch(f, /cancelarSuscripcion/, 'abrir el link NO cancela la prueba');
  const a = cuerpo('app/configuraciones/plan/actions.ts', 'empezarPlanYaAction');
  antes(a, 'await adminDeWorkspaceActual()', 'empezarPlanAhora(ws,', 'sólo el admin');
  assert.match(a, /if \(await estaImpersonando\(\)\.catch\(\(\) => true\)\) return \{ ok: false/, 'quien mira otro negocio no le abre un cobro');
  const p = fuente('app/configuraciones/plan/page.tsx');
  assert.match(p, /const pro = capa === 'completo' && !enPrueba \?/, 'en prueba, sin «Pasar a Pro»');
  assert.match(p, /oferta=\{enPrueba \? null : oferta\}/, 'ni la oferta de retención');
  assert.match(fuente('app/configuraciones/plan/PlanPanel.tsx'), /titulo="Empezar mi plan ya"/);
});

test('al COBRARSE «empezar ya»: la prueba se cancela en la pasarela y se anula; si ya se había cobrado, se corta la nueva y se avisa', () => {
  const f = cuerpo('lib/cobros.ts', 'cerrarPruebaAlEmpezarYa');
  assert.match(f, /if \(pruebaId == null \|\| c\.estado !== 'pagado' \|\| c\.tipo !== 'suscripcion'\) return;/);
  antes(f, 'await cancelarSuscripcionCobro(plataforma, prueba.id,', "estado: 'anulado', motivo: 'Empezó su plan antes de terminar la prueba.'", 'primero se corta el cobro del día 8');
  assert.match(f, /if \(!r\.ok\) \{ console\.error\([^\n]*\); return; \}/, 'si no se pudo cortar, no se anula (el cron reintenta)');
  assert.match(f, /await cancelarSuscripcionCobro\(plataforma, c\.id, 'Cobro doble del primer mes'\);/);
  assert.match(f, /avisarDePlataforma\(\{ to: EMAIL_MAKO, tag: 'cobro-doble'/);
  assert.match(cuerpo('lib/cobros.ts', 'aplicarPagoAprobado'), /if \(!renovacion\) await cerrarPruebaAlEmpezarYa\(actual\);/);
  assert.match(cuerpo('lib/cobros.ts', 'reconciliarCobros'), /await cerrarPruebaAlEmpezarYa\(c\);/);
});

test('la VITRINA cuenta los topes de la prueba con los números de la tabla', () => {
  // Desde el 14/11/2026 /planes muestra las preguntas de la portada (Martín: «tienen que ser siempre las mismas»): los topes de la
  // prueba van en su respuesta, en app/vsl/_sitio/preguntas.ts, con los números de la tabla; y la vitrina dibuja ESAS preguntas.
  const q = fuente('app/vsl/_sitio/preguntas.ts');
  for (const t of ['prueba.videos', 'prueba.avatares', 'prueba.imagenes', 'web.landings_publicadas']) assert.ok(q.includes(`\${TOPES_PRUEBA['${t}']}`), t);
  assert.match(q, /exportar en masa se habilita con el primer cobro/);
  assert.match(fuente('app/planes/Vitrina.tsx'), /PREGUNTAS_SITIO\.map/, 'la vitrina dibuja las preguntas de la portada');
});

// Roturas (25/10/2026; base 19 / 0 con topes-plan y mi-plan), cada una restaurada (pasan / fallan):
//   · 5 videos en la prueba                                       -> 18 / 1
//   · el mayor entre plan y prueba                                -> 18 / 1
//   · el texto sin «Disponible al terminar tu prueba»             -> 18 / 1
//   · un plan ya cobrado sigue con topes de prueba                -> 18 / 1
//   · el uso se suma también fuera de la prueba                   -> 18 / 1
//   · la toma sin freno                                           -> 18 / 1
//   · cada montaje cuenta como un video                           -> 18 / 1
//   · el video con avatar sin freno                               -> 18 / 1
//   · el avatar del editor sin freno                              -> 18 / 1
//   · publicar sin el tope de la prueba                           -> 18 / 1
//   · exportar sin freno en el servidor                           -> 18 / 1
//   · el modal exporta sin preguntar                              -> 18 / 1
//   · el botón en cualquier error                                 -> 18 / 1
//   · publicar sin el botón de la prueba                          -> 18 / 1
//   · abrir «empezar ya» cancela la prueba                        -> 18 / 1
//   · «empezar ya» sin atarlo al negocio                          -> 18 / 1
//   · la prueba se anula sin cortar el cobro del día 8            -> 18 / 1
//   · un mes cobrado dos veces sin aviso                          -> 18 / 1
//   · el pago de «empezar ya» no cierra la prueba                 -> 18 / 1
//   · «Pasar a Pro» en la prueba                                  -> 18 / 1
//   · la vitrina con los topes a mano                             -> 18 / 1
