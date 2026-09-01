import 'server-only';

// =============================================================================
// Los formatos del cliente — leerlos, y resolverlos junto a los de fábrica
// =============================================================================
// ── Por qué existe una segunda fuente ──────────────────────────────────────
// `CATALOGO_PUESTAS` son los DOS formatos de fábrica y vive en código. Los que
// crea un cliente viven en `formatos` (mig 0152), uno por workspace.
//
// Esto es «una cosa, un lugar» con una excepción declarada: hay dos fuentes
// porque son dos cosas distintas —lo que ofrecemos nosotros y lo que hizo el
// cliente— y quien las junta es UNA sola función, `puestaDe`. Cualquier otro
// lugar que resuelva un formato por su cuenta va a quedarse con la mitad.
//
// ⚠️ Y ESTE MÓDULO ES `server-only` A PROPÓSITO, aunque `puestas-data` no lo sea.
//
// `puestas-data` se puede importar desde un componente cliente porque son dos
// constantes: 30 KB que ya viajan al navegador y que son producto público. Los
// formatos del cliente NO: salen de la base, son de UN workspace, y un import
// desde el navegador sería la puerta para que la pantalla de un cliente resuelva
// el formato de otro. Al cliente le bajan por PROPS, ya filtrados por el server
// — que es la regla de la casa: lo que el cliente necesita se resuelve en el
// server y baja resuelto.

import { getTenantDb } from '@/lib/workspace';
import { puestaPorId, puestasOfrecidas, type Puesta, type Camara, type Habla } from '@/lib/puestas-data';

/** Lo que la base guarda de un formato. Sólo lo que se lee acá. */
type FilaFormato = {
  id: string; nombre: string; tecnico: string; descripcion: string; cuando: string;
  personas: number; clips_min: number; clips_max: number;
  segundos_min: number; segundos_max: number;
  camara: string; habla: string; ritmo: string; densidad: number | string;
  escenarios: number; reglas: unknown; estado: string;
  prompt_imagen: string; prompt_video: string;
  ejemplo_video: string; ejemplo_poster: string; ejemplo_seg: number | string | null;
};

/**
 * De una fila a un `Puesta`, que es lo que todo el resto de la tab entiende.
 *
 * ⚠️ EL `ejemplo` SÓLO SE ARMA SI HAY VIDEO, y de eso depende que el formato se
 * ofrezca: `puestasOfrecidas()` filtra por `p.ejemplo`. Es el mismo control que
 * el `check` de la base, del lado de la lectura — no porque se desconfíe de la
 * base, sino porque un formato que llegue sin ejemplo por cualquier camino
 * (una migración vieja, una escritura a mano) no puede colarse al menú.
 */
export function puestaDeFila(f: FilaFormato): Puesta {
  const reglas = Array.isArray(f.reglas) ? f.reglas.filter((r): r is string => typeof r === 'string') : [];
  const seg = Number(f.ejemplo_seg);
  return {
    id: f.id,
    nombre: f.nombre,
    tecnico: f.tecnico,
    descripcion: f.descripcion,
    cuando: f.cuando,
    personas: (f.personas === 2 ? 2 : 1),
    clips: [f.clips_min, f.clips_max],
    segundosClip: [f.segundos_min, f.segundos_max],
    camara: f.camara as Camara,
    habla: f.habla as Habla,
    ritmo: f.ritmo || undefined,
    densidad: Number(f.densidad),
    escenarios: f.escenarios,
    characterSheet: false,
    reglas,
    // De dónde salió, para poder volver a la fuente. En los de fábrica es un
    // documento; en éstos, quién lo creó y cuándo.
    fuente: 'Creado en MaKo por el cliente',
    // ⚠️ `medido`, y con una diferencia que conviene tener presente: un formato
    // del cliente se validó con UN clip, y los de fábrica con un anuncio entero
    // producido de punta a punta. Los dos están medidos —ninguno se ofrece sin
    // haberse producido— pero no con la misma profundidad. No se inventa un
    // tercer valor para eso: `Confianza` gobierna cómo se pinta la tarjeta, y un
    // valor nuevo tocaría todo lo que la lee para expresar un matiz que hoy no
    // cambia ninguna decisión.
    confianza: 'medido',
    ejemplo: f.ejemplo_video
      ? {
        video: f.ejemplo_video,
        poster: f.ejemplo_poster || f.ejemplo_video,
        completo: f.ejemplo_video,
        duracionSeg: Number.isFinite(seg) ? seg : 0,
      }
      : undefined,
  };
}

const CAMPOS = 'id, nombre, tecnico, descripcion, cuando, personas, clips_min, clips_max, '
  + 'segundos_min, segundos_max, camara, habla, ritmo, densidad, escenarios, reglas, estado, '
  + 'prompt_imagen, prompt_video, ejemplo_video, ejemplo_poster, ejemplo_seg';

/** Los formatos de ESTE workspace, en el orden en que se crearon. */
export async function formatosDelWorkspace(incluirBorradores = false): Promise<Puesta[]> {
  try {
    const db = await getTenantDb();
    const estados = incluirBorradores ? ['borrador', 'listo'] : ['listo'];
    const { data } = await db
      .from('formatos')
      .select(CAMPOS)
      .in('estado', estados)
      .order('created_at', { ascending: false });
    return ((data ?? []) as unknown as FilaFormato[]).map(puestaDeFila);
  } catch {
    // ⚠️ Un fallo de lectura devuelve los de FÁBRICA, no una lista vacía: que la
    // base no conteste no puede dejar a alguien sin poder hacer un anuncio.
    return [];
  }
}

/**
 * TODO lo que se puede elegir: los de fábrica y los del cliente.
 *
 * Los de fábrica van primero — están medidos contra un anuncio entero — y los
 * del cliente después, en orden de creación.
 */
export async function formatosOfrecidos(): Promise<Puesta[]> {
  return [...puestasOfrecidas(), ...(await formatosDelWorkspace())];
}

/**
 * Un formato por su id, mire donde mire.
 *
 * ⚠️ Y RESUELVE TAMBIÉN LOS ARCHIVADOS, que es el punto entero de que
 * `archivado` no sea un borrado. Los anuncios guardados referencian el formato
 * por su id adentro de `video-generator.historial`: si dejara de resolverse,
 * cada anuncio hecho con él se rompería —sin poder filmar, sin poder montar— por
 * haber sacado el formato del menú. Sacar algo de un catálogo no es borrarlo:
 * hay gente apuntándole.
 */
export async function puestaDe(id: string): Promise<Puesta | undefined> {
  const deFabrica = puestaPorId(id);
  if (deFabrica) return deFabrica;
  if (!id.startsWith('ws')) return undefined;

  try {
    const db = await getTenantDb();
    const { data } = await db.from('formatos').select(CAMPOS).eq('id', id).maybeSingle();
    return data ? puestaDeFila(data as unknown as FilaFormato) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Los dos prompts validados de un formato del cliente.
 *
 * Van aparte de `Puesta` porque los de fábrica no los guardan ahí: viven en
 * `PROMPT_IMAGEN` y `PROMPT_VIDEO`, indexados por id. Quien los consuma tiene
 * que preguntar por los dos lados, igual que con el formato.
 */
export async function promptsDelFormato(id: string): Promise<{ imagen: string; video: string } | null> {
  if (!id.startsWith('ws')) return null;
  try {
    const db = await getTenantDb();
    const { data } = await db.from('formatos').select('prompt_imagen, prompt_video').eq('id', id).maybeSingle();
    if (!data) return null;
    return { imagen: String(data.prompt_imagen || ''), video: String(data.prompt_video || '') };
  } catch {
    return null;
  }
}
