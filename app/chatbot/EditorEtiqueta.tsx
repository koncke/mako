'use client';

// =============================================================================
// EditorEtiqueta — la tarjeta 🏷️ de un flujo, como UNA frase: «[Poner ▾] [Cualificado ▾]»
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 6): «Falta la tarjeta de etiqueta, para poder
// colocar una etiqueta al lead.» Decisión 8 del diseño (docs/chatbot-flujo-ramas-diseno.md): la
// etiqueta es una tarjeta de PRESENTACIÓN sobre la ⚡ Acción `poner_etiqueta_lead` /
// `sacar_etiqueta_lead`. El motor no cambia: el paso guardado es una acción como cualquier otra,
// con el lead del evento y el id de la etiqueta.
//
// Por eso este editor no guarda nada: entrega (operación, etiqueta) y quien lo monta arma el paso.
// La etiqueta se elige con el SelectorEtiqueta EXPORTADO (app/_components/etiquetas-cliente.tsx),
// que se lee la lista solo y trae «＋ Nueva» con la creación en el lugar: una etiqueta que todavía
// no existe se crea sin salir del flujo.
//
// ⚠️ SE GUARDA EL ID, NO EL NOMBRE: renombrar la etiqueta en el CRUD no rompe la tarjeta.
// ⚠️ SIN RÓTULOS NI GLOSA: la frase se lee sola (punto 5 del primer pedido, «todo debe entenderse
//    por su propia cuenta»). Qué hace poner una etiqueta (mover de etapa, disparar otra automatización,
//    copiarla al celular) es del CRUD de etiquetas, no de cada tarjeta.
// =============================================================================

import { Dropdown } from '@/app/components/Dropdown';
import { SelectorEtiqueta } from '@/app/_components/etiquetas-cliente';
import type { OperacionEtiqueta } from '@/lib/editor-acciones';

export type EditorEtiquetaProps = {
  operacion: OperacionEtiqueta;
  etiquetaId: number | null;
  onChange: (operacion: OperacionEtiqueta, etiquetaId: number | null) => void;
  deshabilitado?: boolean;
};

const OPCIONES: Array<{ value: OperacionEtiqueta; label: string }> = [
  { value: 'poner_etiqueta_lead', label: 'Poner' },
  { value: 'sacar_etiqueta_lead', label: 'Sacar' },
];

export function EditorEtiqueta({ operacion, etiquetaId, onChange, deshabilitado }: EditorEtiquetaProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      <Dropdown
        value={operacion}
        options={OPCIONES}
        width={108}
        ariaLabel="Poner o sacar"
        disabled={deshabilitado}
        search={false}
        onChange={(v) => { if (v === 'poner_etiqueta_lead' || v === 'sacar_etiqueta_lead') onChange(v, etiquetaId); }}
      />
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <SelectorEtiqueta
          value={etiquetaId}
          onElegir={(e) => onChange(operacion, e.id)}
          placeholder="Elige una etiqueta"
          ariaLabel="Etiqueta"
          width="100%"
          disabled={deshabilitado}
        />
      </div>
    </div>
  );
}
