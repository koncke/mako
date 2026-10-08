// =============================================================================
// API de MaKo · un lead en VARIOS productos del CRM (mig 0207) — 08/10/2026
// =============================================================================
// Desde el 06/10 un lead puede estar en varios productos («No se debe "Mover", se debe agregar
// al otro producto», Martín) y, medido el 08/10, NINGUNA operación del registro lo conocía: ni
// MaKo por WhatsApp ni un paso «⚡ Acción» de un flujo podían agregar, quitar ni mover a nadie en
// un segundo producto. Ahora son cuatro operaciones del área crm:
//   productos_del_lead (lectura) · agregar_lead_a_producto · quitar_lead_de_producto ·
//   mover_lead_en_producto
// y van por lib/lead-funnel.ts TAL COMO LA USA LA FICHA: ninguna escribe `lead_funnel` por su
// cuenta (sería la segunda implementación de lo mismo).
//
// El runner lleva server-only: se lee del fuente SIN comentarios y por bloque. Las reglas de
// cuántos productos tiene un lead (`puedeQuitar`, `aQuienPromover`, `etapaDeEntrada`) ya se
// EJECUTAN en tests/lead-funnel.test.ts; acá se fija que cada preparar() las pregunte, y en qué
// orden, antes de dejar nada pendiente.
//
// Probado rompiéndolo (08/10/2026) con un arnés que restaura de memoria (md5 igual al final).
// Como está: 7 pasan / 0 fallan. Cada rotura por separado, 1 falla / 6 pasan:
//   · el lead de OTRO negocio pasa (sin el `noExiste` de leadYProducto)
//   · un producto inexistente pasa (`if (false)` en vez de `if (!producto)`)
//   · productosCrm sin «no pude leer» (sin el `return null` de la lista vacía)
//   · agregar sin «ya está» · quitar del único producto · mover en la casa
//   · mover a una etapa de OTRO producto · un preparar() que escribe
//   · la etapa cruda del principal en la lectura · agregar abierto a HTTP
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFS } from '../lib/api-mako/areas/crm.def';
import { REGISTRO } from '../lib/api-mako/registro';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('../lib/api-mako/areas/crm.run.ts'));
const HELPERS = sinComentarios(leer('../lib/api-mako/areas/crm.helpers.ts'));

/** El cuerpo de UN runner: desde su clave hasta la clave del siguiente. */
function runner(id: string): string {
  const ini = RUN.indexOf(`\n  ${id}: {`);
  assert.ok(ini > 0, `no encontré el runner ${id}`);
  const sig = RUN.slice(ini + 4).search(/\n {2}[a-z][a-z0-9_]*: \{/);
  return sig < 0 ? RUN.slice(ini) : RUN.slice(ini, ini + 4 + sig);
}
/** Una función de primer nivel del archivo: de su firma al `}` en columna 0. */
function funcion(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  return src.slice(ini, src.indexOf('\n}\n', ini));
}
const partes = (r: string) => ({ prep: r.slice(r.indexOf('preparar:'), r.indexOf('ejecutar:')), ejec: r.slice(r.indexOf('ejecutar:')) });

const ACCIONES = ['agregar_lead_a_producto', 'quitar_lead_de_producto', 'mover_lead_en_producto'] as const;

// ── Las definiciones ─────────────────────────────────────────────────────────

test('las cuatro existen, sin HTTP, por chat y con el producto por el id de su EMBUDO', () => {
  const lectura = DEFS.find((d) => d.id === 'productos_del_lead');
  assert.ok(lectura && lectura.tipo === 'lectura', 'falta la lectura productos_del_lead: sin ella nadie consigue el embudoId');
  assert.ok(!lectura.canales.includes('http'));
  assert.ok(!lectura.parametros.find((p) => p.nombre === 'leadId')?.obligatorio, 'sin leadId tiene que devolver los productos (lo que necesita quien arma un flujo)');
  for (const id of ACCIONES) {
    const d = DEFS.find((x) => x.id === id);
    assert.ok(d && d.tipo === 'accion', `falta ${id} en crm.def.ts`);
    assert.equal(d.confirmacion, 'chat', id);
    assert.deepEqual([...d.canales].sort(), ['app', 'whatsapp'], `${id}: abrirlo a HTTP es una decisión (regenera el snapshot)`);
    assert.deepEqual(d.gating, { tab: 'crm' }, id);
    assert.equal(d.reversible, true, id);
    const emb = d.parametros.find((p) => p.nombre === 'embudoId');
    // ⚠️ Del producto al embudo hay dos saltos: un id de listar_productos que coincida con un
    // embudo movería al lead en el producto equivocado sin un error.
    assert.ok(emb && emb.obligatorio && emb.entero, `${id}: embudoId entero y obligatorio`);
    assert.match(emb.descripcion, /NO es el id de listar_productos/, `${id}: la descripción tiene que separar los dos catálogos`);
    assert.ok(d.parametros.find((p) => p.nombre === 'leadId')?.obligatorio, `${id}: leadId (lo que llena un flujo con el lead del evento)`);
  }
  assert.ok(DEFS.find((d) => d.id === 'mover_lead_en_producto')?.parametros.some((p) => p.nombre === 'etapa' && p.obligatorio));
  assert.ok(REGISTRO.some((d) => d.id === 'productos_del_lead'), 'el registro no la cargó');
});

// ── El cableado común ────────────────────────────────────────────────────────

test('⚠️ el lead y el producto se validan contra ESTE negocio antes de proponer nada', () => {
  const f = funcion(RUN, 'async function leadYProducto(');
  // getLead (leadDe) y listarFunnels (productosCrm) leen con getTenantDb: un lead o un embudo de
  // otro negocio no existen acá.
  const iLead = f.indexOf('const lead = await leadDe(input.leadId);');
  const iNo = f.indexOf('if (!lead) return { error: noExiste(input.leadId) };');
  const iProd = f.indexOf('const productos = await productosCrm();');
  assert.ok(iLead > 0 && iNo > iLead, 'un lead de otro negocio tiene que volver como error, primero');
  assert.ok(iProd > iNo, 'el producto se busca después del lead');
  assert.match(f, /if \(!productos\) return \{ error: NO_LEI_PRODUCTOS \};/, '«no pude leer» no es «no existe»');
  assert.match(f, /const producto = productos\.find\(\(p\) => p\.embudoId === id\);\s*if \(!producto\) \{\s*return \{\s*error: `No existe el producto/, 'un embudo que no es de este negocio vuelve como error');
  assert.match(f, /await productosDelLead\(lead\.id\)/, 'en cuáles está, con la lectura de la ficha');
  // Y la lista de productos: la de la pantalla, con vacío = no se pudo leer.
  const h = funcion(HELPERS, 'export async function productosCrm(');
  assert.match(h, /const funnels = await listarFunnels\(\);\s*if \(!funnels\.length\) return null;/);
  assert.match(h, /nombre: f\.producto\?\.trim\(\) \|\| f\.nombre/, 'el nombre que ve la persona, con la regla de la ficha');
});

test('las tres preparan con leadYProducto, y ninguna escribe lead_funnel por su cuenta', () => {
  for (const id of ACCIONES) {
    const { prep, ejec } = partes(runner(id));
    assert.match(prep, /const r = await leadYProducto\(input\);\s*if \('error' in r\) return r;/, `${id}: sin validar lead y producto`);
    assert.doesNotMatch(prep, /agregarAProducto|quitarDeProducto|moverEtapaEnProducto|\.insert\(|\.update\(|\.delete\(/, `${id}: preparar() no puede escribir`);
    assert.match(ejec, /seguro\('/, `${id}: ejecutar() nunca lanza`);
    assert.match(ejec, /\{ autor: autorDe\(ctx\) \}/, `${id}: el historial dice quién (la persona o la automatización)`);
  }
  assert.doesNotMatch(RUN, /from\('lead_funnel'\)/, 'crm.run.ts escribe lead_funnel directo: eso es una segunda implementación de lib/lead-funnel.ts');
});

// ── Cada una ─────────────────────────────────────────────────────────────────

test('agregar: si ya está en ese producto lo dice, y entra por la etapa de entrada', () => {
  const { prep, ejec } = partes(runner('agregar_lead_a_producto'));
  assert.match(prep, /if \(r\.enEse\) return \{ error: `\$\{r\.lead\.nombre\} ya está en «\$\{r\.producto\.nombre\}»\.` \};/);
  assert.match(prep, /const entrada = etapaDeEntrada\(r\.producto\.etapas\);/, 'la misma regla de entrada que agregarAProducto');
  assert.match(ejec, /await agregarAProducto\(id, embudo, /);
  assert.match(ejec, /if \(!r\.agregado\) return \{ ok: false, /, 'si otra cosa lo agregó entre el «sí» y ahora, no se cuenta como hecho');
});

test('quitar: tiene que estar, no del único, y si era el principal dice cuál pasa a serlo', () => {
  const { prep, ejec } = partes(runner('quitar_lead_de_producto'));
  const iNo = prep.indexOf('if (!r.enEse) return { error:');
  const iUnico = prep.indexOf('if (!puedeQuitar(r.suyos)) return { error:');
  assert.ok(iNo > 0 && iUnico > iNo, 'no está → error; único producto → error');
  assert.match(prep, /if \(r\.enEse\.esCasa\) \{\s*const nueva = aQuienPromover\(r\.suyos\);/, 'la casa promueve otra: se dice ANTES del «sí»');
  assert.match(ejec, /await quitarDeProducto\(id, embudo, /);
});

test('mover: sólo en un producto AGREGADO; el principal va por proponer_cambio_etapa', () => {
  const { prep, ejec } = partes(runner('mover_lead_en_producto'));
  const iNo = prep.indexOf('if (!r.enEse) return { error:');
  const iCasa = prep.indexOf('if (r.enEse.esCasa) return { error:');
  const iEtapa = prep.indexOf('const destino = r.producto.etapas.find((e) => e.key === etapa);');
  assert.ok(iNo > 0 && iCasa > iNo && iEtapa > iCasa, 'el orden: está → no es la casa → la etapa existe');
  assert.match(prep.slice(iCasa, iEtapa), /proponer_cambio_etapa/, 'la casa tiene requisitos, estado y Meta: no se mueve por lead_funnel');
  assert.match(prep, /if \(!destino\) return \{ error: `«\$\{etapa\}» no es una etapa de «\$\{r\.producto\.nombre\}»\.`, disponibles:/, 'una etapa de otro producto vuelve con las que hay');
  assert.match(prep, /if \(r\.enEse\.etapa === etapa\) return \{ error:/, 'ya está en esa etapa: lo dice');
  assert.match(ejec, /await moverEtapaEnProducto\(id, embudo, etapa, /);
});

test('la lectura: con leadId dice en cuáles está y la etapa EFECTIVA del principal', () => {
  const r = runner('productos_del_lead');
  assert.match(r, /if \(!productos\) return fallo\(NO_LEI_PRODUCTOS\);/);
  assert.match(r, /return conLead\(input, /, 'un lead de otro negocio vuelve como error');
  assert.match(r, /x\.esCasa \? etapaVigenteDe\(lead, p\.etapas\) : x\.etapa/, 'pipeline_stage es un override casi siempre vacío: la del principal se deriva');
  assert.match(r, /puede_quitar: puedeQuitar\(suyos\)/);
});
