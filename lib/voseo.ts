// =============================================================================
// voseo — las formas del voseo, GENERADAS desde los verbos (PURO)
// =============================================================================
// Una sola regla para las dos puntas:
//   · el guard del repo (tests/puente-panel-copy.test.ts), que barre el copy de app/, lib/ y components/;
//   · `marcasDeVoseo` (re-exportada por lib/puestas-data.ts), la segunda capa sobre lo que escribe la IA: el Copywriter,
//     el Video Planner, flujo-ia, mako-redacta y las variaciones del Media Buyer.
// Hasta el 29/10/2026 la segunda capa era una LISTA de 21 palabras y dejaba pasar «escribime», «agendá», «mandame» y
// «decime» (docs/hallazgos-ia.md). El generador vivía adentro del test: se mudó acá para que la IA mida con lo mismo.
// =============================================================================

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
  descargar descartar duplicar editar enterar entrar entregar escanear escuchar esperar
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
  saber suspender vender
  abrir compartir cubrir cumplir decidir definir describir discutir dividir
  escribir existir imprimir inscribir insistir permitir recibir subir sufrir
  suscribir unir vivir
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
  inscribir olvidar poner quedar quitar registrar salir saltar sentar sentir subir
  sumar suscribir tomar venir
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
export const HOMOGRAFOS: Record<string, string> = {
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
  // Desde que la IA mide con este diccionario (29/10/2026): en un texto de cliente aparecen nombres y temas propios.
  tomás: 'es un nombre («Tomás, de Monterrey»), no solo «tomar»',
  mandala: 'es el dibujo («colorear un mandala»), no «mandar» + «la»',
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
export const FORMAS_GENERADAS = new Set<string>();

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
 * Las marcas de voseo de un texto, en minúscula y sin repetir. Vacío = limpio.
 *
 * No corrige: el texto se marca y se pide rehacer, porque reemplazar formas verbales a mano rompe la prosodia que el
 * guion venía a cuidar. Usa el MISMO diccionario que el guard del repo (`voseoEn`).
 */
export function marcasDeVoseo(texto: string): string[] {
  return [...new Set(voseoEn(texto).map((h) => h.forma.toLowerCase()))];
}
