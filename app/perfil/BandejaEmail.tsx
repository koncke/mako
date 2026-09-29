'use client';

// =============================================================================
// BandejaEmail — los mensajes de MaKo, como se ven en el correo
// =============================================================================
// El gemelo de la pantalla de WhatsApp, del otro lado: allá una burbuja de chat,
// acá una bandeja. Un email no se lee como un chat —tiene remitente, asunto y un
// cuerpo maquetado— y juzgar «¿esto se entiende cuando llega?» pide verlo con la
// forma en la que llega. Pedido del dueño: «en lugar de la UI de WhatsApp, que
// aparezca una UI de Gmail».
//
// ── Lo que se ve es el HTML DE VERDAD ────────────────────────────────────────
// El cuerpo se pinta con `renderEmailHtml`, el MISMO que arma el correo que sale,
// adentro de un iframe. Antes se dibujaba el texto plano en un `<div>` y el lector
// veía los `*asteriscos*` de WhatsApp que el mail real no tiene: una previsualización
// que no muestra lo que llega no sirve para lo único que hace. El render se pudo
// traer al navegador porque se mudó a `lib/email-html.ts` — en `lib/resend.ts` vive
// la API key y por eso lleva `server-only`.
//
// ── Por qué están TODOS los mensajes y no sólo los que salen por mail ────────
// Cada aviso elige por dónde llega (`canales` de su plantilla; los tres reportes,
// su `CanalPrefs`). La bandeja los lista a todos y marca los que hoy NO llegan por
// correo: si listara sólo los prendidos, un cliente con el email apagado abriría una
// bandeja vacía y no tendría dónde prenderlo. El interruptor está adentro del
// detalle, en «Por dónde llega».
//
// ⚠️ EL REMITENTE ES MAKO, y no es un detalle de copy: `lib/notify.ts` y el choke
// point de los avisos mandan con `REMITENTE_MAKO` explícito. Sin eso resolvían el
// `resend_from` del workspace, y un cliente sin dominio conectado —casi todos— cae
// en el remitente sandbox de Resend, que entrega sólo al dueño de la cuenta.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TemplateDetalleModal, type PlantillaVista } from '../agencia/TemplateDetalleModal';
import { renderEmailHtml } from '@/lib/email-html';
import { canalesDeMensaje } from '@/lib/mensaje-canales';
import { REMITENTE_MAKO } from '@/lib/app-url';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const ALTO = 560;
const caja: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };

/** Forma mínima de lo que la bandeja necesita de las preferencias del negocio. */
type PrefsCanal = { horario?: { wa: boolean; email: boolean }; diario?: { wa: boolean; email: boolean }; semanal?: { wa: boolean; email: boolean } };

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
  const [prefs, setPrefs] = useState<PrefsCanal | null>(null);
  const [sel, setSel] = useState<string>('');
  const [editando, setEditando] = useState<PlantillaVista | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [jt, jp] = await Promise.all([
        fetch(endpoint).then((r) => r.json()).catch(() => null),
        fetch('/api/perfil').then((r) => r.json()).catch(() => null),
      ]);
      if (jp?.ok) setPrefs(jp.prefs as PrefsCanal);
      setItems(jt?.ok ? (jt.plantillas as PlantillaVista[]) : []);
      setSel((s) => (s && (jt?.plantillas ?? []).some((p: PlantillaVista) => p.id === s) ? s : (jt?.plantillas?.[0]?.id ?? '')));
    } catch { setItems([]); }
  }, [endpoint]);

  useEffect(() => { void recargar(); }, [recargar]);

  const de = useMemo(() => partirRemitente(REMITENTE_MAKO), []);
  const abierto = items?.find((p) => p.id === sel) ?? items?.[0] ?? null;

  // El HTML del correo abierto: el mismo que sale. Se recalcula sólo cuando cambia
  // el mensaje — armar un documento entero en cada render del padre es gratis en
  // tiempo y caro en parpadeo: el iframe se vuelve a cargar con cada `srcDoc` nuevo.
  const html = useMemo(
    () => (abierto ? renderEmailHtml({
      subject: abierto.titulo, titulo: abierto.titulo, bodyText: abierto.ejemplo, marca: 'mako',
    }) : ''),
    [abierto],
  );

  if (items === null) {
    return <div style={{ ...caja, padding: 20, fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>Cargando…</div>;
  }

  if (!items.length || !abierto) {
    return (
      <div style={{ ...caja, padding: '22px 20px', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
        Todavía no hay mensajes configurados para este negocio.
      </div>
    );
  }

  const para = emails[0] ?? 'tu correo';
  const llegaPorMail = (p: PlantillaVista) => p.enabled && canalesDeMensaje(p.id, p, prefs).email;

  const fila = (activo: boolean, apagado: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
    padding: '11px 13px', border: 'none', borderBottom: '1px solid var(--border)',
    // Gmail marca el no leído con negrita y el leído apagado. Acá «no leído» es el
    // que de verdad va a llegar por correo.
    background: activo ? 'var(--surface-2)' : 'var(--surface)',
    borderLeft: `3px solid ${activo ? 'var(--primary)' : 'transparent'}`,
    cursor: 'pointer', fontFamily: SANS, opacity: apagado ? 0.55 : 1,
  });

  return (
    // ⚠️ EL ALTO SE DECLARA EN LA FILA, no en el detalle. Las celdas tenían `maxHeight`
    // y el grid ningún alto, así que al abrir el editor la fila saltaba de ~300px a 620 y
    // la lista quedaba con medio metro de vacío al lado. Con el grid en alto fijo y las
    // celdas al 100%, abrir y cerrar no mueve nada. Es el mismo molde de PlantillasView.
    <div style={{ ...caja, display: 'grid', gridTemplateColumns: 'minmax(210px, 290px) 1fr', height: ALTO, overflow: 'hidden' }}>
      {/* LA BANDEJA — no se va cuando se edita: el editor ocupa sólo la celda derecha. */}
      <div style={{ borderRight: '1px solid var(--border)', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '12px 13px', borderBottom: '1px solid var(--border)', fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>
          Recibidos · {items.filter(llegaPorMail).length} de {items.length}
        </div>
        {items.map((p) => {
          const llega = llegaPorMail(p);
          return (
            <button key={p.id} type="button" onClick={() => { setSel(p.id); setEditando(null); }} style={fila(p.id === abierto.id, !llega)}>
              <Avatar letra={de.nombre.charAt(0).toUpperCase()} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: llega ? 700 : 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {de.nombre}
                  </span>
                  {!llega && <span style={{ fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>no llega</span>}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: llega ? 600 : 400, color: 'var(--ink)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.titulo}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.ejemplo.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').slice(0, 70)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* LA CELDA DERECHA: el correo, o su editor. */}
      {editando ? (
        // `key` para que cambiar de correo remonte el editor: su estado se siembra de
        // props con useState y sin esto el cuerpo del anterior se guardaría sobre el
        // siguiente. Sin marco: el borde y el radio ya los pone la caja de afuera.
        <TemplateDetalleModal
          key={editando.id} plantilla={editando} endpoint={endpoint} alto="100%" marco={false}
          onClose={() => setEditando(null)}
          onCambio={() => void recargar()}
        />
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 'none', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{abierto.titulo}</h3>
              <button
                type="button" onClick={() => setEditando(abierto)}
                style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flex: 'none' }}
              >
                Editar
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <Avatar letra={de.nombre.charAt(0).toUpperCase()} tam={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>
                  <strong style={{ fontWeight: 600 }}>{de.nombre}</strong>
                  <span style={{ color: 'var(--faint)' }}> &lt;{de.mail}&gt;</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 1, wordBreak: 'break-word' }}>para {para}</div>
              </div>
            </div>
            {!llegaPorMail(abierto) && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--dim)' }}>
                Hoy no llega por email. Se prende en «Editar» → Por dónde llega.
              </div>
            )}
          </div>

          {/* EL CORREO, renderizado de verdad. En un iframe y no con
              dangerouslySetInnerHTML por dos razones: el CSS del mail no se mezcla con
              el de la app (y al revés), y el ancho de 600px se lee como se lee en una
              bandeja. Sin `allow-scripts` ni `allow-same-origin`: no hace falta medirlo
              —la celda ya tiene alto y el correo scrollea adentro— y el documento queda
              aislado. `allow-popups` es para que un link abra en una pestaña. */}
          <iframe
            key={abierto.id}
            title={`Vista previa del correo: ${abierto.titulo}`}
            srcDoc={html}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{ flex: 1, minHeight: 0, width: '100%', border: 'none', background: 'var(--surface-2)' }}
          />
        </div>
      )}
    </div>
  );
}
