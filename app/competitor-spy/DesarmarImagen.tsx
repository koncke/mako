'use client';

// =============================================================================
// «Desarmar» un carrusel o una imagen de anuncio de la competencia (ticket 97, «otros formatos»; 14/11/2026)
// =============================================================================
// En la caja de una pieza de Competitors Spy que es imagen (./DetallePieza.tsx). La IA del negocio con visión saca la estructura,
// los textos EXACTOS de cada lámina, la tipografía y la paleta (/api/competitor-spy/desarmar-imagen). «Replicar en Image» arma la
// réplica de Image (/api/image-editor/carruseles/replicar) con eso como pedido y abre el diseño: el texto queda editable y la
// imagen se regenera con IA (la regla de los carruseles; nunca se entrega por partes ni recortada). «Hacer uno así», al lado en
// el pie de la caja, lo lleva a Copywriting.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { pedidoDeDesarmeImagen, type DesarmeImagenGuardado } from '@/lib/imagen-desarmar';
import d from '@/app/video-editor/desarmar.module.css';

const RUTA = '/api/competitor-spy/desarmar-imagen';
type Respuesta = { ok?: boolean; guardado?: DesarmeImagenGuardado | null; error?: string };

async function pedir(cuerpo: Record<string, unknown>): Promise<Respuesta> {
  const r = await fetch(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  return ((await r.json().catch(() => null)) as Respuesta | null) ?? { ok: false, error: `No pude desarmarlo (HTTP ${r.status}).` };
}

const ROL: Record<string, string> = { titulo: 'Título', subtitulo: 'Subtítulo', cuerpo: 'Cuerpo', dato: 'Dato', cta: 'Llamado', etiqueta: 'Etiqueta', marca: 'Marca' };

export function DesarmarImagen({ piezaId }: { piezaId: number }) {
  const router = useRouter();
  const [g, setG] = useState<DesarmeImagenGuardado | null>(null);
  const [visto, setVisto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replica, setReplica] = useState<string | null>(null);
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  useEffect(() => {
    let vivo = true;
    void pedir({ accion: 'ver', piezaId }).then((j) => { if (vivo) { setG(j.guardado ?? null); setVisto(true); } }).catch(() => { if (vivo) setVisto(true); });
    return () => { vivo = false; };
  }, [piezaId]);

  const desarmar = useCallback(async () => {
    setTrabajando(true);
    setError(null);
    try {
      const j = await pedir({ accion: 'desarmar', piezaId });
      if (!montado.current) return;
      if (j.ok && j.guardado) setG(j.guardado);
      else setError(j.error ?? 'No pude desarmarlo.');
    } catch {
      if (montado.current) setError('Se cortó la conexión. Vuelve a intentar.');
    } finally {
      if (montado.current) setTrabajando(false);
    }
  }, [piezaId]);

  /** La réplica de Image, con lo desarmado como pedido: se lee su NDJSON hasta el `fin` y se abre el diseño. */
  const replicar = useCallback(async () => {
    if (!g) return;
    setError(null);
    setReplica('Armándolo en Image…');
    try {
      const r = await fetch('/api/image-editor/carruseles/replicar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: piezaId, pedido: pedidoDeDesarmeImagen(g.desarme) }),
        signal: AbortSignal.timeout(305_000),
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(r.status === 403 || r.status === 404 ? 'Tu plan no incluye Image.' : j?.error ?? 'No pude armarlo en Image.');
        setReplica(null);
        return;
      }
      const lector = r.body.getReader();
      const dec = new TextDecoder();
      let resto = '';
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const corte = resto.lastIndexOf('\n');
        if (corte < 0) continue;
        for (const linea of resto.slice(0, corte).split('\n')) {
          let e: { fase?: string; ok?: boolean; id?: string; error?: string; indice?: number; total?: number } | null = null;
          try { e = JSON.parse(linea); } catch { continue; }
          if (e?.fase === 'lamina' && montado.current) setReplica(`Armando la lámina ${(e.indice ?? 0) + 1} de ${e.total ?? '…'}…`);
          if (e?.fase === 'fin') {
            if (e.ok && e.id) { router.push(`/image-editor/${encodeURIComponent(e.id)}`); return; }
            if (montado.current) { setError(e.error ?? 'No pude armarlo en Image.'); setReplica(null); }
            return;
          }
        }
        resto = resto.slice(corte + 1);
      }
      if (montado.current) { setError('Image no terminó de armarlo. Vuelve a intentar.'); setReplica(null); }
    } catch {
      if (montado.current) { setError('Se cortó la conexión mientras lo armaba.'); setReplica(null); }
    }
  }, [g, piezaId, router]);

  if (!visto) return null;
  const x = g?.desarme;
  return (
    <section className={d.caja} aria-label="Desarmar la pieza">
      <div className={d.cabeza}>
        <h3>{x ? `Desarmado: ${x.tipo}, ${x.laminas.length} ${x.laminas.length === 1 ? 'lámina' : 'láminas'}` : 'Desarmar esta pieza'}</h3>
        {!x && !trabajando ? <button type="button" className={d.boton} onClick={() => void desarmar()}>Desarmar</button> : null}
      </div>
      {!x && !trabajando && !error ? <p>Tu IA mira cada lámina: estructura, textos exactos, tipografía y paleta.</p> : null}
      {trabajando ? <p className={d.vivo} role="status" aria-live="polite"><i aria-hidden />Mirando cada lámina…</p> : null}
      {error ? <div className={d.error} role="alert"><p>{error}</p></div> : null}
      {x ? (
        <>
          {/* Lo que se hace con esto, arriba (como en el video): la lista de láminas puede ser larga. */}
          <div className={d.acciones}>
            {replica
              ? <p className={d.vivo} role="status" aria-live="polite"><i aria-hidden />{replica}</p>
              : <button type="button" className={d.boton} onClick={() => void replicar()}>Replicar en Image</button>}
          </div>
          {x.paleta.length ? (
            <div className={d.bloque}>
              <h4>Paleta</h4>
              <div className={d.paleta}>{x.paleta.map((c) => <span key={c} style={{ background: c }} title={c}><small>{c}</small></span>)}</div>
            </div>
          ) : null}
          <div className={d.bloque}>
            <h4>Tipografía</h4>
            <p>{[x.tipografia.titulos && `Títulos: ${x.tipografia.titulos}.`, x.tipografia.cuerpo && `Cuerpo: ${x.tipografia.cuerpo}.`, x.tipografia.descripcion].filter(Boolean).join(' ')}</p>
          </div>
          {x.porQueFunciona ? <div className={d.bloque}><h4>Por qué funciona</h4><p>{x.porQueFunciona}</p></div> : null}
          <div className={d.bloque}>
            <h4>Lámina por lámina</h4>
            <ol className={d.planos}>
              {x.laminas.map((l) => (
                <li key={l.n}>
                  <div className={d.planoCabeza}><b>{l.n}</b><span className={d.marca}>{l.rol}</span></div>
                  {l.composicion ? <p>{l.composicion}</p> : null}
                  {l.textos.map((t, i) => (
                    <p key={`${i}-${t.texto}`} className={d.textoPantalla} title={`${ROL[t.rol] ?? t.rol} · ${t.tamano} · ${t.letra}${t.color ? ` · ${t.color}` : ''}`}>{t.texto}</p>
                  ))}
                </li>
              ))}
            </ol>
          </div>
          {x.dudas.length ? <div className={d.bloque}><h4>Lo que no pude ver</h4><ul className={d.pasos}>{x.dudas.map((p) => <li key={p}>{p}</li>)}</ul></div> : null}
        </>
      ) : null}
    </section>
  );
}
