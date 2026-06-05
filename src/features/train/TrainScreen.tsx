import React from 'react';

import { ComingSoon } from '../../components/ComingSoon';

export function TrainScreen() {
  return (
    <ComingSoon
      title="Train"
      blurb="Log your sessions and work the exercises that target your weaknesses."
      roadmap={[
        'Session logger: exercises, sets/reps, climbs and grades, perceived effort',
        'Exercise library (Chapters 6–7) linked to your flagged weaknesses',
        'Daily energy & emotion check-in (Appendix B)',
        'Fitness Evaluation: 10 benchmarks with annual-retest trends',
      ]}
    />
  );
}
