'use client';
// =============================================================================
// MetricasAutomatizacion — la pestaña «Métricas» de una automatización: lo que reemplaza al lienzo
// =============================================================================
// Martín, 23/10/2026: «un botón al lado del botón de configuraciones. Cuando se apreta, todo el lienzo se reemplaza por
// el dashboard de esas métricas... Por defecto MaKo lo debe armar solo... se debe poder personalizar al igual que en
// Dashboard y un botón para llevar esas métricas como nueva hoja a la tab de dashboard». Lo de adentro es el EDITOR DEL
// DASHBOARD (`EditorInforme`) con el informe `automatizacion:<id>` (lib/automatizacion-metricas.ts): se edita igual que una
// hoja del Dashboard, y se autoguarda en su propio informe.
//
//   · El editor entra con `next/dynamic` y SIN server: es pesado y se monta recién al tocar «Métricas» (AGENTS.md: lo que
//     se ve al abrir la app no va con `ssr:false`; esto no se ve al abrir).
//   · «Llevar al Dashboard» (POST /api/automations/metricas) crea una hoja NUEVA en el Dashboard de quien mira, filtrada a
//     esta automatización, y deja el link para abrirla. Lleva la primera hoja de las Métricas (la de MaKo, o la que la
//     persona dejó primera). VA EN EL ⋮ desde el 24/10/2026 (Martín: «"Llevar al Dashboard" dentro de los 3 puntitos»).
//   · UNA SOLA BARRA ARRIBA (24/10/2026). La mitad izquierda la pone la automatización (`izquierda`: su título y «Flujo»
//     para volver) y la derecha es la del informe (buscar, filtrar, Editar y el ⋮), donde sobre el lienzo están «Probar» y
//     la tuerca (`cabeceraPropia` de EditorInforme). Martín: «El título no debería duplicarse, debe ser el mismo, y sin
//     desplegable» y «Si estoy viendo las métricas no debería estar más el botón de "Probar" o "Configuraciones"... En su
//     lugar, los botones de la barra de búsqueda, el filtro, los 3 puntitos». Cargando, con un error o sin hoja, la
//     izquierda está igual: «Flujo» existe siempre.
// =============================================================================
import dynamic from 'next/dynamic';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { Tablero } from '@/lib/graficos-catalogo';
import type { DatosGrafico } from '@/lib/graficos-datos';
import { informeDeAutomatizacion } from '@/lib/informe-automatizacion';

const EditorInforme = dynamic(() => import('@/app/dashboard/EditorInforme').then((m) => m.EditorInforme), {
  ssr: false,
  loading: () => <CargandoEditor />,
});

type Lectura = {
  tablero: Tablero; version: string | null; deMaKo: boolean; lecturaFallo: boolean;
  datos: Record<string, DatosGrafico>; hoy: string; automatizacion: { id: number; nombre: string };
};

// EL LOADER DE LA CASA (Rendimiento, 23/10/2026): la criatura, importada DIRECTO de su archivo y nunca del índice
// '@/app/_ui' (tests/cargando-mako.test.ts); `cubre` pide un contenedor con `position: relative`.
function Cargando() {
  return <div style={{ position: 'relative', height: '100%', minHeight: 320 }}><CargandoMako que="las métricas" cubre /></div>;
}

/** La barra sin el editor: el título y «Flujo» arriba, y abajo lo que haya (el loader, un error, el vacío). */
function ConBarra({ izquierda, children }: { izquierda: ReactNode; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg)' }}>
      <div data-no-pan style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: 14 }}>{izquierda}</div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

// Mientras baja el código del editor, su `loading` también lleva la barra: sin esto «Flujo» desaparecía hasta que el editor
// dibujaba la suya. `loading` no recibe props, así que la izquierda le llega por contexto.
const IzquierdaDeCarga = createContext<ReactNode>(null);
function CargandoEditor() {
  return <ConBarra izquierda={useContext(IzquierdaDeCarga)}><Cargando /></ConBarra>;
}

export function MetricasAutomatizacion({ secuenciaId, izquierda, titulo }: {
  secuenciaId: number;
  /** La mitad izquierda de la barra: el título de la automatización y «Flujo». */
  izquierda: ReactNode;
  /** El nombre de la automatización: el título del PDF y del CSV. */
  titulo: string;
}) {
  const [l, setL] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [llevando, setLlevando] = useState(false);
  const [llevada, setLlevada] = useState<{ hojaId: string; nombre: string } | null>(null);
  const [errLlevar, setErrLlevar] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setL(null); setError(null); setLlevada(null); setErrLlevar(null);
    fetch(`/api/automations/metricas?id=${secuenciaId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !j?.ok) { setError(j?.error ?? 'No pude leer las métricas.'); return; }
        setL(j as Lectura);
      })
      .catch(() => { if (vivo) setError('Sin conexión — prueba de nuevo.'); });
    return () => { vivo = false; };
  }, [secuenciaId]);

  const llevar = async () => {
    if (!l || llevando) return;
    setLlevando(true); setErrLlevar(null);
    try {
      const r = await fetch('/api/automations/metricas', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: 'llevar', id: secuenciaId, hojaId: l.tablero.hojas[0]?.id ?? null }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) setErrLlevar(j?.error ?? 'No pude llevarla al Dashboard.');
      else setLlevada({ hojaId: j.hojaId, nombre: j.nombre });
    } catch { setErrLlevar('Sin conexión — prueba de nuevo.'); } finally { setLlevando(false); }
  };

  // Sin el editor (cargando, un error o sin hoja), la barra igual: el título y «Flujo» para volver.
  const sinEditor = (cuerpo: ReactNode) => <ConBarra izquierda={izquierda}>{cuerpo}</ConBarra>;
  if (error) return sinEditor(<div role="alert" style={{ padding: '18px 32px', color: 'var(--bad)', fontSize: 13.5 }}>{error}<ReportarASoporte /></div>);
  if (!l) return sinEditor(<Cargando />);
  const hoja = l.tablero.hojas[0];
  if (!hoja) return sinEditor(<div style={{ padding: '18px 32px', color: 'var(--dim)', fontSize: 13.5 }}>Esta automatización todavía no tiene métricas.</div>);

  // «Llevar al Dashboard», primero en el ⋮ del informe. El menú no se cierra con un clic adentro (`Flotante`): después de
  // llevarla, en el mismo renglón queda el link para abrirla.
  const enMas = (
    <>
      {llevada ? (
        <a href={`/dashboard?hoja=${encodeURIComponent(llevada.hojaId)}`} role="menuitem" className="lk-opcion" data-metricas-llevada>
          <IconoMenu nombre="ver" size={17} /> <span>Abrir «{llevada.nombre}» en el Dashboard</span>
        </a>
      ) : (
        <button type="button" role="menuitem" className="lk-opcion" disabled={llevando} onClick={() => void llevar()} data-metricas-llevar>
          <IconoMenu nombre="grafico" size={17} /> <span>{llevando ? 'Llevando…' : 'Llevar al Dashboard'}</span>
        </button>
      )}
      {errLlevar && <div role="alert" style={{ padding: '4px 16px 8px', fontSize: 12.5, color: 'var(--bad)' }}>{errLlevar}<ReportarASoporte /></div>}
    </>
  );

  return (
    <div data-metricas-automatizacion={secuenciaId} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg)' }}>
      <IzquierdaDeCarga.Provider value={izquierda}>
      <EditorInforme
        key={`automatizacion-${secuenciaId}`}
        inicial={l.tablero}
        datosIniciales={l.datos}
        lecturaFallo={l.lecturaFallo}
        hoy={l.hoy}
        hojaInicial={hoja.id}
        versionInicial={l.version}
        informe={informeDeAutomatizacion(secuenciaId)}
        unido={null}
        cabeceraPropia={{ izquierda, titulo, enMas }}
      />
      </IzquierdaDeCarga.Provider>
    </div>
  );
}
