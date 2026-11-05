import Matter from 'matter-js';
import type { FrictionRig } from '../../../equipment/mechanical/frictionScene.ts';
import type { FrictionMotion } from './model.ts';

export const MATTER_PIXELS_PER_M = 1000;
export function createFrictionAdapter(rig: FrictionRig) {
  const scale = MATTER_PIXELS_PER_M, engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, enableSleeping: false });
  const common = { isStatic: true, friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0 };
  const ground = Matter.Bodies.rectangle(rig.surface.pose.xM * scale, -rig.surface.pose.yM * scale + 20, Number(rig.surface.parameters.lengthM) * scale, 40, common);
  const height = Number(rig.block.parameters.heightM), width = Number(rig.block.parameters.widthM);
  const block = Matter.Bodies.rectangle(rig.initial.xM * scale, -(rig.surface.pose.yM + height / 2) * scale, width * scale, height * scale + .002, common);
  for (const body of [ground, block]) Matter.Body.set(body, { friction: 0, frictionStatic: 0, frictionAir: 0 });
  Matter.Composite.add(engine.world, [ground, block]);
  return {
    engine, block, ground,
    sync(state: FrictionMotion, stepS: number) {
      const yM = rig.surface.pose.yM + height / 2;
      Matter.Body.setPosition(block, { x: state.xM * scale, y: -yM * scale });
      Matter.Body.setVelocity(block, { x: state.velocityMPerS * scale / 60, y: 0 });
      Matter.Body.setAngle(block, 0); Matter.Body.setAngularVelocity(block, 0);
      Matter.Engine.update(engine, stepS * 1000);
      const contacts = Matter.Query.collides(block, [ground]);
      const xM = block.position.x / scale, actualYM = -block.position.y / scale;
      const ok = contacts.length === 1 && Math.abs(xM - state.xM) <= 1e-10 && Math.abs(actualYM - yM) <= 1e-10 && block.force.x === 0 && block.force.y === 0 && block.isStatic;
      return { ok, xM, yM: actualYM, velocityMPerS: Matter.Body.getVelocity(block).x * 60 / scale, contacts: contacts.length };
    },
    dispose() { Matter.Composite.clear(engine.world, false); Matter.Engine.clear(engine); },
  };
}
