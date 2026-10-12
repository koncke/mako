'use client';

// =============================================================================
// El sheet de una acción que MaKo propuso en el chat: lo que se ejecuta, a la vista
// =============================================================================
// Lo que bloquea NO linkea: el detalle entero se lee acá, ANTES del botón. En el pie, la
// consecuencia pegada arriba del primario —que nombra la acción y su objeto (el nombre de
// la operación)— y debajo la salida, también con objeto. Nunca «Sí / No / Confirmar».
//
// Confirmar y cancelar son las server actions de app/m/mako/acciones.ts: el mismo ciclo
// de WhatsApp y de la bandeja (reclamar → ejecutar → resolver, con el gating mirado OTRA
// vez). La página declara maxDuration 300: su techo gobierna estas actions.
// Sin red no se aprueba: una aprobación NUNCA se encola.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { haptico } from '@/lib/haptico';
import { PieM, SheetM, useConexion, useToastM } from '../_ui';
import { confirmarEnChatAction, cancelarEnChatAction } from './acciones';
import { SALIDA_PROPUESTA, rotuloPrimario, trasTarjeta, type EstadoPropuesta, type ItemHilo } from './chat-ui';

type ItemPropuesta = Extract<ItemHilo, { k: 'propuesta' }>;

export function SheetPropuesta({ item, sessionId, onCerrar, onEstado }: {
  item: ItemPropuesta | null;
  sessionId: number | null;
  onCerrar: () => void;
  onEstado: (pendienteId: number, estado: EstadoPropuesta, nota?: string, paraLaPersona?: string[]) => void;
}) {
  const { enLinea } = useConexion();
  const toast = useToastM();
  const [enviando, setEnviando] = useState<'confirmar' | 'cancelar' | null>(null);
  const [frase, setFrase] = useState<string | null>(null);
  const [ahora, setAhora] = useState<number | null>(null);
  // El último abierto se conserva mientras la hoja se va (cierra en 220 ms).
  const ultimo = useRef<ItemPropuesta | null>(null);
  if (item) ultimo.current = item;
  const it = item ?? ultimo.current;

  const clave = item?.id ?? null;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setFrase(null); setEnviando(null); setAhora(Date.now()); }, [clave]);

  if (!it) return <SheetM abierto={false} onCerrar={onCerrar} titulo="" id="propuesta" />;
  const t = it.t;

  const correr = async (accion: 'confirmar' | 'cancelar') => {
    if (enviando || sessionId == null) return;
    if (!enLinea) { setFrase('Sin conexión: no se envió.'); return; }
    setEnviando(accion);
    setFrase(null);
    if (accion === 'confirmar') onEstado(t.pendienteId, 'aplicando');
    try {
      const r = accion === 'confirmar'
        ? await confirmarEnChatAction(t.pendienteId, sessionId)
        : await cancelarEnChatAction(t.pendienteId, sessionId);
      const d = trasTarjeta(r, accion);
      if (d.haptico) haptico(d.haptico);
      onEstado(t.pendienteId, d.estado ?? 'pendiente', d.frase ?? undefined, r.paraLaPersona);
      if (d.toast) toast(d.toast);
      if (d.estado && d.estado !== 'fallo') onCerrar();
      else setFrase(d.frase);
    } catch {
      // La action pudo haber corrido igual: no se dice «no pasó», se dice que no se sabe.
      haptico('error');
      onEstado(t.pendienteId, 'pendiente');
      setFrase('No llegó la respuesta. Recarga el chat para ver si se ejecutó.');
    } finally {
      setEnviando(null);
    }
  };

  const abierta = it.estado === 'pendiente' || it.estado === 'aplicando';
  const vence = Date.parse(t.venceAt);
  const vencida = ahora != null && Number.isFinite(vence) && vence < ahora && abierta;

  // El pie: la consecuencia en tinta pegada arriba del primario, y la salida con objeto debajo.
  // Ya resuelta (o vencida), sólo lo que pasó; sin nada que decir, sin pie.
  const cierre = vencida ? 'Venció: ya no se puede ejecutar.' : (it.nota ?? frase ?? '');
  const pie = abierta && !vencida ? (
    <PieM consecuencia={t.consecuencia ?? 'MaKo lo ejecuta en cuanto confirmes.'}>
      {frase && <p className="m-mako-pie-nota" role="alert">{frase}</p>}
      {!enLinea && <p className="m-mako-pie-nota m-mako-pie-nota--gris" role="status">Sin conexión: no se puede aprobar.</p>}
      <Button variant="primary" size="lg" full loading={enviando === 'confirmar'}
        disabled={!enLinea || enviando === 'cancelar'} onClick={() => correr('confirmar')}>
        {rotuloPrimario(t)}
      </Button>
      <Button variant="tertiary" size="lg" full loading={enviando === 'cancelar'}
        disabled={!enLinea || enviando === 'confirmar'} onClick={() => correr('cancelar')}>
        {SALIDA_PROPUESTA}
      </Button>
    </PieM>
  ) : cierre ? <PieM consecuencia={cierre} /> : undefined;

  return (
    <SheetM abierto={item != null} onCerrar={onCerrar} titulo={t.titulo} id="propuesta" snap="alto" ocupado={enviando != null} pie={pie}>
      <div className="m-mako-detalle">
        <p className="m-mako-detalle__resumen">{t.resumen}</p>
        {abierta && t.vence && <p className="m-mako-detalle__vence">Vence {t.vence}</p>}
        {t.detalle.length > 0 && (
          <>
            <h3 className="m-mako-subt">Lo que se ejecuta</h3>
            <dl className="m-lista m-mako-lineas">
              {t.detalle.map((l, i) => (
                <div key={i} className="m-mako-linea"><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>
              ))}
            </dl>
          </>
        )}
      </div>
    </SheetM>
  );
}
