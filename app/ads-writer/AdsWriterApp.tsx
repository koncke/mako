'use client';

// =============================================================================
// Content Machine — la fábrica de guiones de anuncios
// =============================================================================
// LA UNA COSA: al entrar, el dueño no quiere filtrar ni navegar. Quiere el
// próximo anuncio escrito. De ahí sale todo el orden de la pantalla:
//
//   · UNA sola acción primaria en toda la tab: «Escribir el próximo guion».
//     Elige la primera celda sin guion y dispara la acción `guion-auto` que ya
//     existe en la API — cero backend nuevo.
//   · La COBERTURA arriba («12 de 18 anuncios con guion · 3 listos para grabar»)
//     porque los huecos son el producto: lo que falta escribir ES el trabajo.
//   · El dorado NO aparece en ningún otro lado. Es el color de «acá intervino
//     MaKo» (ver la regla en app/globals.css) y gastarlo en un chip de categoría
//     lo vuelve mudo. Los ángulos pasaron a <Tag> neutro.
//
// Las dos vistas quedan MONTADAS y se ocultan con `display`, nunca se desmontan:
// es lo que hace que un «Nuevo guion» a medias sobreviva a ir a mirar la lista.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { MatrizView } from '../onboarding/MatrizView';
import { GuionesGlobal } from './GuionesGlobal';
import { MakoStar } from '../_components/MakoBrand';
import { PageHeader, Button, ErrorState, useConfirm } from '../_ui';
import type { EstadoGuion, GuionItem } from '../onboarding/guion-ui';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Vista = 'anuncios' | 'guiones';
type Avatar = { id: string; nombre: string; segmento: string };
type Celda = { id: string; avatarId: string; nombre: string; guiones: GuionItem[] };
type AnguloLite = { id: string; nombre: string; emoji: string };

export function AdsWriterApp() {
  const [vista, setVista] = useState<Vista>('anuncios');
  const [celdas, setCeldas] = useState<Celda[]>([]);
  const [avatares, setAvatares] = useState<Avatar[]>([]);
  const [angulos, setAngulos] = useState<AnguloLite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [escribiendo, setEscribiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saltarA, setSaltarA] = useState<string | null>(null);
  const [tokenMatriz, setTokenMatriz] = useState(0);
  const { confirm, confirmNode } = useConfirm();

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
  const cobertura = useMemo(() => {
    const conGuion = celdas.filter((c) => c.guiones.length).length;
    const listos = celdas.reduce((n, c) => n + c.guiones.filter((g) => g.estado === 'aprobado').length, 0);
    const guiones = celdas.reduce((n, c) => n + c.guiones.length, 0);
    return { conGuion, total: celdas.length, listos, guiones };
  }, [celdas]);

  /** La primera celda sin guion, en orden avatar → razón. Es a la que apunta la
   *  acción primaria: escribir lo que falta, no lo que ya está. */
  const proximaCelda = useMemo(() => {
    for (const av of avatares) {
      const c = celdas.find((x) => x.avatarId === av.id && !x.guiones.length);
      if (c) return c;
    }
    return celdas.find((c) => !c.guiones.length) ?? null;
  }, [celdas, avatares]);

  const escribirProximo = async () => {
    // Sin matriz todavía no hay nada que escribir: lo primero es armarla. Antes
    // este botón (y el «Escribir el primero» del estado vacío) no hacía nada.
    if (!celdas.length) { await rehacerMatriz(); return; }
    const celda = proximaCelda;
    if (!celda) return;
    setEscribiendo(true); setVista('anuncios');
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
    const ok = await confirm('Este guion figura como publicado. Volverlo a borrador no toca el anuncio en Meta, solo cómo se ve acá.', {
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

  const irAMatriz = (celdaId: string) => { setSaltarA(celdaId); setVista('anuncios'); };

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

  const vistas: Array<{ k: Vista; label: string; n: number }> = [
    { k: 'anuncios', label: 'Anuncios', n: cobertura.total },
    { k: 'guiones', label: 'Guiones', n: cobertura.guiones },
  ];

  // El header se arma MIENTRAS carga, no después: esconder las tabs y la acción
  // hasta que lleguen los datos deja un encabezado pelado que después salta.
  // Solo cuando ya cargó y de verdad no hay matriz, la pantalla queda al mando
  // del estado vacío de la vista Anuncios (que es el que sabe qué falta).
  const hayMatriz = cobertura.total > 0;
  const armado = hayMatriz || cargando;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 22px 64px' }}>
      <PageHeader
        titulo="Content Machine"
        proposito="Qué anuncio grabás después, y con qué texto."
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
        accion={armado ? (
          // Cuando ya no queda nada por escribir el botón se APAGA. Antes seguía
          // clickeable, con la chispa de MaKo y todo, y lo único que hacía era
          // cambiarte de tab sin avisar.
          <Button variant="mako" icon={<MakoStar size={15} color="#17140C" />} loading={escribiendo}
            disabled={hayMatriz && !proximaCelda} onClick={escribirProximo}>
            {hayMatriz && !proximaCelda ? 'Todos tienen guion' : 'Escribir el próximo guion'}
          </Button>
        ) : undefined}
        acciones={hayMatriz ? <Button variant="tertiary" onClick={rehacerMatriz}>Rehacer la matriz</Button> : undefined}
        tabs={armado ? (
          <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 'var(--sect-gap)' }}>
            {vistas.map((v) => {
              const on = vista === v.k;
              return (
                <button key={v.k} type="button" onClick={() => setVista(v.k)} style={{
                  border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`,
                  background: 'none', color: on ? 'var(--ink)' : 'var(--dim)',
                  fontFamily: SANS, fontWeight: on ? 600 : 500, fontSize: 'var(--fs-md)',
                  padding: '10px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
                }}>
                  {v.label}
                  <span style={{ fontFamily: MONO, fontSize: 'var(--fs-meta)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{v.n}</span>
                </button>
              );
            })}
          </div>
        ) : undefined}
      />

      {err && <div style={{ marginBottom: 16 }}><ErrorState detalle="No se pudo hablar con el servidor." onReintentar={cargar} detalleTecnico={err} inline /></div>}

      {/* Las dos montadas: cambiar de vista no puede tirar un guion a medias. */}
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

      {confirmNode}
    </div>
  );
}

const num: CSSProperties = { color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' };
