'use client';

// =============================================================================
// DestinatariosCanal — a quién le llega, de UN canal, adentro de su tile
// =============================================================================
// El editor de destinatarios que antes vivía en un modal con las dos listas
// juntas, recortado a un canal y metido adentro del tile de ESE canal. Se ve
// siempre: el tile dice a quién le llega y esto cambia exactamente eso, así que
// esconderlo detrás de un click obligaba a abrir para saber qué hay.
//
// ⚠️ SE GUARDAN LOS DOS ARRAYS IGUAL. `/api/perfil/destinatarios` recibe la lista
// COMPLETA y no un parche, así que cada alta o baja manda las DOS — mandar sólo
// los teléfonos borraría los emails. Por eso este componente recibe `inicial`
// entero y sólo deja EDITAR el canal que le toca.
//
// ⚠️ Y SE GUARDA SOLO, SIN BOTÓN (pedido del dueño: «que el botón de Guardar no
// exista, para eso sólo un check al final del input»). El camino mudo del
// 21/8/2026 —«le doy a enviar y no pasa nada, ni siquiera un mensaje de error»—
// sigue cerrado, pero cambió de lugar, así que las tres guardas son otras:
//   · el tilde NUNCA se deshabilita y dice por qué no puede (vive en `Lista`),
//   · se PINTA cuando hay algo escrito sin confirmar — es lo único que queda del
//     riesgo de «lo escribí y creí que había quedado», que antes cubría el
//     borrador del «Guardar»,
//   · y el resultado se dice acá: el ✓, el error, y quién no entró al grupo de
//     WhatsApp con el link para pasarlo a mano.

import { useState } from 'react';
import { Lista, paraLeer, type Destinatarios } from './DestinatariosLista';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export function DestinatariosCanal({ canal, inicial, onGuardado }: {
  canal: 'whatsapp' | 'email';
  inicial: Destinatarios;
  onGuardado: (d: Destinatarios) => void;
}) {
  const [tel, setTel] = useState<string[]>(inicial.telefonos);
  const [mail, setMail] = useState<string[]>(inicial.emails);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [noAgregados, setNoAgregados] = useState<Array<{ telefono: string; motivo: string }>>([]);
  const [linkGrupo, setLinkGrupo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const esWa = canal === 'whatsapp';
  const saca = esWa && tel.length < inicial.telefonos.length;

  /** Toda alta o baja guarda en el acto. Las DOS listas, siempre. */
  async function guardar(telefonos: string[], emails: string[]) {
    setBusy(true); setError(null); setFlash(null); setNoAgregados([]); setLinkGrupo(null); setCopiado(false);
    const antesTel = tel;
    const antesMail = mail;
    setTel(telefonos); setMail(emails);   // optimista: la fila responde al toque
    try {
      const j = await (await fetch('/api/perfil/destinatarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefonos, emails }),
      })).json();
      if (!j.ok) {
        // Se vuelve atrás: dejar la fila puesta afirma un guardado que no pasó.
        setTel(antesTel); setMail(antesMail);
        setError(j.error || 'No se pudo guardar');
        return;
      }
      const d = j.destinatarios as Destinatarios;
      setTel(d.telefonos); setMail(d.emails);
      onGuardado(d);
      // ⚠️ Guardar la lista y sumar al grupo son DOS cosas, y la segunda falla sola.
      // Si falló se dice, y con el link: decir «listo» sobre algo que no pasó es el
      // bug original.
      const fallidos = (j.noAgregados ?? []) as Array<{ telefono: string; motivo: string }>;
      if (fallidos.length) {
        setNoAgregados(fallidos);
        setLinkGrupo((j.linkGrupo as string | null) ?? null);
        return;
      }
      setFlash('Guardado ✓');
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setTel(antesTel); setMail(antesMail);
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {/* `portalTo` va en null a propósito: acá no hay modal encima, así que el menú
          de ladas se abre en su lugar. Portalearlo pediría medir un nodo, que es justo
          donde vive esa familia de bugs. */}
      {esWa ? (
        <Lista
          icono="whatsapp" tipo="tel" placeholder="223 355 0684"
          items={tel} onChange={(v) => void guardar(v, mail)} portalTo={null}
        />
      ) : (
        <Lista
          icono="email" tipo="email" placeholder="nombre@empresa.com"
          items={mail} onChange={(v) => void guardar(tel, v)} portalTo={null}
        />
      )}

      {(busy || flash || error) && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: error ? 'var(--bad)' : 'var(--good)' }}>
          {busy ? <span style={{ color: 'var(--faint)', fontFamily: MONO, fontWeight: 400 }}>Guardando…</span> : (error ?? flash)}
        </div>
      )}

      {noAgregados.length > 0 && (
        <div style={{ marginTop: 10, borderRadius: 10, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--bad)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
            {noAgregados.length === 1 ? 'Quedó guardado, pero no entró al grupo' : 'Quedaron guardados, pero no entraron al grupo'}
          </div>
          {noAgregados.map((n) => (
            <div key={n.telefono} style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, marginTop: 3 }}>
              <b>{paraLeer('tel', n.telefono)}</b> — <span style={{ color: 'var(--dim)' }}>{n.motivo}</span>
            </div>
          ))}

          {/* La salida que faltaba. WhatsApp puede negarse a que agreguemos a alguien
              (es SU configuración de privacidad, no un error nuestro) y el link del
              grupo siempre funciona. Se COPIA, no se abre: el link es para pasárselo a
              esa persona, no para entrar uno. */}
          {linkGrupo && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                flex: 1, minWidth: 0, fontSize: 11.5, fontFamily: MONO, color: 'var(--ink)',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{linkGrupo}</code>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(linkGrupo).then(() => setCopiado(true)); }}
                style={{
                  flex: 'none', padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border-strong)',
                  background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sacar a alguien de la lista no lo echa del grupo, y es a propósito: echarlo lo
          ven todos los demás y no es algo que se haga de rebote. */}
      {saca && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
          Deja de recibir, pero sigue en el grupo. Si hace falta, sácalo desde WhatsApp.
        </div>
      )}
    </div>
  );
}
