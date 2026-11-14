# Hallazgos — avisos

## Avisos: lo que dejó `punta/nada-por-detras` (revisada el 8/11/2026)

Las dos puntas entraron a `main` **sin que nadie las mirara**. La revisión las leyó con tres lentes
(¿hace lo que dice?, ¿qué le rompe a un cliente?, ¿qué no cubre ningún test?) y **refutó cada
hallazgo con tres refutadores independientes**, con la regla de tirar lo dudoso. De 33 crudos
sobrevivieron 24; 4 de ésos ya los había arreglado un commit posterior. Los de abajo **siguen
abiertos**. «0/3 refutan» quiere decir que ninguno de los tres pudo tumbarlo.

### 🟠 En los dos avisos de agencia, «Es el negocio número N» contesta por la AGENCIA y no por el cliente del que habla el aviso

**promete-y-no-hace** · 0/3 refutan · `lib/aviso-evento.ts:513` · de `punta/nada-por-detras`

`meta_cuenta_frenada_agencia` y `meta_cuenta_recuperada_agencia` son `plataforma: true`, y llegan por `avisoALasAgencias`, que vuelve a llamar `emitirPorEvento(aviso, a.ws, …)` con el ws de la AGENCIA. `datosDeLaPlataforma(a.ws)` pone entonces `negocio_numero` = el número de la agencia, aunque el aviso es sobre su cliente (que viaja aparte como `cliente_nombre` / `cliente_link`). El rótulo que ve el admin dice «El número del negocio». Camino concreto: a MaKo le piden dejar de reportarle a la agencia la cuenta frenada de UN cliente; el admin escribe «No es el negocio número <el del cliente>» en /automations, Publicar lo acepta, y la condición nunca se cumple: el aviso sigue saliendo igual, co

### 🟡 Ninguna plantilla de SuperAdmin pasa por la validación de «se puede publicar»: el test recorre sólo PLANTILLAS, y dos de la plataforma ya están en rojo

**sin-cubrir** · 1/3 refutan · `C:/dev/wt-push-q/tests/plantillas-automatizaciones.test.ts:224` · de `punta/nada-por-detras`

`test('cada plantilla se PUEDE PUBLICAR…')` hace `for (const p of PLANTILLAS)` — las 13 de la galería. `mako-reunion-tareas-al-plan`, que este commit reformó (tres ramas con la fila del negocio y el «Si no» pasado a `null`), vive en PLANTILLAS_PLATAFORMA y no la mira nadie: ni `validarParaGuardar`, ni `validarGrafo`, ni `frenoDelFlujo`, ni `problemasDeForma`, ni `problemasDeTokens`, ni `frenoDelEvento`. El comentario del propio commit se apoya en esa regla («En cada rama y no en una CONDITION delante: CONDITION → CONDITION no se arma, `problemasDeForma`») que para esta familia no la chequea nada. Y el script de producción (scripts/mudanza-avisos-plataforma.mts:114-117) sólo corre `validarGra

## El aviso de una automatización sobre un lead le llega a SU setter (14/11/2026, `punta/mako-en-la-app`)

**Síntoma (la llamada con Julio, 13/11, min 01:27):** Martín dijo que el hand-off «te avisa al celular o la app del setter y por
WhatsApp». No era así: el aviso iba al grupo del negocio (y a los push de los admins) o a nadie, nunca a quien sigue a ESE lead.

**La causa:** `lead.setter` es un nombre suelto (lo escriben la ficha y `asignar_closer_setter`), no un usuario.

**Ahora (lib/aviso-al-setter-reglas.ts y lib/aviso-al-setter.ts):** el nombre se resuelve a UNA persona del negocio, sin adivinar
(mismo nombre sin tildes ni mayúsculas, de ese negocio, sin suspender; con dos que se llaman igual o con MaKo de setter, a nadie).
Le llega un push dirigido (`enviarPushAMiembros`, abre la ficha del lead) y un WhatsApp a su número del perfil. Sale en: la acción
`avisar_al_equipo` desde un flujo con lead («Sólo te avisa» y «Otra cosa» del AI Step pasan por ahí), el aviso de respaldo del AI
Step cuando la charla pasa a una persona, «Contéstale tú» de la charla cerrada (con SU freno de 12 h por lead, `reclamarEspaciado` tipo `aviso-setter`, y ANTES del aviso al grupo: la charla termina en el aviso y devuelve `false`, lo fija tests/instagram-primer-dm.test.ts) y el hand-off clásico
(`registrarHandoff`). El aviso al grupo no cambia.

**Trampas:**
- El push lleva el tag del grupo (`grupo:<ws>`): al setter, que es del equipo, también le suena el del grupo (lib/grupo-app.ts,
  `avisarMiembros`); con el mismo tag uno REEMPLAZA al otro en el teléfono en vez de apilarse.
- El WhatsApp sale SÓLO por la puerta de MaKo (`enviarAlChat`, lib/mako-salida.ts): bot prendido y el setter le escribió a MaKo en
  las últimas 24 h. Hoy el bot está sólo para Martín, así que en la práctica le llega el push y el WhatsApp dice por qué no salió
  (`whatsapp.error`). No es un error: es la regla que protege la línea de otro ban.

**Sin hacer (del relevo de la llamada):** que `asignar_closer_setter` le avise a la persona asignada; «A quién avisar: grupo /
setter del lead / una persona» en la tarjeta del AI Step; el aviso de «Para aprobar» (el borrador que deja MaKo) tampoco le llega al
setter.
