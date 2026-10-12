// =============================================================================
// CREAR CON IA: el CRON y las condiciones salen de lo MISMO que la pantalla (duodécima tanda, 12/10/2026)
// =============================================================================
// docs/diseno-duodecima-tanda.md §1.1, §1.3, §1.4, §2.2, §2.3 y §3.1. Lo que fija:
//   1. `opcionesCronIA` (lib/disparadores.ts) ofrece a la IA lo del desplegable del CRON: los kanbans y «Se le puso»
//      con `seccionesDisparo`, «Etiqueta» (se agrega / se elimina), y los eventos de Instagram, Messenger, Email y Pagos
//      SÓLO si el canal está conectado y SIN los apagados. Ni el Recurrente ni `manual`. Con los valores EXACTOS de §3.1.
//   2. `disparadorDeValorIA` convierte cada valor en el CRON que guarda la pantalla, y lo que pasa la misma validación
//      (`sanearDisparadores` + `problemaDeDisparadores`, la de `guardarDisparadores`); lo que no entiende → [].
//   3. lib/flujo-ia-crear.ts guarda con `guardarDisparadores` (no `setTriggerSecuencia`) y la cascada va sin el modelo
//      de respaldo (`sinRespaldoDeModelo`: el flash-lite escribió #243 y #245 de ws10).
//   4. `catalogosDe` es UNA función (lib/condiciones-catalogos.ts) que importan el editor y `armarContexto`.
//
// PROBADO ROMPIÉNDOLO (12/10/2026; arnés scratchpad/wf-duodecima/ia-contexto-chat/romper.mjs, que rompe en un ESPEJO
// del worktree y restaura en un `finally`). Base: 8 pass / 0 fail. Una rotura por vez:
//   1. `opcionesCronIA` sin mirar `conectados` (todos los canales siempre)     → 6 / 2 (los kanbans + «sólo si conectado»).
//   2. sin filtrar los apagados (`eventosParaIA` = `eventosOfrecidos` tal cual) → 5 / 3 (apagados, valores, cada clase).
//   3. el valor de Email con `email:` en vez de `email_recibido:`               → 5 / 3 (apagados, valores, cada clase).
//   4. una etapa de venta sin embudo se acepta («venta::agendado»)              → 7 / 1 (lo que no entiende).
//   5. `ponerDisparador` vuelve a `setTriggerSecuencia`                         → 7 / 1 (la puerta de la pantalla).
//   6. `pasada` sin `sinRespaldoDeModelo: true`                                 → 7 / 1 (la puerta de la pantalla).
//   7. EditorCondicion vuelve a tener su copia de `catalogosDe`                 → 7 / 1 (UNA función).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  opcionesCronIA, disparadorDeValorIA, eventosParaIA, sanearDisparadores, problemaDeDisparadores, columnasDeDisparador,
  EVENTOS_INSTAGRAM, EVENTOS_MESSENGER, EVENTOS_EMAIL, EVENTOS_PAGO, TEXTO_ETIQUETA_AGREGADA, TEXTO_ETIQUETA_QUITADA,
  type CanalesConectadosIA, type EntradaCronIA,
} from '../lib/disparadores';
import { seccionesDisparo } from '../lib/flujo-conversacion';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Un bloque del fuente, desde `desde` hasta `hasta` (excluido). */
const bloque = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encuentro «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encuentro «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
};

const NINGUNO: CanalesConectadosIA = { instagram: false, messenger: false, email: false, pagos: false };
const TODOS: CanalesConectadosIA = { instagram: true, messenger: true, email: true, pagos: true };
const PRODUCTOS: EntradaCronIA['productos'] = [
  { funnelId: 5, productoId: 39, nombre: 'Fiesta Music', etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }, { value: 'activo', label: 'Activo' }] },
  { funnelId: 6, productoId: 10, nombre: 'Service Delivery & Ops', etapas: [{ value: 'nuevo', label: 'Nuevo' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] },
];
const ETIQUETAS: EntradaCronIA['etiquetas'] = [{ id: 7, nombre: 'Cualificado' }, { id: 8, nombre: 'Vieja', archivada_at: '2026-01-01T00:00:00Z' }];
const entrada = (conectados: CanalesConectadosIA): EntradaCronIA => ({ productos: PRODUCTOS, etiquetas: ETIQUETAS, conectados });
const valores = (secs: ReadonlyArray<{ options: ReadonlyArray<{ value: string }> }>) => secs.flatMap((s) => s.options.map((o) => o.value));
const seccion = (secs: ReadonlyArray<{ title: string; options: ReadonlyArray<{ value: string; label: string }> }>, title: string) => secs.find((s) => s.title === title);

test('1: los kanbans y «Se le puso» son EXACTAMENTE los de `seccionesDisparo`, y después «Etiqueta»', () => {
  const secs = opcionesCronIA(entrada(NINGUNO));
  const deSiempre = seccionesDisparo({ disparadores: [], productos: PRODUCTOS, etiquetas: ETIQUETAS, actual: { trigger_tipo: 'manual' }, textoActual: '' });
  assert.ok(deSiempre.length >= 5, 'el caso trae dos productos con sus dos kanbans y las etiquetas');
  assert.deepEqual(secs.slice(0, deSiempre.length), deSiempre);
  assert.deepEqual(secs.slice(deSiempre.length), [{
    title: 'Etiqueta',
    options: [{ value: 'etiqueta_agregada', label: TEXTO_ETIQUETA_AGREGADA }, { value: 'etiqueta_quitada', label: TEXTO_ETIQUETA_QUITADA }],
  }], 'sin canales conectados no hay nada más');
  // Ni el Recurrente (pide horario) ni `manual` (no inscribe a nadie).
  const todos = valores(opcionesCronIA(entrada(TODOS)));
  assert.ok(!todos.some((v) => v.startsWith('trigger:') || v === 'manual' || v === 'grupo_mako' || v.includes('grupo')), todos.join(' '));
  assert.ok(!opcionesCronIA(entrada(TODOS)).some((s) => s.title === 'Recurrente'));
});

test('1: Instagram, Messenger, Email y Pagos entran SÓLO si su canal está conectado', () => {
  for (const canal of ['instagram', 'messenger', 'email', 'pagos'] as const) {
    const titulo = { instagram: 'Instagram', messenger: 'Messenger', email: 'Email', pagos: 'Pagos' }[canal];
    const solo = opcionesCronIA(entrada({ ...NINGUNO, [canal]: true }));
    assert.ok(seccion(solo, titulo), `${canal} conectado y no aparece`);
    for (const otro of ['Instagram', 'Messenger', 'Email', 'Pagos'].filter((t) => t !== titulo)) {
      assert.equal(seccion(solo, otro), undefined, `con sólo ${canal} conectado aparece ${otro}`);
    }
    assert.equal(seccion(opcionesCronIA(entrada({ ...TODOS, [canal]: false })), titulo), undefined, `${canal} sin conectar y aparece`);
  }
});

test('1: ningún evento «apagado», y están TODOS los que no lo están', () => {
  const secs = opcionesCronIA(entrada(TODOS));
  const tablas = [
    ['Instagram', 'instagram', EVENTOS_INSTAGRAM], ['Messenger', 'messenger', EVENTOS_MESSENGER],
    ['Email', 'email_recibido', EVENTOS_EMAIL], ['Pagos', 'pago', EVENTOS_PAGO],
  ] as const;
  for (const [titulo, prefijo, tabla] of tablas) {
    const ofrecidos = seccion(secs, titulo)!.options;
    for (const ev of tabla) {
      const esta = ofrecidos.some((o) => o.value === `${prefijo}:${ev.subtipo}`);
      assert.equal(esta, !ev.apagado, `${titulo} · ${ev.subtipo}: ${ev.apagado ? 'apagado y se ofrece' : 'no se ofrece'}`);
    }
    // El rótulo es el del selector del CRON.
    for (const o of ofrecidos) assert.equal(o.label, tabla.find((ev) => `${prefijo}:${ev.subtipo}` === o.value)!.label);
  }
  // Y la misma lista con que se valida al guardar (`eventosParaIA`), sin apagados.
  for (const c of ['instagram', 'messenger', 'email', 'pagos'] as const) assert.ok(eventosParaIA(c).every((e) => !e.apagado));
});

test('1: los valores EXACTOS de §3.1', () => {
  const secs = opcionesCronIA(entrada(TODOS));
  assert.deepEqual(valores([seccion(secs, 'Instagram')!]), ['instagram:comentario', 'instagram:historia', 'instagram:dm', 'instagram:en_vivo', 'instagram:ref']);
  assert.deepEqual(valores([seccion(secs, 'Messenger')!]), ['messenger:comentario', 'messenger:dm', 'messenger:ref', 'messenger:qr']);
  assert.deepEqual(valores([seccion(secs, 'Email')!]), ['email_recibido:recibido']);
  assert.deepEqual(valores([seccion(secs, 'Pagos')!]), ['pago:aprobado', 'pago:rechazado', 'pago:reembolsado', 'pago:suscripcion_cancelada']);
  assert.deepEqual(valores([seccion(secs, 'Etiqueta')!]), ['etiqueta_agregada', 'etiqueta_quitada']);
  // El orden de las secciones nuevas es el de la primera pantalla del CRON.
  assert.deepEqual(secs.map((s) => s.title).slice(-5), ['Etiqueta', 'Instagram', 'Messenger', 'Email', 'Pagos']);
});

test('2: `disparadorDeValorIA` para cada clase, y todo lo ofrecido pasa la validación de la pantalla', () => {
  const uno = (v: string) => {
    const r = disparadorDeValorIA(v);
    assert.equal(r.length, 1, `«${v}» no dio un CRON`);
    return r[0];
  };
  assert.deepEqual(uno('venta:5:agendado'), { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', etapas: null, funnel_id: 5 });
  assert.deepEqual(uno('venta:5:nuevo,agendado'), { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'nuevo', etapas: ['nuevo', 'agendado'], funnel_id: 5 });
  assert.deepEqual(uno('entrega:39:onboarding'), { id: 'd1', trigger_tipo: 'entrega_actual', etapa: 'onboarding', etapas: null, producto_id: 39 });
  assert.deepEqual(uno('etiqueta:7'), { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 7 });
  assert.deepEqual(uno('etiqueta_agregada'), { id: 'd1', trigger_tipo: 'etiqueta_agregada', ignorar: [] });
  assert.deepEqual(uno('etiqueta_quitada'), { id: 'd1', trigger_tipo: 'etiqueta_quitada', ignorar: [] });
  assert.deepEqual(uno('instagram:dm'), { id: 'd1', trigger_tipo: 'instagram', subtipo: 'dm' });
  assert.deepEqual(uno('messenger:qr'), { id: 'd1', trigger_tipo: 'messenger', subtipo: 'qr' });
  assert.deepEqual(uno('email_recibido:recibido'), { id: 'd1', trigger_tipo: 'email_recibido', subtipo: 'recibido' });
  assert.deepEqual(uno('pago:aprobado'), { id: 'd1', trigger_tipo: 'pago', subtipo: 'aprobado' });
  assert.equal(disparadorDeValorIA('instagram:comentario', 'd3')[0].id, 'd3');

  // TODO lo que ve el modelo se puede guardar: la misma validación que `guardarDisparadores` (`listaValida`), y el
  // PRIMERO escribe su clase en las columnas (lo que lee el 409 de la ruta de IA).
  const ofrecidos = valores(opcionesCronIA(entrada(TODOS)));
  assert.equal(ofrecidos.length, 23, 'seis etapas, una etiqueta, dos genéricas y 14 eventos');
  for (const v of ofrecidos) {
    const r = disparadorDeValorIA(v);
    assert.equal(r.length, 1, `«${v}» se ofrece y no se entiende`);
    assert.equal(sanearDisparadores(r).length, 1, `«${v}» no sobrevive al saneo`);
    assert.equal(problemaDeDisparadores(sanearDisparadores(r)), null, `«${v}» la pantalla no lo guardaría`);
    assert.equal(columnasDeDisparador(r[0]).trigger_tipo, r[0].trigger_tipo);
  }
});

test('2: lo que no entiende (o la pantalla no guardaría) → []', () => {
  for (const v of [
    '', 'x', 'manual', 'trigger:manual', 'trigger:agendo', 'grupo_mako', 'aviso_mako:pago_recibido',
    'instagram:anuncio', 'messenger:anuncio', 'messenger:tienda', 'instagram:xyz', 'instagram:', 'pago:', 'pago:cuota',
    'email:recibido', 'email_recibido:otro', 'etiqueta:agregada', 'etiqueta:0', 'etiqueta:x',
    'venta::agendado', 'venta:abc:nuevo', 'venta:5:', 'entrega:0:onboarding', 'entrega::onboarding', 'entrega:39:',
  ]) {
    assert.deepEqual(disparadorDeValorIA(v), [], `«${v}» debía ser []`);
  }
});

test('3: lib/flujo-ia-crear.ts guarda por la puerta de la pantalla, ve los canales y va sin el modelo de respaldo', () => {
  const src = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  const poner = bloque(src, 'ponerDisparador: async (id, valor) => {', 'motivoDeDisparador:');
  assert.match(poner, /const lista = disparadorDeValorIA\(valor\);/);
  assert.match(poner, /if \(!lista\.length\) throw new TriggerInvalidoError\('no se entiende'\);/);
  assert.match(poner, /await guardarDisparadores\(id, lista\);/);
  assert.doesNotMatch(src, /setTriggerSecuencia/, 'volvió la puerta vieja: la lista de la 0241 queda en NULL');
  // El contexto: el CRON de `opcionesCronIA` con los canales de `estadoCanalesDisparo`, y el catálogo del editor.
  const ctx = bloque(src, 'export async function armarContexto(', '\nexport async function crearNuevas(');
  assert.match(ctx, /disparadoresParaIA\(opcionesCronIA\(\{/);
  assert.match(src, /estadoCanalesDisparo\(\),/);
  assert.match(ctx, /catalogosRemotos\(\)\.catch\(/);
  assert.match(ctx, /const catalogoCondicion = catalogosDe\(\{ etapas: etapasDeCondicion\(prods\), productos: prods, remotos \}\);/);
  assert.match(ctx, /\n\s*catalogoCondicion,\n/);
  // Sin flash-lite: en la pasada y en la reparación del JSON.
  const pasada = bloque(src, 'async function pasada<', '\nasync function proveedores(');
  assert.match(pasada, /chatCheapCascade\(\{[\s\S]*?sinRespaldoDeModelo: true,[\s\S]*?\}\)/);
  const generar = bloque(src, 'export async function generar<', '\nfunction depsReales(');
  assert.equal((generar.match(/sinRespaldoDeModelo: true,/g) ?? []).length, 1, 'la reparación del JSON también va sin respaldo');
  // El motivo: el de crear por defecto, y el que pase editar.
  assert.match(generar, /motivo\?: string;/);
  assert.match(generar, /const motivo = p\.motivo\?\.trim\(\) \|\| 'Crear una automatización con IA';/);
});

test('4: `catalogosDe` es UNA función, la importan el editor y `armarContexto`; la lectura remota también es una', () => {
  // Una sola definición en todo app/ y lib/.
  const definiciones: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${n}`;
      if (n === 'node_modules' || n.startsWith('.')) continue;
      if (statSync(join(RAIZ, rel)).isDirectory()) recorrer(rel);
      else if (/\.(ts|tsx)$/.test(n)) {
        const crudo = readFileSync(join(RAIZ, rel), 'utf8');
        if (crudo.includes('function catalogosDe(') && /function catalogosDe\(/.test(sinComentarios(crudo))) definiciones.push(rel);
      }
    }
  };
  recorrer('app');
  recorrer('lib');
  assert.deepEqual(definiciones, ['lib/condiciones-catalogos.ts']);
  const editor = sinComentarios(leer('app/automations/EditorCondicion.tsx'));
  assert.match(editor, /import \{ catalogosDe, [^}]*\} from '@\/lib\/condiciones-catalogos';/);
  assert.match(editor, /export \{ catalogosDe, type CatalogosRemotos \};/, 'el lienzo y «Probar» la importan del editor');
  assert.match(editor, /const cat = catalogosDe\(\{ etapas, productos, remotos \}\);/);
  const crear = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  assert.match(crear, /import \{ catalogosDe, etapasDeCondicion \} from '@\/lib\/condiciones-catalogos';/);
  assert.match(crear, /import \{ catalogosRemotos \} from '@\/lib\/condiciones-catalogo-datos';/);
  const ruta = sinComentarios(leer('app/api/chat-agent/condiciones/route.ts'));
  assert.match(ruta, /const \{ cursos, posts, campanas, reuniones \} = await catalogosRemotos\(\);/);
  assert.doesNotMatch(ruta, /from\('|leerTodo\(/, 'la ruta volvió a leer por su cuenta');

  // Lo que arma: las etapas como las pasa el lienzo, y el catálogo como lo arma el editor.
  const etapas = etapasDeCondicion([...PRODUCTOS, { funnelId: null, nombre: 'Sin embudo', etapas: [] }]);
  assert.deepEqual(etapas.map((e) => [e.title, e.funnelId, e.options.length]), [['Fiesta Music', 5, 2], ['Service Delivery & Ops', 6, 1]]);
  assert.deepEqual(etapasDeCondicion([PRODUCTOS[0]]).map((e) => e.title), ['Etapas'], 'con un solo producto, «Etapas»');
  assert.equal(catalogosDe({ etapas, productos: PRODUCTOS, remotos: null }).reuniones, undefined, 'sin lo remoto, como el editor: el selector apagado');
  const remotos = { cursos: [], posts: [{ id: 1, titulo: 'Hola' }], campanas: ['C1'], reuniones: undefined };
  const cat = catalogosDe({ etapas, productos: PRODUCTOS, remotos });
  assert.deepEqual([cat.posts, cat.campanas, cat.reuniones], [[{ id: 1, titulo: 'Hola' }], ['C1'], null]);
});
