// =============================================================================
// ProductoCelda — a qué PRODUCTO del CRM entran los leads de esta campaña
// =============================================================================
// La pieza ya existía del lado del CRM (una campaña o un conjunto → un producto, y sus
// leads caen en ese tablero): acá sólo se la ofrece donde Martín la pidió, en la tabla
// de Ads Manager. Las acciones son las MISMAS (app/crm/campanas-actions.ts); no hay una
// segunda implementación, ni se escribe el setting a mano.
//
// ⚠️ El producto principal viaja con `id: null` — así lo entrega `productosConNull()` y
// así se asigna. Nunca se le manda su id numérico. Por eso el valor del desplegable no
// puede ser el id pelado: `''` es «sin asignar» (quitar) y `ppal` es el principal.
//
// ⚠️ «Sin asignar» NO es lo mismo que el principal: sin asignación, el lead ruta por
// las reglas de siempre; con el principal, alguien lo decidió. Por eso quitar es una
// opción propia y no «elegir el principal».
// =============================================================================

'use client';

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Confirm } from '@/app/_ui';
import {
  asignarCampanaAction, previaCampanaAction, quitarCampanaAction, deshacerAsignacionAction,
  type ProductoNombre,
} from '../crm/campanas-actions';
import type { CampanaAsignada } from '@/lib/campana-config';
import { hayQuePreguntar, preguntaAsignar, valorDeProducto as valorDe, funnelDeValor as funnelDe, type PorProducto } from '@/lib/campana-asignar';

export type ItemCampana = { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string };

type Pide = { funnelId: number | null; producto: string; aTraer: number; desde: string | null; porProducto: PorProducto[] };

export function ProductoCelda({ item, productos, asignada, heredadoDe, onAsignadas, show, disabled, buttonStyle }: {
  item: ItemCampana;
  productos: ProductoNombre[];
  /** La fila de este id en el mapa, si está asignada. */
  asignada: CampanaAsignada | undefined;
  /**
   * El producto que este conjunto HEREDA de su campaña, si no tiene uno propio.
   *
   * ⚠️ No es cosmético: el ruteo ya funciona así (`funnelIdDeCampana`: el conjunto gana
   * sólo si tiene asignación propia, si no manda la campaña), y la celda decía «Sin
   * asignar» sobre un conjunto cuyos leads SÍ entran a un producto. Eso se lee como que
   * la asignación de la campaña no alcanzó, y lleva a asignar de nuevo conjunto por
   * conjunto — justo la fricción que este pedido vino a sacar.
   */
  heredadoDe?: string | null;
  onAsignadas: (asignadas: CampanaAsignada[]) => void;
  show: (msg: string, onUndo?: () => void, tono?: 'bad') => void;
  disabled?: boolean;
  /** El estilo del botón. La tabla de campañas del CRM lo usa sin borde y más bajo: con un
   *  desplegable con borde en cada fila, la fila mide 58 px y la tabla deja de ser densa. */
  buttonStyle?: CSSProperties;
}) {
  const [ocupada, setOcupada] = useState(false);
  const [pide, setPide] = useState<Pide | null>(null);

  const nombreDe = (funnelId: number | null) => productos.find((p) => p.id === funnelId)?.nombre ?? 'otro producto';
  const actual = asignada ? valorDe(asignada.funnelId) : '';

  const asignar = async (funnelId: number | null, traer: boolean) => {
    setOcupada(true);
    setPide(null);
    try {
      const r = await asignarCampanaAction(funnelId, item, traer);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      onAsignadas(r.asignadas);
      const n = r.movidos.length;
      // El toast dice QUÉ pasó en tres palabras; el porqué vive en este archivo.
      show(n ? `${n} ${n === 1 ? 'lead traído' : 'leads traídos'}` : 'Asignada', async () => {
        const d = await deshacerAsignacionAction(item.id, r.antes, r.movidos);
        if (d.ok) onAsignadas(d.asignadas); else show(d.error, undefined, 'bad');
      });
    } catch {
      show('No se pudo asignar', undefined, 'bad');
    } finally {
      setOcupada(false);
    }
  };

  const elegir = async (valor: string) => {
    if (ocupada || valor === actual) return;

    if (valor === '') {
      const antes = asignada ?? null;
      setOcupada(true);
      try {
        const r = await quitarCampanaAction(item.id);
        if (!r.ok) { show(r.error, undefined, 'bad'); return; }
        onAsignadas(r.asignadas);
        show('Quitada', async () => {
          if (!antes) return;
          const d = await asignarCampanaAction(antes.funnelId, item, false);
          if (d.ok) onAsignadas(d.asignadas);
        });
      } catch {
        show('No se pudo quitar', undefined, 'bad');
      } finally {
        setOcupada(false);
      }
      return;
    }

    const funnelId = funnelDe(valor);
    setOcupada(true);
    let previa: Awaited<ReturnType<typeof previaCampanaAction>>;
    try {
      previa = await previaCampanaAction(funnelId, item);
    } catch {
      setOcupada(false);
      show('No se pudo contar', undefined, 'bad');
      return;
    }
    setOcupada(false);
    if (!previa.ok) { show(previa.error, undefined, 'bad'); return; }

    const desde = asignada ? nombreDe(asignada.funnelId) : null;
    if (!hayQuePreguntar(previa.aTraer, desde)) { await asignar(funnelId, true); return; }
    setPide({ funnelId, producto: nombreDe(funnelId), aTraer: previa.aTraer, desde, porProducto: previa.porProducto });
  };

  const opciones = [
    { value: '', label: heredadoDe ? `${heredadoDe} · por su campaña` : 'Sin asignar' },
    ...productos.map((p) => ({ value: valorDe(p.id), label: p.nombre })),
  ];
  const txt = pide ? preguntaAsignar(pide) : null;

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
      <Dropdown
        value={actual}
        options={opciones}
        onChange={elegir}
        width={168}
        placeholder="Sin asignar"
        disabled={disabled || ocupada}
        buttonStyle={buttonStyle}
      />
      {txt && pide && (
        <Confirm
          title={txt.titulo}
          message={txt.mensaje}
          confirmLabel={txt.confirmar}
          cancelLabel={txt.cancelar}
          tone="primary"
          onConfirm={() => { void asignar(pide.funnelId, true); }}
          onCancel={() => setPide(null)}
        />
      )}
    </span>
  );
}
