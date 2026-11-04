'use client';

// =============================================================================
// Frase — la oración de apertura de una hoja, con los números del negocio adentro (lib/graficos-frase.ts)
// =============================================================================
// Las referencias de codeandchill abren con una frase y no con un panel (Orvel: «entraron €3.445 ayer, 9 facturas esperan tu
// aprobación…»). Los números van en la tinta y en peso, el resto en `--dim`: se lee de un vistazo qué cifra es de hoy.
// Un tramo sin dato no se dibuja (la regla vive en `tramosDeFrase`). Si no queda ningún tramo, la frase lo dice en una línea.

import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { cambioEnPalabras, fraseEnTexto, tramosDeFrase } from '@/lib/graficos-frase';

export function Frase({ r, patron, compacto }: { r: Resultado; patron: string | undefined; compacto: boolean }) {
  const tramos = tramosDeFrase(
    patron,
    r.columnas,
    (i) => (r.totales[i] == null ? null : fmtValor(r.totales[i], r.columnas[i].formato, compacto)),
    (i) => cambioEnPalabras(r.totales[i], r.anterior?.[i]),
  );
  if (!tramos.length) return <p className="gr-frase gr-frase--vacia">Todavía no hay números para este período.</p>;
  return (
    <p className="gr-frase" aria-label={fraseEnTexto(tramos)}>
      {tramos.map((t, i) => (
        <span key={i} className="gr-frase-tramo">
          {i > 0 && <span className="gr-frase-punto" aria-hidden="true"> · </span>}
          {t.map((p, j) => (p.numero ? <b key={j}>{p.texto}</b> : <span key={j}>{p.texto}</span>))}
        </span>
      ))}
    </p>
  );
}
