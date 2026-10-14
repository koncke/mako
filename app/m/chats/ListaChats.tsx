'use client';

// =============================================================================
// La lista de Chats con el segmentado Todos · Sin responder, filtrado EN EL CLIENTE (14/10/2026)
// =============================================================================
// El filtro era un link (`?ver=sin-responder`): cada toque iba al servidor a volver a leer los
// mismos chats que la pantalla ya tenía (≥0,2 s de piso más la lectura, con la lista congelada).
// Ahora las filas llegan una vez y el segmentado sólo elige cuáles se ven, como Plan y Dashboard.
// La URL se actualiza con replaceState (un link compartido o «atrás» respetan lo elegido) sin
// navegar.
// =============================================================================

import { useState } from 'react';
import { FilaM, ListaM, SegmentadoM, VacioM } from '@/app/m/_ui';
import type { FilaChatM } from './datos';

type Vista = 'todos' | 'sin';

export function ListaChats({ filas, sinResponder, inicial }: { filas: FilaChatM[]; sinResponder: number; inicial: Vista }) {
  const [vista, setVista] = useState<Vista>(inicial);
  const visibles = vista === 'sin' ? filas.filter((f) => f.sinResponder) : filas;
  const elegir = (v: Vista) => {
    setVista(v);
    try {
      const u = new URL(window.location.href);
      if (v === 'sin') u.searchParams.set('ver', 'sin-responder'); else u.searchParams.delete('ver');
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    } catch { /* la URL es un extra: el filtro anda igual */ }
  };
  return (
    <>
      <SegmentadoM<Vista>
        etiqueta="Chats"
        valor={vista}
        onCambio={elegir}
        opciones={[
          { id: 'todos', label: 'Todos' },
          { id: 'sin', label: 'Sin responder', n: sinResponder || null },
        ]}
      />
      <div className="m-chats-lista">
        {visibles.length > 0 ? (
          <ListaM>
            {visibles.map((f) => (
              <FilaM
                key={f.leadId}
                avatar={f.nombre}
                titulo={f.nombre}
                segunda={f.ultimo}
                riel={f.riel}
                href={`/m/crm/${f.leadId}/chat`}
                etiqueta={`${f.nombre}${f.sinResponder ? ', sin responder' : ''}: ${f.ultimo}`}
              />
            ))}
          </ListaM>
        ) : (
          <VacioM frase={vista === 'sin' ? 'Nadie espera respuesta.' : 'Todavía no hay chats.'} />
        )}
      </div>
    </>
  );
}
