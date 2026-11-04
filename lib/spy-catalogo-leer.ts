// =============================================================================
// spy-catalogo-leer — lee la tabla del catálogo de funnels y formatos (docs/catalogo-funnels-y-formatos.md, §4) (4/11/2026)
// =============================================================================
// El catálogo es la investigación (con sus fuentes) y su §4 es la tabla para el código, en YAML. Este lector la convierte en datos;
// `scripts/spy-catalogo-a-codigo.mts` la escribe en lib/spy-catalogo-datos.ts, y tests/spy-funnel-tipo.test.ts falla si los dos
// se separan. Así la clasificación SALE del catálogo (pedido del Cerebro, 4/11) sin leer un `.md` en producción.
//
// Sin dependencias: la tabla usa sólo `- id:`, claves de una palabra y valores que son una lista JSON o un texto suelto.
// =============================================================================

export type EntradaCatalogo = {
  id: string;
  label: string;
  /** Qué es, en una línea: lo que lee quien mira la ficha («Vende entradas a un evento en un lugar…»). Sólo en los funnels. */
  que?: string;
  fuertes?: string[];
  debiles?: string[];
  compuestas?: string[];
  descarta?: string[];
  nota_hibrido?: string[];
  hosts?: string[];
};

/** El bloque YAML que sigue al título dado (`### 4.1 Funnels`). Vacío si no está. */
function bloqueDe(md: string, titulo: string): string {
  const i = md.indexOf(titulo);
  if (i < 0) return '';
  const a = md.indexOf('```yaml', i);
  const b = a < 0 ? -1 : md.indexOf('```', a + 7);
  return a < 0 || b < 0 ? '' : md.slice(a + 7, b);
}

function leerBloque(bloque: string): EntradaCatalogo[] {
  const out: EntradaCatalogo[] = [];
  let actual: EntradaCatalogo | null = null;
  for (const linea of bloque.replace(/\r\n/g, '\n').split('\n')) {
    const id = /^- id:\s*(\S+)\s*$/.exec(linea);
    if (id) { actual = { id: id[1], label: id[1] }; out.push(actual); continue; }
    const kv = /^\s{2}(\w+):\s*(.+?)\s*$/.exec(linea);
    if (!kv || !actual) continue;
    const [, clave, valor] = kv;
    if (clave === 'label') { actual.label = valor; continue; }
    if (clave === 'que') { actual.que = valor; continue; }
    if (valor.startsWith('[')) (actual as Record<string, unknown>)[clave] = JSON.parse(valor) as string[];
  }
  return out;
}

export function leerCatalogo(md: string): { funnels: EntradaCatalogo[]; formatos: EntradaCatalogo[] } {
  return { funnels: leerBloque(bloqueDe(md, '### 4.1 Funnels')), formatos: leerBloque(bloqueDe(md, '### 4.2 Formatos')) };
}
