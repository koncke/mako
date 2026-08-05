'use client';

// =============================================================================
// AdsWriterApp — la fábrica de guiones de anuncios
// =============================================================================
// Ads Writer ERA un generador suelto de copy: pedías un anuncio en lenguaje
// natural y devolvía 3-5 variantes que no se guardaban en ningún lado. Ahora es
// la tab donde se CREAN los guiones, con las dos vistas del mismo material:
//
//   · Matriz  — avatar × motivación de compra. Cada celda es un anuncio; se abre
//               y MaKo escribe el guion (elige ángulo y estructura solo, o los
//               propone con opciones cerradas). Es el mismo componente que vive
//               en el hub de onboarding: una sola implementación, dos entradas.
//   · Guiones — todos los guiones ya escritos, con filtros por fecha, estado,
//               ángulo y avatar, y el pipeline borrador → publicado.
//
// Las DOS vistas quedan MONTADAS (se ocultan con display, no se desmontan): un
// "Nuevo guion" a medias en la matriz sobrevive a ir a mirar la lista y volver.
// Cada vez que se entra a Guiones se refresca desde la API, porque la matriz
// pudo haber escrito uno nuevo mientras tanto.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MatrizView } from '../onboarding/MatrizView';
import { GuionesGlobal } from './GuionesGlobal';
import { MakoStar } from '../_components/MakoBrand';
import type { EstadoGuion, GuionItem } from '../onboarding/guion-ui';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Vista = 'matriz' | 'guiones';
type Avatar = { id: string; nombre: string; segmento: string };
type Celda = { id: string; avatarId: string; nombre: string; guiones: GuionItem[] };

const VISTAS: Array<{ k: Vista; label: string; sub: string }> = [
  { k: 'matriz', label: 'Matriz', sub: 'Un anuncio por avatar y motivación' },
  { k: 'guiones', label: 'Guiones', sub: 'Todo lo escrito, con su estado' },
];

const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

export function AdsWriterApp() {
  const [vista, setVista] = useState<Vista>('matriz');
  const [celdas, setCeldas] = useState<Celda[]>([]);
  const [avatares, setAvatares] = useState<Avatar[]>([]);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saltarA, setSaltarA] = useState<string | null>(null);
  // Sube cuando la lista global cambia algo, para que la matriz recargue y no
  // muestre un estado viejo del guion que se acaba de mover.
  const [tokenMatriz, setTokenMatriz] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones')).json();
      if (j.ok) { setCeldas(j.razones as Celda[]); setAvatares(j.avatares as Avatar[]); }
      else setErr(j.error || 'No se pudieron cargar los guiones.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);

  // Al entrar a Guiones, siempre datos frescos: la matriz pudo escribir uno nuevo.
  useEffect(() => { if (vista === 'guiones') cargar(); }, [vista, cargar]);

  const post = async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo guardar el cambio.'); return; }
      setCeldas(j.razones as Celda[]);
      setAvatares(j.avatares as Avatar[]);
      setTokenMatriz((t) => t + 1);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const cambiarEstado = (celdaId: string, guionId: string, estado: EstadoGuion) => {
    // Optimista: el chip responde en el acto y el POST confirma. Si falla, la
    // recarga del próximo ingreso a la vista lo devuelve a la verdad.
    setCeldas((cs) => cs.map((c) => (c.id === celdaId ? { ...c, guiones: c.guiones.map((g) => (g.id === guionId ? { ...g, estado } : g)) } : c)));
    post({ action: 'guion-estado', id: celdaId, guionId, estado });
  };

  const borrarGuion = (celdaId: string, guionId: string) => {
    const razones = celdas.map((c) => (c.id === celdaId ? { ...c, guiones: c.guiones.filter((g) => g.id !== guionId) } : c));
    setCeldas(razones);
    post({ action: 'guardar', razones });
  };

  const irAMatriz = (celdaId: string) => { setSaltarA(celdaId); setVista('matriz'); };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 22px 56px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={eyebrow}>Ads Writer</div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '4px 0 0', lineHeight: 1.15 }}>
          <MakoStar size={20} /> Tus guiones de anuncios
        </h1>
      </div>

      {/* Las dos vistas del mismo material */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        {VISTAS.map((v) => {
          const on = vista === v.k;
          return (
            <button key={v.k} type="button" onClick={() => setVista(v.k)} title={v.sub}
              style={{ border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, background: 'none', color: on ? 'var(--ink)' : 'var(--dim)', fontFamily: SANS, fontWeight: on ? 600 : 500, fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
              {v.label}
            </button>
          );
        })}
      </div>

      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>{err}</div>}

      {/* Montadas las dos: cambiar de vista no puede tirar un guion a medias. */}
      <div style={{ display: vista === 'matriz' ? 'block' : 'none' }}>
        <MatrizView abrirCeldaId={saltarA} onAbrioCelda={() => setSaltarA(null)} recargarToken={tokenMatriz} />
      </div>
      <div style={{ display: vista === 'guiones' ? 'block' : 'none' }}>
        {cargando && !celdas.length
          ? <div style={{ ...eyebrow, padding: '28px 0', textAlign: 'center' }}>Cargando tus guiones…</div>
          : <GuionesGlobal celdas={celdas} avatares={avatares} onEstado={cambiarEstado} onBorrar={borrarGuion} onIrAMatriz={irAMatriz} />}
      </div>
    </div>
  );
}
