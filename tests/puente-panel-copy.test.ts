// =============================================================================
// El copy va en español neutro, y las formas de voseo se GENERAN, no se enumeran
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
//
// ⚠️ `git ls-files` lista el ÍNDICE, no el disco: un archivo nuevo SIN commitear
// no se revisa y pasa en verde hasta que alguien lo agrega. El guard cubre lo que
// ya está en el repo, no lo que está a medio escribir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(import.meta.dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// El generador: de una lista de VERBOS salen todas las formas
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ Las formas NO se escriben una por una: se GENERAN desde los infinitivos.
 *
 * Enumerarlas a mano es exactamente lo que dejó pasar «¿Cuánto invertís por día
 * en Meta Ads?» —la segunda pregunta del diagnóstico del onboarding, en
 * producción, con este test en VERDE— hasta que alguien la vio EN LA PANTALLA el
 * 03/09/2026. Una lista escrita a mano cubre lo que ya se escribió, nunca el
 * verbo que todavía no usó nadie: faltaban `hablás`, `entregás`, `corregís`,
 * `aprobás`, `invertís`, `lanzás` y `agendás`, todos de uso diario.
 *
 * La conjugación voseante es REGULAR y sale sola del infinitivo:
 *   -ar → -ás / -á    ·  -er → -és / -é    ·  -ir → -ís / -í
 * más el clítico pegado (`mandalo`, `contame`, `pedíselo`). Lo único irregular
 * está del lado NEUTRO (tener → tienes, contar → cuenta, hacer → haz), y eso es
 * lo único que hay que escribir. Sumar un verbo trae sus ~30 formas de una.
 */

/** infinitivo → [presente de tú, imperativo de tú]. Solo lo que cambia de raíz. */
const IRREGULARES: Record<string, [string, string]> = {
  // -ar que diptongan
  acordar: ['acuerdas', 'acuerda'], aprobar: ['apruebas', 'aprueba'],
  apretar: ['aprietas', 'aprieta'], cerrar: ['cierras', 'cierra'],
  colgar: ['cuelgas', 'cuelga'], comenzar: ['comienzas', 'comienza'],
  contar: ['cuentas', 'cuenta'], despertar: ['despiertas', 'despierta'],
  empezar: ['empiezas', 'empieza'], encontrar: ['encuentras', 'encuentra'],
  jugar: ['juegas', 'juega'], mostrar: ['muestras', 'muestra'],
  pensar: ['piensas', 'piensa'], probar: ['pruebas', 'prueba'],
  recordar: ['recuerdas', 'recuerda'], renovar: ['renuevas', 'renueva'],
  sentar: ['sientas', 'sienta'], soltar: ['sueltas', 'suelta'],
  // -ar con hiato: el neutro YA lleva tilde, y la conserva con el clítico
  ampliar: ['amplías', 'amplía'], confiar: ['confías', 'confía'],
  continuar: ['continúas', 'continúa'], enviar: ['envías', 'envía'],
  evaluar: ['evalúas', 'evalúa'], puntuar: ['puntúas', 'puntúa'],
  // `andá` no es «anda»: en rioplatense es el imperativo de ir
  andar: ['andas', 've'],
  // -er
  atender: ['atiendes', 'atiende'], devolver: ['devuelves', 'devuelve'],
  encender: ['enciendes', 'enciende'], entender: ['entiendes', 'entiende'],
  hacer: ['haces', 'haz'], mover: ['mueves', 'mueve'],
  perder: ['pierdes', 'pierde'], poder: ['puedes', 'puede'],
  mantener: ['mantienes', 'mantén'], poner: ['pones', 'pon'],
  proponer: ['propones', 'propón'], querer: ['quieres', 'quiere'],
  resolver: ['resuelves', 'resuelve'], soler: ['sueles', 'suele'],
  tener: ['tienes', 'ten'], traer: ['traes', 'trae'],
  volver: ['vuelves', 'vuelve'],
  // -ir
  conseguir: ['consigues', 'consigue'], convertir: ['conviertes', 'convierte'],
  corregir: ['corriges', 'corrige'], decir: ['dices', 'di'],
  elegir: ['eliges', 'elige'], invertir: ['inviertes', 'invierte'],
  medir: ['mides', 'mide'], pedir: ['pides', 'pide'],
  preferir: ['prefieres', 'prefiere'], repetir: ['repites', 'repite'],
  salir: ['sales', 'sal'], seguir: ['sigues', 'sigue'],
  sentir: ['sientes', 'siente'], servir: ['sirves', 'sirve'],
  venir: ['vienes', 'ven'],
};

/**
 * Los regulares no necesitan nada: `entregar` → entregás/entregá/entregalo y
 * entregas/entrega/entrégalo salen del infinitivo.
 *
 * ⚠️ NO están `ser`, `estar`, `ir`, `ver` ni `dar`: en esos el voseo se escribe
 * igual que el tú (`estás`, `vas`, `ves`, `das`) y marcarlos es un falso positivo
 * garantizado. `sos` —el único que sí se distingue— va abajo, en LEXICO.
 */
const REGULARES = `
  activar actualizar agendar agregar ajustar analizar anotar apagar apurar armar
  arrancar arrastrar avisar bajar borrar buscar calcular cambiar cancelar cargar
  chatear clonar cobrar comentar comparar completar comprar conectar configurar
  confirmar contestar contratar copiar cortar crear cuidar dejar desactivar
  descargar descartar duplicar editar enterar entrar entregar escanear esperar
  exportar fijar filtrar firmar ganar generar grabar guardar hablar ignorar
  importar ingresar iniciar instalar intentar lanzar limpiar llamar llenar llevar
  mandar marcar mejorar mirar necesitar olvidar ordenar organizar pagar parar
  pasar pegar planificar preguntar preparar programar publicar quedar quitar
  registrar reservar revisar sacar saltar seleccionar sincronizar sumar terminar
  tirar tocar tomar trabajar usar validar verificar visitar
  aceptar adaptar alternar anclar aplicar ayudar capturar charlar citar clasificar
  conservar contrastar dedicar destilar destildar dictar enmarcar enumerar escalar
  escapar evitar explicar facturar gastar imaginar juntar llegar lograr mencionar
  nombrar personalizar pintar presentar priorizar recargar reconectar recontactar
  redactar reemplazar regularizar reintentar resaltar respetar retomar rodear
  rotar segmentar tildar tratar
  aprender comer conocer correr creer deber desaparecer escoger leer meter ofrecer
  parecer prender prometer proteger recoger recorrer releer responder romper
  suspender vender
  abrir compartir cubrir cumplir decidir definir describir discutir dividir
  escribir existir imprimir insistir permitir recibir subir sufrir unir vivir
`.trim().split(/\s+/);

/**
 * Los únicos que aceptan el clítico `te` pegado (`fijate`, `quedate`).
 *
 * ⚠️ La lista es CERRADA a propósito, y no por prolijidad gramatical: en un repo
 * de TypeScript, «-ar + te» cae justo encima de medio diccionario inglés —
 * `crear`+te = `create`, `validar`+te = `validate`, `generar`+te = `generate`,
 * `activar`+te = `activate`, `duplicar`+te = `duplicate`. Un guard con falsos
 * positivos se termina apagando, y ahí se pierde el guard entero.
 */
const REFLEXIVOS = new Set(`
  acordar andar anotar apurar bajar cuidar enterar fijar hacer meter mover
  olvidar poner quedar quitar salir saltar sentar sentir subir sumar tomar venir
`.trim().split(/\s+/));

/**
 * ⚠️ El imperativo voseo de un -ir regular (`abrí`, `escribí`, `elegí`, `subí`,
 * `seguí`, `salí`, `pedí`, `recibí`) se escribe IGUAL que la 1ª persona del
 * pretérito, y MaKo narra en primera persona («no la escribí», «ya lo subí»).
 * Por eso no se genera… salvo estos dos, cuyo pretérito es otro: `vine`, `dije`.
 * Igual quedan cubiertos por el presente (`abrís`) y por el clítico (`abrilo`).
 */
const IMPERATIVO_IR_SEGURO = new Set(['venir', 'decir']);

/** Los pronombres que se pegan al imperativo. `te` sale de REFLEXIVOS. */
const CLITICOS = ['lo', 'la', 'los', 'las', 'le', 'les', 'me', 'nos',
  'selo', 'sela', 'selos', 'selas', 'melo', 'mela'];

/**
 * Formas que el generador produce y que NO se pueden marcar, con el porqué. Son
 * palabras que existen igual en neutro: marcarlas es un falso positivo, y un
 * falso positivo termina con alguien apagando el guard.
 */
const HOMOGRAFOS: Record<string, string> = {
  // «-ar» + el clítico «les» cae justo encima de un adjetivo plural de todos los
  // días. Los tres estaban EN EL REPO y son los que más ruido hacían (59 líneas).
  iniciales: 'el sustantivo («toca tus iniciales»), no «iniciar» + «les»',
  terminales: 'el adjetivo («condiciones terminales»), no «terminar» + «les»',
  generales: 'el adjetivo («datos generales»), no «generar» + «les»',
  puntuales: 'el adjetivo («envíos puntuales»), no «puntuar» + «les»',
  // Inglés adentro de prompts y de código: el guard mira strings, no idiomas.
  moves: 'es inglés, y está en los prompts de cámara de lib/escenas.ts',
  resolves: 'ídem, y en un repo con promesas por todos lados aparece solo',
  // Ambigüedades reales del español, la misma razón por la que se saltea el
  // imperativo pelado de los -ir: la forma existe igual fuera del voseo.
  creé: 'es el pretérito de crear («creé la campaña»), no solo el imperativo de creer',
  tomate: 'es también el vegetal',
};

// ── Dónde va la tilde ────────────────────────────────────────────────────────
// El imperativo neutro con clítico pegado casi siempre gana una tilde que el
// voseo no lleva (`mandale` → `mándale`, `pedíselo` → `pídeselo`). Ponerla bien
// es lo que hace que la sugerencia del error sirva para copiar y pegar.
const ACENTO: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const SIN_ACENTO: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const ES_VOCAL = /[aeiouáéíóú]/;
const ES_FUERTE = /[aeoáéó]/;
const TIENE_TILDE = /[áéíóú]/;

/** Parte la palabra en grupos vocálicos: un grupo ≈ una sílaba. */
function gruposVocalicos(palabra: string): { desde: number; hasta: number }[] {
  const grupos: { desde: number; hasta: number }[] = [];
  for (let i = 0; i < palabra.length; i++) {
    if (!ES_VOCAL.test(palabra[i])) continue;
    const ultimo = grupos.at(-1);
    // Dos vocales FUERTES seguidas son hiato, o sea dos sílabas: «trae» = tra-e,
    // y por eso el neutro es «tráelo» y no «traélo».
    const pega = ultimo?.hasta === i && !(ES_FUERTE.test(palabra[i]) && ES_FUERTE.test(palabra[i - 1]));
    if (pega) ultimo!.hasta = i + 1;
    else grupos.push({ desde: i, hasta: i + 1 });
  }
  return grupos;
}

/** Le pega el clítico al imperativo NEUTRO y le pone la tilde donde va. */
function conClitico(imperativo: string, clitico: string): string {
  const grupos = gruposVocalicos(imperativo);

  // Una tilde ya escrita dice cuál es la tónica, pero hay DOS tildes distintas y
  // se comportan al revés:
  //  · sobre í/ú marca un HIATO («envía», «continúa») y no se va nunca: «envíalo».
  //  · sobre á/é/ó marca la tónica de una aguda («propón», «mantén») y con el
  //    clítico la palabra deja de ser aguda, así que la tilde SOBRA: «proponlo».
  const tilde = [...imperativo].findIndex((c) => TIENE_TILDE.test(c));
  if (tilde >= 0) {
    if ('íú'.includes(imperativo[tilde])) return imperativo + clitico;
    const grupo = grupos.findIndex((g) => tilde >= g.desde && tilde < g.hasta);
    const largo = grupos.length - grupo + gruposVocalicos(clitico).length;
    if (largo >= 3) return imperativo + clitico;
    return imperativo.slice(0, tilde) + SIN_ACENTO[imperativo[tilde]] + imperativo.slice(tilde + 1) + clitico;
  }

  // Sin tilde escrita: es llana si termina en vocal, -n o -s («usa», «pon»), y
  // aguda si no («haz»).
  const tonica = /[aeiouns]$/.test(imperativo) ? Math.max(0, grupos.length - 2) : grupos.length - 1;
  const desdeElFinal = grupos.length - tonica + gruposVocalicos(clitico).length;
  // Todo clítico termina en vocal o en -s, así que una llana nunca lleva tilde
  // («ponle», «dile»); de esdrújula para atrás, siempre («úsalo», «díselo»).
  if (desdeElFinal < 3) return imperativo + clitico;

  const g = grupos[tonica];
  // En un diptongo la tilde va en la fuerte («cuenta» → «cué-»); si las dos son
  // débiles, en la segunda («cuida» → «cuí-»).
  let i = g.hasta - 1;
  for (let k = g.desde; k < g.hasta; k++) if (ES_FUERTE.test(imperativo[k])) i = k;
  return imperativo.slice(0, i) + ACENTO[imperativo[i]] + imperativo.slice(i + 1) + clitico;
}

// ── Léxico: lo que no es conjugación ─────────────────────────────────────────
/**
 * ⚠️ Lo que NO está, está afuera A PROPÓSITO, porque tiene un homógrafo neutro:
 *   · `ves`, `sabes`, `vives`, `dices`, `dale` → son formas normales de tú.
 *   · `vas a tener` estaba en el regex viejo y es idéntico en tú y en vos.
 *   · `nomás` es tan mexicano como rioplatense.
 */
const LEXICO: Record<string, string> = {
  vos: 'tú', sos: 'eres',
  acá: 'aquí', aca: 'aquí',
  laburo: 'trabajo', laburar: 'trabajar', laburás: 'trabajas', laburá: 'trabaja',
  pibe: 'chico', pibes: 'chicos', macanudo: 'amable', quilombo: 'desorden',
  chau: 'adiós', boludo: '(sacalo)',
  // «clickear» no se conjuga al neutro, se REEMPLAZA por una perífrasis, así que
  // no puede salir del generador (no existe «clickéalo»).
  clickeás: 'haces clic', clickeas: 'haces clic', clickeá: 'haz clic',
  clickealo: 'haz clic ahí', clickeale: 'haz clic ahí',
};

// ── El diccionario, ya generado ──────────────────────────────────────────────
/**
 * forma de voseo → con qué se reemplaza. La lista de formas ES el diccionario de
 * reemplazos: nadie puede sumar una forma sin decir por cuál se cambia. Un test
 * que dice «hay voseo» y no dice dónde ni qué poner no lo arregla nadie.
 */
/** Todo lo que el generador arma, homógrafos exceptuados incluidos. */
const FORMAS_GENERADAS = new Set<string>();

function construirDiccionario(): Map<string, string> {
  const VOSEO_PRES = { ar: 'ás', er: 'és', ir: 'ís' } as const;
  const VOSEO_IMP = { ar: 'á', er: 'é', ir: 'í' } as const;
  const SIN_TILDE = { ás: 'as', és: 'es', ís: 'is' } as const;

  const verbos = [...REGULARES, ...Object.keys(IRREGULARES)].sort();
  const neutroDe = (inf: string): [string, string] => {
    if (IRREGULARES[inf]) return IRREGULARES[inf];
    const raiz = inf.slice(0, -2);
    return inf.endsWith('ar') ? [`${raiz}as`, `${raiz}a`] : [`${raiz}es`, `${raiz}e`];
  };

  // Todo lo que es neutro se junta primero: una forma «de vos» que resulta ser
  // también una forma de tú (`comés` sin tilde es `comes`, que está bien escrito)
  // se cae sola, sin lista de excepciones que mantener.
  const neutras = new Set<string>();
  for (const inf of verbos) {
    const [tuPres, tuImp] = neutroDe(inf);
    neutras.add(tuPres).add(tuImp);
    for (const c of CLITICOS) neutras.add(conClitico(tuImp, c));
    if (REFLEXIVOS.has(inf)) neutras.add(conClitico(tuImp, 'te'));
  }

  const dic = new Map<string, string>();
  const sumar = (forma: string, neutro: string) => {
    if (neutras.has(forma)) return;
    // Se anota ANTES de mirar los homógrafos: así se puede comprobar después que
    // cada excepción escrita a mano siga tapando algo que el generador arma.
    FORMAS_GENERADAS.add(forma);
    if (HOMOGRAFOS[forma] || dic.has(forma)) return;
    dic.set(forma, neutro);
  };

  for (const inf of verbos) {
    const clase = inf.slice(-2) as 'ar' | 'er' | 'ir';
    const raiz = inf.slice(0, -2);
    const [tuPres, tuImp] = neutroDe(inf);

    // presente: «entregás», y «tenes» como lo escribe el que no pone la tilde
    sumar(raiz + VOSEO_PRES[clase], tuPres);
    sumar(raiz + SIN_TILDE[VOSEO_PRES[clase]], tuPres);

    // imperativo pelado: «entregá». El de los -ir se salta (ver IMPERATIVO_IR_SEGURO)
    if (clase !== 'ir' || IMPERATIVO_IR_SEGURO.has(inf)) sumar(raiz + VOSEO_IMP[clase], tuImp);

    // imperativo + clítico, en las dos grafías que se ven en la calle:
    // la correcta («mandalo», «pedíselo») y la hipercorregida («mandálo»)
    const vocal = clase === 'ar' ? 'a' : clase === 'er' ? 'e' : 'i';
    for (const c of [...CLITICOS, ...(REFLEXIVOS.has(inf) ? ['te'] : [])]) {
      const neutro = conClitico(tuImp, c);
      sumar(raiz + vocal + c, neutro);
      sumar(raiz + VOSEO_IMP[clase] + c, neutro);
    }
  }

  for (const [forma, neutro] of Object.entries(LEXICO)) dic.set(forma, neutro);
  return dic;
}

export const NEUTRO = construirDiccionario();

/**
 * Las formas se buscan por PALABRA, no con un regex gigante de alternativas: el
 * diccionario tiene miles de entradas y una alternación de ese tamaño se arrastra.
 *
 * ⚠️ El token incluye `_` y `-` a propósito, igual que los límites Unicode que
 * había antes: una forma pegada a un guion es parte de un id o de un slug
 * (`fria_quien_sos`), no prosa. Y NO se usa `\b`, que en JavaScript es ASCII:
 * entre la `á` de `pegá` y el espacio no hay borde de palabra, así que `\b(pegá)\b`
 * da CERO coincidencias sin tirar ningún error — en verde y sin cubrir nada.
 */
const PALABRA = /[\p{L}_-]+/gu;

export function voseoEn(texto: string): { forma: string; neutro: string }[] {
  const encontradas: { forma: string; neutro: string }[] = [];
  for (const m of texto.matchAll(PALABRA)) {
    const neutro = NEUTRO.get(m[0].toLowerCase());
    if (neutro) encontradas.push({ forma: m[0], neutro });
  }
  return encontradas;
}

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
export function copyVisible(ruta: string): string {
  // ⚠️ `git ls-files` lista el ÍNDICE, no el disco. Un archivo borrado y todavía
  // sin commitear aparece en la lista y no existe, y hasta hoy eso tiraba el
  // guard ENTERO con un ENOENT — o sea que borrar un archivo apagaba el chequeo
  // de voseo de los otros 900. Un archivo que no está no tiene copy que revisar:
  // se saltea y se sigue.
  let crudo: string;
  try { crudo = readFileSync(join(RAIZ, ruta), 'utf8'); } catch { return ''; }
  return soloCopy(crudo);
}

/**
 * Borra SOLO los comentarios, sabiendo en qué está parado.
 *
 * ⚠️ Esto era un `replace(/\/\*[\s\S]*?\*\//g, …)` y el `/*` no siempre abre un
 * comentario. En `lib/archivo-a-texto.ts` la línea
 *
 *     //  · .txt .md .vtt .srt y cualquier text/*  → directo del buffer. Gratis.
 *
 * tiene un `text/*` —un MIME con comodín, adentro de un comentario `//`— que abría
 * un bloque falso y lo cerraba 71 LÍNEAS DESPUÉS, en el primer `*​/` que apareciera.
 * Todo ese código quedaba en blanco para el guard, y ahí adentro estaba
 * «Transcribí TODO el texto… describí… Devolvé solo el texto». El test daba VERDE
 * sobre un pedazo de archivo que nunca miró, que es la misma forma de fallar que
 * este archivo entero viene a cerrar: no dice «no pude», dice «está todo bien».
 *
 * El arreglo es el ORDEN: primero se borra lo que va de `//` al fin de línea, y
 * recién después los bloques. Así un `/*` que vivía dentro de un comentario de
 * línea ya no existe cuando se buscan los bloques.
 */
function sinComentarios(crudo: string): string {
  const enBlanco = (m: string) => m.replace(/[^\n]/g, ' ');
  return crudo
    // ⚠️ EL ORDEN ES EL ARREGLO, y va primero el de línea. Al revés —como estaba—
    // un `/*` que vive DENTRO de un `//` abre un bloque que nadie cerró a
    // propósito, y se come el archivo hasta el próximo `*​/`.
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    // ⚠️ Y EL DE BLOQUE NECESITA SU PROPIA PROTECCIÓN, QUE NO TENÍA.
    //
    // El arreglo del orden (de arriba) cerró el caso del MIME escrito dentro de
    // un comentario `//`. No cerró el mismo MIME escrito donde de verdad vive:
    // un atributo. `app/whatsapp/EmpresaInbox.tsx` tiene
    //
    //     accept="image/​*,video/​*,audio/​*,application/pdf,…"
    //
    // y ese `/​*` abre un bloque falso que se cierra 17 líneas después. Adentro
    // quedaban los dos placeholders del composer —«Agregá un texto», «Escribí un
    // mensaje»— que es copy que ve un cliente MEXICANO, y el guard daba verde.
    //
    // MEDIDO antes de arreglarlo, sobre los 1150 archivos en alcance:
    // **1015 archivos con líneas invisibles y 7851 líneas de código que el guard
    // nunca miró.** No era un archivo raro: era el caso normal.
    //
    // La protección es la misma idea que la del `//`, mirando el carácter de
    // ANTES: un `/​*` que abre un comentario de verdad nunca viene pegado a una
    // letra o un dígito. En `image/​*` viene pegado a la `e`. En `text/​*`, a la
    // `t`. Un `/* …` real está al principio de línea, o después de un espacio,
    // un `(`, una `,` o un `=`.
    //
    // Probado rompiéndolo: con la clase de antes puesta en `[\s\S]` (o sea sin
    // protección) el guard vuelve a perder las 17 líneas de EmpresaInbox y el
    // test de abajo que las persigue falla.
    .replace(/(^|[^A-Za-z0-9_])\/\*[\s\S]*?\*\//g, (_m, antes: string) => antes + enBlanco(_m.slice(antes.length)));
}

/**
 * La parte pura, para poder probarla: saca lo que no es copy y NO mueve nada de
 * lugar — cada línea conserva su número y cada palabra su columna.
 */
export function soloCopy(crudo: string): string {
  const enBlanco = (m: string) => m.replace(/[^\n]/g, ' ');
  return sinComentarios(crudo)
    // ⚠️ Un salto ESCRITO dentro de una cadena (`\n`) no separa palabras para
    // nadie: la `n` se le pega a lo que sigue y `\ndevolvé` es un token que no
    // está en ningún diccionario. Así se escondían `\nacá`, `\narrancá` y
    // `\ndevolvé`, en prompts que son casi todos UNA cadena con saltos escritos.
    // Van DOS espacios porque son dos caracteres: acá nada puede cambiar de
    // largo, o el número de línea y la columna del hallazgo dejan de ser los del
    // archivo — y con eso se cae el mensaje y cualquier arreglo automático.
    .replace(/\\[nrtvfb]/g, '  ')
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
export const FUERA_DE_ALCANCE: { ruta: string; porque: string }[] = [
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
  // ── La landing de VENTA, que no es el producto ──────────────────────────────
  {
    ruta: 'app/vsl/',
    porque: 'la /vsl vende: la voz de ahí es la de Martín, y no la del producto que se usa adentro',
  },
  // ── Detectores: nombran las formas para RECONOCER lo que alguien ESCRIBE ────
  {
    ruta: 'lib/puestas-data.ts',
    porque: 'marcasDeVoseo(): es el detector que marca el voseo en un guion generado',
  },
  {
    ruta: 'lib/offer-quien-hace.ts',
    porque: 'detectores de Offer (16/10/2026): reconocen «lo hacemos por vos» en lo que escribió el dueño o la IA para avisar que una oferta promete hacerlo por el cliente; no es copy, nada de ahí se muestra',
  },
  // ── La voz de MaKo cuando le habla al DUEÑO, que es rioplatense a propósito ──
  // AGENTS.md: «La voz de MaKo es rioplatense, y el texto DEL CLIENTE no». Estos
  // tres son del lado del dueño, así que el voseo no es un error: es la regla.
  {
    ruta: 'lib/mako-doer-in.ts',
    porque: 'el prompt del Doer, que le habla a Martín por WhatsApp: su voz ES rioplatense',
  },
  {
    ruta: 'lib/doer-recetas.ts',
    porque: 'las recetas del prompt del Doer, mudadas de lib/mako-doer-in.ts el 08/10/2026: misma voz rioplatense',
  },
  {
    ruta: 'lib/mako-guardian.ts',
    porque: 'el prompt del Perro, que le contesta a Martín en su propio tablero',
  },
  {
    ruta: 'lib/plan-proyectos-catalogo.ts',
    porque: 'los NOMBRES de los proyectos del board del dueño: los escribió él y son su etiqueta',
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
    ruta: 'lib/flujo-ia-consulta.ts',
    porque: 'decide si lo que la persona ESCRIBE en el chat del lienzo es una pregunta («decime», «contame», «¿podés…?»): sin las formas no reconoce lo que escriben',
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

test('el detector conjuga solo, y no se queda corto como la lista a mano', () => {
  // ⚠️ TODOS los casos de acá terminan en vocal acentuada o la llevan pegada al
  // final: es el único modo de que este test valga algo. Con `\b(pegá)\b` —el
  // borde de palabra de JavaScript es ASCII, y entre `á` y el espacio no hay
  // borde— el regex da CERO coincidencias, sin tirar error, y un test escrito
  // solo con `tenés` o `invertís` pasaría igual de verde con el detector roto.
  const marca = (t: string) => voseoEn(t).map((h) => `${h.forma}→${h.neutro}`);

  // La que estuvo en producción con el test en verde (lib/fase-diagnostico.ts)
  assert.deepEqual(marca('¿Cuánto invertís por día en Meta Ads?'), ['invertís→inviertes']);
  // Las otras seis que se encontraron a ojo revisando copy nuevo
  assert.deepEqual(marca('Acá hablás, entregás, corregís, aprobás, lanzás y agendás'),
    ['Acá→aquí', 'hablás→hablas', 'entregás→entregas', 'corregís→corriges',
      'aprobás→apruebas', 'lanzás→lanzas', 'agendás→agendas']);

  // Terminadas en vocal acentuada: el caso que `\b` deja pasar en silencio
  assert.deepEqual(marca('Probá de nuevo'), ['Probá→prueba']);
  assert.deepEqual(marca('Tocá acá y pegá el código'),
    ['Tocá→toca', 'acá→aquí', 'pegá→pega']);
  assert.deepEqual(marca('Andá a Meta y conectá la cuenta'),
    ['Andá→ve', 'conectá→conecta']);

  // El clítico pegado, con y sin la tilde que le pone la gente
  assert.deepEqual(marca('mandale, mandále, pedíselo, contame, decile, ponete'),
    ['mandale→mándale', 'mandále→mándale', 'pedíselo→pídeselo', 'contame→cuéntame',
      'decile→dile', 'ponete→ponte']);

  // La tilde del neutro se recalcula, no se arrastra: sobre í/ú marca un hiato y
  // se queda («envía» → «envíalo»); sobre á/é/ó marca una aguda que con el
  // clítico deja de serlo, y ahí sobra («propón» → «proponlo», no «propónlo»).
  assert.deepEqual(marca('proponelo, mantenelo, enviala, proponémelo'),
    ['proponelo→proponlo', 'mantenelo→mantenlo', 'enviala→envíala', 'proponémelo→propónmelo']);

  // Lo que NO se marca, y por qué (si esto rompe, el guard se vuelve inusable)
  assert.deepEqual(marca('Ya escribí los mensajes, subí el video y elegí la mejor'), [],
    '-ir: el imperativo de vos se escribe igual que el pretérito de MaKo en 1ª persona');
  assert.deepEqual(marca('Si quieres, puedes crear y validar tu cuenta'), [],
    'las formas de tú no se tocan');
  assert.deepEqual(marca('create, validate, generate, animate, mandate'), [],
    'palabras inglesas que caen encima de «-ar + te»');
  assert.deepEqual(marca('Pedí un tomate y lo generé con datos generales'), [],
    'homógrafos declarados: el vegetal y el adjetivo, que no son «tomar» ni «generar»');
  assert.deepEqual(marca('fria_quien_sos y data-tenes-algo'), [],
    'pegada a `_` o `-` es un id o un slug, no prosa');
});

test('sacar lo que no es copy no mueve ni una línea ni una columna', () => {
  // El mensaje del hallazgo dice `archivo:línea`, y cualquier arreglo se escribe
  // por columna. Si esta función corriera algo de lugar, las dos cosas mienten.
  const fuente = [
    "const a = 1; // pegá acá",
    "/* probá esto",
    "   y tocá aquello */",
    "const p = `Contexto.\\nDevolvé un JSON y avisá si no podés.`;",
  ].join('\n');
  const visto = soloCopy(fuente);

  assert.equal(visto.split('\n').length, fuente.split('\n').length, 'cambió la cantidad de líneas');
  for (const [i, linea] of visto.split('\n').entries()) {
    const original = fuente.split('\n')[i];
    // La única línea que puede ACORTARSE es la del `//`, y sólo por la cola.
    assert.ok(linea.length <= original.length && original.startsWith(linea.replace(/\s+$/, '').slice(0, 12)),
      `la línea ${i + 1} se movió de lugar`);
  }

  // El comentario y el bloque se van; la cadena queda.
  assert.deepEqual(voseoEn(visto).map((h) => h.forma), ['Devolvé', 'avisá', 'podés']);

  // ⚠️ Y la columna: `Devolvé` viene pegado a un `\n` ESCRITO, que es el caso que
  // se escapaba. Tiene que caer en la misma columna que en el archivo real.
  const linea = visto.split('\n')[3];
  assert.equal(linea.indexOf('Devolvé'), fuente.split('\n')[3].indexOf('Devolvé'));
});

test('un `/*` que no abre un comentario no se lleva puesto el archivo', () => {
  // El caso real de lib/archivo-a-texto.ts: un MIME con comodín adentro de un
  // comentario `//`. Con el regex viejo abría un bloque que se cerraba 71 líneas
  // después y dejaba TODO ese código invisible para el guard, en verde.
  const enComentario = [
    "// lee .txt .md y cualquier text/*  → directo del buffer",
    "const P = 'Devolvé solo el texto.';",
    "const Q = 'Probá de nuevo.';   /* este sí es un bloque: mirá */",
    "const R = 'Tocá aquí.';",
  ].join('\n');
  assert.deepEqual(voseoEn(soloCopy(enComentario)).map((h) => h.forma),
    ['Devolvé', 'Probá', 'Tocá'], 'un `/*` adentro de un `//` abrió un bloque falso');

  // Y en una cadena tampoco: `accept="image/*"` es el mismo `/*` sin comentario.
  const enCadena = ['const A = <input accept="image/*" />;', "const B = 'Conectá la cuenta.';"].join('\n');
  assert.deepEqual(voseoEn(soloCopy(enCadena)).map((h) => h.forma), ['Conectá']);

  // Lo que sí es un comentario se sigue yendo, que es el otro medio contrato.
  assert.deepEqual(voseoEn(soloCopy('/* mirá esto */ const x = 1; // y pegá acá')), []);
});

test('cada forma que el guard marca trae con qué reemplazarla', () => {
  // Un hallazgo sin reemplazo no lo arregla nadie: es la mitad del contrato.
  assert.ok(NEUTRO.size > 3000, `el generador armó ${NEUTRO.size} formas: no corrió`);

  const sinNeutro = [...NEUTRO].filter(([, n]) => !n?.trim()).map(([f]) => f);
  assert.deepEqual(sinNeutro, [], 'formas marcadas sin decir por cuál se cambian');

  const iguales = [...NEUTRO].filter(([f, n]) => f === n).map(([f]) => f);
  assert.deepEqual(iguales, [], 'formas que se «reemplazan» por sí mismas: no son voseo');

  // El reemplazo tiene que ser neutro, no otra forma de vos: si el sugerido está
  // en el diccionario, el guard se estaría mordiendo la cola.
  const circulares = [...NEUTRO].filter(([, n]) => NEUTRO.has(n)).map(([f, n]) => `${f} → ${n}`);
  assert.deepEqual(circulares, [], 'el reemplazo sugerido es, a su vez, voseo');

  // Y del otro lado: una excepción que el generador ya no produce no protege de
  // nada y queda como ruido que nadie se anima a tocar. Es el mismo chequeo que
  // el de FUERA_DE_ALCANCE, para la otra lista escrita a mano.
  const muertos = Object.keys(HOMOGRAFOS).filter((f) => !FORMAS_GENERADAS.has(f));
  assert.deepEqual(muertos, [], 'homógrafos exceptuados que el generador ya no arma');
});

test('ninguna pantalla del repo le habla al cliente de vos', () => {
  const todos = archivosDelRepo();
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas
  // DISTINTAS: si `git ls-files` devuelve poco, el verde no significa nada.
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos: algo no está corriendo en el repo`);

  const enAlcance = todos.filter((f) => !FUERA_DE_ALCANCE.some((e) => f.startsWith(e.ruta)));

  const hallazgos: string[] = [];
  for (const ruta of enAlcance) {
    copyVisible(ruta).split('\n').forEach((linea, i) => {
      for (const { forma, neutro } of voseoEn(linea)) {
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

test('un MIME con comodin en un ATRIBUTO no ciega al guard', () => {
  // El agujero real, encontrado el 08/09/2026 mirando por que «Agrega un texto»
  // seguia en voseo con el test en verde: `accept="image/*,video/*"` abria un
  // bloque de comentario falso y el guard perdia las 17 lineas siguientes — las
  // del composer, que es copy que ve un cliente mexicano.
  //
  // El caso hermano (el MIME dentro de un `//`) ya estaba cubierto por el ORDEN
  // de los dos replace. Este no: el MIME vive donde de verdad se escribe, que es
  // un atributo, y ahi el orden no ayuda.
  //
  // MEDIDO al encontrarlo: 1015 de 1150 archivos en alcance tenian lineas que el
  // guard nunca miro, y detras habia 13 formas de voseo en copy de producto
  // (StageMoveDialog, EmpresaInbox, WhatsAppApp).
  const fuente = [
    '<input accept="image/*,video/*,application/pdf" />',
    "const t = 'Revisá y confirmá';",
    'const u = 1; /* un comentario de verdad con acá adentro */ const v = 2;',
  ].join('\n');
  const visto = soloCopy(fuente);

  // La linea de DESPUES del MIME tiene que seguir visible.
  assert.match(visto, /Revisá y confirmá/, 'el MIME con comodín volvió a abrir un bloque falso: el guard perdió lo que venía después');
  // Y el comentario de verdad tiene que seguir borrandose: arreglar la ceguera
  // no puede costar que el guard empiece a marcar los comentarios del repo,
  // que estan en rioplatense a proposito.
  assert.doesNotMatch(visto, /un comentario de verdad/, 'dejó de borrar los comentarios de bloque de verdad');
  // Cada linea conserva su numero: el mensaje del guard cita archivo:linea.
  assert.equal(visto.split('\n').length, 3);

  // Probado rompiendolo: con la clase de proteccion sacada del segundo replace,
  // este test falla en el primer assert (el guard se come «Revisá y confirmá»)
  // y el guard grande vuelve a dar verde sobre los 13 hallazgos reales.
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
  // ⚠️ La ruta se mudó: los cuatro pasos de configuración viven ahora en el popup
  // de la extensión, y de `PuentePanel.tsx` solo sobrevivieron los avisos. Este
  // test es la razón por la que el copy sobrevivió TEXTUAL en la mudanza: sin él,
  // reescribirlo «para achicar» se lleva puesto el contrato.
  const copy = enUnaLinea(copyVisible('app/video-generator/puente-avisos.tsx'));
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
