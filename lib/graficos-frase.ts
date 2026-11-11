// =============================================================================
// graficos-frase — la ORACIÓN DE APERTURA de una hoja: lo que pasa, en una línea, con los números del negocio
// =============================================================================
// Martín, 1/11/2026 (docs/templates-dashboard-propuesta.md §1.1 y §7.2.1): las referencias de codeandchill abren con una
// FRASE que dice qué pasa hoy, no con un gráfico. Orvel: «entraron €3.445 ayer, 9 facturas esperan tu aprobación y 14 pagos
// hay que archivar». Tres hechos, uno accionable. Nosotros abríamos con un panel.
//
// Es un gráfico más (tipo `frase`, lib/graficos-catalogo.ts): lee sus métricas del conjunto como cualquier número, y la
// pantalla las escribe adentro de un PATRÓN (`Grafico.frase`): «Entraron {cobrado} · {agendas} agendas · {cierres} cierres».
//
// LAS REGLAS:
//   · El patrón se parte en TRAMOS por « · ». Un tramo cuyo número no se puede leer (null) NO SE DIBUJA: sin dato no se dice
//     «falta» (AGENTS.md). Un cero sí: es una medición.
//   · `{id}` es el valor de esa métrica, con su formato. `{id:cambio}` es cuánto cambió contra el período anterior del mismo
//     largo («18% más», «6% menos», «igual»): necesita `comparar` en el gráfico, y sin período anterior con algo el tramo
//     se va (dividir por cero no es un dato).
//   · Un `{id}` que no es una métrica del gráfico deja el tramo afuera: una llave cruda en una oración se lee como un error.
//   · Sin patrón, la frase se arma sola: «US$12.400 cobrado · 48 agendas».
// ⚠️ Puro y sin server-only: lo leen la pantalla, la miniatura, el teléfono y los tests.
// =============================================================================

/** Lo que la frase necesita de una métrica: su id, su nombre y cómo se escribe su valor. */
export type ColumnaFrase = { id: string; nombre: string };

/** Un pedazo de un tramo: texto suelto, o un número (que la pantalla resalta). */
export type ParteFrase = { texto: string; numero?: true };
export type TramoFrase = ParteFrase[];

/** El tope del patrón, en caracteres (lo que entra en una línea a lo ancho). */
export const TOPE_FRASE = 200;

const SEPARADOR = /\s+·\s+/;
const LLAVE = /\{([a-z0-9_]+)(?::(cambio))?\}/g;

/** El patrón que se arma solo, sin escribir uno: «{cobrado} cobrado · {agendas} agendas». */
export function fraseDeEntrada(columnas: readonly ColumnaFrase[]): string {
  return columnas.map((c) => `{${c.id}} ${c.nombre.toLocaleLowerCase('es')}`).join(' · ');
}

/** Cuánto cambió, en palabras: «18% más», «6% menos», «igual». null = no hay con qué comparar. */
export function cambioEnPalabras(ahora: number | null | undefined, antes: number | null | undefined): string | null {
  if (ahora == null || antes == null || !Number.isFinite(ahora) || !Number.isFinite(antes) || !(antes > 0)) return null;
  const pct = Math.round(((ahora - antes) / antes) * 100);
  if (pct === 0) return 'igual';
  return `${Math.abs(pct).toLocaleString('es-AR')}% ${pct > 0 ? 'más' : 'menos'}`;
}

/**
 * Los tramos de la frase, listos para dibujar. `valor(i)` devuelve el número ya escrito de la métrica `i` (o null si no se
 * pudo leer); `cambio(i)`, su cambio en palabras (o null).
 */
export function tramosDeFrase(
  patron: string | null | undefined,
  columnas: readonly ColumnaFrase[],
  valor: (i: number) => string | null,
  cambio: (i: number) => string | null,
): TramoFrase[] {
  const base = (patron ?? '').trim() || fraseDeEntrada(columnas);
  const indice = new Map(columnas.map((c, i) => [c.id, i] as const));
  const out: TramoFrase[] = [];
  for (const crudo of base.split(SEPARADOR)) {
    const tramo = crudo.trim();
    if (!tramo) continue;
    const partes: ParteFrase[] = [];
    let ultimo = 0;
    let vale = true;
    for (const m of tramo.matchAll(LLAVE)) {
      const i = indice.get(m[1]);
      const v = i == null ? null : m[2] === 'cambio' ? cambio(i) : valor(i);
      if (v == null) { vale = false; break; }
      if (m.index! > ultimo) partes.push({ texto: tramo.slice(ultimo, m.index) });
      partes.push({ texto: v, numero: true });
      ultimo = m.index! + m[0].length;
    }
    if (!vale) continue;
    if (ultimo < tramo.length) partes.push({ texto: tramo.slice(ultimo) });
    // Una llave que no calzó con la forma (`{Cobrado}`, `{ x }`) queda cruda en el texto: ese tramo se va.
    if (partes.some((p) => !p.numero && /[{}]/.test(p.texto))) continue;
    out.push(enSingular(partes));
  }
  return out;
}

/**
 * Las palabras de las frases de las plantillas que van después de un número, en singular. Con «1» la frase decía «Entraron 3
 * visitas de 1 personas» (11/11/2026, Landing en el teléfono). Sólo las que usan las plantillas: una palabra que no está queda.
 */
const SINGULAR: Readonly<Record<string, string>> = {
  veces: 'vez', llamadas: 'llamada', agendas: 'agenda', tareas: 'tarea', personas: 'persona', clientes: 'cliente', cierres: 'cierre',
  visitas: 'visita', sesiones: 'sesión', mensajes: 'mensaje', interesados: 'interesado', cuotas: 'cuota', clases: 'clase', vencidos: 'vencido',
  leads: 'lead', agendaron: 'agendó', vieron: 'vio', tocaron: 'tocó', llegaron: 'llegó', fallaron: 'falló',
};

/** Después de un número que es «1», la palabra que sigue en singular («1 persona», «1 agendó»). */
function enSingular(partes: ParteFrase[]): ParteFrase[] {
  return partes.map((p, i) => {
    const antes = partes[i - 1];
    if (p.numero || !antes?.numero || antes.texto !== '1') return p;
    const m = /^(\s+)([a-záéíóúñ]+)/i.exec(p.texto);
    const uno = m ? SINGULAR[m[2].toLowerCase()] : undefined;
    return uno ? { ...p, texto: m![1] + uno + p.texto.slice(m![0].length) } : p;
  });
}

/** La frase como texto plano (el teléfono, el lector de pantalla, lo que ve MaKo). */
export const fraseEnTexto = (tramos: readonly TramoFrase[]): string => tramos.map((t) => t.map((p) => p.texto).join('')).join(' · ');

/** Los ids de métrica que nombra un patrón (para validar una plantilla o un pedido de la API). */
export function metricasDeFrase(patron: string): string[] {
  return [...new Set([...patron.matchAll(LLAVE)].map((m) => m[1]))];
}
