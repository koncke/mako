// =============================================================================
// «Eliminar mi cuenta» (T4, docs/tiendas-play-appstore.md, paso 4): quién puede, qué se lleva, y que el borrado borre (3/11/2026)
// =============================================================================
// Apple (5.1.1(v)) y Play piden eliminar la cuenta desde la app; desactivarla no alcanza. Lo que corre de verdad, sobre una base de
// mentira, está en tests/_baja-cuenta-hijo.ts.
//
// Correr: node --import tsx --test tests/baja-cuenta.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIRMACION_BAJA, PLAZO_BAJA_DIAS, alcanceDeLaBaja, diasQueQuedan, motivoSinBaja, textoDeLaBaja, venceDe,
} from '../lib/baja-cuenta-reglas';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';
import { decidirDesvio } from '../lib/movil-desvio';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_baja-cuenta-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('1. las reglas: quién no puede, y el negocio entero sólo con su último admin', () => {
  assert.ok(motivoSinBaja({ rol: 'admin', impersonando: false, tieneFila: true }), 'el super admin');
  assert.ok(motivoSinBaja({ rol: 'usuario', impersonando: true, tieneFila: true }), 'quien mira a otro');
  assert.ok(motivoSinBaja({ rol: 'usuario', impersonando: false, tieneFila: false }), 'sin fila propia');
  assert.equal(motivoSinBaja({ rol: 'usuario', impersonando: false, tieneFila: true }), null);
  const base = { otrosAdmins: 0, ws: 30, wsPlataforma: 9 };
  assert.equal(alcanceDeLaBaja({ ...base, rolWs: 'admin' }), 'negocio');
  assert.equal(alcanceDeLaBaja({ ...base, rolWs: 'admin', otrosAdmins: 1 }), 'persona');
  for (const r of ['closer', 'setter', null, '']) assert.equal(alcanceDeLaBaja({ ...base, rolWs: r }), 'persona', String(r));
  assert.equal(alcanceDeLaBaja({ ...base, rolWs: 'admin', ws: null }), 'persona', 'sin negocio no hay negocio que borrar');
  assert.equal(alcanceDeLaBaja({ ...base, rolWs: 'admin', ws: 9 }), 'persona', 'la plataforma no se pausa con un toque');
  assert.equal(alcanceDeLaBaja({ ...base, rolWs: 'admin', wsPlataforma: undefined }), 'persona', 'sin saber cuál es, tampoco');
  assert.equal(PLAZO_BAJA_DIAS, 30, 'T4');
  const ahora = Date.UTC(2026, 10, 3);
  assert.equal(venceDe(ahora), new Date(Date.UTC(2026, 11, 3)).toISOString());
  assert.equal(diasQueQuedan(venceDe(ahora), ahora), 30);
  assert.ok(diasQueQuedan(venceDe(ahora), ahora + 31 * 86_400_000) < 0, 'pasado el plazo es negativo: se ve en rojo');
  assert.match(textoDeLaBaja('negocio', 'Estudio Luna').que, /«Estudio Luna» entero/);
  assert.match(textoDeLaBaja('persona', 'Estudio Luna').que, /Tu negocio sigue/);
  assert.equal(textoDeLaBaja('persona', null).plan, null, 'una persona sola no corta el plan del negocio');
});

test('2. el super admin, quien mira a otro y una sesión sin fila no piden nada', () => {
  for (const k of ['superAdmin', 'mirando', 'sinFila']) assert.equal(R[k].ok, false, k);
  assert.equal(R.filasDespuesDeLosNo, 0, 'y no queda ningún pedido anotado');
});

test('3. un closer se va él: el negocio y su dueño siguen como estaban', () => {
  assert.equal(R.closer.ok, true);
  assert.equal(R.closer.alcance, 'persona');
  assert.equal(R.closerEstado, 'suspendido');
  assert.equal(R.negocioTrasCloser, 'activo');
  assert.equal(R.dueñoTrasCloser, 'activo');
});

test('4. el segundo toque devuelve el mismo pedido: ni otra fila ni otro mail', () => {
  assert.equal(R.closerOtraVez.yaEstaba, true);
  assert.equal(R.closerOtraVez.hasta, R.closer.hasta);
  assert.equal(R.filasDelCloser, 1);
  assert.equal(R.mailsDelSegundoToque, 0);
});

test('5. el último admin se lleva el negocio: se pausa, se suspende, y queda la marca con el plazo', () => {
  assert.equal(R.dueño.alcance, 'negocio');
  assert.equal(R.dueñoEstado, 'suspendido');
  assert.equal(R.negocioPausado, 'pausado');
  assert.equal(R.filaDueño.alcance, 'negocio');
  assert.equal(R.filaDueño.negocio, 'Estudio Luna');
  assert.equal(R.filaDueño.estado, 'pendiente');
  assert.equal(R.filaDueño.vence_at, R.dueño.hasta);
  assert.equal(diasQueQuedan(R.dueño.hasta, Date.now()), 30);
});

test('6. con otro admin adentro no se borra el negocio; cuando queda uno solo, sí', () => {
  assert.equal(R.deDos.alcance, 'persona');
  assert.equal(R.deDosNegocio, 'activo');
  assert.equal(R.deDosUltimo.alcance, 'negocio', 'el primero ya está suspendido: no cuenta como otro admin');
});

test('6b. alguien del equipo de MaKo, admin de la plataforma sin ser super admin, no la pausa', () => {
  assert.equal(R.plataforma.alcance, 'persona');
  assert.equal(R.plataformaEstado, 'activo');
});

test('7. el negocio de prueba anota pero no apaga: el próximo revisor de la tienda tiene que poder entrar', () => {
  assert.equal(R.prueba.ok, true, 'la pantalla le dice lo mismo que a cualquiera');
  assert.equal(R.pruebaEstado, 'activo');
  assert.equal(R.pruebaNegocio, 'activo');
  assert.equal(R.filaPrueba.prueba, true);
  assert.equal(R.pruebaEjecutar.ok, false, 'y no se ejecuta');
});

test('8. ejecutar a una persona la borra, le manda el mail y deja la constancia sin sus datos', () => {
  assert.equal(R.ejecutarCloser.ok, true);
  assert.equal(R.closerBorrado, true);
  assert.deepEqual(R.mailFinal.map((c: { to: string }) => c.to), ['p3@test.com']);
  assert.match(R.mailFinal[0].asunto, /se eliminó/);
  assert.equal(R.filaCloserCerrada.estado, 'hecha');
  for (const k of ['email', 'nombre', 'negocio']) assert.equal(R.filaCloserCerrada[k], null, `${k} sigue en la constancia`);
  assert.ok(R.filaCloserCerrada.cerrada_at);
});

test('9. el negocio entero no se ejecuta con un toque: va por el nombre escrito', () => {
  assert.equal(R.negocioNoSeEjecutaAca.ok, false);
  assert.match(R.negocioNoSeEjecutaAca.error, /nombre escrito/);
  assert.equal(R.dueñoSigue, true);
});

test('10. cancelar devuelve lo que el pedido apagó', () => {
  assert.equal(R.cancelar.ok, true);
  assert.equal(R.dueñoTrasCancelar, 'activo');
  assert.equal(R.negocioTrasCancelar, 'activo');
});

test('11. borrar un negocio se lleva sus archivos, y cierra su pedido con el mail que le prometimos', () => {
  assert.equal(R.borrado.ok, true, R.borrado.error);
  assert.ok(R.borradosStorage.some((b: string) => b.includes('contrato.pdf')), `los archivos quedaron en Storage: ${JSON.stringify(R.borradosStorage)}`);
  assert.ok(R.borradosStorage.includes('archivero:grupos/40/foto-del-grupo.jpg'), `lo del grupo de la app quedó en Storage: ${JSON.stringify(R.borradosStorage)}`);
  assert.deepEqual(R.mailAlBorrar.map((c: { to: string }) => c.to), ['p7@test.com']);
  assert.equal(R.filaBorrado.estado, 'hecha');
  assert.equal(R.filaBorrado.email, null);
});

test('11b. lo que se confirma es lo que se ejecuta: si cambió, no apaga nada', () => {
  assert.equal(R.alcanceViejo.ok, false);
  assert.equal(R.alcanceViejo.status, 409);
  assert.deepEqual(R.tras409, { pendientes: 0, estado: 'activo', negocio: 'activo' });
  assert.match(sinComentarios(leer('app/api/cuenta/eliminar/route.ts')), /pedirBajaDeMiCuenta\(body\.alcance === 'persona'/);
  for (const f of ['app/m/cuenta/EliminarCuentaM.tsx', 'app/perfil/EliminarCuenta.tsx']) assert.match(leer(f), /alcance: estado\?\.puede \? estado\.alcance : null/, f);
});

test('11c. cancelar devuelve sólo lo que el pedido apagó', () => {
  assert.equal(R.yaPausado.fila.pauso_negocio, false, 'ya estaba pausado');
  assert.equal(R.yaPausado.fila.suspendio_usuario, true);
  assert.equal(R.cancelarYaPausado.ok, true);
  assert.equal(R.sigueePausado, 'pausado', 'un negocio pausado por impago sigue pausado');
  assert.equal(R.vuelveLaPersona, 'activo');
});

test('11d. el último admin no se borra suelto', () => {
  assert.equal(R.ultimoAdmin.ok, false);
  assert.match(R.ultimoAdmin.error, /último admin/);
});

test('11e. si el mail final no sale, el correo se queda y se dice', () => {
  assert.equal(R.conMailCaido.ok, true, 'la persona ya se borró');
  assert.equal(R.filaMailCaido.estado, 'hecha');
  assert.equal(R.filaMailCaido.email, 'p14@test.com');
  assert.match(R.filaMailCaido.notas, /No salió el mail final/);
});

test('11f. con algo que quedó no se le dice «con todos sus datos», y se termina a mano cuando el negocio ya no está', () => {
  assert.equal(R.conAviso.mails, 0);
  assert.equal(R.conAviso.fila.estado, 'pendiente');
  assert.match(R.conAviso.fila.notas, /Se borró, y quedó: wa-media/);
  assert.equal(R.terminarExiste.ok, false, 'el negocio todavía existe');
  assert.equal(R.terminar.ok, true);
  assert.equal(R.terminada.estado, 'hecha');
  assert.equal(R.terminada.email, null);
  const r = sinComentarios(leer('app/api/admin/workspaces/route.ts'));
  assert.match(r, /await cerrarBajasDelNegocio\(body\.id, admin\.email, r\.avisos\)/);
  assert.match(r, /export const maxDuration = 300;/);
  const reset = sinComentarios(leer('lib/reset-workspace.ts'));
  for (const b of ["'chats-email'", "'lead-notas'", "'portadas'", "'avatars'"]) assert.ok(reset.includes(b), `${b}: sus archivos quedarían`);
  assert.match(reset, /await runWithWorkspace\(ws, \(\) => borrarVoz\(/, 'la voz, con la clave de ESE negocio');
});

test('12. cada pedido le llega a equipo@: el plazo no depende de abrir una pantalla', () => {
  const alEquipo = R.correos.filter((c: { asunto: string }) => /^Eliminar cuenta:/.test(c.asunto));
  assert.ok(alEquipo.length >= 3, `sólo ${alEquipo.length}`);
  assert.ok(R.correos.some((c: { asunto: string; to: string }) => /Recibimos tu pedido/.test(c.asunto) && c.to === 'p3@test.com'), 'y la persona recibe la fecha');
});

test('13. la ruta pide la confirmación y es con sesión; las dos páginas de la tienda son públicas y sólo se leen', () => {
  const ruta = sinComentarios(leer('app/api/cuenta/eliminar/route.ts'));
  assert.match(ruta, /if \(body\?\.confirmar !== CONFIRMACION_BAJA\) return/);
  assert.equal(CONFIRMACION_BAJA, 'eliminar');
  assert.equal(esPublica('/api/cuenta/eliminar'), false, 'tiene que ser con sesión');
  for (const p of ['/eliminar-cuenta', '/soporte']) {
    assert.equal(esPublica(p), true, `${p}: el revisor la abre sin cuenta`);
    assert.equal(esPublicaSoloLeer(p), true, p);
    assert.equal(decidirDesvio(p).tipo, 'nada', `${p}: el desvío del teléfono no la tapa`);
  }
  const pag = leer('app/eliminar-cuenta/page.tsx');
  assert.match(pag, /la app <strong>MaKo<\/strong>/, 'Play pide que nombre la app o al desarrollador');
  assert.match(pag, /Eliminar mi cuenta/);
});

test('14. dónde se pide: en el teléfono y en la computadora, y nunca mirando a otro', () => {
  assert.match(sinComentarios(leer('app/m/cuenta/CuentaM.tsx')), /\{!datos\.vista && <ListaM><EliminarCuentaM \/><\/ListaM>\}/);
  assert.match(sinComentarios(leer('app/perfil/page.tsx')), /\{!vista\.deOtro && <EliminarCuenta \/>\}/);
  assert.match(sinComentarios(leer('app/admin/AdminView.tsx')), /<BajasDeCuenta vuelta=/);
  const r = sinComentarios(leer('app/api/admin/workspaces/route.ts'));
  assert.ok(r.indexOf('await cerrarBajasDelNegocio(body.id, admin.email') > r.indexOf('await eliminarWorkspace(body.id'), 'se cierra después de borrar');
});

test('15. la política de privacidad dice lo que hay', () => {
  const p = leer('app/privacidad/page.tsx');
  assert.doesNotMatch(p, /Tampoco existe un botón de «borrar mi cuenta»/);
  assert.match(p, /Puedes eliminar tu cuenta cuando quieras/);
  assert.match(p, /href="\/eliminar-cuenta"/);
  assert.match(p, /audio del micrófono/);
  assert.match(p, /APNs en iPhone/);
  assert.doesNotMatch(leer('app/terminos/page.tsx'), /hoy ese paso lo hacemos\s+nosotros a mano/);
});

test('16. la marca sobrevive a lo que anota: sin FK y fuera de las tablas de inquilino', () => {
  const sql = leer('supabase/migrations/0371_bajas_cuenta.sql');
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /references\s/i);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /workspace_id/);
  assert.ok(!(TABLAS_DE_INQUILINO as readonly string[]).includes('bajas_cuenta'), 'vaciar el negocio la borraría');
  assert.match(sql, /where estado = 'pendiente'/);
  assert.match(sql, /ORDEN DE DESPLIEGUE/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 17 / 0; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · el closer se lleva el negocio                → 16 / 1 (1)
//   · la plataforma se pausa con un toque          → 15 / 2 (1 y 6b)
//   · el super admin puede pedirlo                 → 15 / 2 (1 y 2)
//   · se puede pedir mirando a otro                → 15 / 2 (1 y 2)
//   · el negocio de prueba se apaga                → 16 / 1 (7)
//   · el pedido no suspende a la persona           → 14 / 3 (3, 5 y 10)
//   · el pedido no pausa el negocio                → 16 / 1 (5)
//   · la fila cerrada se queda con el email        → 15 / 2 (8 y 11)
//   · un negocio entero se ejecuta con un toque    → 15 / 2 (9 y 10)
//   · el segundo toque no reconoce el duplicado    → 16 / 1 (4)
//   · eliminarWorkspace no borra los archivos      → 16 / 1 (11)
//   · cancelar no despausa                         → 16 / 1 (10)
//   · /soporte fuera de PUBLICOS                   → 16 / 1 (13)
//   · la privacidad vuelve a decir que no existe   → 16 / 1 (15)
//   · (4/11/2026) sin `archivero/grupos/<ws>/` en CARPETAS_APARTE → 21 / 1 (11): lo subido al grupo de la app quedaba en Storage
