// =============================================================================
// Specs de graficos por feature (hero + uno por capacidad) para /vsl/<slug>.
// =============================================================================
// Generado desde el contenido real (texto corto; Visual.tsx recorta por las dudas).
// Biblioteca de tipos + params: ./Visual.tsx.

import type { VisualSpec } from './Visual';

export type FeatureVisuals = { hero: VisualSpec; groups: VisualSpec[] };

export const FEATURE_VISUALS: Record<string, FeatureVisuals> = {
  "funnel": {
    "hero": {
      "type": "funnel",
      "title": "Tu funnel entero",
      "stages": [
        {
          "label": "Clics",
          "w": 1
        },
        {
          "label": "VSL",
          "w": 0.7
        },
        {
          "label": "Agenda",
          "w": 0.42
        },
        {
          "label": "R1",
          "w": 0.24
        },
        {
          "label": "Cierre",
          "w": 0.12
        }
      ]
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Activo",
            "cards": 4,
            "tone": "green"
          },
          {
            "label": "Nutrición",
            "cards": 3,
            "tone": "amber"
          },
          {
            "label": "Descartado",
            "cards": 2,
            "tone": "red"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "Auto",
          "Manual"
        ],
        "tools": [
          {
            "tool": "Formulario",
            "on": [
              true,
              false
            ]
          },
          {
            "tool": "Agenda",
            "on": [
              true,
              false
            ]
          },
          {
            "tool": "Pago",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Asistencia",
            "on": [
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "phaseLadder",
        "title": "Plantilla VSL",
        "phases": [
          "VSL",
          "Agenda",
          "Webinar",
          "Grupo",
          "Cierre"
        ],
        "current": 2
      },
      {
        "type": "signalFlow",
        "title": "Fuente de verdad",
        "nodes": [
          {
            "label": "Config",
            "sub": "funnel",
            "tone": "blue"
          },
          {
            "label": "CRM",
            "sub": "Kanban",
            "tone": "violet"
          },
          {
            "label": "MaKo",
            "sub": "contexto",
            "tone": "green"
          }
        ]
      }
    ]
  },
  "onboarding": {
    "hero": {
      "type": "splitLoad",
      "left": "Contestás 3",
      "right": "Se cargan solos",
      "loading": [
        "Meta 365d",
        "Leads",
        "Guiones",
        "Llamadas"
      ]
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Extracción 365d",
        "tiles": [
          {
            "label": "Métricas",
            "value": "18k",
            "tone": "blue"
          },
          {
            "label": "Leads",
            "value": "1.2k",
            "tone": "green"
          },
          {
            "label": "Llamadas",
            "value": "340",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "PM",
          "Completo"
        ],
        "tools": [
          {
            "tool": "Brief",
            "on": [
              true,
              true
            ]
          },
          {
            "tool": "Meta",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "WhatsApp",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Funnel",
            "on": [
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "phaseLadder",
        "title": "Tu fase",
        "phases": [
          "Validar",
          "Tracción",
          "Escala",
          "Optimizar",
          "Sistema"
        ],
        "current": 1
      },
      {
        "type": "chatThread",
        "title": "MaKo <> Elevate",
        "msgs": [
          {
            "from": "in",
            "text": "Grupo creado ✓"
          },
          {
            "from": "in",
            "text": "Leí tus 365 días"
          },
          {
            "from": "in",
            "text": "Reactivá 8 no-shows"
          },
          {
            "from": "out",
            "text": "Dale, sumalo"
          }
        ]
      },
      {
        "type": "alertCard",
        "text": "Si tu token de Meta cae a mitad, MaKo corta. Nunca sigue con datos que no son tuyos."
      }
    ]
  },
  "graphics": {
    "hero": {
      "type": "dashboardMock",
      "title": "Marketing",
      "points": [
        0.3,
        0.5,
        0.42,
        0.66,
        0.8
      ],
      "kpis": [
        {
          "v": "4.2x",
          "k": "ROAS"
        },
        {
          "v": "$182",
          "k": "CAC"
        },
        {
          "v": "2.4%",
          "k": "CTR"
        }
      ]
    },
    "groups": [
      {
        "type": "chatThread",
        "title": "✨ MaKo · este gráfico",
        "msgs": [
          {
            "from": "out",
            "text": "¿Apago este anuncio?"
          },
          {
            "from": "in",
            "text": "Gastó $340, 0 cierres"
          },
          {
            "from": "out",
            "text": "¿Y el otro?"
          },
          {
            "from": "in",
            "text": "Escalalo: ROAS 4.2x"
          }
        ]
      },
      {
        "type": "funnel",
        "title": "Embudo Meta",
        "stages": [
          {
            "label": "Impresión",
            "w": 1
          },
          {
            "label": "Click",
            "w": 0.42
          },
          {
            "label": "Landing",
            "w": 0.28
          },
          {
            "label": "VSL",
            "w": 0.12
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Revenue",
        "tiles": [
          {
            "label": "Sold",
            "value": "$48k",
            "tone": "blue"
          },
          {
            "label": "Cash",
            "value": "$31k",
            "tone": "green"
          },
          {
            "label": "Falta",
            "value": "$17k",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "amber",
        "verdict": "Aún sin datos"
      },
      {
        "type": "barChart",
        "title": "Audiencia · edad",
        "bars": [
          {
            "label": "18-24",
            "v": 0.3
          },
          {
            "label": "25-34",
            "v": 0.9,
            "tone": "green"
          },
          {
            "label": "35-44",
            "v": 0.6
          },
          {
            "label": "45+",
            "v": 0.35
          }
        ]
      }
    ]
  },
  "crm": {
    "hero": {
      "type": "kanban",
      "cols": [
        {
          "label": "No Show",
          "cards": 3,
          "tone": "red"
        },
        {
          "label": "Nutrición",
          "cards": 2,
          "tone": "amber"
        },
        {
          "label": "Reactivación",
          "cards": 2
        },
        {
          "label": "Ganado",
          "cards": 1,
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "emailSequence",
        "title": "Reglas por tiempo",
        "steps": [
          {
            "day": "3 h",
            "subject": "Fathom → asistió o No Show"
          },
          {
            "day": "Día 2",
            "subject": "→ Nutrición No Agenda"
          },
          {
            "day": "Día 7",
            "subject": "→ Reactivación"
          },
          {
            "day": "Día 30",
            "subject": "Reactiva fríos"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Estado",
            "before": "Agendó",
            "after": "No Show"
          },
          {
            "field": "Etapa",
            "before": "R1",
            "after": "Reactivación"
          },
          {
            "field": "Fathom",
            "before": "—",
            "after": "✓ link"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Anti-loop",
        "tiles": [
          {
            "label": "Cupo",
            "value": "25",
            "tone": "blue"
          },
          {
            "label": "Dedup",
            "value": "✓",
            "tone": "green"
          },
          {
            "label": "Reintenta",
            "value": "↻",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Qué hago con Ana?",
        "a": "Cerrá en R2 hoy",
        "detail": "Vino del ad Dashboard, vio 80% del VSL, objeción de precio ya resuelta en R1. Sin cobranza pendiente."
      },
      {
        "type": "docExtract",
        "doc": "Ganado — requisitos",
        "fields": [
          {
            "k": "R1",
            "v": "✓ marcada"
          },
          {
            "k": "Calificado",
            "v": "✓"
          },
          {
            "k": "Fathom",
            "v": "✓ link"
          },
          {
            "k": "R2",
            "v": "✓ marcada"
          },
          {
            "k": "Monto",
            "v": "$12k"
          }
        ]
      }
    ]
  },
  "api": {
    "hero": {
      "type": "signalFlow",
      "title": "Señal a Meta",
      "nodes": [
        {
          "label": "CRM",
          "sub": "califica",
          "tone": "blue"
        },
        {
          "label": "SHA-256",
          "sub": "hash",
          "tone": "violet"
        },
        {
          "label": "Meta",
          "sub": "optimiza",
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Eventos CAPI",
        "stages": [
          {
            "label": "Leads",
            "w": 1
          },
          {
            "label": "Calificó",
            "w": 0.5
          },
          {
            "label": "Agendó",
            "w": 0.28
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Email",
            "before": "ana@mail",
            "after": "SHA-256"
          },
          {
            "field": "Pixel",
            "before": "bloqueado",
            "after": "✓ llega"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Venta nunca se cae"
      },
      {
        "type": "retentionCurve",
        "title": "Retención VSL",
        "points": [
          1,
          0.6,
          0.42,
          0.28,
          0.15
        ],
        "dropIndex": 1
      },
      {
        "type": "statTiles",
        "title": "Doble red",
        "tiles": [
          {
            "label": "Webhook",
            "value": "live",
            "tone": "blue"
          },
          {
            "label": "Polling",
            "value": "90d",
            "tone": "amber"
          },
          {
            "label": "Dupes",
            "value": "0",
            "tone": "green"
          }
        ]
      },
      {
        "type": "byokKey",
        "account": "Meta · Elevate MX"
      }
    ]
  },
  "ads": {
    "hero": {
      "type": "adRow",
      "rows": [
        {
          "name": "VSL Dolor",
          "cash": "$182k",
          "roas": "5.1x",
          "tone": "green"
        },
        {
          "name": "Testimonio",
          "cash": "$74k",
          "roas": "2.3x",
          "tone": "amber"
        },
        {
          "name": "Reels frío",
          "cash": "$0",
          "roas": "0x",
          "tone": "red"
        }
      ]
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "3 fuentes · 1 fila",
        "nodes": [
          {
            "label": "Meta",
            "sub": "estado vivo",
            "tone": "blue"
          },
          {
            "label": "Rango",
            "sub": "CPL · CTR",
            "tone": "violet"
          },
          {
            "label": "CRM",
            "sub": "cash real",
            "tone": "green"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Estado",
            "before": "Activo",
            "after": "Pausado"
          },
          {
            "field": "Nombre",
            "before": "AD 003",
            "after": "003 · Dolor"
          },
          {
            "field": "Budget",
            "before": "$500",
            "after": "$800"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Crear campaña",
        "msgs": [
          {
            "from": "out",
            "text": "Subí creativo ganador"
          },
          {
            "from": "in",
            "text": "¿Objetivo y presupuesto?"
          },
          {
            "from": "out",
            "text": "Leads · $600/día"
          },
          {
            "from": "in",
            "text": "✓ Árbol en PAUSA"
          }
        ]
      },
      {
        "type": "scoreCard",
        "chrome": "Ads Writer",
        "title": "Ángulos",
        "items": [
          {
            "label": "Dolor",
            "v": 0.9
          },
          {
            "label": "Prueba",
            "v": 0.72
          },
          {
            "label": "Urgencia",
            "v": 0.6
          },
          {
            "label": "Aspiracional",
            "v": 0.48
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Engagement",
            "cards": 2
          },
          {
            "label": "Video 75%",
            "cards": 3,
            "tone": "green"
          },
          {
            "label": "Pixel Lead",
            "cards": 1
          }
        ]
      },
      {
        "type": "barChart",
        "title": "Budget diario",
        "bars": [
          {
            "label": "Lun",
            "v": 0.4
          },
          {
            "label": "Mar",
            "v": 0.55
          },
          {
            "label": "Mié",
            "v": 0.5
          },
          {
            "label": "Jue",
            "v": 0.7
          },
          {
            "label": "Vie",
            "v": 0.9,
            "tone": "green"
          }
        ]
      }
    ]
  },
  "script": {
    "hero": {
      "type": "adRow",
      "rows": [
        {
          "name": "Dashboard ad",
          "cash": "$18k",
          "roas": "4.2x",
          "tone": "green"
        },
        {
          "name": "Testimonio",
          "cash": "$6k",
          "roas": "1.1x",
          "tone": "amber"
        },
        {
          "name": "Promesa",
          "cash": "$3k",
          "roas": "0.4x",
          "tone": "red"
        }
      ]
    },
    "groups": [
      {
        "type": "retentionCurve",
        "title": "Retención x beat",
        "points": [
          1,
          0.82,
          0.55,
          0.3,
          0.24,
          0.2
        ],
        "dropIndex": 2
      },
      {
        "type": "signalFlow",
        "title": "Guion cruzado",
        "nodes": [
          {
            "label": "Guion",
            "sub": "transcript",
            "tone": "blue"
          },
          {
            "label": "Meta",
            "sub": "retención",
            "tone": "violet"
          },
          {
            "label": "CRM",
            "sub": "cierres",
            "tone": "green"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Pausar",
            "cards": 3,
            "tone": "red"
          },
          {
            "label": "Gancho flojo",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "Escalar",
            "cards": 2,
            "tone": "green"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Produzco este guion?",
        "a": "Mejorá el gancho",
        "detail": "Se parece a tu ángulo saturado. Hook rate ~28% estimado. Probalo con $500 en 5 días."
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Ángulo",
            "before": "Dolor",
            "after": "Estatus"
          },
          {
            "field": "Avatar",
            "before": "—",
            "after": "Dueño PYME"
          },
          {
            "field": "Override",
            "before": "IA pisa",
            "after": "✓ sobrevive"
          }
        ]
      }
    ]
  },
  "closing": {
    "hero": {
      "type": "gauge",
      "value": 0.74,
      "big": "7.4",
      "label": "Cierre",
      "tone": "green"
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Venta",
            "cards": 4,
            "tone": "green"
          },
          {
            "label": "Servicio",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "Descarte",
            "cards": 3,
            "tone": "red"
          }
        ]
      },
      {
        "type": "scoreCard",
        "chrome": "Closing",
        "title": "SPIN",
        "items": [
          {
            "label": "Situación",
            "v": 0.9
          },
          {
            "label": "Problema",
            "v": 0.7
          },
          {
            "label": "Implicación",
            "v": 0.5
          },
          {
            "label": "Necesidad",
            "v": 0.8
          },
          {
            "label": "Propuesta",
            "v": 0.6
          },
          {
            "label": "Objeciones",
            "v": 0.4
          },
          {
            "label": "CTA",
            "v": 0.5
          }
        ]
      },
      {
        "type": "barChart",
        "title": "Gap por dimensión",
        "bars": [
          {
            "label": "Objeciones",
            "v": 0.92,
            "tone": "green"
          },
          {
            "label": "CTA",
            "v": 0.6
          },
          {
            "label": "Implicación",
            "v": 0.48
          },
          {
            "label": "Problema",
            "v": 0.3
          },
          {
            "label": "Situación",
            "v": 0.18
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "CTA",
            "before": "5.0",
            "after": "7.0"
          },
          {
            "field": "Outcome",
            "before": "Perdida",
            "after": "Ganada"
          },
          {
            "field": "Fathom",
            "before": "—",
            "after": "✓ clip"
          }
        ]
      },
      {
        "type": "splitLoad",
        "left": "Vos escuchás",
        "right": "Se cargan solas",
        "loading": [
          "Fathom",
          "Leads",
          "Transcript",
          "Llamadas"
        ]
      }
    ]
  },
  "seguimiento": {
    "hero": {
      "type": "kanban",
      "cols": [
        {
          "label": "No agendó",
          "cards": 4,
          "tone": "red"
        },
        {
          "label": "No Show",
          "cards": 3,
          "tone": "amber"
        },
        {
          "label": "Sin pagar",
          "cards": 2
        },
        {
          "label": "Frío",
          "cards": 3,
          "tone": "green"
        }
      ]
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Dónde se traba",
        "stages": [
          {
            "label": "Form",
            "w": 1
          },
          {
            "label": "VSL 50%",
            "w": 0.72
          },
          {
            "label": "Agenda",
            "w": 0.5
          },
          {
            "label": "R1",
            "w": 0.34
          },
          {
            "label": "R2",
            "w": 0.2
          },
          {
            "label": "Pago",
            "w": 0.12
          }
        ]
      },
      {
        "type": "ragIndex",
        "title": "Tu voz",
        "source": "tus ads"
      },
      {
        "type": "chatThread",
        "title": "Respondió",
        "msgs": [
          {
            "from": "in",
            "text": "Hola, me interesa"
          },
          {
            "from": "out",
            "text": "Freno la nutrición"
          },
          {
            "from": "out",
            "text": "✓ Envío borrado"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Plantilla Meta",
        "nodes": [
          {
            "label": "Copy",
            "sub": "tu voz",
            "tone": "blue"
          },
          {
            "label": "Meta-safe",
            "sub": "sin links",
            "tone": "violet"
          },
          {
            "label": "Approved",
            "sub": "envía",
            "tone": "green"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Log del motor",
        "tiles": [
          {
            "label": "Enviado",
            "value": "1.284",
            "tone": "green"
          },
          {
            "label": "Simulado",
            "value": "96",
            "tone": "blue"
          },
          {
            "label": "Omitido",
            "value": "41",
            "tone": "amber"
          }
        ]
      }
    ]
  },
  "cobranza": {
    "hero": {
      "type": "statTiles",
      "title": "Revenue real",
      "tiles": [
        {
          "label": "Vendido",
          "value": "$48k",
          "tone": "blue"
        },
        {
          "label": "Cobrado",
          "value": "$31k",
          "tone": "green"
        },
        {
          "label": "Falta",
          "value": "$17k",
          "tone": "amber"
        }
      ]
    },
    "groups": [
      {
        "type": "barChart",
        "title": "Siempre cuadra",
        "bars": [
          {
            "label": "Vendido",
            "v": 1,
            "tone": "blue"
          },
          {
            "label": "Cobrado",
            "v": 0.65,
            "tone": "green"
          },
          {
            "label": "Falta",
            "v": 0.35,
            "tone": "amber"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Cobrar hoy",
        "tiers": [
          {
            "label": "Vencidas · 3",
            "tone": "red"
          },
          {
            "label": "≤5 días · 2",
            "tone": "amber"
          },
          {
            "label": "Al día",
            "tone": "green"
          }
        ]
      },
      {
        "type": "emailSequence",
        "title": "Plan de pago",
        "steps": [
          {
            "day": "Cierre",
            "subject": "Inicial $2.000"
          },
          {
            "day": "15/08",
            "subject": "Cuota 1 · $1.500"
          },
          {
            "day": "15/09",
            "subject": "Cuota 2 · $1.500"
          }
        ]
      },
      {
        "type": "docExtract",
        "doc": "comprobante.jpg",
        "fields": [
          {
            "k": "Monto",
            "v": "$2.000"
          },
          {
            "k": "Fecha",
            "v": "15/08"
          },
          {
            "k": "Hora",
            "v": "14:32"
          }
        ]
      },
      {
        "type": "dashboardMock",
        "title": "18 meses",
        "points": [
          0.3,
          0.45,
          0.5,
          0.62,
          0.7,
          0.8
        ],
        "kpis": [
          {
            "v": "$48k",
            "k": "Sold"
          },
          {
            "v": "$31k",
            "k": "Cash"
          },
          {
            "v": "$9k",
            "k": "Meta"
          }
        ]
      }
    ]
  },
  "contrato": {
    "hero": {
      "type": "docExtract",
      "doc": "contrato.pdf",
      "fields": [
        {
          "k": "Total",
          "v": "$12.000"
        },
        {
          "k": "Cuotas",
          "v": "6"
        },
        {
          "k": "Servicio",
          "v": "Coaching"
        },
        {
          "k": "1er pago",
          "v": "15/08"
        }
      ]
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Plan de cuotas",
        "tiles": [
          {
            "label": "Total",
            "value": "$12k",
            "tone": "blue"
          },
          {
            "label": "Pagado",
            "value": "$4k",
            "tone": "green"
          },
          {
            "label": "Falta",
            "value": "$8k",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Cuota 1 · pagada",
            "amount": "$2k",
            "tone": "green"
          },
          {
            "name": "Cuota 2 · 15/08",
            "amount": "$2k",
            "tone": "amber"
          },
          {
            "name": "Cuota 3 · 15/09",
            "amount": "$2k",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Detecta el archivo",
        "nodes": [
          {
            "label": "PDF",
            "sub": "o foto",
            "tone": "blue"
          },
          {
            "label": "MaKo",
            "sub": "detecta tipo",
            "tone": "violet"
          },
          {
            "label": "Datos",
            "sub": "extraídos",
            "tone": "green"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Servicio",
            "before": "vacío",
            "after": "Coaching"
          },
          {
            "field": "Fiscal",
            "before": "vacío",
            "after": "✓ cargado"
          },
          {
            "field": "Promesa",
            "before": "vacío",
            "after": "✓ garantía"
          },
          {
            "field": "A mano",
            "before": "Ana SA",
            "after": "Ana SA"
          }
        ]
      },
      {
        "type": "dashboardMock",
        "title": "Comercial",
        "points": [
          0.3,
          0.45,
          0.55,
          0.7,
          0.85
        ],
        "kpis": [
          {
            "v": "$31k",
            "k": "Cobrado"
          },
          {
            "v": "$8k",
            "k": "Falta"
          },
          {
            "v": "6",
            "k": "Cuotas"
          }
        ]
      }
    ]
  },
  "customer": {
    "hero": {
      "type": "makoAnswer",
      "q": "¿Quién se me enfría?",
      "a": "Ana: llamada tibia + impaga",
      "detail": "En su última sesión de entrega bajó el entusiasmo y arrastra una cuota vencida. Reactivala esta semana."
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Venta",
            "cards": 4
          },
          {
            "label": "Entrega",
            "cards": 3,
            "tone": "green"
          },
          {
            "label": "Interna",
            "cards": 2
          },
          {
            "label": "Otro",
            "cards": 1
          }
        ]
      },
      {
        "type": "gauge",
        "value": 0.82,
        "big": "82",
        "label": "Health",
        "tone": "green"
      },
      {
        "type": "signalFlow",
        "title": "Alerta de churn",
        "nodes": [
          {
            "label": "Llamada",
            "sub": "tibia",
            "tone": "amber"
          },
          {
            "label": "Cobranza",
            "sub": "impaga",
            "tone": "violet"
          },
          {
            "label": "MaKo",
            "sub": "te avisa",
            "tone": "green"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Donde queda la plata",
        "tiles": [
          {
            "label": "Cierre",
            "value": "$8k",
            "tone": "blue"
          },
          {
            "label": "Renueva",
            "value": "$8k",
            "tone": "green"
          },
          {
            "label": "Upsell",
            "value": "$5k",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Ana · pidió más",
            "amount": "$5k",
            "tone": "green"
          },
          {
            "name": "Luis · renueva",
            "amount": "$8k",
            "tone": "green"
          }
        ]
      }
    ]
  },
  "semaforo": {
    "hero": {
      "type": "semaphore",
      "lit": "red",
      "verdict": "Algo urgente hoy"
    },
    "groups": [
      {
        "type": "pyramid",
        "title": "Por urgencia",
        "tiers": [
          {
            "label": "Urgente · 2",
            "tone": "red"
          },
          {
            "label": "Vigilar · 3",
            "tone": "amber"
          },
          {
            "label": "En orden",
            "tone": "green"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Meta caída",
            "cards": 1,
            "tone": "red"
          },
          {
            "label": "Creativo",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "R1→R2",
            "cards": 3,
            "tone": "amber"
          },
          {
            "label": "Cobranza",
            "cards": 2,
            "tone": "red"
          }
        ]
      },
      {
        "type": "gauge",
        "value": 0.28,
        "big": "28%",
        "label": "Cierre",
        "tone": "amber"
      },
      {
        "type": "alertCard",
        "text": "Tu cuenta Meta dice ACTIVE pero no entrega. Saldo impago, los leads dejaron de entrar."
      },
      {
        "type": "chatThread",
        "title": "MaKo · 7:00",
        "msgs": [
          {
            "from": "in",
            "text": "Semáforo: verde"
          },
          {
            "from": "in",
            "text": "3 wins ayer"
          },
          {
            "from": "in",
            "text": "1 cuota vence hoy"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Meta",
            "before": "🔴 10:00",
            "after": "🟢 14:20"
          },
          {
            "field": "Duración",
            "before": "—",
            "after": "2h 20m"
          }
        ]
      }
    ]
  },
  "experimentos": {
    "hero": {
      "type": "stamp",
      "title": "Hipótesis",
      "result": "validated",
      "before": "$41",
      "after": "$26"
    },
    "groups": [
      {
        "type": "chatThread",
        "title": "Escribí tu idea",
        "msgs": [
          {
            "from": "out",
            "text": "filtro más el form"
          },
          {
            "from": "in",
            "text": "Métrica: cp_form"
          },
          {
            "from": "in",
            "text": "Éxito: baja · 14 días"
          },
          {
            "from": "out",
            "text": "Confirmar"
          }
        ]
      },
      {
        "type": "barChart",
        "title": "Medición diaria",
        "bars": [
          {
            "label": "D1",
            "v": 0.4
          },
          {
            "label": "D2",
            "v": 0.5
          },
          {
            "label": "D3",
            "v": 0.46
          },
          {
            "label": "D4",
            "v": 0.7,
            "tone": "green"
          },
          {
            "label": "D5",
            "v": 0.82,
            "tone": "green"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "green",
        "verdict": "Hipótesis validada"
      },
      {
        "type": "makoAnswer",
        "q": "¿Subo el ticket?",
        "a": "Sí, ya lo probaste",
        "detail": "Tu experimento de mayo validó +18% de cierre al subir el precio. No es teoría de gurú: es tu dato."
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Propuesto",
            "cards": 2
          },
          {
            "label": "Activo",
            "cards": 3,
            "tone": "green"
          },
          {
            "label": "Cerrado",
            "cards": 4
          },
          {
            "label": "Descartado",
            "cards": 1,
            "tone": "red"
          }
        ]
      }
    ]
  },
  "prioridades": {
    "hero": {
      "type": "makoAnswer",
      "q": "¿Qué hago hoy?",
      "a": "El objetivo top, primero",
      "detail": "MaKo numera 3 jugadas del proyecto #1. El resto baja solo — urgente no es lo mismo que importante."
    },
    "groups": [
      {
        "type": "statTiles",
        "title": "Score de tarea",
        "tiles": [
          {
            "label": "Impacto",
            "value": "92",
            "tone": "blue"
          },
          {
            "label": "Esfuerzo",
            "value": "18",
            "tone": "green"
          },
          {
            "label": "Score",
            "value": "87",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Subir precio R2",
            "amount": "87",
            "tone": "green"
          },
          {
            "name": "Refinar VSL",
            "amount": "41",
            "tone": "amber"
          },
          {
            "name": "Rediseñar logo",
            "amount": "12",
            "tone": "red"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Debate con el guardián",
        "msgs": [
          {
            "from": "out",
            "text": "Subo esto, es importante"
          },
          {
            "from": "in",
            "text": "¿Cuánta plata trae?"
          },
          {
            "from": "out",
            "text": "No sé, me gusta"
          },
          {
            "from": "in",
            "text": "Rechazo: es apego"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Pirámide sana",
        "tiers": [
          {
            "label": "Alta · 15%",
            "tone": "red"
          },
          {
            "label": "Media · 25%",
            "tone": "amber"
          },
          {
            "label": "Baja · 30%",
            "tone": "green"
          },
          {
            "label": "A futuro · 30%",
            "tone": "green"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Nueva",
            "cards": 2,
            "tone": "green"
          },
          {
            "label": "Enriquece",
            "cards": 3
          },
          {
            "label": "No borra",
            "cards": 1,
            "tone": "red"
          }
        ]
      },
      {
        "type": "splitLoad",
        "left": "Vos trabajás",
        "right": "Se ordena solo",
        "loading": [
          "Detecta cambio",
          "Espera 2.5s",
          "Re-puntúa",
          "Estabiliza"
        ]
      }
    ]
  },
  "retro": {
    "hero": {
      "type": "thesisCard",
      "tabs": [
        "Ads",
        "CRM",
        "Closing",
        "Guiones",
        "Revenue",
        "Experimentos"
      ],
      "thesis": "El frente compra barato, el embudo pierde",
      "leak": "$18k",
      "plan": "2 exp · 5 tareas"
    },
    "groups": [
      {
        "type": "signalFlow",
        "title": "El cruce",
        "nodes": [
          {
            "label": "6 áreas",
            "sub": "en paralelo",
            "tone": "blue"
          },
          {
            "label": "Cruces",
            "sub": "entre áreas",
            "tone": "violet"
          },
          {
            "label": "Insight",
            "sub": "oculto",
            "tone": "green"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Fuga del período",
        "tiles": [
          {
            "label": "Fuga",
            "value": "$18k",
            "tone": "amber"
          },
          {
            "label": "Sano",
            "value": "4/6",
            "tone": "green"
          },
          {
            "label": "Sangra",
            "value": "2/6",
            "tone": "red"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Título",
            "before": "crudo",
            "after": "reescrito"
          },
          {
            "field": "Insight",
            "before": "—",
            "after": "MaKo"
          },
          {
            "field": "Evidencia",
            "before": "$18k",
            "after": "$18k 🔒"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Perro Guardián",
        "tiers": [
          {
            "label": "Alta · 15%",
            "tone": "red"
          },
          {
            "label": "Media",
            "tone": "amber"
          },
          {
            "label": "Baja",
            "tone": "green"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Hecha",
            "cards": 2,
            "tone": "green"
          },
          {
            "label": "Empezada",
            "cards": 1,
            "tone": "amber"
          },
          {
            "label": "Aceptada",
            "cards": 3,
            "tone": "red"
          },
          {
            "label": "Se perdió",
            "cards": 1,
            "tone": "red"
          }
        ]
      }
    ]
  },
  "fase-norte": {
    "hero": {
      "type": "phaseLadder",
      "title": "Tu fase real",
      "phases": [
        "Visibilidad",
        "Conversión",
        "Sistemas",
        "Delegación",
        "Foco"
      ],
      "current": 1
    },
    "groups": [
      {
        "type": "funnel",
        "title": "Tu cuello",
        "stages": [
          {
            "label": "Leads",
            "w": 1
          },
          {
            "label": "R1",
            "w": 0.52
          },
          {
            "label": "R2",
            "w": 0.34
          },
          {
            "label": "Cierre",
            "w": 0.16
          }
        ]
      },
      {
        "type": "barChart",
        "title": "Tu reparto",
        "bars": [
          {
            "label": "F0",
            "v": 0.18
          },
          {
            "label": "F1",
            "v": 0.34
          },
          {
            "label": "F2",
            "v": 0.5,
            "tone": "amber"
          }
        ]
      },
      {
        "type": "makoAnswer",
        "q": "¿Subo el presupuesto?",
        "a": "No todavía",
        "detail": "Estás en Fase 1: tu R1 muestra al 30%. Arreglá la conversión antes de escalar la pauta."
      },
      {
        "type": "scoreCard",
        "chrome": "Diagnóstico",
        "title": "6 dimensiones",
        "items": [
          {
            "label": "Ingresos",
            "v": 0.4
          },
          {
            "label": "Leads",
            "v": 0.6
          },
          {
            "label": "Funnel",
            "v": 0.3
          },
          {
            "label": "Ventas",
            "v": 0.3
          },
          {
            "label": "Cuello",
            "v": 0.2
          },
          {
            "label": "Equipo",
            "v": 0.5
          }
        ]
      }
    ]
  },
  "whatsapp": {
    "hero": {
      "type": "chatThread",
      "title": "Hola MaKo",
      "msgs": [
        {
          "from": "out",
          "text": "Lead frío, ¿qué mando?"
        },
        {
          "from": "in",
          "text": "Reactivá con prueba social"
        },
        {
          "from": "in",
          "text": "Ventana: 3h 12m"
        },
        {
          "from": "out",
          "text": "✓ Enviado"
        }
      ]
    },
    "groups": [
      {
        "type": "waInbox",
        "rows": [
          {
            "name": "Ana Méndez",
            "stage": "R2",
            "win": 18
          },
          {
            "name": "Luis Soto",
            "stage": "por-cobrar",
            "win": 4
          },
          {
            "name": "Sofi Ruiz",
            "stage": "no-show",
            "win": 0
          }
        ]
      },
      {
        "type": "gauge",
        "value": 0.13,
        "big": "3:12",
        "label": "Ventana",
        "tone": "amber"
      },
      {
        "type": "makoAnswer",
        "q": "¿Qué le contesto?",
        "a": "Prueba social + cierre suave",
        "detail": "Lleva 6 días sin responder, etapa R2. Mandá el caso de un cliente similar y proponé retomar la llamada."
      },
      {
        "type": "scoreCard",
        "chrome": "Plantilla",
        "title": "Rúbrica Meta",
        "items": [
          {
            "label": "Política",
            "v": 0.9
          },
          {
            "label": "Variables",
            "v": 1
          },
          {
            "label": "Categoría",
            "v": 0.7
          },
          {
            "label": "Riesgo",
            "v": 0.85
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Pendiente",
            "cards": 3,
            "tone": "amber"
          },
          {
            "label": "Enviando",
            "cards": 1
          },
          {
            "label": "Enviado",
            "cards": 4,
            "tone": "green"
          }
        ]
      }
    ]
  },
  "email": {
    "hero": {
      "type": "emailSequence",
      "title": "Secuencia auto",
      "steps": [
        {
          "day": "Día 0",
          "subject": "No agendaste"
        },
        {
          "day": "Día 2",
          "subject": "El caso de Ana"
        },
        {
          "day": "Día 5",
          "subject": "Última llamada"
        }
      ]
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "No Show",
            "cards": 3,
            "tone": "red"
          },
          {
            "label": "Sin pagar",
            "cards": 2,
            "tone": "amber"
          },
          {
            "label": "Ganados",
            "cards": 4,
            "tone": "green"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Botón MaKo",
        "msgs": [
          {
            "from": "out",
            "text": "Escribí el email R1",
            "voice": true
          },
          {
            "from": "in",
            "text": "Asunto + cuerpo ✓"
          },
          {
            "from": "out",
            "text": "Probá a mí"
          },
          {
            "from": "in",
            "text": "✓ [PRUEBA] enviado"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Tu dominio",
        "nodes": [
          {
            "label": "Dominio",
            "sub": "alta",
            "tone": "blue"
          },
          {
            "label": "DKIM",
            "sub": "SPF/DNS",
            "tone": "violet"
          },
          {
            "label": "Verified",
            "sub": "remitente fijo",
            "tone": "green"
          }
        ]
      },
      {
        "type": "gauge",
        "value": 0.94,
        "big": "94%",
        "label": "Entrega",
        "tone": "green"
      }
    ]
  },
  "conocimiento": {
    "hero": {
      "type": "ragIndex",
      "title": "Tu método",
      "source": "tu clase"
    },
    "groups": [
      {
        "type": "splitLoad",
        "left": "Pegás o subís",
        "right": "Queda indexado",
        "loading": [
          "Texto",
          "Video 25MB",
          "Curso",
          "Whisper"
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "mensajes",
          "ads",
          "general"
        ],
        "tools": [
          {
            "tool": "WhatsApp",
            "on": [
              true,
              false,
              false
            ]
          },
          {
            "tool": "Nutrición",
            "on": [
              true,
              false,
              false
            ]
          },
          {
            "tool": "Campañas Meta",
            "on": [
              false,
              true,
              false
            ]
          },
          {
            "tool": "Chat MaKo",
            "on": [
              false,
              false,
              true
            ]
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Recuperación",
        "nodes": [
          {
            "label": "Consulta",
            "sub": "tu duda",
            "tone": "blue"
          },
          {
            "label": "Embedding",
            "sub": "vector",
            "tone": "violet"
          },
          {
            "label": "Top-k",
            "sub": "coseno",
            "tone": "green"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Aditivo",
        "tiers": [
          {
            "label": "Tu método",
            "tone": "green"
          },
          {
            "label": "Glosario",
            "tone": "amber"
          },
          {
            "label": "Base agencia",
            "tone": "green"
          }
        ]
      }
    ]
  },
  "mako": {
    "hero": {
      "type": "makoAnswer",
      "q": "¿Escalo este ad?",
      "a": "No, pausá el otro",
      "detail": "Gastó $340 y 0 cierres en 7 días. Tu CAC objetivo es $180 y ya lo triplicó."
    },
    "groups": [
      {
        "type": "splitLoad",
        "left": "Preguntás",
        "right": "Contexto vivo",
        "loading": [
          "Persona",
          "Funnel real",
          "Fase/Norte",
          "Método RAG"
        ]
      },
      {
        "type": "signalFlow",
        "title": "Consulta antes de opinar",
        "nodes": [
          {
            "label": "Leads",
            "sub": "ficha 360",
            "tone": "blue"
          },
          {
            "label": "getTenantDb",
            "sub": "solo lectura",
            "tone": "violet"
          },
          {
            "label": "MaKo",
            "sub": "con datos",
            "tone": "green"
          }
        ]
      },
      {
        "type": "chatThread",
        "title": "Hola MaKo",
        "msgs": [
          {
            "from": "out",
            "text": "nota de voz",
            "voice": true
          },
          {
            "from": "in",
            "text": "Leí tu audio. ¿Pauso el ad?"
          },
          {
            "from": "out",
            "text": "Sí"
          },
          {
            "from": "in",
            "text": "✓ Pausado"
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Mover lead",
            "before": "Propone",
            "after": "Espera OK"
          },
          {
            "field": "Acción",
            "before": "—",
            "after": "Vence 2h"
          }
        ]
      },
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Ads",
            "cards": 3
          },
          {
            "label": "CRM",
            "cards": 2,
            "tone": "red"
          },
          {
            "label": "Proyecto nuevo",
            "cards": 1,
            "tone": "green"
          }
        ]
      },
      {
        "type": "pyramid",
        "title": "Prioridad",
        "tiers": [
          {
            "label": "Alta · 3 hoy",
            "tone": "red"
          },
          {
            "label": "Media · 5",
            "tone": "amber"
          },
          {
            "label": "Baja · 8",
            "tone": "green"
          }
        ]
      },
      {
        "type": "ragIndex",
        "title": "Tu método",
        "source": "tu clase"
      }
    ]
  },
  "integraciones": {
    "hero": {
      "type": "byokKey",
      "account": "Meta Ads · Elevate MX"
    },
    "groups": [
      {
        "type": "splitLoad",
        "left": "Pegás la key",
        "right": "Conecta y prueba",
        "loading": [
          "Meta Ads",
          "WhatsApp",
          "Fathom",
          "Calendly"
        ]
      },
      {
        "type": "signalFlow",
        "title": "Cada credencial",
        "nodes": [
          {
            "label": "Key",
            "sub": "tu workspace",
            "tone": "blue"
          },
          {
            "label": "HKDF",
            "sub": "sal+AAD",
            "tone": "violet"
          },
          {
            "label": "AES-256",
            "sub": "aislada",
            "tone": "green"
          }
        ]
      },
      {
        "type": "statTiles",
        "title": "Saldo de IA",
        "tiles": [
          {
            "label": "Mes",
            "value": "$42",
            "tone": "blue"
          },
          {
            "label": "Saldo",
            "value": "$180",
            "tone": "green"
          },
          {
            "label": "Resta",
            "value": "$138",
            "tone": "amber"
          }
        ],
        "rows": [
          {
            "name": "Closing · Opus",
            "amount": "$0.42",
            "tone": "blue"
          },
          {
            "name": "Voz · Sonnet",
            "amount": "$0.08",
            "tone": "green"
          },
          {
            "name": "STT · Groq",
            "amount": "$0.00",
            "tone": "amber"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "Claude",
          "Sonnet",
          "Groq"
        ],
        "tools": [
          {
            "tool": "Datos PII",
            "on": [
              true,
              false,
              false
            ]
          },
          {
            "tool": "Voz marca",
            "on": [
              false,
              true,
              false
            ]
          },
          {
            "tool": "Simples",
            "on": [
              false,
              false,
              true
            ]
          }
        ]
      }
    ]
  },
  "equipo": {
    "hero": {
      "type": "roleMatrix",
      "roles": [
        "Setter",
        "Closer",
        "Admin"
      ],
      "tools": [
        {
          "tool": "CRM",
          "on": [
            true,
            true,
            true
          ]
        },
        {
          "tool": "WhatsApp",
          "on": [
            true,
            true,
            true
          ]
        },
        {
          "tool": "Email",
          "on": [
            true,
            false,
            true
          ]
        },
        {
          "tool": "Closing",
          "on": [
            false,
            true,
            true
          ]
        },
        {
          "tool": "Ads",
          "on": [
            false,
            false,
            true
          ]
        },
        {
          "tool": "Config",
          "on": [
            false,
            false,
            true
          ]
        }
      ]
    },
    "groups": [
      {
        "type": "kanban",
        "cols": [
          {
            "label": "Setter",
            "cards": 3
          },
          {
            "label": "Closer",
            "cards": 3,
            "tone": "blue"
          },
          {
            "label": "Admin",
            "cards": 4,
            "tone": "green"
          }
        ]
      },
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "403 · sin acceso"
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Rol",
            "before": "Closer",
            "after": "Revocado"
          },
          {
            "field": "Aplica",
            "before": "Al deslogear",
            "after": "Al instante"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Alta del vendedor",
        "nodes": [
          {
            "label": "Email",
            "sub": "invitás",
            "tone": "blue"
          },
          {
            "label": "Google",
            "sub": "entra",
            "tone": "violet"
          },
          {
            "label": "Activo",
            "sub": "sin pass",
            "tone": "green"
          }
        ]
      },
      {
        "type": "alertCard",
        "text": "Tocás a alguien de otro workspace y MaKo devuelve 404: ese miembro no pertenece a tu equipo."
      }
    ]
  },
  "perfil-reportes": {
    "hero": {
      "type": "chatThread",
      "title": "Reporte MaKo",
      "msgs": [
        {
          "from": "in",
          "text": "☀️ Reporte de ayer"
        },
        {
          "from": "in",
          "text": "Meta frenó la entrega"
        },
        {
          "from": "in",
          "text": "Cuota vencida $2.5k"
        },
        {
          "from": "out",
          "text": "Abrir panel"
        }
      ]
    },
    "groups": [
      {
        "type": "semaphore",
        "lit": "red",
        "verdict": "Solo suena si duele"
      },
      {
        "type": "dashboardMock",
        "title": "Digest diario",
        "points": [
          0.3,
          0.5,
          0.42,
          0.66,
          0.8
        ],
        "kpis": [
          {
            "v": "$14",
            "k": "CPL"
          },
          {
            "v": "2.1%",
            "k": "CTR"
          },
          {
            "v": "31%",
            "k": "Cierre"
          }
        ]
      },
      {
        "type": "signalFlow",
        "title": "Reporte por WhatsApp",
        "nodes": [
          {
            "label": "Plantilla",
            "sub": "apertura",
            "tone": "blue"
          },
          {
            "label": "Ventana",
            "sub": "24h",
            "tone": "violet"
          },
          {
            "label": "Texto",
            "sub": "multilínea",
            "tone": "green"
          }
        ]
      },
      {
        "type": "roleMatrix",
        "roles": [
          "WhatsApp",
          "Email"
        ],
        "tools": [
          {
            "tool": "Horario",
            "on": [
              true,
              false
            ]
          },
          {
            "tool": "Diario",
            "on": [
              false,
              true
            ]
          },
          {
            "tool": "Semanal",
            "on": [
              true,
              true
            ]
          }
        ]
      },
      {
        "type": "diffCard",
        "rows": [
          {
            "field": "Alcance",
            "before": "Tuyo",
            "after": "Negocio"
          },
          {
            "field": "Guarda",
            "before": "Perfil",
            "after": "Contacto"
          },
          {
            "field": "Corre",
            "before": "Con login",
            "after": "Sin sesión"
          }
        ]
      }
    ]
  }
};
