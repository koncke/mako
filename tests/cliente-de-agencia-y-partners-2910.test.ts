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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { USER_NAV } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';
import { ventaValida } from '../lib/vender-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

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
  assert.match(fuente('app/admin/cobros/_components/vender-plan.tsx'), /refCodigo: refCodigo\.trim\(\) \|\| null/);
  assert.match(fuente('lib/api-mako/areas/cobros.def.ts'), /nombre: 'codigoPartner', rotulo: 'Código de partner', tipo: 'string'/);
  assert.match(fuente('lib/api-mako/areas/cobros.run.ts'), /refCodigo: s\(input\.codigoPartner\) \}\);/);
});
