import { suggestionLooksLikeRest } from './restShape';

describe('suggestionLooksLikeRest', () => {
  it('flags an explicit rest and the euphemisms', () => {
    expect(suggestionLooksLikeRest({ restDay: true, headline: 'Power', plan: ['Hang'] })).toBe(
      true,
    );
    expect(suggestionLooksLikeRest({ headline: 'Active recovery', plan: ['Walk'] })).toBe(true);
    expect(suggestionLooksLikeRest({ headline: 'Today', plan: ['No climbing', 'Sleep'] })).toBe(
      true,
    );
  });

  it('leaves a real session alone, including the rests between efforts', () => {
    expect(
      suggestionLooksLikeRest({
        headline: 'Power day',
        plan: ['Limit boulders, 3 min rest between tries'],
      }),
    ).toBe(false);
    expect(
      suggestionLooksLikeRest({
        headline: 'Off the fingers',
        plan: ['Reverse wrist curls', '20 min easy run', 'Stretch the hips'],
      }),
    ).toBe(false);
  });
});
