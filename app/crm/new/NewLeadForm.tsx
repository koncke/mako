'use client';

// =============================================================================
// NewLeadForm — el alta de un lead: CUATRO campos, y el resto se carga en la ficha
// =============================================================================
// Pedido de Martín (12/10/2026, puntos 27 y 28): «mucho mejor que el modal de "Nuevo Lead" sea
// simple, solo nombre, email y teléfono, que el resto se pueda configurar dentro... Y una vez
// que creo se debe abrir el detail automáticamente» y «Que sean 4 opciones... "Nombre, Email,
// Telefono, Instagram"». Se fueron la empresa y las dos fechas (agendamiento y Reunión 1, punto
// 6): todo eso se edita en la ficha, que se abre sola al crear (el tablero: `onCreado`).
//
// Validación: nombre + (email O teléfono). Sin contacto el lead es incontactable, así que se
// exige al menos un canal. El submit va a la server action, que RE-valida.
//
// ⚠️ EL MISMO FORM EN DOS CONTENEDORES: la ruta /crm/new (que navega a la ficha
// nueva) y el modal del tablero (que se cierra y la abre ahí mismo). Lo único que
// cambia es a dónde se va después, así que es UNA prop y no dos componentes: dos
// copias de un form divergen en el primer campo que se agregue.
//
// Lo que el modo modal cambia, y nada más:
//   · la acción — `crearLeadEnTableroAction`, que devuelve el id en vez de redirigir
//   · la caja — sin borde ni fondo propios: el Modal ya los pone
//
// ⚠️ SIN «CANCELAR» (punto 20: «elimina el botón de "Cancelar" para eso ya está la cruz de
// arriba»). En el modal cierra la ✕; en la ruta, el «← Volver» de arriba. Y «Crear lead» va
// abajo de todo, en la MISMA fila que «Traer de otro funnel» («que esté alineado abajo del todo,
// donde está el botón de "Traer de otro funnel"»).

import { useCallback, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { DIAL_DEFAULT, unirTelefono } from '@/lib/paises';
import { useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import { InstagramBuscador, type PerfilIg } from '@/app/crm/new/InstagramBuscador';
import { instagramDelAlta } from '../campo-inline';
import { createLeadAction, crearLeadEnTableroAction, type ChoqueDeLead } from '../actions';
import { agregarAProductoAction, quitarDeProductoAction } from '../lead-funnel-actions';

const SANS = "'Geist', sans-serif";
const field: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const card: CSSProperties = { maxWidth: 720, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px,4vw,32px)' };
/** El id del nombre, para enfocarlo cuando la caja YA se ve (`autoFocus` adentro de un Modal no llega). */
const ID_NOMBRE = 'nuevo-lead-nombre';

export function NewLeadForm({ enModal }: {
  /** Presente = el form vive adentro del modal del tablero. Ausente = es la ruta. */
  enModal?: {
    // Sin `onCerrar`: el form ya no tiene «Cancelar» (punto 20), cierra la ✕ del Modal.
    onCreado: (id: number) => void;
    /**
     * Se AGREGÓ a este producto un lead que ya existía («Agregarlo aquí»), en vez de crear
     * uno. Va aparte de `onCreado` porque el aviso no es el mismo («Lead creado» sobre
     * alguien que ya estaba miente), y trae el deshacer: saca al lead SÓLO de este producto
     * (`quitarDeProductoAction`) — ausente si ya estaba y no se escribió nada.
     *
     * Ausente = se usa `onCreado`, que abre la ficha igual.
     */
    onAgregado?: (id: number, deshacer?: () => Promise<void>) => void;
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

  // ⚠️ EL TELÉFONO VA CON EL PAÍS PRIMERO (punto 5: «siempre en todos lados que pida telefono,
  // primero tiene que ir la numeración que ya tenemos con las banderas, el desplegable»).
  // Lo que viaja al server es `unirTelefono(lada, número)`: los DÍGITOS con el código de país
  // (`525512345678`), que es lo que `splitTelefono` sabe volver a separar en la ficha y lo
  // mismo que guarda el teléfono editado en el lugar (app/crm/lead-view/CampoEditable.tsx).
  // El server (`createLead`) guarda el texto tal cual y saca los dígitos para
  // `telefono_normalizado`, así que la llave de match con WhatsApp no cambia de forma; lo que
  // cambia es que ya no puede llegar un número sin su lada, que es el que nunca matcheaba.
  const [lada, setLada] = useState(DIAL_DEFAULT);
  const [numero, setNumero] = useState('');
  const telefono = numero.replace(/\D/g, '') ? unirTelefono(lada, numero) : '';
  // Instagram (punto 28): el buscador de perfiles (app/crm/new/InstagramBuscador.tsx). Se guarda
  // el USUARIO, sin la @ (`leads.instagram`, mig 0258); la foto es para la lista y vence.
  const [perfil, setPerfil] = useState<PerfilIg | null>(null);
  // Y lo ESCRITO en el buscador: si es un @ y nadie eligió un perfil de la lista, se guarda igual
  // (`instagramDelAlta`). Sin esto, «@martinkoncke» tipeado y «Crear lead» creaba el lead sin él.
  const [igEscrito, setIgEscrito] = useState('');
  // El nodo del form, para que el desplegable de países se abra ADENTRO del modal (la nota de
  // `portalTo` en TelefonoConPais). Estable: un ref en línea es una función nueva por render.
  const [caja, setCaja] = useState<HTMLFormElement | null>(null);
  const refCaja = useCallback((el: HTMLFormElement | null) => setCaja(el), []);
  useFocoInicial(ID_NOMBRE);

  /** La validación de acá es la MISMA que la del server, y corre antes para no
   *  perder lo tipeado en un viaje. El server la repite: este chequeo es
   *  comodidad, no la guarda. */
  const faltaContacto = (fd: FormData) =>
    !String(fd.get('email') ?? '').trim() && !String(fd.get('telefono') ?? '').trim();

  return (
    <form
      ref={refCaja}
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
        <input id={ID_NOMBRE} type="text" name="nombre" required autoFocus style={field} />
      </Field>

      <Field label="Email" hint="Al menos uno: email o teléfono.">
        <input type="email" name="email" style={field} />
      </Field>

      {/* ⚠️ GRUPO Y NO <label>: adentro hay DOS controles (el país y el número), y un <label>
          le reenvía el clic de su texto al PRIMERO — o sea que tocar «Teléfono» abría el
          desplegable de países. El número viaja en un campo oculto, ya unido a su lada. */}
      <Field label="Teléfono" grupo>
        <TelefonoConPais lada={lada} numero={numero} onLada={setLada} onNumero={setNumero}
          inputStyle={field} portalTo={enModal ? caja : undefined} />
        <input type="hidden" name="telefono" value={telefono} />
      </Field>

      <Field label="Instagram" grupo>
        <InstagramBuscador valor={perfil} onElegir={setPerfil} onTexto={setIgEscrito} />
        <input type="hidden" name="instagram" value={instagramDelAlta(perfil?.usuario, igEscrito)} />
      </Field>

      {err && !choque && (
        <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
      )}

      {/* ⚠️ UN DUPLICADO NO ES UN ERROR: ES UNA DECISIÓN. El pedido, textual: «si se
          detecta que se está agregando un lead nuevo, pero que ya está en otro funnel…
          que le advierta que el lead ya existe y que le pregunte si lo quiere traer».
          Por eso acá van las TRES salidas y no un texto rojo: abrir el que ya está,
          agregarlo a este producto, o crearlo igual sabiendo con quién choca. */}
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
                {/* ⚠️ Dice AGREGAR y no «mover» porque eso es lo que hace desde el 06/10/2026
                    (mig 0207): suma una fila en ESTE producto y su casa no se toca. Antes
                    movía, y un lead «traído» desaparecía del producto principal de Mauricio:
                    «Eso JAMÁS debe pasar» (Martín). Y sólo aparece si NO está acá, por casa
                    o por fila: lo decide el server (`estaAca`, con `estaEnProducto`), no un
                    `funnelId !==` crudo que decía «en otro producto» sobre un agregado. */}
                {enModal && !c.estaAca && (
                  <button type="button" disabled={guardando}
                    onClick={() => startGuardar(async () => {
                      const destino = enModal.funnelId ?? null;
                      const r = await agregarAProductoAction(c.id, destino);
                      if (!r.ok) { setErr(r.error); return; }
                      const deshacer = r.agregado
                        ? async () => {
                          const q = await quitarDeProductoAction(c.id, destino);
                          if (!q.ok) throw new Error(q.error);
                        }
                        : undefined;
                      if (enModal.onAgregado) enModal.onAgregado(c.id, deshacer);
                      else enModal.onCreado(c.id);
                    })}
                    style={{ flex: 'none', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Agregarlo aquí
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

      {/* LA FILA DE ABAJO DE TODO: «Traer de otro funnel» a la izquierda y «Crear lead» a la
          derecha, en la misma línea (punto 20). Sin «Cancelar»: la ✕ del modal ya cierra.

          ⚠️ «TRAER» NO ABRE NADA ACÁ: avisa al padre, que cambia la VISTA ENTERA del
          modal. «Cuando le doy, debe reemplazar al formulario de arriba, con un botón de
          atrás claro» (Martín, 30/09/2026). Antes desplegaba un buscador debajo del
          formulario, y con eso el modal pedía dos cosas a la vez —cargar a alguien nuevo y
          buscar a alguien que ya está—, que son dos tareas y ninguna es un paso de la otra. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: enModal?.onTraer ? '1px solid var(--border)' : undefined, paddingTop: enModal?.onTraer ? 14 : 4 }}>
        {enModal?.onTraer && (
          <button type="button" onClick={enModal.onTraer}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Traer de otro funnel
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="submit" disabled={guardando} style={{ flex: 'none', padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS, opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Creando…' : 'Crear lead'}</button>
      </div>
    </form>
  );
}

/**
 * Un campo con su rótulo, su asterisco de obligatorio y su ayuda.
 * `grupo` = adentro hay más de un control: va como <div> con el rótulo arriba, porque un
 * <label> le reenvía el clic de su texto a su primer control.
 */
function Field({ label, required, hint, grupo, children }: { label: string; required?: boolean; hint?: string; grupo?: boolean; children: ReactNode }) {
  const rotulo = (
    <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>
      {label}{required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
    </span>
  );
  const ayuda = hint && <span style={{ display: 'block', fontSize: 12, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>;
  return grupo
    ? <div role="group" aria-label={label} style={{ display: 'block' }}>{rotulo}{children}{ayuda}</div>
    : <label style={{ display: 'block' }}>{rotulo}{children}{ayuda}</label>;
}
