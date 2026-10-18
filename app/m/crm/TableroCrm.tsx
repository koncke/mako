'use client';

// =============================================================================
// El CRM en el teléfono (v3, 14/10/2026): el tablero de escritorio, una columna por pantalla
// =============================================================================
// Martín aprobó el prototipo v3 (docs/prototipos/mako-mobile-tableros.html, «CRM»): el CRM del
// teléfono ES el tablero, sin Hoy ni grupos («el CRM no lleva Hoy»). Lo que hay:
//
//   · Arriba, el selector de funnel (si el negocio tiene más de uno), como el desplegable de
//     escritorio: elegir uno cambia la URL (?funnel=), porque las etapas se leen en el server.
//   · El tablero (KanbanM): las columnas del funnel con su conteo y su plata.
//   · Tocar una tarjeta abre la ficha; mantenerla presionada, «Mover a…» con las etapas a las que
//     el teléfono PUEDE moverla (las de cobro, Ganado y las que piden wizard, en la computadora:
//     seMueveEnElTelefono). Y sólo si de su columna se SALE desde el teléfono (seSacaEnElTelefono:
//     no desde un desenlace ni desde Nutrición manual, porque el Deshacer no repone el monto, el
//     motivo ni el plazo). El server vuelve a chequear las dos cosas en moverEtapaAction.
//   · La lupa (la UNA acción del encabezado) abre el buscador en un sheet.
//
// REDISEÑO DEL 17/10/2026 (Martín: «rediseña las actuales de CRM, Plan… Siempre copia de otras apps que ya lo hacen
// bien»). Se miraron las capturas de la App Store de Pipedrive, HubSpot y Attio en el teléfono; lo que se copió:
//   · La FILA DEL DEAL de Pipedrive: el nombre grande, debajo «$4.2k · Empresa · por dónde llegó» en gris, y a la
//     derecha el punto de actividad (verde = agendado, rojo = venció) con su fecha, en vez de una tarjeta suelta con
//     su pie. Filas pegadas con su filete, sobre la columna blanca: entran 7-8 leads por pantalla, no 4.
//   · El ENCABEZADO DE LA ETAPA de Pipedrive («Proposal Presented / $109,790»): el nombre en letra normal, la plata
//     abajo; el conteo en la píldora de la derecha, como la columna del tablero de Attio («Prospecting 24»).
//   · La BARRA DE ETAPAS de Pipedrive: llena hasta la etapa que se está mirando (dónde estás en el funnel), con el
//     conteo de cada una debajo (eso es nuestro: dónde está la gente sin recorrer las columnas).
//   · El selector de funnel como el «Sales pipeline ▾» de Pipedrive.
// Lo que NO cambia (decisiones de Martín): una columna por pantalla con la siguiente asomando (Trello), arrastrar
// con el dedo + «Mover a…» al mantener. Todo es la piel de KanbanM desde ./crm.css (`.m-crm-tablero`): el
// componente compartido no se toca.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import {
  CabeceraM, ErrorM, FilaM, KanbanM, ListaM, SheetM, SkeletonFilas, VacioM, useConexion,
  type ColumnaKanban, type ResultadoMover, type TarjetaKanban,
} from '@/app/m/_ui';
import { buscarLeadsAction, deshacerMoverAction, moverEtapaAction } from './acciones';
import { MIN_BUSQUEDA, type FilaLeadM } from './reglas';
import type { TableroCrmM } from './datos';

type Busqueda =
  | { fase: 'quieto' }
  | { fase: 'buscando' }
  | { fase: 'listo'; filas: FilaLeadM[]; hayMas: boolean }
  | { fase: 'error'; error: string };

const ficha = (id: number | string) => `/m/crm/${id}`;
const urlFunnel = (id: number | null) => (id == null ? '/m/crm' : `/m/crm?funnel=${id}`);

export function TableroCrm({ datos }: { datos: TableroCrmM }) {
  const [buscar, setBuscar] = useState(false);
  const [elegirFunnel, setElegirFunnel] = useState(false);
  const router = useRouter();

  // UNA acción a la derecha (memo: CabeceraM vuelve a pisar el encabezado cada vez que cambia).
  const accion = useMemo(() => (
    <button type="button" className="m-cabecera__accion" aria-label="Buscar un lead" onClick={() => setBuscar(true)}>
      <Icon name="search" size={22} />
    </button>
  ), []);

  const movibles = useMemo(() => new Set(datos.columnas.filter((c) => c.movible).map((c) => c.key)), [datos.columnas]);
  const deDondeSale = useMemo(() => new Set(datos.columnas.filter((c) => c.sale).map((c) => c.key)), [datos.columnas]);
  const columnas: ColumnaKanban[] = useMemo(
    () => datos.columnas.map((c) => ({ key: c.key, titulo: c.titulo, total: c.total ?? undefined, cuantos: c.cuantos })),
    [datos.columnas],
  );
  const tarjetas: TarjetaKanban[] = useMemo(() => datos.tarjetas.map((t) => ({
    id: String(t.id),
    col: t.col,
    href: ficha(t.id),
    // El nombre accesible lleva lo que dice el punto (el color solo no se lee).
    etiqueta: t.senal.dice ? `${t.nombre}, ${t.senal.dice}` : t.nombre,
    contenido: <FilaLead t={t} />,
  })), [datos.tarjetas]);

  const mover = async (id: string, destino: string): Promise<ResultadoMover> => {
    const leadId = Number(id);
    const r = await moverEtapaAction(leadId, datos.funnelId, destino);
    if (!r.ok) return { ok: false, error: r.error };
    // Ya estaba ahí: el server refrescó y la tarjeta queda donde está, sin Deshacer.
    if (!r.cambio) return { ok: true };
    return {
      ok: true,
      deshacer: async () => {
        const d = await deshacerMoverAction(leadId, datos.funnelId, r.antes, r.esCasa, r.deshacer).catch(() => ({ ok: false as const }));
        return d.ok;
      },
    };
  };

  const actual = datos.funnels.find((f) => f.id === datos.funnelId) ?? datos.funnels[0];
  const selector = datos.funnels.length > 1 ? (
    <button type="button" className="m-crm-funnel" aria-label={`Funnel: ${actual?.nombre ?? ''}`} onClick={() => setElegirFunnel(true)}>
      <span>{actual?.nombre}</span>
      <span className="m-crm-funnel__flecha" aria-hidden><Icon name="chevron" size={16} /></span>
    </button>
  ) : undefined;

  return (
    <>
      <CabeceraM accion={accion} />
      <div className="m-crm-tablero">
        <KanbanM
          etiqueta="Tablero del CRM"
          columnas={columnas}
          tarjetas={tarjetas}
          unidades="leads"
          arriba={selector}
          moverA={(id) => {
            const actualCol = datos.tarjetas.find((t) => String(t.id) === id)?.col;
            if (!actualCol || !deDondeSale.has(actualCol)) return [];
            return datos.columnas.filter((c) => movibles.has(c.key) && c.key !== actualCol).map((c) => c.key);
          }}
          onMover={mover}
        />
      </div>

      <SheetM id="funnel" abierto={elegirFunnel} onCerrar={() => setElegirFunnel(false)} titulo="Funnel" snap="medio">
        <ListaM etiqueta="Funnels">
          {datos.funnels.map((f) => {
            const es = f.id === datos.funnelId;
            return (
              <FilaM
                key={f.id ?? 'negocio'}
                titulo={f.nombre}
                navegacion
                // Cerrarla por código (replaceState) y navegar en el mismo tick es seguro: ver SheetM.
                onClick={() => { setElegirFunnel(false); if (!es) router.push(urlFunnel(f.id)); }}
                chevron={false}
                riel={es ? <span className="m-crm-check"><IconoMenu nombre="check" size={20} /></span> : undefined}
                etiqueta={es ? `${f.nombre}, elegido` : f.nombre}
              />
            );
          })}
        </ListaM>
      </SheetM>

      <SheetM id="buscar" abierto={buscar} onCerrar={() => setBuscar(false)} titulo="Buscar" snap="alto">
        {buscar && <Buscador />}
      </SheetM>
    </>
  );
}

/**
 * La fila de un lead en el tablero, copiada de la del deal de Pipedrive: nombre · «plata · empresa» · punto y fecha.
 * Las clases van sin `.m-crm-tablero` delante a propósito: la COPIA que sigue al dedo al arrastrar cuelga de #m-root
 * (KanbanM), fuera del tablero, y tiene que dibujarse igual.
 */
function FilaLead({ t }: { t: TableroCrmM['tarjetas'][number] }) {
  const linea = [t.plata, t.segunda].filter(Boolean).join(' · ');
  return (
    <span className="m-crm-tj" data-tono={t.senal.tono ?? undefined}>
      <span className="m-crm-tj__txt">
        <span className="m-crm-tj__n">{t.nombre}</span>
        {linea && <span className="m-crm-tj__c">{linea}</span>}
      </span>
      {(t.senal.tono || t.senal.texto) && (
        <span className="m-crm-tj__der">
          {t.senal.tono && <i className="m-crm-tj__punto" aria-hidden />}
          {t.senal.texto && <span className="m-crm-tj__cuando">{t.senal.texto}</span>}
        </span>
      )}
    </span>
  );
}

/** El buscador: en el SERVER (buscarLeadsAction, ~20 filas, 300 ms de respiro). */
function Buscador() {
  const { enLinea } = useConexion();
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

  return (
    <>
      <div className="m-crm-buscar" role="search">
        <span className="m-crm-buscar__ico" aria-hidden><Icon name="search" size={18} /></span>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder={enLinea ? 'Nombre, teléfono o email' : 'Sin conexión'}
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
      <div className="m-crm-resultados">
        {!buscando ? null
          : busqueda.fase === 'buscando' || busqueda.fase === 'quieto' ? <SkeletonFilas filas={3} />
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
      </div>
    </>
  );
}

