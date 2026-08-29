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
  '.pdf', '.docx',
  '.png', '.jpg', '.jpeg', '.webp', '.heic', '.avif',
];
export const ACCEPT_IMPORT = EXTENSIONES_IMPORT.join(',');

/**
 * Planillas: NO se soportan a propósito. Un .xlsx es un ZIP con XML adentro y
 * parsearlo pide una dependencia entera; guardar la hoja como CSV es un click en
 * Excel o en Sheets. Lo que NO se puede hacer es romper con un error críptico.
 */
export const EXTENSIONES_PLANILLA = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods', '.numbers'];
export const MENSAJE_PLANILLA = 'Todavía no leo planillas de Excel. Ábrela y usa "Guardar como" → CSV (delimitado por comas), y vuelve a subirla.';

export const esPlanilla = (nombre: string): boolean =>
  EXTENSIONES_PLANILLA.some((e) => nombre.toLowerCase().endsWith(e));

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

export function parseCsv(text: string): string[][] {
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
    else if (c === ',') { row.push(field); field = ''; }
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
 */
export function filasDesdeCsv(texto: string): { filas: FilaImport[]; error?: string } {
  const rows = parseCsv(texto);
  if (rows.length < 2) return { filas: [], error: 'El archivo no tiene filas de datos.' };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const iNombre = idx(['nombre', 'name']);
  const iEmail = idx(['email', 'correo', 'e-mail', 'mail']);
  const iTel = idx(['telefono', 'teléfono', 'whatsapp', 'celular', 'phone', 'tel']);
  const iEmpresa = idx(['empresa', 'company', 'negocio']);
  if (iNombre < 0) {
    return { filas: [], error: 'No encontré una columna "Nombre" en el CSV. Encabezados esperados: Nombre, Email, Teléfono, Empresa.' };
  }
  const filas: FilaImport[] = [];
  for (let r = 1; r < rows.length && filas.length < MAX_FILAS_IMPORT; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c.trim())) continue;
    const celda = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
    filas.push({
      id: `f${r}`,
      nombre: celda(iNombre),
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
export type ConteosImport = { total: number; listas: number; tildadas: number } & Record<MotivoDescarte, number>;

export function contar(filas: FilaImport[]): ConteosImport {
  const c: ConteosImport = {
    total: filas.length, listas: 0, tildadas: 0,
    'sin-nombre': 0, 'sin-contacto': 0, duplicado: 0, 'repetido-archivo': 0,
  };
  for (const f of filas) {
    if (f.motivo) c[f.motivo]++;
    else {
      c.listas++;
      if (f.incluir) c.tildadas++;
    }
  }
  return c;
}
