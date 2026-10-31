'use client';

// =============================================================================
// El estudio de video — las piezas que se abren encima (mudadas de VideoGeneratorApp.tsx el 27/10/2026)
// =============================================================================
// · `DetalleGuion`: el guion entero, por bloques, editable en el lugar (el mismo template que /ads-writer).
// · `DetalleFormato`: el anuncio de ejemplo de un formato, con sonido, y lo que lo distingue.
// · `VerAnuncio`: un anuncio terminado en su tamaño real, con «Descargar» y «Editar en el editor».
// · `TarjetaFormato`: un formato en la biblioteca del estudio (la «biblioteca de actores» de Arcads).
// ⚠️ EL PROMPT NO SE MUESTRA NUNCA (la regla de esta tab desde su tercer rediseño): ninguna de estas piezas dibuja un prompt.
// =============================================================================

import { useCallback, useState } from 'react';
import { Alert, Button, Modal, Tag } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { cabidaDeGuion, soloHablado, type Puesta } from '@/lib/puestas-data';
import { SeccionCard, parsearSecciones, reconstruirSecciones, EditarTexto, ICONO_SECCION_GUION } from '@/app/components/SeccionCard';
import { editarGuionAction } from '../cargar-guiones-action';
import type { GuionDisponible } from '../guiones-datos';
import type { AnuncioHecho } from '../anuncios-datos';
import { descargarComo } from '../descargar';
import { nombreDeAnuncio } from '../video-pedido';
import { BotonEditarEnEditor } from '../editor-video';

/** El guion entero, por bloques (GANCHO, HISTORIA, CTA…), editable en el lugar. */
export function DetalleGuion({ guion, puesta, onCerrar, onUsar, onEditado }: {
  guion: GuionDisponible;
  puesta?: Puesta | null;
  onCerrar: () => void;
  /** Sin esto, el modal no ofrece «Usar este guion» (ya es el elegido). */
  onUsar?: () => void;
  /** El guion cambió en el server: hay que volver a bajarlo. */
  onEditado: () => void;
}) {
  // Copia local mientras el modal está abierto: guardar dispara un refresh y las props tardan un viaje en volver.
  const [texto, setTexto] = useState(guion.texto);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const cab = puesta ? cabidaDeGuion(puesta, soloHablado(texto)) : null;
  const secciones = parsearSecciones(texto, undefined, 20);

  const guardar = useCallback(async (nuevo: string) => {
    setTexto(nuevo);
    setGuardando(true); setErrorEdit(null);
    try {
      const out = await editarGuionAction(guion.id, nuevo);
      if (!out.ok) { setErrorEdit(out.error); return; }
      onEditado();
    } catch (e) {
      setErrorEdit(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }, [guion.id, onEditado]);

  return (
    <Modal
      titulo={guion.angulo || 'Sin título'}
      encabezado={guion.estructura || undefined}
      onCerrar={onCerrar}
      ancho={720}
      pie={onUsar ? <Button variant="mako" onClick={onUsar} icon={<Icon name="ia" size={15} />}>Usar este guion</Button> : undefined}
    >
      <div className="vgs-meta" style={{ marginBottom: 14 }}>
        <span>{guion.palabras} palabras</span>
        {cab && <><span>·</span><span>{cab.segundosReales}s en {cab.clips} tomas{puesta ? ` con ${puesta.nombre}` : ''}</span></>}
        {guion.yaUsado && (
          <Tag color="var(--good)" icon={<Icon name="check" size={12} />}>
            Generado{guion.grabadoEn.length > 0 ? ` en ${guion.grabadoEn.join(' y ')}` : ''}
          </Tag>
        )}
      </div>
      {cab?.desborda && (
        <div style={{ marginBottom: 14 }}>
          <Alert tono="warn">No entra en <strong>{puesta?.nombre}</strong>: sobran {cab.palabrasDeMas} palabras. El final quedaría afuera.</Alert>
        </div>
      )}
      {errorEdit && <Alert tono="bad">{errorEdit}</Alert>}
      {secciones.length > 0 ? (
        <div className="mk-scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: '52vh', overflowY: 'auto' }}>
          {secciones.map((s, i) => (
            <SeccionCard key={s.titulo + i} s={s} abiertoDefault={i === 0} icono={ICONO_SECCION_GUION[s.titulo] ?? '\u{1F3AC}'} size="sm">
              <EditarTexto
                valor={s.texto}
                multiline
                disabled={guardando}
                onSave={(v) => void guardar(reconstruirSecciones(secciones.map((sec, j) => (j === i ? { ...sec, texto: v } : sec))))}
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.6 }}
              />
            </SeccionCard>
          ))}
        </div>
      ) : (
        // Un guion sin rótulos se edita ENTERO: el que no tiene bloques es el que más ganas dan de corregir.
        <div className="mk-scroll-y" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
          <EditarTexto
            valor={texto}
            multiline
            disabled={guardando}
            onSave={(v) => void guardar(v)}
            style={{
              fontSize: 'var(--fs-md)', lineHeight: 1.7, color: 'var(--ink)', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', margin: 0,
            }}
          />
        </div>
      )}
      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 10 }}>
        {guardando ? 'Guardando…' : 'Haz clic en el guion para corregirlo.'}
      </div>
    </Modal>
  );
}

/** El anuncio de ejemplo de un formato, entero y con sonido: un formato de video se juzga escuchándolo. */
export function DetalleFormato({ puesta, onCerrar, onUsar }: { puesta: Puesta; onCerrar: () => void; onUsar?: () => void }) {
  const ej = puesta.ejemplo;
  return (
    <Modal
      titulo={puesta.nombre}
      encabezado={puesta.tecnico}
      onCerrar={onCerrar}
      ancho={720}
      pie={onUsar ? <Button variant="mako" onClick={onUsar} icon={<Icon name="check" size={14} />}>Usar este formato</Button> : undefined}
    >
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {ej && (
          <video src={ej.completo} poster={ej.poster} controls playsInline
            style={{ width: 260, maxWidth: '100%', flex: 'none', borderRadius: 'var(--r-md)', display: 'block', background: '#000' }} />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6 }}>{puesta.descripcion}</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.6, marginTop: 10 }}>{puesta.cuando}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            <Tag>{puesta.clips[0]}-{puesta.clips[1]} tomas</Tag>
            <Tag>{puesta.segundosClip[0]}-{puesta.segundosClip[1]} s por toma</Tag>
            <Tag>{puesta.habla === 'siempre' ? 'Habla a cámara' : puesta.habla === 'nunca' ? 'Voz en off' : 'Alterna habla y voz en off'}</Tag>
            {puesta.personas === 2 && <Tag>Dos personas</Tag>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Un formato en la biblioteca del estudio: el video de ejemplo es la tarjeta (un formato se elige VIÉNDOLO), con el apodo y
 * la técnica quemados abajo. Un clic lo elige; «Ver» abre el ejemplo entero con sonido.
 */
export function TarjetaFormato({ puesta, elegida, onElegir, onVer }: {
  puesta: Puesta; elegida: boolean; onElegir: () => void; onVer: () => void;
}) {
  const ej = puesta.ejemplo;
  return (
    <div className="vgs-formato" data-elegida={elegida || undefined}>
      <button type="button" className="vgs-formato__boton" onClick={onElegir} aria-pressed={elegida} aria-label={`Elegir el formato ${puesta.nombre}`}>
        {ej ? (
          // Muted + playsInline: sin las dos, el navegador no deja autoplay.
          <video src={ej.video} poster={ej.poster} autoPlay loop muted playsInline className="vgs-formato__video" />
        ) : <span className="vgs-formato__video" />}
        <span className="vgs-formato__rotulo">
          {puesta.nombre}
          {puesta.tecnico && <span className="vgs-formato__tecnico">{puesta.tecnico}</span>}
        </span>
        {elegida && <span className="vgs-formato__tilde" aria-hidden><Icon name="check" size={14} /></span>}
      </button>
      <button type="button" className="vgs-formato__ver" onClick={onVer}>Ver el ejemplo</button>
    </div>
  );
}

/** Un anuncio terminado en su tamaño real, con «Descargar» y «Editar en el editor». */
export function VerAnuncio({ anuncio, onCerrar }: { anuncio: AnuncioHecho; onCerrar: () => void }) {
  const [bajando, setBajando] = useState(false);
  const [falla, setFalla] = useState('');
  return (
    <Modal titulo={anuncio.titulo} onCerrar={onCerrar} ancho={520}>
      {/* Manda el ALTO, no el ancho: en un 9:16 la dimensión que escasea es el alto de la pantalla. */}
      <video src={anuncio.url} poster={anuncio.poster} controls autoPlay playsInline
        style={{ display: 'block', height: '62vh', width: 'auto', maxWidth: '100%', aspectRatio: '9 / 16', objectFit: 'cover', background: '#000', borderRadius: 'var(--r-md)', margin: '0 auto' }} />
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center', paddingTop: 4 }}>
        <Button
          variant="primary" loading={bajando} disabled={bajando} icon={<Icon name="descargar" size={17} />}
          onClick={() => {
            setBajando(true); setFalla('');
            void descargarComo(anuncio.url, nombreDeAnuncio(anuncio.titulo))
              .catch((e) => setFalla(e instanceof Error ? e.message : 'No se pudo descargar.'))
              .finally(() => setBajando(false));
          }}
        >
          Descargar el anuncio
        </Button>
        <BotonEditarEnEditor refVideo={`anuncio:${anuncio.id}`} />
        {falla && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{falla}</div>}
      </div>
    </Modal>
  );
}
