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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EMAIL_MAKO } from '../lib/app-url';
import {
  CAPA_PRUEBA, esTopeDePrueba, PREFIJO_TOPE_PRUEBA, RUTA_EMPEZAR_PLAN, textoTopePrueba, topeDe, topeEnPrueba, TOPES_PRUEBA,
} from '../lib/topes-plan';
import { creadoPorEmpezarYa, pruebaDeEmpezarYa } from '../lib/prueba-plan-reglas';
// La respuesta que la persona LEE, dibujada de verdad (no el fuente del FAQ): PREGUNTAS_SITIO es la lista que dibujan la portada,
// /planes (app/planes/Vitrina.tsx) y cada landing por función.
import { PREGUNTAS_SITIO } from '../app/vsl/_sitio/preguntas';
import { AI_AVATAR_SE_VENDE } from '../lib/planes-comparacion';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** La URL de un archivo del repo, ya entrecomillada, para los `mock.module` del hijo. */
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}
/** Sin las líneas de comentario: acá los comentarios NOMBRAN lo que el código no debe hacer (el `?sinPrueba=1`, por ejemplo). */
const sinComentarios = (t: string): string => t.replace(/^[ \t]*\/\/.*$/gm, '');
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
  // A DÓNDE SE PIDE: NI A /planes NI A UN mailto (ronda 2, 14/11/2026). Estas dos son de FUENTE a propósito, y lo único que
  // fijan es que los destinos viejos NO VOLVIERON. Que la fila exista, que PIDA y a dónde vaya lo miden los dos tests de abajo:
  // el primero dibujando la pantalla, el segundo corriendo la acción.
  assert.doesNotMatch(sinComentarios(p), /\/planes\/\$\{pro\.id\}|mailto:/, 'el checkout de /planes (el círculo) y el mailto no volvieron');
  // ⚠️ Y la página NUNCA llamó a `ofertaDelPlan` (contra el historial del repo: lo propuso una ronda anterior y no se commiteó).
  //    Esto no cuida un cambio: cuida que no se tome ese camino, porque `ofertaDelPlan` se traga el error de lectura y devuelve
  //    `pasarelas: []` —idéntico a «no hay ninguna»—, así que adivinar el destino con eso cae SIEMPRE del lado de /planes.
  assert.doesNotMatch(sinComentarios(p), /ofertaDelPlan/, 'adivinar el destino preguntándole a las pasarelas cae siempre del lado del círculo');
  // Sin los comentarios: los de arriba NOMBRAN el atajo prohibido para explicar por qué no se usa.
  assert.doesNotMatch(sinComentarios(p), /sinPrueba/, '`?sinPrueba=1` saltea el corte y abre el cobro doble: nunca desde acá');
  // Y el cliente de una agencia se pregunta ANTES de armar la fila: no se paga nada para quien no la ve (ronda 2).
  assert.ok(p.indexOf('const deAgencia =') < p.indexOf('const pro ='), 'la fila de Pro se arma después de saber si la ve');
  assert.match(p, /oferta=\{enPrueba \? null : oferta\}/, 'ni la oferta de retención');
});

// =============================================================================
// «TU PLAN» DIBUJADA (ronda 3, 15/11/2026)
// =============================================================================
// ⚠️ ESTO REEMPLAZA CUATRO ASERCIONES QUE NO MEDÍAN NADA, las cuatro refutadas rompiendo el COMPORTAMIENTO y dejando intacto el
//    texto que clavaban:
//      · `assert.match(p, /const pro = capa === 'completo' && !deAgencia \?/)`, lo mismo con `subir` y con `const porLlamada =
//        pro && enPrueba`: `assert.match` clava un PREFIJO, y lo que DECIDE vive después. Con `const pro = … ? (enPrueba ? null
//        : …)` —o con `porLlamada = pro && enPrueba && false ? …`— en la prueba NO HAY fila de Pro, que es el defecto que la
//        ronda 2 vino a cerrar, y el archivo daba 9/9 verde igual.
//      · `assert.match(panel, /onClick=\{corriendo \|\| proPedido \? undefined : \(\) => void pedirPro\(\)\}/)`: clava el
//        NOMBRE DEL ENVOLTORIO. Con `pedirPro` llamando `pasarAProAction()` —la fila que debe PEDIR pasando a COBRAR en la
//        pasarela— los trece archivos de test quedaban verdes. Eso es plata.
// Lo que se mide acá es la PANTALLA: la página de verdad se llama con sus bordes de mentira, lo que devuelve se dibuja, y del
// dibujo salen las filas, los destinos y QUÉ ACCIÓN corre cada una (tests/_plan-pedir-pro-hijo.ts).
// Lo que NO mide: que la acción escriba (eso es el test siguiente), ni el CSS.

type FilaDibujada = { titulo: string; detalle: string; como: 'link' | 'boton' | 'quieta'; href: string | null };
type Escena = { filas: FilaDibujada[]; enlaces: string[]; botones: number };
type Decision = Record<'baja' | 'retencion' | 'subida' | 'pedirPro' | 'empezarYa', boolean>;
type Dibujo = {
  enPrueba: Escena; enPruebaDesdeElTope: Escena; pagando: Escena; clienteDeAgencia: Escena; noSeSiEsDeAgencia: Escena; yaEsPro: Escena;
  tocarPro: { existe: boolean; corrio: string[] }; tocarEmpezar: { existe: boolean; corrio: string[] }; tocarBaja: { existe: boolean; corrio: string[] };
  laBajaDespuesDe: Decision; laBajaConUnError: Decision;
  laBajaSinAviso: { conSuscripcion: boolean; sinSuscripcion: boolean; cancelada: boolean; bajaYaPedida: boolean };
};
let dibujo: Dibujo | null = null;
const dibujarTuPlan = (): Dibujo => {
  if (!dibujo) {
    const out = execFileSync(process.execPath, [
      '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_plan-pedir-pro-hijo.ts'),
    ], { cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
    dibujo = JSON.parse(out.trim().split('\n').pop()!) as Dibujo;
  }
  return dibujo;
};
/** Los títulos y la forma de cada fila, en el orden en que quedaron dibujadas. */
const comoQuedo = (e: Escena) => e.filas.map((f) => [f.titulo, f.como]);

test('«TU PLAN» DIBUJADA: en la prueba hay fila de Pro, es un BOTÓN que pide, y arriba de «Empezar mi plan ya»', () => {
  const d = dibujarTuPlan();
  // 1. EN PRUEBA TAMBIÉN SE OFRECE PRO (14/11/2026). «En prueba, sin Pasar a Pro» (25/10) dejó de valer el día que AI Avatar,
  //    replicar el guion y el chat con los referentes pasaron a ser de Pro (`FUNCIONES_SOLO_PRO`, lib/topes-plan.ts): su candado
  //    trae a «Tu plan» a un negocio en sus 7 días gratis del de 47, y acá no había ninguna fila para pasar a Pro —sólo
  //    «Empezar mi plan ya», que cobra los US$47 y no destraba nada de eso—. Martín: «la idea es que compren el de 97».
  // 2. Y PRO VA ARRIBA cuando no se llegó desde un tope de la PRUEBA: el candado de Pro lleva a `RUTA_CAMBIAR_PLAN`, que no trae
  //    `?empezar=1`, y la primera fila era la que cobra los US$47. Con `?empezar=1` manda «Empezar mi plan ya»: eso es lo que
  //    esa persona pidió. Las dos listas son el conjunto ENTERO de filas, en orden: un cambio de lugar las rompe.
  assert.deepEqual(comoQuedo(d.enPrueba), [
    ['Pasar a MaKo Pro', 'boton'], ['Empezar mi plan ya', 'boton'], ['Recomienda MaKo', 'link'], ['Darme de baja', 'boton'],
  ], 'en la prueba, sin venir de un tope');
  assert.deepEqual(comoQuedo(d.enPruebaDesdeElTope), [
    ['Empezar mi plan ya', 'boton'], ['Pasar a MaKo Pro', 'boton'], ['Recomienda MaKo', 'link'], ['Darme de baja', 'boton'],
  ], 'con ?empezar=1 manda «Empezar mi plan ya»');
  // 3. LA SUBIDA EN EL ACTO NO CORRE EN PRUEBA: en la prueba la fila PIDE, y a quien ya paga por la pasarela le cobra. Los dos
  //    textos son distintos a propósito, y son el control uno del otro.
  assert.equal(d.enPrueba.filas[0].detalle, 'US$ 97 por mes. Pídelo y te lo cambiamos antes de que termine tu prueba.');
  assert.equal(d.pagando.filas[0].detalle, 'US$ 97 por mes, sin topes. Lo tienes en el acto.');
  assert.deepEqual(comoQuedo(d.pagando), [
    ['Pasar a MaKo Pro', 'boton'], ['Recomienda MaKo', 'link'], ['Darme de baja', 'boton'],
  ], 'quien ya paga no ve «Empezar mi plan ya»');
  // 4. QUIÉN NO LA VE: el cliente de una agencia (su plan lo cambia su agencia), el «no sé» de la cartera (`!== false`: ofrecer
  //    de más le rompe el trato a la agencia) y quien YA es Pro (`agencia` no sube a nada). Los tres sin «Recomienda MaKo»
  //    cuando son de agencia, que es la otra mitad de la misma regla.
  assert.deepEqual(comoQuedo(d.clienteDeAgencia), [['Empezar mi plan ya', 'boton'], ['Darme de baja', 'boton']]);
  assert.deepEqual(comoQuedo(d.noSeSiEsDeAgencia), [['Empezar mi plan ya', 'boton'], ['Darme de baja', 'boton']], 'el «no sé» de la cartera ofreció la fila');
  assert.deepEqual(comoQuedo(d.yaEsPro), [
    ['Empezar mi plan ya', 'boton'], ['Recomienda MaKo', 'link'], ['Darme de baja', 'boton'],
  ], 'a quien ya es Pro se le ofreció pasar a Pro');
  // 5. A DÓNDE SE PUEDE IR DESDE LA PANTALLA: sólo a /partners. El checkout de /planes es el círculo del 409 (y con la base
  //    caída, la segunda suscripción del #494); un mailto se va de la app; la agenda se fue el 24/10.
  for (const [nombre, e] of Object.entries({ enPrueba: d.enPrueba, desdeElTope: d.enPruebaDesdeElTope, pagando: d.pagando, yaEsPro: d.yaEsPro })) {
    assert.deepEqual(e.enlaces, ['/partners'], `apareció un destino nuevo en «Tu plan» (${nombre})`);
  }
  // 6. Y AL TOCAR CADA FILA, QUÉ CORRE. Acá vivía el agujero más caro: con `pedirPro` llamando `pasarAProAction()`, la fila que
  //    debe PEDIR le cambia el precio a la suscripción de la pasarela —y en prueba Stripe la rechaza (`trialing`), y Stripe y
  //    Creem cobran la diferencia en días que son gratis—. «Darme de baja» no corre NADA: son dos pasos, el botón y la
  //    confirmación (tests/mi-plan.test.ts).
  assert.deepEqual(d.tocarPro, { existe: true, corrio: ['pedirProAction'] }, 'la fila que debe PEDIR terminó cobrando');
  assert.deepEqual(d.tocarEmpezar, { existe: true, corrio: ['empezarPlanYaAction'] });
  assert.deepEqual(d.tocarBaja, { existe: true, corrio: [] }, 'la baja se fue sin confirmación');
});

test('PEDIR PRO NO ESCONDE «DARME DE BAJA»: sólo lo que TOCA EL COBRO deja vieja la pantalla', () => {
  const d = dibujarTuPlan();
  // ⚠️ EL DEFECTO, MEDIDO (ronda 3): `puedeDarseDeBaja` colgaba de `!aviso?.ok`, y el pedido de Pro escribe ese mismo aviso
  //    compartido con `ok: true`. Antes alcanzaba porque en la prueba el ÚNICO que podía dejar un aviso `ok` era la baja misma
  //    (la retención llega null en prueba, `subir` es null, y «Empezar mi plan ya» sólo avisa cuando FALLA). Con la fila de Pro
  //    de la ronda 2, pedir Pro BIEN borraba de la pantalla «Empezar mi plan ya» y TODA la sección «Darme de baja»: quien pedía
  //    Pro y después quería irse no encontraba cómo.
  // El conjunto ENTERO de las acciones de la pantalla, cada una con su lado: una acción nueva tiene que decidir de qué lado cae
  // o esta comparación se rompe, y mover `pedirPro` de lado la rompe también.
  assert.deepEqual(d.laBajaDespuesDe, { baja: false, retencion: false, subida: false, pedirPro: true, empezarYa: true },
    'pedir Pro escondió la baja (o la baja dejó de esconderse)');
  // Y un aviso de ERROR no esconde nada: quien no pudo darse de baja tiene que poder volver a intentarlo.
  assert.deepEqual(d.laBajaConUnError, { baja: true, retencion: true, subida: true, pedirPro: true, empezarYa: true });
  // Lo que ya decidía antes del aviso, intacto: sin suscripción no hay baja propia (se escribe a MaKo), y una baja ya pedida o
  // una cancelada no se vuelven a ofrecer.
  assert.deepEqual(d.laBajaSinAviso, { conSuscripcion: true, sinSuscripcion: false, cancelada: false, bajaYaPedida: false });
});

// =============================================================================
// EL PEDIDO DE PRO, CORRIENDO (ronda 2, 14/11/2026)
// =============================================================================
// ⚠️ ESTO REEMPLAZA UNA ASERCIÓN QUE NO MEDÍA NADA. Decía «sin lectura, se pide por email (nunca el círculo)» y lo que clavaba
//    por regex era el `.catch(() => false)` de la medición de pasarelas de la ronda 1 — una rama que el arnés del verificador
//    probó INALCANZABLE: `ofertaDelPlan` se traga el error de lectura y devuelve `pasarelas: []`, idéntico a «no hay ninguna»,
//    así que con la lectura TIRANDO la medición daba `true` y mandaba al checkout igual. Romper esa aserción cambiando una
//    letra la ponía roja sin probar ningún comportamiento.
// Acá se importa `pedirProAction` DE VERDAD (app/configuraciones/plan/actions.ts) con sus bordes simulados, y se mide qué
// escribe y a dónde va cuando la escritura falla. Lo que NO mide: que `pedirPlanSinPasarela` escriba bien (está simulada: eso
// lo corre tests/planes-sin-pasarela.test.ts sobre el fuente, y la ruta pública lo usa en producción desde el 24/10). Lo único
// que se corre de verdad de ese lado es `registrarPedido`, que es el pedazo que podía abrirle una SEGUNDA cuenta al que ya tiene.
// El hijo corre con `--conditions=react-server` para que `import 'server-only'` no tire fuera de Next.
const HIJO = `
import { mock } from 'node:test';
const salida = { pedidos: [], checkout: 0, casos: {}, bandeja: {}, alEquipo: [], marcas: [] };
const LIMPIO = { ws: 10, imp: false, capa: 'completo', sesion: { email: 'sol@ejemplo.com', nombre: 'Sol Díaz' }, modo: 'ok', correo: 'sale', marca: null, marcaSeCae: false };
const estado = { ...LIMPIO };
mock.module('next/cache', { namedExports: { revalidatePath: () => {}, revalidateTag: () => {} } });
mock.module(${url('lib/compra-plan.ts')}, { namedExports: {
  pedirPlanSinPasarela: async (p) => {
    salida.pedidos.push(p);
    if (estado.modo === 'tira') throw new Error('la base no contesta');
    if (estado.modo === 'nook') return { ok: false, status: 503, error: 'No pudimos registrar tu pedido. Prueba otra vez en un minuto.' };
    return { ok: true };
  },
  // Si «Tu plan» llamara alguna vez al checkout, ahí viven el 409 del círculo y la segunda suscripción del #494.
  iniciarCompraDePlan: async () => { salida.checkout += 1; return { ok: true, link: 'https://pagar.ejemplo' }; },
  planesMako: async () => [{ id: 'pro', nombre: 'MaKo Pro', activo: true, capa: 'agencia', precioUsd: 97 }],
} });
mock.module(${url('lib/auth.ts')}, { namedExports: { getUsuarioActual: async () => estado.sesion, getSesionAdmin: async () => null } });
mock.module(${url('lib/workspace.ts')}, { namedExports: {
  adminDeWorkspaceActual: async () => estado.ws, estaImpersonando: async () => estado.imp, getCapaActual: async () => estado.capa,
  getWorkspace: async (id) => ({ id, nombre: 'Casa Luna' }), runWithWorkspace: (ws, fn) => fn(),
} });
// EL COMPARE-AND-SET de la marca del pedido, como el de la subida (app_settings, por negocio).
mock.module(${url('lib/settings.ts')}, { namedExports: {
  getSetting: async () => estado.marca,
  cambiarSettingSi: async (clave, esperado, nuevo) => {
    if (estado.marcaSeCae) throw new Error('app_settings no contesta');
    if (estado.marca !== esperado) return false;
    estado.marca = nuevo; salida.marcas.push(nuevo); return true;
  },
  setSetting: async (clave, valor) => { estado.marca = valor; salida.marcas.push(valor); },
} });
// EL AVISO AL EQUIPO: el único rastro que la acción puede CONFIRMAR (devuelve si salió, y nunca tira).
mock.module(${url('lib/invitaciones.ts')}, { namedExports: {
  avisarDePlataforma: async (m) => {
    salida.alEquipo.push({ to: m.to, tag: m.tag, asunto: m.asunto, preheader: m.preheader, cuerpo: m.cuerpo });
    return estado.correo === 'sale' ? { enviado: true } : { enviado: false, error: 'Resend contestó 500' };
  },
  mandarCodigoDeBaja: async () => ({ enviado: true }),
} });
mock.module(${url('lib/prueba-uso.ts')}, { namedExports: {
  estadoDePrueba: async () => ({ enPrueba: true, capa: 'completo', hasta: null, despues: 'US$ 47/mes', plan: 'MaKo Esencial', dias: 5 }),
} });
const { pedirProAction } = await import(${url('app/configuraciones/plan/actions.ts')});
const correr = async (nombre, cambios) => {
  Object.assign(estado, cambios);
  const antes = salida.pedidos.length, avisosAntes = salida.alEquipo.length;
  const r = await pedirProAction();
  salida.casos[nombre] = { ok: r.ok, resumen: r.resumen, escribio: salida.pedidos.length - antes, aviso: salida.alEquipo.length - avisosAntes };
};
await correr('pide', { ...LIMPIO });
// EL F5 Y LA SEGUNDA PESTAÑA: lo mismo otra vez, SIN limpiar la marca que quedó del pedido de arriba.
await correr('otraVez', {});
await correr('elCorreoNoSale', { ...LIMPIO, correo: 'no' });
// Sin poder marcar (app_settings caída) el pedido igual se escribe: perderlo es peor que mandarlo dos veces.
await correr('sinPoderMarcar', { ...LIMPIO, marcaSeCae: true });
await correr('escrituraTira', { ...LIMPIO, modo: 'tira' });
await correr('escrituraFalla', { ...LIMPIO, modo: 'nook' });
await correr('noEsAdmin', { ...LIMPIO, ws: null });
await correr('mirandoOtroNegocio', { ...LIMPIO, imp: true });
await correr('noEsEsencial', { ...LIMPIO, capa: 'agencia' });
await correr('sesionSinEmail', { ...LIMPIO, sesion: { email: '', nombre: 'Dev' } });
// LA BANDEJA «Quieren entrar», con \`registrarPedido\` REAL: el pedido de quien YA TIENE CUENTA no es un alta. Es el pedazo que
// importa de \`pedirPlanSinPasarela\` cuando quien pide es un negocio que ya existe (en prueba, siempre).
const usuarios = ['sol@ejemplo.com'];
const filas = [];
mock.module(${url('lib/usuarios.ts')}, { namedExports: { buscarUsuarioPorEmail: async (e) => (usuarios.includes(e) ? { email: e } : null) } });
mock.module(${url('lib/supabase.ts')}, { namedExports: { getSupabaseServer: () => ({ from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  insert: async (f) => { filas.push(f); return { error: null }; },
}) }) } });
const { registrarPedido } = await import(${url('lib/pedidos-ingreso.ts')});
const { pedidoLimpio } = await import(${url('lib/pedidos-ingreso-reglas.ts')});
const pedir = (email) => registrarPedido(pedidoLimpio({ email, nombre: 'Sol', origen: 'planes', verificado: false, detalle: 'Quiere MaKo Pro' }));
salida.bandeja.conCuenta = await pedir('sol@ejemplo.com');
salida.bandeja.filasConCuenta = filas.length;
salida.bandeja.sinCuenta = await pedir('nueva@ejemplo.com');
salida.bandeja.filasSinCuenta = filas.length;
console.log(JSON.stringify(salida));
`;

type Caso = { ok: boolean; resumen: string; escribio: number; aviso: number };
type NombreDeCaso = 'pide' | 'otraVez' | 'elCorreoNoSale' | 'sinPoderMarcar' | 'escrituraTira' | 'escrituraFalla'
  | 'noEsAdmin' | 'mirandoOtroNegocio' | 'noEsEsencial' | 'sesionSinEmail';
type SalidaPro = {
  pedidos: Array<Record<string, unknown>>; checkout: number;
  casos: Record<NombreDeCaso, Caso>;
  /** Cada correo que la acción le mandó al equipo. */
  alEquipo: Array<{ to: string; tag: string; asunto: string; preheader: string; cuerpo: string }>;
  /** Cada valor que la marca del pedido tomó en app_settings (el compare-and-set). */
  marcas: string[];
  bandeja: { conCuenta: boolean; filasConCuenta: number; sinCuenta: boolean; filasSinCuenta: number };
};
let cache: SalidaPro | null = null;
const correrPedido = (): SalidaPro => {
  if (cache) return cache;
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', HIJO,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  cache = JSON.parse(out.trim().split('\n').pop()!) as SalidaPro;
  return cache;
};

test('«PASAR A PRO» EN PRUEBA: el pedido se ESCRIBE con los datos de la sesión, nunca abre un checkout, y si no se puede escribir lo dice', () => {
  const s = correrPedido();
  // 1. EL CAMINO BUENO: lo que recibe `pedirPlanSinPasarela` es Pro, con el nombre y el email de la SESIÓN (los únicos que no
  //    se pueden escribir desde el navegador), como PEDIDO (`quiero: true`) y por mes. Sin pasarela y sin código de referido.
  //    Y CON EL NEGOCIO (ronda 3): la acción tiene el workspace en la mano y lo tiraba (`origen: null`), así que lo que le
  //    llegaba al equipo era «Sol Díaz quiere MaKo Pro» y nadie podía saber A QUÉ cuenta cambiarle el plan. `origen.landing` es
  //    el único campo del pedido que `pedirPlanSinPasarela` escribe en el texto del evento y del correo.
  assert.deepEqual(s.pedidos[0], {
    plan: 'pro', nombre: 'Sol Díaz', email: 'sol@ejemplo.com', quiero: true, pasarela: null, origen: { landing: 'tu-plan-negocio-10' },
    ref: null, whatsapp: null, diagnostico: null, periodo: 'mensual', sinPrueba: false, codigoEscrito: null, codigoEscritoMal: false,
  });
  assert.equal(s.casos.pide.ok, true);
  assert.match(s.casos.pide.resumen, /nos llegó tu pedido/i, 'y se le dice que quedó');
  // 2. LA ESCRITURA TIRA (lo que la aserción vieja decía medir y no medía): no contesta «Listo», le dice a dónde escribir, y
  //    NO lo manda a /planes a «probar por la otra puerta» —ahí está el 409 que lo devuelve acá y, con la base caída, la
  //    segunda suscripción—. El `checkout` de abajo es lo que lo prueba.
  assert.equal(s.casos.escrituraTira.ok, false);
  assert.equal(s.casos.escrituraTira.escribio, 1, 'se intentó escribir');
  assert.ok(s.casos.escrituraTira.resumen.includes(EMAIL_MAKO), `sin el email del equipo queda en la nada: ${s.casos.escrituraTira.resumen}`);
  // 3. Y si la escritura contesta «no pude» (un 503 del CRM), ese texto es el que lee la persona, no uno inventado.
  assert.equal(s.casos.escrituraFalla.ok, false);
  assert.equal(s.casos.escrituraFalla.resumen, 'No pudimos registrar tu pedido. Prueba otra vez en un minuto.');
  // 4. QUIÉN PUEDE PEDIR: una acción es una puerta POST abierta a cualquiera con sesión. Sin ser admin, mirando otro negocio
  //    (el pedido llevaría el email del que mira) o fuera de Esencial, no se escribe NADA.
  for (const caso of ['noEsAdmin', 'mirandoOtroNegocio', 'noEsEsencial', 'sesionSinEmail'] as const) {
    assert.equal(s.casos[caso].ok, false, caso);
    assert.equal(s.casos[caso].escribio, 0, `${caso}: escribió un pedido que no le corresponde`);
  }
  assert.ok(s.casos.sesionSinEmail.resumen.includes(EMAIL_MAKO), 'sin email en la sesión, al menos se le dice a quién escribir');
  // 5. NUNCA UN COBRO NI UN CHECKOUT desde «Tu plan»: esto PIDE. La subida en el acto es `pasarAProAction`, que no corre en prueba.
  assert.equal(s.checkout, 0);
  assert.equal(s.pedidos.length, 5, 'escribió alguien que no podía, o dejó de escribir alguien que sí');
  // 6. Y EL PEDIDO DE QUIEN YA TIENE CUENTA NO ENTRA A «Quieren entrar» (`registrarPedido` real): el diagnóstico obvio —«lo
  //    estás metiendo en la bandeja de altas, le van a abrir una segunda cuenta como en el #494»— es el equivocado, porque
  //    `registrarPedido` pregunta por el usuario antes y contesta `false`. El control es la segunda fila: con un email sin
  //    cuenta SÍ inserta, así que el `false` de arriba no es un fake roto.
  assert.deepEqual([s.bandeja.conCuenta, s.bandeja.filasConCuenta], [false, 0], 'el que ya tiene cuenta no es un pedido de ingreso');
  assert.deepEqual([s.bandeja.sinCuenta, s.bandeja.filasSinCuenta], [true, 1], 'el control: un email sin cuenta sí entra a la bandeja');
});

test('«LISTO» SÓLO CON UN RASTRO CONFIRMADO, con el NEGOCIO adentro, y un F5 no manda otro pedido', () => {
  const s = correrPedido();
  // ⚠️ EL DEFECTO (ronda 3, medido): para quien pide desde «Tu plan» —que SIEMPRE ya tiene cuenta— `registrarPedido` inserta 0
  //    filas A PROPÓSITO, así que los únicos rastros son el evento de la ficha (`catch(() => {})`) y el correo al equipo (cuyo
  //    `{ enviado: false }` nadie leía, y cuyo `catch` no corre nunca porque `avisarDePlataforma` no rechaza). Con el evento
  //    tirando y el correo sin salir, la acción devolvía `ok: true` y la persona leía «Listo: nos llegó tu pedido y te
  //    escribimos» sin que hubiera llegado nada a ninguna parte.
  // 1. EL AVISO QUE LA ACCIÓN SÍ PUEDE CONFIRMAR, y lo que lleva: el negocio por su nombre Y por su número (el equipo necesita
  //    saber a qué cuenta cambiarle el plan), que está EN PRUEBA, quién pidió, y a dónde ir a cambiarlo.
  const primero = s.alEquipo[0];
  assert.equal(primero.to, EMAIL_MAKO);
  assert.equal(primero.asunto, 'Casa Luna pide MaKo Pro (en prueba)');
  assert.match(primero.preheader, /«Tu plan» de Casa Luna/, 'el preheader seguía diciendo «desde la página de planes»');
  assert.match(primero.cuerpo, /^Sol Díaz \(sol@ejemplo\.com\) pide pasar a MaKo Pro\./);
  assert.match(primero.cuerpo, /Negocio: Casa Luna \(negocio 10\)\./, 'el equipo no puede saber a qué cuenta cambiarle el plan');
  assert.match(primero.cuerpo, /Cómo está hoy: en la prueba gratis de MaKo Esencial, quedan 5 día\(s\)\./, 'ni que es alguien en prueba');
  assert.match(primero.cuerpo, /\/admin\/customers\/10$/, 'el único link era la ficha del lead: falta dónde se le cambia el plan');
  // 2. SI ESE AVISO NO SALE, NO SE DICE «LISTO». El pedido quedó anotado y se lo dice, con el email del equipo, sin prometer
  //    que alguien lo vio. Es el caso que antes contestaba «Listo» con todo en silencio.
  assert.equal(s.casos.elCorreoNoSale.ok, false, '«Listo» con el aviso sin salir');
  assert.equal(s.casos.elCorreoNoSale.escribio, 1, 'el pedido sí se intentó escribir');
  assert.ok(s.casos.elCorreoNoSale.resumen.includes(EMAIL_MAKO), `sin el email del equipo queda en la nada: ${s.casos.elCorreoNoSale.resumen}`);
  assert.doesNotMatch(s.casos.elCorreoNoSale.resumen, /Listo/i);
  // 3. Y SI EL PEDIDO NO SE PUDO ESCRIBIR, no se manda ningún aviso prometiendo un pedido que no existe.
  assert.equal(s.casos.escrituraTira.aviso, 0, 'avisó de un pedido que no quedó escrito');
  assert.equal(s.casos.escrituraFalla.aviso, 0);
  // 4. UN F5 O UNA SEGUNDA PESTAÑA NO MANDAN OTRO PEDIDO (compare-and-set por negocio, como `CLAVE_SUBIDA` en el camino que
  //    cobra). `proPedido` es estado del navegador y se pierde al recargar: del otro lado, cada llamada escribía otro evento en
  //    la ficha y otro correo al equipo.
  assert.deepEqual(
    { ok: s.casos.otraVez.ok, escribio: s.casos.otraVez.escribio, aviso: s.casos.otraVez.aviso },
    { ok: true, escribio: 0, aviso: 0 },
    'el segundo intento volvió a escribir el pedido',
  );
  assert.match(s.casos.otraVez.resumen, /^Ya nos llegó tu pedido/, 'y se le dice que ya está, no «Listo» otra vez');
  // Y la marca queda en un estado terminal: `pedido` cuando llegó, `error` cuando no (para poder volver a intentarlo).
  assert.deepEqual(s.marcas.map((m) => JSON.parse(m).estado), ['pidiendo', 'pedido', 'pidiendo', 'error', 'pidiendo', 'error', 'pidiendo', 'error']);
  // 5. SIN PODER MARCAR (app_settings caída) el pedido IGUAL SE ESCRIBE: un duplicado es más barato que un pedido perdido, y lo
  //    que no se puede hacer es contestar «ya lo pediste» por un error de escritura —eso es volver a decirle que llegó algo que
  //    no llegó—.
  assert.deepEqual(
    { ok: s.casos.sinPoderMarcar.ok, escribio: s.casos.sinPoderMarcar.escribio, aviso: s.casos.sinPoderMarcar.aviso },
    { ok: true, escribio: 1, aviso: 1 },
    'sin poder marcar se perdió el pedido',
  );
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

test('la VITRINA cuenta los topes de la prueba con los números de la tabla, y no promete el avatar mientras no se venda', () => {
  // Desde el 14/11/2026 /planes muestra las preguntas de la portada (Martín: «tienen que ser siempre las mismas»): los topes de la
  // prueba van en su respuesta, en app/vsl/_sitio/preguntas.ts, con los números de la tabla; y la vitrina dibuja ESAS preguntas.
  // ⚠️ SE MIDE LA RESPUESTA DIBUJADA, NO EL FUENTE (14/11/2026). Esto buscaba `${TOPES_PRUEBA['<clave>']}` en el ARCHIVO entero, y
  //    por eso `prueba.avatares` pasaba sin que el FAQ dijera nada: su número sólo vive dentro de `AVATAR_EN_LA_PRUEBA`, muerta
  //    detrás de `AI_AVATAR_SE_VENDE === false`. Una aserción vacía que además se habría puesto roja el día que alguien borrara
  //    esa constante, sin que se rompiera nada público. Lo que importa es lo que la persona LEE.
  const prueba = PREGUNTAS_SITIO.filter((x) => /prueba gratis/i.test(x.p));
  assert.equal(prueba.length, 1, 'el FAQ del sitio dice una vez cómo es la prueba gratis');
  const r = prueba[0].r;
  assert.ok(r.includes(`${TOPES_PRUEBA['prueba.videos']} videos armados`), `los videos de la tabla: ${r}`);
  assert.ok(r.includes(`${TOPES_PRUEBA['prueba.imagenes']} imágenes`), `las imágenes de la tabla: ${r}`);
  assert.ok(r.includes(`${TOPES_PRUEBA['web.landings_publicadas']} página publicada`), `las landings de la tabla: ${r}`);
  assert.match(r, /exportar en masa se habilita con el primer cobro/);
  // EL AVATAR, LOS DOS LADOS DEL INTERRUPTOR: mientras el sitio no lo venda (`AI_AVATAR_SE_VENDE`, lib/planes-comparacion.ts) la
  // respuesta NO lo puede nombrar — los DOS planes arrancan con prueba (`PLANES_CON_PRUEBA`) y el de 47 lo tiene con candado
  // (`FUNCIONES_SOLO_PRO`), así que prometerlo a «la prueba» es mentira para la mitad. El día que se venda, tiene que decir el
  // número de la tabla, que es el techo de quien ya tiene la función por su plan.
  if (AI_AVATAR_SE_VENDE) assert.ok(r.includes(`${TOPES_PRUEBA['prueba.avatares']} video con avatar de IA`), `se vende y no lo dice: ${r}`);
  else assert.doesNotMatch(r, /avatar/i, `no se vende todavía y lo promete: ${r}`);
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
//
// Roturas de «Pasar a Pro» en la prueba (15/11/2026, ronda 3; base 12 / 0 con este archivo solo). Cada una rompe el
// COMPORTAMIENTO y deja INTACTO el texto que las aserciones viejas clavaban — por eso antes pasaban todas:
//   · la fila de Pro otra vez AUSENTE en la prueba (el prefijo `const pro = capa === 'completo' && !deAgencia ?` igual) -> 10 / 2
//   · la fila que debe PEDIR pasa a COBRAR (`pedirPro` llamando `pasarAProAction()`, su `onClick` igual)                -> 11 / 1
//   · la fila vuelve a ser un link a /planes                                                                            -> 11 / 1
//   · pedir Pro vuelve a esconder «Darme de baja» (`pedirPro: true` en `TOCAN_EL_COBRO`)                                -> 11 / 1
//   · «Listo» aunque el aviso al equipo no salga                                                                        -> 11 / 1
//   · el negocio se tira otra vez (`origen: null`)                                                                      -> 11 / 1
//   · el aviso al equipo deja de nombrar el negocio                                                                     -> 11 / 1
//   · el aviso no dice que está en prueba                                                                               -> 11 / 1
//   · el aviso deja de llevar a /admin/customers/<ws>                                                                   -> 11 / 1
//   · sin compare-and-set: el F5 manda otro pedido                                                                      -> 10 / 2
