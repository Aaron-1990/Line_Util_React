// ============================================
// PROCESS FLOW BADGES COMPONENT
// Visual representation of model routing through areas
// ============================================

import { ArrowRight } from 'lucide-react';

interface ProcessFlowBadgesProps {
  areas: string[];
  areaColors?: Map<string, string>;
}

/**
 * Displays a sequence of area badges with arrows between them.
 * Example: [SMT] → [ICT] → [Assembly]
 *
 * Usage:
 * <ProcessFlowBadges
 *   areas={['SMT', 'ICT', 'Assembly']}
 *   areaColors={new Map([['SMT', '#34d399'], ['ICT', '#60a5fa']])}
 * />
 */
export const ProcessFlowBadges = ({ areas, areaColors }: ProcessFlowBadgesProps) => {
  if (areas.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {areas.map((area, index) => {
        const color = areaColors?.get(area) || '#6b7280'; // Default gray

        return (
          <div key={`${area}-${index}`} className="flex items-center gap-2">
            {/* Area Badge */}
            <div
              className="px-3 py-1 rounded-md text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {area}
            </div>

            {/* Arrow (if not last item) */}
            {index < areas.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        );
      })}
    </div>
  );
};
