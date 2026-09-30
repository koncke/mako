'use client';

// =============================================================================
// PrefsDeMensaje — lo que se configura de UN mensaje además de su texto
// =============================================================================
// Antes eran tres secciones sueltas en Configuraciones › Notificaciones, cada una
// hablando de un mensaje que estaba en otra lista. El pedido del dueño fue dejar
// ahí SOLO lo de «Dentro de la app» y que lo demás se configure junto al mensaje
// — que es donde se puede ver de qué se está hablando.
//
// Hoy son tres cosas: POR DÓNDE llega, QUÉ TRAE adentro (sólo los reportes) y si
// los avisos no urgentes esperan al resumen.
//
// ⚠️ «POR DÓNDE LLEGA» ES DE TODOS, Y SE GUARDA EN DOS TIENDAS DISTINTAS. Los tres
// reportes lo tienen en `notification_prefs` (lo leen sus crons); los avisos, en su
// entrada del store de plantillas (lo lee el choke point de lib/avisos.ts). Cuál es
// cuál NO se decide acá: sale de `lib/mensaje-canales.ts`, que es el único lugar que
// lo sabe. Si cada pantalla lo dedujera por su cuenta, terminarían dos interruptores
// diciendo cosas distintas sobre el mismo mensaje — que es el bug que esta tab ya
// pagó una vez.
//
// ⚠️ SE RELEE ANTES DE GUARDAR. `/api/perfil` guarda el objeto de preferencias
// ENTERO, y esta pantalla toca un campo. Sin releer, guardar acá pisaría lo que
// el panel de al lado hubiera cambiado mientras tanto.

import { useEffect, useState, type CSSProperties } from 'react';
import type { NotifPrefs } from '@/lib/perfil';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const ES_RESUMEN = 'avisos-resumen';

/*
 * ⚠️ ACÁ ESTABA «QUÉ TRAE ADENTRO», y se fue el 29/09/2026: «no entiendo lo de Qué
 * trae adentro, eso elimínalo».
 *
 * Eran cuatro casillas (Semáforo, Ads, Wins, Pendientes) que escribían
 * `notification_prefs.secciones`, y hay que saber dónde queda ese campo: lo leen los
 * TRES armadores de reporte (`lib/reportes.ts`, once lecturas) y una operación de la
 * API de MaKo. O sea que el campo sigue vivo y ahora no tiene pantalla.
 *
 * Se midió antes de borrar, que es lo único que lo vuelve seguro: en los CUATRO
 * workspaces con preferencias guardadas las cuatro secciones están en `true`. Nadie
 * apagó nunca una, así que sacar el control no cambia lo que sale — los reportes
 * siguen trayendo las cuatro. El día que alguien quiera elegir, el pedido del dueño
 * dice dónde va: adentro del mensaje, como un comando del texto.
 */

export function PrefsDeMensaje({ id, estilo }: {
  id: string;
  /** El envoltorio lo pone QUIEN LO MONTA, pero lo aplica este componente: si la
   *  tarjeta la dibujara el padre, un mensaje sin nada que configurar dejaría una
   *  cajita blanca vacía flotando. Sólo hay envoltorio si hay contenido. */
  estilo?: React.CSSProperties;
}) {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);


  useEffect(() => {
    let vivo = true;
    void fetch('/api/perfil').then((r) => r.json()).catch(() => null).then((jp) => {
      if (!vivo) return;
      setPrefs(jp?.ok ? (jp.prefs as NotifPrefs) : null);
    });
    return () => { vivo = false; };
  }, []);

  async function guardarPrefs(cambio: (p: NotifPrefs) => NotifPrefs) {
    setBusy(true); setFlash(null);
    try {
      // Releer: el panel guarda el objeto entero y podría haber cambiado.
      const fresco = await fetch('/api/perfil').then((r) => r.json());
      const base = (fresco.ok ? fresco.prefs : prefs) as NotifPrefs;
      const next = cambio(base);
      const j = await (await fetch('/api/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prefs', prefs: next }),
      })).json();
      if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
      setPrefs(next);
      setFlash('✓');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  }

  // ⚠️ ACÁ ESTABAN LOS DOS CHIPS DE CANAL, y se fueron el 29/09/2026. El pedido llegó
  // dos veces y la primera lo leí al revés: «no tiene sentido que diga Por dónde llega
  // si justamente hay un gesto de email y otro de whatsapp» no era «sacale el rótulo»
  // sino «sacalos» — lo confirmó el segundo mensaje: «sigue estando lo de email y
  // whatsapp».
  //
  // Y tiene razón más allá del gusto: a este detalle se ENTRA por un canal (el tile de
  // WhatsApp abre el chat, el de Email abre la bandeja), así que preguntar el canal
  // adentro es decidir lo mismo dos veces, y en el segundo lugar contradice al primero.
  // El interruptor de email vive ahora donde la pregunta es una sola: la bandeja de
  // correo, sobre el mensaje abierto.
  if (!prefs) return null;
  // Hoy lo único que este panel edita es el resumen. Sin eso, no hay nada que dibujar.
  if (id !== ES_RESUMEN) return null;

  const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', display: 'block', marginBottom: 6 };
  const pill = (on: boolean): CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, cursor: busy ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
    border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
    background: on ? 'var(--primary-bg)' : 'var(--surface)',
    color: on ? 'var(--primary)' : 'var(--dim)', opacity: busy ? 0.6 : 1,
  });

  return (
    <div style={estilo ?? { marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {prefs && id === ES_RESUMEN && (
        <div>
          <label style={lbl}>Cuándo llegan los que no son urgentes</label>
          <button
            type="button" disabled={busy} aria-pressed={prefs.resumenDiario === true} style={pill(prefs.resumenDiario === true)}
            onClick={() => void guardarPrefs((p) => ({ ...p, resumenDiario: !p.resumenDiario }))}
          >
            {prefs.resumenDiario === true ? '✓ ' : ''}Juntarlos en este mensaje, una vez al día
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7, lineHeight: 1.45 }}>
            Apagado, cada uno llega en el momento. Un lead, una reunión o una cuenta frenada llegan en el momento igual.
          </div>
        </div>
      )}

      {flash && (
        <div style={{ fontSize: 12, fontWeight: 600, color: flash === '✓' ? 'var(--good)' : 'var(--bad)' }}>{flash}</div>
      )}
    </div>
  );
}
