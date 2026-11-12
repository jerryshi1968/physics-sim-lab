import { z } from 'zod';
import { EquipmentInstanceSchema, FiniteSchema, IdSchema } from '../equipment/schema.ts';
import { ConnectionSchema } from '../connections/schema.ts';
import { dimensionOf, SI_UNITS } from '../units/units.ts';

export const OhmControlSchema = z.strictObject({
  mode: z.enum(['voltage', 'resistance', 'measurement']),
  fixedResistanceOhm: FiniteSchema.positive(),
  targetVoltageV: FiniteSchema.positive(),
  voltageToleranceV: FiniteSchema.nonnegative(),
}).refine(control => control.voltageToleranceV < control.targetVoltageV, { message: 'Voltage tolerance must be smaller than the target' });
export type OhmControl = z.infer<typeof OhmControlSchema>;

export const SCHEMA_VERSION = 2;
const DateTimeSchema = z.iso.datetime({ offset: true });
const OptionalTextSchema = z.string().min(1).max(500).nullable();

export const SimulationConfigSchema = z.strictObject({
  modelVersions: z.record(IdSchema, IdSchema),
  electricalMode: z.enum(['ideal', 'apparatus']),
  gravityMPerS2: FiniteSchema.positive(),
  fixedTimeStepS: FiniteSchema.positive(),
  randomError: z.strictObject({
    enabled: z.boolean(),
    seed: z.number().int().min(0).max(4_294_967_295),
    distribution: z.enum(['none', 'uniform', 'normal']),
    amplitude: FiniteSchema.nonnegative(),
  }).refine(error => !error.enabled || error.distribution !== 'none', { message: 'Missing error distribution' }),
});

export const TextbookMappingSchema = z.strictObject({
  publisher: z.string().min(1).max(200),
  edition: OptionalTextSchema,
  volume: OptionalTextSchema,
  chapter: OptionalTextSchema,
  page: z.number().int().positive().nullable(),
  status: z.enum(['pending_teacher_review', 'verified']),
  reviewedBy: OptionalTextSchema,
  reviewedAt: DateTimeSchema.nullable(),
}).refine(mapping => mapping.status !== 'verified' ||
  [mapping.edition, mapping.volume, mapping.chapter, mapping.reviewedBy, mapping.reviewedAt].every(value => value !== null),
{ message: 'Verified mapping requires review evidence' });

export const CurriculumRefSchema = z.strictObject({
  stage: z.enum(['junior', 'senior']),
  standard: z.strictObject({ title: z.string().min(1).max(200), edition: z.string().min(1).max(100),
    topic: z.string().min(1).max(200), clause: OptionalTextSchema }),
  textbookMappings: z.array(TextbookMappingSchema).max(30),
});

export const MeasurementSnapshotSchema = z.strictObject({
  id: IdSchema, documentId: IdSchema, documentRevision: z.number().int().nonnegative(),
  runId: IdSchema, sequence: z.number().int().positive(), capturedAt: DateTimeSchema,
  setupLabel: z.string().max(100), note: z.string().max(500), modelVersion: IdSchema,
  sourceSnapshotIds: z.array(IdSchema).min(1).max(3).refine(ids => new Set(ids).size === ids.length).optional(),
  captureState: z.strictObject({ kind: z.literal('projectile-launch'), launchRevision: z.number().int().nonnegative(), equipment: z.array(EquipmentInstanceSchema).max(200), connections: z.array(ConnectionSchema).max(500), modelConfigSnapshot: SimulationConfigSchema }).optional(),
  equipment: z.array(EquipmentInstanceSchema).max(200), connections: z.array(ConnectionSchema).max(500),
  modelConfigSnapshot: SimulationConfigSchema,
}).refine(snapshot => !snapshot.captureState || snapshot.modelVersion === 'mechanical.projectile.analytic.v1' && snapshot.captureState.launchRevision <= snapshot.documentRevision && snapshot.equipment.every(item => item.type.startsWith('mechanical.projectile-')) && snapshot.equipment.some(item => item.type === 'mechanical.projectile-ball'), { message: 'Invalid frozen launch snapshot' });

export const MeasurementContextSchema = z.strictObject({
  sampleId: IdSchema, equipmentLabel: z.string().min(1).max(200), pointLabel: z.string().min(1).max(100),
  instrumentStatus: z.enum(['valid', 'disconnected', 'reverse', 'over-range', 'undefined', 'invalid', 'out-of-model']),
  instrumentDisplayValue: FiniteSchema.nullable(), physicalValue: FiniteSchema.nullable(),
  originalRawInput: z.string().max(1000).nullable(),
  diagnosticCodes: z.array(IdSchema).max(50),
});

export const MeasurementRecordSchema = z.strictObject({
  id: IdSchema,
  source: z.enum(['manual', 'instrument']),
  quantity: z.enum(['length', 'mass', 'time', 'current', 'voltage', 'resistance', 'force', 'torque',
    'velocity', 'acceleration', 'angle', 'dimensionless', 'volume', 'density']),
  unit: z.enum(SI_UNITS),
  value: FiniteSchema.nullable(),
  rawInput: z.string().max(1000).nullable(),
  equipmentId: IdSchema,
  range: z.strictObject({ min: FiniteSchema, max: FiniteSchema, resolution: FiniteSchema.positive() })
    .refine(range => range.max > range.min, { message: 'Invalid instrument range' }).nullable(),
  measurementStatus: z.enum(['valid', 'invalid', 'over-range', 'reverse', 'out-of-model', 'non-steady']),
  recordedAt: DateTimeSchema,
  documentRevision: z.number().int().nonnegative(),
  runId: IdSchema,
  sequence: z.number().int().nonnegative(),
  modelConfigSnapshot: SimulationConfigSchema,
  context: MeasurementContextSchema.optional(),
  correctedAt: DateTimeSchema.optional(),
}).superRefine((record, context) => {
  if (dimensionOf(record.unit) !== record.quantity) {
    context.addIssue({ code: 'custom', message: 'Quantity and SI unit mismatch', path: ['unit'] });
  }
  if ((record.measurementStatus === 'valid' || record.measurementStatus === 'non-steady') && record.value === null) {
    context.addIssue({ code: 'custom', message: 'Missing measurement value', path: ['value'] });
  }
  if (!['valid', 'non-steady'].includes(record.measurementStatus) && record.value !== null) {
    context.addIssue({ code: 'custom', message: 'Invalid measurement must not carry a normal value', path: ['value'] });
  }
  if (record.source === 'manual' && record.rawInput === null) {
    context.addIssue({ code: 'custom', message: 'Missing original manual input', path: ['rawInput'] });
  }
  if (record.context) {
    const captured = record.context;
    const expectedStatus = captured.instrumentStatus === 'valid' ? 'valid' : captured.instrumentStatus === 'reverse' ? 'reverse'
      : captured.instrumentStatus === 'over-range' ? 'over-range' : captured.instrumentStatus === 'out-of-model' ? 'out-of-model' : 'invalid';
    if (captured.instrumentStatus === 'valid' && (captured.instrumentDisplayValue === null || captured.physicalValue === null)
      || captured.instrumentStatus !== 'valid' && captured.instrumentDisplayValue !== null
      || record.measurementStatus === 'valid' && captured.instrumentStatus !== 'valid'
      || record.source === 'manual' && captured.originalRawInput === null
      || record.source === 'instrument' && (record.rawInput !== null || captured.originalRawInput !== null || record.measurementStatus !== expectedStatus && !(expectedStatus === 'valid' && record.measurementStatus === 'non-steady') || record.value !== captured.instrumentDisplayValue)) {
      context.addIssue({ code: 'custom', message: 'Inconsistent instrument snapshot', path: ['context'] });
    }
  }
});

export const SceneDocumentSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  documentId: IdSchema,
  revision: z.number().int().nonnegative(),
  title: z.string().min(1).max(200),
  experimentId: IdSchema.nullable(),
  ohmControl: OhmControlSchema.optional(),
  equipment: z.array(EquipmentInstanceSchema).max(200),
  connections: z.array(ConnectionSchema).max(500),
  simulationConfig: SimulationConfigSchema,
  measurementRecords: z.array(MeasurementRecordSchema).max(10_000),
  measurementSnapshots: z.array(MeasurementSnapshotSchema).max(10_000).optional(),
  curriculumRef: CurriculumRefSchema.nullable(),
  provenance: z.strictObject({
    origin: z.enum(['original', 'template', 'imported']),
    sourceDocumentId: IdSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    notes: z.array(z.string().max(1000)).max(30),
  }),
  viewport: z.strictObject({ centerXM: FiniteSchema, centerYM: FiniteSchema, pixelsPerM: FiniteSchema.positive() }).optional(),
});

export type SceneDocument = z.infer<typeof SceneDocumentSchema>;
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export type MeasurementRecord = z.infer<typeof MeasurementRecordSchema>;
export type MeasurementSnapshot = z.infer<typeof MeasurementSnapshotSchema>;
