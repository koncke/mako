// =============================================================================
// El onboarding y las ofertas desde la API de MaKo (área `negocio`, 23/10/2026)
// =============================================================================
// Pedido de Martín (23/10/2026): «Y si hay que hacer una revisión completa de la API, porque creo que faltan muchas
// acciones posibles». La auditoría (P0-12, P0-13 y P0-14) trajo cinco operaciones:
//   · cerrar_paso_onboarding     → un paso del ARRANQUE, como hecho (con el dato vivo) o para después.
//   · marcar_paso_onboarding_tab → un paso de CONTEXTO del onboarding de una tab, o desmarcarlo.
//   · listar_ofertas, guardar_oferta, borrar_oferta → el catálogo de ofertas (lib/ofertas.ts).
//
// Lo que se fija acá, y por qué no se ve en ningún otro lado:
//   1. Las reglas puras de cierre y de marca (lib/onboarding-pasos-api.ts): un paso se cierra con el dato vivo, nunca
//      con la palabra del modelo; «ya está así» es `yaEstaba`; el orden de la tab se respeta.
//   2. El cierre del arranque va por SU puerta (`cerrarPasosOnboarding`) con los pasos de la capa leídos por quien llama,
//      y no toca la conversación de arranque (`onboarding.arranque`).
//   3. Desmarcar un paso de tab va por `desmarcarPasoEnTodasLasTabs` (el paso vive en DOS claves).
//   4. La lista de pasos de tab que la API marca existe en el catálogo, no trae ensayos ni conexiones, y cada uno tiene
//      su comprobación.
//   5. El saneo de una oferta es UNO (`sanearOfertaInput`): lo usan la pantalla y la API; lo que descarta, lo dice.
//   6. Una lectura no escribe: listar_ofertas no siembra la oferta del perfil, como sí hace el GET de la pantalla.
//
// PROBADO ROMPIÉNDOLO (23/10/2026, base 12 de 12 en verde, restaurado de memoria; los primeros doce, sobre esa base):
//   · `revisarCierreDePaso` sin la regla de `yaEstaba` para un paso ya hecho                       → 1 fallo, 11 pases
//   · `revisarCierreDePaso` que acepta un paso con `cumplido: false`                               → 1 fallo, 11 pases
//   · `revisarMarcaDePasoTab` sin `pasoBloqueadoPor`                                               → 1 fallo, 11 pases
//   · `vg_ensayo` agregado a PASOS_TAB_POR_API (lo cazan la regla y el catálogo)                   → 2 fallos, 10 pases
//   · el runner de cerrar_paso_onboarding sin la capa como 4.º argumento de cerrarPasosOnboarding   → 1 fallo, 11 pases
//   · el desmarcar con `marcarPasoTab(x.tab, x.paso, false)` en vez de desmarcarPasoEnTodasLasTabs  → 1 fallo, 11 pases
//   · `sanearOfertaInput` sin anotar la fecha descartada                                           → 1 fallo, 11 pases
//   · `ofertaConCambios` que no parte de la oferta actual (pisa lo que no vino)                    → 1 fallo, 11 pases
//   · la ruta de ofertas con el saneo inline otra vez (sin `sanearOfertaInput`)                    → 1 fallo, 11 pases
//   · listar_ofertas llamando a `seedOfertaDesdeBrief`                                             → 1 fallo, 11 pases
//   · PersonaView con `const MIN_FOTOS = 5` literal                                                → 1 fallo, 11 pases
//   · guardar_oferta con confirmación 'chat'                                                       → 1 fallo, 11 pases
//
// Y la revisión adversarial del mismo día (base 15 de 15):
//   · sin id, el nombre vuelve a ser la llave (edita la que se llama así)                         → 1 fallo, 14 pases
//   · `planDeOferta` sin «ya está así» (escribe lo mismo y contesta «actualizada»)               → 1 fallo, 14 pases
//   · un dato de la urgencia sin su tipo, aceptado (se descartaba en silencio)                   → 1 fallo, 14 pases
//   · se rechaza lo descartado de TODA la fila, no sólo lo del cambio                           → 1 fallo, 14 pases
//   · «ya está así» también sobre una fila rota que el saneo arregla                            → 1 fallo, 14 pases
//   · la ruta de la pantalla sin `ofertaDeLaPantalla` (vuelve a escribir el modelo)            → 1 fallo, 14 pases
//   · `vg_muletillas` de vuelta en PASOS_TAB_POR_API                                             → 2 fallos, 13 pases
//   · el enum de cerrar_paso_onboarding con un paso que no se comprueba (gemini)                 → 1 fallo, 14 pases
//   · listar_ofertas por HTTP                                                                   → 1 fallo, 14 pases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { estadoInicial, aplicarCambiosDePaso, type OnboardingState } from '../lib/onboarding-contrato';
import { PASOS_ARRANQUE_POR_API, PASOS_TAB_POR_API, revisarCierreDePaso, revisarMarcaDePasoTab, type HechoDePaso } from '../lib/onboarding-pasos-api';
import { PASOS_ONBOARDING, PASOS_POSTERGABLES } from '../lib/capas';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { sanearOfertaInput, ofertaConCambios, filaAOferta, cuerpoDeOferta, ofertaDeLaPantalla, planDeOferta, CAMPOS_OFERTA_EDITABLES } from '../lib/oferta-modelo';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { resolverRest } from '../lib/api-mako/rest';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de un runner: desde `  <id>: {` hasta el próximo runner de dos espacios. */
const runner = (src: string, id: string) => {
  const i = src.indexOf(`\n  ${id}: {`);
  assert.ok(i >= 0, `no encontré el runner ${id}`);
  const fin = src.slice(i + 1).search(/\n {2}[a-z_]+: \{/);
  return src.slice(i, fin < 0 ? undefined : i + 1 + fin);
};

const CAPA = ['negocio', 'productos', 'fase', 'tabs', 'integraciones'] as const;
const SI: HechoDePaso = { cumplido: true, que: 'hay 2 productos' };
const NO: HechoDePaso = { cumplido: false, falta: 'el catálogo no tiene ningún producto.' };
const conPasos = (hechos: Partial<Record<(typeof CAPA)[number], 'done' | 'post'>>): OnboardingState => {
  const s = estadoInicial('in_progress');
  for (const [p, v] of Object.entries(hechos)) s.steps[p as (typeof CAPA)[number]] = v === 'done' ? { done: true } : { done: false, postergado: true };
  return s;
};

test('cerrar un paso del arranque: dato vivo, su plan, postergar sólo lo de afuera, y «ya está así»', () => {
  const s = conPasos({});
  const r = (o: Partial<Parameters<typeof revisarCierreDePaso>[0]>) => revisarCierreDePaso({ estado: s, pasosCapa: [...CAPA], paso: 'productos', cierre: 'hecho', hecho: SI, ...o });

  const fuera = r({ paso: 'plan' });
  assert.ok('error' in fuera && /no es un paso del arranque de este plan/.test(fuera.error), 'un paso de otro plan se cerró');
  assert.ok('error' in r({ cierre: 'postergado', hecho: NO }) , 'se postergó un paso de contenido');
  const sinDato = r({ hecho: NO });
  assert.ok('error' in sinDato && /todavía no está hecho: el catálogo/.test(sinDato.error), 'se cerró un paso sin su dato');
  assert.ok('error' in r({ hecho: { sinDato: 'ya no es un paso del arranque.' } }), 'se cerró un paso sin dato comprobable');

  const ya = revisarCierreDePaso({ estado: conPasos({ productos: 'done' }), pasosCapa: [...CAPA], paso: 'productos', cierre: 'hecho', hecho: SI });
  assert.ok('error' in ya && ya.yaEstaba === true, 'un paso ya cerrado no dice «ya estaba»');
  const yaPost = revisarCierreDePaso({ estado: conPasos({ tabs: 'post' }), pasosCapa: [...CAPA], paso: 'tabs', cierre: 'postergado', hecho: NO });
  assert.ok('error' in yaPost && yaPost.yaEstaba === true, 'postergar lo postergado no dice «ya estaba»');
  const resuelto = revisarCierreDePaso({ estado: s, pasosCapa: [...CAPA], paso: 'tabs', cierre: 'postergado', hecho: { cumplido: true, que: 'el teléfono está verificado' } });
  assert.ok('error' in resuelto && /ciérralo como hecho/.test(resuelto.error), 'se postergó algo que ya estaba resuelto');

  const ok = revisarCierreDePaso({ estado: s, pasosCapa: [...CAPA], paso: 'tabs', cierre: 'postergado', hecho: NO });
  assert.ok('cambio' in ok && ok.cambio.postergar === true && !ok.cambio.done);
  assert.match(ok.resumen, /Perfil/, 'el resumen no dice dónde se resuelve lo postergado');
});

test('el resumen dice si con este paso termina el arranque, y coincide con la regla que escribe', () => {
  const casi = conPasos({ negocio: 'done', productos: 'done', fase: 'done', tabs: 'post' });
  const r = revisarCierreDePaso({ estado: casi, pasosCapa: [...CAPA], paso: 'integraciones', cierre: 'postergado', hecho: { cumplido: false, falta: 'falta conectar meta.' } });
  assert.ok('cambio' in r && r.terminaElArranque, 'no se dio cuenta de que era el último');
  assert.match(r.resumen, /el arranque termina/);
  // Lo que anuncia es lo que hace la puerta de verdad (`aplicarCambiosDePaso`, la de cerrarPasosOnboarding).
  const escrito = aplicarCambiosDePaso(structuredClone(casi), [r.cambio], [...CAPA], 'test', '2026-10-23T00:00:00Z');
  assert.equal(escrito.status, 'done');
  const falta = revisarCierreDePaso({ estado: conPasos({}), pasosCapa: [...CAPA], paso: 'negocio', cierre: 'hecho', hecho: SI });
  assert.ok('cambio' in falta && !falta.terminaElArranque && /Siguen faltando/.test(falta.resumen));
});

test('marcar un paso de tab: sólo los de contexto, del plan, en orden, con el dato, y «ya está así» en las dos direcciones', () => {
  const steps = {} as Record<string, { done?: boolean }>;
  const r = (o: Partial<Parameters<typeof revisarMarcaDePasoTab>[0]>) => revisarMarcaDePasoTab({ tab: 'ads-writer', paso: 'cg_entregable', hecho: true, steps, tabEnCapa: true, dato: SI, ...o });

  const ensayo = r({ tab: 'video-generator', paso: 'vg_ensayo' });
  assert.ok('error' in ensayo && /se cierra solo/.test(ensayo.error), 'un ensayo se marcó por la API');
  assert.ok('error' in r({ tab: 'video-generator', paso: 'vg_puente' }), 'una conexión se marcó por la API');
  assert.ok('error' in r({ tab: 'whatsapp', paso: 'wa_no_oficial' }), 'una tab sin pasos de contexto se marcó');
  assert.ok('error' in r({ tabEnCapa: false }), 'se marcó una tab que el plan no tiene');
  assert.ok('error' in r({ dato: NO }), 'se marcó un paso sin su dato');
  const orden = r({ paso: 'cg_avatares' });
  assert.ok('error' in orden && /Antes de «Tus avatares» falta «Tu lead magnet»/.test(orden.error), 'se salteó el orden de la tab');

  const yaHecho = r({ steps: { cg_entregable: { done: true } } });
  assert.ok('error' in yaHecho && yaHecho.yaEstaba === true);
  const yaSinHacer = r({ hecho: false });
  assert.ok('error' in yaSinHacer && yaSinHacer.yaEstaba === true);

  const todo = Object.fromEntries(TAB_ONBOARDINGS['ads-writer'].pasos.map((p) => [p.key, { done: true }]));
  const desmarcar = r({ hecho: false, steps: todo, dato: { sinDato: 'no hace falta' } });
  assert.ok('resumen' in desmarcar && /vuelve a abrir en su recorrido/.test(desmarcar.resumen), 'desmarcar no avisa que reabre la tab');
  const ultimo = r({ paso: 'cg_angulos', steps: { ...todo, cg_angulos: { done: false } } });
  assert.ok('resumen' in ultimo && /queda configurada/.test(ultimo.resumen));
});

test('la lista de pasos de tab de la API existe en el catálogo, no trae ensayos ni conexiones, y cada uno se comprueba', () => {
  const hechos = sinComentarios(leer('lib/onboarding-hechos.ts'));
  for (const [tab, pasos] of Object.entries(PASOS_TAB_POR_API)) {
    const def = TAB_ONBOARDINGS[tab];
    assert.ok(def, `la tab ${tab} no está en el catálogo`);
    for (const p of pasos) {
      assert.ok(def.pasos.some((x) => x.key === p), `${tab}/${p} no es un paso del catálogo`);
      assert.doesNotMatch(p, /_ensayo$|^vg_puente$|^vg_voz$|^wa_|^email_|^cal_|^am_|^reels_/, `${tab}/${p} lo cierra la tab sola`);
      assert.match(hechos, new RegExp(`case '${p}'`), `${p} no tiene su comprobación en lib/onboarding-hechos.ts`);
    }
  }
  // Un paso nuevo del arranque no compila sin su comprobación.
  assert.match(hechos, /satisfies Record<PasoOnboarding, \(\) => Promise<HechoDePaso>>/);
  // Y el mínimo de fotos es UNO para la pantalla y la API.
  assert.match(hechos, /MIN_FOTOS_PERSONA/);
  const vista = sinComentarios(leer('app/onboarding/PersonaView.tsx'));
  assert.match(vista, /from '@\/lib\/persona-reglas'/);
  assert.doesNotMatch(vista, /const MIN_FOTOS = \d/, 'PersonaView volvió a escribir su propio número');
});

test('el arranque se cierra por SU puerta con la capa del ws, y nada escribe la conversación de arranque', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  const cerrar = runner(run, 'cerrar_paso_onboarding');
  assert.match(cerrar, /await cerrarPasosOnboarding\(\[x\.r\.cambio\], [^,]+, undefined, x\.capa!\.onboarding\)/, 'cierra sin pasar la capa (getCapaActual va memoizado por request)');
  for (const id of ['cerrar_paso_onboarding', 'marcar_paso_onboarding_tab']) {
    const cuerpo = runner(run, id);
    assert.doesNotMatch(cuerpo, /setEstadoOnboarding|patchEstadoOnboarding|onboarding\.arranque|guardarEstadoArranque|setSetting\(/, `${id} escribe el estado a mano`);
  }
  // La capa se lee ESTRICTA (`capaDelWs` cae al default si no puede leer).
  assert.match(run, /async function capaEstricta[\s\S]{0,200}await getWorkspace\(ws\)/);
  const estado = sinComentarios(leer('lib/onboarding-state.ts'));
  assert.match(estado, /const pasos = pasosCapa \? \[\.\.\.pasosCapa\] : await pasosDeCapaActual\(\)/);
});

test('desmarcar un paso de tab va por la función que toca las dos claves, y en el Copy Generator corre el puente antes', () => {
  const cuerpo = runner(sinComentarios(leer('lib/api-mako/areas/negocio.run.ts')), 'marcar_paso_onboarding_tab');
  assert.match(cuerpo, /await desmarcarPasoEnTodasLasTabs\(x\.paso\)/);
  assert.doesNotMatch(cuerpo, /marcarPasoTab\([^)]*,\s*false\)/, 'desmarca en una sola tab: el registro compartido lo deja vivo en las otras');
  assert.ok(cuerpo.indexOf('puentearPasosCopyGen()') >= 0 && cuerpo.indexOf('puentearPasosCopyGen()') < cuerpo.indexOf('desmarcarPasoEnTodasLasTabs('), 'el puente de una vez corre DESPUÉS: la próxima carga volvería a marcar el paso');
});

test('el saneo de una oferta: nombre obligatorio, urgencia con su dato, fecha AAAA-MM-DD, y lo descartado se dice', () => {
  assert.equal(sanearOfertaInput({}).ok, false);
  const r = sanearOfertaInput({ nombre: ' Mentoría ', precio_usd: '5000 USD', urgencia_tipo: 'cupos', bonos: [{ nombre: 'Plantillas', valor_usd: 300 }, { nombre: '' }] });
  assert.ok(r.ok);
  assert.equal(r.input.nombre, 'Mentoría');
  assert.equal(r.input.precio_usd, 5000);
  assert.equal(r.input.urgencia_tipo, null, 'una urgencia sin dato quedó guardada');
  assert.deepEqual(r.input.bonos, [{ nombre: 'Plantillas', valor_usd: 300, porque: '' }]);
  assert.ok(r.descartado.some((d) => /urgencia_dato/.test(d)), 'no dice que descartó la urgencia');
  assert.ok(!('modelo' in r.input), 'sin modelo válido, el saneo lo escribe igual (borraría el de la ficha del lead)');
  const f = sanearOfertaInput({ nombre: 'X', urgencia_tipo: 'fecha', urgencia_dato: 'cierra pronto', urgencia_hasta: '12/11/2026', modelo: 'suscripcion' });
  assert.ok(f.ok && f.input.urgencia_hasta === null && f.input.modelo === 'suscripcion');
  assert.ok(f.ok && f.descartado.some((d) => /12\/11\/2026/.test(d)), 'no dice que descartó la fecha');
});

test('editar una parte de una oferta conserva el resto, y «ninguna» quita la urgencia', () => {
  const actual = filaAOferta({
    id: 7, nombre: 'Mentoría', precio_usd: 5000, modelo: 'unico', promesa: 'Escalar', garantia: '30 días',
    bonos: [{ nombre: 'Plantillas' }], urgencia_tipo: 'cupos', urgencia_dato: '6 lugares', activa: true, orden: 0,
  });
  const r = ofertaConCambios(actual, { precio_usd: 6000 });
  assert.ok(r.ok);
  assert.equal(r.input.precio_usd, 6000);
  assert.equal(r.input.promesa, 'Escalar', 'editar el precio borró la promesa');
  assert.equal(r.input.urgencia_dato, '6 lugares');
  assert.equal(r.input.modelo, 'unico');
  assert.equal(r.input.bonos?.length, 1);
  const sin = ofertaConCambios(actual, { urgencia_tipo: 'ninguna' });
  assert.ok(sin.ok && sin.input.urgencia_tipo === null && sin.input.urgencia_dato === null && sin.descartado.length === 0);
});

test('qué oferta toca un pedido de afuera: con id ésa, sin id siempre una nueva, y «ya está así»', () => {
  const vip = filaAOferta({ id: 7, nombre: 'Programa VIP', precio_usd: 2000, modelo: 'unico', promesa: 'Escalar', activa: true, orden: 0 });
  // Una fila vieja con la urgencia incompleta (un tipo sin su dato): la pantalla vieja podía dejarla así.
  const rota = filaAOferta({ id: 8, nombre: 'Taller', precio_usd: 300, urgencia_tipo: 'cupos', urgencia_dato: null, activa: true, orden: 1 });
  const ofertas = [vip, rota];
  const err = (p: ReturnType<typeof planDeOferta>) => ('error' in p ? p : null);
  // Sin id, SIEMPRE una nueva: un nombre que ya existe (corregido al revisar, o creado en el medio) contesta su id.
  const choca = err(planDeOferta(ofertas, { nombre: ' programa vip ', precio_usd: 500 }));
  assert.ok(choca && /#7/.test(choca.error) && /id 7/.test(choca.error), 'sin id, un nombre que ya existe editó esa oferta');
  const nueva = planDeOferta(ofertas, { nombre: 'Mentoría', precio_usd: 500 });
  assert.ok(!('error' in nueva) && nueva.actual === null && nueva.resultado.nombre === 'Mentoría');
  // Con id se renombra, salvo al nombre de otra.
  assert.match(err(planDeOferta(ofertas, { id: 7, nombre: 'taller' }))?.error ?? '', /#8/);
  const ren = planDeOferta(ofertas, { id: 7, nombre: 'Programa Élite' });
  assert.ok(!('error' in ren) && ren.actual?.id === 7 && ren.resultado.nombre === 'Programa Élite');
  // Igual a lo que hay → yaEstaba, no una escritura que contesta «actualizada».
  assert.ok(err(planDeOferta(ofertas, { id: 7, precio_usd: 2000, promesa: 'Escalar' }))?.yaEstaba, 'mismo precio y promesa: escribe igual');
  // Un dato de la urgencia sin su tipo se rechaza: el saneo lo descartaba sin decirlo.
  assert.match(err(planDeOferta(ofertas, { id: 7, urgencia_dato: '6 lugares' }))?.error ?? '', /urgencia_tipo/);
  // «ninguna» con datos al lado quita la urgencia, y sobre la fila rota es un cambio de verdad (no «ya está así»).
  const quita = planDeOferta(ofertas, { id: 8, urgencia_tipo: 'ninguna', urgencia_dato: 'x' });
  assert.ok(!('error' in quita) && quita.resultado.urgencia_tipo === null && quita.resultado.urgencia_dato === null);
  // Se rechaza sólo lo que descarta el CAMBIO: la urgencia vieja de la fila no frena un cambio de precio.
  const precio = planDeOferta(ofertas, { id: 8, precio_usd: 350 });
  assert.ok(!('error' in precio) && precio.resultado.precio_usd === 350, 'una fila vieja con la urgencia incompleta frenó un cambio de precio');
  assert.match(err(planDeOferta(ofertas, { id: 7, urgencia_tipo: 'fecha', urgencia_dato: 'cierra', urgencia_hasta: '12/11' }))?.error ?? '', /12\/11/);
  // Los campos que se cambian son los de la def.
  const d = porId('guardar_oferta');
  assert.ok(d && esAccion(d));
  assert.deepEqual(d.parametros.map((p) => p.nombre).filter((n) => n !== 'id').sort(), [...CAMPOS_OFERTA_EDITABLES].sort());
});

test('la pantalla de ofertas no escribe el modelo: manda la oferta entera con el de cuando cargó', () => {
  const o = { ...cuerpoDeOferta(filaAOferta({ id: 7, nombre: 'Mentoría', modelo: 'unico', activa: true, orden: 0 })), id: 7, promesa: 'Nueva' };
  const r = sanearOfertaInput(ofertaDeLaPantalla(o));
  assert.ok(r.ok && !('modelo' in r.input) && r.input.promesa === 'Nueva', 'la pantalla pisa el modelo que cambió la ficha del lead');
  assert.match(sinComentarios(leer('app/api/onboarding/ofertas/route.ts')), /sanearOfertaInput\(ofertaDeLaPantalla\(o\)\)/);
});

test('el arranque ofrece sólo los pasos que se comprueban, y las muletillas no se marcan desde afuera', () => {
  const d = porId('cerrar_paso_onboarding');
  assert.ok(d && esAccion(d));
  assert.deepEqual(d.parametros.find((p) => p.nombre === 'paso')?.enum, [...PASOS_ARRANQUE_POR_API]);
  for (const p of PASOS_POSTERGABLES) assert.ok((PASOS_ARRANQUE_POR_API as readonly string[]).includes(p), `${p} se posterga y no está en el enum`);
  const hechos = sinComentarios(leer('lib/onboarding-hechos.ts'));
  for (const p of PASOS_ONBOARDING) {
    const salio = new RegExp(`\\n\\s+${p}: async \\(\\) => SALIO_DEL_ARRANQUE,`).test(hechos);
    assert.equal(salio, !(PASOS_ARRANQUE_POR_API as readonly string[]).includes(p), `${p}: el enum y su comprobación no coinciden`);
  }
  assert.ok(!PASOS_TAB_POR_API['video-generator'].includes('vg_muletillas'), 'las muletillas no dejan un dato: marcarlas sería contestar por la persona');
});

test('la pantalla y la API guardan ofertas con el MISMO saneo y la misma regla de la principal', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/ofertas/route.ts'));
  const guardar = ruta.slice(ruta.indexOf("if (action === 'guardar')"), ruta.indexOf("if (action === 'borrar')"));
  assert.match(guardar, /sanearOfertaInput\(/);
  assert.match(guardar, /guardarOferta\(/);
  assert.doesNotMatch(guardar, /esUrgenciaTipo|parseBonos|marcarPrincipal/, 'la ruta volvió a sanear por su cuenta');
  const run = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  assert.match(run, /planDeOferta\(ofertas, input\)/);
  assert.match(sinComentarios(leer('lib/oferta-modelo.ts')), /const r = ofertaConCambios\(actual, cambios\)/);
  assert.match(runner(run, 'guardar_oferta'), /guardarOferta\(x\.resultado, x\.actual\?\.id\)/);
});

test('una lectura no escribe: listar_ofertas no siembra la oferta del perfil', () => {
  const cuerpo = runner(sinComentarios(leer('lib/api-mako/areas/negocio.run.ts')), 'listar_ofertas');
  assert.doesNotMatch(cuerpo, /seedOfertaDesdeBrief|guardarOferta|upsertOferta|marcarPrincipal|setSetting/);
});

test('las cinco operaciones: confirmación, gating, canales y su ruta REST', () => {
  const cerrar = porId('cerrar_paso_onboarding');
  assert.ok(cerrar && esAccion(cerrar) && cerrar.confirmacion === 'chat' && cerrar.gating?.rolMinimo === 'admin' && !cerrar.reversible);
  const tab = porId('marcar_paso_onboarding_tab');
  assert.ok(tab && esAccion(tab) && tab.confirmacion === 'chat' && tab.reversible && tab.gating?.rolMinimo === 'admin');
  for (const id of ['guardar_oferta', 'borrar_oferta']) {
    const d = porId(id);
    assert.ok(d && esAccion(d), `${id} no es una acción`);
    assert.equal(d.confirmacion, 'pantalla', `${id}: el precio es el ticket del lead, se confirma en pantalla`);
    assert.equal(d.gating?.rolMinimo, 'admin');
    assert.equal(d.gating?.tab, 'offer');
    assert.equal(d.parametros.find((p) => p.nombre === 'id')?.fijoAlRevisar, true, `${id}: la oferta se puede cambiar al revisar`);
  }
  const lista = porId('listar_ofertas');
  assert.ok(lista && lista.tipo === 'lectura' && lista.gating?.tab === 'offer');
  // Las ofertas no salen por HTTP, como las de Offer: `prueba` (casos, testimonios) puede traer nombres de personas.
  for (const id of ['listar_ofertas', 'guardar_oferta', 'borrar_oferta']) {
    assert.ok(!porId(id)?.canales.includes('http'), `${id} sale por HTTP sin que nadie lo haya decidido`);
  }
  for (const [metodo, ruta, id] of [
    ['PUT', '/negocio/onboarding/pasos/fase', 'cerrar_paso_onboarding'],
    ['PUT', '/negocio/onboarding/tabs/ads-writer/pasos/cg_avatares', 'marcar_paso_onboarding_tab'],
  ] as const) {
    const r = resolverRest(metodo, ruta.split('/'));
    assert.ok(r && 'operacion' in r && r.operacion === id, `${metodo} ${ruta} no llega a ${id}`);
  }
});

test('ninguna de las cinco escribe nada al proponer: toda escritura vive en ejecutar()', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  for (const id of ['cerrar_paso_onboarding', 'marcar_paso_onboarding_tab', 'guardar_oferta', 'borrar_oferta']) {
    const cuerpo = runner(run, id);
    const preparar = cuerpo.slice(0, cuerpo.indexOf('ejecutar:'));
    assert.doesNotMatch(preparar, /cerrarPasosOnboarding|marcarPasoTab|desmarcarPasoEnTodasLasTabs|puentearPasosCopyGen|guardarOferta|borrarOferta/, `${id} escribe al proponer`);
  }
});
