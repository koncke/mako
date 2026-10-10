'use client';

// =============================================================================
// EditorEtiqueta — la tarjeta TAG de un flujo, como UNA frase: «[Agregar ▾] [Cualificado ✕] [＋ Otra]»
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 6): «Falta la tarjeta de etiqueta, para poder
// colocar una etiqueta al lead.» Decisión 8 del diseño (docs/chatbot-flujo-ramas-diseno.md): la
// etiqueta es una tarjeta de PRESENTACIÓN sobre la ⚡ Acción `poner_etiqueta_lead` /
// `sacar_etiqueta_lead`. El motor no cambia: el paso guardado es una acción como cualquier otra,
// con el lead del evento y el id de la etiqueta.
//
// Sexta tanda (09/10/2026), textual:
//   · TAG 1: «En lugar de "Poner" y "Sacar", se formal escribiendo siempre... "Agregar" y "Eliminar"».
//     El verbo sale de UN lugar (`VERBO_ETIQUETA`, lib/editor-acciones.ts);
//   · TAG 2: «Se debería poder seleccionar multiple, si quiero sacar o agragar varias etiquetas». Las
//     elegidas se ven como chips adentro de un campo grande, cada una con su ✕, y al final «＋ Otra»;
//   · CRON 1 (vale para TAG): «Haz los botones gigantes, y reduce el espacio de ser necesario». El verbo
//     es el desplegable PRINCIPAL de la casa (56 de alto) y el campo de las etiquetas mide lo mismo.
//
// Por eso este editor no guarda nada: entrega (operación, etiquetas) y quien lo monta arma el paso con
// `paramsConEtiquetas` (la primera en `etiquetaId`, todas en `etiquetaIds` si son más de una: la acción
// del registro acepta UNA y el ejecutor corre una por etiqueta, ver `unaPorEtiqueta`).
// La etiqueta se elige con el SelectorEtiqueta EXPORTADO (app/_components/etiquetas-cliente.tsx), que se
// lee la lista solo y trae «＋ Nueva» con la creación en el lugar: una etiqueta que todavía no existe se
// crea sin salir del flujo.
//
// ⚠️ SE GUARDA EL ID, NO EL NOMBRE: renombrar la etiqueta en el CRUD no rompe la tarjeta.
// ⚠️ SIN RÓTULOS NI GLOSA: la frase se lee sola (punto 5 del primer pedido, «todo debe entenderse
//    por su propia cuenta»). Qué hace poner una etiqueta (mover de etapa, disparar otra automatización,
//    copiarla al celular) es del CRUD de etiquetas, no de cada tarjeta.
// =============================================================================

import type { CSSProperties } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { SelectorEtiqueta, ChipEtiqueta, useEtiquetasTodas } from '@/app/_components/etiquetas-cliente';
import { VERBO_ETIQUETA, type OperacionEtiqueta } from '@/lib/editor-acciones';
import { ALTO_PRINCIPAL } from '@/app/components/dropdown-reglas';

export type EditorEtiquetaProps = {
  operacion: OperacionEtiqueta;
  /** Las etiquetas elegidas, en orden (la primera es la que se guarda en `etiquetaId`). */
  etiquetaIds?: readonly number[];
  /** Una sola, como se pasaba antes de la sexta tanda. Si viene `etiquetaIds`, manda la lista. */
  etiquetaId?: number | null;
  onChange: (operacion: OperacionEtiqueta, etiquetaIds: number[]) => void;
  deshabilitado?: boolean;
};

const OPCIONES: DropdownOption[] = [
  { value: 'poner_etiqueta_lead', label: VERBO_ETIQUETA.poner_etiqueta_lead, icono: 'etiqueta-mas' },
  { value: 'sacar_etiqueta_lead', label: VERBO_ETIQUETA.sacar_etiqueta_lead, icono: 'etiqueta-menos' },
];

/**
 * EL CAMPO DE LAS ETIQUETAS: mide lo mismo que el desplegable principal de al lado, y adentro van las
 * elegidas como chips con su ✕ y, al final, el selector. Con ninguna elegida, el selector LLENA el campo
 * («＋ Elige una etiqueta») y el campo va con la cara PLACEHOLDER de la casa —borde punteado, texto
 * centrado y apagado— (CONDITION 4, «para todos lados»: «siempre que puedas usa ese diseño tipo
 * placeholder»): todo el campo es el botón para agregar la primera.
 */
const CAMPO: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: ALTO_PRINCIPAL,
  padding: '6px 8px', borderRadius: 13, border: '1.5px solid var(--border-strong)', background: 'var(--surface)',
  boxSizing: 'border-box', minWidth: 0,
};
const CAMPO_VACIO: CSSProperties = { borderStyle: 'dashed', background: 'transparent', justifyContent: 'center' };
/** El selector adentro del campo: sin caja propia (la caja es el campo). */
const SELECTOR_EN_CAMPO: CSSProperties = {
  border: 'none', background: 'transparent', minHeight: 40, padding: '8px 8px', fontSize: 16, fontWeight: 600, borderRadius: 9,
};

/**
 * LA FRASE, GIGANTE. El ancho del verbo sale de la opción más LARGA del conjunto («Eliminar», ocho
 * letras a 17 px en negrita, más su ícono y la flecha): 168 la deja entera (AGENTS.md: el layout se
 * prueba con el valor más largo). El campo de las etiquetas llena lo que queda del renglón y baja de
 * renglón con muchas; una etiqueta de 40 letras se corta adentro de su chip, no empuja la frase.
 */
export function EditorEtiqueta({ operacion, etiquetaIds, etiquetaId, onChange, deshabilitado }: EditorEtiquetaProps) {
  const ids: number[] = etiquetaIds ? [...etiquetaIds] : etiquetaId != null ? [etiquetaId] : [];
  // Con las archivadas: una tarjeta que apunta a una archivada se sigue leyendo (con «(archivada)»).
  const todas = useEtiquetasTodas();
  const elegir = (id: number) => onChange(operacion, ids.includes(id) ? ids : [...ids, id]);
  const quitar = (id: number) => onChange(operacion, ids.filter((x) => x !== id));
  const chip = (id: number) => {
    const e = todas?.find((x) => x.id === id);
    if (e) return e;
    // Mientras carga, un chip neutro; si ya cargó y no está, se dice (un chip vacío se leería como roto).
    return { nombre: todas ? 'Una etiqueta que ya no está' : '…', color: '#9AA0A6', emoji: null };
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
      <Dropdown
        value={operacion}
        options={OPCIONES}
        width={168}
        ariaLabel="Agregar o eliminar"
        disabled={deshabilitado}
        search={false}
        variante="principal"
        onChange={(v) => { if (v === 'poner_etiqueta_lead' || v === 'sacar_etiqueta_lead') onChange(v, ids); }}
      />
      <div style={{ ...CAMPO, ...(ids.length ? {} : CAMPO_VACIO), flex: '1 1 240px' }}>
        {ids.map((id) => (
          <ChipEtiqueta key={id} e={chip(id)} onSacar={deshabilitado ? undefined : () => quitar(id)} />
        ))}
        <div style={{ flex: ids.length ? '0 0 auto' : '1 1 auto', minWidth: 0 }}>
          <SelectorEtiqueta
            value={null}
            accion
            excluir={new Set(ids)}
            onElegir={(e) => elegir(e.id)}
            placeholder={ids.length ? '＋ Otra' : '＋ Elige una etiqueta'}
            ariaLabel={ids.length ? 'Otra etiqueta' : 'Etiqueta'}
            width={ids.length ? undefined : '100%'}
            disabled={deshabilitado}
            buttonStyle={{ ...SELECTOR_EN_CAMPO, ...(ids.length ? { color: 'var(--primary)' } : { justifyContent: 'center', color: 'var(--dim)' }) }}
          />
        </div>
      </div>
    </div>
  );
}
