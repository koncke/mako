'use client';

// =============================================================================
// DestinatariosCanal — a quién le llega, de UN canal, en la página
// =============================================================================
// El editor de destinatarios que antes vivía en un modal con las dos listas
// juntas, recortado a un canal y puesto en la página. Se abre al tocar
// «Gestionar» en el tile de WhatsApp o de Email, arriba del contenido de ESE
// canal.
//
// Por qué un canal a la vez: el pedido del dueño fue «que no aparezcan ambos, si
// le doy a WhatsApp ese input, y viceversa». Y tiene sentido más allá del gusto —
// abajo se ven los mensajes DE ESE CANAL, así que mostrar las dos listas obliga a
// leer cuál corresponde a lo que estás mirando.
//
// ⚠️ SE GUARDAN LOS DOS ARRAYS IGUAL. `/api/perfil/destinatarios` recibe la lista
// completa, no un parche: mandar sólo los teléfonos borraría los emails. Por eso
// este componente recibe `inicial` entero y sólo deja EDITAR el canal abierto.
//
// ⚠️ Y LOS TRES CAMINOS MUDOS DEL 21/8/2026 SIGUEN CERRADOS ACÁ, porque el bug
// que los produjo no era del modal sino de esta pantalla: «no puedo agregar a
// nadie; le doy a enviar y no pasa nada, ni siquiera un mensaje de error». Son el
// borrador que cuenta como cambio, el «Guardar» que sólo se apaga mientras
// guarda, y el link del grupo cuando WhatsApp no deja sumar a alguien.

import { useState } from 'react';
import { Lista, paraLeer, type Destinatarios } from './DestinatariosLista';
import { telefonoValido, emailValido } from '@/lib/notif-catalogo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const btnGhost = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', flex: 'none',
} as const;

export function DestinatariosCanal({ canal, inicial, onGuardado }: {
  canal: 'whatsapp' | 'email';
  inicial: Destinatarios;
  onGuardado: (d: Destinatarios) => void;
}) {
  const [tel, setTel] = useState<string[]>(inicial.telefonos);
  const [mail, setMail] = useState<string[]>(inicial.emails);
  const [borr, setBorr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [noAgregados, setNoAgregados] = useState<Array<{ telefono: string; motivo: string }>>([]);
  const [linkGrupo, setLinkGrupo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const esWa = canal === 'whatsapp';

  // Lo tipeado y NO agregado CUENTA como cambio: sin esto, escribir el número y
  // darle a Guardar —sin tocar «Agregar»— dejaba la lista igual y sin un mensaje.
  const valido = borr ? (esWa ? telefonoValido(borr) : emailValido(borr)) : true;
  const suma = Boolean(borr) && valido;
  const telFinal = esWa && suma ? [...tel, borr] : tel;
  const mailFinal = !esWa && suma ? [...mail, borr] : mail;
  const dirty = JSON.stringify([telFinal, mailFinal]) !== JSON.stringify([inicial.telefonos, inicial.emails]);
  const saca = esWa ? tel.length < inicial.telefonos.length : false;

  async function guardar() {
    // Hay algo a medio escribir: se dice. Mandarlo igual lo hace desaparecer en el
    // saneo del server con un «Guardado ✓» encima, que es afirmar lo que no pasó.
    if (!valido) {
      setError(esWa
        ? 'Ese número está incompleto. Complétalo y toca «Agregar», o bórralo.'
        : 'Eso no parece un email. Complétalo y toca «Agregar», o bórralo.');
      return;
    }
    if (!dirty) { setError('No cambiaste nada todavía.'); return; }
    setBusy(true); setError(null); setFlash(null); setNoAgregados([]); setLinkGrupo(null); setCopiado(false);
    try {
      const j = await (await fetch('/api/perfil/destinatarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefonos: telFinal, emails: mailFinal }),
      })).json();
      if (!j.ok) { setError(j.error || 'No se pudo guardar'); return; }
      const d = j.destinatarios as Destinatarios;
      setTel(d.telefonos); setMail(d.emails); setBorr('');
      onGuardado(d);
      // ⚠️ Guardar la lista y sumar al grupo son DOS cosas, y la segunda falla
      // sola. Si falló se dice, y con el link: decir «listo» sobre algo que no
      // pasó es el bug original.
      const fallidos = (j.noAgregados ?? []) as Array<{ telefono: string; motivo: string }>;
      if (fallidos.length) {
        setNoAgregados(fallidos);
        setLinkGrupo((j.linkGrupo as string | null) ?? null);
        return;
      }
      setFlash('Guardado ✓');
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  }

  return (
    // Sin caja: esto vive ADENTRO del tile de su canal. Una caja dentro de otra es
    // doble marco y doble padding, y encima lee como una sección nueva justo cuando
    // el pedido era que dejara de serlo.
    <div style={{ marginTop: 10 }}>
      {/* `portalTo` va en null a propósito: acá no hay modal encima, así que el
          menú de ladas se abre en su lugar. Portalearlo pediría medir un nodo, que
          es justo donde vive esa familia de bugs. */}
      {esWa ? (
        <Lista
          icono="whatsapp" tipo="tel"
          items={tel} onChange={setTel} placeholder="223 355 0684"
          onBorrador={setBorr} portalTo={null}
        />
      ) : (
        <Lista
          icono="email" tipo="email"
          items={mail} onChange={setMail} placeholder="nombre@empresa.com"
          onBorrador={setBorr} portalTo={null}
        />
      )}

      {noAgregados.length > 0 && (
        <div style={{ marginTop: 16, borderRadius: 10, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--bad)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            {noAgregados.length === 1 ? 'Quedó guardado, pero no entró al grupo' : 'Quedaron guardados, pero no entraron al grupo'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: '6px 0 8px' }}>
            Reciben los reportes igual. Lo que falló es sumarlos al grupo.
          </div>
          {noAgregados.map((n) => (
            <div key={n.telefono} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, marginTop: 4 }}>
              <b>{paraLeer('tel', n.telefono)}</b> — <span style={{ color: 'var(--dim)' }}>{n.motivo}</span>
            </div>
          ))}

          {/* La salida que faltaba. WhatsApp puede negarse a que agreguemos a
              alguien (es SU configuración de privacidad, no un error nuestro) y el
              link del grupo siempre funciona: con esto se resuelve desde acá en vez
              de quedar trabado. Se COPIA, no se abre: el link es para pasárselo a
              esa persona, no para entrar uno. */}
          {linkGrupo && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 6 }}>
                Pásale este link y entra solo:
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{
                  flex: 1, minWidth: 0, fontSize: 12, fontFamily: MONO, color: 'var(--ink)',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '7px 9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{linkGrupo}</code>
                <button
                  type="button" style={btnGhost}
                  onClick={() => { void navigator.clipboard.writeText(linkGrupo).then(() => setCopiado(true)); }}
                >
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sacar a alguien de la lista no lo echa del grupo, y es a propósito:
          echarlo lo ven todos los demás y no es algo que se haga de rebote. */}
      {saca && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
          Deja de recibir los reportes, pero sigue en el grupo. Si hace falta, sácalo desde WhatsApp.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {/* ⚠️ Solo se deshabilita mientras GUARDA. Antes también se apagaba con
            `!dirty`, y ese era el camino mudo que reportó el cliente: cuando de
            verdad no hay nada que guardar, el botón lo DICE. */}
        <button
          type="button" onClick={guardar} disabled={busy}
          style={{
            padding: '7px 15px', borderRadius: 9, border: 'none', background: '#171511', color: '#F3F0E7',
            fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        {flash && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>}
        {error && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>{error}</span>}
      </div>
    </div>
  );
}
