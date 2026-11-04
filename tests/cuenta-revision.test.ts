// =============================================================================
// La cuenta de revisión de las tiendas, CORRIENDO (4/11/2026)
// =============================================================================
// Esa contraseña se la damos a los revisores de Google Play y App Store, o sea a terceros. La revisión del 4/11 encontró que los tests
// de antes eran 19 regex sobre el código y 12 pruebas de funciones puras: ninguno corría un envío, una entrada ni un ticket. Éste corre lo
// real (tests/_cuenta-revision-hijo.ts y tests/_cuenta-revision-script-hijo.ts, sobre el PostgREST de mentira y con `fetch` contado):
//
//   A. no le escribe a nadie (mail y WhatsApp), ni con la base caída, ni desde un cron de su negocio; un closer común, sí;
//   B. su sesión muere al rotar, al mudarla o al subirla a admin; no entra a otro negocio; no entra con su negocio sucio;
//   C. su ticket se guarda sin despacho y no le llega al Cerebro;
//   E. no conecta una computadora; F. Google la rechaza; G. avisa cada entrada y cada intento fallido, con la IP;
//   y el script: crea su negocio propio, nunca pisa el archivo de la contraseña, la rotación limpia lo que sobreviviría.
//
// Correr: node --import tsx --test tests/cuenta-revision.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (4/11/2026, base 9 / 0, y 10 / 0 desde la segunda revisión; una rotura por vez, restaurada de memoria):
//   · sendEmail sin la guarda                                       → 8 / 1 (A)
//   · la guarda sin mirar la cookie (sólo `getUsuarioActual`)      → 8 / 1 (A, la base caída)
//   · enviarTexto sin la guarda                                     → 8 / 1 (A)
//   · contextoDeAgencia sin el corte                                → 8 / 1 (B)
//   · la entrada sin medir el negocio                               → 8 / 1 (B)
//   · crearTicket sin el corte de la cuenta                         → 8 / 1 (C)
//   · el Runner sin `.neq(workspace_id)`                            → 8 / 1 (C)
//   · el callback de Google sin el rechazo                          → 8 / 1 (F)
//   · el script escribiendo el archivo sin `wx` y sin nombre nuevo  → 8 / 1 (el script)
//   La segunda revisión (base 10 / 0):
//   · las tareas de una reunión sin la guarda (caen a la línea de MaKo) → 9 / 1 (A, la línea de MaKo)
//   · el bot de MaKo (lib/mako-salida.ts) sin la guarda                → 9 / 1 (A, la línea de MaKo)
//   · `antesDeEscribir` (lib/linea-freno.ts) sin la guarda             → 9 / 1 (A, la línea de MaKo)
//   · la entrada sin rechazar la fila tocada (`rol_ws` cambiado)        → 9 / 1 (B y G)
//   · el script siguiendo después de una limpieza que falló            → 9 / 1 (el script)
//   · revertir --total sin mirar el nombre del negocio                 → 9 / 1 (el script)
//   · revertir --total sin mirar si hay alguien más adentro            → 9 / 1 (el script)
//   · revertir --corte sin suspender la fila                           → 9 / 1 (el script: la relectura no da «suspendido»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTIVO_ENVIO_EN_REVISION, WS_REVISION } from '../lib/cuenta-revision-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const correr = (hijo: string): Record<string, any> => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', hijo)], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 240_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const i = salida.indexOf('@@RESULTADO@@');
  assert.ok(i >= 0, `el hijo ${hijo} no devolvió resultado`);
  return JSON.parse(salida.slice(i + '@@RESULTADO@@'.length).trim().split('\n')[0]);
};
// Uno por archivo, perezoso: un hijo que tira cae ADENTRO de un test, no al cargar.
let _r: ReturnType<typeof correr> | null = null;
const R = () => (_r ??= correr('_cuenta-revision-hijo.ts'));
let _s: ReturnType<typeof correr> | null = null;
const S = () => (_s ??= correr('_cuenta-revision-script-hijo.ts'));
const NO_SALE = { ok: false, error: MOTIVO_ENVIO_EN_REVISION, salieron: 0 };

test('A. el correo: a un tercero no sale, al equipo sí; un closer común manda como siempre', () => {
  assert.equal(R().sesionRevision, 'revision', 'el pedido de mentira no tenía la sesión de la cuenta: lo de abajo no mediría nada');
  assert.deepEqual(R().revisionATercero, NO_SALE, 'un mail de MaKo a cualquier dirección (el invitarNuevoAlumnoAction de la revisión)');
  assert.deepEqual(R().revisionAVarios, NO_SALE, 'con el equipo en la lista, el tercero no se cuela');
  assert.deepEqual(R().revisionAlEquipo, { ok: true, error: null, salieron: 1 });
  assert.deepEqual(R().closerATercero, { ok: true, error: null, salieron: 1 }, 'el corte es de la cuenta, no de todos');
  assert.deepEqual(R().cronDelNegocioDeRevision, NO_SALE, 'un cron o un flujo de su negocio, sin pedido');
  assert.deepEqual(R().cronDeOtro, { ok: true, error: null, salieron: 1 });
  // Con la base caída la sesión no vale (fail-closed), y aun así no sale nada: la cookie se lee por su firma.
  assert.equal(R().sesionConLaBaseCaida, null);
  assert.deepEqual(R().revisionConLaBaseCaida, NO_SALE);
});

test('A. WhatsApp: nunca, y sin tocar Evolution; un closer común, sí', () => {
  assert.deepEqual(R().whatsappRevision, { ok: false, error: MOTIVO_ENVIO_EN_REVISION, aEvolution: 0 });
  assert.deepEqual(R().whatsappCloser, { ok: true, error: null, aEvolution: 1 });
});

test('A. la línea de MaKo tampoco: las tareas de una reunión no caen a ella, el bot no sale y ninguna escritura a Evolution pasa', () => {
  assert.deepEqual(R().tareasRevision, { wa: { ok: false, error: MOTIVO_ENVIO_EN_REVISION }, aEvolution: 0 }, 'cayó a la línea de MaKo');
  assert.deepEqual(R().botRevision, { ok: false, error: MOTIVO_ENVIO_EN_REVISION, aEvolution: 0 }, 'el bot de MaKo le escribió');
  assert.equal(R().lineaRevision, MOTIVO_ENVIO_EN_REVISION, 'una escritura por el `ev` de mako-grupo pasaba');
  assert.equal(R().lineaRevisionLeer, null, 'una lectura sigue andando');
  assert.equal(R().lineaCloser, null, 'el corte es de la cuenta, no de todos');
});

test('B. la sesión: muere al rotar la contraseña, al mudarla de negocio y al subirla a admin', () => {
  assert.equal(R().sesionDespuesDeRotar, null, 'una cookie de antes de rotar');
  assert.equal(R().sesionMudada, null, 'la fila en otro negocio');
  assert.equal(R().sesionDeAdmin, null, 'la fila con rol_ws admin');
  assert.equal(R().sesionDeVuelta, 'revision', 'el control: con la fila como era, vale');
  assert.equal(R().seguridad, 403, 'no cambia su seguridad (y con eso, la contraseña que tienen Play y Apple)');
});

test('B. no entra a otro negocio: una cookie de agencia válida no le sirve', () => {
  assert.equal(R().agenciaRevision, null);
  assert.equal(R().agenciaCloser, 51, 'el control: la misma cookie, en un closer común, entra');
});

test('B y G. la entrada: con su negocio sucio, 503 sin sesión; limpio, la sesión marcada; cada una avisa con la IP', () => {
  assert.deepEqual(R().entradaConUnaLinea, { status: 503, conSesion: false, token: null }, 'una línea de WhatsApp en su negocio');
  assert.equal(R().entradaConUnaCredencial, 503, 'una credencial en su negocio');
  assert.deepEqual(R().avisoSucia, [{ to: 'equipo@hola-mako.com', ip: true }]);
  assert.deepEqual(R().entradaLimpia, { status: 200, conSesion: true, mfa: 'revision' });
  assert.deepEqual(R().avisoLimpia, [{ to: 'equipo@hola-mako.com', ip: true }]);
  assert.equal(R().rastro, 1, 'la entrada quedó anotada');
  assert.deepEqual(R().entradaSinRastro, { status: 503, conSesion: false }, 'sin rastro, no entra');
  assert.deepEqual(R().entradaConLaFilaTocada, { status: 403, conSesion: false, avisos: 1 }, 'con el `rol_ws` cambiado entraba como un closer común, sin la marca y sin segundo factor');
  // El intento fallido avisa DESPUÉS de contestar: esperarlo haría tardar más a ese correo, y eso contaría que existe.
  assert.deepEqual(R().intentoFallido, { status: 401, conSesion: false, avisosAntesDeContestar: 0, avisos: [{ to: 'equipo@hola-mako.com', ip: true }] });
});

test('C. su ticket se guarda sin despacho y no le llega al Cerebro; el mismo, de otro negocio, sí se despacha', () => {
  assert.deepEqual(R().ticketRevision, { despacho: null, estado: 'esperando_decision', cerebro: 'no_entregado', intentos: 5, autoArreglo: false });
  assert.deepEqual(R().ticketOtro, { despacho: 'runner', estado: 'en_curso', cerebro: 'pendiente', intentos: 0, autoArreglo: true },
    'el control: con el mismo texto y otro negocio, el triage lo manda al arreglo automático');
  // Dos tickets esperando a Martín, uno de cada negocio, y el de revisión marcado «pendiente» a mano: al Cerebro le llega uno.
  assert.deepEqual(R().nuevosParaElCerebro, { total: 1, estados: ['esperando_decision', 'esperando_decision'] });
});

test('E y F. no conecta una computadora, y Google no le da sesión', () => {
  assert.equal(R().codigoPc, 403);
  assert.equal(R().codigosCreados, 0);
  assert.deepEqual(R().google, { status: 307, destino: 'https://mako.test/login?error=no-autorizado', conSesion: false, pidioAGoogle: true });
});

test('«Eliminar mi cuenta»: se anota como prueba y la cuenta sigue andando para el próximo revisor', () => {
  assert.deepEqual(R().baja, { ok: true, prueba: true, estadoDeLaCuenta: 'activo' });
});

test('el script: su negocio propio, el archivo nunca se pisa, --rotar limpia, y frena con algo de verdad adentro', () => {
  const s = S();
  assert.equal(s.primera, 0, JSON.stringify(s.consola));
  assert.equal(s.negocio, WS_REVISION);
  assert.deepEqual(s.persona, { ws: WS_REVISION, rol: 'usuario', rolWs: 'closer', estado: 'activo' });
  assert.deepEqual(s.archivos1, ['cuenta-revision.txt']);
  assert.equal(s.conContrasena, true);
  assert.equal(s.leads.length, 6);
  assert.ok(s.leads.every((e: string) => e.endsWith('@example.com')), 'sólo leads de ejemplo');
  // Sin --rotar no toca la contraseña que tienen Play y Apple.
  assert.equal(s.segundaSinRotar, 1);
  assert.equal(s.mismaContrasena, true);
  assert.deepEqual(s.archivos2, ['cuenta-revision.txt']);
  // Con --rotar: un archivo nuevo, el viejo intacto, y fuera la computadora, los avisos y el segundo factor.
  assert.equal(s.rotar, 0);
  assert.equal(s.archivos3.length, 2);
  assert.equal(s.archivoViejoIntacto, true);
  assert.equal(s.contrasenaNueva, true);
  assert.equal(s.pcRevocada, true);
  assert.equal(s.avisosDelTelefono, 0);
  assert.equal(s.segundoFactor, 0);
  assert.equal(s.leadsDespues, 6, 'no vuelve a cargar los de ejemplo');
  // Algo de verdad en su negocio: frena antes de tocar la contraseña, y no deja un archivo nuevo.
  assert.equal(s.conCredencial, 1);
  assert.equal(s.noTocoLaContrasena, true);
  assert.equal(s.conProducto, 1);
  assert.equal(s.conLeadDeVerdad, 1);
  assert.equal(s.archivosAlFinal, 2);
  // Si no puede sacar lo que sobreviviría a rotarla, sale con error y no toca la contraseña (antes: «⚠️» y un ✓ al final).
  assert.equal(s.limpiezaFallida, 1, JSON.stringify(s.consola));
  assert.equal(s.limpiezaNoTocoLaContrasena, true);
  assert.equal(s.limpiezaSinArchivoNuevo, true);
  // Revertir (scripts/tiendas-cuenta-revision-revertir.mts): sin elegir no hace nada; --corte la suspende y no borra; --total frena si el
  // negocio no es el de demostración y, si lo es, borra la persona y el negocio, y releyéndolo.
  assert.equal(s.revertirSinElegir, 1);
  assert.equal(s.corte, 0, JSON.stringify(s.consola));
  assert.deepEqual(s.cortada, { estado: 'suspendido', negocio: true });
  assert.equal(s.totalConOtraPersona, 1, 'borró un negocio con otra persona adentro');
  assert.equal(s.totalConOtroNombre, 1, 'borró un 900001 que no se llama como el de demostración');
  assert.deepEqual(s.nadaBorradoAntes, { negocio: true, persona: true });
  assert.equal(s.total, 0, JSON.stringify(s.consola));
  assert.deepEqual(s.despuesDelTotal, { negocio: false, persona: false, leads: 0 });
  assert.equal(s.totalOtraVez, 0, 'otra vez no hay nada que borrar, y eso no es un error');
  assert.equal(s.contrasenaEnLaConsola, false, 'la contraseña salió por la consola');
});
