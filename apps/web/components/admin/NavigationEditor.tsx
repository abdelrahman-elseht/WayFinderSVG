'use client';

import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { NavigationGraph, Point, RouteResult } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { controls, deleteControls, exportConfig, graphEditPayload, HANDLE_DRAG_THRESHOLD, inside, mergeGraphNodes, mergeSourceLinks, moveGraphNodes, pickHandles, pointSegmentDistance, propagateSourceLinks, rectangleSelection, selectHandle, selectionStats, translateSelection, type AddedGraphEdge, type CoincidenceMember, type Control, type NodeMerges, type NodeMoves, type Report, type Session, type Settings, type Spine } from './editor-model';
import { anchoredEdgeGeometryEdits, applyEdgeGeometryEdits, applyRoomEntryBindings, authoringEdits, authoringPayload, createCandidateNode, emptyAuthoringEdits, type AuthoringEdits, type NavigableAreaEdit } from './editor-model';
import './editor.css';

type Layer = { name: string; visible: boolean; locked: boolean; selectable: boolean; color: string };
type Mode = 'Select' | 'Multi-select' | 'Move' | 'Lasso' | 'Draw corridor' | 'Add source control' | 'Measure clearance' | 'Add junction' | 'Add room entry' | 'Add transition landing' | 'Draw walkable mask' | 'Edit edge bends';
type Frame = { spines: Spine[]; nodeMoves: NodeMoves; deletedNodes: string[]; addedEdges: AddedGraphEdge[]; nodeMerges?: NodeMerges; authoring?: AuthoringEdits; label: string };
const emptyFrame = { spines: [] as Spine[], nodeMoves: {} as NodeMoves, deletedNodes: [] as string[], addedEdges: [] as AddedGraphEdge[], nodeMerges: {} as NodeMerges, authoring: emptyAuthoringEdits(), label: 'Empty draft' } satisfies Frame;
type Gesture = { kind: 'move' | 'box' | 'lasso' | 'pan'; start: Point; current: Point; path: Point[]; selected: Set<string>; nodes: Set<string>; view: number[]; additive: boolean };
const layerDefaults: Layer[] = [
  { name: 'Room entrances', color: '#c97525', visible: true, locked: false, selectable: true },
  { name: 'Corridor centerlines', color: '#007d91', visible: true, locked: false, selectable: true },
  { name: 'Junction nodes', color: '#955fac', visible: true, locked: false, selectable: true },
  { name: 'Navigation edges', color: '#4475b8', visible: true, locked: false, selectable: true },
  { name: 'Room boundaries', color: '#bc7165', visible: false, locked: true, selectable: true },
  { name: 'Building boundaries (unavailable)', color: '#ad823d', visible: false, locked: true, selectable: false },
  { name: 'Walkable areas', color: '#50a88d', visible: false, locked: false, selectable: true },
  { name: 'Diagnostic geometry / walls', color: '#bb3845', visible: false, locked: true, selectable: false },
];
const protectedLayerIndices = new Set([4, 5, 7]);
const pointsString = (points: Point[]) => points.map(p => p.join(',')).join(' ');
const fmt = (value: number | undefined) => value === undefined || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(3);
const inSupportedWalkableArea = (point: Point, areas: Point[][]) => areas.some(area => inside(point, area)
  || area.some((vertex, index) => pointSegmentDistance(point, vertex, area[(index + 1) % area.length]) <= 0.01));
const sourceLabel = (reference: string) => reference.endsWith('/master.svg') ? 'Floor drawing (master.svg)'
  : reference.endsWith('/alignment.json') ? 'Floor source alignment'
  : reference.includes('#/corridorSpines/') ? `Corridor spine ${reference.split('/').at(-1)}`
  : reference.split('/').slice(-2).join('/');

// Keep the native select's keyboard behavior without mounting the entire source pack.
const SOURCE_PAGE_SIZE = 98;
export const SourceEvidencePicker = memo(function SourceEvidencePicker({ references, value, onChange, disabled, language }: {
  references: string[]; value: string; onChange: (value: string) => void; disabled: boolean; language: 'en' | 'ar';
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const ar = language === 'ar';
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? references.filter(reference => reference.toLowerCase().includes(search) || sourceLabel(reference).toLowerCase().includes(search)) : references;
  }, [references, query]);
  const lastPage = Math.max(0, Math.ceil(matches.length / SOURCE_PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = matches.slice(currentPage * SOURCE_PAGE_SIZE, (currentPage + 1) * SOURCE_PAGE_SIZE);
  // An edited/restored reference must remain selected, even outside this search/page.
  const options = value && !visible.includes(value) ? [value, ...visible] : visible;
  return <div dir={ar ? 'rtl' : 'ltr'} aria-label={ar ? 'اختيار دليل المصدر' : 'Source evidence picker'}>
    <label>{ar ? 'البحث في أدلة المصدر' : 'Search source evidence'}<input type="search" dir="ltr" value={query} disabled={disabled} onChange={event => { setQuery(event.target.value); setPage(0); }} onKeyDown={event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const exact = matches.find(reference => reference === query.trim());
        if (exact || matches.length === 1) onChange(exact || matches[0]);
      }
      if (event.key === 'Escape') { event.preventDefault(); setQuery(''); setPage(0); }
    }} /></label>
    <label>{ar ? 'مرجع مصدر التحرير' : 'Authoring source reference'}<select data-authoring-source dir="ltr" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="">{ar ? 'اختر دليلاً من مخطط الطابق' : 'Choose supplied floor evidence'}</option>
      {options.map(reference => <option title={reference} value={reference} key={reference}>{sourceLabel(reference)} - {reference}</option>)}
    </select></label>
    <p className="muted" aria-live="polite">{ar ? `نتائج البحث: ${matches.length} من ${references.length}. الصفحة ${currentPage + 1} من ${lastPage + 1}.` : `${matches.length} of ${references.length} references. Page ${currentPage + 1} of ${lastPage + 1}.`}</p>
    <div className="button-pair"><button type="button" disabled={disabled || currentPage === 0} onClick={() => setPage(currentPage - 1)}>{ar ? 'الأدلة السابقة' : 'Previous evidence page'}</button><button type="button" disabled={disabled || currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>{ar ? 'الأدلة التالية' : 'Next evidence page'}</button></div>
    {value && <><code dir="ltr" style={{ display: 'block', overflowWrap: 'anywhere' }}>{value}</code><button type="button" disabled={disabled} onClick={() => onChange('')}>{ar ? 'مسح الدليل المحدد' : 'Clear selected evidence'}</button></>}
  </div>;
});
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
    evidence: Array.isArray(workerSession.evidence) ? workerSession.evidence : (data as { sourceLinks?: Session['evidence'] }).sourceLinks || [],
    runtimeGraph: workerSession.runtimeGraph || workerSession.graph!,
    config: workerSession.config || { reviewedSpineOverrides: [], reviewedConnections: [] },
  } as Session;
}

const Architecture = memo(function Architecture({ session, layers, hideAreas = false }: { session: Session; layers: Layer[]; hideAreas?: boolean }) {
  const [x, y, width, height] = session.floor.floor.viewBox;
  return <g pointerEvents="none">
    <image href={session.floor.floor.mapAsset} x={x} y={y} width={width} height={height} preserveAspectRatio="none" opacity=".68" />
    {layers[6].visible && !hideAreas && session.graph.navigableAreas.map((ring, i) => <polygon key={i} points={pointsString(ring)} fill={layers[6].color} fillOpacity=".13" stroke="none" />)}
    {layers[4].visible && session.floor.rooms.map(room => { const polygon = room.polygon || room.displayFootprint?.polygon; return polygon ? <polygon key={room.id} points={pointsString(polygon)} fill={layers[4].color} fillOpacity=".12" stroke={layers[4].color} strokeWidth=".8" /> : null; })}
    {layers[7].visible && <path d={session.graph.walls.map(([a, b]) => `M${a}L${b}`).join('')} fill="none" stroke={layers[7].color} strokeWidth=".8" />}
  </g>;
});

export default function NavigationEditor({ floorId = 'GF' }: { floorId?: 'GF' | '01' }) {
  const [session, setSession] = useState<Session | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]), [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [nodeSelection, setNodeSelection] = useState<Set<string>>(new Set());
  const lastPick = useRef<{ key: string; client: Point; member: CoincidenceMember } | null>(null);
  const pendingPick = useRef<{ key: string; client: Point; member: CoincidenceMember; candidates: CoincidenceMember[]; repeated: boolean; dragged: boolean } | null>(null);
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
  const [maskPoints, setMaskPoints] = useState<Point[]>([]), [maskOperation, setMaskOperation] = useState<'add' | 'subtract'>('add');
  const [selectedMask, setSelectedMask] = useState('');
  const [editingMaskId, setEditingMaskId] = useState('');
  const [authorSource, setAuthorSource] = useState(''), [authorNote, setAuthorNote] = useState('');
  const [maskError, setMaskError] = useState('');
  const [reviewFocus, setReviewFocus] = useState<'source' | 'note' | 'name' | null>(null);
  const [focusTransitionSetup, setFocusTransitionSetup] = useState(false);
  const authoringPanel = useRef<HTMLElement>(null), completedMaskPoints = useRef<Point[] | null>(null);
  const sourceOverridePanel = useRef<HTMLDetailsElement>(null), reviewDetails = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!reviewFocus || !leftPanelOpen) return;
    const selector = reviewFocus === 'source' ? '[data-authoring-source]'
      : reviewFocus === 'note' ? 'textarea' : '[data-transition-name]';
    if (reviewFocus === 'source') sourceOverridePanel.current!.open = true;
    if (reviewFocus === 'note') reviewDetails.current!.open = true;
    const field = authoringPanel.current?.querySelector<HTMLElement>(selector);
    field?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    field?.focus();
    setReviewFocus(null);
  }, [reviewFocus, leftPanelOpen]);
  useEffect(() => {
    if (!focusTransitionSetup || !leftPanelOpen) return;
    authoringPanel.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    authoringPanel.current?.querySelector<HTMLElement>('[data-transition-kind]')?.focus();
    setFocusTransitionSetup(false);
  }, [focusTransitionSetup, leftPanelOpen]);
  const [entryRoom, setEntryRoom] = useState('');
  const [transitionType, setTransitionType] = useState<'escalator' | 'elevator'>('escalator');
  const [transitionId, setTransitionId] = useState('');
  const [transitionName, setTransitionName] = useState('');
  const [transitionAccessibility, setTransitionAccessibility] = useState<'confirmed' | 'inaccessible' | 'unknown'>('unknown');
  const [transitionRestriction, setTransitionRestriction] = useState<'open' | 'closed' | 'unknown'>('unknown');
  const [bendPoints, setBendPoints] = useState<Point[] | null>(null);
  const [bendEdgeId, setBendEdgeId] = useState('');
  const floor01 = floorId === '01';
  const graphEditing = true;
  const frame = frames[cursor] || emptyFrame;
  const { spines, nodeMoves, deletedNodes, addedEdges } = frame;
  const nodeMerges = frame.nodeMerges || emptyFrame.nodeMerges;
  const authored = frame.authoring || emptyFrame.authoring;
  const unfinishedDrawing = maskPoints.length > 0 || bendPoints !== null;
  const sourceReferences = useMemo(() => session?.authoringSourceReferences || [...new Set(session?.spines.flatMap(spine => spine.sourceReferences) || [])], [session?.authoringSourceReferences, session?.spines]);
  const deletedNodeSet = new Set(deletedNodes);
  const draftKey = JSON.stringify({ spines, nodeMoves, deletedNodes, addedEdges, nodeMerges, authored, settings });
  const sourceChanged = session ? JSON.stringify(spines) !== JSON.stringify(session.spines) : false;
  const changed = sourceChanged || Object.keys(nodeMoves).length > 0 || deletedNodes.length > 0 || addedEdges.length > 0 || Object.keys(nodeMerges).length > 0 || Object.values(authored).some(value => Object.keys(value).length > 0);
  const editable = layers[1].visible && !layers[1].locked && layers[1].selectable;
  const editableIds = new Set(controls(spines).filter(c => editable).map(c => c.id));
  const delta: Point = gesture?.kind === 'move' ? [gesture.current[0] - gesture.start[0], gesture.current[1] - gesture.start[1]] : [0, 0];
  const rawEvidence = session?.evidence;
  // View/inspector changes and live drags must not rebuild the committed graph.
  const { baseGraph, currentGraph } = useMemo(() => {
    // Keep draft IDs and coordinates anchored to the loaded session, even after reconstruction.
    const baseGraph = session ? { ...session.graph, nodes: [...session.graph.nodes, ...authored.addedNodes] } : undefined;
    const positionedGraph = baseGraph && session ? moveGraphNodes(propagateSourceLinks(baseGraph, session.spines, spines, rawEvidence || []), nodeMoves) : baseGraph;
    return { baseGraph, currentGraph: positionedGraph ? mergeGraphNodes(positionedGraph, nodeMerges, false).graph : positionedGraph };
  }, [session, authored.addedNodes, spines, rawEvidence, nodeMoves, nodeMerges]);
  const movement = useMemo(() => gesture?.kind === 'move'
    ? translateSelection(spines, currentGraph, nodeMoves, gesture.selected, gesture.nodes, [gesture.current[0] - gesture.start[0], gesture.current[1] - gesture.start[1]], grid)
    : { spines, nodeMoves }, [spines, currentGraph, nodeMoves, gesture, grid]);
  const preview = movement.spines;
  const selected = controls(preview).filter(c => selection.has(c.id));
  const stats = selectionStats(selected);
  const { propagatedMoves, unmergedGraph, graph, evidence } = useMemo(() => {
    const deletedNodeSet = new Set(deletedNodes);
    const sourceGraph = baseGraph && session ? propagateSourceLinks(baseGraph, session.spines, preview, rawEvidence || []) : baseGraph;
    const propagatedMoves = baseGraph && sourceGraph ? Object.fromEntries(sourceGraph.nodes.filter(node => baseGraph.nodes.find(original => original.id === node.id)?.point.some((value, index) => value !== node.point[index])).map(node => [node.id, node.point])) : {};
    const movedGraph = sourceGraph ? moveGraphNodes(sourceGraph, { ...propagatedMoves, ...movement.nodeMoves }) : undefined;
    const unmergedGraph = movedGraph ? {
      ...movedGraph,
      nodes: movedGraph.nodes.filter(n => !deletedNodeSet.has(n.id)),
      edges: [
        ...movedGraph.edges.filter(e => !deletedNodeSet.has(e.from) && !deletedNodeSet.has(e.to)),
        ...addedEdges.flatMap(edge => {
          const from = movedGraph.nodes.find(n => n.id === edge.from), to = movedGraph.nodes.find(n => n.id === edge.to);
          return from && to && !deletedNodeSet.has(from.id) && !deletedNodeSet.has(to.id)
            ? [{ ...edge, geometry: [from.point, to.point], distance: Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1]) }]
            : [];
        }),
      ],
    } : undefined;
    const merged = unmergedGraph ? mergeGraphNodes(unmergedGraph, Object.fromEntries(Object.entries(nodeMerges).filter(([from, to]) => !deletedNodeSet.has(from) && !deletedNodeSet.has(to))), false) : undefined;
    const graph = merged ? applyEdgeGeometryEdits(merged.graph, anchoredEdgeGeometryEdits(merged.graph, authored.edgeGeometryEdits)) : undefined;
    const evidence = merged ? mergeSourceLinks(rawEvidence || [], merged.edgeIds) : rawEvidence;
    return { propagatedMoves, unmergedGraph, graph, evidence };
  }, [baseGraph, session, preview, rawEvidence, movement.nodeMoves, deletedNodes, addedEdges, nodeMerges, authored.edgeGeometryEdits]);
  const draftFloor = session ? applyRoomEntryBindings(session.floor, authored.roomEntryBindings) : undefined;
  const pendingNodeIds = new Set(authored.addedNodes.map(node => node.id));
  const transitionOptions = session?.transitionCandidates?.filter(candidate => candidate.type === transitionType) ?? [];
  const selectedTransition = transitionOptions.find(candidate => candidate.transitionId === transitionId);
  const isGraphCurrent = !changed || (reportKey === draftKey && !!report?.graph);
  const edge = graph?.edges.find(e => e.id === inspect), node = graph?.nodes.find(n => n.id === inspect);
  const edgeEvidence = evidence?.find(e => e.edgeId === inspect);
  const visibleControls = controls(preview).filter(c => (!spineFilter || c.spine === spineFilter) && (typeFilter === 'all' || typeFilter === 'control') && (!roomFilter || evidence?.some(e => e.sourceSpineIds.includes(preview.find(s => s.id === c.spine)!.index) && graph?.edges.some(g => g.id === e.edgeId && [g.from, g.to].some(id => graph.nodes.find(n => n.id === id)?.roomId === roomFilter)))));
  const selectedIds = new Set(visibleControls.filter(control => selection.has(control.id) && editableIds.has(control.id)).map(control => control.id));
  const filteredNodes = graph?.nodes.filter(n => (!roomFilter || n.roomId === roomFilter)
    && (!spineFilter || evidence?.some(item => item.sourceSpineIds.includes(spines.find(s => s.id === spineFilter)!.index) && graph.edges.some(edge => edge.id === item.edgeId && (edge.from === n.id || edge.to === n.id))))
    && (typeFilter === 'all' || typeFilter === 'graph' || typeFilter === 'room' && !!n.roomId || typeFilter === 'junction' && n.type === 'junction' && !n.roomId || typeFilter === 'candidate-entry' && n.type === 'entrance' && (pendingNodeIds.has(n.id) || 'adminReview' in n) || typeFilter === 'transition' && (n.type === 'escalator' || n.type === 'elevator'))
    && (connectionFilter === 'all' || graph.edges.some(e => e.from === n.id || e.to === n.id) === (connectionFilter === 'connected')));
  const visibleHandles = [
    ...(layers[1].visible ? visibleControls.map(c => ({ id: c.id, kind: 'source' as const, point: c.point })) : []),
    ...(filteredNodes || []).filter(n => (n.roomId ? layers[0].visible : layers[2].visible)).map(n => ({ id: n.id, kind: 'graph' as const, point: n.point })),
  ];
  const editableNodeIds = new Set((filteredNodes || []).filter(node => {
    const layer = node.roomId ? layers[0] : layers[2];
    return layer.visible && layer.selectable && !layer.locked && !deletedNodeSet.has(node.id);
  }).map(node => node.id));
  const selectedNodeIds = new Set([...nodeSelection].filter(id => editableNodeIds.has(id)));
  const pickableHandles = visibleHandles.map(handle => ({ ...handle, visible: true, locked: false,
    selectable: (handle.kind === 'source' ? editableIds : editableNodeIds).has(handle.id) }));

  useEffect(() => {
    const controller = new AbortController();
    setSession(null); setFrames([]); setCursor(0); setSelection(new Set()); setNodeSelection(new Set());
    setInspect(null); setReport(null); setLive(null); setReportKey(''); setRoutes(null);
    setCandidate(''); setSavedRouteNotice(false); setDrawPoints([]); setMaskPoints([]); setSelectedMask(''); setAuthorSource(''); setAuthorNote(''); setBendPoints(null); setBendEdgeId(''); setMode('Select'); lastPick.current = null; pendingPick.current = null;
    setMessage(`Loading Floor ${floorId} source configuration and architectural evidence...`);
    fetch(`/api/admin/navigation?floorId=${floorId}`, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return sessionFromResponse(data, floorId); }).then(data => {
      if (controller.signal.aborted) return;
      const floorDrawingReference = data.floor.floor.mapAsset.replace(/^\//, '');
      setSession(data); setFrames([{ spines: data.spines, nodeMoves: {}, deletedNodes: [], addedEdges: [], label: 'Loaded source configuration' }]); setView(data.floor.floor.viewBox);
      setAuthorSource(data.authoringSourceReferences?.includes(floorDrawingReference) ? floorDrawingReference : '');
      setRouteStart(data.floor.rooms[0]?.id || '');
      setRouteEnd(data.floor.rooms[1]?.id || data.floor.rooms[0]?.id || '');
      setEntryRoom(data.floor.rooms[0]?.id || '');
      setMessage(`Ready. Floor ${floorId}: drag graph nodes or any corridor point, including endpoints. Geometry findings are diagnostic.`);
    }).catch(error => { if (!controller.signal.aborted) setMessage(String(error)); });
    return () => controller.abort();
  }, [floorId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (changed || unfinishedDrawing) event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [changed, unfinishedDrawing]);

  function commit(next: Spine[], label: string, nextNodeMoves = nodeMoves, nextDeletedNodes = deletedNodes, nextAddedEdges = addedEdges, nextNodeMerges = nodeMerges, nextAuthoring = authored) {
    if (busy || JSON.stringify(next) === JSON.stringify(spines) && JSON.stringify(nextNodeMoves) === JSON.stringify(nodeMoves) && JSON.stringify(nextDeletedNodes) === JSON.stringify(deletedNodes) && JSON.stringify(nextAddedEdges) === JSON.stringify(addedEdges) && JSON.stringify(nextNodeMerges) === JSON.stringify(nodeMerges) && JSON.stringify(nextAuthoring) === JSON.stringify(authored)) return;
    setFrames([...frames.slice(0, cursor + 1), { spines: next, nodeMoves: nextNodeMoves, deletedNodes: nextDeletedNodes, addedEdges: nextAddedEdges, nodeMerges: nextNodeMerges, authoring: nextAuthoring, label }]); setCursor(cursor + 1);
  }
  function commitAuthoring(next: AuthoringEdits, label: string) { commit(spines, label, nodeMoves, deletedNodes, addedEdges, nodeMerges, next); }
  function move(x: number, y: number) {
    const next = translateSelection(spines, currentGraph, nodeMoves, selectedIds, selectedNodeIds, [x, y], grid);
    commit(next.spines, `Translate ${selectedIds.size} controls and ${selectedNodeIds.size} graph nodes (${x}, ${y})`, next.nodeMoves);
  }
  const moveSelectedNodes = move;
  function remove() {
    if (busy) return;
    const endpoints = controls(spines).filter(c => selectedIds.has(c.id) && (c.index === 0 || c.index === spines.find(s => s.id === c.spine)!.coordinates.length - 1));
    const removedIds = new Set([...selectedNodeIds, ...Object.keys(nodeMerges).filter(id => selectedNodeIds.has(nodeMerges[id]))]);
    const nextDeleted = graphEditing ? [...new Set([...deletedNodes, ...removedIds])] : deletedNodes;
    const nextAddedEdges = addedEdges.filter(edge => !nextDeleted.includes(edge.from) && !nextDeleted.includes(edge.to));
    const removedEdgeIds = new Set(graph?.edges.filter(edge => removedIds.has(edge.from) || removedIds.has(edge.to)).map(edge => edge.id));
    const nextAuthoring = { ...authored,
      addedNodes: authored.addedNodes.filter(node => !removedIds.has(node.id)),
      roomEntryBindings: authored.roomEntryBindings.filter(binding => !removedIds.has(binding.nodeId)),
      edgeGeometryEdits: Object.fromEntries(Object.entries(authored.edgeGeometryEdits).filter(([id]) => !removedEdgeIds.has(id))),
    };
    const parts = [selectedIds.size ? `${selectedIds.size} source controls` : '', selectedNodeIds.size ? `${selectedNodeIds.size} graph nodes` : ''].filter(Boolean);
    const pendingIds = new Set(authored.addedNodes.map(node => node.id));
    commit(deleteControls(spines, selectedIds), `Delete ${parts.join(' and ') || 'selection'}`, Object.fromEntries(Object.entries(nodeMoves).filter(([id]) => !pendingIds.has(id) || !removedIds.has(id))), nextDeleted.filter(id => !pendingIds.has(id)), nextAddedEdges, Object.fromEntries(Object.entries(nodeMerges).filter(([id, to]) => !removedIds.has(id) && !removedIds.has(to))), nextAuthoring);
    setSelection(new Set()); setNodeSelection(new Set()); setInspect(null);
    if (endpoints.length) setMessage(`Source endpoints retained: ${endpoints.map(c => c.id).join(', ')}. Endpoints can move but cannot be deleted; only selected interior controls and eligible graph nodes were removed.`);
  }
  function cancelDrawing() { setMaskPoints([]); setMaskError(''); setEditingMaskId(''); setBendPoints(null); setBendEdgeId(''); setMode('Select'); }
  function chooseTool(tool: Mode) {
    if (unfinishedDrawing) { setMessage('Finish or cancel the active drawing before choosing another tool.'); return; }
    cancelDrawing(); setMode(tool);
    if (tool === 'Draw walkable mask') setLayers(current => current.map((layer, index) => index === 6 ? { ...layer, visible: true } : layer));
    if (tool === 'Add transition landing') setLayers(current => current.map((layer, index) => index === 6 ? { ...layer, visible: true } : layer));
  }
  function showTransitionSetup() {
    setLeftPanelOpen(true);
    setFocusTransitionSetup(true);
    setMessage('Choose Escalator or Lift, then configure the landing in the left panel.');
  }
  function undo() { if (!busy) { cancelDrawing(); setCursor(Math.max(0, cursor - 1)); setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); } }
  function redo() { if (!busy) { cancelDrawing(); setCursor(Math.min(frames.length - 1, cursor + 1)); setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); } }
  function selectAll() { setSelection(new Set(visibleControls.filter(c => editableIds.has(c.id)).map(c => c.id))); setNodeSelection(new Set(editableNodeIds)); setInspect(null); }
  function chooseHandle(member: CoincidenceMember, additive = false, replace?: CoincidenceMember) {
    if (busy || !(member.kind === 'source' ? editableIds : editableNodeIds).has(member.id)) return;
    const next = selectHandle(selectedIds, selectedNodeIds, member, additive, replace);
    setSelection(next.sources); setNodeSelection(next.nodes); setInspect(member.kind === 'graph' ? member.id : null);
    setMessage(`${member.kind === 'source' ? 'Source control' : 'Graph node'} ${member.id}: ${ (member.kind === 'source' ? next.sources : next.nodes).has(member.id) ? 'selected for movement / deletion' : 'deselected'}. Repeat click to cycle nearby points; Shift / Ctrl toggles selection.`);
    return next;
  }
  function beginHandleGesture(event: ReactPointerEvent<SVGElement>, id: string, kind: 'source' | 'graph', point: Point) {
    if (!(kind === 'source' ? editableIds : editableNodeIds).has(id)) return;
    const additive = event.shiftKey || event.ctrlKey || event.metaKey || mode === 'Multi-select';
    const result = chooseHandle({ id, kind, point }, additive);
    if (!result) return;
    const { sources, nodes } = result;
    if (additive) return;
    const next: Gesture = { kind: 'move', start: point, current: point, path: [point], selected: sources, nodes, view, additive };
    gestureRef.current = next; setGesture(next);
    svg.current?.setPointerCapture(event.pointerId);
  }
  function handleKey(event: ReactKeyboardEvent<SVGCircleElement>, member: CoincidenceMember) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); event.stopPropagation();
    lastPick.current = null;
    chooseHandle(member, event.shiftKey || event.ctrlKey || event.metaKey || mode === 'Multi-select');
  }
  async function run(action: 'reconstruct' | 'preview' | 'draft' | 'save' | 'candidate') {
    if (!session || busy) return;
    if (bendPoints !== null) { setMessage('Finish or cancel the active polygon/bend drawing before previewing or saving.'); return; }
    const requestAuthoring = mode === 'Draw walkable mask' || maskPoints.length ? finishMask() : authored;
    if (!requestAuthoring) return;
    const requestKey = JSON.stringify({ spines, nodeMoves, deletedNodes, addedEdges, nodeMerges, authored: requestAuthoring, settings });
    setBusy(true); setMessage(action === 'preview' ? 'Generating an isolated admin preview; checks will be reported but will not block the preview...' : action === 'draft' ? 'Saving visual preview draft only...' : 'Reconstructing and validating source spines...');
    try {
      const mergeMoves = Object.fromEntries(Object.entries(nodeMerges).flatMap(([id, target]) => {
        const point = graph?.nodes.find(node => node.id === target)?.point;
        return point ? [[id, point]] : [];
      }));
      const pendingIds = new Set(requestAuthoring.addedNodes.map(node => node.id));
      const existingMoves = Object.fromEntries(Object.entries({ ...nodeMoves, ...mergeMoves }).filter(([id]) => !pendingIds.has(id)));
      const response = await api(floorId, action, { revision: session.revision, spines, ...graphEditPayload(existingMoves, Object.fromEntries(Object.entries(propagatedMoves).filter(([id]) => !pendingIds.has(id)))), deletedNodes, addedEdges, nodeMerges, ...authoringPayload(requestAuthoring, nodeMoves), edgeGeometryEdits: unmergedGraph ? anchoredEdgeGeometryEdits(unmergedGraph, requestAuthoring.edgeGeometryEdits) : requestAuthoring.edgeGeometryEdits, settings });
      const result: Report = {
        ...response,
        valid: response.valid ?? !!response.saved,
        diagnostics: (response.diagnostics || []).map((diagnostic: Partial<Report['diagnostics'][number]> & { kind?: string; count?: number }) => ({
          ...diagnostic,
          id: diagnostic.id || diagnostic.kind || `floor-${floorId}-preview`,
          changed: diagnostic.changed ?? (diagnostic.count || 0) > 0,
          state: diagnostic.state || 'unchecked',
          wallClearance: diagnostic.wallClearance ?? null,
          walkableBoundaryClearance: diagnostic.walkableBoundaryClearance ?? null,
          nearbyWallIndices: diagnostic.nearbyWallIndices || [],
          tests: diagnostic.tests || null,
        })),
        changes: response.changes || [],
        errors: response.errors || [],
      };
      setReport(result); setReportKey(requestKey);
      if (action !== 'draft') setLive(result);
      const rejected = result.diagnostics.filter(d => d.changed && d.tests && !d.tests.safe).map(d => d.id);
      const details = [
        rejected.length ? `Geometry diagnostics: ${rejected.join(', ')}` : '',
        result.unattachedSupportedRooms?.length ? `Room approaches lost: ${result.unattachedSupportedRooms.join(', ')}` : '',
        result.requiredRouteFailures?.length ? `Required routes disconnected: ${result.requiredRouteFailures.map(pair => pair.join(' ↔ ')).join(', ')}` : '',
        (result.errors?.[0] as { validationFailures?: string[] } | undefined)?.validationFailures?.length
          ? `Graph diagnostics: ${(result.errors[0] as { validationFailures: string[] }).validationFailures.join(', ')}` : '',
      ].filter(Boolean).join('. ');
      setMessage(result.saved
        ? `Saved source overrides and replaced the runtime ${floorId} graph. Graph node moves/deletions were applied; geometry findings are diagnostic. Backup created.`
        : action === 'draft' && result.candidate
        ? `Preview draft ${result.candidate} saved. Geometry was not checked; this does not change navigation. Use Run in admin to inspect it, or keep editing and save another draft.`
        : action === 'preview'
          ? result.previewError
            ? `Edited source line remains visible in admin preview, but graph reconstruction stopped at a safety check: ${result.previewError} The saved draft is unchanged; edit again or restore a previous draft.`
            : `Admin preview generated. It is isolated and not saved to navigation; checks are informational only. ${details || 'Inspect the generated line and test its route.'}`
        : action === 'candidate' && result.candidate
        ? `Visual-only candidate ${result.candidate} saved. It is not a routable graph and did not change source config or navigation. ${details ? `${details}. ` : ''}Restore it later to continue editing.`
          : result.valid
          ? 'Graph reconstructed; review diagnostics.'
          : `Reconstruction completed with diagnostics; the edited graph remains available for review. ${details || 'Inspect the connectivity report.'}${result.lostRoomPairs?.length ? ` ${result.lostRoomPairs.length} other room-pair connections changed; see the report.` : ''}`);
      if (result.candidate) setSession(s => s ? { ...s, candidates: [...new Set([...s.candidates, result.candidate!])] } : s);
      if (result.saved && result.graph && result.revision) {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('wayfinding-navigation-publication');
          channel.postMessage({ floorId });
          channel.close();
        }
        // The saved graph already contains the complete authored overlay.
        setFrames([{ spines, nodeMoves: {}, deletedNodes: [], addedEdges: [], nodeMerges: {}, authoring: emptyAuthoringEdits(), label: 'Loaded published graph' }]);
        setCursor(0);
        setSelection(new Set());
        setNodeSelection(new Set());
        setSession(s => s ? { ...s, revision: result.revision!, spines, floor: result.floor || draftFloor || s.floor, graph: result.graph!, runtimeGraph: result.runtimeGraph || result.graph!, evidence: response.sourceLinks || result.report?.edgeEvidence || evidence || s.evidence, config: response.config || exportConfig(s, spines) } : s);
        cancelDrawing(); setSelectedMask(''); setInspect(null);
        setSavedRouteNotice(true);
      }
      return result;
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  async function testRoute(editedGraph?: NavigationGraph) {
    if (!session) return;
    const rebuilt = editedGraph || (reportKey === draftKey ? report?.graph : undefined) || graph;
    if (!rebuilt) return;
    const routeFloor = reportKey === draftKey && report?.floor ? report.floor : draftFloor || session.floor;
    const start = routeFloor.rooms.find(r => r.id === routeStart)?.doorNodeId || null;
    const end = routeFloor.rooms.find(r => r.id === routeEnd)?.doorNodeId || null;
    // Both the displayed overlay and worker preview already include aliases.
    // Applying them twice references nodes that no longer exist after a merge.
    const simulationGraph = rebuilt;
    setRoutes({
      original: findRoute(session.runtimeGraph, session.floor.rooms.find(r => r.id === routeStart)?.doorNodeId || null, session.floor.rooms.find(r => r.id === routeEnd)?.doorNodeId || null, { accessibleOnly: accessible }),
      edited: findRoute({ ...simulationGraph, walls: [], navigableAreas: [] }, start, end, { accessibleOnly: accessible }),
      key: draftKey,
    });
  }
  async function saveReview() {
    // Source edits and graph moves/deletions share the immediate save action.
    await run('save');
  }
  function mergeSelectedNodes() {
    if (!graph || selectedNodeIds.size < 2 || busy) return;
    const [survivor, ...removed] = [...selectedNodeIds].sort();
    const aliases = Object.fromEntries(removed.map(id => [id, survivor]));
    try {
      mergeGraphNodes(graph, aliases, true, new Set(session?.mergeProtectedNodeIds || []));
      const combined = { ...nodeMerges, ...aliases };
      for (const id of Object.keys(combined)) while (combined[combined[id]]) combined[id] = combined[combined[id]];
      commit(spines, `Merge ${selectedNodeIds.size} overlapping junctions into ${survivor}`, nodeMoves, deletedNodes, addedEdges, combined);
      setSelection(new Set()); setNodeSelection(new Set([survivor])); setInspect(survivor);
      setMessage(t('Overlapping junctions merged. Incident routes and distinct edge evidence are retained. Undo restores the separate nodes.', 'تم دمج العقد المتطابقة مع الاحتفاظ بالمسارات وبيانات الأدلة. التراجع يعيد العقد المنفصلة.'));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  function connectSelectedNodes() {
    if (!graph || selectedNodeIds.size !== 2 || busy) return;
    const [from, to] = [...selectedNodeIds].sort();
    if (graph.edges.some(edge => edge.from === from && edge.to === to || edge.from === to && edge.to === from)
      || addedEdges.some(edge => edge.from === from && edge.to === to || edge.from === to && edge.to === from)) {
      setMessage(t('These nodes are already connected.', 'هذه العقد متصلة بالفعل.'));
      return;
    }
    const a = graph.nodes.find(n => n.id === from), b = graph.nodes.find(n => n.id === to);
    if (!a || !b || a.floorId !== floorId || b.floorId !== floorId || from === to) {
      setMessage(t('Choose two distinct nodes on this floor.', 'اختر عقدتين مختلفتين في هذا الطابق.'));
      return;
    }
    const distance = Math.hypot(b.point[0] - a.point[0], b.point[1] - a.point[1]);
    if (!Number.isFinite(distance) || distance <= 0) {
      setMessage(t('Nodes at the same coordinate cannot be connected.', 'لا يمكن توصيل عقدتين في الإحداثيات نفسها.'));
      return;
    }
    const edge: AddedGraphEdge = {
      id: `B03-${floorId}-admin-${crypto.randomUUID().replaceAll('-', '')}`,
      from, to, floorId, pathType: 'corridor', distance, distanceUnit: 'map-unit',
      accessibility: 'unknown', restriction: 'unknown', status: 'candidate',
      bidirectional: true, geometry: [a.point, b.point],
    };
    commit(spines, `Connect graph nodes ${from} and ${to}`, nodeMoves, deletedNodes, [...addedEdges, edge]);
    setNodeSelection(new Set());
    setSelection(new Set());
    setMode('Select');
    setInspect(edge.id);
    setMessage(t(
      'Candidate connection added. It will save only if its straight segment is covered by navigable-area evidence and does not touch a wall. Accessibility remains unknown.',
      'أُضيف اتصال مرشح. لن يُحفظ إلا إذا كان المقطع المستقيم داخل نطاق الحركة الموثق ولا يلامس جداراً. إمكانية الوصول غير مؤكدة.',
    ));
  }
  function reviewReady() {
    if (!sourceReferences.includes(authorSource)) {
      setReviewFocus('source');
      setMessage('Choose the source evidence for this landing.');
      return false;
    }
    if (!authorNote.trim() || authorNote.trim().length > 2000) {
      setReviewFocus('note');
      setMessage('Enter a short review note for this landing.');
      return false;
    }
    return true;
  }
  function beginTransitionPlacement() {
    if (!sourceReferences.includes(authorSource) && !reviewReady()) return;
    if (!selectedTransition && !transitionName.trim()) {
      setReviewFocus('name');
      setMessage('Name this escalator or lift before placing it.');
      return;
    }
    if (!authorNote.trim()) {
      setAuthorNote('Position selected in the admin editor; physical access and step-free suitability are unverified.');
    }
    chooseTool('Add transition landing');
  }
  function createNode(point: Point) {
    if (mode === 'Add transition landing' && !inSupportedWalkableArea(point, graph?.navigableAreas ?? [])) {
      setMessage('Place the landing inside the highlighted green walkable area. Do not add a walkable mask to extend this area.');
      return;
    }
    if (!reviewReady() || !point.every(Number.isFinite)) return;
    if (mode === 'Add transition landing' && !selectedTransition && !transitionName.trim()) {
      setReviewFocus('name');
      setMessage('Name this escalator or lift before placing it.');
      return;
    }
    const roomId = mode === 'Add room entry' ? entryRoom : undefined;
    if (mode === 'Add room entry' && !session?.floor.rooms.some(room => room.id === roomId)) { setMessage('Choose the room for this entry/approach first.'); return; }
    const created = mode === 'Add transition landing'
      ? {
          ...createCandidateNode(floorId, point, 'junction', undefined, authorSource, authorNote.trim()),
          type: transitionType,
          transitionId: selectedTransition?.transitionId || `B03-transition-${crypto.randomUUID().replaceAll('-', '')}`,
          transitionName: selectedTransition?.transitionName || transitionName.trim(),
          transitionAccessibility: selectedTransition?.transitionAccessibility || transitionAccessibility,
          transitionRestriction: selectedTransition?.transitionRestriction || transitionRestriction,
        }
      : createCandidateNode(floorId, point, roomId ? 'entrance' : 'junction', roomId, authorSource, authorNote.trim());
    const binding = roomId ? { roomId, nodeId: created.id, sourceReference: authorSource, note: authorNote.trim() } : null;
    commitAuthoring({ ...authored, addedNodes: [...authored.addedNodes, created], roomEntryBindings: binding ? [...authored.roomEntryBindings.filter(item => item.roomId !== roomId), binding] : authored.roomEntryBindings }, `Add candidate ${roomId ? 'room approach' : 'junction'} ${created.id}`);
    setTypeFilter('graph'); setRoomFilter(''); setSpineFilter(''); setConnectionFilter('all');
    setLayers(current => current.map((layer, index) => index === (roomId ? 0 : 2) ? { ...layer, visible: true, locked: false, selectable: true } : layer));
    setSelection(new Set()); setNodeSelection(new Set([created.id])); setInspect(created.id);
    setMode(mode === 'Add transition landing' ? 'Multi-select' : 'Select');
    setMessage(mode === 'Add transition landing'
      ? `Landing placed. Click a nearby corridor node, then Connect nodes. Save and publish this floor before adding the matching landing on the other floor.`
      : roomId ? 'Candidate room approach placed. Select it and a corridor junction, then Connect nodes before saving. Physical access and wheelchair accessibility remain unknown.' : 'Candidate junction placed. Select it and another graph node to connect; no automatic links or accessibility claims are added.');
  }
  function finishMask(): AuthoringEdits | null {
    if (busy || mode !== 'Draw walkable mask' || completedMaskPoints.current === maskPoints) return null;
    const fail = (error: string, field?: 'source' | 'note') => {
      setMaskError(error); setMessage(error);
      if (field) { setLeftPanelOpen(true); setReviewFocus(field); }
      return null;
    };
    const polygon = maskPoints.filter((point, index) => !index || point[0] !== maskPoints[index - 1][0] || point[1] !== maskPoints[index - 1][1]);
    if (polygon.length > 1 && polygon[0][0] === polygon.at(-1)![0] && polygon[0][1] === polygon.at(-1)![1]) polygon.pop();
    if (polygon.length < 3 || polygon.length > 256 || !polygon.every(point => point.every(Number.isFinite))) return fail(t('A walkable mask needs 3-256 finite polygon vertices.', 'يحتاج قناع المشي إلى 3-256 رأس مضلع بإحداثيات محدودة.'));
    const area = polygon.reduce((sum, point, i) => { const next = polygon[(i + 1) % polygon.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0);
    if (Math.abs(area) < 1e-9) return fail(t('The mask polygon must enclose a non-zero area.', 'يجب أن يحيط مضلع القناع بمساحة غير صفرية.'));
    if (!sourceReferences.includes(authorSource)) return fail(t('Choose supplied floor source evidence for this walkable mask.', 'اختر دليل مصدر الطابق المتاح لقناع المشي.'), 'source');
    if (!authorNote.trim() || authorNote.trim().length > 2000) return fail(t('Enter an authoring review note (1-2000 characters) for this walkable mask.', 'أدخل ملاحظة مراجعة التحرير (1-2000 حرف) لقناع المشي.'), 'note');
    const mask: NavigableAreaEdit = { id: editingMaskId || `B03-${floorId}-mask-${crypto.randomUUID().replaceAll('-', '')}`, operation: maskOperation, polygon: polygon.map(point => [...point] as Point), sourceReference: authorSource, note: authorNote.trim() };
    const next = { ...authored, navigableAreaEdits: editingMaskId ? authored.navigableAreaEdits.map(item => item.id === editingMaskId ? mask : item) : [...authored.navigableAreaEdits, mask] };
    completedMaskPoints.current = maskPoints;
    commitAuthoring(next, `${maskOperation === 'add' ? 'Add' : 'Subtract'} candidate walkable mask`);
    setSelectedMask(mask.id); cancelDrawing();
    setMessage('Walkable mask added to the draft with candidate/unknown review provenance. Run in admin checks the area union; supplied walls and room/void exclusions remain protected.');
    return next;
  }
  function beginBends() {
    if (!edge || busy) return;
    if (unfinishedDrawing) { setMessage('Finish or cancel the active drawing first.'); return; }
    if (addedEdges.some(item => item.id === edge.id)) { setMessage('This is a pending straight connection. Save and reload it before editing its bends.'); return; }
    const previous = authored.edgeGeometryEdits[edge.id];
    if (previous) { setAuthorSource(previous.sourceReference); setAuthorNote(previous.note); }
    setBendEdgeId(edge.id); setBendPoints(edge.geometry.map(point => [...point] as Point)); setMode('Edit edge bends');
    setMessage('Click the map to insert a bend in the nearest segment, or edit its coordinates in the inspector. Endpoints stay attached to graph nodes. Finish or cancel explicitly.');
  }
  function finishBends() {
    if (!reviewReady()) return;
    const owner = graph?.edges.find(item => item.id === bendEdgeId);
    if (!owner || !bendPoints || !bendPoints.every(point => point.every(Number.isFinite))) { setMessage('Choose an existing edge and finite bend coordinates.'); return; }
    const geometry = [owner.geometry[0], ...bendPoints.slice(1, -1), owner.geometry.at(-1)!];
    if (geometry.some((point, i) => i > 0 && point[0] === geometry[i - 1][0] && point[1] === geometry[i - 1][1])) { setMessage('Consecutive edge points must be distinct.'); return; }
    commitAuthoring({ ...authored, edgeGeometryEdits: { ...authored.edgeGeometryEdits, [owner.id]: { geometry, sourceReference: authorSource, note: authorNote.trim() } } }, `Edit bends of ${owner.id}`);
    cancelDrawing(); setMessage('Candidate edge bends updated. Endpoints remain attached; preview/save checks walking-area coverage and walls. Accessibility remains unknown.');
  }
  function bindSelectedEntry() {
    if (!node || !entryRoom || !reviewReady()) return;
    if ((node.type !== 'entrance' && node.type !== 'door') || node.status !== 'candidate' || (!pendingNodeIds.has(node.id) && !('adminReview' in node)) || node.roomId && node.roomId !== entryRoom) { setMessage('Select an administrator-reviewed candidate entry for the chosen room, not a junction or another room identity.'); return; }
    commitAuthoring({ ...authored, roomEntryBindings: [...authored.roomEntryBindings.filter(binding => binding.roomId !== entryRoom), { roomId: entryRoom, nodeId: node.id, sourceReference: authorSource, note: authorNote.trim() }] }, `Bind candidate entry to ${entryRoom}`);
    setMessage('Candidate room endpoint binding added. It needs a source-reviewed candidate entry connected to the graph; physical and wheelchair access remain unconfirmed.');
  }
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcuts.current = event => {
    if ((event.target as HTMLElement)?.closest('input,select,textarea,button')) return;
    if (event.key === 'Enter' && mode === 'Draw walkable mask') { event.preventDefault(); if (!busy) finishMask(); return; }
    if (event.code === 'Space') { event.preventDefault(); space.current = true; }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && ['z', 'y', 'a', 's'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'z') event.shiftKey ? redo() : undo();
      if (event.key.toLowerCase() === 'y') redo();
      if (event.key.toLowerCase() === 'a') selectAll();
      if (event.key.toLowerCase() === 's') void saveReview();
    }
    if (event.key === 'Escape') { cancelDrawing(); setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); gestureRef.current = null; pendingPick.current = null; lastPick.current = null; setGesture(null); }
    if (event.key === 'Delete') { event.preventDefault(); remove(); }
    const arrows: Record<string, Point> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[event.key]) { event.preventDefault(); const [x, y] = arrows[event.key]; move(x * (event.shiftKey ? 10 : nudge), y * (event.shiftKey ? 10 : nudge)); }
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => shortcuts.current(event);
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') space.current = false; };
    const blur = () => { space.current = false; gestureRef.current = null; pendingPick.current = null; lastPick.current = null; setGesture(null); };
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
    if (busy || event.button !== 0 && event.button !== 1) return;
    svg.current?.focus();
    pendingPick.current = null;
    const point = position(event);
    const target = event.target as SVGElement;
    const additive = event.shiftKey || event.ctrlKey || event.metaKey || mode === 'Multi-select';
    if (mode === 'Draw corridor' && !space.current && event.button === 0) { setDrawPoints([...drawPoints, point]); return; }
    if (!space.current && event.button === 0) {
      if (mode === 'Draw walkable mask') {
        const matrix = svg.current?.getScreenCTM();
        const first = maskPoints[0];
        if (matrix && first && maskPoints.length >= 3 && Math.hypot(
          matrix.a * first[0] + matrix.c * first[1] + matrix.e - event.clientX,
          matrix.b * first[0] + matrix.d * first[1] + matrix.f - event.clientY,
        ) <= 10) { event.preventDefault(); finishMask(); return; }
        const last = maskPoints.at(-1);
        // A double-click's second pointerdown is not a second polygon vertex.
        if (maskPoints.length < 256 && (!last || last[0] !== point[0] || last[1] !== point[1])) setMaskPoints([...maskPoints, point]);
        return;
      }
      if (mode === 'Add junction' || mode === 'Add room entry' || mode === 'Add transition landing') { createNode(point); return; }
      if (mode === 'Edit edge bends' && bendPoints) {
        let segment = 0, distance = Infinity;
        for (let i = 0; i < bendPoints.length - 1; i++) { const d = pointSegmentDistance(point, bendPoints[i], bendPoints[i + 1]); if (d < distance) { distance = d; segment = i; } }
        setBendPoints([...bendPoints.slice(0, segment + 1), point, ...bendPoints.slice(segment + 1)]); return;
      }
    }
    const matrix = svg.current?.getScreenCTM();
    if (matrix && !space.current && event.button === 0 && mode !== 'Lasso' && mode !== 'Add source control' && mode !== 'Measure clearance' && !target.dataset.edge) {
      const client: Point = [event.clientX, event.clientY];
      const candidates = pickHandles(pickableHandles, client, matrix);
      if (candidates.length) {
        const key = JSON.stringify([candidates.map(c => `${c.kind}:${c.id}`).sort(), matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
        const previous = lastPick.current;
        const repeated = !additive && previous?.key === key && Math.hypot(client[0] - previous.client[0], client[1] - previous.client[1]) <= HANDLE_DRAG_THRESHOLD;
        const member = (repeated ? candidates.find(c => c.id === previous.member.id && c.kind === previous.member.kind) : undefined)
          || candidates.find(c => (c.kind === 'source' ? selectedIds : selectedNodeIds).has(c.id)) || candidates[0];
        pendingPick.current = { key, client, member, candidates, repeated, dragged: false };
        if (additive) lastPick.current = null;
        beginHandleGesture(event, member.id, member.kind, point); return;
      }
    }
    lastPick.current = null;
    let selected = new Set(selection);
    let kind: Gesture['kind'] = mode === 'Lasso' ? 'lasso' : 'box';
    if (space.current || event.button === 1) kind = 'pan';
    else if (target.dataset.edge && layers[3].selectable) { setInspect(target.dataset.edge); setSelection(new Set()); setNodeSelection(new Set()); setMessage(`Navigation edge ${target.dataset.edge} selected. Its geometry and source evidence appear in the inspector.`); return; }
    else if (target.dataset.spine && mode === 'Add source control' && editable) {
      const owner = spines.find(s => s.id === target.dataset.spine)!;
      const segment = Number(target.dataset.segment);
      const next = spines.map(s => s.id === owner.id ? { ...s, coordinates: [...s.coordinates.slice(0, segment + 1), point, ...s.coordinates.slice(segment + 1)] } : s);
      commit(next, `Insert control in ${owner.id}`); setSelection(new Set([`${owner.id}/${segment + 1}`])); return;
    }
    const next: Gesture = { kind, start: point, current: point, path: [point], selected, nodes: new Set(selectedNodeIds), view, additive };
    gestureRef.current = next; setGesture(next); svg.current?.setPointerCapture(event.pointerId);
  }
  function moveGesture(event: ReactPointerEvent<SVGSVGElement>) {
    const current = gestureRef.current;
    if (!current) return;
    if (current.kind === 'move' && pendingPick.current && !pendingPick.current.dragged) {
      if (Math.hypot(event.clientX - pendingPick.current.client[0], event.clientY - pendingPick.current.client[1]) < HANDLE_DRAG_THRESHOLD) return;
      pendingPick.current.dragged = true; lastPick.current = null;
    }
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
    if (current.kind === 'move') {
      const pick = pendingPick.current;
      if (pick && !pick.dragged) {
        let member = pick.member;
        if (pick.repeated && pick.candidates.length > 1) {
          const index = pick.candidates.findIndex(c => c.id === member.id && c.kind === member.kind);
          member = pick.candidates[(index + 1) % pick.candidates.length];
          chooseHandle(member, false, pick.member);
        }
        lastPick.current = { key: pick.key, client: pick.client, member };
      } else {
        const next = translateSelection(spines, currentGraph, nodeMoves, current.selected, current.nodes, [current.current[0] - current.start[0], current.current[1] - current.start[1]], grid);
        commit(next.spines, `Drag ${current.selected.size} controls and ${current.nodes.size} graph nodes`, next.nodeMoves);
      }
    }
    if (current.kind === 'box' || current.kind === 'lasso') {
      const eligible = visibleControls.filter(c => editableIds.has(c.id));
      const found = current.kind === 'box' ? rectangleSelection(eligible, current.start, current.current, view[2] / 700) : eligible.filter(c => inside(c.point, current.path)).map(c => c.id);
      const graphItems: Control[] = (filteredNodes || []).filter(node => editableNodeIds.has(node.id))
        .map((node, index) => ({ id: node.id, spine: 'graph', index, point: node.point, protected: false }));
      const foundNodes = current.kind === 'box'
        ? rectangleSelection(graphItems, current.start, current.current, view[2] / 800)
        : graphItems.filter(item => inside(item.point, current.path)).map(item => item.id);
      setSelection(current.additive ? new Set([...selectedIds, ...found]) : new Set(found));
      setNodeSelection(current.additive ? new Set([...selectedNodeIds, ...foundNodes]) : new Set(foundNodes)); setInspect(null);
    }
    pendingPick.current = null; gestureRef.current = null; setGesture(null); if (svg.current?.hasPointerCapture(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
  }

  function resetSelected() {
    if (!session) return;
    commit(spines.map(s => ({ ...s, coordinates: s.coordinates.map((p, i) => selectedIds.has(`${s.id}/${i}`) ? session.spines.find(o => o.id === s.id)?.coordinates[i] || p : p) })), 'Reset selected control coordinates');
  }
  function exportDraft() {
    if (!session) return;
    const payload = { config: exportConfig(session, spines), previewNodeMoves: nodeMoves, previewDeletedNodes: deletedNodes, previewAddedEdges: addedEdges, previewNodeMerges: nodeMerges, ...authored };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'navigation-v2-admin-preview.json'; a.click(); URL.revokeObjectURL(url);
  }
  function selectSpine() { setSelection(new Set(controls(spines).filter(c => (!spineFilter || c.spine === spineFilter) && editableIds.has(c.id)).map(c => c.id))); }
  const selectedDiagnostic = live?.diagnostics.filter(d => selected.some(c => c.spine === d.id));
  const wallOverlay = showNearbyWalls ? selectedDiagnostic?.flatMap(d => d.nearbyWallIndices.map(index => ({
    index, wall: session?.graph.walls[index], contact: d.tests?.wallIndices.includes(index) ?? false,
  }))) || [] : [];
  const selectedNodeWalls = useMemo(() => node && session
    ? Math.min(...session.graph.walls.map(([a, b]) => pointSegmentDistance(node.point, a, b)))
    : undefined, [node, session]);
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
    <header className="editor-header"><div><span className="editor-brand">B03 / {floorId}</span><strong>{t('Navigation workshop', 'محرر مسارات الملاحة')}</strong><span className="editor-badge">GRAPH & SOURCE EDITOR</span></div><div><button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>{language === 'en' ? 'العربية' : 'English'}</button><a href="/">{t('Wayfinding', 'دليل المبنى')}</a></div></header>
    {savedRouteNotice && <div className="editor-route-notice" role="status">
      <span><strong>Runtime graph editor.</strong> Saves replace the {floorId} graph used by wayfinding; geometry and connectivity findings remain visible as diagnostics.</span>
      <button onClick={() => { document.getElementById('editor-route-regression')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); void testRoute(); }}>Preview edited route here</button>
      <button aria-label="Dismiss saved route notice" onClick={() => setSavedRouteNotice(false)}>Dismiss</button>
    </div>}
    <nav className="editor-toolbar" aria-label="Editor tools">
      <button className="primary transition-setup-shortcut" disabled={busy} onClick={showTransitionSetup}>Set up lift / escalator</button>
      {(['Select', 'Multi-select', 'Move', 'Lasso', 'Draw corridor', 'Add source control', 'Measure clearance', 'Add junction', 'Add room entry', 'Draw walkable mask'] as Mode[]).map(tool => <button key={tool} disabled={busy} aria-pressed={mode === tool} onClick={() => chooseTool(tool)}>{tool}</button>)}
      <button onClick={remove} disabled={(!selectedIds.size && (!graphEditing || !selectedNodeIds.size)) || busy}>Delete</button><span className="toolbar-divider" />
      <button onClick={connectSelectedNodes} disabled={selectedNodeIds.size !== 2 || busy}>{t('Connect nodes', 'وصل عقدتين')}</button>
      <button onClick={mergeSelectedNodes} disabled={selectedNodeIds.size < 2 || busy}>{t('Merge nodes', 'دمج العقد')}</button>
      <button onClick={undo} disabled={!cursor || busy}>Undo</button><button onClick={redo} disabled={cursor >= frames.length - 1 || busy}>Redo</button>
      <button onClick={() => void run('draft')} disabled={busy || (!changed && !maskPoints.length)}>Save preview draft</button><button onClick={() => void run('preview')} disabled={busy}>Run in admin</button>
      <button className="primary" onClick={() => void saveReview()} disabled={busy}>Save and publish</button>
    </nav>
    {mode === 'Draw walkable mask' && <section className="editor-drawing-bar" aria-label={t('Walkable mask drawing controls', 'أدوات رسم قناع المشي')}>
      <strong aria-live="polite">{t(`Pending drawing: ${maskPoints.length} mask vertices`, `رسم معلق: ${maskPoints.length} رؤوس للقناع`)}</strong>
      <span>{t('Finish here, or save/preview to finish and include this mask.', 'أنهِ الرسم هنا أو احفظ/عاين لإنهاء القناع وتضمينه.')}</span>
      <button type="button" disabled={busy} onClick={() => { finishMask(); }}>{t('Finish walkable mask', 'إنهاء قناع المشي')}</button>
      <button type="button" disabled={busy} onClick={cancelDrawing}>{t('Cancel mask', 'إلغاء القناع')}</button>
      {maskError && <p className="editor-drawing-error" role="alert">{maskError}</p>}
    </section>}
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
        <label>Node type<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="all">All nodes</option><option value="control">Source controls</option><option value="graph">All graph nodes</option><option value="junction">Derived junctions</option><option value="room">Room approaches</option><option value="candidate-entry">Admin candidate entries</option><option value="transition">Vertical transition landings</option></select></label>
        <label>Room<select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}><option value="">All rooms</option>{session.floor.rooms.map(r => <option key={r.id} value={r.id}>{r.code} · {r.name[language]}</option>)}</select></label>
        <label>Graph connection<select value={connectionFilter} onChange={e => setConnectionFilter(e.target.value)}><option value="all">All</option><option value="connected">Connected</option><option value="isolated">Isolated</option></select></label>
        <div className="button-pair"><button onClick={selectAll}>Select filtered</button><button aria-label="Clear selection" onClick={() => { setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); }}>Clear</button></div>
        <button onClick={selectSpine}>Select spine controls</button>
        <button onClick={() => { const owner = spines.find(s => s.id === spineFilter); const edgeIds = evidence?.filter(e => owner && e.sourceSpineIds.includes(owner.index)).map(e => e.edgeId) || []; const nodes = graph?.edges.filter(e => edgeIds.includes(e.id)).flatMap(e => [e.from, e.to]) || []; setMessage(`Derived junctions for ${spineFilter}: ${[...new Set(nodes)].join(', ')}. Edit their source controls to regenerate.`); setInspect(nodes[0] || null); }}>Inspect connected junctions</button>
        <section ref={authoringPanel} className="authoring-tools" aria-label="Candidate geometry authoring">
          <h2>Add an escalator or lift landing</h2>
          <p className="muted">The visible floor drawing is selected as evidence. Place this landing, then pair it on the other floor.</p>
          <label>Transition kind<select data-transition-kind value={transitionType} disabled={busy || mode === 'Add transition landing'} onChange={event => { setTransitionType(event.target.value as 'escalator' | 'elevator'); setTransitionId(''); setTransitionName(''); }}><option value="escalator">Escalator</option><option value="elevator">Lift</option></select></label>
          <label>Pair with landing<select value={transitionId} disabled={busy} onChange={event => { const candidate = transitionOptions.find(item => item.transitionId === event.target.value); setTransitionId(event.target.value); setTransitionName(candidate?.transitionName || ''); if (candidate) { setTransitionType(candidate.type); setTransitionAccessibility(candidate.transitionAccessibility); setTransitionRestriction(candidate.transitionRestriction); } }}><option value="">Start a new pair</option>{transitionOptions.map(candidate => <option key={candidate.transitionId} value={candidate.transitionId}>{candidate.transitionName} · floor {candidate.floorId} · {candidate.type}</option>)}</select></label>
          <label>Transition name<input data-transition-name value={transitionName} disabled={busy || !!selectedTransition} maxLength={80} onChange={event => setTransitionName(event.target.value)} /></label>
          <button className="primary transition-place-button" disabled={busy} onClick={beginTransitionPlacement}>Place landing on drawing</button>
          <details className="transition-advanced"><summary>Access and status</summary>
            <label>Step-free access<select value={transitionAccessibility} disabled={busy || !!selectedTransition} onChange={event => setTransitionAccessibility(event.target.value as 'confirmed' | 'inaccessible' | 'unknown')}><option value="unknown">Unknown</option><option value="confirmed">Confirmed step-free</option><option value="inaccessible">Not step-free</option></select></label>
            <label>Transition status<select value={transitionRestriction} disabled={busy || !!selectedTransition} onChange={event => setTransitionRestriction(event.target.value as 'open' | 'closed' | 'unknown')}><option value="unknown">Unknown</option><option value="open">Open</option><option value="closed">Closed</option></select></label>
          </details>
          <details ref={sourceOverridePanel} className="transition-advanced">
            <summary>Use different source evidence</summary>
            <SourceEvidencePicker key={floorId} references={sourceReferences} value={authorSource} disabled={busy} language={language} onChange={setAuthorSource} />
          </details>
          <details ref={reviewDetails} className="transition-advanced">
            <summary>Review note</summary>
            <label>Authoring review note<textarea value={authorNote} disabled={busy} maxLength={2000} onChange={event => setAuthorNote(event.target.value)} /></label>
          </details>
          {mode === 'Add transition landing' && <p role="status">Click inside the green walkable area to place the {transitionType} landing. <button disabled={busy} onClick={cancelDrawing}>Cancel</button></p>}
          <h2>Other map edits</h2>
          <label>Entry / approach room<select value={entryRoom} disabled={busy} onChange={event => setEntryRoom(event.target.value)}><option value="">Choose room</option>{session.floor.rooms.map(room => <option value={room.id} key={room.id}>{room.code} - {room.name[language]}</option>)}</select></label>
          <div className="button-pair"><button disabled={busy} onClick={() => chooseTool('Add junction')}>Place junction</button><button disabled={busy || !entryRoom} onClick={() => chooseTool('Add room entry')}>Place room approach</button></div>
          {(mode === 'Add junction' || mode === 'Add room entry') && <p role="status">Click the map to place the candidate {mode === 'Add junction' ? 'junction' : 'room approach'}. <button disabled={busy} onClick={cancelDrawing}>Cancel node placement</button></p>}
          <label>Walkable mask operation<select value={maskOperation} disabled={busy} onChange={event => setMaskOperation(event.target.value as 'add' | 'subtract')}><option value="add">Add supported walking area</option><option value="subtract">Subtract walking area</option></select></label>
          <button disabled={busy} onClick={() => chooseTool('Draw walkable mask')}>Start walkable polygon</button>
          {mode === 'Draw walkable mask' && <div><p>{t('Click vertices in order. Click the first vertex, double-click the last, press Enter, or use Finish walkable mask to close it.', 'انقر رؤوس المضلع بالترتيب. للإغلاق انقر الرأس الأول أو انقر الأخير مرتين أو اضغط Enter أو زر إنهاء القناع.')} {maskPoints.length} mask vertices.</p><ol className="authoring-vertices">{maskPoints.map((point, index) => <li key={index}><span>Vertex {index + 1}</span><div className="button-pair">{[0, 1].map(axis => <label key={axis}>{axis ? 'Y' : 'X'}<input aria-label={`Mask vertex ${index + 1} ${axis ? 'Y' : 'X'}`} type="number" step="any" value={point[axis]} disabled={busy} onChange={event => { if (event.target.value === '') return; const value = Number(event.target.value); if (Number.isFinite(value)) setMaskPoints(maskPoints.map((old, i) => i === index ? old.map((v, a) => a === axis ? value : v) as Point : old)); }} /></label>)}</div><button disabled={busy} onClick={() => setMaskPoints(maskPoints.filter((_, i) => i !== index))}>Remove vertex {index + 1}</button></li>)}</ol></div>}
          <label>Draft walkable mask<select value={selectedMask} onChange={event => setSelectedMask(event.target.value)}><option value="">Choose draft mask</option>{authored.navigableAreaEdits.map((mask, index) => <option key={mask.id} value={mask.id}>{index + 1} - {mask.operation} - {mask.polygon.length} vertices</option>)}</select></label>
          <p className="muted">Walkable masks can refine supported areas. They cannot extend circulation outside the existing green areas.</p>
          <div className="button-pair"><button disabled={busy || unfinishedDrawing || !authored.navigableAreaEdits.some(mask => mask.id === selectedMask)} onClick={() => { const mask = authored.navigableAreaEdits.find(item => item.id === selectedMask); if (!mask) return; cancelDrawing(); setEditingMaskId(mask.id); setMaskPoints(mask.polygon.map(point => [...point] as Point)); setMaskOperation(mask.operation); setAuthorSource(mask.sourceReference); setAuthorNote(mask.note); setMode('Draw walkable mask'); setLayers(current => current.map((layer, index) => index === 6 ? { ...layer, visible: true } : layer)); }}>Edit draft mask</button><button disabled={busy || unfinishedDrawing || !selectedMask} onClick={() => { commitAuthoring({ ...authored, navigableAreaEdits: authored.navigableAreaEdits.filter(mask => mask.id !== selectedMask) }, 'Remove draft walkable mask'); setSelectedMask(''); cancelDrawing(); }}>Remove draft mask</button></div>
          <p className="muted">Draft: {authored.addedNodes.length} nodes, {authored.roomEntryBindings.length} room bindings, {authored.navigableAreaEdits.length} masks, {Object.keys(authored.edgeGeometryEdits).length} edge edits.</p>
        </section>
        <h2>Navigation edge selection</h2>
        <label>Inspect graph edge<select value={edge?.id || ''} disabled={busy} onChange={event => { setInspect(event.target.value || null); setSelection(new Set()); setNodeSelection(new Set()); }}><option value="">Choose a navigation edge</option>{graph?.edges.filter(item => !roomFilter || [item.from, item.to].some(id => graph.nodes.find(node => node.id === id)?.roomId === roomFilter)).map(item => <option value={item.id} key={item.id}>{item.id} ({item.from} to {item.to})</option>)}</select></label>
        <p className="muted">Graph junctions are purple circles; candidate additions have a filled center. Room approaches have an orange diamond. Source controls are larger teal circles and remain separate from graph topology.</p>
        <h2>Spine operations</h2><p className="muted">Drag unlocked graph nodes and source controls together. Save and publish applies source edits and graph changes immediately; diagnostics remain informational.</p>
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
        <div className="canvas-heading"><span>{mode} / {selection.size + nodeSelection.size} selected</span><span>{mode === 'Draw walkable mask' ? t(`Pending drawing: ${maskPoints.length} mask vertices`, `رسم معلق: ${maskPoints.length} رؤوس للقناع`) : bendPoints !== null ? t('Pending edge bend drawing', 'رسم انحناءات مسار معلق') : changed ? 'Unsaved preview edits' : 'Source unchanged'} · {isGraphCurrent ? 'Graph current' : 'Graph preview required'}</span></div>
        <div className={split ? 'canvas-pair' : 'canvas-single'}>
          {split && <svg className="original-canvas" aria-label="Original route comparison" viewBox={view.join(' ')}><Architecture session={session} layers={layers} />{session.spines.map(s => <polyline key={s.id} points={pointsString(s.coordinates)} fill="none" stroke="#71828d" strokeWidth="2" />)}{routes && <polyline points={pointsString(routes.original.points)} fill="none" stroke="#c97525" strokeWidth="5" />}<text x={view[0] + 15} y={view[1] + 25} fontSize="18">Original</text></svg>}
          <svg ref={svg} className="editor-canvas" role="application" aria-label="Navigation graph canvas" tabIndex={0} viewBox={view.join(' ')} onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture} onDoubleClick={event => { if (!busy && mode === 'Draw walkable mask') { event.preventDefault(); finishMask(); } }} onPointerCancel={() => { gestureRef.current = null; pendingPick.current = null; lastPick.current = null; setGesture(null); }} onWheel={event => { const p = position(event), factor = event.deltaY > 0 ? 1.12 : 1 / 1.12; const width = Math.max(80, Math.min(6200, view[2] * factor)); const ratio = width / view[2]; setView([p[0] - (p[0] - view[0]) * ratio, p[1] - (p[1] - view[1]) * ratio, width, view[3] * ratio]); }}>
            <Architecture session={session} layers={layers} hideAreas />
            {layers[6].visible && <g pointerEvents="none" aria-label="Walkable area preview">{(reportKey === draftKey && report?.graph ? report.graph.navigableAreas : session.graph.navigableAreas).map((ring, i) => <polygon key={`walkable-${i}`} points={pointsString(ring)} fill={layers[6].color} fillOpacity=".13" stroke="none" />)}{authored.navigableAreaEdits.map(mask => <polygon key={mask.id} data-mask={mask.id} points={pointsString(mask.polygon)} fill={mask.operation === 'add' ? '#25804b' : '#cc3b43'} fillOpacity=".15" stroke={selectedMask === mask.id ? '#d98918' : mask.operation === 'add' ? '#25804b' : '#cc3b43'} strokeDasharray="5 3" vectorEffect="non-scaling-stroke"><title>{mask.operation} candidate mask: {mask.note}</title></polygon>)}</g>}
            {maskPoints.length > 0 && <g pointerEvents="none"><polyline data-testid="active-mask-polygon" points={pointsString(maskPoints)} fill="none" stroke="#d98918" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />{maskPoints.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r={view[2] / 500} fill="#d98918" />)}</g>}
            {bendPoints && <g pointerEvents="none"><polyline data-testid="active-edge-bends" points={pointsString(bendPoints)} fill="none" stroke="#d98918" strokeWidth="3" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />{bendPoints.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r={view[2] / 500} fill={index === 0 || index === bendPoints.length - 1 ? '#007d91' : '#d98918'} />)}</g>}
            {wallOverlay.map(({ index, wall, contact }) => wall ? <line key={`wall-guide-${index}`} x1={wall[0][0]} y1={wall[0][1]} x2={wall[1][0]} y2={wall[1][1]} stroke={contact ? '#ff1738' : '#e58c17'} strokeWidth={contact ? 3 : 1.8} vectorEffect="non-scaling-stroke" pointerEvents="none"><title>{contact ? 'Intersected source wall' : 'Nearby source wall'} · #{index}</title></line> : null)}
            {drawPoints.length > 0 && <polyline points={pointsString(drawPoints)} fill="none" stroke="#d98918" strokeDasharray="4 4" strokeWidth="3" pointerEvents="none" />}
            {compare && session.spines.map(s => <polyline key={s.id} points={pointsString(s.coordinates)} fill="none" stroke="#77838d" strokeDasharray="4 4" strokeWidth="1.4" pointerEvents="none" />)}
            {layers[3].visible && graph?.edges.map(e => <g key={e.id}><polyline points={pointsString(e.geometry)} fill="none" stroke={inspect === e.id ? '#ec9513' : layers[3].color} opacity={isGraphCurrent ? .6 : .2} strokeWidth={inspect === e.id ? 4 : 1.5} pointerEvents="none" /><polyline data-edge={e.id} role="button" aria-label={`Navigation edge ${e.id}`} tabIndex={layers[3].selectable && !busy ? 0 : -1} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setInspect(e.id); setSelection(new Set()); setNodeSelection(new Set()); } }} points={pointsString(e.geometry)} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" pointerEvents={layers[3].selectable ? 'stroke' : 'none'} style={{ cursor: 'pointer' }}><title>{e.id} - select to inspect navigation geometry</title></polyline></g>)}
            {layers[1].visible && preview.filter(s => !spineFilter || s.id === spineFilter).map(s => { const diagnostic = live?.diagnostics.find(d => d.id === s.id); const color = diagnostic?.changed ? diagnostic.state === 'red' ? '#cc3b43' : diagnostic.state === 'orange' ? '#d98918' : diagnostic.state === 'green' ? '#25804b' : '#7b8790' : layers[1].color; return <g key={s.id}>{s.coordinates.slice(1).map((p, i) => <line key={i} data-spine={s.id} data-segment={i} x1={s.coordinates[i][0]} y1={s.coordinates[i][1]} x2={p[0]} y2={p[1]} stroke={color} strokeWidth={mode === 'Add source control' ? 5 : 2.5} />)}{mode === 'Measure clearance' && <polyline points={pointsString(s.coordinates)} fill="none" stroke={color} strokeOpacity=".1" strokeWidth={settings.preferred * 2} pointerEvents="none" />}</g>; })}
            {filteredNodes?.map(n => { const layer = n.roomId ? layers[0] : layers[2]; const eligible = editableNodeIds.has(n.id), radius = view[2] / 800; const candidate = pendingNodeIds.has(n.id) || 'adminReview' in n; return layer.visible ? <g key={n.id}>{n.roomId && <path d={`M${n.point[0]},${n.point[1] - radius * 2}l${radius * 2},${radius * 2}l${-radius * 2},${radius * 2}l${-radius * 2},${-radius * 2}Z`} fill="none" stroke={layer.color} strokeWidth="1" pointerEvents="none" vectorEffect="non-scaling-stroke" />}<circle role="button" tabIndex={eligible && !busy ? 0 : -1} aria-label={`Graph node ${n.id}`} aria-pressed={selectedNodeIds.has(n.id)} aria-disabled={!eligible || busy} onKeyDown={event => handleKey(event, { ...n, kind: 'graph' })} data-node={n.id} data-node-role={n.roomId ? 'room-approach' : n.type} data-candidate={candidate || undefined} data-testid={`graph-node-${n.id}`} cx={n.point[0]} cy={n.point[1]} r={radius} fill={selectedNodeIds.has(n.id) ? '#ffe7a0' : inspect === n.id ? '#ffd36a' : candidate ? layer.color : 'white'} stroke={layer.color} strokeWidth={selectedNodeIds.has(n.id) ? 2 : 1.3} style={{ cursor: eligible ? 'grab' : 'default' }}><title>{n.id} - {n.roomId ? 'room approach' : n.type}{candidate ? ' - admin candidate; access unknown' : ''} - Enter / Space to select; arrows to move; Delete to remove</title></circle></g> : null; })}
            {layers[1].visible && visibleControls.map(c => <circle key={c.id} role="button" tabIndex={editable && !busy ? 0 : -1} aria-label={`Source control ${c.id}`} aria-pressed={selectedIds.has(c.id)} aria-disabled={!editable || busy} onKeyDown={event => handleKey(event, { ...c, kind: 'source' })} data-control={c.id} data-testid={`control-${c.id}`} cx={c.point[0]} cy={c.point[1]} r={Math.max(view[2] / 520, 8)} fill={selectedIds.has(c.id) ? '#ffe7a0' : '#fff'} stroke={selectedIds.has(c.id) ? '#a96500' : layers[1].color} strokeWidth={selectedIds.has(c.id) ? 2 : 1.2} style={{ cursor: editable ? 'grab' : 'default' }}><title>{c.id} · Enter / Space to select; arrows to move; source endpoints cannot be deleted</title></circle>)}
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
        <div aria-live="polite" aria-label="Selection targets">
          <strong>Movement / deletion targets: {selectedIds.size + selectedNodeIds.size}</strong>
          <ul>{[...selectedIds].map(id => <li key={`source:${id}`}>Source control <code>{id}</code></li>)}{[...selectedNodeIds].map(id => <li key={`graph:${id}`}>Graph node <code>{id}</code></li>)}</ul>
          {!!selectedIds.size && <p className="muted">Source endpoints can move but cannot be deleted. Repeat a click to cycle nearby overlapping points. Tab then Enter / Space selects an individual point; Shift / Ctrl toggles it.</p>}
        </div>
        {stats ? <><div className="selection-count">{stats.count}<span> source controls selected</span></div><dl><dt>Bounding box</dt><dd>{stats.bounds.map(fmt).join(', ')}</dd><dt>Average X / Y</dt><dd>{stats.average.map(fmt).join(' / ')}</dd><dt>Drag displacement</dt><dd>{delta.map(v => fmt(grid ? Math.round(v / grid) * grid : v)).join(' / ')}</dd><dt>Editable controls</dt><dd>{selectedIds.size}</dd></dl>
          {selected.length === 1 && <><code>{selected[0].id}</code><div className="button-pair">{[0, 1].map(axis => <label key={axis}>{axis ? 'Y' : 'X'}<input aria-label={`Node ${axis ? 'Y' : 'X'}`} type="number" step="any" value={selected[0].point[axis]} disabled={busy || !editable} onChange={event => { if (event.target.value === '') return; const value = Number(event.target.value); move(axis === 0 ? value - selected[0].point[0] : 0, axis === 1 ? value - selected[0].point[1] : 0); }} /></label>)}</div><p className="muted">Editable source point · {selected[0].spine}</p></>}
          <button onClick={resetSelected} disabled={!selectedIds.size}>Reset selected nodes</button>
          {selectedDiagnostic?.map(d => <div className={`diagnostic ${d.state}`} key={d.id}><strong>{d.id}</strong><div>Wall: {fmt(d.wallClearance ?? undefined)} du</div><div>Walkable boundary: {fmt(d.walkableBoundaryClearance ?? undefined)} du</div><div>Geometry status: {d.tests ? d.tests.safe ? 'checked' : 'issues reported' : 'not checked'}</div>{d.tests && !d.tests.safe && <pre>{JSON.stringify(d.tests, null, 2)}</pre>}</div>)}
          <details><summary>Source references</summary><pre>{[...new Set(spines.filter(s => selected.some(c => c.spine === s.id)).flatMap(s => s.sourceReferences))].join('\n')}</pre></details>
        </> : <p className="muted">Select source controls to edit. Select derived nodes or edges to inspect their evidence.</p>}
        {node && <><code>{node.id}</code><dl><dt>Type</dt><dd>{node.type} · draggable preview node</dd><dt>Coordinate</dt><dd>{node.point.map(fmt).join(', ')}</dd><dt>Room</dt><dd>{node.roomId || 'None'}</dd><dt>Nearest wall</dt><dd>{fmt(selectedNodeWalls)} du</dd><dt>Selected graph nodes</dt><dd>{nodeSelection.size}</dd></dl>{nodeSelection.size === 1 && <div className="button-pair">{[0, 1].map(axis => <label key={axis}>{axis ? 'Y' : 'X'}<input aria-label={`Graph node ${axis ? 'Y' : 'X'}`} type="number" step="any" value={node.point[axis]} disabled={busy || !editableNodeIds.has(node.id)} onChange={event => { if (event.target.value === '') return; const value = Number(event.target.value); moveSelectedNodes(axis ? 0 : value - node.point[0], axis ? value - node.point[1] : 0); }} /></label>)}</div>}<details open><summary>Connected edges</summary>{graph?.edges.filter(e => e.from === node.id || e.to === node.id).map(e => <button key={e.id} onClick={() => setInspect(e.id)}>{e.id}</button>)}</details></>}
        {(selection.size > 0 || nodeSelection.size > 0) && <>
          <p>{nodeSelection.size} graph nodes selected</p>
          <div className="button-pair"><label>Move X<input type="number" value={dx} onChange={e => setDx(Number(e.target.value))} /></label><label>Move Y<input type="number" value={dy} onChange={e => setDy(Number(e.target.value))} /></label></div>
          <button disabled={(!selectedIds.size && !selectedNodeIds.size) || busy} onClick={() => move(dx, dy)}>Translate selection</button>
          <div className="nudge-buttons"><button disabled={busy} onClick={() => move(-nudge, 0)}>Left</button><button disabled={busy} onClick={() => move(0, -nudge)}>Up</button><button disabled={busy} onClick={() => move(0, nudge)}>Down</button><button disabled={busy} onClick={() => move(nudge, 0)}>Right</button></div>
        </>}
        {node && (node.type === 'entrance' || node.type === 'door') && <button disabled={busy || !entryRoom} onClick={bindSelectedEntry}>Bind selected entry to chosen room</button>}
        {edge && <section aria-label="Navigation edge inspector"><code>{edge.id}</code><dl><dt>From (anchored)</dt><dd>{edge.from}</dd><dt>To (anchored)</dt><dd>{edge.to}</dd><dt>Distance</dt><dd>{fmt(edge.distance)} du</dd><dt>Source spines</dt><dd>{edgeEvidence?.sourceSpineIds.join(', ') || 'No source-spine link'}</dd></dl><details><summary>Geometry / source evidence</summary><pre>{JSON.stringify({ geometry: edge.geometry, evidence: edgeEvidence }, null, 2)}</pre></details><button onClick={beginBends} disabled={busy || addedEdges.some(item => item.id === edge.id)}>Edit edge bends</button><button disabled={busy || unfinishedDrawing || !authored.edgeGeometryEdits[edge.id]} onClick={() => { const edits = { ...authored.edgeGeometryEdits }; delete edits[edge.id]; commitAuthoring({ ...authored, edgeGeometryEdits: edits }, `Reset edge bends ${edge.id}`); cancelDrawing(); }}>Reset edge bends</button><p className="muted">Edit this navigation edge without repurposing its source controls. Both endpoints remain anchored to graph nodes. Edited geometry remains candidate; accessibility becomes unknown.{addedEdges.some(item => item.id === edge.id) ? ' Pending connections are straight: save and reload before editing their bends.' : ''}</p></section>}
        {bendPoints && <section aria-label="Edge bend editor"><h2>Edge bend editor</h2><code>{bendEdgeId}</code><p>Click the map to insert a bend in its nearest segment. Change coordinates below. Move the graph nodes separately to change anchored endpoints.</p><ol className="authoring-vertices">{bendPoints.map((point, index) => { const anchored = index === 0 || index === bendPoints.length - 1; return <li key={index}><span>{anchored ? 'Anchored endpoint' : `Bend ${index}`}</span><div className="button-pair">{[0, 1].map(axis => <label key={axis}>{axis ? 'Y' : 'X'}<input aria-label={`Edge point ${index} ${axis ? 'Y' : 'X'}`} type="number" step="any" value={point[axis]} disabled={anchored || busy} onChange={event => { if (event.target.value === '') return; const value = Number(event.target.value); if (Number.isFinite(value)) setBendPoints(bendPoints.map((old, i) => i === index ? old.map((v, a) => a === axis ? value : v) as Point : old)); }} /></label>)}</div>{!anchored && <button disabled={busy} onClick={() => setBendPoints(bendPoints.filter((_, i) => i !== index))}>Remove bend {index}</button>}</li>; })}</ol><div className="button-pair"><button disabled={busy} onClick={finishBends}>Finish edge bends</button><button disabled={busy} onClick={cancelDrawing}>Cancel bends</button></div></section>}
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
        <button disabled={busy} onClick={() => { commit(session.spines, 'Restore loaded source configuration', {}, [], [], {}, emptyAuthoringEdits()); cancelDrawing(); setSelectedMask(''); setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); }}>Restore loaded configuration</button><button onClick={exportDraft}>Export configuration JSON</button><button onClick={() => void run('draft')} disabled={busy}>Save preview draft</button>
        <label>Saved candidate<select value={candidate} onChange={e => setCandidate(e.target.value)}><option value="">Choose candidate</option>{session.candidates.map(c => <option key={c}>{c}</option>)}</select></label>
        <button disabled={!candidate || busy} onClick={async () => { try { const result = await api(floorId, 'restore', { revision: session.revision, candidate }); commit(result.spines, `Restore ${candidate}`, result.nodeMoves || {}, result.deletedNodes || [], result.addedEdges || [], result.nodeMerges || {}, authoringEdits(result)); cancelDrawing(); setSelectedMask(''); setSelection(new Set()); setNodeSelection(new Set()); setInspect(null); setMessage('Saved visual draft restored, including masks, added nodes, room bindings and edge bends. Graph edits apply in the admin simulation and are included in publish.'); } catch (error) { setMessage(String(error)); } }}>Restore candidate into draft</button>
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
