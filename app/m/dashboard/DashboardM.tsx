'use client';

// =============================================================================
// DashboardM — la pantalla: el segmentado de hojas, el gráfico, los números y «A quién cobrarle»
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, `data-ir="dashboard"`. Los datos llegan
// leídos y formateados por la página (./datos.ts): acá sólo se elige la hoja, el período y la barra.
//
//   · La HOJA es estado de la pantalla (las dos llegan leídas: cambiar no espera a la red). Se
//     anota en la URL con `replaceState` para que recargar o volver deje la misma.
//   · El PERÍODO es de la URL (`?periodo=ult90`) y lo lee el server: lo cambia `router.replace`.
//     ⚠️ El sheet del período pone `?sheet=periodo` con pushState y lo saca al cerrarse. La
//     navegación va en un efecto DESPUÉS de cerrarlo: el efecto de cierre del sheet (hijo) corre
//     antes que el de esta pantalla (padre), así que cuando se navega la URL ya está limpia. Si se
//     navegara en el mismo toque, su `replaceState` podría pisar la URL nueva.
// =============================================================================

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import {
  ErrorM, FilaDatoM, FilaM, ListaM, SeccionM, SegmentadoM, SheetM, VacioM,
} from '@/app/m/_ui';
import { GraficoBarrasM } from './GraficoBarrasM';
import { CobranzaM } from './CobranzaM';
import type { DeltaM, HojaM, NumeroM, PeriodoM } from './modelo';

function Flecha({ dir }: { dir: DeltaM['dir'] }) {
  if (dir === 'igual') {
    return <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden><path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={dir === 'down' ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** El valor con su variación debajo: flecha de color + número en tinta (--dim), nunca texto de color. */
function Valor({ n }: { n: NumeroM }) {
  return (
    <span className="m-dash-v">
      <strong>{n.v}</strong>
      {n.delta && (
        <span className="m-dash-delta" data-tono={n.delta.tono} aria-label={n.delta.etiqueta}>
          <Flecha dir={n.delta.dir} />
          <span aria-hidden>{n.delta.texto}</span>
        </span>
      )}
    </span>
  );
}

export function DashboardM({ hojas, hojaInicial, periodo, periodos, fichaLead }: {
  hojas: HojaM[];
  hojaInicial: string;
  /** El período que leyó el server. null = la hoja no tiene control de período (no se ofrece cambiarlo). */
  periodo: PeriodoM | null;
  periodos: PeriodoM[];
  fichaLead: boolean;
}) {
  const router = useRouter();
  const [hojaId, setHojaId] = useState(hojaInicial);
  const [abierto, setAbierto] = useState(false);
  const [pedido, setPedido] = useState<PeriodoM | null>(null);
  const [cargando, empezar] = useTransition();
  const hoja = hojas.find((h) => h.id === hojaId) ?? hojas[0];

  // Navegar recién cuando el sheet ya se cerró (ver la cabecera del archivo).
  useEffect(() => {
    if (!pedido || abierto) return;
    const u = new URL(window.location.href);
    u.searchParams.set('periodo', pedido.id);
    u.searchParams.set('hoja', hoja.id);
    u.searchParams.delete('sheet');
    empezar(() => router.replace(`${u.pathname}?${u.searchParams.toString()}`, { scroll: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, abierto]);

  // Lo que se ve: el pedido mientras el server contesta, después el que leyó.
  const visto = cargando && pedido ? pedido : periodo;
  useEffect(() => { if (!cargando) setPedido(null); }, [cargando]);

  const cambiarHoja = (id: string) => {
    setHojaId(id);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('hoja', id);
      window.history.replaceState(window.history.state, '', `${u.pathname}?${u.searchParams.toString()}`);
    } catch { /* sin URL que anotar: la hoja igual cambió */ }
  };

  const elegir = (p: PeriodoM) => {
    setAbierto(false);
    if (p.id !== periodo?.id) setPedido(p);
  };

  if (!hoja) return <VacioM frase="Todavía no hay hojas en tu Dashboard." />;

  const botonPeriodo = visto ? (
    <button type="button" className="m-lnk" onClick={() => setAbierto(true)} aria-haspopup="dialog" aria-label={`Período: ${visto.nombre}`}>
      {visto.corto}
    </button>
  ) : undefined;

  return (
    <div className={cargando ? 'm-dash m-dash--cargando' : 'm-dash'} aria-busy={cargando || undefined}>
      {hojas.length > 1 && (
        <div className="m-dash-seg">
          <SegmentadoM etiqueta="Hoja" valor={hoja.id} onCambio={cambiarHoja} opciones={hojas.map((h) => ({ id: h.id, label: h.nombre }))} />
        </div>
      )}

      {/* Si no se pudo leer nada de la hoja, UN aviso (no uno por sección), con el período a mano. */}
      {hoja.graficoError && hoja.numerosError && (
        <SeccionM titulo={visto?.nombre ?? hoja.nombre} accion={botonPeriodo}>
          <ErrorM frase={hoja.numerosError} />
        </SeccionM>
      )}

      {(hoja.grafico || (hoja.graficoError && !hoja.numerosError)) && (
        <SeccionM titulo={hoja.grafico?.titulo ?? hoja.nombre} accion={hoja.graficoSiguePeriodo ? botonPeriodo : undefined}>
          {hoja.grafico
            ? <GraficoBarrasM key={`${hoja.id}|${periodo?.id ?? ''}|${hoja.grafico.titulo}`} g={hoja.grafico} />
            : <ErrorM frase={hoja.graficoError ?? ''} />}
        </SeccionM>
      )}

      {(hoja.numeros.length > 0 || (hoja.numerosError && !hoja.graficoError)) && (
        <SeccionM
          titulo={visto?.nombre ?? 'Números'}
          // Sin gráfico arriba (o con uno que no sigue el período), el período se cambia desde acá.
          accion={(hoja.grafico || hoja.graficoError) && hoja.graficoSiguePeriodo ? <span className="m-dash-vs">vs. el período anterior</span> : botonPeriodo}
        >
          {hoja.numerosError
            ? <ErrorM frase={hoja.numerosError} />
            : (
              <ListaM>
                {hoja.numeros.map((n) => <FilaDatoM key={n.id} k={n.k} v={<Valor n={n} />} />)}
              </ListaM>
            )}
        </SeccionM>
      )}

      {(hoja.cobranza || hoja.cobranzaError) && (
        <CobranzaM
          filas={hoja.cobranza?.filas ?? []}
          tz={hoja.cobranza?.tz ?? ''}
          error={hoja.cobranzaError}
          fichaLead={fichaLead}
        />
      )}

      {periodos.length > 0 && (
        <SheetM abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Período" id="periodo" rotuloCerrar="Cerrar el período">
          <ListaM>
            {periodos.map((p) => (
              <FilaM
                key={p.id}
                titulo={p.nombre}
                navegacion
                chevron={false}
                onClick={() => elegir(p)}
                riel={p.id === visto?.id ? <span className="m-dash-check"><Icon name="check" size={20} /></span> : undefined}
              />
            ))}
          </ListaM>
        </SheetM>
      )}
    </div>
  );
}
