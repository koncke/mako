'use client';

import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';

// =============================================================================
// NoEsTuyo — el link de una propuesta que no es de tu cuenta
// =============================================================================
// Antes acá salía «No encontramos esa propuesta», que junta dos casos muy distintos:
// el link mal copiado y el aislamiento haciendo exactamente lo que tiene que hacer.
// El dueño lo pidió textual: «debería aparecer el mismo mensaje del plan, tipo "Estas
// no son tus tareas" con el botón para ir a tu CRM».
//
// Es el gemelo de app/plan/revisar/[id]/NoEsTuyo.tsx y comparte su criterio: se dice
// QUE es de otra cuenta y —solo al super-admin— de cuál. NUNCA se muestra su
// contenido: eso sigue del lado del server, scopeado por workspace.
// =============================================================================

const SANS = "'Geist', sans-serif";

/** Pasar a ver esa cuenta: MISMA puerta que la barra de impersonación, no una nueva.
 *  Si el server dice que no, no pasa nada. */
async function irALaCuentaDe(ws: number, ruta: string) {
  const r = await fetch('/api/admin/impersonate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ws }),
  }).then((x) => x.json()).catch(() => ({ ok: false }));
  if (r?.ok) window.location.href = conWs(ruta, ws);
}

/** De qué se habla. Por defecto, de los contactos del CRM (esta pantalla nació ahí);
 *  la bandeja de acciones de MaKo (/mako/revisar) pasa los suyos: «Estos no son tus
 *  contactos» sobre una acción de otra cuenta afirma algo que no es. */
export type TextosNoEsTuyo = {
  titulo: string;
  /** «su CRM», «su bandeja de MaKo»: completa «Puedes pasar a … para verlo». */
  lugarDeOtro: string;
  /** «Ir al CRM de», «Ir a la bandeja de»: el botón agrega el nombre. */
  botonDeOtro: string;
  botonMio: string;
  ruta: string;
};

const TEXTOS_CRM: TextosNoEsTuyo = {
  titulo: 'Estos no son tus contactos', lugarDeOtro: 'su CRM', botonDeOtro: 'Ir al CRM de', botonMio: 'Ir a mi CRM', ruta: '/crm',
};

export function NoEsTuyo({ existe, deQuien, wsDestino, textos = TEXTOS_CRM }: {
  /** el id existe pero es de otra cuenta (false = el link no existe o está mal escrito). */
  existe: boolean;
  /** nombre del workspace dueño. Solo se muestra al super-admin. */
  deQuien: string;
  /** si viene, se ofrece pasar a esa cuenta (solo super-admin). */
  wsDestino: number | null;
  textos?: TextosNoEsTuyo;
}) {
  const puedeIr = existe && wsDestino != null;
  // La pestaña que se está mirando. Sin esto, volver «a lo tuyo» te devuelve
  // literalmente a lo TUYO aunque estuvieras revisando la cuenta de un cliente.
  const ws = useWs();
  const btn = {
    padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  } as const;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 24 }}>
      <div style={{ textAlign: 'center', padding: '30px 34px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 460 }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>
          {existe ? textos.titulo : 'Esa propuesta no existe'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.55 }}>
          {existe
            ? (puedeIr && deQuien
              ? <>Este borrador es de <strong style={{ color: 'var(--ink)' }}>{deQuien}</strong>. Puedes pasar a {textos.lugarDeOtro} para verlo.</>
              : 'Este borrador es de otra cuenta. Entra con esa cuenta para verlo.')
            : 'Fíjate que el link esté entero — a veces se corta al copiarlo de un chat.'}
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          {puedeIr && (
            <button type="button" style={{ ...btn, background: 'var(--primary)', color: '#fff', borderColor: 'transparent' }} onClick={() => void irALaCuentaDe(wsDestino, textos.ruta)}>
              {textos.botonDeOtro} {deQuien}
            </button>
          )}
          <button type="button" style={btn} onClick={() => { window.location.href = conWs(textos.ruta, ws); }}>
            {textos.botonMio}
          </button>
        </div>
      </div>
    </main>
  );
}
