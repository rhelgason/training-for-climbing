/**
 * Whether a coach suggestion is a day off, including one written in other words.
 *
 * "Rest 3 minutes" inside a real session is not a rest day. The scheduler is
 * the only authority that may call one; this is how the client and the server
 * recognise a model that called one anyway.
 */
const REST_SHAPED =
  /\b(rest day|full rest|complete rest|day of rest|day off|off day|take it easy|taking it easy|take the day off|take a rest|rest up|active recovery|mobility only|just mobility|just stretch|no climbing|deload|easy day|light day|recovery day|recovery only|recovery session|rest today)\b/i;

export function suggestionLooksLikeRest(suggestion: {
  headline?: string;
  plan?: string[];
  restDay?: boolean;
}): boolean {
  if (suggestion.restDay) return true;
  const headline = suggestion.headline ?? '';
  if (/^\s*rest\b/i.test(headline)) return true;
  return REST_SHAPED.test([headline, ...(suggestion.plan ?? [])].join('\n'));
}
