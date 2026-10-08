'use client';

// =============================================================================
// EditorMensajeWhatsApp — UN editor para todo lo que sale por WhatsApp
// =============================================================================
// ⚠️ ESQUELETO DEL CONTRATO (08/10/2026). La parte del composer lo reemplaza por el editor
// de verdad (punto 8: «Te pedí que todo lo que tenga que ver con WhatsApp tenga un mismo
// editable, ya sea audio, texto, archivos... con la interfaz tipo WhatsApp que ya creamos»).
// Las props son el contrato con el lienzo (FlujoLienzo) y con el recordatorio: no se
// cambian sin cambiar a los dos.

import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';

export type VariableEditor = { key: string; label: string; ejemplo?: string };

export type EditorMensajeWhatsAppProps = {
  /** El mensaje (un nodo `mensaje` del flujo). */
  paso: PasoSecuenciaDto;
  /** Cambio LOCAL: nunca publica. Publicar es del lienzo (sólo «Publicar» publica). */
  onChange: (patch: Partial<PasoSecuenciaDto>) => void;
  /** La biblioteca de audios del workspace («Audios guardados» del clip). */
  audios: AudioSetting[];
  /** Un audio grabado desde aquí se suma a la biblioteca del padre. */
  onAudioNuevo?: (a: AudioSetting) => void;
  /** Los datos que se pueden insertar como {{key}}. Default: los del motor (lib/template-vars.ts). */
  variables?: VariableEditor[];
  /** El botón ✦ (MaKo lo adapta para cada lead). Sólo texto por el no oficial. */
  permiteIA?: boolean;
  /** Abre la guía de voz la primera vez que se prende la IA. */
  onModoIA?: (on: boolean) => void;
  /** Mic y «Audios guardados». false en el recordatorio y en el oficial. */
  permiteAudio?: boolean;
  /** Clip: fotos, videos, documentos. */
  permiteAdjuntos?: boolean;
  /**
   * Muestra el interruptor «Revisar antes de enviar» (`paso.revisar`). Ausente en el paso =
   * lo que diga la secuencia: `revisarHeredado` es ese valor, para pintar el estado real.
   */
  mostrarRevisar?: boolean;
  revisarHeredado?: boolean;
  /** Nombre del negocio, para la burbuja de vista previa. */
  negocio?: string;
  placeholder?: string;
};

export function EditorMensajeWhatsApp({ paso, onChange, placeholder }: EditorMensajeWhatsAppProps) {
  return (
    <textarea
      value={paso.cuerpo}
      onChange={(e) => onChange({ cuerpo: e.target.value })}
      placeholder={placeholder ?? 'Escribe el mensaje'}
      rows={4}
      style={{ width: '100%', resize: 'vertical' }}
    />
  );
}
