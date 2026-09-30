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
import { createLeadAction, crearLeadEnTableroAction, moverLeadAFunnelAction, type ChoqueDeLead } from '../actions';

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
    /**
     * Cambiar a la vista de «traer de otro producto».
     *
     * ⚠️ LA DECIDE EL PADRE, no este form: la vista de traer necesita un modal mucho más
     * ancho (una tabla con seis columnas) y un título distinto. Un form no puede cambiar
     * el tamaño de la caja que lo contiene. Ausente = no se ofrece.
     */
    onTraer?: () => void;
  };
} = {}) {
  const [err, setErr] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();
  /**
   * Con quién choca el alta. Reemplaza al string pelado de antes: sin los ids la
   * pantalla no puede ofrecer nada, y un aviso sin salida es el que manda a alguien a
   * buscar a mano en otro tablero.
   */
  const [choque, setChoque] = useState<ChoqueDeLead['coincidencias'] | null>(null);
  /** Lo tipeado, para poder reintentar el alta con «Crear igual» sin volver a escribirlo. */
  const [pendiente, setPendiente] = useState<FormData | null>(null);


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
          if ('error' in r) {
            setErr(r.error);
            // Las coincidencias son lo que convierte el aviso en una decisión. Si el
            // error no es un duplicado vienen vacías y la pantalla muestra sólo la frase.
            setChoque(r.coincidencias.length ? r.coincidencias : null);
            setPendiente(r.coincidencias.length ? fd : null);
            return;
          }
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

      {err && !choque && (
        <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
      )}

      {/* ⚠️ UN DUPLICADO NO ES UN ERROR: ES UNA DECISIÓN. El pedido, textual: «si se
          detecta que se está agregando un lead nuevo, pero que ya está en otro funnel…
          que le advierta que el lead ya existe y que le pregunte si lo quiere traer».
          Por eso acá van las TRES salidas y no un texto rojo: abrir el que ya está,
          moverlo a este producto, o crearlo igual sabiendo con quién choca. */}
      {choque && (
        <div style={{ borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg)', padding: '13px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{err}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
            {choque.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', borderRadius: 10, padding: '9px 12px' }}>
                <span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                {c.producto && <span style={{ flex: 'none', fontSize: 12.5, color: 'var(--dim)' }}>{c.producto}</span>}
                <span style={{ flex: 1 }} />
                <Link href={`/crm/${c.id}`} target="_blank"
                  style={{ flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Abrir</Link>
                {/* ⚠️ Dice MOVER y no «traer» porque eso es lo que hace: el producto de un
                    lead es una sola columna, así que sale del tablero donde está. */}
                {enModal && c.funnelId !== (enModal.funnelId ?? null) && (
                  <button type="button" disabled={guardando}
                    onClick={() => startGuardar(async () => {
                      const r = await moverLeadAFunnelAction(c.id, enModal.funnelId ?? null);
                      if ('error' in r) { setErr(r.error); return; }
                      enModal.onCreado(c.id);
                    })}
                    style={{ flex: 'none', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Moverlo aquí
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button type="button" disabled={guardando}
              onClick={() => {
                if (!enModal || !pendiente) return;
                startGuardar(async () => {
                  // El tercer argumento es el permiso explícito, y sólo se manda desde acá:
                  // lo pide una persona que ya vio la lista de arriba.
                  const r = await crearLeadEnTableroAction(pendiente, enModal.funnelId ?? null, true);
                  if ('error' in r) { setErr(r.error); return; }
                  enModal.onCreado(r.id);
                });
              }}
              style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              Crear igual
            </button>
            <button type="button" onClick={() => { setChoque(null); setErr(null); setPendiente(null); }}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>
              Cambiar los datos
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
        {enModal
          ? <button type="button" onClick={enModal.onCerrar} style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          : <Link href="/crm" style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>Cancelar</Link>}
        <button type="submit" disabled={guardando} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS, opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Creando…' : 'Crear lead'}</button>
      </div>

      {/* ⚠️ ESTE BOTÓN NO ABRE NADA ACÁ: avisa al padre, que cambia la VISTA ENTERA del
          modal. «Cuando le doy, debe reemplazar al formulario de arriba, con un botón de
          atrás claro» (Martín, 30/09/2026). Antes desplegaba un buscador debajo del
          formulario, y con eso el modal pedía dos cosas a la vez —cargar a alguien nuevo y
          buscar a alguien que ya está—, que son dos tareas y ninguna es un paso de la otra. */}
      {enModal?.onTraer && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <button type="button" onClick={enModal.onTraer}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Traer de otro producto
          </button>
        </div>
      )}
    </form>
  );
}

/** Un campo con su rótulo, su asterisco de obligatorio y su ayuda. */
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
