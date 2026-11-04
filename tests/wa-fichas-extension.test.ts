// =============================================================================
// «Completar desde mi WhatsApp»: la extensión LEE las fichas del WhatsApp Web de la persona (24/10/2026)
// =============================================================================
// Martín: «lo que yo te pido es con la extensión de MaKo... que se extraiga los nombres y la información pública». El
// Cerebro, el mismo día: «La extensión LEE. Nunca escribe en WhatsApp: ni un mensaje, ni un "visto", ni abrir un chat que
// marque como leído». Esto prueba las tres puntas:
//   · lo puro (extension/wa-fichas-reglas.js), cargado como lo carga Chrome: un script CLÁSICO en un contexto propio (vm), no
//     un `require` — un content script no tiene `module`, y lo que se prueba tiene que ser lo que corre;
//   · el content script (extension/wa-fichas.js) contra un indexedDB de mentira: que no CREE la base si no está, que lea en
//     modo lectura, y que devuelva SÓLO los teléfonos pedidos (la agenda de Martín no sale del navegador);
//   · el cableado (manifest, puente, worker, pantalla, server, política de privacidad), leyendo los archivos.
// Los números y nombres son inventados.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { esMasVieja } from '../lib/version-comparar';
import { VERSION_FICHAS } from '../lib/wa-fichas-cliente';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
/** El código sin comentarios: las prohibiciones de abajo miran lo que corre, no lo que se explica. */
/** Lo que viene del contexto del script (otro «realm»: sus Array no son los nuestros), en objetos de acá. */
const plano = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

type Ficha = { telefono: string; agenda: string | null; pushname: string | null; empresa: string | null; esEmpresa: boolean; grupos: string[] };
type Reglas = {
  telefonoDeJid(j: unknown): string | null; sufijo(t: unknown): string; textoUtil(v: unknown): string | null;
  indexar(c: unknown[], g: unknown[], p: unknown[]): Map<string, unknown>; fichasDe(i: Map<string, unknown>, t: unknown[]): Ficha[];
};

/** Las reglas, cargadas como script clásico (lo que hace Chrome con un content script). */
function cargarReglas(): Reglas {
  const ctx: Record<string, unknown> = {};
  runInNewContext(leer('extension/wa-fichas-reglas.js'), ctx);
  assert.ok(ctx.MakoWaFichas, 'el script clásico no dejó `MakoWaFichas` en el global: el content script no lo va a encontrar');
  const r = ctx.MakoWaFichas as Reglas;
  return { ...r, fichasDe: (i, t) => plano(r.fichasDe(i, t)) };
}

// Lo que WhatsApp Web guarda (la forma de los gists públicos; inventado).
const CONTACTOS = [
  { id: '5491155550001@c.us', name: 'Juan Pérez (agenda)', pushname: 'Juancito', isBusiness: false },
  { id: '201234567890123@lid', phoneNumber: '5491155550002@c.us', pushname: 'Ana', notifyName: 'Ana N' },
  { id: '5491155550003@c.us', verifiedName: 'Panadería La Espiga', isBusiness: true },
  { id: '5491155550004@c.us', name: 'Mamá' },                                  // la agenda de Martín: NO se pidió
  { id: '5491155550005@c.us', pushname: '12345', name: '😀' },                  // sin letras: no es un nombre
  { id: '120363000000000001@g.us', name: 'Un grupo en la tabla de contactos' }, // no es una persona
];
const GRUPOS = [
  { id: '120363000000000001@g.us', subject: 'Emprendedores' },
  { id: '120363000000000002@g.us', subject: 'Afiliados' },
];
const PARTICIPANTES = [
  { groupId: '120363000000000001@g.us', participants: ['5491155550001@c.us', '201234567890123@lid', { id: '5491155550004@c.us' }] },
  { groupId: '120363000000000002@g.us', participants: [{ id: { _serialized: '201234567890123@lid' } }, '5491155550006@c.us'] },
  { groupId: '120363000000000099@g.us', participants: ['5491155550001@c.us'] }, // grupo sin metadatos: no se nombra
];

test('1. lo puro: el teléfono de un jid de persona, el sufijo de 10 y qué texto sirve como nombre', () => {
  const r = cargarReglas();
  assert.equal(r.telefonoDeJid('5491155550001@c.us'), '5491155550001');
  assert.equal(r.telefonoDeJid('5491155550001:12@s.whatsapp.net'), '5491155550001', 'con el dispositivo');
  assert.equal(r.telefonoDeJid('201234567890123@lid'), null, 'un @lid no es un teléfono');
  assert.equal(r.telefonoDeJid('120363000000000001@g.us'), null, 'un grupo no es una persona');
  assert.equal(r.telefonoDeJid(null), null);
  assert.equal(r.sufijo('+54 9 11 5555-0001'), '1155550001');
  assert.equal(r.textoUtil('  Juan  '), 'Juan');
  assert.equal(r.textoUtil('12345'), null);
  assert.equal(r.textoUtil('😀'), null);
  assert.equal(r.textoUtil('Você'), null);
  assert.equal(r.textoUtil('x'.repeat(300))?.length, 120);
});

test('2. el índice: agenda, nombre propio, empresa y grupos en común; el @lid se traduce por su phoneNumber', () => {
  const r = cargarReglas();
  const i = r.indexar(CONTACTOS, GRUPOS, PARTICIPANTES);
  const pedidos = ['5491155550001', '541155550002', '5491155550003', '5491155550005', '5491155550006', '5491199999999'];
  const fichas = r.fichasDe(i, pedidos);
  const por = new Map(fichas.map((f) => [f.telefono, f]));
  assert.deepEqual({ ...por.get('5491155550001') }, {
    telefono: '5491155550001', agenda: 'Juan Pérez (agenda)', pushname: 'Juancito', empresa: null, esEmpresa: false, grupos: ['Emprendedores'],
  });
  // Pedido SIN el 9 de Argentina: cruza igual por los últimos 10, y vuelve con el teléfono como se pidió.
  assert.deepEqual({ ...por.get('541155550002') }, {
    telefono: '541155550002', agenda: null, pushname: 'Ana', empresa: null, esEmpresa: false, grupos: ['Afiliados', 'Emprendedores'],
  });
  assert.equal(por.get('5491155550003')?.empresa, 'Panadería La Espiga');
  assert.equal(por.get('5491155550003')?.esEmpresa, true);
  assert.ok(!por.has('5491155550005'), 'sin letras no hay nombre, y sin grupos no hay nada que devolver');
  assert.deepEqual(por.get('5491155550006')?.grupos, ['Afiliados'], 'sin contacto guardado, igual vuelven sus grupos');
  assert.ok(!por.has('5491199999999'), 'un teléfono que WhatsApp Web no tiene no vuelve');
});

test('3. SÓLO los teléfonos pedidos: la agenda de la persona no sale del navegador', () => {
  const r = cargarReglas();
  const fichas = r.fichasDe(r.indexar(CONTACTOS, GRUPOS, PARTICIPANTES), ['5491155550001']);
  assert.deepEqual(fichas.map((f) => f.telefono), ['5491155550001']);
  assert.ok(!JSON.stringify(fichas).includes('Mamá'), 'salió un contacto que nadie pidió');
  assert.deepEqual(r.fichasDe(r.indexar(CONTACTOS, GRUPOS, PARTICIPANTES), []), []);
  assert.deepEqual(r.fichasDe(r.indexar(CONTACTOS, GRUPOS, PARTICIPANTES), ['12', null, {}]), [], 'lo que no es un teléfono no pide nada');
  // Entradas rotas no tiran: un campo que no está es «no sé».
  assert.doesNotThrow(() => r.indexar([null, 1, 'x', { id: 7 }] as unknown[], [null, { id: 3 }] as unknown[], [null, { groupId: 'x', participants: 'no' }] as unknown[]));
});

/** Un indexedDB de mentira: qué se abrió, con qué modo, y si se intentó crear algo. */
function indexedDbFalso(o: { existe: boolean; stores?: Record<string, unknown[]> }) {
  const registro = { abiertas: 0, modos: [] as string[], creo: false, cerro: false };
  const stores = o.stores ?? {};
  const db = {
    objectStoreNames: Object.assign(Object.keys(stores), { contains: (n: string) => n in stores }),
    transaction(nombre: string, modo: string) {
      registro.modos.push(modo);
      return { objectStore: () => ({ getAll() {
        const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
        setTimeout(() => { req.result = stores[nombre]; req.onsuccess?.(); }, 0);
        return req;
      } }) };
    },
    close() { registro.cerro = true; },
  };
  const api = {
    databases: async () => (o.existe ? [{ name: 'model-storage', version: 1 }] : [{ name: 'otra' }]),
    open(nombre: string, version?: number) {
      registro.abiertas++;
      if (version !== undefined) registro.creo = true; // pedir versión puede crear o migrar: nunca
      const req: Record<string, unknown> & { result?: unknown } = {};
      setTimeout(() => {
        if (!o.existe) { registro.creo = true; (req.onupgradeneeded as (() => void) | undefined)?.(); return; }
        req.result = db; (req.onsuccess as () => void)();
      }, 0);
      void nombre;
      return req;
    },
  };
  return { api, registro };
}

/** Corre wa-fichas.js como content script y le hace un pedido; devuelve lo que contestó. */
async function pedirAlContentScript(idb: ReturnType<typeof indexedDbFalso>['api'], msg: unknown): Promise<{ devolvio: unknown; respuesta: unknown }> {
  let oyente: ((m: unknown, s: unknown, r: (x: unknown) => void) => unknown) | null = null;
  const ctx: Record<string, unknown> = {
    indexedDB: idb, setTimeout, console,
    chrome: { runtime: { onMessage: { addListener: (f: typeof oyente) => { oyente = f; } } } },
  };
  runInNewContext(leer('extension/wa-fichas-reglas.js'), ctx);
  runInNewContext(leer('extension/wa-fichas.js'), ctx);
  assert.ok(oyente, 'el content script no escucha pedidos');
  return new Promise((resolve) => {
    let devolvio: unknown;
    const t = setTimeout(() => resolve({ devolvio, respuesta: undefined }), 200);
    devolvio = oyente!(msg, {}, (respuesta) => { clearTimeout(t); resolve({ devolvio, respuesta: plano(respuesta) }); });
  });
}

test('4. el content script: sin base NO la crea (ni la abre); con base, lee en modo lectura y devuelve sólo lo pedido', async () => {
  const sin = indexedDbFalso({ existe: false });
  const r1 = await pedirAlContentScript(sin.api, { tipo: 'WA_FICHAS', telefonos: ['5491155550001'] });
  assert.equal(r1.devolvio, true, 'contesta asincrónico');
  assert.deepEqual(r1.respuesta, { ok: false, motivo: 'sin_base', diagnostico: { base: false } });
  assert.equal(sin.registro.abiertas, 0, 'abrió `model-storage` sin que existiera: la habría creado VACÍA en su WhatsApp');
  assert.equal(sin.registro.creo, false);

  const con = indexedDbFalso({ existe: true, stores: { contact: CONTACTOS, 'group-metadata': GRUPOS, participant: PARTICIPANTES, message: [{ body: 'hola' }] } });
  const r2 = await pedirAlContentScript(con.api, { tipo: 'WA_FICHAS', telefonos: ['5491155550001'] });
  const resp = r2.respuesta as { ok: boolean; fichas: Ficha[]; diagnostico: Record<string, unknown> };
  assert.equal(resp.ok, true);
  assert.deepEqual(resp.fichas.map((f) => f.telefono), ['5491155550001']);
  assert.equal(con.registro.creo, false, 'pidió una versión: eso puede migrar la base de WhatsApp');
  assert.ok(con.registro.modos.length >= 1 && con.registro.modos.every((m) => m === 'readonly'), `abrió en modo ${con.registro.modos.join(',')}`);
  assert.ok(con.registro.cerro, 'no cerró la conexión: trabaría la próxima actualización de WhatsApp Web');
  assert.ok(!JSON.stringify(resp).includes('hola'), 'salió un mensaje');
  assert.deepEqual(resp.diagnostico, {
    base: true, stores: ['contact', 'group-metadata', 'participant', 'message'], contactos: 6, grupos: 2, participantes: 3, pedidos: 1, conFicha: 1,
    // 0.72.0: cuántos nombres se vieron al recorrer el grupo, y cuántas fichas ganaron uno así (sin recorrer: 0).
    vistos: 0, enPantalla: 0,
    // 0.73.5: los nombres que firman los mensajes de los grupos nombrados (acá no se nombró ninguno).
    mensajes: { tabla: false, clave: null, leidos: 0, conNombre: 0, conAutor: 0, campos: {}, autores: 0, sumados: 0 },
  }, 'el diagnóstico: cantidades y nombres de tablas, nunca datos de nadie');

  const otro = await pedirAlContentScript(con.api, { tipo: 'OTRA_COSA' });
  assert.equal(otro.devolvio, false, 'contestó un pedido que no es suyo');
});

test('5. en WhatsApp Web la extensión SÓLO LEE: ni escribe, ni toca la pantalla, ni habla con la red', () => {
  for (const archivo of ['extension/wa-fichas.js', 'extension/wa-fichas-reglas.js']) {
    const codigo = sinComentarios(leer(archivo));
    for (const [prohibido, por] of [
      [/readwrite|\.put\(|\.delete\(|\.clear\(|deleteDatabase|createObjectStore/, 'escribe en la base de WhatsApp'],
      [/\bdocument\b|\.click\(|dispatchEvent|querySelector|innerHTML|focus\(/, 'toca la pantalla de WhatsApp (un clic puede abrir un chat y dar el «visto»)'],
      [/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|postMessage|chrome\.runtime\.sendMessage|localStorage/, 'habla con algo más que el pedido de MaKo'],
      [/setInterval|MutationObserver|addEventListener\(/, 'corre solo: tiene que contestar un pedido, nunca vigilar'],
    ] as const) {
      assert.doesNotMatch(codigo, prohibido, `${archivo} ${por}`);
    }
  }
});

test('6. el manifest: el permiso de WhatsApp Web, el content script aislado (no MAIN) y la versión que la pantalla espera', () => {
  const man = JSON.parse(leer('extension/manifest.json')) as {
    version: string; host_permissions: string[]; content_scripts: Array<{ matches: string[]; js: string[]; world?: string }>;
  };
  assert.ok(man.host_permissions.includes('https://web.whatsapp.com/*'));
  const wa = man.content_scripts.filter((c) => c.matches.some((m) => m.includes('web.whatsapp.com')));
  assert.equal(wa.length, 1, 'un solo content script en WhatsApp Web');
  assert.deepEqual(wa[0].matches, ['https://web.whatsapp.com/*'], 'el de WhatsApp Web no se comparte con otros sitios');
  // Y el recorrido a la vista (0.72.0), después: usa las reglas (`asuntoComparable`).
  assert.deepEqual(wa[0].js, ['wa-fichas-reglas.js', 'wa-fichas.js', 'wa-recorrer.js'], 'las reglas ANTES del script que las usa');
  assert.equal(wa[0].world, undefined, 'en el mundo MAIN la página de WhatsApp vería (y podría tocar) el script');
  for (const c of man.content_scripts) {
    if (!c.matches.some((m) => m.includes('web.whatsapp.com'))) assert.ok(!c.js.some((j) => j.startsWith('wa-fichas')), 'las fichas corren en otro sitio');
  }
  assert.ok(!esMasVieja(man.version, VERSION_FICHAS), `la pantalla pide la ${VERSION_FICHAS} y el paquete es ${man.version}`);
});

test('7. el puente: página → mako-puente → worker → pestaña de WhatsApp Web, con los mismos nombres en las cuatro puntas', () => {
  const cliente = leer('lib/wa-fichas-cliente.ts');
  const puente = leer('extension/mako-puente.js');
  const worker = leer('extension/background.js');
  const contenido = leer('extension/wa-fichas.js');
  assert.match(cliente, /new CustomEvent\('MAKO_WA_FICHAS_PIDO'/);
  assert.match(cliente, /addEventListener\('MAKO_WA_FICHAS'/);
  assert.match(puente, /addEventListener\('MAKO_WA_FICHAS_PIDO'/);
  assert.match(puente, /new CustomEvent\('MAKO_WA_FICHAS'/);
  assert.match(puente, /tipo: 'WA_FICHAS_PEDIDO'/);
  // El puente sólo atiende eventos de la propia página (no de un iframe ajeno).
  assert.match(puente.slice(puente.indexOf("'MAKO_WA_FICHAS_PIDO'")).slice(0, 400), /ev\.target !== window|ev\.target === window/);
  const desde = worker.indexOf("tipo === 'WA_FICHAS_PEDIDO'");
  const enWorker = worker.slice(desde, worker.indexOf('\n  }\n', desde)); // SÓLO este bloque: el return del siguiente no cuenta
  assert.ok(worker.includes("tipo === 'WA_FICHAS_PEDIDO'"), 'el worker no atiende el pedido');
  // Desde la 0.71.0 (25/10/2026) la pestaña la busca (y abre, despierta o repara) `pestanaDeWhatsappLista`, afuera del bloque.
  // Con su latido a la pantalla mientras espera (0.74.1): la pestaña es la misma.
  assert.match(enWorker, /const lista = await conLatido\(pestanaDeWhatsappLista\(avisar\), origen, pedidoId\);/, 'el worker le pregunta a otra pestaña');
  assert.match(worker, /const esPestanaDeWhatsapp = \(t\) => !!t && t\.id != null && typeof t\.url === 'string' && t\.url\.startsWith\('https:\/\/web\.whatsapp\.com\/'\);/);
  // ⚠️ Sin barra-asterisco en el código del worker: los tests de la extensión quitan comentarios con una regex que, ante esa
  // secuencia dentro de un texto, se come el resto del archivo (y esos tests dan rojo por razones que no son las suyas).
  const ayudas = worker.slice(worker.indexOf('const WA_WEB = '), worker.indexOf('/** Abre Flow, o enfoca la pestana que ya esta. */'));
  assert.ok(ayudas.length > 500, 'no encontré las ayudas de WhatsApp Web del worker');
  assert.ok(!enWorker.includes('web.whatsapp.com/*') && !ayudas.includes('web.whatsapp.com/*'), 'volvió el patrón con barra-asterisco al worker');
  assert.match(enWorker, /tipo: 'WA_FICHAS'/);
  assert.match(enWorker, /return true;/, 'sin `return true` la respuesta asincrónica se pierde');
  assert.match(contenido, /msg\.tipo !== 'WA_FICHAS'/);
});

test('8. el server: sólo leads que ya existen, por los caminos de completar, sin la red de la línea y cortando por tiempo', () => {
  const server = leer('app/crm/grupo-wa-server.ts');
  // El grupo verifica su línea y delega en el NÚCLEO, que es el mismo del lote del tablero (tests/enriquecer-lote.test.ts).
  const grupo = server.slice(server.indexOf('export async function completarFichasDelGrupo'));
  assert.match(grupo.slice(0, grupo.indexOf('\n}\n')), /if \(!\(await lineaDelNegocio\(p\.linea\)\)\) return \{ ok: false,[^\n]*\n {2}return completarFichas\(\{ fichas: p\.fichas, autor: p\.autor, hasta: p\.hasta \}\);/);
  const ini = server.indexOf('export async function completarFichas(');
  assert.ok(ini > 0);
  const cuerpo = server.slice(ini, server.indexOf('\n}\n', ini));
  assert.match(cuerpo, /fichaLimpia/, 'lo que llega del navegador se limpia');
  assert.match(cuerpo, /typeof id === 'number' && \(!p\.soloIds \|\| p\.soloIds\.has\(id\)\)/, 'sólo un teléfono que es UN lead (ni ninguno, ni dos), y del lote, sólo los tildados');
  assert.match(cuerpo, /esNombreDeRelleno\(lead\.nombre\) && await completarNombreDeRelleno\(/, 'el nombre, sólo donde es de relleno y comparando');
  assert.match(cuerpo, /completarCamposVacios\(id, \{ empresa: f\.empresa \}/, 'la empresa, sólo si está vacía');
  assert.match(cuerpo, /Date\.now\(\) > p\.hasta\) \{ pendientes\.push/, 'sin corte por tiempo, una tanda lenta muere a los 60 s a la mitad');
  assert.match(cuerpo, /\.slice\(0, TANDA_FICHAS\)/, 'el server acepta más de una tanda');
  assert.doesNotMatch(cuerpo, /participantesDelGrupo|\bev\(|fetchBusinessProfile|fetchContactosEvolution/, 'consulta la red de la línea en cada tanda');
  assert.doesNotMatch(cuerpo, /createLead|insert\(|moverLead|cambiarEtapa|etapa:|send|enrolar|inscribir/i, 'crea, mueve o manda');
  const acciones = leer('app/crm/grupo-wa-actions.ts');
  assert.match(acciones, /completarFichasDelGrupo\(\{[\s\S]{0,200}hasta: Date\.now\(\) \+ 40_000/, 'la acción no le pone techo de tiempo');
});

test('9. la pantalla: «Extraer» la dispara la persona, con «Parar», y lo que el server no guardó vuelve a la cola', () => {
  // Desde el 26/10/2026 las fichas van DENTRO de «Extraer» (tests/wa-extraer-072.test.ts tiene el resto).
  const ui = leer('app/crm/TraerDeGrupoWA.tsx');
  const ini = ui.indexOf('const extraer = async');
  const cuerpo = ui.slice(ini, ui.indexOf('\n  };\n', ini));
  assert.ok(cuerpo.length > 500, 'no encontré `extraer`');
  // La cola, los pendientes al frente y el corte sin avance viven en la máquina compartida (sus pruebas, con dobles, en
  // tests/enriquecer-lote.test.ts); acá, que la pantalla la use con su «Parar» y su avance (al desplegable).
  assert.match(cuerpo, /await guardarFichasEnTandas\(fichas, \(tanda\) => completarFichasDeGrupoAction\(\{ linea, jid, fichas: tanda \}\), \{\n\s+parar: \(\) => parar\.current,/);
  assert.match(cuerpo, /alAvanzar: \(guardadas, total\) => avisarExtraccion\(id, \{ fase: 'guardando', guardados: guardadas, total \}\),/, 'sin avance visible');
  assert.match(cuerpo, /filter\(\(p\) => p\.enElCrm \|\| vanAEstar\.has\(p\.telefono\)\)/, 'pide fichas de gente que no va a estar en el CRM');
  // El corte va ADENTRO del resumen: releer el grupo (`setVuelta`) limpia `err`, y ahí se perdía (la revisión del 24/10).
  // Con leads nuevos abre el cartel de éxito (27/10/2026); sin, el nombre del grupo. La `cola` (los cortes) va en los dos.
  assert.match(cuerpo, /setHecho\(titular \? `\$\{resumen\}\.\$\{cola\}` : `«\$\{grupo\.nombre\}»: \$\{resumen\}\.\$\{cola\}`\);/, 'un corte callado');
  assert.match(cuerpo, /const corte = t\?\.corte \|\| a\?\.error \|\| \(a\?\.parado \? 'La paraste\.' : ''\);/);
  // «Parar» en el pie, al lado del avance, y también desde el desplegable (`alPararExtraccion`).
  assert.match(ui, /const pararAccion = extrayendo \? \{ texto: 'Parar', onClick: \(\) => \{ parar\.current = true; setAvance\('Parando…'\); \} \}/);
  assert.match(cuerpo, /const soltar = alPararExtraccion\(id, \(\) => \{ parar\.current = true; \}\);/);
  assert.doesNotMatch(cuerpo, /useEffect|setInterval/, 'corre solo');
});

test('10. la política de privacidad dice lo que hace: cada sitio del manifest, y qué lee en WhatsApp Web', () => {
  const pol = leer('app/privacidad/extension/page.tsx');
  const man = JSON.parse(leer('extension/manifest.json')) as { host_permissions: string[] };
  for (const h of man.host_permissions) {
    const dominio = /^https?:\/\/([^/]+)\//.exec(h)?.[1];
    assert.ok(dominio, h);
    const veces = pol.split(dominio).length - 1;
    assert.ok(veces >= 2, `${dominio}: tiene que estar en «No accede a ningún sitio fuera de…» y en «Por qué pide cada permiso» (está ${veces})`);
  }
  assert.match(pol, /<H>En WhatsApp Web<\/H>/);
  // 26/10/2026 (0.72.0): «Extraer» ABRE el grupo a la vista (wa-recorrer.js), y eso marca como leídos sus mensajes: se dice.
  assert.match(pol, /<strong>abre el grupo, a la vista<\/strong>/);
  assert.match(pol, /<strong>Abrir el grupo marca\s+como leídos los mensajes de ese grupo<\/strong>/);
  assert.match(pol, /nunca\s+abre una segunda/);
  assert.doesNotMatch(pol, /no hace clic|no marca nada como leído/, 'la política promete lo que ya no es cierto');
  // 25/10/2026 (0.71.0): la extensión puede ABRIR WhatsApp Web, y recibe el nombre del grupo y el `@lid` de cada contacto.
  assert.match(pol, /Si WhatsApp Web no está abierto, la extensión lo <strong>abre en otra pestaña<\/strong>/);
  assert.match(pol, /el\s+nombre de ese grupo y el identificador con que WhatsApp los conoce en él/);
  // 27/10/2026 (0.73+, al preparar la Chrome Web Store): abre la información de contacto de cada miembro, y el registro local.
  assert.match(pol, /abre también la\{' '\}\s+<strong>información de contacto de cada miembro<\/strong>/, 'la política no dice que lee el perfil de cada miembro');
  assert.match(pol, /<strong>sólo llena lo que está vacío<\/strong>/);
  assert.match(pol, /registro de tus últimas 30 extracciones/);
  // 3/11/2026 (0.75.0): «Guardar en Spy» (lo que dice lo mira tests/spy-captura.test.ts).
  assert.match(pol, /const ACTUALIZADO = '3 de noviembre de 2026'/, 'la política cambió y la fecha no');
});
