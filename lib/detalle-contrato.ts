// =============================================================================
// detalle-contrato — UN solo contrato del detalle, para los cinco orígenes
// =============================================================================
// Una tarea nace por cinco caminos (una reunión de Fathom, un WhatsApp, un archivo
// subido, Claude Code, o a mano) y hasta acá cada uno tenía su propio contrato del
// `detalle` — o ninguno. Medido en producción sobre 475 tareas del tablero del dueño:
//
//   claude-code  n=44   p50=1282 chars · 43% con el molde de 4 partes
//   whatsapp     n=97   p50=469         ·  0%
//   fathom       n=150  p50=228         ·  0%   ← y NINGUNA llega a los 600 que su
//                                                  propio prompt declara como piso
//   seeds/manual n=184  p50=303         ·  0%
//
// O sea: el único camino que cumple es el que escribe un humano a mano. El contrato
// existía en tres lugares distintos, escrito de tres formas, y se cumplía en uno.
//
// LA REGLA QUE ATRAVIESA TODO: el detalle es lo único que hace que una tarea se pueda
// ejecutar dentro de tres semanas sin volver a la fuente — y a la fuente no se vuelve
// nunca. Pero (y esto es la otra mitad, la que se estaba rompiendo) **un detalle largo
// inventado es peor que uno corto y honesto**: hace confiar en algo que no pasó.
// Por eso el contrato pide 4 partes y al mismo tiempo PROHÍBE rellenar.
// =============================================================================

/** Los cuatro títulos, en orden. Son EXACTOS: `evaluarDetalle` los busca literales, y
 *  cambiarlos acá cambia a la vez lo que se pide y lo que se valida. */
export const PARTES_DETALLE = ['Qué hay que hacer', 'Por qué', 'Detalles concretos', 'Listo cuando'] as const;

/** El contrato largo: va en los prompts de sistema (Fathom, archivo, checklist-coach). */
export const CONTRATO_DETALLE = `EL DETALLE ES EL CAMPO MÁS IMPORTANTE. El título dice QUÉ hacer; el detalle es lo único que hace que la tarea se pueda ejecutar dentro de tres semanas sin volver a la fuente — y a la fuente no se vuelve nunca.

FORMATO — markdown, estos cuatro títulos EXACTOS, en este orden. Copiá los asteriscos tal cual:

**Qué hay que hacer**
La acción concreta, 1-2 frases.

**Por qué**
A qué problema responde y qué pasa si no se hace. Si alguien lo pidió, la frase TEXTUAL entre « », con quién y cuándo.

**Detalles concretos**
- los números, nombres propios, archivo:línea y links TAL CUAL
- las condiciones ("si el CPL baja de 5, entonces…")
- lo que quedó DESCARTADO y por qué

**Listo cuando**
El criterio de terminado, verificable por alguien que no estuvo en la conversación.

LARGO — 4 a 8 frases (unos 600 a 1200 caracteres) CUANDO EL MATERIAL DA PARA ESO.

⛔ NO RELLENES. Un detalle de 300 caracteres honesto es MEJOR que uno de 700 con paja. Si el material solo alcanza para dos de las cuatro partes, escribí esas dos y omití las otras: un «Listo cuando» inventado es peor que ninguno.
⛔ NO REPITAS EL TÍTULO con otras palabras: eso es un detalle vacío.
⛔ NO SUPONGAS. Si no sabés por qué lo pidió, no lo escribas.`;

/** Tres líneas, para el `description` de un schema de tool y para las skills. */
export const CONTRATO_DETALLE_CORTO = `Markdown con estos cuatro títulos exactos, en orden: **Qué hay que hacer** / **Por qué** (con la frase textual entre « » si alguien lo pidió) / **Detalles concretos** (lista con "- ": números, nombres, links tal cual, lo descartado) / **Listo cuando**. Apuntá a 600-1200 caracteres si el material da. ⛔ NO rellenes ni supongas: si solo da para dos partes, escribí dos. Un detalle corto y honesto es mejor que uno largo inventado.`;

/** Un ejemplo LITERAL de salida. Nombrar las partes en prosa no alcanzó: el modelo leyó
 *  los `**` como énfasis del autor y devolvió etiquetas planas («Cita:», «Por qué:»).
 *  Con un ejemplo copiable, copia. */
export const EJEMPLO_DETALLE = `**Qué hay que hacer**
Que el botón de importar abra la bandeja de archivos en vez del buscador del sistema operativo.

**Por qué**
Martín, el 5/8: «cuando apreto el botón, no me debe abrir el buscador de archivos directamente, me debe abrir el modal de importación, donde vea como se van importanto». Hoy elegís un archivo a ciegas y si falla desaparece sin decir por qué.

**Detalles concretos**
- Hasta 12 archivos, 25 MB cada uno y 18 MB en total (el proxy corta el body en 20 MB)
- Formatos: .md/.txt/.vtt/.srt, .docx, .pdf, imágenes y audio
- El molde es la subida de videos de «Nueva campaña»
- Se descartó subir de a uno con reintento: no resuelve el caso de 4 archivos de una reunión

**Listo cuando**
Se arrastran cuatro archivos de distinto tipo, se ve el peso y qué va a hacer con cada uno, y el que falla dice por qué sin llevarse a los otros.`;

/** EL MOLDE, listo para meter adentro de un `description` de una sola línea.
 *
 *  Va adentro de la `description` de un campo de un JSON schema o de una tool, que
 *  tiene que ser un string plano. Es LO QUE DE VERDAD FUNCIONÓ: describir las cuatro
 *  partes en prosa daba detalles de 800 caracteres perfectos en contenido y en prosa
 *  corrida, 0 de 6 con secciones. Con el molde literal adentro del campo, 5 de 5.
 *
 *  Si esto cambia, cambia para los cinco orígenes a la vez. Ese es el punto. */
export const MOLDE_DETALLE = [
  '**Qué hay que hacer**', 'La acción concreta, 1-2 frases.', '',
  '**Por qué**', 'A qué problema responde. Si alguien lo pidió, la frase TEXTUAL entre « » con quién.', '',
  '**Detalles concretos**', '- números, nombres, archivo:línea, LINKS TAL CUAL', '- lo que se descartó y por qué', '',
  '**Listo cuando**', 'El criterio de terminado, verificable.',
].join('\n');

/** La advertencia que acompaña al molde. Misma razón: una sola fuente. */
export const MOLDE_ADVERTENCIA = 'Copiá esta forma EXACTA, con los asteriscos y los saltos de línea. Apuntá a 600-1200 caracteres si el material da para eso. ⛔ NO escribas prosa corrida: sin estos cuatro títulos el detalle NO sirve por más largo y mejor escrito que esté. ⛔ NO rellenes ni supongas: si el material solo da para dos partes, escribí dos — un detalle corto y honesto vale más que uno largo inventado.';

// =============================================================================
// El contrato del detalle de un PROYECTO — distinto al de una tarea
// =============================================================================
// Una tarea se ejecuta; un proyecto se entiende. Por eso las cuatro partes son otras:
// nadie «termina» un proyecto, así que un «Listo cuando» ahí no significa nada.
//
// El problema medido: los 39 proyectos del tablero del dueño tienen entre 107 y 1.810
// caracteres de prosa corrida SIN UN SOLO SALTO DE LÍNEA. El campo se pinta con
// `RichText`, que convierte markdown a HTML (app/plan/board/RichText.tsx → mdAHtml),
// así que un texto sin saltos termina en UN solo <div> de mil ochocientos caracteres.
// El contenido era bueno; era ilegible igual.
//
// Y la forma YA estaba adentro de la prosa: casi todos siguen «Es …» → «ya está /
// YA funcionan» → «Falta / Queda» → «Importa porque». Esto solo la saca a la superficie.
export const PARTES_PROYECTO = ['Qué es', 'Qué ya está', 'Qué falta', 'Por qué importa'] as const;

export const MOLDE_PROYECTO = [
  '**Qué es**', 'De qué se trata el proyecto, en 1-2 frases.', '',
  '**Qué ya está**', 'Lo construido, verificable: rutas, archivos, migraciones.', '',
  '**Qué falta**', '- lo que queda, con el # de la tarea que lo cubre', '',
  '**Por qué importa**', 'Qué se gana o qué se rompe según esté o no.',
].join('\n');

/** Mismo diagnóstico que `evaluarDetalle` pero con las partes del proyecto. */
export function evaluarDetalleProyecto(d: string): EvalDetalle {
  const t = (d ?? '').trim();
  const n = norm(t);
  const partes: string[] = [];
  for (const p of PARTES_PROYECTO) {
    if (n.includes(norm(`**${p}**`)) || n.includes(norm(`${p}\n`)) || n.includes(norm(`${p}:`))) partes.push(p);
  }
  return { chars: t.length, partes, faltan: PARTES_PROYECTO.filter((p) => !partes.includes(p)), conForma: partes.length >= 2 };
}

export type EvalDetalle = {
  chars: number;
  /** los títulos del contrato que SÍ están, en el orden en que aparecen. */
  partes: string[];
  /** los que faltan. */
  faltan: string[];
  /** true si tiene al menos dos partes: el piso para considerarlo «con forma». */
  conForma: boolean;
};

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Diagnostica un detalle. NO decide nada: devuelve los hechos para que quien llama
 * decida si reintenta, si avisa o si lo deja pasar.
 *
 * A propósito NO valida por largo: hay tareas legítimas de una línea («llamar a Juan»),
 * y rechazar por chars es lo que empuja al modelo a rellenar — justo lo que rompe.
 */
export function evaluarDetalle(d: string): EvalDetalle {
  const t = (d ?? '').trim();
  const n = norm(t);
  const partes: string[] = [];
  for (const p of PARTES_DETALLE) {
    // Con o sin asteriscos: si el modelo escribió el título en texto plano igual cuenta
    // como intención de cumplir; lo que se corrige después es la forma, no el contenido.
    if (n.includes(norm(`**${p}**`)) || n.includes(norm(`${p}\n`)) || n.includes(norm(`${p}:`))) partes.push(p);
  }
  const faltan = PARTES_DETALLE.filter((p) => !partes.includes(p));
  return { chars: t.length, partes, faltan, conForma: partes.length >= 2 };
}

/** ¿El lote cumple lo suficiente como para no reintentar? Se mide POR LOTE y no por
 *  tarea: una tarea suelta puede no dar para cuatro partes con material honesto, pero
 *  si el 60% del lote no tiene ni dos, el que no entendió fue el modelo. */
export function loteCumple(detalles: string[], minRatio = 0.6): boolean {
  if (!detalles.length) return true;
  const ok = detalles.filter((d) => evaluarDetalle(d).conForma).length;
  return ok / detalles.length >= minRatio;
}
