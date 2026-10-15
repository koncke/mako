'use client';

// =============================================================================
// Clientes — quién es cliente, y qué trabajo tiene
// =============================================================================
// La ENTREGA de un servicio en etapas y, al abrir una tarjeta: sus proyectos, sus
// tareas y sus recurrentes. Eso es toda la pantalla.
//
// Desde el 07/10/2026 (items 4 y 9 del curso tipo Skool) también el CURSO de la cartera: la vista
// «Avance» (Kanban · Tabla · Avance, la tabla que vivía en la tab Curso) y, en el menú de cada
// tarjeta, «Invitar al curso» y «Permisos del curso». Los datos los arma page.tsx (`curso`).
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
import { BarraClientes, FILTRO_LABEL, CUANDO_LABEL, ORDEN_LABEL, entraEnVentana, opcionesDeFase, faseVigente, clientesEnPantalla, type FiltroClientes, type OrdenClientes, type VistaClientes } from './BarraClientes';
import { KanbanEntrega, type Asignacion } from './KanbanEntrega';
import { EstilosTarjeta } from '@/app/_components/TarjetaEntidad';
import { EtapasEntregaModal } from './EtapasEntregaModal';
import { SelectorServicio } from './SelectorServicio';
import type { CarteraEnEntrega } from './entrega';
import { conteoDeEtapas, relojDeVuelta, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';
import { TablaClientes } from './TablaClientes';
import { LoteClientes } from './LoteClientes';
import { esDelProducto } from './pertenencia';
import { ordenarManual, columnaConInsercion, mismaLista } from './orden-manual';
import { guardarImagenClienteAction, autoasignarAction, moverEntregaAction, sacarDeEntregaAction, guardarEtapasEntregaAction, crearServicioAction, moverEntregaLoteAction, renombrarServicioAction, eliminarServicioAction, quitarDeProductoAction, volverAProductoAction, ordenarEtapaAction, anotarFichaAbiertaAction } from './actions';
import { atajar } from './sin-red';
import { filasCSV, textoCSV } from './exportar';
import { hrefConFicha } from './url-ficha';
import { ChecklistClientes } from './ChecklistClientes';
import { listaVisible, type OnboardingClientes } from './onboarding-clientes';
import { AvanceCurso, type FilaConAcceso } from './curso/AvanceCurso';
import type { EtapaVista } from './curso/FilaAvance';
import type { CursoDeTarjeta } from './ClienteCard';
import { accesoDeFila, type AccesoInvitacion } from './curso-ficha-lectura';
import { accesoEnProducto } from '@/lib/curso-invitar-reglas';

/**
 * Lo que la cartera necesita del CURSO (07/10/2026, items 4 y 9). Lo arma page.tsx
 * (`cursoDeLaCartera`) y viene con el HTML.
 *
 * ⚠️ TRES DATOS Y CADA UNO CON SU «NO PUDE LEER»: `conCurso` vacío = no se sabe qué producto tiene
 * clases (la tarjeta no ofrece nada del curso); `accesos: null` = no se leyeron (la tarjeta no ofrece
 * invitar, la columna dice «—»); `avance.ok: false` = la vista lo dice en vez de una tabla vacía.
 */
export type CursoClientes = {
  /** productoId → ¿tiene clases? Sin entrada = no se sabe (se trata como «no»). */
  conCurso: Record<number, boolean>;
  /** leadId → su acceso, CON su invitación. `null` = no se pudo leer. */
  accesos: Record<number, FilaConAcceso['acceso']> | null;
  avance:
    | { ok: true; porProducto: Record<number, { etapas: EtapaVista[]; filas: FilaConAcceso[] }> }
    | { ok: false; error: string };
};

/** Un acceso como lo pinta la celda, de vuelta a la forma de la fila (para pisar la del server). */
const filaDeAcceso = (a: AccesoInvitacion): NonNullable<FilaConAcceso['acceso']> => ({
  estado: a.revocado ? 'cortado' : a.existe ? 'activo' : 'sin-link',
  ingresos: a.ingresos,
  ultimoIngresoAt: a.ultimoIngresoAt,
  email: a.email ?? null,
  invitacionEnviadaAt: a.invitacionEnviadaAt ?? null,
  // Qué cursos abre, si se leyó: sin esto la tabla de OTRO producto lo daría por invitado ahí también.
  ...(a.productos !== undefined ? { productos: a.productos } : {}),
});

/** Lo que se le cambió a un cliente sin recargar la página. */
type Imagen = { avatarUrl?: string | null; portada?: string | null; portadaY?: number | null; avatarY?: number | null; icono?: string | null };

/**
 * «Ordenar» de ESTA pantalla: los criterios de la barra más «Manual» (mig 0196). Va acá y no en
 * `ORDEN_LABEL` porque la barra también la monta /admin, que no tiene kanban ni nada que
 * arrastrar: ofrecerle «Manual» sería un criterio que no ordena nada.
 */
type OrdenCS = OrdenClientes | 'manual';
const ORDEN_CS: Record<OrdenCS, string> = { ...ORDEN_LABEL, manual: 'Manual' };

/**
 * Los filtros de la barra SIN los de la cuenta de MaKo. «Con / Sin cuenta de MaKo» es parte
 * de invitar a MaKo, y desde el 05/10/2026 eso sólo existe en una AGENCIA («todo lo que
 * tenga que ver con invitar a MaKo, debería solo verse si la cuenta es AGENCIA»): en otro
 * workspace el filtro preguntaría por algo que la pantalla no ofrece en ningún lado.
 */
const FILTRO_SIN_CUENTAS = Object.fromEntries(
  Object.entries(FILTRO_LABEL).filter(([k]) => k !== 'con-cuenta' && k !== 'sin-cuenta'),
) as Partial<typeof FILTRO_LABEL>;

export function ClientesApp({ clientes, tablero, trabajo, user, error, cuentas, entrega, puedeEditarEtapas = false, onboarding = null, curso, vistaInicial = null, productoInicial = null, clienteInicial = null }: {
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
  /**
   * La ficha que llega ABIERTA: el `?cliente=<leadId>` de la URL, leído en el SERVER
   * (page.tsx). Viene con el HTML y no se corrige después de hidratar, por lo mismo que
   * `?vista=` en el Plan: abrirla en un efecto sería un parpadeo de la cartera en cada F5.
   * Un id que no es de un cliente de esta cartera no abre nada (`abierto` se busca en
   * `lista`) y el efecto de la URL lo limpia.
   */
  clienteInicial?: number | null;
  /**
   * El onboarding de la tab (#109), como lo dejó anotado la página con lo que dicen los datos
   * (./onboarding-clientes-sync.ts). `null` = no se pudo leer, y entonces no hay lista: pedirle al
   * ws1 su catálogo y su cartera sobre una lectura caída sería taparle lo que ya tiene.
   */
  onboarding?: OnboardingClientes | null;
  /**
   * El curso de la cartera: la vista «Avance» (item 4, se mudó de la tab Curso) y el menú de cada
   * tarjeta («Invitar al curso», «Permisos del curso», item 9). Ausente = no hay cartera o la entrega
   * no se leyó: ni la vista ni el menú se ofrecen.
   */
  curso?: CursoClientes;
  /**
   * Con qué vista y qué servicio abre: `?vista=avance&producto=<id>`, leídos en el server (page.tsx).
   * Es a donde caen los links viejos de la vista Avance de la tab Curso. Son un PEDIDO: si la vista
   * no se ofrece o el producto no es un servicio, manda el default de siempre (`vista`, `servicio`).
   */
  vistaInicial?: VistaClientes | null;
  productoInicial?: number | null;
}) {
  /**
   * El alta, y EN QUÉ ETAPA se apretó.
   *
   * `''` = se abrió desde la tabla, que no tiene columnas: ahí el cliente nace y la
   * página recarga, como siempre. Un string vacío y no `null` para que el booleano de
   * «está abierto» no se confunda con «no hay etapa».
   */
  const [creando, setCreando] = useState<string | null>(null);
  /**
   * QUÉ FICHA ESTÁ ABIERTA, y viaja en la URL (`?cliente=`, ver el efecto de abajo).
   *
   * ⚠️ ES UN `useState` SEMBRADO DE UNA PROP, y está bien que lo sea: la pantalla no se
   * remonta con un `router.refresh()`, así que la prop nueva que trae el server después de
   * guardar algo NO reabre ni cierra nada — manda lo que la persona hizo en esta sesión.
   */
  const [abiertoId, setAbiertoId] = useState<number | null>(clienteInicial);
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
  const [vistaElegida, setVista] = useState<VistaClientes | null>(vistaInicial);
  const [filtro, setFiltro] = useState<FiltroClientes>('todos');
  const [cuando, setCuando] = useState('siempre');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  /**
   * El criterio de «Ordenar». Además de los de la barra, `'manual'`: el orden que se arma
   * arrastrando (mig 0196). «Se guarda + "Manual"» (Martín, 06/10/2026).
   *
   * ⚠️ ARRANCA EN «MANUAL» SI ALGUIEN YA ORDENÓ ALGO. El criterio vive en el estado y no en la
   * URL; arrancando siempre en «Nombre», el orden que se armó arrastrando desaparecería en cada
   * F5 — se leería como que no se guardó, que es justo lo que se eligió que haga.
   */
  const [orden, setOrden] = useState<OrdenCS>(() =>
    entrega?.ok && Object.values(entrega.ordenPorServicio).some((p) => Object.values(p).some((l) => l.length)) ? 'manual' : 'nombre');
  /**
   * Con «Manual», el criterio que ordena a los que la lista manual todavía no nombra (los que
   * nadie arrastró). Es el que estaba elegido al pasar a «Manual»: así las columnas que nadie
   * tocó no saltan de orden al soltar una tarjeta en otra.
   */
  const [ordenPrevio, setOrdenPrevio] = useState<OrdenClientes>('nombre');
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
  /**
   * La vista «Avance» (item 4, 07/10/2026) se ofrece con servicios Y con algún producto con curso.
   * ⚠️ CON EL AVANCE CAÍDO SE OFRECE IGUAL: adentro dice «no pude leer»; esconder el botón haría
   * desaparecer la vista sin decir por qué. Sin ningún producto con clases, no: sería un botón que
   * abre siempre la misma pantalla vacía.
   */
  const hayAvance = hayKanban && curso != null && (!curso.avance.ok || Object.values(curso.conCurso).some(Boolean));
  const vistasDisponibles: VistaClientes[] = hayKanban ? ['kanban', 'tabla', ...(hayAvance ? ['avance' as const] : [])] : ['tabla'];
  const vista: VistaClientes = vistaElegida && vistasDisponibles.includes(vistaElegida)
    ? vistaElegida
    : (vistasDisponibles[0] ?? 'tabla');
  /** De que servicio es el tablero. `null` = todavia no se eligio; cae al primero. */
  const [servicioId, setServicioId] = useState<number | null>(productoInicial);
  const servicio = servicios.find((s) => s.productoId === servicioId) ?? servicios[0] ?? null;
  /** Lo que de verdad se está dibujando. ⚠️ No es `vista === 'kanban'` a secas: lo
   *  escribiría dos veces y el día que una de las dos cambie, el renglón de «no
   *  encontré» aparece sobre un tablero o desaparece sobre una tabla. */
  const enKanban = vista === 'kanban' && Boolean(servicio);
  const enAvance = vista === 'avance' && Boolean(servicio);

  /**
   * LO QUE SE INVITÓ ACÁ ADENTRO, encima del acceso que trajo el server. Mismo trato que `imgs` y
   * `movs`: es lo que el server action ya devolvió, aplicado sin releer la cartera. Lo comparten la
   * tarjeta y la vista Avance — invitar desde una tiene que cambiar lo que dice la otra, o la
   * tarjeta seguiría ofreciendo «Invitar al curso» a alguien que acaba de recibir el mail.
   */
  const [accesoMovs, setAccesoMovs] = useState<Record<number, AccesoInvitacion>>({});
  const alAcceso = (leadId: number, a: AccesoInvitacion) => setAccesoMovs((m) => ({ ...m, [leadId]: a }));
  /**
   * El curso de UNA tarjeta, en el servicio que se mira. `null` = ese producto no tiene curso (o no
   * se sabe): el menú no ofrece nada del curso. `acceso: null` = no se pudo leer: se ofrecen los
   * permisos, nunca invitar.
   */
  const cursoDe = (leadId: number): CursoDeTarjeta | null => {
    if (!curso || !servicio || !curso.conCurso[servicio.productoId]) return null;
    const crudo = accesoMovs[leadId] ?? (curso.accesos ? accesoDeFila(curso.accesos[leadId] ?? { estado: 'sin-link', ingresos: 0, ultimoIngresoAt: null }) : null);
    // ⚠️ DESDE EL CURSO DE ESTE TABLERO (puntos 6 y 7 del audio del 08/10 a la noche): invitado a otro
    // curso es «Invitar al curso» acá, y el modal invita a ÉSTE (el mail nombra sólo éste).
    const acceso = accesoEnProducto(crudo, servicio.productoId);
    return { acceso, productoId: servicio.productoId, onAcceso: (a) => alAcceso(leadId, a) };
  };
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

  /**
   * EL CRITERIO de «Ordenar», AFUERA del filtro: lo usan lo que se ve (`visibles`) y la columna
   * ENTERA que se guarda al arrastrar con un buscador puesto (`soltarEnColumna`) — con dos
   * comparadores, la lista guardada y la dibujada pondrían a los mismos en otro orden.
   * Con «Manual», ordena por el criterio que estaba antes (`ordenPrevio`): es el de los que
   * la lista manual no nombra.
   */
  const criterio: OrdenClientes = orden === 'manual' ? ordenPrevio : orden;
  const cmp = (a: ClienteCruce, b: ClienteCruce) => {
    if (criterio === 'abiertas') return (resumenDe(b.leadId)?.abiertas ?? 0) - (resumenDe(a.leadId)?.abiertas ?? 0);
    if (criterio === 'proyectos') return (resumenDe(b.leadId)?.proyectos ?? 0) - (resumenDe(a.leadId)?.proyectos ?? 0);
    // Las dos columnas de la cartera (#109). «Mayor primero» es lo que pide atención: más tareas
    // vencidas, y más tiempo sin hablar.
    if (criterio === 'vencidas') return (resumenDe(b.leadId)?.atrasadas ?? 0) - (resumenDe(a.leadId)?.atrasadas ?? 0);
    if (criterio === 'contacto') {
      const ta = contactoMs(a);
      const tb = contactoMs(b);
      // «No pude leer» va al final en las DOS direcciones (por eso devuelve `signo`, que la
      // dirección vuelve positivo): no es ni el más callado ni el más reciente.
      if (ta === null || tb === null) return ta === tb ? 0 : ta === null ? signo : -signo;
      // El más viejo primero; «nunca hubo» (−∞) antes que todos.
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    }
    // Antigüedad = el orden de alta, que es el que numera. Sale del `leadId`.
    // Cuándo se ganó, con la fecha REAL (`leads.fecha_cierre`). Antes salía del
    // número de cliente, que es el orden de CARGA al CRM: dos ganados el mismo mes
    // podían salir a diez lugares de distancia. Los que no tienen fecha van al final
    // en las dos direcciones — «no sé cuándo» no es ni lo más nuevo ni lo más viejo.
    if (criterio === 'antiguedad') {
      const fa = a.fechaCierre ? Date.parse(a.fechaCierre) : NaN;
      const fb = b.fechaCierre ? Date.parse(b.fechaCierre) : NaN;
      if (Number.isNaN(fa) && Number.isNaN(fb)) return 0;
      // ⚠️ `signo` Y NO `1` (06/10/2026): el resultado se multiplica por la dirección más abajo, así
      // que con un `1` fijo los sin fecha iban al final en «mayor primero» y AL PRINCIPIO en
      // «menor primero» — lo contrario de lo que este comentario siempre prometió.
      if (Number.isNaN(fa)) return signo;
      if (Number.isNaN(fb)) return -signo;
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
  const porCriterio = (cs: ClienteCruce[]): ClienteCruce[] =>
    [...cs].sort((a, b) => signo * cmp(a, b) || nombreDe(a).localeCompare(nombreDe(b), 'es'));

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
    return porCriterio(lista.filter((c) => pasa(c) && enVentana(c)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, imgs, q, filtro, orden, ordenPrevio, cuando, dir, tablero]);
  /** Cuántos tienen algo abierto. Con el tablero caído no se cuenta nada: sería un 0
   *  con cara de dato sobre una lectura que falló. */
  const conTrabajo = tablero.ok ? lista.filter((c) => (resumenDe(c.leadId)?.abiertas ?? 0) > 0).length : 0;

  // ⚠️ LA FICHA SE BUSCA EN `lista` Y NO EN `visibles`: filtrar o buscar con una ficha
  // abierta la cerraría de golpe, que se lee como que la app se rompió.
  const abierto = abiertoId === null ? null : lista.find((c) => c.leadId === abiertoId) ?? null;

  /**
   * LA FICHA ABIERTA SE ESCRIBE EN LA URL (`?cliente=<leadId>`), y al cerrarla se borra. Así
   * el link que se copia es la ficha que se está mirando, y un F5 —o el `reload()` de
   * algún camino que todavía recarga— la vuelve a abrir en vez de cerrarla.
   *
   * ⚠️ `history.replaceState` Y NO `router.replace`, con el mismo porqué que el tablero del
   * Plan (BoardShell.tsx, «LA URL ES EL ESTADO DE LA PANTALLA»): esta página es
   * `force-dynamic` y `router.replace` sobre la misma ruta ES una navegación, o sea volver a
   * pedir el RSC con el trabajo de toda la cartera por abrir una ficha. Acá la URL no es un
   * destino: es un marcador para el próximo F5. Y replace, no push: el Atrás tiene que
   * sacarte de Clientes, no recorrer las fichas que abriste.
   *
   * ⚠️ LA QUERY SE PARTE DE `window.location.search`, NUNCA SE ARMA DE CERO: ahí viene el
   * `?ws=` del super admin o de la agencia, y perderlo es terminar mirando otra cuenta.
   *
   * ⚠️ SE ESCRIBE LO QUE SE VE (`abierto`), NO LO QUE SE PIDIÓ (`abiertoId`). Un
   * `?cliente=` que no es de esta cartera no abre nada, y dejarlo en la URL haría que el link
   * copiado prometa una ficha que no existe. Sólo se toca la URL si cambia.
   */
  const idEnUrl = abierto?.leadId ?? null;
  useEffect(() => {
    try {
      const { pathname, search, hash } = window.location;
      const destino = hrefConFicha({ pathname, search, hash }, idEnUrl);
      if (destino !== pathname + search + hash) window.history.replaceState(null, '', destino);
    } catch { /* sin URL no se pierde nada: la ficha vive en React igual */ }
  }, [idEnUrl]);

  /**
   * EL ENSAYO DEL ONBOARDING (#109): abrir una ficha. Es lo único de la lista que no se lee de la
   * base, así que se anota la PRIMERA vez que pasa en la sesión y sólo si el paso no estaba hecho.
   *
   * ⚠️ SE ENGANCHA A LO QUE SE VE (`idEnUrl`), no a cada `setAbiertoId`: hay cuatro caminos que
   * abren una ficha (la tabla, el kanban, «Ver su equipo» y el `?cliente=` de la URL) y un quinto
   * mañana. Un efecto sobre el resultado no tiene caminos que olvidar.
   */
  const [fichaVista, setFichaVista] = useState(false);
  const fichaAnotada = useRef(false);
  useEffect(() => {
    if (idEnUrl == null || !onboarding || onboarding.cs_ficha || fichaAnotada.current) return;
    fichaAnotada.current = true;
    empezar(async () => {
      // Corre sola: si falla no se interrumpe a nadie, y la próxima carga lo vuelve a intentar.
      const r = await atajar(anotarFichaAbiertaAction(), 'No se pudo anotar.');
      if (r.ok) setFichaVista(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEnUrl]);
  /** Lo anotado, con lo que pasó en esta sesión encima. `null` = no se dibuja nada. */
  const pasosOnb: OnboardingClientes | null = onboarding
    ? { ...onboarding, cs_ficha: onboarding.cs_ficha || fichaVista }
    : null;
  const conLista = listaVisible(pasosOnb);

  /** Guarda la foto o la portada. Lo que se pinta es lo que el server dijo que quedó
   *  guardado, no lo que se pidió: si el saneo descartó la URL, se tiene que ver. */
  function guardarImagen(leadId: number, cambio: Imagen) {
    setMal('');
    empezar(async () => {
      // ⚠️ TODA ACCIÓN DE ESTA PANTALLA PASA POR `atajar` (./sin-red.ts): sin red, la promesa
      // rechaza y, adentro de una transición, eso tumba la pantalla entera.
      const r = await atajar(guardarImagenClienteAction(leadId, cambio), 'No se pudo guardar la imagen.');
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
  /**
   * La CASA de cada cliente con lo quitado en esta sesión encima: «Quitar de este producto»
   * sobre su casa la anula (`cliente_entrega_fuera`), y la pantalla lo tiene que ver en el acto,
   * no al próximo `revalidatePath`. Mismo trato que `movs` para las filas.
   */
  const [casaMovs, setCasaMovs] = useState<Record<number, number | null>>({});
  const casa: Record<number, number | null> = { ...(entrega?.ok ? entrega.casaPorLead : {}), ...casaMovs };
  const asigServicio = servicio ? asignacionDe(servicio.productoId) : {};
  const delServicio = (cs: ClienteCruce[]): ClienteCruce[] => (servicio
    ? cs.filter((c) => esDelProducto(c.leadId, servicio.productoId, casa, asigServicio))
    : cs);

  /**
   * EL ORDEN MANUAL (mig 0196), con lo arrastrado en esta sesión encima. Clave
   * `producto:etapa` → la lista de la columna entera.
   */
  const [ordenMovs, setOrdenMovs] = useState<Record<string, number[]>>({});
  const listaManual = (prodId: number, etapa: string): number[] | undefined =>
    ordenMovs[`${prodId}:${etapa}`] ?? (entrega?.ok ? entrega.ordenPorServicio[prodId]?.[etapa] : undefined);
  /** ¿Hay algún orden manual guardado (o arrastrado en esta sesión) en el servicio que se mira? */
  const hayOrdenManual = Boolean(servicio) && (servicio?.etapas ?? []).some((e) => (listaManual(servicio!.productoId, e.key) ?? []).length > 0);
  /** Su etapa en el servicio que se mira, con la regla del reparto: sin fila, la primera. */
  const etapaEnServicio = (leadId: number): string =>
    (asigServicio[leadId]?.etapa ?? '').trim() || (servicio?.etapas[0]?.key ?? '');
  /** Con «Manual», cada columna en su orden guardado; los que no figuran, después (ver `ordenPrevio`). */
  const conManual = (cs: ClienteCruce[]): ClienteCruce[] => (orden === 'manual' && servicio
    ? ordenarManual(cs, (c) => c.leadId, (c) => etapaEnServicio(c.leadId), (e) => listaManual(servicio.productoId, e))
    : cs);
  const visiblesServ = conManual(delServicio(visibles));
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
   * una cuenta propia, el contador diría un número y el riel mostraría otro. Las dos viven
   * adentro de `clientesEnPantalla` (./BarraClientes), que además es lo que el test EJECUTA.
   *
   * ⚠️ DESDE EL 06/10/2026 LA FASE FILTRA TAMBIÉN LA TABLA. El porqué viejo —«la tabla no
   * esconde columnas»— dejó de ser cierto el día que la tabla se agrupó por las etapas del
   * servicio: ahora esconde GRUPOS con la misma función, y lo que se cuenta, se elige en
   * lote y se exporta tiene que ser lo mismo en las dos vistas.
   *
   * ⚠️ Y LOS HUÉRFANOS (una etapa que el catálogo ya no tiene) CUENTAN SÓLO EN LA TABLA SIN
   * FASE, que es la única vista que les dibuja una fila (el grupo «Etapa borrada»). El
   * kanban no les dibuja tarjeta: los nombra en un aviso al pie, y «N de M» no puede contar
   * a quien no se ve.
   */
  const enPantalla = servicio
    ? clientesEnPantalla(servicio.etapas, servicio.fases, faseVista, visiblesServ,
      (c) => asigServicio[c.leadId]?.etapa, !enKanban)
    : visiblesServ;
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
   *
   * ⚠️ Y LO QUE REPONE SALE DEL SERVER (`r.desde` + `r.relojPrevio`), NO DE ESTA PANTALLA
   * (14/10/2026). La pantalla puede estar vieja: si MaKo pasó al cliente de Onboarding a Hito 1
   * por el avance del curso y acá seguía en Onboarding, deshacer con lo de la pantalla lo
   * devolvía a Onboarding con su reloj trabado y lo re-enrolaba en esas secuencias, perdiendo el
   * avance; y si la pantalla creía que no tenía fila, se la borraba. Lo encontró MaKo Mobile
   * (89367e3d2). Y si la etapa de antes ya no existe en el catálogo, no se ofrece: el server la
   * rechazaría.
   */
  function moverEntrega(leadId: number, etapa: string, prodId: number, conDeshacer = true, relojPrevio?: string | null) {
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
      const r = await atajar(moverEntregaAction(leadId, prodId, etapa, relojPrevio), 'No se pudo mover.');
      if (!r.ok) { setMal(r.error); return; }
      // Un movimiento que no movio nada no se anuncia ni se pinta.
      if (!r.cambio) return;
      // La misma regla que el server (`relojDeVuelta`): si no, la pantalla y la base dicen dos fechas.
      setMovs((v) => ({ ...v, [claveMov(leadId, prodId)]: { etapa: r.hacia, etapa_desde: relojDeVuelta(relojPrevio) ?? new Date().toISOString(), por: 'CRM' } }));
      if (!conDeshacer) return;
      const desde = r.desde;
      const relojDesde = r.relojPrevio;
      // El toast dice QUE paso, en tres palabras. El porque de la etapa vive en el
      // catalogo, no en un cartel de cinco segundos.
      if (desde && !etapaExiste(prodId, desde)) { show(`En ${r.rotulo}`); return; }
      show(`En ${r.rotulo}`, () => {
        clear();
        if (desde) moverEntrega(leadId, desde, prodId, false, relojDesde);
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
   *
   * ⚠️ Lo que repone es lo que el SERVER tenía (`desde` + `relojPrevio` de cada resultado),
   * no lo que esta pantalla creía: ver `moverEntrega`. Y al que estaba en una etapa que ya no
   * existe no se lo devuelve (el server lo rechazaría).
   */
  function moverLote(leadIds: number[], destino: string | ((leadId: number) => string | null), prodId: number, conDeshacer = true) {
    const movs: Array<{ leadId: number; etapa: string | null }> = [];
    for (const leadId of leadIds) {
      const etapa = typeof destino === 'function' ? destino(leadId) : destino;
      if (!etapa) continue;
      movs.push({ leadId, etapa });
    }
    if (!movs.length) return;
    setMal('');
    empezar(async () => {
      const r = await atajar(moverEntregaLoteAction(prodId, movs), 'No se pudieron mover.');
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
      const cartel = unaEtapa ? `${movidos.length} en ${unaEtapa}` : `${movidos.length} movidos`;
      // Con su RELOJ: volver a la etapa de antes no es llegar hoy (ver `relojDeVuelta`).
      const volver = movidos
        .filter((x) => !x.desde || etapaExiste(prodId, x.desde))
        .map((x) => ({ leadId: x.leadId, etapa: x.desde, relojPrevio: x.relojPrevio ?? null }));
      if (!volver.length) { show(cartel); return; }
      const relojDe = new Map(volver.map((x) => [x.leadId, x.relojPrevio]));
      show(cartel, () => {
        clear();
        empezar(async () => {
          const d = await atajar(moverEntregaLoteAction(prodId, volver), 'No se pudo deshacer.');
          if (!d.ok) { setMal(d.error); return; }
          const ahoraD = new Date().toISOString();
          setMovs((v) => {
            const n = { ...v };
            for (const x of d.resultados) {
              if (!x.ok) continue;
              n[claveMov(x.leadId, prodId)] = x.hacia
                ? { etapa: x.hacia, etapa_desde: relojDeVuelta(relojDe.get(x.leadId)) ?? ahoraD, por: 'CRM' }
                : null;
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

  /** Si la etapa sigue en el catálogo del servicio. Un deshacer hacia una que se borró lo
   *  rechazaría el server, así que no se ofrece. */
  function etapaExiste(prodId: number, key: string): boolean {
    return (servicios.find((s) => s.productoId === prodId)?.etapas ?? []).some((e) => e.key === key);
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
      const r = await atajar(sacarDeEntregaAction(leadId, prodId), 'No se pudo deshacer.');
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
   * SOLTAR EN UNA COLUMNA: mueve de etapa a los que vienen de otra y guarda el lugar donde
   * cayeron (orden manual, mig 0196). «Se guarda + "Manual"» (Martín, 06/10/2026).
   *
   * ⚠️ LA COLUMNA QUE SE GUARDA ES LA ENTERA, también los que el buscador o un filtro
   * esconden: guardar sólo lo que se ve mandaría a los escondidos al final. Por eso el kanban
   * manda un VECINO («antes de Juan») y no un número: «el tercero» de lo que se ve no es el
   * tercero de la columna.
   *
   * ⚠️ Y SOLTAR DONDE YA ESTABA NO ES UN CAMBIO: no se guarda, no se anuncia y no pasa
   * «Ordenar» a «Manual» — que un gesto que no movió nada cambie el criterio de la pantalla
   * se leería como que la app se reacomodó sola.
   *
   * Un movimiento de etapa ofrece SU deshacer (el de `moverEntrega` / `moverLote`); un
   * reordenamiento en la misma columna ofrece uno que devuelve la lista y el criterio de antes.
   */
  function soltarEnColumna(ids: number[], etapa: string, antesDe: number | null) {
    if (!servicio || !ids.length) return;
    const prodId = servicio.productoId;
    const columna = conManual(porCriterio(listaServ))
      .filter((c) => etapaEnServicio(c.leadId) === etapa).map((c) => c.leadId);
    const nueva = columnaConInsercion(columna, ids, antesDe);
    const mueven = ids.filter((id) => etapaEnServicio(id) !== etapa);
    if (!mueven.length && mismaLista(nueva, columna)) return;

    const criterioAntes = orden;
    if (orden !== 'manual') { setOrdenPrevio(orden); setOrden('manual'); }
    const clave = `${prodId}:${etapa}`;
    const previa = listaManual(prodId, etapa) ?? null;
    setOrdenMovs((v) => ({ ...v, [clave]: nueva }));
    // ⚠️ UN LOTE VA POR `moverLote` AUNQUE AL FINAL CAMBIE UNO SOLO: la persona decidió sobre
    // la selección entera, y lo que deshace es esa decisión.
    if (mueven.length) {
      if (ids.length > 1) moverLote(mueven, etapa, prodId);
      else moverEntrega(mueven[0], etapa, prodId);
    }
    setMal('');
    empezar(async () => {
      // ⚠️ UNA ACCIÓN QUE NO LLEGA (sin red) RECHAZA LA PROMESA, y adentro de una transición eso
      // tumba la pantalla entera («Esta pantalla se rompió al dibujarse»). Medido en el arnés
      // abortando el pedido (06/10/2026). Se ataja como un error más (./sin-red.ts).
      const r = await atajar(ordenarEtapaAction(prodId, etapa, nueva), 'No se pudo guardar el orden.');
      if (!r.ok) {
        setMal(r.error);
        setOrdenMovs((v) => ({ ...v, [clave]: previa ?? [] }));
        return;
      }
      if (mueven.length) return;
      show('Reordenado', () => {
        clear();
        setOrdenMovs((v) => ({ ...v, [clave]: previa ?? [] }));
        if (criterioAntes !== 'manual') setOrden(criterioAntes);
        empezar(async () => {
          const d = await atajar(ordenarEtapaAction(prodId, etapa, previa ?? []), 'No se pudo deshacer.');
          if (!d.ok) setMal(d.error);
        });
      });
    });
  }

  /**
   * «Quitar de este producto» desde la ficha (06/10/2026). El server decide si se puede (dos o
   * más productos) y CÓMO (borrar la fila, o marcar «fuera» si era su casa); la pantalla
   * refleja lo mismo en el acto. El deshacer lo devuelve con su etapa y SU reloj.
   */
  function quitarDeProducto(leadId: number, prodId: number) {
    setMal('');
    empezar(async () => {
      const r = await atajar(quitarDeProductoAction(leadId, prodId), 'No se pudo quitar.');
      if (!r.ok) { setMal(r.error); return; }
      if (r.eraCasa) setCasaMovs((v) => ({ ...v, [leadId]: null }));
      setMovs((v) => ({ ...v, [claveMov(leadId, prodId)]: null }));
      show('Quitado del producto', () => {
        clear();
        empezar(async () => {
          const d = await atajar(volverAProductoAction(leadId, prodId, r.etapa, r.reloj), 'No se pudo devolver.');
          if (!d.ok) { setMal(d.error); return; }
          if (r.eraCasa) setCasaMovs((v) => ({ ...v, [leadId]: prodId }));
          setMovs((v) => {
            const n = { ...v };
            // Con fila, vuelve a ella con su reloj; sin fila, se borra la marca de «sacado» y
            // manda lo que diga el server (que ya no tiene fila: está en la primera por regla).
            if (r.etapa) n[claveMov(leadId, prodId)] = { etapa: r.etapa, etapa_desde: r.reloj ?? new Date().toISOString(), por: 'CRM' };
            else delete n[claveMov(leadId, prodId)];
            return n;
          });
        });
      });
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
    const r = await atajar(guardarEtapasEntregaAction(servicio.productoId, etapas, fases), 'No se pudo guardar.');
    return r.ok ? null : r.error;
  }

  function correrMako() {
    setMako(null);
    empezar(async () => {
      // ⚠️ CORRE SOLA AL MONTAR, así que un rechazo sin red acá tumbaba la pantalla ANTES de
      // que la persona tocara nada. Atajada, se calla como cualquier otro fallo de abajo.
      const r = await atajar(autoasignarAction(), 'No se pudo asignar.');
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

      {/* EL ONBOARDING DE LA TAB (#109): una lista arriba de la cartera mientras falte algo, y se
          va sola. No tapa nada — el ws1 entra con todo hecho y no la ve. */}
      {!error && conLista && pasosOnb && (
        <ChecklistClientes
          estado={pasosOnb}
          onCargar={() => setCreando('')}
          onAbrirFicha={lista.length ? () => { setAbrirEn(null); setAbiertoId(lista[0].leadId); } : undefined}
        />
      )}

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
                  // Sin `atajar`, un rechazo dejaba el selector en «guardando» para siempre:
                  // `SelectorServicio` espera un texto, no una excepción.
                  const r = await atajar(crearServicioAction(nombre), 'No se pudo crear.');
                  if (!r.ok) return r.error;
                  // Se queda mirando el que acaba de crear: crear algo y no verlo se lee
                  // como que no pasó nada. El `revalidatePath` trae su tablero.
                  setServicioId(r.productoId);
                  return null;
                }}
              />
            ) : undefined}
            filtro={filtro} onFiltro={(v) => setFiltro(v as FiltroClientes)} orden={orden} onOrden={(v) => setOrden(v as OrdenCS)}
            /* «Manual» sólo con un servicio elegido: sin columnas no hay nada que arrastrar. Y con
               «Manual» no se ofrece el sentido: el orden es el que se armó, no tiene «al revés». */
            ordenes={servicio ? ORDEN_CS : ORDEN_LABEL}
            /* ⚠️ CON UN ORDEN MANUAL GUARDADO, «MANUAL» ES LA BASE, no un filtro puesto. Martín
               (06/10/2026): «para quitar eso y volver a antes, simplemente es volver a ordenar por
               fecha… y si quiero volver a la posición que había dejado las tarjetas es
               simplemente quitar filtros». Así «Limpiar filtros» vuelve a lo que arrastró, y el
               número del botón no cuenta como filtro el orden que él mismo armó. */
            ordenBase={hayOrdenManual ? 'manual' : 'nombre'}
            cuandos={CUANDO_LABEL} cuando={cuando} onCuando={setCuando} dir={dir} onDir={orden === 'manual' ? undefined : setDir}
            /* La FASE, como una sección más de «Filtrar», EN LAS DOS VISTAS. Hasta el 06/10/2026
               era sólo del kanban, con el porqué de que «la tabla no esconde columnas»; dejó de
               ser cierto cuando la tabla se agrupó por las etapas del servicio, y ahora esconde
               grupos con la misma `columnasVisibles`. Sin servicio no hay etapas que filtrar; sin
               fases (o con una sola), `opcionesDeFase` devuelve vacío y la sección no está. */
            fases={servicio ? opcionesFase : undefined} fase={faseVista} onFase={setFasePedida}
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
          {/* Con la lista del onboarding a la vista, ella ya lo dice («Tu servicio»): dos renglones
              pidiendo lo mismo se leen como dos cosas que faltan. */}
          {!hayKanban && entrega?.ok && !conLista && (
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
          {/* En «Avance» no hay casillas que elegir: la barra de lote ahí actuaría sobre una
              selección que esta vista no muestra. Vuelve sola al volver al kanban o la tabla. */}
          {elegidosVisibles.length > 0 && !enAvance && (
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
              onSoltar={soltarEnColumna}
              onAbrir={(leadId) => { setAbrirEn(null); setAbiertoId(leadId); }}
              onEquipo={(leadId) => { setAbrirEn('equipo'); setAbiertoId(leadId); }}
              onNuevoCliente={(etapa) => setCreando(etapa)}
              onError={setMal}
              seleccion={sel}
              onSeleccion={setSel}
              /* EL CURSO EN EL MENÚ DE CADA TARJETA (item 9): «Invitar al curso» abre el modal de
                 invitar ahí mismo; «Permisos del curso» abre la ficha en su pestaña Curso, que es
                 donde viven (el mismo molde que «Ver su equipo»). */
              cursoDe={cursoDe}
              onPermisos={(leadId) => { setAbrirEn('curso'); setAbiertoId(leadId); }}
            />
          ) : enAvance && servicio ? (
            <AvanceDelServicio curso={curso} productoId={servicio.productoId}
              visibles={visiblesServ} accesoMovs={accesoMovs} onAcceso={alAcceso} />
          ) : (
            <TablaClientes filas={visiblesServ} numeroDe={numeroDe} resumenDe={resumenDe}
              tableroOk={tablero.ok}
              /* Con un servicio elegido la tabla se agrupa por SUS etapas y se arrastra
                 entre ellas; sin servicio queda plana, como antes. */
              etapas={servicio ? servicio.etapas : null}
              fases={servicio ? servicio.fases : []}
              /* Ya VIGENTE, igual que al kanban: la tabla esconde los grupos que no son de la
                 fase con la MISMA `columnasVisibles`, y lo que cuenta «N de M» (`enPantalla`)
                 sale de la misma regla. */
              fase={faseVista}
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
          {visiblesServ.length === 0 && !enKanban && !enAvance && (
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
            onQuitar: (prodId) => quitarDeProducto(abierto.leadId, prodId),
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
            const r = await atajar(renombrarServicioAction(servicio.productoId, nombre), 'No se pudo renombrar.');
            return r.ok ? null : r.error;
          }}
          /* ⚠️ Sólo un producto CON EMBUDO vuelve desde «Productos eliminados» del CRM (uno
             sin embudo se da de baja con `activo = false`, ver `eliminarServicioAction`): la
             confirmación lo dice sólo en ese caso. El dato sale de `productosOfrecibles`. */
          conEmbudo={servicio.conEmbudo}
          /* El producto del embudo principal no se elimina (el server lo frena): sin
             botón, como en el CRM. Un botón cuya única respuesta es «no se puede» se
             lee como que la app está rota. */
          onEliminar={servicio.principal ? undefined : async () => {
            const r = await atajar(eliminarServicioAction(servicio.productoId), 'No se pudo eliminar.');
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
 * La vista «Avance» de UN servicio: la tabla que vivía en la tab Curso, mudada acá (item 4 del
 * 07/10/2026). Las celdas, la columna «Acceso» y el modal de invitar son los MISMOS
 * (./curso/AvanceCurso.tsx): esto sólo elige las filas.
 *
 * ⚠️ FILTRA POR LO QUE LA BARRA DEJÓ (`visibles`, ya buscado, filtrado y del servicio): el buscador
 * de la pantalla vale igual en las tres vistas. Con una lista propia, buscar «Ana» y pasar a Avance
 * mostraría a todos — dos vistas de la misma cartera diciendo cosas distintas.
 *
 * ⚠️ LO INVITADO EN ESTA SESIÓN (`accesoMovs`) PISA LA FILA DEL SERVER: si se invitó desde la
 * tarjeta, la columna tiene que decir «Invitado», no ofrecer «Invitar» otra vez.
 */
function AvanceDelServicio({ curso, productoId, visibles, accesoMovs, onAcceso }: {
  curso: CursoClientes | undefined;
  productoId: number;
  visibles: readonly ClienteCruce[];
  accesoMovs: Readonly<Record<number, AccesoInvitacion>>;
  onAcceso: (leadId: number, a: AccesoInvitacion) => void;
}) {
  if (!curso) return null;
  if (!curso.avance.ok) return <AvanceCurso etapas={[]} filas={[]} error={curso.avance.error} />;
  const p = curso.avance.porProducto[productoId];
  // Un producto sin clases no es «nadie empezó»: es que no hay curso, y se dice dónde se arma.
  if (!p) return <EmptyState titulo="Este producto no tiene curso" detalle="Sus clases se cargan en Curso." accion={{ label: 'Ir a Curso', href: '/customer-success/curso' }} />;
  const ids = new Set(visibles.map((c) => c.leadId));
  const filas = p.filas
    .filter((f) => ids.has(f.leadId))
    .map((f) => (accesoMovs[f.leadId] ? { ...f, acceso: filaDeAcceso(accesoMovs[f.leadId]) } : f));
  // «No encontré» no es «no tiene clientes»: con el buscador puesto, la tabla vacía diría lo segundo.
  if (!filas.length && p.filas.length) return <p className="cl-nada">Ningún cliente coincide con lo que buscaste.</p>;
  return <AvanceCurso etapas={p.etapas} filas={filas} error={null} onAcceso={onAcceso} productoId={productoId} />;
}

/**
 * LO QUE SE VE, a un CSV.
 *
 * ⚠️ EXPORTA `visibles` Y NO LA CARTERA ENTERA, a propósito: con un filtro puesto,
 * exportar todo es devolver algo que no es lo que la persona está mirando. Y el
 * archivo se arma en el NAVEGADOR —sin ruta y sin server— porque el dato ya está acá:
 * pedirlo de nuevo sería una llamada para reordenar lo que ya tenemos.
 *
 * QUÉ columnas salen (y el escape, el `;` y el BOM) vive en ./exportar.ts, que un test puede
 * ejecutar; acá sólo se arma el archivo. Desde el 06/10/2026 lleva Email y Teléfono: es la
 * forma en que «copiar los contactos de los elegidos» quedó resuelto sin un botón más.
 */
function exportarCSV(
  filas: ClienteCruce[],
  numeroDe: Map<number, number>,
  resumenDe: (leadId: number) => ResumenTrabajo | null,
) {
  const csv = textoCSV(filasCSV(filas, numeroDe, resumenDe));
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

/**
 * Para ordenar por «Último contacto»: el instante de la última conversación. `-Infinity` = se leyó
 * y nunca hubo (el más callado de todos); `null` = no se pudo leer, que no es ninguno de los dos.
 */
const contactoMs = (c: ClienteCruce): number | null => {
  const u = c.ficha?.contactoUltimo;
  if (!u) return null;
  if (!u.fecha) return -Infinity;
  const t = Date.parse(u.fecha);
  return Number.isFinite(t) ? t : null;
};

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
