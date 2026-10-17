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
//
// ⚠️ UNO O VARIOS (#893, 17/10/2026): el desplegable tiene casillas. El PRIMERO que se
// marca es la casa del lead; los demás lo suman (`tambien`, lib/campana-config.ts).
// Marcar el primero pregunta como siempre (asignar); sumar otro pregunta sólo si hay leads
// para traer; desmarcar no saca a nadie.
// =============================================================================

'use client';

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Confirm } from '@/app/_ui';
import {
  alternarFunnelCampanaAction, asignarCampanaAction, previaCampanaAction, quitarCampanaAction, deshacerAsignacionAction,
  type ProductoNombre,
} from '../crm/campanas-actions';
import { funnelsDeAsignada, type CampanaAsignada } from '@/lib/campana-config';
import { hayQuePreguntar, preguntaAsignar, preguntaSumar, valorDeProducto as valorDe, funnelDeValor as funnelDe, type PorProducto } from '@/lib/campana-asignar';

export type ItemCampana = { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string };

type Pide = { funnelId: number | null; producto: string; aTraer: number; desde: string | null; porProducto: PorProducto[]; sumar?: true };

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

  const nombreDe = (funnelId: number | null) => productos.find((p) => p.id === funnelId)?.nombre ?? 'otro funnel';
  // Los marcados, la casa primero. Sin asignar, «Sin asignar» (o lo que hereda de su campaña).
  const marcados = asignada ? funnelsDeAsignada(asignada).map(valorDe) : [''];

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

  /** Sumar o sacar UN funnel de una campaña que ya tiene casa. Sacar no pregunta: nadie sale de donde está. */
  const alternar = async (funnelId: number | null, traer: boolean) => {
    setOcupada(true);
    setPide(null);
    try {
      const r = await alternarFunnelCampanaAction(funnelId, item, traer);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      onAsignadas(r.asignadas);
      const n = r.movidos.length;
      const sumo = !!r.antes && !funnelsDeAsignada(r.antes).includes(funnelId);
      show(n ? `${n} ${n === 1 ? 'lead traído' : 'leads traídos'}` : sumo ? 'Funnel sumado' : 'Funnel quitado', async () => {
        const d = await deshacerAsignacionAction(item.id, r.antes, r.movidos);
        if (d.ok) onAsignadas(d.asignadas); else show(d.error, undefined, 'bad');
      });
    } catch {
      show('No se pudo guardar', undefined, 'bad');
    } finally {
      setOcupada(false);
    }
  };

  const elegir = async (valor: string) => {
    if (ocupada) return;
    if (valor === '' && !asignada) return;

    if (valor === '') {
      const antes = asignada ?? null;
      setOcupada(true);
      try {
        const r = await quitarCampanaAction(item.id);
        if (!r.ok) { show(r.error, undefined, 'bad'); return; }
        onAsignadas(r.asignadas);
        // El deshacer de asignar: la devuelve ENTERA, con sus otros funnels.
        show('Quitada', async () => {
          if (!antes) return;
          const d = await deshacerAsignacionAction(item.id, antes, []);
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
    // Ya asignada: la casilla suma o saca ESE funnel. Sacar va directo.
    if (asignada && marcados.includes(valor)) { await alternar(funnelId, false); return; }
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

    if (asignada) {
      if (previa.aTraer === 0) { await alternar(funnelId, true); return; }
      setPide({ funnelId, producto: nombreDe(funnelId), aTraer: previa.aTraer, desde: null, porProducto: previa.porProducto, sumar: true });
      return;
    }
    if (!hayQuePreguntar(previa.aTraer, null)) { await asignar(funnelId, true); return; }
    setPide({ funnelId, producto: nombreDe(funnelId), aTraer: previa.aTraer, desde: null, porProducto: previa.porProducto });
  };

  const opciones = [
    { value: '', label: heredadoDe ? `${heredadoDe} · por su campaña` : 'Sin asignar' },
    ...productos.map((p) => ({ value: valorDe(p.id), label: p.nombre })),
  ];
  const txt = pide ? (pide.sumar ? preguntaSumar(pide) : preguntaAsignar(pide)) : null;

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
      <Dropdown
        value=""
        options={opciones}
        varios={marcados}
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
          onConfirm={() => { void (pide.sumar ? alternar(pide.funnelId, true) : asignar(pide.funnelId, true)); }}
          onCancel={() => setPide(null)}
        />
      )}
    </span>
  );
}
