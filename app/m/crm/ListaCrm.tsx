'use client';

// =============================================================================
// La lista del CRM en el teléfono (v2): buscador, el filtro por etapa y los tres grupos
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="crm" y el sheet «Ver por etapa».
//
//   · Buscar busca en el SERVER (buscarLeadsAction, ~20 filas, 300 ms de respiro). Con texto,
//     los resultados reemplazan a los grupos; sin texto, vuelven tal cual.
//   · La acción de la derecha de la barra abre «Ver por etapa»: las columnas del tablero del
//     negocio con su conteo (porEtapaAction). Elegir una muestra sus leads en lugar de los grupos.
//   · Los grupos (Hoy · Por responder · Nuevos) llegan ya armados del server (datos.ts).
//
// Las filas del CRM no llevan chevron (como el prototipo y como Mensajes): el riel es la hora.
// La cartera NUNCA baja al teléfono.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Icon } from '@/app/_components/icons';
import {
  CabeceraM, ErrorM, FilaM, ListaM, SeccionM, SheetM, SkeletonFilas, VacioM, useConexion,
} from '@/app/m/_ui';
import { buscarLeadsAction, porEtapaAction } from './acciones';
import { MIN_BUSQUEDA, type FilaLeadM } from './reglas';
import type { EtapaConteoM, FilaCrmM, ListaCrmM } from './datos';

type Busqueda =
  | { fase: 'quieto' }
  | { fase: 'buscando' }
  | { fase: 'listo'; filas: FilaLeadM[]; hayMas: boolean }
  | { fase: 'error'; error: string };

type Etapas = { fase: 'cargando' } | { fase: 'listo'; etapas: EtapaConteoM[] } | { fase: 'error'; error: string };
type DeEtapa = { fase: 'cargando' } | { fase: 'listo'; filas: FilaCrmM[]; hayMas: boolean } | { fase: 'error'; error: string };

const ficha = (id: number) => `/m/crm/${id}`;

function Filas({ filas }: { filas: FilaCrmM[] }) {
  return (
    <ListaM>
      {filas.map((f) => (
        <FilaM key={f.leadId} avatar={f.nombre} titulo={f.nombre} segunda={f.segunda ?? undefined} riel={f.riel || undefined} href={ficha(f.leadId)} chevron={false} />
      ))}
    </ListaM>
  );
}

export function ListaCrm({ datos }: { datos: ListaCrmM }) {
  const { enLinea } = useConexion();

  // ── Buscar ────────────────────────────────────────────────────────────────
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState<Busqueda>({ fase: 'quieto' });
  const [intento, setIntento] = useState(0);
  const pedido = useRef(0);
  const query = q.trim();
  const buscando = query.length >= MIN_BUSQUEDA;

  useEffect(() => {
    if (!buscando) return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      setBusqueda({ fase: 'buscando' });
      buscarLeadsAction(query)
        .then((r) => {
          if (n !== pedido.current) return; // llegó tarde: ya se escribió otra cosa
          setBusqueda(r.ok ? { fase: 'listo', filas: r.filas, hayMas: r.hayMas } : { fase: 'error', error: r.error });
        })
        .catch(() => { if (n === pedido.current) setBusqueda({ fase: 'error', error: 'No pude buscar' }); });
    }, 300);
    return () => clearTimeout(t);
  }, [query, buscando, intento]);

  // ── Filtrar por etapa ─────────────────────────────────────────────────────
  const [sheet, setSheet] = useState(false);
  const [etapas, setEtapas] = useState<Etapas>({ fase: 'cargando' });
  const [filtro, setFiltro] = useState<{ key: string; label: string } | null>(null);
  const [deEtapa, setDeEtapa] = useState<DeEtapa>({ fase: 'cargando' });
  const pedidoEtapa = useRef(0);

  const leerEtapas = () => {
    setEtapas({ fase: 'cargando' });
    porEtapaAction(null)
      .then((r) => setEtapas(r.ok ? { fase: 'listo', etapas: r.etapas } : { fase: 'error', error: r.error }))
      .catch(() => setEtapas({ fase: 'error', error: 'No pude leer las etapas' }));
  };

  const elegir = (e: { key: string; label: string } | null) => {
    setSheet(false);
    setFiltro(e);
    if (!e) return;
    const n = ++pedidoEtapa.current;
    setDeEtapa({ fase: 'cargando' });
    porEtapaAction(e.key)
      .then((r) => {
        if (n !== pedidoEtapa.current) return;
        if (!r.ok) { setDeEtapa({ fase: 'error', error: r.error }); return; }
        setDeEtapa({ fase: 'listo', filas: r.filas, hayMas: r.hayMas });
        setEtapas({ fase: 'listo', etapas: r.etapas });
      })
      .catch(() => { if (n === pedidoEtapa.current) setDeEtapa({ fase: 'error', error: 'No pude leer la etapa' }); });
  };

  const abrirFiltro = () => {
    setSheet(true);
    if (etapas.fase !== 'listo') leerEtapas();
  };

  // Tirar para refrescar trae `datos` nuevos: los conteos guardados y la etapa filtrada
  // también se vuelven a pedir (si no, el refresco renueva los grupos y deja el filtro viejo).
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtapas({ fase: 'cargando' });
    if (filtro) elegir(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  // UNA acción a la derecha de la barra. Memo: CabeceraM vuelve a pisar el encabezado cada
  // vez que cambia, y un elemento nuevo en cada render lo pisaría en cada render.
  const accion = useMemo(() => (
    <button type="button" className="m-cabecera__accion m-crm-filtro" aria-label="Filtrar por etapa" aria-pressed={!!filtro} onClick={abrirFiltro}>
      <IconoMenu nombre="filtro" size={22} />
    </button>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filtro, etapas.fase]);

  // ── Lo que se dibuja debajo del buscador ──────────────────────────────────
  let cuerpo: React.ReactNode;
  if (buscando) {
    cuerpo = (
      <SeccionM titulo="Resultados">
        {busqueda.fase === 'buscando' || busqueda.fase === 'quieto' ? <SkeletonFilas filas={3} />
          : busqueda.fase === 'error' ? <ErrorM frase={busqueda.error} onReintentar={() => setIntento((n) => n + 1)} />
          : busqueda.filas.length === 0 ? <VacioM frase="Ningún lead con ese nombre." />
          : (
            <>
              <ListaM>
                {busqueda.filas.map((f) => (
                  <FilaM key={f.id} avatar={f.nombre} titulo={f.nombre} segunda={f.segunda ?? undefined} href={ficha(f.id)} chevron={false} />
                ))}
              </ListaM>
              {busqueda.hayMas && <p className="m-crm-aviso">Escribe un poco más para ver el resto.</p>}
            </>
          )}
      </SeccionM>
    );
  } else if (filtro) {
    cuerpo = (
      <SeccionM titulo={filtro.label} accion={<button type="button" className="m-lnk" onClick={() => elegir(null)}>Ver todo</button>}>
        {deEtapa.fase === 'cargando' ? <SkeletonFilas filas={4} />
          : deEtapa.fase === 'error' ? <ErrorM frase={deEtapa.error} onReintentar={() => elegir(filtro)} />
          : deEtapa.filas.length === 0 ? <VacioM frase="Nadie en esta etapa." />
          : (
            <>
              <Filas filas={deEtapa.filas} />
              {deEtapa.hayMas && <p className="m-crm-aviso">El resto, en el tablero de la computadora.</p>}
            </>
          )}
      </SeccionM>
    );
  } else {
    const { hoy, porResponder, nuevos } = datos;
    const todoVacio = hoy?.length === 0 && porResponder?.length === 0 && nuevos?.length === 0;
    cuerpo = todoVacio ? (
      <VacioM frase="Nada pendiente por hoy." />
    ) : (
      <>
        {hoy == null ? (
          <SeccionM titulo="Hoy"><ErrorM frase="No pude leer las reuniones de hoy." /></SeccionM>
        ) : hoy.length > 0 && (
          <SeccionM titulo="Hoy"><Filas filas={hoy} /></SeccionM>
        )}
        {porResponder == null ? (
          <SeccionM titulo="Por responder"><ErrorM frase="No pude leer los chats de WhatsApp." /></SeccionM>
        ) : porResponder.length > 0 && (
          <SeccionM titulo="Por responder"><Filas filas={porResponder} /></SeccionM>
        )}
        {nuevos == null ? (
          <SeccionM titulo="Nuevos"><ErrorM frase="No pude leer los leads nuevos." /></SeccionM>
        ) : nuevos.length > 0 && (
          <SeccionM
            titulo="Nuevos"
            accion={datos.masNuevos && datos.entrada
              ? <button type="button" className="m-lnk" onClick={() => elegir(datos.entrada)}>Ver todos</button>
              : undefined}
          >
            <Filas filas={nuevos} />
          </SeccionM>
        )}
      </>
    );
  }

  return (
    <>
      <CabeceraM accion={accion} />

      <div className="m-crm-buscar" role="search">
        <span className="m-crm-buscar__ico" aria-hidden><Icon name="search" size={18} /></span>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={enLinea ? 'Buscar' : 'Sin conexión'}
          aria-label="Buscar un lead por nombre, teléfono, email o empresa"
          value={q}
          onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < MIN_BUSQUEDA) setBusqueda({ fase: 'quieto' }); }}
          disabled={!enLinea}
        />
        {q && (
          <button type="button" className="m-crm-buscar__limpiar" aria-label="Borrar la búsqueda" onClick={() => { setQ(''); setBusqueda({ fase: 'quieto' }); }}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {cuerpo}

      <SheetM id="etapas" abierto={sheet} onCerrar={() => setSheet(false)} titulo="Ver por etapa" snap="medio">
        {etapas.fase === 'cargando' ? <SkeletonFilas filas={5} />
          : etapas.fase === 'error' ? <ErrorM frase={etapas.error} onReintentar={leerEtapas} />
          : (
            <ListaM etiqueta="Etapas">
              <FilaM
                titulo="Todas"
                navegacion
                onClick={() => elegir(null)}
                chevron={false}
                riel={!filtro ? <span className="m-crm-check"><IconoMenu nombre="check" size={20} /></span> : undefined}
                etiqueta={!filtro ? 'Todas, elegida' : 'Todas'}
              />
              {etapas.etapas.map((e) => {
                const es = filtro?.key === e.key;
                return (
                  <FilaM
                    key={e.key}
                    titulo={e.label}
                    navegacion
                    onClick={() => elegir({ key: e.key, label: e.label })}
                    chevron={false}
                    riel={es ? <span className="m-crm-check"><IconoMenu nombre="check" size={20} /></span> : String(e.n)}
                    etiqueta={`${e.label}: ${e.n}${es ? ', elegida' : ''}`}
                  />
                );
              })}
            </ListaM>
          )}
      </SheetM>
    </>
  );
}
