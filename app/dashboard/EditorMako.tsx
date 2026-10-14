'use client';

// =============================================================================
// EditorMako — el botón de MaKo de un gráfico, EDITADO EN EL LUGAR (editando la hoja)
// =============================================================================
// Martín (13/10/2026), textual: «que el botón de la IA de MaKo NO se abra al estar en modo edición, sino que se pueda
// editar allí justamente... Que se pueda editar el prompt, lo que debe responder, eliminar el botón de IA de ese grafico,
// etc...». Editando, el botón de la tarjeta no abre el chat: abre esto, anclado a él (un `Flotante` de ./Galeria.tsx).
//   · «Qué tiene que responder»: el pedido que el chat responde PRIMERO al abrirse (`Grafico.makoIA.pedido`; viaja en el
//     contexto, app/dashboard/exportar.ts → `contextoDeGrafico`).
//   · «Preguntas sugeridas»: los botones de pregunta del chat, una por renglón (`makoIA.sugerencias`).
//   · «Quitar el botón»: `mako: false` (es una elección: gana sobre lo que diga el tipo, `conMako`).
// Se guarda al salir de cada campo y al cerrar (un `cambiar` por tecla dejaría una foto de deshacer por letra). Lo saneado
// manda: `sanearGrafico` recorta el pedido a TOPE_PEDIDO_MAKO y las sugerencias a MAX_SUGERENCIAS_MAKO.
// ⚠️ EL CHAT YA ABIERTO NO CAMBIA: una sesión guarda el contexto con que nació; el pedido nuevo vale desde el próximo chat.

import { useEffect, useRef, useState } from 'react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { MAX_SUGERENCIAS_MAKO, TOPE_PEDIDO_MAKO, type Grafico } from '@/lib/graficos-catalogo';

/** Lo que el editor escribe en el gráfico (lo sanea `cambiar`). */
export type CambioMako = { makoIA: { pedido: string; sugerencias: string[] } } | { mako: false };

/** Las sugerencias escritas una por renglón, sin vacíos ni repetidas, hasta el tope. */
export const sugerenciasDeTexto = (t: string): string[] =>
  [...new Set(t.split('\n').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SUGERENCIAS_MAKO);

export function EditorMako({ g, onCambiar }: { g: Grafico; onCambiar: (c: CambioMako) => void }) {
  const [pedido, setPedido] = useState(g.makoIA?.pedido ?? '');
  const [sugerencias, setSugerencias] = useState((g.makoIA?.sugerencias ?? []).join('\n'));
  // Lo último escrito y lo último guardado, para el guardado al cerrar (el desmontaje no ve el estado de ese render).
  const ahora = useRef({ pedido, sugerencias });
  const guardado = useRef({ pedido, sugerencias });
  useEffect(() => { ahora.current = { pedido, sugerencias }; });

  const guardar = () => {
    const a = ahora.current;
    if (a.pedido === guardado.current.pedido && a.sugerencias === guardado.current.sugerencias) return;
    guardado.current = a;
    onCambiar({ makoIA: { pedido: a.pedido.trim(), sugerencias: sugerenciasDeTexto(a.sugerencias) } });
  };
  // Cerrar el flotante (clic afuera, Escape) también guarda lo escrito.
  const guardarRef = useRef(guardar);
  useEffect(() => { guardarRef.current = guardar; });
  useEffect(() => () => guardarRef.current(), []);

  return (
    <div className="lk-lista" data-editor-mako="" style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="lk-lista-grupo" style={{ padding: 0 }}>Botón de MaKo</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="lk-seccion-tit">Qué tiene que responder</span>
        <textarea className="lk-input" value={pedido} maxLength={TOPE_PEDIDO_MAKO} rows={3}
          placeholder="Ej.: por qué subió o bajó, y qué hacer" style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
          onChange={(e) => setPedido(e.target.value)} onBlur={guardar} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="lk-seccion-tit">Preguntas sugeridas</span>
        <textarea className="lk-input" value={sugerencias} rows={3} placeholder="Una por renglón"
          style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
          onChange={(e) => setSugerencias(e.target.value)} onBlur={guardar} />
      </label>
      <BotonBorrar talla="sm" texto="Quitar el botón" title="Quitar el botón de MaKo de este gráfico"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => { guardado.current = ahora.current; onCambiar({ mako: false }); }} />
    </div>
  );
}
