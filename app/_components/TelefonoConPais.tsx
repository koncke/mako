'use client';

// =============================================================================
// TelefonoConPais — selector de país + número, la ÚNICA forma de pedir un teléfono
// =============================================================================
// Existía solo adentro del wizard de onboarding, escrito inline. La pantalla de
// destinatarios (Integraciones › Notificaciones) pedía el teléfono con un input
// pelado y un placeholder «+54 9 3764 67-3479», confiando en que la persona
// escribiera el código de país a mano.
//
// EL CASO (2026-08-21). Un cliente quiso sumar a alguien a su grupo de MaKo y
// escribió el número como lo tiene agendado: sin código de país. Medido contra
// la API de WhatsApp, esa es la diferencia entre existir y no existir:
//
//     542233550684  →  exists: true
//       2233550684  →  exists: false      ← lo mismo, sin la lada
//
// El número entraba a la lista sin protestar (la validación pedía «8 dígitos o
// más») y después no se podía agregar a ningún grupo. Un campo que acepta algo
// inservible es un campo que delega en el usuario una regla que el sistema
// conoce mejor que él.
//
// ⚠️ `portalTo` NO es opcional adentro de un modal. El menú del Dropdown se
// portalea a `document.body` con `zIndex: 1000`; un modal de esta app está en
// 3000, así que el desplegable se abre POR DETRÁS y desde afuera se ve como un
// selector que no responde. Pasándole el nodo del modal, el menú queda adentro
// de su contexto de apilado. Es `position: fixed`, así que el `overflow` del
// modal no lo recorta.

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { PAISES, flagUrl, numeroTecleado } from '@/lib/paises';

/**
 * Las opciones del selector, UNA POR LADA.
 *
 * ⚠️ Estados Unidos y Canadá comparten `+1`, y lo que este selector elige es la
 * LADA, no el país: dos renglones con el mismo valor son la misma opción escrita
 * dos veces. React lo gritaba —«Encountered two children with the same key»— y
 * con claves repetidas puede omitir o duplicar renglones. Venía de antes, en el
 * wizard de onboarding, donde el mapeo era idéntico.
 *
 * Se funden en un renglón que nombra a los dos («Estados Unidos · Canadá») en vez
 * de tirar uno: sacar a Canadá de la lista haría que un canadiense tenga que
 * elegir «Estados Unidos», que es exactamente el tipo de detalle que hace dudar
 * de si el formulario entendió lo que se le dijo.
 */
function opcionesPorLada() {
  const porDial = new Map<string, { nombres: string[]; iso2: string }>();
  for (const p of PAISES) {
    const ya = porDial.get(p.dial);
    if (ya) ya.nombres.push(p.nombre);
    else porDial.set(p.dial, { nombres: [p.nombre], iso2: p.iso2 });
  }
  return [...porDial.entries()].map(([dial, { nombres, iso2 }]) => ({
    value: dial, label: dial, sub: nombres.join(' · '), avatar: flagUrl(iso2), avatarCuadrado: true,
  }));
}

export function TelefonoConPais({
  lada, numero, onLada, onNumero, onEnter, inputStyle, placeholder = '223 355 0684',
  portalTo, anchoLada = 128, autoFocus,
}: {
  lada: string;
  numero: string;
  onLada: (v: string) => void;
  onNumero: (v: string) => void;
  onEnter?: () => void;
  inputStyle: CSSProperties;
  placeholder?: string;
  /** El nodo del modal/panel que lo contiene. Ver la nota de arriba. */
  portalTo?: HTMLElement | null;
  anchoLada?: number;
  autoFocus?: boolean;
}) {
  const opciones = useMemo(opcionesPorLada, []);

  // ⚠️ UN NÚMERO QUE LLEGA CON SU «+código» CAMBIA LAS DOS COSAS, Y NO EN EL MISMO EVENTO (revisión
  // del 12/10/2026). Varios padres guardan lada y número en UN objeto con un spread sobre el estado
  // del render (`setDraft({ ...draft, lada })`, TelefonosPanel; `cambiarTel({ ...tel, … })`): llamar a
  // `onLada` y `onNumero` seguidos hace que el segundo pise al primero con la lada vieja. Así que la
  // lada va primero y el número espera acá a que la lada nueva vuelva por props — con el `onNumero`
  // de ESE render, que ya la tiene.
  const pendiente = useRef<{ lada: string; numero: string } | null>(null);
  useEffect(() => {
    const p = pendiente.current;
    if (!p || p.lada !== lada) return;
    pendiente.current = null;
    onNumero(p.numero);
  }, [lada, onNumero]);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {/* Bandera como IMAGEN vía el prop avatar: los emoji de bandera en Windows
          se ven como las dos letras del país ("MX") — bug real reportado. */}
      <Dropdown
        value={lada} onChange={onLada} width={anchoLada} ariaLabel="Código de país" portalTo={portalTo}
        options={opciones}
      />
      <input
        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        value={numero}
        placeholder={placeholder}
        inputMode="tel"
        autoFocus={autoFocus}
        aria-label="Número sin el código de país"
        // Se dejan espacios y guiones para que pueda escribirlo como lo lee; los
        // dígitos se extraen al guardar. Un `+` al principio es el código de país
        // y se muda al selector (`numeroTecleado`, lib/paises.ts): dejarlo adentro
        // del número son dos códigos de país, el error que este componente vino a
        // hacer imposible.
        onChange={(e) => {
          pendiente.current = null;
          const r = numeroTecleado(e.target.value);
          if (r.lada && r.lada !== lada) { pendiente.current = { lada: r.lada, numero: r.numero }; onLada(r.lada); return; }
          onNumero(r.numero);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
      />
    </div>
  );
}
