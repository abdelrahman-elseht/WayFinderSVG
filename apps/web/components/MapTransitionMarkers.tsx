'use client';
import { ArrowUpDown, ArrowUpRight } from 'lucide-react';
import { Html } from '@react-three/drei';
import type { Language, NavigationNode, Point } from '@wayfinding/map-engine';

const copy = {
  en: { elevator: 'Lift', escalator: 'Escalator', accessUnknown: 'Access unverified' },
  ar: { elevator: 'مصعد', escalator: 'سلم متحرك', accessUnknown: 'إمكانية الوصول غير مؤكدة' },
} satisfies Record<Language, Record<'elevator' | 'escalator' | 'accessUnknown', string>>;
const isTransitionNode = (node: NavigationNode): node is NavigationNode & { type: 'elevator' | 'escalator' } =>
  node.type === 'elevator' || node.type === 'escalator';

export function MapTransitionMarkers({ nodes, language, center }: {
  nodes: NavigationNode[];
  language: Language;
  center: Point;
}) {
  const labels = copy[language];
  const transitions = nodes.filter(isTransitionNode);
  return <>{transitions.map(node => {
    const typeLabel = labels[node.type];
    const accessibilityLabel = node.transitionAccessibility === 'unknown'
      ? labels.accessUnknown
      : node.transitionAccessibility === 'confirmed'
        ? language === 'ar' ? 'إمكانية الوصول مؤكدة' : 'Step-free access confirmed'
        : language === 'ar' ? 'غير مهيأ للوصول الخالي من الدرج' : 'Not step-free';
    const Icon = node.type === 'elevator' ? ArrowUpDown : ArrowUpRight;

    return <Html key={node.id} center zIndexRange={[20, 5]} position={[
      (node.point[0] - center[0]) / 100,
      0.15,
      (node.point[1] - center[1]) / 100,
    ]}>
      <div
        className={`map-transition-marker${node.status === 'candidate' ? ' is-candidate' : ''}`}
        role="img"
        data-testid={`transition-marker-${node.id}`}
        aria-label={`${node.transitionName}, ${typeLabel}, ${accessibilityLabel}`}
        title={`${node.transitionName} · ${typeLabel} · ${accessibilityLabel}`}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <span className="map-transition-marker-icon" aria-hidden="true"><Icon size={15} strokeWidth={2.2} /></span>
      </div>
    </Html>;
  })}</>;
}
