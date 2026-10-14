import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filaAOferta, esModeloOferta, validarOfertaNueva } from '../lib/oferta-modelo';
import { DEFS } from '../lib/api-mako/areas/crm.def';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { entradaDelLink, idDeParametro } from '../app/offer/arbol';

/**
 * La OFERTA de un lead en su tab Pagos (Martín, 13/10/2026, Pagos punto 1): un desplegable para
 * asignarla, «Nueva oferta» arriba con nombre, modelo y ticket, y «Analizar oferta» que lleva a Offer.
 *
 * Verificado rompiéndolo (base 5/0): asignar sin buscar la oferta en las del workspace, 1 fallo;
 * crear sin el candado de admin, 1 fallo; «Nueva oferta» al final del desplegable, 1 fallo; la ruta
 * sin el desplegable, 1 fallo; `filaAOferta` sin leer el modelo, 1 fallo. Y con el link a Offer
 * (base 7/0): el funnel del link sin desempatar, 1 fallo; la página sin leer el link, 1 fallo; el
 * «Analizar» sin el candado del rol, 1 fallo. Y la API de MaKo (base 8/0, 14/10): sin la ruta REST de
 * asignar, 1 fallo; el ejecutar de editar_contacto_lead con la lista vieja, 1 fallo; crear sin
 * validar, 1 fallo; editar_contacto_lead sin «sexo», 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const ACC = sinComentarios(leer('../app/crm/oferta-lead-actions.ts'));
const UI = sinComentarios(leer('../app/crm/lead-view/OfertaDelLead.tsx'));
const cuerpo = (src: string, firma: string) => { const i = src.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); const f = src.indexOf('\nexport ', i + 10); return src.slice(i, f < 0 ? undefined : f); };

test('asignar busca la oferta entre las del workspace: la FK sólo mira que exista', () => {
  const LIB = sinComentarios(leer('../lib/oferta-lead.ts'));
  const fn = cuerpo(LIB, 'export async function asignarOfertaAlLead');
  assert.match(fn, /const o = \(await listarOfertas\(\)\)\.find\(\(x\) => x\.id === ofertaId\);\s*if \(!o\) return \{ ok: false, error: 'Esa oferta no existe\.' \};/);
  assert.match(cuerpo(ACC, 'export async function asignarOfertaLeadAction'), /await asignarOfertaAlLead\(leadId, ofertaId, await autor\(\)\)/, 'la ficha usa la misma que la API');
});

test('crear es del admin, valida lo mínimo y la liga al CRM del lead', () => {
  assert.match(cuerpo(ACC, 'export async function crearOfertaDesdeLeadAction'), /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return/);
  const LIB = sinComentarios(leer('../lib/oferta-lead.ts'));
  const fn = cuerpo(LIB, 'export async function crearOfertaParaLead');
  assert.match(fn, /const v = validarOfertaNueva\(datos\);\s*if \(!v\.ok\) return v;/);
  assert.match(fn, /await ligarOfertaAFunnel\(funnelId, id, false\)/, 'sin ligarla al CRM no aparece en Offer');
  assert.deepEqual(validarOfertaNueva({ nombre: '  Mentoría   VIP ', modelo: 'suscripcion', ticket: '97' }), { ok: true, nombre: 'Mentoría VIP', modelo: 'suscripcion', ticket: 97 });
  assert.equal(validarOfertaNueva({ nombre: 'X', modelo: 'cuotas', ticket: null }).ok, false);
  assert.equal(validarOfertaNueva({ nombre: '', modelo: 'unico', ticket: null }).ok, false);
  assert.equal(validarOfertaNueva({ nombre: 'X', modelo: 'unico', ticket: -5 }).ok, false);
});

test('la API de MaKo puede leer, asignar y crear la oferta, y editar los datos nuevos del contacto', () => {
  const op = (id: string) => DEFS.find((d) => d.id === id);
  for (const id of ['oferta_del_lead', 'asignar_oferta_lead', 'crear_oferta_lead']) {
    assert.ok(op(id), `${id} no está en el registro`);
    assert.ok(op(id)!.canales.includes('http'), `${id} no sale por HTTP: Claude de afuera no lo vería`);
    assert.ok(RUTAS_REST.some((r) => r[2] === id), `${id} sin ruta REST`);
  }
  assert.equal(op('crear_oferta_lead')!.gating?.rolMinimo, 'admin', 'crear una oferta es del admin, como en la ficha');
  const params = op('editar_contacto_lead')!.parametros.map((p) => p.nombre);
  for (const c of ['web', 'instagram', 'youtube', 'linkedin', 'direccion', 'sexo']) assert.ok(params.includes(c), `editar_contacto_lead sin «${c}»`);
  const RUN = sinComentarios(leer('../lib/api-mako/areas/crm.run.ts'));
  assert.match(RUN, /const CAMPOS_CONTACTO = \['nombre', 'email', 'telefono', 'empresa', 'web', 'instagram', 'youtube', 'linkedin', 'direccion', 'sexo'\] as const;/);
  assert.match(RUN, /for \(const k of CAMPOS_CONTACTO\) if \(typeof payload\[k\] === 'string'\) meta\[k\] = payload\[k\] as string;/, 'lo que se propone tiene que ser lo que se escribe');
});

test('«Nueva oferta» va arriba, y «Analizar oferta» lleva a Offer con la oferta y el CRM', () => {
  const i = UI.indexOf('const opciones: DropdownOption[] = [');
  const lista = UI.slice(i, UI.indexOf('];', i));
  assert.ok(lista.indexOf("label: 'Nueva oferta'") > 0 && lista.indexOf("label: 'Nueva oferta'") < lista.indexOf('(ofertas ?? []).map'), '«Nueva oferta» tiene que ir antes que las ofertas');
  assert.match(UI, /router\.push\(`\/offer\?\$\{qs\.toString\(\)\}`\)/);
  assert.match(UI, /new URLSearchParams\(\{ oferta: String\(elegida\.id\) \}\)/);
});

test('las DOS puertas de la ficha muestran la oferta antes del deal', () => {
  for (const p of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/page.tsx']) {
    const src = sinComentarios(leer(p));
    const o = src.indexOf('<OfertaDelLead leadId={lead.id}');
    const d = src.indexOf('<DealDetailsCard lead={lead}');
    assert.ok(o > 0 && d > o, `${p}: la oferta no está arriba del deal`);
  }
});

test('el link a Offer abre ESA oferta: su conversación más reciente, o una nueva para analizarla', () => {
  const s = (id: number, updatedAt: string) => ({ id, titulo: '', estado: 'abierta', total: 0, updatedAt }) as never;
  const arbol = {
    funnels: [
      { id: 1, nombre: 'A', ofertas: [{ id: 7, nombre: 'Mentoría', principal: true, sesiones: [s(30, '2026-10-01'), s(31, '2026-10-09')] }], sesionesNuevas: [] },
      { id: 2, nombre: 'B', ofertas: [{ id: 7, nombre: 'Mentoría', principal: false, sesiones: [] }, { id: 8, nombre: 'Curso', principal: false, sesiones: [] }], sesionesNuevas: [] },
    ],
    sueltas: [],
  };
  assert.deepEqual(entradaDelLink(arbol, 7, 1), { tipo: 'sesion', id: 31 });
  assert.deepEqual(entradaDelLink(arbol, 7, 2), { tipo: 'nueva', funnelId: 2, ofertaBaseId: 7 }, 'el funnel del link desempata');
  assert.deepEqual(entradaDelLink(arbol, 8, null), { tipo: 'nueva', funnelId: 2, ofertaBaseId: 8 });
  assert.deepEqual(entradaDelLink(arbol, 8, 99), { tipo: 'nueva', funnelId: 2, ofertaBaseId: 8 }, 'un funnel que no es suyo no la pierde');
  assert.equal(entradaDelLink(arbol, 99, 1), null, 'una oferta de otro lado abre como siempre');
  assert.equal(idDeParametro(['12', '3']), 12);
  assert.equal(idDeParametro('12abc'), null);
  const PAGE = sinComentarios(leer('../app/offer/page.tsx'));
  assert.match(PAGE, /entradaDelLink\(leido\.arbol, idDeParametro\(q\.oferta\), idDeParametro\(q\.funnel\)\)/);
  assert.match(PAGE, /analizarAlAbrir=\{pedido\?\.tipo === 'nueva'/);
  assert.match(sinComentarios(leer('../app/offer/OfferApp.tsx')), /alAbrir\.current = null;\s*void nuevaSesion\(p\.funnelId, p\.ofertaBaseId\);/);
});

test('«Analizar oferta» sólo se le muestra a quien puede entrar a Offer', () => {
  assert.match(UI, /\{elegida && puedeCrear && \(\s*<button type="button" onClick=\{analizar\}/);
});

test('el modelo de cobro se lee de la fila, y lo desconocido no se inventa', () => {
  assert.equal(filaAOferta({ id: 1, nombre: 'Mentoría', modelo: 'suscripcion' }).modelo, 'suscripcion');
  assert.equal(filaAOferta({ id: 1, nombre: 'Mentoría', modelo: 'mensualidad' }).modelo, null);
  assert.equal(filaAOferta({ id: 1, nombre: 'Mentoría' }).modelo, null);
  assert.ok(esModeloOferta('unico') && !esModeloOferta('cuotas'));
});
