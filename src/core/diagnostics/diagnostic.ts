import { z } from 'zod';

export const DiagnosticSchema = z.strictObject({
  code: z.string().min(1).max(100),
  severity: z.enum(['info', 'warning', 'error']),
  equipmentIds: z.array(z.string().min(1).max(80)),
  messageKey: z.string().min(1).max(160),
  measurementUsable: z.boolean(),
  path: z.string().max(500).optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export function documentDiagnostic(code: string, path: string, equipmentIds: string[] = []): Diagnostic {
  return { code, severity: 'error', equipmentIds, messageKey: `document.${code}`,
    measurementUsable: false, path };
}
