import { createTickerExperiment } from './ticker.ts';
import { TAPE_SPEED_EXPERIMENT, TAPE_SPEED_MODEL } from '../equipment/tapeSpeed/model.ts';

export function createTapeSpeedExperiment(id: string, timestamp: string) {
  const scene = createTickerExperiment(id, timestamp);
  scene.experimentId = TAPE_SPEED_EXPERIMENT;
  scene.title = '测量纸带的平均速度和瞬时速度';
  scene.simulationConfig.modelVersions['mechanical.tape-speed'] = TAPE_SPEED_MODEL;
  scene.curriculumRef!.standard.topic = '由纸带位移与时间求平均速度，用短区间平均速度近似瞬时速度，正式条目待教师核验';
  return scene;
}
