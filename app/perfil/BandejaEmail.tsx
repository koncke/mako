'use client';

// =============================================================================
// BandejaEmail — los mensajes que salen por EMAIL, como se ven en el correo
// =============================================================================
// El gemelo de la pantalla de WhatsApp, del otro lado: allá una burbuja de chat,
// acá una bandeja. Un email no se lee como un chat —tiene remitente, asunto y un
// cuerpo largo—, y juzgar «¿esto se entiende cuando llega?» pide verlo con la
// forma en la que llega. Pedido del dueño: «en lugar de la UI de WhatsApp, que
// aparezca una UI de Gmail».
//
// QUÉ SALE POR EMAIL, hoy: los REPORTES, y nada más. `lib/notify.ts` arma el mail
// con `subject: rep.titulo` y el cuerpo del reporte pasado a HTML
// (`renderEmailHtml`), y es el único `sendEmail` de los avisos. Los demás no
// tienen camino de email, así que listarlos acá sería ofrecer editar un correo
// que no existe.
//
// El ASUNTO no se edita aparte y no es un olvido: es el TÍTULO del reporte, el
// mismo que se ve en la bandeja (`subject: rep.titulo`, medido). Dos campos para
// el mismo dato terminan diciendo cosas distintas.
//
// ⚠️ EL REMITENTE NO SE ESCRIBE ACÁ: se pregunta. Sale del `resend_from` de CADA
// workspace («el De: es el negocio del cliente, no la agencia»), así que dibujar
// «MaKo <equipo@hola-mako.com>» sería una pantalla afirmando algo que no midió —
// y para un cliente con su dominio conectado, además, falso. Si no se pudo leer,
// la línea del remitente no se dibuja: un dato inventado en una previsualización
// es peor que un dato que falta.
//
// El detalle es el MISMO que el de WhatsApp (`TemplateDetalleModal`), no una
// copia: lo que cambia entre los dos canales es cómo se PREVISUALIZA el mensaje,
// no qué se puede editar de él.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { TemplateDetalleModal, type PlantillaVista } from '../agencia/TemplateDetalleModal';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const caja: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };

/** Los que de verdad viajan por email (ver la cabecera). */
const POR_EMAIL = ['reporte-diario', 'reporte-horario', 'reporte-semanal'];

/** `Nombre <mail@dom>` → sus dos mitades. Sin nombre, el mail hace de nombre. */
function partirRemitente(s: string): { nombre: string; mail: string } {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(s);
  if (m) return { nombre: m[1] || m[2], mail: m[2] };
  return { nombre: s.trim(), mail: s.trim() };
}

/** El avatar redondo de Gmail: la inicial del remitente. */
function Avatar({ letra, tam = 36 }: { letra: string; tam?: number }) {
  return (
    <div style={{
      width: tam, height: tam, borderRadius: '50%', flex: 'none',
      background: 'var(--primary)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(tam * 0.42), fontWeight: 600, fontFamily: SANS,
    }}>{letra}</div>
  );
}

export function BandejaEmail({ emails, endpoint }: { emails: string[]; endpoint: string }) {
  const [items, setItems] = useState<PlantillaVista[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [editando, setEditando] = useState<PlantillaVista | null>(null);
  const [remitente, setRemitente] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const j = await (await fetch(endpoint)).json();
      if (!j.ok) { setItems([]); return; }
      // La lista del cliente ya viene filtrada por la lista blanca; acá se recorta
      // a los que tienen camino de email. Si mañana un aviso gana ese camino, entra
      // sumándolo a POR_EMAIL y no tocando esta pantalla.
      const soloMail = (j.plantillas as PlantillaVista[]).filter((p) => POR_EMAIL.includes(p.id));
      setItems(soloMail);
      setSel((s) => (s && soloMail.some((p) => p.id === s) ? s : soloMail[0]?.id ?? ''));
    } catch { setItems([]); }
  }, [endpoint]);

  useEffect(() => { void recargar(); }, [recargar]);

  // El remitente real del workspace. Que falle no puede impedir ver los mensajes:
  // se queda en null y la línea del «De:» no se dibuja.
  useEffect(() => {
    let vivo = true;
    fetch('/api/email/dominio')
      .then((r) => r.json())
      .then((j) => { if (vivo && j?.ok && typeof j.remitente === 'string' && j.remitente.trim()) setRemitente(j.remitente.trim()); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (items === null) {
    return <div style={{ ...caja, padding: 20, fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>Cargando…</div>;
  }

  if (editando) {
    return (
      <TemplateDetalleModal
        plantilla={editando} endpoint={endpoint}
        onClose={() => setEditando(null)}
        onCambio={() => void recargar()}
      />
    );
  }

  if (!items.length) {
    return (
      <div style={{ ...caja, padding: '22px 20px', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
        Por email sólo salen los reportes, y este negocio no tiene ninguno disponible.
      </div>
    );
  }

  const abierto = items.find((p) => p.id === sel) ?? items[0];
  const para = emails[0] ?? 'tu correo';
  const de = remitente ? partirRemitente(remitente) : null;
  const inicial = (de?.nombre ?? 'M').charAt(0).toUpperCase();

  const fila = (activo: boolean, apagado: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
    padding: '11px 13px', border: 'none', borderBottom: '1px solid var(--border)',
    // Gmail marca el no leído con negrita y el leído apagado. Acá «no leído» es el
    // que está PRENDIDO: el que de verdad va a llegar.
    background: activo ? 'var(--surface-2)' : 'var(--surface)',
    borderLeft: `3px solid ${activo ? 'var(--primary)' : 'transparent'}`,
    cursor: 'pointer', fontFamily: SANS, opacity: apagado ? 0.55 : 1,
  });

  return (
    <div style={{ ...caja, display: 'grid', gridTemplateColumns: 'minmax(210px, 290px) 1fr', overflow: 'hidden' }}>
      {/* LA BANDEJA */}
      <div style={{ borderRight: '1px solid var(--border)', maxHeight: 560, overflowY: 'auto' }}>
        <div style={{ padding: '12px 13px', borderBottom: '1px solid var(--border)', fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>
          Recibidos · {items.length}
        </div>
        {items.map((p) => (
          <button key={p.id} type="button" onClick={() => setSel(p.id)} style={fila(p.id === abierto.id, !p.enabled)}>
            <Avatar letra={inicial} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: p.enabled ? 700 : 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {/* Sin remitente leído va «—», la convención de la casa: no se inventa. */}
                  {de?.nombre ?? '—'}
                </span>
                {!p.enabled && <span style={{ fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>apagado</span>}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: p.enabled ? 600 : 400, color: 'var(--ink)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.titulo}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.ejemplo.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').slice(0, 70)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* EL CORREO ABIERTO */}
      <div style={{ padding: '18px 22px', maxHeight: 560, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{abierto.titulo}</h3>
          <button
            type="button" onClick={() => setEditando(abierto)}
            style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flex: 'none' }}
          >
            Editar
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '14px 0 16px' }}>
          <Avatar letra={inicial} tam={40} />
          <div style={{ minWidth: 0 }}>
            {de && (
              <div style={{ fontSize: 13.5, color: 'var(--ink)', wordBreak: 'break-word' }}>
                <strong style={{ fontWeight: 600 }}>{de.nombre}</strong>
                {de.mail !== de.nombre && <span style={{ color: 'var(--faint)' }}> &lt;{de.mail}&gt;</span>}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 1, wordBreak: 'break-word' }}>para {para}</div>
          </div>
        </div>

        {/* El cuerpo, tal cual sale y con sus saltos de línea: es lo que permite
            juzgar si se entiende al abrirlo en el correo. */}
        <div style={{
          fontSize: 14, lineHeight: 1.65, color: 'var(--ink)', whiteSpace: 'pre-wrap',
          paddingTop: 16, borderTop: '1px solid var(--border)',
        }}>
          {abierto.ejemplo}
        </div>

        {!abierto.enabled && (
          <div style={{ marginTop: 18, padding: '10px 13px', borderRadius: 10, background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', fontSize: 12.5, color: 'var(--dim)' }}>
            Apagado: hoy no se manda. Se prende desde «Editar».
          </div>
        )}
      </div>
    </div>
  );
}
