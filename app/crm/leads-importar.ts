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
export const entra = (f: FilaImport): boolean =>
  f.incluir && (!f.motivo || f.motivo === MOTIVO_DECIDIBLE);

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
    filas.push({
      id: `f${r}`,
      nombre,
      email: celda(iEmail),
      telefono: celda(iTel),
      empresa: celda(iEmpresa),
      incluir: true,
      yaExiste: false,
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
} & Record<MotivoDescarte, number>;

export function contar(filas: FilaImport[]): ConteosImport {
  const c: ConteosImport = {
    total: filas.length, listas: 0, tildadas: 0, aProposito: 0,
    'sin-nombre': 0, 'sin-contacto': 0, duplicado: 0, 'repetido-archivo': 0,
  };
  for (const f of filas) {
    if (f.motivo) c[f.motivo]++;
    else c.listas++;
    // ⚠️ `tildadas` cuenta por `entra`, NO por «no tiene motivo y está tildada». Es el
    // número que el botón promete («Crear N leads»), así que tiene que contar lo mismo
    // que el server va a crear — incluido el duplicado que alguien tildó a propósito.
    // Contarlo aparte es cómo el botón decía 80 y entraban 80 más las repetidas.
    if (entra(f)) {
      c.tildadas++;
      if (f.motivo === MOTIVO_DECIDIBLE) c.aProposito++;
    }
  }
  return c;
}
