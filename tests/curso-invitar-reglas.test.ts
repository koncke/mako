// =============================================================================
// curso-invitar-reglas — invitar a UN curso: qué abre el acceso, de quién fue el correo, el borrador
// =============================================================================
// El feedback del audio del 08/10/2026 a la noche (docs/feedback-curso-08oct-noche.md):
//   6. «el mail nombra DOS productos» · 7. «tengo acceso a los dos cursos, cuando sólo le había invitado
//   al curso de Fiesta Music» · 9. el formulario pierde lo escrito · 10. el correo, configurarlo ahí
//   mismo · 11. el teléfono, opcional · 12. «sólo aparecen los clientes ganados».
//
// Lo que se EJECUTA es lo puro (lib/curso-invitar-reglas.ts). Lo que se LEE del fuente son los cableados
// que el typecheck no ve: que TODO lugar que decide qué cursos ve el alumno pase por la misma función, que
// la invitación por producto llegue hasta la escritura, y que la pantalla use el borrador y el formulario
// de Integraciones.
//
// PROBADO ROMPIÉNDOLO: ver el bloque «ROTURAS» al final, con los números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import {
  saneaProductos, productosVisibles, abreElProducto, productosTrasInvitar, invitadoAlProducto, entroAlProducto,
  yaSeLeDio, accesoEnProducto, correoQueFallo, leerBorrador, borradorConAlgo, claveBorrador, BORRADOR_VACIO,
} from '../lib/curso-invitar-reglas';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función: desde su firma hasta el comienzo de lo que viene después. */
const bloque = (src: string, firma: string, hasta: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no está: ${firma}`);
  const fin = src.indexOf(hasta, ini + firma.length);
  assert.ok(fin > ini, `no encontré el final de ${firma}`);
  return src.slice(ini, fin);
};

// ── Qué abre un acceso (punto 7) ───────────────────────────────────────────────

test('saneaProductos: null es «todos»; lo ilegible es «ninguno», nunca «todos»', () => {
  assert.equal(saneaProductos(null), null);
  assert.equal(saneaProductos(undefined), null);
  assert.deepEqual(saneaProductos([39, 10]), [39, 10], 'en el orden en que llegaron');
  assert.deepEqual(saneaProductos(['10', '39', '10']), [10, 39], 'un bigint puede llegar como texto, y sin repetir');
  assert.deepEqual(saneaProductos('{10,39}'), [10, 39], 'el literal de Postgres');
  assert.deepEqual(saneaProductos([]), [], 'vacío es «ninguno»');
  assert.deepEqual(saneaProductos([0, -1, 1.5, 'x', null, '__proto__', 7]), [7]);
  // ⚠️ Lo ilegible NO abre todo.
  for (const malo of [{ a: 1 }, 'todo', 42, true]) assert.deepEqual(saneaProductos(malo), [], `«${String(malo)}» abriría todo`);
});

test('productosVisibles: los suyos, cruzados con lo que abre su acceso, en el orden del catálogo', () => {
  const suyos = [10, 39, 50];
  assert.deepEqual(productosVisibles(suyos, null), [10, 39, 50], 'sin lista: todos (lo de antes)');
  assert.deepEqual(productosVisibles(suyos, [39]), [39], 'invitado a Fiesta Music: sólo Fiesta Music');
  assert.deepEqual(productosVisibles(suyos, [50, 10]), [10, 50], 'en el orden de sus productos, no el de la lista');
  assert.deepEqual(productosVisibles(suyos, [77]), [], 'un producto del que ya no es cliente no se abre');
  assert.deepEqual(productosVisibles(suyos, []), []);
  assert.equal(abreElProducto(null, 5), true);
  assert.equal(abreElProducto([4], 5), false);
});

test('productosTrasInvitar: suma, nunca reemplaza; «todos» se achica sólo si nadie lo usó', () => {
  // Sin producto (la ficha, el CRM sin su producto): no se toca.
  assert.equal(productosTrasInvitar({ productos: null }, null), null);
  assert.deepEqual(productosTrasInvitar({ productos: [10] }, undefined), [10]);
  // Sin fila: sólo ése.
  assert.deepEqual(productosTrasInvitar(null, 39), [39]);
  // Una lista: se le SUMA.
  assert.deepEqual(productosTrasInvitar({ productos: [10] }, 39), [10, 39]);
  assert.deepEqual(productosTrasInvitar({ productos: [10, 39] }, 39), [10, 39], 'ya lo tenía');
  // «Todos» y nadie lo usó (la fila nació copiando el link en la ficha): la invitación lo acota.
  assert.deepEqual(productosTrasInvitar({ productos: null, invitacionEnviadaAt: null, linkEnviadoAt: null, ingresos: 0 }, 39), [39]);
  // «Todos» y ya se le dio (el mail, el WhatsApp con el link, o entró): sigue en todos.
  assert.equal(productosTrasInvitar({ productos: null, invitacionEnviadaAt: '2026-10-09T01:50:20Z' }, 39), null);
  assert.equal(productosTrasInvitar({ productos: null, linkEnviadoAt: '2026-10-09T01:50:20Z' }, 39), null);
  assert.equal(productosTrasInvitar({ productos: null, ingresos: 1 }, 39), null);
  assert.equal(yaSeLeDio(null), false);
});

test('«ya invitado» y «ya entró» son POR PRODUCTO: invitado a otro curso no es invitado a éste', () => {
  const aFiesta = { productos: [39], invitacionEnviadaAt: '2026-10-09T01:50:20Z', ingresos: 2 };
  assert.equal(invitadoAlProducto(aFiesta, 39), true);
  assert.equal(invitadoAlProducto(aFiesta, 10), false, 'el de Fiesta Music figuraba invitado a Service Delivery');
  assert.equal(invitadoAlProducto({ productos: null, invitacionEnviadaAt: 'x' }, 10), true, 'invitado a todos');
  assert.equal(invitadoAlProducto({ productos: [10], invitacionEnviadaAt: null }, 10), false, 'sin mail no hay invitación');
  assert.equal(invitadoAlProducto(null, 10), false);
  assert.equal(entroAlProducto(aFiesta, 39), true);
  assert.equal(entroAlProducto(aFiesta, 10), false);
  assert.equal(entroAlProducto({ productos: null, ingresos: 1 }, 10), true);
});

test('accesoEnProducto: la fila vista desde OTRO curso se ofrece para invitar; sin la lista leída, no se afirma nada', () => {
  const fila = { estado: 'activo' as const, ingresos: 0, ultimoIngresoAt: null, email: 'a@b.mx', invitacionEnviadaAt: '2026-10-09T01:50:20Z', productos: [39] };
  assert.equal(accesoEnProducto(fila, 39), fila, 'en su curso, tal cual');
  assert.equal(accesoEnProducto(fila, 10)!.invitacionEnviadaAt, null, 'en otro curso, «sin invitar»');
  assert.equal(accesoEnProducto(fila, 10)!.email, 'a@b.mx', 'el email anterior sigue prellenando');
  const sinLista = { estado: 'activo' as const, ingresos: 0, ultimoIngresoAt: null, invitacionEnviadaAt: 'x' };
  assert.equal(accesoEnProducto(sinLista, 10), sinLista, 'una lectura que no trajo la lista vale como antes');
  assert.equal(accesoEnProducto({ ...fila, productos: null }, 10)!.invitacionEnviadaAt, fila.invitacionEnviadaAt, '«todos» abre éste');
  assert.equal(accesoEnProducto(null, 10), null);
});

// ── De quién fue el correo (punto 10) ──────────────────────────────────────────

test('correoQueFallo: configuración del negocio es «tuyo», la de MaKo es «mako», y lo demás no se configura', () => {
  // El del audio: sin remitente iba por MaKo, y la key que faltaba era la de la plataforma.
  assert.equal(correoQueFallo({ error: 'RESEND_API_KEY no configurada', via: 'mako' }), 'mako');
  assert.equal(correoQueFallo({ error: 'RESEND_API_KEY no configurada', via: 'negocio' }), 'tuyo');
  assert.equal(correoQueFallo({ error: 'el correo de MaKo todavía no está configurado (remitente de prueba)', via: 'mako' }), 'mako');
  assert.equal(correoQueFallo({ error: 'The leandrotejado.com domain is not verified. Please, add and verify your domain on https://resend.com/domains', via: 'negocio' }), 'tuyo');
  assert.equal(correoQueFallo({ error: 'API key is invalid', via: 'negocio' }), 'tuyo');
  assert.equal(correoQueFallo({ error: 'Invalid `from` field. The email address needs to follow the `email@example.com` format.', via: 'negocio' }), 'tuyo');
  // Sin saber por dónde salió, lo de configuración se lee como nuestro: no se culpa a quien invita.
  assert.equal(correoQueFallo({ error: 'RESEND_API_KEY no configurada' }), 'mako');
  // La red, un 5xx o el límite: se reintenta, no se configura.
  for (const e of ['fetch failed', 'Resend 500', 'Too many requests. You can only make 2 requests per second.', '', null]) {
    assert.equal(correoQueFallo({ error: e, via: 'negocio' }), null, `«${String(e)}» no es de configuración`);
  }
});

// ── El borrador (punto 9) ──────────────────────────────────────────────────────

test('el borrador: lo escrito vuelve, lo raro no, y «También por WhatsApp» nunca vuelve prendido', () => {
  assert.equal(leerBorrador(null), null);
  assert.equal(leerBorrador('no es json'), null);
  assert.equal(leerBorrador('[1,2]'), null);
  const b = leerBorrador(JSON.stringify({
    pestana: 'nuevo',
    nuevo: { nombre: 'Leandro prueba', email: 'l@x.mx', telefono: '', empresa: 'X', sinCobro: true, porWhatsapp: true },
    clientes: { elegidos: [21, '22', 21, -3, 'x'], emails: { 21: 'a@b.mx', __proto__: 'c', '0': 'z', abc: 'd', 22: 5 } },
  }))!;
  assert.equal(b.pestana, 'nuevo');
  assert.deepEqual(b.nuevo, { nombre: 'Leandro prueba', email: 'l@x.mx', telefono: '', empresa: 'X', sinCobro: true });
  assert.ok(!('porWhatsapp' in b.nuevo), 'una casilla que le escribe a alguien volvió prendida de un borrador');
  assert.deepEqual(b.clientes.elegidos, [21, 22]);
  assert.deepEqual(b.clientes.emails, { 21: 'a@b.mx' });
  assert.equal(borradorConAlgo(BORRADOR_VACIO), false, 'un borrador vacío no deja una clave colgada');
  assert.equal(borradorConAlgo(b), true);
  assert.equal(claveBorrador(null, 39), 'mako.invitar.0.39');
  assert.equal(claveBorrador(10, 39), 'mako.invitar.10.39', 'por workspace: la pestaña del super admin puede mirar otro');
});

// ── Los cableados ──────────────────────────────────────────────────────────────

const DATOS = sinComentarios(leer('lib/curso-datos.ts'));
const NUCLEO = sinComentarios(leer('lib/curso-invitar.ts'));
const ACC = sinComentarios(leer('app/customer-success/curso/invitar-actions.ts'));
const COMP = sinComentarios(leer('app/customer-success/curso/InvitarAlumnos.tsx'));
const MODAL = sinComentarios(leer('app/customer-success/curso/InvitarAlCurso.tsx'));

test('«qué ve el alumno» es UNA función: productosConCasaDelAlumno cruza lo suyo con lo que abre su acceso', () => {
  const f = bloque(DATOS, 'export async function productosConCasaDelAlumno(', 'async function productosQueAbre(');
  assert.match(f, /productosVisibles\(suyos\.productos, abre\)/);
  assert.match(f, /productosQueAbre\(leadId\)/);
  // La lista del CLIENTE, y «no pude leer» tira (no es «abre todo»).
  const q = bloque(DATOS, 'async function productosQueAbre(', 'export async function etapaActualDe(');
  assert.match(q, /\.select\('productos'\)\.eq\('lead_id', leadId\)\.is\('area', null\)\.maybeSingle\(\)/);
  assert.match(q, /if \(error\) throw new Error\(error\.message\);/);
  assert.match(q, /saneaProductos\(/);
  // productosDelAlumno es la MISMA (no una segunda forma de cruzarlos).
  assert.match(bloque(DATOS, 'export async function productosDelAlumno(', 'export async function productosConCasaDelAlumno('), /return \(await productosConCasaDelAlumno\(leadId\)\)\.productos;/);
  // Y la etapa de la entrega es un hecho del kanban: sin lista pasada, los del CLIENTE.
  const u = bloque(DATOS, 'export async function ubicacionEnEntregaDe(', '\n}\n');
  assert.match(u, /productosYaLeidos \?\? import\('@\/app\/customer-success\/entrega'\)\.then\(\(m\) => m\.productosDelCliente\(leadId\)\)/);
  assert.doesNotMatch(u, /productosDelAlumno\(/);
});

/**
 * Quién pregunta qué. ⚠️ Una lista POR NOMBRE con su porqué: un call site nuevo de cualquiera de las dos
 * preguntas hace fallar este test hasta que alguien decide cuál le toca. Medido el 09/10/2026.
 */
const QUE_VE: Record<string, string> = {
  'lib/curso-portal.ts': 'el portal: lo que se dibuja y la clase que se abre',
  'lib/comunidad-datos.ts': 'la comunidad del alumno: de qué comunidades es miembro',
  'lib/curso-mensajes.ts': 'los mensajes del curso: no nombran clases de un curso que no le abre su acceso',
  'lib/curso-propuesta-ia.ts': 'la propuesta de la IA: rellena tareas que el alumno va a ver',
  'lib/curso-invitar.ts': 'el mail sin producto nombra sólo los cursos que ve',
  'lib/curso-datos.ts': 'la definición (productosDelAlumno → productosConCasaDelAlumno)',
  // Sólo el mail del LÍDER de un área: su link se rige por el acceso del cliente, así que nombra lo que
  // ese acceso abre. El resto de la ficha es del EQUIPO y pregunta «de qué es cliente» (la otra lista).
  'app/customer-success/curso-ficha-actions.ts': 'el mail del líder: nombra sólo los cursos que su link abre',
};
const ES_CLIENTE: Record<string, string> = {
  'lib/curso-invitar.ts': '¿es cliente del producto al que se lo invita?',
  'lib/curso-datos.ts': 'la etapa de la entrega (un hecho del kanban) y la definición de lo que ve',
  'app/customer-success/curso/invitar-actions.ts': 'el alta de cero: entra al kanban de ESTE producto y sale de los otros',
  'app/customer-success/actions.ts': 'quitar de un producto (el kanban)',
  'app/customer-success/entrega.ts': 'la definición',
  // Desde el 09/10/2026 (revisión de la corrida): la ficha es del EQUIPO — sus cursos, su casa y agendar
  // una llamada son de todo producto del que es cliente, aunque su acceso todavía no lo abra.
  'app/customer-success/curso-ficha-actions.ts': 'la ficha: sus cursos, su casa y agendar una llamada',
};

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(resolve(RAIZ, dir))) {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const s = statSync(resolve(RAIZ, p));
    if (s.isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(relative('.', p).replace(/\\/g, '/'));
  }
  return out;
}

test('la comunidad: es miembro aquel cuyo acceso ABRE ese producto, no cualquier cliente de él', () => {
  // Revisión del 09/10/2026: `actorDelAlumno` ya miraba «qué ve», y los MIEMBROS no (directorio,
  // conteo, ranking, perfil, @menciones). La lista de arriba no lo veía: busca `productosDelAlumno`, y
  // los miembros salen de `esDelProducto` + el acceso vigente.
  const m = bloque(sinComentarios(leer('lib/comunidad-datos.ts')), 'export async function miembrosDeLaComunidad(', 'export const esMiembroDe');
  assert.match(m, /'curso_accesos', 'id, lead_id, created_at, revocado_at, productos'/);
  assert.match(m, /if \(!a\.revocado_at && abreElProducto\(saneaProductos\(a\.productos\), productoId\)\) vigente\.set\(/);
});

test('todo call site de «qué ve el alumno» y de «de qué es cliente» está clasificado', () => {
  // Se lee el DISCO (no `git ls-files`): un archivo nuevo sin `git add` también cuenta (AGENTS.md). Y se
  // filtra con un `includes` barato antes de sacar comentarios: hay fuentes de 170 KB.
  const candidatos = [...archivos('lib'), ...archivos('app')]
    .map((f) => ({ f, src: leer(f) }))
    .filter((x) => x.src.includes('productosDel') || x.src.includes('productosConCasaDelAlumno'))
    .map((x) => ({ f: x.f, src: sinComentarios(x.src) }));
  const usa = (re: RegExp) => candidatos.filter((x) => re.test(x.src)).map((x) => x.f).sort();
  assert.deepEqual(usa(/\bproductos(DelAlumno|ConCasaDelAlumno)\(/), Object.keys(QUE_VE).sort(), 'un lugar nuevo decide qué cursos ve el alumno sin pasar por la lista');
  assert.deepEqual(usa(/\bproductosDelCliente\(/), Object.keys(ES_CLIENTE).sort(), 'un lugar nuevo pregunta «de qué es cliente»: ¿no es «qué ve»?');
});

test('la invitación a UN producto llega hasta la escritura: el mail, el reclamo y la lista', () => {
  // El núcleo: por producto, los motivos y los cursos; y lo pasa al reclamo y al marcar.
  assert.match(NUCLEO, /productoId != null \? invitadoAlProducto\(deEste, productoId\)/);
  assert.match(NUCLEO, /const cursos = await d\.cursos\(p\.leadId, productoId\);/);
  assert.match(NUCLEO, /if \(cursos === null\) return \{ tipo: 'error'/);
  assert.match(NUCLEO, /d\.reclamar\(p\.leadId, productoId\)/);
  assert.match(NUCLEO, /await d\.marcar\(p\.leadId, correo, autor, productoId\);/);
  // Con producto, el mail nombra SÓLO ése y sólo si es cliente de ése (la regla del kanban).
  assert.match(NUCLEO, /\(await entrega\.productosDelCliente\(leadId\)\)\.productos\.includes\(productoId\) \? \[productoId\] : null/);
  // La escritura: la lista se calcula con la regla, sólo con producto y sólo en la fila del cliente.
  const marcar = bloque(DATOS, 'export async function marcarInvitacion(', 'const RECLAMO_MS');
  assert.match(marcar, /if \(area == null && productoId != null\) \{/);
  assert.match(marcar, /productosTrasInvitar\(previo, productoId\)/);
  assert.match(marcar, /invitando_at: null, \.\.\.productos \}/);
  // El reclamo por producto: invitado a otro curso no frena; invitado a todos sí.
  const reclamar = bloque(DATOS, 'export async function reclamarInvitacion(', 'export async function soltarInvitacion(');
  assert.match(reclamar, /`productos\.not\.cs\.\{\$\{productoId\}\}`/);
  assert.match(reclamar, /base\.is\('invitacion_enviada_at', null\)\.or\(libre\.join\(','\)\)/, 'sin producto, el reclamo de siempre');
  // Lo que se lee del acceso trae la lista.
  assert.match(DATOS, /const COLS_ACCESO = '[^']*\bproductos\b[^']*';/);
  assert.match(DATOS, /productos: saneaProductos\(f\.productos\),/);
});

test('las actions: toda invitación del editor lleva su producto, y «es cliente» es la regla del kanban', () => {
  const clientes = bloque(ACC, 'export async function invitarClientesAction(', 'export async function invitarNuevoAlumnoAction(');
  assert.match(clientes, /if \(productoId == null\) return \{ ok: false, error: 'Falta el producto\.' \};/);
  assert.match(clientes, /reenviar: false, canales, productoId \}\)/);
  const nuevo = bloque(ACC, 'export async function invitarNuevoAlumnoAction(', 'export async function invitarAlCursoDelProductoAction(');
  assert.match(nuevo, /productoId \}\)\);/);
  assert.doesNotMatch(ACC, /productosDelAlumno\(/, 'el editor preguntó «qué ve» donde quería «de qué es cliente»');
  const uno = bloque(ACC, 'export async function invitarAlCursoDelProductoAction(', 'export async function opcionesDeInvitarAction(');
  assert.match(uno, /reenviar: true, productoId: producto \}\)/);
  assert.match(uno, /accesoParaPantalla\(id, ws\)/);
  // El modal de un cliente la usa cuando sabe el producto, y la de la ficha cuando no.
  assert.match(MODAL, /productoId \? await invitarAlCursoDelProductoAction\(leadId, productoId, correo\)\s*: await invitarAlCursoAction\(leadId, correo\)/);
});

test('invitar desde la tarjeta, la tabla Avance y la ficha va al curso donde se está parado', () => {
  // Revisión del 09/10/2026: la prop `productoId` de ModalInvitar, BotonInvitar y CeldaAcceso tenía
  // CERO call sites — desde esas tres puertas se seguía invitando a todos (el bug del audio, por otra
  // puerta), y la tabla de un curso le pintaba «Invitado» a quien sólo lo estaba a otro.
  const app = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  const cursoDe = bloque(app, 'const cursoDe = (leadId: number): CursoDeTarjeta | null => {', '\n  };\n');
  assert.match(cursoDe, /const acceso = accesoEnProducto\(crudo, servicio\.productoId\);/);
  assert.match(cursoDe, /return \{ acceso, productoId: servicio\.productoId, onAcceso:/);
  assert.match(app, /<AvanceCurso etapas=\{p\.etapas\} filas=\{filas\} error=\{null\} onAcceso=\{onAcceso\} productoId=\{productoId\} \/>/);
  assert.match(sinComentarios(leer('app/customer-success/ClienteCard.tsx')), /<ModalInvitar [^>]*productoId=\{curso\.productoId\}/);
  const avance = sinComentarios(leer('app/customer-success/curso/AvanceCurso.tsx'));
  assert.match(avance, /const acceso = productoId != null \? accesoEnProducto\(crudo, productoId\) : crudo;/);
  assert.match(avance, /<CeldaAcceso [^>]*productoId=\{productoId\}/);
  const ficha = sinComentarios(leer('app/customer-success/FichaCurso.tsx'));
  assert.match(ficha, /<Acceso leadId=\{leadId\} curso=\{curso\} editar=\{editar\} productoId=\{prod\?\.productoId \?\? null\} \/>/);
  assert.match(ficha, /const desde = a && productoId != null \? accesoEnProducto\(a, productoId\) : a;/);
  assert.match(ficha, /<BotonInvitar [^>]*acceso=\{desde\}\s*productoId=\{productoId \?\? undefined\}/);
  // La lectura en lote trae qué abre cada acceso, y la traducción de la fila lo deja pasar.
  const admin = sinComentarios(leer('lib/curso-admin.ts'));
  assert.match(admin, /invitacion_enviada_at, productos'\)\.in\('lead_id'/);
  assert.match(admin, /productos: saneaProductos\(f\.productos\),/);
  assert.match(sinComentarios(leer('app/customer-success/curso-ficha-lectura.ts')), /\.\.\.\(a\.productos !== undefined \? \{ productos: a\.productos \} : \{\}\),/);
  // Y la ficha lee el acceso con la lectura que trae la lista (no una copia sin ella).
  const fichaAcc = sinComentarios(leer('app/customer-success/curso-ficha-actions.ts'));
  assert.match(fichaAcc, /return accesoParaPantalla\(leadId, ws\);/);
  // La ficha es del EQUIPO: sus cursos y agendar una llamada preguntan «de qué es cliente»; sólo el mail
  // del líder pregunta «qué ve» (su link abre lo que abre el acceso del cliente). La lista de arriba
  // cuenta ARCHIVOS y este tiene las dos preguntas: sin esto, cambiar una por la otra pasaba en verde.
  assert.match(bloque(fichaAcc, 'async function cursosDelCliente(', 'async function cursosDe('), /= await productosDelCliente\(leadId\);/);
  assert.match(bloque(fichaAcc, 'export async function agendarLlamadaCursoAction(', 'export async function borrarLlamadaCursoAction('),
    /if \(!\(await productosDelCliente\(leadId\)\)\.productos\.includes\(productoId\)\) return/);
  assert.match(bloque(fichaAcc, 'export async function invitarLiderAction(', 'export async function linkDeLiderAction('),
    /const cursos = await cursosDe\(await productosDelAlumno\(leadId\)\);/);
});

test('la pantalla: el borrador en sessionStorage, la lista desde ESTE curso y el correo ahí mismo', () => {
  // La lista «Clientes sin invitar» mira el acceso desde ESTE curso, con la lista de cada acceso leída al
  // abrir (las filas de la página no la traen), del CLIENTE (`area is null`).
  assert.match(COMP, /accesoEnProducto\(conLista, productoId\)/);
  assert.match(COMP, /productosDeLosAccesosAction\(idsFilas\)/);
  assert.match(bloque(DATOS, 'export async function productosDeAccesos(', '\n}\n'), /\.select\('lead_id, productos'\)\.in\('lead_id', ids\.slice\(i, i \+ 200\)\)\.is\('area', null\);/);
  assert.match(COMP, /claveBorrador\(ws, productoId\)/);
  assert.match(COMP, /window\.sessionStorage\.setItem\(clave, JSON\.stringify\(b\)\)/);
  assert.doesNotMatch(COMP, /localStorage/, 'datos de una persona en un almacenamiento que no se borra');
  // Toda lectura y escritura del almacenamiento en try/catch.
  assert.match(bloque(COMP, 'function borradorGuardado(', 'function guardarBorrador('), /try \{ return leerBorrador\(window\.sessionStorage\.getItem\(clave\)\); \} catch \{ return null; \}/);
  assert.match(bloque(COMP, 'function guardarBorrador(', 'export function InvitarAlumnos('), /try \{[\s\S]*\} catch \{/);
  // Lo que salió deja de ser borrador.
  assert.match(COMP, /setBorrador\(\(\) => \(\{ \.\.\.BORRADOR_VACIO\.nuevo \}\)\);/);
  // …y por eso «Volver a invitar» usa el WhatsApp que se pidió AL CREAR: con el borrador vacío, el
  // teléfono es '' y `ofreceWa` ya dice que no (revisión del 09/10/2026).
  assert.match(COMP, /conWhatsapp: ofreceWa && porWhatsapp \}\);/);
  assert.match(bloque(COMP, 'async function reintentar(', 'if (listo) {'), /canales: canalesCon\(listo\.conWhatsapp\)/);
  // El formulario de Integraciones, el mismo de siempre, cargado sólo cuando hace falta.
  assert.match(COMP, /dynamic\(\(\) => import\('@\/app\/integraciones\/ServicioConfigForm'\), \{\s*ssr: false,/);
  assert.match(COMP, /<ServicioConfigForm servicioKey="email"/);
  assert.match(MODAL, /\{correoMal && <CorreoAhiMismo cual=\{correoMal\} \/>\}/);
  // Punto 11 y 12: el teléfono no es obligatorio, y la lista dice que son los ganados.
  // Desde el 12/10/2026 es el selector con banderas (punto 5 del feedback del CRM) adentro de un
  // `Field`: sigue sin `required` y con su «Opcional.».
  assert.match(COMP, /<Field label="Teléfono"(?![^>]*\brequired\b)[^>]*hint="Opcional\./);
  assert.match(COMP, /<TelefonoConPais lada=\{tel\.lada\} numero=\{tel\.numero\}/);
  assert.match(COMP, /Sólo aparecen los clientes ganados\./);
  assert.match(sinComentarios(leer('app/customer-success/curso/invitar-actions.ts')), /if \(!emailUtilizable\(correo\)\) return \{ ok: false, error: 'Ese email no sirve\.' \};/);
});

test('los textos nuevos: cortos y en neutro con TÚ', () => {
  const textos = [
    'Revisa tu correo', 'La API key y el remitente.', 'Falló el correo de MaKo', 'Reintenta, o conecta tu correo: API key y remitente.',
    'Guardado. Vuelve a invitar.', 'Sólo aparecen los clientes ganados.', 'Todavía no tiene clientes.', 'Opcional. Sin él, sólo por correo.',
    'Volver a invitar', 'No es cliente de ese producto.', 'El curso todavía no tiene clases.', 'Falta el producto.',
  ];
  const fuente = COMP + MODAL + ACC + NUCLEO;
  for (const t of textos) {
    assert.ok(fuente.includes(t), `no está «${t}»`);
    assert.ok(t.length <= 60, `«${t}» es largo para una pantalla`);
  }
  assert.deepEqual(marcasDeVoseo(textos.join('\n')), [], 'un texto vosea');
});

test('la migración 0232: la columna, su forma y el orden de despliegue', () => {
  const sql = leer('supabase/migrations/0232_curso_accesos_productos.sql');
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  assert.match(sql, /alter table curso_accesos add column if not exists productos bigint\[\];/);
  assert.match(sql, /check \(productos is null or \(array_position\(productos, null\) is null and cardinality\(productos\) <= 200\)\)/);
  assert.match(sql, /revoke all on curso_accesos from anon, authenticated;/);
  // Ningún backfill: NULL es «todos», lo de antes.
  assert.doesNotMatch(sinComentarios(sql.replace(/^--.*$/gm, '')), /\bupdate\b/i);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 09/10/2026 (scratchpad fb-acceso/romper.mjs: guarda cada archivo en memoria, lo rompe, corre
// los tests y lo reescribe — nunca git —, y compara byte a byte; los 17 volvieron iguales). Con todo en
// su lugar: este archivo 14 pass / 0 fail, y con tests/curso-invitar.test.ts 44 / 0. Cada rotura, sola:
//   1. productosVisibles devolviendo todos los suyos              → 13 / 1 «productosVisibles…»
//   2. saneaProductos con lo ilegible como null («todos»)          → 13 / 1 «saneaProductos…»
//   3. productosTrasInvitar achicando «todos» aunque ya se usó     → 13 / 1 «productosTrasInvitar…»
//   4. productosTrasInvitar REEMPLAZANDO la lista                  → 13 / 1 «productosTrasInvitar…»
//   5. invitadoAlProducto sin mirar el producto                    → 42 / 2 (este y «a UN curso…» del núcleo)
//   6. accesoEnProducto devolviendo la fila tal cual               → 13 / 1 «accesoEnProducto…»
//   7. correoQueFallo culpando al negocio sin saber por dónde iba  → 13 / 1 «correoQueFallo…»
//   8. el borrador devolviendo «También por WhatsApp» prendida     → 13 / 1 «el borrador…»
//   9. productosConCasaDelAlumno sin cruzar con el acceso          → 13 / 1 «"qué ve el alumno" es UNA función…»
//  10. la lista del acceso leída sin `area is null`                → 13 / 1 el mismo
//  11. el núcleo con «ya invitado» sin producto                    → 42 / 2 «la invitación a UN producto…» y «a UN curso…»
//  12. el núcleo marcando sin el producto                          → 42 / 2 los mismos
//  13. invitarClientesAction sin exigir el producto                → 13 / 1 «las actions…»
//  14. el borrador en localStorage                                 → 13 / 1 «la pantalla…»
//  15. el editor preguntando «qué ve» (productosDelAlumno)          → 12 / 2 «todo call site… clasificado» y «las actions…»
//  16. marcarInvitacion escribiendo la lista sin producto           → 13 / 1 «la invitación a UN producto…»
//  17. el núcleo sin el error de «no es cliente de ese producto»    → 29 / 1 «a UN curso…» (tests/curso-invitar.test.ts)
//
// EL CIERRE DE LA CORRIDA (09/10/2026, los arreglos de la revisión; scratchpad fb-cierre/romper.mjs, que
// restaura de memoria y comparó byte a byte los 12 archivos tocados). Corriendo juntos este archivo,
// curso-invitar-canales, crm-curso-al-ganar, curso-recordatorio, curso-vista-alumno-0910,
// curso-onboarding, curso-tareas-secciones y curso-ficha: sano 128 / 0. Cada rotura, sola:
//  18. la tarjeta sin mirar el acceso desde su curso (ClientesApp)  → 127 / 1 «invitar desde la tarjeta…»
//  19. la tarjeta sin `productoId` en ModalInvitar                  → 127 / 1 el mismo
//  20. la tabla Avance sin `productoId` en CeldaAcceso              → 127 / 1 el mismo
//  21. Clientes sin pasarle el producto a AvanceCurso               → 127 / 1 el mismo
//  22. la ficha con el acceso entero (no `desde`) en el botón       → 127 / 1 el mismo
//  23. accesosDeClientes sin leer `productos`                       → 127 / 1 el mismo
//  24. la comunidad sin `abreElProducto`                            → 127 / 1 «la comunidad: es miembro…»
//  25. la invitación al ganar sin `productoId`                      → 127 / 1 «NO hay una segunda invitación…» (crm-curso-al-ganar)
//  26. los mensajes sin `productos.includes(curso.productoId)`      → 127 / 1 «los mensajes NOMBRAN…» (curso-recordatorio)
//  27. «Volver a invitar» recalculando el WhatsApp                  → 126 / 2 «…sanea los canales…» y «la pantalla…»
//  28. la vista previa con `vista={vista}`                          → 126 / 2 «5: la PÁGINA…» y «…no crea accesos…» (onboarding)
//  29. agendar una llamada preguntando «qué ve»                     → 127 / 1 «invitar desde la tarjeta…» (antes de su
//      assert daba 128 / 0: la lista de call sites cuenta ARCHIVOS y la ficha tiene las dos preguntas)
//  30. la ficha volviendo a una copia de la lectura del acceso      → 126 / 2 «ABRIR la ficha…» (curso-ficha) y «invitar desde…»
//  31. el guard de `.campos` sin la excepción de tarea-valores      → 127 / 1 «el guard: cada lector de `.campos`…»
//  32. el mail del líder nombrando los cursos de los que es cliente → 126 / 2 «todo call site… clasificado» y «invitar desde…»
//  33. la ficha mostrando sólo los cursos que ve                    → 127 / 1 «invitar desde la tarjeta…»
// Restaurado: 128 / 0.
