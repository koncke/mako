'use client';

// =============================================================================
// EtapasModal — editar las etapas de un funnel SIN salir del CRM
// =============================================================================
// Pedido de Martín (28/09/2026): «Quiero eliminar la ruta de funnel, que todo se edite
// como un pop-up dentro del mismo CRM. Así es más simple. Y que sea simple la edición,
// nada compleja».
//
// ⚠️ NO ES `FunnelEditor` ADENTRO DE UN `Modal`, y esa era la salida barata. Ese editor
// son 527 líneas: dibuja las transiciones, las nutriciones suprimidas, las plantillas de
// canal y la tarjeta de entradas, autoguarda el jsonb ENTERO con un debounce por tecla, y
// asume que es la pantalla (`<main>`, altos en `vh`, su propia URL). Meterlo en una caja
// habría traído las seis decisiones de «Montar una PANTALLA adentro de un modal» y, sobre
// todo, habría contestado lo contrario de lo que se pidió: más simple, no lo mismo en una
// ventana más chica.
//
// Acá se hace UNA cosa —la lista de etapas: nombre, orden, agregar, quitar— que es la que
// se ve en el tablero de atrás. El editor completo sigue existiendo y se llega a él desde
// /onboarding y /second-brain, que es donde se configura el negocio.
//
// ⚠️ Y CADA CAMBIO ES UNA OPERACIÓN PROPIA, no un «Guardar» al final. El pipeline crudo
// vive en el server (el tablero recibe las etapas ya DERIVADAS), así que mandar una lista
// reconstruida desde esta pantalla le haría perder todo lo que la derivación agrega. Se
// pide «renombra ésta», «sube ésta», y el server parcha el original — el mismo contrato
// que ya usa el menú «···» de cada columna.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import { MAX_LABEL_ETAPA } from '@/lib/pipeline';
import { editarEtapaAction, etapasDeFunnelAction, type EtapaDelFunnel, type OpEtapa } from './actions';

const SANS = "'Geist', sans-serif";

/** El botoncito de una acción por fila. Sin texto: el `aria-label` lleva la frase. */
function AccionFila({ etiqueta, onClick, disabled, children }: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      style={{
        width: 28, height: 28, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid transparent', background: 'transparent', fontFamily: SANS, fontSize: 13,
        color: disabled ? 'var(--faint)' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function EtapasModal({ funnelId, nombre, onCerrar }: {
  /** El funnel que se edita. `null`/`undefined` = el del negocio. */
  funnelId?: number | null;
  /** Cómo se llama el producto: va en el encabezado, para saber cuál se está tocando. */
  nombre: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [etapas, setEtapas] = useState<EtapaDelFunnel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<EtapaDelFunnel | null>(null);
  const [trabajando, startTrabajo] = useTransition();

  const cargar = useCallback(async () => {
    const r = await etapasDeFunnelAction(funnelId ?? undefined);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setEtapas(r.etapas);
  }, [funnelId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const aplicar = (op: OpEtapa) => {
    startTrabajo(async () => {
      const r = await editarEtapaAction(op, funnelId ?? undefined);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      setRenombrando(null);
      setBorrar(null);
      await cargar();
      // ⚠️ EL TABLERO DE ATRÁS SE REFRESCA EN CADA CAMBIO, no al cerrar. Las columnas
      // se leen en el server: sin esto, quien renombra una etapa y mira detrás del
      // pop-up ve el nombre viejo, que es exactamente «le di y no pasó nada».
      router.refresh();
    });
  };

  const guardarNombre = (e: EtapaDelFunnel, valor: string) => {
    const limpio = valor.trim();
    // Sin cambio no se escribe: el `onBlur` también salta al apretar Escape o al hacer
    // clic afuera, y un guardado por cada foco perdido es ruido en el historial.
    if (!limpio || limpio === e.label) { setRenombrando(null); return; }
    aplicar({ op: 'renombrar', key: e.key, label: limpio });
  };

  const ultima = (etapas ?? []).length - 1;

  return (
    <Modal
      titulo="Etapas del embudo"
      encabezado={nombre}
      ancho={520}
      onCerrar={onCerrar}
      pie={(
        <button type="button" onClick={onCerrar}
          style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
          Listo
        </button>
      )}
    >
      {/* Una frase: los cambios ya están guardados, y el botón de abajo solo cierra.
          Sin esto, «Listo» se lee como «Guardar» y quien cierre con la cruz va a creer
          que perdió lo que hizo. */}
      <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Cada cambio se guarda al momento.
      </p>

      {etapas === null && !error && (
        <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>Cargando…</p>
      )}

      {etapas !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {etapas.map((e, i) => (
            <div key={e.key}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
              {renombrando === e.key ? (
                <input
                  autoFocus
                  defaultValue={e.label}
                  maxLength={MAX_LABEL_ETAPA}
                  onBlur={(ev) => guardarNombre(e, ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                    if (ev.key === 'Escape') setRenombrando(null);
                  }}
                  style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setRenombrando(e.key)}
                  title={`Cambiar el nombre de ${e.label}`}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {e.label}
                </button>
              )}
              {/* ⚠️ LAS CUATRO TERMINALES SE RENOMBRAN Y NADA MÁS, y acá se DICE por qué.
                  Un botón apagado sin explicación se lee como que la app está rota; el
                  `title` es el único lugar donde el porqué no le quita espacio a nada.

                  ⚠️ Y NO SE PUEDE INTERCAMBIAR CON UNA FIJA, ni siendo movible. Medido en el
                  navegador: «Facturando» es la última etapa propia y su ↓ salía encendido,
                  pero el swap es contra «Ganado» —el cierre, que va último— y el server lo
                  rechaza siempre. Un botón que se puede apretar y siempre falla es peor que
                  uno apagado: hace creer que la app está rota. */}
              <AccionFila etiqueta={e.fija ? `${e.label} va siempre en su lugar` : `Subir ${e.label}`}
                disabled={trabajando || e.fija || i === 0 || !!etapas[i - 1]?.fija}
                onClick={() => aplicar({ op: 'mover', key: e.key, delta: -1 })}>↑</AccionFila>
              <AccionFila etiqueta={e.fija ? `${e.label} va siempre en su lugar` : `Bajar ${e.label}`}
                disabled={trabajando || e.fija || i === ultima || !!etapas[i + 1]?.fija}
                onClick={() => aplicar({ op: 'mover', key: e.key, delta: 1 })}>↓</AccionFila>
              <AccionFila etiqueta={e.fija ? `${e.label} está en todos los embudos: solo se le cambia el nombre` : `Quitar ${e.label}`}
                disabled={trabajando || e.fija}
                onClick={() => setBorrar(e)}>✕</AccionFila>
            </div>
          ))}

          <button
            type="button"
            disabled={trabajando}
            onClick={() => aplicar({ op: 'agregar' })}
            style={{ marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: trabajando ? 'default' : 'pointer', textAlign: 'left' }}
          >
            + Agregar etapa
          </button>
        </div>
      )}

      {borrar && (
        <div style={{ marginTop: 14, borderRadius: 10, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
          {/* La consecuencia, pegada al botón y en tinta normal: los leads no se borran,
              se quedan sin columna. Es el dato que decide, y es el que nadie adivina. */}
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            Quitar <strong>{borrar.label}</strong>. Los leads que estén ahí no se borran: quedan fuera del embudo hasta que los muevas.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setBorrar(null)}
              style={{ padding: '8px 14px', fontSize: 13.5, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>
              No quitarla
            </button>
            <button type="button" disabled={trabajando} onClick={() => aplicar({ op: 'eliminar', key: borrar.key })}
              style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: trabajando ? 'default' : 'pointer', fontFamily: SANS }}>
              Quitar la etapa
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{error}</div>
      )}
    </Modal>
  );
}
