'use client';

// =============================================================================
// Los gurús, a la vista en «Nuevo chat» (3/11/2026)
// =============================================================================
// Martín: «Cuando le doy a "Nuevo chat" no me deja ver las opciones de los gurus». Antes eran un chip en la cabecera que abría un modal,
// y «Nuevo chat jamás debe abrir un modal» (app/admin/operaciones/ChatNuevo.tsx). Tocar uno abre su chat ahí mismo. La misma pieza en las
// cuatro puertas: el cliente y el super admin, en la computadora y en el teléfono. Dice «Inspirado en» (lib/asesores/catalogo.ts).
//
// SÓLO MaKo Pro (14/11/2026, lib/asesores/candado.ts): con `soloPro`, el candado EN LUGAR de la grilla, con «Pasar a Pro». La
// defensa es el servidor (/api/mako/chat: 403 con `pasarAPro`); esto es para que no toque un gurú y reciba un error.
// ⚠️ `soloPro` ES UNA PROP Y NO EL HOOK (`useSoloPro`), aunque el hook esté a una línea: esta pieza se dibuja y se RECORRE como
//    función en los tests (tests/gurus-ops-center.test.ts la llama `GaleriaDeGurus({ onElegir })` para tocar cada botón), y una
//    función con hooks adentro no se puede llamar fuera de un render de React. El hook lo llama cada puerta, que ya es una
//    pantalla con estado.
// ⛔ Esto cierra al GURÚ, no el chat de MaKo: «Nuevo chat» sigue abriendo la conversación con MaKo en los dos planes.

import { CandadoSoloPro } from '@/app/_components/CandadoSoloPro';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASESORES, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { aspectoDeReferente } from '@/lib/centro-munecos';

export function GaleriaDeGurus({ onElegir, soloPro = false }: { onElegir: (id: IdAsesor) => void; soloPro?: boolean }) {
  return (
    <section className="co-gurus" aria-label="Hablar con un gurú">
      <h2 className="co-gurus__titulo">O habla con un gurú</h2>
      {soloPro ? (
        <CandadoSoloPro funcion="chat-referentes" />
      ) : (
        <div className="co-gurus__grilla">
          {ASESORES.map((r) => (
            <button key={r.id} type="button" className="co-gurus__uno" title={inspiradoEn(r)} onClick={() => onElegir(r.id)}>
              <Muneco titulo={r.nombre} animo="despierto" size={40} aspecto={aspectoDeReferente(r.id)} />
              <span className="co-gurus__texto"><span className="co-gurus__nombre">{r.nombre}</span><small>{r.especialidad}</small></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
