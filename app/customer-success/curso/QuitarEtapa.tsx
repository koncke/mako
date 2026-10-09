'use client';

// =============================================================================
// QuitarEtapa — la pregunta de antes de sacar una etapa del kanban (o un módulo) desde el curso
// =============================================================================
// Pedido de Martín (08/10/2026, item 15): «si se desactiva se elimina esa etapa del kanban, y si hay
// leads debería preguntar a dónde los mueve… si se elimina [el módulo], se elimina también la etapa».
// Lo abren el interruptor «Etapa del kanban» y «Eliminar módulo» del menú «…» (./MenuCurso.tsx).
//
//   · Con clientes adentro: cuántos, y a qué OTRA etapa van. Se mudan SIN mensajes
//     (lib/cs-mover-etapa.ts, `silencioso`): eso no se dice acá, porque no hay nada que decidir.
//   · «Eliminar módulo»: además cuántas clases se van con él (a la papelera: el «Deshacer» las
//     devuelve), aunque no tenga clientes — la confirmación dice qué se lleva, corto.
//
// ⚠️ VA AFUERA DEL CURSO (lo monta ./CursoApp.tsx al lado de `confirmNode`): adentro, la hoja del
//    curso (`.ahdoc`) le saca el fondo y el borde a los botones de un diálogo, y `Modal` no se portalea
//    (hallazgos-customer-success, «Trampas del dibujo que aparecieron al editar adentro»).
// ⚠️ EL DESTINO NO VIENE ELEGIDO: «la siguiente» sería decidir por la persona a dónde van sus
//    clientes. El botón queda apagado hasta que elige.

import { useState } from 'react';
import { Button, Modal, Select } from '@/app/_ui';
import type { DestinoClientes } from '@/lib/curso-modulos';
import { useCerrarEstable } from './dialogo-foco';

/** Lo que se pregunta. `clientes` en 0 = sólo se confirma (eliminar un módulo sin clientes). */
export type PreguntaQuitar = {
  titulo: string;
  /** «Eliminar módulo»: cuántas clases se van con él. `null` = no viene al caso (el interruptor). */
  clases: number | null;
  clientes: number;
  destinos: DestinoClientes[];
  /** El botón que lo hace: nombra la acción y su objeto. */
  boton: string;
  /** Lo que se hace con la respuesta: el destino, o `null` si no hay clientes que mover. */
  hacer: (destino: string | null) => Promise<void>;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** La frase de la consecuencia, corta: «3 clases y 2 clientes.» / «Sin clases.» / «2 clientes.». */
export function fraseDeQuitar(p: Pick<PreguntaQuitar, 'clases' | 'clientes'>): string {
  const partes: string[] = [];
  if (p.clases != null) partes.push(p.clases ? plural(p.clases, 'clase', 'clases') : 'Sin clases');
  if (p.clientes) partes.push(plural(p.clientes, 'cliente', 'clientes'));
  return `${partes.join(' y ')}.`;
}

export function QuitarEtapa({ pregunta, onCerrar }: { pregunta: PreguntaQuitar; onCerrar: () => void }) {
  const [destino, setDestino] = useState('');
  const [haciendo, setHaciendo] = useState(false);
  const falta = pregunta.clientes > 0 && !destino;
  // ⚠️ `onCerrar` de identidad FIJA (audio del 08/10/2026 a la noche, punto 1; ./dialogo-foco.ts): con una
  //    flecha nueva por render, cada render le mandaba el foco a la caja. Medido con 10 etapas (el desplegable
  //    trae buscador) y la pantalla re-renderizándose: tipear «Grad» en el buscador dejaba el campo vacío.
  const cerrar = useCerrarEstable(onCerrar, haciendo);
  const hacer = async () => {
    if (falta || haciendo) return;
    setHaciendo(true);
    try { await pregunta.hacer(pregunta.clientes > 0 ? destino : null); } finally { setHaciendo(false); onCerrar(); }
  };
  return (
    <Modal titulo={pregunta.titulo} onCerrar={cerrar} ancho={440}
      pie={(
        <>
          <Button variant="secondary" disabled={haciendo} onClick={onCerrar}>No, dejarlo</Button>
          <Button variant="danger" loading={haciendo} disabled={falta} onClick={() => void hacer()}>{pregunta.boton}</Button>
        </>
      )}>
      <p style={{ margin: 0 }}>{fraseDeQuitar(pregunta)}</p>
      {pregunta.clientes > 0 && (
        <div style={{ marginTop: 14 }}>
          <Select label="Sus clientes van a" value={destino} onChange={setDestino} placeholder="Elige una etapa"
            options={pregunta.destinos.map((d) => ({ value: d.key, label: d.label }))} />
        </div>
      )}
    </Modal>
  );
}
