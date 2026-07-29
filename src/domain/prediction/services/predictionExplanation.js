import { z } from 'zod'

import { ValidationError } from '../../../shared/errors/AppError.js'
import {
  EXPLANATION_RESPONSIBLE_USE_NOTICE,
  EXPLANATION_SOURCES,
  EXPLANATION_STATUSES
} from '../constants/explanationDefaults.js'

const PROHIBITED_LANGUAGE_PATTERNS = [
  /\bgaranti[az]\b/i,
  /\bsegur[ao]\b/i,
  /\bcerteza\b/i,
  /\bsin riesgo\b/i,
  /\bbeneficio asegurado\b/i,
  /\bapuesta segura\b/i
]

function sanitizeExplanationAtom(value, maxLength = 80) {
  const normalized = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.slice(0, maxLength)
}

function toPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`
}

function toRounded(value, digits = 2) {
  return Number(value).toFixed(digits)
}

function describeSelection(prediction) {
  const homeTeamName = sanitizeExplanationAtom(prediction.fixture.homeTeam.name)
  const awayTeamName = sanitizeExplanationAtom(prediction.fixture.awayTeam.name)
  const labels = {
    MATCH_RESULT: {
      HOME: `victoria de ${homeTeamName}`,
      DRAW: 'empate',
      AWAY: `victoria de ${awayTeamName}`
    },
    OVER_UNDER_2_5: {
      OVER_2_5: 'mas de 2.5 goles',
      UNDER_2_5: 'menos de 2.5 goles'
    },
    BOTH_TEAMS_TO_SCORE: {
      YES: 'ambos equipos marcan',
      NO: 'al menos uno de los equipos no marca'
    },
    DOUBLE_CHANCE: {
      HOME_OR_DRAW: `${homeTeamName} o empate`,
      DRAW_OR_AWAY: `empate o ${awayTeamName}`,
      HOME_OR_AWAY: `${homeTeamName} o ${awayTeamName}`
    }
  }

  return (
    labels[prediction.market]?.[prediction.selection] ?? prediction.selection
  )
}

function buildSummaryCandidates({
  prediction,
  modelPrediction,
  selectionLabel
}) {
  const homeTeamName = sanitizeExplanationAtom(prediction.fixture.homeTeam.name)
  const awayTeamName = sanitizeExplanationAtom(prediction.fixture.awayTeam.name)

  return [
    `La seleccion ${selectionLabel} entra en consideracion porque el modelo la valora en ${toPercent(prediction.modelProbability)} frente a ${toPercent(prediction.marketProbability)} del mercado, con confianza ${prediction.confidenceScore}/100.`,
    `El cruce ${homeTeamName} vs ${awayTeamName} muestra una ventaja estadistica para ${selectionLabel}: edge de ${toRounded(prediction.edgePp, 1)} pp y riesgo ${prediction.riskLevel}.`,
    `La lectura prepartido favorece ${selectionLabel} con una diferencia positiva entre probabilidad propia y mercado, apoyada por el modelo ${modelPrediction.modelVersion}.`
  ]
}

function buildSupportingCandidates({
  prediction,
  modelPrediction,
  selectionLabel
}) {
  const homeTeamName = sanitizeExplanationAtom(prediction.fixture.homeTeam.name)
  const awayTeamName = sanitizeExplanationAtom(prediction.fixture.awayTeam.name)
  const bookmaker = sanitizeExplanationAtom(prediction.sources.bookmaker, 40)
  const candidates = [
    `La probabilidad propia para ${selectionLabel} es ${toPercent(prediction.modelProbability)} y supera la implicita del mercado (${toPercent(prediction.marketProbability)}).`,
    `El edge estimado es de ${toRounded(prediction.edgePp, 1)} puntos porcentuales.`,
    `La confianza compuesta quedo en ${prediction.confidenceScore}/100 con riesgo ${prediction.riskLevel}.`,
    `La calidad de datos es ${modelPrediction.dataQuality.status} con muestra previa de ${modelPrediction.inputs.sampleSizeHome} partidos del local y ${modelPrediction.inputs.sampleSizeAway} del visitante.`,
    `Los goles esperados proyectados son ${toRounded(modelPrediction.expectedGoals.home)} para ${homeTeamName} y ${toRounded(modelPrediction.expectedGoals.away)} para ${awayTeamName}.`,
    `La cuota utilizada proviene de ${bookmaker} y fue capturada hace ${toRounded(prediction.sources.oddsAgeHours ?? 0, 1)} horas.`
  ]

  if (
    modelPrediction.expectedGoals.home > modelPrediction.expectedGoals.away &&
    prediction.selection === 'HOME'
  ) {
    candidates.push(
      `${homeTeamName} proyecta mas gol esperado que ${awayTeamName}, alineado con la seleccion elegida.`
    )
  }

  if (
    modelPrediction.expectedGoals.away > modelPrediction.expectedGoals.home &&
    prediction.selection === 'AWAY'
  ) {
    candidates.push(
      `${awayTeamName} proyecta mas gol esperado que ${homeTeamName}, alineado con la seleccion elegida.`
    )
  }

  return [...new Set(candidates)]
}

function buildCounterCandidates({ prediction, modelPrediction }) {
  const candidates = [
    `La recomendacion sigue siendo experimental y depende de una ventana historica acotada al corte ${modelPrediction.inputs.historicalCutoff}.`,
    `El mercado puede corregirse antes del kickoff y reducir el edge detectado.`,
    'La senal estadistica no elimina la varianza propia de un partido unico.',
    `La muestra previa es de ${modelPrediction.inputs.sampleSizeHome}/${modelPrediction.inputs.sampleSizeAway} partidos relevantes, por lo que no representa certeza.`
  ]

  if (prediction.riskLevel !== 'LOW') {
    candidates.push(
      `El riesgo operativo esta clasificado como ${prediction.riskLevel}, por lo que la lectura requiere cautela adicional.`
    )
  }

  if (modelPrediction.dataQuality.flags.length > 0) {
    candidates.push(
      `Existen banderas de calidad de datos: ${modelPrediction.dataQuality.flags.join(', ')}.`
    )
  }

  return [...new Set(candidates)]
}

function buildWarningCandidates({ prediction, modelPrediction }) {
  const bookmaker = sanitizeExplanationAtom(prediction.sources.bookmaker, 40)
  const candidates = [
    EXPLANATION_RESPONSIBLE_USE_NOTICE,
    `Fuente de mercado: ${bookmaker}; hora de captura: ${prediction.sources.capturedAt}.`,
    `El modelo ${prediction.modelVersion} no usa noticias, lesiones ni alineaciones; solo datos historicos y cuotas disponibles.`
  ]

  if (modelPrediction.dataQuality.status !== 'SUFFICIENT') {
    candidates.push(
      `La calidad de datos actual es ${modelPrediction.dataQuality.status}; la explicacion debe leerse con prudencia.`
    )
  }

  return [...new Set(candidates)]
}

function buildDeterministicContent({
  summaryCandidates,
  supportingCandidates,
  counterCandidates,
  warningCandidates
}) {
  return {
    summary: summaryCandidates[0],
    supportingFactors: supportingCandidates.slice(0, 3),
    counterFactors: counterCandidates.slice(0, 3),
    warnings: warningCandidates.slice(0, 3),
    responsibleUseNotice: EXPLANATION_RESPONSIBLE_USE_NOTICE
  }
}

function createStrictEnumSchema(values) {
  return z
    .enum(values)
    .refine(
      (value) =>
        value === EXPLANATION_RESPONSIBLE_USE_NOTICE ||
        PROHIBITED_LANGUAGE_PATTERNS.every((pattern) => !pattern.test(value)),
      'Prohibited language detected'
    )
}

export function buildPredictionExplanationContract({
  prediction,
  modelPrediction
}) {
  const competitionName = sanitizeExplanationAtom(
    prediction.fixture.competition.name
  )
  const homeTeamName = sanitizeExplanationAtom(prediction.fixture.homeTeam.name)
  const awayTeamName = sanitizeExplanationAtom(prediction.fixture.awayTeam.name)
  const selectionLabel = describeSelection(prediction)
  const summaryCandidates = buildSummaryCandidates({
    prediction,
    modelPrediction,
    selectionLabel
  })
  const supportingCandidates = buildSupportingCandidates({
    prediction,
    modelPrediction,
    selectionLabel
  })
  const counterCandidates = buildCounterCandidates({
    prediction,
    modelPrediction
  })
  const warningCandidates = buildWarningCandidates({
    prediction,
    modelPrediction
  })

  return {
    selectionLabel,
    llmInput: {
      fixture: {
        competition: competitionName,
        kickoffAt: prediction.fixture.kickoffAt,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName
      },
      selection: selectionLabel,
      recommendation: prediction.recommendation,
      confidenceScore: prediction.confidenceScore,
      riskLevel: prediction.riskLevel,
      modelProbability: prediction.modelProbability,
      marketProbability: prediction.marketProbability,
      edgePp: prediction.edgePp,
      expectedGoals: modelPrediction.expectedGoals,
      dataQuality: modelPrediction.dataQuality,
      sampleSizes: modelPrediction.inputs,
      summaryCandidates,
      supportingCandidates,
      counterCandidates,
      warningCandidates,
      responsibleUseNotice: EXPLANATION_RESPONSIBLE_USE_NOTICE
    },
    responseSchema: {
      name: 'pronostia_prediction_explanation',
      description:
        'Select only statements that are explicitly present in the provided candidate lists.',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: {
            type: 'string',
            enum: summaryCandidates,
            maxLength: Math.max(
              ...summaryCandidates.map((value) => value.length)
            )
          },
          supportingFactors: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: {
              type: 'string',
              enum: supportingCandidates,
              maxLength: Math.max(
                ...supportingCandidates.map((value) => value.length)
              )
            }
          },
          counterFactors: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: {
              type: 'string',
              enum: counterCandidates,
              maxLength: Math.max(
                ...counterCandidates.map((value) => value.length)
              )
            }
          },
          warnings: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: {
              type: 'string',
              enum: warningCandidates,
              maxLength: Math.max(
                ...warningCandidates.map((value) => value.length)
              )
            }
          },
          responsibleUseNotice: {
            type: 'string',
            enum: [EXPLANATION_RESPONSIBLE_USE_NOTICE],
            maxLength: EXPLANATION_RESPONSIBLE_USE_NOTICE.length
          }
        },
        required: [
          'summary',
          'supportingFactors',
          'counterFactors',
          'warnings',
          'responsibleUseNotice'
        ]
      }
    },
    validationSchema: z
      .object({
        summary: createStrictEnumSchema(summaryCandidates),
        supportingFactors: z
          .array(createStrictEnumSchema(supportingCandidates))
          .min(1)
          .max(3)
          .refine(
            (values) => new Set(values).size === values.length,
            'Duplicate supporting factors are not allowed'
          ),
        counterFactors: z
          .array(createStrictEnumSchema(counterCandidates))
          .min(1)
          .max(3)
          .refine(
            (values) => new Set(values).size === values.length,
            'Duplicate counter factors are not allowed'
          ),
        warnings: z
          .array(createStrictEnumSchema(warningCandidates))
          .min(1)
          .max(3)
          .refine(
            (values) => new Set(values).size === values.length,
            'Duplicate warnings are not allowed'
          ),
        responsibleUseNotice: z.literal(EXPLANATION_RESPONSIBLE_USE_NOTICE)
      })
      .strict(),
    fallbackContent: buildDeterministicContent({
      summaryCandidates,
      supportingCandidates,
      counterCandidates,
      warningCandidates
    })
  }
}

export function validateGeneratedExplanation({ contract, output }) {
  const result = contract.validationSchema.safeParse(output)

  if (!result.success) {
    throw new ValidationError('Invalid structured explanation output', {
      issues: result.error.issues.map((issue) => issue.message)
    })
  }

  return result.data
}

export function createPendingExplanation() {
  return {
    status: EXPLANATION_STATUSES.PENDING,
    source: null,
    generatedAt: null,
    model: null,
    budget: null,
    content: null,
    metadata: null
  }
}

export function buildFinalExplanation({
  status,
  source,
  generatedAt,
  model,
  budget,
  content,
  metadata = null
}) {
  return {
    status,
    source,
    generatedAt,
    model,
    budget,
    content,
    metadata
  }
}

export function buildFallbackExplanation({
  generatedAt,
  model,
  budget,
  content,
  reason
}) {
  return buildFinalExplanation({
    status: EXPLANATION_STATUSES.FALLBACK,
    source: EXPLANATION_SOURCES.DETERMINISTIC_FALLBACK,
    generatedAt,
    model,
    budget,
    content,
    metadata: {
      reason
    }
  })
}
