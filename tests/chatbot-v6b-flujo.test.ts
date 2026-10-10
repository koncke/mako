// =============================================================================
// Sexta tanda, SEGUNDA PASADA, parte «flujo»: el borrador, el aviso de las 24 h, el TAG con varias,
// el CRON con varios disparadores y los enchufes del lienzo
// =============================================================================
// Pedido literal de Martín (09/10/2026, sexta tanda; el entero en app/admin/dev/chatbot/bitacora.ts,
// hito «9 oct 18:37»). Lo que fija este archivo, cada cosa con su porqué en el fuente:
//   · El BORRADOR (punto 7): una automatización a medio armar se guarda sola, sin publicar
//     (`crearBorrador`, app/automations/useBorradorSecuencia.ts; se EJECUTA con relojes falsos).
//   · DELAY > 24 h justo antes de Instagram o Messenger: la tarjeta lo avisa (`esperaAntesDe`).
//   · TAG 2 («Se debería poder seleccionar multiple»): la tarjeta nombra TODAS las etiquetas.
//   · CRON 10: una fila por disparador con SU ícono, cada una abre ESE CRON, y «＋ Nuevo CRON».
//   · El cableado que otra parte pidió en los archivos del lienzo (el GET trae el borrador, la ruta lo
//     guarda, la condición vacía pasa a escuchar, el disparador llega al editor del mensaje, el DTO
//     sabe de Instagram/Messenger y de la línea) y el barrido de general 9 (la papelera roja).
//
// PROBADO ROMPIÉNDOLO (09/10/2026; base en verde: 14 pasan, 0 fallan). Cada rotura de a una, aplicada
// y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   B1. `cambio` no suelta el respiro anterior (dos guardados por frase)             -> 13 / 1
//   B2. `cambio` manda aunque sea lo último guardado                                  -> 11 / 3
//   B3. guarda sin haber leído el borrador (`puedeGuardar` ignorado)                  -> 13 / 1
//   B4. `sinColumna` no apaga el guardado                                             -> 13 / 1
//   B5. un rechazo del server no avisa                                                -> 13 / 1
//   B6. `despachar` deja vivo el respiro (sale dos veces)                             -> 13 / 1
//   B7. `descartar` no le avisa al server                                             -> 13 / 1
//   B8. `yaGuardado` no anota lo publicado (vuelve como borrador)                     -> 13 / 1
//   B9. SecuenciaPerfil guarda sin mirar si el GET lo leyó                            -> 13 / 1
//  B10. publicar sin descartar el borrador                                            -> 13 / 1
//  B11. getSettingData dice «ninguno» cuando no lo pudo leer                          -> 13 / 1
//  B12. la ruta guarda el borrador con `setSecuenciaPasos` (lo que lee el motor)      -> 13 / 1
//   V1. dos esperas seguidas no se suman                                              -> 13 / 1
//   V2. la espera «antes de la reunión» cuenta                                        -> 13 / 1
//   V3. el aviso sale también para WhatsApp                                          -> 13 / 1
//   V4. avisa con justo 24 h (`>=`)                                                   -> 13 / 1
//   V5. el aviso le gana a «Sin escribir»                                             -> 13 / 1
//   T1. la tarjeta nombra sólo la primera etiqueta                                    -> 13 / 1
//   C1. la fila del CRON sin el ícono de su clase                                     -> 13 / 1
//   C2. «＋ Nuevo CRON» aunque nadie sepa agregar                                     -> 13 / 1
//   C3. tocar una fila abre un CRON nuevo y no ESE                                    -> 13 / 1
//   C4. la condición vacía ofrece escuchar aunque ya haya otra                        -> 13 / 1
//   C5. el editor del mensaje sin el disparador                                       -> 13 / 1
//   C6. el DTO sin Instagram ni Messenger                                             -> 13 / 1
//   P1. Lienzo vuelve a definir su propia papelera (🗑)                               -> 13 / 1
//   P2. quitar una fila de la condición vuelve a ser la ✕                             -> 13 / 1
//   R1. la que escucha va en el orden del array (después de las sueltas)              -> 13 / 1
//
// Correr: node --import tsx --test tests/chatbot-v6b-flujo.test.ts
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { crearBorrador, ERROR_BORRADOR, RESPIRO_BORRADOR_MS } from '../app/automations/useBorradorSecuencia';
import { grafoDeSecuencia, esperaAntesDe, AVISO_VENTANA_META, etiquetaDeAccion, type PasoParaGrafo, type NodoFlujo } from '../lib/flujo-conversacion';
import { VENTANA_META_MS } from '../lib/canal-social';
import { CuerpoCron } from '../app/automations/FlujoLienzo';
import { IconoDisparador } from '../app/automations/IconosDisparador';
import type { PasoSecuenciaDto } from '../app/automations/ChatAgentApp';
import { condicionARespuesta, type PasoGrafo } from '../lib/flujo-grafo';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (r: string) => sinComentarios(fuente(r));
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  return src.slice(i, j);
};

// ── El borrador ─────────────────────────────────────────────────────────────────────────────

const flujo = (cuerpo: string): PasoSecuenciaDto[] => [{ id: 'm1', canal: 'whatsapp', delay_horas: 0, cuerpo } as unknown as PasoSecuenciaDto];
/** Deja correr las promesas del `post` (el reloj falso sólo maneja `setTimeout`). */
const drenar = () => new Promise<void>((r) => setImmediate(r));

function armar(opts: { puedeGuardar?: boolean; respuesta?: unknown; tira?: boolean } = {}) {
  const posts: Record<string, unknown>[] = [];
  const guardados: string[] = [];
  const errores: string[] = [];
  const motor = crearBorrador({
    post: async (body) => {
      posts.push(body);
      if (opts.tira) throw new Error('sin red');
      return { json: async () => opts.respuesta ?? { ok: true } };
    },
    inicial: flujo('hola'),
    puedeGuardar: opts.puedeGuardar ?? true,
    avisos: () => ({ onGuardado: (j) => guardados.push(j), onError: (m) => errores.push(m) }),
  });
  return { motor, posts, guardados, errores };
}

test('el borrador se guarda UNA vez por respiro, con el flujo FINAL, y avisa qué quedó guardado', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts, guardados } = armar();
  motor.cambio(flujo('hola'));                 // lo de siempre: no se manda
  motor.cambio(flujo('hola L'));
  mock.timers.tick(RESPIRO_BORRADOR_MS - 1);
  motor.cambio(flujo('hola Lu'));              // tipea antes del respiro: reinicia
  mock.timers.tick(RESPIRO_BORRADOR_MS - 1);
  assert.equal(posts.length, 0, 'se guardó antes del respiro');
  mock.timers.tick(1);
  await drenar();
  assert.equal(posts.length, 1, 'tipear una frase tiene que ser UN guardado');
  assert.equal(posts[0].action, 'borrador');
  assert.deepEqual(posts[0].pasos, flujo('hola Lu'));
  assert.deepEqual(guardados, [JSON.stringify(flujo('hola Lu'))]);
  motor.cambio(flujo('hola Lu'));              // lo mismo que lo guardado: nada
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 1);
});

test('volver a lo guardado ANTES del respiro no manda nada (deshacer hasta ahí)', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts } = armar();
  motor.cambio(flujo('otra cosa'));
  motor.cambio(flujo('hola'));
  mock.timers.tick(RESPIRO_BORRADOR_MS * 2);
  await drenar();
  assert.equal(posts.length, 0);
});

test('⚠️ sin haber LEÍDO el borrador no se guarda ni se descarta: pisaría uno que la pantalla no vio', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts } = armar({ puedeGuardar: false });
  motor.cambio(flujo('nuevo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  motor.despachar();
  motor.descartar();
  await drenar();
  assert.equal(posts.length, 0);
});

test('`sinColumna` apaga el guardado sin cartel; un rechazo o la red caída sí avisan', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const sin = armar({ respuesta: { ok: false, sinColumna: true } });
  sin.motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  sin.motor.cambio(flujo('b'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(sin.posts.length, 1, 'siguió intentando con la columna que falta');
  assert.deepEqual(sin.errores, [], 'la columna que falta no es nada que la persona pueda arreglar');

  const no = armar({ respuesta: { ok: false } });
  no.motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(no.errores, [ERROR_BORRADOR]);
  assert.deepEqual(no.guardados, [], 'un rechazo no es «guardado»: salir perdería lo que no se guardó');

  const red = armar({ tira: true });
  red.motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(red.errores, [ERROR_BORRADOR]);
});

test('al irse sale YA lo que esperaba; publicar lo DESCARTA en el server y lo publicado no se manda', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const ida = armar();
  ida.motor.cambio(flujo('a medio armar'));
  ida.motor.despachar();
  await drenar();
  assert.equal(ida.posts.length, 1, 'cerrar la pestaña antes del respiro perdía el cambio');
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(ida.posts.length, 1, 'el respiro volvió a mandar lo ya despachado');

  const pub = armar();
  pub.motor.cambio(flujo('listo'));
  pub.motor.descartar();
  pub.motor.yaGuardado(flujo('listo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(pub.posts.map((p) => p.action), ['descartar-borrador'], 'publicar dejó un borrador vivo, o lo volvió a guardar');
  pub.motor.cambio(flujo('listo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(pub.posts.length, 1, 'lo recién publicado volvió a guardarse como borrador');
});

test('el lienzo guarda el borrador SÓLO si lo leyó, lo abre si hay, y lo descarta al publicar', () => {
  const sp = codigo('app/automations/SecuenciaPerfil.tsx');
  assert.match(sp, /useBorradorSecuencia\(secuencia\.id, \{\s*puedeGuardar: rolAdmin && secuencia\.borrador !== undefined,/);
  assert.match(sp, /useEffect\(\(\) => \{ borrador\.cambio\(pasos\); \}, \[pasos\]\);/);
  assert.match(sp, /secuencia\.borrador\?\.pasos\?\.length \? renumerar\(normalizar\(secuencia\.borrador\.pasos\)\) : null/);
  const publicar = tramo(sp, 'borrador.descartar();', 'if (convertida && limpiar)');
  assert.match(publicar, /borrador\.yaGuardado\(pasos\);/);
  // La ruta lo guarda por SU acción (nunca por `setSecuenciaPasos`, que es lo que lee el motor).
  const ruta = codigo('app/api/chat-agent/secuencias/route.ts');
  const rama = tramo(ruta, "if (body.action === 'borrador' || body.action === 'descartar-borrador')", 'status: 404');
  assert.match(rama, /guardarBorradorSecuencia/);
  assert.match(rama, /descartarBorradorSecuencia/);
  assert.doesNotMatch(rama, /setSecuenciaPasos/);
  // El GET lo trae, tolerante: AUSENTE cuando no se pudo leer (no «ninguno»).
  const gsd = codigo('lib/setting-secuencias.ts');
  assert.match(gsd, /leerBorradoresSecuencias\(supabase as unknown as DbBorrador\)/);
  assert.match(gsd, /\.\.\.\(borradores \? \{ borrador: borradores\.get\(s\.id\) \?\? null \} : \{\}\)/);
});

// ── El aviso de las 24 h ────────────────────────────────────────────────────────────────────

const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const esp = (id: string, siguiente: string | null, minutos: number, modo = 'tiempo'): PasoParaGrafo =>
  ({ id, nodo: 'esperar', espera: { modo, minutos }, siguiente, canal: 'whatsapp', delay_horas: 0, cuerpo: '' } as PasoParaGrafo);
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n!; };
const DIA = VENTANA_META_MS / 60_000;

test('⚠️ un DELAY de más de 24 h justo antes de Instagram o Messenger lo avisa la tarjeta (corto)', () => {
  assert.equal(DIA, 1440, 'la ventana de Meta son 24 h');
  assert.ok(AVISO_VENTANA_META.length <= 22, 'el ⚠ de una tarjeta es corto: el porqué va al comentario');
  for (const canal of ['instagram', 'messenger']) {
    const g = grafoDeSecuencia([esp('e', 'dm', DIA + 60), msg('dm', { canal })], { disparador: 'X' });
    assert.equal(nodo(g, 'dm').advertencia, AVISO_VENTANA_META, `${canal} después de 25 h no avisa`);
  }
  // Justo 24 h todavía sale; WhatsApp no tiene ventana (el no oficial, AGENTS.md).
  assert.equal(nodo(grafoDeSecuencia([esp('e', 'dm', DIA), msg('dm', { canal: 'instagram' })], { disparador: 'X' }), 'dm').advertencia, undefined);
  assert.equal(nodo(grafoDeSecuencia([esp('e', 'w', DIA * 3), msg('w')], { disparador: 'X' }), 'w').advertencia, undefined);
  // «Sin escribir» gana: primero lo que falta.
  assert.equal(nodo(grafoDeSecuencia([esp('e', 'dm', DIA * 2), msg('dm', { canal: 'instagram', cuerpo: '' })], { disparador: 'X' }), 'dm').advertencia, 'Sin escribir');
});

test('dos esperas seguidas son UNA más larga; «antes de la reunión» no cuenta (depende de la fecha)', () => {
  const seguidas = [esp('a', 'b', 720), esp('b', 'dm', 780), msg('dm', { canal: 'messenger' })] as PasoGrafo[];
  assert.equal(esperaAntesDe(seguidas, 'dm'), 1500);
  assert.equal(nodo(grafoDeSecuencia(seguidas as PasoParaGrafo[], { disparador: 'X' }), 'dm').advertencia, AVISO_VENTANA_META);
  // Un mensaje en el medio corta la cuenta: lo que importa es la espera JUSTO antes.
  const cortada = [esp('a', 'm', DIA * 2), msg('m', { siguiente: 'b' }), esp('b', 'dm', 60), msg('dm', { canal: 'instagram' })] as PasoGrafo[];
  assert.equal(esperaAntesDe(cortada, 'dm'), 60);
  const reunion = [esp('a', 'dm', DIA * 2, 'antes_reunion'), msg('dm', { canal: 'instagram' })] as PasoGrafo[];
  assert.equal(esperaAntesDe(reunion, 'dm'), 0);
});

// ── «Si responde» como la CONDITION que escucha ─────────────────────────────────────────────

test('la que escucha va PRIMERO debajo del árbol del CRON, antes que una tarjeta suelta', () => {
  // Punto 12: sin flecha de entrada, va en la columna del CRON. Y aunque en el array venga DESPUÉS de una
  // suelta (lo normal: se crea al final), se dibuja antes, pegada al CRON: es parte de la automatización.
  const vacia = { id: 'escucha', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: null, ramas: [{ id: 'escucha_r', modo: 'todas', filas: [], siguiente: null }] } as unknown as PasoGrafo;
  const r = condicionARespuesta([msg('a'), msg('suelta'), vacia] as PasoGrafo[], 'escucha');
  assert.ok(!('error' in r), 'no se pudo pasar la condición a escuchar');
  const g = grafoDeSecuencia((r as { pasos: PasoParaGrafo[] }).pasos, { disparador: 'X' });
  const escucha = nodo(g, 'escucha');
  const suelta = nodo(g, 'suelta');
  assert.equal(suelta.suelta, true);
  assert.equal(escucha.suelta, undefined, 'la que escucha no es una suelta');
  assert.ok(escucha.y < suelta.y, 'la suelta quedó entre el CRON y la que escucha');
});

// ── El TAG con varias etiquetas ─────────────────────────────────────────────────────────────

test('TAG 2: la tarjeta nombra TODAS las etiquetas elegidas, no sólo la primera', () => {
  const nombres = { etiqueta: (id: number) => ({ 1: 'Cualificado', 2: 'Seguimiento', 3: 'VIP', 4: 'Frío' } as Record<number, string>)[id] ?? 'una etiqueta' };
  const tag = (ids: number[]) => msg('t', { cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaIds: ids } } } as Partial<PasoParaGrafo>);
  const detalle = (ids: number[]) => nodo(grafoDeSecuencia([tag(ids)], { disparador: 'X', nombres }), 't').detalle;
  assert.equal(detalle([1]), 'Agregar Cualificado');
  assert.equal(detalle([1, 2]), 'Agregar Cualificado y Seguimiento');
  assert.equal(detalle([1, 2, 3, 4]), 'Agregar Cualificado, Seguimiento y 2 más');
  const e = etiquetaDeAccion(tag([2, 3]) as PasoGrafo);
  assert.deepEqual(e && { id: e.etiquetaId, ids: e.etiquetaIds }, { id: 2, ids: [2, 3] }, 'la primera sigue en `etiquetaId` (lo que leen los de antes)');
});

// ── El CRON con varios disparadores ─────────────────────────────────────────────────────────

test('CRON 10: una fila por disparador con SU ícono, cada una abre ESE CRON, y «＋ Nuevo CRON»', () => {
  const ds = [{ id: 'd1', texto: 'Entra a Ventas', icono: 'producto' }, { id: 'd2', texto: 'Todos los lunes', icono: 'recurrente' }];
  const html = renderToStaticMarkup(createElement(CuerpoCron, { disparadores: ds, onAbrir: () => {}, onNuevo: () => {} }));
  assert.match(html, /data-disparador="d1"/);
  assert.match(html, /data-disparador="d2"/);
  assert.ok(html.indexOf('Entra a Ventas') < html.indexOf('Todos los lunes'), 'las filas no van en el orden de la lista');
  for (const tipo of ['producto', 'recurrente'] as const) {
    assert.ok(html.includes(renderToStaticMarkup(createElement(IconoDisparador, { tipo, tam: 16 }))), `la fila de ${tipo} no lleva el ícono de su clase`);
  }
  assert.match(html, /＋ Nuevo CRON/);
  // Sin quien sepa agregar, no se ofrece; sin quien sepa abrir, las filas no son botones.
  const soloVer = renderToStaticMarkup(createElement(CuerpoCron, { disparadores: ds }));
  assert.doesNotMatch(soloVer, /Nuevo CRON|data-disparador|<button/);
  // Y cada fila abre la suya: el id viaja hasta `setCronAbierto` (no «el CRON», uno).
  const fl = codigo('app/automations/FlujoLienzo.tsx');
  assert.match(fl, /onAbrir=\{disparadores\?\.length && onAbrirDisparador \? \(did\) => \{ setSel\(ID_ENTRADA\); onAbrirDisparador\(did\); \} : undefined\}/);
  assert.match(fl, /onClick=\{\(\) => onAbrir\(d\.id\)\}/);
  const sp = codigo('app/automations/SecuenciaPerfil.tsx');
  assert.match(sp, /onAbrirDisparador=\{\(id\) => setCronAbierto\(id\)\}/);
  assert.match(sp, /const filasCron = crons\.lista\.map\(\(d\) => \(\{ id: d\.id, texto: textosCron\.texto\(d\), icono: iconoDeDisparador\(d\) \}\)\);/);
});

// ── Los enchufes que otra parte pidió en los archivos del lienzo ────────────────────────────

test('la condición VACÍA pasa a escuchar desde su editor, y sólo si no hay otra que escuche', () => {
  const fl = codigo('app/automations/FlujoLienzo.tsx');
  const caso = tramo(fl, "case 'condicion': {", "case 'respuesta':");
  assert.match(caso, /\(paso\.ramas \?\? \[\]\)\.every\(\(r\) => !r\.filas\?\.length\) && !raizRespuesta\(pr\.pasos\)/);
  assert.match(caso, /condicionARespuesta\(prev, id\)/);
  assert.match(caso, /onPasarARespuesta=\{pasarARespuesta\}/);
});

test('el editor del mensaje recibe el disparador; el DTO sabe de Instagram, Messenger y la línea', () => {
  const fl = codigo('app/automations/FlujoLienzo.tsx');
  const editorMsg = tramo(fl, '<EditorMensajeWhatsApp', '/>');
  assert.match(editorMsg, /disparador=\{disparador\}/);
  const app = codigo('app/automations/ChatAgentApp.tsx');
  const dto = tramo(app, 'export type PasoSecuenciaDto', '};');
  assert.match(dto, /canal: 'email' \| 'whatsapp' \| CanalSocial;/);
  assert.match(dto, /linea\?: string \| null;/);
  assert.doesNotMatch(fl, /as PasoConLinea|PasoConLinea\b/, 'el cast de la línea ya no hace falta');
});

// ── El barrido: la papelera roja de la casa ─────────────────────────────────────────────────

test('general 9: «borrar» es UNA definición (app/_ui/BotonBorrar.tsx) en los archivos del lienzo', () => {
  for (const r of ['app/_components/Lienzo.tsx', 'app/automations/FlujoLienzo.tsx', 'app/automations/EditorDisparadores.tsx', 'app/automations/OnboardingChatAgent.tsx', 'app/automations/EditorCondicion.tsx']) {
    const c = codigo(r);
    assert.match(c, /from '@\/app\/_ui\/BotonBorrar'/, `${r} no usa la papelera de la casa`);
    assert.doesNotMatch(c, /function IconoBorrar\b/, `${r} define su propia papelera`);
    assert.doesNotMatch(c, /🗑|name="trash"/, `${r} dibuja la papelera vieja`);
  }
  const quitar = tramo(codigo('app/automations/EditorCondicion.tsx'), 'function BotonQuitar(', '\n}');
  assert.match(quitar, /<BotonBorrar talla="sm"/);
  assert.doesNotMatch(quitar, /✕/, 'quitar una fila vuelve a ser la ✕ gris, que se lee como «cerrar»');
});
