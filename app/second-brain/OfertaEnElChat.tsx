'use client';

// =============================================================================
// LA OFERTA DEL OFFER COACH, EN UN MENSAJE (onboarding V2, 19/11/2026)
// =============================================================================
// Martín, 16/11 (4.ª vuelta de la maqueta): «el diagnóstico en UN mensaje: la nota general y Descargar PDF… nada de texto
// innecesario». Con el motor de Offer (./useChatDelCoach.ts → `motorOffer`), después de «Armar mi oferta» MaKo manda el PDF de esa
// versión (lib/offer-reglas.ts → mensajePdf). Adentro de ESE mensaje va esta tarjeta, la de la maqueta (C:/dev/artefactos-onboarding/
// cuerpo.html → ofertaListaHtml): el nombre de la oferta, su nota de 100, cada dimensión con su barra, lo que más la sube, y
// «Descargar PDF» y «Seguir afinando».
//   · «Descargar PDF» abre primero la vista previa (16/11, 3.ª vuelta: «como regla siempre antes de descargar algo»), con el
//     PDF de verdad (app/offer/VistaPdf.tsx). En el teléfono baja directo: el teléfono ya lo abre en su visor, y una ventana
//     encima de la hoja la taparía (HojaDelCoach.tsx: «una sola hoja»).
//   · SE GUARDA SOLA (16/11: sin «Guardar en este funnel» ni «PDF para tu cliente»: «las cosas que se fueron respondiendo se
//     deberían guardar automáticamente»): al aparecer la versión, si no está guardada, se guarda en el funnel de su conversación
//     ('guardar-oferta', el mismo de la tab) y queda «Guardada en …». Así Funnel Coach ya la ve.
//   · Una versión ANTERIOR (después de pulirla) sólo lleva su PDF para bajar: la nota y el diagnóstico son de la última.
// Su CSS (`.co-ol`) vive en app/_chat/chat.css, que ya llega con la caja del chat (AdjuntosCaja.tsx): no se importa acá, que lo cargan
// los tests en node (AGENTS.md, «Un chat de tab adjunta con las piezas de la caja del Ops Center»).
// =============================================================================

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { VistaPdf } from '@/app/offer/VistaPdf';
import { guardadaVisible, textoGuardada, tonoDeNota } from '@/app/offer/ayudas';
import { descargarPdf, llamarOffer, mensajeDeError, TOPE } from '@/app/offer/offer-api';
import { DIMENSIONES, type ConclusionOferta, type OfferSesionVista } from '@/lib/offer-marco';

const txt = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
/** Las versiones que ya se mandaron a guardar en esta pestaña: la tarjeta se vuelve a montar (al volver al chat) y no repite. */
const yaGuardando = new Set<string>();

type Guardado = { en: OfferSesionVista['guardadaEn']; aviso: string | null };

export function OfertaEnElChat({ sesion, conclusion, onSeguir, movil = false }: {
  sesion: OfferSesionVista;
  /** La última versión armada (`sesion.conclusion`). */
  conclusion: ConclusionOferta;
  /** «Seguir afinando»: vuelve a la caja para escribirle al coach. */
  onSeguir: () => void;
  /** En el teléfono, «Descargar PDF» baja directo (ver arriba). */
  movil?: boolean;
}) {
  const [viendo, setViendo] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  const yaGuardada = guardadaVisible(sesion.ofertaId, sesion.ligada, null);

  // Se guarda sola, una vez por versión.
  const clave = `${sesion.id}:${conclusion.version}`;
  useEffect(() => {
    if (yaGuardada || yaGuardando.has(clave)) return;
    yaGuardando.add(clave);
    let vivo = true;
    void llamarOffer<{ sesion: OfferSesionVista; aviso?: unknown }>({ action: 'guardar-oferta', sesionId: sesion.id }, TOPE.corto)
      .then((r) => { if (vivo) setGuardado({ en: r.sesion.guardadaEn, aviso: typeof r.aviso === 'string' && r.aviso.trim() ? r.aviso : null }); })
      .catch((e) => { yaGuardando.delete(clave); if (vivo) setError(`No pude guardar tu oferta: ${mensajeDeError(e)}`); });
    return () => { vivo = false; };
  }, [clave, yaGuardada, sesion.id]);

  const bajar = async () => {
    if (bajando) return;
    setBajando(true);
    setError(null);
    try { await descargarPdf(sesion.id, conclusion.version); } catch (e) { setError(mensajeDeError(e)); } finally { setBajando(false); }
  };

  const p = conclusion.propuesta;
  const nombre = txt(p?.nombre) || txt(p?.frase) || 'Tu oferta';
  const total = Number.isFinite(conclusion.calculo?.total) ? Math.max(0, Math.min(100, Math.round(conclusion.calculo.total))) : null;
  const notas = Array.isArray(conclusion.diagnostico?.dimensiones) ? conclusion.diagnostico.dimensiones : [];
  // Lo que más la sube: la de la dimensión que más la frena (el cuello del cálculo) o, si no la trae, la de la nota más baja.
  const cuello = notas.find((n) => n?.id === conclusion.calculo?.cuello && txt(n.mejora))
    ?? [...notas].filter((n) => n && Number.isFinite(n.nota) && txt(n.mejora)).sort((a, b) => a.nota - b.nota)[0];
  const mejora = txt(cuello?.mejora);
  const guardadaEn = guardado ? guardado.en : yaGuardada ? sesion.guardadaEn : null;

  return (
    <div className="ch-tarjeta co-ol" data-oferta-lista={conclusion.version}>
      <div className="co-ol__cab">
        <div style={{ minWidth: 0 }}>
          <p className="co-ol__t">Tu oferta</p>
          <p className="co-ol__nombre">{nombre}</p>
        </div>
        {total != null && <p className="co-ol__nota" aria-label={`Nota: ${total} de 100`}><b>{total}</b><span>de 100</span></p>}
      </div>
      <ul className="co-ol__dims" aria-label="El diagnóstico de tu oferta">
        {DIMENSIONES.map((dim) => {
          const n = notas.find((x) => x?.id === dim.id);
          const nota = n && Number.isFinite(n.nota) ? Math.max(0, Math.min(10, Math.round(n.nota))) : null;
          return (
            <li key={dim.id}>
              <span>{dim.label}</span>
              <span className="co-ol__barra" aria-hidden><i style={{ width: `${(nota ?? 0) * 10}%` }} data-nivel={nota == null ? undefined : tonoDeNota(nota)} /></span>
              <b className="co-ol__n">{nota ?? '–'}</b>
            </li>
          );
        })}
      </ul>
      {mejora && <p className="co-ol__mejora"><b>Lo que más la sube:</b> {mejora}</p>}
      <div className="co-ol__botones">
        <Button variant="primary" loading={bajando} onClick={() => (movil ? void bajar() : setViendo(true))} icon={<Icon name="descargar" size={18} />}>
          Descargar PDF
        </Button>
        <Button variant="secondary" onClick={onSeguir}>Seguir afinando</Button>
        {guardadaEn && (
          <span role="status" className="co-ol__guardada"><IconoMenu nombre="check" size={16} />{textoGuardada(guardadaEn)}</span>
        )}
      </div>
      {guardado?.aviso && <p role="status" className="co-ol__aviso">{guardado.aviso}</p>}
      {error && <p role="alert" className="co-ol__error">{error}</p>}
      {viendo && (
        <Modal titulo="Tu oferta (PDF)" ancho={860} onCerrar={() => setViendo(false)}
          pie={(
            <>
              <Button variant="secondary" onClick={() => setViendo(false)}>Cerrar</Button>
              <Button variant="primary" loading={bajando} onClick={() => void bajar()} icon={<Icon name="descargar" size={18} />}>Descargar PDF</Button>
            </>
          )}>
          <VistaPdf sesionId={sesion.id} version={conclusion.version} />
        </Modal>
      )}
    </div>
  );
}

/** El PDF de una versión ANTERIOR: sólo para bajarlo (la nota y el diagnóstico son de la última). */
export function PdfDeOtraVersion({ sesionId, version }: { sesionId: number; version: number }) {
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bajar = async () => {
    if (bajando) return;
    setBajando(true);
    setError(null);
    try { await descargarPdf(sesionId, version); } catch (e) { setError(mensajeDeError(e)); } finally { setBajando(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <Button variant="secondary" size="sm" loading={bajando} onClick={() => void bajar()} icon={<Icon name="descargar" size={16} />}>
        Descargar el PDF de la versión {version}
      </Button>
      {error && <p role="alert" className="co-ol__error">{error}</p>}
    </div>
  );
}
