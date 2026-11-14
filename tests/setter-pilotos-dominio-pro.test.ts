// =============================================================================
// MaKo Esencial SIN el setter con IA, SIN los pilotos de Instagram y YouTube y SIN dominio propio (14/11/2026)
// =============================================================================
// Martín decidió el 14/11/2026 que la capa `completo` (Esencial, US$47) no trae: (1) el setter con IA, que contesta y agenda
// solo; (2) los pilotos automáticos de Instagram y de YouTube del Marketing CoPilot (el de anuncios ya era de Pro); (3) el
// dominio propio de las landings (`web.dominios` en 0). Pro (`agencia`) trae las tres. Lo que se cuida acá:
//   A. EL SETTER: la regla (lib/setter-ia-reglas.ts: lo que le contesta SOLO a un lead con IA, y lo que NO lo es), ejecutada;
//      los dos candados del servidor (Activar → `topeAlActivar`; guardar → `setSecuenciaPasos` con `setterNuevoSoloPro`); las
//      plantillas y «Crear con IA» de un Esencial nacen enteras con «Sola» en «Para aprobar»; la API lo dice antes del «sí»;
//      la pantalla (el AI Step con el candado, «Sola» deshabilitada, y «Pasar a Pro» en el error de Publicar/Activar); y MaKo
//      en WhatsApp para el DUEÑO no lleva candado.
//   B. LOS PILOTOS DE REDES: el candado donde se guarda la config (lib/copiloto/piloto.ts), la ruta (403 con `pasarAPro`) y la
//      pantalla (la hoja de Instagram de «Configurar piloto» y las tarjetas de Instagram y YouTube del paso «Piloto automático»).
//   C. EL DOMINIO EN 0: el texto dice que es de Pro (no «Llegaste al tope de tu plan (0)»), con «Pasar a Pro»; la pestaña
//      «Dominios» lo muestra en vez de «Añadir un dominio»; la API lo dice al proponer.
//
// Correr: node --import tsx --test tests/setter-pilotos-dominio-pro.test.ts
// Probado rompiéndolo: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FUNCIONES_SOLO_PRO, TOPES, textoSoloPro, textoTope } from '../lib/topes-plan';
import {
  TEXTO_SETTER_SOLO_PRO, esCandadoSetterIA, filaConSetterIA, guardarSinSetterSiFrena, sinSetterIA, sumaSetterIA, tieneSetterIA,
} from '../lib/setter-ia-reglas';
import { libertadDeCaso } from '../lib/ai-step-libertad';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { PLANTILLAS, pasosDePlantilla, plantillaPorId } from '../lib/plantillas-automatizaciones';
import { crearDesdePlantilla, type DbPlantilla } from '../lib/plantilla-crear';
import { TEXTO_DOMINIO_SOLO_PRO, pidePasarAPro, topeParaDominio, topeParaPublicar } from '../lib/editor-landing/tope-landings';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: lo que dice un comentario no es lo que corre. */
const codigo = (rel: string) => fuente(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
/** El cuerpo de una función: desde su firma hasta la próxima declaración de nivel superior. */
const cuerpo = (src: string, firma: string, hasta = '\n}\n'): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  return src.slice(i, src.indexOf(hasta, i) + hasta.length);
};

// ── Los pasos de prueba ──────────────────────────────────────────────────────────

const CRON = { id: 'inicio', nodo: 'inicio', siguiente: 'm1' } as PasoGrafo;
const MSG = { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: null } as PasoGrafo;
/** Un AI Step colgado del CRON con un escenario de la libertad pedida. */
const aiStep = (libertad: 'sola' | 'aprueba' | 'avisa', extra: Partial<PasoGrafo> = {}): PasoGrafo => ({
  id: 'ia', nodo: 'respuesta', paso_ia: true, objetivo: 'Que agende', siguiente: null, si_no: null,
  casos: [{
    id: 'c1', titulo: 'Confirma', cuando: 'dice que sí', siguiente: null,
    ...(libertad === 'avisa' ? { responder: '', no_contesta: true } : { responder: 'Agradece en una línea' }),
    ...(libertad === 'sola' ? { sola: true } : {}),
  }],
  ...extra,
} as PasoGrafo);
/** «Si responde» de los de siempre con un «MaKo contesta» (`tipo: 'ia'`) en su caso. */
const siResponde = (revisar: boolean | undefined): PasoGrafo[] => [
  { id: 'r', nodo: 'respuesta', siguiente: null, si_no: null, casos: [{ id: 'k1', titulo: 'Confirma', cuando: 'dice que sí', siguiente: 'mk' }] } as PasoGrafo,
  { id: 'mk', canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'ia', cuerpo: 'Agradece', siguiente: null, ...(revisar === undefined ? {} : { revisar }) } as PasoGrafo,
];

// ── A. EL SETTER CON IA ──────────────────────────────────────────────────────────

test('A1 · la regla: el setter es lo que le contesta SOLO a un lead con IA, y «Para aprobar» o «Sólo te avisa» no lo son', () => {
  assert.equal(tieneSetterIA([CRON, MSG, aiStep('sola')]), true, 'un escenario «Sola» del AI Step');
  assert.equal(tieneSetterIA([CRON, MSG, aiStep('aprueba')]), false, '«Para aprobar» deja el borrador: una persona lo manda');
  assert.equal(tieneSetterIA([CRON, MSG, aiStep('avisa')]), false, '«Sólo te avisa» no le escribe al lead');
  assert.equal(tieneSetterIA([CRON, MSG, aiStep('sola', { suelta: true })]), false, 'un AI Step suelto no escucha (el motor no lo expande)');
  assert.equal(tieneSetterIA([CRON, MSG, ...siResponde(false)]), true, 'un «MaKo contesta» de «Si responde» que sale solo');
  assert.equal(tieneSetterIA([CRON, MSG, ...siResponde(true)]), false, 'el que queda para aprobar');
  assert.equal(tieneSetterIA([CRON, MSG, ...siResponde(undefined)]), false, 'sin `revisar`, el motor deja borrador');
  // Un mensaje en «modo IA» FUERA de «Si responde» adapta un texto fijo: no contesta (y está en una plantilla de la galería).
  assert.equal(tieneSetterIA([CRON, { ...MSG, tipo: 'ia', revisar: false } as PasoGrafo]), false, 'el modo IA de un mensaje de la secuencia');
  assert.equal(tieneSetterIA(null), false);
  assert.equal(tieneSetterIA('no es una lista'), false);
  // La forma de antes: el modo asistido sin «Si responde» contesta solo los casos de la estrategia con `contestaSolo`.
  assert.equal(filaConSetterIA([CRON, MSG], [{ contestaSolo: true }]), true);
  assert.equal(filaConSetterIA([CRON, MSG], [{ contestaSolo: false }, {}]), false);
  assert.equal(filaConSetterIA([CRON, MSG, aiStep('aprueba')], [{ contestaSolo: true }]), false, 'con una tarjeta que escucha, la estrategia no contesta');
});

test('A2 · un candado frena lo NUEVO: guardar suma el setter sólo donde no estaba', () => {
  const sin = [CRON, MSG, aiStep('aprueba')];
  const con = [CRON, MSG, aiStep('sola')];
  assert.equal(sumaSetterIA(sin, con), true);
  assert.equal(sumaSetterIA([], con), true, 'una automatización recién creada');
  assert.equal(sumaSetterIA(con, con), false, 'lo que ya tenía (un Pro que pasó a Esencial) se sigue editando');
  assert.equal(sumaSetterIA(con, sin), false, 'sacarlo nunca se frena');
});

test('A3 · sin el setter: «Sola» pasa a «Para aprobar» y el «MaKo contesta» queda para aprobar; lo demás, igual', () => {
  const pasos = [CRON, MSG, aiStep('sola'), ...siResponde(false)];
  const sin = sinSetterIA(pasos);
  assert.equal(tieneSetterIA(sin), false);
  assert.equal(libertadDeCaso(sin[2].casos![0]), 'aprueba');
  assert.equal(sin[4].revisar, true);
  assert.equal(sin[0], CRON, 'lo que no es el setter no se copia ni se toca');
  assert.equal(sin[1], MSG);
  assert.equal(tieneSetterIA(pasos), true, 'no muta lo que recibe');
});

test('A4 · el texto del candado es el de `textoSoloPro`, y se reconoce sin importar la clase del error', () => {
  assert.ok(FUNCIONES_SOLO_PRO.includes('setter-ia'));
  assert.equal(TEXTO_SETTER_SOLO_PRO, textoSoloPro('setter-ia'));
  assert.equal(TEXTO_SETTER_SOLO_PRO, 'El setter con IA es de MaKo Pro. Pasa a Pro para usarlo.');
  assert.equal(esCandadoSetterIA(new Error(TEXTO_SETTER_SOLO_PRO)), true);
  assert.equal(esCandadoSetterIA(new Error('No se guardó: otra cosa.')), false);
  assert.equal(esCandadoSetterIA(TEXTO_SETTER_SOLO_PRO), false, 'un texto suelto no es un error');
});

test('A5 · lo que CREA MaKo (plantilla, «Crear con IA») se guarda otra vez sin el setter si la puerta lo frena; lo demás no se toca', async () => {
  const guardados: PasoGrafo[][] = [];
  const puerta = async (ps: PasoGrafo[]) => { if (tieneSetterIA(ps)) throw new Error(TEXTO_SETTER_SOLO_PRO); guardados.push(ps); };
  await guardarSinSetterSiFrena([CRON, MSG, aiStep('sola')], puerta);
  assert.equal(guardados.length, 1);
  assert.equal(tieneSetterIA(guardados[0]), false);
  // Otro rechazo sigue siendo un rechazo (no se reintenta con otra cosa).
  await assert.rejects(guardarSinSetterSiFrena([CRON, MSG, aiStep('sola')], async () => { throw new Error('No se guardó: falta el objetivo.'); }), /falta el objetivo/);
  // Sin setter, una sola escritura, con los mismos pasos.
  const una: PasoGrafo[][] = [];
  await guardarSinSetterSiFrena([CRON, MSG], async (ps) => { una.push(ps); });
  assert.deepEqual(una, [[CRON, MSG]]);
});

test('A6 · las plantillas siguen abiertas: hay plantillas con «Sola», y la de un Esencial nace entera con «Para aprobar»', async () => {
  const conSetter = PLANTILLAS.filter((p) => tieneSetterIA(pasosDePlantilla(p))).map((p) => p.id);
  assert.ok(conSetter.includes('lead-agendo'), `«Confirma» sale sola en la del agendado (con setter: ${conSetter.join(', ')})`);
  for (const p of PLANTILLAS) assert.equal(tieneSetterIA(sinSetterIA(pasosDePlantilla(p))), false, p.id);
  // Ejecutado con la puerta de mentira de un Esencial: el primer intento lo frena el candado, el segundo entra sin setter.
  const db: DbPlantilla = {
    from: () => ({
      select: () => ({ is: async () => ({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 701 }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  };
  const intentos: unknown[][] = [];
  const r = await crearDesdePlantilla('lead-agendo', {
    db, clave: () => 'plantilla-x', setDisparadores: async () => {},
    setPasos: async (_id, ps) => { intentos.push(ps); if (tieneSetterIA(ps)) throw new Error(TEXTO_SETTER_SOLO_PRO); },
  });
  assert.equal(r.id, 701, 'la plantilla se creó');
  assert.equal(intentos.length, 2);
  assert.equal(tieneSetterIA(intentos[1]), false);
  const ia = (intentos[1] as PasoGrafo[]).find((x) => x.paso_ia === true)!;
  const confirma = ia.casos!.find((c) => c.titulo === 'Confirma')!;
  assert.equal(libertadDeCaso(confirma), 'aprueba');
  assert.ok(plantillaPorId('lead-agendo'));
});

test('A7 · los candados del servidor: Activar (`topeAlActivar`) y guardar los pasos (`setSecuenciaPasos`), con `TopeDelPlanError`', () => {
  const tope = codigo('lib/tope-automations.ts');
  const activar = cuerpo(tope, 'export async function topeAlActivar(');
  assert.match(activar, /if \(ws == null \|\| !\(await esEsencialDe\(ws\)\)\) return null;/, 'sólo al Esencial');
  assert.match(activar, /select\('activa, pasos, estrategia'\)/);
  const iSetter = activar.indexOf('filaConSetterIA(');
  assert.ok(iSetter > 0 && iSetter < activar.indexOf("topeDe('completo', 'automations.activas')"), 'el setter va antes que el tope de las activas');
  assert.ok(iSetter > activar.indexOf('?.activa === true) return null;'), 'volver a prender una prendida no se frena');
  assert.match(activar, /return TEXTO_SETTER_SOLO_PRO;/);
  const nuevo = cuerpo(tope, 'export async function setterNuevoSoloPro(');
  assert.ok(nuevo.indexOf('sumaSetterIA(antes, nuevos)') < nuevo.indexOf('esEsencialDe('), 'lo barato primero: sin setter nuevo no se lee el plan');
  // La puerta de TODOS los escritores de pasos: antes de escribir, después de validar, y no en la validación de Activar.
  const nutri = codigo('lib/nutricion.ts');
  const pasos = cuerpo(nutri, 'export async function setSecuenciaPasos(', '\nasync function filasCohorte<T>(');
  // 14/11/2026 (el rojo de nutricion-canal, que mide el bloque): el candado vive en `frenarSetterNuevo` y el bloque lo llama.
  const iCandado = pasos.indexOf('await frenarSetterNuevo(antes, grafo, o?.soloValidar);');
  assert.ok(iCandado > pasos.indexOf('const errores = validarGrafo(grafo);'), 'después de validar el grafo');
  assert.ok(iCandado < pasos.indexOf('.update({ pasos: grafo'), 'antes de escribir');
  const frena = cuerpo(nutri, 'async function frenarSetterNuevo(');
  assert.match(frena, /if \(!soloValidar\) \{\n\s+const \{ setterNuevoSoloPro \} = await import\('\.\/tope-automations'\);\n\s+const soloPro = await setterNuevoSoloPro\(antes, grafo\);\n\s+if \(soloPro\) throw new TopeDelPlanError\(soloPro\);/);
  // La ruta del lienzo ya contesta `TopeDelPlanError` con 403 y `tope: true` (Publicar y Activar).
  assert.match(codigo('app/api/whatsapp/secuencias/route.ts'), /instanceof TopeDelPlanError\) return Response\.json\(\{ ok: false, error: msg, tope: true \}, \{ status: 403 \}\);/);
  // Lo que crea MaKo nace sin el setter: la plantilla y «Crear con IA».
  assert.match(codigo('lib/plantilla-crear.ts'), /await guardarSinSetterSiFrena\(pasosDePlantilla\(p\), \(ps\) => deps\.setPasos\(nueva\.id, ps as never\[\]\)\);/);
  assert.match(codigo('lib/flujo-ia-crear.ts'), /guardarPasos: \(id, pasos\) => guardarSinSetterSiFrena\(pasos, \(ps\) => setSecuenciaPasos\(id, ps as unknown as PasoSecuencia\[\]\)\),/);
  // La API: `contestaSolo` de un Esencial se dice ANTES de proponer.
  const run = codigo('lib/api-mako/areas/chatbot.run.ts');
  const agregar = run.slice(run.indexOf('  agregar_escenario_secuencia: {'), run.indexOf('\n  resolver_handoff: {'));
  assert.match(agregar, /preparar: async \(input, ctx\) => \{/);
  assert.match(agregar, /if \(escenario\.contestaSolo && \(await esEsencialDe\(ctx\.ws\)\)\) return \{ error: TEXTO_SETTER_SOLO_PRO \};/);
});

test('A8 · la pantalla: el AI Step con el candado y «Sola» deshabilitada; Publicar/Activar con «Pasar a Pro»; MaKo para el dueño, sin candado', () => {
  const ed = codigo('app/automations/EditorPasoIA.tsx');
  assert.match(ed, /const setterSoloPro = useSoloPro\('setter-ia'\);/);
  assert.match(ed, /\{setterSoloPro && <CandadoSoloPro funcion="setter-ia" \/>\}/);
  assert.match(ed, /const conIconos = \(ops: ReadonlyArray<OpcionDeLibertad>\) => opcionesConIconos\(sinSolaConEsencial\(ops, setterSoloPro\)\);/);
  assert.match(ed, /esencial \? ops\.map\(\(o\) => \(o\.value === 'sola' \? \{ \.\.\.o, disabled: true \} : o\)\) : ops/);
  // Lo nuevo nace sin «Sola»: el catálogo y lo que arma MaKo.
  assert.match(ed, /setCasos\(conEscenario\(casos, sinSola\(escenarioTipico\(v\.slice\(2\), ids\(\)\(\)\)\)\)\)/);
  assert.match(ed, /const a = armadoDelPlan\(j\.armado as ArmadoAIStep\);/);
  const perfil = codigo('app/automations/SecuenciaPerfil.tsx');
  assert.match(perfil, /useEffect\(\(\) => \{ if \(err === TEXTO_SETTER_SOLO_PRO\) marcarSoloPro\('setter-ia'\); \}, \[err\]\);/);
  // 14/11/2026 (los rojos de lienzo-sexta-tanda y reportar-a-soporte): el candado es un aviso aparte, role="status" y fuera del pie,
  // y el error del pie (`errPie`) es cualquier otro, con su «Reportar a soporte».
  assert.match(perfil, /const errPie = err !== TEXTO_SETTER_SOLO_PRO \? err : null;/);
  assert.match(perfil, /const avisoSetter = rolAdmin && err === TEXTO_SETTER_SOLO_PRO && \(\s*<span role="status"[^>]*>\s*\{err\} <CtaPasarAPro><Link href=\{RUTA_CAMBIAR_PLAN\}[^>]*>\{ROTULO_PASAR_A_PRO\}<\/Link><\/CtaPasarAPro>/);
  // MaKo en WhatsApp para el DUEÑO (el bot 1 a 1 y los grupos) no es el setter: no mira este candado.
  for (const f of ['lib/mako-bot.ts', 'lib/mako-bot-reglas.ts']) assert.doesNotMatch(codigo(f), /setter-ia|TEXTO_SETTER_SOLO_PRO|tieneSetterIA/, f);
});

// ── B. LOS PILOTOS DE INSTAGRAM Y DE YOUTUBE ─────────────────────────────────────

test('B1 · el candado donde se guarda la config del piloto de Instagram, como `PlanSinPiloto` de los anuncios', () => {
  assert.ok(FUNCIONES_SOLO_PRO.includes('piloto-redes'));
  assert.match(textoSoloPro('piloto-redes'), /^El piloto automático de Instagram y YouTube es de MaKo Pro\./);
  const piloto = codigo('lib/copiloto/piloto.ts');
  assert.match(piloto, /export class PlanSinPilotoRedes extends Error \{\n\s+constructor\(\) \{ super\(textoSoloPro\('piloto-redes'\)\); this\.name = 'PlanSinPilotoRedes'; \}/);
  assert.match(piloto, /export const pilotoRedesPermitido = async \(ws: number\): Promise<boolean> => !\(await esEsencialDe\(ws\)\);/);
  const guardar = cuerpo(piloto, 'export async function guardarNumeroReel(');
  assert.match(guardar, /^export async function guardarNumeroReel\(ws: number, numero: number\): Promise<PilotoCoPilot> \{\n\s+if \(!\(await pilotoRedesPermitido\(ws\)\)\) throw new PlanSinPilotoRedes\(\);/, 'lo primero, antes de escribir');
  // La ruta: 403 con el texto y `pasarAPro` (lo reconoce `esRespuestaSoloPro`). El retargeting (de los anuncios) no lo lleva.
  const ruta = codigo('app/api/copiloto/piloto/route.ts');
  assert.match(ruta, /if \(e instanceof PlanSinPilotoRedes\) return J\(\{ ok: false, error: e\.message, tope: true, pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \}, 403\);/);
});

// 14/11/2026, al unir con main: el piloto de Instagram y YouTube de copilot-maqueta llegó con su CONFIGURACIÓN en `pilotoRedes`, y el
// «¿el plan lo trae?» de acá pasó a llamarse `redesPermitidas`. El candado cubre las dos pestañas (Instagram y YouTube) y también
// `guardarPilotoRedes`, que guarda la configuración que trajo main.
test('B2 · la pantalla: «Configurar piloto» › Instagram y YouTube son el candado, y el paso «Piloto automático» lo dice en las dos', () => {
  // Desde el 14/11/2026 (main) la carga vive en ./cargar.ts, compartida con el teléfono (app/m/ads/page.tsx).
  const pagina = codigo('app/ads-manager/copiloto/configurar/cargar.ts');
  assert.match(pagina, /pilotoRedesPermitido\(ws\)\.catch\(\(\) => true\)/, 'ante la duda, abierto');
  assert.match(pagina, /redes, redesPermitidas \};/);
  const cfg = codigo('app/ads-manager/copiloto/configurar/ConfigurarPiloto.tsx');
  assert.match(cfg, /const redesSoloPro = useSoloPro\('piloto-redes'\) \|\| !redesPermitidas;/);
  assert.match(cfg, /\{canal !== 'anuncios' && redesSoloPro \? \([\s\S]*?<CandadoSoloPro funcion="piloto-redes"/);
  assert.match(cfg, /\? !redesSoloPro && <button type="button" className="frn-btn frn-btn--primary" disabled=\{guardando\} onClick=\{\(\) => void guardarRed\(canal\)\}>/, 'sin «Guardar» con el candado');
  assert.match(cfg, /if \(!r\.ok && esRespuestaSoloPro\(r\)\) \{ marcarSoloPro\('piloto-redes'\); return; \}/);
  const copiloto = codigo('app/ads-manager/copiloto/CoPilot.tsx');
  assert.match(copiloto, /\{paso === 'piloto' && \(tarjeta === 'instagram' \|\| tarjeta === 'youtube'\) && !datos\.redesPermitidas && <PilotoRedesSoloPro red=\{tarjeta\} \/>\}/);
  assert.match(copiloto, /<CandadoSoloPro funcion="piloto-redes" \/>/);
  assert.match(copiloto, /if \(\(t === 'instagram' \|\| t === 'youtube'\) && !datos\.redesPermitidas\) return \{ n: '—', s: 'De MaKo Pro' \};/);
  assert.match(codigo('app/ads-manager/copiloto/cargar.ts'), /callar\(pilotoRedesPermitido\(ws\), true\)/);
  // Lo que guarda la configuración de las redes (main) también frena primero.
  const redes = cuerpo(codigo('lib/copiloto/piloto.ts'), 'export async function guardarPilotoRedes(');
  assert.match(redes, /^export async function guardarPilotoRedes\([^)]*\)[^{]*\{\n\s+if \(!\(await pilotoRedesPermitido\(ws\)\)\) throw new PlanSinPilotoRedes\(\);/, 'guardarPilotoRedes sin el candado');
});

// ── C. EL DOMINIO PROPIO EN 0 ────────────────────────────────────────────────────

const ESENCIAL = { ws: 42, wsPlataforma: 9, capa: 'completo', cobradoPorPasarela: true, usadas: 0, yaCuenta: false };

test('C1 · Esencial sin dominio propio: el texto dice que es de Pro, nunca «Llegaste al tope de tu plan (0)»', () => {
  assert.equal(TOPES.completo['web.dominios'], 0);
  assert.equal(TOPES.agencia['web.dominios'], null);
  assert.deepEqual(topeParaDominio(ESENCIAL), { ok: false, tope: 0, texto: TEXTO_DOMINIO_SOLO_PRO });
  assert.equal(TEXTO_DOMINIO_SOLO_PRO, 'El dominio propio es de MaKo Pro. Pasa a Pro para usarlo.');
  assert.ok(!TEXTO_DOMINIO_SOLO_PRO.includes('(0)'));
  // Lo de siempre sigue: el Pro, quien no paga por la pasarela y la landing que ya tenía su dominio pasan.
  assert.deepEqual(topeParaDominio({ ...ESENCIAL, capa: 'agencia' }), { ok: true });
  assert.deepEqual(topeParaDominio({ ...ESENCIAL, cobradoPorPasarela: false }), { ok: true });
  assert.deepEqual(topeParaDominio({ ...ESENCIAL, yaCuenta: true }), { ok: true });
  // Un tope lleno que no es 0 sigue diciendo el de siempre.
  assert.deepEqual(topeParaPublicar({ ...ESENCIAL, usadas: 1 }), { ok: false, tope: 1, texto: textoTope(1) });
  // Los dos llevan «Pasar a Pro»; un error cualquiera, no.
  assert.equal(pidePasarAPro(TEXTO_DOMINIO_SOLO_PRO), true);
  assert.equal(pidePasarAPro(textoTope(1)), true);
  assert.equal(pidePasarAPro('Vercel no contestó. Vuelve a intentar.'), false);
  assert.equal(pidePasarAPro(null), false);
});

test('C2 · la pestaña «Dominios» y la API: el candado con «Pasar a Pro», y la API lo dice al proponer', () => {
  const dialogo = codigo('app/web-generator/editor/dialogos/DialogoPublicar.tsx');
  assert.match(dialogo, /if \(!pidePasarAPro\(error\)\) return null;/);
  assert.match(dialogo, /const esencial = usePlanEsencial\(\);/);
  assert.match(dialogo, /\) : esencial === true \? \(\n\s+<p className="gmp-ayuda" role="status" data-solo-pro="dominio">\{TEXTO_DOMINIO_SOLO_PRO\}<PasarAPro error=\{TEXTO_DOMINIO_SOLO_PRO\} \/><\/p>\n\s+\) : \(\n\s+<Campo etiqueta="Añadir un dominio"/);
  const run = codigo('lib/api-mako/areas/landing-editor.run.ts');
  const conectar = run.slice(run.indexOf('  conectar_dominio_landing: {'), run.indexOf('  verificar_dominio_landing: {'));
  const iFreno = conectar.indexOf("const freno = await frenoDeTope(ctx.ws, 'dominio', !!actual);");
  assert.ok(iFreno > 0 && iFreno < conectar.indexOf('payload: { id, dominio: d }'), 'el tope antes de proponer');
  assert.match(conectar, /if \(freno\) return \{ error: freno\.error \};/);
  // Y el servidor de siempre: `conectarDominio` pregunta `frenoDeTope` antes de reclamar el dominio.
  const srv = codigo('lib/editor-landing/dominios.ts');
  assert.ok(srv.indexOf("frenoDeTope(ws, 'dominio', !!fila.dominio)") < srv.indexOf('await reclamar(ws, id, d)'));
});

// PROBADO ROMPIÉNDOLO (14/11/2026), junto con tests/tope-landings.test.ts. Base 17 / 0. Una rotura por vez, restaurada de
// memoria y verificada byte a byte (nunca con git). Pasan / fallan:
//   R1  la regla: «Para aprobar» cuenta como setter (lib/setter-ia-reglas.ts)            → 13 / 4 (A1, A2, A3, A6)
//   R2  Activar sin el candado del setter (lib/tope-automations.ts)                      → 16 / 1 (A7)
//   R3  guardar los pasos sin el candado (lib/nutricion.ts, `setSecuenciaPasos`)          → 16 / 1 (A7)
//   R4  el reel de Instagram sin el candado (lib/copiloto/piloto.ts)                     → 16 / 1 (B1)
//   R5  el dominio en 0 dice «Llegaste al tope de tu plan (0)» (tope-landings.ts)        → 15 / 2 (C1 y el de tope-landings)
//   R6  el AI Step sin el candado (app/automations/EditorPasoIA.tsx)                     → 16 / 1 (A8)
//   R7  la plantilla sin bajar «Sola» (lib/plantilla-crear.ts)                           → 15 / 2 (A6, A7)
//   R8  «Configurar piloto» ignora el plan que leyó el server (ConfigurarPiloto.tsx)     → 16 / 1 (B2)
//   R9  la API propone el dominio sin el tope (lib/api-mako/areas/landing-editor.run.ts) → 16 / 1 (C2)
//   R10 lo que ya tenía el setter también se frena (`sumaSetterIA`)                      → 16 / 1 (A2)
// Al final, 17 / 0. Además, en verde el mismo día: topes-plan (4), plan-esencial + ai-step-armar (16), automations-paso-ia
// (20), automations-activar-todos-los-caminos + plantillas-automatizaciones (57), motor-segunda-tanda +
// automations-paso-ia-revision (20), cliente-de-agencia-y-partners-2910 + prueba-topes (15), api-mako-dominio-landing +
// editor-landing-dominios (45), automations-mako-en-whatsapp + automatizaciones-solo-plantillas (19). Sin `tsc` (la RAM de la PC).
