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
import { linkInstagram } from '@/app/crm/campo-inline';
import { CaraTarjeta, CuerpoFichaRapida, EstiloTarjetas } from '@/app/_ui/TarjetaKanban';
import { ReunionesParaPreparar } from '@/app/crm/TarjetaReunion';
import { insigniaDeCanal, subtituloEnOrden, subtituloLead, type CampoTarjetaLead } from '@/lib/tarjeta-kanban';
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
  // La ficha rápida (17/10/2026, la familia del prototipo): tocar una tarjeta la abre; «Abrir ficha» lleva a la completa.
  const [rapida, setRapida] = useState<TableroCrmM['tarjetas'][number] | null>(null);
  // «Mover a…» desde la ficha rápida: le pide a KanbanM su MISMO sheet (el del toque largo, con su toast y su deshacer).
  const [pedirMover, setPedirMover] = useState<{ id: string; vez: number } | null>(null);
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
  // Qué muestra la tarjeta (20/10/2026): la elección de quien mira, la misma que en la computadora.
  const campos: readonly CampoTarjetaLead[] = datos.campos ?? [];
  const tarjetas: TarjetaKanban[] = useMemo(() => datos.tarjetas.map((t) => ({
    id: String(t.id),
    col: t.col,
    // Sin `href` (17/10/2026): tocar abre la ficha rápida (`onTocar`); desde ahí «Abrir ficha» lleva a la completa.
    // El nombre accesible lleva lo que dice el punto (el color solo no se lee) y, si es su único canal, el @ del chip.
    etiqueta: [t.nombre, t.soloInstagram ? `@${t.soloInstagram}` : null, t.senal.dice].filter(Boolean).join(', '),
    contenido: <FilaLead t={t} campos={campos} />,
  })), [datos.tarjetas, campos]);

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

  // «Próximo»: la próxima reunión que todavía no pasó, con LA tarjeta de la computadora (22/10/2026, app/crm/TarjetaReunion.tsx):
  // cuánto falta, quién es, lo útil para entrar y, cerca de la hora, «Entrar a la reunión». Sin «Llamar» ni «WhatsApp»
  // (Martín: «Y que no tenga "Llamar o WhatsApp"»; las dos siguen en la ficha rápida y en la ficha).
  const px = datos.proximo;
  // El paso cuenta el CAMINO (las columnas del pipeline), como en la computadora.
  const camino = datos.columnas.filter((c) => c.camino);
  const iPx = px ? camino.findIndex((c) => c.key === px.col) : -1;
  const proximo = px ? (
    <ReunionesParaPreparar reuniones={[{
      id: `${px.id}-J1`, leadId: px.id, cual: 'R1', fecha: px.fecha, dia: px.dia, at: px.at, url: px.url,
      nombre: px.nombre, empresa: px.empresa, foto: px.foto,
      paso: iPx >= 0 ? { n: iPx + 1, de: camino.length, etapa: camino[iPx].titulo } : null,
      plata: px.plata, objetivo: null, facturacion: null, sinVsl: false,
    }]} onVerDetalle={() => router.push(ficha(px.id))} />
  ) : null;
  const arriba = selector || proximo ? <div className="m-crm-arriba">{selector}{proximo}</div> : undefined;

  const r = rapida;
  const iR = r ? camino.findIndex((c) => c.key === r.col) : -1;
  // Su único canal es el @ (sin email ni teléfono): «Instagram» va donde las demás ofrecen Llamar y WhatsApp. El link se arma
  // en campo-inline (`linkInstagram`); sin un usuario válido no hay link, y entonces no se dibuja un botón que no lleva a nada.
  const igR = r?.soloInstagram ? linkInstagram(r.soloInstagram) : null;
  const destinosR = r && deDondeSale.has(r.col) ? datos.columnas.filter((c) => movibles.has(c.key) && c.key !== r.col) : [];

  return (
    <>
      <CabeceraM accion={accion} />
      <EstiloTarjetas />
      <div className="m-crm-tablero">
        <KanbanM
          etiqueta="Tablero del CRM"
          columnas={columnas}
          tarjetas={tarjetas}
          unidades="leads"
          arriba={arriba}
          onTocar={(id) => setRapida(datos.tarjetas.find((t) => String(t.id) === id) ?? null)}
          pedirMover={pedirMover}
          moverA={(id) => {
            const actualCol = datos.tarjetas.find((t) => String(t.id) === id)?.col;
            if (!actualCol || !deDondeSale.has(actualCol)) return [];
            return datos.columnas.filter((c) => movibles.has(c.key) && c.key !== actualCol).map((c) => c.key);
          }}
          onMover={mover}
        />
      </div>

      <SheetM id="info" abierto={!!r} onCerrar={() => setRapida(null)} titulo="Ver info" snap="medio">
        {r && (
          <CuerpoFichaRapida
            nombre={r.nombre}
            foto={r.foto}
            insignia={insigniaDeCanal(r.canal)}
            subtitulo={subtituloLead(r.plata, r.canal)}
            avance={iR >= 0 ? { pct: ((iR + 1) / camino.length) * 100, texto: `Paso ${iR + 1} de ${camino.length} · ${camino[iR].titulo}` } : null}
            filas={[
              ...(r.soloInstagram ? [{ k: 'Instagram', v: `@${r.soloInstagram}` }] : []),
              ...(r.segunda ? [{ k: 'Empresa o llegó por', v: r.segunda }] : []),
              ...(r.senal.dice ? [{ k: 'Ahora', v: r.senal.dice }] : []),
            ]}
            acciones={[
              ...(r.telefono ? [{ texto: 'Llamar', href: `tel:+${r.telefono}`, primaria: true }, { texto: 'WhatsApp', href: `https://wa.me/${r.telefono}`, externo: true }] : []),
              ...(igR ? [{ texto: 'Instagram', href: igR, externo: true, primaria: true }] : []),
              { texto: 'Abrir ficha', onClick: () => { const id = r.id; setRapida(null); router.push(ficha(id)); }, primaria: !r.telefono && !igR },
            ]}
            onMoverA={destinosR.length ? () => { const id = String(r.id); setRapida(null); setPedirMover((p) => ({ id, vez: (p?.vez ?? 0) + 1 })); } : null}
          />
        )}
      </SheetM>

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
function FilaLead({ t, campos }: { t: TableroCrmM['tarjetas'][number]; campos: readonly CampoTarjetaLead[] }) {
  // La familia de tarjetas (17/10/2026): la cara con la insignia del canal, el nombre, «plata · por dónde llegó», la
  // señal (la reunión, el plazo que vence) y «Ver info», como en la computadora. Toda la tarjeta abre la ficha rápida:
  // la píldora es la pista, no un segundo botón adentro de otro.
  // La foto, la plata y por dónde llegó, según «Personalizar tarjetas» de quien mira (20/10/2026; se elige en la
  // computadora y vale acá). La señal (la reunión, el plazo) se queda: es el aviso de la fila.
  const sub = subtituloEnOrden(campos, { plata: t.plata, canal: t.canal });
  return (
    <span className="m-crm-tj" data-tono={t.senal.tono ?? undefined}>
      {campos.includes('foto') && <CaraTarjeta nombre={t.nombre} foto={t.foto} insignia={insigniaDeCanal(t.canal)} tam={46} />}
      <span className="m-crm-tj__txt">
        <span className="m-crm-tj__n">{t.nombre}</span>
        {sub && <span className="m-crm-tj__c">{sub}</span>}
        {/* EL @ COMO ÚNICO CANAL (23/10/2026): el MISMO chip que la tarjeta de escritorio (`tk-chip--gris`, data-solo-instagram), y
            sale SIEMPRE, no es un campo de «Personalizar tarjetas»: es por dónde se le escribe a este lead. Se dibuja el canal que
            tiene, no un «falta» (Martín, 22/10/2026). La condición es `soloInstagram` (./reglas.ts), la del escritorio. */}
        {t.soloInstagram && (
          <span className="tk-chips m-crm-tj__canal"><span className="tk-chip tk-chip--gris" data-solo-instagram>@{t.soloInstagram}</span></span>
        )}
        {t.senal.tono && t.senal.texto && (
          <span className="m-crm-tj__cuando"><i className="m-crm-tj__punto" aria-hidden />{t.senal.texto}</span>
        )}
      </span>
      <span className="m-crm-tj__ver tk-pill tk-pill--suave" aria-hidden>Ver info</span>
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

