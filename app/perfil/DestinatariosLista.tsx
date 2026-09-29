'use client';

// =============================================================================
// DestinatariosLista — a quiénes les llegan las notificaciones del negocio
// =============================================================================
// Reemplaza a la card "Tu WhatsApp", que ocupaba media pantalla para un solo
// input y además solo aceptaba un número. Un negocio reparte: el dueño quiere el
// reporte, la asistente los avisos de reuniones, el contador la cobranza.
//
// El PRIMER número es el principal: es con el que se crea el grupo de WhatsApp de
// MaKo. Los demás se suman como participantes de ese mismo grupo.
//
// ⚠️ ACÁ VIVÍA `DestinatariosModal`, el modal que preguntaba «¿a quién le avisa
// MaKo?» con las DOS listas juntas. Se fue el 29/09/2026: los destinatarios se
// editan ahora en la página, un canal a la vez, al abrir su tile
// (`DestinatariosCanal`). Lo que queda acá es la pieza compartida —una lista con
// su campo para sumar uno más— y lo que el modal tenía de propio se mudó, no se
// borró: el link del grupo, el aviso de quién no entró y la nota de que sacar a
// alguien de la lista no lo echa del grupo.

import { useState, type CSSProperties } from 'react';
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
export function paraLeer(tipo: 'tel' | 'email', v: string): string {
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
 *   3. Lo escrito y no agregado ya no se puede perder EN UN GUARDADO, porque no hay
 *      guardado: el tilde confirma y guarda de una. Antes había un «Guardar» aparte y
 *      escribir el número sin tocar «Agregar» dejaba la lista igual, el botón
 *      deshabilitado por no estar «sucia», y ni un mensaje. Lo que queda de ese
 *      riesgo —escribir y creer que quedó— lo cubre el tilde, que se pinta cuando hay
 *      algo esperando.
 */
export function Lista({ titulo, sub, items, onChange, placeholder, icono, tipo, portalTo }: {
  /**
   * El rótulo de arriba, en versalitas. OPCIONAL, y sin él es otra cosa: ese
   * tratamiento (MONO 10.5 uppercase) es el que la casa usa para abrir una SECCIÓN,
   * así que adentro de un recuadro que ya dice de qué canal habla, anuncia una
   * sección que no existe. El dueño lo cortó con todas las letras: «que no sea una
   * sección diferente, que esté todo en el mismo recuadro».
   */
  titulo?: string;
  /**
   * La línea que explicaba el canal. OPCIONAL, y hoy no la pasa nadie: decía cosas
   * ciertas («el primero es con el que se arma el grupo», «cada una recibe su propia
   * copia») que la pantalla YA muestra —el chip PRINCIPAL marca el primero— y que el
   * dueño cortó por innecesarias. El porqué vive acá, que es donde se busca.
   */
  sub?: string; items: string[]; onChange: (v: string[]) => void;
  placeholder: string; icono: string; tipo: 'tel' | 'email';
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

  /** Hay algo escrito y válido, esperando el tilde. Lo que lo pinta. */
  const pendiente = Boolean(nuevo.trim()) && valido && !yaEsta;

  const escribir = (v: string) => { setNuevo(v); setMotivo(null); };
  const cambiarLada = (v: string) => { setLada(v); setMotivo(null); };

  const agregar = () => {
    if (!nuevo.trim()) {
      setMotivo(tipo === 'tel' ? 'Escribe el número (sin el código de país, ese lo eliges al lado).' : 'Escribe el email.');
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
    setNuevo(''); setMotivo(null);
  };

  return (
    <div>
      {titulo && <span style={labelStyle}>{titulo}</span>}
      {sub && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: titulo ? -4 : 0, marginBottom: 10, lineHeight: 1.45 }}>{sub}</div>}

      {items.length === 0 && (
        // El vacío no explica la consecuencia: el campo para arreglarlo está justo
        // abajo, así que el párrafo ocupaba el lugar del arreglo.
        <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 8 }}>Todavía no hay ninguno.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {items.map((v, i) => (
          <div key={`${v}-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '6px 9px',
            borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <span style={{ display: 'flex', color: 'var(--dim)', flex: 'none' }}><Icon name={icono} size={16} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paraLeer(tipo, v)}</span>
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
        {/*
          El tilde reemplaza al botón «Agregar» y al «Guardar» que había abajo: acá se
          confirma y se guarda, en un solo gesto.

          ⚠️ SIN `disabled`, igual que antes: el botón contesta SIEMPRE, y cuando no
          puede dice por qué. Un botón gris que no responde y no explica es
          indistinguible de uno roto — es el reporte que originó todo esto.

          ⚠️ Y SE PRENDE CUANDO HAY ALGO ESCRITO SIN CONFIRMAR. Al sacar el «Guardar»
          apareció un riesgo que antes no existía: alguien escribe un número, no toca
          nada más y se va creyendo que quedó — no hay ningún botón pendiente que se lo
          recuerde. El tilde en color ES ese recordatorio.
        */}
        <button
          type="button" onClick={agregar}
          aria-label={tipo === 'tel' ? 'Agregar este número' : 'Agregar este email'}
          title={pendiente ? 'Agregar' : 'Escribe uno para agregarlo'}
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 9, cursor: 'pointer',
            border: `1px solid ${pendiente ? 'var(--primary)' : 'var(--border-strong)'}`,
            background: pendiente ? 'var(--primary)' : 'var(--surface)',
            color: pendiente ? '#fff' : 'var(--faint)',
            transition: 'background .13s, border-color .13s, color .13s',
          }}
        >
          <Icon name="check" size={17} />
        </button>
      </div>

      {motivo && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.45 }}>{motivo}</div>
      )}
    </div>
  );
}
