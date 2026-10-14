// =============================================================================
// resumen-ficha — qué datos muestra el Resumen de la ficha del lead, en ESTE negocio
// =============================================================================
// Martín (13/10/2026, Resumen punto 1): «el usuario puede querer ver distintos tipos de
// información en el resumen... unos su IG, otros su YouTube, otros su Web, LinkedIn, dirección,
// otros su sexo, otros quieren ver la respuesta del instant form, las respuestas del form de
// opt-in, etc... lo hagas personalizable, que sea simple y que el diseño sea bonito».
//
// Nombre, empresa, teléfono y email no se apagan: son el contacto, y sin ellos no hay ficha.
// Lo demás se prende o se apaga por negocio (lo decide el admin, lo ve todo el equipo).
//
// Se guarda lo que alguien ELIGIÓ; lo que nadie tocó toma su `porDefecto`. Así un dato nuevo
// del catálogo nace con su default en todos los negocios sin que nadie se acuerde de sumarlo, y
// lo que ya se veía antes de existir esto (web, Instagram, ingreso, cohorte, el formulario de
// Meta) sigue viéndose.
//
// Sin `server-only`, para que tenga test y lo lea la pantalla.
// =============================================================================

export type CampoResumen =
  | 'web' | 'instagram' | 'youtube' | 'linkedin' | 'direccion' | 'sexo'
  | 'ingreso' | 'cohorte' | 'form_meta' | 'form_landing';

export const CAMPOS_RESUMEN: ReadonlyArray<{ id: CampoResumen; label: string; grupo: 'Datos' | 'Formularios'; porDefecto: boolean }> = [
  { id: 'web', label: 'Web', grupo: 'Datos', porDefecto: true },
  { id: 'instagram', label: 'Instagram', grupo: 'Datos', porDefecto: true },
  { id: 'youtube', label: 'YouTube', grupo: 'Datos', porDefecto: false },
  { id: 'linkedin', label: 'LinkedIn', grupo: 'Datos', porDefecto: false },
  { id: 'direccion', label: 'Dirección', grupo: 'Datos', porDefecto: false },
  { id: 'sexo', label: 'Sexo', grupo: 'Datos', porDefecto: false },
  { id: 'ingreso', label: 'Ingreso estimado', grupo: 'Datos', porDefecto: true },
  { id: 'cohorte', label: 'Cohorte', grupo: 'Datos', porDefecto: true },
  { id: 'form_meta', label: 'Formulario de Meta', grupo: 'Formularios', porDefecto: true },
  { id: 'form_landing', label: 'Formulario de la landing', grupo: 'Formularios', porDefecto: true },
];

/** Lo que eligió el negocio. Lo que no está, nadie lo tocó. */
export type ResumenElegido = Partial<Record<CampoResumen, boolean>>;

const IDS = new Set<string>(CAMPOS_RESUMEN.map((c) => c.id));

export function sanearResumen(v: unknown): ResumenElegido {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: ResumenElegido = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (IDS.has(k) && typeof x === 'boolean') out[k as CampoResumen] = x;
  }
  return out;
}

/** ¿Se ve este dato? Lo elegido, y si nadie eligió, su default. */
export function seVe(elegido: ResumenElegido | null | undefined, id: CampoResumen): boolean {
  const e = elegido?.[id];
  if (typeof e === 'boolean') return e;
  return CAMPOS_RESUMEN.find((c) => c.id === id)?.porDefecto ?? false;
}

/** El sexo del lead, como lo guarda `leads.sexo` (mig 0274). */
export const SEXOS: ReadonlyArray<{ id: 'mujer' | 'hombre' | 'otro'; label: string }> = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'otro', label: 'Otro' },
];
export const esSexo = (v: unknown): v is 'mujer' | 'hombre' | 'otro' => v === 'mujer' || v === 'hombre' || v === 'otro';
