import { registerReflectionEquipment } from './reflection/definitions.ts';
import { registerDensityEquipment } from './density/definitions.ts';
import { registerProjectileEquipment } from './projectile/definitions.ts';
import { createElectricalRegistry } from './electrical/definitions.ts';
import { registerOpticalEquipment } from './optical/definitions.ts';
import { registerFrictionEquipment } from './mechanical/frictionDefinitions.ts';
import { registerSpringEquipment } from './spring/definitions.ts';
import { registerMechanicalEquipment } from './mechanical/definitions.ts';

export function createWorkbenchRegistry() {
  const registry = createElectricalRegistry();
  registerOpticalEquipment(registry);
  registerReflectionEquipment(registry);
  registerMechanicalEquipment(registry);
  registerFrictionEquipment(registry);
  registerSpringEquipment(registry);
  registerProjectileEquipment(registry);
  registerDensityEquipment(registry);
  return registry;
}
