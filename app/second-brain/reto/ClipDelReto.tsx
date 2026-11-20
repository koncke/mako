'use client';

// =============================================================================
// EL CLIP DE REGALO DEL DÍA 6, EN EL CHAT DEL RETO (20/11/2026)
// =============================================================================
// Va en su archivo porque es un formulario (la frase y el botón), no una caja para escribirle a MaKo: la del reto es la caja única
// (tests/chat-unico.test.ts). Qué dibuja en cada estado: lib/reto/clip-del-reto.ts. El clip lo hace AI Avatar (app/ai-avatar/regalo/).
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { CADA_MS_CLIP, frasePorEscribir, ganchoDelGuion, guionMasNuevo, vistaDelClip, type VistaClip } from '@/lib/reto/clip-del-reto';
import type { ClipRegalo } from '@/lib/reto/clip-regalo-reglas';
import { clipDeRegaloAction, pedirClipDeRegaloAction } from '@/app/ai-avatar/regalo/actions';
import { pedirAbrir, pedirListar } from '@/app/copywriter/cliente';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Burbuja } from './Burbuja';

/** Lo que contestan las dos acciones del clip de regalo (el tipo vive en app/ai-avatar/regalo/clip.ts, que es del servidor). */
type SalidaClip = Awaited<ReturnType<typeof clipDeRegaloAction>>;

/**
 * EL CLIP DE REGALO DEL DÍA 6 (20/11, R57-02; el Cerebro: «sí, por ApiMart», UN clip por prueba, lo que cuesta anotado y, si ApiMart
 * falla o no hay saldo, se dice claro y no se cobra nada). El clip lo hace la sesión de AI Avatar (app/ai-avatar/regalo/actions.ts,
 * 51d9ef3e5); acá sólo se muestra. Qué vista toca en cada estado: lib/reto/clip-del-reto.ts. Mientras dice «generando» pregunta cada
 * 10 s: esa consulta es la que lo termina con el día 6 abierto (si se va, lo termina el cron de cada 15 min, app/api/cron/clip-regalo).
 * Al quedar listo está en su historial de videos, y eso ya marca la tarea
 * «Tu primer clip con tu personaje» (lib/reto/senales.ts, `6:clip`): por eso `onListo` relee el reto.
 */
export function ClipDelReto({ onListo }: { onListo?: () => void }) {
  const [clip, setClip] = useState<ClipRegalo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [frase, setFrase] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const vivo = useRef(true);
  const antes = useRef<ClipRegalo['estado'] | null>(null);
  const aplicar = useCallback((r: SalidaClip) => {
    if (!vivo.current) return;
    if (r.ok) { setClip(r.clip); setError(null); } else setError(r.error);
    setVuelta((n) => n + 1);
  }, []);
  const preguntar = useCallback(() => clipDeRegaloAction().then(aplicar, () => aplicar({ ok: false, error: 'No pude leer tu clip de regalo. Vuelve a intentarlo en un momento.' })), [aplicar]);
  useEffect(() => { vivo.current = true; void preguntar(); return () => { vivo.current = false; }; }, [preguntar]);
  const generando = clip?.estado === 'generando';
  // Una consulta 10 s después de cada respuesta (también si la última falló): nunca dos a la vez.
  useEffect(() => {
    if (!generando) return;
    const t = setTimeout(() => { void preguntar(); }, CADA_MS_CLIP);
    return () => clearTimeout(t);
  }, [generando, vuelta, preguntar]);
  useEffect(() => {
    const ahora = clip?.estado ?? null;
    if (ahora === 'listo' && antes.current === 'generando') onListo?.();
    antes.current = ahora;
  }, [clip, onListo]);
  // La frase ya escrita con el gancho de su guion, una vez y sólo con la caja vacía (no le pisa lo que escribió).
  const conFormulario = clip?.estado === 'disponible' || (clip?.estado === 'fallo' && clip.puedeReintentar);
  const prellenada = useRef(false);
  useEffect(() => {
    if (!conFormulario || prellenada.current) return;
    prellenada.current = true;
    void ganchoDeSuGuion().then((g) => { if (g && vivo.current) setFrase((f) => (f.trim() ? f : g)); });
  }, [conFormulario]);
  const pedir = async () => {
    setPidiendo(true);
    try { aplicar(await pedirClipDeRegaloAction({ frase })); } catch { aplicar({ ok: false, error: 'No pude pedir tu clip. Vuelve a intentarlo en un momento.' }); }
    if (vivo.current) setPidiendo(false);
  };
  return <TarjetaClip vista={vistaDelClip(clip, clip ? null : error)} error={clip ? error : null} frase={frase} pidiendo={pidiendo} onFrase={setFrase} onPedir={() => { void pedir(); }} />;
}

/** Lo que se ve del clip de regalo (sin estado: así lo dibujan las capturas con renderToStaticMarkup). */
export function TarjetaClip({ vista, error = null, frase, pidiendo = false, onFrase, onPedir }: {
  vista: VistaClip; error?: string | null; frase: string; pidiendo?: boolean; onFrase: (f: string) => void; onPedir: () => void;
}) {
  if (vista.v === 'nada') return null;
  if (vista.v === 'aviso') return <Burbuja><p>{vista.texto}</p></Burbuja>;
  const cuerpo = (() => {
    if (vista.v === 'generando') {
      return (
        <>
          <p className="rt-tarjeta__t">Tu clip se está haciendo</p>
          <p className="rt-wa__ej" role="status">Tarda un par de minutos y aparece aquí. <span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span></p>
        </>
      );
    }
    if (vista.v === 'listo') {
      return (
        <>
          <p className="rt-tarjeta__t">Tu clip de regalo</p>
          <video className="rt-clip__video" src={vista.url} controls playsInline preload="metadata" />
          <p className="rt-wa__ej">También quedó en tu historial de videos.</p>
        </>
      );
    }
    if (vista.v === 'fallo') return <><p className="rt-tarjeta__t">Tu clip de regalo</p><p className="rt-wa__ej">{vista.texto}</p></>;
    if (vista.v !== 'pedir') return null;
    const f = frasePorEscribir(frase, vista.max);
    return (
      <>
        <p className="rt-tarjeta__t">Tu clip de regalo: {vista.segundos} segundos con tu personaje</p>
        {vista.aviso
          ? <p className="rt-wa__ej">{vista.aviso}</p>
          : <p className="rt-wa__ej">Escribe el gancho de tu guion y tu personaje lo dice a cámara. Queda en tu historial de videos.</p>}
        <textarea className="rt-clip__frase" rows={3} value={frase} onChange={(ev) => onFrase(ev.target.value)} aria-label="Lo que dice tu personaje"
          placeholder="Por ejemplo: Tres errores que te hacen perder clientes en la primera llamada." disabled={pidiendo} />
        <p className="rt-clip__cuenta" data-pasada={f.aviso ? '' : undefined}>{f.aviso ?? `${f.palabras} de ${vista.max} palabras`}</p>
        <button type="button" className="rt-clip__btn" onClick={onPedir} disabled={!f.lista || pidiendo}>{pidiendo ? 'Pidiendo tu clip…' : vista.aviso ? 'Pedirlo otra vez' : 'Pedir mi clip'}</button>
      </>
    );
  })();
  return (
    <Burbuja ancho>
      <div className="rt-tarjeta rt-clip" data-recorrido="sb-reto-dia-6-clip">
        {cuerpo}
        {error && <p className="rt-clip__error" role="alert">{error}<ReportarASoporte /></p>}
      </div>
    </Burbuja>
  );
}
