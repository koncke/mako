// =============================================================================
// El destino de un redirect también pasa por el gate
// =============================================================================
// EL BUG QUE LO MOTIVÓ, medido en producción el 30/08/2026: `/extension` es el
// link corto que se reparte por mail y por WhatsApp para bajar la extensión del
// puente. Redirige a `/mako-puente.zip`, y quien lo abría sin sesión de MaKo
// caía en la pantalla de login en vez de bajarse el archivo.
//
//     /extension        → 307 a /mako-puente.zip
//     /mako-puente.zip  → 307 a /login?next=%2Fmako-puente.zip
//
// ⚠️ LO QUE HIZO QUE NADIE LO VIERA FUE UN COMENTARIO, NO EL CÓDIGO. En
// next.config.ts decía que no hacía falta sumar el destino a `PUBLICOS` porque
// «los redirects corren ANTES del proxy, así que el gate ni se entera». La
// premisa es cierta y la conclusión es falsa: el redirect no sirve el archivo,
// manda un 307 y el navegador PIDE EL DESTINO DE NUEVO. Ese segundo pedido es un
// request nuevo y entra al proxy como cualquier otro. Un comentario que documenta
// la intención correcta con un razonamiento falso es peor que no tener ninguno:
// convence a quien pasa por al lado de que ahí no hay nada que revisar.
//
// ⚠️ ESTE TEST NO EXIGE QUE LOS DESTINOS SEAN PÚBLICOS, y es a propósito.
// Exige que su estado esté DECLARADO en `ESPERADO`. La clase de bug no era «una
// ruta mal configurada» sino «una creencia falsa sobre una ruta»: pedir
// `public: true` habría convertido una decisión de producto —abrir o no una
// descarga a todo internet— en un test que se pone verde solo. Un redirect nuevo
// hacia un archivo gateado no falla acá por estar gateado; falla por no estar
// declarado, que es exactamente el momento en que alguien tiene que decidirlo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esPublica } from '../lib/rutas-publicas';
import { EXTENSION_URL_ZIP } from '../lib/extension-tienda';
import nextConfig from '../next.config';

// ── El matcher de verdad, leído de proxy.ts ──────────────────────────────────
// Se lee el ARCHIVO en vez de importar la constante porque no existe tal
// constante y no puede existir: Next exige que `config.matcher` sea un literal
// que pueda analizar en build, así que no acepta un valor importado. Leer el
// fuente es la única forma de que un test compare contra lo mismo que corre.
function matcherDeProxy(): RegExp {
  const src = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  const m = src.match(/matcher:\s*\[\s*'([^']+)'/);
  assert.ok(m, 'no encontré el matcher en proxy.ts — ¿cambió de forma?');
  // El literal viene con el escape del CÓDIGO FUENTE (`\\.`). `JSON.parse` lo
  // desescapa a lo que el runtime realmente compila (`\.`). Sin este paso el
  // patrón diría «una barra invertida y cualquier carácter», matchearía de más y
  // el test pasaría en falso. Lo cubre el caso de `/logo.png` más abajo.
  const patron = JSON.parse(`"${m[1]}"`) as string;
  return new RegExp(`^${patron}$`);
}

/** ¿El gate llega a mirar esta ruta, o el matcher la exime antes de entrar? */
const loMiraElGate = (ruta: string) => matcherDeProxy().test(ruta);

/** ¿Se puede abrir sin sesión? Las dos salidas: exenta del matcher, o pública. */
const entraSinSesion = (ruta: string) => !loMiraElGate(ruta) || esPublica(ruta);

/** Los destinos de `redirects()` que son un archivo servido desde public/. */
async function destinosEstaticos(): Promise<string[]> {
  const redirects = await nextConfig.redirects!();
  return redirects
    .map((r) => r.destination)
    // Externos (la ficha de la Chrome Web Store): no los gatea nadie nuestro.
    .filter((d) => d.startsWith('/'))
    // Con parámetro (`/plan/:path*`) no es un archivo, es un árbol de páginas.
    .filter((d) => !d.includes(':'))
    // Un archivo se reconoce por la extensión del último segmento.
    .filter((d) => /\.[a-z0-9]{2,5}$/i.test(d.split('/').pop() ?? ''));
}

/**
 * Qué archivo estático es destino de un redirect, y si se baja SIN sesión.
 *
 * `false` no es un pendiente. `/mako-puente.zip` está cerrado por decisión del
 * 30/08/2026: se verificó que el zip no lleva secretos (10 archivos; el único
 * literal parecido a una credencial es el site key de reCAPTCHA de Google Flow,
 * que es público por naturaleza) y que la extensión ya está en la Chrome Web
 * Store, así que abrirlo era viable — y se eligió no hacerlo. El link repartido
 * igual entrega el archivo a quien tiene cuenta, vía el `?next` del login.
 *
 * ⚠️ LA CLAVE SE DERIVA, no se escribe. Desde el 04/09/2026 el zip lleva la versión
 * en el nombre (`/mako-puente-0.42.0.zip`) para que ningún caché ni ninguna carpeta
 * de Descargas pueda entregar el anterior. Con la ruta escrita a mano acá, este test
 * fallaría en CADA release — y un guard que falla por algo que no es su tema es un
 * guard que alguien va a apagar. Se deriva de la misma constante que arma el link.
 *
 * La decisión que declara —cerrado— no cambió: sigue siendo la del 30/08.
 */
const ESPERADO: Record<string, boolean> = {
  [EXTENSION_URL_ZIP]: false,
  // El nombre viejo, que hoy es una RUTA que redirige a la versión vigente en vez de
  // un archivo. Se declara igual: la ruta pasa por el mismo gate.
  '/mako-puente.zip': false,
};

test('el matcher que se leyó de proxy.ts es el de verdad', () => {
  // Va PRIMERO porque si la extracción se rompe, todo lo demás pasa en falso:
  // un patrón que no matchea nada haría que cada ruta se vea como «exenta».
  assert.equal(loMiraElGate('/plan'), true, 'una página normal la tiene que mirar');
  assert.equal(loMiraElGate('/api/crm'), true, 'una API interna también');
  assert.equal(loMiraElGate('/logo.png'), false, 'las imágenes están exentas por extensión');
  assert.equal(loMiraElGate('/cono-tx/algo.json'), false, 'los .json de /conocimientos van exentos por RUTA');
});

test('el gate SÍ mira el destino de un redirect: el 307 es un request nuevo', () => {
  // La afirmación exacta que el comentario viejo daba por falsa. Si esto se pone
  // en `false` sin que nadie haya tocado el matcher a propósito, algo se abrió de
  // más y hay que mirarlo.
  assert.equal(loMiraElGate('/mako-puente.zip'), true, '`zip` no está entre las extensiones exentas del matcher');
});

test('todo redirect a un archivo estático tiene su acceso DECLARADO', async () => {
  for (const destino of await destinosEstaticos()) {
    assert.ok(
      destino in ESPERADO,
      `El redirect a "${destino}" apunta a un archivo que pasa por el gate y nadie declaró si se abre sin sesión.\n` +
        `No lo agregues a ESPERADO para que el test calle: decidí primero si ese archivo se reparte a gente sin cuenta.\n` +
        `Si va abierto, la ruta EXACTA a PUBLICOS (lib/rutas-publicas.ts) — nunca un prefijo, nunca la extensión al matcher.`,
    );
  }
});

test('cada destino declarado se comporta como dice la declaración', () => {
  for (const [ruta, esperado] of Object.entries(ESPERADO)) {
    assert.equal(
      entraSinSesion(ruta),
      esperado,
      esperado
        ? `"${ruta}" se declara público y el gate lo está cortando: el link repartido cae en /login.`
        : `"${ruta}" se abrió sin actualizar la declaración. Si fue a propósito, cambiá ESPERADO y decí por qué.`,
    );
  }
});
