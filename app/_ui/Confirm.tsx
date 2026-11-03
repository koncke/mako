'use client';

// =============================================================================
// Confirm — LA confirmación de la app (antes había dos)
// =============================================================================
// Hasta el rediseño convivían app/components/ConfirmDialog.tsx (14 archivos) y
// app/_components/ConfirmModal.tsx + useConfirm.tsx (3), con tipografías, radios
// y z-index distintos, y ninguna mandaba. Ésta es la única; las otras dos
// quedaron como envoltorios que llaman acá, así que ningún call-site cambió.
//
// Se usa de dos formas, según cómo esté escrito el call-site:
//
//   1) Declarativa — tenés un estado de «qué voy a borrar»:
//        {aBorrar && <Confirm title="¿Eliminar la campaña?" … />}
//
//   2) Con promesa — reemplazo directo de window.confirm(), sin reestructurar:
//        const { confirm, confirmNode } = useConfirm();
//        if (!(await confirm('¿Eliminar?'))) return;
//        …
//        return <>{confirmNode}…</>
//
// Nunca usamos el confirm() nativo del navegador: aparece pegado arriba de la
// ventana, con la tipografía del sistema, y rompe la ilusión de aplicación.
//
// Va SOBRE la pila de modales (no la esconde, ver pila-modales.ts): preguntar
// «¿seguro?» ocultando lo que estás por borrar sería absurdo.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * Por encima de TODO modal, no solo de los de la pila.
 *
 * ⚠️ Estaba en 500, que alcanza para la pila (`pila-modales.ts`, Z_BASE 130 + niveles) y es
 * CIEGO a los modales escritos a mano, que no pasan por la pila y eligen su z-index solos.
 * Medido el 25/09/2026: `app/whatsapp/EvolutionConnect.tsx:300` usa 1000,
 * `app/whatsapp/EmpresaInbox.tsx` hasta 2500 y `app/email/EmailApp.tsx` 1000. En los tres, el
 * «¿seguro?» se dibujaba DETRÁS del modal que lo abrió: la acción no se podía completar nunca
 * y no había forma de darse cuenta, porque el fondo oscuro del confirm sí se veía.
 *
 * No es cosmético: el único camino para recuperar una línea de WhatsApp desvinculada (403) es
 * «Desconectar» y volver a vincular —`conectar()` sobre la instancia zombi devuelve un QR
 * nulo—, y ese botón pide confirmación desde un modal de z-index 1000. Con el cartel detrás,
 * la línea de un cliente no se puede recuperar desde la app. La de Mauricio lleva así 22 días.
 *
 * 3500 = arriba del techo de modales medido en el repo (3000: DestinatariosModal —retirado el 29/09/2026—,
 * PanelAgencia) y abajo de los carteles flotantes y del login (4000 y 9999), que no
 * tapan una pregunta a pantalla completa.
 */
const Z_CONFIRM = 3500;

export function Confirm({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
  zIndex = Z_CONFIRM,
  loading,
  bloqueado,
}: {
  /** El título ES la pregunta. Si solo tenés una frase, usá `message`. */
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para lo que destruye (rojo), `primary` para lo que solo confirma. */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
  /** La acción está corriendo: bloquea los dos botones y muestra el spinner. */
  loading?: boolean;
  /** Corre OTRA cosa del cartel, con su propio spinner: bloquea lo mismo, sin girar en el botón de acción. */
  bloqueado?: boolean;
}) {
  const okRef = useRef<HTMLButtonElement | null>(null);
  const cartelRef = useRef<HTMLDivElement | null>(null);

  // Escape cancela, Enter confirma. El foco arranca en el botón de acción, así
  // que quien navega por teclado no tiene que buscarlo.
  //
  // ⚠️ Una tecla MANTENIDA no confirma nada (`e.repeat`). Si el Enter que abrió el
  // cartel —el de un campo que guarda con Enter, como el presupuesto del Ads Manager—
  // se queda apretado, la autorrepetición llegaba acá y confirmaba sola: una pregunta
  // contestada sin que nadie la leyera. El preventDefault corta además el camino
  // nativo: con el foco en el botón de acción, el Enter repetido lo «clickea».
  // Medido el 07/10/2026 en el Ads Manager, sin esta línea: Enter mantenido = 1 POST.
  // Vale para todas las pantallas que usan este cartel, y en todas es lo correcto.
  //
  // ⚠️ ENTER SOBRE OTRO BOTÓN ES ESE BOTÓN (revisión del 30/10/2026): la escucha va antes que nadie, y con el foco en «Cancelar» o en «Descartar», un Enter
  // confirmaba: prendía la automatización. Se deja seguir, y el navegador lo clickea. Y el foco va al botón de acción UNA vez: con las flechas que le pasa
  // cada pantalla, cada render se lo volvía a robar al botón que estaba mirando la persona. Con algo en vuelo, Escape tampoco cierra, como el fondo: el resultado se perdía.
  // ⚠️ SÓLO LOS DE ESTE CARTEL (revisión del 31/10/2026): este cartel no atrapa el Tab, y un botón de atrás del velo se clickeaba con el cartel abierto. Con el foco
  // afuera, Enter confirma y no clickea nada (`preventDefault`); si está en OTRO cartel, es de ése. `data-sin-enter`: un lugar del cartel donde Enter no hace nada
  // (AvisoRitmoConfirm, después de descartar: el mensaje cambió, y el Enter que descartó no tiene que prender).
  const ocupado = loading || bloqueado;
  useEffect(() => { okRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); return; }
      if (e.key === 'Escape') { e.stopPropagation(); if (!ocupado) onCancel(); }
      if (e.key !== 'Enter') return;
      const t = e.target instanceof Element ? e.target : null;
      const cartel = t?.closest('[role="alertdialog"]');
      if (cartel && cartel !== cartelRef.current) return;
      if (cartel && t !== okRef.current && t?.closest('button, a, [data-sin-enter]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!ocupado) onConfirm();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onConfirm, onCancel, ocupado]);

  return (
    <div onClick={(e) => { e.stopPropagation(); if (!ocupado) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'mkFade .12s ease' }}>
      <div ref={cartelRef} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true"
        style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px', animation: 'mkPop .16s ease' }}>
        {title && <div style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>{title}</div>}
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.55 }}>{message}</div>
        <div className="mk-row mk-row--stack" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={ocupado}>{cancelLabel}</Button>
          <Button ref={okRef} variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} loading={loading} disabled={bloqueado}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

type ConfirmOpts = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Pendiente = ConfirmOpts & { msg: ReactNode; resolve: (ok: boolean) => void };

/**
 * `confirm()` con API de promesa, para reemplazar window.confirm() sin
 * reestructurar la función que lo llama (solo tiene que ser async, que las
 * acciones destructivas ya suelen serlo).
 */
export function useConfirm() {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const confirm = useCallback(
    (msg: ReactNode, opts?: ConfirmOpts) => new Promise<boolean>((resolve) => setPendiente({ msg, ...opts, resolve })),
    [],
  );
  const confirmNode = pendiente ? (
    <Confirm
      title={pendiente.title}
      message={pendiente.msg}
      confirmLabel={pendiente.confirmLabel ?? 'Eliminar'}
      cancelLabel={pendiente.cancelLabel}
      tone={pendiente.danger === false ? 'primary' : 'danger'}
      onConfirm={() => { pendiente.resolve(true); setPendiente(null); }}
      onCancel={() => { pendiente.resolve(false); setPendiente(null); }}
    />
  ) : null;
  return { confirm, confirmNode };
}
