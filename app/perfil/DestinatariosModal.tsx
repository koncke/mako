'use client';

// =============================================================================
// DestinatariosModal — a quiénes les llegan las notificaciones del negocio
// =============================================================================
// Reemplaza a la card "Tu WhatsApp", que ocupaba media pantalla para un solo
// input y además solo aceptaba un número. Un negocio reparte: el dueño quiere el
// reporte, la asistente los avisos de reuniones, el contador la cobranza.
//
// El PRIMER número es el principal: es con el que se crea el grupo de WhatsApp de
// MaKo. Los demás se suman como participantes de ese mismo grupo.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { TelefonoConPais } from '../_components/TelefonoConPais';
import { DIAL_DEFAULT, splitTelefono, unirTelefono } from '@/lib/paises';
import { telefonoValido, emailValido, type Destinatarios } from '@/lib/notif-catalogo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type { Destinatarios };

const inputStyle: CSSProperties = {
  flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontSize: 14, fontFamily: SANS,
};
const btnDark: CSSProperties = {
  padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511',
  color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: CSSProperties = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
const labelStyle: CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase',
  color: 'var(--dim)', marginBottom: 8, display: 'block',
};

/** El valor final de lo que se está escribiendo (para el teléfono: lada + resto). */
const compuestoDe = (tipo: 'tel' | 'email', lada: string, crudo: string): string =>
  tipo === 'tel' ? unirTelefono(lada, crudo) : crudo.trim();

/**
 * Cómo se LEE un destinatario ya guardado. El teléfono se muestra con la lada
 * separada (`+52 2233550684`) y no como el muro de dígitos que se almacena.
 *
 * No es cosmética: todo este arreglo salió de un número al que le faltaba el
 * código de país, y un número que se lee de corrido es justamente uno en el que
 * nadie nota que la lada está mal (o que no está). Separada, se revisa de un
 * vistazo.
 */
function paraLeer(tipo: 'tel' | 'email', v: string): string {
  if (tipo !== 'tel') return v;
  const { lada, resto } = splitTelefono(v);
  return resto ? `${lada} ${resto}` : v;
}

/**
 * Una lista de destinatarios con su campo para sumar uno más.
 *
 * ⚠️ TRES COSAS ACÁ SON EL ARREGLO DEL 21/8/2026, y las tres son la misma:
 * **nada puede rechazarse en silencio.** Un cliente reportó «no puedo agregar a
 * nadie; le doy a enviar y no pasa nada, ni siquiera un mensaje de error», y
 * todos los caminos de rechazo de esta pantalla eran mudos.
 *
 *   1. El teléfono se pide con SELECTOR DE PAÍS, como en el onboarding. Antes era
 *      un input pelado con un placeholder y la lada quedaba a cargo del usuario;
 *      un número sin código de país no existe en WhatsApp (medido) y no se puede
 *      sumar a ningún grupo.
 *   2. El botón «Agregar» ya NO se deshabilita: **dice por qué no puede**. Un
 *      botón gris que no responde y no explica es indistinguible de uno roto.
 *   3. Lo escrito y no agregado SE AVISA (`onBorrador`), porque antes se perdía
 *      entero al guardar: escribir el número y darle a Guardar —sin tocar
 *      «Agregar»— dejaba la lista igual, el botón deshabilitado por no estar
 *      «sucia», y ni un mensaje.
 */
function Lista({ titulo, sub, items, onChange, placeholder, icono, tipo, onBorrador, portalTo }: {
  titulo: string; sub: string; items: string[]; onChange: (v: string[]) => void;
  placeholder: string; icono: string; tipo: 'tel' | 'email';
  /** Lo tipeado y todavía no agregado, para que el guardado no lo pierda. */
  onBorrador: (v: string) => void;
  portalTo: HTMLElement | null;
}) {
  const [nuevo, setNuevo] = useState('');
  const [lada, setLada] = useState(DIAL_DEFAULT);
  const [motivo, setMotivo] = useState<string | null>(null);

  // El valor completo: para el teléfono, lada + lo escrito.
  const compuesto = tipo === 'tel' ? unirTelefono(lada, nuevo) : nuevo.trim();
  // La MISMA regla con la que el server normaliza: si acá se aceptara algo que
  // allá se descarta, el usuario lo vería agregado y desaparecería al recargar.
  const valido = tipo === 'tel' ? telefonoValido(compuesto) : emailValido(compuesto);
  const yaEsta = items.some((v) => (tipo === 'tel' ? v.replace(/\D/g, '') === compuesto : v.trim().toLowerCase() === compuesto.toLowerCase()));

  const escribir = (v: string) => { setNuevo(v); setMotivo(null); onBorrador(v.trim() ? compuestoDe(tipo, lada, v) : ''); };
  const cambiarLada = (v: string) => { setLada(v); setMotivo(null); onBorrador(nuevo.trim() ? unirTelefono(v, nuevo) : ''); };

  const agregar = () => {
    if (!nuevo.trim()) {
      setMotivo(tipo === 'tel' ? 'Escribí el número (sin el código de país, ese lo elegís al lado).' : 'Escribí el email.');
      return;
    }
    // ⚠️ Cada rechazo dice QUÉ pasa. El duplicado se avisa en vez de descartarse
    // callado: el server deduplica igual, así que sin este mensaje la persona
    // agrega a alguien, no ve nada nuevo en la lista, y no sabe si funcionó.
    if (!valido) {
      setMotivo(tipo === 'tel'
        ? 'Ese número está incompleto. Va sin el 0 ni el 15, y sin el código de país.'
        : 'Eso no parece un email.');
      return;
    }
    if (yaEsta) { setMotivo('Ese ya está en la lista.'); return; }
    onChange([...items, compuesto]);
    setNuevo(''); setMotivo(null); onBorrador('');
  };

  return (
    <div>
      <span style={labelStyle}>{titulo}</span>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: -4, marginBottom: 10, lineHeight: 1.45 }}>{sub}</div>

      {items.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', marginBottom: 10 }}>
          Todavía no hay ninguno. Sin esto, MaKo no puede avisar por este canal.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
        {items.map((v, i) => (
          <div key={`${v}-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
            borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)',
          }}>
            <span style={{ display: 'flex', color: 'var(--dim)', flex: 'none' }}><Icon name={icono} size={16} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paraLeer(tipo, v)}</span>
            {i === 0 && (
              <span style={{
                flex: 'none', fontSize: 10.5, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border-strong)',
                borderRadius: 999, padding: '2px 8px',
              }}>
                Principal
              </span>
            )}
            <button
              type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Quitar ${v}`} title="Quitar"
              style={{ flex: 'none', border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', display: 'flex', padding: 3 }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {tipo === 'tel' ? (
            <TelefonoConPais
              lada={lada} numero={nuevo} onLada={cambiarLada} onNumero={escribir}
              onEnter={agregar} inputStyle={inputStyle} placeholder={placeholder} portalTo={portalTo}
            />
          ) : (
            <input
              value={nuevo}
              onChange={(e) => escribir(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
              placeholder={placeholder}
              inputMode="email"
              style={{ ...inputStyle, width: '100%' }}
            />
          )}
        </div>
        {/* Sin `disabled`: el botón contesta SIEMPRE, y cuando no puede dice por qué. */}
        <button type="button" onClick={agregar} style={btnGhost}>Agregar</button>
      </div>

      {motivo && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.45 }}>{motivo}</div>
      )}
    </div>
  );
}

export function DestinatariosModal({ inicial, onCerrar, onGuardado }: {
  inicial: Destinatarios;
  onCerrar: () => void;
  onGuardado: (d: Destinatarios) => void;
}) {
  const [tel, setTel] = useState<string[]>(inicial.telefonos);
  const [mail, setMail] = useState<string[]>(inicial.emails);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAgregados, setNoAgregados] = useState<Array<{ telefono: string; motivo: string }>>([]);
  const [linkGrupo, setLinkGrupo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Lo tipeado y NO agregado. Antes se perdía entero al guardar (ver la nota de
  // `Lista`): es la causa más probable del «le di a enviar y no pasó nada».
  const [borrTel, setBorrTel] = useState('');
  const [borrMail, setBorrMail] = useState('');
  // El nodo del modal: el menú del Dropdown se portalea acá adentro o se abre
  // por detrás (el modal está en z-index 3000 y el menú en 1000).
  const panelRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  useEffect(() => { setPanel(panelRef.current); }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  // Lo que se va a mandar incluye el borrador: si alguien escribió un número y
  // le dio a Guardar directo, su intención es sumarlo — no tirarlo.
  const telFinal = borrTel && telefonoValido(borrTel) && !tel.some((t) => t.replace(/\D/g, '') === borrTel) ? [...tel, borrTel] : tel;
  const mailFinal = borrMail && emailValido(borrMail) && !mail.includes(borrMail.toLowerCase()) ? [...mail, borrMail] : mail;

  const dirty = JSON.stringify([telFinal, mailFinal]) !== JSON.stringify([inicial.telefonos, inicial.emails]);
  // Hay algo escrito que NO es válido: Guardar lo tiene que decir, no ignorarlo.
  const borrInvalido = (borrTel && !telefonoValido(borrTel)) || (borrMail && !emailValido(borrMail));

  const guardar = async () => {
    if (borrInvalido) {
      setError('Hay un dato a medio escribir. Completalo y tocá «Agregar», o borralo.');
      return;
    }
    if (!dirty) { setError('No cambiaste nada todavía.'); return; }
    setBusy(true); setError(null); setNoAgregados([]); setLinkGrupo(null); setCopiado(false);
    try {
      const j = await (await fetch('/api/perfil/destinatarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefonos: telFinal, emails: mailFinal }),
      })).json();
      if (!j.ok) { setError(j.error || 'No se pudo guardar'); return; }
      onGuardado(j.destinatarios as Destinatarios);
      // ⚠️ Guardar la lista y sumar al grupo son DOS cosas, y la segunda puede
      // fallar sola. Si falló, el modal NO se cierra: cerrarlo sería volver a
      // decir «listo» sobre algo que no pasó, que es el bug original.
      const fallidos = (j.noAgregados ?? []) as Array<{ telefono: string; motivo: string }>;
      if (fallidos.length) {
        setNoAgregados(fallidos);
        setLinkGrupo((j.linkGrupo as string | null) ?? null);
        setTel((j.destinatarios as Destinatarios).telefonos);
        setMail((j.destinatarios as Destinatarios).emails);
        setBorrTel(''); setBorrMail('');
        return;
      }
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Destinatarios de las notificaciones"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,21,27,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div ref={panelRef} style={{
        background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)',
        width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto',
        padding: '26px 28px', boxShadow: '0 24px 60px rgba(18,21,27,.28)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 19, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
          ¿A quién le avisa MaKo?
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 5, marginBottom: 22, lineHeight: 1.5 }}>
          Podés sumar a quien haga falta. Todos reciben lo que esté activado en cada canal.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <Lista
            titulo="WhatsApp" icono="whatsapp" tipo="tel"
            sub="El primero es con el que se arma el grupo de MaKo; el resto se suma a ese mismo grupo."
            items={tel} onChange={setTel} placeholder="223 355 0684"
            onBorrador={setBorrTel} portalTo={panel}
          />
          <Lista
            titulo="Email" icono="email" tipo="email"
            sub="Cada uno recibe su propia copia, no van en copia entre ellos."
            items={mail} onChange={setMail} placeholder="nombre@empresa.com"
            onBorrador={setBorrMail} portalTo={panel}
          />
        </div>

        {noAgregados.length > 0 && (
          <div style={{
            marginTop: 18, borderRadius: 10, padding: '12px 14px',
            background: 'var(--bad-bg, var(--surface-2))', border: '1px solid var(--bad)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              {noAgregados.length === 1 ? 'Quedó guardado, pero no entró al grupo' : 'Quedaron guardados, pero no entraron al grupo'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 8 }}>
              Van a recibir los reportes igual. Lo que falló es sumarlos al grupo de WhatsApp de MaKo.
            </div>
            {noAgregados.map((n) => (
              <div key={n.telefono} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, marginTop: 4 }}>
                <b>{paraLeer('tel', n.telefono)}</b> — <span style={{ color: 'var(--dim)' }}>{n.motivo}</span>
              </div>
            ))}

            {/* La salida que faltaba. WhatsApp puede negarse a que agreguemos a
                alguien (es SU configuración de privacidad, no un error nuestro),
                pero el link del grupo siempre funciona: con esto se resuelve
                desde acá en vez de quedar trabado. */}
            {linkGrupo && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 6 }}>
                  Pasale este link y entra solo:
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{
                    flex: 1, minWidth: 0, fontSize: 12, fontFamily: MONO, color: 'var(--ink)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '7px 9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{linkGrupo}</code>
                  <button
                    type="button" style={{ ...btnGhost, flex: 'none' }}
                    onClick={() => { void navigator.clipboard.writeText(linkGrupo).then(() => setCopiado(true)); }}
                  >
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tel.length < inicial.telefonos.length && (
          <div style={{ marginTop: 18, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
            Quien saques deja de recibir los reportes, pero sigue en el grupo de WhatsApp:
            echarlo de un grupo es visible para todos los demás y no es algo que se deba hacer
            solo. Si hace falta, sacalo desde WhatsApp.
          </div>
        )}

        {error && <div style={{ marginTop: 16, fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button type="button" onClick={onCerrar} style={btnGhost}>Cancelar</button>
          {/* ⚠️ Solo se deshabilita mientras GUARDA. Antes también se apagaba con
              `!dirty`, y ese era el camino mudo que reportó el cliente: escribís
              el número, no tocás «Agregar» (la lista no cambia → no está sucia),
              tocás Guardar y el botón no responde ni explica nada. Ahora el
              borrador cuenta como cambio, y cuando de verdad no hay nada que
              guardar el botón lo DICE. */}
          <button
            type="button" onClick={guardar} disabled={busy}
            style={{ ...btnDark, opacity: busy ? 0.5 : 1 }}
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
