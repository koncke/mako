// =============================================================================
// El cliente de una agencia no ve lo que MaKo vende, y cualquiera es partner (29/10/2026)
// =============================================================================
// Llamada con Thiago (agencia de España, 27 clientes): «yo no me meto con ese cliente». El cliente de una agencia no ve
// «Pasar a Pro», «Recomienda MaKo» ni MaKo Partners: su plan lo paga y lo cambia su agencia. Y MaKo Partners deja de ser
// sólo de Pro: las landings dicen «gratis» y «cualquier plan» (eso lo fija tests/scraper-partners-solo-pro.test.ts). Lo
// que se suma acá: el código de partner en la venta a mano (/admin/cobros y `vender_plan_mako`), que queda en el cobro
// como el de /r/<código>.
//
// Probado rompiéndolo (29/10/2026; base 6 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · puedeVerItem sin mirar `noParaClienteDeAgencia`                         -> 5 / 1
//   · /api/auth/me sin `clienteDeAgencia` en la respuesta                     -> 5 / 1
//   · «Tu plan» le ofrece «Pasar a Pro» al cliente de una agencia             -> 5 / 1
//   · /partners sin el corte del cliente de una agencia                       -> 5 / 1
//   · ventaValida guardando el código como vino (sin limpiarlo)               -> 5 / 1
//   · venderPlan sin preguntar si el código es de un partner                  -> 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { USER_NAV } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';
import { TEXTO_PEDIR_PRO_A_LA_AGENCIA } from '../lib/plan-esencial-reglas';
import { ventaValida } from '../lib/vender-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

function tsx(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) return tsx(rel);
    return rel.endsWith('.tsx') ? [rel] : [];
  });
}

test('la barra: MaKo Partners no se le ve al cliente de una agencia, y al resto sí', () => {
  const partners = USER_NAV.find((x) => x.key === 'partners');
  assert.ok(partners?.noParaClienteDeAgencia, 'la entrada de Partners lleva la marca');
  const v = { adminShell: false, rolWs: 'admin', capa: 'agencia' };
  assert.equal(puedeVerItem(partners!, v), true);
  assert.equal(puedeVerItem(partners!, { ...v, capa: 'completo' }), true, 'el Esencial también es partner');
  assert.equal(puedeVerItem(partners!, { ...v, clienteDeAgencia: true }), false);
  // Una entrada sin la marca no cambia.
  const otra = USER_NAV.find((x) => !x.noParaClienteDeAgencia && puedeVerItem(x, v));
  assert.ok(otra && puedeVerItem(otra, { ...v, clienteDeAgencia: true }));
});

test('el dato sale de la base: /api/auth/me lo lee de lib/vista-de-otro.ts y la barra lo pasa a la vista', () => {
  const me = fuente('app/api/auth/me/route.ts');
  assert.match(me, /\bcuentaActualEsDeAgencia\(\),?\s*\]\);/);
  assert.match(me, /\n\s+clienteDeAgencia,\n/);
  const bar = fuente('app/_components/Sidebar.tsx');
  assert.match(bar, /setClienteDeAgencia\(j\.clienteDeAgencia === true\)/);
  assert.match(bar, /const vistaNav = \{ adminShell, rolWs, capa, clienteDeAgencia \}/);
});

test('«Tu plan» del cliente de una agencia: sin «Pasar a Pro» ni «Recomienda MaKo», y dice que lo maneja su agencia', () => {
  const page = fuente('app/configuraciones/plan/page.tsx');
  // ⚠️ `!== false` desde el 30/10/2026 (P15): `esClienteDeAgencia` contesta sí/no/**no sé**, y acá el «no sé» NO OFRECE.
  //    Leerla por verdad le ofrecería «Pasar a Pro» al cliente de una agencia cuando la cartera no se pudo leer.
  assert.match(page, /const deAgencia = \(await esClienteDeAgencia\(ws\)\) !== false;/);
  assert.match(page, /subir=\{deAgencia \? null : subir\} porLlamada=\{deAgencia \? null : porLlamada\} clienteDeAgencia=\{deAgencia\}/);
  const panel = fuente('app/configuraciones/plan/PlanPanel.tsx');
  const recomienda = panel.indexOf('titulo="Recomienda MaKo"');
  assert.ok(recomienda > 0 && panel.lastIndexOf('{!clienteDeAgencia && (', recomienda) > panel.lastIndexOf('</GrupoAjustes>', recomienda),
    'el grupo «Recomienda MaKo» va adentro de !clienteDeAgencia');
  assert.match(panel, /clienteDeAgencia \? 'Lo maneja tu agencia' : gratisHasta \? `Gratis hasta el \$\{gratisHasta\}` : 'Acordado con MaKo'/);
  assert.match(panel, /!suscripcion && clienteDeAgencia && \([\s\S]*?pídeselo a ella/);
});

// =============================================================================
// LOS CARTELES DE TOPE (6/11/2026, #494) — el otro camino, y por qué es otro
// =============================================================================
// La barra se arregló con `noParaClienteDeAgencia`, que decide ÍTEMS por su key. Un cartel de tope no es un ítem: es el pie
// de ocho pantallas, y cada una ofrecía «Pasar a Pro» con un link a /configuraciones/plan. El cliente de la agencia hacía
// clic y le pagaba a MaKo un SEGUNDO plan del que su agencia ya paga. Ahora el link va envuelto en `CtaPasarAPro`.
test('los carteles de tope: el «Pasar a Pro» va envuelto en CtaPasarAPro, y sin él no hay link', () => {
  const cta = fuente('app/_components/CtaPasarAPro.tsx');
  assert.match(cta, /const deAgencia = useClienteDeAgencia\(\);\n\s*if \(!deAgencia\) return <>\{children\}<\/>;/,
    'el `null` del primer dibujo va por el link: el «no sé» de la BASE ya llega como `true` desde /api/auth/me');
  assert.match(cta, /\{TEXTO_PEDIR_PRO_A_LA_AGENCIA\}<\/span>/);
  assert.doesNotMatch(cta.slice(cta.indexOf('if (!deAgencia)')), /<a |<Link /, 'al cliente de una agencia, SIN link: no hay nada que toque él');
  assert.match(TEXTO_PEDIR_PRO_A_LA_AGENCIA, /^Pídele a tu agencia/, 'de TÚ, y dice a quién pedírselo');
  // Una sola lectura de /api/auth/me para los ocho carteles (el hook la memoiza a nivel de módulo).
  assert.match(fuente('app/_components/useClienteDeAgencia.ts'), /promesa \?\?= fetch\('\/api\/auth\/me'\)/);

  // ⚠️ LA LISTA ESTÁ CERRADA: un cartel nuevo con «Pasar a Pro» sin envolver rompe este test, y ahí se decide de qué lado cae.
  //    No lo envuelven, con motivo: la pantalla del candado y la barra ya lo resuelven con `deAgencia`, y los dos de /agency
  //    son de la AGENCIA (su botón para cambiarle el plan a su cliente, y su landing, donde el cliente no entra: su guard).
  const SIN_ENVOLVER: Record<string, string> = {
    'app/no-esta-en-tu-plan/page.tsx': 'el cartel del candado ya decide con `deAgencia` (test de arriba)',
    'app/_components/Sidebar.tsx': 'la barra dice «De MaKo Pro» al cliente de una agencia (`esPro` devuelve «agencia»)',
    'app/agency/LandingAgency.tsx': 'es la landing de /agency: el cliente de una agencia no entra (app/agency/page.tsx)',
  };
  // ⚠️ `\s*` A LOS DOS LADOS, y no es cosmético: en app/crm/PasarAPro.tsx el rótulo está en su propio renglón, así que un
  //    `>Pasar a Pro<` pelado no lo veía — el barrido daba verde sobre el cartel del CRM, que es el que alimenta a cuatro pantallas.
  const CTA = />\s*(?:Pasar a Pro|\{ROTULO_PASAR_A_PRO\}|Pásate a MaKo Pro)\s*</g;
  const sinPuerta: string[] = [];
  for (const rel of tsx('app')) {
    const src = fuente(rel);
    const cuantos = (src.match(CTA) ?? []).length;
    if (!cuantos || rel in SIN_ENVOLVER) continue;
    if ((src.match(/<CtaPasarAPro>/g) ?? []).length < cuantos) sinPuerta.push(rel);
  }
  assert.deepEqual(sinPuerta, [], 'cada «Pasar a Pro» de un cartel va envuelto en <CtaPasarAPro>, o entra en SIN_ENVOLVER con su motivo');
  // Y los que ya están: si uno pierde el envoltorio, no alcanza con que el barrido quede vacío.
  for (const rel of [
    'app/crm/PasarAPro.tsx', 'app/crm/TraerDeGrupoWA.tsx', 'app/whatsapp/EvolutionConnect.tsx', 'app/equipo/EquipoView.tsx',
    'app/web-generator/editor/dialogos/DialogoPublicar.tsx', 'app/integraciones/CuentasDePago.tsx',
    'app/ads-manager/Automatizaciones.tsx', 'app/ads-manager/Ajustes.tsx',
  ]) assert.match(fuente(rel), /<CtaPasarAPro>/, rel);
  // El teléfono no vende (T5): ni el link ni este texto. Su cartel de tope dice sólo que llegó.
  assert.doesNotMatch(fuente('app/m/configuraciones/equipo/EquipoM.tsx'), /Pasar a Pro|CtaPasarAPro/);
});

test('/partners y /m/partners: el cliente de una agencia vuelve al inicio', () => {
  // ⚠️ Comparado contra `false` (P15, 30/10/2026): son PUERTAS, y con el «no sé» de `esClienteDeAgencia` no se entra.
  assert.match(fuente('app/partners/page.tsx'), /if \(\(await esClienteDeAgencia\(ws\)\) !== false\) redirect\(await rutaConWs\('\/inicio'\)\)/);
  assert.match(fuente('app/m/partners/page.tsx'), /deAgencia !== false\) redirect\(await rutaConWs\('\/m'\)\)/);
});

test('la venta a mano: el código de partner se limpia, uno mal escrito se frena, y sin código queda null', () => {
  const base = { capa: 'completo', monto: 47, tipo: 'suscripcion' as const, email: 'a@b.com', nombre: 'Ana' };
  const con = (refCodigo: string | null | undefined) => ventaValida({ ...base, refCodigo });
  const ok = con(' Juan-1 ');
  assert.ok(ok.ok && ok.venta.refCodigo === 'juan-1');
  for (const nada of [undefined, null, '', '   ']) { const r = con(nada); assert.ok(r.ok && r.venta.refCodigo === null, String(nada)); }
  const mal = con('a b!');
  assert.ok(!mal.ok && /código de partner/.test(mal.error));
});

test('la venta a mano: el código tiene que ser de un partner, y queda en el cobro (pantalla y API)', () => {
  const v = fuente('lib/vender-plan.ts');
  const chequeo = v.indexOf('if (venta.refCodigo && !(await esCodigoDePartner(venta.refCodigo))) return { ok: false');
  const abierto = v.indexOf('const abierto = await cobroAbiertoDelPlan(');
  const cobro = v.indexOf('const r = await crearCobro(ws, {');
  const guarda = v.indexOf("update({ ref_codigo: venta.refCodigo }).eq('id', r.cobro.id).eq('workspace_id', ws)", cobro);
  assert.ok(chequeo > 0 && abierto > chequeo && cobro > abierto, 'se pregunta ANTES del link que ya existe y de crear el cobro');
  assert.ok(guarda > cobro, 'y se guarda en el cobro que se creó');
  // La pantalla: desde el 6/11/2026 «Vender un plan» es Products › Checkout Links (la copia de Polar), con el mismo campo.
  assert.match(fuente('app/admin/_polar/web/CheckoutLinks/CheckoutLinkForm.tsx'), /refCodigo: data\.refCodigo\.trim\(\) \|\| null/);
  assert.match(fuente('lib/api-mako/areas/cobros.def.ts'), /nombre: 'codigoPartner', rotulo: 'Código de partner', tipo: 'string'/);
  assert.match(fuente('lib/api-mako/areas/cobros.run.ts'), /refCodigo: s\(input\.codigoPartner\) \}\);/);
});
