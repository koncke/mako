'use client';

// =============================================================================
// /m/competitor-spy — las dos vistas de Competitor Spy en una columna (6/11/2026)
// =============================================================================
// El teléfono DESTILA la computadora: las MISMAS dos vistas de app/competitor-spy/SpyApp.tsx, en el
// mismo orden y con los mismos rótulos, con menos texto y menos piezas.
//
//   1. LA LISTA: el campo de arriba (el MISMO `BuscadorAlta`), «Competidores» en una columna con su
//      cara, su nombre y sus números destilados, y «Sugeridos» con «Sumar».
//   2. LA FICHA (`?competidor=<id>`): quién es (su cara, su nombre, de dónde se lee y sus números),
//      y después UN BLOQUE POR PANTALLA, plegados (docs/diseno-competitors-spy.md §8): el gráfico
//      (`GraficoSpy` TAL CUAL, como pide docs/relevo/nube-spy.md), «Lo que mejor le fue»
//      (`MejoresPiezas`), «Su oferta» (lo que la IA le leyó) y «Todas sus piezas» en UNA columna
//      (`GrillaPiezas` + `TarjetaPieza`). El detalle de una pieza y los filtros, en hojas.
//
// ⚠️ TODO ESTO ES EL CÓDIGO DE LA COMPUTADORA, no una copia: el gráfico con su selector y sus
// filtros por red, «¿Qué formatos le funcionan?», el guion de una pieza y «Hacer uno así» son los de
// escritorio, y las cuentas son las puras de lib/spy-vista.ts y lib/spy-detalle.ts. Lo único que se
// escribió acá es la FORMA de una columna. Qué se vistió y por qué: ./competitor-spy.css.
//
// ⚠️ EL DETALLE DE UNA PIEZA VA EN UNA `SheetM`, NO EN EL `Modal` DE ESCRITORIO. `DetallePieza` era
// un `Modal` —que /m no usa (AGENTS.md)—, así que se le abrió una puerta: `marco`, la caja donde se
// dibuja (app/competitor-spy/DetallePieza.tsx → `MarcoDetalle`). El escritorio sigue con su `Modal`,
// que es el default; acá se le pasa la hoja.
//
// ⚠️ Y LA SEGUNDA PUERTA ES `columnas`, EN `GrillaPiezas`: el teléfono PIDE una columna en vez de
// taparle su `grid-template-columns` del estilo en línea con un `!important` desde la hoja. El
// componente cuenta la paginación con las columnas que cree dibujar, así que con el `!important` se
// veía una columna y se contaban dos: el doble de tarjetas por página, el doble de miniaturas que
// bajar con datos (docs/hallazgos-mobile.md, 6/11/2026). Las dos puertas tienen su default de
// escritorio, y son lo único que se tocó de allá.
//
// ⚠️ LO QUE NO VA AL TELÉFONO SE DICE, NO DESAPARECE (§8): replicar su sitio (es el editor) y el
// recorrido con la extensión (es Chrome de escritorio) van en la fila `ComputadoraM` del final.
//
// ⚠️ ACÁ NO SE LEE AL COMPETIDOR (ver page.tsx): la ficha muestra lo leído y, si todavía no se leyó
// nada, lo dice. Por eso NO se usa `estadoDeResultados`: esa función decide entre «leímos y no hay» y
// «no pudimos» con la lectura EN LA MANO, y sin lectura devuelve «cargando» —un esqueleto para
// siempre—. Lo que acá se sabe es `mirado_en`.
//
// ⚠️ Y NO SE OFRECE COMPRAR, PAGAR NI SUBIR DE PLAN (tests/tiendas-telefono-no-vende.test.ts).
// =============================================================================

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { CabeceraM, ComputadoraM, FilaDatoM, FilaM, ListaM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { BuscadorAlta } from '@/app/competitor-spy/BuscadorAlta';
import { DetallePieza, type MarcoDetalle } from '@/app/competitor-spy/DetallePieza';
import { GraficoSpy } from '@/app/competitor-spy/GraficoSpy';
import { GrillaPiezas } from '@/app/competitor-spy/GrillaPiezas';
import { MejoresPiezas } from '@/app/competitor-spy/MejoresPiezas';
import { TarjetaPieza } from '@/app/competitor-spy/TarjetaPieza';
import { sumarCanalAction, sumarCompetidorAction, sumarSugeridoAction, type PiezaVista } from '@/app/competitor-spy/actions';
import { multiplosDe } from '@/lib/multiplo-rendimiento';
import { caricaturaDeCompetidor, nombreDeTarjeta } from '@/lib/spy-caricatura';
import { caraDeTarjeta } from '@/lib/spy-caricatura-reglas';
import { grupoDe } from '@/lib/spy-detalle';
import { dibujarContador } from '@/lib/spy-reglas';
import { iniciales } from '@/lib/unicode-seguro';
import {
  MINIMOS_DE_MULTIPLO, ORDENES, canalesDe, fechaCorta, filtrarPiezas, haceCuanto, opcionesDeContenido, ordenarPiezas,
  type OrdenSpy, type TipoContenido, type ValorDeContenido,
} from '@/lib/spy-vista';
import type { Competidor, ResumenPiezas } from '@/lib/spy';
import type { Sugerido } from '@/lib/spy-sugeridos';

/** La ruta de la pantalla, en rutas internas de /m: al navegar, `conWs` la traduce (lib/ws-tab.ts). */
const RUTA = '/m/competitor-spy';
/** Su nombre, el de la fila de More y de la sidebar (lib/movil-rutas.ts → SECCIONES_MAS). */
const TITULO = 'Competitor Spy';

/** La inicial de un nombre: SIEMPRE con `iniciales` — `charAt(0)` de «🔥 Alex» parte el emoji y tira la pantalla al hidratar. */
const inicial = (nombre: string): string => iniciales(nombre, 1, '·');

/** Su cara: la caricatura que ya tenemos, la dibujada de ese referente o su foto (`caraDeTarjeta`). */
function Cara({ c }: { c: { nombre: string; caricatura?: string | null; avatar?: string | null; instagram?: string | null; youtube_id?: string | null; tiktok?: string | null } }) {
  // La caricatura de un referente en su tamaño CHICO (200 px, la del Ops Center): acá mide 48 px. La grande (600 px, 150–190 KB)
  // es para la tarjeta de la computadora; en el teléfono tardaba, y Sugeridos se veía con cuadrados verdes vacíos (11/11/2026).
  const cara = caraDeTarjeta(c, caricaturaDeCompetidor(c)?.replace('/asesores/grandes/', '/asesores/') ?? null);
  return (
    <span className="m-competitor-spy__cara" aria-hidden>
      {cara
        // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public, no pasa por el optimizador
        ? <img src={cara} alt="" loading="lazy" onError={(e) => { e.currentTarget.remove(); }} />
        : inicial(c.nombre)}
    </span>
  );
}

/** Dónde se lo lee, en una línea: la misma de la computadora, con los mismos rótulos. */
const canalesEnLinea = (c: { instagram?: string | null; youtube_id?: string | null; tiktok?: string | null; landing_url?: string | null }): string =>
  [c.instagram ? 'Instagram' : null, c.youtube_id ? 'YouTube' : null, c.tiktok ? 'TikTok' : null, c.landing_url ? 'Su web' : null].filter(Boolean).join(' · ');

/** Un bloque de la ficha: plegable, con su chevron. El primero (el gráfico) abre puesto. */
function Bloque({ titulo, abierto = false, children }: { titulo: string; abierto?: boolean; children: ReactNode }) {
  return (
    <details className="m-competitor-spy__bloque" open={abierto}>
      <summary>{titulo}<Icon name="chevron" size={18} /></summary>
      <div className="m-competitor-spy__cuerpo">{children}</div>
    </details>
  );
}

/** Una opción de una lista de la hoja de filtros: la elegida lleva el tilde, no un color de texto. */
function Opcion({ rotulo, segunda, elegida, onElegir }: { rotulo: string; segunda?: string; elegida: boolean; onElegir: () => void }) {
  return (
    <FilaM
      titulo={rotulo}
      segunda={segunda}
      navegacion
      onClick={onElegir}
      chevron={false}
      riel={elegida ? <span className="m-competitor-spy-hoja__elegida" aria-label="Elegido"><Icon name="check" size={18} /></span> : null}
    />
  );
}

export function SpyM({ competidores, resumen, sugeridos, abierto, piezas }: {
  competidores: Competidor[];
  resumen: Record<number, ResumenPiezas>;
  /** Los de la plataforma que este negocio todavía no mira (lib/spy-sugeridos.ts). */
  sugeridos: Sugerido[];
  /** El `?competidor=` de la URL: la ficha es una URL, se comparte y se vuelve (igual que la computadora). */
  abierto: number | null;
  /** Las piezas del que se abre, leídas en el server. */
  piezas: readonly PiezaVista[];
}) {
  const router = useRouter();
  const toast = useToastM();
  // ⚠️ `abierto` y `piezas` son PROPS y no se copian a un estado: refrescar tirando hacia abajo vuelve
  // a correr el server y tiene que traer lo nuevo (app/m/_ui/PantallaM.tsx).
  const c = competidores.find((x) => x.id === abierto) ?? null;

  const [alta, setAlta] = useState<{ para: { nombre: string; red: 'instagram' | 'youtube' | null } | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  /** Los filtros y el orden: los mismos de la computadora, en una hoja. */
  const [filtros, setFiltros] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [tipo, setTipo] = useState<TipoContenido>('todo');
  const [minimo, setMinimo] = useState(0);
  const [orden, setOrden] = useState<OrdenSpy>('mas-vistas');
  /**
   * La pieza del detalle y si su hoja está abierta, SEPARADAS: una hoja sigue en pantalla los 220 ms
   * de su salida, así que lo de adentro no puede depender de `abierto` (app/m/_ui/LEEME.md §4).
   */
  const [pieza, setPieza] = useState<PiezaVista | null>(null);
  const [hojaPieza, setHojaPieza] = useState(false);

  const flujo = useMemo(() => piezas.filter((p) => p.canal === 'instagram' || p.canal === 'youtube'), [piezas]);
  const anuncios = useMemo(() => piezas.filter((p) => p.canal === 'anuncios'), [piezas]);
  // La galería de abajo: lo que publica Y sus anuncios, como un formato más (Martín, 4/11).
  const contenido = useMemo(() => [...flujo, ...anuncios], [flujo, anuncios]);
  // El «3,7×» de cada pieza, sobre TODAS las suyas: la única cuenta de la casa (lib/multiplo-rendimiento.ts).
  const multiplos = useMemo(() => multiplosDe(piezas), [piezas]);
  const visibles = useMemo(
    () => ordenarPiezas(filtrarPiezas(contenido, buscar, tipo, minimo, multiplos), orden, multiplos),
    [contenido, buscar, tipo, minimo, multiplos, orden],
  );
  const opcionesTipo = useMemo(() => (c ? opcionesDeContenido(contenido, c) : []), [contenido, c]);
  const filtrado = buscar.trim() !== '' || tipo !== 'todo' || minimo > 0;

  const irA = useCallback((id: number | null) => {
    router.push(id == null ? RUTA : `${RUTA}?competidor=${id}`);
  }, [router]);

  /** Abre el detalle de una pieza: las de su grupo viajan con ella, para su puesto y su mediana. */
  const abrirPieza = useCallback((p: PiezaVista) => { setPieza(p); setHojaPieza(true); }, []);
  const todasDeLaPieza = useMemo(
    () => (pieza == null ? [] : pieza.canal === 'anuncios' ? anuncios : piezas.filter((x) => grupoDe(x) === grupoDe(pieza))),
    [pieza, piezas, anuncios],
  );

  /** La caja del detalle en el teléfono: la hoja de MaKo Mobile en vez del `Modal` de la computadora. */
  const marcoHoja: MarcoDetalle = useCallback(({ titulo, encabezado, pie, onCerrar, children }) => (
    <SheetM
      abierto={hojaPieza}
      onCerrar={onCerrar}
      titulo={<span className="m-competitor-spy-hoja__titulo">{titulo}<small>{encabezado}</small></span>}
      pie={pie}
      snap="alto"
      id="pieza"
    >
      <div className="m-competitor-spy m-competitor-spy-hoja">{children}</div>
    </SheetM>
  ), [hojaPieza]);

  // ── El alta: el MISMO buscador de la computadora, que ya está hecho para el teléfono ──────────
  const abrirAlta = (para: { nombre: string; red: 'instagram' | 'youtube' | null } | null = null) => {
    setErrorAlta(null);
    setAlta({ para });
  };
  const sumar = async (pegado: string, nombre?: string, deLaBio?: string | null) => {
    setOcupado(true);
    setErrorAlta(null);
    try {
      const r = await sumarCompetidorAction(pegado, nombre, deLaBio);
      if (!r.ok) { setErrorAlta(r.error); return; }
      setAlta(null);
      irA(r.id);
    } finally {
      setOcupado(false);
    }
  };
  /** Le suma un canal al que ya se mira: el mismo buscador, con su nombre puesto y sólo esa red. */
  const sumarCanal = async (pegado: string) => {
    if (!c) return;
    setOcupado(true);
    setErrorAlta(null);
    try {
      const r = await sumarCanalAction(c.id, pegado);
      if (!r.ok) { setErrorAlta(r.error); return; }
      setAlta(null);
      toast('Canal agregado');
      router.refresh();
    } finally {
      setOcupado(false);
    }
  };
  /** Sumar un sugerido copia lo que la plataforma ya leyó de él: no gasta nada del negocio. */
  const sumarSugerido = async (s: Sugerido) => {
    setOcupado(true);
    try {
      const r = await sumarSugeridoAction(s.id);
      if (!r.ok) { toast(r.error, { error: true }); return; }
      irA(r.id);
    } finally {
      setOcupado(false);
    }
  };

  const buscador = alta && (
    <div className="m-competitor-spy">
      <BuscadorAlta
        para={alta.para ? { nombre: alta.para.nombre, red: alta.para.red } : null}
        competidores={competidores}
        ocupado={ocupado}
        error={errorAlta}
        onClose={() => setAlta(null)}
        onAgregar={(v, n, bio) => { void (alta.para ? sumarCanal(v) : sumar(v, n, bio)); }}
        onAbrir={(id) => { setAlta(null); irA(id); }}
      />
    </div>
  );

  // ── LA LISTA ──────────────────────────────────────────────────────────────────────────────────
  if (!c) {
    const desdes = Object.values(resumen).map((r) => r.desde).filter((d): d is string => !!d).sort();
    return (
      <div className="m-competitor-spy">
        <button type="button" className="m-competitor-spy__campo" aria-haspopup="dialog" onClick={() => abrirAlta()}>
          <Icon name="search" size={16} />
          <span>Nombre, @, canal de YouTube o sitio</span>
          <Icon name="plus" size={17} />
        </button>

        {competidores.length === 0 ? (
          <VacioM
            frase="Todavía no estás mirando a nadie. Busca a alguien de tu nicho por su nombre, su @, su canal o su sitio: lo leemos ahora."
            accion={{ rotulo: 'Buscar a alguien', onClick: () => abrirAlta() }}
          />
        ) : (
          <SeccionM titulo="Competidores">
            <ListaM etiqueta="Competidores">
              {competidores.map((x) => {
                const r = resumen[x.id];
                const conPiezas = !!r && r.vivas + r.idas > 0;
                // Sin piezas, «Revisado hace…» va en la segunda línea y no a la derecha: ahí le quitaba 130 px al nombre, y
                // «Acquisition.com» se veía «Acquisition.con», cortado sin «…» (mirado en producción a 375 px, 11/11/2026).
                const canales = canalesEnLinea(x) || 'Sin canales todavía';
                return (
                  <FilaM
                    key={x.id}
                    leading={<Cara c={x} />}
                    titulo={nombreDeTarjeta(x)}
                    segunda={!conPiezas && x.mirado_en ? `${canales} · revisado ${haceCuanto(x.mirado_en)}` : canales}
                    riel={conPiezas ? `${r.vivas} ${r.vivas === 1 ? 'pieza' : 'piezas'}` : null}
                    onClick={() => irA(x.id)}
                  />
                );
              })}
            </ListaM>
          </SeccionM>
        )}

        {/* La línea de la computadora es la de la lista: cuántos hay y desde cuándo (sin un título-frase). */}
        {competidores.length > 0 && desdes[0] && (
          <p className="m-competitor-spy__frescura">{competidores.length} {competidores.length === 1 ? 'competidor' : 'competidores'} · el más viejo desde el {fechaCorta(desdes[0])}</p>
        )}

        {sugeridos.length > 0 && (
          <SeccionM titulo="Sugeridos">
            <ListaM etiqueta="Sugeridos">
              {sugeridos.map((s) => (
                <FilaM
                  key={s.id}
                  leading={<Cara c={{ nombre: s.nombre, avatar: s.cara, instagram: s.instagram, youtube_id: s.youtube_id, tiktok: s.tiktok }} />}
                  titulo={nombreDeTarjeta(s)}
                  segunda={canalesEnLinea(s)}
                  riel={<span className="m-lnk">Sumar</span>}
                  chevron={false}
                  deshabilitada={ocupado}
                  etiqueta={`Sumar a ${nombreDeTarjeta(s)}`}
                  onClick={() => { void sumarSugerido(s); }}
                />
              ))}
            </ListaM>
          </SeccionM>
        )}

        <ComputadoraM que="El recorrido con la extensión para guardar lo que ves" />
        {buscador}
      </div>
    );
  }

  // ── LA FICHA DE UNO ───────────────────────────────────────────────────────────────────────────
  const nombre = nombreDeTarjeta(c);
  const de = [
    c.instagram ? `@${String(c.instagram).replace(/^@/, '')}` : null,
    c.youtube_id ? 'YouTube' : null,
    c.tiktok ? `TikTok @${c.tiktok}` : null,
    c.landing_url ? 'Su web' : null,
  ].filter(Boolean).join(' · ');
  const desde = piezas.map((p) => p.visto_primera_vez).sort()[0] ?? null;
  // La línea gris: SÓLO frescura. Nunca promete que lo vigilamos (no hay cron: docs/relevo/nube-spy.md).
  const frescura = [
    c.mirado_en ? `Revisado ${haceCuanto(c.mirado_en)}` : null,
    desde ? `lo seguimos desde el ${fechaCorta(desde)}` : null,
  ].filter(Boolean).join(' · ');
  const rc = resumen[c.id];
  // Un contador ausente NO es cero (lib/spy-reglas.ts): sin dato no hay celda.
  const celdas = [
    ...(rc && rc.idas > 0 ? [{ k: 'idas', rot: 'Borradas', val: String(rc.idas), pie: 'las bajó' }] : []),
    ...(c.instagram_seguidores != null ? [{ k: 'ig', rot: 'Seguidores', val: dibujarContador(c.instagram_seguidores), pie: 'en Instagram' }] : []),
    ...(c.youtube_suscriptores != null ? [{ k: 'yt', rot: 'Suscriptores', val: dibujarContador(c.youtube_suscriptores), pie: 'en YouTube' }] : []),
  ];
  const conGrafico = flujo.length > 0 || anuncios.length > 0;
  // Lo que la IA ya dejó escrito de su oferta, con los rótulos de la computadora (app/competitor-spy/SuOferta.tsx).
  // Un campo vacío no deja fila, y sin ninguno el bloque no existe: no se anuncia su ausencia.
  const oferta = ([
    { k: 'Promete', v: c.oferta?.promete },
    { k: 'A quién', v: c.oferta?.aQuien },
    { k: 'Precio que publica', v: c.oferta?.precio },
    { k: 'Objeción que ataca', v: c.oferta?.objecion },
  ] as const).flatMap((o) => (o.v?.trim() ? [{ k: o.k, v: o.v.trim() }] : []));
  const huecos = (c.oferta?.huecos ?? []).filter((h) => h?.trim());

  return (
    <div className="m-competitor-spy">
      {/* Mi propio encabezado (su cara y su nombre): el nombre chico sube a la barra al hacer scroll. */}
      <CabeceraM titulo={nombre} grande={false} padre={{ href: RUTA, label: TITULO }} />
      <header className="m-competitor-spy__quien" data-m-titulo-grande>
        <Cara c={c} />
        <div>
          <h1>{nombre}</h1>
          {de && <span className="m-competitor-spy__de">{de}</span>}
        </div>
      </header>
      {frescura && <p className="m-competitor-spy__frescura">{frescura}</p>}
      {celdas.length > 0 && (
        <div className="m-competitor-spy__kpis">
          {celdas.map((k) => <div key={k.k} className="m-competitor-spy__kpi"><b>{k.rot}</b><strong>{k.val}</strong><small>{k.pie}</small></div>)}
        </div>
      )}

      {/* Sin canales no hay nada que leer, y la salida es la misma de la computadora: agregarle uno. */}
      {!canalesDe(c) && (
        <VacioM
          frase={`Dime dónde mirar a ${nombre}: su @, su canal de YouTube o su sitio.`}
          accion={{ rotulo: 'Agregar un canal', onClick: () => abrirAlta({ nombre: c.nombre, red: null }) }}
        />
      )}
      {/* Con canales y sin nada leído: lo que se sabe, sin inventar un cero (ver la cabecera del archivo). */}
      {canalesDe(c) && contenido.length === 0 && (
        <VacioM frase={c.mirado_en
          ? `Leímos sus canales el ${fechaCorta(c.mirado_en)} y no había nada público.`
          : `Todavía no se leyó nada de ${nombre}. Su primera lectura se hace en la computadora.`} />
      )}

      {conGrafico && (
        <Bloque titulo="Qué publica" abierto>
          {/* TAL CUAL, como pide docs/relevo/nube-spy.md: trae los números de arriba, el gráfico con su
              selector y sus filtros por red, y «¿Qué formatos le funcionan?». Ya se achica solo en el
              teléfono (`useTelefono`, miniaturas de 30 px) y se midió a 390 px con 90 miniaturas. */}
          <GraficoSpy
            c={c}
            piezas={piezas}
            analizando={false}
            onAbrir={abrirPieza}
            onAgregarRed={(red) => abrirAlta({ nombre: c.nombre, red })}
            // «Su web» es, en la computadora, la pestaña Funnel; acá se DICE dónde se mira.
            onWeb={() => toast('Su web se mira en la computadora')}
          />
        </Bloque>
      )}

      {flujo.length > 0 && (
        <Bloque titulo="Lo que mejor le fue">
          <MejoresPiezas piezas={flujo} onAbrir={abrirPieza} />
        </Bloque>
      )}

      {oferta.length > 0 && (
        <Bloque titulo="Su oferta">
          {/* Lo que la IA del negocio leyó de todo su contenido (spy_competidores.oferta), con los MISMOS
              cuatro rótulos de la computadora, en las filas clave → valor de /m.
              ⚠️ NO SE MONTA `SuOferta`, aunque trae su CSS y dibujaría esto mismo: su puntaje y sus notas
              salen de /api/competitor-spy/oferta, y sin esa lectura deja un `EsqueletoPuntaje` puesto para
              siempre («una espera que no termina no es un loader»). Pedirla desde el teléfono sería una
              corrida de IA del negocio disparada por abrir una pantalla; su diagnóstico nota por nota se
              mira en la computadora. */}
          <ListaM etiqueta="Su oferta">
            {oferta.map((o) => <FilaDatoM key={o.k} k={o.k} v={o.v} />)}
          </ListaM>
          {huecos.length > 0 && (
            <SeccionM titulo="Lo que ataca y tu oferta no menciona">
              <ListaM>{huecos.map((h) => <FilaM key={h} titulo={h} navegacion />)}</ListaM>
            </SeccionM>
          )}
        </Bloque>
      )}

      {contenido.length > 0 && (
        /* UNA columna (§8), PEDIDA: es la que se dibuja y la que se cuenta, así que una página son tres tarjetas y no
           seis. Taparle el estilo en línea con un `!important` desde la hoja dejaba la cuenta en dos columnas: el doble
           de miniaturas que bajar con datos (docs/hallazgos-mobile.md). */
        <GrillaPiezas
          columnas={1}
          piezas={visibles}
          reinicio={`${c.id}|${buscar}|${tipo}|${minimo}|${orden}`}
          tarjeta={(p) => <TarjetaPieza p={p} multiplo={multiplos.get(p.id)} onAbrir={() => abrirPieza(p)} />}
          vacio={(
            <VacioM
              frase={`Ninguna de sus ${contenido.length} piezas pasa este filtro.`}
              accion={{ rotulo: 'Ver todo', onClick: () => { setBuscar(''); setTipo('todo'); setMinimo(0); } }}
            />
          )}
          cabecera={(
            <>
              <SeccionM titulo="Todas sus piezas" />
              <div className="m-competitor-spy__filtro">
                <button type="button" data-puesto={filtrado ? 'si' : undefined} aria-haspopup="dialog" onClick={() => setFiltros(true)}>
                  <Icon name="tools" size={16} />
                  {filtrado ? `${visibles.length} de ${contenido.length}` : 'Filtrar y ordenar'}
                </button>
                {filtrado && (
                  <button type="button" onClick={() => { setBuscar(''); setTipo('todo'); setMinimo(0); }}>Ver todo</button>
                )}
              </div>
            </>
          )}
        />
      )}

      {/* Lo que NO va al teléfono, dicho (§8): replicar su sitio es el editor, y el recorrido es Chrome
          de escritorio. Guardar un anuncio pegado y dejar de mirarlo también quedaron allá. */}
      <ComputadoraM que="Replicar su sitio, el recorrido con la extensión y dejar de mirarlo" />

      {/* La hoja de los filtros y del orden: los MISMOS tres de la barra de herramientas de la computadora. */}
      <SheetM abierto={filtros} onCerrar={() => setFiltros(false)} titulo="Filtrar y ordenar" snap="alto" id="filtros">
        <div className="m-competitor-spy m-competitor-spy-hoja">
          <label className="m-competitor-spy-hoja__buscar">
            <Icon name="search" size={16} />
            <input aria-label="Buscar en sus piezas" placeholder="Buscar en sus piezas" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </label>
          <SeccionM titulo={<span className="m-competitor-spy-hoja__grupo">Qué ver</span>}>
            <ListaM>
              {opcionesTipo.map((o) => (
                <Opcion
                  key={o.value}
                  rotulo={o.label}
                  elegida={o.value === tipo}
                  onElegir={() => {
                    // La red que falta se agrega desde acá, como en la computadora: elegirla abre su buscador.
                    const v = o.value as ValorDeContenido;
                    if (v === 'agregar-instagram' || v === 'agregar-youtube') {
                      setFiltros(false);
                      abrirAlta({ nombre: c.nombre, red: v === 'agregar-youtube' ? 'youtube' : 'instagram' });
                      return;
                    }
                    setTipo(v);
                  }}
                />
              ))}
            </ListaM>
          </SeccionM>
          <SeccionM titulo={<span className="m-competitor-spy-hoja__grupo">Rendimiento mínimo</span>}>
            <ListaM>
              {MINIMOS_DE_MULTIPLO.map((m) => (
                <Opcion
                  key={m}
                  rotulo={m ? `${m}×+` : 'Cualquier rendimiento'}
                  segunda={m ? `${m} veces lo que suele hacer su cuenta, o más` : undefined}
                  elegida={m === minimo}
                  onElegir={() => setMinimo(m)}
                />
              ))}
            </ListaM>
          </SeccionM>
          <SeccionM titulo={<span className="m-competitor-spy-hoja__grupo">Ordenar</span>}>
            <ListaM>
              {ORDENES.map((o) => <Opcion key={o.value} rotulo={o.label} elegida={o.value === orden} onElegir={() => setOrden(o.value)} />)}
            </ListaM>
          </SeccionM>
        </div>
      </SheetM>

      {/* El detalle de una pieza, con su guion y «Hacer uno así»: el de la computadora, en una hoja. */}
      {pieza && (
        <DetallePieza
          p={piezas.find((x) => x.id === pieza.id) ?? pieza}
          nombre={nombre}
          cara={c.avatar}
          seguidores={pieza.canal === 'youtube'
            ? (c.youtube_suscriptores != null ? `${dibujarContador(c.youtube_suscriptores)} suscriptores` : null)
            : (c.instagram_seguidores != null ? `${dibujarContador(c.instagram_seguidores)} seguidores` : null)}
          todas={todasDeLaPieza}
          analizando={false}
          onCerrar={() => setHojaPieza(false)}
          marco={marcoHoja}
        />
      )}
      {buscador}
    </div>
  );
}
