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
  MAX_FILAS_IMPORT, buscarTelefono, clavesDeTelefono, esCsv, esPlanilla, esPlanillaLeible, filasDesdeCsv, filasDesdePlanilla, MENSAJE_PLANILLA, recalcular,
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
export type IndiceContactos = {
  /**
   * El dato → el ID del lead que lo tiene. `null` = lo tienen DOS leads distintos.
   *
   * ⚠️ QUE LA CLAVE ESTÉ Y QUE EL VALOR SEA `null` SON DOS COSAS. `has()` contesta
   * «esto ya está en el CRM», que es lo único que necesita `yaExiste`; el valor contesta
   * «a quién completar», y con dos leads que comparten el email no hay respuesta. Leerlo
   * con `get()` a secas confundiría «no está» con «hay dos», y la segunda es justo
   * donde completar le escribiría a la persona equivocada.
   */
  emails: Map<string, number | null>;
  /** Los DÍGITOS COMPLETOS del teléfono guardado. */
  tels: Map<string, number | null>;
  /**
   * Los ÚLTIMOS 10 DÍGITOS — y ésta es la que de verdad cruza (#622).
   *
   * ⚠️ EL CRUCE POR TELÉFONO COMPARABA LOS DÍGITOS COMPLETOS, Y ESO DEJABA AFUERA A CASI
   * TODA LA TABLA. Medido contra producción el 04/10/2026: de los 1.154 leads de ws1 con
   * teléfono, UNO tiene 10 dígitos; 1.027 tienen 13 y 115 tienen 16 (entraron desde
   * WhatsApp y Meta, con código de país). O sea que una lista tipeada a mano —que es
   * como llega un CSV de clientes de pago— matcheaba 1 de 1.154. Los otros 1.153 se
   * importaban como leads nuevos, y las dos fichas quedaban inalcanzables para la
   * ingesta siguiente: dos filas con el mismo `telefono_normalizado` rompen con PGRST116
   * el `.maybeSingle()` de Calendly y del instant form.
   *
   * El criterio no se inventó acá: es `telefonoComparable`, el MISMO que ya usaban el
   * alta manual (`duplicadosDeLead`, que FRENA con eso) y el inbox de WhatsApp. Esta
   * puerta era la que aplicaba el criterio MÁS ESTRICTO, igual que les pasaba a las
   * ingestas antes del #626.
   *
   * ⚠️ TRAE DE MÁS A PROPÓSITO, y por eso es un mapa APARTE: un sufijo que dos leads
   * comparten deja la clave en `null` —«ya existe» sigue siendo cierto y la oferta de
   * completar desaparece, que es lo correcto porque no hay a quién— y la búsqueda prueba
   * primero el exacto, así que ningún match que antes era limpio se vuelve ambiguo.
   * Pares que hoy comparten los últimos 10 dígitos sin compartir los completos: 0 en los
   * 6 workspaces.
   */
  telsSufijo: Map<string, number | null>;
};

export async function indiceContactos(): Promise<IndiceContactos> {
  const db = await getTenantDb();
  const emails = new Map<string, number | null>();
  const tels = new Map<string, number | null>();
  const telsSufijo = new Map<string, number | null>();
  // Dos leads con el mismo dato no se desempatan acá: la clave queda en `null` y el
  // «ya existe» sigue siendo cierto. Lo que se pierde es la oferta de completar, que es
  // exactamente lo correcto — no hay a quién.
  const anotar = (m: Map<string, number | null>, k: string, id: number) => {
    if (!m.has(k)) { m.set(k, id); return; }
    if (m.get(k) !== id) m.set(k, null);
  };
  try {
    // ⚠️ NINGÚN FILTRO, Y NO ES UN OLVIDO: el cruce mira TODAS las etapas y todos los
    // estados. «No contesta» y «Perdido» siguen siendo la misma persona, así que un
    // filtro por etapa, por `estado_lead` o por funnel acá es lo que CREA el duplicado
    // (Martín, 04/10/2026: «no solo los Ganados sino todos los leads de cualquier
    // etapa»). Medido ese día: entran las 1.549 filas de los 6 workspaces con leads, 72
    // de ellas en un estado terminal — y entran. El único recorte es el `workspace_id`
    // que pone getTenantDb, que es aislamiento y no un filtro de producto.
    //
    // ⚠️ Y VIAJA `telefono_normalizado` ADEMÁS DEL `telefono`: es la llave con la que
    // matchean todos los webhooks, así que un lead con la llave puesta y el `telefono`
    // vacío está en el CRM aunque esta lectura no lo viera. Hoy son 0 filas en los 6
    // workspaces; cuesta una columna y cierra el caso antes de que exista.
    await leerPorPaginas<{ id: number; email: string | null; telefono: string | null; telefono_normalizado: string | null }>(
      db, 'leads', 'id, email, telefono, telefono_normalizado',
      (chunk) => {
        for (const r of chunk) {
          if (r.email) anotar(emails, r.email.trim().toLowerCase(), r.id);
          const { exacta, sufijo } = clavesDeTelefono(r.telefono || r.telefono_normalizado || '');
          if (exacta) anotar(tels, exacta, r.id);
          if (sufijo) anotar(telsSufijo, sufijo, r.id);
        }
      },
    );
  } catch (e) {
    // Se relanza con contexto: un índice a medias no se puede usar (ver arriba),
    // así que esto NUNCA degrada a "no hay duplicados".
    throw new Error(`No se pudo revisar los duplicados: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { emails, tels, telsSufijo };
}

/**
 * Marca qué filas ya existen en el CRM —y CUÁL es el lead que ya existe— y recalcula
 * todos los motivos de descarte. Se corre DOS veces: al leer el archivo (para
 * mostrarlo) y al confirmar (porque entre una cosa y la otra pudo entrar un lead por el
 * webhook de Calendly o Meta).
 *
 * ⚠️ EL ID LO RESUELVE ACÁ EL SERVER, Y NO SE LE CREE AL NAVEGADOR. Es lo que decide a
 * quién se le escribe cuando la persona elige «completar» en vez de «duplicar» (#623),
 * o sea el único camino de esta pantalla que ESCRIBE sobre un lead que ya existe. Un id
 * que viaja en el payload del cliente es un id que cualquiera puede cambiar.
 *
 * ⚠️ Y SI LAS DOS SEÑALES APUNTAN A LEADS DISTINTOS, NO HAY ID. Pasa de verdad: el email
 * de la fila es el de la ficha de Ana y el teléfono es el de la de Juan (el mail de la
 * empresa, el número de la recepción). Ahí «ya existe» sigue siendo cierto y «a quién
 * completar» no tiene respuesta — se ofrece saltear o duplicar, que es lo reversible.
 */
export async function marcarExistentes(filas: FilaImport[]): Promise<FilaImport[]> {
  const { emails, tels, telsSufijo } = await indiceContactos();
  return recalcular(filas.map((f) => {
    const email = f.email.trim().toLowerCase();
    // `undefined` = ese dato no está en el CRM. `null` = está y lo tienen dos leads.
    const porEmail = email && emails.has(email) ? emails.get(email) ?? null : undefined;
    // El teléfono lo decide `buscarTelefono` (exacto primero, sufijo después), que vive
    // sin `server-only` en ./leads-importar para que la COMPARACIÓN tenga test.
    const porTel = buscarTelefono({ exactos: tels, sufijos: telsSufijo }, f.telefono);
    const apuntan = [porEmail, porTel].filter((v) => v !== undefined);
    const unico = apuntan.length && apuntan.every((v) => v != null && v === apuntan[0])
      ? (apuntan[0] as number)
      : null;
    return { ...f, yaExiste: apuntan.length > 0, leadExistenteId: unico };
  }));
}

const SISTEMA_EXTRAER = `Eres un extractor de contactos. Recibes el TEXTO de un documento (una lista, una tabla, una captura, un PDF) y devuelves SOLO JSON con esta forma:
{"contactos":[{"nombre":"","email":"","telefono":"","empresa":"","seguro":true}]}

Reglas:
- Un objeto por PERSONA. No inventes datos: si un campo no está en el texto, déjalo como cadena vacía.
- "nombre" es el nombre de la persona; "empresa" es la organización, nunca el nombre de la persona.
- Si el documento trae el nombre y el apellido SEPARADOS (dos columnas, o "Apellido Paterno" y "Apellido Materno"), "nombre" es todo junto y en ese orden: nombre primero, apellidos después. Nunca devuelvas sólo el nombre de pila.
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

  // Un .xlsx sale de `archivoATexto` como TSV (una hoja por bloque), así que entra
  // por el parser exacto y no gasta una llamada de IA. Si la planilla no tiene
  // encabezados reconocibles se deja seguir al camino de la IA de abajo: el texto ya
  // está extraído, así que no cuesta una segunda lectura del archivo.
  if (esPlanillaLeible(nombre) && lectura.texto.trim()) {
    const r = filasDesdePlanilla(lectura.texto);
    if (r.filas.length) return { filas: r.filas, viaIA: false };
  }
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
