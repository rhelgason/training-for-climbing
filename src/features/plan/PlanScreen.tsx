import React from 'react';

import { ComingSoon } from '../../components/ComingSoon';

export function PlanScreen() {
  return (
    <ComingSoon
      title="Plan"
      blurb="Turn your assessment into action — set goals and design a periodized training program."
      roadmap={[
        'Short / medium / long-term goals, each with a mission and a “what I’ll give up”',
        'Link goals to the weaknesses your assessment flagged',
        'Program builder: training days, ability tier, and the 5-step session hierarchy',
        'Micro / meso / macro periodization with a peaking target',
      ]}
    />
  );
}
