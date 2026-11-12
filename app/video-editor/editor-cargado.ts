// =============================================================================
// La PUERTA del motor del Video Editor: todo lo que la tab carga a pedido entra por acá (12/11/2026)
// =============================================================================
// Martín, 12/11/2026: «cada vez que ingreso desde la web a utilizar esta pestaña de edición, se me traba exageradamente
// todo». Medido ese día en producción: la página del editor bajaba y compilaba TRES veces el mismo script de 1,1 MB
// (los mismos 236 módulos: el núcleo, mediabunny, el WASM…), y 453 de sus 1.394 módulos venían repetidos en más de un
// script. La causa: el motor se pedía por varios `import()` distintos (`cargarMotor` y `cargarAlmacen` en ./proyectos.ts,
// y `EditorPage`, `PanelChat`, `ImportarDesde`, `ArmarPlantilla` y el nombre del proyecto en ./VideoEditorCliente.tsx), y
// el empaquetador arma un grupo por cada uno con su PROPIA copia de lo que comparten con los demás.
//
// Por eso hay UNA sola puerta: un `import()` de este archivo, desde cualquier lado, trae el mismo grupo una vez. Lo que
// se sume a la carga a pedido de la tab se exporta acá; un `import()` directo a `./_opencut/…` desde la tab vuelve a
// duplicar el motor (lo fija tests/video-editor-fluidez.test.ts).
// =============================================================================

export { EditorCore } from './_opencut/core';
export { storageService } from './_opencut/services/storage/service';
export { EditorPage } from './_opencut/editor-page';
export { PanelChat } from './_opencut/chat/PanelChat';
export { ImportarDesde } from './desde/ImportarDesde';
export { ArmarPlantilla } from './plantilla/ArmarPlantilla';
export { nombreLibre, nombreProyectoLibre, nombreProyectoNuevo } from './_opencut/inicio/nombre';
