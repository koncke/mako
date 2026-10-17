// =============================================================================
// La pasarela de pagos en la API de MaKo: el área `cobros` (11/10/2026)
// =============================================================================
// Pedido de Martín: «implementes end-to-end la integración con Mercado Pago y con Stripe, tipo
// pasarela de pagos... Obvio revisa si hay que meterlo en diferentes lugares, como la API de
// MaKo, como automatios, como el CRM». El contrato: docs/diseno-pasarela-pagos.md §4.8.
//
// Lo que fija, y por qué cada cosa:
//   1. la FORMA de las seis operaciones: lo que mueve plata va en pantalla, `dinero` y sólo el
//      admin; el link se crea por chat con el precio del catálogo; ningún id `proponer_*`;
//   2. que el link NO pase por el modelo: ni las lecturas ni el resumen lo traen, sólo
//      `paraLaPersona` y `datos` (AGENTS.md, «un link que lee un modelo lo escribe el código»);
//   3. que el runner no hable con las pasarelas (eso es lib/cobros.ts, con `credDelCliente`);
//   4. que las frases REALES lleguen con su herramienta por el turno que CORRE
//      (clasificarIntencion + herramientasDelTurno, el molde de tests/agenda-whatsapp.test.ts):
//      el 11/10, antes de la regla, cinco de cinco llegaban SIN ninguna herramienta de cobros;
//   5. la receta que viaja con ellas, el `{{link_pago}}` del «{ }» y los `datos` de la pantalla
//      genérica en la escritura directa (lib/api-mako/flujo.ts).
//
// PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez, con todo en verde antes (15 pass) y
// restaurado después (15 pass). Pasan / fallan:
//   · reembolsar_cobro con costo 'externo' en vez de 'dinero'                      -> 14 / 1
//   · el `if (pedidoCobro)` de clasificarIntencion anulado                          -> 13 / 2
//   · AREAS_COBROS.link sin `crm` (no viaja listar_productos)                       -> 14 / 1
//   · AREAS_COBROS.link sin `cobros` (lo cubren las palabras; cae la de las puertas) -> 14 / 1
//   · RECETA_COBROS sin su `partes.push`                                            -> 14 / 1
//   · `vistaDe` con `link: linkDelCobro(c.token)`                                   -> 14 / 1
//   · valoresDelCobro(null) devolviendo {} (el token quedaría crudo)                -> 14 / 1
//   · flujo.ts sin `...(e.datos ? { datos: e.datos } : {})` en la pantalla genérica -> 14 / 1
//   · esCargaDePlan sin `if (esPedidoDeCobro(texto)) return false;`                 -> 14 / 1
//   · el router sin `|| esPedidoDeCobro(t)` («cargale…» se iba a `(plan)`)          -> 14 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { porArea, porId, visible, type Vista } from '../lib/api-mako/registro';
import { AREAS, AREA_INFO, esAccion, esLectura, type AccionDef } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';
import { tituloRecurso } from '../lib/api-mako/recursos';
import { rotuloDeParametro } from '../lib/editor-acciones';
import { clasificarIntencion, areasDelMensaje, esPedidoDeCobro } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { recetasDelTurno } from '../lib/doer-recetas';
import { rutearDoer } from '../lib/mako-router';
import { VARIABLES_AVISO, datosOfrecidos, fuentesQueNombra, resolverVariables } from '../lib/variables-aviso';
import { valoresDelCobro, SIN_LINK_DE_PAGO } from '../lib/variables-del-lead';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const IDS = ['listar_cobros', 'ver_cobro', 'crear_link_pago', 'anular_link_pago', 'reembolsar_cobro', 'cancelar_suscripcion'];
// ⚠️ Cambiado A PROPÓSITO el 14/10/2026: el área suma las nueve de Pagos campo por campo (docs/diseno-ficha-bloques.md
// §3), con su forma fijada en tests/api-mako-pagos-campo.test.ts.
const IDS_PAGOS_CAMPO = [
  'ver_moneda_negocio', 'cambiar_moneda_negocio', 'editar_dato_deal', 'editar_obligacion_deal', 'editar_venta_lead',
  'editar_cuota', 'crear_link_cuota', 'cortar_recordatorio_cuota', 'estado_suscripcion_manual', 'baja_del_cliente',
];
const accion = (id: string): AccionDef => {
  const d = porId(id);
  assert.ok(d && esAccion(d), `«${id}» no es una acción del registro`);
  return d;
};

// ── 1. La forma ───────────────────────────────────────────────────────────────

test('el área `cobros` existe, va antes de `mako` y tiene exactamente sus operaciones (las seis de la pasarela y las diez de Pagos)', () => {
  assert.ok(AREAS.indexOf('cobros') >= 0 && AREAS.indexOf('cobros') === AREAS.indexOf('mako') - 1, 'el orden de AREAS es el del catálogo');
  assert.deepEqual(AREA_INFO.cobros, { titulo: 'Cobros (Stripe y Mercado Pago)', tab: 'CRM', ruta: '/crm' });
  assert.deepEqual(porArea('cobros').map((d) => d.id).sort(), [...IDS, ...IDS_PAGOS_CAMPO].sort());
  for (const id of [...IDS, ...IDS_PAGOS_CAMPO]) assert.ok(!/^proponer_/.test(id), `«${id}»: con proponer_ viaja la receta que pide un «sí»`);
});

test('las lecturas: gratis, por TODOS los canales (http incluido) y con la tab del CRM', () => {
  for (const id of ['listar_cobros', 'ver_cobro']) {
    const d = porId(id)!;
    assert.ok(esLectura(d), id);
    assert.equal(d.costo, 'gratis', `${id} lee nuestra tabla, no la pasarela`);
    assert.deepEqual([...d.canales].sort(), ['app', 'http', 'whatsapp']);
    assert.deepEqual(d.gating, { tab: 'crm' });
  }
});

test('⚠️ LO QUE MUEVE PLATA: reembolsar y cancelar una suscripción son pantalla, `dinero`, admin e irreversibles', () => {
  for (const id of ['reembolsar_cobro', 'cancelar_suscripcion']) {
    const d = accion(id);
    assert.equal(d.confirmacion, 'pantalla', `${id} no se confirma por el chat`);
    assert.equal(d.pantalla, '/mako/revisar');
    assert.equal(d.costo, 'dinero', `${id}: con «dinero» un token detallado NUNCA escribe en el acto (rutas-http.ts)`);
    assert.deepEqual(d.gating, { tab: 'crm', rolMinimo: 'admin' });
    assert.equal(d.reversible, false);
    // Total, a propósito: la pantalla genérica no sigue un monto editado ni deja vaciar un campo.
    assert.ok(!d.parametros.some((p) => /monto/i.test(p.nombre)), `${id} no lleva monto: es total`);
  }
  // Y una persona que no es admin no los ve (en la app un closer no reembolsa).
  const miembro: Vista = { canal: 'app', alcance: 'ejecutar', ws: 9, rol: 'miembro', tabs: null };
  assert.equal(visible(porId('reembolsar_cobro')!, miembro), false);
  assert.equal(visible(porId('crear_link_pago')!, miembro), true, 'crear un link no es sólo del admin');
});

test('crear_link_pago: chat, `externo`, con el lead y un producto DEL CATÁLOGO (sin monto libre)', () => {
  const d = accion('crear_link_pago');
  assert.equal(d.confirmacion, 'chat');
  assert.equal(d.costo, 'externo', 'crear un link no mueve plata: un token detallado lo crea en el acto');
  assert.deepEqual(d.gating, { tab: 'crm' });
  const por = new Map(d.parametros.map((p) => [p.nombre, p]));
  assert.deepEqual([...por.keys()].sort(), ['leadId', 'pasarela', 'productoId']);
  assert.equal(por.get('leadId')?.obligatorio, true);
  assert.equal(por.get('productoId')?.obligatorio, true, 'el precio sale del catálogo');
  assert.deepEqual(por.get('pasarela')?.enum, ['stripe', 'mercadopago']);
  // productoId NO es el embudo: el lienzo rotula «Producto» al embudoId del CRM.
  assert.notEqual(rotuloDeParametro(por.get('productoId')!), rotuloDeParametro({ nombre: 'embudoId' }));
  assert.equal(accion('anular_link_pago').confirmacion, 'chat');
});

test('cada parámetro de una acción trae su rótulo, y el id de un cobro no se llama como el de una cuota', () => {
  for (const d of porArea('cobros')) {
    if (esAccion(d)) for (const p of d.parametros) assert.ok(p.rotulo?.trim(), `${d.id}.${p.nombre} sin rótulo`);
    assert.ok(!d.parametros.some((p) => p.nombre === 'pagoId'), `${d.id}: pagoId es el id de una CUOTA del CRM`);
  }
  assert.equal(rotuloDeParametro(accion('reembolsar_cobro').parametros.find((p) => p.nombre === 'cobroId')!), 'Cobro');
});

test('las rutas REST viven bajo /cobros y el recurso del link tiene nombre', () => {
  assert.deepEqual(rutaRestDe('listar_cobros'), { metodo: 'GET', ruta: '/cobros/cobros' });
  assert.deepEqual(rutaRestDe('crear_link_pago'), { metodo: 'POST', ruta: '/cobros/links-pago' });
  assert.deepEqual(rutaRestDe('reembolsar_cobro'), { metodo: 'POST', ruta: '/cobros/cobros/{cobroId}/reembolsos' });
  assert.equal(tituloRecurso('links-pago'), 'Links de pago');
});

// ── 2 y 3. El link no pasa por el modelo, y el runner no habla con las pasarelas ──────────────

test('⚠️ EL LINK NO PASA POR EL MODELO: las lecturas no lo traen y sólo viaja por paraLaPersona y datos', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/cobros.run.ts'));
  const vista = run.slice(run.indexOf('function vistaDe('), run.indexOf('async function conPasarelaConectada('));
  assert.ok(vista.length > 200 && vista.length < 3000, `el recorte de vistaDe mide ${vista.length}: mira otra cosa`);
  assert.doesNotMatch(vista, /token|url_proveedor|linkDelCobro|\blink\b|email/, 'la vista de un cobro deja ver el link o datos de quien paga');
  // Cada vez que el código arma un link, va a la persona (o a `datos`), nunca al resumen.
  for (const linea of run.split('\n').filter((l) => /linkDelCobro\(|r\.link/.test(l))) {
    assert.match(linea, /paraLaPersona|url: r\.link/, `un link fuera de paraLaPersona/datos: ${linea.trim()}`);
  }
  assert.doesNotMatch(run, /resumen:[^\n]*(r\.link|linkDelCobro)/);
});

test('el runner es server-only y no lee claves ni llama a Stripe o Mercado Pago (eso es lib/cobros.ts)', () => {
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  assert.match(run, /^import 'server-only';$/m);
  const codigo = sinComentarios(run);
  assert.doesNotMatch(codigo, /credDelCliente|credWs|envCred|process\.env|stripe-api|mercadopago-api|fetch\(/);
  assert.match(codigo, /from '@\/lib\/cobros'/);
  // ejecutar() nunca lanza: cada uno va envuelto. ⚠️ Cambiado a propósito el 14/10/2026: contaba exactamente 4
  // (las de la pasarela); ahora TODO `ejecutar:` del archivo tiene que ir envuelto, cuente lo que cuente.
  const ejecutores = codigo.match(/ejecutar: \([^)]*\) => /g) ?? [];
  assert.ok(ejecutores.length >= 12, `vi ${ejecutores.length} ejecutar(): el recorte no está mirando`);
  assert.equal((codigo.match(/ejecutar: \([^)]*\) => seguro\(/g) ?? []).length, ejecutores.length, 'un ejecutar() sin seguro() lanza y consume la pendiente');
});

// ── 4. Las frases reales llegan con su herramienta ────────────────────────────────────────────

/** Los NOMBRES de las herramientas de siempre (server-only): se los pide a un node aparte, como
 *  tests/agenda-whatsapp.test.ts. Una lista escrita a mano mediría otra cosa. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
// El doer de WhatsApp corre como admin del grupo, con alcance ejecutar.
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

function turno(mensaje: string, ctx: { hayPendientes?: boolean; makoPregunto?: boolean } = {}) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: !!ctx.hayPendientes });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}

const FRASES: Array<{ mensaje: string; espera: string[] }> = [
  // Las de Martín en el pedido de la API (11/10/2026), tal cual.
  { mensaje: 'mandale un link de pago a Ana', espera: ['crear_link_pago', 'listar_productos', 'buscar_leads'] },
  { mensaje: 'generá el link de pago de la mentoría para Juan', espera: ['crear_link_pago', 'listar_productos'] },
  { mensaje: 'reembolsale el pago a Carlos', espera: ['reembolsar_cobro', 'listar_cobros'] },
  { mensaje: 'cancelá la suscripción de Pedro', espera: ['cancelar_suscripcion', 'listar_cobros'] },
  { mensaje: 'creá un checkout de Mercado Pago para Laura', espera: ['crear_link_pago', 'listar_productos'] },
  // Y las formas de al lado: tuteo, con saludo, con modal, anular.
  { mensaje: 'hola mako, manda el link de pago a Sofía', espera: ['crear_link_pago'] },
  { mensaje: '¿me puedes generar un link de pago para Ana?', espera: ['crear_link_pago'] },
  { mensaje: 'anulá el link de pago pendiente de Ana', espera: ['anular_link_pago', 'listar_cobros'] },
];

test('⚠️ cada pedido de cobro llega como acción y con su herramienta, por el turno que CORRE', () => {
  for (const { mensaje, espera } of FRASES) {
    const r = turno(mensaje);
    assert.equal(r.veredicto.intencion, 'actuar', `«${mensaje}» no es una acción: ${r.veredicto.porque}`);
    for (const id of espera) {
      assert.ok(r.nombres.includes(id), `«${mensaje}» → ${r.veredicto.porque}: no trae ${id} (llegaron ${r.nombres.length}: ${r.nombres.slice(0, 12).join(', ')}…)`);
    }
  }
});

test('lo que NO es un pedido de cobro sigue siendo lo que era', () => {
  // El CRM no pierde su área ni gana la de cobros.
  assert.ok(areasDelMensaje('mové a Ana a la etapa de agendados').includes('crm'));
  assert.ok(!areasDelMensaje('mové a Ana a la etapa de agendados').includes('cobros'));
  assert.equal(esPedidoDeCobro('mové a Ana a la etapa de agendados'), null);
  assert.equal(clasificarIntencion('mové a Ana a la etapa de agendados').areas?.includes('crm'), true);
  // «los pagos de Ana» son sus CUOTAS: no suman el área de cobros.
  assert.ok(!areasDelMensaje('¿cuánto le falta pagar a Ana de sus pagos?').includes('cobros'));
  // Una pregunta se contesta y la acción se OFRECE: no viaja la que escribe.
  const q = turno('¿cuántos links de pago mandé este mes?');
  assert.notEqual(q.veredicto.intencion, 'actuar');
  assert.ok(!q.nombres.includes('crear_link_pago'), 'en una pregunta viajó la que crea el link');
  // Un volcado y lo del plan siguen siendo material.
  assert.equal(esPedidoDeCobro('Idea: links de pago automáticos para todos'), null);
  assert.equal(esPedidoDeCobro('anotá en el plan: mandarle el link de pago a Ana'), null);
  // La tercera persona no es un pedido.
  assert.equal(esPedidoDeCobro('Stripe genera el link de pago solo'), null);
});

test('las TRES puertas dicen lo mismo: con una pendiente abierta no es un «no», y el router no lo manda al plan', () => {
  // «cancelá» es una palabra de CONFIRMACION: con una pendiente se leía como cancelarla.
  assert.equal(clasificarIntencion('cancelá la suscripción de Pedro', { hayPendientes: true }).intencion, 'actuar');
  assert.equal(clasificarIntencion('sí, mandale el link de pago a Ana', { makoPregunto: true }).areas?.includes('cobros'), true);
  // «cargale…» nombra «carg…», que el router lee como cargar tareas al plan.
  assert.notEqual(rutearDoer('cargale el link de pago a Ana').motivo, 'router:sonnet (plan)');
  // `esCargaDePlan` vive en un módulo con `server-only`: se fija que pregunte por el cobro ANTES de «anot…».
  const src = sinComentarios(leer('lib/mako-doer-in.ts'));
  const cuerpo = src.slice(src.indexOf('function esCargaDePlan('), src.indexOf('function esCargaDePlan(') + 900);
  const pregunta = cuerpo.indexOf('if (esPedidoDeCobro(texto)) return false;');
  assert.ok(pregunta > 0 && pregunta < cuerpo.indexOf('anot[aá]'), 'esCargaDePlan no mira el cobro antes de leer una carga del plan');
});

// ── 5. La receta, el «{ }» y la escritura directa ─────────────────────────────────────────────

test('la receta de cobros viaja con SUS herramientas y no pide un «sí» para lo de pantalla', () => {
  const r = recetasDelTurno(new Set(['reembolsar_cobro', 'listar_cobros']), false);
  assert.match(r, /NUNCA se confirma por el chat/);
  assert.match(r, /NO lo copies/);
  assert.doesNotMatch(r, /CUANDO TE PIDEN ACCIONES/, 'la receta genérica pide un «sí»');
  assert.match(recetasDelTurno(new Set(['crear_link_pago']), false), /LOS COBROS/);
  assert.doesNotMatch(recetasDelTurno(new Set(['listar_cobros', 'buscar_leads']), true), /LOS COBROS/, 'en una pregunta no viaja');
});

test('{{link_pago}}: en Pagos, para un lead, de la tabla y SIN quedar crudo cuando no hay cobro pendiente', () => {
  const v = VARIABLES_AVISO.find((x) => x.key === 'link_pago');
  assert.ok(v, 'falta {{link_pago}} en el catálogo');
  assert.equal(v.grupo, 'pagos');
  assert.equal(v.alcance, 'lead');
  assert.equal(v.fuente, 'cobro');
  const claves = (o: Parameters<typeof datosOfrecidos>[0]) => datosOfrecidos(o).flatMap((g) => g.items.map((i) => i.key));
  assert.ok(claves({ destino: 'lead', conLead: true }).includes('link_pago'), 'al lead');
  assert.ok(claves({ destino: 'equipo', conLead: true }).includes('link_pago'), 'al equipo');
  assert.ok(!claves({ destino: 'lead', conLead: false }).includes('link_pago'), 'sin lead no hay de quién');
  assert.deepEqual([...fuentesQueNombra('Paga aquí: {{link_pago}}')], ['cobro']);
  // Con cobro, el link; sin cobro, el hecho — nunca el token crudo.
  assert.deepEqual(valoresDelCobro('https://hola-mako.com/pagar/abc'), { link_pago: 'https://hola-mako.com/pagar/abc' });
  assert.equal(resolverVariables('Paga aquí: {{link_pago}}', valoresDelCobro(null)), `Paga aquí: ${SIN_LINK_DE_PAGO}`);
  assert.equal(resolverVariables('{{link_pago}}', valoresDelCobro('  ')), SIN_LINK_DE_PAGO);
  // El resolvedor lo lee SÓLO si el texto lo nombra, de la tabla, y sin tocar una pasarela.
  const res = sinComentarios(leer('lib/variables-resolver.ts'));
  const rama = res.slice(res.indexOf("f.has('cobro')"), res.indexOf("f.has('perfil')"));
  assert.match(rama, /cobroPendienteDelLead\(ctx\.ws, ctx\.leadId!\)/);
  assert.match(rama, /valoresDelCobro\(c \? linkDelCobro\(c\.token\) : null\)/);
  assert.doesNotMatch(res, /urlParaPagar|stripe-api|mercadopago-api/, 'el resolvedor salió a una pasarela');
});

test('la escritura directa de una acción de pantalla genérica devuelve sus `datos` (flujo.ts)', () => {
  // Sin esto, un token detallado que escribía en el acto una acción de pantalla recibía 200 sin el
  // id de lo que creó (la rama de la pendiente ya los pasaba). tests/flujo-acciones.test.ts lee la
  // llamada textual `aplicarPropuestaGenerica(id, null, ctx)`: sigue igual.
  const flujo = sinComentarios(leer('lib/api-mako/flujo.ts'));
  assert.match(flujo, /const e = await aplicarPropuestaGenerica\(id, null, ctx\);\s*return \{ ok: e\.ok, resumen: e\.resumen, via: 'propuesta', \.\.\.\(e\.datos \? \{ datos: e\.datos \} : \{\}\) \};/);
});

test('la bitácora de la API tiene el pedido textual', () => {
  const b = leer('app/admin/dev/api-mako/bitacora.ts');
  assert.match(b, /tipo: 'prompt',\s*titulo: 'Cobrar con Stripe y Mercado Pago, también desde la API',\s*pedido: 'Esta tab se llama "Integraciones"\. Quiero que implementes end-to-end/);
});
