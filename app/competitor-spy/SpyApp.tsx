'use client';

// =============================================================================
// Competitor Spy — la lista a la izquierda y la ficha por bloques a la derecha
// =============================================================================
// El molde de la ficha es el que ya se aprobó en casa: la FICHA POR BLOQUES del CRM
// (docs/diseno-ficha-bloques.md). No se diseña de cero (AGENTS.md → «NINGUNA pantalla se diseña de
// cero»): un bloque por canal, cada uno se pliega, y **un bloque sin dato dice por qué, nunca
// "0"**.
//
// LAS TRES REGLAS DE PRODUCTO QUE DECIDEN ESTA PANTALLA, y que son lo que la separa de abrir cuatro
// pestañas a mano:
//
//  1. **Un contador ausente no es cero.** Todo número pasa por `dibujarContador`, que escribe «No
//     lo publica» cuando el dueño de la cuenta lo oculta. Un «0 me gusta» sobre una publicación con
//     miles es una mentira que nadie detecta.
//  2. **La etapa de tendencia es NUESTRO criterio y se dice.** «Probado / ganando tracción / test
//     nuevo» es la antigüedad de la pieza, no un dato de Meta ni de YouTube, y la pantalla lo
//     aclara. Y «no se sabe desde cuándo» NO es «es nuevo»: una pieza que vimos hoy por primera vez
//     puede llevar un año corriendo.
//  3. **Nada de «vs» ni de duelos.** La política III.L de YouTube prohíbe enmarcar una comparación
//     como «war» o «battle». La tab se llama Spy; la pantalla mira el mercado, no ataca a una
//     persona. Lo vigila `tests/spy-reglas.test.ts` sobre este archivo.
//
// Y una cuarta, de la galería: **ni cara, ni nombre, ni @ de un gurú en lo público** (Martín,
// 29/10/2026). Acá el @ del competidor SÍ se ve, porque esto es el análisis PRIVADO de un negocio
// sobre alguien que ese negocio eligió — la distinción está escrita en lib/spy-reglas.ts. La
// galería pública de plantillas, donde la regla aplica, todavía no existe.
//
// El copy va en español neutro, con «tú»: el producto se usa en México.

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../_components/icons';
import {
  AVISO_CORTE_VIEWCOUNT, ETAPA_ES_NUESTRO_CRITERIO, NOMBRE_CANAL, NOMBRE_ETAPA, NOMBRE_FUENTE,
  SIN_ANUNCIOS_EN_ESTE_PAIS, adLibraryCubreComercial, cruzaElCorte, dibujarContador,
  type CanalSpy,
} from '@/lib/spy-reglas';
import type { Competidor } from '@/lib/spy';
import {
  analizarAction, competidoresAction, guardarAnuncioAction, piezasAction, revisarAction,
  type PiezaVista,
} from './actions';
import { sumarCompetidorAction } from './onboarding-actions';

const CANALES: readonly CanalSpy[] = ['instagram', 'youtube', 'landing', 'anuncios'];

const CAJA: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };
const TENUE: React.CSSProperties = { fontSize: 12, color: 'var(--faint)' };
const BOTON: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, cursor: 'pointer',
};
const ENTRADA: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--ink)', fontSize: 13,
};

/** Los chips de los canales que tiene cargado un competidor. */
function Chips({ c }: { c: Competidor }) {
  const tiene: CanalSpy[] = [
    ...(c.instagram ? (['instagram'] as const) : []),
    ...(c.youtube_id ? (['youtube'] as const) : []),
    ...(c.landing_url ? (['landing'] as const) : []),
  ];
  if (!tiene.length) return <span style={TENUE}>sin canales</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
      {tiene.map((t) => (
        <span key={t} style={{ ...TENUE, border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px' }}>{NOMBRE_CANAL[t]}</span>
      ))}
    </span>
  );
}

/** Un bloque de la ficha: se pliega, y sin dato dice POR QUÉ. */
function Bloque({ canal, piezas, competidor }: { canal: CanalSpy; piezas: PiezaVista[]; competidor: Competidor }) {
  const [abierto, setAbierto] = useState(true);
  const delCanal = piezas.filter((p) => p.canal === canal);

  // Por qué está vacío: tres motivos distintos, y ninguno es «no tiene nada».
  const porQueVacio = (): string => {
    if (canal === 'anuncios') {
      // Si el país no está cubierto, se dice que la fuente no lo entrega. Una sección vacía sin
      // explicación se lee como «este competidor no pauta», que es una conclusión falsa.
      if (competidor.pais && !adLibraryCubreComercial(competidor.pais)) return SIN_ANUNCIOS_EN_ESTE_PAIS;
      return 'Cuando veas un anuncio suyo, pega su enlace aquí abajo y queda guardado con la fecha en que lo viste.';
    }
    const cargado = canal === 'instagram' ? competidor.instagram : canal === 'youtube' ? competidor.youtube_id : competidor.landing_url;
    if (!cargado) return `No hay ${NOMBRE_CANAL[canal]} cargado para este competidor.`;
    if (!competidor.mirado_en) return 'Todavía no se lo revisó. Usa «Revisar ahora».';
    return 'Se revisó y no se pudo leer nada de este canal.';
  };

  // ¿Alguna serie de este bloque cruza el corte del `viewCount` del 24/8/2026? Si sí, se avisa: el
  // salto de esa fecha es del cambio de medición, no del canal.
  const fechas = delCanal.map((p) => p.publicada_en).filter((f): f is string => !!f).sort();
  const hayCorte = canal === 'youtube' && fechas.length > 1 && cruzaElCorte(fechas[0], fechas[fechas.length - 1]);

  return (
    <section style={{ ...CAJA, padding: '12px 14px' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--ink)' }}
      >
        <Icon name="chevron" size={13} />
        <strong style={{ fontSize: 14 }}>{NOMBRE_CANAL[canal]}</strong>
        <span style={TENUE}>{delCanal.length ? `${delCanal.length}` : ''}</span>
      </button>

      {abierto && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!delCanal.length && <p style={{ ...TENUE, margin: 0, lineHeight: 1.6 }}>{porQueVacio()}</p>}

          {hayCorte && <p style={{ ...TENUE, margin: 0, lineHeight: 1.6 }}>{AVISO_CORTE_VIEWCOUNT}</p>}

          {delCanal.slice(0, 20).map((p) => (
            <div key={p.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                {p.url
                  ? <a href={p.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--ink)' }}>{p.titulo || p.texto?.slice(0, 90) || p.ref}</a>
                  : (p.titulo || p.texto?.slice(0, 90) || p.ref)}
              </div>
              <div style={{ ...TENUE, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>Vistas: {dibujarContador(p.vistas)}</span>
                <span>Me gusta: {dibujarContador(p.megusta)}</span>
                <span>Comentarios: {dibujarContador(p.comentarios)}</span>
                {/* Un tramo se dice tramo: `gasto_tramo` es texto («1K-5K»), nunca un punto de un eje. */}
                {p.gasto_tramo && <span>Gasto: {p.gasto_tramo}</span>}
                <span>{NOMBRE_FUENTE[p.fuente]}</span>
              </div>
              <div style={{ ...TENUE, marginTop: 3 }}>
                {p.etapa
                  ? <span title={NOMBRE_ETAPA[p.etapa].porque}>{NOMBRE_ETAPA[p.etapa].rotulo}</span>
                  : <span>No se sabe desde cuándo está a la vista</span>}
                {p.dejo_de_verse_en && <span> · Ya no se ve desde el {p.dejo_de_verse_en.slice(0, 10)}</span>}
              </div>
              {p.analisis?.gancho && <div style={{ ...TENUE, marginTop: 3 }}>Abre con: {p.analisis.gancho}</div>}
            </div>
          ))}

          {canal === 'landing' && competidor.landing_url && (
            // ⚠️ El parámetro es `?analizar=`, que es el que el Web Generator entiende
            // (`derechaDeQuery`, app/web-generator/panel-reglas.ts): abre el Diagnóstico de esa
            // página, que es desde donde se replica. Un `?replicar=` —que es lo que uno escribe
            // de memoria— no existe en ese contrato: la query se ignora, la pantalla abre en su
            // vista por omisión, y el botón parece andar. Una ruta que apunta a la nada no rompe
            // nada, y por eso es cara.
            <a href={`/web-generator?analizar=${encodeURIComponent(competidor.landing_url)}`} style={{ ...BOTON, textDecoration: 'none', alignSelf: 'flex-start', marginTop: 4 }}>
              Analizar y replicar su sitio
            </a>
          )}
          {delCanal.length > 0 && <p style={{ ...TENUE, margin: '4px 0 0', lineHeight: 1.5 }}>{ETAPA_ES_NUESTRO_CRITERIO}</p>}
        </div>
      )}
    </section>
  );
}

export function SpyApp({ iniciales }: { iniciales: Competidor[] }) {
  const [competidores, setCompetidores] = useState<Competidor[]>(iniciales);
  const [elegido, setElegido] = useState<number | null>(iniciales[0]?.id ?? null);
  const [piezas, setPiezas] = useState<PiezaVista[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Estado POR ACCIÓN: un solo `busy` compartido pone «Revisando…» en el botón de al lado.
  const [revisando, setRevisando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [pegado, setPegado] = useState('');
  const [sumando, setSumando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const [guardando, setGuardando] = useState(false);

  const c = competidores.find((x) => x.id === elegido) ?? null;

  const recargar = useCallback(async (id: number | null) => {
    const r = await competidoresAction();
    if (r.ok) setCompetidores(r.competidores);
    if (id == null) return;
    const p = await piezasAction(id);
    if (p.ok) setPiezas(p.piezas);
    else setError(p.error);
  }, []);

  useEffect(() => { if (elegido != null) void recargar(elegido); }, [elegido, recargar]);

  const revisar = async () => {
    if (elegido == null) return;
    setError(null); setAviso(null); setRevisando(true);
    try {
      const r = await revisarAction(elegido);
      if (r.error) { setError(r.error); return; }
      // Se muestra lo que pasó CANAL POR CANAL, también lo que no se pudo leer: «no pude» es un
      // tercer estado y confundirlo con «no tiene» le miente al negocio.
      setAviso(r.canales.map((x) => `${NOMBRE_CANAL[x.canal]}: ${x.detalle}`).join(' · ') || 'No había ningún canal que leer.');
      await recargar(elegido);
    } finally {
      setRevisando(false);
    }
  };

  const analizar = async () => {
    if (elegido == null) return;
    setError(null); setAviso(null); setAnalizando(true);
    try {
      const r = await analizarAction(elegido);
      if (!r.ok) { setError(r.error); return; }
      await recargar(elegido);
    } finally {
      setAnalizando(false);
    }
  };

  const sumar = async () => {
    setError(null); setSumando(true);
    try {
      const r = await sumarCompetidorAction(pegado.trim());
      if (!r.ok) { setError(r.error); return; }
      setPegado('');
      setElegido(r.id);
      await recargar(r.id);
    } finally {
      setSumando(false);
    }
  };

  const guardarAnuncio = async () => {
    if (elegido == null) return;
    setError(null); setAviso(null); setGuardando(true);
    try {
      const r = await guardarAnuncioAction(elegido, anuncio.trim());
      if (!r.ok) { setError(r.error); return; }
      setAnuncio('');
      setAviso(r.nuevo ? 'Guardado. Desde hoy se cuenta cuántos días lleva a la vista.' : 'Ese anuncio ya estaba guardado.');
      await recargar(elegido);
    } finally {
      setGuardando(false);
    }
  };

  return (
    // Dos columnas en la computadora y UNA en el teléfono, con el mismo componente: la tab se
    // adapta al tamaño de la pantalla, siempre (AGENTS.md).
    <main data-spy style={{ padding: 16, display: 'grid', gap: 16, gridTemplateColumns: 'minmax(220px, 300px) 1fr', alignItems: 'start' }}>
      {/* El quiebre a una columna va en CSS y no en un `useState` del ancho: un layout que se
          auto-mide tiene que acertar SIEMPRE, y uno fijo no tiene casos (AGENTS.md). */}
      <style>{'@media (max-width: 860px){ main[data-spy]{ grid-template-columns: 1fr !important } }'}</style>

      {/* ── La lista ───────────────────────────────────────────────────── */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="spy" size={18} /> Competitor Spy
        </h1>
        <input
          style={ENTRADA}
          placeholder="Pega un @, un canal o un sitio"
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && pegado.trim() && !sumando) void sumar(); }}
        />
        <button type="button" style={BOTON} disabled={!pegado.trim() || sumando} onClick={() => void sumar()}>
          {sumando ? 'Agregando…' : 'Agregar competidor'}
        </button>

        {!competidores.length && <p style={{ ...TENUE, lineHeight: 1.6 }}>Todavía no estás mirando a nadie. Pega el @ de Instagram de alguien de tu nicho, el enlace de su canal de YouTube o el de su sitio.</p>}

        {competidores.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setElegido(x.id)}
            style={{
              ...CAJA, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
              borderColor: x.id === elegido ? 'var(--ink)' : 'var(--border)', color: 'var(--ink)',
            }}
          >
            <div style={{ fontSize: 14 }}>{x.nombre}</div>
            <div style={{ marginTop: 4 }}><Chips c={x} /></div>
            <div style={{ ...TENUE, marginTop: 4 }}>
              {x.mirado_en ? `Revisado el ${x.mirado_en.slice(0, 10)}` : 'Sin revisar'}
            </div>
          </button>
        ))}
      </aside>

      {/* ── La ficha ───────────────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!c && <p style={TENUE}>Elige a alguien de la lista para ver su ficha.</p>}
        {c && (
          <>
            <header style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 17, margin: 0 }}>{c.nombre}</h2>
              {c.instagram && <span style={TENUE}>@{c.instagram}</span>}
              <span style={{ ...TENUE, marginLeft: 'auto' }}>
                Seguidores: {dibujarContador(c.instagram_seguidores)} · Suscriptores: {dibujarContador(c.youtube_suscriptores)}
              </span>
            </header>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={BOTON} disabled={revisando} onClick={() => void revisar()}>
                {revisando ? 'Revisando sus canales…' : 'Revisar ahora'}
              </button>
              <button type="button" style={BOTON} disabled={analizando || !piezas.length} onClick={() => void analizar()}>
                {analizando ? 'Leyendo su oferta…' : 'Qué vende y qué ataca'}
              </button>
            </div>

            {error && <p style={{ ...TENUE, color: 'var(--danger, #c0392b)', lineHeight: 1.6 }}>{error}</p>}
            {aviso && <p style={{ ...TENUE, lineHeight: 1.6 }}>{aviso}</p>}

            {/* El bloque OFERTA es el que justifica la tab: los otros son datos, este es la conclusión. */}
            {c.oferta?.promete && (
              <section style={{ ...CAJA, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <strong style={{ fontSize: 14 }}>Su oferta</strong>
                <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
                  <div>Promete: {c.oferta.promete}</div>
                  {c.oferta.aQuien && <div>A: {c.oferta.aQuien}</div>}
                  {c.oferta.precio && <div>Precio que publica: {c.oferta.precio}</div>}
                  {c.oferta.objecion && <div>Objeción que ataca: {c.oferta.objecion}</div>}
                  {!!c.oferta.huecos.length && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      Lo que él ataca y tu oferta no menciona:
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {c.oferta.huecos.map((h) => <li key={h}>{h}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                <p style={{ ...TENUE, margin: 0 }}>Es una lectura de la IA sobre lo que se leyó de él, no una afirmación suya.</p>
              </section>
            )}

            {CANALES.map((canal) => <Bloque key={canal} canal={canal} piezas={piezas} competidor={c} />)}

            {/* La única vía de anuncios que no tiene problema de términos: lo trae la persona. */}
            <section style={{ ...CAJA, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>Guardar un anuncio que viste</strong>
              <input
                style={ENTRADA}
                placeholder="Pega el enlace del anuncio en la Biblioteca de Anuncios"
                value={anuncio}
                onChange={(e) => setAnuncio(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && anuncio.trim() && !guardando) void guardarAnuncio(); }}
              />
              <button type="button" style={{ ...BOTON, alignSelf: 'flex-start' }} disabled={!anuncio.trim() || guardando} onClick={() => void guardarAnuncio()}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <p style={{ ...TENUE, margin: 0, lineHeight: 1.6 }}>
                Meta no entrega por su API los anuncios comerciales de América Latina, así que esto no
                se puede traer solo. Lo que guardas aquí sí queda con la fecha, y desde entonces se
                cuenta cuántos días lleva a la vista.
              </p>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
