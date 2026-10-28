'use client';

// =============================================================================
// «Trabajando…» al pie de la conversación: se toca y se ve lo que está haciendo (17/10/2026, punto 9 de Martín)
// =============================================================================
// Martín (19:45): «Cuando está trabajando, debería poder clickear y ver el razonamiento, lo mismo que se ve en Claude... Y en
// todos los chats debería tener la misma animación de "Trabajando..."».
//
// Es UNA pieza para todos los chats (cada jefe, el Cerebro y los nuevos), en la computadora y en el teléfono: la monta el hilo
// (Hilo.tsx) y por eso no se repite en ningún otro lado. Cerrada: «Trabajando…» con los tres puntos que laten y, al lado,
// el paso de ahora en chico. Tocada se despliega como el panel de razonamiento de Claude: la lista de pasos, los de antes
// tildados y el de ahora animado. Se pliega sola al terminar: cuando el chat deja de trabajar el hilo la desmonta, y la
// próxima vez arranca cerrada.
//
// ⚠️ LO QUE SE VE ES LO QUE YA SUBE LA PC (lib/centro-pasos.ts, la E): el nombre de cada herramienta y la frase corta que el
// modelo le pone al Bash. NO es el texto del razonamiento: subirlo a MaKo pide otra revisión de qué viaja (relevo, después
// del 20/10). Sin pasos todavía lo dice, no se queda callada.
// ⚠️ Es un archivo aparte de Hilo.tsx a propósito: el hilo no lleva hooks (lo usa el teléfono sin llevarse la pantalla de
// escritorio) y éste necesita su estado.
// ⚠️ LOS TRES PUNTOS VAN EN UNA BURBUJA, COMO «ESCRIBIENDO…» DE WHATSAPP (27/10/2026, Martín: «la animación de MaKo
//    escribiendo, de los 3 puntos»). Eran tres puntos de 4 px pegados a la palabra «Trabajando», que en el teléfono no se
//    leían como «está escribiendo». Ahora la burbuja del chat late con sus puntos; la palabra queda para el lector de
//    pantalla y el paso de ahora sigue al lado, en chico.

import { useId, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { Muneco } from './Muneco';
import type { Aspecto } from '@/lib/centro-munecos';
import type { PasoDelTurno } from '@/lib/centro-pasos';

const Puntos = () => <span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span>;

export function Trabajando({ titulo, aspecto, pasos = [], abierto: abiertoAlMontar = false }: {
  titulo: string;
  aspecto?: Aspecto | null;
  /** Los pasos en vivo del turno abierto, el más viejo primero (lib/centro-pasos.ts → pasosDelChat). */
  pasos?: readonly PasoDelTurno[];
  /** Cómo arranca (los tests lo piden abierto; en pantalla siempre arranca cerrada). */
  abierto?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoAlMontar);
  const id = useId();
  const hechos = pasos.slice(0, -1);
  const ahora = pasos.at(-1)?.texto ?? null;
  return (
    <div className="co-el co-trabajando" role="status" aria-live="polite">
      <Muneco titulo={titulo} aspecto={aspecto} animo="trabajando" size={26} />
      <div className="co-trabajando__cuerpo">
        <button type="button" className="co-trabajando__boton" aria-expanded={abierto} aria-controls={id}
          title={abierto ? 'Ocultar lo que está haciendo' : 'Ver lo que está haciendo'} onClick={() => setAbierto((a) => !a)}>
          <span className="co-trabajando__texto co-oculto">Trabajando</span>
          <span className="co-escribiendo" aria-hidden><Puntos /></span>
          {ahora && !abierto && <span className="co-trabajando__paso">{ahora}</span>}
          <span className={`co-chev${abierto ? '' : ' co-chev--cerrado'}`} aria-hidden><Icon name="chevron" size={13} /></span>
        </button>
        {abierto && (
          <ul id={id} className="co-pasos" aria-label="Lo que está haciendo">
            {hechos.map((p, i) => <li key={`${p.at}-${i}`} className="co-pasos__hecho">{p.texto}</li>)}
            {ahora
              ? <li className="co-pasos__ahora">{ahora}<Puntos /></li>
              : <li className="co-pasos__vacio">Sin pasos todavía</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
