'use client';

// =============================================================================
// Los gurús, a la vista en «Nuevo chat» (3/11/2026)
// =============================================================================
// Martín: «Cuando le doy a "Nuevo chat" no me deja ver las opciones de los gurus». Antes eran un chip en la cabecera que abría un modal,
// y «Nuevo chat jamás debe abrir un modal» (app/admin/operaciones/ChatNuevo.tsx). Tocar uno abre su chat ahí mismo. La misma pieza en las
// cuatro puertas: el cliente y el super admin, en la computadora y en el teléfono. Dice «Inspirado en» (lib/asesores/catalogo.ts).

import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASESORES, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { aspectoDeReferente } from '@/lib/centro-munecos';

export function GaleriaDeGurus({ onElegir }: { onElegir: (id: IdAsesor) => void }) {
  return (
    <section className="co-gurus" aria-label="Hablar con un gurú">
      <h2 className="co-gurus__titulo">O habla con un gurú</h2>
      <div className="co-gurus__grilla">
        {ASESORES.map((r) => (
          <button key={r.id} type="button" className="co-gurus__uno" title={inspiradoEn(r)} onClick={() => onElegir(r.id)}>
            <Muneco titulo={r.nombre} animo="despierto" size={40} aspecto={aspectoDeReferente(r.id)} />
            <span className="co-gurus__texto"><span className="co-gurus__nombre">{r.nombre}</span><small>{r.especialidad}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
