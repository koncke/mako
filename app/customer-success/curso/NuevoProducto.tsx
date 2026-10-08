'use client';

// =============================================================================
// NuevoProducto — «+ Nuevo producto» desde el menú de la marca del curso
// =============================================================================
// Item 17 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 00:40). Martín, textual:
// «vos si querés agregar un nuevo producto tenés que irte hoy en día, eso es algo que tengo que poner
// ahí el botón, pero hoy en día tenés que irte al CRM y en el CRM pones nuevo producto… eso yo también
// lo voy a poner ahí en el mismo curso, que vos puedas agregar un nuevo producto».
//
// ⚠️ NO ES `upsertProducto`, y es el error que parece obvio (ver app/customer-success/actions.ts,
//    `crearServicioAction`, y lib/producto-con-funnel.ts). El CRM lista EMBUDOS: un producto suelto no
//    aparece ahí. Se crea con la MISMA cadena que el «Nuevo producto» del CRM y del kanban de Customer
//    Success (`crearProductoConFunnel`: producto → oferta → embudo, con sus etapas), así lo que nace acá
//    se ve allá. Pide sólo el NOMBRE, como el selector del kanban (SelectorServicio.tsx): el precio y el
//    canal se completan en el CRM; acá se está armando un curso, no cerrando el modelo de negocio.
//
// ⚠️ AL CREARLO SE NAVEGA DURO al curso nuevo (`window.location.href` con `conWs`), no con
//    `router.refresh()`: lo que cambió es QUÉ PRODUCTOS EXISTEN, y un refresh llega un paso atrás —
//    la tab seguiría sin el producto que se acaba de crear (AGENTS.md, «Si lo que cambió es QUÉ EXISTE,
//    se navega DURO»). Con el `?ws=` puesto: el super admin mirando a un cliente sigue en ese cliente.
//
// ⚠️ VA AFUERA DEL CURSO (lo monta ./CursoApp.tsx al lado de ./QuitarEtapa.tsx): adentro, la hoja del
//    curso le saca el fondo y el borde a los botones de un diálogo, y `Modal` no se portalea.

import { useId, useState } from 'react';
import { Button, Field, Input, Modal } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { crearServicioAction } from '../actions';

/** El curso del producto `id` (el `?ws=` lo pone `conWs`). */
const rutaDelCurso = (id: number) => `/customer-success/curso?producto=${id}`;

export function NuevoProducto({ onCerrar }: { onCerrar: () => void }) {
  const id = useId();
  const ws = useWs();
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const n = nombre.trim();

  const crear = async () => {
    if (!n || creando) return;
    setCreando(true);
    setError('');
    try {
      const r = await crearServicioAction(n);
      if (!r.ok) { setError(r.error); setCreando(false); return; }
      // Se queda «Creando…» hasta que la página nueva llega: el modal no se cierra sobre una tab vieja.
      window.location.href = conWs(rutaDelCurso(r.productoId), ws);
    } catch {
      setError('No se pudo crear.');
      setCreando(false);
    }
  };

  return (
    <Modal titulo="Nuevo producto" ancho={440} onCerrar={() => { if (!creando) onCerrar(); }}
      pie={(
        <>
          <Button variant="secondary" disabled={creando} onClick={onCerrar}>No crear</Button>
          <Button variant="primary" loading={creando} disabled={!n} onClick={() => void crear()}>Crear producto</Button>
        </>
      )}>
      <Field label="Nombre" required htmlFor={id} hint="También aparece en el CRM.">
        <Input id={id} value={nombre} autoFocus placeholder="Nombre del producto" disabled={creando} maxLength={60}
          onChange={(e) => { setNombre(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void crear(); } }} />
      </Field>
      {error && <p style={{ margin: '10px 0 0', color: 'var(--bad)', fontSize: 13 }} role="alert">{error}</p>}
    </Modal>
  );
}
