import { readFileSync } from 'node:fs';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

// Historical exported documents keep import/assembly coverage after their catalogue entries are removed.
const documents = JSON.parse(readFileSync(new URL('./legacy-junior-blanks.json', import.meta.url), 'utf8')) as Record<string, SceneDocument>;
export function legacyJuniorBlank(id: string): SceneDocument {
  if (!documents[id]) throw new RangeError('UNKNOWN_LEGACY_JUNIOR_BLANK');
  return structuredClone(documents[id]);
}
