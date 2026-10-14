import { useCallback } from 'react'
import { useEditor } from '../context'

/**
 * Después de agregar algo al diseño: en la hoja inferior (pantallas chicas) el panel se cierra para dejar ver el
 * lienzo; en la tarjeta de la izquierda queda abierto, como en Canva (se agregan varias cosas seguidas).
 */
export function useInsertDone(close: () => void): () => void {
  const editor = useEditor()
  return useCallback(() => {
    if (editor.state.ui.compact) close()
  }, [editor, close])
}
