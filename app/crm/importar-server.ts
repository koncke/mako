import 'server-only';

// =============================================================================
// importar-server — leer un archivo de contactos y contrastarlo con la base
// =============================================================================
// Lo comparten el route que sube el archivo (/api/crm/importar-leads) y la action
// que confirma la importación: las dos necesitan el MISMO índice de duplicados y
// las MISMAS reglas, y si vivieran en dos lugares el segundo se quedaría viejo.
//
// Por qué el archivo lo lee un route y no una server action: el tope de body de
// las server actions es 1 MB. Un PDF escaneado o una foto de una lista de
// contactos pesa varios megas, así que por ahí el archivo NUNCA iba a entrar.
//
// Qué sabe leer, y a qué costo:
//   · CSV                       → parser propio, gratis e instantáneo.
//   · PDF con capa de texto     → unpdf, gratis (lib/archivo-a-texto).
//   · PDF escaneado e imágenes  → visión (Gemini→OpenAI, free tier primero).
//   · .docx / .txt / .md        → texto directo.
// Todo lo que NO es CSV pasa después por la IA barata, que devuelve los contactos
// como JSON. Esas filas se marcan de baja confianza: la IA se equivoca de columna
// más seguido de lo que uno cree, y el usuario tiene que revisarlas a mano.
// =============================================================================

import { archivoATexto } from '@/lib/archivo-a-texto';
import { CASCADA_DOCS, MODELO_DOCS, chatCheapCascade } from '@/lib/ai-cheap';
import { getTenantDb } from '@/lib/workspace';
import { leerPorPaginas } from '@/lib/supabase-paginado';
import {
  MAX_FILAS_IMPORT, esCsv, esPlanilla, filasDesdeCsv, MENSAJE_PLANILLA, recalcular, soloDigitos,
  type FilaImport,
} from './leads-importar';

/**
 * Índice de lo que YA está en el CRM (tenant-scoped). Paginado: PostgREST corta
 * en 1000 y `.limit()` no sube ese techo (lib/supabase-paginado.ts).
 *
 * Por página y no `leerTodo`: acá solo se arman dos Sets de strings, así que no
 * hay razón para tener medio millón de filas de `leads` vivas al mismo tiempo.
 *
 * El bucle que había acá paginaba SIN ORDER BY. Eso no es cosmético en ESTA
 * lectura: sin orden garantizado, la página 2 se puede saltear leads que la 1 no
 * trajo, y un lead que falta en el índice es un DUPLICADO que se crea igual —
 * el importador decía "nuevo" sobre alguien que ya estaba en el CRM.
 */
export async function indiceContactos(): Promise<{ emails: Set<string>; tels: Set<string> }> {
  const db = await getTenantDb();
  const emails = new Set<string>();
  const tels = new Set<string>();
  try {
    await leerPorPaginas<{ email: string | null; telefono: string | null }>(
      db, 'leads', 'email, telefono',
      (chunk) => {
        for (const r of chunk) {
          if (r.email) emails.add(r.email.trim().toLowerCase());
          if (r.telefono) { const dg = soloDigitos(r.telefono); if (dg) tels.add(dg); }
        }
      },
    );
  } catch (e) {
    // Se relanza con contexto: un índice a medias no se puede usar (ver arriba),
    // así que esto NUNCA degrada a "no hay duplicados".
    throw new Error(`No se pudo revisar los duplicados: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { emails, tels };
}

/**
 * Marca qué filas ya existen en el CRM y recalcula todos los motivos de descarte.
 * Se corre DOS veces: al leer el archivo (para mostrarlo) y al confirmar (porque
 * entre una cosa y la otra pudo entrar un lead por el webhook de Calendly o Meta).
 */
export async function marcarExistentes(filas: FilaImport[]): Promise<FilaImport[]> {
  const { emails, tels } = await indiceContactos();
  return recalcular(filas.map((f) => {
    const email = f.email.trim().toLowerCase();
    const tel = soloDigitos(f.telefono);
    return { ...f, yaExiste: (!!email && emails.has(email)) || (!!tel && tels.has(tel)) };
  }));
}

const SISTEMA_EXTRAER = `Eres un extractor de contactos. Recibes el TEXTO de un documento (una lista, una tabla, una captura, un PDF) y devuelves SOLO JSON con esta forma:
{"contactos":[{"nombre":"","email":"","telefono":"","empresa":"","seguro":true}]}

Reglas:
- Un objeto por PERSONA. No inventes datos: si un campo no está en el texto, déjalo como cadena vacía.
- "nombre" es el nombre de la persona; "empresa" es la organización, nunca el nombre de la persona.
- "telefono" tal cual aparece (con su prefijo si lo tiene). No lo reformatees ni le agregues códigos de país.
- "seguro" es false cuando dudas de a qué campo va un valor, cuando el texto está borroso o cortado, o cuando estás partiendo una línea ambigua.
- Ignora encabezados, totales, notas al pie y todo lo que no sea una persona.
- Si el documento no tiene contactos, devuelve {"contactos":[]}.`;

function parseJsonLoose(raw: string): Record<string, unknown> {
  const s = (raw || '').trim();
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { /* viene con fences o texto alrededor */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* nos rendimos */ } }
  return {};
}

const txt = (v: unknown): string => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, 200);

export type LecturaArchivoImport = { filas: FilaImport[]; viaIA: boolean; aviso?: string; error?: string };

/**
 * Un archivo entra, filas de contactos salen. Nunca tira: los formatos que no se
 * soportan devuelven un `error` en criollo con qué hacer, porque "algo salió mal"
 * frente a un .xlsx es exactamente lo que hacía que el importador pareciera roto.
 */
export async function filasDesdeArchivo(file: File): Promise<LecturaArchivoImport> {
  const nombre = file.name || 'archivo';
  if (esPlanilla(nombre)) return { filas: [], viaIA: false, error: MENSAJE_PLANILLA };

  // CSV: la vía directa. No pasa por IA — es exacto y gratis.
  if (esCsv(nombre, file.type)) {
    const { filas, error } = filasDesdeCsv(await file.text());
    return { filas, viaIA: false, error };
  }

  const lectura = await archivoATexto(file);
  if (!lectura.texto.trim()) {
    return { filas: [], viaIA: false, error: lectura.warning ?? `No pude sacar texto de «${nombre}».` };
  }

  // 120k caracteres: una lista de contactos gigante entra de sobra, y le pone
  // techo al costo de una llamada de visión sobre un PDF de 300 páginas.
  const texto = lectura.texto.slice(0, 120_000);
  const crudo = await chatCheapCascade({
    system: SISTEMA_EXTRAER,
    user: `Documento «${nombre}»:\n\n${texto}`,
    json: true,
    maxTokens: 8000,
    feature: 'Importar leads',
    motivo: `Extraer contactos de «${nombre}»`,
    provs: CASCADA_DOCS,
    modelos: MODELO_DOCS,
    validar: (t) => Array.isArray(parseJsonLoose(t).contactos),
  });
  const arr = parseJsonLoose(crudo).contactos;
  if (!Array.isArray(arr)) {
    return { filas: [], viaIA: true, error: `Leí «${nombre}» pero no pude sacar contactos de ahí. Prueba con un CSV.` };
  }

  const filas: FilaImport[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const fila: FilaImport = {
      id: `ia${filas.length}`,
      nombre: txt(o.nombre),
      email: txt(o.email),
      telefono: txt(o.telefono),
      empresa: txt(o.empresa),
      // De la IA nada entra tildado a ciegas: lo dudoso arranca destildado para
      // que el usuario tenga que mirarlo antes de crear el lead.
      bajaConfianza: o.seguro === false,
      incluir: o.seguro !== false,
      yaExiste: false,
    };
    if (!fila.nombre && !fila.email && !fila.telefono) continue;
    filas.push(fila);
    if (filas.length >= MAX_FILAS_IMPORT) break;
  }
  if (!filas.length) return { filas: [], viaIA: true, error: `«${nombre}» se leyó bien, pero no encontré contactos adentro.` };
  const aviso = arr.length > filas.length ? `El archivo traía ${arr.length} filas: se tomaron las primeras ${filas.length}.` : undefined;
  return { filas, viaIA: true, aviso };
}
