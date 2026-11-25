'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Building2, Check, ChevronDown, Compass, Headphones, Info, Layers, LocateFixed, MapPin, Minus, Navigation, Plus, RotateCcw, Search, Square, Volume2, VolumeX, X } from 'lucide-react';
import type { Floor, FloorBundle, FloorData, Language, NavigationGraph, Room, RoomCategory, RoomContent } from '@wayfinding/map-engine';
import { searchRooms } from '@wayfinding/search';
import { getDirection, t } from '@wayfinding/i18n';
import { createBrowserTTS, type TTSService } from '@wayfinding/audio';
import { findRoute } from '@wayfinding/routing';
import { createRouteSmoother, routeProtectedPoints } from '../../../packages/routing/src/visual-route';
import { clipVisualRouteAtProgress, playbackPlanDuration, playbackPlanPosition, routePlaybackPlan, type PlaybackPhase } from './routePlayback';
import { SignLanguageDialog } from './SignLanguageDialog';
import { isPlaceholderVideo } from './RoomContentPresentation';
import { DestinationDetails } from './DestinationDetails';
import { TransitionChoiceDialog, type TransitionChoice } from './TransitionChoiceDialog';
import { multiFloorNavigation, routeGraphForTransition } from '../lib/multi-floor-navigation';
const FloorMap = dynamic(() => import('./FloorMap'), { ssr: false });
type DirectoryRoom = Pick<Room, 'id' | 'code' | 'buildingId' | 'floorId' | 'name' | 'category' | 'centroid' | 'doorNodeId' | 'aliases' | 'public' | 'navigationPartial' | 'navigationNote' | 'geometryStatus' | 'contentRef'>;
type FloorDirectory = { floor: Floor; rooms: DirectoryRoom[]; kiosks: FloorData['kiosks']; navigationDefaults: FloorData['navigationDefaults']; revision: string };
const categoryKeys: Record<RoomCategory, string> = { classroom: 'categoryClassroom', office: 'categoryOffice', laboratory: 'categoryLaboratory', service: 'categoryService', restroom: 'categoryRestroom', circulation: 'categoryCirculation', other: 'categoryOther' };
const copy = { en: { brand: 'NAID', wayfinding: 'CAMPUS WAYFINDING', welcome: 'Where would you like to go?', explore: 'Explore the ground floor', all: 'All spaces', spaces: 'spaces', browse: 'Browse', navigate: 'Navigate', floorNote: 'One floor. Every destination.', overview: 'Floor overview', directoryHelp: 'Find a room in the directory or select its marker on the map.', source: 'Source-based floor plan', marker: 'Room marker', selected: 'Selected', selectedDetails: 'DESTINATION DETAILS', mapReview: 'Outlines under review', resetKiosk: 'Reset to kiosk', plan: 'Plan your visit', roomCount: 'rooms on this floor', sourcePreview: 'Drawing detail', noKiosk: 'Kiosk position not configured', footer: 'B03 / GROUND FLOOR', category: 'Filter by category' }, ar: { brand: 'الأكاديمية', wayfinding: 'دليل التنقل في الحرم', welcome: 'إلى أين تريد الذهاب؟', explore: 'استكشف الطابق الأرضي', all: 'جميع المساحات', spaces: 'مساحات', browse: 'استكشاف', navigate: 'التنقل', floorNote: 'طابق واحد. جميع الوجهات.', overview: 'نظرة على الطابق', directoryHelp: 'ابحث في الدليل أو اختر علامة الغرفة على الخريطة.', source: 'خريطة مستندة إلى المصدر', marker: 'علامة الغرفة', selected: 'محدد', selectedDetails: 'تفاصيل الوجهة', mapReview: 'الحدود قيد المراجعة', resetKiosk: 'العودة إلى الكشك', plan: 'خطط لزيارتك', roomCount: 'غرفة في هذا الطابق', sourcePreview: 'تفصيل من الرسم', noKiosk: 'لم يتم تحديد موقع الكشك', footer: 'B03 / الطابق الأرضي', category: 'تصفية حسب الفئة' } };

export function WayfindingApp({ floorData, graph, contents, floorBundle, initialGraphLoaded = true, floorDirectories, initialRevision, floorBundles: suppliedFloorBundles, routeGraph: suppliedRouteGraph, floorOptions, audioService, configuredKioskId }: { floorData?: FloorData; graph?: NavigationGraph; contents?: RoomContent[]; floorBundle?: FloorBundle; initialGraphLoaded?: boolean; floorDirectories?: FloorDirectory[]; initialRevision?: string; floorBundles?: FloorBundle[]; routeGraph?: NavigationGraph; floorOptions?: Floor[]; audioService?: TTSService; configuredKioskId?: string }) {
  const router = useRouter();
  const initialBundle = floorBundle ?? suppliedFloorBundles?.[0] ?? (floorData && graph && contents ? { floorData, graph, contents } : null);
  if (!initialBundle) throw new Error('WayfindingApp requires a floor bundle');
  const directories = useMemo(() => floorDirectories ?? (suppliedFloorBundles ?? [initialBundle]).map(bundle => ({
    floor: bundle.floorData.floor,
    rooms: bundle.floorData.rooms,
    kiosks: bundle.floorData.kiosks,
    navigationDefaults: bundle.floorData.navigationDefaults,
    revision: '',
  })), [floorDirectories, suppliedFloorBundles, initialBundle]);
  const availableFloors = floorOptions ?? directories.map(directory => directory.floor);
  const defaultOriginDirectory = directories.find(directory => directory.floor.id === 'GF') ?? directories[0];
  const [language, setLanguage] = useState<Language>('en');
  const [buildingId] = useState(initialBundle.floorData.building.id); const [floorId, setFloorId] = useState(initialBundle.floorData.floor.id);
  const [revisionOverrides, setRevisionOverrides] = useState<Map<string, string>>(() => new Map());
  const [bundles, setBundles] = useState<FloorBundle[]>(() => suppliedFloorBundles ?? [initialBundle]);
  const [loadedGraphFloorIds, setLoadedGraphFloorIds] = useState<Set<string>>(() => new Set(
    suppliedFloorBundles?.map(bundle => bundle.floorData.floor.id)
      ?? (initialGraphLoaded ? [initialBundle.floorData.floor.id] : []),
  ));
  const loadedGraphFloorIdsRef = useRef(loadedGraphFloorIds);
  loadedGraphFloorIdsRef.current = loadedGraphFloorIds;
  const floorRevision = (id: string) => revisionOverrides.get(id) ?? directories.find(directory => directory.floor.id === id)?.revision ?? '';
  const loadedGraphRevisions = useRef(new Map([...loadedGraphFloorIds].map(id => [id, directories.find(directory => directory.floor.id === id)?.revision || initialRevision || ''])));
  const graphIsCurrent = (id: string) => {
    if (!loadedGraphFloorIdsRef.current.has(id)) return false;
    const currentRevision = floorRevision(id);
    return !currentRevision || loadedGraphRevisions.current.get(id) === currentRevision;
  };
  const bundleRequests = useRef(new Map<string, Promise<FloorBundle>>());
  const [bundleLoadError, setBundleLoadError] = useState<string | null>(null);
  const ensureFloorBundle = useCallback((requestedFloorId: string): Promise<FloorBundle> => {
    const loaded = bundles.find(bundle => bundle.floorData.floor.id === requestedFloorId);
    if (loaded && graphIsCurrent(requestedFloorId)) return Promise.resolve(loaded);
    const pending = bundleRequests.current.get(requestedFloorId);
    if (pending) return pending;
    const directory = directories.find(item => item.floor.id === requestedFloorId);
    if (!directory) return Promise.reject(new Error(`Unknown floor ${requestedFloorId}`));
    const revision = floorRevision(requestedFloorId);
    const url = revision
      ? `/api/navigation/${requestedFloorId}?revision=${encodeURIComponent(revision)}`
      : `/api/navigation/${requestedFloorId}`;
    const request = fetch(url).then(async response => {
      if (!response.ok && response.status !== 409) throw new Error(`Could not load floor ${requestedFloorId}`);
      const payload = await response.json() as { revision?: string; bundle?: FloorBundle };
      const nextBundle = payload.bundle;
      if (typeof payload.revision !== 'string' || !nextBundle
        || nextBundle.floorData.floor.id !== requestedFloorId
        || nextBundle.floorData.building.id !== buildingId
        || !Array.isArray(nextBundle.graph.nodes) || !Array.isArray(nextBundle.graph.edges)
        || !Array.isArray(nextBundle.contents)) throw new Error(`Invalid floor bundle ${requestedFloorId}`);
      if (response.status === 409) {
        setRevisionOverrides(current => new Map(current).set(requestedFloorId, payload.revision!));
        router.refresh();
      }
      setBundles(current => current.some(bundle => bundle.floorData.floor.id === requestedFloorId)
        ? current.map(bundle => bundle.floorData.floor.id === requestedFloorId ? nextBundle : bundle)
        : [...current, nextBundle]);
      loadedGraphFloorIdsRef.current = new Set(loadedGraphFloorIdsRef.current).add(requestedFloorId);
      setLoadedGraphFloorIds(loadedGraphFloorIdsRef.current);
      loadedGraphRevisions.current.set(requestedFloorId, payload.revision!);
      return nextBundle;
    }).finally(() => bundleRequests.current.delete(requestedFloorId));
    bundleRequests.current.set(requestedFloorId, request);
    return request;
  }, [bundles, directories, buildingId, revisionOverrides, router]);
  useEffect(() => { setRevisionOverrides(new Map()); }, [directories]);
  useEffect(() => {
    if (!floorBundle || !initialRevision) return;
    setBundles([floorBundle]);
    const loadedIds = initialGraphLoaded ? new Set([floorBundle.floorData.floor.id]) : new Set<string>();
    loadedGraphFloorIdsRef.current = loadedIds;
    setLoadedGraphFloorIds(loadedIds);
    loadedGraphRevisions.current = new Map(initialGraphLoaded ? [[floorBundle.floorData.floor.id, initialRevision]] : []);
    bundleRequests.current.clear();
  }, [floorBundle, initialGraphLoaded, initialRevision]);
  const activeFloorIdRef = useRef(floorId); activeFloorIdRef.current = floorId;
  const [originFloorId, setOriginFloorId] = useState(() => directories.find(directory => directory.kiosks.some(item => item.id === configuredKioskId))?.floor.id ?? defaultOriginDirectory.floor.id);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [customStartId, setCustomStartId] = useState<string | null>(null); const [destinationId, setDestinationId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [signLanguageRoomId, setSignLanguageRoomId] = useState<string | null>(null);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState<RoomCategory | 'all'>('all'); const [mode, setMode] = useState<'browse' | 'navigate'>('navigate');
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [playbackPhase, setPlaybackPhase] = useState<PlaybackPhase>('idle'); const [playbackProgress, setPlaybackProgress] = useState(0); const [followCamera, setFollowCamera] = useState(true);
  const [playbackRouteKey, setPlaybackRouteKey] = useState('');
  const playbackTimer = useRef<number | null>(null); const playbackStartedAt = useRef(0); const playbackOrigin = useRef(0);
  const playbackPausedAt = useRef<number | null>(null); const waitingFloorId = useRef<string | null>(null);
  const [readyFloorIds, setReadyFloorIds] = useState<Set<string>>(() => new Set());
  const readyFloorIdsRef = useRef(readyFloorIds); readyFloorIdsRef.current = readyFloorIds;
  const floorReadyAtRef = useRef(new Map<string, number>());
  const playbackPaintAt = useRef(Number.NEGATIVE_INFINITY);
  const markFloorReady = useCallback((readyFloorId: string) => {
    if (!floorReadyAtRef.current.has(readyFloorId)) floorReadyAtRef.current.set(readyFloorId, performance.now());
    setReadyFloorIds(current => current.has(readyFloorId) ? current : new Set(current).add(readyFloorId));
  }, []);
  const [muted, setMuted] = useState(false); const [audioSupported, setAudioSupported] = useState(true); const [accessibleOnly, setAccessibleOnly] = useState(false); const [zoom, setZoom] = useState(1); const [reset, setReset] = useState(0);
  const [directoryCollapsed, setDirectoryCollapsed] = useState(false); const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const audio = useRef<TTSService | null>(null); const c = copy[language];
  const currentBundle = bundles.find(bundle => bundle.floorData.floor.id === floorId) ?? initialBundle;
  const originDirectory = directories.find(directory => directory.floor.id === originFloorId) ?? defaultOriginDirectory;
  const activeFloor = currentBundle.floorData;
  const activeGraph = currentBundle.graph;
  const activeContents = currentBundle.contents;
  const transitionNodes = useMemo(() => activeGraph.nodes.filter(node => node.type === 'elevator' || node.type === 'escalator'), [activeGraph]);
  const allRooms = useMemo(() => directories.flatMap(directory => directory.rooms).filter(room => room.public && room.buildingId === buildingId), [directories, buildingId]);
  const floorName = (id: string) => directories.find(directory => directory.floor.id === id)?.floor.name[language] ?? id;
  const allContents = useMemo(() => bundles.flatMap(bundle => bundle.contents), [bundles]);
  const rooms = useMemo(() => activeFloor.rooms.filter(room => room.public && room.buildingId === buildingId), [activeFloor.rooms, buildingId]);
  const selected = rooms.find(room => room.id === selectedId) ?? null;
  const rawSelectedContent = selected ? allContents.find(item => item.id === selected.contentRef) : null;
  const selectedContent = rawSelectedContent && isPlaceholderVideo(rawSelectedContent) ? { ...rawSelectedContent, signLanguageVideo: undefined } : rawSelectedContent;
  const signLanguageRoom = signLanguageRoomId ? rooms.find(room => room.id === signLanguageRoomId) ?? null : null;
  const rawSignLanguageContent = signLanguageRoom ? allContents.find(item => item.id === signLanguageRoom.contentRef) : null;
  const signLanguageContent = rawSignLanguageContent && !isPlaceholderVideo(rawSignLanguageContent) ? rawSignLanguageContent : null;
  const description = selectedContent?.description[language] || t(language, 'descriptionUnavailable');
  const speechText = selected ? `${selected.name[language]}. ${selected.code}. ${description}` : '';
  const results = useMemo(() => searchRooms(rooms, query, language).filter(room => category === 'all' || category === room.category), [rooms, query, language, category]);
  const categories = useMemo(() => [...new Set(rooms.map(room => room.category))], [rooms]);
  const kiosk = originDirectory.kiosks.find(item => item.buildingId === buildingId && item.floorId === originFloorId && (configuredKioskId ? item.id === configuredKioskId : originDirectory.kiosks.length === 1));
  const kioskNode = kiosk?.status === 'confirmed' ? kiosk.nodeId : null;
  const originRooms = originDirectory.rooms;
  const defaultStartRoom = originRooms.find(room => room.id === originDirectory.navigationDefaults?.startRoomId) ?? null;
  const startRoom = customStartId ? allRooms.find(room => room.id === customStartId) ?? null : kioskNode ? null : defaultStartRoom;
  const startNode = customStartId ? startRoom?.doorNodeId ?? null : kioskNode ?? defaultStartRoom?.doorNodeId ?? null;
  const defaultStartLabel = kioskNode ? t(language, 'kiosk') : defaultStartRoom ? `${defaultStartRoom.name[language]} (${t(language, 'defaultStart')})` : t(language, 'chooseStart');
  const destinationRoom = allRooms.find(room => room.id === destinationId) ?? null;
  const destinationNode = destinationRoom?.doorNodeId ?? null;
  const partialRoute = Boolean(startRoom?.navigationPartial || destinationRoom?.navigationPartial);
  const startFloorId = startRoom?.floorId ?? originFloorId;
  const crossFloor = !!destinationRoom && startFloorId !== destinationRoom.floorId;
  const routeGraph = useMemo(() => suppliedRouteGraph ?? (bundles.length > 1 ? multiFloorNavigation(bundles) : undefined), [suppliedRouteGraph, bundles]);
  const startGraph = bundles.find(bundle => bundle.floorData.floor.id === startFloorId)?.graph;
  const routingGraph = (crossFloor ? routeGraph : startGraph) ?? currentBundle.graph;
  useEffect(() => {
    if (!destinationRoom) return;
    const requiredFloorIds = new Set([startFloorId, destinationRoom.floorId]);
    const missing = [...requiredFloorIds].filter(id => !graphIsCurrent(id));
    if (!missing.length) { setBundleLoadError(null); return; }
    let active = true;
    setBundleLoadError(null);
    void Promise.all(missing.map(ensureFloorBundle)).catch(error => {
      if (active) setBundleLoadError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [startFloorId, destinationRoom?.floorId, bundles, loadedGraphFloorIds, ensureFloorBundle]);
  const transitionGraphs = useMemo(() => {
    if (!routeGraph) return new Map<string, NavigationGraph>();
    const nodes = new Map(routeGraph.nodes.map(node => [node.id, node]));
    const ids = new Set(routeGraph.edges.filter(edge => edge.pathType === 'elevator' || edge.pathType === 'escalator').map(edge => nodes.get(edge.from)?.transitionId).filter((id): id is string => Boolean(id)));
    return new Map([...ids].map(transitionId => [transitionId, routeGraphForTransition(routeGraph, transitionId)]));
  }, [routeGraph]);
  const transitionChoices = useMemo(() => {
    if (!crossFloor || !routeGraph || !destinationRoom || !graphIsCurrent(startFloorId) || !graphIsCurrent(destinationRoom.floorId)) return [];
    const nodes = new Map(routeGraph.nodes.map(node => [node.id, node]));
    const options = new Map<string, TransitionChoice>();
    for (const edge of routeGraph.edges) {
      if (edge.pathType !== 'elevator' && edge.pathType !== 'escalator') continue;
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to || from.floorId === to.floorId
        || ![from.floorId, to.floorId].includes(startFloorId)
        || ![from.floorId, to.floorId].includes(destinationRoom.floorId)) continue;
      const transitionId = from.transitionId;
      if (!transitionId || options.has(transitionId)) continue;
      options.set(transitionId, { transitionId, type: edge.pathType, name: from.transitionName ?? to.transitionName ?? '', available: false });
    }
    return [...options.values()]
      .map(option => ({ ...option, available: findRoute(
        transitionGraphs.get(option.transitionId) ?? routeGraph, startNode, destinationNode,
        { accessibleOnly },
      ).status === 'ok' }))
      .sort((left, right) => Number(left.type === 'elevator') - Number(right.type === 'elevator'));
  }, [crossFloor, routeGraph, transitionGraphs, destinationRoom, startFloorId, startNode, destinationNode, accessibleOnly, loadedGraphFloorIds, directories]);
  useEffect(() => {
    if (!crossFloor || !destinationRoom) return;
    const destinationAsset = directories.find(directory => directory.floor.id === destinationRoom.floorId)?.floor.mapAsset;
    if (!destinationAsset) return;
    void import('./FloorMap')
      .then(({ preloadFloorTexture }) => preloadFloorTexture(destinationAsset))
      .catch(() => {
        // The active map load retries after the prefetch cache evicts a failed texture promise.
      });
  }, [crossFloor, destinationRoom, directories]);
  const showTransitionChoice = crossFloor && transitionChoices.some(option => option.available) && !selectedTransitionId;
  const selectedRoutingGraph = useMemo(() => {
    if (!crossFloor || !selectedTransitionId) return routingGraph;
    return transitionGraphs.get(selectedTransitionId) ?? routingGraph;
  }, [routingGraph, transitionGraphs, crossFloor, selectedTransitionId]);
  const route = useMemo(() => destinationId && graphIsCurrent(startFloorId)
    && (!crossFloor || (!!routeGraph && graphIsCurrent(destinationRoom!.floorId))) && !showTransitionChoice && !!selectedRoutingGraph
    ? findRoute(selectedRoutingGraph, startNode, destinationNode, { accessibleOnly, unsafeGeometry: !crossFloor })
    : null,
  [selectedRoutingGraph, startNode, destinationNode, accessibleOnly, destinationId, crossFloor, routeGraph, showTransitionChoice, loadedGraphFloorIds, loadedGraphRevisions.current, startFloorId, destinationRoom?.floorId, directories]);
  const playbackParts = useMemo(() => route?.status === 'ok' && selectedRoutingGraph ? routePlaybackPlan(selectedRoutingGraph, route) : [], [selectedRoutingGraph, route]);
  const playbackDurationMs = useMemo(() => playbackPlanDuration(playbackParts), [playbackParts]);
  const playbackPosition = useMemo(() => playbackPlanPosition(playbackParts, playbackProgress), [playbackParts, playbackProgress]);
  const activePart = playbackPosition?.part;
  const floorRoute = activePart?.floorId === floorId ? activePart.points : [];
  const smoothRoute = useMemo(() => createRouteSmoother(activeGraph), [activeGraph]);
  const protectedPoints = useMemo(() => route?.status === 'ok' ? routeProtectedPoints(activeGraph, route) : [], [activeGraph, route]);
  const visualRoute = useMemo(() => smoothRoute(floorRoute, { protectedPoints }), [smoothRoute, floorRoute, protectedPoints]);
  const routeInstructions = route?.status === 'ok' ? route.instructions : [];
  const routeKey = route?.status === 'ok' ? `${route.nodeIds.join(';')}|${route.edgeIds.join(';')}` : '';
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const visibleRoute = useMemo(() => clipVisualRouteAtProgress(visualRoute,
    reducedMotion || (playbackPhase === 'complete' && playbackRouteKey === routeKey) ? 1
      : playbackRouteKey === routeKey ? playbackPosition?.partProgress ?? 0 : 0),
  [visualRoute, reducedMotion, playbackPhase, playbackRouteKey, routeKey, playbackPosition?.partProgress]);
  const transitionInstruction = activePart?.kind === 'transition' ? routeInstructions.find(instruction =>
    instruction.nodeId === activePart.fromNodeId && ['stairs', 'elevator', 'escalator'].includes(instruction.type)) : undefined;
  const currentInstruction = transitionInstruction ?? (playbackPhase === 'complete' ? routeInstructions.at(-1) : routeInstructions[0]);

  useEffect(() => { const service = audioService ?? createBrowserTTS(); audio.current = service; setAudioSupported(service.isSupported()); return () => service.stop(); }, [audioService]);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('wayfinding-navigation-publication');
    channel.onmessage = event => {
      if (directories.some(directory => directory.floor.id === event.data?.floorId)) router.refresh();
    };
    return () => channel.close();
  }, [directories, router]);
  useEffect(() => { setFloorId(initialBundle.floorData.floor.id); }, [initialBundle.floorData.floor.id]);
  useEffect(() => {
    if (!floorBundle || !initialRevision) return;
    setBundles([floorBundle]);
    bundleRequests.current.clear();
  }, [floorBundle, initialRevision]);
  useEffect(() => {
    const syncFloorFromHistory = () => {
      const requestedFloor = new URLSearchParams(window.location.search).get('floor');
      if (!requestedFloor || !directories.some(directory => directory.floor.id === requestedFloor)) return;
      if (graphIsCurrent(requestedFloor)) setFloorId(requestedFloor);
      else void ensureFloorBundle(requestedFloor).then(() => setFloorId(requestedFloor)).catch(error => setBundleLoadError(String(error)));
    };
    window.addEventListener('popstate', syncFloorFromHistory);
    return () => window.removeEventListener('popstate', syncFloorFromHistory);
  }, [bundles, directories, ensureFloorBundle]);
  useEffect(() => { audio.current?.setMuted(muted); }, [muted]);
  useEffect(() => { if (speechText && !journeyStarted) audio.current?.speak(speechText, language); else if (!journeyStarted) audio.current?.stop(); return () => audio.current?.stop(); }, [speechText, language, journeyStarted]);
  useEffect(() => {
    if (playbackPhase !== 'playing' || !playbackDurationMs || reducedMotion) return;
    playbackStartedAt.current = performance.now(); playbackOrigin.current = playbackProgress;
    playbackPausedAt.current = null; waitingFloorId.current = null;
    playbackPaintAt.current = Number.NEGATIVE_INFINITY;
    const tick = () => {
      const now = performance.now();
      if (playbackPausedAt.current !== null) {
        const waitingFor = waitingFloorId.current;
        const loaded = waitingFor !== null && readyFloorIdsRef.current.has(waitingFor);
        const readyAt = waitingFor ? floorReadyAtRef.current.get(waitingFor) : undefined;
        const waited = readyAt !== undefined && now - readyAt >= 1200;
        if (!loaded || !waited) {
          playbackTimer.current = window.requestAnimationFrame(tick);
          return;
        }
        playbackStartedAt.current += now - playbackPausedAt.current;
        playbackPausedAt.current = null;
        waitingFloorId.current = null;
      }
      const duration = (1 - playbackOrigin.current) * playbackDurationMs;
      const next = Math.min(1, playbackOrigin.current + (now - playbackStartedAt.current) / duration);
      const nextPart = playbackPlanPosition(playbackParts, next)?.part;
      if (nextPart && nextPart.floorId !== activeFloorIdRef.current && waitingFloorId.current !== nextPart.floorId) {
        // Give the destination floor time to load before revealing its route segment.
        if (waitingFloorId.current !== nextPart.floorId) {
          setPlaybackProgress(value => Math.max(value, next));
          playbackOrigin.current = next;
          playbackStartedAt.current = now;
          playbackPausedAt.current = now;
          waitingFloorId.current = nextPart.floorId;
        }
        playbackTimer.current = window.requestAnimationFrame(tick);
        return;
      }
      if (next < 1 && now - playbackPaintAt.current < 33) {
        playbackTimer.current = window.requestAnimationFrame(tick);
        return;
      }
      playbackPaintAt.current = now;
      setPlaybackProgress(value => Math.max(value, next));
      if (next >= 1) { setPlaybackPhase('complete'); return; }
      playbackTimer.current = window.requestAnimationFrame(tick);
    };
    playbackTimer.current = window.requestAnimationFrame(tick);
    return () => { if (playbackTimer.current !== null) window.cancelAnimationFrame(playbackTimer.current); playbackTimer.current = null; };
  }, [playbackPhase, playbackDurationMs, routeKey, reducedMotion]);
  useEffect(() => {
    if (route?.status !== 'ok' || !playbackParts.length) {
      if (playbackTimer.current !== null) window.cancelAnimationFrame(playbackTimer.current);
      playbackTimer.current = null; playbackPausedAt.current = null; waitingFloorId.current = null;
      setPlaybackRouteKey(''); setPlaybackPhase('idle'); setPlaybackProgress(0); setJourneyStarted(false); return;
    }
    // A new valid route always cancels the prior animation and starts from zero.
    const completeImmediately = reducedMotion || playbackDurationMs === 0;
    setPlaybackRouteKey(routeKey); setPlaybackProgress(completeImmediately ? 1 : 0); setJourneyStarted(true); setFollowCamera(!completeImmediately);
    setPlaybackPhase(completeImmediately ? 'complete' : 'playing');
  }, [routeKey, route?.status, playbackParts.length, playbackDurationMs, reducedMotion]);
  useEffect(() => {
    const nextFloor = playbackPosition?.part.floorId;
    if (!nextFloor || nextFloor === floorId || !['playing', 'paused', 'complete'].includes(playbackPhase)) return;
    floorReadyAtRef.current.delete(nextFloor);
    setReadyFloorIds(current => {
      if (!current.has(nextFloor)) return current;
      const next = new Set(current);
      next.delete(nextFloor);
      return next;
    });
    setFloorId(nextFloor);
    const params = new URLSearchParams(window.location.search);
    params.set('floor', nextFloor);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [playbackPosition?.part.floorId, floorId, playbackPhase]);
  useEffect(() => { if (journeyStarted && currentInstruction) audio.current?.speak(currentInstruction.text[language], language); }, [journeyStarted, currentInstruction, language]);
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = getDirection(language); }, [language]);
  function selectRoom(id: string) { setSelectedId(id); setSignLanguageRoomId(null); }
  function stopPlayback() { if (playbackTimer.current !== null) window.cancelAnimationFrame(playbackTimer.current); playbackTimer.current = null; setPlaybackPhase('stopped'); setPlaybackProgress(0); setFollowCamera(false); }
  async function changeFloor(nextFloorId: string) {
    if (!graphIsCurrent(nextFloorId)) {
      try {
        await ensureFloorBundle(nextFloorId);
      } catch (error) {
        setBundleLoadError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setBundleLoadError(null);
    stopPlayback(); setFloorId(nextFloorId);
    setCustomStartId(null); setDestinationId(null); setSelectedTransitionId(null); setSelectedId(null); setJourneyStarted(false); setPlaybackPhase('idle');
    const params = new URLSearchParams(window.location.search); params.set('floor', nextFloorId);
    window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
  }
  function resetKiosk() { stopPlayback(); setOriginFloorId(defaultOriginDirectory.floor.id); void ensureFloorBundle(defaultOriginDirectory.floor.id).then(() => setFloorId(defaultOriginDirectory.floor.id)).catch(error => setBundleLoadError(String(error))); setCustomStartId(null); setDestinationId(null); setSelectedTransitionId(null); setSelectedId(null); setSignLanguageRoomId(null); setQuery(''); setCategory('all'); setJourneyStarted(false); setZoom(1); setReset(value => value + 1); audio.current?.stop(); }
  function goToRoom(id: string) { stopPlayback(); setSelectedTransitionId(null); setDestinationId(id); setSelectedId(id); setMode('navigate'); setJourneyStarted(false); setPlaybackPhase('idle'); }
  function togglePlayback() {
    if (playbackPhase === 'playing') { setPlaybackPhase('paused'); return; }
    setJourneyStarted(true);
    setFollowCamera(!reducedMotion);
    if (reducedMotion || playbackDurationMs === 0) {
      setPlaybackProgress(1);
      setPlaybackPhase('complete');
    } else {
      setPlaybackPhase('playing');
    }
  }
  const closeSignLanguage = useCallback(() => setSignLanguageRoomId(null), []);
  const closeTransitionChoice = useCallback(() => {
    setSelectedTransitionId(null);
    setDestinationId(null);
  }, []);
  const chooseTransition = useCallback((transitionId: string) => setSelectedTransitionId(transitionId), []);

  return <div className="wayfinding-app" dir={getDirection(language)} data-language={language}>
    <a className="skip-link" href="#directory">{t(language, 'skipToDirectory')}</a>
    <header className="app-header"><a className="brand" href="#directory" aria-label={t(language, 'appTitle')}><span className="brand-icon"><img src="/academy-logo.webp" alt="" /></span><span><strong>{c.brand}</strong><small>{c.wayfinding}</small></span></a><div className="header-divider" /><div className="building-heading"><span>{t(language, 'building')} <b dir="ltr">{buildingId}</b></span><small>{activeFloor.floor.name[language]}</small></div><div className="header-actions"><span className="campus-tag"><span />{c.source}</span><button className="language-button" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} aria-label={t(language, language === 'en' ? 'switchToArabic' : 'switchToEnglish')} data-testid="language-toggle"><span className={language === 'en' ? 'active' : ''}>EN</span><span className="language-divider" /><span lang="ar" className={language === 'ar' ? 'active' : ''}>العربية</span></button><button className="icon-button header-audio" onClick={() => setMuted(!muted)} title={t(language, muted ? 'unmuteAudio' : 'muteAudio')} aria-label={t(language, muted ? 'unmuteAudio' : 'muteAudio')} aria-pressed={muted}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button></div></header>
    <main id="main-content" className={`main-layout ${directoryCollapsed ? 'directory-collapsed' : ''}`}>
      {bundleLoadError && <p role="alert" data-testid="bundle-load-error">{bundleLoadError}</p>}
      {destinationId && !route && (!graphIsCurrent(startFloorId) || (crossFloor && (!routeGraph || !graphIsCurrent(destinationRoom?.floorId ?? '')))) && !bundleLoadError && <p role="status" data-testid="route-data-loading">{t(language, 'loading')}</p>}
      <div className={`directory-shell ${directoryCollapsed ? 'is-collapsed' : ''}`}>
      <button type="button" className="panel-collapse-control directory-toggle" aria-expanded={!directoryCollapsed} aria-controls="directory" aria-label={directoryCollapsed ? (language === 'ar' ? 'إظهار الدليل' : 'Expand directory') : (language === 'ar' ? 'إخفاء الدليل' : 'Collapse directory')} title={directoryCollapsed ? 'Expand directory / إظهار الدليل' : 'Collapse directory / إخفاء الدليل'} onClick={() => setDirectoryCollapsed(value => !value)}><ChevronDown size={18} /></button>
      <aside id="directory" className="directory-panel" aria-label={t(language, 'directory')}>
        <div className="directory-intro"><p className="eyebrow">{t(language, 'building')} <span dir="ltr">{buildingId}</span> <span className="eyebrow-dot">·</span> {activeFloor.floor.name[language]}</p><h1>{c.welcome}</h1><p>{c.floorNote}</p></div>
        <div className="mode-tabs" role="group" aria-label={c.plan}><button className={mode === 'browse' ? 'active' : ''} aria-pressed={mode === 'browse'} onClick={() => setMode('browse')}><Layers size={16} />{c.browse}</button><button className={mode === 'navigate' ? 'active' : ''} aria-pressed={mode === 'navigate'} onClick={() => setMode('navigate')}><Navigation size={16} />{c.navigate}</button></div>
        {mode === 'browse' ? <><div className="search-box"><Search size={19} /><label className="sr-only" htmlFor="room-search">{t(language, 'search')}</label><input id="room-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t(language, 'searchPlaceholder')} autoComplete="off" />{query && <button aria-label={t(language, 'clearSearch')} onClick={() => setQuery('')}><X size={16} /></button>}</div><div className="category-row"><label className="sr-only" htmlFor="category-filter">{c.category}</label><select id="category-filter" value={category} onChange={event => setCategory(event.target.value as RoomCategory | 'all')}><option value="all">{c.all}</option>{categories.map(item => <option key={item} value={item}>{t(language, categoryKeys[item])}</option>)}</select><span>{results.length} {c.spaces}</span></div><div className="room-directory" aria-label={t(language, 'searchResults')} data-testid="room-directory">{results.map(room => <button key={room.id} data-room-id={room.id} className={`directory-room ${selectedId === room.id ? 'active' : ''}`} aria-pressed={selectedId === room.id} onClick={() => selectRoom(room.id)}><span className={`room-symbol ${room.category}`}><MapPin size={18} strokeWidth={1.7} /></span><span className="room-text"><strong>{room.name[language]}</strong><small><bdi>{room.code}</bdi><span> · </span>{t(language, categoryKeys[room.category])}</small></span>{selectedId === room.id ? <Check size={17} /> : <ArrowUpRight size={17} className="room-arrow" />}</button>)}{!results.length && <p className="empty-search">{t(language, rooms.length ? 'noResults' : 'noRooms')}</p>}</div></> : <div className="navigation-panel"><div className="journey-fields"><label htmlFor="start-room"><span className="start-dot" />{t(language, 'start')}</label><select id="start-room" value={customStartId ?? ''} onChange={event => { setSelectedTransitionId(null); setCustomStartId(event.target.value || null); }} data-testid="start-select"><option value="">{defaultStartLabel}</option>{allRooms.map(room => <option key={room.id} value={room.id}>{room.name[language]} — {room.code} · {floorName(room.floorId)}</option>)}</select><label htmlFor="destination-room"><MapPin size={14} />{t(language, 'destination')}</label><select id="destination-room" value={destinationId ?? ''} onChange={event => { const roomId = event.target.value || null; setSelectedTransitionId(null); setDestinationId(roomId); setSelectedId(roomId); }} data-testid="destination-select"><option value="">{t(language, 'chooseDestination')}</option>{allRooms.map(room => <option key={room.id} value={room.id}>{room.name[language]} — {room.code} · {floorName(room.floorId)}</option>)}</select></div>{!customStartId && !kioskNode && <p className="inline-note" data-testid="kiosk-status"><Info size={15} />{t(language, defaultStartRoom ? 'planningOriginNote' : 'kioskUnconfigured')}</p>}<label className="checkbox-label"><input type="checkbox" checked={accessibleOnly} onChange={event => setAccessibleOnly(event.target.checked)} />{t(language, 'accessibleOnly')}</label><button className="text-button reset-start" onClick={() => { setSelectedTransitionId(null); setCustomStartId(null); }}>{t(language, kioskNode ? 'clearStart' : 'restoreDefaultStart')}</button>{route && <div className={`route-result ${route.status}`} role="status" data-testid="route-status">{route.status === 'ok' ? <><h3>{t(language, partialRoute ? 'partialRoute' : 'directions')}</h3>{partialRoute && <p className="route-partial-notice" data-testid="partial-route-note">{t(language, 'partialRouteNote')}</p>}<strong>{route.distanceUnit === 'meter' ? `${Math.round(route.distance)} ${t(language, 'meters')}` : t(language, 'routeOnPlan')}</strong>{routingGraph.routingPolicy === 'drawing-based' && <p>{t(language, 'drawingRouteNote')}</p>}{startRoom?.navigationNote && <p className="route-endpoint-note">{t(language, 'start')}: {startRoom.navigationNote[language]}</p>}{destinationRoom?.navigationNote && <p className="route-endpoint-note" data-testid="arrival-note">{destinationRoom.navigationNote[language]}</p>}{route.instructions.some(instruction => ['stairs', 'elevator', 'escalator'].includes(instruction.type)) && <p className="route-endpoint-note" data-testid="floor-transition-status">{transitionInstruction?.text[language] ?? floorName(destinationRoom?.floorId ?? "")}</p>}<ol>{route.instructions.map((instruction, index) => <li key={`${instruction.nodeId}-${index}`}>{instruction.type === 'arrival' && partialRoute ? t(language, 'mappedSegmentEnd') : destinationRoom?.navigationNote && ['arrival', 'destination-left', 'destination-right'].includes(instruction.type) ? t(language, instruction.type === 'destination-left' ? 'mappedApproachLeft' : instruction.type === 'destination-right' ? 'mappedApproachRight' : 'mappedApproachArrival') : instruction.text[language]}</li>)}</ol><div className="playback-controls" role="group"><button className="secondary-button" onClick={togglePlayback} disabled={playbackPhase === 'complete'} data-testid="playback-toggle">{playbackPhase === 'playing' ? t(language, 'playbackPause') : t(language, 'playbackStart')}</button><button className="secondary-button" onClick={stopPlayback} disabled={playbackPhase === 'idle' || playbackPhase === 'stopped'} data-testid="playback-stop">{t(language, 'playbackStop')}</button><button className="text-button" onClick={() => { stopPlayback(); setPlaybackPhase('ready'); setJourneyStarted(false); }} data-testid="playback-reset">{t(language, 'playbackReset')}</button><progress className="playback-progress" value={playbackProgress} max="1" /></div></> : <><span className="route-status-icon"><Navigation size={19} /></span><h3>{t(language, 'routeNotFound')}</h3><p>{route.reason?.[language] || t(language, 'noConnectingRoute')}</p></>}</div>}<button className="secondary-button clear-route" onClick={() => { setSelectedTransitionId(null); setDestinationId(null); }} title={t(language, 'resetRoute')} aria-label={t(language, 'resetRoute')}><RotateCcw size={15} /></button></div>}
        <div className="directory-footer"><span className="footer-icon"><Info size={16} /></span><p>{t(language, 'publicDirectoryNotice')}</p></div>
      </aside></div>
      <section className={`map-workspace ${selected && !detailsCollapsed ? 'has-selection' : ''} ${selected ? 'has-room-details' : ''} ${detailsCollapsed ? 'details-collapsed' : ''}`} aria-label={t(language, 'map')}>
        <button type="button" className="panel-collapse-control details-toggle" aria-expanded={!detailsCollapsed} aria-controls="room-details" aria-label={detailsCollapsed ? (language === 'ar' ? 'إظهار التفاصيل' : 'Expand details') : (language === 'ar' ? 'إخفاء التفاصيل' : 'Collapse details')} title={detailsCollapsed ? 'Expand details / إظهار التفاصيل' : 'Collapse details / إخفاء التفاصيل'} onClick={() => setDetailsCollapsed(value => !value)}><ChevronDown size={18} /></button>
        <div className="map-topline"><div><p className="eyebrow">{c.overview}</p><h2>{activeFloor.floor.name[language]}</h2><p>{rooms.length} {c.roomCount} <span>·</span> <bdi>{buildingId}</bdi></p></div><label className="floor-select"><Layers size={18} /><span className="sr-only">{t(language, 'floor')}</span><select aria-label={t(language, 'floor')} value={floorId} onChange={event => changeFloor(event.target.value)} data-testid="floor-select">{availableFloors.map(option => <option key={option.id} value={option.id}>{option.name[language]} · {option.id}</option>)}</select><ChevronDown size={15} /></label></div>
        <div className="map-canvas" data-testid="floor-map"><FloorMap floor={activeFloor.floor} rooms={rooms} contents={activeContents} mapFeatures={activeFloor.mapFeatures} transitionNodes={transitionNodes} language={language} selectedId={selectedId} onSelect={selectRoom} onMapReady={markFloorReady} route={floorRoute} visibleRoute={visibleRoute} playbackPhase={playbackPhase} playbackProgress={playbackProgress} followCamera={followCamera} zoom={zoom} reset={reset} /></div>
        <div className="map-evidence"><Info size={14} /><span>{c.mapReview}</span></div>
        <div className="map-control-stack" role="group" aria-label={t(language, 'mapControls')}><button onClick={() => setZoom(value => Math.min(3, value * 1.2))} aria-label={t(language, 'zoomIn')}><Plus size={20} /></button><button onClick={() => setZoom(value => Math.max(.6, value / 1.2))} aria-label={t(language, 'zoomOut')}><Minus size={20} /></button><span /><button onClick={() => { setZoom(1); setReset(value => value + 1); }} aria-label={t(language, 'resetView')}><LocateFixed size={19} /></button></div>
        {!selected && <div className="map-welcome"><span><Compass size={24} strokeWidth={1.5} /></span><div><strong>{t(language, 'selectRoom')}</strong><p>{c.directoryHelp}</p></div></div>}
        {selected && <DestinationDetails room={selected} content={selectedContent} floor={activeFloor.floor} language={language} collapsed={detailsCollapsed} audioSupported={audioSupported} onClose={() => { setSelectedId(null); setSignLanguageRoomId(null); }} onDestination={() => goToRoom(selected.id)} onStart={() => { stopPlayback(); setSelectedTransitionId(null); setCustomStartId(selected.id); setMode('navigate'); setJourneyStarted(false); setPlaybackPhase('idle'); }} onSpeak={() => audio.current?.speak(speechText, language)} onStop={() => audio.current?.stop()} onSignLanguage={() => setSignLanguageRoomId(selected.id)} />}
        <div className="map-bottom"><div className="map-legend"><span><i className="legend-marker" />{c.marker}</span><span><i className="legend-selected" />{c.selected}</span><span className="legend-pan">{t(language, 'panMap')}</span></div><button className="reset-kiosk" onClick={resetKiosk} data-testid="reset-kiosk"><RotateCcw size={15} />{kioskNode ? c.resetKiosk : t(language, 'resetPlanningRoute')}</button></div>
      </section>
    </main>
    <footer className="app-footer"><span><span className="status-dot" /><bdi>{buildingId} / {activeFloor.floor.name[language]}</bdi></span><span>{kioskNode ? kiosk?.name[language] : c.noKiosk}</span><span><Compass size={13} />{t(language, 'accessibilityUnknown')}</span></footer>
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-status">{selected ? `${t(language, 'selectedRoom')}: ${selected.name[language]}, ${selected.code}.` : ''} {route && route.status !== 'ok' ? route.reason?.[language] : ''} {muted ? t(language, 'audioMuted') : ''}</div>
    {signLanguageRoom && signLanguageContent?.signLanguageVideo?.url && <SignLanguageDialog room={signLanguageRoom} video={signLanguageContent.signLanguageVideo} language={language} onClose={closeSignLanguage} />}
    {showTransitionChoice && <TransitionChoiceDialog language={language} options={transitionChoices} startLabel={startRoom?.name[language] ?? defaultStartLabel} destinationFloor={floorName(destinationRoom?.floorId ?? "") ?? destinationRoom?.floorId ?? ''} onChoose={chooseTransition} onClose={closeTransitionChoice} />}
  </div>;
}







