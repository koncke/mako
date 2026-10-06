'use client';

// =============================================================================
// Clientes — quién es cliente, y qué trabajo tiene
// =============================================================================
// La ENTREGA de un servicio en etapas y, al abrir una tarjeta: sus proyectos, sus
// tareas y sus recurrentes. Eso es toda la pantalla.
//
// ⚠️ LA GRILLA DE TARJETAS NO EXISTE MÁS (05/10/2026). «No quiero que exista la vista
// de Tarjetas, es la vista de kanban por default y la otra es la vista de tabla. Solo
// que dentro del kanban, las tarjetas no son como las del CRM, son como las nuevas que
// hicimos, de clientes». La tarjeta de cliente NO se fue con la grilla: ahora es lo que
// se dibuja adentro de cada columna, así que la pieza es la misma y el lugar es otro.
//
// ⚠️ LO QUE NO ESTÁ, NO FALTA. Se fueron la señal de atención en tres niveles, el reloj
// del contrato, los cuatro números de cabecera y las cinco tabs: venían de calcar la tab
// que UN cliente tenía armada para su negocio. Antes de agregarle algo: si no es un
// cliente, un proyecto, una tarea o una recurrente, no va acá.

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Status, Toast, useToast } from '@/app/_ui';

import type { ClienteCruce } from './cruce';
import type { CuentasProp } from './CuentaDeMaKo';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { FichaCliente } from './FichaCliente';
import type { TrabajoDeCliente } from './trabajo';
import type { BoardUser } from '@/app/plan/board/types';
import { NuevoCliente } from './NuevoCliente';
import { BarraClientes, FILTRO_LABEL, CUANDO_LABEL, entraEnVentana, opcionesDeFase, faseVigente, columnasVisibles, type FiltroClientes, type OrdenClientes, type VistaClientes } from './BarraClientes';
import { KanbanEntrega, type Asignacion } from './KanbanEntrega';
import { EstilosTarjeta } from '@/app/_components/TarjetaEntidad';
import { EtapasEntregaModal } from './EtapasEntregaModal';
import { SelectorServicio } from './SelectorServicio';
import type { CarteraEnEntrega } from './entrega';
import { conteoDeEtapas, relojDeVuelta, repartirEnEtapas, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';
import { TablaClientes } from './TablaClientes';
import { LoteClientes } from './LoteClientes';
import { esDelProducto } from './pertenencia';
import { guardarImagenClienteAction, autoasignarAction, moverEntregaAction, sacarDeEntregaAction, guardarEtapasEntregaAction, crearServicioAction, moverEntregaLoteAction, renombrarServicioAction, eliminarServicioAction } from './actions';

/** Lo que se le cambió a un cliente sin recargar la página. */
type Imagen = { avatarUrl?: string | null; portada?: string | null; portadaY?: number | null; avatarY?: number | null; icono?: string | null };

/**
 * Los filtros de la barra SIN los de la cuenta de MaKo. «Con / Sin cuenta de MaKo» es parte
 * de invitar a MaKo, y desde el 05/10/2026 eso sólo existe en una AGENCIA («todo lo que
 * tenga que ver con invitar a MaKo, debería solo verse si la cuenta es AGENCIA»): en otro
 * workspace el filtro preguntaría por algo que la pantalla no ofrece en ningún lado.
 */
const FILTRO_SIN_CUENTAS = Object.fromEntries(
  Object.entries(FILTRO_LABEL).filter(([k]) => k !== 'con-cuenta' && k !== 'sin-cuenta'),
) as Partial<typeof FILTRO_LABEL>;

export function ClientesApp({ clientes, tablero, trabajo, user, error, cuentas, entrega, puedeEditarEtapas = false }: {
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
  /**
   * Las etapas de entrega de cada servicio y en que etapa esta cada cliente (mig 0188).
   *
   * ⚠️ `ok: false` NO ES «no entregas nada»: son dos pantallas. Con la lectura caida
   * el kanban no se ofrece y el banner dice por que — un tablero vacio sobre una
   * lectura que fallo afirma que no hay nadie en entrega.
   */
  entrega?: CarteraEnEntrega;
  /** Renombrar o borrar una columna le cambia el tablero a todo el equipo: lo decide
   *  un admin del workspace. Mover un cliente lo hace cualquiera con la tab. */
  puedeEditarEtapas?: boolean;
}) {
  /**
   * El alta, y EN QUÉ ETAPA se apretó.
   *
   * `''` = se abrió desde la tabla, que no tiene columnas: ahí el cliente nace y la
   * página recarga, como siempre. Un string vacío y no `null` para que el booleano de
   * «está abierto» no se confunda con «no hay etapa».
   */
  const [creando, setCreando] = useState<string | null>(null);
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
  /**
   * UNA vista y no un booleano por vista: ver el porqué en el tipo (./BarraClientes).
   *
   * `null` = nadie eligió todavía, y entonces manda el DEFAULT calculado más abajo. No
   * arranca en `'kanban'` a secas porque el kanban no siempre se puede dibujar, y una
   * pantalla que abre vacía no distingue «no configuraste» de «se rompió».
   */
  const [vistaElegida, setVista] = useState<VistaClientes | null>(null);
  const [filtro, setFiltro] = useState<FiltroClientes>('todos');
  const [cuando, setCuando] = useState('siempre');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [orden, setOrden] = useState<OrdenClientes>('nombre');
  const { toast, show, clear } = useToast();

  // ── La entrega de un servicio (el kanban) ────────────────────────────
  const servicios = entrega?.ok ? entrega.servicios : [];
  /**
   * ⚠️ SE CALCULA, NO SE DISPARA. El kanban es el default, pero sólo se puede dibujar
   * si la entrega se leyó Y el negocio tiene al menos un servicio activo. Un `useEffect`
   * que «corrigiera» la vista al montar dejaría a la persona viendo medio segundo una
   * pantalla que no es, y encima pisaría su elección en cuanto `entrega` cambie. Como
   * cálculo, el caso que todavía no existe lo hereda gratis.
   */
  const hayKanban = Boolean(entrega?.ok && servicios.length);
  const vistasDisponibles: VistaClientes[] = hayKanban ? ['kanban', 'tabla'] : ['tabla'];
  const vista: VistaClientes = vistaElegida && vistasDisponibles.includes(vistaElegida)
    ? vistaElegida
    : (vistasDisponibles[0] ?? 'tabla');
  /** De que servicio es el tablero. `null` = todavia no se eligio; cae al primero. */
  const [servicioId, setServicioId] = useState<number | null>(null);
  const servicio = servicios.find((s) => s.productoId === servicioId) ?? servicios[0] ?? null;
  /** Lo que de verdad se está dibujando. ⚠️ No es `vista === 'kanban'` a secas: lo
   *  escribiría dos veces y el día que una de las dos cambie, el renglón de «no
   *  encontré» aparece sobre un tablero o desaparece sobre una tabla. */
  const enKanban = vista === 'kanban' && Boolean(servicio);
  /**
   * QUÉ FASE DEL TABLERO SE ESTÁ MIRANDO. `null` = todas, `''` = las columnas sueltas.
   *
   * ⚠️ VIVE ACÁ Y NO EN EL KANBAN desde que dejó de ser una fila de chips arriba del riel
   * y pasó a ser una sección de «Filtrar» (05/10/2026): el control es de la BARRA, y la
   * barra y el tablero son hermanos. Lo pedido se guarda tal cual y lo que se DIBUJA sale
   * de `faseVigente`: cambiar a un servicio que no tiene esa fase no la borra, la ignora.
   *
   * ⚠️ Y SIGUE SIENDO UN FILTRO DEL RENDER: el kanban la usa para elegir columnas y nunca
   * se la pasa al reparto (ver `visibles` en KanbanEntrega).
   */
  const [fasePedida, setFasePedida] = useState<string | null>(null);
  const opcionesFase = servicio ? opcionesDeFase(servicio.etapas, servicio.fases) : [];
  const faseVista = faseVigente(fasePedida, opcionesFase);
  const [editandoEtapas, setEditandoEtapas] = useState(false);
  /**
   * LO QUE SE MOVIO ACA ADENTRO, encima de lo que trajo el server.
   *
   * ⚠️ NO ES UN CACHE: es el resultado que el server action YA devolvio, aplicado sin
   * esperar a que `revalidatePath` vuelva con las 78 KB del trabajo de la cartera.
   * Arrastrar una tarjeta y verla volver a su columna medio segundo se lee como que el
   * tablero no dejo moverla. Misma razon que `imgs`.
   *
   * `null` = se saco de la entrega. Es distinto de «no esta en el mapa», que significa
   * «no se toco en esta sesion»: sin esa diferencia, sacar a alguien lo dejaria en su
   * columna hasta el proximo F5.
   */
  const [movs, setMovs] = useState<Record<string, Asignacion | null>>({});
  const claveMov = (leadId: number, prodId: number) => `${prodId}:${leadId}`;
  /**
   * Los clientes ELEGIDOS para una acción en lote. Una sola selección para las DOS
   * vistas, a propósito: elegir cinco en la tabla y pasar al kanban no puede perderlos
   * —es la misma cartera mirada de otra forma—, y con una selección por vista la barra
   * de lote estaría actuando sobre algo que la pantalla ya no muestra.
   */
  const [sel, setSel] = useState<Set<number>>(() => new Set());

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

  /**
   * En que etapa esta cada cliente en ESTE servicio, con lo movido en esta sesion encima.
   *
   * Se calcula y no se guarda: es la regla de la casa aplicada a un overlay. Un estado
   * «la asignacion ya mergeada» tendria que re-sincronizarse cada vez que el server
   * revalida, y ese es el camino por el que una tarjeta vuelve sola a su columna vieja.
   */
  const asignacionDe = (prodId: number): Record<number, Asignacion> => {
    const out: Record<number, Asignacion> = {};
    const base = entrega?.ok ? (entrega.porServicio[prodId] ?? {}) : {};
    for (const [lead, f] of Object.entries(base)) {
      out[Number(lead)] = { etapa: f.etapa, etapa_desde: f.etapa_desde, por: f.por };
    }
    for (const [k, v] of Object.entries(movs)) {
      const corte = k.indexOf(':');
      if (Number(k.slice(0, corte)) !== prodId) continue;
      const lead = Number(k.slice(corte + 1));
      // `null` = se saco de la entrega. Borrar la clave y no ponerla en null serian
      // dos cosas distintas: la segunda es «no se toco» y dejaria la fila del server.
      if (v === null) delete out[lead]; else out[lead] = v;
    }
    return out;
  };

  /**
   * LOS CLIENTES DE ESTE PRODUCTO: su casa (el embudo del CRM) o una fila ahí.
   *
   * ⚠️ ANTES CADA TABLERO DIBUJABA A LA CARTERA ENTERA, y por eso «Prueba» mostraba a los
   * 14 clientes de Negocio que Escala en Bienvenida (06/10/2026, «en el producto de PRUEBA
   * debería estar vacío»). La regla vive en ./pertenencia.ts; acá se aplica UNA vez y de acá
   * salen los cuatro universos que cuelgan del producto: el kanban, la tabla, «N de M» y el
   * conteo del editor de etapas. Con uno filtrado y otro no, el editor avisaría que sacar
   * una columna se lleva clientes que el tablero no muestra.
   *
   * ⚠️ SOBRE LA ASIGNACIÓN CON LO MOVIDO ENCIMA, no sobre las filas del server: «Agregar a
   * este producto» desde la ficha lo mete al tablero en el acto, y su deshacer lo saca.
   */
  const casa = entrega?.ok ? entrega.casaPorLead : {};
  const asigServicio = servicio ? asignacionDe(servicio.productoId) : {};
  const delServicio = (cs: ClienteCruce[]): ClienteCruce[] => (servicio
    ? cs.filter((c) => esDelProducto(c.leadId, servicio.productoId, casa, asigServicio))
    : cs);
  const visiblesServ = delServicio(visibles);
  const listaServ = delServicio(lista);

  /**
   * LOS QUE ESTÁN EN PANTALLA: `visiblesServ` menos los que la fase elegida esconde.
   *
   * ⚠️ HACE FALTA DESDE QUE LA FASE ES UN FILTRO DE «Filtrar». Mientras fue una fila de
   * chips adentro del tablero, la pantalla no sabía que había columnas escondidas, y
   * «Seleccionar todos» de la barra de lote elegía también a los clientes de las fases que
   * no se veían — y «Mover a…» los movía. Es la regla que la barra de lote ya tenía
   * escrita («el lote actúa sobre los elegidos que se ven»), y la fase era la puerta por la
   * que se colaba lo que no se ve. Con la fase en el filtro, el contador «N de M» y el
   * exportar también tienen que contar lo mismo que se dibuja.
   *
   * ⚠️ Y SE CUENTA CON LAS MISMAS DOS FUNCIONES QUE DIBUJAN: `repartirEnEtapas` (un
   * cliente sin fila está en la primera) y `columnasVisibles` (qué es «de la fase»). Con
   * una cuenta propia, el contador diría un número y el riel mostraría otro.
   *
   * Sin fase elegida —o fuera del kanban, donde la tabla no filtra columnas— es `visibles`
   * tal cual.
   */
  const enPantalla = ((): ClienteCruce[] => {
    if (!enKanban || !servicio || faseVista === null) return visiblesServ;
    const { porEtapa } = repartirEnEtapas(servicio.etapas, visiblesServ, (c) => asigServicio[c.leadId]?.etapa);
    const ids = new Set<number>();
    for (const e of columnasVisibles(servicio.etapas, servicio.fases, faseVista)) {
      for (const c of porEtapa[e.key] ?? []) ids.add(c.leadId);
    }
    return visiblesServ.filter((c) => ids.has(c.leadId));
  })();
  /** Los elegidos que la pantalla está mostrando, en el orden en que se ven. */
  const elegidosVisibles = enPantalla.filter((c) => sel.has(c.leadId)).map((c) => c.leadId);

  /**
   * Mueve un cliente de etapa en la entrega de un servicio.
   *
   * ⚠️ EL DESHACER VUELVE A LLAMAR AL SERVER con la etapa anterior. Revertir solo la
   * pantalla miente hasta el proximo F5 — y la etapa anterior viaja desde ACA porque el
   * choke point ya no la tiene despues de escribir.
   *
   * ⚠️ Y EL DESHACER NO OFRECE SU PROPIO DESHACER (`conDeshacer = false`): dos carteles
   * encadenados dejan a la persona apretando el de un paso intermedio.
   *
   * ⚠️ Y DEVUELVE EL RELOJ, no sólo la etapa (`relojPrevio`, que manda sólo el deshacer).
   * Sin él el server escribía `etapa_desde = ahora` y un cliente trabado hace tres semanas
   * volvía como recién llegado — mientras la pantalla mostraba la fecha vieja hasta el F5.
   */
  function moverEntrega(leadId: number, etapa: string, prodId: number, conDeshacer = true, relojPrevio?: string | null) {
    const previa = asignacionDe(prodId)[leadId] ?? null;
    // ⚠️ ACA NO VA UNA GUARDA DE IDEMPOTENCIA, y costo verlo en el navegador: un
    // `if (previa?.etapa === etapa) return` parece gratis y ROMPE EL DESHACER. El
    // callback del toast se queda con la version de esta funcion del render que lo
    // creo, o sea con el `movs` de ANTES del movimiento: desde ahi, «volver a
    // onboarding» se ve como «ya esta en onboarding» y la llamada nunca sale. El
    // cartel se cierra, la tarjeta no se mueve, y eso se lee como un deshacer roto.
    // Quien corta el viaje de un drop sobre su propia columna es el kanban, que mira
    // la prop del render en curso; y el choke point es idempotente de todas formas.
    setMal('');
    empezar(async () => {
      const r = await moverEntregaAction(leadId, prodId, etapa, relojPrevio);
      if (!r.ok) { setMal(r.error); return; }
      // Un movimiento que no movio nada no se anuncia ni se pinta.
      if (!r.cambio) return;
      // La misma regla que el server (`relojDeVuelta`): si no, la pantalla y la base dicen dos fechas.
      setMovs((v) => ({ ...v, [claveMov(leadId, prodId)]: { etapa: r.hacia, etapa_desde: relojDeVuelta(relojPrevio) ?? new Date().toISOString(), por: 'CRM' } }));
      if (!conDeshacer) return;
      // El toast dice QUE paso, en tres palabras. El porque de la etapa vive en el
      // catalogo, no en un cartel de cinco segundos.
      show(`En ${r.rotulo}`, () => {
        clear();
        if (previa) moverEntrega(leadId, previa.etapa, prodId, false, previa.etapa_desde);
        else sacarEntrega(leadId, prodId, false);
      });
    });
  }

  /**
   * Mueve VARIOS clientes: la barra de acciones en lote y el arrastre de una selección.
   *
   * `destino` es una etapa fija («Mover a…») o una función que la calcula POR CLIENTE
   * («Siguiente etapa», donde cada uno avanza desde la suya).
   *
   * ⚠️ UN SOLO DESHACER PARA TODO EL LOTE, y es la regla de la casa: N toasts dejan a la
   * persona apretando el de un paso intermedio. El deshacer repone exactamente a los que
   * SE MOVIERON —un lote puede salir a medias—, cada uno a la etapa que tenía, y al que
   * no tenía fila se la borra (`null`): escribirle la primera etapa le inventaría una
   * fila con un reloj que arranca hoy. Y vuelve a llamar al server: revertir sólo la
   * pantalla mentiría hasta el próximo F5.
   */
  function moverLote(leadIds: number[], destino: string | ((leadId: number) => string | null), prodId: number, conDeshacer = true) {
    const asig = asignacionDe(prodId);
    const movs: Array<{ leadId: number; etapa: string | null }> = [];
    const previas = new Map<number, Asignacion | null>();
    for (const leadId of leadIds) {
      const etapa = typeof destino === 'function' ? destino(leadId) : destino;
      if (!etapa) continue;
      previas.set(leadId, asig[leadId] ?? null);
      movs.push({ leadId, etapa });
    }
    if (!movs.length) return;
    setMal('');
    empezar(async () => {
      const r = await moverEntregaLoteAction(prodId, movs);
      if (!r.ok) { setMal(r.error); return; }
      const movidos = r.resultados.filter((x) => x.ok && x.cambio);
      const fallaron = r.resultados.filter((x) => !x.ok);
      if (fallaron.length) setMal(`${fallaron.length} no se ${fallaron.length === 1 ? 'pudo' : 'pudieron'} mover: ${fallaron[0].error ?? ''}`);
      if (!movidos.length) return;
      // Como el Plan: una acción en lote que salió limpia la selección. Dejarla puesta
      // invita a apretar «Siguiente etapa» dos veces sobre el mismo grupo sin querer.
      if (conDeshacer) setSel(new Set());
      const ahora = new Date().toISOString();
      setMovs((v) => {
        const n = { ...v };
        for (const x of movidos) n[claveMov(x.leadId, prodId)] = x.hacia ? { etapa: x.hacia, etapa_desde: ahora, por: 'CRM' } : null;
        return n;
      });
      if (!conDeshacer) return;
      const etapas = servicios.find((s) => s.productoId === prodId)?.etapas ?? [];
      const unaEtapa = new Set(movidos.map((x) => x.hacia)).size === 1 ? etapas.find((e) => e.key === movidos[0].hacia)?.label : null;
      show(unaEtapa ? `${movidos.length} en ${unaEtapa}` : `${movidos.length} movidos`, () => {
        clear();
        // Con su RELOJ: volver a la etapa de antes no es llegar hoy (ver `relojDeVuelta`).
        const volver = movidos.map((x) => {
          const p = previas.get(x.leadId) ?? null;
          return { leadId: x.leadId, etapa: p?.etapa ?? null, relojPrevio: p?.etapa_desde ?? null };
        });
        empezar(async () => {
          const d = await moverEntregaLoteAction(prodId, volver);
          if (!d.ok) { setMal(d.error); return; }
          setMovs((v) => {
            const n = { ...v };
            for (const x of d.resultados) {
              if (!x.ok) continue;
              const p = previas.get(x.leadId) ?? null;
              n[claveMov(x.leadId, prodId)] = p;
            }
            return n;
          });
        });
      });
    });
  }

  /** La etapa que sigue a la actual de un cliente. Sin fila está en la PRIMERA (regla
   *  derivada, `repartirEnEtapas`); en la última no hay siguiente y no se mueve. */
  function siguienteDe(leadId: number, prodId: number): string | null {
    const etapas = servicios.find((s) => s.productoId === prodId)?.etapas ?? [];
    if (!etapas.length) return null;
    const actual = asignacionDe(prodId)[leadId]?.etapa;
    const i = Math.max(0, etapas.findIndex((e) => e.key === actual));
    return etapas[i + 1]?.key ?? null;
  }

  /**
   * Borra la fila de un cliente en esta entrega.
   *
   * ⚠️ YA NO ES «sacarlo del tablero»: desde que un cliente SIN FILA se dibuja en la
   * primera columna, no existe el estado «afuera». Lo que esto hace es volver al estado
   * derivado, y por eso su ÚNICO llamador es el DESHACER del primer movimiento: si alguien
   * mueve a un cliente que nunca se había movido, lo contrario de eso no es moverlo a la
   * primera —sería escribirle una fila que antes no tenía, con un reloj de etapa que
   * arranca hoy— sino borrar la que acaba de nacer.
   */
  function sacarEntrega(leadId: number, prodId: number, conDeshacer = true) {
    setMal('');
    empezar(async () => {
      const r = await sacarDeEntregaAction(leadId, prodId);
      if (!r.ok) { setMal(r.error); return; }
      setMovs((v) => ({ ...v, [claveMov(leadId, prodId)]: null }));
      // Sin etapa anterior no hay nada que reponer, y ofrecer un «Deshacer» que no
      // deshace nada es peor que no ofrecerlo.
      const volverA = r.etapa;
      if (!conDeshacer || !volverA) return;
      show('Fuera de la entrega', () => { clear(); moverEntrega(leadId, volverA, prodId, false); });
    });
  }

  /**
   * Las etapas del servicio elegido, como las dejo el editor.
   *
   * ⚠️ LAS FASES VIAJAN EN LA MISMA LLAMADA. El server reemplaza el `data` entero, asi
   * que guardar las etapas sin mandar las fases las BORRA — y lo que se borraria es el
   * color de cada columna, en el proximo guardado de cualquier otra cosa.
   */
  async function guardarEtapas(etapas: EtapaEntrega[], fases: FaseEntrega[]): Promise<string | null> {
    if (!servicio) return 'No hay ningun servicio elegido.';
    const r = await guardarEtapasEntregaAction(servicio.productoId, etapas, fases);
    return r.ok ? null : r.error;
  }

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
    /* ⚠️ `--cartera-max: none` ES LO QUE DESCENTRA LA PANTALLA ENTERA. «Toda la
       topbar va al mismo ancho que el kanban, no se queda agrupado en el medio»
       (Martín, 05/10/2026). El tope de 1180 lo declara `CSS_TARJETA` en `:root` y lo
       miran la barra, la tabla y la grilla; redefinirlo ACÁ es el camino que el
       propio archivo deja escrito, y lo mueve en las TRES a la vez — que es lo que
       hay que cuidar: si una queda en 1180 y las otras no, la pantalla se ve torcida
       y eso no se nota en el diff. /admin sigue con su 1180, porque es otra pantalla. */
    <Pagina ancho="completo" style={{ '--cartera-max': 'none' } as CSSProperties}>
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
      {/* ⚠️ «NO PUDE LEER» NO ES «NO ENTREGAS NADA». Sin este renglon, una lectura
          caida esconde el boton del kanban sin decir por que, y eso se lee como que la
          vista desaparecio. */}
      {!error && entrega && !entrega.ok && <Banner tono="bad">No pude leer la entrega de tus servicios. {entrega.error}</Banner>}
      {mal && <Banner tono="bad">{mal}</Banner>}

      {error ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={error} detalleTecnico={error} />
      ) : lista.length === 0 ? (
        // EL VACÍO ES EL CASO PRINCIPAL: un workspace que recién empieza no ganó a nadie
        // todavía. Y ahora tiene DOS salidas, porque no todo cliente pasó por el CRM.
        <EmptyState
          titulo="Todavía no tienes clientes"
          detalle="Cárgalo aquí, o marca la venta de un lead como ganada en el CRM."
          accion={{ label: 'Cargar un cliente', onClick: () => setCreando('') }}
        />
      ) : (
        <>
          <BarraClientes
            q={q} onQ={setQ} vista={vista} onVista={setVista}
            filtros={cuentas?.visible ? FILTRO_LABEL : FILTRO_SIN_CUENTAS}
            /* ⚠️ LAS VISTAS QUE ESTA PANTALLA PUEDE DIBUJAR, en positivo. Sin servicios
               —o con la lectura de la entrega caída— el kanban no se ofrece: un botón que
               abre una pantalla vacía se lee como que la app está rota. Con una sola
               vista el toggle entero no se dibuja, porque un botón que no se puede
               apagar es un control trabado. */
            vistas={vistasDisponibles}
            /* El selector va al final de la barra y EN LAS DOS VISTAS. «En la vista de tabla
               siempre debería estar el desplegable de los productos, porque desaparece»
               (Martín, 05/10/2026): la tabla también se agrupa por las etapas de UN servicio
               y se arrastra entre ellas, así que también depende de cuál se está mirando.
               Antes vivía sólo en el kanban, con el porqué de que la tabla contestaba
               «quiénes son mis clientes» — dejó de ser cierto el día que la tabla tuvo etapas. */
            extremo={servicios.length > 0 ? (
              <SelectorServicio
                servicios={servicios.map((sv) => ({ id: sv.productoId, nombre: sv.nombre }))}
                servicio={servicio?.productoId ?? null}
                onServicio={setServicioId}
                puedeEditar={puedeEditarEtapas}
                /* El lapiz abre las etapas de ESE servicio, que no tiene por que ser el
                   que se esta mirando: por eso primero se cambia de servicio y despues se
                   abre, en vez de editar a ciegas el de otra columna. */
                onEditarEtapas={(id) => { setServicioId(id); setEditandoEtapas(true); }}
                onNuevo={async (nombre) => {
                  const r = await crearServicioAction(nombre);
                  if (!r.ok) return r.error;
                  // Se queda mirando el que acaba de crear: crear algo y no verlo se lee
                  // como que no pasó nada. El `revalidatePath` trae su tablero.
                  setServicioId(r.productoId);
                  return null;
                }}
              />
            ) : undefined}
            filtro={filtro} onFiltro={(v) => setFiltro(v as FiltroClientes)} orden={orden} onOrden={(v) => setOrden(v as OrdenClientes)}
            cuandos={CUANDO_LABEL} cuando={cuando} onCuando={setCuando} dir={dir} onDir={setDir}
            /* La FASE, como una sección más de «Filtrar» y sólo en el kanban: la tabla no
               esconde columnas, así que ahí la opción no cambiaría nada de lo que se ve. Sin
               fases (o con una sola), `opcionesDeFase` devuelve vacío y la sección no está. */
            fases={enKanban ? opcionesFase : undefined} fase={faseVista} onFase={setFasePedida}
            /* ⚠️ `enPantalla` Y NO `visibles`: con una fase elegida, «N de M» tiene que
               contar lo que el riel dibuja. */
            nVisibles={enPantalla.length} nTotal={listaServ.length}
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
            onExportar={() => exportarCSV(enPantalla, numeroDe, resumenDe)}
            onImportar={() => { window.location.href = '/crm?importar=1'; }} />

          {/* ⚠️ SIN SERVICIOS NO HAY TABLERO POSIBLE, Y SE DICE ANTES DE LA VISTA.
              El kanban ni se ofrece en ese caso, así que sin este renglón la persona ve
              una tabla y no se entera de que la vista de etapas existe ni de qué le
              falta para tenerla — que es la única acción que hay acá. */}
          {!hayKanban && entrega?.ok && (
            <p className="cl-nada">
              Para ver la entrega en etapas, carga tus servicios en el catálogo de productos.
            </p>
          )}

          {/* LA BARRA DE ACCIONES EN LOTE: una para las DOS vistas, porque la selección es
              una sola (ver `sel`). «Muy importante que implementes las acciones en LOTE,
              tanto para la vista de tablas como kanban» (Martín, 05/10/2026). Mover y
              avanzar sólo existen con un servicio elegido: sin etapas no hay a dónde. */}
          {/* ⚠️ EL LOTE ACTÚA SOBRE LOS ELEGIDOS QUE SE VEN, como la barra del Plan. Con
              un buscador puesto, `sel` puede tener clientes que la pantalla esconde, y
              moverlos sería actuar sobre algo que nadie está mirando. */}
          {elegidosVisibles.length > 0 && (
            <LoteClientes
              elegidos={elegidosVisibles.length}
              visibles={enPantalla.length}
              etapas={servicio ? servicio.etapas : null}
              fases={servicio ? servicio.fases : []}
              puedeAvanzar={Boolean(servicio && elegidosVisibles.some((id) => siguienteDe(id, servicio.productoId)))}
              onMover={(etapa) => { if (servicio) moverLote(elegidosVisibles, etapa, servicio.productoId); }}
              onSiguiente={() => { if (servicio) moverLote(elegidosVisibles, (id) => siguienteDe(id, servicio.productoId), servicio.productoId); }}
              onExportar={() => exportarCSV(enPantalla.filter((c) => sel.has(c.leadId)), numeroDe, resumenDe)}
              onTodos={() => setSel(new Set(enPantalla.map((c) => c.leadId)))}
              onLimpiar={() => setSel(new Set())}
            />
          )}

          {enKanban && servicio ? (
            <KanbanEntrega
              etapas={servicio.etapas}
              fases={servicio.fases}
              /* Ya VIGENTE: una fase que este servicio no tiene llega como `null` (todas). */
              fase={faseVista}
              origen={servicio.origen}
              servicio={servicio.nombre}
              clientes={visiblesServ}
              asignacion={asigServicio}
              numeroDe={numeroDe}
              trabajoDe={resumenDe}
              tableroOk={tablero.ok}
              cuentas={cuentas}
              onMover={(leadId, etapa) => moverEntrega(leadId, etapa, servicio.productoId)}
              onAbrir={(leadId) => { setAbrirEn(null); setAbiertoId(leadId); }}
              onEquipo={(leadId) => { setAbrirEn('equipo'); setAbiertoId(leadId); }}
              onNuevoCliente={(etapa) => setCreando(etapa)}
              onError={setMal}
              seleccion={sel}
              onSeleccion={setSel}
              onMoverLote={(leadIds, etapa) => moverLote(leadIds, etapa, servicio.productoId)}
            />
          ) : (
            <TablaClientes filas={visiblesServ} numeroDe={numeroDe} resumenDe={resumenDe}
              tableroOk={tablero.ok}
              /* Con un servicio elegido la tabla se agrupa por SUS etapas y se arrastra
                 entre ellas; sin servicio queda plana, como antes. */
              etapas={servicio ? servicio.etapas : null}
              fases={servicio ? servicio.fases : []}
              asignacion={asigServicio}
              onMover={(leadId, etapa) => { if (servicio) moverEntrega(leadId, etapa, servicio.productoId); }}
              onMoverLote={(leadIds, etapa) => { if (servicio) moverLote(leadIds, etapa, servicio.productoId); }}
              seleccion={sel}
              onSeleccion={setSel}
              onAbrir={setAbiertoId} onNuevo={() => setCreando('')} />
          )}
          {/* ⚠️ «NO ENCONTRÉ» NO ES «NO TENÉS». Sin este renglón, buscar algo que no
              existe deja una tabla vacía, y una tabla vacía se lee como que se borró la
              cartera. En el kanban no va: ahí lo dice cada columna, y un renglón más
              debajo de cinco «Sin clientes» es repetir lo mismo seis veces. */}
          {/* Un producto sin clientes no es una búsqueda sin resultados: son dos frases. */}
          {visiblesServ.length === 0 && !enKanban && (
            <p className="cl-nada">{listaServ.length === 0 ? 'Este producto todavía no tiene clientes.' : 'Ningún cliente coincide con lo que buscaste.'}</p>
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
          entrega={entrega?.ok ? {
            servicios, asignacionDe, casa,
            inicial: servicio?.productoId ?? null,
            onMover: (etapa, prodId) => moverEntrega(abierto.leadId, etapa, prodId),
          } : undefined}
          tabInicial={abrirEn}
          onImagen={(cambio) => guardarImagen(abierto.leadId, cambio)}
          onCerrar={() => { setAbiertoId(null); setAbrirEn(null); }}
        />
      )}

      {creando !== null && (
        <NuevoCliente
          onCerrar={() => setCreando(null)}
          /* Desde una COLUMNA el cliente nace y se mueve a esa etapa en el acto; desde
             la tabla no hay etapa que elegir, así que se deja el camino de siempre
             (el modal recarga) en vez de inventar una. */
          /* ⚠️ Y DESDE LA TABLA DE UN PRODUCTO QUE NO ES EL PRINCIPAL, nace en su primera
             etapa. Un cliente nuevo nace en el embudo principal, así que su casa es el
             producto principal (ver ./pertenencia.ts): creado mirando otro, desaparecería
             de la pantalla en la que se lo acaba de crear. */
          onCreado={servicio && (creando || (!servicio.principal && servicio.etapas[0]))
            ? (leadId) => moverEntrega(leadId, creando || servicio.etapas[0].key, servicio.productoId)
            : undefined}
        />
      )}

      {editandoEtapas && servicio && (
        <EtapasEntregaModal
          servicio={servicio.nombre}
          etapas={servicio.etapas}
          fases={servicio.fases}
          /* El conteo por etapa sale del MISMO overlay que dibuja el tablero: con dos
             fuentes, el editor diria «3 en Hito 1» sobre una columna que ya muestra 2.

             ⚠️ Y SE CUENTA UNA ENTRADA POR CLIENTE, NO UNA POR FILA. Lo de antes era
             `Object.values(asignacion)`, o sea las filas de `cliente_entrega` — y «un
             cliente sin fila esta en la PRIMERA etapa» es una regla DERIVADA, asi que a
             quien no tiene fila no hay de donde derivarselo si ni aparece en la lista.
             Medido en el navegador el 05/10/2026 con 8 clientes y 3 filas: el tablero
             dibujaba 5 tarjetas en Diagnostico y el editor decia 0. No es cosmetico — ese
             numero es lo que hace que sacar una columna sea una decision, asi que con el
             0 puesto el Confirm no se dispara y la columna se va con cinco clientes
             adentro, en silencio. La funcion estaba bien; lo que se le pasaba, no.

             ⚠️ Y SOBRE LOS CLIENTES DEL PRODUCTO (`listaServ`), NO SOBRE `visibles`: con
             un filtro o una busqueda puesta, lo que el editor avisa al sacar una columna
             dejaria de contar a los que el buscador escondio. Y no sobre la cartera
             entera: un cliente de otro producto no esta en ninguna columna de este. */
          conteo={conteoDeEtapas(servicio.etapas,
            listaServ.map((c) => asigServicio[c.leadId]?.etapa))}
          /* ⚠️ `undefined` y `null` NO son lo mismo acá: sin la lectura (el server no
             la trajo) y con la lectura caída, el editor tiene que decir las dos veces
             que no pudo revisar — nunca «ninguna». Por eso el `??` cae a `null`. */
          secuencias={entrega?.ok ? (entrega.secuenciasPorServicio[servicio.productoId] ?? null) : null}
          onGuardar={guardarEtapas}
          /* «Debería poder cambiar el nombre del producto, y se debe cambiar en todos
             lados, en el CRM y aquí» (05/10/2026). El server escribe el MISMO campo que
             lee el CRM; el `revalidatePath` trae el nombre nuevo al selector. */
          onRenombrar={async (nombre) => {
            const r = await renombrarServicioAction(servicio.productoId, nombre);
            return r.ok ? null : r.error;
          }}
          /* El producto del embudo principal no se elimina (el server lo frena): sin
             botón, como en el CRM. Un botón cuya única respuesta es «no se puede» se
             lee como que la app está rota. */
          onEliminar={servicio.principal ? undefined : async () => {
            const r = await eliminarServicioAction(servicio.productoId);
            if (!r.ok) return r.error;
            // Se cierra y se vuelve al primero: quedarse mirando un producto que ya no
            // está en el selector se lee como que no se borró.
            setEditandoEtapas(false);
            setServicioId(null);
            return null;
          }}
          onCerrar={() => setEditandoEtapas(false)}
        />
      )}

      <Toast state={toast} onClose={clear} />

      {/* ⚠️ LA HOJA DE LA TARJETA SE MONTA EN LA PANTALLA, no en el kanban. Hasta hoy
          la traía `GrillaTarjetas`; al irse la grilla quedó montada en el tablero, y
          con eso la vista de TABLA perdía `.cl-nada` —el renglón de «ningún cliente
          coincide»— que vive en la misma hoja. Acá cubre a las dos vistas. */}
      <EstilosTarjeta />
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
  // Los mismos rótulos que la tarjeta y la tabla: un CSV que nombra distinto las
  // mismas columnas obliga a cruzarlo a mano con la pantalla de la que salió.
  const cab = ['Cliente', 'Nombre', 'Empresa', 'Proyectos', 'Tareas', 'Recurrentes'];
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
/* ⛔ ACA vivian las reglas de la grilla de tarjetas y el porque de su tope de 1180
   centrado. La grilla se fue el 05/10/2026 y el tope tambien: esta pantalla ahora
   ocupa el ancho entero (ver --cartera-max arriba). */
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
