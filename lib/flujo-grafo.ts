// =============================================================================
// flujo-grafo — una automatización del chatbot como FLUJO CON RAMAS
// =============================================================================
// Pedido de Martín (08/10/2026, punto 9): «Yo debería poder crear CONDICIONALES... A raíz
// de cada condicional, debería poder crear tarjetas arriba y abajo, no solo a la derecha,
// hoy en día no es un flujo, es solamente una secuencia lineal... Ya te había pedido que
// revises como lo hace Manychat, copiemos de allí».
//
// Módulo PURO y sin `server-only`. Lo leen cuatro lugares que antes tenían cada uno su
// idea de «cuál es el paso siguiente»: el motor (lib/nutricion.ts), el lienzo
// (lib/flujo-conversacion.ts + app/automations), el simulador de «Probar» y el script que pasa
// las secuencias de antes a tarjetas. Si el dibujo y el motor no leen la MISMA función,
// se separan en la primera edición (AGENTS.md, «Sólo se dibuja la rama que el motor
// EJECUTA»).
//
// ── EL DATO SIGUE SIENDO `pasos` ─────────────────────────────────────────────────────
// No hay una columna `grafo` aparte: cada elemento de `nutricion_secuencias.pasos` es un
// NODO. Con dos fuentes, los diez escritores de `pasos` que ya existen (la API de MaKo,
// el generador, regrabar un audio, /email…) dejarían el grafo desincronizado. Lo que se
// suma son campos opcionales:
//
//   · `id`         identidad ESTABLE. `orden` no sirve: `setSecuenciaPasos` lo renumera en
//                  cada guardado, y `paso_actual` (un índice) le manda a un lead el paso
//                  de OTRO apenas alguien inserta una tarjeta en el medio.
//   · `siguiente`  a qué nodo sigue (null = termina). AUSENTE = el elemento siguiente del
//                  array: así una secuencia lineal de antes ES un grafo sin convertir nada.
//   · `nodo`       la clase cuando no es un mensaje ni una acción: esperar · condicion ·
//                  respuesta · ir_a. Es un campo APARTE de `tipo` a propósito: `tipo` dice
//                  de qué está hecho un MENSAJE (texto, audio, ia, media) y lo tocan
//                  pasoAVoz/pasoATexto y la API; mezclar las dos preguntas en un campo
//                  dejaba que «pasar a voz» convirtiera una condición en un audio.
//
// ── LAS DOS RAÍCES ───────────────────────────────────────────────────────────────────
// Una automatización tiene DOS puntas de entrada, como en el lienzo:
//
//   1. La SALIDA (lo que MaKo manda por su cuenta). Arranca en la tarjeta del CRON, que
//      no es un nodo de `pasos` sino el disparador de la secuencia, y sigue por el primer
//      nodo que nadie apunta (`raizSalida`).
//   2. «SI RESPONDE» (un nodo `respuesta`, uno solo). Es lo que hoy hacía el modo asistido
//      con sus `escenarios` y el hand-off: cada CASO es una rama con su salida, y «otra
//      cosa» es la rama de lo que no encaja. El formulario «Enseñarle este caso» de arriba
//      de la pantalla (punto 1) se va: un caso nuevo es una rama más de esta tarjeta.
//
// Una respuesta del lead PAUSA la salida, como siempre (`pausarPorRespuesta`): por eso en
// la salida no hay condición «respondió» —mientras la salida corre, el lead NO respondió—
// y lo que pasa cuando contesta se dibuja y se configura en «Si responde».
//
// ── LAS SALIDAS SON PUERTOS ──────────────────────────────────────────────────────────
// Las salidas de un nodo son sus PUERTOS, todos al borde derecho, una fila por rama — el
// molde de ManyChat. Hasta la quinta tanda cada nodo tenía UN padre y para juntar ramas
// estaba el nodo `ir_a` (un salto). Desde la SEXTA (ver más abajo) una tarjeta puede tener
// VARIOS padres y «Ir a» no se crea más. Lo que la persona MUEVE se guarda aparte, en
// `posiciones` (mig 0233), y no toca este modelo; y el motor no puede quedar en un ciclo
// sin una espera en el medio (`validarGrafo`).
//
// ── SEGUNDA TANDA (08/10/2026, noche): UN SOLO CRON Y FLECHAS EN PARALELO ─────────────
// Pedido de Martín, puntos 1 y 2: «No pueden haber 2 flujos por separado. Solo 1 CRON y de
// ahí desprende todo» y «Del CRON inicial debería poder sacar varias flechas... En realidad de
// varias tarjetas debería poder sacar varias flechas, para que se pueda personalizar. Por
// ejemplo, de un mismo cron puedo sacar todo una secuencia para WhatsApp y toda otra
// secuencia de email». El contrato entero está en docs/chatbot-flujo-ramas-diseno.md, sección
// «SEGUNDA TANDA».
//
//   · «Si responde» NO TIENE PADRE: se dibuja colgando del CRON (una fila de su tarjeta), pero
//     es un EVENTO, no un camino en el tiempo. Ninguna tarjeta puede seguir en ella.
//   · `paralelos` en un mensaje, una acción o una espera: los ids que arrancan A LA VEZ cuando
//     esa tarjeta termina. Son PUERTOS más (`par:<id>`), así que el «un padre», las sueltas,
//     `padreDe` y `descendientes` funcionan sin saber que existen. Una condición, «Si responde»
//     y un «Ir a» no los tienen: sus salidas se excluyen entre sí o terminan.
//   · El CRON lleva sus flechas en paralelo en un nodo `inicio` con el id reservado `'entrada'`
//     (el mismo `ID_ENTRADA` del lienzo). Se crea SÓLO con la primera flecha en paralelo desde el
//     CRON y va al FINAL del array: inyectarlo en todos los flujos los volvía «flujos de
//     tarjetas» (`esFlujoExplicito`) y `puedePisarFlujo` dejaba de aceptar a /email, a la API
//     «por orden» y al armado de audios del onboarding sobre una secuencia lineal.
//
// ── CUARTA TANDA (09/10/2026), PUNTO 8: VARIAS FLECHAS POR RESULTADO DE UNA CONDICIÓN ─────
// Pedido literal: «dentro de las flechas que se despegan de una condición, se debería poder
// desplegar varias si se cumple y varias si no se cumple... En ambos casos, por ejemplo, se
// podría enviar un WhatsApp y un Email y eso son 2 flechas en cada resultado».
//
//   · Cada RESULTADO de una condición (cada rama y el «Si no») lleva SU lista de flechas en
//     paralelo: `paralelos` en la rama y `paralelos_si_no` en la tarjeta. La condición en sí
//     sigue sin `paralelos` (`puedeTenerParalelos` = false): sus resultados se excluyen, así que
//     una flecha «de la condición» no diría de cuál sale.
//   · Son PUERTOS más, como los de siempre: `par:<destino>@<resultado>` (el resultado es el id de
//     la rama o 'si_no'). Empiezan con `par:` a propósito: `hiloDe`, `padreDe`, `descendientes`,
//     el «un padre» y las sueltas los ven sin saber que existen. El `@<resultado>` dice de qué
//     fila sale la flecha (el lienzo la dibuja ahí) y a qué lista vuelve un borrado.
//   · El motor: al resolver la condición, el hilo sigue por la principal del resultado elegido
//     y ARRANCA un hilo por cada paralelo de ESE resultado (`paralelosDeResultado`). Los del
//     otro resultado no corren nunca para ese lead.
//   · Lo guardado sin el campo nuevo se lee igual: sin listas no hay puertos nuevos.
//
// ── SEXTA TANDA (09/10/2026, noche): VARIOS PADRES, TARJETAS SUELTAS, SIN «IR A» ─────────────
// Pedido literal (puntos 7, 12 y 13 de «General»): «Que se elimine una flecha no significa que se
// elimine la tarjeta posterior, sino que queda "flotando". Lo que no se puede es publicar o probar
// una automatización incompleta», «"Go to" desaparece directamente» y «Aún no funciona poner o
// sacar más de una flecha a una tarjeta». El porqué entero, en docs/chatbot-flujo-ramas-diseno.md
// → «SEXTA TANDA, parte modelo».
//
//   · VARIOS PADRES (fan-in). Una flecha puede llegar a una tarjeta que ya existe: `padresDe` los
//     da todos, y `padreDe` sigue dando el primero. Lo que sube por los padres (el primer mensaje,
//     el ancla de la reunión, el mensaje anterior de una acción) sube por TODOS los que no vuelven
//     (`padresSinVuelta`: una flecha de un ciclo no es «lo de antes»).
//   · UN CICLO NECESITA UNA ESPERA EN EL MEDIO, sea por flechas o por un «Ir a» de antes
//     (`ciclosSinEspera`). Y dos caminos que corren A LA VEZ no pueden caer en la misma tarjeta (al
//     lead le llegaría dos veces): `cruces`, que sabe que dos resultados de una condición se excluyen.
//   · DOS VALIDACIONES. `validarParaGuardar`: lo que rompe el DATO (ids repetidos, destinos que no
//     existen, topes, combinaciones imposibles); con eso pasa un BORRADOR (lib/secuencia-borrador.ts).
//     `validarGrafo` (PUBLICAR o PROBAR): eso más lo incompleto — tarjetas sueltas, condiciones sin
//     completar, una automatización sin ningún camino. El motor sólo lee lo publicado: una tarjeta
//     suelta nunca corre.
//   · LA RAÍZ EXPLÍCITA. Con tarjetas sueltas, «la primera que nadie apunta» deja de alcanzar (una
//     suelta podría pasar a ser la raíz). Toda edición que conecta, desconecta o crea una suelta
//     FIJA la raíz antes (`fijarRaiz`: el nodo `inicio`, el CRON). Esas ediciones tienen UNA puerta,
//     lib/flujo-edicion.ts: el lienzo edita por ahí, nunca con `conectarPuerto` a mano.
//   · «IR A» NO SE CREA: los que hay se pasan a flechas (`quitarIrA`, lib/flujo-legado.ts). El motor
//     y «Probar» los siguen sabiendo correr mientras no se conviertan.
//
// ── NOVENA TANDA (10/10/2026): EL AI STEP ─────────────────────────────────────────────────────
// Pedido literal de Martín: «Todo lo que hiciste de una cantidad impresionante de flujos y tarjetas eso
// justamente debería estar en una nueva tarjeta que sea "AI Step". Configuralo allí». Eligió la forma
// «una tarjeta con sus casos adentro»: el tono general arriba (opcional), una fila por situación
// (cuándo → cómo responder, si sale sola o va a revisar, si te avisa) y «Otra cosa → te aviso».
//
//   · NO ES UNA CLASE NUEVA: es una FORMA del nodo `respuesta` (`paso_ia: true`). `claseDe` sigue
//     diciendo 'respuesta' en todos lados, así hereda TODAS las reglas de «Si responde» sin copiarlas
//     (una por automatización, sin padre, sin esperas, sin paralelos, cuelga del CRON). Una clase nueva
//     eran unos quince archivos y una segunda copia de esas reglas (AGENTS.md, las cinco puertas).
//   · Lo que en la forma de siempre eran las TARJETAS HIJAS de cada caso (el «MaKo contesta» y el aviso
//     al equipo) va ADENTRO del caso (`responder`, `sola`, `avisar`), y «Otra cosa» es el texto del
//     aviso (`otra_aviso`). Un caso de un AI Step NO tiene `siguiente`.
//   · EL MOTOR NO SE REESCRIBE: `expandirPasoIA` devuelve el flujo con el AI Step EXPANDIDO a la forma
//     de siempre (las tarjetas hijas, con ids que se derivan del nodo y del caso), y lo que RECORRE la
//     respuesta —el motor (`responderConGrafo`), «Probar» (lib/simulador-grafo.ts) y los casos del
//     clasificador (`escenariosDeRespuesta`)— recorre eso. Así el redactor, el borrador, «sale sola» con
//     la guarda de la plata (`puedeContestarSolo`), el cierre de la charla y el hand-off son los MISMOS.
//   · LO QUE SE GUARDA ES LA FORMA COMPACTA. Lo expandido no se guarda nunca: sus ids llevan `~`, que el
//     saneo de `setSecuenciaPasos` no acepta (`[A-Za-z0-9_-]`), así que un expandido guardado por error
//     perdería las flechas de sus casos y Publicar lo frenaría por tarjetas sueltas: falla ruidoso.
//
// ── DÉCIMA TANDA (11/10/2026): AI STEP v2 (docs/diseno-ai-step-v2.md) ─────────────────────────
// Martín: «solo permitir 1 caso por tarjeta de AI Step, y si quieren pueden crear otra tarjeta» y «si elijo
// el AI Step, siempre va a estar vinculado a un medio».
//   · UNA TARJETA = UN CASO, VARIAS TARJETAS (hasta `TOPE_AI_STEP_POR_MEDIO` por medio). Cada una sigue
//     siendo la forma `paso_ia` del nodo `respuesta`, colgada del CRON (`raicesRespuesta`: todas las que
//     escuchan). «Si responde» de los de siempre sigue siendo uno y no se mezcla con AI Step.
//   · EL MOTOR SIGUE VIENDO UNA: `expandirPasoIA(pasos, { medio })` junta las del medio en la primera y
//     deja a las demás inertes EN SU ÍNDICE (los índices no se corren). Lo viejo (N casos) se lee igual:
//     cada caso cuenta como una tarjeta. (Lo partía `separarPasosIA`; desde la undécima JUNTA `juntarPasosIA`.)
//   · CAMPOS NUEVOS del caso (`objetivo`, `cualquiera`, `no_contesta`, `hasta`, `audio`, `ejemplos`) y del
//     nodo (`medio`), todos opcionales y por `camposDelFlujo`/`sanearCaso`. El tono y el aviso de «Otra
//     cosa» se LEEN y no se escriben más.
//
// ── UNDÉCIMA TANDA (11/10/2026): UN AI STEP POR OBJETIVO (docs/diseno-undecima-tanda.md §2 y §6) ─────
// Martín: «Toda la cantidad de tarjetas de "AI Step" deberían ser una sola... Si justamente es el mismo
// objetivo, solo son diferentes objeciones o escenarios». Y «El "Hasta" siempre es atado al objetivo. Y el
// "Te avisa cada vez" ya es uno de los 3 botones». Lo de la décima (una tarjeta por caso) se DA VUELTA:
//   · UNA TARJETA POR MEDIO (`TOPE_AI_STEP_POR_MEDIO` = 1), con el OBJETIVO en la tarjeta (`objetivo`,
//     obligatorio para Publicar), la voz (`audio`) y lo del ensayo (`ejemplos`), y hasta
//     `TOPE_ESCENARIOS_AI_STEP` escenarios adentro (los casos) más «Lo demás» (el caso `cualquiera`).
//   · LA LIBERTAD es una por escenario (lib/ai-step-libertad.ts) y el AVISO AL GRUPO se DERIVA de ella
//     (`avisaElCaso`): `avisar` y `hasta` del caso se van, `instrucciones` y `otra_aviso` del nodo también.
//     Quedan en los TIPOS como @deprecated porque los lee `juntarPasosIA` (y archivos de otros paquetes).
//   · `juntarPasosIA` es LA PUERTA PARA LO VIEJO (al abrir, al guardar y en la API): junta las tarjetas del
//     medio en la primera, sube al nodo lo que era del caso y SACA del array a las demás. El motor no se
//     reescribe: `expandirPasoIA` ya juntaba; ahora toma objetivo, voz y ejemplos del nodo.
// =============================================================================

// El catálogo de condiciones importa sólo TIPOS de acá: el ciclo no existe en runtime.
import {
  cumpleCatalogo, problemaDeFila, textoCondicion, pagoDeFila, cuotaDeFila, condicionPorId,
  type HechosCatalogo, type NombresCatalogo, type OperadorCondicion,
} from './condiciones-catalogo';
// Puro y sin dependencias: lo importan también el editor (cliente) y el motor.
import { segundosDeMinutos, textoDuracion } from './espera-duracion';

// Sólo el TIPO de una parte de un mensaje (cuarta tanda, punto 15): `import type` se borra al compilar.
import type { ParteMensaje } from './mensaje-partes';
// La LIBERTAD de un escenario del AI Step (undécima tanda). Puro: de acá importa sólo tipos (sin ciclo en runtime).
import { contestaElCaso, avisaElCaso, libertadDeCaso, libertadesPermitidas, conLibertad } from './ai-step-libertad';
// `contestaElCaso` vivía acá: se re-exporta para los que ya la importaban de este módulo.
export { contestaElCaso };

// ── Tipos ─────────────────────────────────────────────────────────────────────────

/** De qué está hecha una condición. Cada una la evalúa el motor con un dato que YA tiene. */
export type CampoCondicion =
  | 'etiqueta'        // valor: id de crm_etiquetas
  | 'etapa'           // valor: key de la etapa; funnel_id: de qué producto (null = la casa)
  | 'agendo'          // tiene una reunión cargada (la misma regla que el desenlace de antes)
  | 'pago'            // ya pagó
  | 'ya_contactado'   // alguna vez le salió algo (lo que decidían ya_contactado/primer_contacto)
  | 'respondio'       // alguna vez te escribió (no «respondió a esta»: eso es «Si responde»)
  | 'antiguedad'      // valor: horas — llegó hace menos de N h (el «Solo a leads recientes»)
  | 'tiene_telefono'
  | 'tiene_email';

export const CAMPOS_CONDICION: readonly CampoCondicion[] = [
  'etiqueta', 'etapa', 'agendo', 'pago', 'ya_contactado', 'respondio', 'antiguedad', 'tiene_telefono', 'tiene_email',
];

/**
 * De qué está hecha una fila: una de las nueve de arriba (que siguen valiendo tal cual) o un id del
 * CATÁLOGO de condiciones (lib/condiciones-catalogo.ts, tercera tanda: «Debe ser bien amplio»). Un
 * id que ninguno de los dos conoce NUNCA se cumple, ni negado, y `validarGrafo` no lo deja guardar.
 */
export type CampoFila = CampoCondicion | (string & {});

export type FilaCondicion = {
  campo: CampoFila;
  /** La negación: «No tiene», «No agendó», «Llegó hace MÁS de». Sólo en las negables del catálogo. */
  no?: boolean;
  /** El dato elegido: id de etiqueta, key de etapa, horas, un número, un id del catálogo, un texto. */
  valor?: string | number | null;
  /** Sólo `etapa`: el producto. null/ausente = la casa del lead. */
  funnel_id?: number | null;
  /** Las numéricas del catálogo: ≥ (ausente) o ≤. */
  op?: OperadorCondicion;
  /** Una numérica que además se refiere a algo: «Avance del curso [X] ≥ 50 %» (el curso). */
  ref?: string | number | null;
  /**
   * CON QUÉ SE UNE A LA FILA DE ARRIBA (cuarta tanda, punto 7: «me gustaba antes la opción de "+y"
   * "+o", para que cumplan ambas o una de las 2»). AUSENTE = el `modo` de la rama, así una rama
   * guardada antes evalúa y se dibuja igual que siempre. En la primera fila no significa nada.
   * Las «y» atan más que las «o»: A y B o C = (A y B) o C (`gruposDeRama`).
   */
  union?: 'y' | 'o';
  /**
   * Las etapas de REUNIÓN que acota la condición (cuarta tanda, punto 5: «que dentro del editable de
   * esa sección se elija 1 o más reuniones de las etapas del kanban»), cada una `${funnelId}:${key}`.
   * Vacío o ausente = cualquier reunión. Sólo en las condiciones del catálogo con `reuniones: true`.
   */
  reuniones?: string[];
};

/** Una rama de la condición. Gana la PRIMERA que se cumple, de arriba hacia abajo. */
export type RamaCondicion = {
  id: string;
  /**
   * La unión de las filas que no dicen la suya (`FilaCondicion.union`): 'todas' = Y, 'cualquiera' = O.
   * Desde la cuarta tanda cada fila nueva guarda su unión, y esto queda para las de antes. Una rama
   * sin filas nunca se cumple.
   */
  modo: 'todas' | 'cualquiera';
  filas: FilaCondicion[];
  siguiente: string | null;
  /**
   * CUARTA TANDA, PUNTO 8: los ids que arrancan A LA VEZ que `siguiente` cuando la condición sale
   * por esta rama (el WhatsApp y el email del pedido). Ausente o vacío = una sola flecha.
   */
  paralelos?: string[];
};

/** Un caso de «Si responde»: lo que el clasificador busca en el mensaje del lead. */
export type CasoRespuesta = {
  id: string;
  /** Cómo se llama el caso: «Quiere cambiar el día». */
  titulo: string;
  /** Cuándo aplica, en palabras del negocio. Es lo que lee el clasificador. */
  cuando: string;
  siguiente: string | null;
  // ── Sólo en un AI STEP (`paso_ia`, novena tanda): el caso lleva ADENTRO lo que en la forma de
  //    siempre eran sus tarjetas hijas. En un «Si responde» de los de siempre no significan nada. ──
  /** Cómo responder: la guía del redactor (lo que era el `cuerpo` del «MaKo contesta»). Vacío = no contesta. */
  responder?: string;
  /** Sale sola. Ausente o false = queda para revisar (lo que era `revisar: true`, el default de siempre). */
  sola?: boolean;
  /**
   * @deprecated Undécima tanda: el aviso al grupo se DERIVA de la libertad (`avisaElCaso`, lib/ai-step-libertad.ts).
   * Sólo lo lee `juntarPasosIA` (para decir lo que cambia); el saneo no lo escribe más.
   */
  avisar?: boolean;
  // ── AI STEP v2 (décima tanda, docs/diseno-ai-step-v2.md §1). Desde la undécima, lo que es del OBJETIVO
  //    (objetivo, voz, ejemplos) vive en el NODO; acá queda @deprecated para leer lo de antes. ──
  /** @deprecated Undécima tanda: el objetivo es del AI Step (`PasoGrafo.objetivo`). Lo sube `juntarPasosIA`. */
  objetivo?: string;
  /** «Lo demás» (lo que era «Cualquier respuesta»): entra con todo lo que no encaja en otro escenario. `cuando` no se lee. */
  cualquiera?: boolean;
  /** «Sólo te avisa»: no contesta aunque `responder` tenga texto (se guarda para cuando vuelva a contestar). */
  no_contesta?: boolean;
  /** @deprecated Undécima tanda: «Hasta» siempre es el objetivo. Sólo lo lee `juntarPasosIA` (y lo saca). */
  hasta?: 'una';
  /** @deprecated Undécima tanda: la voz es del AI Step (`PasoGrafo.audio`). Lo sube `juntarPasosIA`. */
  audio?: { voz: string };
  /** @deprecated Undécima tanda: los ejemplos son del AI Step (`PasoGrafo.ejemplos`). Lo sube `juntarPasosIA`. */
  ejemplos?: EjemploCaso[];
};

/** Un par del ensayo de objeciones: lo que dijo el lead y cómo contestó la persona (§4). */
export type EjemploCaso = { lead: string; tu: string };

/** Por dónde escucha y contesta un AI Step (§6). Ausente = WhatsApp: todo lo guardado hasta v2 lo es. */
export type MedioAIStep = 'whatsapp' | 'instagram' | 'messenger';
export const MEDIOS_AI_STEP: readonly MedioAIStep[] = ['whatsapp', 'instagram', 'messenger'];

/**
 * LO QUE VIAJA EN EL «MaKo contesta» DE LA EXPANSIÓN (`expandirPasoIA`): los datos del caso que el redactor
 * necesita y que la forma de siempre no tenía dónde llevar. NUNCA se guarda (no está en `CamposFlujo`, y un
 * expandido no se guarda: sus ids llevan `~`).
 */
export type DatosCasoIA = {
  titulo: string;
  cuando: string;
  medio: MedioAIStep;
  objetivo?: string;
  ejemplos?: EjemploCaso[];
  audio?: { voz: string };
  /** @deprecated Undécima tanda: la expansión ya no lo arma («Hasta» siempre es el objetivo). Lo lee lib/nutricion.ts. */
  hasta?: 'una';
};

export type Espera =
  | { modo: 'tiempo'; minutos: number }
  /** Hasta N minutos ANTES de la próxima reunión del lead (lo que era `ancla: 'reunion'`). */
  | { modo: 'antes_reunion'; minutos: number };

/** Un salto: a otra automatización (se lo inscribe) o a otra tarjeta de ésta. */
export type DestinoIrA = { secuencia_id: number } | { nodo: string };

export type ClaseNodo = 'mensaje' | 'accion' | 'esperar' | 'condicion' | 'respuesta' | 'ir_a' | 'inicio';

/**
 * El id del nodo de INICIO: el CRON cuando tiene flechas en paralelo. Es el mismo string que
 * `ID_ENTRADA` del lienzo (lib/flujo-conversacion.ts) a propósito: el ＋ del CRON ya manda ese id
 * como nodo, y así `{ nodo: ID_INICIO, puerto: 'par' }` es literalmente lo que el lienzo pide.
 * `nuevoId` da `n…` y `normalizar` da `o<i>`: ninguno choca con él.
 */
export const ID_INICIO = 'entrada';

/**
 * Las claves de hilo que devuelve `hiloDe` además de los ids: 'p' = el principal, 'r' = lo que
 * cuelga de «Si responde». Una flecha en paralelo a una tarjeta con uno de estos ids abriría un
 * hilo que se confunde con ellos: `validarGrafo` la rechaza.
 */
export const HILO_PRINCIPAL = 'p';
export const HILO_RESPUESTA = 'r';

/** Los campos que este módulo lee de un paso. El resto del paso viaja intacto. */
/**
 * QUÉ HACE UN CAMINO CUANDO EL LEAD CONTESTA (14/10/2026). Era una regla escondida del motor: cualquier mensaje
 * del lead frenaba TODO lo que tenía por delante (`pausarPorRespuesta`, lib/nutricion.ts), y así no salió el audio
 * de bienvenida del bug 5 (el lead le contestó a Mauricio un mensaje a mano). Martín: «jamás que "mako" haga cosas
 * que no están en el flujo», y eligió «Opción en cada camino, sigue de fábrica».
 */
export type SiContesta = 'corta' | 'sigue';
/** Lo que hace un camino que nadie configuró. Las automatizaciones de antes del 14/10 se migraron con su valor de hoy. */
export const SI_CONTESTA_DE_FABRICA: SiContesta = 'sigue';

export type PasoGrafo = {
  id?: string;
  siguiente?: string | null;
  /**
   * Mensaje, acción, espera e inicio: los ids que arrancan A LA VEZ cuando esta tarjeta termina
   * (además de su `siguiente`). Ausente o vacío = una sola salida, como siempre.
   */
  paralelos?: string[];
  nodo?: 'esperar' | 'condicion' | 'respuesta' | 'ir_a' | 'inicio';
  /**
   * Sólo el inicio (la tarjeta CRON): qué hace CADA camino de la salida cuando el lead contesta. La clave es la del
   * camino (`caminosDeSalida`): `HILO_PRINCIPAL` para la flecha principal del CRON y el id de la primera tarjeta para
   * cada flecha en paralelo, como los hilos del motor. Ausente = `SI_CONTESTA_DE_FABRICA`.
   */
  si_contesta?: Record<string, SiContesta>;
  espera?: Espera;
  ramas?: RamaCondicion[];
  casos?: CasoRespuesta[];
  /**
   * Sólo «Si responde»: la persona le BORRÓ la flecha del CRON (10/10/2026, «Una condición normal»: la
   * flecha se borra como cualquier otra). Suelta, no escucha: `raizRespuesta` no la devuelve, así que el
   * motor no la corre y Publicar la frena como a cualquier tarjeta suelta (`tarjetasSueltas`). Conectarla
   * desde el CRON la vuelve a enganchar (`conectar`, lib/flujo-edicion.ts). Ausente = conectada.
   */
  suelta?: boolean;
  /**
   * Sólo «Si responde»: es un AI STEP (novena tanda, ver «EL AI STEP» más abajo). Ausente = la forma de
   * siempre, con una tarjeta hija por caso. La clase sigue siendo 'respuesta' (`claseDe`).
   */
  paso_ia?: true;
  /**
   * @deprecated Sólo AI Step: el tono general, que se suma a la guía de cada caso. Desde v2 (décima tanda) se LEE y
   * no se escribe más: `juntarPasosIA` lo pliega adentro de cada `responder` (el bloque «TU TONO» de la guía de voz
   * lo reemplaza). Queda en la tarjeta sólo si plegarlo no entraba en `TOPE_RESPONDER`.
   */
  instrucciones?: string;
  /**
   * @deprecated Sólo AI Step: el aviso al equipo de «Otra cosa». Vacío = `AVISO_OTRA_COSA`. La expansión lo sigue
   * LEYENDO (lo de antes sin juntar); `juntarPasosIA` lo saca («Lo demás» avisa con el texto de siempre).
   */
  otra_aviso?: string;
  /** Sólo AI Step v2: por dónde escucha y contesta (`medioDe`). Ausente = WhatsApp. */
  medio?: MedioAIStep;
  // ── Sólo AI Step, UNDÉCIMA TANDA: lo del OBJETIVO vive en la tarjeta (una por objetivo). Pasan por
  //    `camposDelFlujo` (la quinta puerta) y la expansión se los da a cada escenario (`datosDeCaso`). ──
  /** Qué tiene que lograr (≤ `TOPE_OBJETIVO`). OBLIGATORIO para Publicar: «Hasta» siempre es el objetivo. */
  objetivo?: string;
  /** Contesta con una nota de voz (sólo WhatsApp): `'propia'` (el clon VIGENTE al mandar) o el voiceId de otra voz. */
  audio?: { voz: string };
  /** Cómo contestó la persona en el ensayo (≤ `TOPE_EJEMPLOS`): ejemplos para el redactor. */
  ejemplos?: EjemploCaso[];
  /** Sólo en la EXPANSIÓN (nunca se guarda): los datos del caso para el redactor (`DatosCasoIA`). */
  ia?: DatosCasoIA;
  /** condicion: «si no» · respuesta: «otra cosa». */
  si_no?: string | null;
  /**
   * Sólo condición (cuarta tanda, punto 8): las flechas en paralelo del «Si no», como las de cada
   * rama (`RamaCondicion.paralelos`). «Otra cosa» de «Si responde» no las tiene: ahí se contesta en
   * el momento y en UN hilo.
   */
  paralelos_si_no?: string[];
  destino?: DestinoIrA | null;
  /**
   * Sólo mensajes: true = queda como BORRADOR para que lo apruebe una persona; false = sale
   * solo. AUSENTE = lo que diga la secuencia (`estrategia.envio_automatico`), que es como
   * se comportan todas las de antes. Reemplaza el «Sale sola» de la tarjeta del CRON
   * (punto 6: «mucho menos se entiende el checkbox de Sale sola»): es de cada mensaje.
   */
  revisar?: boolean;
  /** Sólo `tipo: 'media'`: el archivo de la biblioteca (`setting_adjuntos`), por referencia. */
  media_id?: number | null;
  /**
   * Sólo un mensaje de WhatsApp (cuarta tanda, punto 15): VARIOS mensajes que salen en orden, dos o
   * más. Ausente = el mensaje de siempre. Qué significa y cómo se guarda, en lib/mensaje-partes.ts.
   */
  partes?: ParteMensaje[];
  // ── Lo de siempre, que el conversor y el motor leen ──
  orden?: number;
  canal?: string;
  proveedor?: string;
  delay_horas?: number;
  ancla?: 'reunion';
  tipo?: string;
  requiere?: string;
  accion?: unknown;
  cuerpo?: string;
  asunto?: string | null;
  template_wa?: string | null;
  audio_id?: number | null;
};

export type Puerto = {
  /** 'sig' para el único de un nodo simple, el id de la rama/caso, o 'si_no'. */
  puerto: string;
  destino: string | null;
};

// ── Identidad y clase ─────────────────────────────────────────────────────────────

/**
 * El id de un nodo. Uno sin `id` (todo lo escrito antes del 08/10/2026, y lo que escriban
 * los escritores que no pasan por `setSecuenciaPasos`) toma `o<índice>`: es lo mismo que
 * hacía `paso_actual`, así que una secuencia vieja se lee igual que siempre.
 */
export const idDe = (p: PasoGrafo, i: number): string => (typeof p.id === 'string' && p.id ? p.id : `o${i}`);

/** Tiene ids explícitos: la escribió alguien que ya sabe de ramas. */
export const esGrafo = (pasos: readonly PasoGrafo[]): boolean =>
  pasos.some((p) => typeof p?.id === 'string' && p.id.length > 0);

export function claseDe(p: PasoGrafo): ClaseNodo {
  if (p.nodo === 'esperar' || p.nodo === 'condicion' || p.nodo === 'respuesta' || p.nodo === 'ir_a' || p.nodo === 'inicio') return p.nodo;
  const a = p.accion;
  if (a != null && typeof a === 'object' && !Array.isArray(a)) return 'accion';
  return 'mensaje';
}

export const esNodoMensaje = (p: PasoGrafo): boolean => claseDe(p) === 'mensaje';

/** ¿Es un AI STEP? Un «Si responde» con sus casos adentro (`paso_ia`, novena tanda). */
export const esPasoIA = (p: PasoGrafo | null | undefined): boolean => !!p && claseDe(p) === 'respuesta' && p.paso_ia === true;

/** El medio de un AI Step: el suyo, o WhatsApp si no dice (todo lo guardado antes de v2). */
export const medioDe = (p: Pick<PasoGrafo, 'medio'> | null | undefined): MedioAIStep =>
  (p?.medio === 'instagram' || p?.medio === 'messenger' ? p.medio : 'whatsapp');

// Por SALIDA: una tarjeta de una salida, o cada RESULTADO de una condición (cuarta tanda, punto 8:
// «varias si se cumple y varias si no se cumple»).
export const TOPE_PARALELOS = 3;   // flechas en paralelo por tarjeta (o por resultado de una condición)
// ⚠️ La suma cuenta TODOS los paralelos, también los de los dos resultados de una condición aunque
// para un lead corra uno solo: es la cota que el motor no puede pasar (`aplicarAHilo`), y medirla por
// camino exigiría recorrer cada combinación de resultados. Con el ejemplo del pedido (un paralelo en
// cada resultado) son 3 de 6.
export const TOPE_HILOS = 6;       // por inscripción: 1 (el principal) + la suma de todos los paralelos

/**
 * ¿Esta tarjeta puede sacar flechas en paralelo? Un mensaje, una acción, una espera y el
 * inicio, sí. Una condición no (sus ramas se EXCLUYEN: gana la primera que se cumple), «Si
 * responde» tampoco (sus casos también se excluyen, y corre en el momento) y un «Ir a» termina
 * ahí.
 */
export function puedeTenerParalelos(p: PasoGrafo): boolean {
  const c = claseDe(p);
  return c === 'mensaje' || c === 'accion' || c === 'esperar' || c === 'inicio';
}

/**
 * Los paralelos de un nodo TAL COMO ESTÁN, sin repetidos ni vacíos, y sólo si su clase los
 * admite. No saca el propio id ni los que no existen: eso lo tiene que VER `validarGrafo` (se
 * dibuja y se rechaza), y lo limpia `normalizar`.
 */
function paralelosDe(p: PasoGrafo | undefined): string[] {
  if (!p || !Array.isArray(p.paralelos) || !puedeTenerParalelos(p)) return [];
  return listaLimpia(p.paralelos);
}

/** Los ids de una lista de flechas, sin repetidos ni vacíos (lo que no es un string no cuenta). */
function listaLimpia(x: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(x)) for (const d of x) if (typeof d === 'string' && d && !out.includes(d)) out.push(d);
  return out;
}

// ── Las flechas en paralelo de un RESULTADO de una condición (cuarta tanda, punto 8) ─────────

/** El resultado «Si no» de una condición: el nombre de su puerto y de su fila en el lienzo. */
export const RESULTADO_SI_NO = 'si_no';

/**
 * El puerto de una flecha en paralelo. `par:<destino>` desde un mensaje, una acción, una espera o el
 * CRON (lo de siempre); `par:<destino>@<resultado>` desde un RESULTADO de una condición. Sin destino
 * es el pedido de agregar una NUEVA: `'par'` (lo de siempre) o `par@<resultado>`.
 *
 * El `@` no choca con ningún id: los ids que se guardan son `[A-Za-z0-9_-]` (el saneo de
 * `setSecuenciaPasos`), y se lee con el ÚLTIMO `@` por si uno escrito a mano lo trajera.
 */
export function puertoParalelo(destino: string | null, resultado?: string | null): string {
  return `par${destino ? `:${destino}` : ''}${resultado ? `@${resultado}` : ''}`;
}

/** Lo que dice un puerto de flecha en paralelo, o null si no lo es. */
export function leerPuertoParalelo(puerto: string): { destino: string | null; resultado: string | null } | null {
  if (puerto !== 'par' && !puerto.startsWith('par:') && !puerto.startsWith('par@')) return null;
  const k = puerto.lastIndexOf('@');
  const cuerpo = k > 0 ? puerto.slice(0, k) : puerto;
  const resultado = k > 0 ? puerto.slice(k + 1) || null : null;
  const destino = cuerpo.startsWith('par:') ? cuerpo.slice(4) || null : null;
  return { destino, resultado };
}

/** ¿`resultado` es una salida de esta condición? (El id de una de sus ramas, o 'si_no'.) */
function esResultadoDe(p: PasoGrafo, resultado: string): boolean {
  return claseDe(p) === 'condicion' && (resultado === RESULTADO_SI_NO || (p.ramas ?? []).some((r) => r.id === resultado));
}

/** La lista TAL COMO ESTÁ guardada para un resultado (sin limpiar). */
function crudoDeResultado(p: PasoGrafo, resultado: string): unknown {
  return resultado === RESULTADO_SI_NO ? p.paralelos_si_no : (p.ramas ?? []).find((r) => r.id === resultado)?.paralelos;
}

/**
 * LAS FLECHAS EN PARALELO DE UN RESULTADO de una condición (la rama `resultado`, o 'si_no'), sin
 * repetidos ni vacíos. Vacío si no es una condición o no tiene ese resultado. Es lo que arranca el
 * motor cuando la condición sale por ahí (`resolverControl`) y lo que «Probar» abre al elegir.
 */
export function paralelosDeResultado(p: PasoGrafo | undefined, resultado: string): string[] {
  if (!p || !esResultadoDe(p, resultado)) return [];
  return listaLimpia(crudoDeResultado(p, resultado));
}

/** Los resultados de una condición, en el orden de sus filas: [cada rama, 'si_no']. */
function resultadosDe(p: PasoGrafo): string[] {
  return claseDe(p) === 'condicion' ? [...(p.ramas ?? []).map((r) => r.id), RESULTADO_SI_NO] : [];
}

/**
 * TODAS las flechas en paralelo que saca una tarjeta: las suyas (mensaje, acción, espera, inicio) o
 * las de sus resultados (condición). Lo que cuentan las reglas de «Si responde», del bucle y del
 * tope de caminos: una regla que mirara sólo las de la tarjeta dejaba pasar las de un resultado.
 */
function todosLosParalelos(p: PasoGrafo | undefined): string[] {
  if (!p) return [];
  if (claseDe(p) !== 'condicion') return paralelosDe(p);
  return resultadosDe(p).flatMap((r) => paralelosDeResultado(p, r));
}

/** Cuántas flechas en paralelo hay dibujadas en un flujo, de tarjetas y de resultados, sumadas todas. */
export function totalDeParalelos(pasos: readonly PasoGrafo[]): number {
  return pasos.reduce((n, p) => n + todosLosParalelos(p).length, 0);
}

/**
 * CUÁNTOS CAMINOS EN PARALELO PUEDEN CORRER A LA VEZ en una inscripción, además del principal (para
 * `TOPE_HILOS`: `1 + contarParalelos`). Es lo que el motor puede llegar a tener vivo (`aplicarAHilo`).
 *
 * ⚠️ SEXTA TANDA, PUNTO 13 («Aún no funciona poner o sacar más de una flecha a una tarjeta... si
 * quiero luego de una condición abrir 2 flechas»): HASTA ACÁ SE SUMABAN TODAS LAS FLECHAS DEL FLUJO,
 * también las de los dos resultados de cada condición, aunque para un lead corre UNO solo. Con tres
 * condiciones con una flecha en paralelo en el «Sí» y otra en el «Si no» eran 1 + 6 = 7 «caminos»
 * sobre un tope de 6: la tercera condición ya no podía sacar su segunda flecha, en el lienzo (que
 * pregunta con esta misma función) ni al publicar. Medido así, contra lo que corre: en una condición
 * cuenta el resultado que MÁS abre; en una tarjeta, su salida más cada flecha en paralelo con lo que
 * abre detrás. Es una cota por arriba (dos caminos que se juntan se cuentan dos veces), nunca por debajo.
 * Una tarjeta suelta no cuenta: no corre. La suma de antes queda en `totalDeParalelos`.
 */
export function contarParalelos(pasos: readonly PasoGrafo[]): number {
  const memo = new Map<string, number>();
  const enCurso = new Set<string>();
  const abre = (id: string | null | undefined): number => {
    if (!id) return 0;
    const ya = memo.get(id);
    if (ya !== undefined) return ya;
    // Una flecha que VUELVE no abre caminos nuevos: un bucle con flechas en paralelo se rechaza aparte
    // (`repartenEnBucle`), y contarlo acá daría infinito.
    if (enCurso.has(id)) return 0;
    const i = indicePorId(pasos, id);
    if (i < 0) return 0;
    enCurso.add(id);
    const p = pasos[i];
    const c = claseDe(p);
    const masLosSuyos = (lista: readonly string[]) => lista.reduce((s, d) => s + 1 + abre(d), 0);
    let v = 0;
    if (c === 'condicion') {
      for (const r of resultadosDe(p)) {
        const principal = r === RESULTADO_SI_NO ? p.si_no : (p.ramas ?? []).find((x) => x.id === r)?.siguiente;
        v = Math.max(v, abre(principal) + masLosSuyos(paralelosDeResultado(p, r)));
      }
    } else if (c === 'ir_a') {
      v = p.destino && 'nodo' in p.destino ? abre(p.destino.nodo) : 0;
    } else if (c !== 'respuesta') {
      // Mensaje, acción, espera e inicio. «Si responde» corre en UN hilo y no reparte.
      v = abre(siguienteDe(pasos, i)) + masLosSuyos(paralelosDe(p));
    }
    enCurso.delete(id);
    memo.set(id, v);
    return v;
  };
  const ini = indiceInicio(pasos);
  return ini >= 0 ? abre(idDe(pasos[ini], ini)) : abre(raizSalida(pasos));
}

/** El nodo de inicio, si la automatización tiene uno (el primero, si por error hay varios). */
function indiceInicio(pasos: readonly PasoGrafo[]): number {
  return pasos.findIndex((p) => p && claseDe(p) === 'inicio');
}

export function indicePorId(pasos: readonly PasoGrafo[], id: string | null | undefined): number {
  if (!id) return -1;
  return pasos.findIndex((p, i) => idDe(p, i) === id);
}

export function nodoPorId<P extends PasoGrafo>(pasos: readonly P[], id: string | null | undefined): P | null {
  const i = indicePorId(pasos, id);
  return i >= 0 ? pasos[i] : null;
}

// ── Navegación ────────────────────────────────────────────────────────────────────

/**
 * A qué nodo sigue uno de UNA salida (mensaje, acción, esperar). `siguiente` explícito
 * manda; ausente = el elemento siguiente del array (la secuencia lineal de siempre).
 * Los nodos de varias salidas devuelven null: se leen con `puertosDe`.
 */
export function siguienteDe(pasos: readonly PasoGrafo[], i: number): string | null {
  const p = pasos[i];
  if (!p) return null;
  const c = claseDe(p);
  if (c === 'condicion' || c === 'respuesta' || c === 'ir_a') return null;
  if (p.siguiente !== undefined) return p.siguiente ?? null;
  // El inicio va al FINAL del array: «el de abajo» no existe o es cualquier cosa. Su salida
  // principal es la explícita o ninguna.
  if (c === 'inicio') return null;
  const sig = pasos[i + 1];
  return sig ? idDe(sig, i + 1) : null;
}

/** Las salidas de un nodo, en el orden en que se dibujan (de arriba hacia abajo). */
export function puertosDe(pasos: readonly PasoGrafo[], i: number): Puerto[] {
  const p = pasos[i];
  if (!p) return [];
  switch (claseDe(p)) {
    case 'condicion': {
      // Cada resultado, y DETRÁS de él sus flechas en paralelo (cuarta tanda, punto 8): en ese orden
      // se apilan los hijos en el lienzo, así las de un resultado quedan pegadas a su fila.
      const out: Puerto[] = [];
      const conSusParalelos = (resultado: string, principal: string | null | undefined) => {
        out.push({ puerto: resultado, destino: principal ?? null });
        for (const d of paralelosDeResultado(p, resultado)) out.push({ puerto: puertoParalelo(d, resultado), destino: d });
      };
      for (const r of p.ramas ?? []) conSusParalelos(r.id, r.siguiente);
      conSusParalelos(RESULTADO_SI_NO, p.si_no);
      return out;
    }
    case 'respuesta':
      return [...(p.casos ?? []).map((c) => ({ puerto: c.id, destino: c.siguiente ?? null })), { puerto: 'si_no', destino: p.si_no ?? null }];
    case 'ir_a':
      return [];
    default:
      // Mensaje, acción, espera e inicio: la salida de siempre y una por flecha en paralelo.
      // Como PUERTOS, así `apuntados`, `padreDe`, `descendientes`, el «un padre» y las sueltas
      // las ven sin saber que existen.
      return [
        { puerto: 'sig', destino: siguienteDe(pasos, i) },
        ...paralelosDe(p).map((d) => ({ puerto: `par:${d}`, destino: d })),
      ];
  }
}

/** Los ids que algún puerto apunta (los «hijos»). Un salto `ir_a` NO cuenta: no es un padre. */
function apuntados(pasos: readonly PasoGrafo[]): Set<string> {
  const s = new Set<string>();
  pasos.forEach((_, i) => { for (const pt of puertosDe(pasos, i)) if (pt.destino) s.add(pt.destino); });
  return s;
}

/**
 * Dónde arranca la SALIDA: el primer nodo que ningún PUERTO apunta y que no es «Si responde».
 *
 * ⚠️ SER DESTINO DE UN «IR A» NO LO DESCARTA. Un salto no es un padre, y el caso más natural de
 * un salto hacia atrás es «volver al principio» (ManyChat lo hace: espera y vuelve a la primera
 * tarjeta). Hasta el 08/10/2026 se descartaban los destinos de salto, y [m1 → esperar → ir a m1]
 * se quedaba SIN raíz: la salida no arrancaba nunca y `validarGrafo` no decía nada, porque
 * contaba los destinos de salto como alcanzables. Lo encontró la parte de «Probar».
 */
export function raizSalida(pasos: readonly PasoGrafo[]): string | null {
  // ⚠️ CON INICIO, LA PRIMERA TARJETA REAL, NUNCA 'entrada'. Lo leen `antiguedadDeEntrada` (el
  // «Solo a leads recientes» de #198 es una condición que tiene que ser la PRIMERA tarjeta),
  // `pasoDeEntrada` y `encadenar`: devolviendo el inicio, los tres miraban una tarjeta vacía.
  const ini = indiceInicio(pasos);
  if (ini >= 0) return pasos[ini].siguiente ?? null;
  const ap = apuntados(pasos);
  const elegibles: number[] = [];
  for (let i = 0; i < pasos.length; i++) {
    const c = claseDe(pasos[i]);
    if (c !== 'respuesta' && c !== 'inicio') elegibles.push(i);
  }
  if (!elegibles.length) return null;
  const r0 = idDe(pasos[elegibles[0]], elegibles[0]);
  if (!ap.has(r0)) return r0;
  // ⚠️ SEXTA TANDA: «VOLVER AL PRINCIPIO» CON UNA FLECHA, SIN «IR A». Una flecha que vuelve a la
  // primera tarjeta la deja apuntada, y la regla de arriba se quedaba sin raíz (o elegía una tarjeta
  // suelta de más abajo). Si TODO lo que apunta a la primera cuelga de ella misma, es un ciclo que
  // vuelve al principio: sigue siendo la raíz. Si la apunta algo de AFUERA (una suelta conectada a
  // ella), no se sabe cuál es la entrada: por eso toda edición fija la raíz antes (`fijarRaiz`).
  const deR0 = descendientes(pasos, r0);
  if (padresDe(pasos, r0).every((pa) => pa.id === r0 || deR0.has(pa.id))) return r0;
  for (const i of elegibles) {
    const id = idDe(pasos[i], i);
    if (!ap.has(id)) return id;
  }
  return null;
}

/**
 * Dónde arranca CADA hilo de la salida: [la principal, …las flechas en paralelo del CRON]. Sin
 * inicio es `[raizSalida]` (o nada). El motor arranca un hilo por cada una al inscribir; con una
 * sola, la inscripción sigue siendo de un cursor, como siempre.
 */
export function raicesSalida(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  const principal = raizSalida(pasos);
  if (principal) out.push(principal);
  const ini = indiceInicio(pasos);
  if (ini >= 0) for (const d of paralelosDe(pasos[ini])) if (!out.includes(d)) out.push(d);
  return out;
}

/**
 * A qué HILO pertenece cada nodo: nodo → la clave del hilo. `'p'` = el principal (y el inicio);
 * el de una flecha en paralelo se llama como su PRIMERA tarjeta (el id del destino de la flecha,
 * el `h` del motor); `'r'` = lo que cuelga de «Si responde».
 *
 * Lo de «Si responde» ENTRA (como 'r') a propósito: es la única forma de que una regla pueda
 * preguntar «¿esto es de la salida o de la respuesta?» con el mismo mapa. Un «Ir a» desde 'r'
 * puede saltar a cualquier lado (retoma UN hilo); desde la salida, sólo a su propio hilo.
 *
 * Se sigue por PUERTOS: los saltos no cuentan (no son un padre). Un nodo que no está en el mapa
 * es una tarjeta suelta.
 */
export function hiloDe(pasos: readonly PasoGrafo[]): Map<string, string> {
  const hilo = new Map<string, string>();
  const pila: Array<[string, string]> = [];
  const ini = indiceInicio(pasos);
  if (ini >= 0) pila.push([idDe(pasos[ini], ini), HILO_PRINCIPAL]);
  else { const r = raizSalida(pasos); if (r) pila.push([r, HILO_PRINCIPAL]); }
  // Todas las que escuchan (AI Step v2: varias tarjetas, `raicesRespuesta`); en la forma de siempre, una.
  for (const resp of raicesRespuesta(pasos)) pila.push([resp, HILO_RESPUESTA]);
  while (pila.length) {
    const [id, h] = pila.pop()!;
    if (hilo.has(id)) continue;
    hilo.set(id, h);
    const i = indicePorId(pasos, id);
    if (i < 0) continue;
    for (const pt of puertosDe(pasos, i)) {
      if (!pt.destino || hilo.has(pt.destino)) continue;
      // Una flecha en paralelo abre un hilo nuevo, salvo adentro de «Si responde» (eso no se
      // puede guardar; acá sigue en 'r' para que la regla que lo prohíbe lo encuentre). También la
      // de un RESULTADO de una condición (`par:<destino>@<resultado>`, cuarta tanda): el motor la
      // arranca con el nombre de su primera tarjeta, igual que la de una tarjeta.
      const nuevo = pt.puerto.startsWith('par:') && h !== HILO_RESPUESTA ? pt.destino : h;
      pila.push([pt.destino, nuevo]);
    }
  }
  return hilo;
}

// ── SI CONTESTA: lo que hace cada camino cuando el lead escribe (14/10/2026) ───────────────────────

/** Los CAMINOS de la salida, uno por flecha del CRON: su clave (la del hilo del motor) y su primera tarjeta. */
export function caminosDeSalida(pasos: readonly PasoGrafo[]): Array<{ clave: string; raiz: string }> {
  return raicesSalida(pasos).slice(0, TOPE_HILOS).map((raiz, k) => ({ clave: k === 0 ? HILO_PRINCIPAL : raiz, raiz }));
}

/**
 * A qué CAMINO del CRON pertenece cada tarjeta. Como `hiloDe`, salvo que una flecha en paralelo de ADENTRO de un
 * camino sigue siendo de ese camino: la opción es de la flecha del CRON, no de cada hilo que nace después. Una
 * tarjeta a la que llegan dos caminos es del primero (el principal antes que los paralelos). «Si responde», lo que
 * cuelga de ella y las sueltas no son de ningún camino.
 */
export function caminoDe(pasos: readonly PasoGrafo[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of caminosDeSalida(pasos)) {
    const pila = [c.raiz];
    while (pila.length) {
      const id = pila.pop()!;
      if (out.has(id)) continue;
      const i = indicePorId(pasos, id);
      if (i < 0 || claseDe(pasos[i]) === 'respuesta' || claseDe(pasos[i]) === 'inicio') continue;
      out.set(id, c.clave);
      for (const pt of puertosDe(pasos, i)) if (pt.destino && !out.has(pt.destino)) pila.push(pt.destino);
    }
  }
  return out;
}

/** Lo que hace el camino `clave` cuando el lead contesta: lo de su CRON, o el de fábrica. */
export function siContestaDe(pasos: readonly PasoGrafo[], clave: string): SiContesta {
  const ini = indiceInicio(pasos);
  const v = ini >= 0 ? pasos[ini].si_contesta?.[clave] : undefined;
  return v === 'corta' || v === 'sigue' ? v : SI_CONTESTA_DE_FABRICA;
}

/** ¿La tarjeta `idx` sigue cuando el lead contesta? La opción de SU camino. Fuera de los caminos (sueltas, «Si responde»), no. */
export function sigueSiContesta(pasos: readonly PasoGrafo[], idx: number): boolean {
  const p = pasos[idx];
  if (!p) return false;
  const clave = caminoDe(pasos).get(idDe(p, idx));
  return clave != null && siContestaDe(pasos, clave) === 'sigue';
}

/** ¿Algún camino sigue cuando el lead contesta? (El motor pausa de a una sólo las que tienen algo que sigue.) */
export function algunCaminoSigue(pasos: readonly PasoGrafo[]): boolean {
  return caminosDeSalida(pasos).some((c) => siContestaDe(pasos, c.clave) === 'sigue');
}

/**
 * Fija lo que hace un camino cuando el lead contesta. Sin tarjeta de inicio (una sola flecha del CRON), la CREA,
 * como cuando se agrega la primera flecha en paralelo desde el CRON (`insertarNodo`): es la tarjeta CRON del dato.
 * Un camino que no existe no cambia nada.
 */
export function fijarSiContesta<P extends PasoGrafo>(pasosIn: readonly P[], clave: string, valor: SiContesta): P[] {
  const pasos = normalizar(pasosIn);
  if (!caminosDeSalida(pasos).some((c) => c.clave === clave)) return pasos;
  const ini = indiceInicio(pasos);
  if (ini < 0) {
    const principal = raizSalida(pasos);
    if (!principal) return pasos;
    return [...pasos, { id: ID_INICIO, nodo: 'inicio', siguiente: principal, si_contesta: { [clave]: valor } } as unknown as P];
  }
  return pasos.map((p, i) => (i === ini ? { ...p, si_contesta: { ...(p.si_contesta ?? {}), [clave]: valor } } : p));
}

/** Las opciones válidas de un inicio: sólo de sus caminos (`claves`) y con un valor que existe. Vacío = sin el campo. */
function siContestaLimpio(x: unknown, claves: readonly string[]): Record<string, SiContesta> | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const out: Record<string, SiContesta> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (claves.includes(k) && (v === 'corta' || v === 'sigue')) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

/** El nodo «Si responde», si la automatización tiene uno (con varios AI Step, el PRIMERO: `raicesRespuesta`). */
export function raizRespuesta(pasos: readonly PasoGrafo[]): string | null {
  // Una «Si responde» SUELTA (le borraron la flecha del CRON) no escucha: no es raíz de nada.
  const i = pasos.findIndex((p) => claseDe(p) === 'respuesta' && p.suelta !== true);
  return i >= 0 ? idDe(pasos[i], i) : null;
}

/**
 * TODAS LAS TARJETAS QUE ESCUCHAN, conectadas al CRON, en el orden del array (AI Step v2, décima tanda:
 * «solo permitir 1 caso por tarjeta de AI Step, y si quieren pueden crear otra tarjeta»). En la forma de
 * siempre es una sola (`validarGrafo` no deja dos «Si responde»), así que es `[raizRespuesta]`. Lo que
 * pregunta «¿esto cuelga del CRON por escuchar?» —los hilos, las sueltas, los cruces, el dibujo— mira
 * ésta; el motor y «Probar» recorren la EXPANSIÓN (`expandirPasoIA`), donde vuelve a haber una.
 */
export function raicesRespuesta(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  pasos.forEach((p, i) => { if (p && claseDe(p) === 'respuesta' && p.suelta !== true) out.push(idDe(p, i)); });
  return out;
}

/**
 * El PRIMER padre de un nodo (por puertos, en el orden del array) y por cuál de sus puertos cuelga.
 * Desde la sexta tanda una tarjeta puede tener varios: lo que tiene que mirarlos a todos usa
 * `padresDe` (o `padresSinVuelta`, si una flecha de un ciclo no cuenta como «lo de antes»).
 */
export function padreDe(pasos: readonly PasoGrafo[], id: string): { id: string; puerto: string } | null {
  for (let i = 0; i < pasos.length; i++) {
    for (const pt of puertosDe(pasos, i)) if (pt.destino === id) return { id: idDe(pasos[i], i), puerto: pt.puerto };
  }
  return null;
}

/** TODOS los padres de un nodo (por puertos), en el orden del array y de sus puertos. */
export function padresDe(pasos: readonly PasoGrafo[], id: string): Array<{ id: string; puerto: string }> {
  const out: Array<{ id: string; puerto: string }> = [];
  for (let i = 0; i < pasos.length; i++) {
    for (const pt of puertosDe(pasos, i)) if (pt.destino === id) out.push({ id: idDe(pasos[i], i), puerto: pt.puerto });
  }
  return out;
}

/** La clave de una flecha en `aristasDeVuelta`: de qué tarjeta y por qué puerto. */
export const claveArista = (origen: string, puerto: string): string => `${origen}|${puerto}`;

/**
 * LAS FLECHAS QUE VUELVEN: las que cierran un ciclo, yendo de una tarjeta a otra que está ANTES en
 * su camino (el «volver al principio» de ManyChat, que desde la sexta tanda es una flecha y no un
 * «Ir a»). Un recorrido en profundidad DETERMINISTA —el CRON (o la raíz), «Si responde», lo que nadie
 * apunta y después lo que quede, en el orden del array y de los puertos— y una flecha a una tarjeta
 * que todavía está en el camino que se recorre es una que vuelve. Clave: `claveArista`.
 *
 * Lo leen los que suben por los padres (`padresSinVuelta`): para «¿es el primer mensaje?» o «¿de qué
 * espera cuelga?», la flecha que vuelve de abajo no es lo de antes.
 */
export function aristasDeVuelta(pasos: readonly PasoGrafo[]): Set<string> {
  const ids = pasos.map((p, i) => idDe(p, i));
  const estado = new Map<string, 1 | 2>();   // 1 = en el camino que se recorre, 2 = terminado
  const out = new Set<string>();
  const recorrer = (inicio: string) => {
    if (estado.has(inicio) || indicePorId(pasos, inicio) < 0) return;
    const pila: Array<{ id: string; pts: Puerto[]; k: number }> = [];
    const entrar = (id: string) => { estado.set(id, 1); pila.push({ id, pts: puertosDe(pasos, indicePorId(pasos, id)), k: 0 }); };
    entrar(inicio);
    while (pila.length) {
      const top = pila[pila.length - 1];
      if (top.k >= top.pts.length) { estado.set(top.id, 2); pila.pop(); continue; }
      const pt = top.pts[top.k++];
      const d = pt.destino;
      if (!d || indicePorId(pasos, d) < 0) continue;
      const e = estado.get(d);
      if (e === 1) out.add(claveArista(top.id, pt.puerto));
      else if (e === undefined) entrar(d);
    }
  };
  const ini = indiceInicio(pasos);
  if (ini >= 0) recorrer(ids[ini]);
  else { const r = raizSalida(pasos); if (r) recorrer(r); }
  for (const resp of raicesRespuesta(pasos)) recorrer(resp);
  const ap = apuntados(pasos);
  for (const id of ids) if (!ap.has(id)) recorrer(id);
  for (const id of ids) recorrer(id);
  return out;
}

/**
 * Los padres de un nodo SIN las flechas que vuelven (`aristasDeVuelta`): lo que de verdad viene
 * antes. `vuelta` se puede pasar ya calculada (quien sube por varios nodos la calcula una vez).
 */
export function padresSinVuelta(pasos: readonly PasoGrafo[], id: string, vuelta: ReadonlySet<string> = aristasDeVuelta(pasos)): Array<{ id: string; puerto: string }> {
  return padresDe(pasos, id).filter((pa) => !vuelta.has(claveArista(pa.id, pa.puerto)));
}

/** Todos los nodos que cuelgan de uno (sin él), siguiendo puertos. Los saltos no se siguen. */
export function descendientes(pasos: readonly PasoGrafo[], id: string): Set<string> {
  const out = new Set<string>();
  const pila = [id];
  while (pila.length) {
    const cur = pila.pop()!;
    const i = indicePorId(pasos, cur);
    if (i < 0) continue;
    for (const pt of puertosDe(pasos, i)) {
      if (pt.destino && !out.has(pt.destino) && pt.destino !== id) { out.add(pt.destino); pila.push(pt.destino); }
    }
  }
  return out;
}

// ── Generar ids ───────────────────────────────────────────────────────────────────

/**
 * Un id nuevo que no choca con ninguno. ALEATORIO a propósito: uno correlativo («el mayor
 * más uno») reusaría el id de un nodo recién borrado, y una inscripción parada en ese nodo
 * seguiría por la tarjeta nueva. `rnd` se inyecta en los tests.
 */
export function nuevoId(pasos: readonly PasoGrafo[], rnd: () => number = Math.random): string {
  const usados = new Set(pasos.map((p, i) => idDe(p, i)));
  for (const p of pasos) {
    for (const r of p.ramas ?? []) usados.add(r.id);
    for (const c of p.casos ?? []) usados.add(c.id);
  }
  for (let k = 0; k < 50; k++) {
    const id = `n${Math.floor(rnd() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!usados.has(id)) return id;
  }
  // 50 choques seguidos sólo pasan con un `rnd` roto: se desempata con el tamaño.
  return `n${usados.size}x${Math.floor(rnd() * 1e9).toString(36)}`;
}

// ── Normalizar: lo que se GUARDA ──────────────────────────────────────────────────

/**
 * UN RESULTADO de una condición, limpio: su principal y sus flechas en paralelo sin repetidos, sin
 * vacíos, sin la propia condición, sin las que van a una tarjeta que no está (`existe`, si se pasa)
 * y sin repetir la principal (sería la misma flecha dos veces: dos padres). Y SIN PRINCIPAL, LA
 * PRIMERA FLECHA PASA A SERLO, como en el inicio: un «Si no» con sólo flechas en paralelo y la
 * principal vacía se leería como «termina» (`antiguedadDeEntrada` frenaría al inscribir a quien
 * entra por esas flechas) y su fila se dibujaría vacía con flechas saliendo. El motor hace lo mismo
 * con las dos formas: sigue por una y arranca hilos por las otras.
 */
function salidaLimpia(principal: string | null | undefined, lista: unknown, propio: string, existe?: ReadonlySet<string>): { principal: string | null; paralelos: string[] } {
  let par = listaLimpia(lista).filter((d) => d !== propio && (!existe || existe.has(d)));
  let sig = principal ?? null;
  if (sig == null && par.length) { sig = par[0]; par = par.slice(1); }
  par = par.filter((d) => d !== sig);
  return { principal: sig, paralelos: par };
}

/**
 * Deja todos los ids y todos los `siguiente` EXPLÍCITOS. Lo corre `setSecuenciaPasos` en
 * cada guardado y el lienzo al cargar: después de esto, insertar o borrar un elemento del
 * array no le cambia a nadie el paso siguiente.
 *
 * Los ids que faltan toman `o<índice>` (el mismo que leía el motor con `paso_actual`), así
 * que la PRIMERA normalización de una secuencia vieja no mueve a ninguna inscripción.
 * Idempotente.
 *
 * ⚠️ UNA FLECHA EN PARALELO A UNA TARJETA QUE NO ESTÁ EN EL FLUJO SE VA (cuarta tanda). El comentario
 * de `paralelosDe` lo prometía desde la segunda tanda («lo limpia `normalizar`») y el código no lo
 * hacía: un id colgado no se dibuja (no hay tarjeta a la que llegar), así que en el lienzo no había
 * nada que borrar, y Publicar frenaba con «sigue en X, que no existe» nombrando un id. Una flecha en
 * paralelo es un extra: sin su tarjeta no lleva a ningún lado. Una salida PRINCIPAL colgada NO se
 * toca: ésa sí cambia por dónde sigue el lead, y la tiene que ver `validarGrafo`.
 */
export function normalizar<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  // Un inicio sin id sólo puede tener uno: el reservado. Con `o<i>` `validarGrafo` lo rechazaría
  // por un id que nadie eligió.
  const ids = pasos.map((p, i) => (claseDe(p) === 'inicio' && !(typeof p.id === 'string' && p.id) ? ID_INICIO : idDe(p, i)));
  // Un id repetido (dos escritores que copiaron un paso con su id) se desempata: el
  // segundo toma otro. Sin esto, `nodoPorId` devolvería siempre el primero.
  const vistos = new Set<string>();
  ids.forEach((id, i) => {
    if (!vistos.has(id)) { vistos.add(id); return; }
    let k = 2;
    while (vistos.has(`${id}_${k}`)) k++;
    ids[i] = `${id}_${k}`;
    vistos.add(ids[i]);
  });
  const existe = new Set(ids);
  return pasos.map((p, i) => {
    const out: P = { ...p, id: ids[i] };
    const c = claseDe(p);
    if (c === 'mensaje' || c === 'accion' || c === 'esperar') {
      out.siguiente = p.siguiente !== undefined ? (p.siguiente ?? null) : (pasos[i + 1] ? ids[i + 1] : null);
    } else if (c === 'inicio') {
      // El inicio, siempre explícito: «el de abajo del array» no es su salida (siguienteDe).
      out.siguiente = p.siguiente ?? null;
    } else {
      delete out.siguiente;
    }
    // Las flechas en paralelo se conservan SÓLO donde se admiten, sin repetidos, sin vacíos, sin
    // apuntarse a sí misma y sin repetir la salida principal (una flecha «en paralelo» al mismo
    // lugar que la de siempre es la misma flecha dos veces: le daría dos padres). Vacío = sin el
    // campo, así un flujo que nunca tuvo paralelos queda IGUAL que antes byte a byte.
    let par = puedeTenerParalelos(p) && Array.isArray(p.paralelos)
      ? p.paralelos.filter((d, k, a): d is string => typeof d === 'string' && d.length > 0 && d !== ids[i] && a.indexOf(d) === k && existe.has(d))
      : [];
    // Un inicio sin salida principal y con paralelos PROMUEVE el primero: la principal es la que
    // leen `raizSalida` y el «Solo a leads recientes», y no puede quedar vacía con hilos vivos.
    let promovido: string | null = null;
    if (c === 'inicio' && out.siguiente == null && par.length) { out.siguiente = par[0]; promovido = par[0]; par = par.slice(1); }
    par = par.filter((d) => d !== out.siguiente);
    if (par.length) out.paralelos = par;
    else delete out.paralelos;
    // SI CONTESTA (14/10/2026): sólo en el inicio y sólo de sus caminos. El paralelo que pasa a principal se lleva
    // su opción a la clave del principal.
    if (c === 'inicio') {
      const crudo = (p.si_contesta && typeof p.si_contesta === 'object' ? { ...p.si_contesta } : undefined) as Record<string, unknown> | undefined;
      if (crudo && promovido && crudo[promovido] !== undefined && crudo[HILO_PRINCIPAL] === undefined) crudo[HILO_PRINCIPAL] = crudo[promovido];
      const sc = siContestaLimpio(crudo, [HILO_PRINCIPAL, ...par]);
      if (sc) out.si_contesta = sc;
      else delete out.si_contesta;
    } else {
      delete out.si_contesta;
    }
    if (c === 'condicion') {
      out.ramas = (p.ramas ?? []).map((r, k) => {
        // Las flechas en paralelo de cada resultado (cuarta tanda, punto 8), con la misma limpieza
        // que las de una tarjeta y la promoción del inicio (`salidaLimpia`).
        const s = salidaLimpia(r.siguiente, r.paralelos, ids[i], existe);
        const rama: RamaCondicion = { ...r, id: r.id || `${ids[i]}r${k}`, siguiente: s.principal, filas: r.filas ?? [], modo: r.modo === 'cualquiera' ? 'cualquiera' : 'todas' };
        if (s.paralelos.length) rama.paralelos = s.paralelos;
        else delete rama.paralelos;
        return rama;
      });
      const s = salidaLimpia(p.si_no, p.paralelos_si_no, ids[i], existe);
      out.si_no = s.principal;
      if (s.paralelos.length) out.paralelos_si_no = s.paralelos;
      else delete out.paralelos_si_no;
    } else {
      // Sólo una condición tiene «Si no» con flechas: en otra clase el campo no significa nada.
      delete out.paralelos_si_no;
    }
    if (c === 'respuesta') {
      const idsCasos = idsDeCasos(ids[i], p.casos ?? []);
      out.casos = (p.casos ?? []).map((x, k) => ({ ...x, id: idsCasos[k], siguiente: x.siguiente ?? null }));
      out.si_no = p.si_no ?? null;
    }
    return out;
  });
}

/**
 * LOS IDS DE LOS CASOS de un «Si responde»: el que trae cada uno o `<nodo>c<k>`, y un REPETIDO se
 * desempata como los ids de tarjeta de `normalizar` (el segundo toma `_2`). Lo usan `normalizar` y
 * `expandirPasoIA`, así lo que se guarda y lo que se recorre nombran igual a cada caso.
 *
 * ⚠️ EN UN AI STEP UN ID REPETIDO NO ES INOFENSIVO (revisión de la novena tanda). En la forma de
 * siempre el motor va por `caso.siguiente` y dos casos con el mismo id no se pisan. La expansión
 * deriva del id las tarjetas de cada caso (`idRespuestaDeCaso`), así que el segundo caso apuntaba a la
 * respuesta del primero: medido con «Precio» (NO des precio, a revisar) y «Confirma» (agradece, sale
 * sola) con el mismo id, «Confirma» contestaba con la guía del precio y quedaba a revisar. Nace sin
 * que nadie lo pida: `sanearCaso` deja en '' un id inválido y el `<nodo>c<k>` de acá puede ser el de
 * otro caso. No se frena al guardar porque nadie podría arreglarlo desde el lienzo (no muestra ids).
 */
export function idsDeCasos(nodo: string, casos: readonly { readonly id?: string | null }[]): string[] {
  const vistos = new Set<string>();
  return casos.map((c, k) => {
    const base = typeof c.id === 'string' && c.id ? c.id : `${nodo}c${k}`;
    let id = base;
    for (let n = 2; vistos.has(id); n++) id = `${base}_${n}`;
    vistos.add(id);
    return id;
  });
}

// ── Validar: lo que NO se guarda ──────────────────────────────────────────────────

export const TOPE_NODOS = 60;
export const TOPE_RAMAS = 8;
export const TOPE_FILAS = 6;
export const TOPE_CASOS = 30;

/**
 * LO QUE IMPIDE GUARDAR, incluso un borrador (sexta tanda): lo que rompe el DATO y no se arregla
 * terminando de armar la automatización. Ids repetidos (`nodoPorId` devolvería siempre el primero),
 * flechas a tarjetas que no existen (no hay a dónde dibujarlas), los topes, y las combinaciones
 * imposibles (una flecha en paralelo donde la clase no la admite, dos «Si responde», una flecha que
 * llega al CRON o a «Si responde», un inicio con otro id).
 *
 * Con esto pasa el BORRADOR de lib/secuencia-borrador.ts: una automatización con tarjetas sueltas o
 * a medio armar SOBREVIVE sin publicarse. Lo que falta para publicar lo dice `validarGrafo`.
 */
export function validarParaGuardar(pasos: readonly PasoGrafo[]): string[] {
  return erroresDeForma(pasos, false);
}

/**
 * LO QUE IMPIDE PUBLICAR O PROBAR: todo lo de `validarParaGuardar` y además lo INCOMPLETO —
 * tarjetas sueltas, condiciones sin completar, una espera sin cuánto, un caso sin nombre, una
 * automatización sin ningún camino—, los ciclos sin una espera en el medio y los caminos que corren
 * a la vez y caen en la misma tarjeta. Vacío = se puede publicar.
 *
 * Lo corre `setSecuenciaPasos` (lo publicado: es lo único que lee el motor, así que una tarjeta
 * suelta nunca corre) y el lienzo antes de Publicar y de Probar (`frenoDelFlujo`, que muestra el
 * PRIMERO: por eso «sin ningún camino» va adelante y las sueltas nombran su tarjeta).
 */
export function validarGrafo(pasos: readonly PasoGrafo[]): string[] {
  return erroresDeForma(pasos, true);
}

function erroresDeForma(pasos: readonly PasoGrafo[], publicar: boolean): string[] {
  const err: string[] = [];
  const ids = pasos.map((p, i) => idDe(p, i));
  const ini = indiceInicio(pasos);
  // Las que escuchan, conectadas (con AI Step v2 pueden ser varias: `raicesRespuesta`).
  const rs = raicesRespuesta(pasos);
  // ── Sin ningún camino: hay tarjetas y el CRON no lleva a ninguna (y no hay «Si responde»). Va
  // PRIMERO: con el CRON desconectado, todo lo demás es consecuencia. Una automatización VACÍA no lo
  // es: no tiene nada que correr, y los escritores que la vacían (la API) siguen pudiendo.
  if (publicar && pasos.some((p) => p && claseDe(p) !== 'inicio') && !raicesSalida(pasos).length && !rs.length) {
    err.push('el CRON no lleva a ninguna tarjeta');
  }
  if (pasos.length > TOPE_NODOS) err.push(`una automatización tiene como mucho ${TOPE_NODOS} tarjetas`);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) err.push(`ids repetidos: ${[...new Set(dup)].join(', ')}`);
  const existe = new Set(ids);
  let respuestas = 0;
  pasos.forEach((p, i) => {
    const c = claseDe(p);
    if (c === 'respuesta') respuestas++;
    if (c === 'condicion') {
      const ramas = p.ramas ?? [];
      if (publicar && !ramas.length) err.push(`la condición ${ids[i]} no tiene ninguna rama`);
      if (ramas.length > TOPE_RAMAS) err.push(`la condición ${ids[i]} tiene más de ${TOPE_RAMAS} ramas`);
      for (const rama of ramas) {
        if (publicar && !rama.filas?.length) err.push(`una rama de la condición ${ids[i]} no tiene ninguna condición`);
        if ((rama.filas?.length ?? 0) > TOPE_FILAS) err.push(`una rama de la condición ${ids[i]} tiene más de ${TOPE_FILAS} condiciones`);
        // SEXTA TANDA: «Su respuesta trata de» es la fila de la condición que ESCUCHA (sus casos), no
        // una de la salida: ahí no se evalúa contra nada y la rama no se cumpliría nunca. El editor no
        // la deja poner (la ofrece sólo en una condición vacía, que la convierte); esto es para la API.
        if (rama.filas?.some((f) => condicionPorId(f.campo)?.evento)) err.push(`«${ROTULO_RESPUESTA}» va en la condición que escucha las respuestas, no en la condición ${ids[i]}`);
        // Lo que cada fila necesita para que el motor la pueda decidir lo dice UNA función, la del
        // catálogo (`problemaDeFila`): la misma que mira el editor para marcar la fila incompleta.
        if (publicar) for (const f of rama.filas ?? []) {
          const pr = problemaDeFila(f);
          if (pr) err.push(pr.startsWith('condición desconocida') ? pr : `${pr} en la condición ${ids[i]}`);
        }
      }
    }
    if (c === 'respuesta' && (p.casos?.length ?? 0) > TOPE_CASOS) err.push(`«Si responde» tiene más de ${TOPE_CASOS} casos`);
    // El AI STEP se valida en su forma COMPACTA (lo que se guarda), con sus propios motivos: nombran la
    // tarjeta por su id para que Publicar la abra (`tarjetaDelError`) y el caso por su nombre.
    if (c === 'respuesta' && esPasoIA(p)) err.push(...erroresDelPasoIA(p, ids[i], publicar));
    else if (publicar && c === 'respuesta') for (const x of p.casos ?? []) if (!x.titulo?.trim() || !x.cuando?.trim()) err.push('un caso de «Si responde» no tiene nombre o descripción');
    if (publicar && c === 'esperar') {
      const m = Number(p.espera?.minutos);
      if (!p.espera || !(m > 0)) err.push(`la espera ${ids[i]} no dice cuánto`);
    }
    if (c === 'ir_a') {
      const d = p.destino;
      if (!d) { if (publicar) err.push(`el «Ir a» ${ids[i]} no dice a dónde`); }
      else if ('nodo' in d && !existe.has(d.nodo)) err.push(`el «Ir a» ${ids[i]} apunta a una tarjeta que no existe`);
    }
    for (const pt of puertosDe(pasos, i)) {
      if (pt.destino && !existe.has(pt.destino)) err.push(`la tarjeta ${ids[i]} sigue en ${pt.destino}, que no existe`);
    }
  });
  // «Si responde» de los de siempre sigue siendo UNO y no se mezcla con AI Step (las dos formas escuchan el
  // mismo mensaje: el motor no sabría cuál contesta).
  // ⚠️ UNDÉCIMA TANDA: UN AI STEP POR MEDIO (`TOPE_AI_STEP_POR_MEDIO`). Al guardar cuentan los que ESCUCHAN (lo
  // viejo de varios lo junta `juntarPasosIA` antes de llegar acá; uno suelto al lado es un borrador que se
  // arregla en el lienzo). Al publicar, todos los del medio: uno suelto tampoco se publica.
  const ias = pasos.filter((p) => p && esPasoIA(p));
  const clasicas = respuestas - ias.length;
  if (clasicas > 1) err.push('hay más de una tarjeta «Si responde»');
  if (clasicas > 0 && ias.length > 0) err.push('un AI Step no va con un «Si responde»');
  for (const m of MEDIOS_AI_STEP) {
    const delMedio = ias.filter((p) => medioDe(p) === m);
    const escuchan = delMedio.filter((p) => p.suelta !== true).length;
    if (escuchan > TOPE_AI_STEP_POR_MEDIO || (publicar && delMedio.length > TOPE_AI_STEP_POR_MEDIO)) err.push(`hay más de un AI Step de ${ROTULO_MEDIO[m]}`);
  }
  // ⚠️ SEXTA TANDA: VARIAS FLECHAS PUEDEN LLEGAR A UNA TARJETA. Hasta la quinta, «la tarjeta X cuelga
  // de N lugares (para juntar ramas se usa «Ir a»)» era un error, y era lo que hacía que «poner más de
  // una flecha a una tarjeta» no funcionara (punto 13). Lo que sí se mira: que el ciclo que formen
  // tenga una espera (abajo) y que dos caminos que corren a la vez no caigan en ella (`cruces`).
  if (publicar) {
    // Lo que cuelga de «Si responde» corre EN EL MOMENTO de la respuesta: una espera ahí
    // dejaría al lead esperando una contestación horas. No se puede.
    for (const r of rs) for (const d of descendientes(pasos, r)) if (claseDe(pasos[indicePorId(pasos, d)]) === 'esperar') err.push('«Si responde» no puede tener esperas: se contesta en el momento');
    // Un CICLO sin una espera en el medio —por flechas (sexta tanda) o por un «Ir a» de antes— es un
    // bucle que el motor daría vueltas en la misma corrida (`ciclosSinEspera`).
    const ciclo = ciclosSinEspera(pasos);
    if (ciclo.size) {
      const nombrar = nombreDelCiclo(pasos, ciclo);
      const i = indicePorId(pasos, nombrar);
      err.push(claseDe(pasos[i]) === 'ir_a'
        ? `el «Ir a» ${nombrar} vuelve atrás sin ninguna espera en el medio`
        : `la tarjeta ${nombrar} vuelve atrás sin ninguna espera en el medio`);
    }
  }
  err.push(...reglasDeHilos(pasos, ids, rs, publicar));
  if (publicar) {
    for (const x of cruces(pasos)) {
      err.push(x.conRespuesta
        ? `la tarjeta ${x.id} está en «Si responde» y en el camino de salida`
        : `a la tarjeta ${x.id} llegan dos caminos que corren a la vez`);
    }
    // Lo que no cuelga de ninguna de las raíces es una tarjeta suelta. Un salto NO la salva: una
    // tarjeta a la que sólo se llega saltando es una segunda salida que nadie dibuja ni arranca.
    // Las raíces son las de CADA hilo de la salida (`raicesSalida`) y «Si responde»; el inicio es
    // el CRON y cuenta como alcanzable (no es una tarjeta que alguien pueda dejar suelta).
    const sueltas = tarjetasSueltas(pasos);
    if (sueltas.length) err.push(`tarjetas sueltas: ${sueltas.join(', ')}`);
  }
  return [...new Set(err)];
}

/**
 * LAS TARJETAS SUELTAS: las que no se alcanzan desde el CRON (cada camino de la salida) ni desde «Si
 * responde», siguiendo flechas. Un salto NO las salva (ver `validarGrafo`). El motor nunca las corre:
 * no se llega a ellas, y además no se pueden publicar.
 */
export function tarjetasSueltas(pasos: readonly PasoGrafo[]): string[] {
  const ids = pasos.map((p, i) => idDe(p, i));
  const alcanzable = new Set<string>();
  // Cada AI Step conectado al CRON es una raíz (AI Step v2: varias tarjetas que escuchan).
  const raices = [...raicesSalida(pasos), ...raicesRespuesta(pasos)];
  const ini = indiceInicio(pasos);
  if (ini >= 0) raices.push(ids[ini]);
  for (const x of raices) { alcanzable.add(x); for (const d of descendientes(pasos, x)) alcanzable.add(d); }
  return ids.filter((id) => !alcanzable.has(id));
}

/**
 * LAS TARJETAS DE UN CICLO SIN UNA ESPERA EN EL MEDIO, siguiendo lo que EJECUTA el motor: las flechas
 * y los saltos de un «Ir a» a una tarjeta. Es la regla de siempre («un ciclo necesita una espera») con
 * la forma de la sexta tanda: desde que una flecha puede volver a una tarjeta de arriba, el ciclo ya
 * no es sólo un «Ir a». Se arma el grafo SIN las esperas y se buscan las tarjetas que vuelven a sí
 * mismas: si existe un camino de vuelta que no pasa por ninguna espera, ésa es la vuelta que el motor
 * daría en la misma corrida. (Mirando sólo el camino del árbol, un segundo camino sin espera que llega
 * al mismo lugar se escapaba.)
 */
export function ciclosSinEspera(pasos: readonly PasoGrafo[]): Set<string> {
  const ids = pasos.map((p, i) => idDe(p, i));
  const indice = new Map<string, number>();
  ids.forEach((id, i) => { if (!indice.has(id)) indice.set(id, i); });
  const espera = (i: number) => claseDe(pasos[i]) === 'esperar';
  const ejec = pasos.map((p, i) => {
    if (espera(i)) return [] as string[];
    const out = puertosDe(pasos, i).map((pt) => pt.destino).filter((d): d is string => !!d);
    if (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino) out.push(p.destino.nodo);
    return out.filter((d) => { const k = indice.get(d); return k !== undefined && !espera(k); });
  });
  const out = new Set<string>();
  pasos.forEach((_, i) => {
    if (espera(i)) return;
    const vistos = new Set<string>();
    const pila = [...ejec[i]];
    while (pila.length) {
      const cur = pila.pop()!;
      if (cur === ids[i]) { out.add(ids[i]); return; }
      if (vistos.has(cur)) continue;
      vistos.add(cur);
      const k = indice.get(cur);
      if (k !== undefined) pila.push(...ejec[k]);
    }
  });
  return out;
}

/**
 * Qué tarjeta nombra el error de un ciclo sin espera: un «Ir a» del ciclo (el error de siempre), si
 * no la tarjeta de la que SALE la flecha que vuelve (donde la persona dibujó la vuelta), y si no la
 * primera del ciclo en el orden del array.
 */
function nombreDelCiclo(pasos: readonly PasoGrafo[], ciclo: ReadonlySet<string>): string {
  const ids = pasos.map((p, i) => idDe(p, i));
  const irA = ids.find((id, i) => ciclo.has(id) && claseDe(pasos[i]) === 'ir_a');
  if (irA) return irA;
  for (const k of aristasDeVuelta(pasos)) {
    const [origen] = k.split('|');
    if (ciclo.has(origen)) return origen;
  }
  return ids.find((id) => ciclo.has(id)) ?? [...ciclo][0];
}

/** De dónde nació un camino: 'p' el principal, 'r' «Si responde», o la flecha en paralelo (`origen|puerto`). */
type Llegada = { camino: string; ctx: ReadonlyMap<string, string> | null };

/** Cuántos estados recorre `cruces` antes de rendirse a la regla simple (sin mirar qué se excluye). */
const TOPE_ESTADOS_CRUCES = 20_000;

/**
 * DOS CAMINOS QUE CORREN A LA VEZ CAEN EN LA MISMA TARJETA: al lead le llegaría dos veces (dos
 * cursores en una tarjeta: lo mismo que la regla del «Ir a» a otro camino, que desde la sexta tanda
 * también puede pasar con una flecha a una tarjeta que ya existe). Y una tarjeta que está a la vez en
 * «Si responde» y en la salida (ahí corre en el momento de la respuesta; acá, con el reloj del camino).
 *
 * ⚠️ DOS RESULTADOS DE UNA CONDICIÓN SE EXCLUYEN: el WhatsApp del «Sí» y el email del «Si no» pueden
 * juntarse en la misma tarjeta, porque para un lead corre uno solo. Por eso cada llegada lleva por qué
 * resultado de cada condición pasó (`ctx`), y dos llegadas sólo chocan si no tomaron resultados
 * distintos en ninguna condición que compartan. Una condición que se vuelve a pasar (un ciclo) deja el
 * contexto en «cualquiera» (`null`), y si el recorrido se va de tamaño se rinde a la regla simple: lo
 * que no se puede probar que se excluye, choca.
 */
export function cruces(pasos: readonly PasoGrafo[]): Array<{ id: string; conRespuesta: boolean }> {
  // Con contexto; si el recorrido se va de tamaño, otra vez SIN contexto (la regla simple: todo lo que
  // llega por dos caminos choca). Nunca a medias: un recorrido cortado se perdería llegadas.
  const llegadas = llegadasPorTarjeta(pasos, true) ?? llegadasPorTarjeta(pasos, false)!;
  const compatibles = (a: Llegada, b: Llegada): boolean => {
    if (!a.ctx || !b.ctx) return true;
    for (const [k, v] of a.ctx) if (b.ctx.has(k) && b.ctx.get(k) !== v) return false;
    return true;
  };
  const out: Array<{ id: string; conRespuesta: boolean }> = [];
  pasos.forEach((p, i) => {
    const id = idDe(p, i);
    const ls = llegadas.get(id) ?? [];
    let choca: { conRespuesta: boolean } | null = null;
    for (let a = 0; a < ls.length && !choca; a++) {
      for (let b = a + 1; b < ls.length && !choca; b++) {
        if (ls[a].camino === ls[b].camino) continue;
        const conRespuesta = ls[a].camino === HILO_RESPUESTA || ls[b].camino === HILO_RESPUESTA;
        if (conRespuesta || compatibles(ls[a], ls[b])) choca = { conRespuesta };
      }
    }
    if (choca) out.push({ id, ...choca });
  });
  return out;
}

/** Por qué caminos (y con qué resultados de cada condición) se llega a cada tarjeta. null = pasó el tope. */
function llegadasPorTarjeta(pasos: readonly PasoGrafo[], conCtx: boolean): Map<string, Llegada[]> | null {
  const llegadas = new Map<string, Llegada[]>();
  const vistos = new Set<string>();
  const firma = (ctx: ReadonlyMap<string, string> | null) => (ctx ? [...ctx].sort().map(([a, b]) => `${a}=${b}`).join(',') : '*');
  const pila: Array<{ id: string; camino: string; ctx: ReadonlyMap<string, string> | null; enResp: boolean }> = [];
  const empujar = (id: string | null | undefined, camino: string, ctx: ReadonlyMap<string, string> | null, enResp: boolean) => {
    if (!id || indicePorId(pasos, id) < 0) return;
    const c = conCtx ? ctx : null;
    const k = `${id}#${camino}#${firma(c)}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    pila.push({ id, camino, ctx: c, enResp });
  };
  const ini = indiceInicio(pasos);
  if (ini >= 0) empujar(idDe(pasos[ini], ini), HILO_PRINCIPAL, new Map(), false);
  else empujar(raizSalida(pasos), HILO_PRINCIPAL, new Map(), false);
  for (const resp of raicesRespuesta(pasos)) empujar(resp, HILO_RESPUESTA, new Map(), true);
  while (pila.length) {
    if (conCtx && vistos.size > TOPE_ESTADOS_CRUCES) return null;
    const { id, camino, ctx, enResp } = pila.pop()!;
    const lista = llegadas.get(id) ?? [];
    lista.push({ camino, ctx });
    llegadas.set(id, lista);
    const i = indicePorId(pasos, id);
    const p = pasos[i];
    if (claseDe(p) === 'condicion') {
      for (const res of resultadosDe(p)) {
        // La condición ya estaba en el camino (un ciclo): en otra vuelta puede salir por otro lado.
        const otro = ctx && ctx.has(id) && ctx.get(id) !== res;
        const nuevo: ReadonlyMap<string, string> | null = !ctx || otro ? null : new Map([...ctx, [id, res]]);
        const principal = res === RESULTADO_SI_NO ? p.si_no : (p.ramas ?? []).find((x) => x.id === res)?.siguiente;
        empujar(principal, camino, nuevo, enResp);
        for (const d of paralelosDeResultado(p, res)) empujar(d, enResp ? camino : claveArista(id, puertoParalelo(d, res)), nuevo, enResp);
      }
      continue;
    }
    for (const pt of puertosDe(pasos, i)) {
      if (!pt.destino) continue;
      const nace = pt.puerto.startsWith('par:') && !enResp;
      empujar(pt.destino, nace ? claveArista(id, pt.puerto) : camino, ctx, enResp);
    }
    // Un «Ir a» de la salida salta dentro de su camino. Uno desde «Si responde» RETOMA la salida en UN
    // camino y DESCARTA los congelados (decisión 4 de la segunda tanda): lo que corre después es un
    // cursor solo, que no choca con nadie. No se sigue.
    if (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino && !enResp) empujar(p.destino.nodo, camino, ctx, false);
  }
  return llegadas;
}

/**
 * LAS TARJETAS QUE ESTÁN DENTRO DE UN BUCLE: las que, siguiendo el grafo de EJECUCIÓN (los
 * puertos más los saltos de un «Ir a» a una tarjeta), vuelven a sí mismas. Un bucle es cualquier
 * ciclo de ese grafo, no sólo un salto hacia su propio ancestro: dos saltos cruzados entre ramas
 * también vuelven.
 *
 * ⚠️ UNA SOLA FUNCIÓN PARA LA REGLA Y PARA LO QUE SE OFRECE. La usan `reglasDeHilos` (rechaza al
 * publicar una tarjeta que reparte dentro de un bucle) y el lienzo (`grafoDeSecuencia` no ofrece
 * el ＋ en paralelo en una tarjeta de un bucle). Hasta el 09/10/2026 el lienzo miraba la clase,
 * «Si responde» y los topes y NO los bucles: ofrecía «＋ En paralelo» en CRON → m1 → esperar → «Ir a» m1 y Publicar lo rechazaba
 * (revisión de la segunda tanda, frente modelo). Con dos copias de «qué es un bucle», la del
 * lienzo y la de validar se separan en la primera que se toque.
 */
export function nodosEnBucle(pasos: readonly PasoGrafo[]): Set<string> {
  const ids = pasos.map((p, i) => idDe(p, i));
  // El primero gana, como `indicePorId`: con ids repetidos (que `validarGrafo` rechaza aparte) se
  // sigue la misma tarjeta que seguiría el resto del modelo.
  const indice = new Map<string, number>();
  ids.forEach((id, i) => { if (!indice.has(id)) indice.set(id, i); });
  const ejec = pasos.map((p, i) => {
    const out = puertosDe(pasos, i).map((pt) => pt.destino).filter((d): d is string => !!d);
    if (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino) out.push(p.destino.nodo);
    return out;
  });
  const out = new Set<string>();
  pasos.forEach((_, i) => {
    const vistos = new Set<string>();
    const pila = [...ejec[i]];
    while (pila.length) {
      const cur = pila.pop()!;
      if (cur === ids[i]) { out.add(ids[i]); return; }
      if (vistos.has(cur)) continue;
      vistos.add(cur);
      const k = indice.get(cur);
      if (k !== undefined) pila.push(...ejec[k]);
    }
  });
  return out;
}

/**
 * Las tarjetas que sacan flechas en paralelo DENTRO DE UN BUCLE (lo que `validarGrafo` rechaza,
 * en el orden del array). Exportada para que quien pregunte por un flujo hipotético use la MISMA
 * regla en vez de reescribirla (la usaba `tarjetasParaIrA`, que se fue con el GO TO).
 */
export function repartenEnBucle(pasos: readonly PasoGrafo[]): Set<string> {
  // `todosLosParalelos`: una condición que reparte desde un RESULTADO dentro de un bucle abre hilos
  // en cada vuelta igual que una tarjeta (cuarta tanda, punto 8).
  if (!pasos.some((p) => todosLosParalelos(p).length)) return new Set();
  const enBucle = nodosEnBucle(pasos);
  const out = new Set<string>();
  pasos.forEach((p, i) => { const id = idDe(p, i); if (todosLosParalelos(p).length && enBucle.has(id)) out.add(id); });
  return out;
}

/**
 * Las reglas de la SEGUNDA TANDA (el inicio, «Si responde» sin padre y las flechas en paralelo).
 * Aparte de `validarGrafo` para que cada una se lea con su porqué.
 *
 * ⚠️ EL PORQUÉ VA EN ESTOS COMENTARIOS, NO EN EL MENSAJE. Estos textos llegan a la pantalla
 * (`errorLegible`, al lado de «Publicar»), y con el porqué entre paréntesis («(abriría caminos
 * nuevos en cada vuelta)», «(le llegaría lo mismo dos veces)», «(una condición, «Si responde» y un
 * «Ir a» no las tienen)») el error con el nombre de la tarjeta ocupaba TRES renglones: unos 69 px,
 * y el panel apaisado que ese mismo error abre le tapaba el primero, el que nombra la tarjeta
 * (revisión de la segunda tanda, 09/10/2026). AGENTS.md: «La pantalla dice QUÉ pasó; el PORQUÉ va
 * al código».
 */
function reglasDeHilos(pasos: readonly PasoGrafo[], ids: readonly string[], resps: readonly string[], publicar: boolean): string[] {
  const err: string[] = [];
  // ── El inicio: uno solo, con su id, y nadie sigue en él ──
  const inicios = pasos.map((p, i) => (claseDe(p) === 'inicio' ? i : -1)).filter((i) => i >= 0);
  if (inicios.length > 1) err.push('hay más de un inicio');
  for (const i of inicios) if (ids[i] !== ID_INICIO) err.push(`el inicio tiene que llamarse «${ID_INICIO}» (se llama ${ids[i]})`);
  // 'entrada' en una tarjeta que no es el inicio: es el CRON del lienzo, y la tarjeta quedaría
  // dibujada debajo de él.
  pasos.forEach((p, i) => {
    if (claseDe(p) !== 'inicio' && ids[i] === ID_INICIO) err.push(`el id «${ID_INICIO}» es del CRON: la tarjeta que lo usa tiene que cambiarlo`);
  });
  for (const i of inicios) if (padreDe(pasos, ids[i])) err.push('ninguna tarjeta puede seguir en el CRON');
  // ── «Si responde» no tiene padre: cuelga del CRON (pedido literal, punto 1) ──
  // Es un EVENTO (el lead contestó), no un paso del camino: una flecha hacia él lo convertiría en
  // «después de este mensaje, si responde», que es otro modelo (un oyente con alcance) y no éste.
  for (const resp of resps) if (padreDe(pasos, resp)) err.push('«Si responde» cuelga del CRON: ninguna tarjeta puede seguir en él');
  // ── Las flechas en paralelo ──
  // Una lista de flechas (la de una tarjeta o la de un resultado de una condición): repetidas, ids
  // reservados y el tope por salida. Las dos pasan por las MISMAS reglas.
  const revisarLista = (i: number, crudos: readonly unknown[], par: readonly string[], dondeTope: string) => {
    if (par.length !== crudos.length) err.push(`la tarjeta ${ids[i]} repite una flecha en paralelo`);
    // El hilo de una flecha en paralelo se llama como su primera tarjeta (`hiloDe`, el `h` del
    // motor): una llamada 'p' o 'r' sería «el principal» o «Si responde». Sólo pasa con ids
    // escritos a mano (`nuevoId` da `n…`); como id de cualquier otra tarjeta, 'r' es válido y los
    // tests lo usan.
    if (par.some((d) => d === HILO_PRINCIPAL || d === HILO_RESPUESTA)) err.push(`una flecha en paralelo de ${ids[i]} va a una tarjeta con un id reservado («${HILO_PRINCIPAL}» o «${HILO_RESPUESTA}»)`);
    if (par.length > TOPE_PARALELOS) err.push(`la tarjeta ${ids[i]} saca más de ${TOPE_PARALELOS} flechas en paralelo${dondeTope}`);
  };
  const noVacios = (x: unknown): unknown[] => (Array.isArray(x) ? x.filter((d) => typeof d === 'string' && d) : []);
  pasos.forEach((p, i) => {
    // Las de cada RESULTADO de una condición (cuarta tanda, punto 8): el tope es por resultado,
    // como el de una tarjeta es por tarjeta («varias si se cumple y varias si no se cumple»).
    for (const res of resultadosDe(p)) {
      const crudos = noVacios(crudoDeResultado(p, res));
      if (crudos.length) revisarLista(i, crudos, paralelosDeResultado(p, res), ' en un resultado');
    }
    const crudos = noVacios(p.paralelos);
    if (!crudos.length) return;
    // Una condición, «Si responde» y un «Ir a» no las tienen en la TARJETA (`puedeTenerParalelos`):
    // las de una condición van en cada resultado.
    if (!puedeTenerParalelos(p)) { err.push(`la tarjeta ${ids[i]} no puede sacar flechas en paralelo`); return; }
    revisarLista(i, crudos, paralelosDe(p), '');
  });
  // Los caminos que pueden correr A LA VEZ (`contarParalelos`), no la suma de todas las flechas: dos
  // resultados de una condición se excluyen (sexta tanda, punto 13).
  if (1 + contarParalelos(pasos) > TOPE_HILOS) err.push(`una automatización corre como mucho ${TOPE_HILOS} caminos a la vez`);
  // Adentro de «Si responde» todo corre EN EL MOMENTO de la respuesta y retoma UN hilo (diseño,
  // decisión 4): repartir ahí no tiene a qué hilo volver. Tampoco desde un resultado de una
  // condición que cuelga de ella.
  for (const resp of resps) for (const d of [resp, ...descendientes(pasos, resp)]) {
    if (todosLosParalelos(pasos[indicePorId(pasos, d)]).length) err.push('«Si responde» no puede sacar flechas en paralelo');
  }
  // Una tarjeta con paralelos DENTRO DE UN BUCLE de «Ir a» abre hilos nuevos en cada vuelta, sin
  // fin: m1 (en paralelo m2) → esperar 1 día → «Ir a» m1 suma un hilo m2 por día. Qué es un bucle
  // lo decide `nodosEnBucle`, la misma función con la que el lienzo deja de ofrecerlo.
  // Es de PUBLICAR, no de guardar: desde la sexta tanda el bucle se arma dibujando flechas, y a mitad
  // de armarlo un borrador lo puede tener.
  // El «de «Ir a»» queda sólo si el bucle lo arma un «Ir a» de antes: desde la sexta tanda el bucle es
  // una flecha que vuelve, y nombrar algo que ya no existe no dice qué pasó.
  if (publicar) {
    const reparten = repartenEnBucle(pasos);
    if (reparten.size) {
      const enBucle = nodosEnBucle(pasos);
      const conIrA = pasos.some((p, i) => claseDe(p) === 'ir_a' && enBucle.has(ids[i]));
      for (const id of reparten) err.push(`la tarjeta ${id} saca flechas en paralelo dentro de un bucle${conIrA ? ' de «Ir a»' : ''}`);
    }
  }
  // Un «Ir a {tarjeta}» de la SALIDA sólo salta dentro de su propio hilo: a la tarjeta de otro,
  // dos cursores caen en la misma tarjeta y al lead le llega el mismo mensaje dos veces. Desde «Si
  // responde» sí se puede ir a cualquier lado: la respuesta pausa todo y retoma UN solo hilo.
  // Y nunca al CRON: volver a entrar no es un salto, es inscribir de nuevo.
  const hilo = hiloDe(pasos);
  pasos.forEach((p, i) => {
    if (claseDe(p) !== 'ir_a' || !p.destino || !('nodo' in p.destino)) return;
    const destino = p.destino.nodo;
    const di = indicePorId(pasos, destino);
    if (di >= 0 && claseDe(pasos[di]) === 'inicio') { err.push(`el «Ir a» ${ids[i]} no puede volver al CRON`); return; }
    if (!publicar) return;
    const desde = hilo.get(ids[i]);
    if (!desde || desde === HILO_RESPUESTA) return;
    const hasta = hilo.get(destino);
    // Dos cursores en la misma tarjeta: al lead le llegaría lo mismo dos veces.
    if (hasta !== undefined && hasta !== desde) err.push(`el «Ir a» ${ids[i]} salta a una tarjeta de otro camino`);
  });
  return err;
}

// ── Evaluar (motor y simulador) ───────────────────────────────────────────────────

/** Lo que el motor sabe del lead en el momento de decidir. Lo junta el motor en batch. */
/**
 * Las etapas de UN CRON de la automatización que se está evaluando: las de venta de un embudo (`funnelId` null = la
 * casa del lead) o las de la entrega de un producto (`productoId` null = cualquiera). Las arma `etapasDelCron`
 * (lib/disparadores.ts) desde la lista de CRON de la fila.
 */
export type EtapasDelCron =
  | { tipo: 'venta'; funnelId: number | null; keys: readonly string[] }
  | { tipo: 'entrega'; productoId: number | null; keys: readonly string[] };

export type HechosLead = {
  etiquetas: ReadonlySet<number>;
  /** Etapa de la casa (key). */
  etapa: string | null;
  /** Etapa por producto (funnel_id → key), para `etapa` con funnel_id. */
  etapasPorProducto?: ReadonlyMap<number, string>;
  /**
   * Las etapas de los CRON de la automatización que se evalúa (para «Sigue en la etapa del CRON»). NO es un dato del
   * lead: es de la automatización, y la pone quien evalúa (el motor por fila, «Probar» con el lead de prueba). Ausente
   * = no se sabe, y la condición da «no sé».
   */
  etapasDelCron?: ReadonlyArray<EtapasDelCron> | null;
  agendo: boolean;
  pago: boolean;
  yaContactado: boolean;
  respondio: boolean;
  creadoMs: number | null;
  tieneTelefono: boolean;
  tieneEmail: boolean;
  ahoraMs: number;
  /**
   * Lo que piden las condiciones del CATÁLOGO (lib/condiciones-catalogo.ts). Cada bloque lo lee el
   * motor sólo si una fila del flujo lo pide (`fuentesDeFilas`); ausente = no se leyó, y la fila
   * que lo necesita no se cumple. «Probar» no lo necesita: sigue cada condición por el «Sí» (cuarta
   * tanda, punto 17), y la dice con el mismo `textoRama`.
   */
  catalogo?: HechosCatalogo;
};

/**
 * ¿Se cumple esta fila? Las nueve de antes, en el `switch` (lo mira el guard del lienzo:
 * tests/flujo-conversacion.test.ts); el resto, en el catálogo (`cumpleCatalogo`), con la MISMA
 * regla: un campo que no se conoce, o un dato que no se sabe, NUNCA se cumple, ni negado.
 */
export function cumpleFila(f: FilaCondicion, h: HechosLead): boolean {
  let si: boolean;
  switch (f.campo) {
    case 'etiqueta': si = h.etiquetas.has(Number(f.valor)); break;
    case 'etapa': {
      const etapa = f.funnel_id != null ? (h.etapasPorProducto?.get(Number(f.funnel_id)) ?? null) : h.etapa;
      si = etapa != null && etapa === String(f.valor ?? '');
      break;
    }
    case 'agendo': si = h.agendo; break;
    // «No pagó» con la cuota N (cuarta tanda, punto 6) decide `pagoDeFila`; sin cuota, lo de siempre.
    case 'pago': { const p = pagoDeFila(f, h); if (p == null) return false; si = p; break; }
    case 'ya_contactado': si = h.yaContactado; break;
    case 'respondio': si = h.respondio; break;
    // La misma regla que `dentroDeAntiguedad` (lib/setting-estrategia.ts): sin fecha de
    // alta no se sabe cuándo llegó, y «no sé» no es «reciente».
    case 'antiguedad': si = h.creadoMs != null && (h.ahoraMs - h.creadoMs) / 3_600_000 <= Number(f.valor); break;
    case 'tiene_telefono': si = h.tieneTelefono; break;
    case 'tiene_email': si = h.tieneEmail; break;
    // Lo del catálogo (o un campo que no se conoce, que NUNCA se cumple, ni negado).
    default: return cumpleCatalogo(f, h);
  }
  return f.no ? !si : si;
}

/**
 * Con qué se une la fila `k` a la de arriba: la suya, o el `modo` de la rama si no dice ninguna (una
 * rama de antes). La primera fila no se une a nada: se contesta lo mismo por prolijidad.
 */
export function unionDe(r: Pick<RamaCondicion, 'modo' | 'filas'>, k: number): 'y' | 'o' {
  const u = r.filas?.[k]?.union;
  if (u === 'y' || u === 'o') return u;
  return r.modo === 'cualquiera' ? 'o' : 'y';
}

/**
 * LAS FILAS DE UNA RAMA EN GRUPOS: cada «o» abre un grupo nuevo y cada «y» suma al de arriba. La rama
 * se cumple si se cumple ALGÚN grupo entero. Es la precedencia de siempre (las «y» atan más que las
 * «o»): «A y B o C» es «(A y B) o C». Lo usan la evaluación (`cumpleRama`) y lo que se mira al
 * inscribir (`antiguedadDeEntrada`): con dos lecturas de la unión, una rama mixta decidiría distinto
 * al inscribir que al pasar por la tarjeta.
 */
export function gruposDeRama(r: Pick<RamaCondicion, 'modo' | 'filas'>): FilaCondicion[][] {
  const grupos: FilaCondicion[][] = [];
  (r.filas ?? []).forEach((f, k) => {
    if (k === 0 || unionDe(r, k) === 'o') grupos.push([f]);
    else grupos[grupos.length - 1].push(f);
  });
  return grupos;
}

export function cumpleRama(r: RamaCondicion, h: HechosLead): boolean {
  const grupos = gruposDeRama(r);
  if (!grupos.length) return false;
  return grupos.some((g) => g.every((f) => cumpleFila(f, h)));
}

/** Por dónde sale una condición: la primera rama que se cumple, o «si no». */
export function elegirSalida(p: PasoGrafo, h: HechosLead): Puerto {
  for (const r of p.ramas ?? []) if (cumpleRama(r, h)) return { puerto: r.id, destino: r.siguiente ?? null };
  return { puerto: 'si_no', destino: p.si_no ?? null };
}

/**
 * El tope de antigüedad que se puede mirar AL INSCRIBIR. La condición «Llegó hace menos de
 * N h» puesta como PRIMERA tarjeta, con «si no» terminando, equivale al viejo «Solo a leads
 * recientes» — y ése se miraba también al inscribir, porque si no, prender la secuencia
 * crea una fila por cada lead de la cohorte de 30 días (medido el 17/09: 126, 66 de más de
 * 14 días), todas trabadas por el UNIQUE y contando como «inscriptos».
 *
 * Sólo si TODAS las ramas exigen la antigüedad (si una no, entra igual por esa).
 */
export function antiguedadDeEntrada(pasos: readonly PasoGrafo[]): number | null {
  // Con flechas en paralelo desde el CRON, la condición de la principal frena a SU hilo y no a
  // los otros: el lead entra igual por el hilo de al lado. Mirarla al inscribir dejaría afuera a
  // quien el otro hilo sí atiende.
  if (raicesSalida(pasos).length > 1) return null;
  const raiz = raizSalida(pasos);
  const p = nodoPorId(pasos, raiz);
  if (!p || claseDe(p) !== 'condicion' || (p.si_no ?? null) !== null) return null;
  const ramas = p.ramas ?? [];
  if (!ramas.length) return null;
  // Cada GRUPO de cada rama (`gruposDeRama`: las «o» los separan) tiene que exigir la antigüedad:
  // con un grupo que no la pide, el lead entra por ése. Una rama con «o» en el medio y `modo: 'todas'`
  // (una fila nueva con su unión) se leía como «todas» y dejaba afuera a quien entraba por la otra.
  // El máximo es conservador: deja inscribir de más, nunca de menos.
  let max = 0;
  for (const r of ramas) {
    const grupos = gruposDeRama(r);
    if (!grupos.length) return null;
    for (const g of grupos) {
      const exige = g.filter((f) => f.campo === 'antiguedad' && !f.no && Number(f.valor) > 0);
      if (!exige.length) return null;
      max = Math.max(max, ...exige.map((f) => Number(f.valor)));
    }
  }
  return max || null;
}

/**
 * Los casos de «Si responde» en la forma del clasificador de siempre
 * (`clasificarEscenario`, lib/chat-agent-handoff.ts) — así el motor nuevo usa EL MISMO
 * clasificador, probado, y no uno paralelo. `comoResponder` y `contestaSolo` salen del
 * PRIMER nodo de la rama si es un mensaje «MaKo contesta» (`tipo: 'ia'`): su `cuerpo` es la
 * guía y `revisar === false` es «sale solo».
 */
export type EscenarioDeGrafo = {
  casoId: string;
  titulo: string;
  cuando: string;
  comoResponder: string;
  contestaSolo?: boolean;
  siguiente: string | null;
  // ── AI Step v2: lo del caso que viaja en su «MaKo contesta» (`DatosCasoIA`). Ausente = lo de antes. ──
  objetivo?: string;
  ejemplos?: EjemploCaso[];
  audio?: { voz: string };
  /** @deprecated Undécima tanda: la expansión ya no lo arma. Lo sigue leyendo lib/nutricion.ts (siempre ausente). */
  hasta?: 'una';
};

/**
 * ⚠️ CON UN AI STEP, SOBRE EL FLUJO EXPANDIDO (`expandirPasoIA`, novena tanda): la guía de cada caso es
 * su `responder` con el tono, y «sale sola» es su `sola` —los dos viajan al «MaKo contesta» que arma la
 * expansión—. Se expande ACÁ ADENTRO (es idempotente) para que quien sólo pregunta por los casos —la
 * acción `clasificar` de «Probar», que recibe los pasos del lienzo— lea lo mismo que el motor. El
 * `siguiente` que devuelve es del flujo EXPANDIDO: quien recorre la rama, recorre `expandirPasoIA(pasos)`.
 */
export function escenariosDeRespuesta(pasosIn: readonly PasoGrafo[], op: { medio?: MedioAIStep } = {}): EscenarioDeGrafo[] {
  const pasos = expandirPasoIA(pasosIn, op);
  const r = nodoPorId(pasos, raizRespuesta(pasos));
  if (!r) return [];
  return (r.casos ?? []).map((c) => {
    const primero = nodoPorId(pasos, c.siguiente);
    const contesta = primero && claseDe(primero) === 'mensaje' && primero.tipo === 'ia' ? primero : null;
    return {
      casoId: c.id, titulo: c.titulo, cuando: c.cuando,
      comoResponder: contesta?.cuerpo ?? '',
      ...(contesta && contesta.revisar === false ? { contestaSolo: true } : {}),
      siguiente: c.siguiente ?? null,
      ...extrasDeCaso(contesta?.ia),
    };
  });
}

/**
 * Lo de un escenario que el redactor usa (`DatosCasoIA` → los campos opcionales del escenario), sin vacíos. Desde la
 * undécima el objetivo, la voz y los ejemplos son del AI STEP (la expansión se los pone a cada escenario) y `hasta`
 * no lo arma nadie: se sigue copiando si llega (lo lee lib/nutricion.ts), pero llega siempre ausente.
 */
export function extrasDeCaso(d: DatosCasoIA | null | undefined): Pick<EscenarioDeGrafo, 'objetivo' | 'ejemplos' | 'audio' | 'hasta'> {
  if (!d) return {};
  return {
    ...(d.objetivo ? { objetivo: d.objetivo } : {}),
    ...(d.ejemplos?.length ? { ejemplos: d.ejemplos } : {}),
    ...(d.audio ? { audio: d.audio } : {}),
    ...(d.hasta === 'una' ? { hasta: 'una' as const } : {}),
  };
}

// ── Editar (lienzo) ───────────────────────────────────────────────────────────────

/**
 * Apunta un puerto de un nodo a otro destino. Devuelve un array nuevo.
 *
 * Las flechas en paralelo: `'par:<id>'` REEMPLAZA ese elemento (con `null` lo saca), y `'par'`
 * AGREGA una al final (si la tarjeta las admite y no estaba). Una lista que queda vacía se va
 * con el campo.
 *
 * Las de un RESULTADO de una condición (cuarta tanda, punto 8): `par@<resultado>` agrega,
 * `par:<id>@<resultado>` reemplaza o saca. Un `par:<id>` sin resultado sobre una condición busca
 * la lista que lo tiene (un id cuelga de un solo lugar).
 */
export function conectarPuerto<P extends PasoGrafo>(pasos: readonly P[], id: string, puerto: string, destino: string | null): P[] {
  const pp = leerPuertoParalelo(puerto);
  return pasos.map((p, i) => {
    if (idDe(p, i) !== id) return p;
    if (pp) return conectarParalelo(p, pp, destino);
    if (puerto === 'sig') return { ...p, siguiente: destino };
    if (puerto === 'si_no') return { ...p, si_no: destino };
    if (p.ramas?.some((r) => r.id === puerto)) return { ...p, ramas: p.ramas.map((r) => (r.id === puerto ? { ...r, siguiente: destino } : r)) };
    if (p.casos?.some((c) => c.id === puerto)) return { ...p, casos: p.casos.map((c) => (c.id === puerto ? { ...c, siguiente: destino } : c)) };
    return p;
  });
}

/** Agrega (`viejo` null), reemplaza o saca (`nuevo` null) un destino de una lista. La MISMA lista si no cambia nada. */
function editarLista(actual: readonly string[], viejo: string | null, nuevo: string | null): readonly string[] {
  if (viejo == null) return !nuevo || actual.includes(nuevo) ? actual : [...actual, nuevo];
  if (!actual.includes(viejo)) return actual;
  return nuevo ? actual.map((d) => (d === viejo ? nuevo : d)) : actual.filter((d) => d !== viejo);
}

/** La lista de flechas de un campo, como array (lo que no lo es, vacío). */
const comoLista = (x: unknown): string[] => (Array.isArray(x) ? x.filter((d): d is string => typeof d === 'string') : []);

/** El puerto de una flecha en paralelo (`leerPuertoParalelo`) aplicado a UNA tarjeta. */
function conectarParalelo<P extends PasoGrafo>(p: P, pp: { destino: string | null; resultado: string | null }, destino: string | null): P {
  if (claseDe(p) === 'condicion') {
    // De un RESULTADO. Sin resultado en el puerto, el que ya tiene ese destino (borrar por la flecha).
    const res = pp.resultado ?? (pp.destino ? resultadosDe(p).find((r) => comoLista(crudoDeResultado(p, r)).includes(pp.destino!)) ?? null : null);
    if (res == null || !esResultadoDe(p, res)) return p;
    const actual = comoLista(crudoDeResultado(p, res));
    const nueva = editarLista(actual, pp.destino, destino);
    if (nueva === actual) return p;
    if (res === RESULTADO_SI_NO) {
      const q = { ...p };
      if (nueva.length) q.paralelos_si_no = [...nueva];
      else delete q.paralelos_si_no;
      return q;
    }
    return {
      ...p,
      ramas: (p.ramas ?? []).map((r) => {
        if (r.id !== res) return r;
        const q = { ...r };
        if (nueva.length) q.paralelos = [...nueva];
        else delete q.paralelos;
        return q;
      }),
    };
  }
  // Una tarjeta de una salida (o el CRON): no tiene resultados. `par@sig` es lo mismo que `par`.
  if (pp.resultado != null && pp.resultado !== 'sig') return p;
  if (pp.destino == null && !puedeTenerParalelos(p)) return p;
  const actual = comoLista(p.paralelos);
  const nueva = editarLista(actual, pp.destino, destino);
  if (nueva === actual) return p;
  const q = { ...p };
  if (nueva.length) q.paralelos = [...nueva];
  else delete q.paralelos;
  // SI CONTESTA (14/10/2026): la opción es de la FLECHA del CRON y su clave es la primera tarjeta. Insertar una
  // tarjeta en el medio de la flecha (el ＋) cambia esa tarjeta: la opción se muda con la flecha; sacar la flecha
  // se la lleva.
  if (claseDe(p) === 'inicio' && pp.destino && q.si_contesta?.[pp.destino] !== undefined) {
    const { [pp.destino]: v, ...resto } = q.si_contesta;
    const sc: Record<string, SiContesta> = destino ? { ...resto, [destino]: v } : resto;
    if (Object.keys(sc).length) q.si_contesta = sc;
    else delete q.si_contesta;
  }
  return q;
}

/**
 * Dónde se inserta:
 *   · `{ nodo, puerto }` después de un puerto de un nodo: `'sig'`, `'si_no'`, el id de una rama o
 *     de un caso, o `'par:<id>'` (el ＋ del MEDIO de una flecha en paralelo: la tarjeta nueva queda
 *     en el medio y apunta a la de antes);
 *   · `{ nodo, puerto: 'par' }` una flecha en paralelo NUEVA desde ese nodo (desde el CRON:
 *     `nodo: ID_INICIO`, exista o no el inicio todavía);
 *   · `{ nodo, puerto: 'par@<resultado>' }` una flecha en paralelo NUEVA desde un RESULTADO de una
 *     condición (cuarta tanda, punto 8), y `'par:<id>@<resultado>'` el ＋ del medio de una de ellas;
 *   · `{ inicio: true }` al principio de la salida principal.
 */
export type LugarInsercion = { nodo: string; puerto: 'sig' | 'si_no' | 'par' | `par:${string}` | `par@${string}` | (string & {}) } | { inicio: true };

/**
 * Inserta un nodo YA ARMADO (con id) en un lugar. Lo que colgaba de ese lugar pasa a
 * colgar del nodo nuevo: de su `siguiente` si es simple, o de su PRIMERA rama si es una
 * condición («si se cumple, sigue como antes»). «Si responde» no se inserta: es una raíz.
 *
 * Una flecha en paralelo NUEVA (`puerto: 'par'`) no tiene nada colgando: la tarjeta nace con su
 * `siguiente` en null. Desde el CRON sin inicio, el inicio se CREA (al final del array, con la
 * salida de hoy como principal) — salvo que no haya salida principal: ahí la tarjeta nueva PASA a
 * ser la principal y no hace falta ningún inicio (una sola raíz es un flujo de siempre).
 */
export function insertarNodo<P extends PasoGrafo>(pasos: readonly P[], lugarIn: LugarInsercion, nuevo: P): P[] {
  const base = normalizar(pasos);
  const n = normalizar([nuevo])[0];
  let lugar: LugarInsercion = lugarIn;
  const ini = indiceInicio(base);
  // Con inicio, «al principio» es su salida principal: anteponer la tarjeta en el array la
  // dejaba sin padre y al inicio apuntando a la de antes (dos raíces que nadie dibuja).
  if ('inicio' in lugar && ini >= 0) lugar = { nodo: base[ini].id!, puerto: 'sig' };
  if (!('inicio' in lugar) && lugar.puerto === 'par') {
    const desdeCron = lugar.nodo === ID_INICIO && ini < 0;
    const principal = raizSalida(base);
    if (desdeCron && !principal) {
      lugar = { inicio: true };
    } else if (desdeCron) {
      const inicio = { id: ID_INICIO, nodo: 'inicio', siguiente: principal, paralelos: [n.id!] } as unknown as P;
      return [...base, sinSalida(n), inicio];
    } else {
      const i = indicePorId(base, lugar.nodo);
      if (i < 0 || !puedeTenerParalelos(base[i])) return base;
      // Un inicio sin principal (lo dejó así un borrado): la flecha nueva ES la principal.
      if (claseDe(base[i]) === 'inicio' && base[i].siguiente == null) lugar = { nodo: lugar.nodo, puerto: 'sig' };
      else {
        const out = conectarPuerto(base, lugar.nodo, 'par', n.id!);
        out.splice(i + 1, 0, sinSalida(n));
        return out;
      }
    }
  }
  // Una flecha en paralelo NUEVA desde un RESULTADO de una condición (cuarta tanda, punto 8).
  const pp = 'inicio' in lugar ? null : leerPuertoParalelo(lugar.puerto);
  if (!('inicio' in lugar) && pp && pp.destino == null && pp.resultado != null && pp.resultado !== 'sig') {
    const i = indicePorId(base, lugar.nodo);
    // ⚠️ SIN ESTO, UN `par@x` SOBRE ALGO QUE NO ES UNA CONDICIÓN SEGUÍA AL CAMINO DE ABAJO:
    // `conectarPuerto` no conectaba nada y la tarjeta nueva quedaba igual en el array, SUELTA.
    if (i < 0 || !esResultadoDe(base[i], pp.resultado)) return base;
    const principal = puertosDe(base, i).find((pt) => pt.puerto === pp.resultado)?.destino ?? null;
    // Un resultado vacío: la flecha nueva ES su principal (como el inicio sin principal).
    if (principal == null) lugar = { nodo: lugar.nodo, puerto: pp.resultado };
    else {
      const out = conectarPuerto(base, lugar.nodo, lugar.puerto, n.id!);
      out.splice(i + 1, 0, sinSalida(n));
      return out;
    }
  }
  let antes: string | null;
  let out: P[];
  if ('inicio' in lugar) {
    antes = raizSalida(base);
    out = [n, ...base];
  } else {
    const i = indicePorId(base, lugar.nodo);
    if (i < 0) return base;
    // El ＋ del medio de una flecha en paralelo: lo de antes es su destino (también el `par:<id>` sin
    // resultado sobre una condición, que no coincide letra por letra con su puerto).
    antes = pp?.destino ?? puertosDe(base, i).find((pt) => pt.puerto === lugar.puerto)?.destino ?? null;
    out = conectarPuerto(base, lugar.nodo, lugar.puerto, n.id!);
    // ⚠️ UN PUERTO QUE ESA TARJETA NO TIENE NO CONECTA NADA, y la tarjeta nueva quedaba igual en el
    // array: SUELTA (y apuntando a `antes`, o sea con un segundo padre). No se inserta.
    if (!puertosDe(out, i).some((pt) => pt.destino === n.id)) return base;
    // El nodo nuevo va justo después de su padre en el array: el orden del array es el
    // orden de lectura (`orden`, las métricas por paso), no el del dibujo.
    out.splice(i + 1, 0, n);
  }
  const c = claseDe(n);
  return out.map((p) => {
    if (p.id !== n.id) return p;
    if (c === 'condicion' && p.ramas?.length) return { ...p, ramas: p.ramas.map((r, k) => (k === 0 ? { ...r, siguiente: antes } : r)) };
    if (c === 'respuesta' || c === 'ir_a' || c === 'condicion') return p;
    return { ...p, siguiente: antes };
  });
}

/** Una tarjeta que nace en una flecha en paralelo NUEVA: no hay nada que siga después de ella. */
function sinSalida<P extends PasoGrafo>(n: P): P {
  const c = claseDe(n);
  if (c === 'condicion' && n.ramas?.length) return { ...n, ramas: n.ramas.map((r, k) => (k === 0 ? { ...r, siguiente: null } : r)) };
  if (c === 'respuesta' || c === 'ir_a' || c === 'condicion') return n;
  return { ...n, siguiente: null };
}

/**
 * Borra un nodo. Uno SIMPLE (mensaje, acción, espera) se saca de la cadena: lo que seguía
 * pasa a colgar de su padre. Uno de VARIAS salidas (condición, «Si responde») se lleva todo
 * lo que cuelga de él —no hay una rama que tenga más derecho que otra a quedarse— y el
 * deshacer del lienzo lo devuelve. Los saltos que apuntaban a algo borrado se van también.
 *
 * ⚠️ SEXTA TANDA: CON VARIOS PADRES. Lo que seguía pasa a colgar de TODOS sus padres (con uno solo,
 * los demás quedaban apuntando a la nada), y una condición se lleva lo que cuelga SÓLO de ella: una
 * tarjeta a la que también se llega por otro lado (dos ramas que se juntan más abajo, una suelta que
 * la apunta) se queda, con el padre que le queda.
 */
export function borrarNodo<P extends PasoGrafo>(pasos: readonly P[], id: string): P[] {
  const base = normalizar(pasos);
  const i = indicePorId(base, id);
  if (i < 0) return base;
  const p = base[i];
  const c = claseDe(p);
  // El inicio es el CRON: no es una tarjeta que se borre. Sus flechas se sacan de a una.
  if (c === 'inicio') return base;
  const padres = padresDe(base, id);
  const quitar = new Set<string>([id]);
  let reemplazo: string | null = null;
  // Las flechas en paralelo que SALÍAN de la borrada: pasan a la que la reemplaza si puede
  // tenerlas; si no, se van con su subárbol (el deshacer del lienzo las devuelve).
  let heredan: string[] = [];
  if (c === 'condicion' || c === 'respuesta') for (const d of soloDe(base, id)) quitar.add(d);
  else {
    reemplazo = siguienteDe(base, i);
    const par = paralelosDe(p);
    // Sin salida principal, la PRIMERA flecha en paralelo pasa a ser la que la reemplaza.
    if (!reemplazo && par.length) { reemplazo = par[0]; heredan = par.slice(1); }
    else heredan = par;
    const r = reemplazo ? base[indicePorId(base, reemplazo)] : undefined;
    if (heredan.length && !(r && puedeTenerParalelos(r))) {
      // Se va lo que colgaba SÓLO de esas flechas: lo que también se alcanza por otro lado, o por la
      // salida que reemplaza a la borrada (dos caminos que se juntaban), se queda.
      const solo = soloDe(base, id);
      const sigue = reemplazo ? new Set([reemplazo, ...descendientes(base, reemplazo)]) : new Set<string>();
      for (const d of heredan) for (const x of [d, ...descendientes(base, d)]) if (solo.has(x) && !sigue.has(x)) quitar.add(x);
      heredan = [];
    }
  }
  // Un salto a algo que se borra no tiene a dónde ir: se borra con él (y lo que colgara de
  // él, que no puede ser nada: un `ir_a` no tiene salidas).
  for (const q of base) if (claseDe(q) === 'ir_a' && q.destino && 'nodo' in q.destino && quitar.has(q.destino.nodo)) quitar.add(q.id!);
  let out = base.filter((q) => !quitar.has(q.id!));
  // Si colgaba de una flecha en paralelo (`par:<id>`), el padre se reconecta POR ESA flecha:
  // `conectarPuerto` reemplaza el elemento (o lo saca, si no queda nada). Cada padre, por la suya.
  for (const padre of padres) if (!quitar.has(padre.id)) out = conectarPuerto(out, padre.id, padre.puerto, reemplazo);
  if (reemplazo && heredan.length) for (const d of heredan) out = conectarPuerto(out, reemplazo, 'par', d);
  // Un salto borrado deja a su padre apuntando a la nada: se corta ahí.
  for (const q of base) {
    if (q.id === id || !quitar.has(q.id!)) continue;
    for (const pa of padresDe(base, q.id!)) if (!quitar.has(pa.id) && pa.id !== id) out = conectarPuerto(out, pa.id, pa.puerto, null);
  }
  // Un inicio que se quedó sin principal y con paralelos promueve el primero (lo mismo que hace
  // `normalizar` al guardar; acá para que el lienzo lo dibuje igual que lo que se va a guardar).
  const ini = indiceInicio(out);
  if (ini >= 0 && out[ini].siguiente == null) {
    const par = paralelosDe(out[ini]);
    if (par.length) {
      out = conectarPuerto(out, out[ini].id!, `par:${par[0]}`, null);
      out = conectarPuerto(out, out[ini].id!, 'sig', par[0]);
    }
  }
  // Y lo mismo con un RESULTADO de una condición (cuarta tanda, punto 8): borrar la principal del
  // «Si no» que tenía un email en paralelo deja al email como su principal, no una fila vacía con
  // una flecha punteada saliendo.
  return out.map((q) => (claseDe(q) === 'condicion' ? promoverResultados(q) : q));
}

/**
 * Lo que cuelga SÓLO de `id`: sus descendientes a los que no se llega sin pasar por él. Se arranca de TODO lo que no tiene padre —el CRON, «Si responde» y las
 * sueltas— y de la raíz de la salida. Con un solo padre por tarjeta era lo mismo que `descendientes`.
 */
function soloDe(pasos: readonly PasoGrafo[], id: string): Set<string> {
  const bloqueado = new Set([id]);
  const ap = apuntados(pasos);
  const entradas = [...raicesSalida(pasos), raizRespuesta(pasos), ...pasos.map((p, i) => idDe(p, i)).filter((x) => !ap.has(x))];
  const llega = new Set<string>();
  const pila = entradas.filter((x): x is string => !!x && !bloqueado.has(x));
  while (pila.length) {
    const cur = pila.pop()!;
    if (llega.has(cur)) continue;
    llega.add(cur);
    const i = indicePorId(pasos, cur);
    if (i < 0) continue;
    for (const pt of puertosDe(pasos, i)) if (pt.destino && !bloqueado.has(pt.destino) && !llega.has(pt.destino)) pila.push(pt.destino);
  }
  const out = new Set<string>();
  for (const d of descendientes(pasos, id)) if (!llega.has(d)) out.add(d);
  return out;
}

/** Los resultados de una condición sin principal y con flechas en paralelo promueven la primera (`salidaLimpia`). */
function promoverResultados<P extends PasoGrafo>(q: P): P {
  let out = q;
  const ramas = q.ramas ?? [];
  if (ramas.some((r) => r.siguiente == null && listaLimpia(r.paralelos).length)) {
    out = {
      ...out,
      ramas: ramas.map((r) => {
        if (r.siguiente != null) return r;
        const s = salidaLimpia(null, r.paralelos, q.id ?? '');
        const x: RamaCondicion = { ...r, siguiente: s.principal };
        if (s.paralelos.length) x.paralelos = s.paralelos;
        else delete x.paralelos;
        return x;
      }),
    };
  }
  if (q.si_no == null && listaLimpia(q.paralelos_si_no).length) {
    const s = salidaLimpia(null, q.paralelos_si_no, q.id ?? '');
    out = { ...out, si_no: s.principal };
    if (s.paralelos.length) out.paralelos_si_no = s.paralelos;
    else delete out.paralelos_si_no;
  }
  return out;
}

// ── SEXTA TANDA: el CRON como dato ───────────────────────────────────────────────────────────
// Las ediciones de flechas del lienzo (arrastrar el «+», la papelera de una flecha, la tarjeta suelta
// del click derecho) viven en UNA puerta: lib/flujo-edicion.ts, que arranca cada una con esto. Hasta
// la segunda pasada de la sexta tanda había acá una segunda implementación (`conectar`,
// `desconectar`, `crearSuelta`, `destinosConectables`) sin un solo call site: se fue.

/**
 * FIJA LA RAÍZ: si la automatización no tiene el nodo `inicio` (el CRON), lo crea al FINAL del array
 * apuntando a la raíz de hoy (`raizSalida`). Con inicio, el mismo contenido.
 *
 * ⚠️ POR QUÉ ANTES DE TODA EDICIÓN DE FLECHAS. Sin inicio, la raíz es «la primera tarjeta que nadie
 * apunta». Con tarjetas sueltas eso deja de alcanzar: conectar una suelta a la primera tarjeta la deja
 * apuntada, y la raíz pasaba a ser la SUELTA —el CRON le escribía al lead lo que la persona dejó a un
 * costado—; y borrar la flecha del CRON no se podía decir (el CRON no es una tarjeta). Con el inicio
 * la flecha del CRON es un dato: se conecta, se borra y no se corre sola. Al final del array para no
 * correr el índice de nadie (`paso_actual`). Hace al flujo «de tarjetas» (`esFlujoExplicito`), que es
 * lo que es un flujo con sueltas o con flechas que se juntan: una lista ya no.
 */
export function fijarRaiz<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  if (indiceInicio(pasos) >= 0 || pasos.some((p, i) => idDe(p, i) === ID_INICIO)) return [...pasos];
  return [...pasos, { id: ID_INICIO, nodo: 'inicio', siguiente: raizSalida(pasos) } as unknown as P];
}

// ── «Si responde» es una CONDITION (sexta tanda, punto 12) ─────────────────────────────────────
// Pedido literal: «Reply ya te dije que tiene que estar dentro de CONDITION». El dato y el motor NO
// cambian (el nodo `respuesta`, sus `casos` y `responderConGrafo`): así lo que hacen en vivo #212 y
// #213 —los mismos casos, «contesta solo» o borrador, la charla de 7 días y el hand-off— es lo mismo.
// Cambia cómo se DIBUJA y cómo se EDITA: una tarjeta CONDITION cuyas filas son de la familia
// «Respuesta» del catálogo («Su respuesta trata de «Pregunta el precio»») y cuyo «Si no» es lo que
// antes era «Otra cosa». Es una condición que se evalúa cuando el lead ESCRIBE, no cuando la salida
// pasa por ahí: por eso no tiene flecha de entrada EN EL DATO. (En el DIBUJO sí, desde la séptima
// tanda: la cuelga del CRON una flecha «Si responde», `grafoDeSecuencia` en lib/flujo-conversacion.ts;
// sin ella se veía como una condición suelta.) El porqué de no convertir los datos, en
// docs/chatbot-flujo-ramas-diseno.md → «SEXTA TANDA, parte modelo».

/** El rótulo de una fila de la condición de respuesta (el mismo que el catálogo: `respuesta_trata_de`). */
export const ROTULO_RESPUESTA = 'Su respuesta trata de';

/** ¿Es la condición que escucha las respuestas? (El nodo de siempre de «Si responde».) */
export const esCondicionDeRespuesta = (p: PasoGrafo | null | undefined): boolean => !!p && claseDe(p) === 'respuesta';

/** La fila de un caso, como la dice la tarjeta: «Su respuesta trata de «Pregunta el precio»». */
export function textoCasoRespuesta(c: Pick<CasoRespuesta, 'titulo'>): string {
  const t = c.titulo?.trim();
  return t ? `${ROTULO_RESPUESTA} «${t}»` : `${ROTULO_RESPUESTA}…`;
}

/** La salida de la condición que escucha cuando NO tiene casos: toda respuesta va por ahí. */
export const ROTULO_RESPONDIO = 'Respondió';

/**
 * LA ÚLTIMA FILA DE LA CONDICIÓN QUE ESCUCHA, como la dicen la tarjeta y su editor (séptima tanda,
 * 10/10/2026). Con casos es «Si no»: lo que no encajó en ninguno (lo que antes era «Otra cosa»). SIN
 * casos es la ÚNICA salida —el motor manda por ahí TODA respuesta (`responderConGrafo`: sin caso,
 * `si_no`)—, y «Si no» solo, sin un «Sí» arriba, se leía como una condición a medio armar. Medido con
 * la #198 del ws1 (la captura de Martín: «hay una condición suelta que no esta conectado a nada»):
 * cero casos, una fila «Si no» que lleva a «Te escribió algo que no sé contestar».
 */
export function rotuloSiNoDeRespuesta(p: { readonly casos?: readonly unknown[] | null; readonly paso_ia?: boolean } | null | undefined): string {
  // El AI Step lo dice como lo dibuja: «Otra cosa → te aviso» (novena tanda). Lo lee «Probar» al caer ahí.
  if (p?.paso_ia === true) return ROTULO_OTRA_COSA;
  return p?.casos?.length ? 'Si no' : ROTULO_RESPONDIO;
}

/**
 * UNA CONDITION QUE PASA A ESCUCHAR LAS RESPUESTAS: cuando en una condición VACÍA (sin ninguna fila
 * elegida) se elige «Su respuesta trata de», la tarjeta pasa a ser la condición de respuesta (el nodo
 * `respuesta`, con su primer caso y su «MaKo contesta», y el «Si no» avisando al equipo como el
 * hand-off de siempre si no tenía nada). Es la única forma de crear una para lo nuevo.
 *
 * Como escucha cuando el lead escribe, NO TIENE FLECHA DE ENTRADA: lo que la apuntaba pasa a ir a lo
 * que seguía en su primera rama (la condición insertada en el medio de una flecha devuelve esa flecha
 * como estaba). Las demás ramas pasan a ser casos con lo que ya colgaba de ellas.
 *
 * `{ error }` si ya hay una (una por automatización), si la condición ya tiene filas o flechas en
 * paralelo (no se convierte lo que ya decide algo), o si no es una condición. `ids`: los de lo nuevo.
 */
export function condicionARespuesta<P extends PasoGrafo>(
  pasosIn: readonly P[], condId: string, rnd: () => number = Math.random,
): { pasos: P[]; ids: { caso: string; mensaje: string; otraCosa: string | null } } | { error: string } {
  const base = normalizar(pasosIn);
  const i = indicePorId(base, condId);
  const c = i >= 0 ? base[i] : null;
  if (!c || claseDe(c) !== 'condicion') return { error: 'No es una condición' };
  if (raizRespuesta(base)) return { error: 'Ya hay una condición que escucha las respuestas' };
  const ramas = c.ramas ?? [];
  if (ramas.some((r) => (r.filas?.length ?? 0) > 0)) return { error: 'La condición ya tiene filas' };
  if (todosLosParalelos(c).length) return { error: 'La condición saca flechas en paralelo' };
  const relleno = { canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null };
  const vuelve = ramas[0]?.siguiente ?? null;
  // Lo que la apuntaba sigue en lo que seguía (`fijarRaiz` antes: si era la primera, el CRON también).
  let out = fijarRaiz(base);
  for (const pa of padresDe(out, condId)) out = conectarPuerto(out, pa.id, pa.puerto, vuelve);
  const mensajeId = nuevoId(out, rnd);
  const mensaje = { ...relleno, proveedor: 'no_oficial', id: mensajeId, tipo: 'ia', revisar: true, siguiente: null } as unknown as P;
  out = [...out, mensaje];
  let otraCosa: string | null = null;
  if (c.si_no == null) {
    otraCosa = nuevoId(out, rnd);
    out = [...out, { ...relleno, id: otraCosa, accion: { operacion: OP_AVISO_EQUIPO, params: { leadId: LEAD_EVENTO, mensaje: AVISO_OTRA_COSA } }, siguiente: null } as unknown as P];
  }
  const casoId = ramas[0]?.id || nuevoId(out, rnd);
  const casos: CasoRespuesta[] = [
    { id: casoId, titulo: '', cuando: '', siguiente: mensajeId },
    ...ramas.slice(1).map((r) => ({ id: r.id, titulo: '', cuando: '', siguiente: r.siguiente ?? null })),
  ];
  out = out.map((p) => {
    if (p.id !== condId) return p;
    const q = { ...p, nodo: 'respuesta', casos, si_no: c.si_no ?? otraCosa } as P;
    delete (q as PasoGrafo).ramas;
    delete (q as PasoGrafo).paralelos_si_no;
    delete (q as PasoGrafo).siguiente;
    return q;
  });
  return { pasos: normalizar(out), ids: { caso: casoId, mensaje: mensajeId, otraCosa } };
}

// ── EL AI STEP (novena tanda): la forma COMPACTA y su EXPANSIÓN ─────────────────────────────────
// El porqué entero, en la cabecera de este archivo («NOVENA TANDA: EL AI STEP»).

/**
 * La operación del aviso al grupo del negocio. Es el MISMO literal que `OP_AVISAR` (lib/flujo-legado.ts),
 * que no se importa: flujo-legado importa este módulo, y este módulo no importa a nadie del flujo
 * (el ciclo no existe en runtime y así sigue). tests/automations-paso-ia.test.ts fija que sean iguales.
 */
export const OP_AVISO_EQUIPO = 'avisar_al_equipo';
/** El lead del EVENTO en los params de una acción del flujo: el mismo literal que `LEAD_DEL_EVENTO` (lib/api-mako/flujo-params.ts). */
const LEAD_EVENTO = 'evento';
/** El aviso de «Otra cosa» si nadie escribió otro: el hand-off de siempre («MaKo se calla y te avisa»). */
export const AVISO_OTRA_COSA = 'Te escribió algo que no sé contestar';
/** La última fila de un AI Step: lo que no encajó en ningún caso. */
export const ROTULO_OTRA_COSA = 'Otra cosa';
/**
 * El MENSAJE del aviso de un caso con «Avisarme»; el TÍTULO del aviso es el del caso, y el motor le suma lo
 * que escribió el lead (`respuesta`, `LLENA_EL_FLUJO`). No dice si MaKo contestó: el aviso corre después
 * del redactor, pero no sabe si su borrador salió (AGENTS.md: un mensaje que sale solo no afirma lo que no
 * verificó). Eso ya lo dice el aviso del redactor (`wa-mensaje-entrante`).
 */
export const AVISO_DE_CASO = 'Te escribió sobre esto.';

/** Los topes de lo que se escribe en un AI Step (el saneo de `setSecuenciaPasos` los aplica). */
export const TOPE_RESPONDER = 2000;
export const TOPE_INSTRUCCIONES = 1000;
export const TOPE_OTRA_AVISO = 1000;
// AI Step v2 (décima tanda, docs/diseno-ai-step-v2.md §1).
export const TOPE_OBJETIVO = 300;
export const TOPE_EJEMPLOS = 6;
export const TOPE_EJEMPLO = 500;
/**
 * Cuántas tarjetas AI Step por medio en una automatización. UNDÉCIMA TANDA: UNA (Martín: «Toda la cantidad de
 * tarjetas de "AI Step" deberían ser una sola... Si justamente es el mismo objetivo, solo son diferentes objeciones
 * o escenarios»). En la décima eran 10, una por caso; lo guardado así lo junta `juntarPasosIA`.
 */
export const TOPE_AI_STEP_POR_MEDIO = 1;
/** Cuántos escenarios lleva un AI Step, sin contar «Lo demás» (undécima tanda, decisión §9.16). */
export const TOPE_ESCENARIOS_AI_STEP = 10;
/** El nombre de un caso: lo que muestra la tarjeta en negrita y el título del aviso. */
export const TOPE_TITULO_CASO = 40;

/** Cómo se nombra cada medio en una frase («un AI Step de WhatsApp»). */
export const ROTULO_MEDIO: Readonly<Record<MedioAIStep, string>> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
/** El nombre con el que la décima creaba el caso `cualquiera` (lo de antes lo sigue diciendo). */
export const ROTULO_CUALQUIERA = 'Cualquier respuesta';
/** La última fila de los escenarios (undécima tanda): el caso `cualquiera`, o sin él «Sólo te avisa». */
export const ROTULO_LO_DEMAS = 'Lo demás';

/**
 * LOS IDS DE LA EXPANSIÓN, derivados del nodo y del caso: DETERMINÍSTICOS (expandir dos veces, o el
 * motor y «Probar», dan las mismas tarjetas) y con `~`, que no entra en un id guardado (`[A-Za-z0-9_-]`):
 * nunca chocan con una tarjeta de verdad. El motor los deja en `nutricion_envios.nodo_id` y en la clave del
 * reclamo de la acción (una vez por respuesta), así que también tienen que ser ESTABLES entre corridas.
 * Desde v2 el nodo es la TARJETA de cada caso (la primera conserva los suyos: los de antes no cambian).
 */
export const idRespuestaDeCaso = (nodo: string, caso: string): string => `${nodo}~${caso}~r`;
export const idAvisoDeCaso = (nodo: string, caso: string): string => `${nodo}~${caso}~a`;
export const idOtraCosa = (nodo: string): string => `${nodo}~otra`;

/**
 * LA GUÍA CON LA QUE EL REDACTOR CONTESTA UN CASO: su `responder`, con el tono general arriba. '' = el
 * caso no contesta (aunque haya tono: el tono no es una respuesta). Va al bloque «CÓMO RESPONDER» del
 * redactor (`bloqueEscenario`, lib/setter-conversacion.ts).
 */
export function guiaDeCaso(p: Pick<PasoGrafo, 'instrucciones'>, c: Pick<CasoRespuesta, 'responder'>): string {
  const r = (c.responder ?? '').trim();
  if (!r) return '';
  const tono = (p.instrucciones ?? '').trim();
  return tono ? `${ROTULO_TONO}${tono}\n${r}` : r;
}
const ROTULO_TONO = 'Tono: ';

/**
 * El LARGO MÁXIMO de `guiaDeCaso` con los topes del saneo: el rótulo, el tono, el salto y la respuesta.
 * Es el tope de lo que «Probar» le pasa al redactor (`responder`, app/api/chat-agent/simulador): cortaba
 * en 2000, y con un tono de 1000 y una respuesta de 2000 (3007) perdía el FINAL —la respuesta del caso,
 * que va después del tono—, así que contestaba distinto que el motor, que no recorta (revisión de la
 * novena tanda).
 */
export const TOPE_GUIA = ROTULO_TONO.length + TOPE_INSTRUCCIONES + 1 + TOPE_RESPONDER;

/**
 * ¿LA AUTOMATIZACIÓN CONTESTA POR ESTE MEDIO? Con AI Step v2, una que sólo tiene AI Step de Instagram no
 * contesta un WhatsApp (§1): la pregunta se hace sobre la EXPANSIÓN del medio, no sobre lo guardado. Un
 * «Si responde» de los de siempre escucha por WhatsApp, como siempre.
 */
export function escuchaPor(pasos: readonly PasoGrafo[], medio: MedioAIStep = 'whatsapp'): boolean {
  return raizRespuesta(expandirPasoIA(pasos, { medio })) != null;
}

/**
 * ¿SE PUEDE SUMAR UN AI STEP de este medio? No si hay un «Si responde» de los de siempre (no se mezclan) ni si el
 * medio ya tiene uno (UNDÉCIMA TANDA: `TOPE_AI_STEP_POR_MEDIO` = 1; cuenta también uno suelto). La misma regla que
 * Publicar: ofrecerla sería una tarjeta que no se publica. La leen el ＋ y el click derecho
 * (lib/flujo-conversacion.ts) y las ediciones (lib/flujo-edicion.ts: crear, duplicar, conectar).
 */
export function puedeSumarAIStep(pasos: readonly PasoGrafo[], medio: MedioAIStep = 'whatsapp'): boolean {
  if (pasos.some((p) => p && claseDe(p) === 'respuesta' && !esPasoIA(p))) return false;
  return pasos.filter((p) => p && esPasoIA(p) && medioDe(p) === medio).length < TOPE_AI_STEP_POR_MEDIO;
}

// (`contestaElCaso` —¿este caso CONTESTA?— vive en lib/ai-step-libertad.ts desde la undécima, con la libertad que
// lee: este módulo la re-exporta arriba.)

/** Los campos que todo paso tiene (lo de `RELLENO_CONTROL` del motor), para las tarjetas de la expansión. */
const RELLENO_EXPANSION = { canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null } as const;

/** Una acción «avisar al equipo» sobre el lead del evento, como la arma `condicionARespuesta`. */
function avisoAlEquipo<P extends PasoGrafo>(id: string, params: { titulo?: string; mensaje: string }): P {
  const titulo = (params.titulo ?? '').trim().slice(0, 120);
  return {
    ...RELLENO_EXPANSION, id, siguiente: null,
    accion: { operacion: OP_AVISO_EQUIPO, params: { leadId: LEAD_EVENTO, ...(titulo ? { titulo } : {}), mensaje: params.mensaje } },
  } as unknown as P;
}

/**
 * Lo que viaja del escenario a su «MaKo contesta» (`DatosCasoIA`). UNDÉCIMA TANDA: el objetivo, los ejemplos y la
 * voz son del AI STEP (`nodo`); sin valor en el nodo, el del caso (lo de antes sin juntar, para que el motor lo
 * siga contestando igual hasta que se guarde). La voz, sólo por WhatsApp (§5). `hasta` ya no viaja: «Hasta» es
 * siempre el objetivo.
 */
function datosDeCaso(c: CasoRespuesta, medio: MedioAIStep, nodo: Pick<PasoGrafo, 'objetivo' | 'audio' | 'ejemplos'>): DatosCasoIA {
  const objetivo = (nodo.objetivo ?? '').trim() || (c.objetivo ?? '').trim();
  const ejemplos = nodo.ejemplos?.length ? nodo.ejemplos : c.ejemplos;
  const audio = nodo.audio ?? c.audio;
  return {
    titulo: c.titulo, cuando: c.cuando, medio,
    ...(objetivo ? { objetivo } : {}),
    ...(ejemplos?.length ? { ejemplos } : {}),
    ...(audio && medio === 'whatsapp' ? { audio } : {}),
  };
}

/** Lo que sólo significa en un AI Step: fuera de la expansión no viaja (el nodo expandido es un «Si responde»). */
function sinLoDelAIStep<P extends PasoGrafo>(q: P): P {
  delete q.paso_ia;
  delete q.instrucciones;
  delete q.otra_aviso;
  delete q.objetivo;
  delete q.audio;
  delete q.ejemplos;
  return q;
}

/** Un AI Step que ya no escucha en la expansión: en su índice, sin casos y suelto (inerte para todos). */
function inerte<P extends PasoGrafo>(p: P): P {
  return sinLoDelAIStep({ ...p, casos: [], si_no: null, suelta: true } as P);
}

/**
 * EL FLUJO CON LOS AI STEP DE UN MEDIO EXPANDIDOS A UN «SI RESPONDE» de los de siempre (AI Step v2,
 * docs/diseno-ai-step-v2.md §1). PURA e IDEMPOTENTE: lo expandido ya no tiene `paso_ia`, así que expandirlo
 * otra vez no hace nada. Un flujo sin AI Step vuelve igual (una copia del array).
 *
 *   · Junta los AI Step NO sueltos del `medio` (ausente = WhatsApp) en el PRIMERO del array, con un caso
 *     por caso de cada tarjeta (lo de la décima, una tarjeta por caso, se sigue leyendo igual hasta que se
 *     guarde junto: `juntarPasosIA`). Los demás AI Step —los del medio que se juntaron, los de otro medio y los
 *     sueltos— quedan EN SU ÍNDICE, sin casos y sueltos (`inerte`): `raizRespuesta` los saltea. NO se sacan
 *     del array: `responderConGrafo` escribe `paso_actual` con el índice EXPANDIDO al retomar con «Ir a».
 *     Sin AI Step del medio, no queda ninguno que escuche: la automatización no contesta por ahí.
 *   · Por cada caso, al FINAL del array (no corre el índice de nadie), con ids de SU tarjeta:
 *       – si contesta (`contestaElCaso`): un mensaje de WhatsApp no oficial `tipo: 'ia'` —el «MaKo
 *         contesta» de siempre— con la guía de cuerpo, `revisar = !sola` y `ia` (lo que el redactor usa: el
 *         objetivo, la voz y los ejemplos del AI Step, `datosDeCaso`);
 *       – si avisa (UNDÉCIMA: se DERIVA de la libertad, `avisaElCaso`: todo lo que no sale solo): una acción
 *         «avisar al equipo» con el título del caso, DESPUÉS del mensaje (o sola).
 *   · `cualquiera` («Lo demás») NO es un caso del clasificador: es el destino de «Otra cosa» (`si_no`). Sin uno,
 *     «Otra cosa» es el aviso de siempre (`AVISO_OTRA_COSA`, o el `otra_aviso` de lo de antes) y la charla pasa a
 *     una persona.
 *
 * Lo que la lee: el motor (`responderConGrafo`, lib/nutricion.ts), «Probar» (lib/simulador-grafo.ts) y
 * `escenariosDeRespuesta`. NUNCA lo que se GUARDA ni lo que se DIBUJA: eso es la forma compacta.
 */
export function expandirPasoIA<P extends PasoGrafo>(pasos: readonly P[], op: { medio?: MedioAIStep } = {}): P[] {
  if (!pasos.some((p) => esPasoIA(p))) return [...pasos];
  const medio = op.medio ?? 'whatsapp';
  const delMedio = pasos.map((p, i) => i).filter((i) => esPasoIA(pasos[i]) && pasos[i].suelta !== true && medioDe(pasos[i]) === medio);
  const extra: P[] = [];
  const casos: CasoRespuesta[] = [];
  const usados = new Set<string>();
  let siNo: string | null | undefined;
  let otraAviso = '';
  for (const i of delMedio) {
    const p = pasos[i];
    const tarjeta = idDe(p, i);
    if (!otraAviso) otraAviso = (p.otra_aviso ?? '').trim().slice(0, TOPE_OTRA_AVISO);
    // El id de cada caso, como lo pone `normalizar` (si falta, o si se repite): el clasificador devuelve
    // ESTE id, y de él salen las tarjetas del caso. Un flujo sin normalizar (los pasos del lienzo que
    // llegan a «Probar») nombra igual que uno guardado.
    const idsCasos = idsDeCasos(tarjeta, p.casos ?? []);
    (p.casos ?? []).forEach((c, k) => {
      const id = idsCasos[k];
      const guia = contestaElCaso(c) ? guiaDeCaso(p, c) : '';
      const contesta = guia ? idRespuestaDeCaso(tarjeta, id) : null;
      const aviso = avisaElCaso(c) ? idAvisoDeCaso(tarjeta, id) : null;
      if (contesta) {
        extra.push({
          ...RELLENO_EXPANSION, proveedor: 'no_oficial', id: contesta, tipo: 'ia', cuerpo: guia,
          revisar: c.sola !== true, siguiente: aviso, ia: datosDeCaso(c, medio, p),
        } as unknown as P);
      }
      // El aviso de un «Lo demás» que NO contesta dice lo que es: algo que MaKo no sabe contestar.
      const mensaje = c.cualquiera === true && !contesta ? (otraAviso || AVISO_OTRA_COSA) : AVISO_DE_CASO;
      if (aviso) extra.push(avisoAlEquipo<P>(aviso, { titulo: c.titulo, mensaje }));
      const destino = contesta ?? aviso;
      if (c.cualquiera === true) {
        // El primero gana (Publicar no deja dos: `erroresDelPasoIA`).
        if (siNo === undefined) siNo = destino;
        return;
      }
      // Dos tarjetas con el mismo id de caso (sólo por la API): el segundo se desempata como `idsDeCasos`.
      let unico = id;
      for (let n = 2; usados.has(unico); n++) unico = `${id}_${n}`;
      usados.add(unico);
      casos.push({ id: unico, titulo: c.titulo, cuando: c.cuando, siguiente: destino });
    });
  }
  const primero = delMedio[0] ?? -1;
  if (primero >= 0 && siNo === undefined) {
    const otra = idOtraCosa(idDe(pasos[primero], primero));
    extra.push(avisoAlEquipo<P>(otra, { mensaje: otraAviso || AVISO_OTRA_COSA }));
    siNo = otra;
  }
  const out = pasos.map((p, i) => {
    if (!esPasoIA(p)) return p;
    if (i !== primero) return inerte(p);
    return sinLoDelAIStep({ ...p, casos, si_no: siNo ?? null });
  });
  return [...out, ...extra];
}

/**
 * Lo que impide guardar o publicar UN AI Step, en su forma COMPACTA (lo de todo el flujo —uno por medio, no
 * mezclado con un «Si responde»— lo mira `erroresDeForma`). Los motivos nombran la tarjeta por su id («la tarjeta
 * X», que `errorLegible` vuelve «AI STEP» y `tarjetaDelError` abre) y el escenario por su nombre: son cortos
 * porque van al lado de Publicar (el porqué, acá).
 *   · Al guardar: un caso con `siguiente` o un «Otra cosa» con flecha. En un AI Step lo de debajo va
 *     ADENTRO del caso; una tarjeta colgada la pisaría la expansión, y el lead recibiría otra cosa que
 *     lo que se dibuja. Lo escribe sólo quien arma `pasos` a mano (la API); el lienzo no lo ofrece.
 *   · Al publicar (UNDÉCIMA TANDA, docs/diseno-undecima-tanda.md §6):
 *       – el OBJETIVO (Martín: «El "Hasta" siempre es atado al objetivo»: sin objetivo no hay hasta dónde);
 *       – hasta `TOPE_ESCENARIOS_AI_STEP` escenarios y UN «Lo demás» (con dos, la expansión toma el primero);
 *       – cada escenario con nombre y «cuándo» (lo que lee el clasificador); «Lo demás» no los necesita;
 *       – nombres que NO se repiten: el clasificador elige por POSICIÓN en una lista «título — cuándo»
 *         (lib/chat-agent-handoff.ts), y dos iguales se leen como el mismo;
 *       – una libertad que el escenario puede tener (`libertadesPermitidas`: nunca «Sola» con plata ni en «Lo
 *         demás»): la que la pantalla deshabilita, Publicar no la deja pasar desde la API;
 *       – la voz, sólo por WhatsApp.
 *     Se fue «tiene más de un caso» (era la forma de la décima) y «no contesta ni avisa» (un escenario sin
 *     respuesta es «Sólo te avisa»).
 */
export function erroresDelPasoIA(p: PasoGrafo, id: string, publicar: boolean): string[] {
  const err: string[] = [];
  const casos = p.casos ?? [];
  if (casos.some((x) => x.siguiente) || p.si_no) err.push(`debajo de la tarjeta ${id} no van tarjetas`);
  if (!publicar) return err;
  if (!(p.objetivo ?? '').trim()) err.push(`falta el objetivo de la tarjeta ${id}`);
  const escenarios = casos.filter((x) => x.cualquiera !== true);
  if (escenarios.length > TOPE_ESCENARIOS_AI_STEP) err.push(`la tarjeta ${id} tiene más de ${TOPE_ESCENARIOS_AI_STEP} escenarios`);
  if (casos.length - escenarios.length > 1) err.push(`la tarjeta ${id} tiene dos «${ROTULO_LO_DEMAS}»`);
  const vistos = new Set<string>();
  for (const x of casos) {
    const t = (x.titulo ?? '').trim();
    const falta = faltaEnCaso(x);
    if (falta === 'nombre') err.push(`la tarjeta ${id} tiene un escenario sin nombre`);
    else if (falta === 'cuando') err.push(`en la tarjeta ${id}, «${t}» no dice cuándo`);
    if (t && x.cualquiera !== true) {
      const k = t.toLowerCase();
      if (vistos.has(k)) err.push(`en la tarjeta ${id}, «${t}» está dos veces`);
      vistos.add(k);
    }
    if (!libertadesPermitidas(x).includes(libertadDeCaso(x))) err.push(`en la tarjeta ${id}, «${x.cualquiera === true ? ROTULO_LO_DEMAS : t}» no puede salir sola`);
    if (x.audio && medioDe(p) !== 'whatsapp') err.push(`en la tarjeta ${id}, el audio sale sólo por WhatsApp`);
  }
  if (p.audio && medioDe(p) !== 'whatsapp') err.push(`en la tarjeta ${id}, el audio sale sólo por WhatsApp`);
  return [...new Set(err)];
}

/**
 * LO PRIMERO QUE LE FALTA A UN ESCENARIO DE UN AI STEP para publicar, o null. UNA función para el freno de
 * Publicar (`erroresDelPasoIA`) y para lo que se marca en rojo en la tarjeta y en su editor: con dos copias, la
 * tarjeta diría «completo» de algo que Publicar frena. «Lo demás» (`cualquiera`) no necesita nombre ni «cuándo».
 * UNDÉCIMA TANDA: ya no puede faltar «qué hace» (un escenario sin respuesta es «Sólo te avisa»).
 */
export function faltaEnCaso(c: Pick<CasoRespuesta, 'titulo' | 'cuando' | 'cualquiera'>): 'nombre' | 'cuando' | null {
  if (c.cualquiera === true) return null;
  if (!(c.titulo ?? '').trim()) return 'nombre';
  if (!(c.cuando ?? '').trim()) return 'cuando';
  return null;
}

// ── juntarPasosIA: LA PUERTA PARA LO VIEJO (undécima tanda) ─────────────────────────────────────────

/** Lo que devuelve `juntarPasosIA`. */
export type JuntaPasosIA<P> = {
  pasos: P[];
  /** Hubo algo que juntar, subir, plegar o sacar (quien guarda renumera `orden`). */
  cambio: boolean;
  /** Valores DISTINTOS de lo que sube al AI Step (objetivo, voz, ejemplos): quedó el primero. */
  conflictos: string[];
  /** Lo que se fue y cambia lo que pasa («una respuesta», el aviso de una «Sola», el texto de «Otra cosa», un tono que no entra…). */
  perdidos: string[];
};

/** JSON con las claves ordenadas: dos valores iguales dan el mismo texto aunque las claves vengan en otro orden. */
function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
    : x)) ?? '';
}

/** Un escenario sin lo que la undécima sacó del caso (lo lee sólo `juntarPasosIA`). */
function sinCamposViejos(c: CasoRespuesta): CasoRespuesta {
  const { objetivo: _o, audio: _a, ejemplos: _e, hasta: _h, avisar: _v, ...resto } = c;
  void _o; void _a; void _e; void _h; void _v;
  return resto;
}

/**
 * TODA FLECHA QUE IBA A UNA TARJETA QUITADA va a la que queda (`mapa`: quitada → la que queda): `siguiente`, las
 * flechas en paralelo, las ramas, «Si no», los casos y el destino de un «Ir a». Lo que no cambia queda el MISMO
 * objeto. A un AI Step no le llega ninguna flecha (Publicar lo frena), pero una que llegara a una quitada quedaría
 * colgando de una tarjeta que no existe: así sigue diciendo el mismo error, y no otro.
 */
function reapuntarFlechas<P extends PasoGrafo>(pasos: readonly P[], mapa: ReadonlyMap<string, string>): P[] {
  if (!mapa.size) return [...pasos];
  const a = (d: string | null | undefined): string | null | undefined => (d != null && mapa.has(d) ? mapa.get(d)! : d);
  const toca = (d: string | null | undefined): boolean => d != null && mapa.has(d);
  const lista = (l: readonly string[], propio: string): string[] => [...new Set(l.map((d) => a(d) ?? d))].filter((d) => d !== propio);
  return pasos.map((p, i) => {
    const propio = idDe(p, i);
    let q: P | null = null;
    const copia = (): P => (q ??= { ...p });
    if (toca(p.siguiente)) copia().siguiente = a(p.siguiente) ?? null;
    if (Array.isArray(p.paralelos) && p.paralelos.some(toca)) copia().paralelos = lista(p.paralelos, propio);
    if (toca(p.si_no)) copia().si_no = a(p.si_no) ?? null;
    if (Array.isArray(p.paralelos_si_no) && p.paralelos_si_no.some(toca)) copia().paralelos_si_no = lista(p.paralelos_si_no, propio);
    if (p.ramas?.some((r) => toca(r.siguiente) || (Array.isArray(r.paralelos) && r.paralelos.some(toca)))) {
      copia().ramas = p.ramas.map((r) => ({
        ...r, siguiente: a(r.siguiente) ?? null,
        ...(Array.isArray(r.paralelos) ? { paralelos: lista(r.paralelos, propio) } : {}),
      }));
    }
    if (p.casos?.some((c) => toca(c.siguiente))) copia().casos = p.casos.map((c) => (toca(c.siguiente) ? { ...c, siguiente: a(c.siguiente) ?? null } : c));
    if (p.destino && 'nodo' in p.destino && toca(p.destino.nodo)) copia().destino = { nodo: mapa.get(p.destino.nodo)! };
    return q ?? p;
  });
}

/** Lo que se va juntando de cada medio: los avisos de `juntarPasosIA` y los escenarios cuyo tono no entró. */
type AcumJunta = { conflictos: string[]; perdidos: string[]; noEntra: string[] };

/**
 * EL PRIMERO NO VACÍO de lo que sube al AI Step, en el orden tarjeta → sus casos. Los DISTINTOS van a `conflictos`
 * (`nombre`: cómo se dice en el aviso).
 */
function primeroDe<T>(valores: ReadonlyArray<T | null | undefined>, nombre: string, decir: (v: T) => string, acc: AcumJunta): T | undefined {
  const distintos = new Map<string, T>();
  for (const v of valores) if (v != null) { const k = estable(v); if (!distintos.has(k)) distintos.set(k, v); }
  const lista = [...distintos.values()];
  if (lista.length > 1) acc.conflictos.push(`${nombre}: ${lista.map(decir).join(' / ')}`);
  return lista[0];
}

/**
 * EL AI STEP JUNTO de las tarjetas `idx` (todas del mismo medio y escuchando, en el orden del array): el primero
 * con todos los escenarios, lo del objetivo en el nodo, el tono plegado y sin lo de antes. Ver `juntarPasosIA`.
 */
function nodoJunto<P extends PasoGrafo>(pasos: readonly P[], idx: readonly number[], acc: AcumJunta): P {
  const tarjetas = idx.map((i) => ({ p: pasos[i], id: idDe(pasos[i], i) }));
  const nodo = { ...tarjetas[0].p } as P;
  const t = (c: CasoRespuesta): string => (c.titulo ?? '').trim() || ROTULO_LO_DEMAS;

  // 1. Lo del OBJETIVO sube al nodo: el de la tarjeta y si no el de sus casos, en orden.
  const deTodos = <T>(deNodo: (p: P) => T | null | undefined, deCaso: (c: CasoRespuesta) => T | null | undefined): Array<T | null | undefined> =>
    tarjetas.flatMap(({ p }) => [deNodo(p), ...(p.casos ?? []).map(deCaso)]);
  const texto = (s: string | undefined): string | null => ((s ?? '').trim() || null);
  const objetivo = primeroDe(deTodos((p) => texto(p.objetivo), (c) => texto(c.objetivo)), 'el objetivo', (v) => `«${v}»`, acc);
  const audio = primeroDe(deTodos((p) => p.audio ?? null, (c) => c.audio ?? null), 'la voz', (v) => `«${v.voz}»`, acc);
  const ejemplos = primeroDe(deTodos((p) => (p.ejemplos?.length ? p.ejemplos : null), (c) => (c.ejemplos?.length ? c.ejemplos : null)),
    'los ejemplos del ensayo', (v) => `${v.length}`, acc);

  // 2. El TONO (`instrucciones`) se pliega adentro de cada respuesta, como lo pegaba `guiaDeCaso`. Si en un
  //    escenario no entra (TOPE_RESPONDER): con UN mismo tono en todas las tarjetas, el nodo lo conserva y no se
  //    pliega nada (contesta igual); con tonos distintos, se pliega lo que entra y lo que no pierde el tono.
  const tonos = tarjetas.map(({ p }) => (p.instrucciones ?? '').trim());
  const plegado = (tono: string, r: string): string => `${ROTULO_TONO}${tono}\n${r}`;
  const noCabe = (tono: string, c: CasoRespuesta): boolean => {
    const r = (c.responder ?? '').trim();
    return !!tono && !!r && plegado(tono, r).length > TOPE_RESPONDER;
  };
  const algunoNoCabe = tarjetas.some(({ p }, k) => (p.casos ?? []).some((c) => noCabe(tonos[k], c)));
  const conservar = algunoNoCabe && tonos.every((x) => x === tonos[0]) ? tonos[0] : '';

  // 3. «Otra cosa» con su texto de antes: se va (`AVISO_OTRA_COSA`, «Lo demás: Sólo te avisa»).
  const otraAviso = tarjetas.map(({ p }) => (p.otra_aviso ?? '').trim()).find(Boolean) ?? '';
  if (otraAviso && otraAviso !== AVISO_OTRA_COSA) acc.perdidos.push(`«Otra cosa» avisaba «${otraAviso.slice(0, 60)}»: ahora avisa «${AVISO_OTRA_COSA}»`);

  // 4. Los escenarios, tarjeta → caso, con el id que el clasificador ya devolvía (el de `idsDeCasos` de su tarjeta,
  //    desempatado como en la expansión).
  const escenarios: CasoRespuesta[] = [];
  let loDemas: CasoRespuesta | null | undefined;
  const usados = new Set<string>();
  tarjetas.forEach(({ p, id: tarjeta }, k) => {
    const ids = idsDeCasos(tarjeta, p.casos ?? []);
    (p.casos ?? []).forEach((c0, j) => {
      let c: CasoRespuesta = { ...c0, id: ids[j] };
      if (c.hasta === 'una') acc.perdidos.push(`«${t(c)}»: contestaba una vez; ahora hasta lograr el objetivo`);
      if (c.avisar === true && libertadDeCaso(c) === 'sola') acc.perdidos.push(`«${t(c)}»: sale sola y ya no te avisa`);
      const r = (c.responder ?? '').trim();
      if (tonos[k] && r && !conservar) {
        if (noCabe(tonos[k], c)) { acc.noEntra.push(t(c)); acc.perdidos.push(`«${t(c)}»: el tono no entra en la respuesta y se pierde`); }
        else c = { ...c, responder: plegado(tonos[k], r) };
      } else if (conservar && noCabe(conservar, c)) {
        acc.noEntra.push(t(c));
        acc.perdidos.push(`«${t(c)}»: el tono no entra en la respuesta (queda en la tarjeta)`);
      }
      c = sinCamposViejos(c);
      // Una libertad que el escenario no puede tener (plata, «Lo demás») baja a la que sí: lo mismo que el
      // desplegable deshabilita y Publicar frena.
      const permitidas = libertadesPermitidas(c);
      const lib = libertadDeCaso(c);
      if (!permitidas.includes(lib)) {
        const baja = permitidas.includes('aprueba') ? 'aprueba' : 'avisa';
        c = conLibertad(c, baja);
        acc.perdidos.push(`«${t(c)}»: no puede salir sola; queda ${baja === 'aprueba' ? 'para aprobar' : 'en sólo te avisa'}`);
      }
      if (c.cualquiera === true) {
        // «Lo demás»: el PRIMERO del medio es el que contestaba (la expansión toma ése). «Sólo te avisa» es el
        // default y se representa de UNA forma: sin el caso.
        if (loDemas !== undefined) { acc.perdidos.push(`«${t(c)}»: había dos «${ROTULO_LO_DEMAS}»; queda el primero`); return; }
        if (libertadDeCaso(c) === 'avisa') {
          loDemas = null;
          if ((c.responder ?? '').trim()) acc.perdidos.push(`«${t(c)}»: guardaba una respuesta que no mandaba; se va`);
          return;
        }
        loDemas = c;
        return;
      }
      let unico = c.id;
      for (let n = 2; usados.has(unico); n++) unico = `${c.id}_${n}`;
      usados.add(unico);
      escenarios.push(unico === c.id ? c : { ...c, id: unico });
    });
  });

  nodo.casos = loDemas ? [...escenarios, loDemas] : escenarios;
  if (objetivo) nodo.objetivo = objetivo; else delete nodo.objetivo;
  if (audio) nodo.audio = audio; else delete nodo.audio;
  if (ejemplos) nodo.ejemplos = ejemplos.slice(0, TOPE_EJEMPLOS); else delete nodo.ejemplos;
  if (conservar) nodo.instrucciones = conservar; else delete nodo.instrucciones;
  delete nodo.otra_aviso;
  return nodo;
}

/**
 * LA PUERTA PARA LO VIEJO (UNDÉCIMA TANDA, docs/diseno-undecima-tanda.md §2 punto 11 y §6): UN AI STEP POR MEDIO.
 * PURA e IDEMPOTENTE. La aplican el lienzo al abrir (`abrirFlujo`, como `quitarIrA`), `setSecuenciaPasos` al
 * escribir (`grafoAGuardar`: la API, «Crear con IA», «Pasar a AI Step») y el borrador al abrirse (SecuenciaPerfil.tsx).
 *
 *   · POR MEDIO (ausente = WhatsApp): los AI Step que ESCUCHAN se juntan en el PRIMERO del array, que conserva su
 *     id, los ids de los casos (los que el clasificador ya devolvía) y el orden tarjeta → caso. Las demás tarjetas
 *     SE SACAN del array (corre el índice de lo que venía después: con #213 las tres quitadas eran las últimas) y
 *     toda flecha que les llegaba va a la que queda. Las SUELTAS no se tocan.
 *   · Lo del OBJETIVO sube al nodo (objetivo, voz, ejemplos): el primero no vacío; los distintos, a `conflictos`.
 *   · El TONO se pliega adentro de cada respuesta (el mismo texto que pegaba `guiaDeCaso`); si no entra, el nodo
 *     lo conserva (o se pierde, con tonos distintos) y se dice en `perdidos`.
 *   · Se van `hasta`, `avisar` (el aviso se deriva de la libertad) y `otra_aviso`; lo que eso cambie, a `perdidos`.
 *     Un «Lo demás» que sólo avisa se va (es el default), uno repetido también, y una libertad que el escenario no
 *     puede tener baja a la que sí (`libertadesPermitidas`).
 *
 * Lo que el clasificador ve (`escenariosDeRespuesta`: nombre, cuándo, guía, «sale sola») no cambia. Con #213
 * (cuatro tarjetas de un caso) cambian sólo los ids de la expansión de las tres que se pliegan.
 */
export function juntarPasosIA<P extends PasoGrafo>(pasos: readonly P[]): JuntaPasosIA<P> {
  const r = juntar(pasos);
  return { pasos: r.pasos, cambio: r.cambio, conflictos: r.conflictos, perdidos: r.perdidos };
}

function juntar<P extends PasoGrafo>(pasosIn: readonly P[]): JuntaPasosIA<P> & { noEntra: string[] } {
  const acc: AcumJunta = { conflictos: [], perdidos: [], noEntra: [] };
  if (!pasosIn.some((p) => esPasoIA(p))) return { pasos: [...pasosIn], cambio: false, ...acc };
  const escuchan = (ps: readonly P[], m: MedioAIStep): number[] =>
    ps.map((_, i) => i).filter((i) => esPasoIA(ps[i]) && ps[i].suelta !== true && medioDe(ps[i]) === m);
  // Si hay que SACAR tarjetas, sobre el flujo normalizado: un paso sin id (`o<i>`) o sin `siguiente` explícito
  // («el de abajo del array») cambiaría de identidad o de salida al correrse el array.
  const quita = MEDIOS_AI_STEP.some((m) => escuchan(pasosIn, m).length > 1);
  const pasos = quita ? normalizar(pasosIn) : pasosIn;
  const quitar = new Set<number>();
  const mapa = new Map<string, string>();
  const nuevos = new Map<number, P>();
  for (const m of MEDIOS_AI_STEP) {
    const idx = escuchan(pasos, m);
    if (!idx.length) continue;
    const queda = idDe(pasos[idx[0]], idx[0]);
    for (const k of idx.slice(1)) { quitar.add(k); mapa.set(idDe(pasos[k], k), queda); }
    nuevos.set(idx[0], nodoJunto(pasos, idx, acc));
  }
  const out = reapuntarFlechas(pasos.map((p, i) => nuevos.get(i) ?? p).filter((_, i) => !quitar.has(i)), mapa);
  // Ninguna flecha queda colgando de una tarjeta quitada (por construcción; si pasara, se dice).
  for (let i = 0; i < out.length; i++) {
    const d = out[i].destino;
    const colgadas = [...puertosDe(out, i).map((pt) => pt.destino), d && 'nodo' in d ? d.nodo : null].filter((x): x is string => !!x && mapa.has(x));
    for (const x of colgadas) acc.perdidos.push(`una flecha seguía en ${x}, que se juntó`);
  }
  const cambio = quitar.size > 0 || [...nuevos].some(([i, q]) => estable(q) !== estable(pasosIn[i]));
  return { pasos: cambio ? out : [...pasosIn], cambio, ...acc };
}

// (El alias `separarPasosIA` de la décima —«una tarjeta por caso»— se BORRÓ en la ola 4 de la undécima: todos sus
// llamadores llaman a `juntarPasosIA`.)

// ── Textos que dibuja la tarjeta (cortos: AGENTS.md, el texto que se DIBUJA) ────────

export type NombresParaTexto = {
  etiqueta?: (id: number) => string | null;
  etapa?: (key: string, funnelId: number | null) => string | null;
  /** El nombre de un valor del catálogo (una clase, un módulo, un curso…). Sin él, el genérico. */
  catalogo?: NombresCatalogo;
};

export function textoFila(f: FilaCondicion, n: NombresParaTexto = {}): string {
  const no = !!f.no;
  switch (f.campo) {
    case 'etiqueta': {
      const nom = n.etiqueta?.(Number(f.valor)) ?? 'una etiqueta';
      return no ? `No tiene «${nom}»` : `Tiene «${nom}»`;
    }
    case 'etapa': {
      const nom = n.etapa?.(String(f.valor ?? ''), f.funnel_id ?? null) ?? String(f.valor ?? 'una etapa');
      return no ? `No está en «${nom}»` : `Está en «${nom}»`;
    }
    case 'agendo': return no ? 'No agendó' : 'Agendó';
    case 'pago': {
      const n = cuotaDeFila(f);
      const base = no ? 'No pagó' : 'Pagó';
      return n == null ? base : `${base} la cuota ${n}`;
    }
    case 'ya_contactado': return no ? 'Nunca le escribiste' : 'Ya le escribiste';
    case 'respondio': return no ? 'Nunca te escribió' : 'Te escribió alguna vez';
    case 'antiguedad': return `Llegó hace ${no ? 'más' : 'menos'} de ${horasTexto(Number(f.valor))}`;
    case 'tiene_telefono': return no ? 'Sin WhatsApp' : 'Tiene WhatsApp';
    case 'tiene_email': return no ? 'Sin email' : 'Tiene email';
    default: return textoCondicion(f, n.catalogo);
  }
}

/** La rama en una frase, con la unión de CADA fila («A y B o C»): la misma que evalúa `cumpleRama`. */
export function textoRama(r: RamaCondicion, n: NombresParaTexto = {}): string {
  const filas = r.filas ?? [];
  if (!filas.length) return 'Elige una condición';
  return filas.map((f, k) => (k ? ` ${unionDe(r, k)} ` : '') + textoFila(f, n)).join('');
}

function horasTexto(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '…';
  if (h % 24 === 0 && h >= 48) return `${h / 24} días`;
  return `${h} h`;
}

/**
 * La espera en una frase: la píldora de la tarjeta («10 s», sin «Esperar») y el aviso de «Probar»
 * («⏳ Esperar 10 s»).
 *
 * ⚠️ REDONDEABA A MINUTOS ENTEROS (quinta tanda, punto 3): desde que el DELAY lleva segundos
 * (`espera.minutos` con decimales, lib/espera-duracion.ts), 10 s se dibujaba «Esperar 0 min» y 30 s
 * «Esperar 1 min» —el `Math.round` de medio minuto—, en la tarjeta y en «Probar», con el editor
 * diciendo «10 segundos» al lado. La duración la escribe `textoDuracion`, que para un número entero
 * de minutos da exactamente lo de antes («1 día», «90 min», «2 h»).
 */
export function textoEspera(e: Espera | undefined): string {
  if (!e) return 'Esperar';
  const dur = textoDuracion(segundosDeMinutos(e.minutos));
  return e.modo === 'antes_reunion' ? `${dur} antes de la reunión` : `Esperar ${dur}`;
}
