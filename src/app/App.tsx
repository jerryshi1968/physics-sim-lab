import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { SWITCH, WIRE, RHEOSTAT } from '../equipment/electrical/definitions.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { isOpticalScene, simulateOptical } from '../equipment/optical/simulate.ts';
import { createOpticalExperiment } from '../experiments/optical-bench.ts';
import { OpticalPanel } from './optical/OpticalPanel.tsx';
import { OpticalStart } from './optical/OpticalStart.tsx';
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
import { createLampCircuitExperiment, LAMP_CIRCUIT_EXPERIMENT } from '../experiments/lamp-circuits.ts';
import type { LampCircuitStart as ExperimentStart } from '../experiments/lamp-circuits.ts';
import { LampCircuitStart } from './experiments/LampCircuitStart.tsx';
import { LampCircuitGuide } from './experiments/LampCircuitGuide.tsx';
import { createLeverExperiment } from '../experiments/lever.ts';
import { detachedWeightUpdates } from '../equipment/mechanical/weightChain.ts';
import { isMechanicalScene, mechanicalViewScene, simulateLever, mechanicalDrop } from '../equipment/mechanical/simulate.ts';
import { buildLeverMeasurements } from '../equipment/mechanical/measure.ts';
import type { LeverCapture } from '../equipment/mechanical/measure.ts';
import { LeverPanel, LeverAttachment } from './mechanical/LeverPanel.tsx';
import { LeverStart } from './mechanical/LeverStart.tsx';
import { LeverRecords } from './mechanical/LeverRecords.tsx';
import type { NutPreview } from './mechanical/BalanceNutControls.tsx';
import { isFrictionScene, frictionDrop, frictionSample } from '../equipment/mechanical/frictionScene.ts';
import { createFrictionExperiment } from '../experiments/friction.ts';
import { useFrictionSimulation } from './friction/useFrictionSimulation.ts';
import { FrictionPanel, FrictionAssembly } from './friction/FrictionPanel.tsx';
import { FrictionStart } from './friction/FrictionStart.tsx';
import { FrictionRecords } from './friction/FrictionRecords.tsx';
import { buildFrictionMeasurements } from '../equipment/mechanical/frictionMeasure.ts';
import type { FrictionCapture } from '../equipment/mechanical/frictionMeasure.ts';
import { BLOCK, SURFACE } from '../equipment/mechanical/frictionDefinitions.ts';
import { FORCE_METER } from '../equipment/mechanical/definitions.ts';
import type { EquipmentInstance } from '../core/equipment/schema.ts';
import { leverPresentationScene } from './mechanical/leverPresentation.ts';

import { createSpringExperiment } from '../experiments/spring.ts';
import { isSpringScene, springSample, springViewScene, springDrop, detachedSpringUpdates, springMessage } from '../equipment/spring/simulate.ts';
import { buildSpringMeasurements } from '../equipment/spring/measure.ts';
import type { SpringCapture } from '../equipment/spring/measure.ts';
import { SpringStart } from './spring/SpringStart.tsx';
import { SpringPanel, SpringAssembly } from './spring/SpringPanel.tsx';
import { SpringRecords } from './spring/SpringRecords.tsx';
import { SpringChart } from './spring/SpringChart.tsx';

import { createProjectileExperiment } from '../experiments/projectile.ts';
import { isProjectileScene, projectileDrop, projectileMessage } from '../equipment/projectile/simulate.ts';
import { LAUNCHER as PROJECTILE_LAUNCHER, BALL as PROJECTILE_BALL, GROUND as PROJECTILE_GROUND } from '../equipment/projectile/definitions.ts';
import { buildProjectileMeasurements } from '../equipment/projectile/measure.ts';
import type { ProjectileCapture } from '../equipment/projectile/measure.ts';
import { useProjectileSimulation } from './projectile/useProjectileSimulation.ts';
import { ProjectilePanel } from './projectile/ProjectilePanel.tsx';
import { ProjectileRecords } from './projectile/ProjectileRecords.tsx';
import { ProjectileChart } from './projectile/ProjectileChart.tsx';
import { ProjectileStart } from './projectile/ProjectileStart.tsx';

import { createReflectionExperiment } from '../experiments/reflection.ts';
import { isReflectionScene, simulateReflection } from '../equipment/reflection/simulate.ts';
import { PAPER, MIRROR, EMITTER, reflectionTypes } from '../equipment/reflection/definitions.ts';
import { buildReflectionMeasurements, reflectionProfiles } from '../equipment/reflection/measure.ts';
import type { ReflectionCapture } from '../equipment/reflection/measure.ts';
import { ReflectionStart } from './reflection/ReflectionStart.tsx';
import { ReflectionPanel } from './reflection/ReflectionPanel.tsx';
import { ReflectionRecords } from './reflection/ReflectionRecords.tsx';

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
  const reflectionMode = isReflectionScene(scene);
  const opticalMode = isOpticalScene(scene) || reflectionMode;
  const [choosingReflection, setChoosingReflection] = useState(false);
  const [foldPreview, setFoldPreview] = useState<{ value: number; documentId: string; revision: number } | null>(null);
  const [reflectionAuxiliary, setReflectionAuxiliary] = useState(false);
  const activeFoldPreview = foldPreview?.documentId === scene.documentId && foldPreview.revision === scene.revision ? foldPreview : null;
  const mechanicalMode = isMechanicalScene(scene);
  const frictionMode = isFrictionScene(scene);
  const springMode = isSpringScene(scene);
  const projectileMode = isProjectileScene(scene);
  const projectile = useProjectileSimulation(scene, registry, projectileMode);
  const [choosingProjectile, setChoosingProjectile] = useState(false), [projectileMarksVisible, setProjectileMarksVisible] = useState(false);
  const [choosingSpring, setChoosingSpring] = useState(false);
  const friction = useFrictionSimulation(scene, registry, frictionMode);
  const [choosingFriction, setChoosingFriction] = useState(false);
  const [mechanicalPreview, setMechanicalPreview] = useState<{ id: string; point: WorldPoint; documentId: string; revision: number } | null>(null);
  const [nutPreview, setNutPreview] = useState<(NutPreview & { documentId: string; revision: number }) | null>(null);
  const [leverAuxiliary, setLeverAuxiliary] = useState(false);
  const [choosingLever, setChoosingLever] = useState(false);
  const activeMechanicalPreview = mechanicalPreview?.documentId === scene.documentId && mechanicalPreview.revision === scene.revision ? mechanicalPreview : null;
  const activeNutPreview = nutPreview?.documentId === scene.documentId && nutPreview.revision === scene.revision ? nutPreview : null;
  const nutScene = activeNutPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeNutPreview.id ? { ...item, parameters: { ...item.parameters, [activeNutPreview.side === 'left' ? 'leftNutOffsetM' : 'rightNutOffsetM']: activeNutPreview.offsetM } } : item) } : scene;
  const springScene = springMode ? springViewScene(scene, registry, activeMechanicalPreview) : scene;
  const springOutcome = springMode ? springSample(springScene, registry) : null;
  const mechanicalScene = mechanicalMode && !frictionMode && !springMode && !projectileMode ? mechanicalViewScene(nutScene, activeMechanicalPreview) : scene;
  const leverOutcome = mechanicalMode && !frictionMode && !springMode && !projectileMode ? simulateLever(mechanicalScene, registry) : null;
  const [opticalPreview, setOpticalPreview] = useState<{ id: string; point: WorldPoint; documentId: string; revision: number } | null>(null);
  const [opticalAuxiliary, setOpticalAuxiliary] = useState(false);
  const activeOpticalPreview = opticalPreview?.documentId === scene.documentId && opticalPreview.revision === scene.revision ? opticalPreview : null;
  const opticalScene = activeOpticalPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeOpticalPreview.id ? { ...item, pose: { ...item.pose, ...activeOpticalPreview.point } } : item) } : scene;
  const reflectionScene = activeFoldPreview ? { ...opticalScene, equipment: opticalScene.equipment.map(item => item.type === PAPER ? { ...item, parameters: { ...item.parameters, foldRad: activeFoldPreview.value } } : item) } : opticalScene;
  const reflectionOutcome = reflectionMode ? simulateReflection(reflectionScene, registry) : null;
  const opticalOutcome = opticalMode && !reflectionMode ? simulateOptical(opticalScene, registry) : null;
  const [rheostatPreview, setRheostatPreview] = useState<{ id: string; position: number; documentId: string; revision: number } | null>(null);
  const activeRheostatPreview = rheostatPreview?.documentId === scene.documentId && rheostatPreview.revision === scene.revision ? rheostatPreview : null;
  const calculationScene = activeRheostatPreview ? { ...scene, equipment: scene.equipment.map(item => item.id === activeRheostatPreview.id
    ? { ...item, parameters: { ...item.parameters, position: activeRheostatPreview.position } } : item) } : scene;
  const simulation = useElectricalSimulation(calculationScene, activeRheostatPreview ? `${activeRheostatPreview.id}:${activeRheostatPreview.position}` : '', !opticalMode && !mechanicalMode);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDocument | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [choosingExperiment, setChoosingExperiment] = useState(false);
  const [choosingOptical, setChoosingOptical] = useState(false);
  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[] | null>(null);
  const [libraryError, setLibraryError] = useState('');
  const [boardEpoch, setBoardEpoch] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const recordContent = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel>('记录表');
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const mechanicalSelection = mechanicalMode && selection?.kind === 'equipment' ? scene.equipment.find(item => item.id === selection.id) : undefined;
  const [placing, setPlacing] = useState<string | null>(null);
  const [connectionStart, setConnectionStart] = useState<Endpoint | null>(null);
  const [activeWireEnd, setActiveWireEnd] = useState<WireEndSelection | null>(null);
  const [wireColor, setWireColor] = useState('#126c63');

  useEffect(() => { if (recordContent.current) recordContent.current.scrollTop = 0; }, [panel, scene.documentId]);

  useEffect(() => {
    let cancelled = false;
    readSavedScene().then(text => {
      if (cancelled || text === null) return;
      const result = parseSceneJson(text, registry);
      if (!result.ok) { setError(`本地保存未加载：${result.message}`); return; }
      const restored = createHistory(result.document);
      historyRef.current = restored;
      setHistory(restored);
      setSavedSnapshot(JSON.stringify(result.document));
      setNotice('已恢复本地保存的实验；重载后从初态重新运行。');
    }).catch(reason => { if (!cancelled) setError(storageErrorMessage(reason)); })
      .finally(() => { if (!cancelled) setBooting(false); });
    return () => { cancelled = true; };
  }, []);

  function applyHistory(value: SceneHistory) {
    historyRef.current = value;
    setHistory(value);
  }

  function clearEditing() {
    setNutPreview(null);
    setMechanicalPreview(null);
    setProjectileMarksVisible(false);
    setLeverAuxiliary(false);
    setOpticalPreview(null);
    setOpticalAuxiliary(false);
    setFoldPreview(null);
    setReflectionAuxiliary(false);
    setRheostatPreview(null);
    setSelection(null);
    setPlacing(null);
    setConnectionStart(null);
    setActiveWireEnd(null);
    setBoardEpoch(value => value + 1);
  }

  function resetDocument() {
    projectile.reset();
    friction.reset();
    setNutPreview(null);
    setMechanicalPreview(null);
    setLeverAuxiliary(false);
    setOpticalPreview(null);
    setOpticalAuxiliary(false);
    setFoldPreview(null);
    setReflectionAuxiliary(false);
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
    setWireColor('#126c63');
  }

  function commit(command: SceneCommand): boolean {
    const result = executeCommand(historyRef.current, command, registry, new Date().toISOString());
    if (!result.ok) {
      setError(opticalMode && result.diagnostics[0]?.code === 'INVALID_EQUIPMENT_PARAMETERS' ? '光学属性无效：焦距须为 0.02～0.5 m，长度与孔径等须在模型范围内；原装置保持不变。' : editMessage(result.diagnostics[0]?.code ?? 'SCHEMA_INVALID'));
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
    projectile.reset();
    friction.reset();
    if (!pending) return;
    simulation.reset();
    applyHistory(createHistory(pending.document));
    setSavedSnapshot(pending.source === 'saved' ? JSON.stringify(pending.document) : null);
    clearEditing();
    setPanel('记录表');
    setWireColor('#126c63');
    setError('');
    setNotice('已加载实验；从初态重新运行，撤销历史已清空。');
    setPending(null);
  }

  function prepareExperiment(start: ExperimentStart) {
    const document = createLampCircuitExperiment(crypto.randomUUID(), new Date().toISOString(), start);
    if (document.viewport && window.innerWidth < 760) document.viewport.pixelsPerM = 320;
    setChoosingExperiment(false);
    setPending({ document, fromVersion: 2, source: 'experiment' });
  }

  function prepareOptical(empty: boolean) {
    const document = createOpticalExperiment(crypto.randomUUID(), new Date().toISOString(), empty);
    if (window.innerWidth < 760) document.viewport!.pixelsPerM = 240;
    setChoosingOptical(false);
    setPending({ document, fromVersion: 2, source: 'optical' });
  }

  function prepareReflection(empty: boolean) {
    const document = createReflectionExperiment(crypto.randomUUID(), new Date().toISOString(), empty);
    if (window.innerWidth < 760) document.viewport!.pixelsPerM = 280;
    setChoosingReflection(false);
    setPending({ document, fromVersion: 2, source: 'reflection' });
  }

  function changeFold(value: number) {
    setFoldPreview(null);
    const item = historyRef.current.present.equipment.find(item => item.type === PAPER);
    if (item) applyProperties(item.id, item.pose, { ...item.parameters, foldRad: value });
  }

  function alignReflection(type: string) {
    const current = historyRef.current.present, result = simulateReflection(current, registry), item = current.equipment.find(item => item.type === type);
    if (result.ok && item) applyProperties(item.id, { ...item.pose, xM: result.hit.x, yM: result.hit.y, rotationRad: result.mirror.pose.rotationRad }, item.parameters);
  }

  function orbitReflection(degrees: number) {
    const current = historyRef.current.present, mirror = current.equipment.find(item => item.type === MIRROR), emitter = current.equipment.find(item => item.type === EMITTER);
    if (!mirror || !emitter) return;
    const radius = Math.max(.2, Math.hypot(emitter.pose.xM - mirror.pose.xM, emitter.pose.yM - mirror.pose.yM)), angle = mirror.pose.rotationRad + degrees * Math.PI / 180;
    const direction = Math.atan2(-Math.sin(angle), -Math.cos(angle));
    applyProperties(emitter.id, { ...emitter.pose, xM: mirror.pose.xM + radius * Math.cos(angle), yM: mirror.pose.yM + radius * Math.sin(angle), rotationRad: direction }, emitter.parameters);
  }

  function captureReflection(input: ReflectionCapture): string | null {
    const built = buildReflectionMeasurements(historyRef.current.present, registry, input, `reflection-${crypto.randomUUID()}`, new Date().toISOString(), !!activeOpticalPreview || !!activeFoldPreview);
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限角度，空白记缺失；范围为 0～90°。' : '请完成摆放与折动，并检查装置、备注和组名后记录。';
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function chooseEquipment(value: string | null) {
    if (value && opticalMode && (scene.equipment.length || scene.experimentId) && reflectionTypes.includes(value) !== reflectionMode) {
      if (reflectionTypes.includes(value)) setChoosingReflection(true); else setChoosingOptical(true);
      setPlacing(null);
      return;
    }
    setPlacing(value); setConnectionStart(null); setActiveWireEnd(null);
  }

  function prepareProjectile(empty: boolean) {
    const document = createProjectileExperiment(crypto.randomUUID(), new Date().toISOString(), empty);
    if (window.innerWidth < 760) document.viewport!.pixelsPerM = 128;
    setChoosingProjectile(false);
    setPending({ document, fromVersion: 2, source: 'projectile' });
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

  function prepareSpring(empty: boolean) {
    const document = createSpringExperiment(crypto.randomUUID(), new Date().toISOString(), empty);
    if (window.innerWidth < 760) document.viewport!.pixelsPerM = 360;
    setChoosingSpring(false);
    setPending({ document, fromVersion: 2, source: 'spring' });
  }

  function captureSpring(input: SpringCapture): string | null {
    const built = buildSpringMeasurements(historyRef.current.present, registry, input, `spring-sample-${crypto.randomUUID()}`, new Date().toISOString(), !!activeMechanicalPreview);
    if (!built.ok) return built.code === 'INVALID_MANUAL_VALUE' ? '请输入有限读数，留空记缺失。' : springMessage(built.code);
    return measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
  }

  function prepareLever(empty: boolean) {
    const document = createLeverExperiment(crypto.randomUUID(), new Date().toISOString(), empty);
    if (window.innerWidth < 760) document.viewport!.pixelsPerM = 360;
    setChoosingLever(false);
    setPending({ document, fromVersion: 2, source: 'lever' });
  }

  function prepareFriction(empty: boolean) {
    const document = createFrictionExperiment(crypto.randomUUID(), new Date().toISOString(), empty);
    if (window.innerWidth < 760) document.viewport!.pixelsPerM = 180;
    setChoosingFriction(false); setPending({ document, fromVersion: 2, source: 'friction' });
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
    setPlacing(null);
    if (value?.kind === 'connection' && value.id !== activeWireEnd?.wireId) setActiveWireEnd(null);
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
    const built = buildElectricalMeasurements(historyRef.current.present, registry, simulation.acceptedReply, {
      ...entry, sampleId: `sample-${crypto.randomUUID()}`, timestamp: new Date().toISOString(),
      choices: entry.choices.map(choice => ({ ...choice, id: `record-${crypto.randomUUID()}` })),
    });
    if (!built.ok) return measurementMessage(built.code);
    const message = measurementCommand({ type: 'record-measurements', records: built.records, snapshot: built.snapshot });
    if (!message) {
      setRecordsExpanded(true);
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
    if (opticalMode && (scene.equipment.length || scene.experimentId) && reflectionTypes.includes(type) !== reflectionMode) { chooseEquipment(type); return; }
    if (type === WIRE) {
      const id = `wire-${crypto.randomUUID()}`;
      if (commit({ type: 'add-wire', id, point })) {
        setSelection({ kind: 'connection', id });
        setPlacing(null); setConnectionStart(null); setActiveWireEnd(null);
      }
      return;
    }
    const id = `item-${crypto.randomUUID()}`;
    if (commit({ type: 'add-equipment', equipmentType: type, id, point })) {
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
    const instance = mechanicalMode && !frictionMode && !springMode && !projectileMode ? mechanicalScene.equipment.find(item => item.id === id) : undefined;
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
    const instance = scene.equipment.find(item => item.id === id);
    if (instance && projectileMode) { commit({ type: 'update-equipment', id, ...projectileDrop(scene, instance, point) }); }
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
    const command: SceneCommand = springMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: detachedSpringUpdates(scene, ids, springScene) } : mechanicalMode && !projectileMode && !frictionMode && ids.length ? { type: 'remove-equipment-batch', ids, updates: detachedWeightUpdates(scene, ids, leverPresentationScene(scene, leverOutcome)) } : selection.kind === 'equipment-group' ? { type: 'remove-equipment-batch', ids: selection.ids }
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

  function viewport(value: Viewport) {
    applyHistory(setHistoryViewport(historyRef.current, value));
  }

  function cancelInteraction() {
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
    if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') || pending || renaming || choosingExperiment || choosingOptical || choosingReflection || savedExperiments || booting) return;
    if (event.key === 'Delete' && !event.ctrlKey && !event.metaKey && !event.altKey && selection && !busy) {
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
        <div><div className="document-title"><h1>{scene.title}</h1><button className="rename-button" aria-label="修改实验名称" disabled={booting || busy} onClick={() => setRenaming(true)}>修改名称</button></div><p>{reflectionMode ? '光的反射 · 共面探究' : projectileMode ? '平抛 · 高中定量探究' : springMode ? '弹簧 · 高中定量探究' : frictionMode ? '滑动摩擦 · 控制变量' : mechanicalMode ? '杠杆 · 自主探究' : opticalMode ? '凸透镜 · 自主探究' : scene.experimentId === LAMP_CIRCUIT_EXPERIMENT ? '灯泡串并联 · 自主探究' : '自由搭建'}<span className="separator">/</span><span data-testid="save-state">{booting ? '正在读取本地保存…' : savedSnapshot === JSON.stringify(scene) ? '已保存' : savedSnapshot === null ? '尚未保存' : '有未保存更改'}</span></p></div>
      </div>
      <div className="document-actions">
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingExperiment(true)}>灯泡串并联实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingReflection(true)}>光的反射定律实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingOptical(true)}>凸透镜成像实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingLever(true)}>杠杆平衡实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingFriction(true)}>滑动摩擦实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingSpring(true)}>弹簧弹力实验</button>
        <button className="experiment-entry-button" disabled={booting || busy} onClick={() => setChoosingProjectile(true)}>平抛运动实验</button>
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
      <EquipmentLibrary key={scene.documentId} registry={registry} domain={mechanicalMode ? 'mechanical' : opticalMode ? 'optical' : 'electrical'} locked={!!scene.experimentId || !!scene.equipment.length || !!scene.connections.length}
        onNewDomain={domain => { if (domain === 'mechanical') prepareLever(true); else if (domain === 'optical') prepareOptical(true); else setPending({ document: newDocument(), fromVersion: 2, source: 'experiment' }); }} placing={placing} onChoose={chooseEquipment} onDrop={drop}
        onCenter={() => { if (placing) { const view = scene.viewport ?? DEFAULT_VIEWPORT; place(placing, { xM: view.centerXM, yM: view.centerYM }); } }} />

      <SceneBoard key={`${scene.documentId}:${boardEpoch}`} scene={reflectionMode ? reflectionScene : projectileMode ? projectile.viewScene : springMode ? springScene : frictionMode ? friction.viewScene : nutScene} projectileMode={projectileMode} projectileFlight={projectile.flight} projectileMarks={projectileMarksVisible} springOutcome={springOutcome} frictionSample={friction.sample} registry={registry} selection={selection} placing={placing} start={connectionStart} wireColor={wireColor} activeWireEnd={activeWireEnd}
        reflectionOutcome={reflectionOutcome} opticalOutcome={opticalOutcome} opticalAuxiliary={opticalAuxiliary} onOpticalPreview={value => setOpticalPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null)}
        leverOutcome={leverOutcome} leverAuxiliary={leverAuxiliary} onMechanicalPreview={value => { if (frictionMode && value) friction.pause(); setMechanicalPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null); }}
        outcome={simulation.current} calculationStatus={reflectionMode ? '空间反射 · 自行量角与折板对照' : projectileMode ? '解析平抛 · 同一时间源 · 落地事件截断' : springMode ? '竖直静态弹簧 · 自行读尺与拟合' : frictionMode ? '水平一维摩擦 · 运行时刻不保存' : mechanicalMode ? '杠杆静力矩 · 先空载调平再挂载' : opticalMode ? '近轴光学 · 自行调高与找焦' : simulation.status} onToggleSwitch={toggleSwitch} onRheostatChange={changeRheostat} onRheostatPreview={previewRheostat}
        undoLabel={history.undo.at(-1)?.label ?? null} redoLabel={history.redo.at(-1)?.label ?? null} onUndo={() => travel('undo')} onRedo={() => travel('redo')}
        onSelect={select} onPort={connect} onPlace={place} onMove={move} onRoute={route} onWireChange={reshapeWire} onWireEnd={chooseWireEnd} onViewport={viewport} onCancel={cancelInteraction} onNotice={setNotice} />

      <aside className="panel inspector" aria-labelledby="inspector-title">
        <div className="panel-heading"><h2 id="inspector-title">属性与诊断</h2></div>
        {scene.experimentId === LAMP_CIRCUIT_EXPERIMENT && <LampCircuitGuide key={scene.documentId} onRecord={() => { setPanel('记录表'); setRecordsExpanded(true); recordContent.current?.scrollTo(0, 0); }} />}
        {reflectionOutcome ? <ReflectionPanel key={scene.documentId} scene={reflectionScene} outcome={reflectionOutcome} auxiliary={reflectionAuxiliary} onAuxiliary={setReflectionAuxiliary} preview={!!activeOpticalPreview || !!activeFoldPreview} onFoldPreview={value => setFoldPreview(value === null ? null : { value, documentId: scene.documentId, revision: scene.revision })} onFold={changeFold} onAlign={alignReflection} onOrbit={orbitReflection} /> : projectileMode ? <ProjectilePanel key={scene.documentId} scene={scene} simulation={projectile} marks={projectileMarksVisible} onMarks={setProjectileMarksVisible} onHeight={projectileHeight} onLevel={levelProjectile} /> : springOutcome ? <SpringPanel key={scene.documentId} outcome={springOutcome} preview={!!activeMechanicalPreview} gravity={scene.simulationConfig.gravityMPerS2} /> : frictionMode ? <FrictionPanel key={scene.documentId} scene={scene} simulation={friction} onUpdate={updateFriction} /> : leverOutcome ? <LeverPanel scene={scene} outcome={leverOutcome} auxiliary={leverAuxiliary} onAuxiliary={setLeverAuxiliary} onZero={zeroLever} preview={!!activeMechanicalPreview || !!activeNutPreview} movingEquipment={!!activeMechanicalPreview} onNutPreview={value => setNutPreview(value ? { ...value, documentId: scene.documentId, revision: scene.revision } : null)} onNutChange={changeNut} /> : opticalOutcome ? <OpticalPanel outcome={opticalOutcome} auxiliary={opticalAuxiliary} onAuxiliary={setOpticalAuxiliary} preview={!!activeOpticalPreview} /> : <SimulationPanel scene={scene} outcome={simulation.current} running={simulation.running} status={simulation.status} onStart={simulation.start} onPause={simulation.pause} onReset={simulation.reset} />}
        {frictionMode && mechanicalSelection && <FrictionAssembly key={`${mechanicalSelection.id}:${scene.revision}`} scene={scene} instance={mechanicalSelection} onUpdate={updateFriction} onPlace={placeOnFrictionSurface} />}
        {springMode && mechanicalSelection && <SpringAssembly key={`${mechanicalSelection.id}:${scene.revision}`} scene={scene} instance={mechanicalSelection} onAttach={parameters => commit({ type: 'update-equipment', id: mechanicalSelection.id, pose: mechanicalSelection.pose, parameters })} />}
        {projectileMode && mechanicalSelection?.type === PROJECTILE_BALL && <section className="projectile-panel"><h3>下次小球装配</h3><label>小球装入发射器<select aria-label="小球装入发射器" value={String(mechanicalSelection.parameters.launcherId ?? '')} onChange={event => applyProperties(mechanicalSelection.id, mechanicalSelection.pose, { ...mechanicalSelection.parameters, launcherId: event.target.value })}><option value="">未装入</option>{scene.equipment.filter(item => item.type === PROJECTILE_LAUNCHER).map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><p>可把小球拖到枪口附近装入；参数立即配置到下次初态，本次飞行中的小球不接受拖动。</p></section>}
        {!projectileMode && !springMode && !frictionMode && mechanicalSelection && <LeverAttachment key={`${mechanicalSelection.id}:${scene.revision}`} scene={scene} instance={mechanicalSelection} onAttach={parameters => { commit({ type: 'update-equipment', id: mechanicalSelection.id, pose: mechanicalSelection.pose, parameters }); }} />}
        <InspectorEditor scene={springMode ? springScene : mechanicalMode ? mechanicalScene : scene} registry={registry} selection={selection} start={connectionStart} wireColor={wireColor} onSelect={select} activeWireEnd={activeWireEnd}
          onPort={connect} onApply={applyProperties} onRemove={removeSelected} onRoute={changeRoute} onWireEnd={chooseWireEnd} onDetachEnd={detachWireEnd} onColor={setWireColor} onFlip={flipEquipment} />
        {!opticalMode && !mechanicalMode && <div className="config-section"><span className="eyebrow">当前模型设定</span><dl>
          <div><dt>电学模式</dt><dd>理想源 · 电表按器材参数</dd></div><div><dt>重力加速度</dt><dd>{scene.simulationConfig.gravityMPerS2} m/s²</dd></div><div><dt>随机误差</dt><dd>{scene.simulationConfig.randomError.enabled ? '配置启用，本阶段未施加' : '关闭'}</dd></div>
        </dl><p className="config-note">重力加速度为可配置的教学值。</p></div>}
        <div className="diagnostic-empty"><h3>操作诊断</h3><p role={error ? 'alert' : undefined}>{error || (reflectionMode ? '移动/转动光源瞄准镜面，分别校准纸板、量角器与法线；从法线读角，折板做共面对照。' : projectileMode ? '调平发射器，将小球装入；发射后暂停或单步，再用计时器和二维标尺读数。' : springMode ? '弹簧安装到支架，钩码挂到弹簧下端；独立尺竖直向下摆放，超限请减载。' : mechanicalMode ? '拖到挂点或在挂接区选择支架/杠杆；改变支点或自重后重新空载调平。' : opticalMode ? '拖动或输入位置与光心高度；光屏不自动对焦。' : scene.equipment.length || scene.connections.length ? '拖动线头接到接线柱；未接线头不导通，多线可共用接线柱。尚未求解电路。' : '当前没有待检查的装置。')}</p></div>
      </aside>

      <section className={`panel records ${recordsExpanded ? 'is-expanded' : ''}`} aria-label="实验记录与分析">
        <div className="records-header"><div className="record-tabs" role="tablist" aria-label="记录面板">
          {panels.map((name, index) => <button key={name} role="tab" id={`tab-${index}`} aria-selected={panel === name}
            aria-controls={`panel-${index}`} tabIndex={panel === name ? 0 : -1} onClick={() => setPanel(name)}
            onKeyDown={event => movePanel(event, index)}>{name}</button>)}
        </div><div className="record-header-actions"><span className="record-count">{scene.measurementRecords.length} 条记录</span><button onClick={() => setRecordsExpanded(value => !value)}>{recordsExpanded ? '收起记录区' : '展开记录区'}</button></div></div>
        <div ref={recordContent} className={`record-content ${panel !== '模型说明' ? 'records-data-view' : ''}`} role="tabpanel" id={`panel-${panels.indexOf(panel)}`} aria-labelledby={`tab-${panels.indexOf(panel)}`} tabIndex={0}>
          <div hidden={panel !== '记录表'}>{reflectionMode && <ReflectionRecords key={`reflection-records:${scene.documentId}`} scene={scene} ready={!!reflectionOutcome?.ok && !activeOpticalPreview && !activeFoldPreview} onCapture={captureReflection} />}{projectileMode && <ProjectileRecords key={`projectile-records:${scene.documentId}`} scene={scene} registry={registry} flight={projectile.flight} ready={!!projectile.flight && !projectile.running && !activeMechanicalPreview} onCapture={captureProjectile} />}{springMode && <SpringRecords key={`spring-records:${scene.documentId}`} scene={scene} registry={registry} ready={!!springOutcome?.ok && !activeMechanicalPreview} onCapture={captureSpring} />}{frictionMode && <FrictionRecords key={`friction-records:${scene.documentId}`} ready={!!friction.sample?.ok && friction.state.timeS > 0 && !activeMechanicalPreview} onCapture={captureFriction} />}{leverOutcome && <LeverRecords key={`lever-records:${scene.documentId}`} scene={scene} outcome={leverOutcome} ready={leverOutcome.ok && leverOutcome.calibrated && !activeMechanicalPreview && !activeNutPreview} onCapture={captureLever} />}{opticalMode && !reflectionMode && <OpticalRecords key={`optical-records:${scene.documentId}`} scene={scene} ready={!!opticalOutcome?.ok && !activeOpticalPreview} onCapture={captureOptical} />}<MeasurementPanel key={`measurements:${scene.documentId}`} scene={scene} registry={registry} ready={!!simulation.acceptedReply} entryEnabled={!opticalMode && !mechanicalMode}
            onCapture={captureMeasurements} onCorrect={(id, rawInput) => measurementCommand({ type: 'correct-measurement', id, rawInput })}
            onRemove={id => { measurementCommand({ type: 'remove-measurement', id }); }} onExport={exportMeasurements} /></div>
          <div hidden={panel !== '图线'}>{projectileMode ? <ProjectileChart scene={scene} /> : springMode ? <SpringChart scene={scene} /> : <MeasurementChart key={scene.documentId} scene={scene} profiles={reflectionMode ? reflectionProfiles : frictionMode ? [{ id: 'friction-f-n', label: '滑动摩擦力—压力（稳态）', available: true, x: { quantity: 'force', unit: 'N', label: '压力（N）', pointLabel: '压力' }, y: { quantity: 'force', unit: 'N', label: '滑动摩擦力（N）', pointLabel: '滑动摩擦力' } }] : mechanicalMode ? [{ id: 'lever-torque', label: '多组力矩比较（手工计算）', available: true, x: 'sample', y: { quantity: 'torque', unit: 'N·m', label: '有符号力矩（N·m）' } }, { id: 'lever-force', label: '多组拉力比较', available: true, x: 'sample', y: { quantity: 'force', unit: 'N', label: '力（N）' } }] : opticalMode ? [{ id: 'optical-distance', label: '屏距—物距（手工读尺）', available: true, x: { quantity: 'length', unit: 'm', label: '物距 u（m）', pointLabel: '物距u' }, y: { quantity: 'length', unit: 'm', label: '屏距 s（m，非自动像距）', pointLabel: '屏距s' } }, { id: 'optical-image', label: '实测像距—物距（清晰实像）', available: true, x: { quantity: 'length', unit: 'm', label: '物距 u（m）', pointLabel: '物距u' }, y: { quantity: 'length', unit: 'm', label: '实测像距 v（m）', pointLabel: '像距v' } }] : undefined} />}</div>
          {panel === '模型说明' && reflectionMode && <div className="model-description"><h3>光的反射与共面证据</h3><p>空间单位方向按 r=d−2(d·n)n 反射，入射角和反射角均从镜面法线量起。两片纸板为有限空间承接面，右板绕法线折轴转动；光线离开纸板时只有交点，没有连续光迹，光的方向仍保持。正入射沿轴是退化对照，不能证明共面。</p><p>量角器分度 1°，学生记录独立于理论，存储/图线/CSV 使用 SI rad。单镜单束，无衍射、散射亮度或厚光束，非校准状态不输出正常角度记录。</p></div>}
          {panel === '模型说明' && opticalMode && !reflectionMode && <div className="model-description"><h3>近轴薄透镜与离焦</h3><p>光屏由多物点、圆孔径采样光线落点形成连续光斑；三心偏移会使像移位或离屏。虚像仅在辅助观察中显示，u=f 无有限像。理论辅助可关闭，不自动找焦或填入学生记录；不模拟衍射、像差及真实照明。</p></div>}
          {panel === '模型说明' && frictionMode && <div className="model-description"><h3>水平一维静/滑摩擦</h3><p>静摩擦按需匹配至 μsN，滑动摩擦与速度反向；N=mg，牵引力与摩擦力只在滑动稳态时等大。自研模型负责轨迹和力，Matter.js 同步静态表示与接触，不重复积分。面积对照保持质量/材料不变，采用干摩擦近似；非稳态数据保留标签，不作为 F–N 有效图点。</p></div>}
          {panel === '模型说明' && springMode && <div className="model-description"><h3>竖直无质量理想弹簧</h3><p>静态 F=(钩码质量+盘质量)g=kΔx；L=L0+Δx。原长须在无载时读尺，总长由两端读数相减。范围外无正常长度/采样，不计算振动、阻尼或塑性变形；图线和最小二乘拟合只用学生有效记录。教材映射待教师核验。</p></div>}
          {panel === '模型说明' && projectileMode && <div className="model-description"><h3>质点平抛与同源计时</h3><p>无空气阻力、恒定重力，x=x0+v0t、y=y0−gt²/2，ydrop=y0−y。计时、小球、等时标记和采样共用本次时间，帧跨落地也准确截断；本次初态冻结，编辑只配置下一次。尺读数与理论分开，至少三组有效时间才作记录拟合；保存后重载从初态准备，教材映射待教师核验。</p></div>}
          {panel === '模型说明' && mechanicalMode && !projectileMode && !springMode && !frictionMode && <div className="model-description"><h3>杠杆力矩与约束</h3><p>从挂点和方向计算 r×F、作用线垂距及支点反力。先空载调平，后挂载不再抵消外力矩；失衡仅提示趋势。自重可选、仪器超量程明确提示；理论辅助默认关闭，不自动改挂点或拉力。手工力矩由当组输入的力与力臂计算。</p></div>}
          {panel === '模型说明' && !opticalMode && !mechanicalMode && <div className="model-description"><h3>理想模型与测量</h3><p>{simulation.current ? '当前使用准静态直流模型：灯泡 U=Rcold·I+a·I³，亮度由耗散功率映射，不模拟热惯性或真实烧毁。电表按实际量程端接线，按分度值显示。' : '当前未加载领域模型。放置器材并接线后自动计算，开关和参数变化会更新效果；仪器示数不会自动填入学生记录。'}</p><p>物理计算使用 SI 单位；理论值、仪器示数与手工记录分别保存。</p></div>}
        </div>
      </section>
    </main>
    <footer className="app-footer"><span>本地保存仅限当前浏览器；重载从实验初态重新运行。</span><span>初中 · 高中物理</span></footer>
    {pending && <DocumentPreview pending={pending} onConfirm={confirmReplacement} onCancel={() => setPending(null)} />}
    {choosingExperiment && <LampCircuitStart onChoose={prepareExperiment} onCancel={() => setChoosingExperiment(false)} />}
    {choosingReflection && <ReflectionStart onChoose={prepareReflection} onCancel={() => setChoosingReflection(false)} />}
    {choosingOptical && <OpticalStart onChoose={prepareOptical} onCancel={() => setChoosingOptical(false)} />}
    {choosingProjectile && <ProjectileStart onChoose={prepareProjectile} onCancel={() => setChoosingProjectile(false)} />}
    {choosingSpring && <SpringStart onChoose={prepareSpring} onCancel={() => setChoosingSpring(false)} />}
    {choosingFriction && <FrictionStart onChoose={prepareFriction} onCancel={() => setChoosingFriction(false)} />}
    {choosingLever && <LeverStart onChoose={prepareLever} onCancel={() => setChoosingLever(false)} />}
    {renaming && <RenameExperiment title={scene.title} onRename={title => commit({ type: 'rename', title })} onCancel={() => setRenaming(false)} />}
    {savedExperiments && <SavedExperiments entries={savedExperiments} busy={busy} error={libraryError} onChoose={id => void chooseSavedDocument(id)} onDelete={deleteSavedDocument} onCancel={() => setSavedExperiments(null)} />}
    <div className="live-notice" role="status">{notice}</div>
  </div>;
}
