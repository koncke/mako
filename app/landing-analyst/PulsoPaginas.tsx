'use client';

// =============================================================================
// PulsoPaginas — la analítica por página del Pixel, dentro de Landing Analyst
// =============================================================================
// Contesta DOS preguntas y nada más, que son las dos que uno le hace a un mapa
// de calor:
//
//   · ¿LLEGAN A TU OFERTA? — la barra de profundidad de scroll.
//   · ¿QUÉ BOTÓN TOCAN?    — los clics por destino, con personas distintas.
//
// Lo demás que se podría dibujar con estos datos (una línea por día, un top de
// referrers) ya vive en el bloque «Lo que hace la gente» del diagnóstico: acá se
// agrega lo que NADIE estaba mirando, no se repite lo que ya se ve.
//
// ⚠️ EL MAPA DE CALOR DE PUNTOS NO ES ESTO. Para pintar dónde se hace clic en la
// página hacen falta las coordenadas del clic, y hoy el Pixel no las guarda
// (`vsl_events.detalle` tiene el destino, no el x/y). Esta pantalla es la mitad
// que ya se puede contestar con lo que está medido desde hace meses.
//
// ⚠️ Y UN CERO NO SE DIBUJA NUNCA SOBRE UNA LECTURA QUE FALLÓ. `fallas` dice qué
// bloque no se pudo leer y ese bloque lo dice en pantalla, en vez de mostrar un
// 0% que se lee como una conclusión. Es la regla de la casa y ya costó una
// medición fantasma.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, Banner, Alert, EmptyState, ErrorState, SkeletonLines, Section, Eyebrow, MONO } from '@/app/_ui';
// Las barras son las del repo, con su regla ya resuelta: una barra que se sale
// de la escala se recorta al 100% y SE VE que se recortó. Reescribirlas acá
// sería reescribir también el bug que ese recorte evita (un ancho de 1468% no
// desborda la barra: desborda la página).
import { Barras, Cifra, type Barra } from '@/app/admin/dev/pricing/Piezas';
import { PIXEL_CLICS_DESDE, PIXEL_SCROLL_DESDE, PIXEL_PAGINA_DESDE, type PulsoDatos, type PulsoPagina, type BloquePulso } from '@/lib/landing-pulso';

const LINK_PIXEL = '/integraciones';

function hostPath(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch { return url; }
}

function fecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/** El rótulo de un hito. El 100% no es «pasó el 100%»: es llegar al final. */
function rotuloHito(h: number): string {
  return h >= 100 ? 'Llegó al final' : `Pasó el ${h}%`;
}

/** De dónde a dónde se cae. `desde: 0` es el primer escalón: entrar y no bajar. */
function rotuloCaida(desde: number, hasta: number): string {
  return desde === 0 ? `entrar y el ${hasta}%` : `el ${desde}% y el ${hasta}%`;
}

/** Un bloque que no se pudo leer. Lo que NO hace es dibujar un cero. */
function NoSePudo({ que, mensaje }: { que: string; mensaje: string }) {
  return (
    <ErrorState
      inline
      titulo={`No se pudo leer ${que}`}
      detalle="El dato puede estar y no haber llegado. Lo que ves abajo no incluye esta parte."
      detalleTecnico={mensaje}
    />
  );
}

// ── ¿Llegan a tu oferta? ─────────────────────────────────────────────────────

function Profundidad({ pag, pixel, falla }: {
  pag: PulsoPagina;
  pixel: PulsoDatos['pixel'];
  falla: string | null;
}) {
  if (falla) return <NoSePudo que="el scroll" mensaje={falla} />;

  const p = pag.profundidad;
  if (!p) {
    // El vacío EXPLICA qué falta y lleva a dónde se arregla. Tres causas
    // distintas, tres textos: sin código, código viejo, o código al día y
    // todavía sin datos. Decir «sin datos» en los tres casos manda a buscar un
    // problema en el lugar equivocado.
    if (pixel && pixel.instalada === 0) {
      return (
        <EmptyState inline
          titulo="Tu página todavía no tiene el Pixel"
          detalle="Se pega una vez en el HTML y desde ahí mide las visitas, los clics y hasta dónde baja cada persona."
          accion={{ label: 'Copiar el código', href: LINK_PIXEL }} />
      );
    }
    if (pixel && pixel.instalada > 0 && pixel.instalada < PIXEL_SCROLL_DESDE) {
      return (
        <EmptyState inline
          titulo="Tu Pixel todavía no mide el scroll"
          detalle={`El código que tienes pegado es de una versión anterior a la ${PIXEL_SCROLL_DESDE}, que es la que mide hasta dónde baja cada persona. Se arregla pegándolo de nuevo.`}
          accion={{ label: 'Volver a copiar el código', href: LINK_PIXEL }} />
      );
    }
    return (
      <EmptyState inline
        titulo="Todavía no llegó ni un dato de scroll de esta página"
        detalle="Aparece en cuanto alguien entre y baje. Si ya recibiste visitas aquí, revisa que el código esté en esta página y no solo en la principal."
        accion={{ label: 'Revisar el código', href: LINK_PIXEL }} />
    );
  }

  const datos: Barra[] = p.hitos.map((h) => ({
    id: String(h.hito),
    label: rotuloHito(h.hito),
    valor: h.personas,
    texto: `${h.personas}`,
    // Se destaca el escalón donde se va MÁS gente, no el más profundo: la
    // pregunta útil es dónde se pierde a la gente, y eso lo decide el dato.
    destacada: p.mayorCaida?.hasta === h.hito,
    nota: p.base > 0 ? `${Math.round((h.personas / p.base) * 100)}% de los medidos` : undefined,
  }));

  return (
    <div>
      {/* El tope de la escala es la BASE, no el hito más alto: así el largo de
          cada barra se lee como «de los medidos, esta fracción». */}
      <Barras datos={datos} max={p.base} tono="info" />
      <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
        {/* ⚠️ EL DENOMINADOR A LA VISTA. El scroll se mide desde la versión 19
            del Pixel, así que «medidos» puede ser mucho menos que «entraron» —
            y un porcentaje sin su denominador acá diría que tu página es mala
            cuando lo que pasa es que no se está midiendo. */}
        Medido en {p.base} de las {pag.visitantes} personas que entraron.
        {p.mayorCaida && ` La mayor caída está entre ${rotuloCaida(p.mayorCaida.desde, p.mayorCaida.hasta)}: se van ${p.mayorCaida.personas}.`}
      </div>
    </div>
  );
}

// ── ¿Qué botón tocan? ────────────────────────────────────────────────────────

function Clics({ pag, pixel, falla }: {
  pag: PulsoPagina;
  pixel: PulsoDatos['pixel'];
  falla: string | null;
}) {
  if (falla) return <NoSePudo que="los clics" mensaje={falla} />;

  if (!pag.clics.length) {
    if (pixel && pixel.instalada === 0) {
      return (
        <EmptyState inline
          titulo="Tu página todavía no tiene el Pixel"
          detalle="Sin el código pegado no hay forma de saber qué botón toca la gente."
          accion={{ label: 'Copiar el código', href: LINK_PIXEL }} />
      );
    }
    if (pixel && pixel.instalada > 0 && pixel.instalada < PIXEL_CLICS_DESDE) {
      return (
        <EmptyState inline
          titulo="Tu Pixel todavía no mide los clics"
          detalle={`Los clics llegaron en la versión ${PIXEL_CLICS_DESDE} del código. Pégalo de nuevo y empiezan a contarse.`}
          accion={{ label: 'Volver a copiar el código', href: LINK_PIXEL }} />
      );
    }
    if (pag.clicsDelConstructor > 0) {
      return (
        <EmptyState inline
          titulo="Los únicos clics de esta página son del sello del constructor"
          detalle={`Se registraron ${pag.clicsDelConstructor}, y ninguno es sobre el contenido de tu página. En tus botones todavía no tocó nadie.`} />
      );
    }
    return (
      <EmptyState inline
        titulo="Todavía nadie tocó un botón en esta página"
        detalle="Aparece el primero que entre y haga clic. Si tu llamado a la acción es un formulario o una agenda embebida, el clic lo recibe ese bloque y no se mide desde aquí." />
    );
  }

  const datos: Barra[] = pag.clics.map((c, i) => ({
    id: c.clave,
    label: c.texto ?? c.destino ?? 'Un botón sin nombre',
    valor: c.clics,
    texto: `${c.clics}`,
    // El primero es el más tocado: lo que la página consigue que se apriete.
    destacada: i === 0,
    // Las PERSONAS al lado de los clics, siempre. Tres clics de la misma
    // persona no son tres personas, y en una página con un botón que scrollea
    // ése es el caso normal: se aprieta, se vuelve arriba, se aprieta otra vez.
    nota: [`${c.personas} ${c.personas === 1 ? 'persona' : 'personas'}`, c.texto && c.destino ? c.destino : null]
      .filter(Boolean).join(' · '),
  }));

  return (
    <div>
      <Barras datos={datos} tono="info" />
      <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
        {pag.clicsRestantes > 0 && `Hay ${pag.clicsRestantes} destinos más con menos clics. `}
        {pag.clicsDelConstructor > 0 && `No se cuentan ${pag.clicsDelConstructor} clics del sello del constructor de la página.`}
      </div>
    </div>
  );
}

// ── La pantalla ──────────────────────────────────────────────────────────────

export function PulsoPaginas() {
  const [datos, setDatos] = useState<PulsoDatos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const r = await fetch('/api/landing-analyst/pulso');
      const j = await r.json().catch(() => ({ ok: false, error: 'La respuesta no se pudo leer.' }));
      // ⚠️ `fetch` solo rechaza por error de RED: un 500 llega acá como éxito, y
      // sin este chequeo la pantalla se dibujaba vacía como si no hubiera datos.
      if (!j.ok) { setError(j.error || 'No se pudo leer lo que midió el Pixel.'); return; }
      setDatos(j.data as PulsoDatos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const falla = useCallback((b: BloquePulso): string | null =>
    datos?.fallas.find((f) => f.bloque === b)?.mensaje ?? null, [datos]);

  const pag = useMemo(() => {
    if (!datos?.paginas.length) return null;
    return datos.paginas.find((p) => p.url === sel) ?? datos.paginas[0];
  }, [datos, sel]);

  if (cargando) return <SkeletonLines lines={6} />;
  if (error) {
    return <ErrorState titulo="No se pudo leer lo que midió el Pixel" detalle="Nada de lo de abajo se puede afirmar todavía." accion={{ label: 'Volver a intentar la lectura', onClick: () => void cargar() }} detalleTecnico={error} />;
  }
  if (!datos) return null;

  const fallaPaginas = falla('paginas');
  const fallaVisitas = falla('visitas');

  if (!datos.paginas.length) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {fallaPaginas && <Banner tono="bad">No se pudo leer tu lista de páginas, así que puede faltar alguna aquí.</Banner>}
        <EmptyState
          titulo="Todavía no hay nada medido"
          detalle="El Pixel de MaKo se pega una vez en el HTML de tu página y desde ahí cuenta las visitas, los clics y hasta dónde baja cada persona."
          accion={{ label: 'Copiar el código', href: LINK_PIXEL }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {fallaPaginas && <Banner tono="bad">No se pudo leer tu lista de páginas, así que puede faltar alguna en el selector.</Banner>}
      {datos.pixel?.viejo && (
        <Banner tono="warn" accion={{ label: 'Volver a copiar el código', href: LINK_PIXEL }}>
          Tu Pixel es de la versión {datos.pixel.instalada} y la actual es la {datos.pixel.actual}. Te falta medir {datos.pixel.novedades}.
        </Banner>
      )}
      {datos.eventosSinPagina > 0 && (
        <Alert tono="info">
          Hay {datos.eventosSinPagina} eventos que no dicen de qué página son: los mandó un Pixel anterior a la versión {PIXEL_PAGINA_DESDE}. No se suman a ninguna página.
        </Alert>
      )}

      {datos.paginas.length > 1 && (
        <Select
          label="Página"
          value={pag?.url ?? ''}
          onChange={setSel}
          width={420}
          options={datos.paginas.map((p) => ({
            value: p.url,
            label: hostPath(p.url),
            sub: p.visitas > 0 ? `${p.visitas} visitas` : 'sin visitas medidas',
          }))}
        />
      )}

      {pag && (
        <>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {fallaVisitas ? (
              <>
                <Cifra valor="—" rotulo="Visitas" detalle="No se pudo leer." tono="neutral" />
                <Cifra valor="—" rotulo="Personas" detalle="No se pudo leer." tono="neutral" />
              </>
            ) : (
              <>
                <Cifra valor={String(pag.visitas)} rotulo="Visitas" detalle={`Últimos ${datos.dias} días`} />
                <Cifra valor={String(pag.visitantes)} rotulo="Personas distintas" detalle={`${fecha(pag.primera)} → ${fecha(pag.ultima)}`} />
              </>
            )}
            <div style={{ flex: 1, minWidth: 180, paddingTop: 6 }}>
              <Eyebrow>Página</Eyebrow>
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)', marginTop: 5, wordBreak: 'break-all' }}>{hostPath(pag.url)}</div>
              {/* `<a>` crudo y no el Link de la casa: ése le pega el workspace
                  a la URL, que es lo correcto para una ruta nuestra y una
                  barbaridad para la página de un cliente. */}
              <a href={pag.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600 }}>
                Abrir la página ↗
              </a>
            </div>
          </div>

          <Section titulo="¿Llegan a tu oferta?" nota="hasta dónde baja la gente" card>
            <Profundidad pag={pag} pixel={datos.pixel} falla={falla('scroll')} />
          </Section>

          <Section titulo="¿Qué botón tocan?" nota="por clics, con personas distintas" card>
            <Clics pag={pag} pixel={datos.pixel} falla={falla('clics')} />
          </Section>
        </>
      )}
    </div>
  );
}
