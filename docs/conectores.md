# Conectores de la cuenta de Claude

Qué hay enchufado a la cuenta de Claude que trabaja este repo, para qué sirve cada uno y
cuáles hacen falta de verdad. Importa porque **los conectores no se comparten entre las
dos cuentas**: van atados a la cuenta de claude.ai, no a un archivo del disco. Al entrar
con la otra cuenta hay que volver a conectarlos —y este documento dice cuáles valen la
pena y en qué orden.

> No confundir con las **integraciones del producto** (Meta, Chatwoot, Evolution, Resend,
> Panda, Calendly). Aquéllas las carga cada cliente en `/integraciones` y viven cifradas
> por workspace: eso está en [hallazgos-seguridad.md](hallazgos-seguridad.md) y en
> [hallazgos-comunicacion.md](hallazgos-comunicacion.md). Acá se habla de las herramientas
> del que ESCRIBE el código, no del que lo usa.

## Qué se usa de verdad

La cuenta tiene siete conectores habilitados, pero el uso real es muy desparejo. Esto no
es una impresión: son las veces que aparece cada uno en los 1.038 mensajes del dueño y en
los documentos del repo.

| Conector | En los mensajes | En los docs | Para qué se usa acá |
|---|---|---|---|
| **Fathom** | 165 | 146 | **El importante.** Las reuniones con clientes: transcripciones, Closing Analyst, el pipeline reunión → tareas |
| **Google Drive** | 119 | 17 | Los cursos de `/conocimientos`: recorrer la carpeta raíz, bajar videos y PDF |
| **Google Calendar** | 66 | 85 | Agenda y horarios libres; buena parte de las menciones son de la integración del producto, no del conector |
| Gmail | 42 | 19 | Casi todas las apariciones son `martinkoncke@gmail.com`, la casilla de PRUEBAS. Uso real del conector: sin evidencia |
| Notion | 29 | 4 | Las menciones son sobre tokens de MCP en general, no sobre usarlo. Sin evidencia de uso |
| Canva | 26 | 4 | **Falso positivo**: las 26 son `canvas` de HTML, no Canva. Sin evidencia de uso |
| Zoom | 3 | 0 | **Falso positivo**: las 3 son «zoom» como efecto de video. Sin evidencia de uso |

**Lo que hay que conectar, en orden:** Fathom, después Google Drive, después Google
Calendar. Los otros cuatro se pueden dejar para cuando aparezca la necesidad — hoy no hay
una sola tarea del repo que los pida.

## Fathom: hay DOS cuentas, y conviene saberlo antes

Es la trampa más cara de esta lista.

- La cuenta de **Mauricio** es la que usa el PRODUCTO: `FATHOM_API_KEY`, registrada en
  `lib/metodo-catalogo.ts`. De ahí salen el Closing Analyst, las reuniones automáticas
  R1/R2 y el webhook.
- La cuenta de **Martín** es aparte: `FATHOM_API_KEY_MARTIN` en `.env.local`. Ahí están
  sus reuniones propias («Mau ↔ Martín»). Está **deliberadamente fuera** de `ENVS_METODO`
  para que `migrarEnvACredenciales` no la copie a la base y no se mezcle con la del
  cliente.

⚠️ **La key de Martín empieza con un guion** (`-zxWU…`). Sin comillas en el `.env` se
rompe: con guion devuelve 200, sin guion 503. Verificado contra la API.

Si el MCP no está disponible, la API se puede usar directo:

```bash
curl -H "X-Api-Key: $K" https://api.fathom.ai/external/v1/recordings/<id>/transcript
```

El listado sale de `/meetings?limit=N`. Y ojo con un detalle de esa API: el filtro
`?recording_id=` en `/meetings` **se ignora** — para una grabación puntual hay que ir a
`/recordings/{id}/transcript`. Está en [hallazgos-comunicacion.md](hallazgos-comunicacion.md).

## Lo que NO es un conector y se confunde

Estas cosas se usan igual de seguido y **no** dependen de la cuenta de claude.ai: vienen
con la app o son APIs que el repo llama con su propia key.

| Qué | De dónde sale |
|---|---|
| El panel de navegador (preview, leer una página, screenshots) | Viene con la app. Permiso permanente del dueño |
| Control del escritorio y Claude en Chrome | Vienen con la app |
| **ScreenApp** | API propia (`api.screenapp.io/v2`), no un conector. Ahí están las transcripciones de los cursos |
| **Panda Video** | API propia. Las métricas del VSL. Ojo: el header va `Authorization` **sin** «Bearer» |
| Supabase, Vercel, GitHub | Se usan por CLI y por `.env.local`, no por conector |

## Al cambiar de cuenta

Lo único que se pierde de esta página son los conectores en sí. Todo lo demás —las
memorias, las skills, los settings, `AGENTS.md` y estos documentos— vive en el disco o en
el repo y **no depende de la cuenta**: ver [dos-cuentas.md](dos-cuentas.md).

Checklist para la cuenta nueva:

- [ ] Conectar **Fathom**. Ojo: hay DOS cuentas de Fathom (la de Mauricio, que es la que
      usa el producto, y la de Martín). Cuál corresponde depende de quién opera la cuenta
      de Claude — preguntá, no lo asumas por el nombre del config dir.
- [ ] Conectar **Google Drive** si va a tocar `/conocimientos`.
- [ ] Conectar **Google Calendar** si va a tocar agenda u horarios.
- [ ] El resto: solo si aparece la necesidad.
