'use client';

// =============================================================================
// TextoMarcas — el dialecto de WhatsApp, PINTADO
// =============================================================================
// «El mensaje tiene cosas como ** pero no se formatea, eso está mal.»
//
// El texto de un mensaje se guarda con las marcas del canal (`*negrita*`,
// `_itálica_`, `~tachado~`) porque eso es lo que WhatsApp entiende y lo que el
// email traduce solo. Pero mostrarlo CRUDO en una vista previa hace las dos cosas
// mal a la vez: no se ve cómo va a llegar, y los asteriscos se leen como un error
// de tipeo del texto.
//
// ⚠️ ES UN RENDER, NO UN SANEO. Lo que se guarda no cambia: el modelo sigue
// siendo el string con marcas. Acá sólo se decide cómo se DIBUJA, y por eso
// devuelve nodos de React y no HTML — `dangerouslySetInnerHTML` sobre texto que
// escribe una persona es una inyección esperando, y el email ya tiene su propio
// camino escapado (`marcasAHtml` en lib/email-html.ts).
//
// ⚠️ Y LAS REGLAS SON LAS DE WHATSAPP, NO LAS DE MARKDOWN. Una marca abre y
// cierra en la MISMA línea y no puede estar vacía: `**` suelto —lo que deja el
// botón de negrita cuando no hay nada seleccionado— es texto, no una negrita
// vacía. Tratarlo como markdown haría desaparecer los asteriscos de la pantalla y
// que al lead le lleguen igual.

import { Fragment, type ReactNode } from 'react';
import { tramosConVariables } from '@/lib/variables-aviso';

type Marca = { char: string; estilo: React.CSSProperties };

const MARCAS: Marca[] = [
  { char: '*', estilo: { fontWeight: 700 } },
  { char: '_', estilo: { fontStyle: 'italic' } },
  { char: '~', estilo: { textDecoration: 'line-through' } },
];

/** Escapa lo que en una regex es especial. `*` y `~` lo son. */
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parte un texto en nodos, aplicando las marcas de una línea.
 *
 * Recursivo sobre la lista de marcas para que se puedan anidar (`*_las dos_*`),
 * que es lo que hace WhatsApp. El caso de una marca sin cerrar cae solo: si no
 * hay pareja, el regex no matchea y el texto sale tal cual.
 */
function pintar(texto: string, marcas: Marca[], clave: string): ReactNode[] {
  // ⚠️ LOS TOKENS `{{…}}` NO SE TOCAN. Su guión bajo es el mismo carácter que abre la
  // itálica, así que dos tokens en una línea se emparejan entre sí y el mensaje se
  // dibuja con los nombres partidos. Se parten primero, y las marcas corren sólo
  // afuera. (Es la primera vuelta: adentro ya no hay tokens que separar.)
  if (marcas.length === MARCAS.length) {
    const tramos = tramosConVariables(texto);
    if (tramos.some((t) => t.esVar)) {
      return tramos.map((t, i) => (t.esVar
        ? <span key={`${clave}v${i}`} style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>{t.txt}</span>
        : <Fragment key={`${clave}t${i}`}>{pintar(t.txt, marcas, `${clave}t${i}`)}</Fragment>));
    }
  }
  if (marcas.length === 0) return [texto];
  const [m, ...resto] = marcas;
  const c = esc(m!.char);
  // Sin `\n` adentro: una marca no cruza de renglón, igual que en WhatsApp.
  const re = new RegExp(`${c}([^${c}\\n]+?)${c}`, 'g');
  const out: ReactNode[] = [];
  let i = 0;
  let n = 0;
  for (const hit of texto.matchAll(re)) {
    const desde = hit.index ?? 0;
    if (desde > i) out.push(...pintar(texto.slice(i, desde), resto, `${clave}-${n++}`));
    out.push(<span key={`${clave}-m${n++}`} style={m!.estilo}>{pintar(hit[1]!, resto, `${clave}-i${n}`)}</span>);
    i = desde + hit[0].length;
  }
  if (i < texto.length) out.push(...pintar(texto.slice(i), resto, `${clave}-${n++}`));
  return out;
}

/** El texto de un mensaje, como se ve al llegar. */
export function TextoMarcas({ texto }: { texto: string }) {
  const lineas = (texto ?? '').split('\n');
  return (
    <>
      {lineas.map((l, i) => (
        <span key={i}>
          {pintar(l, MARCAS, `l${i}`)}
          {i < lineas.length - 1 ? '\n' : null}
        </span>
      ))}
    </>
  );
}

/** Las marcas, para que la barra de formato y el render digan lo mismo. */
export const MARCAS_CANAL = MARCAS.map((m) => m.char);
