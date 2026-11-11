'use client';

import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { NavigationGraph, Point, RouteResult } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { coincidenceClusters, controls, deleteControls, exportConfig, inside, moveGraphNodes, nextCoincidenceMember, pointSegmentDistance, propagateSourceLinks, rectangleSelection, selectionStats, translate, type CoincidenceCluster, type Control, type NodeMoves, type Report, type Session, type Settings, type Spine } from './editor-model';
import './editor.css';

type Layer = { name: string; visible: boolean; locked: boolean; selectable: boolean; color: string };
type Mode = 'Select' | 'Multi-select' | 'Move' | 'Lasso' | 'Draw corridor' | 'Add node' | 'Measure clearance';
type Frame = { spines: Spine[]; nodeMoves: NodeMoves; deletedNodes: string[]; label: string };
type Gesture = { kind: 'move' | 'node-move' | 'box' | 'lasso' | 'pan'; start: Point; current: Point; path: Point[]; selected: Set<string>; view: number[]; additive: boolean };
const layerDefaults: Layer[] = [
  { name: 'Room entrances', color: '#c97525', visible: true, locked: false, selectable: true },
  { name: 'Corridor centerlines', color: '#007d91', visible: true, locked: false, selectable: true },
  { name: 'Junction nodes', color: '#955fac', visible: true, locked: false, selectable: true },
  { name: 'Navigation edges', color: '#4475b8', visible: true, locked: true, selectable: true },
  { name: 'Room boundaries', color: '#bc7165', visible: false, locked: true, selectable: true },
  { name: 'Building boundaries (unavailable)', color: '#ad823d', visible: false, locked: true, selectable: false },
  { name: 'Walkable areas', color: '#50a88d', visible: false, locked: true, selectable: true },
  { name: 'Diagnostic geometry / walls', color: '#bb3845', visible: false, locked: true, selectable: false },
];
const protectedLayerIndices = new Set([3, 4, 5, 6, 7]);
const pointsString = (points: Point[]) => points.map(p => p.join(',')).join(' ');
const fmt = (value: number | undefined) => value === undefined || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(3);
async function api(floorId: 'GF' | '01', action: string, body: Record<string, unknown>) {
  const response = await fetch('/api/admin/navigation', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Navigation-Editor': '1' }, body: JSON.stringify({ floorId, action, ...body }) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
function sessionFromResponse(data: unknown, floorId: 'GF' | '01'): Session {
  if (floorId === 'GF') return data as Session;
  const workerSession = data as Partial<Session> & { evidence?: unknown };
  return {
    ...workerSession,
    evidence: Array.isArray(workerSession.evidence) ? workerSession.evidence : [],
    runtimeGraph: workerSession.runtimeGraph || workerSession.graph!,
    config: workerSession.config || { reviewedSpineOverrides: [], reviewedConnections: [] },
  } as Session;
}

const Architecture = memo(function Architecture({ session, layers }: { session: Session; layers: Layer[] }) {
  const [x, y, width, height] = session.floor.floor.viewBox;
  return <g pointerEvents="none">
    <image href={session.floor.floor.mapAsset} x={x} y={y} width={width} height={height} preserveAspectRatio="none" opacity=".68" />
    {layers[6].visible && session.graph.navigableAreas.map((ring, i) => <polygon key={i} points={pointsString(ring)} fill={layers[6].color} fillOpacity=".13" stroke={layers[6].color} strokeWidth=".45" />)}
    {layers[4].visible && session.floor.rooms.map(room => { const polygon = room.polygon || room.displayFootprint?.polygon; return polygon ? <polygon key={room.id} points={pointsString(polygon)} fill={layers[4].color} fillOpacity=".12" stroke={layers[4].color} strokeWidth=".8" /> : null; })}
    {layers[7].visible && <path d={session.graph.walls.map(([a, b]) => `M${a}L${b}`).join('')} fill="none" stroke={layers[7].color} strokeWidth=".8" />}
  </g>;
});

export default function NavigationEditor({ floorId = 'GF' }: { floorId?: 'GF' | '01' }) {
  const [session, setSession] = useState<Session | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]), [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [nodeSelection, setNodeSelection] = useState<Set<string>>(new Set());
  const [clusterCursor, setClusterCursor] = useState<Record<string, string>>({});
  const [inspect, setInspect] = useState<string | null>(null);
  const [layers, setLayers] = useState(layerDefaults), [mode, setMode] = useState<Mode>('Select');
  const [view, setView] = useState([650, 500, 3100, 1550]);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null), svg = useRef<SVGSVGElement>(null), space = useRef(false);
  const [grid, setGrid] = useState(0), [nudge, setNudge] = useState(1);
  const [dx, setDx] = useState(0), [dy, setDy] = useState(0);
  const [spineFilter, setSpineFilter] = useState(''), [roomFilter, setRoomFilter] = useState(''), [typeFilter, setTypeFilter] = useState('all');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [settings, setSettings] = useState<Settings>({ minimum: 0, preferred: 5, maximum: 100 });
  const [report, setReport] = useState<Report | null>(null), [live, setLive] = useState<Report | null>(null);
  const [reportKey, setReportKey] = useState(''), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading source configuration and architectural evidence...');
  const [compare, setCompare] = useState(true), [split, setSplit] = useState(false);
  const [routeStart, setRouteStart] = useState('B03-GF-G-35'), [routeEnd, setRouteEnd] = useState('B03-GF-G-01');
  const [routes, setRoutes] = useState<{ original: RouteResult; edited: RouteResult; key: string } | null>(null);
  const [accessible, setAccessible] = useState(false), [candidate, setCandidate] = useState('');
  const [savedRouteNotice, setSavedRouteNotice] = useState(false);
  const [showNearbyWalls, setShowNearbyWalls] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true), [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [connectionStart, setConnectionStart] = useState(''), [connectionEnd, setConnectionEnd] = useState('');
  const [connectionEvidence, setConnectionEvidence] = useState(''), [connectionNote, setConnectionNote] = useState('');
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const floor01 = floorId === '01';
  const graphEditing = !floor01;
  const spines = frames[cursor]?.spines || [];
  const nodeMoves = frames[cursor]?.nodeMoves || {};
  const deletedNodes = frames[cursor]?.deletedNodes || [];
  const deletedNodeSet = new Set(deletedNodes);
  const draftKey = JSON.stringify({ spines, nodeMoves, deletedNodes, settings });
  const sourceChanged = session ? JSON.stringify(spines) !== JSON.stringify(session.spines) : false;
  const changed = sourceChanged || Object.keys(nodeMoves).length > 0 || deletedNodes.length > 0;
  const editable = layers[1].visible && !layers[1].locked && layers[1].selectable;
  const editableIds = new Set(controls(spines).filter(c => editable).map(c => c.id));
  const selectedIds = new Set([...selection].filter(id => editableIds.has(id)));
  const delta: Point = gesture?.kind === 'move' ? [gesture.current[0] - gesture.start[0], gesture.current[1] - gesture.start[1]] : [0, 0];
  const preview = gesture?.kind === 'move' ? translate(spines, gesture.selected, delta, grid) : spines;
  const selected = controls(preview).filter(c => selection.has(c.id));
  const stats = selectionStats(selected);
  const baseGraph = reportKey === draftKey && report?.graph ? report.graph : session?.graph;
  const gestureNodeMoves = gesture?.kind === 'node-move'
    ? Object.fromEntries([...gesture.selected].map(id => {
      const point = baseGraph?.nodes.find(node => node.id === id)?.point || [0, 0];
      const current = nodeMoves[id] || point;
      return [id, [current[0] + delta[0], current[1] + delta[1]] as Point];
    }))
    : {};
  const evidence = reportKey === draftKey && report?.report ? report.report.edgeEvidence : session?.evidence;
  const sourceGraph = baseGraph && session ? propagateSourceLinks(baseGraph, session.spines, preview, evidence || session.evidence) : baseGraph;
  const propagatedMoves = baseGraph && sourceGraph ? Object.fromEntries(sourceGraph.nodes.filter(node => baseGraph.nodes.find(original => original.id === node.id)?.point.some((value, index) => value !== node.point[index])).map(node => [node.id, node.point])) : {};
  const movedGraph = sourceGraph ? moveGraphNodes(sourceGraph, { ...propagatedMoves, ...nodeMoves, ...gestureNodeMoves }) : undefined;
  const graph = movedGraph ? { ...movedGraph, nodes: movedGraph.nodes.filter(n => !deletedNodeSet.has(n.id)), edges: movedGraph.edges.filter(e => !deletedNodeSet.has(e.from) && !deletedNodeSet.has(e.to)) } : undefined;
  const isGraphCurrent = !changed || (reportKey === draftKey && !!report?.graph);
  const edge = graph?.edges.find(e => e.id === inspect), node = graph?.nodes.find(n => n.id === inspect);
  const edgeEvidence = evidence?.find(e => e.edgeId === inspect);
  const visibleControls = controls(preview).filter(c => (!spineFilter || c.spine === spineFilter) && (typeFilter === 'all' || typeFilter === 'control') && (!roomFilter || evidence?.some(e => e.sourceSpineIds.includes(preview.find(s => s.id === c.spine)!.index) && graph?.edges.some(g => g.id === e.edgeId && [g.from, g.to].some(id => graph.nodes.find(n => n.id === id)?.roomId === roomFilter)))));
  const filteredNodes = graph?.nodes.filter(n => (!roomFilter || n.roomId === roomFilter)
    && (typeFilter === 'all' || typeFilter === 'room' && !!n.roomId || typeFilter === 'junction' && !n.roomId)
    && (connectionFilter === 'all' || graph.edges.some(e => e.from === n.id || e.to === n.id) === (connectionFilter === 'connected')));
  const visibleHandles = [
    ...(layers[1].visible ? visibleControls.map(c => ({ id: c.id, kind: 'source' as const, point: c.point })) : []),
    ...(filteredNodes || []).filter(n => (n.roomId ? layers[0].visible : layers[2].visible)).map(n => ({ id: n.id, kind: 'graph' as const, point: n.point })),
  ];
  const handleClusters = coincidenceClusters(visibleHandles);

  useEffect(() => {
    const controller = new AbortController();
    setSession(null); setFrames([]); setCursor(0); setSelection(new Set()); setNodeSelection(new Set());
    setInspect(null); setReport(null); setLive(null); setReportKey(''); setRoutes(null);
    setCandidate(''); setSavedRouteNotice(false); setDrawPoints([]); setClusterCursor({});
    setMessage(`Loading Floor ${floorId} source configuration and architectural evidence...`);
    fetch(`/api/admin/navigation?floorId=${floorId}`, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return sessionFromResponse(data, floorId); }).then(data => {
      if (controller.signal.aborted) return;
      setSession(data); setFrames([{ spines: data.spines, nodeMoves: {}, deletedNodes: [], label: 'Loaded source configuration' }]); setView(data.floor.floor.viewBox);
      setRouteStart(data.floor.rooms[0]?.id || '');
      setRouteEnd(data.floor.rooms[1]?.id || data.floor.rooms[0]?.id || '');
      setMessage(floor01
        ? 'Floor 01 source spine editor ready. Room approaches and derived graph are read-only; edits remain a draft until reviewed.'
        : 'Ready. Drag graph nodes or any corridor point, including endpoints. Unsafe geometry remains previewable.');
    }).catch(error => { if (!controller.signal.aborted) setMessage(String(error)); });
    return () => controller.abort();
  }, [floorId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (changed) event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [changed]);

  function commit(next: Spine[], label: string, nextNodeMoves = nodeMoves, nextDeletedNodes = deletedNodes) {
    if (busy || JSON.stringify(next) === JSON.stringify(spines) && JSON.stringify(nextNodeMoves) === JSON.stringify(nodeMoves) && JSON.stringify(nextDeletedNodes) === JSON.stringify(deletedNodes)) return;
    setFrames([...frames.slice(0, cursor + 1), { spines: next, nodeMoves: nextNodeMoves, deletedNodes: nextDeletedNodes, label }]); setCursor(cursor + 1);
  }
  function move(x: number, y: number) { commit(translate(spines, selectedIds, [x, y], grid), `Translate ${selectedIds.size} controls (${x}, ${y})`); }
  function moveSelectedNodes(x: number, y: number, moves = nodeMoves) {
    if (!graphEditing || !baseGraph || !nodeSelection.size) return;
    const next = { ...moves };
    for (const id of nodeSelection) {
      const original = baseGraph.nodes.find(n => n.id === id)?.point;
      if (original) {
        const point = moves[id] || original;
        next[id] = [point[0] + x, point[1] + y];
      }
    }
    commit(spines, `Move ${nodeSelection.size} graph node${nodeSelection.size === 1 ? '' : 's'} (${x}, ${y})`, next);
  }
  function remove() {
    const nextDeleted = graphEditing ? [...new Set([...deletedNodes, ...nodeSelection])] : deletedNodes;
    const parts = [selectedIds.size ? `${selectedIds.size} source controls` : '', nodeSelection.size ? `${nodeSelection.size} graph nodes` : ''].filter(Boolean);
    commit(deleteControls(spines, selectedIds), `Delete ${parts.join(' and ') || 'selection'}`, graphEditing ? nodeMoves : {}, nextDeleted);
    setSelection(new Set()); setNodeSelection(new Set()); setInspect(null);
  }
  function undo() { if (!busy) { setCursor(Math.max(0, cursor - 1)); setSelection(new Set()); setNodeSelection(new Set()); } }
  function redo() { if (!busy) { setCursor(Math.min(frames.length - 1, cursor + 1)); setSelection(new Set()); setNodeSelection(new Set()); } }
  function selectAll() { setSelection(new Set(visibleControls.filter(c => editableIds.has(c.id)).map(c => c.id))); setNodeSelection(new Set(graphEditing ? filteredNodes?.map(n => n.id) || [] : [])); setInspect(null); }
  function chooseCluster(cluster: CoincidenceCluster) {
    const member = nextCoincidenceMember(cluster, clusterCursor[cluster.id]);
    setClusterCursor({ ...clusterCursor, [cluster.id]: member.id });
    if (member.kind === 'source') { setSelection(new Set([member.id])); setNodeSelection(new Set()); setInspect(null); }
    else { setNodeSelection(new Set([member.id])); setSelection(new Set()); setInspect(member.id); }
    setMessage(`Coincident handle: selected ${member.id}. Activate again to cycle ${cluster.members.length} members.`);
  }
  function beginClusterGesture(event: ReactPointerEvent<SVGGElement>, cluster: CoincidenceCluster) {
    event.stopPropagation();
    const member = nextCoincidenceMember(cluster, clusterCursor[cluster.id]);
    setClusterCursor({ ...clusterCursor, [cluster.id]: member.id });
    if (member.kind === 'source') {
      if (!editable || !editableIds.has(member.id)) return;
      setSelection(new Set([member.id])); setNodeSelection(new Set()); setInspect(null);
      const next: Gesture = { kind: 'move', start: cluster.point, current: cluster.point, path: [cluster.point], selected: new Set([member.id]), view, additive: false };
      gestureRef.current = next; setGesture(next);
    } else {
      const graphNode = graph?.nodes.find(n => n.id === member.id);
      if (floor01) {
        setSelection(new Set()); setNodeSelection(new Set()); setInspect(member.id);
        setMessage(`Read-only room approach or derived node: ${member.id}. Edit its source corridor spine instead.`);
        return;
      }
      const layer = graphNode?.roomId ? layers[0] : layers[2];
      if (!graphNode || !layer?.selectable || layer.locked) { setInspect(member.id); setNodeSelection(new Set([member.id])); return; }
      setNodeSelection(new Set([member.id])); setSelection(new Set()); setInspect(member.id);
      const next: Gesture = { kind: 'node-move', start: cluster.point, current: cluster.point, path: [cluster.point], selected: new Set([member.id]), view, additive: false };
      gestureRef.current = next; setGesture(next);
    }
    svg.current?.setPointerCapture(event.pointerId);
    setMessage(`Coincident handle: selected ${member.id}. Drag to move this member independently.`);
  }
  async function run(action: 'reconstruct' | 'preview' | 'draft' | 'save' | 'candidate') {
    if (!session || busy) return;
    setBusy(true); setMessage(action === 'preview' ? 'Generating an isolated admin preview; checks will be reported but will not block the preview...' : action === 'draft' ? 'Saving visual preview draft only...' : 'Reconstructing and validating source spines...');
    try {
      const effectiveGraph = floor01 ? session.graph : propagateSourceLinks(session.graph, session.spines, spines, session.evidence);
      const linkedMoves = Object.fromEntries(effectiveGraph.nodes.filter(node => session.graph.nodes.find(original => original.id === node.id)?.point.some((value, index) => value !== node.point[index])).map(node => [node.id, node.point]));
      const response = await api(floorId, action, { revision: session.revision, spines, ...(floor01 ? {} : { nodeMoves: { ...linkedMoves, ...nodeMoves }, deletedNodes, settings }) });
      const result: Report = floor01 ? {
        ...response,
        valid: false,
        draftOnly: true,
        safetyChecked: false,
        diagnostics: (response.diagnostics || []).map((diagnostic: { kind?: string; count?: number; id?: string }) => ({
          id: diagnostic.id || diagnostic.kind || 'floor-01-preview',
          changed: (diagnostic.count || 0) > 0,
          state: 'unchecked' as const,
          wallClearance: null,
          walkableBoundaryClearance: null,
          nearbyWallIndices: [],
          tests: null,
        })),
        changes: response.changes || [],
        errors: response.errors || [],
      } : response;
      setReport(result); setReportKey(draftKey);
      if (action !== 'draft') setLive(result);
      const rejected = result.diagnostics.filter(d => d.changed && d.tests && !d.tests.safe).map(d => d.id);
      const details = [
        rejected.length ? `Geometry diagnostics: ${rejected.join(', ')}` : '',
        result.unattachedSupportedRooms?.length ? `Room approaches lost: ${result.unattachedSupportedRooms.join(', ')}` : '',
        result.requiredRouteFailures?.length ? `Required routes disconnected: ${result.requiredRouteFailures.map(pair => pair.join(' ↔ ')).join(', ')}` : '',
        (result.errors?.[0] as { validationFailures?: string[] } | undefined)?.validationFailures?.length
          ? `Graph diagnostics: ${(result.errors[0] as { validationFailures: string[] }).validationFailures.join(', ')}` : '',
      ].filter(Boolean).join('. ');
      setMessage(action === 'draft' && result.candidate
        ? `Preview draft ${result.candidate} saved. Geometry was not checked; this does not change navigation. Use Run in admin to inspect it, or keep editing and save another draft.`
        : action === 'preview'
          ? result.previewError
            ? `Edited source line remains visible in admin preview, but graph reconstruction stopped at a safety check: ${result.previewError} The saved draft is unchanged; edit again or restore a previous draft.`
            : `Admin preview generated. It is isolated and not saved to navigation; checks are informational only. ${details || 'Inspect the generated line and test its route.'}`
        : action === 'candidate' && result.candidate
        ? `Visual-only candidate ${result.candidate} saved. It is not a routable graph and did not change source config or navigation. ${details ? `${details}. ` : ''}Restore it later to continue editing.`
          : result.valid
          ? result.saved ? 'Saved source overrides and replaced the runtime GF graph. Graph node moves/deletions were applied; geometry findings are diagnostic. Backup created.' : 'Graph reconstructed; review diagnostics.'
          : `Reconstruction completed with diagnostics; the edited graph remains available for review. ${details || 'Inspect the connectivity report.'}${result.lostRoomPairs?.length ? ` ${result.lostRoomPairs.length} other room-pair connections changed; see the report.` : ''}`);
      if (result.candidate) setSession(s => s ? { ...s, candidates: [...new Set([...s.candidates, result.candidate!])] } : s);
      if (result.saved && result.graph && result.revision) {
        // A source rebuild may regenerate junction IDs. Rebase the editor
        // history to the returned graph so a subsequent build cannot submit
        // moves/deletions for nodes that no longer exist. Only IDs present in
        // the rebuilt graph are retained; no edit is transferred by position.
        const graphIds = new Set(result.graph.nodes.map(node => node.id));
        const currentMoves = Object.fromEntries(Object.entries(nodeMoves).filter(([id]) => graphIds.has(id)));
        const currentDeleted = deletedNodes.filter(id => graphIds.has(id));
        setFrames([{ spines, nodeMoves: currentMoves, deletedNodes: currentDeleted, label: 'Loaded rebuilt source graph' }]);
        setCursor(0);
        setSelection(new Set());
        setNodeSelection(new Set());
        setSession(s => s ? { ...s, revision: result.revision!, spines, graph: result.graph!, runtimeGraph: result.runtimeGraph || result.graph!, evidence: result.report?.edgeEvidence || s.evidence, config: exportConfig(s, spines) } : s);
        setSavedRouteNotice(true);
      }
      return result;
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  async function testRoute(editedGraph?: NavigationGraph) {
    if (!session) return;
    const rebuilt = editedGraph || (reportKey === draftKey ? report?.graph : undefined) || session.graph;
    if (!rebuilt) return;
    const start = session.floor.rooms.find(r => r.id === routeStart)?.doorNodeId || null;
    const end = session.floor.rooms.find(r => r.id === routeEnd)?.doorNodeId || null;
    const moved = moveGraphNodes(rebuilt, nodeMoves);
    const simulationGraph = { ...moved, nodes: moved.nodes.filter(n => !deletedNodeSet.has(n.id)), edges: moved.edges.filter(e => !deletedNodeSet.has(e.from) && !deletedNodeSet.has(e.to)) };
    setRoutes({
      original: findRoute(session.runtimeGraph, start, end, { accessibleOnly: accessible }),
      edited: findRoute({ ...simulationGraph, walls: [], navigableAreas: [] }, start, end, { accessibleOnly: accessible }),
      key: draftKey,
    });
  }
  async function saveReview() {
    if (floor01) {
      await run('draft');
      return;
    }
    // Build source candidate is the explicit publish action. Use the same
    // transactional runtime save path so source edits and graph-node moves or
    // deletions are persisted together; geometry findings remain diagnostics.
    await run('save');
  }
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcuts.current = event => {
    if ((event.target as HTMLElement)?.closest('input,select,textarea,button')) return;
    if (event.code === 'Space') { event.preventDefault(); space.current = true; }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && ['z', 'y', 'a', 's'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'z') event.shiftKey ? redo() : undo();
      if (event.key.toLowerCase() === 'y') redo();
      if (event.key.toLowerCase() === 'a') selectAll();
      if (event.key.toLowerCase() === 's') void saveReview();
    }
    if (event.key === 'Escape') { setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); gestureRef.current = null; setGesture(null); }
    if (event.key === 'Delete') { event.preventDefault(); remove(); }
    const arrows: Record<string, Point> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[event.key]) { event.preventDefault(); const [x, y] = arrows[event.key]; nodeSelection.size ? moveSelectedNodes(x * (event.shiftKey ? 10 : nudge), y * (event.shiftKey ? 10 : nudge)) : move(x * (event.shiftKey ? 10 : nudge), y * (event.shiftKey ? 10 : nudge)); }
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => shortcuts.current(event);
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') space.current = false; };
    const blur = () => { space.current = false; gestureRef.current = null; setGesture(null); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  function position(event: { clientX: number; clientY: number }): Point {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return [0, 0];
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }
  function startGesture(event: ReactPointerEvent<SVGSVGElement>) {
    if (busy || event.button > 1) return;
    svg.current?.focus();
    const point = position(event);
    const target = event.target as SVGElement;
    const id = target.dataset.control;
    const additive = event.shiftKey || event.ctrlKey || event.metaKey || mode === 'Multi-select';
    if (mode === 'Draw corridor' && !space.current && event.button === 0) { setDrawPoints([...drawPoints, point]); return; }
    if (target.dataset.node && floor01 && !space.current && event.button === 0) {
      setInspect(target.dataset.node);
      setSelection(new Set()); setNodeSelection(new Set());
      return;
    }
    if (target.dataset.node && graph && graphEditing && !space.current && event.button === 0) {
      const nodeId = target.dataset.node;
      const graphNode = graph.nodes.find(n => n.id === nodeId);
      const nodeLayer = graphNode?.roomId ? layers[0] : layers[2];
      if (!nodeLayer?.selectable || nodeLayer.locked) { setInspect(nodeId); return; }
      let selectedNodes = new Set(nodeSelection);
      if (additive) selectedNodes.has(nodeId) ? selectedNodes.delete(nodeId) : selectedNodes.add(nodeId);
      else if (!selectedNodes.has(nodeId)) selectedNodes = new Set([nodeId]);
      setNodeSelection(selectedNodes); setSelection(new Set()); setInspect(nodeId);
      if (!selectedNodes.has(nodeId)) return;
      const next: Gesture = { kind: 'node-move', start: point, current: point, path: [point], selected: selectedNodes, view, additive };
      gestureRef.current = next; setGesture(next); svg.current?.setPointerCapture(event.pointerId); return;
    }
    let selected = new Set(selection);
    let kind: Gesture['kind'] = mode === 'Lasso' ? 'lasso' : 'box';
    if (space.current || event.button === 1) kind = 'pan';
    else if (id && editable) {
      if (additive) { selected.has(id) ? selected.delete(id) : selected.add(id); setSelection(selected); setInspect(null); return; }
      if (!selected.has(id)) selected = new Set([id]);
      setSelection(selected); setInspect(null);
      if (!editableIds.has(id)) return;
      kind = 'move';
      selected = new Set([...selected].filter(id => editableIds.has(id)));
    } else if (target.dataset.edge && layers[3].selectable) { setInspect(target.dataset.edge); setSelection(new Set()); return; }
    else if (target.dataset.spine && mode === 'Add node' && editable) {
      const owner = spines.find(s => s.id === target.dataset.spine)!;
      const segment = Number(target.dataset.segment);
      const next = spines.map(s => s.id === owner.id ? { ...s, coordinates: [...s.coordinates.slice(0, segment + 1), point, ...s.coordinates.slice(segment + 1)] } : s);
      commit(next, `Insert control in ${owner.id}`); setSelection(new Set([`${owner.id}/${segment + 1}`])); return;
    }
    const next: Gesture = { kind, start: point, current: point, path: [point], selected, view, additive };
    gestureRef.current = next; setGesture(next); svg.current?.setPointerCapture(event.pointerId);
  }
  function moveGesture(event: ReactPointerEvent<SVGSVGElement>) {
    const current = gestureRef.current;
    if (!current) return;
    const point = position(event);
    if (current.kind === 'pan') {
      setView(([x, y, w, h]) => [x - point[0] + current.start[0], y - point[1] + current.start[1], w, h]); return;
    }
    const next = { ...current, current: point, path: current.kind === 'lasso' ? [...current.path, point] : current.path };
    gestureRef.current = next; setGesture(next);
  }
  function endGesture(event: ReactPointerEvent<SVGSVGElement>) {
    const current = gestureRef.current;
    if (!current) return;
    if (current.kind === 'move') commit(translate(spines, current.selected, [current.current[0] - current.start[0], current.current[1] - current.start[1]], grid), `Drag ${current.selected.size} controls`);
    if (current.kind === 'node-move' && baseGraph) {
      const raw: Point = [current.current[0] - current.start[0], current.current[1] - current.start[1]];
      const [dx, dy] = raw.map(value => grid ? Math.round(value / grid) * grid : value) as Point;
      const next = { ...nodeMoves };
      for (const id of current.selected) {
        const original = baseGraph.nodes.find(n => n.id === id)?.point;
        if (original) {
          const p = nodeMoves[id] || original;
          next[id] = [p[0] + dx, p[1] + dy];
        }
      }
      commit(spines, `Move ${current.selected.size} graph node${current.selected.size === 1 ? '' : 's'}`, next);
    }
    if (current.kind === 'box' || current.kind === 'lasso') {
      const eligible = visibleControls.filter(c => editableIds.has(c.id));
      const found = current.kind === 'box' ? rectangleSelection(eligible, current.start, current.current, view[2] / 700) : eligible.filter(c => inside(c.point, current.path)).map(c => c.id);
      const graphItems: Control[] = graphEditing ? (graph?.nodes || []).filter(node => {
        const layer = node.roomId ? layers[0] : layers[2];
        return layer.visible && layer.selectable && !layer.locked && !deletedNodeSet.has(node.id);
      }).map((node, index) => ({ id: node.id, spine: 'graph', index, point: node.point, protected: false })) : [];
      const foundNodes = current.kind === 'box'
        ? rectangleSelection(graphItems, current.start, current.current, view[2] / 800)
        : graphItems.filter(item => inside(item.point, current.path)).map(item => item.id);
      setSelection(new Set([...(current.additive ? selection : []), ...found]));
      setNodeSelection(new Set([...(current.additive ? nodeSelection : []), ...foundNodes])); setInspect(null);
    }
    gestureRef.current = null; setGesture(null); if (svg.current?.hasPointerCapture(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
  }

  function resetSelected() {
    if (!session) return;
    commit(spines.map(s => ({ ...s, coordinates: s.coordinates.map((p, i) => selectedIds.has(`${s.id}/${i}`) ? session.spines.find(o => o.id === s.id)?.coordinates[i] || p : p) })), 'Reset selected control coordinates');
  }
  function exportDraft() {
    if (!session) return;
    const payload = { config: exportConfig(session, spines), previewNodeMoves: nodeMoves, previewDeletedNodes: deletedNodes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'navigation-v2-admin-preview.json'; a.click(); URL.revokeObjectURL(url);
  }
  function selectSpine() { setSelection(new Set(controls(spines).filter(c => (!spineFilter || c.spine === spineFilter) && editableIds.has(c.id)).map(c => c.id))); }
  const selectedDiagnostic = live?.diagnostics.filter(d => selected.some(c => c.spine === d.id));
  const wallOverlay = showNearbyWalls ? selectedDiagnostic?.flatMap(d => d.nearbyWallIndices.map(index => ({
    index, wall: session?.graph.walls[index], contact: d.tests?.wallIndices.includes(index) ?? false,
  }))) || [] : [];
  const selectedNodeWalls = node && session ? Math.min(...session.graph.walls.map(([a, b]) => pointSegmentDistance(node.point, a, b))) : undefined;
  const sourceAnchors = [...controls(spines).map(c => ({ id: c.id, point: c.point })), ...(session?.graph.nodes.filter(n => n.roomId).map(n => ({ id: n.id, point: n.point })) || [])];
  function addConnection() {
    const a = sourceAnchors.find(n => n.id === connectionStart), b = sourceAnchors.find(n => n.id === connectionEnd);
    const source = session?.spines.find(s => s.id === connectionEvidence);
    if (!a || !b || !source || connectionNote.trim().length < 20 || a.id === b.id) { setMessage('Choose distinct source anchors, evidence, and a source-review justification (20+ characters).'); return; }
    const id = `connection:admin-${crypto.randomUUID().replaceAll('-', '')}`;
    commit([...spines, { id, index: Math.max(...spines.map(s => s.index)) + 1, kind: 'connection', coordinates: [a.point, ...drawPoints, b.point], sourceReferences: source.sourceReferences, note: connectionNote.trim() }], 'Add source-reviewed connection');
    setDrawPoints([]); setSpineFilter(id); setMode('Select'); setMessage('Connection added to the editable source set. Build Source Candidate writes the graph to runtime; geometry and connectivity findings remain diagnostic.');
  }
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  if (!session) return <main className="nav-editor"><div className="editor-loading" role="status">{message}</div></main>;

  return <main className="nav-editor" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="editor-header"><div><span className="editor-brand">B03 / {floorId}</span><strong>{t('Navigation workshop', 'محرر مسارات الملاحة')}</strong><span className="editor-badge">{floor01 ? 'SOURCE SPINES · REVIEW REQUIRED' : 'V2 · DIAGNOSTIC ONLY'}</span></div><div><button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>{language === 'en' ? 'العربية' : 'English'}</button><a href="/">{t('Wayfinding', 'دليل المبنى')}</a></div></header>
    {savedRouteNotice && <div className="editor-route-notice" role="status">
      <span><strong>Runtime graph editor.</strong> Confirmed saves replace the GF graph used by the normal wayfinding page; geometry and connectivity findings remain visible as diagnostics.</span>
      <button onClick={() => { document.getElementById('editor-route-regression')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); void testRoute(report?.graph); }}>Preview edited route here</button>
      <button aria-label="Dismiss saved route notice" onClick={() => setSavedRouteNotice(false)}>Dismiss</button>
    </div>}
    <nav className="editor-toolbar" aria-label="Editor tools">
      {(['Select', 'Multi-select', 'Move', 'Lasso', 'Draw corridor', 'Add node', 'Measure clearance'] as Mode[]).map(tool => <button key={tool} aria-pressed={mode === tool} onClick={() => setMode(tool)}>{tool}</button>)}
      <button onClick={remove} disabled={(!selectedIds.size && (!graphEditing || !nodeSelection.size)) || busy}>Delete</button><span className="toolbar-divider" />
      <button onClick={undo} disabled={!cursor || busy}>Undo</button><button onClick={redo} disabled={cursor >= frames.length - 1 || busy}>Redo</button>
      <button onClick={() => void run('draft')} disabled={busy || !changed}>{floor01 ? 'Save isolated draft' : 'Save preview draft'}</button><button onClick={() => void run('preview')} disabled={busy}>Run in admin</button>{floor01
        ? <button className="primary" onClick={() => void saveReview()} disabled={busy}>Save isolated draft only</button>
        : <button className="primary" onClick={() => void saveReview()} disabled={busy}>Build source candidate</button>}
      {floor01 && <span className="muted">Draft only; does not publish canonical configuration.</span>}
    </nav>
    <div className={`editor-workspace${leftPanelOpen ? '' : ' left-collapsed'}${rightPanelOpen ? '' : ' right-collapsed'}`}>
      <aside className={`editor-left${leftPanelOpen ? '' : ' collapsed'}`} aria-label="Navigation layers">
        <button className="panel-toggle" type="button" aria-expanded={leftPanelOpen} aria-controls="navigation-layers-panel" onClick={() => setLeftPanelOpen(open => !open)}>{leftPanelOpen ? '‹' : '›'}<span className="panel-toggle-label">{leftPanelOpen ? 'Collapse layers' : 'Expand layers'}</span></button>
        <div id="navigation-layers-panel">
        <h2>{t('Navigation layers', 'طبقات الملاحة')}</h2><p className="muted">Source-aligned · Y increases downward</p>
        {layers.map((layer, i) => <div className="layer-row" key={layer.name}>
          <input type="checkbox" aria-label={`${layer.name} visibility`} checked={layer.visible} disabled={i === 5} onChange={e => setLayers(current => current.map((l, j) => j === i ? { ...l, visible: e.target.checked } : l))} />
          <input type="color" aria-label={`${layer.name} color`} value={layer.color} onChange={e => setLayers(current => current.map((l, j) => j === i ? { ...l, color: e.target.value } : l))} />
          <span>{layer.name}</span><button aria-label={`${layer.name} lock`} title={i === 0 || i === 1 || i === 2 ? 'Lock/unlock preview editing' : 'Layer is read-only'} disabled={![0, 1, 2].includes(i)} onClick={() => setLayers(layers.map((l, j) => j === i ? { ...l, locked: !l.locked } : l))}>{layer.locked ? 'L' : 'U'}</button>
          <input type="checkbox" aria-label={`${layer.name} selectable`} checked={layer.selectable} disabled={protectedLayerIndices.has(i)} onChange={e => setLayers(current => current.map((l, j) => j === i ? { ...l, selectable: e.target.checked } : l))} />
        </div>)}
        <h2>Selection filters</h2>
        <label>Source spine<select value={spineFilter} onChange={e => setSpineFilter(e.target.value)}><option value="">All source spines</option>{spines.map(s => <option key={s.id} value={s.id}>{s.index} · {s.id}</option>)}</select></label>
        <label>Node type<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="all">All nodes</option><option value="control">Source controls</option><option value="junction">Derived junctions</option><option value="room">Room approaches</option></select></label>
        <label>Room<select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}><option value="">All rooms</option>{session.floor.rooms.map(r => <option key={r.id} value={r.id}>{r.code} · {r.name[language]}</option>)}</select></label>
        <label>Graph connection<select value={connectionFilter} onChange={e => setConnectionFilter(e.target.value)}><option value="all">All</option><option value="connected">Connected</option><option value="isolated">Isolated</option></select></label>
        <div className="button-pair"><button onClick={selectAll}>Select filtered</button><button aria-label="Clear selection" onClick={() => { setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); }}>Clear</button></div>
        <button onClick={selectSpine}>Select spine controls</button>
        <button onClick={() => { const owner = spines.find(s => s.id === spineFilter); const edgeIds = evidence?.filter(e => owner && e.sourceSpineIds.includes(owner.index)).map(e => e.edgeId) || []; const nodes = graph?.edges.filter(e => edgeIds.includes(e.id)).flatMap(e => [e.from, e.to]) || []; setMessage(`Derived junctions for ${spineFilter}: ${[...new Set(nodes)].join(', ')}. Edit their source controls to regenerate.`); setInspect(nodes[0] || null); }}>Inspect connected junctions</button>
        <h2>Spine operations</h2><p className="muted">{floor01 ? 'Edit reviewed corridor spines only. Room approaches and the derived graph are protected source evidence.' : 'Drag any unlocked graph node for route simulation, or drag source controls to edit corridor geometry. Preview node moves and deletions are saved separately from source geometry.'}</p>
        <details hidden={floor01}><summary>Manual source-reviewed connection</summary><p className="muted">Choose source anchors and evidence. Draw corridor adds intermediate points on the canvas. No proximity auto-connect.</p>
          <label>Start anchor<select value={connectionStart} onChange={e => setConnectionStart(e.target.value)}><option value="">Choose start</option>{sourceAnchors.map(a => <option key={a.id}>{a.id}</option>)}</select></label>
          <label>End anchor<select value={connectionEnd} onChange={e => setConnectionEnd(e.target.value)}><option value="">Choose end</option>{sourceAnchors.map(a => <option key={a.id}>{a.id}</option>)}</select></label>
          <label>Source evidence<select value={connectionEvidence} onChange={e => setConnectionEvidence(e.target.value)}><option value="">Choose reviewed source</option>{session.spines.map(s => <option key={s.id}>{s.id}</option>)}</select></label>
          <label>Source-review justification<textarea value={connectionNote} onChange={e => setConnectionNote(e.target.value)} maxLength={2000} /></label><p>{drawPoints.length} intermediate points</p><button onClick={() => setDrawPoints([])}>Clear drawn points</button><button onClick={addConnection} disabled={busy}>Add reviewed connection</button>
        </details>
        <button hidden={floor01} disabled={!spines.find(s => s.id === spineFilter && s.kind === 'connection') || busy} onClick={() => { commit(spines.filter(s => s.id !== spineFilter), `Delete reviewed connection ${spineFilter}`); setSpineFilter(''); setSelection(new Set()); }}>Delete selected connection</button>
        <button disabled={!spineFilter || busy} onClick={() => { commit(spines.map(s => s.id === spineFilter ? session.spines.find(o => o.id === s.id)! : s), `Reset ${spineFilter}`); setSelection(new Set()); }}>Reset selected spine</button>
        <label><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Original geometry overlay</label>
        <button onClick={() => setView(session.floor.floor.viewBox)}>Fit architectural drawing</button>
        </div>
      </aside>
      <section className="editor-stage" aria-label="Architectural drawing workspace">
        <div className="canvas-heading"><span>{mode} / {selection.size + nodeSelection.size} selected</span><span>{changed ? 'Unsaved preview edits' : 'Source unchanged'} · {isGraphCurrent ? 'Graph current' : 'Graph preview required'}</span></div>
        <div className={split ? 'canvas-pair' : 'canvas-single'}>
          {split && <svg className="original-canvas" aria-label="Original route comparison" viewBox={view.join(' ')}><Architecture session={session} layers={layers} />{session.spines.map(s => <polyline key={s.id} points={pointsString(s.coordinates)} fill="none" stroke="#71828d" strokeWidth="2" />)}{routes && <polyline points={pointsString(routes.original.points)} fill="none" stroke="#c97525" strokeWidth="5" />}<text x={view[0] + 15} y={view[1] + 25} fontSize="18">Original</text></svg>}
          <svg ref={svg} className="editor-canvas" role="application" aria-label="Navigation graph canvas" tabIndex={0} viewBox={view.join(' ')} onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={() => { gestureRef.current = null; setGesture(null); }} onWheel={event => { const p = position(event), factor = event.deltaY > 0 ? 1.12 : 1 / 1.12; const width = Math.max(80, Math.min(6200, view[2] * factor)); const ratio = width / view[2]; setView([p[0] - (p[0] - view[0]) * ratio, p[1] - (p[1] - view[1]) * ratio, width, view[3] * ratio]); }}>
            <Architecture session={session} layers={layers} />
            {wallOverlay.map(({ index, wall, contact }) => wall ? <line key={`wall-guide-${index}`} x1={wall[0][0]} y1={wall[0][1]} x2={wall[1][0]} y2={wall[1][1]} stroke={contact ? '#ff1738' : '#e58c17'} strokeWidth={contact ? 3 : 1.8} vectorEffect="non-scaling-stroke" pointerEvents="none"><title>{contact ? 'Intersected source wall' : 'Nearby source wall'} · #{index}</title></line> : null)}
            {drawPoints.length > 0 && <polyline points={pointsString(drawPoints)} fill="none" stroke="#d98918" strokeDasharray="4 4" strokeWidth="3" pointerEvents="none" />}
            {compare && session.spines.map(s => <polyline key={s.id} points={pointsString(s.coordinates)} fill="none" stroke="#77838d" strokeDasharray="4 4" strokeWidth="1.4" pointerEvents="none" />)}
            {layers[3].visible && graph?.edges.map(e => <polyline key={e.id} data-edge={e.id} points={pointsString(e.geometry)} fill="none" stroke={inspect === e.id ? '#ec9513' : layers[3].color} opacity={isGraphCurrent ? .6 : .2} strokeWidth={inspect === e.id ? 4 : 1.5} pointerEvents="none" />)}
            {layers[1].visible && preview.filter(s => !spineFilter || s.id === spineFilter).map(s => { const diagnostic = live?.diagnostics.find(d => d.id === s.id); const color = diagnostic?.changed ? diagnostic.state === 'red' ? '#cc3b43' : diagnostic.state === 'orange' ? '#d98918' : diagnostic.state === 'green' ? '#25804b' : '#7b8790' : layers[1].color; return <g key={s.id}>{s.coordinates.slice(1).map((p, i) => <line key={i} data-spine={s.id} data-segment={i} x1={s.coordinates[i][0]} y1={s.coordinates[i][1]} x2={p[0]} y2={p[1]} stroke={color} strokeWidth={mode === 'Add node' ? 5 : 2.5} />)}{mode === 'Measure clearance' && <polyline points={pointsString(s.coordinates)} fill="none" stroke={color} strokeOpacity=".1" strokeWidth={settings.preferred * 2} pointerEvents="none" />}</g>; })}
            {handleClusters.filter(cluster => cluster.members.length > 1).map(cluster => <g key={cluster.id} role="button" tabIndex={0} aria-label={`Coincident handles: ${cluster.members.length} members`} onPointerDown={event => beginClusterGesture(event, cluster)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseCluster(cluster); } }} style={{ cursor: 'pointer' }}><circle cx={cluster.point[0]} cy={cluster.point[1]} r={Math.max(view[2] / 450, 11)} fill="#fff4c2" stroke="#7a5b00" strokeWidth="2" /><text x={cluster.point[0]} y={cluster.point[1]} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(view[2] / 300, 12)} fill="#4b3b00">{cluster.members.length}</text><title>{cluster.members.map(member => `${member.kind}: ${member.id}`).join(' · ')} · activate to cycle; drag selected member</title></g>)}
            {filteredNodes?.map(n => { const layer = n.roomId ? layers[0] : layers[2]; const clustered = handleClusters.some(c => c.members.length > 1 && c.members.some(m => m.id === n.id)); return layer.visible && !clustered ? <circle key={n.id} data-node={n.id} data-testid={`graph-node-${n.id}`} cx={n.point[0]} cy={n.point[1]} r={view[2] / 800} fill={nodeSelection.has(n.id) ? '#ffe7a0' : inspect === n.id ? '#ffd36a' : 'white'} stroke={layer.color} strokeWidth={nodeSelection.has(n.id) ? 2 : 1.3} style={{ cursor: 'grab' }}><title>{n.id} · {n.type} · draggable admin preview node</title></circle> : null; })}
            {layers[1].visible && visibleControls.map(c => { const clustered = handleClusters.some(cluster => cluster.members.length > 1 && cluster.members.some(member => member.id === c.id)); return !clustered ? <circle key={c.id} data-control={c.id} data-testid={`control-${c.id}`} cx={c.point[0]} cy={c.point[1]} r={Math.max(view[2] / 520, 8)} fill={selection.has(c.id) ? '#ffe7a0' : '#fff'} stroke={selection.has(c.id) ? '#a96500' : layers[1].color} strokeWidth={selection.has(c.id) ? 2 : 1.2} style={{ cursor: editable ? 'grab' : 'default' }}><title>{c.id} · editable source control</title></circle> : null; })}
            {routes && routes.key === draftKey && <g pointerEvents="none">{compare && <polyline points={pointsString(routes.original.points)} fill="none" stroke="#c97525" strokeDasharray="6 3" strokeWidth="4" />}<polyline points={pointsString(routes.edited.points)} fill="none" stroke="#166aca" strokeWidth="4" /></g>}
            {gesture?.kind === 'box' && <rect x={Math.min(gesture.start[0], gesture.current[0])} y={Math.min(gesture.start[1], gesture.current[1])} width={Math.abs(delta[0] || gesture.current[0] - gesture.start[0])} height={Math.abs(delta[1] || gesture.current[1] - gesture.start[1])} fill={gesture.current[0] < gesture.start[0] ? '#2ba17b' : '#2877c3'} fillOpacity=".12" stroke="#2877c3" strokeWidth="1" strokeDasharray={gesture.current[0] < gesture.start[0] ? '4 3' : undefined} pointerEvents="none" />}
            {gesture?.kind === 'lasso' && <polygon points={pointsString(gesture.path)} fill="#2877c3" fillOpacity=".1" stroke="#2877c3" strokeWidth="1" pointerEvents="none" />}
          </svg>
        </div>
        <div className="canvas-footer"><span>Shift / Ctrl + click: toggle · Space + drag: pan · Wheel: zoom</span><span>{t('Drawing units, not metres', 'وحدات الرسم وليست أمتاراً')}</span></div>
      </section>
      <aside className={`editor-right${rightPanelOpen ? '' : ' collapsed'}`} aria-label="Properties inspector">
        <button className="panel-toggle" type="button" aria-expanded={rightPanelOpen} aria-controls="properties-inspector-panel" onClick={() => setRightPanelOpen(open => !open)}>{rightPanelOpen ? '›' : '‹'}<span className="panel-toggle-label">{rightPanelOpen ? 'Collapse inspector' : 'Expand inspector'}</span></button>
        <div id="properties-inspector-panel">
        <h2>{t('Properties inspector', 'خصائص التحديد')}</h2>
        {stats ? <><div className="selection-count">{stats.count}<span> source controls selected</span></div><dl><dt>Bounding box</dt><dd>{stats.bounds.map(fmt).join(', ')}</dd><dt>Average X / Y</dt><dd>{stats.average.map(fmt).join(' / ')}</dd><dt>Drag displacement</dt><dd>{delta.map(v => fmt(grid ? Math.round(v / grid) * grid : v)).join(' / ')}</dd><dt>Editable controls</dt><dd>{selectedIds.size}</dd></dl>
          {selected.length === 1 && <><code>{selected[0].id}</code><div className="button-pair">{[0, 1].map(axis => <label key={axis}>{axis ? 'Y' : 'X'}<input aria-label={`Node ${axis ? 'Y' : 'X'}`} type="number" step="any" value={selected[0].point[axis]} disabled={busy || !editable} onChange={event => { if (event.target.value === '') return; const value = Number(event.target.value); move(axis === 0 ? value - selected[0].point[0] : 0, axis === 1 ? value - selected[0].point[1] : 0); }} /></label>)}</div><p className="muted">Editable source point · {selected[0].spine}</p></>}
          <div className="button-pair"><label>Move X<input type="number" value={dx} onChange={e => setDx(Number(e.target.value))} /></label><label>Move Y<input type="number" value={dy} onChange={e => setDy(Number(e.target.value))} /></label></div><button disabled={!selectedIds.size || busy} onClick={() => move(dx, dy)}>Translate selection</button>
          <div className="nudge-buttons"><button onClick={() => move(-nudge, 0)}>Left</button><button onClick={() => move(0, -nudge)}>Up</button><button onClick={() => move(0, nudge)}>Down</button><button onClick={() => move(nudge, 0)}>Right</button></div><button onClick={resetSelected} disabled={!selectedIds.size}>Reset selected nodes</button>
          {selectedDiagnostic?.map(d => <div className={`diagnostic ${d.state}`} key={d.id}><strong>{d.id}</strong><div>Wall: {fmt(d.wallClearance ?? undefined)} du</div><div>Walkable boundary: {fmt(d.walkableBoundaryClearance ?? undefined)} du</div><div>Geometry status: {d.tests ? d.tests.safe ? 'checked' : 'issues reported' : 'not checked'}</div>{d.tests && !d.tests.safe && <pre>{JSON.stringify(d.tests, null, 2)}</pre>}</div>)}
          <details><summary>Source references</summary><pre>{[...new Set(spines.filter(s => selected.some(c => c.spine === s.id)).flatMap(s => s.sourceReferences))].join('\n')}</pre></details>
        </> : <p className="muted">Select source controls to edit. Select derived nodes or edges to inspect their evidence.</p>}
        {node && <><code>{node.id}</code><dl><dt>Type</dt><dd>{node.type} · {graphEditing ? 'draggable preview node' : 'read-only derived node'}</dd><dt>Coordinate</dt><dd>{node.point.map(fmt).join(', ')}</dd><dt>Room</dt><dd>{node.roomId || 'None'}</dd><dt>Nearest wall</dt><dd>{fmt(selectedNodeWalls)} du</dd><dt>Selected graph nodes</dt><dd>{nodeSelection.size}</dd></dl>{graphEditing && nodeSelection.size === 1 && <div className="button-pair">{[0, 1].map(axis => <label key={axis}>{axis ? 'Y' : 'X'}<input aria-label={`Graph node ${axis ? 'Y' : 'X'}`} type="number" step="any" value={node.point[axis]} onChange={event => { if (event.target.value === '') return; const value = Number(event.target.value); moveSelectedNodes(axis ? 0 : value - node.point[0], axis ? value - node.point[1] : 0); }} /></label>)}</div>}{graphEditing && <><div className="nudge-buttons"><button onClick={() => moveSelectedNodes(-nudge, 0)}>Left</button><button onClick={() => moveSelectedNodes(0, -nudge)}>Up</button><button onClick={() => moveSelectedNodes(0, nudge)}>Down</button><button onClick={() => moveSelectedNodes(nudge, 0)}>Right</button></div><button onClick={() => moveSelectedNodes(dx, dy)} disabled={!nodeSelection.size}>Translate selected graph nodes</button></>}<details open><summary>Connected edges</summary>{graph?.edges.filter(e => e.from === node.id || e.to === node.id).map(e => <button key={e.id} onClick={() => setInspect(e.id)}>{e.id}</button>)}</details></>}
        {edge && <><code>{edge.id}</code><dl><dt>From</dt><dd>{edge.from}</dd><dt>To</dt><dd>{edge.to}</dd><dt>Distance</dt><dd>{fmt(edge.distance)} du</dd><dt>Source spines</dt><dd>{edgeEvidence?.sourceSpineIds.join(', ')}</dd></dl><details open><summary>Geometry / source evidence</summary><pre>{JSON.stringify({ geometry: edge.geometry, evidence: edgeEvidence }, null, 2)}</pre></details><p className="muted">Generated edges are not source geometry. Edit the owning spine or reviewed connection.</p></>}
        <h2>Clearance & movement</h2><label>Snap grid (0 = off)<input type="number" min="0" max="100" value={grid} onChange={e => setGrid(Math.max(0, Number(e.target.value)))} /></label><label>Nudge drawing units<select value={nudge} onChange={e => setNudge(Number(e.target.value))}>{[1, 5, 10].map(n => <option key={n}>{n}</option>)}</select></label>
        <label><input type="checkbox" checked={showNearbyWalls} onChange={e => setShowNearbyWalls(e.target.checked)} /> Show nearby source walls (red = contact)</label>
        {(Object.keys(settings) as (keyof Settings)[]).map(key => <label key={key}>{key === 'minimum' ? 'Minimum wall clearance' : key === 'preferred' ? 'Preferred wall clearance' : 'Maximum displacement'}<input type="number" min="0" value={settings[key]} onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>)}
        <p className="muted">Walkable enforcement always on. Building/facade clearance unavailable: no separate verified envelope supplied. Rotation/scaling disabled for constrained source geometry.</p>
        <h2 id="editor-route-regression">Route regression</h2>
        <p className="muted">Admin simulation only. Choose two rooms, then run their route over the current preview graph. Safety checks are intentionally not applied here; the normal wayfinding app remains unchanged.</p><label>Starting room<select value={routeStart} onChange={e => { setRouteStart(e.target.value); setRoutes(null); }}>{session.floor.rooms.map(r => <option value={r.id} key={r.id}>{r.code} · {r.name[language]}</option>)}</select></label>
        <label>Destination room<select value={routeEnd} onChange={e => { setRouteEnd(e.target.value); setRoutes(null); }}>{session.floor.rooms.map(r => <option value={r.id} key={r.id}>{r.code} · {r.name[language]}</option>)}</select></label>
        <label><input type="checkbox" checked={accessible} onChange={e => { setAccessible(e.target.checked); setRoutes(null); }} /> Accessible only (unknown excluded)</label><button onClick={() => void testRoute()} disabled={busy}>Run selected room route in admin</button>
        {!floor01 && <button onClick={() => { setRouteStart('B03-GF-G-37'); setRouteEnd('B03-GF-G-42'); setRoutes(null); }}>G-37 / G-42 regression</button>}
        <label><input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} /> Side-by-side comparison</label>
        {routes && <div className="route-results">{(['original', 'edited'] as const).map(key => { const records = (key === 'edited' ? report?.report?.edgeEvidence : session.evidence)?.filter(e => routes[key].edgeIds.includes(e.edgeId)) || []; const distances = records.map(e => e.wallClearance).filter((d): d is number => d !== undefined); return <div key={key}><strong>{key}</strong><p>{routes[key].status} · {fmt(routes[key].distance)} du · {routes[key].edgeIds.length} edges</p><p>Minimum wall clearance: {distances.length === routes[key].edgeIds.length && distances.length ? fmt(Math.min(...distances)) : 'Unavailable in baseline report'} du</p><p>Building clearance: unavailable (no verified envelope)</p><p>{routes[key].reason?.[language]}</p></div>; })}{routes.key !== draftKey && <p>Route preview stale. Re-test current edits.</p>}</div>}
        {session.floor.rooms.filter(r => [routeStart, routeEnd].includes(r.id)).map(r => r.navigationNote && <p className="muted" key={r.id}>{r.code}: {r.navigationNote[language]}</p>)}
        <h2>History & candidates</h2><ol className="editor-history">{frames.map((f, i) => <li key={i} className={cursor === i ? 'current' : ''}>{f.label}</li>)}</ol>
        <button disabled={busy} onClick={() => { commit(session.spines, 'Restore loaded source configuration', {}, []); setSelection(new Set()); setNodeSelection(new Set()); }}>Restore loaded configuration</button><button onClick={exportDraft}>Export configuration JSON</button><button onClick={() => void run('draft')} disabled={busy}>{floor01 ? 'Save isolated draft' : 'Save preview draft'}</button>
        <label>Saved candidate<select value={candidate} onChange={e => setCandidate(e.target.value)}><option value="">Choose candidate</option>{session.candidates.map(c => <option key={c}>{c}</option>)}</select></label>
        <button disabled={!candidate || busy} onClick={async () => { try { const result = await api(floorId, 'restore', { revision: session.revision, candidate }); commit(result.spines, `Restore ${candidate}`, result.nodeMoves || {}, result.deletedNodes || []); setMessage('Saved visual draft restored. Graph-node moves and removals apply only to the admin simulation.'); } catch (error) { setMessage(String(error)); } }}>Restore candidate into draft</button>
        </div>
      </aside>
    </div>
    <footer className="editor-status" role="status"><span className={busy ? 'status-dot busy' : 'status-dot'} />{message}</footer>
    {report && <details className="editor-report" open={!report.valid}><summary>{report.draftOnly && report.safetyChecked === false ? 'Admin simulation only · safety checks skipped' : report.valid ? 'Reconstruction complete · review diagnostics' : 'Reconstruction diagnostics'} · {report.changes.length} changed source lines · {report.lostRoomPairs?.length || 0} other room-pair changes</summary>
      {report.lostRoomPairs?.length ? <p>Room-pair connectivity changes are reported for review; every supported room approach and the required G-35/G-01 and G-37/G-42 routes must remain connected.</p> : null}
      {report.unattachedSupportedRooms?.length ? <p className="diagnostic red">No regenerated corridor connection for: {report.unattachedSupportedRooms.join(', ')}</p> : null}
      {report.roomConnections?.length ? <details><summary>Regenerated room-to-spine connections ({report.roomConnections.filter(c => c.connected).length}/{report.roomConnections.length})</summary><pre>{JSON.stringify(report.roomConnections.map(({ room, nodeId, attachment, method, incidentEdgeCount, connected }) => ({ room, nodeId, attachment, method, incidentEdgeCount, connected })), null, 2)}</pre></details> : null}
      <pre>{JSON.stringify({ changes: report.changes, errors: report.errors, validation: report.validation, backup: report.backup, candidate: report.candidate }, null, 2)}</pre>
    </details>}
  </main>;
}
