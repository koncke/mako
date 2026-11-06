// =============================================================================
// «Tus cuentas de IA»: cada cuenta con sus dispositivos, y dónde está cada uno (23/10/2026)
// =============================================================================
// El feedback de Martín (por el Cerebro, con capturas del ws1), punto 5:
//   · sin el botón «Conectar tu IA»: «Nueva cuenta» (Claude o ChatGPT) arriba, siempre a la vista;
//   · cada cuenta conectada es UN bloque, «Cuenta 1», «Cuenta 2» (no el nombre de la PC), con su email (la regla del
//     enmascarado), su plan y su uso; adentro, sus DISPOSITIVOS y «Desconectar»; y ahí «Nuevo dispositivo», que se distingue de
//     «Nueva cuenta» (con la descarga a la vista hasta el 24/10; desde ahí una fila que abre el tutorial en la descarga: Martín, «no
//     el botón feo que está al final del modal que no lo ve nadie»; la descarga vive en el cartel del chat, app/_chat/AppPrimero.tsx);
//   · cada dispositivo dice DÓNDE está, como Google («Grandbourg, Buenos Aires, Argentina»): de los headers de Vercel, sólo
//     ciudad, provincia y país, nunca la IP; lo ve quien ve ese dispositivo;
//   · fuera el «Modelo», «Tu clave de Claude» y el crédito de MaKo (ése, sólo en SuperAdmin), y el mismo dibujo en SuperAdmin.
// Lo que fija este test (lib/ia-pc.ts REAL en tests/_ia-pc-ubicacion-hijo.ts):
//   1. el texto de la ubicación, como Google, y sin nada que no sea ciudad, provincia y país;
//   2. el latido la guarda sola (de los headers de Vercel, nunca la IP), y sin la mig 0327 todo sigue andando;
//   3. las cuentas con sus dispositivos: una cuenta en dos computadoras es UN bloque, numeradas, con el email por la regla;
//   4. la tarjeta: «Nueva cuenta» arriba, los bloques, «Nuevo dispositivo» en cada cuenta, y nada de modelo, claves ni crédito.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { agruparPorCuenta, dondeEsta, textoDeUbicacion, type PcParaAgrupar } from '../lib/ia-pc-reglas';
import { CuentasYDispositivos, NuevoDispositivo } from '../app/integraciones/CuentasYDispositivos';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia-pc-ubicacion-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@UBICACION@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@UBICACION@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('1. la ubicación como Google: ciudad, provincia y país; lo que no se sabe no va', () => {
  assert.equal(textoDeUbicacion({ pais: 'AR', region: 'B', ciudad: 'Grandbourg' }), 'Grandbourg, Buenos Aires, Argentina');
  assert.equal(textoDeUbicacion({ pais: 'MX', region: 'JAL', ciudad: 'Guadalajara' }), 'Guadalajara, Jalisco, México');
  assert.equal(textoDeUbicacion({ pais: 'AR', region: 'X', ciudad: 'Córdoba' }), 'Córdoba, Argentina', 'un nombre repetido va una vez');
  assert.equal(textoDeUbicacion({ pais: 'US', region: 'CA', ciudad: 'San Francisco' }), 'San Francisco, Estados Unidos', 'sin el nombre de la provincia, no se inventa');
  assert.equal(textoDeUbicacion({ pais: 'AR', region: null, ciudad: null }), 'Argentina');
  assert.equal(textoDeUbicacion({ pais: null, region: 'B', ciudad: 'Grandbourg' }), null, 'sin país, nada');
  assert.equal(textoDeUbicacion(null), null);
  assert.doesNotMatch(textoDeUbicacion({ pais: 'AR', region: 'B', ciudad: 'Grand<img src=x>bourg\u0007' }) ?? '', /[<>\u0000-\u001f]/);
  // Ni lo invisible ni lo que invierte el texto (revisión de privacidad), ni medio emoji suelto.
  assert.equal(textoDeUbicacion({ pais: 'AR', region: 'B', ciudad: 'Grand\u202ebourg\u200b\u007f' }), 'Grandbourg, Buenos Aires, Argentina');
  assert.equal(textoDeUbicacion({ pais: 'AR', region: null, ciudad: 'Rosario\ud83c' }), 'Rosario, Argentina');
  assert.equal(dondeEsta({ sistema: 'Windows', ubicacion: 'Grandbourg, Buenos Aires, Argentina' }), 'Windows · Grandbourg, Buenos Aires, Argentina');
  assert.equal(dondeEsta({ sistema: null, ubicacion: null }), null, 'sin dato, no se muestra');
});

test('2. el latido la guarda sola (sólo el texto, de los headers de Vercel, nunca la IP); sin la mig 0327, todo sigue', () => {
  const r = correr();
  assert.equal(r.fila.ubicacion, 'Grandbourg, Buenos Aires, Argentina');
  assert.ok(!r.fila.columnas.some((c: string) => /ip|lat(itud)?$|lon|coord/i.test(c.replace('ultimo_latido', ''))), `guardó algo más: ${r.fila.columnas}`);
  assert.deepEqual(r.lista, ['Grandbourg, Buenos Aires, Argentina']);
  assert.deepEqual(r.todas, [{ ubicacion: 'Grandbourg, Buenos Aires, Argentina', cuentas: ['ana@gmail.com'] }], 'el super admin no la ve');
  assert.equal(r.queda, 'Grandbourg, Buenos Aires, Argentina', 'un latido sin ubicación la borró');
  assert.equal(r.latioSinColumna, true, `sin la mig 0327 el latido falla: ${r.latioSinColumna}`);
  assert.equal(r.latidoNuevo, true, 'sin la mig 0327 el latido no se anotó');
  assert.deepEqual(r.listaSinColumna, [['PC de Ana', null]], 'sin la mig 0327 la tarjeta no sale');
  assert.deepEqual(r.todasSinColumna, [['PC de Ana', null]], 'sin la mig 0327 SuperAdmin no sale');
  assert.equal(r.ipOCoordenadas, 0, 'viajó la IP o coordenadas a la base');
  // Revisión de privacidad: un texto que la base no acepta no tira el latido; y desconectar borra lo personal.
  assert.equal(r.latioConTextoMalo, true, `un texto malo tiró el latido: ${r.latioConTextoMalo}`);
  assert.equal(r.latidoNuevo2, true, 'con un texto malo el latido no se anotó');
  assert.deepEqual(r.desconectada, { revocada: true, ubicacion: null, cuentas: [] }, 'desconectar dejó la ubicación o los emails');
  // La ruta del latido: de los headers de Vercel, con la regla que nunca lee la IP.
  const ruta = sinComentarios(leer('app/api/ia-pc/latido/route.ts'));
  assert.match(ruta, /const ubicacion = textoDeUbicacion\(ubicacionDeHeaders\(\(n\) => req\.headers\.get\(n\)\)\);/);
  assert.match(ruta, /await latir\(d, body, \{ ubicacion \}\)/);
  assert.doesNotMatch(ruta, /x-forwarded-for|x-real-ip|\.ip\b|latitude|longitude/i, 'el latido lee la IP o las coordenadas');
  // Y la migración: una columna de texto.
  assert.match(leer('supabase/migrations/0327_ia_pc_ubicacion.sql'), /alter table ia_pc_dispositivos add column if not exists ubicacion text;/);
});

test('3. las cuentas con sus dispositivos: una cuenta en dos PC es UN bloque, numeradas, el uso del último latido, el email por la regla', () => {
  const pc = (id: number, o: Partial<PcParaAgrupar>): PcParaAgrupar => ({
    id, nombre: `PC ${id}`, esMia: true, enLinea: true, ultimoLatido: '2026-10-23T10:00:00Z', version: '0.4.0+windows', sistema: 'Windows',
    ubicacion: null, conectadaAt: '2026-10-22T10:00:00Z', cuentas: [], ...o,
  });
  const g = agruparPorCuenta([
    pc(1, { conectadaAt: '2026-10-22T12:00:00Z', ultimoLatido: '2026-10-23T10:00:00Z', cuentas: [{ proveedor: 'claude', email: 'Ana@Gmail.com', plan: 'max', usado5h: 10 }] }),
    pc(2, { conectadaAt: '2026-10-21T12:00:00Z', ultimoLatido: '2026-10-23T11:00:00Z', cuentas: [{ proveedor: 'claude', email: 'ana@gmail.com', plan: 'max', usado5h: 40 }] }),
    pc(3, { esMia: false, de: 'beto@negocio.com', conectadaAt: '2026-10-23T09:00:00Z', cuentas: [{ proveedor: 'claude', email: 'beto@gmail.com', plan: 'pro' }] }),
    pc(4, { cuentas: [], enLinea: true }),
  ], (p) => p.esMia);
  assert.deepEqual(g.cuentas.map((c) => [c.numero, c.email, c.dispositivos.map((d) => d.id)]), [
    [1, 'ana@gmail.com', [1, 2]],
    [2, 'b***@gmail.com', [3]],
  ], 'la misma cuenta en dos PC, numeradas por la primera conexión, y el email de otro, enmascarado');
  assert.equal(g.cuentas[0].usado5h, 40, 'el uso es el del dispositivo que latió último');
  assert.deepEqual(g.sinCuenta.map((d) => [d.id, d.conCuenta]), [[4, false]]);
  assert.equal(g.cuentas[1].dispositivos[0].de, 'beto@negocio.com');
  // La cuenta es de una persona: un miembro que declara el email del admin no entra al bloque del admin (revisión de privacidad).
  const ajena = agruparPorCuenta([
    pc(7, { persona: 'admin@negocio.com', cuentas: [{ proveedor: 'claude', email: 'admin@gmail.com', usado5h: 5 }] }),
    pc(8, { esMia: false, persona: 'beto@negocio.com', de: 'beto@negocio.com', ultimoLatido: '2026-10-23T12:00:00Z', cuentas: [{ proveedor: 'claude', email: 'admin@gmail.com', usado5h: 99 }] }),
  ], (p) => p.esMia);
  assert.deepEqual(ajena.cuentas.map((c) => [c.dispositivos.map((d) => d.id), c.usado5h]), [[[7], 5], [[8], 99]]);
  assert.ok(!JSON.stringify(ajena).includes('"persona"'), 'la persona salió en el dispositivo');
  // El super admin: todo entero.
  assert.equal(agruparPorCuenta([pc(3, { esMia: false, cuentas: [{ proveedor: 'claude', email: 'beto@gmail.com' }] })], () => true).cuentas[0].email, 'beto@gmail.com');
  // Una PC con dos cuentas está en las dos.
  const dos = agruparPorCuenta([pc(5, { cuentas: [{ proveedor: 'claude', email: 'a@x.com' }, { proveedor: 'claude', email: 'b@x.com' }] })], () => true);
  assert.deepEqual(dos.cuentas.map((c) => c.dispositivos.map((d) => d.id)), [[5], [5]]);
});

test('4. la tarjeta: «Nueva cuenta» arriba, los bloques, «Nuevo dispositivo» en cada cuenta; ni modelo, ni claves, ni crédito', () => {
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const nueva = ui.indexOf('<NuevaCuenta onElegir={setEligiendo} vacia={vacia} />');
  assert.ok(nueva > 0 && nueva < ui.indexOf('<CuentasYDispositivos grupos={grupos}'), '«Nueva cuenta» no va arriba');
  assert.doesNotMatch(ui, />Conectar tu IA<\/button>|>Modelo<|MODELOS|elegirModelo|\/api\/ia-pc\/modelo|SusClaves|crédito de Claude que te dio MaKo/, 'volvió el modelo, la clave o el crédito');
  // El dibujo, con datos de verdad.
  const grupos = agruparPorCuenta([
    { id: 1, nombre: 'MSI', esMia: true, enLinea: true, ultimoLatido: new Date().toISOString(), version: '0.4.0+windows', sistema: 'Windows', ubicacion: 'Grandbourg, Buenos Aires, Argentina', conectadaAt: '2026-10-22T12:00:00Z', cuentas: [{ proveedor: 'claude', email: 'mauricio@gmail.com', plan: 'max', usado5h: 30, usadoSemana: 12 }] },
    { id: 2, nombre: 'Oficina', esMia: false, de: 'ana@negocio.com', enLinea: false, ultimoLatido: '2026-10-22T10:00:00Z', version: '0.3.2', sistema: null, ubicacion: null, conectadaAt: '2026-10-23T09:00:00Z', cuentas: [{ proveedor: 'claude', email: 'ana@gmail.com', plan: 'pro' }] },
  ], (p) => p.esMia);
  const html = renderToStaticMarkup(createElement(CuentasYDispositivos, {
    grupos, ahora: Date.now(), onDesconectar: () => {},
    nuevoDispositivo: () => createElement(NuevoDispositivo, { onAbrir: () => {} }),
  }));
  assert.match(html, /<h3 class="tci-bloque__titulo">Cuenta 1<\/h3>.*mauricio@gmail\.com.*max.*Sesión de 5 horas.*30% usado.*Semana.*Dispositivos.*MSI.*En línea.*Windows · Grandbourg, Buenos Aires, Argentina/);
  assert.doesNotMatch(html, /<h3 class="tci-bloque__titulo">MSI<\/h3>/, 'el título de la cuenta es el nombre de la PC');
  assert.match(html, /<h3 class="tci-bloque__titulo">Cuenta 2<\/h3>.*a\*\*\*@gmail\.com.*Oficina.* · de ana@negocio\.com.*Sin conexión/);
  assert.equal((html.match(/<button type="button" class="tci-nuevo-fila">/g) ?? []).length, 2, '«Nuevo dispositivo» en cada cuenta');
  assert.doesNotMatch(html, /\/api\/ia-pc\/descargar/, 'el recuadro con la descarga al final de cada cuenta se fue (24/10/2026)');
  assert.equal((html.match(/>Desconectar</g) ?? []).length, 2);
  // Lo mismo en el teléfono (/m/cuenta/ia). (La ficha de un cliente del super admin, app/admin/ComputadorasDelNegocio.tsx, se
  // borró el 6/11/2026 con la copia de Polar: las computadoras de un negocio se ven en su ficha nueva, ver tests/ia-pc-varias.)
  assert.match(sinComentarios(leer('app/m/cuenta/ia/IaM.tsx')), /<SeccionM titulo=\{`Cuenta \$\{cuenta\.numero\}`\}>/);
});
