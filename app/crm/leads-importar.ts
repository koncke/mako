// =============================================================================
// leads-importar — el contrato de la importación (cliente, route y action)
// =============================================================================
// Client-safe (sin 'server-only'): lo comparten los TRES lados de la importación
// para que las reglas de descarte sean UNA sola. Antes vivían dentro del bucle de
// inserción del server, así que el usuario no podía verlas ni corregirlas: el
// archivo entraba y salía un número ("12 omitidos") sin decir cuáles ni por qué.
//
// El flujo es:
//   1. El modal sube el archivo a /api/crm/importar-leads (route, no server action:
//      un PDF de 6 MB no entra en el tope de 1 MB de las server actions).
//   2. El route devuelve las filas detectadas, cada una con `yaExiste` resuelto
//      contra la base EN ESE MOMENTO.
//   3. El usuario las revisa, corrige y tilda. Cada edición recalcula el motivo
//      con `recalcular` (la MISMA función que corre el server).
//   4. Al confirmar viajan las filas editadas, y el server vuelve a validar TODO
//      contra la base: entre el paso 2 y el 4 pudo entrar un lead por el webhook,
//      y lo que manda el cliente nunca es la autoridad.
// =============================================================================

// El criterio de teléfono de la casa. Los dos módulos son client-safe, así que esto no
// arrastra nada del server al navegador.
import { telefonoComparable } from '@/lib/leads-duplicados';

/** Por qué una fila NO se va a importar. Ninguna se esconde: se muestra atenuada. */
export type MotivoDescarte = 'sin-nombre' | 'sin-contacto' | 'duplicado' | 'repetido-archivo';

/**
 * De los cuatro motivos, el ÚNICO que es una decisión de la persona.
 *
 * «Ya existe en el CRM» es una advertencia: puede ser la misma persona (y entonces no
 * va) o un homónimo, un socio que comparte el mail de la empresa, o alguien a quien se
 * quiere cargar igual. Eso lo sabe quien importa y no el código, así que la fila entra
 * DESTILDADA y se puede tildar a sabiendas.
 *
 * Los otros tres no son decisiones, son filas que no se pueden crear:
 *   · `sin-nombre` → `createLead` tira, el nombre es obligatorio.
 *   · `sin-contacto` → el alta manual lo prohíbe desde siempre, «sin eso el lead es
 *     incontactable», y no hay razón para que el importador sea la puerta de atrás.
 *   · `repetido-archivo` → son dos filas del MISMO archivo; el server las frena con
 *     `chocaAcá` haga lo que haga el tilde, así que ofrecerlo sería un control muerto.
 *
 * ⚠️ POR ESO LA CASILLA SE HABILITA SÓLO PARA ÉSTE. Un tilde que la persona puede
 * mover y que el server ignora es peor que no tenerlo: es la pantalla prometiendo una
 * decisión que no existe, que es exactamente el bug del 03/10/2026 visto del otro lado.
 */
export const MOTIVO_DECIDIBLE: MotivoDescarte = 'duplicado';

/**
 * QUÉ LE PASA A ESTA FILA. Son TRES destinos y no dos (#623): la fila repetida se
 * puede saltear, se puede duplicar a sabiendas, y desde el 04/10/2026 se puede usar
 * para COMPLETAR la ficha que ya está — llenarle los campos que tiene vacíos sin
 * pisarle ni uno de los que tiene cargados.
 *
 * ⚠️ ES UNA FUNCIÓN Y NO TRES CONDICIONES PARECIDAS, y el porqué ya se pagó acá (está
 * abajo, en `entra`): las tres divergieron y la pantalla dibujó una cosa, el botón
 * contó otra y el server hizo una tercera. Un destino nuevo entra POR ACÁ o vuelve a
 * pasar lo mismo, y la próxima vez con una escritura sobre un lead que ya existe.
 *
 * El orden de las preguntas no es decorativo:
 *
 *   · **Sin tilde no pasa nada.** La casilla sigue contestando «¿esta fila hace algo?»,
 *     igual que siempre, y es lo que hace que `enriquecer` sea una pregunta APARTE y no
 *     un tercer valor de la misma: con la fila destildada no hay nada que decidir.
 *   · **Los motivos que NO son decisiones ganan.** Sin nombre, sin contacto o repetida
 *     dentro del archivo: ahí no hay fila que crear ni ficha que completar.
 *   · **Completar necesita A QUIÉN.** Sin `leadExistenteId` —porque el «ya existe»
 *     matchea dos leads distintos, o porque el server no lo pudo resolver— el destino
 *     vuelve a `crear`: es la decisión reversible. Escribirle los datos de una persona
 *     a la ficha de otra no lo es, y no deja una línea en ningún lado.
 */
export type DestinoFila = 'omitir' | 'crear' | 'enriquecer';

export function destinoDe(f: FilaImport): DestinoFila {
  if (!f.incluir) return 'omitir';
  if (f.motivo && f.motivo !== MOTIVO_DECIDIBLE) return 'omitir';
  if (f.motivo === MOTIVO_DECIDIBLE && f.enriquecer && f.leadExistenteId != null) return 'enriquecer';
  return 'crear';
}

/** ¿Esta fila va a COMPLETAR el lead que ya existe? */
export const enriquece = (f: FilaImport): boolean => destinoDe(f) === 'enriquecer';

/**
 * ¿ESTA FILA SE VA A CREAR? La misma pregunta, la misma respuesta, para los tres que
 * la hacen: la casilla que se dibuja, el número del botón (`contar`) y el portón del
 * server (`importarLeadsRevisadosAction`).
 *
 * ⚠️ ES UNA FUNCIÓN Y NO TRES CONDICIONES PARECIDAS porque las tres divergieron, y lo
 * que se pagó fue esto: la pantalla dibujaba la fila repetida atenuada y sin tilde, el
 * botón decía «Crear 80 leads» contando sólo las limpias, y el server creaba 80 MÁS las
 * repetidas —con la guarda anti-duplicado apagada— porque su portón miraba únicamente
 * `incluir`, que nace en true y que `recalcular` nunca baja. Tres lectores, tres
 * respuestas, ningún error. Vivió desde el 14/08/2026.
 */
export const entra = (f: FilaImport): boolean => destinoDe(f) === 'crear';

/**
 * ¿ESTA FILA ENTRA COMO GANADO? (#622)
 *
 * Sale de la tarjeta: Leila carga a mano sus clientes de pago recurrente y TODOS caían
 * en «Lead (Instant form)», o sea la primera etapa del embudo — gente que ya pagó
 * esperando a que alguien les agende una primera reunión.
 *
 * ⚠️ ES UNA PROPUESTA, NO UNA DECISIÓN DEL CÓDIGO. El parser marca la fila, la tabla de
 * revisión la muestra diciendo a dónde va, y la persona confirma o la apaga. Es la regla
 * de la casa —un canal propone, una persona confirma— y acá importa el doble: lo que se
 * escribe es `estado_lead = 'ganado'` y el monto de la venta, que es lo que leen la
 * facturación y el Segundo Cerebro.
 *
 * ⚠️ Y SÓLO SOBRE UNA FILA QUE SE CREA. `destinoDe` ya contesta qué le pasa a la fila:
 * una que completa la ficha que ya está (#623) llena campos vacíos y NO le mueve la
 * etapa a nadie — mover de etapa a un lead que alguien viene trabajando no es
 * «completar lo que falta», y encima pasaría por arriba de su historial.
 *
 * ⚠️ EL `pagoEnArchivo` ES UN GATE, NO UNA AUTORIZACIÓN. Igual que `vioDuplicado` en el
 * server: lo manda el cliente, así que no sirve para dejar pasar nada por sí solo —
 * sirve para FRENAR la fila que no venía marcada por el parser.
 */
export const entraGanado = (f: FilaImport): boolean =>
  destinoDe(f) === 'crear' && f.pagoEnArchivo === true && f.comoGanado === true;

/**
 * Encabezados que se leen como «esta persona PAGÓ». Por inclusión, igual que los otros
 * cinco (`filasDesdeCsv`), así que «Total cobrado», «Monto del primer pago» o
 * «Payment amount» entran sin enumerarlos.
 *
 * ⚠️ LA LISTA ES CORTA A PROPÓSITO. Están afuera «total», «precio» y «venta», que
 * aparecen en catálogos y listas de productos sin querer decir que alguien pagó: el
 * costo de un falso positivo acá no es una celda mal leída, es un lead propuesto como
 * venta con un monto inventado. Un alias que falte se agrega el día que aparezca un
 * archivo real que lo use.
 */
export const ALIAS_PAGO = ['pago', 'pagado', 'paid', 'cobrado', 'cobro', 'monto', 'importe', 'amount', 'payment'];

/** Encabezados de FECHA: nunca son la columna del monto. Ver `pagoDeCelda`. */
const ALIAS_FECHA = ['fecha', 'date'];

const sinAcentos = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** Lo que significa un «no» explícito. Lo vacío ya es un no y no hace falta listarlo. */
const NO_PAGO = new Set(['0', 'no', 'false', 'n', '-', '--', 'na', 'n/a', 'sin pago', 'no pago', 'impago', 'pendiente', 'nada', 'cero']);
/** Y un «sí» sin número. Vale como propuesta; lo que no hay es monto que escribir. */
const SI_PAGO = new Set(['si', 'yes', 'true', 'y', 'ok', 'pago', 'pagado', 'paid', 'cobrado', 'activo', 'al dia', 'completo', 'listo']);

/**
 * Un importe escrito por una persona → un número. `null` = ahí no había un importe.
 *
 * ⚠️ LAS DOS CONVENCIONES SON REALES Y SE CONFUNDEN ENTRE SÍ: «1.200,50» (como lo
 * escribe media Latinoamérica y como lo exporta Excel en español) y «1,200.50». Leer
 * «1.200» con `Number` da 1,2 — un cliente de 1.200 dólares entraría al CRM como una
 * venta de un dólar con veinte, sin un solo error.
 *
 * La regla, con el separador que aparece ÚLTIMO:
 *   · hay coma Y punto  → el último de los dos es el decimal, el otro agrupa miles.
 *   · hay uno solo      → con 1 o 2 dígitos detrás es decimal («1200,5»); con 3 es el
 *                         separador de miles («1.200»), que es el caso que rompía.
 * Una fecha no sobrevive a esto («2026-03-15» no es un número) y eso es a propósito: un
 * monto inventado a partir de una fecha es peor que no proponer nada.
 */
export function montoDeTexto(v: string): number | null {
  const s = (v || '').replace(/[^\d,.-]/g, '');
  if (!/\d/.test(s)) return null;
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  let limpio = s;
  if (coma >= 0 && punto >= 0) {
    const dec = Math.max(coma, punto);
    limpio = `${s.slice(0, dec).replace(/[,.]/g, '')}.${s.slice(dec + 1).replace(/[,.]/g, '')}`;
  } else if (coma >= 0 || punto >= 0) {
    const i = Math.max(coma, punto);
    const cola = s.slice(i + 1);
    limpio = /^\d{1,2}$/.test(cola) ? `${s.slice(0, i).replace(/[,.]/g, '')}.${cola}` : s.replace(/[,.]/g, '');
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Tope del monto que se acepta de un archivo. Un cierre de más de 10 millones de USD no
 *  existe en este producto, y sin tope una celda con un teléfono pegado sin separadores
 *  entra al CRM como una venta de mil millones. */
export const MAX_MONTO_IMPORT = 10_000_000;

/**
 * Qué dice la celda de pago: si esa persona pagó, y cuánto.
 *
 * `monto: null` con `pago: true` es un caso real y legítimo —la columna dice «sí» o
 * «pagado» sin importe— y se distingue del otro: la propuesta vale igual, lo que no hay
 * es monto que escribirle a la venta.
 */
export function pagoDeCelda(celda: string): { pago: boolean; monto: number | null } {
  const plano = sinAcentos(celda || '');
  if (!plano || NO_PAGO.has(plano)) return { pago: false, monto: null };
  const monto = montoDeTexto(celda);
  if (monto != null) {
    // Un 0, un negativo (una devolución, un saldo en contra) o un número fuera de escala
    // no son un pago. El negativo no se toma por valor absoluto a propósito: eso
    // convertiría una devolución en una venta.
    return monto > 0 && monto <= MAX_MONTO_IMPORT ? { pago: true, monto } : { pago: false, monto: null };
  }
  return SI_PAGO.has(plano) ? { pago: true, monto: null } : { pago: false, monto: null };
}

export const MOTIVO_LABEL: Record<MotivoDescarte, string> = {
  'sin-nombre': 'sin nombre',
  'sin-contacto': 'sin email ni teléfono',
  duplicado: 'ya existe en el CRM',
  'repetido-archivo': 'repetido dentro del archivo',
};

export type FilaImport = {
  /** Clave estable para React y para el recuento (el índice de la fila original). */
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  /** Lo tilda el usuario. Una fila con motivo nunca se importa, aunque venga en true. */
  incluir: boolean;
  /** Resuelto contra la base al leer el archivo; se recalcula al confirmar. */
  yaExiste: boolean;
  /**
   * Lo elige la persona SOBRE UNA FILA QUE YA EXISTE: completar la ficha que hay en
   * vez de crear una segunda. Es una pregunta DISTINTA de `incluir` («¿esta fila hace
   * algo?»), no un tercer valor suyo: con la fila destildada no hay nada que decidir.
   *
   * Default `false` a propósito, y es la decisión del 14/08 intacta: tildar un
   * repetido CREA otra ficha, y eso ya está fijado por
   * tests/crm-importar-duplicados.test.ts. Completar es lo que antes no se podía
   * elegir, no lo que ahora pasa solo.
   */
  enriquecer?: boolean;
  /**
   * A QUÉ lead apunta el «ya existe». Lo resuelve el SERVER (`marcarExistentes`), nunca
   * el navegador: lo que manda el cliente es una propuesta.
   *
   * `null` = no se puede decidir a quién completar, y los dos casos son reales: el email
   * de la fila matchea un lead y el teléfono matchea OTRO, o hay dos leads guardados con
   * el mismo dato. Ahí `destinoDe` no ofrece `enriquecer`.
   */
  leadExistenteId?: number | null;
  /**
   * EL ARCHIVO TRAÍA UN PAGO para esta persona (#622). Es un HECHO del archivo, no una
   * decisión: lo pone `filasDesdeCsv` al leer la columna de pago y nadie lo mueve.
   *
   * Existe aparte de `comoGanado` porque son dos preguntas: ésta es «¿la planilla decía
   * que pagó?» y la otra «¿entra como venta?». Con una sola no se puede dibujar el
   * control —una fila cuya propuesta la persona apagó sigue siendo una fila con pago, y
   * el botón tiene que seguir ahí para volver a prenderla— y el server no tendría con
   * qué frenar una fila que llega marcada como venta sin que el archivo lo dijera.
   */
  pagoEnArchivo?: boolean;
  /**
   * CUÁNTO pagó, si la celda traía un importe. `null` = la columna decía «sí» o
   * «pagado» sin número, que es un caso real y no un error: la propuesta vale igual y lo
   * que falta es el monto de la venta.
   */
  montoPago?: number | null;
  /**
   * LA DECISIÓN: esta fila entra en la etapa de cierre en vez de la primera.
   *
   * Nace en `true` sobre las filas con pago —ésa ES la propuesta— y la persona la apaga
   * desde la tabla. Al revés de `enriquecer`, que nace en false: ahí el default seguro
   * era no escribir sobre una ficha ajena; acá la fila es nueva y el dato más fresco que
   * hay sobre ella es justamente que pagó.
   */
  comoGanado?: boolean;
  /** La IA no estaba segura de esta fila → entra destildada. */
  bajaConfianza?: boolean;
  /** Derivado (no se persiste): por qué se descarta. null = entra. */
  motivo?: MotivoDescarte | null;
};

/** Lo que devuelve el route al leer un archivo. */
export type LecturaImport = {
  ok: true;
  filas: FilaImport[];
  /** true si los datos los sacó la IA de un PDF/imagen/documento (no de un CSV). */
  viaIA: boolean;
  /** Aviso no bloqueante (ej. "el archivo traía 4000 filas, se tomaron las primeras 3000"). */
  aviso?: string;
} | { ok: false; error: string };

/** Tope de filas por importación: acota el payload de la confirmación (server action). */
export const MAX_FILAS_IMPORT = 3000;

/** A partir de acá la tabla de revisión se pagina (una tabla de 500 filas no se revisa). */
export const FILAS_POR_PAGINA = 100;
export const UMBRAL_PAGINADO = 200;

/** Solo dígitos: es la llave con la que el CRM matchea teléfonos (telefono_normalizado). */
export const soloDigitos = (v: string): string => (v || '').replace(/\D/g, '');

// ── El cruce por teléfono contra lo que YA está en el CRM (#622) ─────────────
// Vive acá, sin `server-only`, por la regla de la casa: lo que se puede equivocar es la
// COMPARACIÓN —un número con código de país, otro sin, uno tipeado a mano— y tiene que
// poder testearse sin base de datos. El índice en sí (paginar `leads`, armar los mapas)
// se queda en app/crm/importar-server.ts, que es lo único que necesita Supabase.

/** Los dos mapas del índice: dígitos completos y sufijo de 10. Ver `clavesDeTelefono`. */
export type IndiceTelefonos = {
  exactos: Map<string, number | null>;
  sufijos: Map<string, number | null>;
};

/**
 * LAS DOS CLAVES con las que un teléfono entra al índice de duplicados.
 *
 * ⚠️ EL SUFIJO ES EL QUE DE VERDAD CRUZA, y es lo que faltaba. El índice comparaba los
 * dígitos COMPLETOS, así que «+52 1 998 123 4567» guardado y «9981234567» tipeado en un
 * CSV eran dos personas. Medido contra producción el 04/10/2026: de los 1.154 leads de
 * ws1 con teléfono, UNO tiene 10 dígitos — 1.027 tienen 13 y 115 tienen 16, porque
 * entraron desde WhatsApp y desde Meta. O sea que una lista de clientes tipeada a mano
 * matcheaba 1 de 1.154 y los otros 1.153 se importaban de nuevo.
 *
 * El criterio es `telefonoComparable`, el MISMO que ya usan el alta manual
 * (`duplicadosDeLead`) y el inbox de WhatsApp: «el mismo número con y sin código de país
 * es el mismo número». Esta puerta era la única que aplicaba el criterio estricto.
 *
 * La exacta se conserva igual: es la que mantiene limpio lo que ya matcheaba bien, y es
 * la que se prueba PRIMERO en `buscarTelefono`.
 */
export function clavesDeTelefono(v: string): { exacta: string | null; sufijo: string | null } {
  const d = soloDigitos(v);
  return { exacta: d || null, sufijo: telefonoComparable(d) };
}

/**
 * A QUÉ LEAD apunta un teléfono, leído del índice.
 *
 * Tres respuestas y las tres distintas, igual que en `IndiceContactos`:
 *   · `undefined` → ese teléfono no está en el CRM.
 *   · un número   → está, y es ÉSE el lead (es a quién se le podría completar la ficha).
 *   · `null`      → está y lo tienen DOS leads. «Ya existe» sigue siendo cierto y no hay
 *     a quién completar, que es lo correcto: elegir uno es escribirle los datos de una
 *     persona en la ficha de otra.
 *
 * ⚠️ EL EXACTO PRIMERO Y EL SUFIJO DESPUÉS, el mismo orden que `elegirPorTelefono` y que
 * las ingestas: si hay un match exacto, el sufijo no opina. Eso es lo que hace que este
 * cruce más ancho no pueda volver ambiguo ningún match que antes era limpio.
 */
export function buscarTelefono(idx: IndiceTelefonos, tel: string): number | null | undefined {
  const { exacta, sufijo } = clavesDeTelefono(tel);
  if (exacta && idx.exactos.has(exacta)) return idx.exactos.get(exacta) ?? null;
  if (sufijo && idx.sufijos.has(sufijo)) return idx.sufijos.get(sufijo) ?? null;
  return undefined;
}

/**
 * Formatos que el importador sabe leer. Los de texto van directo; el resto pasa por
 * lib/archivo-a-texto (PDF con capa de texto, visión para escaneos e imágenes, docx)
 * y después por la IA barata, que devuelve los contactos como JSON.
 */
export const EXTENSIONES_IMPORT = [
  '.csv', '.txt', '.md', '.json',
  '.xlsx', '.xlsm', '.ods',
  '.pdf', '.docx',
  '.png', '.jpg', '.jpeg', '.webp', '.heic', '.avif',
];
export const ACCEPT_IMPORT = EXTENSIONES_IMPORT.join(',');

/**
 * Planillas que SÍ se leen, desde el 27/09/2026 (tanda 3 de la fricción del CRM).
 *
 * ⚠️ EL COMENTARIO QUE ESTABA ACÁ SE HABÍA QUEDADO VIEJO, y eso es lo que costó:
 * decía «parsearlo pide una dependencia entera» y para entonces el repo YA tenía el
 * lector, escrito para el importador del plan (`lib/office-a-texto.ts`: jszip + XML,
 * cero dependencias nuevas). El importador del CRM siguió rebotando .xlsx y mandando
 * a guardar como CSV — mientras un PDF escaneado sí lo leía — porque nadie volvió a
 * leer la razón. Una decisión bien argumentada deja de ser cierta sin avisar.
 *
 * Y NO van por la IA: `xlsxATexto` devuelve las celdas separadas por TAB, así que
 * entran por el mismo parser exacto del CSV. Un teléfono o un email que pasa por un
 * modelo deja de ser exacto, y son justo las dos columnas que importan.
 */
export const EXTENSIONES_LEIBLES_PLANILLA = ['.xlsx', '.xlsm', '.ods'];

/**
 * Las que de verdad no se pueden: el Excel binario viejo (.xls), el binario nuevo
 * (.xlsb) y Numbers, que es un formato cerrado. Acá el mensaje sigue siendo lo
 * importante: romper con un error críptico frente a una planilla es lo que hacía que
 * el importador pareciera roto.
 */
export const EXTENSIONES_PLANILLA = ['.xls', '.xlsb', '.numbers'];
export const MENSAJE_PLANILLA = 'Ese formato de planilla es cerrado y no lo puedo abrir. En Excel o en Numbers usa "Guardar como" → .xlsx (o CSV) y vuelve a subirla.';

export const esPlanilla = (nombre: string): boolean =>
  EXTENSIONES_PLANILLA.some((e) => nombre.toLowerCase().endsWith(e));

export const esPlanillaLeible = (nombre: string): boolean =>
  EXTENSIONES_LEIBLES_PLANILLA.some((e) => nombre.toLowerCase().endsWith(e));

/**
 * Las filas de una planilla ya convertida a texto por `xlsxATexto` /
 * `openDocumentATexto`: celdas separadas por TAB, y un `===== Hoja: X =====` antes de
 * cada hoja.
 *
 * Se prueban TODAS las hojas y gana la primera que tenga una columna de nombre: la
 * hoja 1 de un archivo real es muchas veces una portada, un resumen o un tablero, y
 * quedarse con ella devuelve «no encontré una columna Nombre» sobre un archivo que sí
 * la tiene una pestaña más allá.
 */
export function filasDesdePlanilla(texto: string): { filas: FilaImport[]; error?: string } {
  const hojas = texto.split(/^===== Hoja: .*? =====$/m).map((h) => h.trim()).filter(Boolean);
  const candidatas = hojas.length ? hojas : [texto];
  let primerError: string | undefined;
  for (const hoja of candidatas) {
    const r = filasDesdeCsv(hoja, '\t');
    if (r.filas.length) return r;
    primerError = primerError ?? r.error;
  }
  return { filas: [], error: primerError ?? 'La planilla no tiene filas de datos.' };
}

export const esCsv = (nombre: string, mime = ''): boolean =>
  nombre.toLowerCase().endsWith('.csv') || mime === 'text/csv' || mime === 'application/csv';

/**
 * Recalcula el motivo de descarte de TODAS las filas. Es puro y lo corren los dos
 * lados: el cliente después de cada edición y el server antes de insertar. El orden
 * importa: la primera aparición de un email/teléfono entra y las siguientes quedan
 * marcadas como repetidas (si no, un archivo con la misma persona dos veces creaba
 * dos leads y el dedup contra la base no lo veía porque todavía no existía).
 */
export function recalcular(filas: FilaImport[]): FilaImport[] {
  const emails = new Set<string>();
  const tels = new Set<string>();
  return filas.map((f) => {
    const nombre = f.nombre.trim();
    const email = f.email.trim().toLowerCase();
    const tel = soloDigitos(f.telefono);
    let motivo: MotivoDescarte | null = null;
    if (!nombre) motivo = 'sin-nombre';
    else if (!email && !tel) motivo = 'sin-contacto';
    else if (f.yaExiste) motivo = 'duplicado';
    else if ((email && emails.has(email)) || (tel && tels.has(tel))) motivo = 'repetido-archivo';
    // Solo las que efectivamente van a entrar reservan su email/teléfono: si una
    // fila ya se descarta por otro motivo, no tiene por qué invalidar a la próxima.
    if (!motivo) {
      if (email) emails.add(email);
      if (tel) tels.add(tel);
    }
    return { ...f, motivo };
  });
}

// ── CSV → filas ──────────────────────────────────────────────────────────────
// Parser propio (RFC4180: comillas, comas y saltos de línea dentro de un campo).
// Vive acá y no en el server porque es puro y lo necesitan los dos lados.

export function parseCsv(text: string, delim = ','): string[][] {
  const s = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') { q = true; }
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Filas de un CSV. Los encabezados NO tienen que ser exactos: se buscan por
 * inclusión ("Nombre completo", "Correo electrónico", "WhatsApp" y demás).
 * Devuelve `error` en vez de tirar: el modal lo muestra y el usuario corrige el
 * archivo, que es distinto de "el archivo está roto".
 *
 * ⚠️ EL APELLIDO SE PEGA AL NOMBRE, y hasta el 03/10/2026 se TIRABA. Se buscaban
 * cuatro encabezados —nombre, email, teléfono, empresa— y ninguno era apellido, así
 * que un archivo con las dos columnas separadas (la forma normal de exportar de
 * cualquier CRM) entraba con media identidad: «Juan» a secas, sin forma de
 * distinguirlo del otro Juan de la lista. Y no es sólo el CSV — por este mismo
 * parser entra la planilla (`filasDesdePlanilla` con TAB).
 *
 * Se PEGA y no se guarda aparte porque la tabla `leads` no tiene columna de
 * apellido: todo el repo lo deriva partiendo el campo `nombre`
 * (`lib/template-vars.ts`). O sea que acá no hace falta migración ni columna nueva,
 * y la tabla de revisión muestra el nombre completo en la celda que el usuario ya
 * sabe corregir.
 */
export function filasDesdeCsv(texto: string, delim = ','): { filas: FilaImport[]; error?: string } {
  const rows = parseCsv(texto, delim);
  if (rows.length < 2) return { filas: [], error: 'El archivo no tiene filas de datos.' };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const coincide = (h: string, names: string[]) => names.some((n) => h === n || h.includes(n));
  const idx = (names: string[]) => header.findIndex((h) => coincide(h, names));
  const iNombre = idx(['nombre', 'name']);
  const iEmail = idx(['email', 'correo', 'e-mail', 'mail']);
  const iTel = idx(['telefono', 'teléfono', 'whatsapp', 'celular', 'phone', 'tel']);
  const iEmpresa = idx(['empresa', 'company', 'negocio']);
  if (iNombre < 0) {
    return { filas: [], error: 'No encontré una columna "Nombre" en el CSV. Encabezados esperados: Nombre, Apellido, Email, Teléfono, Empresa.' };
  }
  /**
   * Las columnas de apellido. Son TODAS las que matcheen y no una: «Apellido
   * Paterno» + «Apellido Materno» es como exporta media Latinoamérica, y quedarse
   * con la primera tira el segundo apellido igual que antes se tiraba el único.
   *
   * Las dos condiciones que las acotan, y las dos son casos reales:
   *   · `i !== iNombre` — si no, un archivo cuya única columna es «Last Name»
   *     (que matchea 'name', así que ES la columna de nombre) se pegaría a sí
   *     mismo: «Pérez Pérez».
   *   · `!coincide(h, ['nombre'])` — «Nombre y Apellido» YA trae el nombre
   *     completo. Sin esto se duplicaría entero: «Juan Pérez Juan Pérez».
   */
  const iApellidos = header
    .map((h, i) => (i !== iNombre && coincide(h, ['apellido', 'last name', 'lastname', 'last_name', 'surname']) && !coincide(h, ['nombre']) ? i : -1))
    .filter((i) => i >= 0);
  /**
   * La columna de PAGO (#622). Las dos condiciones que la acotan, y las dos son casos
   * reales de un export de CRM:
   *   · no puede ser una de las cinco ya mapeadas — «Empresa de cobro» matchea 'cobro'
   *     y es la empresa; leerla como importe propondría una venta por cada fila.
   *   · ni una de FECHA. «Fecha de pago» matchea 'pago' y suele venir ANTES que el
   *     monto, así que sin esto `findIndex` se queda con la fecha y el archivo que SÍ
   *     traía el importe entra sin importe.
   */
  const usadas = new Set([iNombre, iEmail, iTel, iEmpresa, ...iApellidos].filter((i) => i >= 0));
  const iPago = header.findIndex((h, i) => !usadas.has(i) && coincide(h, ALIAS_PAGO) && !coincide(h, ALIAS_FECHA));
  const filas: FilaImport[] = [];
  for (let r = 1; r < rows.length && filas.length < MAX_FILAS_IMPORT; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c.trim())) continue;
    const celda = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
    // El orden es nombre y DESPUÉS apellido, lo diga el archivo o no: un CSV con
    // «Apellido | Nombre» (también común) daría «Pérez Juan», que es el saludo al
    // revés en toda plantilla. El orden sale de qué ES cada columna, no de dónde está.
    // Y el espacio lo pone el `join`, con las celdas vacías ya afuera: sin el filtro,
    // un apellido en blanco deja «Juan » y el nombre guardado termina con un espacio
    // que después nadie ve y que rompe cualquier comparación por nombre.
    const nombre = [celda(iNombre), ...iApellidos.map(celda)].filter(Boolean).join(' ');
    // La propuesta de entrar como venta (#622). Los campos se agregan SÓLO cuando el
    // archivo dijo que pagó: una fila sin pago no lleva la pregunta encima, así que la
    // tabla no dibuja un control que no decide nada.
    const pago = iPago >= 0 ? pagoDeCelda(celda(iPago)) : { pago: false, monto: null };
    filas.push({
      id: `f${r}`,
      nombre,
      email: celda(iEmail),
      telefono: celda(iTel),
      empresa: celda(iEmpresa),
      incluir: true,
      yaExiste: false,
      ...(pago.pago ? { pagoEnArchivo: true, montoPago: pago.monto, comoGanado: true } : {}),
    });
  }
  return { filas };
}

/** Cuántas hay de cada cosa — los chips que se ven arriba de la tabla. */
export type ConteosImport = {
  total: number;
  /** Filas sin ningún motivo de descarte. */
  listas: number;
  /** Las que SE VAN A CREAR: es el número del botón, y sale de `entra`. */
  tildadas: number;
  /** Duplicados tildados a sabiendas. Su propio chip: es lo irreversible de esta pantalla. */
  aProposito: number;
  /** Las que COMPLETAN un lead que ya existe en vez de crear uno nuevo (#623). */
  aEnriquecer: number;
  /**
   * Las que entran como VENTA en vez de en la primera etapa (#622).
   *
   * ⚠️ Es un SUBCONJUNTO de `tildadas`, no un número aparte: esos leads se crean igual
   * que los demás y después se los mueve de etapa, así que sumarlo al botón contaría dos
   * veces al mismo lead. La diferencia con `aEnriquecer` —que SÍ va aparte— es que ahí
   * no se crea nada.
   */
  comoGanado: number;
} & Record<MotivoDescarte, number>;

export function contar(filas: FilaImport[]): ConteosImport {
  const c: ConteosImport = {
    total: filas.length, listas: 0, tildadas: 0, aProposito: 0, aEnriquecer: 0, comoGanado: 0,
    'sin-nombre': 0, 'sin-contacto': 0, duplicado: 0, 'repetido-archivo': 0,
  };
  for (const f of filas) {
    if (f.motivo) c[f.motivo]++;
    else c.listas++;
    // Las que completan NO entran en `tildadas`: ése es el número que el botón promete
    // CREAR, y una ficha completada no es un lead nuevo. Son dos hechos distintos y por
    // eso van en dos campos — meterlos en uno hace que el resumen diga «3 leads nuevos»
    // sobre una importación que no creó ninguno.
    if (enriquece(f)) c.aEnriquecer++;
    // ⚠️ `tildadas` cuenta por `entra`, NO por «no tiene motivo y está tildada». Es el
    // número que el botón promete («Crear N leads»), así que tiene que contar lo mismo
    // que el server va a crear — incluido el duplicado que alguien tildó a propósito.
    // Contarlo aparte es cómo el botón decía 80 y entraban 80 más las repetidas.
    if (entra(f)) {
      c.tildadas++;
      if (f.motivo === MOTIVO_DECIDIBLE) c.aProposito++;
      // Dentro de `entra` a propósito: ver el porqué en `ConteosImport.comoGanado`.
      if (entraGanado(f)) c.comoGanado++;
    }
  }
  return c;
}
