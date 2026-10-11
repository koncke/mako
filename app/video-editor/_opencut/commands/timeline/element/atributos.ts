// =============================================================================
// Cortar / Copiar atributos / Pegar atributos — STUB del paquete D
// =============================================================================
// Contrato (docs/diseno-editor-video.md §4.1): lo escribe el paquete I
// (operaciones de clip). La línea de tiempo (paquete D) ya llama a estas tres
// funciones desde los atajos Ctrl+X, Ctrl+Shift+C y Ctrl+Shift+V y desde el
// menú contextual del clip (actions/use-editor-actions.ts). Hasta que I las
// escriba, no hacen nada: I reemplaza este archivo entero, sin cambiar las
// firmas.

import type { EditorCore } from "@/app/video-editor/_opencut/core";

/** «Cortar» (Ctrl+X): copia la selección al portapapeles y la borra. */
export function cortarSeleccion(_editor: EditorCore): void {}

/** «Copiar atributos» (Ctrl+Shift+C): guarda los atributos del clip elegido. */
export function copiarAtributos(_editor: EditorCore): void {}

/** «Pegar atributos» (Ctrl+Shift+V): aplica los atributos guardados a la selección. */
export function pegarAtributos(_editor: EditorCore): void {}
