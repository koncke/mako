# El curso tipo Skool: diseño de los 19 pedidos del 07/10/2026

Pedido de Martín (07/10/2026, con dos capturas de la tab Curso de un cliente de agencia), los 19
puntos sin resumir están en la bitácora de `/admin/dev/customer-success`. Este documento fija las
DECISIONES y los CONTRATOS entre piezas, para que varias manos trabajen en paralelo sin pisarse.
El relevo que lo sostiene (7 informes, solo lectura) está resumido en `docs/hallazgos-customer-success.md`
cuando se coseche.

## Decisiones (y por qué no es lo obvio)

### D1. Módulos: la clave de módulo sigue en `curso_clases.etapa`
- En la interfaz del curso se llaman **Módulos** (item 11). En el kanban siguen siendo etapas.
- `curso_clases.etapa` pasa a significar **la clave del MÓDULO** de la clase. No se crea
  `modulo_id`: el relevo contó ~40 lugares que agrupan por `c.etapa` (portal, avance, mensajes,
  IA, ficha, resumen) y todos siguen valiendo sin tocarlos si la clave del módulo vinculado es la
  clave de la etapa.
- Hay dos clases de módulo:
  - **Vinculado**: es una etapa del kanban (`producto_entrega.data.etapas[]`). Su clave es la de
    la etapa, su nombre es el rótulo de la etapa y su orden es el del kanban. Renombrarlo o
    reordenarlo desde el curso escribe la etapa (item 6 y 7).
  - **Suelto** (item 12, «desvincularlo del kanban»): vive en `curso_modulos` con clave
    `m_<azar>`, nombre propio y un ancla `despues_de` (la clave del módulo que lo precede, o null =
    al principio). No es una etapa: no mueve clientes.
- Una etapa del kanban puede NO ser módulo: flag `enCurso: false` en la etapa (las etapas
  «Entregado» u «Onboarding» que no tienen clases). Default `true` (ausente = true). El saneo de
  etapas (`lib/servicio-etapas.ts`) tiene que conservarlo, porque reconstruye campo por campo.
- **La lista de módulos se DERIVA**: las etapas con `enCurso !== false`, en el orden del kanban,
  con los sueltos insertados después de su ancla. Una función pura en `lib/curso-modulos.ts`.
- **Reordenar** (arrastre): de la secuencia deseada se deriva (a) el orden nuevo de las etapas
  vinculadas, que se escribe con la lectura ESTRICTA de la entrega y conservando las fases
  (`enOrden`), y (b) el ancla de cada suelto. La primera etapa del kanban es la entrada («un
  cliente sin fila está en la primera») y no se mueve: un arrastre que la cambie se rechaza con un
  aviso.
- **Nuevo módulo** (item 12): por default vinculado → agrega una etapa al kanban (después de la
  etapa del módulo vinculado anterior). Se puede crear suelto.
- ⚠️ **CAMBIÓ el 08/10 (los 20 ajustes, item 15):** el interruptor «Etapa del kanban» apagado ya
  NO deja la etapa con `enCurso: false`: la QUITA del kanban. Si tiene clientes, se pregunta a
  dónde van y se mueven en silencio (`silencioso` en `moverClienteDeEtapa`, con el bloqueo de
  secuencias ANTES de mover). La entrada no se quita. `enCurso: false` sólo queda en etapas viejas.
  Lo de abajo describe la versión de la tanda 2.
- **Desvincular** un vinculado: nace un suelto con clave nueva en el mismo lugar, se re-clavean
  sus clases (`update curso_clases set etapa = <nueva>`) y su portada, y la etapa queda en el
  kanban con `enCurso: false` (los clientes que están ahí no se mueven). **Vincular** un suelto:
  crea una etapa nueva en el kanban en su lugar y re-clavea al revés.
- El avance automático de etapa (`alEnviarTarea`) y los mensajes por etapa siguen valiendo SOLO
  para módulos vinculados. Un suelto no mueve a nadie en el kanban.

### D2. Bloqueos (item 8): más que Skool
Skool solo bloquea por nivel, tiempo desde que entró al grupo, compra, plan o a mano; no tiene
«completó X» (relevo, fuente help.skool.com). Acá la regla es por MÓDULO y por CLASE
(`bloqueo jsonb`, null = hereda / default):
- `abierto` (default de un suelto y de una clase)
- `etapa` (default de un vinculado: se abre cuando el cliente llega a esa etapa, lo de hoy)
- `anterior` (al completar el módulo o la clase anterior)
- `dias` `{ dias }` (N días después de que se le abrió el curso a ESE alumno, no desde que entró
  al grupo: el criterio de Skool rompe los cursos que se abren después)
- `fecha` `{ fecha: 'YYYY-MM-DD' }` (cohortes)
- `tarea` `{ claseId, aprobada?: boolean }` (al enviar, o al aprobar, la tarea de otra clase)
- `nivel` `{ nivel }` (nivel de la comunidad, D8)
- `manual` (cerrado hasta que el equipo lo abre a ese alumno)
- Desbloqueo manual por alumno: tabla `curso_desbloqueos` (lead, producto, objeto, clave).
- **Se decide en el server y lo bloqueado NO viaja** (regla vigente del portal). El evaluador es
  puro (`lib/curso-bloqueo.ts`) y lo llama la ÚNICA puerta del portal (`decidirClase` /
  `armarEtapas` en `lib/curso-portal.ts`).
- «Completó» una clase = envió su tarea (si tiene) o la marcó como hecha / vio ≥ 90 % (si no tiene).

### D3. Invitar y permisos (item 9)
- **El alumno NO recibe una fila en `usuarios` ni `mako_session`**: está medido que con una fila
  leía el CRM del dueño del workspace (hallazgos del 06/10). La «cuenta de MaKo» que pidió Martín
  es la identidad de alumno que ya existe (cookie `mako_alumno`, 30 días, entra con Google o con el
  link del mail), y se le suma **entrar con su email** (link mágico) para cuando la cookie vence.
  Sin sidebar, sin nada más que su curso y su comunidad.
- Permisos por alumno: `curso_accesos.alcance jsonb` (null = todo). Forma: `{ modulos: { [productoId]: string[] } }`.
  Se aplica en la misma puerta que los bloqueos.
- Invitar desde la tarjeta del kanban (menú de la tarjeta, sin depender de `conCuentas`), desde la
  ficha (ya existe), y desde el editor del curso: elegir un cliente del producto que no esté
  invitado, o uno NUEVO (nombre, email obligatorio, teléfono, empresa) que se crea como cliente
  ganado y entra al kanban del producto en su primera etapa.
- La invitación sin sesión (para el CRM, item 19) es `invitarAlCursoSinSesion` en
  `lib/curso-invitar.ts` (contrato abajo). `invitarAlCursoAction` queda como envoltorio.

### D4. La lección (items 13 a 17)
- Fuera: las Notas en todos lados (las tablas quedan), el botón Grabar/No grabar (la columna
  queda), el botón Editar y su modal, y las pestañas Tarea/Descripción.
- Todo se edita en su lugar: título, descripción (editor rico), video (un placeholder «Agregar
  video» con link o subida), tarea (un placeholder «Agregar tarea» debajo de la descripción con el
  constructor de campos en línea). La descripción va primero y la tarea debajo, siempre juntas.
- Disposición: texto al costado del video o debajo a todo el ancho. Es un ajuste del curso
  (`curso_estilo` clave `disposicion`: `costado` | `abajo`).
- Descripción rica: HTML saneado en el SERVER con lista blanca (`sanitize-html`), en la columna
  nueva `curso_clases.descripcion_html`; `descripcion` (texto plano) se sigue llenando con el texto
  derivado para la búsqueda, la IA y los mensajes. Los adjuntos (imágenes, PDF, archivos) van a
  `curso_adjuntos` + bucket privado `curso-adjuntos`, y adentro del HTML se nombran por referencia
  `mako-adjunto:<id>`: el que dibuja traduce la referencia a la URL que le corresponde a quien mira
  (el equipo con sesión, el alumno con su token y respetando el candado).

### D5. Tipos de tarea (item 18)
Además de los campos de hoy (texto, línea, número, elección, casillas, tabla): **archivo**
(entregable con revisión), **audio** y **video** grabados en el navegador, **link**, **escala**
(1-10 / NPS), **quiz** (opciones con respuestas correctas, nota mínima, se corrige en el server y
las correctas NUNCA viajan al alumno), **checklist** (todas tildadas para completar), **agenda**
(agendar una llamada con un link; se completa al confirmar) y **confirmación** («lo hice»).

### D6. Portadas diseñadas (item 5)
Un catálogo de láminas (`app/_cursos/laminas/`): el cuaderno de hoy más varios diseños nuevos, todos
con la misma lógica: número arriba, rótulo, un TEXTO editable (default = nombre del módulo) con
tope de caracteres por diseño, y dos colores editables. Valor: `lam:<diseno>:<hexA>:<hexB>:<texto>`
(texto con `encodeURIComponent`, vacío = el nombre). El selector suma una pestaña «Diseños» que
incluye el cuaderno por default, así nunca «desaparece» después de elegir otra portada.

### D7. Recorrido en lugar de «Configura tu curso» (item 3)
Componente genérico `app/_ui/Recorrido.tsx`: fondo oscuro con recorte sobre el elemento, flecha,
texto corto, «Siguiente», «Atrás», «Omitir recorrido», contador. Los pasos apuntan a
`[data-recorrido="<id>"]`. Se ve una vez por PERSONA (no por workspace). Se puede volver a ver.

### D8. Comunidad (item 10)
Una comunidad por PRODUCTO (el programa: en Skool el grupo es la comunidad más el classroom). Tab
nueva «Comunidad» en el grupo Customer Success de la sidebar, y una pestaña «Comunidad» en el
portal del alumno. Lo imprescindible de Skool según el relevo: feed con categorías, hasta 3 fijados,
likes (1 like = 1 punto), comentarios de dos niveles con @menciones, encuestas, adjuntos y video;
puntos y los 9 niveles con los umbrales de Skool (0, 5, 20, 65, 155, 515, 2015, 8015, 33015) y
nombres editables; leaderboard 7 / 30 días / total; miembros con buscador y «en línea»; calendario
con zona horaria, recurrencia, link y acceso; campana de notificaciones; About; moderación (borrar,
fijar, sacar a alguien). El chat 1 a 1 y los mails de resumen quedan para después.
Miembros: el equipo del workspace (como admins) y los alumnos con acceso al curso del producto.

### D9. Conocimientos editable por el super admin (item 1)
Conocimientos monta `CursoUgc` (deja `CursoReplica`) y una capa en la base,
`conocimiento_ajustes` (sin workspace: es de la plataforma; solo `getSesionAdmin()` escribe), se
aplica encima del catálogo del código: título, resumen, color y portada del curso; nombre, portada
(láminas) y orden de módulos; título, portada, orden, módulo y ocultar de clases. Un link
compartido y cualquier otro usuario ven el resultado y no editan.

### D10. Avance de los clientes (item 4)
Sale del curso y pasa a ser una vista más de `/customer-success` (Kanban · Tabla · Avance), con el
selector de producto de esa pantalla.

### D11. El CRM (item 19)
Lo construye el chat del CRM (brief mandado el 07/10). De este lado solo `lib/curso-invitar.ts`.

## Contratos entre piezas

```ts
// lib/curso-invitar.ts (server-only) — lo usa el CRM
invitarAlCursoSinSesion({ ws, leadId, email?, autor }): Promise<
  { ok: true; enviado: boolean; motivo?: 'ya-invitado' | 'ya-entro' | 'sin-email' | 'sin-clases' | 'cortado' | 'no-ganado' }
  | { ok: false; error: string }>

// lib/curso-alcance.ts (puro) — permisos por alumno
type AlcanceCurso = { modulos: Record<string /* productoId */, string[] /* claves */> } | null
saneaAlcance(x: unknown): AlcanceCurso
moduloPermitido(alcance, productoId, clave): boolean

// lib/laminas.ts (puro) — portadas diseñadas
type ValorLamina = { diseno: string; a: string; b: string; texto: string }
leerLamina(v: unknown): ValorLamina | null
valorDeLamina(l: ValorLamina): string   // 'lam:...'
// app/_cursos/laminas/index.tsx: LAMINAS (catálogo) y <Lamina diseno n rotulo texto a b className />

// app/_ui/EditorRico.tsx ('use client') y app/_ui/HtmlSeguro.tsx
<EditorRico valor={html} onCambio={(html) => …} subirAdjunto={(file) => Promise<{ ref: string; nombre: string; mime: string }>} urlDeAdjunto={(ref) => string} placeholder />
<HtmlSeguro html={htmlYaSaneado} urlDeAdjunto={(ref) => string} />
// lib/html-seguro.ts (server-only): sanearHtml(html): string · textoDeHtml(html): string

// app/_ui/Recorrido.tsx ('use client')
<Recorrido id="cs-curso" pasos={[{ objetivo: 'marca', titulo, texto }]} abierto onCerrar />
// el objetivo apunta a [data-recorrido="marca"]

// lib/curso-bloqueo.ts (puro)
type Bloqueo = { tipo: 'abierto' } | { tipo: 'etapa' } | { tipo: 'anterior' } | { tipo: 'dias'; dias: number }
  | { tipo: 'fecha'; fecha: string } | { tipo: 'tarea'; claseId: number; aprobada?: boolean }
  | { tipo: 'nivel'; nivel: number } | { tipo: 'manual' }

// lib/comunidad-niveles.ts (puro): UMBRALES_NIVEL, nivelDe(puntos), puntosParaSubir(puntos)
// lib/comunidad-datos.ts: puntosDeLead(productoId, leadId) (para el bloqueo por nivel)
```

## Migraciones reservadas

| Nº | Qué |
|---|---|
| 0216 | `curso_adjuntos` + bucket `curso-adjuntos` + `curso_clases.descripcion_html` |
| 0217 | la comunidad (todas sus tablas) |
| 0218 | entregas de tareas del alumno (bucket `curso-entregas`) |
| 0219 | `curso_accesos.alcance` |
| 0220 | `curso_modulos`, `curso_clases.bloqueo`, `curso_desbloqueos` |
| 0221 | `conocimiento_ajustes` |
| 0222 | (la tomó la API de MaKo: `api_llamadas_token`) |
| 0223 | la papelera: `curso_clases.borrada_at`, `curso_modulos.borrado_at` (APLICADA el 08/10) |

Toda tabla con `workspace_id` va a `TENANT_TABLES` (lib/workspace.ts) Y a `TABLAS_DE_INQUILINO`
(lib/tablas-de-inquilino.ts), con RLS prendido y `revoke all … from anon, authenticated`.
