'use client';

// =============================================================================
// ProbarTracking — el "Test Events" de MaKo para la landing
// =============================================================================
// El equivalente al Pixel Helper de Meta. El botón "Verificar" de antes solo
// decía si ALGUNA VEZ llegó un evento — y estuvo en verde tres semanas mientras
// el VSL no medía nada, porque llegaban los plays pero ningún avance.
//
// Esto abre una sesión de prueba: mientras está prendida consulta cada 3s y
// muestra los eventos ENTRANDO, más los chequeos que dicen qué anda y qué no
// (incluido si la landing tiene el código VIEJO, que es el error más común: se
// pega una vez y queda congelado ahí para siempre).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, Input, Select } from '@/app/_ui';
import { IconBtn } from './ServicioConfigForm';
import { Icon } from '@/app/_components/icons';
import { mismaPagina } from '@/lib/landing-paginas';
import type { VideoLanding } from '@/lib/landing-videos';
import { NombrarVideos, type VideoDetectado } from './NombrarVideos';
import { borrarPaginaAction, getPaginasAction, guardarPaginaAction } from './landing-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Evento = { ts: string; tipo: string; porcentaje: number | null; segundos: number | null; detalle: string | null };
type Chequeo = { id: string; label: string; estado: 'ok' | 'falta' | 'viejo'; detalle: string; accion?: { texto: string; href: string } };
type Diag = {
  eventos: Evento[]; chequeos: Chequeo[]; veredicto: string; urls: string[]; codigoViejo: boolean; ultima: string | null;
  /** Los videos que el sistema VIO en los eventos, y los que el negocio nombró. */
  videosDetectados: VideoDetectado[]; videos: VideoLanding[];
};

const hora = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('es-MX', { hour12: false }); };

/** Cómo se lee cada evento crudo. Los tipos técnicos no se muestran pelados. */
function legible(e: Evento): { texto: string; color: string } {
  if (e.tipo === 'pageview') return { texto: 'Visitó la landing', color: 'var(--dim)' };
  if (e.tipo === 'play') return { texto: 'Arrancó el VSL', color: 'var(--primary)' };
  if (e.tipo === 'exit') return { texto: e.porcentaje != null ? `Salió en el ${e.porcentaje}%` : 'Salió del VSL', color: 'var(--bad)' };
  const m = /^p(\d+)$/.exec(e.tipo);
  if (m) return { texto: `Llegó al ${m[1]}% del VSL`, color: 'var(--good)' };
  const s = /^s(\d+)$/.exec(e.tipo);
  if (s) return { texto: `Vio ${s[1]} segundos`, color: 'var(--good)' };
  // ⚠️ «desconocido» NO es un evento: es lo que el beacon escribe cuando le llega
  // un tipo que no sabe clasificar (código viejo o modificado). Mostrarlo crudo
  // hacía aparecer la palabra «desconocido» en la lista, que se lee como que algo
  // se rompió — cuando lo que dice es que ese evento no se pudo interpretar.
  // El click trae su destino en `detalle`, y eso es lo que hay que mostrar: «hizo
  // click» sin decir en qué no distingue el botón de WhatsApp del de arriba.
  if (e.tipo === 'click') return { texto: e.detalle ? `Hizo click: ${e.detalle}` : 'Hizo click', color: 'var(--primary)' };
  if (e.tipo === 'desconocido') return { texto: 'Evento que no reconozco (código viejo o modificado)', color: 'var(--warn)' };
  return { texto: e.tipo, color: 'var(--dim)' };
}

const ICONO: Record<string, string> = { ok: '✓', falta: '○', viejo: '!' };
const COLOR: Record<string, string> = { ok: 'var(--good)', falta: 'var(--faint)', viejo: 'var(--warn)' };

/** La landing elegida para probar. Se recuerda para no volver a tipearla. */
const URL_KEY = 'mako.landing.url_prueba';
/** Valor centinela de la última opción del desplegable. */
const NUEVA = '__nueva__';

export function ProbarTracking() {
  const [activo, setActivo] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [previo, setPrevio] = useState<Diag | null>(null); // estado ANTES de arrancar
  const [bloqueo, setBloqueo] = useState(false); // apretó "probar" con el código viejo
  const [eligiendoNueva, setEligiendoNueva] = useState(false); // eligió "Otra página…"
  const [paginas, setPaginas] = useState<string[]>([]);        // las GUARDADAS del workspace
  const [ocultas, setOcultas] = useState<string[]>([]);        // las que sacó de la lista a mano
  const [editando, setEditando] = useState<string | null>(null); // la que se está corrigiendo
  const [errPagina, setErrPagina] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Sin esquema también vale: «tu-pagina.com» es lo que la gente escribe, y el
  // server lo normaliza. Acá solo se pide que tenga un punto.
  const urlValida = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}/i.test(url.trim());
  // ⚠️ NORMALIZADO en las dos puntas. Comparar los strings crudos hacía
  // desaparecer los botones justo después de guardar: la lista queda con
  // «https://x.com» y el estado con lo que se tipeó, «x.com».
  const guardadaElegida = paginas.some((p) => mismaPagina(p, url));
  // Detectadas por los eventos: ni guardadas ni escondidas a mano.
  const detectadas = (previo?.urls ?? []).filter(
    (u) => !paginas.some((p) => mismaPagina(p, u)) && !ocultas.some((o) => mismaPagina(o, u)),
  );
  // ⚠️ Los botones van sobre CUALQUIER página elegida, no solo sobre una
  // guardada. La versión anterior los gateaba en `guardadaElegida` con el
  // argumento de que una detectada «todavía no es de nadie» — y el resultado fue
  // que quien nunca guardó una a mano (todas detectadas, que es el caso normal)
  // no veía un solo botón y la función entera era invisible. Una página
  // detectada SÍ es suya: la diferencia es cómo nos enteramos, no de quién es.
  const hayElegida = !!url.trim() && !eligiendoNueva;

  const aplicar = (r: { paginas: string[]; ocultas: string[] }) => { setPaginas(r.paginas); setOcultas(r.ocultas); };

  const guardar = async () => {
    setOcupado(true); setErrPagina(null);
    const r = await guardarPaginaAction(url, editando);
    setOcupado(false);
    if (!r.ok) { setErrPagina(r.error); return; }
    aplicar(r);
    // Se queda seleccionada la que se acaba de guardar: si el desplegable
    // volviera a vacío, guardar se sentiría como que no pasó nada. Se busca por
    // comparación normalizada, no por `includes` de substring —que hacía match
    // con cualquier URL que contuviera a esta como prefijo.
    setUrl(r.paginas.find((u) => mismaPagina(u, url)) ?? url.trim());
    setEligiendoNueva(false);
    setEditando(null);
  };

  const borrar = async (cual?: string) => {
    const u = cual ?? url;
    setOcupado(true); setErrPagina(null);
    const r = await borrarPaginaAction(u);
    setOcupado(false);
    if (!r.ok) { setErrPagina(r.error); return; }
    aplicar(r);
    // Solo se deselecciona si se borró LA elegida: quitar otra de la lista no
    // tiene por qué hacerte perder la que estabas por probar.
    if (mismaPagina(u, url)) setUrl('');
  };

  /**
   * Corregir y quitar, DENTRO de cada renglón del desplegable.
   *
   * Los mismos dos botones están afuera y actúan sobre la elegida; estos actúan
   * sobre el renglón. No es redundancia: hacerlo solo desde afuera obliga a
   * SELECCIONAR una página para poder sacarla — o sea, a elegir justo lo que
   * querés que desaparezca. Con siete renglones de la misma landing, eso es el
   * caso normal, no el raro.
   */
  const accionesDe = (u: string) => [
    { icono: <Icon name="pen" size={14} />, title: 'Corregir esta dirección', onClick: () => { setUrl(u); setEditando(paginas.some((p) => mismaPagina(p, u)) ? u : null); setEligiendoNueva(true); } },
    { icono: <Icon name="trash" size={14} />, title: 'Quitarla de la lista', tone: 'bad' as const, onClick: () => { void borrar(u); } },
  ];
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const traer = useCallback(async (guardarEn?: (d: Diag) => void) => {
    try {
      const r = await fetch('/api/integraciones/landing/estado?diag=1', { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok) {
        const d: Diag = { eventos: r.eventos ?? [], chequeos: r.chequeos ?? [], veredicto: r.veredicto ?? '', urls: r.urls ?? [], codigoViejo: !!r.codigoViejo, ultima: r.ultima ?? null, videosDetectados: r.videosDetectados ?? [], videos: r.videos ?? [] };
        (guardarEn ?? setDiag)(d);
        setErr(null);
      } else setErr(r?.error ?? 'No se pudo consultar');
    } catch { setErr('No se pudo consultar'); }
    finally { setCargando(false); }
  }, []);

  // Antes de arrancar se consulta UNA vez: hace falta saber si el código está
  // viejo (para no dejar probar) y qué landings ya mandaron eventos (para poder
  // ofrecerlas en vez de pedir que las tipee).
  useEffect(() => {
    if (activo) return;
    traer(setPrevio);
    // Las guardadas viven en el WORKSPACE, no en este navegador: si vivieran en
    // localStorage, cambiar de máquina o de sesión las perdería, y no serían
    // «mis páginas» sino «las páginas de esta compu».
    getPaginasAction().then(aplicar).catch(() => { /* sin lista, se puede agregar */ });
    try { setUrl(localStorage.getItem(URL_KEY) ?? ''); } catch { /* sin storage */ }
  }, [activo, traer]);

  // Mientras la prueba está prendida, consulta cada 3s. Se apaga sola al cerrar
  // el modal (cleanup) para no dejar un poll corriendo de fondo.
  useEffect(() => {
    if (!activo) { if (timer.current) { clearInterval(timer.current); timer.current = null; } return; }
    setCargando(true);
    traer();
    timer.current = setInterval(traer, 3000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [activo, traer]);

  const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface-2)', padding: 16, fontFamily: SANS };

  // ⚠️ CON EL CÓDIGO VIEJO NO SE PRUEBA. Probar sobre un snippet desactualizado
  // da un resultado que no significa nada: los chequeos nuevos van a fallar
  // SIEMPRE —el código que está pegado no manda esos eventos— y la persona sale
  // creyendo que su landing está rota cuando lo único que pasa es que hay que
  // volver a pegar el código.
  //
  // El aviso aparece al APRETAR, no en lugar del panel: esconder el botón deja la
  // sección sin su acción y sin explicar qué la reemplazó. La persona viene a
  // probar; lo que corresponde es dejarla intentar y decirle ahí por qué todavía no.
  const arrancar = async () => {
    // ⚠️ SE VUELVE A PREGUNTAR, no se le cree a lo que se leyó al abrir el modal.
    // El caso real: la persona actualiza el código, recarga su landing y aprieta
    // «Probar» — pero el `previo` es de cuando abrió la pantalla, así que le
    // seguía diciendo «tenés el código viejo» sobre algo que ya había arreglado.
    // Un estado que gobierna un bloqueo se relee en el momento de bloquear.
    setOcupado(true);
    let viejo = previo?.codigoViejo ?? false;
    try {
      const r = await fetch('/api/integraciones/landing/estado?diag=1', { cache: 'no-store' }).then((x) => x.json());
      if (r?.ok) { viejo = !!r.codigoViejo; setPrevio((p) => (p ? { ...p, codigoViejo: viejo, urls: r.urls ?? p.urls } : p)); }
    } catch { /* sin respuesta, vale lo último que sabíamos */ }
    setOcupado(false);
    if (viejo) { setBloqueo(true); return; }

    const u = url.trim();
    // Probar una página la GUARDA. Si no, la próxima vez hay que volver a
    // elegirla de las detectadas o a escribirla — y el desplegable dice
    // «se guarda al probarla», así que tiene que cumplirlo.
    if (!guardadaElegida) void guardarPaginaAction(u).then((r) => { if (r.ok) aplicar(r); });
    try { localStorage.setItem(URL_KEY, u); } catch { /* sin storage */ }
    window.open(u, '_blank', 'noopener');
    setActivo(true);
  };

  const avisoViejo = bloqueo && (
    <div style={{ marginTop: 12, padding: '13px 15px', borderRadius: 11, border: '1px solid var(--warn)', background: 'var(--warn-bg)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Primero actualizá el código</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4, lineHeight: 1.55 }}>
        El que tenés pegado es de una versión anterior, así que probarlo no te va a decir nada útil:
        los chequeos nuevos van a fallar porque ese código todavía no los manda.
        <b> Copiá el código de arriba, reemplazalo en tu página y volvé acá.</b>
      </div>
    </div>
  );

  if (!activo) {
    return (
      <div style={box}>
        <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Probar que el código funciona</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
          Elegí cuál de tus páginas querés probar. La abrimos en otra pestaña y acá ves llegar los eventos en vivo.
        </div>

        {/* UN desplegable, no un desplegable AL LADO de un input. Las páginas que
            ya mandaron eventos las conoce el sistema; la última opción es la
            salida para una nueva, y recién ahí aparece dónde escribirla. Dos
            campos que hacen lo mismo obligan a elegir cuál usar antes de poder
            contestar la pregunta.
            Y es el `Select` de la casa: el <select> nativo está prohibido —no se
            puede estilar igual en todos los navegadores— y además este se
            renderiza en portal, así que el scroll del modal no lo recorta. */}
        <div style={{ marginTop: 14 }}>
          {/* Las GUARDADAS primero, después las que se detectaron solas por los
              eventos. La distinción importa: una guardada se puede corregir y
              borrar; una detectada es una observación, y elegirla la adopta. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Select
                ariaLabel="Página a probar"
                value={eligiendoNueva ? NUEVA : url}
                onChange={(v) => { setUrl(v === NUEVA ? '' : v); setEligiendoNueva(v === NUEVA); setEditando(null); }}
                placeholder="Elegí una página…"
                options={[
                  ...paginas.map((u) => ({ value: u, label: u, acciones: accionesDe(u) })),
                  ...detectadas.map((u) => ({ value: u, label: u, sub: 'detectada — se guarda al probarla', acciones: accionesDe(u) })),
                  { value: NUEVA, label: 'Otra página…', sub: 'escribí la dirección' },
                ]}
              />
            </div>
            {/* Corregir y quitar, sobre la que esté elegida sea guardada o
                detectada. Al corregir una detectada, guardarla la ADOPTA — que
                es justo lo que hace falta cuando lo que llegó por los eventos es
                una URL de preview con un hash adelante y no la página real.
                `editando` solo viaja si estaba guardada: para una detectada no
                hay entrada previa que reemplazar, y mandarla haría que el server
                buscara algo que no está. */}
            {hayElegida && (
              <>
                <IconBtn name="pen" title="Corregir esta dirección" onClick={() => { setEditando(guardadaElegida ? url : null); setEligiendoNueva(true); }} />
                <IconBtn name="trash" title="Quitarla de la lista" tone="bad" disabled={ocupado} onClick={() => void borrar()} />
              </>
            )}
          </div>

          {/* El campo aparece solo cuando hace falta: escribir una nueva o
              corregir una que ya está. Un campo vacío al lado del desplegable es
              una pregunta de más en el 90% de los casos. */}
          {eligiendoNueva && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 9 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-pagina.com" inputMode="url" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && urlValida) void guardar(); }} />
              </div>
              <IconBtn name="check" title={editando ? 'Guardar el cambio' : 'Guardar esta página'} tone="good" disabled={!urlValida || ocupado} onClick={() => void guardar()} />
            </div>
          )}
          {errPagina && <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--bad)' }}>{errPagina}</div>}
        </div>

        {/* UN solo botón. Siempre abre la página en otra pestaña: si la prueba
            depende de que la persona se acuerde de abrirla, la prueba no arranca. */}
        <div style={{ marginTop: 14 }}>
          <Button variant="primary" onClick={() => void arrancar()} loading={ocupado} disabled={!urlValida}>Probar</Button>
        </div>

        {avisoViejo}

        {/* Qué es cada video. Vive acá abajo y no en su propio panel porque
            contesta la misma pregunta que la prueba —«¿esto está midiendo lo que
            creo?»— y porque los videos que ofrece salen de los MISMOS eventos que
            los chequeos: separarlos en dos tarjetas obligaría a dos consultas y a
            explicar dos veces de dónde sale la lista. */}
        <NombrarVideos
          detectados={previo?.videosDetectados ?? []}
          videos={previo?.videos ?? []}
          onCambio={(v) => setPrevio((p) => (p ? { ...p, videos: v } : p))}
        />
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--good)', animation: 'pt-latido 1.4s infinite', flex: 'none' }} />
          <span style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>Escuchando… {diag ? `· ${diag.veredicto}` : ''}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setActivo(false)}>Terminar</Button>
      </div>
      <style>{'@keyframes pt-latido{0%,100%{opacity:1}50%{opacity:.25}}'}</style>

      {/* La instrucción cubre las DOS cosas que el código hace. Hasta el 14/08 solo
          hablaba del video, y para un negocio cuya landing es un formulario —el
          caso que destapó esto— la prueba entera parecía no ser para él. */}
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 12 }}>
        Abrí tu landing en otra pestaña y probá lo que uses: <b>reproducí el video</b> más de 15 segundos,
        y <b>completá tu propio formulario</b> con tu email. Los eventos aparecen acá en unos segundos.
      </div>

      {/* Los chequeos: qué anda y qué no, en criollo. El total lo dice el server
          (), no un número escrito acá: estuvo diciendo «de 4» cuando ya
          eran cinco. */}
      {diag && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {diag.chequeos.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: COLOR[c.estado] }}>{ICONO[c.estado]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: c.estado === 'ok' ? 'var(--ink)' : 'var(--dim)' }}>{c.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1, lineHeight: 1.45 }}>{c.detalle}</span>
                {/* El href lo arma el SERVER con el id real de la propuesta. Un
                    chequeo que dice «tenés 8 sin revisar» y no lleva a ningún
                    lado deja la misma tarea sin hacer que no decir nada. */}
                {c.accion && (
                  <a href={c.accion.href} style={{ display: 'inline-block', marginTop: 4, fontSize: 12.5, fontWeight: 650, color: 'var(--primary)' }}>{c.accion.texto} →</a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Los eventos crudos, como el Test Events de Meta. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', maxHeight: 260, overflowY: 'auto' }}>
        {cargando && !diag && <div style={{ padding: 16, fontSize: 13, color: 'var(--faint)' }}>Conectando…</div>}
        {diag && diag.eventos.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--faint)', lineHeight: 1.55 }}>
            Todavía no llegó nada en las últimas 24 h. Si ya abriste tu landing y no aparece nada, el código no está pegado o no se publicó.
          </div>
        )}
        {diag?.eventos.map((e, i) => {
          const l = legible(e);
          return (
            <div key={`${e.ts}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{hora(e.ts)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: l.color, flex: 1, minWidth: 0 }}>{l.texto}</span>
              {e.segundos != null && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{Math.round(e.segundos)}s</span>}
            </div>
          );
        })}
      </div>

      {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
