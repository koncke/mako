'use client';

// =============================================================================
// NewLeadForm — form de alta con validación: nombre + (email O teléfono)
// =============================================================================
// Sin contacto el lead es incontactable, así que se exige al menos un canal.
// El submit va a la server action createLeadAction (que re-valida).
//
// ⚠️ EL MISMO FORM EN DOS CONTENEDORES: la ruta /crm/new (que navega a la ficha
// nueva) y el modal del tablero (que se cierra y la abre ahí mismo). Lo único que
// cambia es a dónde se va después, así que es UNA prop y no dos componentes: dos
// copias de un form de seis campos divergen en el primer campo que se agregue.
//
// Lo que el modo modal cambia, y nada más:
//   · la acción — `crearLeadEnTableroAction`, que devuelve el id en vez de redirigir
//   · «Cancelar» — cierra en vez de navegar
//   · la caja — sin borde ni fondo propios: el Modal ya los pone

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { createLeadAction, crearLeadEnTableroAction } from '../actions';

const SANS = "'Geist', sans-serif";
const field: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const card: CSSProperties = { maxWidth: 720, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px,4vw,32px)' };

export function NewLeadForm({ enModal }: {
  /** Presente = el form vive adentro del modal del tablero. Ausente = es la ruta. */
  enModal?: {
    onCerrar: () => void;
    onCreado: (id: number) => void;
    /** El funnel que se está mirando. null = el del negocio. */
    funnelId?: number | null;
  };
} = {}) {
  const [err, setErr] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  /** La validación de acá es la MISMA que la del server, y corre antes para no
   *  perder lo tipeado en un viaje. El server la repite: este chequeo es
   *  comodidad, no la guarda. */
  const faltaContacto = (fd: FormData) =>
    !String(fd.get('email') ?? '').trim() && !String(fd.get('telefono') ?? '').trim();

  return (
    <form
      action={enModal ? undefined : createLeadAction}
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        if (faltaContacto(fd)) {
          e.preventDefault();
          setErr('Carga al menos un email o un teléfono: sin eso el lead es incontactable.');
          return;
        }
        setErr(null);
        if (!enModal) return;
        // En el modal el submit no navega: se crea, se avisa y el tablero decide.
        e.preventDefault();
        startGuardar(async () => {
          // ⚠️ El lead nace en el tablero DESDE EL QUE SE LO ESTA CREANDO. Sin esto se
          // iba al funnel del negocio y desaparecia de la pantalla donde se acababa de
          // cargar — que es el peor final posible para un alta.
          const r = await crearLeadEnTableroAction(fd, enModal.funnelId ?? null);
          if ('error' in r) { setErr(r.error); return; }
          enModal.onCreado(r.id);
        });
      }}
      style={enModal
        ? { display: 'flex', flexDirection: 'column', gap: 16 }
        : { ...card, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <Field label="Nombre" required>
        <input type="text" name="nombre" required autoFocus style={field} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Field label="Email" hint="Al menos uno: email o teléfono."><input type="email" name="email" style={field} /></Field>
        <Field label="Teléfono"><input type="tel" name="telefono" style={field} /></Field>
      </div>

      <Field label="Empresa"><input type="text" name="empresa" style={field} /></Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Field label="Fecha de agendamiento"><input type="date" name="fecha_agenda" style={field} /></Field>
        <Field label="Fecha de Reunión 1 (si ya la tienes)"><input type="date" name="fecha_junta_1" style={field} /></Field>
      </div>

      {err && (
        <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
        {enModal
          ? <button type="button" onClick={enModal.onCerrar} style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          : <Link href="/crm" style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>Cancelar</Link>}
        <button type="submit" disabled={guardando} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS, opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Creando…' : 'Crear lead'}</button>
      </div>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>
        {label}{required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 12, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}
