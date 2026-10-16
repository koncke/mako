'use client';

// =============================================================================
// Content Machine — la fábrica de guiones de anuncios
// =============================================================================
// LA UNA COSA: al entrar, el dueño no quiere filtrar ni navegar. Quiere el
// próximo anuncio escrito. De ahí sale todo el orden de la pantalla:
//
//   · UNA sola acción primaria en las vistas de la matriz (Anuncios y Guiones):
//     «Escribir el próximo guion». Elige la primera celda sin guion y dispara la
//     acción `guion-auto` que ya existe en la API — cero backend nuevo. En
//     «Analizar guion» el header la esconde: ahí la primaria es «Valorar guion».
//   · La COBERTURA arriba («12 de 18 anuncios con guion · 3 listos para grabar»)
//     porque los huecos son el producto: lo que falta escribir ES el trabajo.
//   · El dorado NO aparece en ningún otro lado. Es el color de «acá intervino
//     MaKo» (ver la regla en app/globals.css) y gastarlo en un chip de categoría
//     lo vuelve mudo. Los ángulos pasaron a <Tag> neutro.
//
// Las vistas quedan MONTADAS y se ocultan con `display`, nunca se desmontan:
// es lo que hace que un «Nuevo guion» a medias sobreviva a ir a mirar la lista.
//
// ── LA TERCERA VISTA, «Analizar guion» (11/10/2026) ─────────────────────────
// Lo que EJECUTABA Ads Analyst (valorar un guion nuevo, sincronizar, ángulos y
// avatares) se mudó acá; su análisis, a la hoja «Ads Analyst» del Dashboard.
// La vista viaja en `?tab=` (./tabs.ts): la page la lee en el server y, para
// «analizar», arma la vista entera allá (lee la base) y la manda ya dibujada
// por la prop `analizar` — mismo molde que Análisis en app/experimentos.
// Tocar una vista la escribe de vuelta con el router de la casa (conserva el
// ?ws=), y eso es un viaje al server: así «Analizar guion» llega con sus datos.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { MatrizView } from '../onboarding/MatrizView';
import { GuionesGlobal } from './GuionesGlobal';
import { MakoStar } from '../_components/MakoBrand';
import { PageHeader, Button, ErrorState, Spinner, useConfirm } from '../_ui';
import { useRouter } from '../_ui/Link';
import type { EstadoGuion, GuionItem } from '../onboarding/guion-ui';
import { hrefDeVista, VISTA_POR_DEFECTO, type VistaAdsWriter } from './tabs';
// La cobertura y «el próximo guion» viven en un módulo puro (./reglas.ts): el teléfono
// (app/m/copywriting) escribe en la MISMA celda que esta pantalla (tests/m-copywriting.test.ts falla
// si vuelven a estar inline).
import { coberturaDe, proximaCeldaDe } from './reglas';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Vista = VistaAdsWriter;
type Avatar = { id: string; nombre: string; segmento: string };
type Celda = { id: string; avatarId: string; nombre: string; guiones: GuionItem[] };
type AnguloLite = { id: string; nombre: string; emoji: string };

export function AdsWriterApp({ tabInicial = VISTA_POR_DEFECTO, analizar = null }: {
  /** La vista que pide la URL (`?tab=`), resuelta en el server con `tabDeUrl` (./tabs.ts). */
  tabInicial?: Vista;
  /** «Analizar guion» ya dibujada en el server. null = este pedido no la trajo (la URL nombra otra vista). */
  analizar?: ReactNode | null;
}) {
  // El valor de la URL manda al montar, y desde ahí la vista es de quien la usa…
  const [vista, setVista] = useState<Vista>(tabInicial);
  // …salvo que el SERVER mande otra: pasa si se llega a /ads-writer con otro ?tab= sin desmontar
  // esta pantalla (el link de la barra estando en «Analizar guion», por ejemplo). Es el patrón de
  // React para ajustar el estado cuando cambia una prop: durante el render, sin efecto.
  const [tabDelServer, setTabDelServer] = useState<Vista>(tabInicial);
  if (tabInicial !== tabDelServer) {
    setTabDelServer(tabInicial);
    setVista(tabInicial);
  }
  // «Analizar guion» se guarda la ÚLTIMA que mandó el server: al volver a Anuncios el server ya no la
  // manda (null), y si se soltara se desmontaría con el guion que la persona estaba pegando. Cuando
  // llega una nueva (al volver, o tras un refresh) React la reconcilia en el mismo lugar: cambian los
  // datos, se conserva lo escrito.
  const [analizarVivo, setAnalizarVivo] = useState<ReactNode | null>(analizar);
  const [analizarDelServer, setAnalizarDelServer] = useState<ReactNode | null>(analizar);
  if (analizar !== analizarDelServer) {
    setAnalizarDelServer(analizar);
    if (analizar != null) setAnalizarVivo(analizar);
  }
  const router = useRouter();
  const [celdas, setCeldas] = useState<Celda[]>([]);
  const [avatares, setAvatares] = useState<Avatar[]>([]);
  const [angulos, setAngulos] = useState<AnguloLite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [escribiendo, setEscribiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saltarA, setSaltarA] = useState<string | null>(null);
  const [tokenMatriz, setTokenMatriz] = useState(0);
  const { confirm, confirmNode } = useConfirm();

  // La vista se cambia en el acto y se escribe en la URL con el ROUTER de la casa
  // (conserva el ?ws=; AGENTS.md, «la tab viaja en ?tab= leída en el server y
  // escrita con router.replace»). Con history.replaceState el árbol del router
  // quedaba con la vista vieja y atrás/adelante pintaba otra (lo midió
  // Experimentos el 11/10). La URL se arma desde la ACTUAL para no perder lo que
  // traiga el link. Tocar la vista que ya está abierta no viaja.
  const cambiarVista = (v: Vista) => {
    if (v === vista) return;
    setVista(v);
    let destino = v === VISTA_POR_DEFECTO ? '/ads-writer' : `/ads-writer?tab=${v}`;
    try { destino = hrefDeVista(window.location.href, v); } catch { /* sin URL: el destino mínimo */ }
    router.replace(destino, { scroll: false });
  };

  const cargar = useCallback(async () => {
    setCargando(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones')).json();
      if (j.ok) {
        setCeldas(j.razones as Celda[]);
        setAvatares(j.avatares as Avatar[]);
        setAngulos((j.angulosGuion ?? []) as AnguloLite[]);
      } else setErr(j.error || 'No se pudieron cargar los guiones.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo guardar el cambio.'); return false; }
      setCeldas(j.razones as Celda[]);
      setAvatares(j.avatares as Avatar[]);
      setAngulos((j.angulosGuion ?? []) as AnguloLite[]);
      setTokenMatriz((t) => t + 1);
      return true;
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); return false; }
  }, []);

  // ── Cobertura: el KPI de la fábrica, sin necesidad de una card ─────────────
  const cobertura = useMemo(() => coberturaDe(celdas), [celdas]);

  /** La primera celda sin guion, en orden avatar → razón. Es a la que apunta la
   *  acción primaria: escribir lo que falta, no lo que ya está. */
  const proximaCelda = useMemo(() => proximaCeldaDe(celdas, avatares), [celdas, avatares]);

  const escribirProximo = async () => {
    // Sin matriz todavía no hay nada que escribir: lo primero es armarla. Antes
    // este botón (y el «Escribir el primero» del estado vacío) no hacía nada.
    if (!celdas.length) { await rehacerMatriz(); return; }
    const celda = proximaCelda;
    if (!celda) return;
    setEscribiendo(true); cambiarVista('anuncios');
    const ok = await post({ action: 'guion-auto', id: celda.id });
    setEscribiendo(false);
    // Y se MUESTRA lo que escribió. Antes terminaba en la grilla con la celda
    // cerrada: 30-60 segundos de espera y ninguna señal de dónde quedó el guion.
    if (ok) setSaltarA(celda.id);
  };

  const cambiarEstado = async (celdaId: string, guionId: string, estado: EstadoGuion) => {
    // Optimista: el chip responde en el acto y el POST confirma. Si falla, VUELVE
    // ATRÁS — sin esto el chip se quedaba pintado en el estado nuevo mientras el
    // servidor tenía el viejo, y la pantalla afirmaba algo falso hasta recargar.
    const antes = celdas;
    setCeldas((cs) => cs.map((c) => (c.id === celdaId ? { ...c, guiones: c.guiones.map((g) => (g.id === guionId ? { ...g, estado } : g)) } : c)));
    const ok = await post({ action: 'guion-estado', id: celdaId, guionId, estado });
    if (!ok) setCeldas(antes);
  };

  // El chip ya no cicla de «publicado» a «borrador» de un clic suelto (en una
  // tarjeta de galería eso despublicaba por error). La vuelta atrás existe, pero
  // preguntando — y aclarando que no toca nada en Meta.
  const retrocederEstado = async (celdaId: string, guionId: string) => {
    const ok = await confirm('Este guion figura como publicado. Volverlo a borrador no toca el anuncio en Meta, solo cómo se ve aquí.', {
      title: '¿Volver a borrador?', confirmLabel: 'Volver a borrador', danger: false,
    });
    if (ok) cambiarEstado(celdaId, guionId, 'borrador');
  };

  // ⚠️ Borrar y editar NUNCA mandan la matriz entera. La acción `guardar` la
  // REEMPLAZA con lo que reciba, y esta pantalla tiene una copia que se queda
  // vieja apenas la vista Anuncios escribe algo por su cuenta: guardar un cambio
  // chico con esa copia borraba los guiones recién generados. Estas dos acciones
  // releen del servidor y tocan un solo guion.
  const borrarGuion = async (celdaId: string, guionId: string) => {
    const ok = await confirm('Este guion se borra y no se puede recuperar.', { title: '¿Borrar el guion?' });
    if (!ok) return false;
    return post({ action: 'guion-borrar', id: celdaId, guionId });
  };

  const editarGuion = (celdaId: string, guionId: string, texto: string) =>
    post({ action: 'guion-texto', id: celdaId, guionId, texto });

  const irAMatriz = (celdaId: string) => { setSaltarA(celdaId); cambiarVista('anuncios'); };

  // «Rehacer la matriz» BORRA todos los guiones escritos: el route reemplaza las
  // celdas por unas nuevas con `guiones: []`. Antes no preguntaba nada.
  const rehacerMatriz = async () => {
    const ok = await confirm(
      cobertura.guiones
        ? `Rehacer la matriz borra los ${cobertura.guiones} guiones escritos, con su estado. No se puede deshacer.`
        : 'Se van a reemplazar los anuncios de la matriz por unos nuevos.',
      { title: '¿Rehacer la matriz?', confirmLabel: 'Rehacer' },
    );
    if (!ok) return;
    setCargando(true);
    await post({ action: 'generar' });
    setCargando(false);
  };

  // «Analizar guion» no lleva número: su historial lo trae el server sólo cuando
  // se la pide, y un número que aparece recién al visitarla se lee como que cambió.
  const vistas: Array<{ k: Vista; label: string; n?: number }> = [
    { k: 'anuncios', label: 'Anuncios', n: cobertura.total },
    { k: 'guiones', label: 'Guiones', n: cobertura.guiones },
    { k: 'analizar', label: 'Analizar guion' },
  ];

  // El header se arma MIENTRAS carga, no después: esconder las tabs y la acción
  // hasta que lleguen los datos deja un encabezado pelado que después salta.
  // Solo cuando ya cargó y de verdad no hay matriz, la pantalla queda al mando
  // del estado vacío de la vista Anuncios (que es el que sabe qué falta).
  const hayMatriz = cobertura.total > 0;
  const armado = hayMatriz || cargando;
  // «Analizar guion» no depende de la matriz: ahí las vistas se ven siempre (si
  // no, quien llega por el link de valorar un guion sin matriz armada no tiene
  // por dónde ir a armarla). Y la acción primaria del header es la de la matriz:
  // en esta vista la primaria es «Valorar guion», y dos primarias no son una.
  const enAnalizar = vista === 'analizar';
  const conVistas = armado || enAnalizar;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 22px 64px' }}>
      <PageHeader
        titulo="Content Machine"
        proposito="Qué anuncio grabas después, y con qué texto."
        estado={hayMatriz ? (
          // Las unidades tienen que cerrar: conGuion/total cuentan ANUNCIOS y
          // `listos` cuenta GUIONES (una celda puede tener varios aprobados).
          // Mezclarlos en una frase cuyo sujeto es «anuncios» daba números que no
          // cuadraban: «1 de 18 anuncios con guion · 3 listos para grabar».
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            <b style={num}>{cobertura.conGuion}</b> de <b style={num}>{cobertura.total}</b> anuncios con guion
            {cobertura.listos > 0 && <> · <b style={num}>{cobertura.listos}</b> {cobertura.listos === 1 ? 'guion listo' : 'guiones listos'} para grabar</>}
          </span>
        ) : undefined}
        accion={armado && !enAnalizar ? (
          // Cuando ya no queda nada por escribir el botón se APAGA. Antes seguía
          // clickeable, con la chispa de MaKo y todo, y lo único que hacía era
          // cambiarte de tab sin avisar.
          <Button variant="mako" icon={<MakoStar size={15} color="#17140C" />} loading={escribiendo}
            disabled={hayMatriz && !proximaCelda} onClick={escribirProximo}>
            {hayMatriz && !proximaCelda ? 'Todos tienen guion' : 'Escribir el próximo guion'}
          </Button>
        ) : undefined}
        acciones={hayMatriz && !enAnalizar ? <Button variant="tertiary" onClick={rehacerMatriz}>Rehacer la matriz</Button> : undefined}
        tabs={conVistas ? (
          // Con `flex-wrap`: una barra de vistas no scrollea de costado (app/_ui/LEEME.md).
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 'var(--sect-gap)' }}>
            {vistas.map((v) => {
              const on = vista === v.k;
              return (
                <button key={v.k} type="button" onClick={() => cambiarVista(v.k)} aria-pressed={on} style={{
                  border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`,
                  background: 'none', color: on ? 'var(--ink)' : 'var(--dim)',
                  fontFamily: SANS, fontWeight: on ? 600 : 500, fontSize: 'var(--fs-md)',
                  padding: '10px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
                }}>
                  {v.label}
                  {v.n != null && <span style={{ fontFamily: MONO, fontSize: 'var(--fs-meta)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{v.n}</span>}
                </button>
              );
            })}
          </div>
        ) : undefined}
      />

      {/* El error de la matriz: en «Analizar guion» no se usa, y su cartel taparía una vista que anda. */}
      {err && !enAnalizar && <div style={{ marginBottom: 16 }}><ErrorState detalle="No se pudo hablar con el servidor." onReintentar={cargar} detalleTecnico={err} inline /></div>}

      {/* Las tres montadas: cambiar de vista no puede tirar un guion a medias. */}
      <div style={{ display: vista === 'anuncios' ? 'block' : 'none' }}>
        {/* sinCabecera: el título y «Rehacer la matriz» ya están en el PageHeader
            de esta pantalla. En el hub de onboarding la matriz sí trae los suyos. */}
        {/* onCambio: la matriz escribe por su cuenta (generar guion, editar copy).
            Sin este aviso, la cobertura del header, «el próximo guion» y la
            galería se quedaban con datos de antes — y el próximo guardado los
            pisaba. sinCabecera: el título y «Rehacer la matriz» ya están arriba. */}
        <MatrizView sinCabecera onCambio={cargar}
          abrirCeldaId={saltarA} onAbrioCelda={() => setSaltarA(null)} recargarToken={tokenMatriz} />
      </div>
      <div style={{ display: vista === 'guiones' ? 'block' : 'none' }}>
        <GuionesGlobal
          celdas={celdas} avatares={avatares} angulos={angulos} cargando={cargando}
          onEstado={cambiarEstado} onRetroceder={retrocederEstado} onBorrar={borrarGuion}
          onIrAMatriz={irAMatriz} onEditar={editarGuion} onEscribirPrimero={escribirProximo}
        />
      </div>
      {/* «Analizar guion» se monta la primera vez que hace falta y desde ahí se queda (ver
          `analizarVivo`). Mientras el server la arma por primera vez, el giro: es una lectura de
          la base, no una corrida de IA. */}
      {(analizarVivo != null || enAnalizar) && (
        <div style={{ display: enAnalizar ? 'block' : 'none' }}>
          {analizarVivo ?? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--faint)' }}>
              <Spinner size={22} />
            </div>
          )}
        </div>
      )}

      {confirmNode}
    </div>
  );
}

const num: CSSProperties = { color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' };
