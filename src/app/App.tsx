import { upgradeInductionGalvanometer } from '../equipment/induction/galvanometer.ts';
import { inductionViewport, inductionMotionBounds, clampInductionPoint } from '../equipment/induction/motion.ts';
import { INDUCTION_EXPERIMENT, GALVANOMETER } from '../equipment/induction/definitions.ts';
import { useInduction } from './induction/useInduction.ts';
import { InductionPanel, InductionRecords, InductionTable } from './induction/InductionPanel.tsx';
import { buildInductionReading } from '../equipment/induction/measure.ts';
import type { InductionInput } from '../equipment/induction/measure.ts';
import { CONDUCTOR_EXPERIMENT, metalPoint } from '../equipment/electrical/conductor.ts';
import { conductorChange, conductorSample } from '../equipment/conductor/experiment.ts';
import { ConductorPanel, ConductorResults } from './conductor/ConductorPanel.tsx';
import { PARALLEL_CURRENT_EXPERIMENT, configureParallelCurrent, parallelCurrentPoint, parallelCurrentSetup } from '../experiments/parallel-current.ts';
import { ParallelCurrentPanel, ParallelCurrentResults } from './experiments/ParallelCurrentPanel.tsx';
import { SERIES_CURRENT_EXPERIMENT, configureSeriesCurrent, seriesCurrentPoint, seriesCurrentSetup } from '../experiments/series-current.ts';
import { SeriesCurrentPanel, SeriesCurrentResults } from './experiments/SeriesCurrentPanel.tsx';
import { heatPlacementParameters } from '../equipment/heatComparison/simulate.ts';
import { useHeatComparison } from './heatComparison/useHeatComparison.ts';
import { HeatComparisonPanel } from './heatComparison/HeatComparisonPanel.tsx';
import { HeatComparisonRecords, HeatComparisonChart } from './heatComparison/HeatComparisonRecords.tsx';
import { buildHeatComparisonReading } from '../equipment/heatComparison/measure.ts';
import type { HeatComparisonInput } from '../equipment/heatComparison/measure.ts';
import { EFFICIENCY_EXPERIMENT } from '../equipment/pulley/definitions.ts';
import { buildEfficiencyReading } from '../equipment/pulley/efficiency.ts';
import { EfficiencyPanel } from './pulley/EfficiencyPanel.tsx';
import { EfficiencyRecords, EfficiencyTable } from './pulley/EfficiencyRecords.tsx';
import { simulatePulley, pulleyPreviewScene, pulleyPullUpdates, pulleyDrop, pulleyDetached, pulleyAttach } from '../equipment/pulley/simulate.ts';
import { PulleyPanel } from './pulley/PulleyPanel.tsx';
import { PulleyRecords, PulleyTable } from './pulley/PulleyRecords.tsx';
import { buildPulleyReading } from '../equipment/pulley/measure.ts';
import type { PulleyInput } from '../equipment/pulley/measure.ts';
import { useKinetic } from './kinetic/useKinetic.ts';
import { MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { KineticPanel } from './kinetic/KineticPanel.tsx';
import { KineticRecords, KineticTable } from './kinetic/KineticRecords.tsx';
import { kineticRig, kineticDrop } from '../equipment/kinetic/simulate.ts';
import { buildKineticReading } from '../equipment/kinetic/measure.ts';
import type { KineticInput } from '../equipment/kinetic/measure.ts';
import { useTwoForce } from './twoForce/useTwoForce.ts';
import { TwoForcePanel } from './twoForce/TwoForcePanel.tsx';
import { TwoForceRecords, TwoForceTable } from './twoForce/TwoForceRecords.tsx';
import { buildTwoForceReading } from '../equipment/twoForce/measure.ts';
import type { TwoForceInput } from '../equipment/twoForce/measure.ts';
import { twoForceDrop, twoForceDetached, twoForceMessage } from '../equipment/twoForce/simulate.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { SWITCH, WIRE, RHEOSTAT, AMMETER, VOLTMETER } from '../equipment/electrical/definitions.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { simulateOptical } from '../equipment/optical/simulate.ts';
import { OpticalPanel } from './optical/OpticalPanel.tsx';
import { OpticalRecords } from './optical/OpticalRecords.tsx';
import { buildOpticalMeasurements } from '../equipment/optical/measure.ts';
import type { OpticalCapture } from '../equipment/optical/measure.ts';
import { createEmptyScene } from '../core/scene/create.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';
import type { SceneDocument } from '../core/scene/schema.ts';
import type { Connection, Endpoint } from '../core/connections/schema.ts';
import type { Pose2D, Scalar } from '../core/equipment/schema.ts';
import { editMessage, positionWireEnd } from '../core/workbench/edit.ts';
import { createHistory, executeCommand, setHistoryViewport, travelHistory } from '../core/workbench/history.ts';
import type { SceneCommand, SceneHistory } from '../core/workbench/history.ts';
import { MAX_DOCUMENT_BYTES, parseSceneJson, serializeScene } from '../core/scene/transfer.ts';
import { deleteSavedScene, listSavedScenes, readSavedScene, storageErrorMessage, writeSavedScene } from './persistence/localSceneStore.ts';
import type { SavedExperiment } from './persistence/localSceneStore.ts';
import { DocumentPreview } from './workbench/DocumentPreview.tsx';
import { RenameExperiment } from './workbench/RenameExperiment.tsx';
import { SavedExperiments } from './workbench/SavedExperiments.tsx';
import type { PendingDocument } from './workbench/DocumentPreview.tsx';
import { DEFAULT_VIEWPORT, screenToWorld, wireWorldPoints } from '../core/workbench/geometry.ts';
import type { Viewport, WorldPoint } from '../core/workbench/geometry.ts';
import { EquipmentLibrary } from './workbench/EquipmentLibrary.tsx';
import { SceneBoard } from './workbench/SceneBoard.tsx';
import { InspectorEditor } from './workbench/InspectorEditor.tsx';
import type { Selection, WireEndSelection } from './workbench/shared.ts';
import { changeSelection } from './workbench/shared.ts';
import { useElectricalSimulation } from './simulation/useElectricalSimulation.ts';
import { SimulationPanel } from './workbench/SimulationPanel.tsx';
import { MeasurementPanel } from './measurements/MeasurementPanel.tsx';
import type { CaptureInput } from './measurements/MeasurementPanel.tsx';
import { MeasurementChart } from './measurements/MeasurementChart.tsx';
import { buildElectricalMeasurements } from '../equipment/electrical/measure.ts';
import { measurementMessage } from '../core/measurements/records.ts';
import { measurementsCsv } from '../core/measurements/csv.ts';
import { LAMP_CIRCUIT_EXPERIMENT } from '../experiments/lamp-circuits.ts';
import { LampCircuitGuide } from './experiments/LampCircuitGuide.tsx';
import { detachedWeightUpdates } from '../equipment/mechanical/weightChain.ts';
import { mechanicalViewScene, simulateLever, mechanicalDrop } from '../equipment/mechanical/simulate.ts';
import { buildLeverMeasurements } from '../equipment/mechanical/measure.ts';
import type { LeverCapture } from '../equipment/mechanical/measure.ts';
import { LeverPanel, LeverAttachment } from './mechanical/LeverPanel.tsx';
import { LeverRecords } from './mechanical/LeverRecords.tsx';
import type { NutPreview } from './mechanical/BalanceNutControls.tsx';
import { frictionDrop, frictionSample } from '../equipment/mechanical/frictionScene.ts';
import { useFrictionSimulation } from './friction/useFrictionSimulation.ts';
import { FrictionPanel, FrictionAssembly } from './friction/FrictionPanel.tsx';
import { FrictionRecords } from './friction/FrictionRecords.tsx';
import { buildFrictionMeasurements } from '../equipment/mechanical/frictionMeasure.ts';
import type { FrictionCapture } from '../equipment/mechanical/frictionMeasure.ts';
import { BLOCK, SURFACE } from '../equipment/mechanical/frictionDefinitions.ts';
import { FORCE_METER } from '../equipment/mechanical/definitions.ts';
import type { EquipmentInstance } from '../core/equipment/schema.ts';
import { leverPresentationScene } from './mechanical/leverPresentation.ts';

import { useAverageSpeed } from './averageSpeed/useAverageSpeed.ts';
import { AverageSpeedPanel } from './averageSpeed/AverageSpeedPanel.tsx';
import { AverageSpeedRecords } from './averageSpeed/AverageSpeedRecords.tsx';
import { AverageSpeedResults } from './averageSpeed/AverageSpeedResults.tsx';
import { averageSpeedRig, averageSpeedDrop, averageTrackUpdates, trackPoint } from '../equipment/averageSpeed/simulate.ts';
import { CART as SPEED_CART, TRACK as SPEED_TRACK } from '../equipment/cart/definitions.ts';
import { buildAverageSpeedMeasurements } from '../equipment/averageSpeed/measure.ts';
import type { AverageSpeedCapture } from '../equipment/averageSpeed/measure.ts';
import { useMelting } from './melting/useMelting.ts';
import { MeltingPanel } from './melting/MeltingPanel.tsx';
import { MeltingRecords } from './melting/MeltingRecords.tsx';
import { MeltingChart } from './melting/MeltingChart.tsx';
import { meltingRig } from '../equipment/melting/simulate.ts';
import { buildMeltingMeasurements } from '../equipment/melting/measure.ts';
import type { MeltingCapture } from '../equipment/melting/measure.ts';
import { useThermalSimulation } from './thermal/useThermalSimulation.ts';
import { ThermalPanel } from './thermal/ThermalPanel.tsx';
import { ThermalRecords } from './thermal/ThermalRecords.tsx';
import { ThermalChart } from './thermal/ThermalChart.tsx';
import { thermalRig } from '../equipment/thermal/simulate.ts';
import { buildThermalMeasurements } from '../equipment/thermal/measure.ts';
import type { ThermalCapture } from '../equipment/thermal/measure.ts';
import { PENDULUM } from '../equipment/pendulum/definitions.ts';
import { pendulumDrop, pendulumRig } from '../equipment/pendulum/simulate.ts';
import { buildPendulumMeasurements } from '../equipment/pendulum/measure.ts';
import type { PendulumCapture } from '../equipment/pendulum/measure.ts';
import { usePendulumSimulation } from './pendulum/usePendulumSimulation.ts';
import { PendulumPanel } from './pendulum/PendulumPanel.tsx';
import { PendulumRecords } from './pendulum/PendulumRecords.tsx';
import { PendulumChart } from './pendulum/PendulumChart.tsx';
import { springSample, springViewScene, springDrop, detachedSpringUpdates, springMessage } from '../equipment/spring/simulate.ts';
import { buildSpringMeasurements } from '../equipment/spring/measure.ts';
import type { SpringCapture } from '../equipment/spring/measure.ts';
import { SpringPanel, SpringAssembly } from './spring/SpringPanel.tsx';
import { SpringRecords } from './spring/SpringRecords.tsx';
import { SpringChart } from './spring/SpringChart.tsx';

import { projectileDrop, projectileMessage } from '../equipment/projectile/simulate.ts';
import { LAUNCHER as PROJECTILE_LAUNCHER, BALL as PROJECTILE_BALL, GROUND as PROJECTILE_GROUND } from '../equipment/projectile/definitions.ts';
import { buildProjectileMeasurements } from '../equipment/projectile/measure.ts';
import type { ProjectileCapture } from '../equipment/projectile/measure.ts';
import { useProjectileSimulation } from './projectile/useProjectileSimulation.ts';
import { ProjectilePanel } from './projectile/ProjectilePanel.tsx';
import { ProjectileRecords } from './projectile/ProjectileRecords.tsx';
import { ProjectileChart } from './projectile/ProjectileChart.tsx';

import { lightOrbitForScene } from '../equipment/optical/lightOrbit.ts';
import { lightOrbitPose } from '../core/workbench/lightOrbit.ts';
import { simulateRefraction, refractionAim, reverseRefraction } from '../equipment/refraction/simulate.ts';
import { buildRefractionMeasurements, refractionProfiles } from '../equipment/refraction/measure.ts';
import type { RefractionCapture } from '../equipment/refraction/measure.ts';
import { RefractionPanel } from './refraction/RefractionPanel.tsx';
import { RefractionRecords } from './refraction/RefractionRecords.tsx';
import { simulateReflection } from '../equipment/reflection/simulate.ts';
import { PAPER, MIRROR, EMITTER } from '../equipment/reflection/definitions.ts';
import { buildReflectionMeasurements, reflectionProfiles } from '../equipment/reflection/measure.ts';
import type { ReflectionCapture } from '../equipment/reflection/measure.ts';
import { ReflectionPanel } from './reflection/ReflectionPanel.tsx';
import { ReflectionRecords } from './reflection/ReflectionRecords.tsx';
import { EYE } from '../equipment/mirrorImage/definitions.ts';
import { simulateMirrorImage } from '../equipment/mirrorImage/simulate.ts';
import { buildMirrorImageMeasurements, mirrorImageProfiles } from '../equipment/mirrorImage/measure.ts';
import type { MirrorImageCapture } from '../equipment/mirrorImage/measure.ts';
import { MirrorImagePanel } from './mirrorImage/MirrorImagePanel.tsx';
import { MirrorImageRecords } from './mirrorImage/MirrorImageRecords.tsx';
import { FREE_OPTICAL_EXPERIMENT, JUNIOR_ELECTRICAL_EXPERIMENT, equipmentAvailability, equipmentSupport } from '../equipment/support.ts';
import { OVERFLOW, vesselAreaM2, spoutHeightM } from '../equipment/buoyancy/definitions.ts';
import { buoyancyViewScene, simulateBuoyancy, buoyancyTransition, buoyancyDrop, buoyancyChanges, buoyancyDetached, isReceiver, overflowOutlet } from '../equipment/buoyancy/simulate.ts';
import { captureBuoyancy, calculateBuoyancy, buoyancyProfiles } from '../equipment/buoyancy/measure.ts';
import type { BuoyancyPhase, BuoyancyCalculation } from '../equipment/buoyancy/measure.ts';
import { BuoyancyPanel } from './buoyancy/BuoyancyPanel.tsx';
import type { BuoyancyAction } from './buoyancy/BuoyancyPanel.tsx';
import { BuoyancyRecords } from './buoyancy/BuoyancyRecords.tsx';

import { densityMethod, simulateDensity, densityViewScene, densityDrop, densityPour, densityMessage, detachedDensityUpdates } from '../equipment/density/simulate.ts';
import { BALANCE, MASS_SET, SPECIMEN, BEAKER, DENSITY_EXPERIMENT, LIQUID_EXPERIMENT, densityExperimentTitles } from '../equipment/density/definitions.ts';
import { buildDensityReading, buildDensityResult, densityProfiles } from '../equipment/density/measure.ts';
import type { DensityPhase } from '../equipment/density/measure.ts';
import { simulateMassVolume } from '../equipment/massVolume/simulate.ts';
import { massVolumeMessage } from '../equipment/massVolume/simulate.ts';
import { buildMassVolumeReading, buildMassVolumeResult } from '../equipment/massVolume/measure.ts';
import type { MassVolumePhase } from '../equipment/massVolume/measure.ts';
import { MassVolumePanel } from './massVolume/MassVolumePanel.tsx';
import { MassVolumeRecords } from './massVolume/MassVolumeRecords.tsx';
import { MassVolumeChart } from './massVolume/MassVolumeChart.tsx';
import { gravityViewScene, simulateGravity, gravityDrop, gravityDetached, gravityMessage } from '../equipment/gravity/simulate.ts';
import { buildGravityReading } from '../equipment/gravity/measure.ts';
import { GravityPanel } from './gravity/GravityPanel.tsx';
import { GravityRecords } from './gravity/GravityRecords.tsx';
import type { GravityInput } from './gravity/GravityRecords.tsx';
import { GravityChart } from './gravity/GravityChart.tsx';
import { simulateMass, massMessage } from '../equipment/mass/simulate.ts';
import { buildMassReading, buildMassDifference, massProfiles } from '../equipment/mass/measure.ts';
import type { MassPhase } from '../equipment/mass/measure.ts';
import { MassPanel } from './mass/MassPanel.tsx';
import { MassRecords } from './mass/MassRecords.tsx';
import { DensityPanel } from './density/DensityPanel.tsx';
import type { DensityPreview } from './density/DensityPanel.tsx';
import { DensityRecords } from './density/DensityRecords.tsx';
import { cartTypes } from '../equipment/cart/definitions.ts';
import { cartDropPoint, cartMessage } from '../equipment/cart/simulate.ts';
import type { CartMethod } from '../equipment/cart/simulate.ts';
import { buildCartMeasurement, cartProfiles } from '../equipment/cart/measure.ts';
import type { CartCapture } from '../equipment/cart/measure.ts';
import { CartPanel } from './cart/CartPanel.tsx';
import { CartRecords } from './cart/CartRecords.tsx';
import { useCartSimulation } from './cart/useCartSimulation.ts';
import { useTicker } from './ticker/useTicker.ts';
import { TickerPanel } from './ticker/TickerPanel.tsx';
import { TickerRecords } from './ticker/TickerRecords.tsx';
import { buildTickerMeasurement, tickerProfiles } from '../equipment/ticker/measure.ts';
import type { TickerInput } from '../equipment/ticker/measure.ts';

import { ElectricalRecordMode, OhmGuide, OhmRecords } from './ohm/OhmExperiment.tsx';
import { LampPowerGuide, LampPowerRecords, LampPowerChart } from './lampPower/LampPowerExperiment.tsx';
import { buildLampPowerMeasurements, lampPowerMode } from '../equipment/electrical/lamp-power.ts';
import { VoltammetryGuide, VoltammetryRecords, VoltammetryChart } from './voltammetry/VoltammetryExperiment.tsx';
import { buildVoltammetryMeasurements, voltammetryMode } from '../equipment/electrical/voltammetry.ts';
import { OhmChart } from './ohm/OhmChart.tsx';
import { buildOhmMeasurements, ohmRecordMode } from '../equipment/electrical/ohm.ts';
import { RESISTOR as OHM_RESISTOR, SWITCH as OHM_SWITCH } from '../equipment/electrical/definitions.ts';
import { buildEmfMeasurements } from '../equipment/electrical/emf.ts';
import { EmfGuide, EmfRecords } from './emf/EmfExperiment.tsx';
import { EmfChart } from './emf/EmfChart.tsx';

import { createCatalogExperiment, fitCatalogViewport } from '../experiments/catalog.ts';
import type { SchoolStage, CatalogDomain, ExperimentChoice } from '../experiments/catalog.ts';
import { ExperimentCatalog } from './experiments/ExperimentCatalog.tsx';

const registry = createWorkbenchRegistry();
const panels = ['记录表', '图线', '模型说明'] as const;
type Panel = typeof panels[number];

function newDocument(): SceneDocument {
  const scene = createEmptyScene(crypto.randomUUID(), new Date().toISOString());
  const result = validateSceneDocument(scene, registry);
  if (!result.ok) throw new Error('Invalid initial document');
  return result.document;
}

function AtomMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <ellipse cx="20" cy="20" rx="17" ry="6.5" stroke="currentColor" strokeWidth="1.5" transform="rotate(-35 20 20)" />
    <ellipse cx="20" cy="20" rx="17" ry="6.5" stroke="currentColor" strokeWidth="1.5" transform="rotate(35 20 20)" />
    <circle cx="20" cy="20" r="3" fill="currentColor" />
  </svg>;
}

export function App() {
  const [history, setHistory] = useState(() => createHistory(newDocument()));
  const historyRef = useRef(history);
  const scene = history.present;
  const [catalog, setCatalog] = useState<{ stage: SchoolStage; domain: CatalogDomain } | null>(null);
  const activeEquipmentSupport = equipmentSupport(scene);
  const mirrorImageMode = activeEquipmentSupport?.key === 'mirrorImage';
  const refractionMode = activeEquipmentSupport?.key === 'refraction';
  const [refractionTheory, setRefractionTheory] = useState(false), [refractionReflection, setRefractionReflection] = useState(false);
  const reflectionMode = activeEquipmentSupport?.key === 'reflection';
  const opticalMode = scene.experimentId === FREE_OPTICAL_EXPERIMENT || (activeEquipmentSupport?.types.some(type => type.startsWith('optical.')) ?? false);
  const opticalPending = activeEquipmentSupport?.key === 'opticalFree';
  const [mirrorGuides, setMirrorGuides] = useState(true);
  const [mirrorRays, setMirrorRays] = useState(false);
  const [foldPreview, setFoldPreview] = useState<{ value: number; documentId: string; revision: number } | null>(null);
  const [reflectionAuxiliary, setReflectionAuxiliary] = useState(false);
  const activeFoldPreview = foldPreview?.documentId === scene.documentId && foldPreview.revision === scene.revision ? foldPreview : null;
  const ohmMode = ohmRecordMode(scene), resistanceMode = voltammetryMode(scene), powerMode = lampPowerMode(scene);
  const MeasurementGuide = powerMode ? LampPowerGuide : VoltammetryGuide;
  const emfMode = activeEquipmentSupport?.key === 'emf';
  const buoyancyMode = activeEquipmentSupport?.key === 'buoyancy';
  const buoyPreviewRef = useRef<{ documentId: string; revision: number; scene: SceneDocument } | null>(null);
  const [buoyPreview, setBuoyPreview] = useState<SceneDocument | null>(null);
  const pulleyMode = activeEquipmentSupport?.key === 'pulley', efficiencyMode = scene.experimentId === EFFICIENCY_EXPERIMENT;
  const kineticMode = activeEquipmentSupport?.key === 'kinetic';
  const kinetic = useKinetic(scene, kineticMode);
  const twoForceMode = activeEquipmentSupport?.key === 'twoForce';
  const gravityMode = activeEquipmentSupport?.key === 'gravity';
  const massVolumeMode = activeEquipmentSupport?.key === 'massVolume';
  const massMode = activeEquipmentSupport?.key === 'mass';
  const densityMode = massVolumeMode || massMode || activeEquipmentSupport?.key === 'density';
  const simulateWeighing = massVolumeMode ? simulateMassVolume : massMode ? simulateMass : simulateDensity;
  const tickerMode = activeEquipmentSupport?.key === 'ticker';
  const ticker = useTicker(scene, tickerMode);
  const cartMode = activeEquipmentSupport?.key === 'cart';
  const cart = useCartSimulation(scene, registry, cartMode);
  const [cartMethod, setCartMethod] = useState<CartMethod>('gate');
  const meltingMode = activeEquipmentSupport?.key === 'melting';
  const inductionMode = scene.experimentId === INDUCTION_EXPERIMENT;
  const induction = useInduction(scene, inductionMode);
  const conductorMode = scene.experimentId === CONDUCTOR_EXPERIMENT;
  const parallelCurrentMode = scene.experimentId === PARALLEL_CURRENT_EXPERIMENT || scene.experimentId === LAMP_CIRCUIT_EXPERIMENT && parallelCurrentSetup(scene).position !== null;
  const seriesCurrentMode = scene.experimentId === SERIES_CURRENT_EXPERIMENT || scene.experimentId === LAMP_CIRCUIT_EXPERIMENT && seriesCurrentSetup(scene).position !== null;
  const heatComparisonMode = activeEquipmentSupport?.key === 'heatComparison';
  const thermalMode = activeEquipmentSupport?.key === 'boiling';
  const averageSpeedMode = activeEquipmentSupport?.key === 'averageSpeed';
  const averageSpeed = useAverageSpeed(scene, averageSpeedMode);
  const mechanicalMode = !tickerMode && !heatComparisonMode && !thermalMode && !meltingMode && !pulleyMode && !kineticMode && !averageSpeedMode && (activeEquipmentSupport?.types.some(type => type.startsWith('mechanical.')) ?? false);
  const [densityPreview, setDensityPreview] = useState<(DensityPreview & { documentId: string; revision: number }) | null>(null);
  const activeDensityPreview = densityPreview?.documentId === scene.documentId && densityPreview.revision === scene.revision ? densityPreview : null;
  const frictionMode = activeEquipmentSupport?.key === 'friction';
  const pendulumMode = activeEquipmentSupport?.key === 'pendulum';
  const pendulum = usePendulumSimulation(scene, pendulumMode);
  const springMode = activeEquipmentSupport?.key === 'spring';
  const projectileMode = activeEquipmentSupport?.key === 'projectile';
  const projectile = useProjectileSimulation(scene, registry, projectileMode);
  const [projectileMarksVisible, setProjectileMarksVisible] = useState(false);
  const friction = useFrictionSimulation(scene, registry, frictionMode);
  const [mechanicalPreview, setMechanicalPreview] = useState<{ id: string; point: WorldPoint; documentId: string; revision: number } | null>(null);
  const [nutPreview, setNutPreview] = useState<(NutPreview & { documentId: string; revision: number }) | null>(null);
  const [leverAuxiliary, setLeverAuxiliary] = useState(false);
  const activeMechanicalPreview = mechanicalPreview?.documentId === scene.documentId && mechanicalPreview.revision === scene.revision ? mechanicalPreview : null;
  const pulleyWorkingScene = pulleyMode ? pulleyPreviewScene(scene, activeMechanicalPreview) : scene;
  const pulleyOutcome = pulleyMode ? simulatePulley(pulleyWorkingScene, registry, !!activeMechanicalPreview) : null;
  const thermalScene = (thermalMode || meltingMode) && activeMechanicalPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeMechanicalPreview.id ? { ...item, pose: { ...item.pose, ...activeMechanicalPreview.point } } : item) } : scene;
  const heatComparison = useHeatComparison(scene, heatComparisonMode, activeMechanicalPreview);
  const thermal = useThermalSimulation(thermalScene, thermalMode);
  const melting = useMelting(thermalScene, meltingMode);
  const activeNutPreview = nutPreview?.documentId === scene.documentId && nutPreview.revision === scene.revision ? nutPreview : null;
  const nutScene = activeNutPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeNutPreview.id ? { ...item, parameters: { ...item.parameters, [activeNutPreview.side === 'left' ? 'leftNutOffsetM' : 'rightNutOffsetM']: activeNutPreview.offsetM } } : item) } : scene;
  const [twoForceYawPreview, setTwoForceYawPreview] = useState<{ documentId: string; revision: number; degrees: number } | null>(null);
  const activeTwoForceYaw = twoForceYawPreview?.documentId === scene.documentId && twoForceYawPreview.revision === scene.revision ? twoForceYawPreview : null;
  const twoForceWorkingScene = twoForceMode && (activeTwoForceYaw || activeMechanicalPreview) ? { ...scene, equipment: scene.equipment.map(item => item.id === activeMechanicalPreview?.id ? { ...item, pose: { ...item.pose, ...activeMechanicalPreview.point } } : item.type === 'mechanical.cart' && activeTwoForceYaw ? { ...item, pose: { ...item.pose, rotationRad: activeTwoForceYaw.degrees * Math.PI / 180 } } : item) } : scene;
  const twoForce = useTwoForce(twoForceWorkingScene, registry, twoForceMode);
  const gravityScene = gravityMode ? gravityViewScene(scene, activeMechanicalPreview) : scene;
  const gravityOutcome = gravityMode ? simulateGravity(gravityScene, registry, !!activeMechanicalPreview) : null;
  const springScene = springMode ? springViewScene(scene, registry, activeMechanicalPreview) : scene;
  const springOutcome = springMode ? springSample(springScene, registry) : null;
  const mechanicalScene = mechanicalMode && !twoForceMode && !gravityMode && !buoyancyMode && !densityMode && !cartMode && !frictionMode && !springMode && !pendulumMode && !projectileMode ? mechanicalViewScene(nutScene, activeMechanicalPreview) : scene;
  const densityWorkingScene = activeDensityPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeDensityPreview.id ? { ...item, parameters: { ...item.parameters, [activeDensityPreview.key]: activeDensityPreview.value } } : item) } : scene;
  const massVolumeOutcome = massVolumeMode ? simulateMassVolume(densityViewScene(densityWorkingScene, activeMechanicalPreview), registry) : null;
  const massOutcome = massMode ? simulateMass(densityViewScene(densityWorkingScene, activeMechanicalPreview), registry) : null;
  const densityOutcome = densityMode && !massMode && !massVolumeMode ? simulateDensity(densityViewScene(densityWorkingScene, activeMechanicalPreview), registry) : null;
  const densityScene = densityMode ? densityViewScene(densityWorkingScene, activeMechanicalPreview, massVolumeOutcome ?? massOutcome ?? densityOutcome) : scene;
  const buoyWorkingScene = buoyancyMode && buoyPreview?.documentId === scene.documentId && buoyPreview.revision === scene.revision ? buoyPreview : densityWorkingScene;
  const buoyancyOutcome = buoyancyMode ? simulateBuoyancy(buoyWorkingScene, registry) : null;
  const buoyancyScene = buoyancyMode ? buoyancyViewScene(buoyWorkingScene) : scene;
  const leverOutcome = mechanicalMode && !twoForceMode && !gravityMode && !buoyancyMode && !densityMode && !cartMode && !frictionMode && !springMode && !pendulumMode && !projectileMode ? simulateLever(mechanicalScene, registry) : null;
  const [opticalPreview, setOpticalPreview] = useState<{ id: string; point: WorldPoint & { rotationRad?: number }; documentId: string; revision: number } | null>(null);
  const [opticalAuxiliary, setOpticalAuxiliary] = useState(false);
  const activeOpticalPreview = opticalPreview?.documentId === scene.documentId && opticalPreview.revision === scene.revision ? opticalPreview : null;
  const opticalScene = activeOpticalPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeOpticalPreview.id ? { ...item, pose: { ...item.pose, ...activeOpticalPreview.point } } : item) } : scene;
  const reflectionScene = activeFoldPreview ? { ...opticalScene, equipment: opticalScene.equipment.map(item => item.type === PAPER ? { ...item, parameters: { ...item.parameters, foldRad: activeFoldPreview.value } } : item) } : opticalScene;
  const refractionOutcome = refractionMode ? simulateRefraction(opticalScene, registry) : null;
  const reflectionOutcome = reflectionMode ? simulateReflection(reflectionScene, registry) : null;
  const mirrorImageOutcome = mirrorImageMode ? simulateMirrorImage(opticalScene) : null;
  const opticalOutcome = activeEquipmentSupport?.key === 'optical' ? simulateOptical(opticalScene, registry) : null;
  const [rheostatPreview, setRheostatPreview] = useState<{ id: string; position: number; documentId: string; revision: number } | null>(null);
  const activeRheostatPreview = rheostatPreview?.documentId === scene.documentId && rheostatPreview.revision === scene.revision ? rheostatPreview : null;
  const calculationScene = activeRheostatPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeRheostatPreview.id
    ? { ...item, parameters: { ...item.parameters, position: activeRheostatPreview.position } } : item) } : scene;
  const simulation = useElectricalSimulation(calculationScene, activeRheostatPreview ? `${activeRheostatPreview.id}:${activeRheostatPreview.position}` : '', !tickerMode && !inductionMode && !opticalMode && !mechanicalMode && !heatComparisonMode && !thermalMode && !meltingMode && !averageSpeedMode);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDocument | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[] | null>(null);
  const [libraryError, setLibraryError] = useState('');
  const [boardEpoch, setBoardEpoch] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const recordContent = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel>('记录表');
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [recordsMinimized, setRecordsMinimized] = useState(false);
  const [notice, setNoticeState] = useState<{ message: string } | null>(null);
  const setNotice = useCallback((message: string) => setNoticeState(message ? { message } : null), []);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [panMode, setPanMode] = useState(false);
  const mechanicalSelection = mechanicalMode && selection?.kind === 'equipment' ? scene.equipment.find(item => item.id === selection.id) : undefined;
  const [placing, setPlacing] = useState<string | null>(null);
  const [connectionStart, setConnectionStart] = useState<Endpoint | null>(null);
  const [activeWireEnd, setActiveWireEnd] = useState<WireEndSelection | null>(null);
  const [wireColor, setWireColor] = useState('#126c63');

  useEffect(() => { if (recordContent.current) recordContent.current.scrollTop = 0; }, [panel, scene.documentId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNoticeState(current => current === notice ? null : current), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    readSavedScene().then(text => {
      if (cancelled || text === null) return;
      const result = parseSceneJson(text, registry);
      if (!result.ok) { setError(`本地保存未加载：${result.message}`); return; }
      const restored = createHistory(upgradeInductionGalvanometer(result.document, new Date().toISOString()));
      historyRef.current = restored;
      setHistory(restored);
      setSavedSnapshot(JSON.stringify(result.document));
      setNotice('已恢复本地保存的实验；重载后从初态重新运行。');
    }).catch(reason => { if (!cancelled) setError(storageErrorMessage(reason)); })
      .finally(() => { if (!cancelled) setBooting(false); });
    return () => { cancelled = true; };
  }, [setNotice]);

  function applyHistory(value: SceneHistory) {
    const previous = pendulumRig(historyRef.current.present), next = pendulumRig(value.present);
    if (previous.ok && (!next.ok || previous.signature !== next.signature)) pendulum.reset();
    const previousMelting = meltingRig(historyRef.current.present), nextMelting = meltingRig(value.present);
    if (previousMelting.signature !== nextMelting.signature || previousMelting.ok !== nextMelting.ok) melting.reset();
    const previousThermal = thermalRig(historyRef.current.present), nextThermal = thermalRig(value.present);
    if (previousThermal.signature !== nextThermal.signature || previousThermal.ok !== nextThermal.ok) thermal.reset();
    const previousSpeed = averageSpeedRig(historyRef.current.present), nextSpeed = averageSpeedRig(value.present);
    if (previousSpeed.ok && (!nextSpeed.ok || previousSpeed.signature !== nextSpeed.signature)) averageSpeed.reset();
    const previousKinetic = kineticRig(historyRef.current.present), nextKinetic = kineticRig(value.present);
    if (previousKinetic.ok && (!nextKinetic.ok || previousKinetic.signature !== nextKinetic.signature)) kinetic.reset();
    historyRef.current = value;
    setHistory(value);
  }

  function clearEditing() {
    induction.reset();
    cart.reset();
    buoyPreviewRef.current = null; setBuoyPreview(null);
    setDensityPreview(null);
    setNutPreview(null);
    setMechanicalPreview(null);
    setProjectileMarksVisible(false);
    setLeverAuxiliary(false);
    setOpticalPreview(null);
    setOpticalAuxiliary(false);
    setFoldPreview(null);
    setReflectionAuxiliary(false);
    setRefractionTheory(false);
    setRefractionReflection(false);
    setMirrorGuides(true);
    setMirrorRays(false);
    setRheostatPreview(null);
    setSelection(null);
    setPlacing(null);
    setConnectionStart(null);
    setActiveWireEnd(null);
    setPanMode(false);
    setBoardEpoch(value => value + 1);
  }

  function resetDocument() {
    induction.reset();
    buoyPreviewRef.current = null; setBuoyPreview(null);
    setDensityPreview(null);
    projectile.reset();
    pendulum.reset();
    thermal.reset();
    heatComparison.reset();
    melting.reset();
    kinetic.reset();
    averageSpeed.reset();
    twoForce.reset();
    friction.reset();
    cart.reset();
    setNutPreview(null);
    setMechanicalPreview(null);
    setLeverAuxiliary(false);
    setOpticalPreview(null);
    setOpticalAuxiliary(false);
    setFoldPreview(null);
    setReflectionAuxiliary(false);
    setRefractionTheory(false);
    setRefractionReflection(false);
    setMirrorGuides(true);
    setMirrorRays(false);
    simulation.reset();
    setRheostatPreview(null);
    applyHistory(createHistory(newDocument()));
    setSavedSnapshot(null);
    setPanel('记录表');
    setNotice('已建立新的空白实验。');
    setError('');
    setSelection(null);
    setPlacing(null);
    setConnectionStart(null);
    setActiveWireEnd(null);
    setPanMode(false);
    setWireColor('#126c63');
  }

  function commit(command: SceneCommand): boolean {
    const result = executeCommand(historyRef.current, command, registry, new Date().toISOString());
    if (!result.ok) {
      setError(opticalMode && !mirrorImageMode && result.diagnostics[0]?.code === 'INVALID_EQUIPMENT_PARAMETERS' ? '光学属性无效：焦距须为 0.02～0.5 m，长度与孔径等须在模型范围内；原装置保持不变。' : editMessage(result.diagnostics[0]?.code ?? 'SCHEMA_INVALID'));
      setNotice('');
      return false;
    }
    applyHistory(result.history);
    setError('');
    setNotice('已更新装置。');
    return true;
  }

  function travel(direction: 'undo' | 'redo') {
    const current = historyRef.current;
    const entry = current[direction].at(-1);
    if (!entry || booting || pending) return;
    const result = travelHistory(current, direction, registry, new Date().toISOString());
    if (!result.ok) { setError(editMessage(result.diagnostics[0]?.code ?? 'SCHEMA_INVALID')); return; }
    applyHistory(result.history);
    clearEditing();
    setError('');
    setNotice(`已${direction === 'undo' ? '撤销' : '重做'}：${entry.label}。`);
  }

  async function saveDocument() {
    setBusy(true);
    setError('');
    const snapshot = historyRef.current.present;
    try {
      await writeSavedScene(serializeScene(snapshot, registry));
      setSavedSnapshot(JSON.stringify(snapshot));
      setNotice('已保存到本浏览器；刷新后恢复此版本，从初态重新运行。');
    } catch (reason) { setError(storageErrorMessage(reason)); setNotice(''); }
    finally { setBusy(false); }
  }

  async function loadDocument() {
    setBusy(true);
    setError('');
    setLibraryError('');
    try {
      setSavedExperiments(await listSavedScenes());
    } catch (reason) { setError(storageErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function chooseSavedDocument(id: string) {
    setBusy(true);
    setLibraryError('');
    try {
      const text = await readSavedScene(id);
      if (text === null) { setLibraryError('这个实验已不存在，请关闭后重新加载列表。'); return; }
      const result = parseSceneJson(text, registry);
      if (!result.ok) { setLibraryError(result.message); return; }
      if (result.document.documentId !== id) { setLibraryError('本地实验标识不一致，未加载。'); return; }
      setSavedExperiments(null);
      setPending({ ...result, source: 'saved' });
    } catch (reason) { setLibraryError(storageErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function deleteSavedDocument(id: string): Promise<boolean> {
    setBusy(true);
    setLibraryError('');
    try {
      await deleteSavedScene(id);
      setSavedExperiments(current => current?.filter(entry => entry.id !== id) ?? null);
      if (historyRef.current.present.documentId === id) setSavedSnapshot(null);
      setNotice('已删除本地保存；当前工作台保留，再次保存可重新加入列表。');
      return true;
    } catch (reason) { setLibraryError(`删除失败：${storageErrorMessage(reason)}`); return false; }
    finally { setBusy(false); }
  }

  async function importDocument(file: File) {
    setError('');
    setNotice('');
    if (file.size > MAX_DOCUMENT_BYTES) { setError('文件超过 5 MiB，未读取；原实验保持不变。'); return; }
    setBusy(true);
    try {
      const result = parseSceneJson(await file.text(), registry);
      if (!result.ok) { setError(result.message); return; }
      setPending({ ...result, source: 'import' });
    } catch { setError('文件读取失败，原实验保持不变。'); }
    finally { setBusy(false); }
  }

  function confirmReplacement() {
    ticker.reset();
    projectile.reset();
    pendulum.reset();
    thermal.reset();
    heatComparison.reset();
    melting.reset();
    kinetic.reset();
    averageSpeed.reset();
    friction.reset();
    if (!pending) return;
    simulation.reset();
    applyHistory(createHistory(upgradeInductionGalvanometer(pending.document, new Date().toISOString())));
    setSavedSnapshot(pending.source === 'saved' ? JSON.stringify(pending.document) : null);
    clearEditing();
    setCartMethod('gate');
    setPanel('记录表');
    setPanMode(false);
    setWireColor('#126c63');
    setError('');
    setNotice('已加载实验；从初态重新运行，撤销历史已清空。');
    setPending(null);
  }

  function prepareCatalog(choice: ExperimentChoice) {
    const document = createCatalogExperiment(choice.id, crypto.randomUUID(), new Date().toISOString());
    fitCatalogViewport(document, choice, window.innerWidth, window.innerHeight);
    const checked = validateSceneDocument(document, registry);
    if (!checked.ok) { setError('实验起点未通过校验，当前实验保持不变。'); return; }
    setCatalog(null);
    setPending({ document: checked.document, fromVersion: 2, source: choice.family });
  }

  function updateBuoyancy(id: string, values: Record<string, Scalar>) {
    const current = historyRef.current.present, item = current.equipment.find(peer => peer.id === id);
    if (Object.hasOwn(values, 'zeroTrimKg')) {
      const weighing = simulateBuoyancy(current, registry).density.weighing;
      if (!weighing.ok || !weighing.canZero) { setNotice('先清空天平两盘并将游码归零，再调零。'); return; }
    }
    const shown = buoyancyViewScene(current).equipment.find(peer => peer.id === id);
    if (item && shown) applyProperties(id, shown.pose, { ...item.parameters, ...values });
  }

  function previewBuoyancy(value: { id: string; point: WorldPoint } | null) {
    if (!value) { buoyPreviewRef.current = null; setBuoyPreview(null); return; }
    const current = historyRef.current.present;
    const previous = buoyPreviewRef.current;
    const base = previous?.documentId === current.documentId && previous.revision === current.revision ? previous.scene : current;
    const item = base.equipment.find(peer => peer.id === value.id);
    if (!item) return;
    const changed = buoyancyDrop(base, item, value.point);
    if (!changed) return;
    const candidate = buoyancyTransition({ ...base, equipment: base.equipment.map(peer => peer.id === item.id ? { ...peer, ...changed } : peer) });
    buoyPreviewRef.current = { documentId: current.documentId, revision: current.revision, scene: candidate };
    setBuoyPreview(candidate);
  }

  function buoyancyAction(action: BuoyancyAction) {
    const current = historyRef.current.present, outcome = simulateBuoyancy(current, registry), candidate = structuredClone(current);
    const tank = candidate.equipment.find(item => item.type === OVERFLOW), receiver = candidate.equipment.find(isReceiver), cylinder = candidate.equipment.find(item => item.type === 'mechanical.density-cylinder');
    if (action === 'fill' && tank) {
      if (outcome.submergedM3 > 1e-12 || outcome.code === 'BUOY_CONTACT') { setNotice('先把物体提离液面，再补液。'); return; }
      Object.assign(tank.parameters, { liquidM3: vesselAreaM2 * spoutHeightM, initialLiquidM3: vesselAreaM2 * spoutHeightM, spilledM3: 0, lostM3: 0, trialId: crypto.randomUUID() });
    } else if (action === 'clear-receiver' && receiver) receiver.parameters.liquidM3 = 0;
    else if (action === 'clear-cylinder' && cylinder) cylinder.parameters.liquidM3 = 0;
    else if (action === 'receive' && tank && receiver) {
      const point = overflowOutlet(tank);
      receiver.parameters.targetId = ''; receiver.pose.xM = point.xM; receiver.pose.yM = point.yM - .115;
      tank.parameters.receiverId = receiver.id;
    } else if (action === 'fill-beaker') {
      const beaker = candidate.equipment.find(item => item.type === BEAKER && !isReceiver(item));
      if (!beaker || outcome.submergedM3 > 1e-12) { setNotice('先将物体提离液体，再补液。'); return; }
        beaker.parameters.liquidM3 = .0004; beaker.parameters.buoyancyRole = 'vessel';
    } else if (action === 'pour' && receiver && cylinder) {
      const amount = Number(receiver.parameters.liquidM3);
      if (amount <= 0 || Number(cylinder.parameters.liquidM3) !== 0 || amount > Number(cylinder.parameters.capacityM3)) { setNotice('请准备空量筒，并检查排液量是否超出量程。'); return; }
      cylinder.parameters.liquidM3 = amount; cylinder.parameters.liquidDensityKgPerM3 = receiver.parameters.liquidDensityKgPerM3!; receiver.parameters.liquidM3 = 0;
    } else { setNotice('请先放置本次操作所需的器材。'); return; }
    commit({ type: 'update-equipment-batch', updates: buoyancyChanges(current, buoyancyTransition(candidate)) });
  }

  function captureBuoyancyRecord(phase: BuoyancyPhase, raw: string, group: string): string | null {
    if (buoyPreview || activeDensityPreview) return '先松手完成调整，再记录读数。';
    const built = captureBuoyancy(historyRef.current.present, registry, phase, raw, group, `buoyancy-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.message;
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function calculateBuoyancyRecords(kind: BuoyancyCalculation, ids: string[], group: string): string | null {
    const built = calculateBuoyancy(historyRef.current.present, kind, ids, group, `buoyancy-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.message;
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function stepMirrorEye(deltaM: number) {
    const eye = historyRef.current.present.equipment.find(item => item.type === EYE);
    if (eye) applyProperties(eye.id, { ...eye.pose, yM: Number((eye.pose.yM + deltaM).toFixed(4)) }, eye.parameters);
  }

  function captureMirrorImage(input: MirrorImageCapture): string | null {
    if (activeOpticalPreview) return '请先完成器材摆放，再保存读数。';
    const result = buildMirrorImageMeasurements(historyRef.current.present, input, `mirror-image-${crypto.randomUUID()}`, new Date().toISOString());
    if (!result.ok) return result.code === 'INVALID_MANUAL_VALUE' ? '请输入有限数字，未读的量可以留空。' : '请检查装置和组名后再保存。';
    return measurementCommand({ type: 'record-measurements', records: result.records, snapshot: result.snapshot });
  }

  function changeFold(value: number) {
    setFoldPreview(null);
    const item = historyRef.current.present.equipment.find(item => item.type === PAPER);
    if (item) applyProperties(item.id, item.pose, { ...item.parameters, foldRad: value });
  }

  function aimRefraction(degrees: number, fromWater: boolean) {
    const next = refractionAim(historyRef.current.present, degrees * Math.PI / 180, fromWater);
    if (next) applyProperties(next.id, next.pose, next.parameters);
  }

  function alignRefraction(id: string, lower: boolean) {
    const current = historyRef.current.present, outcome = simulateRefraction(current, registry), item = current.equipment.find(i => i.id === id);
    if (outcome.ok && item) applyProperties(id, { ...item.pose, xM: outcome.hit.x, yM: outcome.hit.y, rotationRad: lower ? Math.PI : 0 }, item.parameters);
  }

  function reverseRefractionLight() {
    const next = reverseRefraction(simulateRefraction(historyRef.current.present, registry));
    if (next) applyProperties(next.id, next.pose, next.parameters);
  }

  function captureRefraction(input: RefractionCapture): string | null {
    const built = buildRefractionMeasurements(historyRef.current.present, registry, input, `refraction-${crypto.randomUUID()}`, new Date().toISOString(), !!activeOpticalPreview);
    if (!built.ok) return built.message;
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function alignReflection(type: string) {
    const current = historyRef.current.present, result = simulateReflection(current, registry), item = current.equipment.find(item => item.type === type);
    if (result.ok && item) applyProperties(item.id, { ...item.pose, xM: result.hit.x, yM: result.hit.y, rotationRad: result.mirror.pose.rotationRad }, item.parameters);
  }

  function orbitReflection(degrees: number) {
    const current = historyRef.current.present, mirror = current.equipment.find(item => item.type === MIRROR), emitter = current.equipment.find(item => item.type === EMITTER);
    if (!mirror || !emitter) return;
    const orbit = lightOrbitForScene(current, 'reflection');
    if (orbit) applyProperties(emitter.id, lightOrbitPose(orbit, mirror.pose.rotationRad + degrees * Math.PI / 180), emitter.parameters);
  }

  function captureReflection(input: ReflectionCapture): string | null {
    const built = buildReflectionMeasurements(historyRef.current.present, registry, input, `reflection-${crypto.randomUUID()}`, new Date().toISOString(), !!activeOpticalPreview || !!activeFoldPreview);
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限角度，空白记缺失；范围为 0～90°。' : '请完成摆放与折动，并检查装置、备注和组名后记录。';
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function previewDensity(value: DensityPreview | null) {
    setDensityPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null);
  }

  function updateDensity(id: string, values: Record<string, Scalar>) {
    if (buoyancyMode) { updateBuoyancy(id, values); return; }
    setDensityPreview(null);
    const current = historyRef.current.present, item = current.equipment.find(item => item.id === id);
    if (!item) return;
    if (Object.hasOwn(values, 'zeroTrimKg')) {
      const { weighing } = simulateWeighing(current, registry);
      if (!weighing.ok || weighing.balance.id !== id || !weighing.canZero) return;
    }
    const parameters = { ...item.parameters, ...values, ...(item.type === MASS_SET && values.balanceId === '' ? { mask: 0 } : {}) }, candidate = { ...current, equipment: current.equipment.map(other => other.id === id ? { ...other, parameters } : other) }, result = simulateWeighing(candidate, registry);
    if (!result.weighing.ok && result.weighing.code === 'DENSITY_PAN_OCCUPIED') { setNotice(densityMessage(result.weighing.code)); return; }
    if (!result.ok && result.code === 'DENSITY_ATTACHMENT') { setNotice(densityMessage(result.code)); return; }
    const balance = current.equipment.find(other => other.type === BALANCE);
    const pose = values.targetId === '' && item.parameters.targetId && balance ? { ...item.pose, xM: balance.pose.xM + (item.type === BEAKER ? .3 : -.31), yM: balance.pose.yM } : item.pose;
    commit({ type: 'update-equipment', id, pose, parameters });
  }

  function toggleDensityWeight(id: string, index: number) {
    if (buoyancyMode) {
      const box = scene.equipment.find(item => item.id === id);
      if (box) updateBuoyancy(id, { mask: Number(box.parameters.mask) ^ (1 << index) });
      return;
    }
    const { weighing } = simulateWeighing(historyRef.current.present, registry);
    if (!weighing.ok || weighing.masses?.id !== id) return;
    updateDensity(id, { mask: Number(weighing.masses.parameters.mask) ^ (1 << index) });
  }

  function changeDensityMethod(method: ReturnType<typeof densityMethod>) {
    const current = historyRef.current.present;
    if (densityMethod(current) === method) return;
    const experimentId = method === 'liquid' ? LIQUID_EXPERIMENT : DENSITY_EXPERIMENT;
    const title = Object.values(densityExperimentTitles).includes(current.title) ? densityExperimentTitles[method] : current.title;
    commit({ type: 'set-experiment', experimentId, title });
  }

  function clearDensityBalance() {
    setDensityPreview(null);
    const current = historyRef.current.present, balance = current.equipment.find(item => item.type === BALANCE);
    if (!balance) return;
    const updates = current.equipment.flatMap<Pick<EquipmentInstance, 'id' | 'pose' | 'parameters'>>(item => item.type === BALANCE ? [{ id: item.id, pose: item.pose, parameters: { ...item.parameters, riderKg: 0 } }] : item.type === MASS_SET ? [{ id: item.id, pose: item.pose, parameters: { ...item.parameters, mask: 0 } }] : [SPECIMEN, BEAKER].includes(item.type) && item.parameters.targetId === balance.id ? [{ id: item.id, pose: { ...item.pose, xM: balance.pose.xM + (item.type === BEAKER ? .3 : -.31), yM: balance.pose.yM }, parameters: { ...item.parameters, targetId: '' } }] : []);
    commit({ type: 'update-equipment-batch', updates });
  }

  function pourDensity(amount: number) {
    const result = densityPour(historyRef.current.present, registry, amount);
    if (!result.ok) { setNotice(densityMessage(result.code)); return; }
    commit({ type: 'update-equipment-batch', updates: result.updates });
  }

  const PulleyControls = efficiencyMode ? EfficiencyPanel : PulleyPanel;
  const PulleyMeasurements = efficiencyMode ? EfficiencyRecords : PulleyRecords;

  function capturePulley(input: PulleyInput): string | null {
    const built = (efficiencyMode ? buildEfficiencyReading : buildPulleyReading)(historyRef.current.present, registry, input, crypto.randomUUID(), new Date().toISOString(), !!activeMechanicalPreview);
    if (!built.ok) { setNotice(built.message); return built.message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureKinetic(input: KineticInput): string | null {
    const built = buildKineticReading(historyRef.current.present, kinetic.run, input, crypto.randomUUID(), new Date().toISOString(), !!activeMechanicalPreview);
    if (!built.ok) { setNotice(built.message); return built.message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureTwoForce(input: TwoForceInput): string | null {
    const built = buildTwoForceReading(historyRef.current.present, registry, twoForce.run, input, crypto.randomUUID(), new Date().toISOString(), !!activeMechanicalPreview || !!activeTwoForceYaw, twoForce.running);
    if (!built.ok) { const message = twoForceMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }
  function setTwoForceAngle(degrees: number) {
    const item = scene.equipment.find(peer => peer.type === 'mechanical.cart');
    if (item) { twoForce.reset(); commit({ type: 'update-equipment', id: item.id, pose: { ...item.pose, rotationRad: degrees * Math.PI / 180 }, parameters: item.parameters }); }
  }

  function captureGravity(input: GravityInput): string | null {
    const built = buildGravityReading(historyRef.current.present, registry, input, crypto.randomUUID(), new Date().toISOString(), !!activeMechanicalPreview);
    if (!built.ok) { const message = gravityMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureMassVolume(input: { phase: MassVolumePhase; mass: string; start: string; end: string; group: string; note: string }): string | null {
    const built = buildMassVolumeReading(historyRef.current.present, registry, input, crypto.randomUUID(), new Date().toISOString(), !!activeDensityPreview || !!activeMechanicalPreview);
    if (!built.ok) { const message = massVolumeMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }
  function calculateMassVolume(massId: string, edgeId: string, group: string): string | null {
    if (activeDensityPreview || activeMechanicalPreview) return massVolumeMessage('MV_PREVIEW');
    const built = buildMassVolumeResult(historyRef.current.present, registry, massId, edgeId, group, crypto.randomUUID(), new Date().toISOString());
    if (!built.ok) { const message = massVolumeMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }
  function alignMassVolumeRuler() {
    const current = historyRef.current.present, out = simulateMassVolume(current, registry);
    if (!out.ok || !out.ruler || out.block.parameters.targetId) return;
    applyProperties(out.ruler.id, { ...out.ruler.pose, xM: out.block.pose.xM - out.sample.edgeM / 2 - .01, yM: out.block.pose.yM - .014, rotationRad: 0, flippedX: false }, out.ruler.parameters);
  }

  function captureMass(input: { phase: MassPhase; raw: string; group: string; note: string }): string | null {
    const built = buildMassReading(historyRef.current.present, registry, input, crypto.randomUUID(), new Date().toISOString(), !!activeDensityPreview || !!activeMechanicalPreview);
    if (!built.ok) { const message = massMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }
  function calculateMass(ids: string[], group: string): string | null {
    if (activeDensityPreview || activeMechanicalPreview) return massMessage('MASS_PREVIEW');
    const built = buildMassDifference(historyRef.current.present, registry, ids, group, crypto.randomUUID(), new Date().toISOString());
    if (!built.ok) { const message = massMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureDensity(input: { phase: DensityPhase; raw: string; group: string; note: string }): string | null {
    const built = buildDensityReading(historyRef.current.present, registry, input, crypto.randomUUID(), new Date().toISOString(), !!activeDensityPreview || !!activeMechanicalPreview);
    if (!built.ok) { const message = densityMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function calculateDensity(ids: string[], group: string): string | null {
    const built = buildDensityResult(historyRef.current.present, registry, ids, group, crypto.randomUUID(), new Date().toISOString());
    if (!built.ok) { const message = densityMessage(built.code); setNotice(message); return message; }
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function chooseEquipment(value: string | null) {
    if (value) {
      const available = equipmentAvailability(historyRef.current.present, value);
      if (!available.enabled) { setPlacing(null); setNotice(available.reason); return; }
    }
    setPlacing(value); setConnectionStart(null); setActiveWireEnd(null);
  }

  function expandRecords() {
    setRecordsMinimized(false);
    setRecordsExpanded(true);
  }

  function viewCartTape() {
    setCartMethod('tape');
    setPanel('记录表');
    expandRecords();
    window.requestAnimationFrame(() => {
      const content = recordContent.current;
      if (!content) return;
      content.scrollTop = 0;
      content.focus({ preventScroll: true });
      content.scrollIntoView({ block: 'nearest' });
    });
  }

  function captureTicker(input: TickerInput): string | null {
    if (ticker.powered || activeMechanicalPreview) return '请先结束移动并断电取带。';
    const result = buildTickerMeasurement(historyRef.current.present, ticker.run, ticker.taken, input, crypto.randomUUID(), new Date().toISOString(), ticker.paper);
    return result.ok ? measurementCommand({ type: 'record-measurements', records: result.records, snapshot: result.snapshot }) : result.message;
  }

  function viewTickerTape() {
    setPanel('记录表');
    expandRecords();
    window.requestAnimationFrame(() => { recordContent.current?.scrollTo({ top: 0 }); recordContent.current?.focus({ preventScroll: true }); recordContent.current?.scrollIntoView({ block: 'nearest' }); });
  }

  function captureCart(input: CartCapture): string | null {
    if (cart.running || activeMechanicalPreview) return cartMessage('CART_CAPTURE');
    const result = buildCartMeasurement(historyRef.current.present, cart.run, input, crypto.randomUUID(), new Date().toISOString());
    if (!result.ok) return cartMessage(result.code);
    return measurementCommand({ type: 'record-measurements', records: result.records, snapshot: result.snapshot });
  }

  function captureAverageSpeed(input: AverageSpeedCapture): string | null {
    if (activeMechanicalPreview || averageSpeed.running) return '请先结束移动或等待撞片停表。';
    const result = buildAverageSpeedMeasurements(historyRef.current.present, averageSpeed.run, input, 'speed-sample-' + crypto.randomUUID(), new Date().toISOString());
    return result.ok ? measurementCommand({ type: 'record-measurements', records: result.records, snapshot: result.snapshot }) : result.message;
  }

  function positionSpeedStop(half: boolean) {
    const rig = averageSpeedRig(scene);
    if (!rig.ok) return;
    const low = -Number(rig.track.parameters.lengthM) / 2 + .14;
    applyProperties(rig.stop.id, { ...rig.stop.pose, ...trackPoint(rig.track, half ? (low + rig.frontAlongM) / 2 : low) }, rig.stop.parameters);
  }

  function captureMelting(input: MeltingCapture): string | null {
    if (activeMechanicalPreview) return '请先结束器材拖动。';
    const built = buildMeltingMeasurements(historyRef.current.present, melting.state, melting.rig.signature, melting.seriesId, melting.originS, melting.heating, input, `melting-sample-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.message;
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureInduction(input: InductionInput): string | null {
    const built = buildInductionReading(historyRef.current.present, induction.viewScene, induction.outcome, input, crypto.randomUUID(), new Date().toISOString());
    return built.ok ? measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot }) : built.message;
  }

  function changeConductor(change: Parameters<typeof conductorChange>[1]) {
    const command = conductorChange(historyRef.current.present, change);
    return command ? commit(command) : false;
  }

  function changeParallelCurrent(change: Parameters<typeof configureParallelCurrent>[1]) {
    const command = configureParallelCurrent(historyRef.current.present, change);
    if (command && commit(command)) setNotice('已配置并联电路，开关已断开；已有测量记录保留。');
  }

  function changeSeriesCurrent(change: Parameters<typeof configureSeriesCurrent>[1]) {
    const command = configureSeriesCurrent(historyRef.current.present, change);
    if (command && commit(command)) setNotice('已配置串联电路，开关已断开；已有测量记录保留。');
  }

  function captureHeatComparison(input: HeatComparisonInput): string | null {
    const built = buildHeatComparisonReading(historyRef.current.present, registry, heatComparison.state, heatComparison.signature, heatComparison.seriesId, heatComparison.protocol, heatComparison.riseK, input, `heat-comparison-sample-${crypto.randomUUID()}`, new Date().toISOString(), !!activeMechanicalPreview);
    return built.ok ? measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot }) : built.message;
  }

  function captureThermal(input: ThermalCapture): string | null {
    if (activeMechanicalPreview) return '请先结束器材拖动。';
    const built = buildThermalMeasurements(historyRef.current.present, thermal.state, thermal.rig.signature, thermal.seriesId, thermal.heating, input, `thermal-sample-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.message;
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function capturePendulum(input: PendulumCapture): string | null {
    if (activeMechanicalPreview) return '请先结束器材拖动。';
    const built = buildPendulumMeasurements(historyRef.current.present, pendulum.run, input, `pendulum-sample-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.message;
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureProjectile(input: ProjectileCapture): string | null {
    const built = buildProjectileMeasurements(historyRef.current.present, registry, projectile.flight, input, `projectile-sample-${crypto.randomUUID()}`, new Date().toISOString(), projectile.running || !!activeMechanicalPreview);
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限的计时/尺读数，留空记缺失。' : projectileMessage(built.code);
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function projectileHeight(id: string, height: number) {
    const current = historyRef.current.present, item = current.equipment.find(item => item.id === id), ground = current.equipment.find(item => item.type === PROJECTILE_GROUND);
    if (item && ground && Number.isFinite(height)) applyProperties(item.id, { ...item.pose, yM: ground.pose.yM + height }, item.parameters);
  }

  function levelProjectile(id: string) {
    const item = historyRef.current.present.equipment.find(item => item.id === id);
    if (item) applyProperties(id, { ...item.pose, rotationRad: 0 }, item.parameters);
  }

  function captureSpring(input: SpringCapture): string | null {
    const built = buildSpringMeasurements(historyRef.current.present, registry, input, `spring-sample-${crypto.randomUUID()}`, new Date().toISOString(), !!activeMechanicalPreview);
    if (!built.ok) {
      const message = built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限读数，留空记缺失。' : built.code === 'SPRING_ORIGINAL_LOADED' ? `${springMessage(built.code)}记录当前载荷请将“测量阶段”改为“加载”或“卸载复测”。` : springMessage(built.code);
      setNotice(`未保存弹簧读尺记录：${message}`); return message;
    }
    const message = measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
    setNotice(message ? `未保存弹簧读尺记录：${message}` : `已新增 1 组弹簧读尺记录（${built.records.length} 行）；之前的记录已保留。${input.phase === '原长测量' ? '测量阶段已切换为“加载”。' : ''}`);
    return message;
  }

  function updateFriction(item: EquipmentInstance, parameters: Record<string, Scalar>) {
    const updates = [{ id: item.id, pose: item.pose, parameters }];
    if (item.type === BLOCK && parameters.meterId && parameters.meterId !== item.parameters.meterId) {
      const meter = scene.equipment.find(candidate => candidate.type === FORCE_METER && candidate.id === parameters.meterId);
      if (meter) updates.push({ id: meter.id, pose: meter.pose, parameters: { ...meter.parameters, directionDeg: 0 } });
    }
    commit({ type: 'update-equipment-batch', updates });
  }

  function placeOnFrictionSurface(item: EquipmentInstance) {
    const surface = scene.equipment.find(candidate => candidate.type === SURFACE && candidate.id === item.parameters.surfaceId);
    if (!surface) return;
    const half = Math.max(0, (Number(surface.parameters.lengthM) - Number(item.parameters.widthM)) / 2);
    commit({ type: 'update-equipment', id: item.id, pose: { ...item.pose, xM: Math.max(surface.pose.xM - half, Math.min(surface.pose.xM + half, item.pose.xM)), yM: surface.pose.yM + Number(item.parameters.heightM) / 2, rotationRad: 0 }, parameters: item.parameters });
  }

  function captureFriction(input: FrictionCapture): string | null {
    if (activeMechanicalPreview || !friction.sample?.ok) return '请先完成装配/移动，再记录。';
    const current = historyRef.current.present;
    if (!frictionSample(current, registry, friction.state).ok) return '当前装置或状态不可测量。';
    const built = buildFrictionMeasurements(current, registry, friction.state, friction.runId, input, `friction-sample-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限抄表值，留空记缺失。' : '请先开始或单步牵引，再检查组名与备注。';
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function captureLever(entry: LeverCapture): string | null {
    if (activeMechanicalPreview || activeNutPreview) return '请先松手完成移动，再记录。';
    const built = buildLeverMeasurements(historyRef.current.present, registry, entry, `lever-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限的力与力臂，留空记缺失。' : '请先完成挂接与空载调平，并检查输入和备注。';
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function zeroLever() {
    if (leverOutcome?.ok && leverOutcome.canZero && !activeMechanicalPreview && !activeNutPreview) commit({ type: 'update-equipment', id: leverOutcome.lever.id, pose: { ...scene.equipment.find(item => item.id === leverOutcome.lever.id)!.pose, rotationRad: leverOutcome.lever.pose.rotationRad },
      parameters: { ...leverOutcome.lever.parameters, zeroReference: leverOutcome.zeroReference } });
  }

  function changeNut(value: NutPreview) {
    setNutPreview(null);
    const current = historyRef.current.present, outcome = simulateLever(current, registry), item = current.equipment.find(item => item.id === value.id);
    if (!outcome.ok || !outcome.empty || !item || !Number.isFinite(value.offsetM) || value.offsetM < 0 || value.offsetM > .06) return;
    commit({ type: 'update-equipment', id: item.id, pose: item.pose, parameters: { ...item.parameters, [value.side === 'left' ? 'leftNutOffsetM' : 'rightNutOffsetM']: value.offsetM } });
  }

  function captureOptical(entry: OpticalCapture): string | null {
    if (activeOpticalPreview) return '请先松手完成移动，再记录读尺。';
    const built = buildOpticalMeasurements(historyRef.current.present, registry, entry, `optical-${crypto.randomUUID()}`, new Date().toISOString());
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限十进制读数，留空记缺失。' : '当前装置或读尺不可用，请检查器材、近轴范围和备注长度。';
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function exportDocument() {
    try {
      const snapshot = historyRef.current.present;
      const text = serializeScene(snapshot, registry);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${snapshot.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\p{Cc}/gu, '_')}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
      setNotice('已导出实验初态与记录；重新导入后从初态运行。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '导出失败，原实验保持不变。'); }
  }

  function select(value: Selection, additive = false) {
    setSelection(current => changeSelection(current, value, additive));
    if (connectionStart || activeWireEnd) setNotice('');
    setPlacing(null);
    setConnectionStart(null);
    setActiveWireEnd(null);
  }

  function measurementCommand(command: SceneCommand): string | null {
    const result = executeCommand(historyRef.current, command, registry, new Date().toISOString());
    if (!result.ok) {
      const message = measurementMessage(result.diagnostics[0]?.code ?? 'SCHEMA_INVALID'); setError(message); return message;
    }
    applyHistory(result.history); setError(''); setNotice('已保存测量记录；采样快照不随装置修改而变化。');
    return null;
  }

  function captureMeasurements(entry: CaptureInput): string | null {
    const built = (powerMode ? buildLampPowerMeasurements : resistanceMode ? buildVoltammetryMeasurements : ohmMode ? buildOhmMeasurements : emfMode ? buildEmfMeasurements : buildElectricalMeasurements)(historyRef.current.present, registry, simulation.acceptedReply, {
      ...entry, sampleId: `sample-${crypto.randomUUID()}`, timestamp: new Date().toISOString(),
      choices: entry.choices.map(choice => ({ ...choice, id: `record-${crypto.randomUUID()}` })),
    });
    if (!built.ok) return measurementMessage(built.code);
    const message = measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
    if (!message) {
      expandRecords();
      window.requestAnimationFrame(() => { if (recordContent.current) recordContent.current.scrollTop = 0; });
    }
    return message;
  }

  function exportMeasurements() {
    try {
    const snapshot = historyRef.current.present;
    const url = URL.createObjectURL(new Blob([measurementsCsv(snapshot)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `${snapshot.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\p{Cc}/gu, '_')}-测量记录.csv`;
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('已导出全部测量记录 CSV；无效值留空，原始抄表与追溯信息单独保留。');
    } catch { setError('CSV 导出失败：请减少记录后重试，原始记录保持不变。'); }
  }

  function place(type: string, point: WorldPoint) {
    const available = equipmentAvailability(historyRef.current.present, type);
    if (!available.enabled) { setPlacing(null); setNotice(available.reason); return; }
    if (type === WIRE) {
      const id = `wire-${crypto.randomUUID()}`;
      if (commit({ type: 'add-wire', id, point })) {
        setSelection({ kind: 'connection', id });
        setPlacing(null); setConnectionStart(null); setActiveWireEnd(null);
      }
      return;
    }
    const id = `item-${crypto.randomUUID()}`;
    if (inductionMode && type === 'electrical.metal-wire') {
      const initial = { pose: { ...point, rotationRad: Math.PI / 2, flippedX: false }, parameters: { ...registry.get(type, 1)!.defaultParameters, lengthM: .2, areaM2: 5e-8, inductionShape: 'rod', turns: 10, inductionPerspective: true } };
      if (commit({ type: 'add-equipment', equipmentType: type, id, point, initial })) { setSelection({ kind: 'equipment', id }); setPlacing(null); setConnectionStart(null); }
      return;
    }
    if (heatComparisonMode) {
      const initial = { pose: { ...point, rotationRad: 0 }, parameters: heatPlacementParameters(scene, type, registry.get(type, 1)!.defaultParameters) };
      if (commit({ type: 'add-equipment', equipmentType: type, id, point, initial })) { setSelection({ kind: 'equipment', id }); setPlacing(null); setConnectionStart(null); }
      return;
    }
    if (kineticMode) {
      const definition = registry.get(type, 1)!;
      const initial = { id, type, definitionVersion: 1, pose: { ...point, rotationRad: 0 }, parameters: { ...definition.defaultParameters, ...(type === 'mechanical.projectile-ball' ? { massKg: .05 } : {}) } };
      const changed = kineticDrop(scene, initial, point);
      if (commit({ type: 'add-equipment', equipmentType: type, id, point, initial: changed })) { setSelection({ kind: 'equipment', id }); setPlacing(null); setConnectionStart(null); }
      return;
    }
    if (averageSpeedMode) {
      const definition = registry.get(type, 1)!;
      const initial = { id, type, definitionVersion: 1, pose: { ...point, rotationRad: type === SPEED_TRACK ? 2 * Math.PI / 180 : 0 }, parameters: { ...definition.defaultParameters, ...(type === SPEED_CART ? { hangerMassKg: 0, loadMassKg: 0 } : {}) } };
      const changed = averageSpeedDrop(scene, initial, point);
      if (commit({ type: 'add-equipment', equipmentType: type, id, point, initial: changed })) { setSelection({ kind: 'equipment', id }); setPlacing(null); setConnectionStart(null); }
      return;
    }
    if (commit({ type: 'add-equipment', equipmentType: type, id, point: cartTypes.includes(type) ? cartDropPoint(scene, type, point) : point })) {
      setSelection({ kind: 'equipment', id });
      setPlacing(null);
      setConnectionStart(null);
    }
  }

  function drop(type: string, clientX: number, clientY: number) {
    const element = document.querySelector<SVGSVGElement>('[data-testid="scene-board"]');
    const rect = element?.getBoundingClientRect();
    if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setNotice('请将器材放入实验画布内。');
      return;
    }
    place(type, screenToWorld({ x: clientX - rect.left, y: clientY - rect.top }, scene.viewport ?? DEFAULT_VIEWPORT, rect));
  }

  function applyProperties(id: string, pose: Pose2D, parameters: Record<string, Scalar>) {
    if (pulleyMode) {
      const item = scene.equipment.find(peer => peer.id === id), shown = pulleyOutcome?.view.equipment.find(peer => peer.id === id);
      if (!item || !shown) return false;
      if (item.type === FORCE_METER && Math.hypot(shown.pose.xM - pose.xM, shown.pose.yM - pose.yM) > 1e-9) return commit({ type: 'update-equipment-batch', updates: [...pulleyPullUpdates(scene, pose), { id, pose: item.pose, parameters }] });
      return commit({ type: 'update-equipment', id, pose: item.type === FORCE_METER ? { ...pose, xM: item.pose.xM, yM: item.pose.yM } : pose, parameters });
    }
    if (kineticMode) { if (scene.equipment.find(item => item.id === id)?.type !== MECHANICAL_RULER) kinetic.reset(); return commit({ type: 'update-equipment', id, pose, parameters }); }
    if (twoForceMode) { twoForce.reset(); return commit({ type: 'update-equipment', id, pose, parameters }); }
    if (gravityMode) {
      const item = scene.equipment.find(peer => peer.id === id), shown = gravityViewScene(scene).equipment.find(peer => peer.id === id);
      if (!item || !shown) return false;
      const changed = Math.hypot(shown.pose.xM - pose.xM, shown.pose.yM - pose.yM) > 1e-10 ? gravityDrop(scene, { ...item, parameters }, pose) : { pose: item.pose, parameters };
      if ('notice' in changed && changed.notice) { setNotice(changed.notice); return false; }
      return commit({ type: 'update-equipment', id, pose: changed.pose, parameters: changed.parameters });
    }
    if (averageSpeedMode) {
      const item = scene.equipment.find(peer => peer.id === id);
      return item?.type === SPEED_TRACK ? commit({ type: 'update-equipment-batch', updates: averageTrackUpdates(scene, item, pose, parameters) }) : commit({ type: 'update-equipment', id, pose, parameters });
    }
    const ohmResistor = (ohmMode || resistanceMode) ? scene.equipment.find(item => item.id === id && item.type === OHM_RESISTOR) : undefined;
    if (ohmResistor && parameters.resistanceOhm !== ohmResistor.parameters.resistanceOhm && scene.equipment.some(item => item.type === OHM_SWITCH && item.parameters.closed)) { setError('替换定值电阻前请先断开开关。'); return false; }
    if (buoyancyMode) {
      const current = historyRef.current.present, previous = buoyPreviewRef.current;
      const base = previous?.documentId === current.documentId && previous.revision === current.revision ? previous.scene : current;
      const item = base.equipment.find(peer => peer.id === id), shown = buoyancyViewScene(base).equipment.find(peer => peer.id === id);
      if (!item || !shown) return false;
        const buoyancyParameters = item.type === BEAKER ? { ...parameters, buoyancyRole: parameters.buoyancyRole ?? 'vessel' } : parameters;
        const changed = Math.hypot(shown.pose.xM - pose.xM, shown.pose.yM - pose.yM) > 1e-10 ? buoyancyDrop(base, { ...item, parameters: buoyancyParameters }, pose) : { pose: item.pose, parameters: buoyancyParameters };
      if (!changed) { setNotice('天平左盘已有物体。'); return false; }
      const candidate = buoyancyTransition({ ...base, equipment: base.equipment.map(peer => peer.id === id ? { ...peer, ...changed } : peer) });
      buoyPreviewRef.current = null; setBuoyPreview(null);
      return commit({ type: 'update-equipment-batch', updates: buoyancyChanges(current, candidate) });
    }
    if (cartMode) {
      const item = scene.equipment.find(item => item.id === id);
      if (!item) return false;
      const position = item.pose.xM !== pose.xM || item.pose.yM !== pose.yM ? cartDropPoint(scene, item.type, pose) : pose;
      return commit({ type: 'update-equipment', id, pose: { ...pose, xM: position.xM, yM: position.yM }, parameters });
    }
    if (densityMode) {
      const current = historyRef.current.present, item = current.equipment.find(item => item.id === id), shown = densityScene.equipment.find(item => item.id === id);
      if (!item || !shown) return false;
      const changed = Math.abs(shown.pose.xM - pose.xM) > 1e-12 || Math.abs(shown.pose.yM - pose.yM) > 1e-12 ? densityDrop(current, { ...item, parameters }, pose) : { pose: item.pose, parameters };
      if ('notice' in changed && changed.notice) { setNotice(changed.notice); return false; }
      return commit({ type: 'update-equipment', id, ...changed });
    }
    if (pendulumMode) {
      const item = scene.equipment.find(item => item.id === id);
      const candidate = { ...scene, equipment: scene.equipment.map(peer => peer.id === id ? { ...peer, pose, parameters } : peer) };
      const changed = item?.type === PENDULUM && (item.pose.xM !== pose.xM || item.pose.yM !== pose.yM) ? pendulumDrop(candidate, id, pose) : null;
      return commit({ type: 'update-equipment', id, ...(changed ?? { pose, parameters }) });
    }
    if (projectileMode) {
      const item = scene.equipment.find(item => item.id === id);
      if (item?.type === PROJECTILE_BALL && (item.pose.xM !== pose.xM || item.pose.yM !== pose.yM)) { const changed = projectileDrop(scene, { ...item, pose, parameters }, pose); return commit({ type: 'update-equipment', id, ...changed }); }
      return commit({ type: 'update-equipment', id, pose, parameters });
    }
    const springInstance = springMode ? springScene.equipment.find(item => item.id === id) : undefined;
    if (springInstance && (Math.abs(springInstance.pose.xM - pose.xM) > 1e-12 || Math.abs(springInstance.pose.yM - pose.yM) > 1e-12)) {
      const changed = springDrop(scene, { ...springInstance, pose, parameters }, pose, springScene, registry);
      if (changed.notice) { setNotice(changed.notice); return false; }
      return commit({ type: 'update-equipment', id, pose: changed.pose, parameters: changed.parameters });
    }
    const instance = mechanicalMode && !frictionMode && !springMode && !pendulumMode && !projectileMode ? mechanicalScene.equipment.find(item => item.id === id) : undefined;
    if (instance && (Math.abs(instance.pose.xM - pose.xM) > 1e-12 || Math.abs(instance.pose.yM - pose.yM) > 1e-12)) {
      const changed = mechanicalDrop(scene, { ...instance, pose, parameters }, pose, leverPresentationScene(scene, leverOutcome, activeMechanicalPreview));
      if (changed.notice) { setNotice(changed.notice); return false; }
      return commit({ type: 'update-equipment', id, ...changed });
    }
    return commit({ type: 'update-equipment', id, pose, parameters });
  }

  function flipEquipment(id: string) {
    const instance = historyRef.current.present.equipment.find(item => item.id === id);
    if (instance) applyProperties(id, { ...instance.pose, flippedX: !instance.pose.flippedX }, instance.parameters);
  }

  function toggleSwitch(id: string) {
    const instance = historyRef.current.present.equipment.find(item => item.id === id);
    if (instance?.type === SWITCH) {
      applyProperties(id, instance.pose, { ...instance.parameters, closed: !instance.parameters.closed });
      setSelection({ kind: 'equipment', id });
    }
  }

  function changeRheostat(id: string, position: number) {
    const instance = historyRef.current.present.equipment.find(item => item.id === id);
    if (instance?.type === RHEOSTAT) applyProperties(id, instance.pose, { ...instance.parameters, position });
  }

  function previewRheostat(value: { id: string; position: number } | null) {
    setRheostatPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null);
  }

  function move(id: string, point: WorldPoint) {
    if (inductionMode) { const bounds = inductionMotionBounds(historyRef.current.present, id, induction.viewScene); if (bounds) point = clampInductionPoint(point, bounds); }
    if (pulleyMode) { const item = scene.equipment.find(peer => peer.id === id); if (item) { const result = pulleyDrop(scene, item, point); if (result.ok) commit({ type: 'update-equipment-batch', updates: result.updates }); else setNotice(result.message); } return; }
    if (kineticMode) { const item = scene.equipment.find(peer => peer.id === id); if (item) { const changed = kineticDrop(scene, item, point); applyProperties(id, changed.pose, changed.parameters); } return; }
    if (averageSpeedMode) {
      const item = scene.equipment.find(peer => peer.id === id);
      if (item) { const changed = averageSpeedDrop(scene, item, point); applyProperties(id, changed.pose, changed.parameters); }
      return;
    }
    if (buoyancyMode) {
      const current = historyRef.current.present, previous = buoyPreviewRef.current;
      const base = previous?.documentId === current.documentId && previous.revision === current.revision ? previous.scene : current;
      const item = base.equipment.find(peer => peer.id === id);
      if (!item) return;
      const changed = buoyancyDrop(base, item, point);
      if (!changed) { setNotice('天平左盘已有物体。'); return; }
      const candidate = buoyancyTransition({ ...base, equipment: base.equipment.map(peer => peer.id === id ? { ...peer, ...changed } : peer) });
      buoyPreviewRef.current = null; setBuoyPreview(null);
      commit({ type: 'update-equipment-batch', updates: buoyancyChanges(current, candidate) });
      return;
    }
    const instance = scene.equipment.find(item => item.id === id);
    if (instance && twoForceMode) { twoForce.reset(); const changed = twoForceDrop(scene, instance, point, twoForce.viewScene); commit({ type: 'update-equipment', id, ...changed }); }
    else if (instance && gravityMode) { const changed = gravityDrop(scene, instance, point); if (changed.notice) { setNotice(changed.notice); return; } commit({ type: 'update-equipment', id, ...changed }); }
    else if (instance && densityMode) { const changed = densityDrop(scene, instance, point); if (changed.notice) { setNotice(changed.notice); return; } commit({ type: 'update-equipment', id, ...changed }); }
    else if (instance && cartMode) { applyProperties(id, { ...instance.pose, ...point }, instance.parameters); }
    else if (instance && pendulumMode) { const changed = pendulumDrop(scene, id, point); commit({ type: 'update-equipment', id, ...(changed ?? { pose: { ...instance.pose, ...point }, parameters: instance.parameters }) }); }
    else if (instance && projectileMode) { commit({ type: 'update-equipment', id, ...projectileDrop(scene, instance, point) }); }
    else if (instance && springMode) {
      const changed = springDrop(scene, instance, point, springScene, registry);
      if (changed.notice) { setNotice(changed.notice); return; }
      commit({ type: 'update-equipment', id, pose: changed.pose, parameters: changed.parameters });
    }
    else if (instance && frictionMode) { friction.pause(); commit({ type: 'update-equipment', id, ...frictionDrop(scene, instance, point) }); }
    else if (instance && mechanicalMode) {
      const changed = mechanicalDrop(scene, instance, point, leverPresentationScene(scene, leverOutcome, activeMechanicalPreview));
      if (changed.notice) { setNotice(changed.notice); return; }
      commit({ type: 'update-equipment', id, ...changed });
    }
    else if (instance) applyProperties(id, { ...instance.pose, ...point }, instance.parameters);
  }

  function connect(endpoint: Endpoint) {
    setPlacing(null);
    if (activeWireEnd) {
      const wire = scene.connections.find(item => item.id === activeWireEnd.wireId);
      if (wire && commit({ type: 'reshape-wire', wire: positionWireEnd(wire, activeWireEnd.side, endpoint, { xM: 0, yM: 0 }) })) {
        setActiveWireEnd(null);
        setSelection({ kind: 'connection', id: wire.id });
      }
      return;
    }
    if (!connectionStart) {
      setConnectionStart(endpoint);
      setError('');
      setNotice('已选起点，请点击另一个接线柱；按 Escape 可取消。');
      return;
    }
    const id = `wire-${crypto.randomUUID()}`;
    if (commit({ type: 'connect', id, from: connectionStart, to: endpoint })) {
      setConnectionStart(null);
      setSelection({ kind: 'connection', id });
    }
  }

  function removeSelected() {
    if (!selection) return;
    const ids = selection.kind === 'equipment-group' ? selection.ids : selection.kind === 'equipment' ? [selection.id] : [];
    const command: SceneCommand = pulleyMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: pulleyDetached(scene, ids) } : twoForceMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: twoForceDetached(scene, ids, twoForce.viewScene) } : gravityMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: gravityDetached(scene, ids) } : buoyancyMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: buoyancyDetached(scene, ids) } : densityMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: detachedDensityUpdates(scene, ids, densityScene) } : springMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: detachedSpringUpdates(scene, ids, springScene) } : mechanicalMode && !cartMode && !pendulumMode && !projectileMode && !frictionMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: detachedWeightUpdates(scene, ids, leverPresentationScene(scene, leverOutcome)) } : selection.kind === 'equipment-group' ? { type: 'remove-equipment-batch', ids: selection.ids }
      : { type: selection.kind === 'equipment' ? 'remove-equipment' : 'remove-wire', id: selection.id };
    if (commit(command)) {
      clearEditing();
      window.requestAnimationFrame(() => document.querySelector<SVGSVGElement>('[data-testid="scene-board"]')?.focus());
    }
  }

  function route(id: string, points: { x: number; y: number }[]) {
    commit({ type: 'route', id, points });
  }

  function reshapeWire(wire: Connection) {
    if (commit({ type: 'reshape-wire', wire })) setActiveWireEnd(null);
  }

  function chooseWireEnd(value: WireEndSelection) {
    setActiveWireEnd(value); setConnectionStart(null); setPlacing(null);
    setSelection({ kind: 'connection', id: value.wireId });
    setNotice(`已选择线头 ${value.side === 'from' ? 'A' : 'B'}，请拖到或点击目标接线柱。`);
  }

  function detachWireEnd(side: 'from' | 'to') {
    const wire = selection?.kind === 'connection' ? scene.connections.find(item => item.id === selection.id) : undefined;
    if (!wire) return;
    const points = wireWorldPoints(wire, scene.equipment, registry);
    reshapeWire(positionWireEnd(wire, side, null, side === 'from' ? points[0]! : points[points.length - 1]!));
  }

  function changeRoute(add: boolean) {
    const wire = selection?.kind === 'connection' ? scene.connections.find(item => item.id === selection.id) : undefined;
    if (!wire) return;
    const ends = wireWorldPoints(wire, scene.equipment, registry);
    const first = ends[0]!;
    const last = ends[ends.length - 1]!;
    const points = wire.routeWorldM ?? [];
    route(wire.id, add ? [...points, { x: (first.xM + last.xM) / 2, y: (first.yM + last.yM) / 2 + 0.06 * (points.length + 1) }] : []);
  }

  function deleteRoutePoint(index: number) {
    const wire = selection?.kind === 'connection' ? scene.connections.find(item => item.id === selection.id) : undefined;
    if (wire) route(wire.id, (wire.routeWorldM ?? []).filter((_, pointIndex) => pointIndex !== index));
  }

  function viewport(value: Viewport) {
    applyHistory(setHistoryViewport(historyRef.current, value));
  }

  function cancelInteraction() {
    if (inductionMode) induction.reset();
    setSelection(null);
    setPanMode(false);
    setDensityPreview(null);
    setNutPreview(null);
    setMechanicalPreview(null);
    setOpticalPreview(null);
    setRheostatPreview(null);
    setPlacing(null);
    setConnectionStart(null);
    setActiveWireEnd(null);
    setNotice('已取消当前操作。');
  }

  function movePanel(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % panels.length;
    else if (event.key === 'ArrowLeft') next = (index + panels.length - 1) % panels.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = panels.length - 1;
    else return;
    event.preventDefault();
    setPanel(panels[next]!);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return <div className="lab-app" aria-busy={booting || busy} onKeyDownCapture={event => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') || pending || renaming || catalog !== null || savedExperiments || booting) return;
    if (event.key === 'Delete' && !target.closest('.route-handle') && !event.ctrlKey && !event.metaKey && !event.altKey && selection && !busy) {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) removeSelected();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      travel(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
    }
  }} onKeyDown={event => { if (event.key === 'Escape') cancelInteraction(); }}>
    <a className="skip-link" href="#workbench">跳至实验工作台</a>
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><AtomMark /></span>
        <div><span className="brand-name">中学物理仿真实验室</span><span className="brand-caption">观察 · 测量 · 探索</span></div>
      </div>
      <span className="workspace-label">实验工作台</span>
    </header>

    <div className="document-bar">
      <div className="document-heading"><span className="document-symbol" aria-hidden="true">◇</span>
        <div><div className="document-title"><h1>{scene.title}</h1><button className="rename-button" aria-label="修改实验名称" disabled={booting || busy} onClick={() => setRenaming(true)}>修改名称</button></div><p>{tickerMode ? '打点计时器 · 高中测量' : inductionMode ? '磁生电 · 初中电学' : conductorMode ? '导体电阻因素 · 初中电学' : parallelCurrentMode ? '并联电流关系 · 初中电学' : seriesCurrentMode ? '串联电流关系 · 初中电学' : heatComparisonMode ? '吸热比较 · 初中热学' : pulleyMode ? efficiencyMode ? '滑轮组机械效率 · 初中力学' : '滑轮 · 初中力学' : kineticMode ? '动能影响因素 · 初中力学' : twoForceMode ? '二力平衡 · 初中力学' : gravityMode ? '重力与质量 · 初中力学' : averageSpeedMode ? '平均速度 · 初中力学' : meltingMode ? '固体熔化 · 初中热学' : thermalMode ? '水沸腾 · 初中热学' : powerMode ? '小灯泡功率 · 初中电学' : resistanceMode ? '伏安法 · 初中电学' : ohmMode ? '控制变量 · 初中电学' : pendulumMode ? '单摆 · 高中定量探究' : emfMode ? '电动势与内阻 · 高中测量' : buoyancyMode ? '浮力 · 初中探究' : cartMode ? '小车 · 高中控制变量' : massVolumeMode ? '质量与体积 · 初中力学' : massMode ? '天平称量 · 初中力学' : densityMode ? '密度 · 初中测量' : mirrorImageMode ? '平面镜成像 · 初中光学' : refractionMode ? '光折射 · 初中光学' : reflectionMode ? '光的反射 · 共面探究' : projectileMode ? '平抛 · 高中定量探究' : springMode ? '弹簧 · 高中定量探究' : frictionMode ? '滑动摩擦 · 控制变量' : mechanicalMode ? '杠杆 · 自主探究' : opticalPending ? '光学 · 自由搭建' : opticalMode ? '凸透镜 · 自主探究' : scene.experimentId === LAMP_CIRCUIT_EXPERIMENT ? '灯泡串并联 · 自主探究' : '自由搭建'}<span className="separator">/</span><span data-testid="save-state">{booting ? '正在读取本地保存…' : savedSnapshot === JSON.stringify(scene) ? '已保存' : savedSnapshot === null ? '尚未保存' : '有未保存更改'}</span></p></div>
      </div>
      <div className="document-actions">
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setCatalog({ stage: 'junior', domain: 'mechanical' })}>初中物理实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setCatalog({ stage: 'senior', domain: 'mechanical' })}>高中物理实验</button>
        <button disabled={booting || busy} onClick={() => void saveDocument()}>保存</button>
        <button disabled={booting || busy} onClick={() => void loadDocument()}>加载</button>
        <button disabled={booting || busy} onClick={() => fileInput.current?.click()}>导入</button>
        <button disabled={booting || busy} onClick={exportDocument}>导出</button>
        <input ref={fileInput} type="file" accept=".json,application/json" aria-label="导入实验 JSON" hidden onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importDocument(file);
        }} />
        <button className="primary-button" disabled={booting || busy} onClick={resetDocument}><span aria-hidden="true">＋</span> 新建实验</button>
      </div>
    </div>

    <main className="workspace" inert={booting}>
      <EquipmentLibrary key={scene.documentId} registry={registry} scene={scene} domain={heatComparisonMode || thermalMode || meltingMode ? 'thermal' : tickerMode || mechanicalMode || pulleyMode || kineticMode || averageSpeedMode ? 'mechanical' : opticalMode ? 'optical' : 'electrical'} mirrorImage={mirrorImageMode} buoyancy={buoyancyMode} locked={!!scene.experimentId || !!scene.equipment.length || !!scene.connections.length}
        onNewDomain={domain => setCatalog({ stage: scene.curriculumRef?.stage === 'senior' && domain !== 'optical' && domain !== 'thermal' ? 'senior' : 'junior', domain })} placing={placing} onChoose={chooseEquipment} onDrop={drop}
        onCenter={() => { if (placing) { const view = scene.viewport ?? DEFAULT_VIEWPORT; place(placing, { xM: view.centerXM, yM: view.centerYM }); } }} />

      <SceneBoard ticker={tickerMode ? ticker : undefined} onInductionReset={inductionMode ? (width, height) => viewport(inductionViewport(scene, width, height)) : undefined} onInductionDrag={inductionMode ? induction.onDrag : undefined} heatComparison={heatComparisonMode ? heatComparison : undefined} pulleyOutcome={pulleyOutcome} kinetic={kineticMode ? kinetic : undefined} twoForce={twoForceMode ? twoForce : undefined} twoForceYaw={activeTwoForceYaw?.degrees} onTwoForceYaw={setTwoForceAngle} onTwoForceYawPreview={degrees => setTwoForceYawPreview(degrees === null ? null : { documentId: scene.documentId, revision: scene.revision, degrees })} gravityOutcome={gravityOutcome} massVolumeMode={massVolumeMode} massMode={massMode || massVolumeMode} melting={meltingMode ? melting : undefined} averageSpeed={averageSpeedMode ? averageSpeed : undefined} thermal={thermalMode ? thermal : undefined} key={`${scene.documentId}:${boardEpoch}`} scene={inductionMode ? induction.viewScene : pulleyOutcome ? pulleyOutcome.view : kineticMode ? kinetic.viewScene : twoForceMode ? twoForce.viewScene : gravityMode ? gravityScene : averageSpeedMode ? averageSpeed.viewScene : pendulumMode ? pendulum.viewScene : buoyancyMode ? buoyancyScene : cartMode ? cart.viewScene : densityMode ? densityScene : reflectionMode ? reflectionScene : projectileMode ? projectile.viewScene : springMode ? springScene : frictionMode ? friction.viewScene : nutScene} pendulumAngle={pendulumMode ? pendulum.angleRad : undefined} pendulumTimeS={pendulumMode ? pendulum.displayS : undefined} onPendulumAngle={pendulumMode && !pendulum.run ? (id, degrees) => { const item = scene.equipment.find(item => item.id === id); if (item) applyProperties(id, item.pose, { ...item.parameters, initialAngleDeg: degrees }); } : undefined} projectileMode={projectileMode} projectileFlight={projectile.flight} projectileMarks={projectileMarksVisible} springOutcome={springOutcome} frictionSample={friction.sample} registry={registry} selection={selection} placing={placing} start={connectionStart} wireColor={wireColor} activeWireEnd={activeWireEnd}
        cartMode={cartMode} cartRun={cart.run} cartRig={cart.rig?.ok ? cart.rig : null}
        mirrorImageOutcome={mirrorImageOutcome} mirrorGuides={mirrorGuides} mirrorRays={mirrorRays}
        buoyancyOutcome={buoyancyOutcome} densityOutcome={buoyancyOutcome?.density ?? massVolumeOutcome ?? massOutcome ?? densityOutcome} onDensityPreview={previewDensity} onDensityAdjust={(id, key, value) => updateDensity(id, { [key]: value })} onDensityWeight={toggleDensityWeight} refractionOutcome={refractionOutcome} refractionReflection={refractionReflection} reflectionOutcome={reflectionOutcome} opticalOutcome={opticalOutcome} opticalAuxiliary={opticalAuxiliary} onOpticalPreview={value => setOpticalPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null)}
        leverOutcome={leverOutcome} leverAuxiliary={leverAuxiliary} onMechanicalPreview={value => { if (buoyancyMode) { previewBuoyancy(value); return; } if (frictionMode && value) friction.pause(); setMechanicalPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null); }}
        outcome={inductionMode ? induction.outcome : simulation.current} calculationStatus={tickerMode ? '手拉纸带 · 先通电后拉带 · 断电读尺' : inductionMode ? '磁生电 · 灵敏电流计 · 自行观察偏转' : heatComparisonMode ? '等功率加热 · 温度与加热时间比较' : pulleyMode ? '轻绳约束 · 缓慢提拉 · 静止读表' : kineticMode ? '滚动 · 碰撞 · 木块位移比较' : twoForceMode ? '二力平衡 · 水平面内平动与转动 · 自行观察' : gravityMode ? '重力探究 · 逐次加挂钩码 · 自行读数' : averageSpeedMode ? '平均速度 · 同一起点两次释放 · 沿斜面读尺' : meltingMode ? '水浴 · 固体熔化与温度—时间记录' : thermalMode ? '热学 · 加热、汽化与温度—时间记录' : pendulumMode ? '单摆 · 非线性周期 · 多周期计时' : buoyancyMode ? '浮力 · 静态称重与排液测量' : cartMode ? '水平轨道 · 光电门与纸带采样' : massVolumeMode ? '同种物质 · 独立称量与读尺 · m–V 图' : massMode ? '天平测质量 · 左物右码 · 砝码加游码' : densityMode ? '密度测量 · 自行称量、平视读液面' : mirrorImageMode ? '薄玻璃板 · 对照找像与光屏验证' : refractionMode ? '空气—水 · 自行量角与光路可逆' : reflectionMode ? '空间反射 · 自行量角与折板对照' : projectileMode ? '解析平抛 · 同一时间源 · 落地事件截断' : springMode ? '竖直静态弹簧 · 自行读尺与拟合' : frictionMode ? '水平一维摩擦 · 运行时刻不保存' : mechanicalMode ? '杠杆静力矩 · 先空载调平再挂载' : opticalPending ? '光学自由搭建 · 放置器材确定实验' : opticalMode ? '近轴光学 · 自行调高与找焦' : simulation.status} onToggleSwitch={toggleSwitch} onRheostatChange={changeRheostat} onRheostatPreview={previewRheostat}
        undoLabel={history.undo.at(-1)?.label ?? null} redoLabel={history.redo.at(-1)?.label ?? null} onUndo={() => travel('undo')} onRedo={() => travel('redo')}
        onSelect={select} onPort={connect} onPlace={place} onMove={move} onOpticalPose={(id, pose) => { const item = historyRef.current.present.equipment.find(i => i.id === id); if (item) applyProperties(id, pose, item.parameters); }} onRoute={route} onWireChange={reshapeWire} onWireEnd={chooseWireEnd} onViewport={viewport} panMode={panMode} onPanMode={setPanMode} onCancel={cancelInteraction} onNotice={setNotice} />

      <aside className="panel inspector" aria-labelledby="inspector-title">
        <div className="panel-heading"><h2 id="inspector-title">属性与诊断</h2></div>
        {opticalPending && <section className="property-editor"><h3>光学自由搭建</h3><p>{activeEquipmentSupport?.types.length ? '共用器材可先摆放，专用器材确定实验类型；不兼容器材禁用。' : '当前包含互斥器材，请移除不兼容器材后继续。'}</p></section>}
        {scene.experimentId === JUNIOR_ELECTRICAL_EXPERIMENT && <ElectricalRecordMode scene={scene} onControl={control => commit({ type: 'set-ohm-control', control })} />}
        {(resistanceMode || powerMode) && <MeasurementGuide scene={scene} reply={simulation.acceptedReply} onRange={(id, range) => {
          if (scene.equipment.some(item => item.type === SWITCH && item.parameters.closed)) return;
          const leads = scene.connections.filter(wire => [wire.from, wire.to].some(end => end?.equipmentId === id && ['low', 'high'].includes(end.portId)));
          if (leads.length !== 1) return;
          const wire = leads[0]!, move = (end: Connection['from']) => end?.equipmentId === id && ['low', 'high'].includes(end.portId) ? { ...end, portId: range } : end;
          reshapeWire({ ...wire, from: move(wire.from), to: move(wire.to) }); setConnectionStart(null);
        }} onIdealize={() => commit({ type: 'update-equipment-batch', updates: scene.equipment.filter(item => [AMMETER, VOLTMETER].includes(item.type)).map(item => ({ id: item.id, pose: item.pose, parameters: { ...item.parameters, ...(item.type === AMMETER ? { resistanceOhm: 0 } : { finiteInput: false }) } })) })} onReplace={(id, values) => { const item = scene.equipment.find(item => item.id === id); if (item) applyProperties(id, item.pose, { ...item.parameters, ...values }); }} />}
        {ohmMode && <OhmGuide showModeSelector={scene.experimentId !== JUNIOR_ELECTRICAL_EXPERIMENT} scene={scene} reply={simulation.acceptedReply} onControl={control => commit({ type: 'set-ohm-control', control })} onReplace={(id, resistanceOhm) => { const item = scene.equipment.find(item => item.id === id); if (item) applyProperties(id, item.pose, { ...item.parameters, resistanceOhm }); }} />}
        {emfMode && <EmfGuide scene={scene} />}
        {inductionMode && <InductionPanel key={scene.documentId} scene={scene} simulation={induction} onUpdate={item => { induction.reset(); applyProperties(item.id, item.pose, item.parameters); }} onView={close => {
          const meter = scene.equipment.find(i => i.type === GALVANOMETER);
          viewport(close && meter ? { centerXM: meter.pose.xM, centerYM: meter.pose.yM, pixelsPerM: 1300 } : inductionViewport(scene, document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().width ?? 600, document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().height ?? 352));
        }} />}
        {conductorMode && <ConductorPanel scene={scene} onChange={changeConductor} />}
        {parallelCurrentMode && <ParallelCurrentPanel scene={scene} onChange={changeParallelCurrent} />}
        {seriesCurrentMode && <SeriesCurrentPanel scene={scene} onChange={changeSeriesCurrent} />}
        {!conductorMode && !parallelCurrentMode && !seriesCurrentMode && !ohmMode && !resistanceMode && !powerMode && (scene.experimentId === LAMP_CIRCUIT_EXPERIMENT || scene.experimentId === JUNIOR_ELECTRICAL_EXPERIMENT) && <LampCircuitGuide key={scene.documentId} onRecord={() => { setPanel('记录表'); expandRecords(); recordContent.current?.scrollTo(0, 0); }} />}
        {tickerMode ? <TickerPanel simulation={ticker} onView={viewTickerTape} /> : heatComparisonMode ? <HeatComparisonPanel simulation={heatComparison} onView={key => { const reading = key ? heatComparison.readings[key] : null; const target = reading?.ok ? reading.meter : undefined; viewport(target ? { centerXM: target.pose.xM + .025, centerYM: target.pose.yM - .11, pixelsPerM: Math.min(2000, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().height ?? 352) - 50) / .24) } : { centerXM: 0, centerYM: .1, pixelsPerM: Math.min(700, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().width ?? 600) - 60) / .9, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().height ?? 352) - 70) / .56) }); }} onUpdate={items => commit({ type: 'update-equipment-batch', updates: items.map(item => ({ id: item.id, pose: item.pose, parameters: item.parameters })) })} /> : pulleyOutcome ? <PulleyControls scene={scene} outcome={pulleyOutcome} onUpdate={item => applyProperties(item.id, item.pose, item.parameters)} onAttach={(key, id) => { const update = pulleyAttach(scene, key, id); if (update) commit({ type: 'update-equipment', ...update }); }} onView={close => { const meter = pulleyOutcome.layout?.meterPoint; viewport(close && meter ? { centerXM: meter.xM, centerYM: meter.yM - .1, pixelsPerM: 1500 } : { centerXM: .05, centerYM: .39, pixelsPerM: Math.min(550, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().height ?? 352) - 60) / .95, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().width ?? 600) - 40) / .8) }); }} /> : kineticMode ? <KineticPanel scene={scene} simulation={kinetic} preview={!!activeMechanicalPreview} onUpdate={item => applyProperties(item.id, item.pose, item.parameters)} onView={close => { const r = kinetic.rig; viewport(close && r.ok ? { centerXM: r.block.pose.xM + (kinetic.state?.displacement ?? 0) - .025, centerYM: .02, pixelsPerM: 1000 } : { centerXM: .05, centerYM: .13, pixelsPerM: Math.min(350, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().width ?? 600) - 50) / 3.3) }); }} /> : twoForceMode ? <TwoForcePanel scene={scene} simulation={twoForce} preview={!!activeMechanicalPreview || !!activeTwoForceYaw} onUpdate={(item, parameters, pose) => { twoForce.reset(); commit({ type: 'update-equipment', id: item.id, pose: pose ?? item.pose, parameters }); }} onAngle={setTwoForceAngle} onView={close => { const cart = twoForce.viewScene.equipment.find(item => item.type === 'mechanical.cart'); viewport(close && cart ? { centerXM: cart.pose.xM, centerYM: cart.pose.yM, pixelsPerM: 850 } : { centerXM: 0, centerYM: .15, pixelsPerM: Math.min(500, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().width ?? 600) - 45) / 1.85, ((document.querySelector('[data-testid="scene-board"]')?.getBoundingClientRect().height ?? 352) - 64) / 1.05) }); }} /> : gravityOutcome ? <GravityPanel scene={scene} outcome={gravityOutcome} preview={!!activeMechanicalPreview} onUpdate={(id, parameters) => { const item = scene.equipment.find(peer => peer.id === id); if (item) commit({ type: 'update-equipment', id, pose: item.pose, parameters }); }} onGravity={value => commit({ type: 'set-gravity', gravityMPerS2: value })} onReadView={() => { const meter = gravityScene.equipment.find(item => item.type === FORCE_METER); if (meter) viewport({ centerXM: meter.pose.xM, centerYM: meter.pose.yM - .11, pixelsPerM: 1250 }); }} onOverview={() => viewport({ centerXM: 0, centerYM: .36, pixelsPerM: Math.min(650, window.innerWidth < 760 ? 420 : 650, (Math.max(352, window.innerHeight * .52 - 114) - 48) / .76) })} /> : averageSpeedMode ? <AverageSpeedPanel simulation={averageSpeed} angle={(scene.equipment.find(item => item.type === SPEED_TRACK)?.pose.rotationRad ?? 2 * Math.PI / 180) * 180 / Math.PI} onAngle={degrees => { const track = scene.equipment.find(item => item.type === SPEED_TRACK); if (track) applyProperties(track.id, { ...track.pose, rotationRad: degrees * Math.PI / 180 }, track.parameters); }} onStop={positionSpeedStop} /> : meltingMode ? <MeltingPanel simulation={melting} onUpdate={(item, values) => { applyProperties(item.id, item.pose, { ...item.parameters, ...values }); }} /> : thermalMode ? <ThermalPanel scene={scene} simulation={thermal} onUpdate={(item, values) => { applyProperties(item.id, item.pose, { ...item.parameters, ...values }); }} /> : pendulumMode ? <PendulumPanel scene={scene} simulation={pendulum} onGravity={value => commit({ type: 'set-gravity', gravityMPerS2: value })} onAttach={(id, supportId) => { const item = scene.equipment.find(item => item.id === id); if (item) applyProperties(id, item.pose, { ...item.parameters, supportId }); }} /> : buoyancyOutcome ? <BuoyancyPanel scene={buoyWorkingScene} outcome={buoyancyOutcome} onUpdate={updateBuoyancy} onAction={buoyancyAction} /> : cartMode ? <CartPanel simulation={cart} preview={!!activeMechanicalPreview} onViewTape={viewCartTape} /> : massVolumeOutcome ? <MassVolumePanel key={scene.documentId} scene={densityWorkingScene} outcome={massVolumeOutcome} preview={!!activeDensityPreview || !!activeMechanicalPreview} onUpdate={updateDensity} onClear={clearDensityBalance} onAlign={alignMassVolumeRuler} onReadView={() => { const block = scene.equipment.find(i => i.type === SPECIMEN); if (block) viewport({ centerXM: block.pose.xM + .025, centerYM: block.pose.yM + .005, pixelsPerM: 2400 }); }} onOverview={() => viewport({ centerXM: .03, centerYM: .06, pixelsPerM: window.innerWidth < 760 ? 360 : 650 })} /> : massOutcome ? <MassPanel key={scene.documentId} scene={densityWorkingScene} outcome={massOutcome} preview={!!activeDensityPreview || !!activeMechanicalPreview} onUpdate={updateDensity} onClear={clearDensityBalance} /> : densityOutcome ? <DensityPanel key={scene.documentId} onMethodChange={changeDensityMethod} scene={densityWorkingScene} outcome={densityOutcome} preview={!!activeDensityPreview || !!activeMechanicalPreview} onUpdate={updateDensity} onPreview={previewDensity} onPour={pourDensity} onClear={clearDensityBalance} /> : mirrorImageOutcome ? <MirrorImagePanel key={scene.documentId} outcome={mirrorImageOutcome} guides={mirrorGuides} rays={mirrorRays} onGuides={setMirrorGuides} onRays={setMirrorRays} onEyeStep={stepMirrorEye} /> : refractionOutcome ? <RefractionPanel key={scene.documentId} scene={opticalScene} outcome={refractionOutcome} preview={!!activeOpticalPreview} theory={refractionTheory} onTheory={setRefractionTheory} reflection={refractionReflection} onReflection={setRefractionReflection} onAim={aimRefraction} onAlign={alignRefraction} onReverse={reverseRefractionLight} /> : reflectionOutcome ? <ReflectionPanel key={scene.documentId} scene={reflectionScene} outcome={reflectionOutcome} auxiliary={reflectionAuxiliary} onAuxiliary={setReflectionAuxiliary} preview={!!activeOpticalPreview || !!activeFoldPreview} onFoldPreview={value => setFoldPreview(value === null ? null : { value, documentId: scene.documentId, revision: scene.revision })} onFold={changeFold} onAlign={alignReflection} onOrbit={orbitReflection} /> : projectileMode ? <ProjectilePanel key={scene.documentId} scene={scene} simulation={projectile} marks={projectileMarksVisible} onMarks={setProjectileMarksVisible} onHeight={projectileHeight} onLevel={levelProjectile} /> : springOutcome ? <SpringPanel key={scene.documentId} outcome={springOutcome} preview={!!activeMechanicalPreview} gravity={scene.simulationConfig.gravityMPerS2} /> : frictionMode ? <FrictionPanel key={scene.documentId} scene={scene} simulation={friction} onUpdate={updateFriction} /> : leverOutcome ? <LeverPanel scene={scene} outcome={leverOutcome} auxiliary={leverAuxiliary} onAuxiliary={setLeverAuxiliary} onZero={zeroLever} preview={!!activeMechanicalPreview || !!activeNutPreview} movingEquipment={!!activeMechanicalPreview} onNutPreview={value => setNutPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null)} onNutChange={changeNut} /> : opticalOutcome ? <OpticalPanel outcome={opticalOutcome} auxiliary={opticalAuxiliary} onAuxiliary={setOpticalAuxiliary} preview={!!activeOpticalPreview} /> : inductionMode ? null : <SimulationPanel scene={scene} outcome={simulation.current} running={simulation.running} status={simulation.status} onStart={simulation.start} onPause={simulation.pause} onReset={simulation.reset} />}
        {frictionMode && mechanicalSelection && <FrictionAssembly key={`${mechanicalSelection.id}:${scene.revision}`} scene={scene} instance={mechanicalSelection} onUpdate={updateFriction} onPlace={placeOnFrictionSurface} />}
        {springMode && mechanicalSelection && <SpringAssembly key={`${mechanicalSelection.id}:${scene.revision}`} scene={scene} instance={mechanicalSelection} onAttach={parameters => commit({ type: 'update-equipment', id: mechanicalSelection.id, pose: mechanicalSelection.pose, parameters })} />}
        {projectileMode && mechanicalSelection?.type === PROJECTILE_BALL && <section className="projectile-panel"><h3>下次小球装配</h3><label>小球装入发射器<select aria-label="小球装入发射器" value={String(mechanicalSelection.parameters.launcherId ?? '')} onChange={event => applyProperties(mechanicalSelection.id, mechanicalSelection.pose, { ...mechanicalSelection.parameters, launcherId: event.target.value })}><option value="">未装入</option>{scene.equipment.filter(item => item.type === PROJECTILE_LAUNCHER).map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><p>可把小球拖到枪口附近装入；参数立即配置到下次初态，本次飞行中的小球不接受拖动。</p></section>}
        {!pulleyMode && !twoForceMode && !gravityMode && !buoyancyMode && !cartMode && !densityMode && !projectileMode && !pendulumMode && !springMode && !frictionMode && mechanicalSelection && <LeverAttachment key={`${mechanicalSelection.id}:${scene.revision}`} scene={scene} instance={mechanicalSelection} onAttach={parameters => { commit({ type: 'update-equipment', id: mechanicalSelection.id, pose: mechanicalSelection.pose, parameters }); }} />}
        <InspectorEditor scene={pulleyOutcome ? pulleyOutcome.view : twoForceMode ? scene : gravityMode ? gravityScene : buoyancyMode ? buoyancyScene : densityMode ? densityScene : springMode ? springScene : mechanicalMode ? mechanicalScene : scene} registry={registry} selection={selection} start={connectionStart} wireColor={wireColor} onSelect={select} activeWireEnd={activeWireEnd}
          onPort={connect} onApply={applyProperties} onRemove={removeSelected} onRoute={changeRoute} onDeleteRoutePoint={deleteRoutePoint} onWireEnd={chooseWireEnd} onDetachEnd={detachWireEnd} onColor={setWireColor} onFlip={flipEquipment} />
        {!opticalMode && !mechanicalMode && !heatComparisonMode && !thermalMode && !meltingMode && !pulleyMode && !kineticMode && !averageSpeedMode && <div className="config-section"><span className="eyebrow">当前模型设定</span><dl>
          <div><dt>电学模式</dt><dd>{scene.equipment.some(item => item.type === 'electrical.power-supply' && Number(item.parameters.internalResistanceOhm ?? 0) > 0) ? '有限内阻源 · 电表按器材参数' : '理想源 · 电表按器材参数'}</dd></div><div><dt>重力加速度</dt><dd>{scene.simulationConfig.gravityMPerS2} m/s²</dd></div><div><dt>随机误差</dt><dd>{scene.simulationConfig.randomError.enabled ? '配置启用，本阶段未施加' : '关闭'}</dd></div>
        </dl><p className="config-note">重力加速度为可配置的教学值。</p></div>}
        <div className="diagnostic-empty"><h3>操作诊断</h3><p role={error ? 'alert' : undefined}>{error || (tickerMode ? '固定计时器并穿纸带；拖纸带穿入，点击机身开关；拖右端拉带，断电后取下移到尺旁读数。' : heatComparisonMode ? '相同质量、初温和加热器条件，抄表比较水与食用油的温升或加热时间。' : pulleyMode ? '拖动测力计缓慢提拉，静止后读表；移动支架可整体调整装置。' : kineticMode ? '从静止释放钢球；保持同一木块和接触面，分别改变高度与钢球质量。' : twoForceMode ? '比较两端质量不等、相等以及扭转释放；选中小车可拖弯箭头改变起始角度。' : gravityMode ? '测力计挂在支架上，逐次拖钩码到下挂钩；取下、改变质量或量程立即更新。' : averageSpeedMode ? '小车和挡片拖到斜面上，沿斜面读同一车头位置；移到中部后从原起点重新释放。' : meltingMode ? '水浴加热，温度计玻璃泡埋入试管样品，按分钟观察并保存。' : thermalMode ? '将烧杯放在加热网面，温度计玻璃泡浸入水中；加热并按固定间隔记录。' : pendulumMode ? '重置后量悬点到最低点球心的距离；设置小摆角，释放并计时多个完整周期，再自行记录。' : buoyancyMode ? '上下移动测力计使圆柱体浸入液体，逐阶段保存读数。排液前先给溢水杯补液并放好接液杯。' : cartMode ? '将小车和光电门摆到水平轨道上。释放后读挡光时间或纸带，暂停或停止后记录。' : massVolumeMode ? '同一铝块先称量，再取下读尺。选择同块来源计算体积，换不同大小重复并观察 m–V 图。' : massMode ? '空载调平后，拖物体或烧杯到左盘；点击砝码盒增减砝码，拖游码配平，保存自己的读数。' : densityMode ? '先空载调零，拖固体或烧杯到天平左盘、砝码盒到右盘；也可在上方选择位置。固体拖入量筒观察排水，液体用倒液按钮转移；读数需手工保存。' : mirrorImageMode ? '镜前移动观察眼，镜后移动对照物，使用刻度尺自行测量。' : refractionMode ? '将光源射向水面；法线与量角器对齐入射点，改变方向并手工读角。' : reflectionMode ? '移动/转动光源瞄准镜面，分别校准纸板、量角器与法线；从法线读角，折板做共面对照。' : projectileMode ? '调平发射器，将小球装入；发射后暂停或单步，再用计时器和二维标尺读数。' : springMode ? '弹簧安装到支架，钩码挂到弹簧下端；独立尺竖直向下摆放，超限请减载。' : mechanicalMode ? '拖到挂点或在挂接区选择支架/杠杆；改变支点或自重后重新空载调平。' : opticalMode ? '拖动或输入位置与光心高度；光屏不自动对焦。' : scene.equipment.length || scene.connections.length ? '拖动线头接到接线柱；未接线头不导通，多线可共用接线柱。尚未求解电路。' : '当前没有待检查的装置。')}</p></div>
      </aside>

      <section className={`panel records ${recordsMinimized ? 'is-minimized' : recordsExpanded ? 'is-expanded' : ''}`} aria-label="实验记录与分析">
        <div className="records-header">{recordsMinimized && <h2>实验记录</h2>}<div className="record-tabs" role="tablist" aria-label="记录面板" hidden={recordsMinimized}>
          {panels.map((name, index) => <button key={name} role="tab" id={`tab-${index}`} aria-selected={panel === name}
            aria-controls={`panel-${index}`} tabIndex={panel === name ? 0 : -1} onClick={() => setPanel(name)}
            onKeyDown={event => movePanel(event, index)}>{name}</button>)}
        </div><div className="record-header-actions"><span className="record-count">{scene.measurementRecords.length} 条记录</span>
          {!recordsMinimized && <button onClick={() => setRecordsExpanded(value => !value)}>{recordsExpanded ? '收起记录区' : '展开记录区'}</button>}
          <button aria-expanded={!recordsMinimized} aria-controls={`panel-${panels.indexOf(panel)}`} onClick={() => setRecordsMinimized(value => !value)}>{recordsMinimized ? '恢复记录区' : '最小化记录区'}</button>
        </div></div>
        <div ref={recordContent} className={`record-content ${panel !== '模型说明' ? 'records-data-view' : ''}`} role="tabpanel" id={`panel-${panels.indexOf(panel)}`} aria-labelledby={`tab-${panels.indexOf(panel)}`} tabIndex={0} hidden={recordsMinimized}>
          <div hidden={panel !== '记录表'}>{tickerMode && <TickerRecords scene={scene} key={scene.documentId + ':' + (ticker.run?.id ?? 'new')} simulation={ticker} onCapture={captureTicker} />}{inductionMode && <InductionRecords key={scene.documentId} scene={scene} onCapture={captureInduction} />}{heatComparisonMode && <HeatComparisonRecords key={scene.documentId} scene={scene} simulation={heatComparison} onCapture={captureHeatComparison} />}{pulleyOutcome && <PulleyMeasurements key={scene.documentId} scene={scene} outcome={pulleyOutcome} onCapture={capturePulley} />}{kineticMode && <KineticRecords key={scene.documentId} scene={scene} simulation={kinetic} preview={!!activeMechanicalPreview} onCapture={captureKinetic} />}{averageSpeedMode && <AverageSpeedRecords key={scene.documentId} scene={scene} simulation={averageSpeed} onCapture={captureAverageSpeed} />}{meltingMode && <MeltingRecords key={scene.documentId} simulation={melting} onCapture={captureMelting} />}{thermalMode && <ThermalRecords key={scene.documentId} simulation={thermal} onCapture={captureThermal} />}{powerMode && <LampPowerRecords key={scene.documentId} scene={scene} ready={!!simulation.acceptedReply} onCapture={captureMeasurements} />}{resistanceMode && <VoltammetryRecords key={scene.documentId} scene={scene} ready={!!simulation.acceptedReply} onCapture={captureMeasurements} />}{pendulumMode && <PendulumRecords key={scene.documentId} scene={scene} simulation={pendulum} onCapture={capturePendulum} />}{ohmMode && <OhmRecords key={scene.documentId} scene={scene} ready={!!simulation.acceptedReply} onCapture={captureMeasurements} />}{emfMode && <EmfRecords key={scene.documentId} scene={scene} ready={!!simulation.acceptedReply} onCapture={captureMeasurements} />}{buoyancyMode && <BuoyancyRecords key={scene.documentId} scene={scene} ready={!buoyPreview && !activeDensityPreview} onCapture={captureBuoyancyRecord} onCalculate={calculateBuoyancyRecords} />}{cartMode && <CartRecords key={scene.documentId} run={cart.run} ready={!!cart.run && !cart.running && !activeMechanicalPreview} method={cartMethod} onMethodChange={setCartMethod} onCapture={captureCart} />}{twoForceMode && <TwoForceRecords key={scene.documentId} scene={scene} ready={!!twoForce.run && !twoForce.running && !activeMechanicalPreview && !activeTwoForceYaw} onCapture={captureTwoForce} />}{gravityMode && <GravityRecords key={scene.documentId} scene={scene} ready={!activeMechanicalPreview} onCapture={captureGravity} />}{massVolumeMode && <MassVolumeRecords key={scene.documentId} scene={scene} ready={!activeDensityPreview && !activeMechanicalPreview} onCapture={captureMassVolume} onCalculate={calculateMassVolume} />}{massMode && <MassRecords key={scene.documentId} scene={scene} ready={!!massOutcome?.ok && !activeDensityPreview && !activeMechanicalPreview} onCapture={captureMass} onCalculate={calculateMass} />}{densityMode && !massMode && !massVolumeMode && <DensityRecords key={scene.documentId + ':' + densityMethod(scene)} scene={scene} ready={!!densityOutcome?.ok && !activeDensityPreview && !activeMechanicalPreview} onCapture={captureDensity} onResult={calculateDensity} />}{mirrorImageMode && <MirrorImageRecords key={scene.documentId} ready={!!mirrorImageOutcome?.ok && !activeOpticalPreview} onCapture={captureMirrorImage} />}{refractionMode && <RefractionRecords key={scene.documentId} scene={scene} ready={!!refractionOutcome?.ok && !activeOpticalPreview} onCapture={captureRefraction} />}{reflectionMode && <ReflectionRecords key={`reflection-records:${scene.documentId}`} scene={scene} ready={!!reflectionOutcome?.ok && !activeOpticalPreview && !activeFoldPreview} onCapture={captureReflection} />}{projectileMode && <ProjectileRecords key={`projectile-records:${scene.documentId}`} scene={scene} registry={registry} flight={projectile.flight} ready={!!projectile.flight && !projectile.running && !activeMechanicalPreview} onCapture={captureProjectile} />}{springMode && <SpringRecords key={`spring-records:${scene.documentId}`} scene={scene} registry={registry} ready={!!springOutcome?.ok && !activeMechanicalPreview} onCapture={captureSpring} />}{frictionMode && <FrictionRecords key={`friction-records:${scene.documentId}`} ready={!!friction.sample?.ok && friction.state.timeS > 0 && !activeMechanicalPreview} onCapture={captureFriction} />}{leverOutcome && <LeverRecords key={`lever-records:${scene.documentId}`} scene={scene} outcome={leverOutcome} ready={leverOutcome.ok && leverOutcome.calibrated && !activeMechanicalPreview && !activeNutPreview} onCapture={captureLever} />}{opticalOutcome && <OpticalRecords key={`optical-records:${scene.documentId}`} scene={scene} ready={opticalOutcome.ok && !activeOpticalPreview} onCapture={captureOptical} />}<MeasurementPanel defaultSetupLabel={conductorMode || parallelCurrentMode || seriesCurrentMode ? '第1组' : undefined} defaultPointLabels={conductorMode && conductorSample(scene) ? Object.fromEntries(scene.equipment.filter(item => item.type === AMMETER).map(item => [item.id, metalPoint(conductorSample(scene)!)])) : parallelCurrentMode ? Object.fromEntries(scene.equipment.filter(item => item.type === AMMETER).map(item => [item.id, parallelCurrentPoint(scene)])) : seriesCurrentMode ? Object.fromEntries(scene.equipment.filter(item => item.type === AMMETER).map(item => [item.id, seriesCurrentPoint(scene)])) : undefined} key={`measurements:${scene.documentId}`} scene={scene} registry={registry} ready={!!simulation.acceptedReply} entryEnabled={!tickerMode && !inductionMode && !opticalMode && !mechanicalMode && !heatComparisonMode && !thermalMode && !meltingMode && !pulleyMode && !kineticMode && !averageSpeedMode && !emfMode && !ohmMode && !resistanceMode && !powerMode}
            onCapture={captureMeasurements} onCorrect={(id, rawInput) => measurementCommand({ type: 'correct-measurement', id, rawInput })}
            onRemove={id => { measurementCommand({ type: 'remove-measurement', id }); }} onExport={exportMeasurements} /></div>
          <div hidden={panel !== '图线'}>{tickerMode ? <MeasurementChart key={scene.documentId} scene={scene} profiles={tickerProfiles} /> : inductionMode ? <InductionTable scene={scene} /> : conductorMode ? <ConductorResults scene={scene} /> : parallelCurrentMode ? <ParallelCurrentResults scene={scene} /> : seriesCurrentMode ? <SeriesCurrentResults scene={scene} /> : heatComparisonMode ? <HeatComparisonChart scene={scene} /> : pulleyMode ? efficiencyMode ? <EfficiencyTable scene={scene} /> : <PulleyTable scene={scene} /> : kineticMode ? <KineticTable scene={scene} /> : averageSpeedMode ? <AverageSpeedResults scene={scene} chart /> : meltingMode ? <MeltingChart scene={scene} /> : thermalMode ? <ThermalChart scene={scene} /> : powerMode ? <LampPowerChart scene={scene} /> : resistanceMode ? <VoltammetryChart scene={scene} /> : ohmMode ? <OhmChart scene={scene} /> : pendulumMode ? <PendulumChart scene={scene} /> : emfMode ? <EmfChart scene={scene} /> : projectileMode ? <ProjectileChart scene={scene} /> : twoForceMode ? <div><h3>二力条件与现象对比</h3><TwoForceTable scene={scene} /><p>本实验比较条件和运动状态，以观察表整理证据，不自动生成数值拟合或平衡结论。</p></div> : gravityMode ? <GravityChart key={scene.documentId} scene={scene} /> : massVolumeMode ? <MassVolumeChart scene={scene} /> : springMode ? <SpringChart scene={scene} /> : <MeasurementChart key={scene.documentId} scene={scene} profiles={buoyancyMode ? buoyancyProfiles : mirrorImageMode ? mirrorImageProfiles : cartMode ? cartProfiles : massMode ? massProfiles : densityMode ? densityProfiles : refractionMode ? refractionProfiles : reflectionMode ? reflectionProfiles : frictionMode ? [{ id: 'friction-f-n', label: '滑动摩擦力—压力（稳态）', available: true, x: { quantity: 'force', unit: 'N', label: '压力（N）', pointLabel: '压力' }, y: { quantity: 'force', unit: 'N', label: '滑动摩擦力（N）', pointLabel: '滑动摩擦力' } }] : mechanicalMode ? [{ id: 'lever-torque', label: '多组力矩比较（手工计算）', available: true, x: 'sample', y: { quantity: 'torque', unit: 'N·m', label: '有符号力矩（N·m）' } }, { id: 'lever-force', label: '多组拉力比较', available: true, x: 'sample', y: { quantity: 'force', unit: 'N', label: '力（N）' } }] : opticalMode ? [{ id: 'optical-distance', label: '屏距—物距（手工读尺）', available: true, x: { quantity: 'length', unit: 'm', label: '物距 u（m）', pointLabel: '物距u' }, y: { quantity: 'length', unit: 'm', label: '屏距 s（m，非自动像距）', pointLabel: '屏距s' } }, { id: 'optical-image', label: '实测像距—物距（清晰实像）', available: true, x: { quantity: 'length', unit: 'm', label: '物距 u（m）', pointLabel: '物距u' }, y: { quantity: 'length', unit: 'm', label: '实测像距 v（m）', pointLabel: '像距v' } }] : undefined} />}</div>
          {panel === '模型说明' && inductionMode && <div className="model-description"><h3>磁生电与灵敏电流计</h3><p>装置采用固定斜视角的立体示意，磁场由上极指向下极，导体 AB 沿前后方向横跨磁极间隙。左右运动切割磁感线，上下运动沿磁场方向。往复运动在限定行程内自动折返；线圈按磁通量变化计算，整体处在匀强磁场中平移时无净感应电动势。</p><p>电流由实际闭合接线求解，灵敏电流计中央为零，负方向也可正常读数。忽略连接导线受场、自感、边缘磁场和指针惯性；改变磁场强弱、匝数等设置视为两次实验之间的静态调整，不模拟调整瞬间。恢复起点及重载从初态开始，已存观察保留。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && buoyancyMode && <div className="model-description"><h3>静态浮力与排液</h3><p>浮力按液体密度、重力加速度与实际浸没体积计算，悬挂张力等于重力减浮力。液面由液体体积和浸入几何共同确定，排出的液体累计保存在接液杯中。触底、碰壁、松绳和超量程均不输出正常悬挂读数。</p><p>学生分阶段记录测力计、天平与量筒读数，并选来源计算。忽略黏滞阻力、液滴挂壁、表面张力及浮体动态运动。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && tickerMode && <div className="model-description"><h3>等周期打点与手拉纸带</h3><p>计时器使用配套电源，固定后以 50 或 60 Hz 等周期打点；纸带跟随指针实际位置，松手停拉，静止时会打出重合点。纸带长 0.8 m，通电最多 12 s，达到时限自动断电。忽略纸带弹性、摩擦与打点阻力，不模拟真实高压电路。</p><p>起点记为 0，数 n 个间隔，有 t=n/f。断电后把纸带拖到独立刻度尺上沿，放大后按 1 mm 分度读两个测点；尺不会自动对齐，位移由学生输入。历史来源保留两个原始点的位置、时刻、频率与原文；运行过程不续存。教材版次和页码待教师核验。</p></div>}
          {panel === '模型说明' && cartMode && <div className="model-description"><h3>小车、配重与悬挂砝码</h3><p>水平轨道无摩擦，绳轻且不可伸长，定滑轮无转动惯量。系统质量包含小车、车上配重和悬挂总质量。以悬挂端重力为系统驱动力，从静止释放，到轨道末端或砝码限位停止采样。</p><p>光电门速度来自挡光时长，纸带加速度来自 x–t² 拟合。运行时刻不保存，重新加载从初态释放。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && efficiencyMode && <div className="model-description"><h3>滑轮组机械效率</h3><p>一只定滑轮和一只动滑轮，按绳端固定位置选择两股或三股竖直轻绳承重，绳长约束 s=nh。缓慢提拉时 F=(G+动滑轮重力)/n；W有用=Gh，W总=Fs。默认动滑轮 50 g，忽略绳重、轮轴摩擦、惯性与摆动；额外功仅为提升动滑轮，不模拟发热损耗。</p><p>直接称重先读 G，滑轮组再读 F、h、s。记录和效率只使用手工读数，原始来源保持；缺失、零分母或无效装配不输出正常效率。</p></div>}
          {panel === '模型说明' && pulleyMode && !efficiencyMode && <div className="model-description"><h3>滑轮与轻绳约束</h3><p>直接提起与定滑轮 F=G，动滑轮 F=(G+滑轮重力)/2。固定轴仅改变竖直拉动的方向；两股竖直绳承托动滑轮，拉动端移动与重物位移受同一绳长约束。忽略摩擦、绳重和绳伸长，按缓慢提拉、静止读数计算。</p><p>默认理想轻滑轮；可计入动滑轮自重，超量程、碰底、绳段不足和装配无效时拒绝正常读数。记录、比值和结论来自手工读数，来源快照保留实际装置。</p></div>}
          {panel === '模型说明' && kineticMode && <div className="model-description"><h3>动能影响因素</h3><p>实心钢球纯滚动到达水平面，转动惯量为 2mr²/5；平滑衔接、忽略滚阻。同高度释放时撞前速度与质量无关。球块碰后保持接触，共同减速；木块受恒定滑动摩擦，碰撞存在能量损失。只在相同装置下比较木块位移，不将 μMgs 直接等同碰前钢球动能。</p><p>系统不代填实验结论。质量、高度、起止读数和比较条件独立保留，改动装置不覆盖已保存来源。</p></div>}
          {panel === '模型说明' && twoForceMode && <div className="model-description"><h3>光滑水平面上的两股绳拉力</h3><p>小车可在水平面内平动和转动。轻绳长度固定，定滑轮理想，计算小车与两侧钩码的耦合运动；运动中张力不直接等于钩码重力。竖直重力与支持力抵消，观察水平两力。</p><p>相等、反向的两力若不共线，仍可能有力矩；无摩擦和阻尼，不自动把转动停止到平衡。画布俯视小车，钩码侧视示意。到达台边、行程、松绳或观察时限则停止；保存的是初始装置和独立观察快照，不续跑。</p><p>质量和现象由学生记录，不自动填结论；具体教材版次、章节、页码待核验。</p></div>}
          {panel === '模型说明' && gravityMode && <div className="model-description"><h3>重力与质量的静态测量</h3><p>已挂钩码总质量决定实际重力，理想测力计竖直静止时拉力与重力大小相等；空载为零。默认 g=9.81 m/s²，可调整。忽略振动、空气浮力及校准误差；过载、接触桌面、错误挂接和拖动中不输出正常读数。</p><p>质量与重力由学生填写，图线和 G/m 仅用有效记录；装置变更不覆盖历史来源，不同 g 分组显示，原点参照不写入实测记录。教材信息待教师核验。</p></div>}
          {panel === '模型说明' && massVolumeMode && <div className="model-description"><h3>同种正方体铝块的质量与体积</h3><p>复用天平和独立刻度尺。铝块为同种均匀材料，正面一条边的真实长度按比例绘制，侧面是立体示意。质量由天平称量保存，两端尺读数相减得边长，再由自己的读数计算 V=a³；独立保存来源，不自动填结论。</p><p>图线使用成组手工记录。可选原点仅是理论参照，不冒充测量。忽略加工偏差、温度变化、空气浮力及砝码误差；具体教材映射待教师核验。</p></div>}
          {panel === '模型说明' && massMode && <div className="model-description"><h3>天平测量固体和液体质量</h3><p>复用静态等臂天平，左物右码，右盘砝码加游码读数为质量；空载调平后才称量，未平衡或超量程不输出正常读数。液体质量由同一烧杯先空杯、后加水两条手工读数相减得到；不依赖量筒或密度记录。</p><p>存储使用 kg，记录与 CSV 使用 g。忽略空气浮力、砝码误差、挂壁与蒸发。教材条目待教师核验。</p></div>}
          {panel === '模型说明' && densityMode && !massMode && !massVolumeMode && <div className="model-description"><h3>天平称量与排水读数</h3><p>静态等臂天平先调零，左物右码，游码每格0.2 g；量筒100 mL，每格1 mL，平视凹液面最低处。固体使用ρ=m/(V2−V1)，液体使用ρ=(m1−m2)/V。各阶段独立保存学生读数，选择相同条件的来源再计算；修改来源后需明确重算。</p><p>计算存储使用SI，界面和CSV使用g、mL、g/cm³。忽略吸水、溶解、挂壁、蒸发与砝码浮力；仅支持下沉固体、相同液体转移，未调零/未平衡、溢出和未浸没不输出正常密度。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && refractionMode && <div className="model-description"><h3>单一空气—水界面折射</h3><p>二维几何光学，使用 Snell 定律；空气折射率近似 1、水取 4/3。角从法线量起，水到空气达到临界角时沿界面传播，超过临界角没有正常折射光。只计算一个水平界面，水下光到水槽边缘结束，不模拟玻璃壁、多次折射、光强或干涉。复用光源、量角器、法线和记录模块，角度手工填写，教材映射待教师核验。</p></div>}
          {panel === '模型说明' && reflectionMode && <div className="model-description"><h3>光的反射与共面证据</h3><p>空间单位方向按 r=d−2(d·n)n 反射，入射角和反射角均从镜面法线量起。两片纸板为有限空间承接面，右板绕法线折轴转动；光线离开纸板时只有交点，没有连续光迹，光的方向仍保持。正入射沿轴是退化对照，不能证明共面。</p><p>量角器分度 1°，学生记录独立于理论，存储/图线/CSV 使用 SI rad。单镜单束，无衍射、散射亮度或厚光束，非校准状态不输出正常角度记录。</p></div>}
          {panel === '模型说明' && mirrorImageMode && <div className="model-description"><h3>平面镜的正立虚像</h3><p>物体各点关于竖直镜面对称。实线为射向镜面及进入眼睛的实际光线，虚线为反射光线向镜后的延长线。观察眼看到的像在镜后，光屏上没有清晰像。</p><p>模型只计算理想薄玻璃板的侧视截面。忽略厚度、折射偏移、遮挡和亮度差。对照物需要自行移动，读数不会自动填写。</p></div>}
          {panel === '模型说明' && opticalMode && !opticalPending && !reflectionMode && !refractionMode && !mirrorImageMode && <div className="model-description"><h3>近轴薄透镜与离焦</h3><p>光屏由多物点、圆孔径采样光线落点形成连续光斑；三心偏移会使像移位或离屏。虚像仅在辅助观察中显示，u=f 无有限像。理论辅助可关闭，不自动找焦或填入学生记录；不模拟衍射、像差及真实照明。</p></div>}
          {panel === '模型说明' && frictionMode && <div className="model-description"><h3>水平一维静/滑摩擦</h3><p>静摩擦按需匹配至 μsN，滑动摩擦与速度反向；N=mg，牵引力与摩擦力只在滑动稳态时等大。自研模型负责轨迹和力，Matter.js 同步静态表示与接触，不重复积分。面积对照保持质量/材料不变，采用干摩擦近似；非稳态数据保留标签，不作为 F–N 有效图点。</p></div>}
          {panel === '模型说明' && averageSpeedMode && <div className="model-description"><h3>测量物体运动的平均速度</h3><p>全程和上半程均从同一高端静止释放，沿斜面读同一车头到挡片的路程。v=s/t 使用学生保存的尺读数与时间，不用瞬时速度代替。运动采用忽略阻力、车轮转动惯量的质点模型，a=g·sinθ；碰到挡片精确截断。计时同步开始、撞片停止，不模拟人工按表误差。重载从初态重跑，教材映射待核验。</p></div>}
          {panel === '模型说明' && meltingMode && <div className="model-description"><h3>固体熔化水浴模型</h3><p>水浴与样品通过热传递交换能量，样品用焓法计入显热和潜热。海波用近似单一熔点，石蜡用分布熔程作教学示意，具体牌号和条件会改变数据。忽略温度梯度、温度计滞后、过冷与分解。时间内部存 s、界面记录使用 min，温度内部存 K、界面使用 ℃。归零记录计时保留物态；换样品或重载从初态重做，保留已存记录。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && heatComparisonMode && <div className="model-description"><h3>等功率加热与吸热比较</h3><p>温度均匀的液体，默认无散热且忽略容器热容量，Q=Pt=mcΔT。两组独立计时和加热；相同温升模式分别到达目标后断电，80 ℃或 3600 s 到达观察上限。食用油参数为教学近似。记录保留原装置和学生读数；条件不一致的数据不绘比较图。教材条目待教师核验。</p></div>}
          {panel === '模型说明' && thermalMode && <div className="model-description"><h3>水沸腾热学模型</h3><p>标准大气压下纯水；以水与烧杯的总热容量计算升温，计入向环境散热。达到 100 ℃ 后净供热用于汽化，水量减少；停止加热后按同一能量方程冷却。忽略沸腾前蒸发、温度计滞后与气压变化。温度内部存 K，界面与 CSV 使用 ℃。保存实验记录与初态，重载不续跑。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && pendulumMode && <div className="model-description"><h3>单摆与小角条件</h3><p>L 为悬点到摆球球心的距离。无质量、不可伸长摆线及质点摆球，θ″=−(g/L)sinθ；周期使用完全椭圆积分，不把大角度当小角度。小角公式 T=2π√(L/g)，建议摆角不超过 5°；N 个完整周期时间 t 得 T=t/N。忽略空气阻力、阻尼、摆球转动惯量与人工反应时间。参数修改清除当前计时，保存只保存初态与已记录读数，重载不续跑。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && springMode && <div className="model-description"><h3>竖直无质量理想弹簧</h3><p>静态 F=(钩码质量+盘质量)g=kΔx；L=L0+Δx。原长须在无载时读尺，总长由两端读数相减。范围外无正常长度/采样，不计算振动、阻尼或塑性变形；图线和最小二乘拟合只用学生有效记录。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && projectileMode && <div className="model-description"><h3>质点平抛与同源计时</h3><p>无空气阻力、恒定重力，x=x0+v0t、y=y0−gt²/2，ydrop=y0−y。计时、小球、等时标记和采样共用本次时间，帧跨落地也准确截断；本次初态冻结，编辑只配置下一次。尺读数与理论分开，至少三组有效时间才作记录拟合；保存后重载从初态准备，教材映射待教师核验。</p></div>}
          {panel === '模型说明' && mechanicalMode && !cartMode && !densityMode && !projectileMode && !pendulumMode && !springMode && !frictionMode && <div className="model-description"><h3>杠杆力矩与约束</h3><p>从挂点和方向计算 r×F、作用线垂距及支点反力。先空载调平，后挂载不再抵消外力矩；失衡仅提示趋势。自重可选、仪器超量程明确提示；理论辅助默认关闭，不自动改挂点或拉力。手工力矩由当组输入的力与力臂计算。</p></div>}
          {panel === '模型说明' && powerMode && <div className="model-description"><h3>小灯泡的实际功率与额定功率</h3><p>沿用首版灯泡 U=Rcold·I+a·I³；亮度随耗散功率变化，不模拟温升过程或真实烧毁。电表为理想模型，学生自行调变阻器改变工作点。每次 P=UI 只使用保存的实际读数；额定工作点按该次电压表半分度与灯泡额定电压判断，不能自动回到额定状态。额定功率只汇总额定点，低压和过压不混合平均；粗量程不足以区分邻近工作点时应改合适量程。原始修订、删除会更新派生功率，历史灯泡参数冻结。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && resistanceMode && <div className="model-description"><h3>伏安法与读数误差</h3><p>同一电阻在不同电压下分别计算 R=U/I，再比较均值与 U–I 图线斜率。计算只使用保存的读数；量程、分度值和器材配置随快照冻结。修订或删除原始记录会更新分析。本初中实验固定使用理想电表：电流表内阻为 0，电压表内阻为 ∞。忽略温升，不支持灯泡的非恒定电阻。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && ohmMode && <div className="model-description"><h3>电流关系与控制变量</h3><p>定值电阻温度不变时 I=U/R。探究 I–U 保持 R 不变；探究 I–1/R 需在每次替换电阻后调节变阻器，使定值电阻两端的电压表示数回到目标值。变阻器用一上一下两柱，不自动调节滑片。图线只使用成对有效记录和该次标称电阻；未满足控制条件的记录保留并标记，不参与拟合。电表内阻改变时保留加载影响，不将模型真值填入学生记录。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && emfMode && <div className="model-description"><h3>有限内阻源与 U–I 拟合</h3><p>电源端电压 U端=E−rI总。内接测负载电流，电压表分流；外接测总电流，电压表排除电流表分压。拟合只使用成对有效学生记录，保存时冻结接法与仪器参数；五个不同电流才计算，不用源参数补齐或修正拟合值。详见右侧实验指导中的加载公式。</p><p>导线、开关理想，源参数恒定。电表内阻为量程共用参数，可在器材属性中设置；不模拟量程切换导致的内阻变化。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && !inductionMode && !powerMode && !resistanceMode && !ohmMode && !emfMode && !opticalMode && !mechanicalMode && !heatComparisonMode && !thermalMode && !meltingMode && !pulleyMode && !kineticMode && !averageSpeedMode && <div className="model-description"><h3>理想模型与测量</h3><p>{simulation.current ? '当前使用准静态直流模型：灯泡 U=Rcold·I+a·I³，亮度由耗散功率映射，不模拟热惯性或真实烧毁。电表按实际量程端接线，按分度值显示。' : '当前未加载领域模型。放置器材并接线后自动计算，开关和参数变化会更新效果；仪器示数不会自动填入学生记录。'}</p><p>物理计算使用 SI 单位；理论值、仪器示数与手工记录分别保存。</p></div>}
        </div>
      </section>
    </main>
    <footer className="app-footer"><span>本地保存仅限当前浏览器；重载从实验初态重新运行。</span><span>初中 · 高中物理</span></footer>
    {catalog && <ExperimentCatalog key={`${catalog.stage}:${catalog.domain}`} stage={catalog.stage} initialDomain={catalog.domain} onChoose={prepareCatalog} onCancel={() => setCatalog(null)} />}
    {pending && <DocumentPreview pending={pending} onConfirm={confirmReplacement} onCancel={() => setPending(null)} />}
    {renaming && <RenameExperiment title={scene.title} onRename={title => commit({ type: 'rename', title })} onCancel={() => setRenaming(false)} />}
    {savedExperiments && <SavedExperiments entries={savedExperiments} busy={busy} error={libraryError} onChoose={id => void chooseSavedDocument(id)} onDelete={deleteSavedDocument} onCancel={() => setSavedExperiments(null)} />}
    <div className="live-notice" role="status">{notice?.message}</div>
  </div>;
}
