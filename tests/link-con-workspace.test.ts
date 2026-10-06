import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { linkApp } from '../lib/app-url';

// =============================================================================
// Un link que se MANDA afuera lleva el `?ws=`, o abre la pantalla equivocada
// =============================================================================
// Un aviso viaja al teléfono o al correo de alguien que puede tener acceso a más de un
// workspace (el super admin, una agencia con cartera). Sin el parámetro, el link abre la
// pantalla en el workspace que su cookie resuelva y la app contesta «este lead no es de
// esta cuenta» sobre un lead que sí es suyo. Medido el 05/10/2026 con el aviso de «nuevo
// agendado»: se lee como una fuga entre clientes y es un destino que falta.
//
// ⚠️ LA LISTA QUE SE MANTIENE ES LA DE RUTAS PÚBLICAS, NO LA DE PANTALLAS DE INQUILINO.
// La primera versión de este guard tenía la lista al revés (`DE_INQUILINO` con siete
// rutas) y por eso dejó pasar SIETE links el mismo día que se escribió: `/integraciones`,
// `/inicio`, `/ads-manager`, `/closing`, `/mako`, `/instagram` y `/experimentos` no
// estaban en ella. Una lista de pantallas de inquilino crece con el producto, así que
// envejece sola; la de rutas públicas no se movió en seis meses. Lo encontró un relevo de
// la capa de notificaciones contando las 45 interpolaciones del repo, no leyendo el guard.
//
// ⚠️ Y LA OTRA MITAD CIEGA ERA LA RUTA EN UNA VARIABLE. El regex viejo exigía una ruta
// LITERAL pegada a `${APP_BASE_URL}`, así que no veía `${APP_BASE_URL}${ruta}` — que es
// justo la forma del resolvedor de los seis `{{link_*}}` de todos los mensajes y de los 18
// links de la API de MaKo. Acá una interpolación seguida de otra interpolación es un
// FALLO: no se puede leer del fuente a dónde va, así que no se puede autorizar.
//
// El guard mira el FUENTE y no los tipos, porque esto no es un error de tipos: un template
// literal con la URL pegada a mano compila perfecto.
//
// Probado rompiéndolo (06/10/2026), las tres veces 2 pasan / 1 falla y con el mensaje
// nombrando exactamente lo que hay que arreglar:
//  · `${APP_BASE_URL}/crm/${leadId}/resumen` a mano en lib/lead-resumen.ts → cae el barrido
//    diciendo `lib/lead-resumen.ts:39 → /crm/${leadId}/resumen`.
//  · `${APP_BASE_URL}${ruta}` devuelto a lib/variables-resolver.ts → cae el barrido
//    diciendo `lib/variables-resolver.ts:52 → «ruta en una variable»`, que es EL caso que
//    el guard viejo no podía ver.
//  · con `conWs` devolviendo el href intacto cae «linkApp le pega el workspace al destino»
//    y el barrido sigue en verde — son dos preguntas distintas y se ve cuál es cuál.

/**
 * Lo único que puede armar una URL absoluta a mano, con su motivo. Son rutas que NO
 * abren una pantalla dentro de un workspace, así que el `?ws=` no les aporta nada — y en
 * los dos últimos casos lo ROMPERÍA.
 *
 * Para agregar una fila acá hay que poder escribir por qué esa URL no es una pantalla de
 * inquilino. Si el motivo es «no tengo el ws a mano», no es una excusa: es el bug.
 */
const PUBLICAS: Array<{ ruta: string; porque: string }> = [
  { ruta: '/api/', porque: 'endpoints: webhooks que se registran en un proveedor, el píxel de tracking, el baja de un correo, la imagen de OG. No son pantallas.' },
  { ruta: '/inicio', porque: 'el mail de invitación: quien lo abre todavía no tiene sesión, y un `?ws=` sólo lo honra `proxy.ts` para un admin firmado.' },
  { ruta: '/agencia', porque: 'la vista de la AGENCIA, que es de plataforma y no de un inquilino; el aviso sale al grupo de MaKo.' },
  // `/instagram?conectado=1` (el redirect_uri del OAuth de Zernio) salió el 06/10/2026
  // con la tab Instagram: ya no hay quien arme esa URL, y una excusa sin dueño termina
  // tapando un link futuro que empiece igual.
  { ruta: '/replay/', porque: 'un asset estático que baja el navegador de un visitante de la landing de un cliente.' },
];

/**
 * Lo que el guard NO mira, con su motivo. ⚠️ Es por BLOQUE, no por archivo: eximir
 * `lib/mako-doer-in.ts` entero tapaba también sus líneas que SÍ mandan un link (el
 * borrador crudo y el informe), y las dos estaban sin `?ws=`.
 */
const FUERA = [
  { archivo: 'lib/app-url.ts', bloque: null, porque: 'es donde vive el helper.' },
  { archivo: 'lib/api-mako/link.ts', bloque: null, porque: 'es el helper de la API de MaKo.' },
  { archivo: 'lib/mako-doer-in.ts', bloque: 'DEEP_LINKS', porque: 'es el PROMPT que le describe al modelo la FORMA de cada URL, no un link que sale.' },
  { archivo: 'lib/landing-token.ts', bloque: 'landingSnippet', porque: 'es el SNIPPET que se pega en la página del cliente: las rutas que arma son endpoints de /api y el asset de /replay, y las dos salen de variables porque el número de versión lo pone el server.' },
];

function tsDe(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsDe(p, out);
    else if ((p.endsWith('.ts') || p.endsWith('.tsx')) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * Las líneas del bloque a eximir. Dos formas, y el cierre de cada una es el REAL:
 *  · `const <NOMBRE> = \`…\`;`  → hasta el backtick que cierra la plantilla.
 *  · `function <NOMBRE>(…) {`    → hasta el `}` a columna cero.
 *
 * No se recorta por cantidad de líneas: un número elegido a ojo mira la función de al lado
 * y da verde sobre lo que debería marcar (ya pasó en otro guard de esta casa).
 */
function lineasDelBloque(src: string, nombre: string): Set<number> {
  const fuera = new Set<number>();
  const lineas = src.split('\n');
  let dentro: 'plantilla' | 'funcion' | null = null;
  lineas.forEach((l, i) => {
    if (!dentro) {
      if (new RegExp(`const ${nombre}\\s*=\\s*\``).test(l)) dentro = 'plantilla';
      else if (new RegExp(`function ${nombre}\\s*\\(`).test(l)) dentro = 'funcion';
      if (dentro) fuera.add(i + 1);
      return;
    }
    fuera.add(i + 1);
    if (dentro === 'plantilla' && /`\s*;\s*$/.test(l)) dentro = null;
    if (dentro === 'funcion' && /^\}/.test(l)) dentro = null;
  });
  assert.ok(fuera.size > 0, `no encontré el bloque ${nombre}: la exención quedó sin efecto`);
  return fuera;
}

test('ningún link que se manda arma la URL a mano', () => {
  const malos: string[] = [];
  for (const abs of [...tsDe(join(RAIZ, 'lib')), ...tsDe(join(RAIZ, 'app'))]) {
    const rel = abs.replace(/\\/g, '/').replace(/^.*?\/((?:lib|app)\/.*)$/, '$1');
    const exime = FUERA.find((f) => rel.endsWith(f.archivo));
    if (exime && exime.bloque === null) continue;
    const src = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    const saltar = exime?.bloque ? lineasDelBloque(src, exime.bloque) : new Set<number>();
    src.split('\n').forEach((linea, i) => {
      if (saltar.has(i + 1)) return;
      if (/^\s*(\/\/|\*)/.test(linea)) return; // comentarios: la convención es citar rutas ahí
      // `${APP_BASE_URL}…` o `${APP_URL}…`: la URL absoluta armada en el fuente.
      for (const m of linea.matchAll(/\$\{APP_(?:BASE_)?URL\}(\S*)/g)) {
        const sigue = m[1] ?? '';
        // Una ruta que viene de una VARIABLE no se puede leer del fuente → no se autoriza.
        const esVariable = sigue.startsWith('${');
        const permitida = !esVariable && PUBLICAS.some((p) => sigue.startsWith(p.ruta));
        if (!permitida) malos.push(`${rel}:${i + 1} → ${esVariable ? '«ruta en una variable»' : (sigue.slice(0, 40) || '«nada»')}`);
      }
    });
  }
  assert.deepEqual(malos, [], `Estos links salen sin el workspace; van por linkApp(ruta, ws) —o linkPantalla en la API de MaKo—:\n  ${malos.join('\n  ')}`);
});

test('linkApp le pega el workspace al destino', () => {
  const l = linkApp('/crm/2439/resumen', 13);
  assert.match(l, /\/crm\/2439\/resumen\?ws=13$/);
  // Con query propia, el ws se suma sin pisarla.
  assert.match(linkApp('/whatsapp?canal=no-oficial', 1), /canal=no-oficial/);
  assert.match(linkApp('/whatsapp?canal=no-oficial', 1), /ws=1/);
});

test('sin workspace devuelve el link tal cual, no uno roto', () => {
  // Un cron que todavía no itera inquilinos no tiene ws: el link queda como antes (sin el
  // parámetro) en vez de salir con `ws=null` pegado, que abriría una pantalla vacía.
  const l = linkApp('/crm/7', null);
  assert.ok(l.endsWith('/crm/7'), l);
  assert.ok(!l.includes('ws='), l);
});
