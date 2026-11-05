// =============================================================================
// El Leads Scraper (Hotmart, Skool y Apify) se RETIRÓ el 25/10/2026: que no vuelva a medias
// =============================================================================
// Martín, 25/10/2026 (docs/feedback-25-10-tarde.md): «depreca todas las INTEGRACIONES que ya no nos sirvan... Depreca Hotmart,
// Skool... Elimina Apify». Las tres eran el Leads Scraper del 14/10 (docs/diseno-leads-scraper.md): dos «fuentes que avisan»
// (el webhook de Hotmart y el Zap de Skool entraban gente al CRM) y Apify, donde corrían las búsquedas de prospectos en frío
// (/crm/prospectos, «Buscar prospectos» del «⋯» del CRM). Medido antes, en producción y sólo leyendo: 0 claves guardadas de
// las tres (ni de la plataforma), 0 filas de ruteo, 0 leads con origen hotmart o skool, 0 búsquedas y 0 prospectos. O sea: no
// había nada que reemplazar antes de sacarlo, y no hay datos que borrar (las tablas de la mig 0289 quedan, vacías).
//
// Retirar una integración es enumerar SUS REGISTROS (AGENTS.md): la tarjeta, los campos, el ping, el logo, las slides, el
// ruteo (`ROUTING_CREDS`, `RUTEO_POR_HASH`, el tipo de servicio de ruteo), las rutas, la API de MaKo y los archivos que sólo
// existían para ellas. Mismo molde que tests/puente-leads-retirado.test.ts.
//
// Lo que este guard NO toca, a propósito, y por qué:
//   · app/crm/origen-lead.ts sigue nombrando los orígenes `hotmart` y `skool`: un lead que hubiera entrado así se tiene que
//     seguir leyendo (hoy no hay ninguno, pero el dato no se borra).
//   · La lectura de un @ de Instagram por Apify que paga la PLATAFORMA (lib/instagram-perfil-server.ts, 22/10/2026) es del
//     CRM, no la integración del negocio: queda DORMIDA (no hay clave en ningún lado y la tarjeta para cargarla se fue). Si se
//     saca o se reemplaza lo decide el CRM: docs/hallazgos-integraciones.md, «El Leads Scraper se retiró».
//   · Una clave de Apify pegada en el chat se sigue TAPANDO (lib/claves-en-el-chat.ts). Desde el 1/11/2026 ofrece conectar `apify-instagram`.
//   · ⚠️ `apify-instagram` (1/11/2026) NO ES EL SCRAPER QUE VUELVE: es otra clave (`APIFY_INSTAGRAM_TOKEN`) para leer el perfil público de un competidor en
//     Competitors Spy. No genera leads, no entra al CRM y no despierta `APIFY_TOKEN`. Abajo hay un test que fija ese límite: si crece, este guard falla.
//   · Hotmart como plataforma de CURSOS (scripts/hotmart-*.mjs, app/conocimientos/) es otra cosa: bajar cursos al archivo.
//
// ⚠️ SE BUSCA UN NOMBRE PROPIO DEL SCRAPER, NO LA PALABRA: «prospecto» es vocabulario del CRM y «Skool» es el modelo de la
// Comunidad. Y se saltean los comentarios: la convención de la casa es explicar en un comentario lo que el guard prohíbe.
//
// PROBADO ROMPIÉNDOLO (25/10/2026): ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS } from '../lib/integraciones-catalogo';
import { SLIDES } from '../lib/servicio-slides';
import { RUTEO_POR_HASH } from '../lib/ruteo-hash';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Los de línea PRIMERO: un `//` que contenga la apertura de un bloque abriría uno que se cierra páginas después. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Quien conserva la historia a propósito (bitácoras, historial generado, transcripciones de cursos). */
const HISTORIA = [
  /^app\/admin\/dev\/.*bitacora\.ts$/,
  /^app\/admin\/dev\/areas\.ts$/,
  /^app\/admin\/dev\/_historial\.generado\.ts$/,
  /^app\/conocimientos\//,
];
/** Lo que nombra a Apify o a Hotmart y NO es el scraper (ver la cabecera): exceptuado por nombre, con su motivo. */
const NO_ES_EL_SCRAPER = new Set([
  'app/crm/origen-lead.ts', // los orígenes de los leads viejos
  'lib/instagram-perfil-server.ts', 'lib/instagram-perfil.ts', 'app/api/crm/instagram-buscar/route.ts', // el @ de la plataforma
  'tests/_instagram-perfil-hijo.ts', 'tests/instagram-perfil-fuentes.test.ts',
  'tests/crm-redirige-antes-del-loader.test.ts', // prueba que /crm/prospectos ya NO tiene puerta (la nombra para eso)
]);
const ESTE = 'tests/leads-scraper-retirado.test.ts';
const EXT = /\.(tsx?|mjs|cjs|js|mts)$/;

/** Cuántos archivos de código hay EN GIT: sin este piso, un `git` que no corre en el repo daría verde sin mirar nada. */
function cuantosArchivos(): number {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib', 'tests', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 })
    .split(/\r?\n/).filter((f) => EXT.test(f.trim()) && !/\.d\.ts$/.test(f));
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos.length;
}

/** Los nombres propios del scraper en el CÓDIGO (sin comentarios). Cada uno nombra algo que se sacó. */
const NOMBRES_DEL_SCRAPER: ReadonlyArray<[RegExp, string]> = [
  [/HOTMART_HOTTOK|SKOOL_WEBHOOK_CLAVE/, 'la credencial de una fuente que avisa'],
  [/APIFY_TOKEN/, 'la credencial de Apify'],
  [/webhooks\/(hotmart|skool|apify)\b/, 'la ruta de un webhook del scraper'],
  [/from ['"][^'"]*\/(hotmart-evento|skool-evento|fuentes-leads|fuentes-leads-catalogo|funnel-de-entrada|apify|prospectos|prospectos-reglas)['"]/, 'un import de un módulo del scraper'],
  [/\b(ingresarDeFuente|leerEventoHotmart|leerEventoSkool|esIntegracionDeLeads|esFuenteQueAvisa|funnelDeEntrada|listarProspectos|procesarBusqueda|lanzarActor|cuentaDeApify)\b/, 'una función del scraper'],
  [/key:\s*['"](hotmart|skool|apify)['"]/, 'una entrada de catálogo (tarjeta o campos)'],
  [/^\s*(hotmart|skool|apify)\s*:\s*[[{]/m, 'una entrada `hotmart:`/`skool:`/`apify:` de un registro (slides, logo, ruteo)'],
  [/\/crm\/prospectos\b/, 'la pantalla de prospectos'],
  [/\b(listar_prospectos|busquedas_prospeccion|buscar_prospectos)\b/, 'una operación de la API o un renglón del menú del CRM'],
  [/servicio(=|:\s*)\{?\s*['"]apify['"]/, 'un «Conectar Apify»'],
];

function candidatos(): string[] {
  let salida = '';
  try {
    salida = execFileSync('git', ['grep', '-l', '-i', '-E', 'hotmart|skool|apify|prospect', '--', 'app', 'lib', 'tests', 'scripts'],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 });
  } catch (e) {
    if ((e as { status?: number }).status !== 1) throw e;
  }
  return salida.split(/\r?\n/).map((f) => f.trim())
    .filter((f) => EXT.test(f) && f !== ESTE && !HISTORIA.some((h) => h.test(f)) && !NO_ES_EL_SCRAPER.has(f));
}

/** Lo que sólo existía para el scraper: ninguno puede estar, ni en el índice ni en el disco. */
const ARCHIVOS_DEL_SCRAPER = [
  'app/api/webhooks/hotmart/route.ts', 'app/api/webhooks/skool/route.ts', 'app/api/webhooks/apify/route.ts',
  'lib/hotmart-evento.ts', 'lib/skool-evento.ts', 'lib/fuentes-leads.ts', 'lib/fuentes-leads-catalogo.ts', 'lib/funnel-de-entrada.ts',
  'lib/apify.ts', 'lib/prospectos.ts', 'lib/prospectos-reglas.ts',
  'app/crm/prospectos/page.tsx', 'app/crm/prospectos/ProspectosApp.tsx', 'app/crm/prospectos/actions.ts',
  'tests/hotmart-evento.test.ts', 'tests/skool-evento.test.ts', 'tests/fuentes-leads-webhooks.test.ts', 'tests/prospectos-reglas.test.ts',
];

// ── 1. Los archivos ───────────────────────────────────────────────────────────

test('los archivos del scraper no están: ni en git ni en el disco, y no hay otro suelto en lib', () => {
  const indice = new Set(execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 }).split(/\r?\n/));
  for (const f of ARCHIVOS_DEL_SCRAPER) {
    assert.equal(existsSync(join(RAIZ, f)), false, `volvió ${f} (está en el disco)`);
    assert.equal(indice.has(f), false, `volvió ${f} (está en git)`);
  }
  const sueltos = readdirSync(join(RAIZ, 'lib')).filter((f) => /^(hotmart|skool|apify|prospect|fuentes-leads)/i.test(f));
  assert.deepEqual(sueltos, [], `un archivo de lib/ con el nombre del scraper: ${sueltos.join(', ')}`);
  for (const d of ['app/api/webhooks/hotmart', 'app/api/webhooks/skool', 'app/api/webhooks/apify', 'app/crm/prospectos']) {
    assert.equal(existsSync(join(RAIZ, d)), false, `volvió la carpeta ${d}`);
  }
  // El diseño no se borró: queda como historia, con su aviso de retirada.
  assert.match(leer('docs/diseno-leads-scraper.md'), /RETIRADO el 25\/10\/2026/);
});

// ── 2. El código no nombra nada del scraper ───────────────────────────────────

test('ningún código de app, lib, tests ni scripts nombra las credenciales, las rutas, los módulos ni las keys del scraper', () => {
  cuantosArchivos();
  const lista = candidatos();
  // Los que SÍ dicen esas palabras hoy (la Comunidad copiada de Skool, «prospecto» del CRM): el barrido tiene que verlos.
  assert.ok(lista.length >= 20, `git grep devolvió ${lista.length} archivos: el barrido no está mirando`);
  const culpables: string[] = [];
  for (const f of lista) {
    const src = sinComentarios(leer(f));
    for (const [patron, que] of NOMBRES_DEL_SCRAPER) if (patron.test(src)) culpables.push(`${f}: ${que}`);
  }
  assert.deepEqual(culpables, [], `el scraper volvió a medias:\n${culpables.join('\n')}`);
});

// ── 3. Los registros, ejecutados ──────────────────────────────────────────────

test('la tarjeta, los campos, el ping, las slides, el logo y el ruteo ya no tienen a ninguna de las tres', () => {
  for (const k of ['hotmart', 'skool', 'apify']) {
    assert.equal(DEFS.some((d) => d.key === k), false, `la tarjeta de ${k} sigue en el catálogo`);
    assert.equal(k in SLIDES, false, `las slides de ${k} siguen`);
  }
  // El método y el verificador son `server-only`: se leen del fuente.
  const metodo = sinComentarios(leer('lib/metodo-catalogo.ts'));
  assert.doesNotMatch(metodo, /key:\s*'(hotmart|skool|apify)'/, 'sus campos siguen en el método');
  assert.doesNotMatch(sinComentarios(leer('lib/metodo-verificar.ts')), /async (hotmart|skool|apify)\(/, 'un ping sigue en el verificador');
  assert.doesNotMatch(sinComentarios(leer('app/_components/ServicioVisual.tsx')), /\b(hotmart|skool|apify)\s*:/, 'su logo sigue en el registro');
  assert.equal(RUTEO_POR_HASH.has('HOTMART_HOTTOK') || RUTEO_POR_HASH.has('SKOOL_WEBHOOK_CLAVE'), false, 'una clave sigue ruteando por hash');
  assert.doesNotMatch(sinComentarios(leer('lib/webhook-routing.ts')), /HOTMART|SKOOL/, 'ROUTING_CREDS sigue nombrándolas');
  assert.doesNotMatch(sinComentarios(leer('lib/webhook-ruteo-huella.ts')), /'hotmart'|'skool'/, 'el tipo de servicio de ruteo sigue nombrándolas');
});

test('la API de MaKo y el menú del CRM: sin prospectos', () => {
  const def = sinComentarios(leer('lib/api-mako/areas/crm.def.ts'));
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  assert.doesNotMatch(def + run, /listar_prospectos|busquedas_prospeccion/, 'una operación de prospectos sigue en la API');
  assert.doesNotMatch(sinComentarios(leer('app/crm/menu-contextual-crm.ts')), /buscar_prospectos/, 'el renglón sigue en el menú');
  assert.doesNotMatch(sinComentarios(leer('app/crm/CrmToolbar.tsx')), /Buscar prospectos/, 'el renglón sigue en el «⋯»');
  assert.doesNotMatch(sinComentarios(leer('app/crm/layout-reglas.ts')), /prospectos/, 'la puerta de la pantalla sigue en el layout');
});

test('una clave de Apify pegada se tapa igual, y sólo ofrece conectar la de Competitors Spy', () => {
  const src = sinComentarios(leer('lib/claves-en-el-chat.ts'));
  assert.match(src, /\{ nombre: 'apify', re: \/\\bapify_api_\[A-Za-z0-9\]\{20,\}\/g, con: CLAVE_TAPADA, servicio: 'apify-instagram' \}/);
});

test('la clave de Competitors Spy sólo lee Instagram: no es la vuelta del scraper de leads', () => {
  const quienes = (patron: string) => execFileSync('git', ['grep', '-l', '--untracked', '-E', patron, '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => EXT.test(f) && !HISTORIA.some((h) => h.test(f)));
  // ⚠️ 2/11/2026 — EL ALTA DEL CRM AHORA SÍ PUEDE GASTARLA, Y ES UN CAMBIO DE DECISIÓN, NO UN
  // DESCUIDO. Hasta el 1/11 la regla era «Apify: sólo Spy» y este guard decía, textual, «el alta
  // del CRM y Offer siguen sin poder gastarla». Martín el 2/11: «ya con Apify debería funcionar el
  // traer el perfil escribiendo el @, eso también en el CRM».
  //
  // Qué significa en plata, que es lo que esta lista cuida: el buscador de @ del CRM, cuando ni
  // Meta ni Google traen nada, lee UN perfil por @ EXACTO con `APIFY_CLAVE_DE_SPY`, que es la clave
  // DEL NEGOCIO. Tiene el mismo tope diario que Spy (`APIFY_TOPE_POR_DIA`) y la pantalla espera a
  // que la persona deje de escribir, así que no se gasta por tecla. Lo que NO vuelve es el scraper
  // de leads: eso es una búsqueda masiva, se llamaba `apify` a secas, y los asserts de abajo siguen
  // exigiendo que no exista.
  //
  // Si esto no era lo que Martín quiso decir, lo que se saca es `'apify-spy'` de las fuentes en
  // app/api/crm/instagram-buscar/route.ts y se vuelve a poner este guard como estaba.
  // ⚠️ 5/11/2026 — VARIAS CLAVES DE SPY (Martín: «Dame la opción de tener varias claves de apify»). Las extra
  // (`APIFY_INSTAGRAM_TOKEN_2…_5`) se nombran por su lista (`CLAVES_APIFY_DE_SPY`) y se leen por UNA función
  // (`clavesApifyDeSpy`): las dos van en el patrón, para que un lector nuevo no pueda esquivar esta lista llamándolas por otro
  // nombre. Los archivos son los mismos de antes más lib/spy-claves.ts, que es PURO: no lee ninguna clave, ordena las que le
  // pasa Spy y decide cuándo pasar a la siguiente (sólo por falta de crédito).
  assert.deepEqual(quienes('APIFY_INSTAGRAM_TOKEN|APIFY_CLAVE_DE_SPY|CLAVES_APIFY_DE_SPY|clavesApifyDeSpy').sort(), [
    'app/api/crm/instagram-buscar/route.ts',
    'lib/instagram-perfil-server.ts', 'lib/instagram-perfil.ts', 'lib/integraciones-catalogo.ts', 'lib/metodo-catalogo.ts', 'lib/metodo-verificar.ts',
    // 4/11/2026: el buscador de Spy por red (Google y el buscador de Instagram por nombre). Es Spy, con la misma clave, sin
    // escribir nada: candidatos que la persona confirma. Su cupo es aparte (`TOPE_BUSQUEDAS_SPY_POR_DIA`).
    'lib/spy-buscar.ts',
    // 5/11/2026: puro, sin leer ninguna clave (ver arriba).
    'lib/spy-claves.ts',
    // 3/11/2026: buscar sus otras redes (ítems 10/11 de Spy). Es Spy, con la misma clave y sin escribir nada: candidatos que la persona confirma.
    'lib/spy-otras-redes.ts',
    // 4/11/2026: las corridas largas de Spy (puntos 8 y 10: todas sus publicaciones y sus anuncios). Es Spy, con la misma
    // clave: lee el contenido PÚBLICO de un competidor que el negocio eligió y lo guarda en `spy_piezas`. No entra a `leads`.
    'lib/spy-todo.ts',
  ]);
  // La fuente la piden Spy y el alta del CRM. Offer sigue sin poder gastarla.
  assert.deepEqual(quienes("'apify-spy'").sort(), [
    'app/api/crm/instagram-buscar/route.ts', 'lib/instagram-perfil-server.ts', 'lib/spy-buscar.ts', 'lib/spy.ts',
  ]);
  assert.doesNotMatch(leer('app/api/offer/route.ts'), /apify-spy/, 'Offer no gasta la clave de Spy');
  // Las claves EXTRA son de Spy y de la biblioteca de carruseles (5/11/2026): el alta del CRM sigue con la 1 sola. La pide Spy
  // por nombre (`variasClaves`), y el CRM no.
  assert.deepEqual(quienes('variasClaves').sort(), ['lib/instagram-perfil-server.ts', 'lib/spy-buscar.ts', 'lib/spy.ts'], 'sólo Spy pide las claves extra');
  assert.doesNotMatch(sinComentarios(leer('app/api/crm/instagram-buscar/route.ts')), /clavesApifyDeSpy|variasClaves|CLAVES_APIFY_DE_SPY/, 'el alta del CRM no usa las claves extra');
  assert.doesNotMatch(leer('app/api/offer/route.ts'), /clavesApifyDeSpy|variasClaves/, 'Offer tampoco');
  // ⚠️ 3/11/2026 — SE SUMÓ UN SEGUNDO ACTOR DE APIFY Y NO ES LA VUELTA DEL SCRAPER.
  // `apify~instagram-scraper` (lib/instagram-buscar-apify.ts) busca perfiles por NOMBRE para que la
  // lista ofrezca candidatos sin que haya que escribir el @ —pedido de Martín del 2/11—. Lo que
  // sigue retirado es otra cosa: traer LISTAS de leads a la base. La diferencia que importa:
  //   · acá se piden 8 candidatos, una persona elige UNO y lo demás se descarta;
  //   · no entra ningún lead a `leads` por este camino;
  //   · va topeado por corrida y por el tope diario que ya existía.
  // Si alguna vez esto empieza a volcar resultados a la base sin que alguien elija, ES el scraper
  // de vuelta y hay que frenarlo.
  assert.doesNotMatch(leer('lib/instagram-buscar-apify.ts'), /from\('leads'\)|insert\(/, 'el buscador por nombre NO escribe leads: eso sería el scraper de vuelta');
  // La tarjeta es otra: la del scraper se llamaba `apify` y no volvió.
  assert.equal(DEFS.some((d) => d.key === 'apify'), false);
  assert.equal(DEFS.filter((d) => d.key === 'apify-instagram').length, 1);
});

test('el guard sabe leer: cada patrón reconoce lo que busca y no acusa por prosa', () => {
  const trampa = "import { x } from '@/lib/prospectos'; const a = 'HOTMART_HOTTOK'; const t = 'APIFY_TOKEN'; fetch('/api/webhooks/skool'); "
    + "ingresarDeFuente(); const d = { key: 'apify' };\n  hotmart: [],\nrouter.push('/crm/prospectos'); const op = 'listar_prospectos'; <BotonIntegracion servicio=\"apify\" />";
  for (const [patron, que] of NOMBRES_DEL_SCRAPER) assert.match(trampa, patron, `el patrón de «${que}» no reconoce lo que busca`);
  const prosa = "const t = 'Comunidad estilo Skool'; const p = 'prospecto caliente'; const c = 'curso de Hotmart';";
  for (const [patron, que] of NOMBRES_DEL_SCRAPER) assert.doesNotMatch(prosa, patron, `el patrón de «${que}» se acusa por prosa`);
});

// ── ROTURAS (25/10/2026) ───────────────────────────────────────────────────────
// Una por vez, con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura comprobando el contenido.
// Base: 6 pasan / 0 fallan. Las 12 cazadas («pasan / fallan» y QUÉ test la cazó):
//   L1. la tarjeta de Hotmart de vuelta en DEFS                     → 4 / 2 · el barrido y «la tarjeta, los campos…»
//   L2. HOTMART_HOTTOK de vuelta en RUTEO_POR_HASH                   → 4 / 2 · el barrido y «la tarjeta, los campos…»
//   L3. SKOOL_WEBHOOK_CLAVE de vuelta en ROUTING_CREDS               → 4 / 2 · el barrido y «la tarjeta, los campos…»
//   L4. 'skool' de vuelta en el tipo de servicio de ruteo            → 5 / 1 · «la tarjeta, los campos…»
//   L5. el logo de Apify de vuelta en ServicioVisual                 → 4 / 2 · el barrido y «la tarjeta, los campos…»
//   L6. un lib/apify.ts suelto en el disco, sin git add              → 5 / 1 · «los archivos del scraper no están»
//   L7. la ruta /api/webhooks/apify en un fuente cualquiera          → 5 / 1 · el barrido
//   L8. listar_prospectos de vuelta en crm.def.ts                   → 4 / 2 · el barrido y «la API de MaKo y el menú…»
//   L9. buscar_prospectos de vuelta en el menú del CRM              → 4 / 2 · el barrido y «la API de MaKo y el menú…»
//   L10. `servicio: 'apify'` de vuelta en las claves del chat        → 4 / 2 · el barrido y «una clave de Apify pegada…»
//   L11. sin el aviso de retirada en docs/diseno-leads-scraper.md    → 5 / 1 · «los archivos del scraper no están»
//   L12. el ping `async apify(` de vuelta en el verificador          → 5 / 1 · «la tarjeta, los campos…»
// Restaurado: 6 / 0.
