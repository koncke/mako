'use client';

// =============================================================================
// ProbarTracking — el "Test Events" de MaKo para la landing
// =============================================================================
// El equivalente al Pixel Helper de Meta. El botón "Verificar" de antes solo
// decía si ALGUNA VEZ llegó un evento — y estuvo en verde tres semanas mientras
// el VSL no medía nada, porque llegaban los plays pero ningún avance.
//
// Esto abre una sesión de prueba: mientras está prendida consulta cada 3s y
// muestra los eventos ENTRANDO, más los chequeos que dicen qué anda y qué no
// (incluido si la landing tiene el código VIEJO, que es el error más común: se
// pega una vez y queda congelado ahí para siempre).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Evento = { ts: string; tipo: string; porcentaje: number | null; segundos: number | null; detalle: string | null };
type Chequeo = { id: string; label: string; estado: 'ok' | 'falta' | 'viejo'; detalle: string };
type Diag = { eventos: Evento[]; chequeos: Chequeo[]; veredicto: string; urls: string[]; codigoViejo: boolean; ultima: string | null };

const hora = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('es-MX', { hour12: false }); };

/** Cómo se lee cada evento crudo. Los tipos técnicos no se muestran pelados. */
function legible(e: Evento): { texto: string; color: string } {
  if (e.tipo === 'pageview') return { texto: 'Visitó la landing', color: 'var(--dim)' };
  if (e.tipo === 'play') return { texto: 'Arrancó el VSL', color: 'var(--primary)' };
  if (e.tipo === 'exit') return { texto: e.porcentaje != null ? `Salió en el ${e.porcentaje}%` : 'Salió del VSL', color: 'var(--bad)' };
  const m = /^p(\d+)$/.exec(e.tipo);
  if (m) return { texto: `Llegó al ${m[1]}% del VSL`, color: 'var(--good)' };
  const s = /^s(\d+)$/.exec(e.tipo);
  if (s) return { texto: `Vio ${s[1]} segundos`, color: 'var(--good)' };
  return { texto: e.tipo, color: 'var(--dim)' };
}

const ICONO: Record<string, string> = { ok: '✓', falta: '○', viejo: '!' };
const COLOR: Record<string, string> = { ok: 'var(--good)', falta: 'var(--faint)', viejo: 'var(--warn)' };

/** La landing elegida para probar. Se recuerda para no volver a tipearla. */
const URL_KEY = 'mako.landing.url_prueba';

export function ProbarTracking() {
  const [activo, setActivo] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [previo, setPrevio] = useState<Diag | null>(null); // estado ANTES de arrancar
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const traer = useCallback(async (guardarEn?: (d: Diag) => void) => {
    try {
      const r = await fetch('/api/integraciones/landing/estado?diag=1', { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok) {
        const d: Diag = { eventos: r.eventos ?? [], chequeos: r.chequeos ?? [], veredicto: r.veredicto ?? '', urls: r.urls ?? [], codigoViejo: !!r.codigoViejo, ultima: r.ultima ?? null };
        (guardarEn ?? setDiag)(d);
        setErr(null);
      } else setErr(r?.error ?? 'No se pudo consultar');
    } catch { setErr('No se pudo consultar'); }
    finally { setCargando(false); }
  }, []);

  // Antes de arrancar se consulta UNA vez: hace falta saber si el código está
  // viejo (para no dejar probar) y qué landings ya mandaron eventos (para poder
  // ofrecerlas en vez de pedir que las tipee).
  useEffect(() => {
    if (activo) return;
    traer(setPrevio);
    try { setUrl(localStorage.getItem(URL_KEY) ?? ''); } catch { /* sin storage */ }
  }, [activo, traer]);

  // Mientras la prueba está prendida, consulta cada 3s. Se apaga sola al cerrar
  // el modal (cleanup) para no dejar un poll corriendo de fondo.
  useEffect(() => {
    if (!activo) { if (timer.current) { clearInterval(timer.current); timer.current = null; } return; }
    setCargando(true);
    traer();
    timer.current = setInterval(traer, 3000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [activo, traer]);

  const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface-2)', padding: 16, fontFamily: SANS };

  if (!activo) {
    // ⚠️ CON EL CÓDIGO VIEJO NO SE PRUEBA. Probar sobre un snippet desactualizado
    // da un resultado que no significa nada: los chequeos nuevos van a fallar
    // SIEMPRE —el código que está pegado no manda esos eventos— y la persona
    // sale creyendo que su landing está rota cuando lo único que pasa es que hay
    // que volver a pegar el código. Primero se actualiza; después se prueba.
    if (previo?.codigoViejo) {
      return (
        <div style={{ ...box, borderColor: 'var(--warn)' }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Primero actualizá el código</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.55 }}>
            El que tenés pegado es de una versión anterior, así que probarlo no te va a decir nada útil:
            los chequeos nuevos van a fallar porque ese código todavía no los manda.
            <b> Copiá el código de arriba, reemplazalo en tu página y volvé acá.</b>
          </div>
        </div>
      );
    }
    return (
      <div style={box}>
        <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Probar que el código funciona</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
          Elegí cuál de tus páginas querés probar. La abrimos en otra pestaña y acá ves llegar los eventos en vivo.
        </div>

        {/* Elegir en vez de tipear: las landings que YA mandaron eventos las
            conoce el sistema, y pedirle a alguien que copie una URL que ya
            tenemos es trabajo inventado. El campo libre queda para la primera
            vez, cuando todavía no llegó nada de ninguna. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {(previo?.urls ?? []).length > 0 && (
            <select value={(previo?.urls ?? []).includes(url) ? url : ''} onChange={(e) => setUrl(e.target.value)}
              style={{ flex: '1 1 240px', minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS }}>
              <option value="">Elegí una de tus páginas…</option>
              {(previo?.urls ?? []).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-pagina.com" inputMode="url"
            style={{ flex: '1 1 240px', minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS }} />
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button"
            disabled={!/^https?:\/\/.+/i.test(url.trim())}
            onClick={() => {
              const u = url.trim();
              try { localStorage.setItem(URL_KEY, u); } catch { /* sin storage */ }
              window.open(u, '_blank', 'noopener');
              setActivo(true);
            }}
            style={{ flex: 'none', padding: '11px 20px', borderRadius: 11, border: 'none', background: /^https?:\/\/.+/i.test(url.trim()) ? 'var(--primary)' : 'var(--border)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: /^https?:\/\/.+/i.test(url.trim()) ? 'pointer' : 'not-allowed', fontFamily: SANS }}>
            Abrir mi página y empezar
          </button>
          <button type="button" onClick={() => setActivo(true)}
            style={{ flex: 'none', padding: '11px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Ya la tengo abierta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--good)', animation: 'pt-latido 1.4s infinite', flex: 'none' }} />
          <span style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Escuchando… {diag ? `· ${diag.veredicto}` : ''}</span>
        </div>
        <button type="button" onClick={() => setActivo(false)}
          style={{ flex: 'none', padding: '8px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
          Terminar
        </button>
      </div>
      <style>{'@keyframes pt-latido{0%,100%{opacity:1}50%{opacity:.25}}'}</style>

      {/* La instrucción cubre las DOS cosas que el código hace. Hasta el 14/08 solo
          hablaba del video, y para un negocio cuya landing es un formulario —el
          caso que destapó esto— la prueba entera parecía no ser para él. */}
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 12 }}>
        Abrí tu landing en otra pestaña y probá lo que uses: <b>reproducí el video</b> más de 15 segundos,
        y <b>completá tu propio formulario</b> con tu email. Los eventos aparecen acá en unos segundos.
      </div>

      {/* Los chequeos: qué anda y qué no, en criollo. El total lo dice el server
          (), no un número escrito acá: estuvo diciendo «de 4» cuando ya
          eran cinco. */}
      {diag && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {diag.chequeos.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: COLOR[c.estado] }}>{ICONO[c.estado]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: c.estado === 'ok' ? 'var(--ink)' : 'var(--dim)' }}>{c.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1, lineHeight: 1.45 }}>{c.detalle}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Los eventos crudos, como el Test Events de Meta. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', maxHeight: 260, overflowY: 'auto' }}>
        {cargando && !diag && <div style={{ padding: 16, fontSize: 13, color: 'var(--faint)' }}>Conectando…</div>}
        {diag && diag.eventos.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--faint)', lineHeight: 1.55 }}>
            Todavía no llegó nada en las últimas 24 h. Si ya abriste tu landing y no aparece nada, el código no está pegado o no se publicó.
          </div>
        )}
        {diag?.eventos.map((e, i) => {
          const l = legible(e);
          return (
            <div key={`${e.ts}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{hora(e.ts)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: l.color, flex: 1, minWidth: 0 }}>{l.texto}</span>
              {e.segundos != null && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{Math.round(e.segundos)}s</span>}
            </div>
          );
        })}
      </div>

      {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
