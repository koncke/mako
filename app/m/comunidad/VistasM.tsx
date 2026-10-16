'use client';

// =============================================================================
// /m/comunidad — las pestañas Miembros y Ranking (en lectura)
// =============================================================================
// Miembros es el directorio de app/_comunidad/Miembros.tsx: el buscador «Buscar miembros», los filtros
// Todos · Equipo · En línea con su número, y cada miembro de la actividad más reciente a la más vieja (lo
// ordena el server), con el punto verde de «en línea» en la cara; tocarlo abre su perfil. «Fuera» (los que el
// equipo sacó) es moderación: en la computadora.
//
// Ranking es el Leaderboards de app/_comunidad/Ranking.tsx: primero los niveles (escritorio los pone arriba,
// al lado de la tarjeta de quien mira; el equipo no tiene tarjeta porque no está en el ranking), en una fila
// que abre su hoja, y después la tabla, con las TRES de escritorio en chips (Últimos 7 días · Últimos 30
// días · Total). Los nombres de los niveles se editan en la computadora.
//
// ⚠️ REFRESCAR TRAE LO NUEVO: `version` sube cuando el server manda otra comunidad (tirar hacia abajo) y las
//    dos se vuelven a pedir. Escritorio las pide al abrir la pestaña; acá también.
// ⚠️ EL BUSCADOR ESPERA A QUE SE DEJE DE TIPEAR (250 ms, como escritorio) y gana el último pedido.

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import type { FiltroMiembros, MiembrosVista, RankingVista } from '@/lib/comunidad-tipos';
import { rotuloNivel } from '@/lib/comunidad-niveles';
import { ErrorM, FilaM, ListaM, SheetM, SkeletonFilas, VacioM } from '@/app/m/_ui';
import {
  FILTROS_MIEMBROS, PERIODOS, R, T, conteoDeFiltro, filasDelPeriodo, rotuloPuntos, segundaDeMiembro, vacioDeMiembros,
  type Periodo,
} from './modelo';
import { AvatarNivelM, useComunidadM } from './piezas';

// ── Miembros ────────────────────────────────────────────────────────────────────

export function MiembrosM({ version }: { version: number }) {
  const { api, ahora, abrirPerfil } = useComunidadM();
  const [filtro, setFiltro] = useState<FiltroMiembros>('todos');
  const [q, setQ] = useState('');
  const [vista, setVista] = useState<MiembrosVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const pedido = useRef(0);

  useEffect(() => {
    const n = ++pedido.current;
    const t = setTimeout(() => {
      void api.miembros({ filtro, q }).then((r) => {
        if (n !== pedido.current) return;
        if (r.ok) { setVista(r.miembros); setError(null); } else setError(r.error);
      });
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [api, filtro, q, version, vuelta]);

  return (
    <div className="m-comunidad-vista">
      <label className="m-comunidad-buscar">
        <span className="m-comunidad-buscar__ico" aria-hidden><Icon name="search" size={18} /></span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={R.buscarMiembros} aria-label={R.buscarMiembros}
          enterKeyHint="search" autoComplete="off" />
        {q && (
          <button type="button" className="m-comunidad-buscar__limpiar" aria-label="Borrar la búsqueda" onClick={() => setQ('')}>
            <Icon name="x" size={16} />
          </button>
        )}
      </label>

      <div className="m-comunidad-chips" role="group" aria-label="Filtro">
        {FILTROS_MIEMBROS.map((f) => {
          const n = conteoDeFiltro(vista?.conteos, f.id);
          return (
            <button key={f.id} type="button" className="m-comunidad-chip" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
              {f.label}{n != null && <span className="m-comunidad-chip__n">{n}</span>}
            </button>
          );
        })}
      </div>

      {error ? (
        <ErrorM frase={error} onReintentar={() => setVuelta((v) => v + 1)} />
      ) : !vista ? (
        <SkeletonFilas filas={5} />
      ) : vista.miembros.length === 0 ? (
        <VacioM frase={vacioDeMiembros(q)} />
      ) : (
        <ListaM etiqueta={R.miembros}>
          {vista.miembros.map((m) => (
            <FilaM key={m.clave} leading={<AvatarNivelM m={m} tam={40} enLinea={m.enLinea} />} titulo={m.nombre}
              segunda={segundaDeMiembro(m, ahora) || undefined} riel={m.equipo ? R.equipo : undefined}
              onClick={() => abrirPerfil(m.clave)} />
          ))}
        </ListaM>
      )}
    </div>
  );
}

// ── Ranking ─────────────────────────────────────────────────────────────────────

export function RankingM({ version }: { version: number }) {
  const { api, comunidad, abrirPerfil } = useComunidadM();
  const [r, setR] = useState<RankingVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [niveles, setNiveles] = useState(false);

  useEffect(() => {
    let vivo = true;
    void api.ranking().then((x) => {
      if (!vivo) return;
      if (x.ok) { setR(x.ranking); setError(null); } else setError(x.error);
    });
    return () => { vivo = false; };
  }, [api, version, vuelta]);

  if (error && !r) return <ErrorM frase={error} onReintentar={() => setVuelta((v) => v + 1)} />;
  if (!r) return <SkeletonFilas filas={6} />;
  const filas = filasDelPeriodo(r, periodo);

  return (
    <div className="m-comunidad-vista">
      <ListaM>
        <FilaM icono="rayo" titulo={T.niveles} segunda={R.unLike} onClick={() => setNiveles(true)} />
      </ListaM>

      <div className="m-comunidad-chips" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" className="m-comunidad-chip" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {filas.length === 0 ? (
        <VacioM frase={R.nadieSumo} />
      ) : (
        <ListaM etiqueta={PERIODOS.find((p) => p.id === periodo)?.label}>
          {filas.map((f) => (
            <FilaM key={f.miembro.clave} titulo={f.miembro.nombre}
              leading={(
                <span className="m-comunidad-puesto">
                  <span className="m-comunidad-puesto__n" data-podio={f.puesto <= 3 || undefined}>{f.puesto}</span>
                  <AvatarNivelM m={f.miembro} tam={36} />
                </span>
              )}
              riel={<span className="m-comunidad-puntos">{rotuloPuntos(f.puntos)}</span>}
              onClick={() => abrirPerfil(f.miembro.clave)} />
          ))}
        </ListaM>
      )}

      <SheetM id="niveles" abierto={niveles} onCerrar={() => setNiveles(false)} titulo={T.niveles} rotuloCerrar="Cerrar los niveles">
        <ListaM etiqueta={T.niveles}>
          {r.niveles.map((n) => (
            <FilaM key={n.nivel} titulo={rotuloNivel(n.nivel, comunidad.nombresNivel)}
              leading={<span className="m-comunidad-nivel">{n.nivel}</span>}
              segunda={[`${n.pct}${R.deLosMiembros}`, n.abre.length ? `Abre: ${n.abre.join(', ')}` : ''].filter(Boolean).join(' · ')} />
          ))}
        </ListaM>
      </SheetM>
    </div>
  );
}
