// =============================================================================
// ¿Esta pregunta le llega a Martín? El juez de TODO lo que pregunta un chat en el Ops Center (10/11/2026; puro, con test)
// =============================================================================
// Martín, 10/11/2026: «Me están llegando un montón de preguntas al Ops Center… que no tienen sentido. Son preguntas técnicas…
// Que solamente me llegan las preguntas de decisiones importantes. Y nunca tiene que ser con lenguaje técnico que yo no
// entiendo». Ese día contestó doce «sí» seguidos sin leer. Cuatro de las reales:
//   «¿Arreglo los 2 rojos de tipos-ci-tiempo (CRLF) en otra punta?» · «¿Liberás RAM para que corra el tsc acotado ahora?» ·
//   «¿Agrego {{pago_motivo}} con su propio alcance?» · «¿Conectás Chrome para que mire la pantalla?»
// La regla está arriba de todo en AGENTS.md («A MARTÍN SÓLO LE LLEGAN SUS DECISIONES»). Esto la hace cumplir.
//
// QUÉ MIRA, y por qué en este orden:
//   · JERGA — palabras de la cocina (punta, rama, tests, tipos, tsc, CI, CRLF, RAM, commit, deploy, worktree, merge…) y lo que
//     sólo escribe un programador: un archivo (`x.ts`), una ruta (`lib/…`), `{{…}}`, un `código`, un nombre_con_guiones_bajos,
//     unNombreEnCamello, un id-con-tres-partes o un sha. Se busca en la pregunta, su contexto y sus opciones.
//   · HECHO — la pregunta le pide a Martín un dato que el chat puede MEDIR («¿te llegó?», «¿conectaste Chrome?», «¿liberaste
//     RAM?», «¿está abierto el Runner?»). Sólo en la pregunta: una opción que dice «Ya lo conecté» no la vuelve un hecho.
//   · ORDEN — «¿Sigo con…?», «¿Arranco por…?»: qué hace primero el chat. Es suyo (AGENTS.md: «qué arreglo va primero, si seguir
//     con el paso siguiente: se elige la opción recomendada y se hace»), salvo que hable de un TEMA de Martín.
//   · TEMA — plata, un cliente, un acceso, seguridad sin vuelta atrás, una fecha, o aprobar algo que tiene que ver. Lo que dice
//     que la decisión SÍ es de él.
//
// DOS USOS, Y CADA UNO FALLA HACIA SU LADO SEGURO:
//   1. EN LA FUENTE (`cartero preguntar`, el hook de AskUserQuestion, publicar en la Ticketera): con jerga, un hecho o una de orden
//      SE RECHAZA, con `motivoParaElChat`, y el chat sigue en su turno. Si era suya, la decide con la recomendada; si era de
//      Martín, la reescribe en palabras de producto. Un falso positivo cuesta UNA reescritura: el motivo nombra la palabra.
//   2. EN EL OPS CENTER (lo que ya llegó: las de antes, un wrap_up, una AskUserQuestion sin el hook): `llegaAMartin` la saca de
//      lo que espera — el bloque de arriba de la caja, el globito y «Espera tu respuesta». Acá un falso positivo ESCONDERÍA una
//      decisión de verdad, así que el TEMA la rescata: una pregunta de plata con jerga se le sigue mostrando (mal escrita, pero
//      suya). Es la regla de AGENTS.md para leer texto con reglas: el filtro que esconde falla hacia mostrar.
//
// ⚠️ ES UN JUEZ DE PALABRAS, NO DE INTENCIÓN: «¿Terminamos esto y después hacemos otra landing?» es del chat y no tiene una
//    palabra que lo diga; pasa. Lo que no caza lo sigue cazando la regla escrita. Se mide contra el banco de preguntas reales
//    (tests/fixtures/preguntas-ops-center.json) antes de tocar una lista: tiene que dar 0 falsos positivos sobre las de Martín.
// ⚠️ LA COPIA DEL CARTERO: scripts/operaciones/cartero.mjs lleva la misma función en JS (corre en la PC, sin el repo).
//    tests/pregunta-para-martin.test.ts corre las dos sobre el banco entero y exige que contesten lo mismo.
// ⚠️ SIN `server-only`: lo usan el servidor, las dos pantallas, la API y los tests.

export type PreguntaAJuzgar = {
  pregunta: string;
  contexto?: string | null;
  /** Las opciones: `titulo` (una pregunta del chat) o `texto` (una decisión de la Ticketera), y su detalle. */
  opciones?: ReadonlyArray<{ titulo?: string | null; texto?: string | null; detalle?: string | null }>;
};

export type JuicioDePregunta = {
  /** ¿La ve Martín en el Ops Center? (lo que YA llegó: el tema rescata una suya mal escrita). */
  llega: boolean;
  /** ¿Se acepta al preguntarla? (la fuente: sin jerga, sin hecho y sin orden). */
  seAcepta: boolean;
  /** Las palabras técnicas que encontró, como estaban escritas (para decírselas al chat). */
  jerga: string[];
  /** El trozo que pregunta un hecho medible, o null. */
  hecho: string | null;
  /** ¿Pregunta qué hace primero el chat? */
  orden: boolean;
  /** ¿Habla de plata, clientes, accesos, seguridad, fechas o algo que aprobar? */
  tema: boolean;
};

const sinTildes = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '');

/** Lo que sólo escribe un programador, buscado en el texto TAL CUAL (las mayúsculas cuentan). */
const CODIGO: readonly RegExp[] = [
  /`[^`\n]+`/g,                                                                          // un `código`
  /\{\{[^}\n]*\}\}/g,                                                                    // {{una_variable}}
  /\b[\w.-]*\w\.(?:tsx?|mjs|cjs|jsx?|jsonl?|md|sql|css|sh|ps1|ya?ml|env|lock)\b/gi,      // un archivo
  // Una ruta del repo. `app/` pide dos tramos: «la app/la web» es castellano.
  /(?:^|[\s(«"'])(?:(?:lib|scripts|docs|tests|supabase|public|extension|plugin|\.github)\/[\w./[\]()-]*|app\/[\w[\]().-]+\/[\w./[\]()-]*)/g,
  /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g,                                                      // nombre_con_guiones_bajos
  /\b(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+){2,}\b/g,                                 // un-id-de-tres-partes
  /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g,                                // un sha
  /(?:^|\s)--[a-z][\w-]*/g,                                                              // --una-bandera
];
/** unNombreEnCamello (dos minúsculas antes de la mayúscula: «iPhone» e «iOS» no lo son), salvo los que son marcas. */
const CAMELLO = /\b[a-z]{2,}[A-Z][A-Za-z0-9]*\b/g;
const CAMELLOS_DE_MARCA = new Set(['macos', 'ipados', 'tvos', 'watchos']);

/** Siglas que se miran con sus mayúsculas: en minúscula son otra cosa (o nada). */
const SIGLAS: readonly RegExp[] = [/\bCI\b/g, /\bRAM\b/g, /\bPRs?\b/g];

/** Palabras de la cocina, sobre el texto sin tildes y en minúscula. */
const PALABRAS: readonly RegExp[] = [
  /\bpuntas?\b/g,
  /\b(?:otra|esta|una|su|nueva|misma)\s+rama\b/g,
  /\bramas?\s+(?:main|punta|claude|de git)\b/g,
  // «test A/B» y el test que es un imán de leads («test de personalidad») son del producto.
  /(?<!a\/b )\btests?\b(?!\s*a\s*\/\s*b)(?!\s+de\s+(?:personalidad|diagnostico|nivel))/g,
  /\btesteos?\b/g,
  /\b(?:de|los|sus|en|con)\s+tipos\b(?!\s+de\b)/g,
  /\btipos\s+(?:rojos?|ci|en rojo)\b/g,
  /\btsc\b/g, /\btype-?check\w*/g, /\blint\w*/g, /\bcrlf\b/g,
  // «el desplegable» es un control de la pantalla, no un despliegue.
  /\bcommit\w*/g, /\bdeploy\w*/g, /\bdespleg(?!abl)\w*/g, /\bdespliegues?\b/g,
  // «push» de un aviso al teléfono (Web Push) es del producto; el de git, no.
  /\bworktrees?\b/g, /\bmerge\w*/g, /\brebase\w*/g, /(?<!web )(?<!notificacion )(?<!notificaciones )(?<!un )\bpush(?!\s+(?:notification|a\s+(?:los|las|tus|sus|todos|todas)\b))\w*/g,
  /\bpull request/g, /\bbranch\w*/g,
  /\bbuild\w*/g, /\bbundle\w*/g, /\bnpm\b/g, /\bgit\b/g, /\bgithub actions\b/g,
  // «Closing Script» es una tab.
  /\bmigraci(?:on|ones)\b/g, /\bendpoints?\b/g, /\bwebhooks?\b/g, /\bhooks?\b/g, /(?<!closing )\bscripts?\b/g, /\brefactor\w*/g,
  /\bheap\b/g, /\bpayloads?\b/g, /\bregex\w*/g, /\bjson\b/g, /\bcartero\b/g, /\bstaging\b/g, /\bbackend\b/g, /\bfrontend\b/g,
  /\bruntime\b/g, /\bsupabase\b/g, /\bvercel\b/g, /\btypescript\b/g,
];

/** Lo que la PC tiene y el chat puede mirar: el objeto de un hecho medible. */
const DE_LA_MAQUINA = String.raw`(?:chrome|navegador|extension|pc|computadora|compu|maquina|terminal|runner|app de claude|claude|sesion(?:es)?|chats?|pestanas?|ventanas?|servidor|ram|memoria|disco|espacio|qr|whatsapp web)`;

/** Un hecho que el chat puede medir, sobre la pregunta sin tildes y en minúscula. */
const HECHOS: readonly RegExp[] = [
  /\b(?:te|le|les|me)\s+(?:llego|llegaron)\b/,
  /^[¿\s]*llego\b/,
  /\brecibiste\b/,
  // Sin «recargas»: también es un sustantivo de plata («¿hacemos recargas automáticas de saldo?»).
  /\b(?:conect|instal|reinici|escane)(?:aste|as|es)\b/,
  new RegExp(String.raw`\bliber(?:aste|as|es)\b.*?\b${DE_LA_MAQUINA}\b`),
  new RegExp(String.raw`\b(?:abr(?:iste|is|es)|cerr(?:aste|as)|cierr(?:as|es))\b.*?\b${DE_LA_MAQUINA}\b`),
  /\b(?:probaste|pudiste)\b/,
  new RegExp(String.raw`\b(?:volves|vuelves|podes|puedes|podrias)\s+(?:a\s+)?(?:abrir|conectar|cerrar|liberar|instalar|reiniciar|recargar)\b.*?\b${DE_LA_MAQUINA}\b`),
  new RegExp(String.raw`\bhay\s+(?:un|una|algun|alguna)\s+${DE_LA_MAQUINA}\b`),
  new RegExp(String.raw`\besta(?:n)?\s+(?:corriendo|prendid[oa]s?|abiert[oa]s?|conectad[oa]s?|encendid[oa]s?)\b.*?\b${DE_LA_MAQUINA}\b`),
];

/** «¿Sigo con…?»: qué hace primero el chat (al principio de la pregunta). */
const ORDEN = /^[¿\s]*(?:sigo|seguimos|continuo|continuamos|avanzo|avanzamos|arranco|arrancamos|empiezo|empezamos|voy con|paso a|paso al|arreglo|lo arreglo|hago (?:primero|antes)|primero (?:hago|arreglo|sigo))\b/;

/** Los temas de Martín, sobre el texto sin código, sin tildes y en minúscula. */
// Una campaña, un anuncio, un lanzamiento, un día o un grupo de un cliente también son de él: «¿Empezamos la campaña el lunes?».
const TEMA = /(?:\b(?:cobr\w*|precios?|pag(?:o|os|ar|an|ue|ues|amos)|usd|dolar\w*|factur\w*|gast(?:o|os|ar|amos)|presupuesto\w*|suscripci\w*|descuentos?|reembols\w*|devoluci\w*|clientes?|leads?|accesos?|permisos?|contrasenas?|invitaci\w*|invit(?:o|ar|amos)|seguridad|irreversible|para siempre|fechas?|deadline|aprob\w*|captura\w*|campanas?|anuncios?|lanzamientos?|lanzar|grupos?|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|us\$|\$\s?\d)/;

function textosDe(p: PreguntaAJuzgar): string[] {
  const out = [p.pregunta ?? '', p.contexto ?? ''];
  for (const o of p.opciones ?? []) out.push(o.titulo ?? o.texto ?? '', o.detalle ?? '');
  return out.filter((t): t is string => typeof t === 'string' && !!t.trim());
}

/**
 * El texto sin tildes y en minúscula, con de qué posición del ORIGINAL sale cada letra: así lo que se encuentra en el plano se
 * cita como estaba escrito («¿Liberás RAM…», no «liberas ram»). Letra por letra: una tilde suelta en NFD no corre las posiciones.
 */
function plano(texto: string): { s: string; desde: number[] } {
  let s = '';
  const desde: number[] = [];
  let i = 0;
  for (const ch of texto) {
    const p = sinTildes(ch).toLowerCase();
    for (let k = 0; k < p.length; k++) desde.push(i);
    s += p;
    i += ch.length;
  }
  desde.push(i);
  return { s, desde };
}
const enElOriginal = (texto: string, pl: { desde: number[] }, ini: number, fin: number): string => texto.slice(pl.desde[ini], pl.desde[fin]);

/** Las palabras técnicas de un texto, como estaban escritas, sin repetir. */
export function jergaEn(texto: string): string[] {
  const vistas = new Map<string, string>();
  const anotar = (m: string) => {
    const t = m.trim().replace(/^[(«"']+/, '');
    if (t && !vistas.has(t.toLowerCase())) vistas.set(t.toLowerCase(), t);
  };
  for (const re of CODIGO) for (const m of texto.matchAll(re)) anotar(m[0]);
  for (const m of texto.matchAll(CAMELLO)) if (!CAMELLOS_DE_MARCA.has(m[0].toLowerCase())) anotar(m[0]);
  for (const re of SIGLAS) for (const m of texto.matchAll(re)) anotar(m[0]);
  const pl = plano(texto);
  for (const re of PALABRAS) for (const m of pl.s.matchAll(re)) anotar(enElOriginal(texto, pl, m.index ?? 0, (m.index ?? 0) + m[0].length));
  return [...vistas.values()];
}

const sinCodigo = (s: string): string => [...CODIGO, CAMELLO].reduce((t, re) => t.replace(re, ' '), s);

/** El juicio de una pregunta (ver la cabecera). */
export function juzgarPregunta(p: PreguntaAJuzgar): JuicioDePregunta {
  const textos = textosDe(p);
  const todo = textos.join('\n');
  const jerga = jergaEn(todo);
  const original = String(p.pregunta ?? '').replace(/\s+/g, ' ').trim();
  const pl = plano(original);
  let hecho: string | null = null;
  for (const re of HECHOS) {
    const m = re.exec(pl.s);
    if (!m) continue;
    const cita = enElOriginal(original, pl, m.index, m.index + m[0].length).replace(/^[¿\s]+/, '').trim();
    hecho = cita.length > 60 ? `${cita.slice(0, 59).trimEnd()}…` : cita;
    break;
  }
  const tema = TEMA.test(plano(sinCodigo(todo)).s);
  const orden = !tema && ORDEN.test(pl.s);
  const seAcepta = !jerga.length && !hecho && !orden;
  return { llega: seAcepta || tema, seAcepta, jerga, hecho, orden, tema };
}

/** Un juicio por texto, para lo que se pregunta en cada refresco (la lista, el bloque, el globito): el mismo texto, el mismo juicio. */
const memo = new Map<string, JuicioDePregunta>();
const MEMO_MAX = 2000;
const claveDe = (p: PreguntaAJuzgar): string => textosDe(p).join('\u0001');
function juicioGuardado(p: PreguntaAJuzgar): JuicioDePregunta {
  const k = claveDe(p);
  let j = memo.get(k);
  if (!j) {
    j = juzgarPregunta(p);
    if (memo.size >= MEMO_MAX) memo.clear();
    memo.set(k, j);
  }
  return j;
}

/** ¿La ve Martín? Lo que pregunta el Ops Center para lo que ya llegó (el bloque, el globito, «Espera tu respuesta», la API). */
export const llegaAMartin = (p: PreguntaAJuzgar): boolean => juicioGuardado(p).llega;

const citar = (xs: readonly string[]) => xs.slice(0, 4).map((x) => `«${x}»`).join(', ');

/**
 * Lo que se le contesta al chat cuando su pregunta no le llega a Martín (null = se acepta). Es lo que imprime `cartero preguntar`, lo
 * que lee el chat cuando el hook le niega un AskUserQuestion y lo que devuelve publicar en la Ticketera. Dice qué hacer, en el orden
 * en que conviene: decidirla, y sólo si de verdad es de Martín, reescribirla.
 */
export function motivoParaElChat(j: JuicioDePregunta): string | null {
  if (j.seAcepta) return null;
  const decidir = 'decídela tú con la opción recomendada, hazla y cuéntalo en tu cierre';
  const suya = 'Si de verdad la decide él (plata, un cliente real, un acceso, seguridad sin vuelta atrás, una fecha o algo que tiene que ver), escríbela en palabras de producto y vuelve a preguntar.';
  if (j.hecho) {
    return `Esta pregunta no le llega a Martín: le pide un dato que puedes medir tú («${j.hecho}»). Mídelo, o déjalo anotado en tu relevo; si hace falta que él haga algo en su computadora, va en tu relevo, no como pregunta.${j.jerga.length ? ` Además dice ${citar(j.jerga)}, que es lenguaje técnico.` : ''}`;
  }
  if (j.jerga.length) {
    return `Esta pregunta no le llega a Martín: dice ${citar(j.jerga)}, que es lenguaje técnico. Si es técnica, ${decidir}. ${suya}`;
  }
  return `Esta pregunta no le llega a Martín: es sobre qué haces primero, y eso lo decides tú. Elige la opción recomendada, hazla y cuéntalo en tu cierre. ${suya}`;
}
