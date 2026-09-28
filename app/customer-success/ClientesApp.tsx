'use client';

// =============================================================================
// Clientes — quién es cliente, y qué trabajo tiene
// =============================================================================
// Una grilla de tarjetas y, al abrir una: sus proyectos, sus tareas y sus recurrentes.
// Eso es toda la pantalla.
//
// ⚠️ LO QUE NO ESTÁ, NO FALTA. Se fueron la señal de atención en tres niveles, el reloj
// del contrato, los cuatro números de cabecera y las cinco tabs: venían de calcar la tab
// que UN cliente tenía armada para su negocio. Antes de agregarle algo: si no es un
// cliente, un proyecto, una tarea o una recurrente, no va acá.

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Status } from '@/app/_ui';

import type { ClienteCruce } from './cruce';
import type { CuentasProp } from './CuentaDeMaKo';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { ClienteCard } from './ClienteCard';
import { GrillaTarjetas, TarjetaNueva } from '@/app/_components/TarjetaEntidad';
import { FichaCliente } from './FichaCliente';
import type { TrabajoDeCliente } from './trabajo';
import type { BoardUser } from '@/app/plan/board/types';
import { NuevoCliente } from './NuevoCliente';
import { BarraClientes, CUANDO_LABEL, entraEnVentana, type FiltroClientes, type OrdenClientes } from './BarraClientes';
import { TablaClientes } from './TablaClientes';
import { guardarImagenClienteAction, autoasignarAction } from './actions';

/** Lo que se le cambió a un cliente sin recargar la página. */
type Imagen = { avatarUrl?: string | null; portada?: string | null; portadaY?: number | null; avatarY?: number | null; icono?: string | null };

export function ClientesApp({ clientes, tablero, trabajo, user, error, cuentas }: {
  /** Los leads GANADOS del workspace, en orden de `id` — o sea, de antigüedad como
   *  cliente. Ese orden es el que numera («Cliente 1»); la grilla se ordena aparte. */
  clientes: ClienteCruce[];
  tablero: TableroCartera;
  /** El trabajo de TODOS, leído en el server. Es lo que hace que abrir una ficha no
   *  tenga estado de carga. `null` = no se pudo leer; la grilla se dibuja igual. */
  trabajo: { dueno: boolean; porCliente: Record<number, TrabajoDeCliente> } | null;
  user: BoardUser;
  /** La lista no se pudo leer. NO es «no tenés clientes»: son dos pantallas. */
  error?: string;
  /** Vista de agencia: en qué estado está la cuenta de MaKo de cada cliente, quién
   *  ve el control y por qué puerta entra. La forma vive en `CuentaDeMaKo` y se
   *  importa: escrita tres veces, la tercera se queda vieja. */
  cuentas?: CuentasProp;
}) {
  const [creando, setCreando] = useState(false);
  const [abiertoId, setAbiertoId] = useState<number | null>(null);
  /** Con qué tab abre la ficha. `null` = la que la ficha elija (el tablero). Existe
   *  para que «Ver su equipo» de la tarjeta caiga en Equipo y no en el tablero. */
  const [abrirEn, setAbrirEn] = useState<string | null>(null);
  /**
   * LO QUE SE CAMBIÓ ACÁ ADENTRO, encima de lo que trajo el server.
   *
   * ⚠️ NO ES UN CACHÉ NI UN DUPLICADO DEL DATO: es el resultado que ya devolvió el
   * server action, aplicado sin esperar a que `revalidatePath` vuelva con las 78 KB del
   * trabajo de toda la cartera. Cambiar una portada y quedarse mirando la vieja durante
   * medio segundo se lee como que el botón no hizo nada.
   */
  const [imgs, setImgs] = useState<Record<number, Imagen>>({});
  const [mal, setMal] = useState('');
  const [mako, setMako] = useState<string | null>(null);
  const [, empezar] = useTransition();
  /** Lo que la barra de arriba decide: qué se busca, cómo se mira y en qué orden. */
  const [q, setQ] = useState('');
  const [tabla, setTabla] = useState(false);
  const [filtro, setFiltro] = useState<FiltroClientes>('todos');
  const [cuando, setCuando] = useState('siempre');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [orden, setOrden] = useState<OrdenClientes>('nombre');

  const resumenDe = (leadId: number): ResumenTrabajo | null =>
    (tablero.ok ? tablero.porLead[leadId] : null) ?? null;

  /** El cliente con lo que se le haya cambiado en esta sesión encima. */
  const conImagen = (c: ClienteCruce): ClienteCruce => ({ ...c, ...(imgs[c.leadId] ?? {}) });

  /**
   * El NÚMERO de cliente, y sale del orden de ALTA, no del de la pantalla.
   *
   * ⚠️ NO ES EL ID DEL LEAD, a pedido: «el ID ya no sería de lead, sino de cliente, sería
   * el cliente 1» (26/09/2026). Y no es la posición en la grilla: esa se ordena por
   * nombre, así que ganar un cliente nuevo le cambiaría el número a media cartera.
   * `clientes` llega ordenado por `id`, que es el orden en que se ganaron.
   */
  const numeroDe = new Map(clientes.map((c, i) => [c.leadId, i + 1]));

  /**
   * LO QUE SE VE: la cartera pasada por el buscador, el filtro y el orden de la barra.
   *
   * ⚠️ `lista` ES LA CARTERA ENTERA Y `visibles` LO QUE QUEDÓ. Los dos hacen falta: el
   * número del header y «N de M» cuentan cosas distintas, y colapsarlos haría que al
   * filtrar el título dijera que se te fueron nueve clientes.
   */
  const lista = [...clientes].map(conImagen);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pasa = (c: ClienteCruce) => {
      if (t && !`${nombreDe(c)} ${c.empresa ?? ''}`.toLowerCase().includes(t)) return false;
      const r = resumenDe(c.leadId);
      // ⚠️ SIN TABLERO NO SE FILTRA POR TRABAJO. Si no se pudo leer, todos tienen 0 y
      // «sin trabajo abierto» seleccionaría a la cartera entera — una respuesta falsa
      // con cara de filtro. Ahí pasan todos y el banner de arriba dice por qué.
      if (!tablero.ok) return true;
      if (filtro === 'con-trabajo') return (r?.abiertas ?? 0) > 0;
      if (filtro === 'sin-trabajo') return (r?.abiertas ?? 0) === 0;
      if (filtro === 'sin-proyecto') return (r?.proyectos ?? 0) === 0;
      if (filtro === 'con-cuenta') return c.clienteWs != null;
      if (filtro === 'sin-cuenta') return c.clienteWs == null;
      return true;
    };
    // La ventana va APARTE del filtro: son dos preguntas («cuáles» y «de cuándo»);
    // combinarlas en una lista obliga a escribir el producto cartesiano de las dos.
    const enVentana = (c: ClienteCruce) => entraEnVentana(c.fechaCierre, cuando);
    const cmp = (a: ClienteCruce, b: ClienteCruce) => {
      if (orden === 'abiertas') return (resumenDe(b.leadId)?.abiertas ?? 0) - (resumenDe(a.leadId)?.abiertas ?? 0);
      if (orden === 'proyectos') return (resumenDe(b.leadId)?.proyectos ?? 0) - (resumenDe(a.leadId)?.proyectos ?? 0);
      // Antigüedad = el orden de alta, que es el que numera. Sale del `leadId`.
      // Cuándo se ganó, con la fecha REAL (`leads.fecha_cierre`). Antes salía del
      // número de cliente, que es el orden de CARGA al CRM: dos ganados el mismo mes
      // podían salir a diez lugares de distancia. Los que no tienen fecha van al final
      // en las dos direcciones — «no sé cuándo» no es ni lo más nuevo ni lo más viejo.
      if (orden === 'antiguedad') {
        const fa = a.fechaCierre ? Date.parse(a.fechaCierre) : NaN;
        const fb = b.fechaCierre ? Date.parse(b.fechaCierre) : NaN;
        if (Number.isNaN(fa) && Number.isNaN(fb)) return 0;
        if (Number.isNaN(fa)) return 1;
        if (Number.isNaN(fb)) return -1;
        return fb - fa;
      }
      // El nombre es el único que se lee natural de la A a la Z, así que su «mayor
      // primero» es la Z: se invierte acá para que la dirección signifique lo mismo
      // en los cuatro criterios.
      return nombreDe(b).localeCompare(nombreDe(a), 'es');
    };
    // ⚠️ EL CRITERIO SE CALCULA «MAYOR PRIMERO» Y LA DIRECCION LO DA VUELTA AL FINAL.
    // Así el sentido es UNA decisión y no hay que acordarse de invertir cada rama,
    // que es como se cuela un orden que va al revés sólo para un criterio.
    const signo = dir === 'asc' ? -1 : 1;
    // Desempate SIEMPRE por nombre: sin él, dos clientes con la misma cantidad de
    // tareas se intercambian de lugar en cada render y la grilla parpadea.
    return lista.filter((c) => pasa(c) && enVentana(c))
      .sort((a, b) => signo * cmp(a, b) || nombreDe(a).localeCompare(nombreDe(b), 'es'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, imgs, q, filtro, orden, cuando, dir, tablero]);
  /** Cuántos tienen algo abierto. Con el tablero caído no se cuenta nada: sería un 0
   *  con cara de dato sobre una lectura que falló. */
  const conTrabajo = tablero.ok ? lista.filter((c) => (resumenDe(c.leadId)?.abiertas ?? 0) > 0).length : 0;

  // ⚠️ LA FICHA SE BUSCA EN `lista` Y NO EN `visibles`: filtrar o buscar con una ficha
  // abierta la cerraría de golpe, que se lee como que la app se rompió.
  const abierto = abiertoId === null ? null : lista.find((c) => c.leadId === abiertoId) ?? null;

  /** Guarda la foto o la portada. Lo que se pinta es lo que el server dijo que quedó
   *  guardado, no lo que se pidió: si el saneo descartó la URL, se tiene que ver. */
  function guardarImagen(leadId: number, cambio: Imagen) {
    setMal('');
    empezar(async () => {
      const r = await guardarImagenClienteAction(leadId, cambio);
      if (!r.ok) { setMal(r.error); return; }
      // ⚠️ SE FIJA LO QUE QUEDÓ EN LA BASE, LOS CINCO CAMPOS. Copiar sólo los dos que
      // el gesto tocó deja los otros tres en `undefined`, y `conImagen` los mergea
      // encima del cliente: la portada se encuadraría bien y el ícono desaparecería.
      setImgs((v) => ({ ...v, [leadId]: { avatarUrl: r.avatarUrl, portada: r.portada, portadaY: r.portadaY, avatarY: r.avatarY, icono: r.icono } }));
    });
  }

  /**
   * Que MaKo asigne lo evidente sobre TODA la cartera.
   *
   * ⚠️ VIVE EN LA CABECERA Y NO ADENTRO DE UNA FICHA, que es de donde salió: la corrida
   * mira el tablero entero y reparte entre todos los clientes, así que abrirla desde uno
   * prometía algo que no era. Y no se fue con el botón de «Asignarle trabajo» porque no
   * es lo mismo: aquél elegía a mano lo que ESTA pantalla ya resuelve desde el detalle de
   * cada tarjeta, y esto es lo único que decide solo.
   */
  const yaCorrio = useRef(false);
  useEffect(() => {
    // ⚠️ UNA VEZ POR MONTAJE. Sin el ref, cualquier re-render volvería a dispararlo — y
    // la corrida ESCRIBE en el tablero: repetirla no es sólo gastar, es repartir otra
    // vez sobre un tablero que la primera corrida ya movió.
    if (yaCorrio.current || !clientes.length) return;
    yaCorrio.current = true;
    correrMako();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes.length]);

  function correrMako() {
    setMako(null);
    empezar(async () => {
      const r = await autoasignarAction();
      // ⚠️ CORRIENDO SOLA, UN ERROR NO INTERRUMPE. Nadie apretó nada, así que un banner
      // rojo al entrar acusaría de algo que la persona no hizo. Lo que falla en segundo
      // plano se calla y se reintenta en la próxima carga; se muestra lo que SÍ pasó.
      if (!r.ok) return;
      const n = r.porNombre + r.porIA;
      // ⚠️ «NO PUDE PREGUNTAR» TIENE SU PROPIO TEXTO. Si la cascada de IA no contestó,
      // decir «ninguna es suya» sería afirmar un juicio que nadie emitió — y ya pasó: la
      // primera corrida reportó «0 de 43» sobre una respuesta vacía.
      // ⚠️ SÓLO SE AVISA CUANDO ASIGNÓ ALGO. «Ninguna de 4 es de nadie» y «Nada
      // evidente» eran la respuesta a apretar un botón: informaban del ESFUERZO. Sin
      // botón nadie preguntó nada, así que un cartel diciendo que no pasó nada es ruido
      // permanente en la cabecera. Lo que cambió el tablero sí se dice.
      if (n > 0) setMako(`MaKo asignó ${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`);
    });
  }

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Clientes"
        estado={lista.length > 0
          ? <Status>{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}</Status>
          : undefined}
        /* ⛔ ACÁ ESTABAN «MaKo: asignar lo evidente» Y «+ Nuevo cliente», y los dos se
           fueron (27/09/2026). El primero porque asignar lo evidente «debería hacerlo
           solo, automático, siempre»: ahora corre al entrar y sólo habla cuando movió
           algo. El segundo porque un botón de texto en una esquina no se parece a lo
           que crea — ahora es la primera tarjeta de la grilla, igual que «Crear nuevo
           proyecto…» en el tablero. Queda el aviso, que es lo único que informa. */
        accion={mako ? <span className="cl-mako">{mako}</span> : undefined}
      />

      {/* ⚠️ «Cero resultados» no es «no hay». Si el tablero no se pudo leer, las tarjetas
          dirían 0 en los tres números sobre clientes que sí tienen trabajo. */}
      {!error && !tablero.ok && <Banner tono="bad">No pude leer el tablero. {tablero.error}</Banner>}
      {mal && <Banner tono="bad">{mal}</Banner>}

      {error ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={error} detalleTecnico={error} />
      ) : lista.length === 0 ? (
        // EL VACÍO ES EL CASO PRINCIPAL: un workspace que recién empieza no ganó a nadie
        // todavía. Y ahora tiene DOS salidas, porque no todo cliente pasó por el CRM.
        <EmptyState
          titulo="Todavía no tienes clientes"
          detalle="Cárgalo aquí, o marca la venta de un lead como ganada en el CRM."
          accion={{ label: 'Cargar un cliente', onClick: () => setCreando(true) }}
        />
      ) : (
        <>
          <BarraClientes
            q={q} onQ={setQ} tabla={tabla} onTabla={setTabla}
            filtro={filtro} onFiltro={(v) => setFiltro(v as FiltroClientes)} orden={orden} onOrden={(v) => setOrden(v as OrdenClientes)}
            cuandos={CUANDO_LABEL} cuando={cuando} onCuando={setCuando} dir={dir} onDir={setDir}
            nVisibles={visibles.length} nTotal={lista.length}
            /* ⚠️ EL PROGRESO DE UNA CARTERA NO ES «TAREAS HECHAS». El plan cuenta lo
               completado; acá lo que importa es cuántos clientes tienen trabajo
               abierto — un cliente sin nada abierto no está «listo», está enfriándose,
               que es justo lo que esta pantalla existe para ver. Con el tablero caído
               no se afirma nada: el banner de arriba ya dice por qué. */
            progreso={{
              pct: lista.length ? Math.round((conTrabajo / lista.length) * 100) : 0,
              hechas: conTrabajo,
              total: lista.length,
              label: 'con trabajo',
            }}
            onExportar={() => exportarCSV(visibles, numeroDe, resumenDe)}
            onImportar={() => { window.location.href = '/crm?importar=1'; }} />

          {tabla ? (
            <TablaClientes filas={visibles} numeroDe={numeroDe} resumenDe={resumenDe}
              tableroOk={tablero.ok} onAbrir={setAbiertoId} onNuevo={() => setCreando(true)} />
          ) : (
            <GrillaTarjetas>
              {/* ⚠️ CREAR ES LA PRIMERA TARJETA, no un botón en la esquina. «Que sea una
                  preview de card, transparente, que diga Nuevo cliente, al principio de
                  todo, así como tenemos a los nuevos proyectos» (27/09/2026). Y vale
                  para algo más que parecerse: con la grilla vacía de resultados por un
                  filtro, sigue habiendo una salida a la vista. */}
              <li><TarjetaNueva label="Nuevo cliente" onClick={() => setCreando(true)} /></li>
              {visibles.map((c) => (
                <li key={c.leadId}>
                  <ClienteCard c={c} n={numeroDe.get(c.leadId) ?? 0}
                    trabajo={resumenDe(c.leadId)} tableroOk={tablero.ok}
                    cuentas={cuentas} onError={setMal}
                    onAbrir={() => { setAbrirEn(null); setAbiertoId(c.leadId); }}
                    onEquipo={() => { setAbrirEn('equipo'); setAbiertoId(c.leadId); }} />
                </li>
              ))}
            </GrillaTarjetas>
          )}

          {/* ⚠️ «NO ENCONTRÉ» NO ES «NO TENÉS». Sin este renglón, buscar algo que no
              existe deja una grilla con una sola tarjeta de crear, y eso se lee como
              que se borró la cartera. */}
          {visibles.length === 0 && (
            <p className="cl-nada">Ningún cliente coincide con lo que buscaste.</p>
          )}
        </>
      )}

      {abierto && (
        <FichaCliente
          key={abierto.leadId}
          c={abierto}
          n={numeroDe.get(abierto.leadId) ?? 0}
          trabajo={trabajo?.porCliente[abierto.leadId]
            // Un cliente sin trabajo asignado no tiene entrada en el mapa, y eso NO es un
            // error: es el caso normal del día 1. Se le arma su tablero vacío.
            ?? (trabajo ? (trabajo.dueno
              ? { dueno: true as const, tareas: [], proyectos: [] }
              : { dueno: false as const, tareas: [], categorias: [] }) : null)}
          user={user}
          clientes={clientes}
          cuentas={cuentas}
          tabInicial={abrirEn}
          onImagen={(cambio) => guardarImagen(abierto.leadId, cambio)}
          onCerrar={() => { setAbiertoId(null); setAbrirEn(null); }}
        />
      )}

      {creando && <NuevoCliente onCerrar={() => setCreando(false)} />}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}


/**
 * LO QUE SE VE, a un CSV.
 *
 * ⚠️ EXPORTA `visibles` Y NO LA CARTERA ENTERA, a propósito: con un filtro puesto,
 * exportar todo es devolver algo que no es lo que la persona está mirando. Y el
 * archivo se arma en el NAVEGADOR —sin ruta y sin server— porque el dato ya está acá:
 * pedirlo de nuevo sería una llamada para reordenar lo que ya tenemos.
 *
 * El separador es `;` y va con BOM. Sin las dos cosas, Excel en español abre el
 * archivo con todo en una columna y se come los acentos.
 */
function exportarCSV(
  filas: ClienteCruce[],
  numeroDe: Map<number, number>,
  resumenDe: (leadId: number) => ResumenTrabajo | null,
) {
  // Una comilla adentro de un campo rompe la fila: se duplica, que es como la escapa
  // el formato. Y los saltos de línea se aplanan, o parten la fila en dos.
  const q = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
  const cab = ['Cliente', 'Nombre', 'Empresa', 'Proyectos', 'Abiertas', 'Se repiten'];
  const cuerpo = filas.map((c) => {
    const r = resumenDe(c.leadId);
    return [numeroDe.get(c.leadId) ?? 0, nombreDe(c), c.empresa ?? '', r?.proyectos ?? 0, r?.abiertas ?? 0, r?.recurrentes ?? 0]
      .map(q).join(';');
  });
  const csv = '﻿' + [cab.map(q).join(';'), ...cuerpo].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clientes.csv';
  a.click();
  // Sin esto el blob queda en memoria hasta que se cierre la pestaña.
  URL.revokeObjectURL(url);
}

/** Un lead ganado puede tener el nombre vacío: la tarjeta necesita algo que decir. */
const nombreDe = (c: ClienteCruce): string => c.nombre.trim() || 'Sin nombre';

const CSS = `
/* ⚠️ MÁS GRANDES Y CENTRADAS. «Queda todo muy chiquito y mucho espacio en blanco»
   (27/09/2026): con auto-fill y 258 px, en una pantalla de 1440 entraban cinco
   columnas chicas y el resto era aire. Van tres cosas juntas: auto-fit en vez de
   auto-fill —que colapsa las columnas vacías en vez de reservarlas—, un mínimo de
   320, y un tope de 1180 centrado. El tope es lo que impide el efecto contrario:
   sin él, en un monitor ancho las tarjetas se estiran hasta deformar la foto. */
/* La tarjeta de CREAR: el mismo hueco que una de verdad, punteada y sin peso. Es la
   misma pieza que «Crear nuevo proyecto…» en el tablero, a propósito — si la misma
   acción se ve distinta en dos pantallas, se aprende dos veces. */
.cl-acciones{ display:flex; align-items:center; gap:10px; }
.cl-mako{ font-size:12.5px; color:var(--dim); }
.cl-auto{ background:none; border:0; font:inherit; font-size:12.5px; color:var(--dim); cursor:pointer;
  padding:7px 4px; }
.cl-auto:hover:not(:disabled){ color:var(--primary); }
.cl-auto:disabled{ color:var(--faint); cursor:default; }

.cl-nuevo{ background:var(--surface); border:1px solid var(--border-strong); border-radius:9px;
  padding:7px 13px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.cl-nuevo:hover{ border-color:var(--primary); color:var(--primary); }
`;
