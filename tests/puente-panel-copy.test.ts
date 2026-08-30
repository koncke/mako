// =============================================================================
// El copy va en español neutro, y el guard que lo cuidaba miraba DOS archivos
// =============================================================================
// El producto se usa en México: la interfaz va en español neutro. La voz de MaKo
// hacia Martín sí es rioplatense (ver AGENTS.md → «La voz de MaKo es rioplatense,
// y el texto DEL CLIENTE no»), y por eso el voseo se filtra solo: el kit
// compartido trae «Probá de nuevo» y «No tenés acceso» en sus textos por defecto,
// los comentarios del repo están escritos de vos, y copiar de ahí mete
// «conectá/pegalo» en una pantalla que dice «conecta/pégalo» sin que nada falle.
//
// Este archivo tenía un chequeo de voseo sobre una LISTA BLANCA de dos pantallas.
// Esa lista es exactamente por lo que se colaron cientos de casos en el resto del
// repo: un guard que cubre dos pantallas deja pasar la tercera, y el que la
// escribe no tiene por qué saber que este test existe. Ahora recorre TODO
// `app/`, `lib/` y `components/` con `git ls-files`, igual que el chequeo de
// `var(--fs-*)` de más abajo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(import.meta.dirname, '..');

/**
 * La lista de formas ES el diccionario de reemplazos: nadie puede sumar una forma
 * sin decir por cuál se cambia. Un test que dice «hay voseo» y no dice dónde ni
 * qué poner no lo arregla nadie.
 *
 * ⚠️ Sin `\b`: el límite de palabra de JavaScript es ASCII, así que después de una
 * vocal acentuada NO hay borde y `pegá`, `mirá` o `entrá` se escapan en silencio.
 * Van los límites por Unicode — y con `_`/`-` adentro del corte, porque una forma
 * pegada a un guion es parte de un id o de un slug (`fria_quien_sos`), no prosa.
 *
 * ⚠️ Y las que NO están, están afuera A PROPÓSITO, porque tienen un homógrafo
 * neutro y un guard con falsos positivos se termina apagando:
 *   · `ves`, `sabes`, `vives`, `dices`, `dale` → son formas normales de tú.
 *   · `abrí`, `escribí`, `elegí`, `subí`, `seguí`, `salí`, `pedí`, `recibí` →
 *     también son la 1ª persona del pretérito, y MaKo narra en primera persona
 *     («no la escribí», «ya lo subí», «Escribí los 5 mensajes» = lo hizo MaKo).
 *     Quedan cubiertas por sus formas con clítico (`abrilo`, `escribilo`) y por
 *     el presente de vos (`abrís`, `escribís`).
 *   · `vas a tener` estaba en el regex viejo y es idéntico en tú y en vos.
 *   · `nomás` es tan mexicano como rioplatense.
 */
const NEUTRO: Record<string, string> = {
  // pronombre y presente voseado
  vos: 'tú', sos: 'eres', tenés: 'tienes', querés: 'quieres', podés: 'puedes',
  debés: 'debes', sabés: 'sabes', hacés: 'haces', ponés: 'pones', venís: 'vienes',
  decís: 'dices', vivís: 'vives', seguís: 'sigues', elegís: 'eliges',
  preferís: 'prefieres', salís: 'sales', pedís: 'pides', sentís: 'sientes',
  escribís: 'escribes', recibís: 'recibes', valés: 'vales', creés: 'crees',
  leés: 'lees', traés: 'traes', necesitás: 'necesitas', usás: 'usas',
  buscás: 'buscas', mandás: 'mandas', cargás: 'cargas', guardás: 'guardas',
  armás: 'armas', esperás: 'esperas', mirás: 'miras', entrás: 'entras',
  dejás: 'dejas', tocás: 'tocas', llevás: 'llevas', pasás: 'pasas',
  quedás: 'quedas', agregás: 'agregas', apretás: 'aprietas', clickeás: 'haces clic',
  conectás: 'conectas', instalás: 'instalas', descargás: 'descargas',
  revisás: 'revisas', marcás: 'marcas', anotás: 'anotas', avisás: 'avisas',
  sacás: 'sacas', metés: 'metes', corrés: 'corres', subís: 'subes', bajás: 'bajas',
  volvés: 'vuelves', mostrás: 'muestras', contás: 'cuentas', empezás: 'empiezas',
  terminás: 'terminas', cerrás: 'cierras', abrís: 'abres', borrás: 'borras',
  filtrás: 'filtras', movés: 'mueves', tirás: 'tiras', sumás: 'sumas',
  // las mismas, como las escribe la gente cuando no pone la tilde
  podes: 'puedes', tenes: 'tienes', queres: 'quieres',
  // imperativos voseados
  andá: 've', mirá: 'mira', pegá: 'pega', tocá: 'toca', dejá: 'deja',
  entrá: 'entra', fijate: 'fíjate', acordate: 'acuérdate', probá: 'prueba',
  conectá: 'conecta', descargá: 'descarga', instalá: 'instala', revisá: 'revisa',
  clickeá: 'haz clic', apretá: 'aprieta', mandá: 'manda', contá: 'cuenta',
  cargá: 'carga', guardá: 'guarda', borrá: 'borra', armá: 'arma', usá: 'usa',
  sumá: 'suma', tirá: 'tira', poné: 'pon', hacé: 'haz', vení: 'ven',
  esperá: 'espera', cerrá: 'cierra', llevá: 'lleva', mové: 'mueve', buscá: 'busca',
  filtrá: 'filtra', marcá: 'marca', anotá: 'anota', avisá: 'avisa', fijá: 'fija',
  sacá: 'saca', meté: 'mete', corré: 'corre', bajá: 'baja', volvé: 'vuelve',
  mostrá: 'muestra', agregá: 'agrega', empezá: 'empieza', terminá: 'termina',
  // imperativo + clítico (acá no hay homógrafo: el neutro lleva tilde)
  pegalo: 'pégalo', pegala: 'pégala', contame: 'cuéntame', decime: 'dime',
  mirala: 'mírala', miralo: 'míralo', armalo: 'ármalo', armala: 'ármala',
  probalo: 'pruébalo', probala: 'pruébala', usalo: 'úsalo', usala: 'úsala',
  tenelo: 'tenlo', tenela: 'tenla', ponelo: 'ponlo', ponela: 'ponla',
  dejalo: 'déjalo', dejala: 'déjala', sacalo: 'sácalo', sacala: 'sácala',
  mandalo: 'mándalo', mandala: 'mándala', cargalo: 'cárgalo', cargala: 'cárgala',
  abrilo: 'ábrelo', abrila: 'ábrela', cerralo: 'ciérralo', cerrala: 'ciérrala',
  pedile: 'pídele', decile: 'dile', mandale: 'mándale', apagalo: 'apágalo',
  prendelo: 'enciéndelo', anotalo: 'anótalo', guardalo: 'guárdalo',
  guardala: 'guárdala', borralo: 'bórralo', borrala: 'bórrala',
  revisalo: 'revísalo', revisala: 'revísala', cambialo: 'cámbialo',
  cambiala: 'cámbiala', movelo: 'muévelo', movela: 'muévela', subilo: 'súbelo',
  subila: 'súbela', apurate: 'apúrate',
  // léxico rioplatense
  acá: 'aquí', aca: 'aquí', laburo: 'trabajo', laburar: 'trabajar', pibe: 'chico',
  pibes: 'chicos', macanudo: 'amable', quilombo: 'desorden', chau: 'adiós',
  boludo: '(sacalo)',
};

/** Las más largas primero: si no, `cargá` se comería el principio de `cargalo`. */
const FORMAS = Object.keys(NEUTRO).sort((a, b) => b.length - a.length);
const VOSEO = new RegExp(`(?<![\\p{L}_-])(${FORMAS.join('|')})(?![\\p{L}_-])`, 'giu');

/**
 * Solo el texto que un cliente LEE: fuera comentarios, imports y nombres de código.
 *
 * Dos detalles que el chequeo repo-wide obligó a arreglar acá:
 *  1. Los comentarios se reemplazan por ESPACIOS y no por un espacio: el número de
 *     línea del hallazgo tiene que ser el del archivo, o el mensaje no sirve.
 *  2. También sale el comentario al final de una línea (`const x = 1; // pegá acá`).
 *     Los comentarios del repo están escritos de vos a propósito y nadie los lee
 *     desde la app. El `[^:'"\`\\]` de adelante es para no cortar en `https://`.
 */
function copyVisible(ruta: string): string {
  // ⚠️ `git ls-files` lista el ÍNDICE, no el disco. Un archivo borrado y todavía
  // sin commitear aparece en la lista y no existe, y hasta hoy eso tiraba el
  // guard ENTERO con un ENOENT — o sea que borrar un archivo apagaba el chequeo
  // de voseo de los otros 900. Un archivo que no está no tiene copy que revisar:
  // se saltea y se sigue.
  let crudo: string;
  try { crudo = readFileSync(join(RAIZ, ruta), 'utf8'); } catch { return ''; }
  const enBlanco = (m: string) => m.replace(/[^\n]/g, ' ');
  return crudo
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)   // bloques /* … */ y {/* … */}
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')  // // … (de línea y al final de línea)
    .replace(/^import[\s\S]*?;$/gm, enBlanco);
}

/**
 * Lo que queda afuera del guard, con el porqué al lado. Es una excepción ACOTADA
 * Y ESCRITA, no una lista blanca: el default es que TODO el repo esté adentro.
 *
 * Va por archivo y no por línea porque la mitad de estos casos viven adentro de un
 * template literal (un prompt): un `// voseo-ok` ahí no sería un comentario, sería
 * texto que le llega al modelo.
 */
const FUERA_DE_ALCANCE: { ruta: string; porque: string }[] = [
  // ── Palabras de otro: no son copy nuestro, son citas ────────────────────────
  {
    ruta: 'app/admin/dev/',
    porque: 'bitácoras internas: citan TEXTUAL los pedidos de Martín, que escribe de vos',
  },
  {
    ruta: 'app/admin/ui/bitacora.ts',
    porque: 'la misma bitácora, fuera de /dev: son los pedidos de Martín, textuales',
  },
  {
    ruta: 'app/conocimientos/curso',
    porque: 'transcripciones de un curso ajeno: son las palabras de otro, no las nuestras',
  },
  // ── Detectores: nombran las formas para RECONOCER lo que alguien ESCRIBE ────
  {
    ruta: 'lib/puestas-data.ts',
    porque: 'marcasDeVoseo(): es el detector que marca el voseo en un guion generado',
  },
  {
    ruta: 'lib/mako-intencion.ts',
    porque: 'clasifica lo que Martín MANDA por WhatsApp; sin las formas no reconoce nada',
  },
  {
    ruta: 'lib/mako-router.ts',
    porque: 'ídem: rutea el mensaje ENTRANTE («¿quién sos?», «dale»)',
  },
  {
    ruta: 'lib/reaccion-emoji.ts',
    porque: 'reconoce el agradecimiento entrante («sos un genio») para reaccionar',
  },
  {
    ruta: 'lib/mako-doer-acciones.ts',
    porque: 'detecta la confirmación entrante («hacelo», «cargalo») y le habla a MARTÍN',
  },
  {
    ruta: 'app/api/webhooks/calendly/route.ts',
    porque: 'lista las variantes de UNA pregunta tal como pudo escribirla el cliente',
  },
  {
    ruta: 'app/whatsapp/EmojiPicker.tsx',
    porque: 'keywords de búsqueda: es lo que el usuario TIPEA para encontrar el emoji',
  },
  // ── Prompts que nombran el voseo justamente para prohibirlo (o para ofrecerlo)
  {
    ruta: 'lib/campaign-structurer.ts',
    porque: 'el prompt prohíbe el voseo en el copy del anuncio nombrando las formas',
  },
  { ruta: 'lib/ig-writer.ts', porque: 'ídem, para las piezas de Instagram' },
  { ruta: 'lib/landing-writer.ts', porque: 'ídem, para el copy de la landing' },
  { ruta: 'lib/video-planner.ts', porque: 'ídem, para el guion del video' },
  { ruta: 'lib/onboarding.ts', porque: 'ídem, para el panorama del Archivero' },
  { ruta: 'app/api/email/generar/route.ts', porque: 'ídem, para el email' },
  {
    ruta: 'lib/razones.ts',
    porque: 'el prompt enseña a conjugar de vos SOLO si la personalidad del cliente lo pide',
  },
  {
    ruta: 'lib/personalidad.ts',
    porque: 'el quiz OFRECE el voseo como voz: la frase de ejemplo tiene que estar en voseo',
  },
];

function archivosDelRepo(): string[] {
  return execFileSync('git', ['ls-files', 'app', 'lib', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
}

test('ninguna pantalla del repo le habla al cliente de vos', () => {
  const todos = archivosDelRepo();
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas
  // DISTINTAS: si `git ls-files` devuelve poco, el verde no significa nada.
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos: algo no está corriendo en el repo`);

  const enAlcance = todos.filter((f) => !FUERA_DE_ALCANCE.some((e) => f.startsWith(e.ruta)));

  const hallazgos: string[] = [];
  for (const ruta of enAlcance) {
    copyVisible(ruta).split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(VOSEO)) {
        const forma = m[0];
        const neutro = NEUTRO[forma.toLowerCase()];
        hallazgos.push(`${ruta}:${i + 1} — «${forma}» → «${neutro}»   ${linea.trim().slice(0, 120)}`);
      }
    });
  }

  assert.deepEqual(
    hallazgos,
    [],
    `El producto se usa en México: la interfaz va en español neutro.\n` +
      `${hallazgos.length} formas de voseo en ${enAlcance.length} archivos revisados:\n  ` +
      `${hallazgos.join('\n  ')}\n\n` +
      `Se arregla cambiando el copy. Si el archivo NECESITA nombrar la forma ` +
      `(un detector de lo que el usuario escribe, un prompt que prohíbe el voseo), ` +
      `va en FUERA_DE_ALCANCE de este test CON el porqué escrito.`,
  );
});

test('las excepciones del guard de voseo siguen apuntando a algo que existe', () => {
  // Una ruta escrita a mano que queda vieja no falla: desaparece en silencio, y se
  // lleva puesto el alcance del guard sin que nadie se entere.
  const todos = archivosDelRepo();
  const huerfanas = FUERA_DE_ALCANCE
    .filter((e) => !todos.some((f) => f.startsWith(e.ruta)))
    .map((e) => `${e.ruta} (${e.porque})`);

  assert.deepEqual(huerfanas, [], `excepciones que ya no apuntan a ningún archivo:\n  ${huerfanas.join('\n  ')}`);
});

/** Normaliza el texto de un JSX: el copy viene partido en varias líneas. */
const enUnaLinea = (s: string) => s.replace(/\s+/g, ' ');

test('el aviso de navegador incompatible ofrece una SALIDA, no solo la puerta cerrada', () => {
  // Un aviso que dice «no podés» y nada más deja a la persona en un callejón.
  // Este es el contrato: nombra los navegadores que sí sirven, y aclara que puede
  // seguir usando MaKo donde está — la extensión trabaja desde donde se instaló,
  // que es cierto porque el que encola y el que ejecuta solo comparten el
  // workspace (lib/flow-cola.ts), nunca la sesión ni el navegador.
  const copy = enUnaLinea(copyVisible('app/video-generator/PuentePanel.tsx'));
  const aviso = /Este navegador no puede instalar la extensión.{0,320}/.exec(copy)?.[0] ?? '';

  assert.ok(aviso, 'desapareció el aviso de navegador incompatible');
  assert.match(aviso, /Chrome/, 'el aviso tiene que nombrar a dónde ir');
  assert.match(aviso, /puedes seguir usando MaKo/, 'el aviso tiene que decir que no hay que mudarse');
});

test('TODO var(--fs-*) del repo apunta a un token que existe', () => {
  // Un `var(--x)` inexistente no da error: hereda el tamaño del padre, en
  // silencio. Es el mismo modo de falla que `<Icon name="inventado">` dibujando
  // un punto — y ya se coló dos veces (`--fs-xs`, `--fs-lg`).
  //
  // El chequeo va sobre el repo ENTERO y no sobre una lista de archivos: un guard
  // que cubre dos pantallas deja pasar la tercera, y el que la escribe no tiene
  // por qué saber que este test existe.
  const definidos = new Set(
    [...readFileSync(join(RAIZ, 'app/globals.css'), 'utf8').matchAll(/^\s*(--fs-[a-z]+)\s*:/gm)].map((m) => m[1]),
  );
  assert.ok(definidos.size >= 5, 'no se pudieron leer los tokens de app/globals.css');

  // `git grep` sale con código 1 cuando no encuentra NADA, y eso hace tirar a
  // execFileSync: sin este catch, el test explotaría con un error críptico justo
  // en el caso en que no hay nada que reprochar.
  let salida = '';
  try {
    salida = execFileSync(
      'git',
      ['grep', '-n', '-o', '-E', 'var\\(--fs-[a-z]+\\)', '--', 'app', 'lib'],
      { cwd: RAIZ, encoding: 'utf8' },
    );
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    if (err.status !== 1) throw e;   // 1 = sin coincidencias; cualquier otro sí es un problema
  }

  const huerfanos = salida
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [archivo, linea, uso] = l.split(':');
      return { archivo, linea, token: uso.replace(/^var\(|\)$/g, '') };
    })
    .filter((u) => !definidos.has(u.token))
    .map((u) => `${u.archivo}:${u.linea} usa ${u.token}`);

  assert.deepEqual(huerfanos, [], `tokens de fuente inexistentes:\n  ${huerfanos.join('\n  ')}`);
});
