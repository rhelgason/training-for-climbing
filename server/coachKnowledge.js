/**
 * Static training-reference knowledge for the AI coach.
 *
 * This is climbing-training domain knowledge the coach may draw on when
 * prescribing a day's workout — concrete grip positions, fingerboard/hangboard
 * protocols, and the energy-system training zones. It is reference material,
 * identical for every user and request, so it lives in the system prompt rather
 * than the per-user context.
 *
 * Source (for maintainers only — NOT surfaced to the model, which is told not to
 * cite sources): Eric J. Hörst, *Training for Climbing* (3rd ed., 2016) —
 * grip positions & the four max-strength requirements (Ch 8, p. 167/182–183);
 * fingerboard protocols Tables 8.2 (min-edge), 8.3 (max-weight 10-sec),
 * 8.4 (max-weight 7-53); repeaters Tables 8.6 (short) & 8.7 (long);
 * HIT Tables 8.5 (max-strength) & 8.9 (strength-endurance); energy-system
 * weight/rep/rest scheme and RPE training zones (Ch 5, Tables 5.4 & 5.5, Fig 5.9).
 * If the app is updated to a new edition, re-verify these numbers here.
 */

const TRAINING_REFERENCE = `TRAINING REFERENCE — concrete protocols you can prescribe. Match the protocol to
the day's goal and the climber's ability; give real numbers (edge size, hang/rest
seconds, sets, added weight), not vague advice. Only prescribe fingerboard/HIT work
for intermediate+ climbers who are warmed up.

Grip positions to train (never train a full crimp with thumb lock):
- Half-crimp and open-crimp, open hand, wide pinch, and the three two-finger pocket
  "teams" (3rd team = pinky+ring, 2nd = index+middle, 1st = middle+ring).
- Strength is grip-specific: isolate ONE grip per set and take it to near-failure.
  A true max-strength set reaches failure in under ~12 seconds; longer sets train
  strength-endurance instead.

Fingerboard MAX-STRENGTH protocols (pick one; RPE 9–9.5/10; ~2 days/week max):
- Minimum-edge hangs: 12 s hang / 3 min rest between hangs / 5 hangs per set / 2–5
  sets / 5 min between sets. Use an edge you can barely hold ~15 s; end every hang at
  12 s. Produces little pump (targets the ATP-CP / alactic system).
- Max-weight "10-second": 10 s hang / 3 min rest / 5 hangs per set / 2–5 sets / 5 min
  between sets, on a 14–20 mm edge with enough added weight (~25–100 lb) to fail at
  ~13 s; end every hang at 10 s. Favor half-crimp and open-hand.
- Max-weight "7-53": 7 s hang / 53 s rest / 3 hangs per set / 2–5 sets / 5 min between
  sets, weighted to fail at ~10 s; end every hang at 7 s. Also builds aerobic power
  (faster recovery between efforts). Use the 10-second OR the 7-53 protocol, not both.

Fingerboard STRENGTH-ENDURANCE — repeaters (alternate half-crimp / open-hand by set):
- Short-duration: 6 hangs per set, 3–5 sets, 1 min between sets. Difficulty by
  hang/rest seconds — L1 10/30, L2 10/20, L3 10/10, L4 10/5. When 5 sets at L4 feel
  easy, add ~10 lb or use smaller holds.
- Long-duration: 4 hangs per set, 3–5 sets, 1 min between sets — L1 30/30, L2 30/15,
  L3 60/30, L4 60/15. Advance a level once you complete 5 sets at the current one.

HIT (Hypergravity Isolation Training) on a 45–55° wall, feet-on, one grip per set,
working hardest grip first (pinch → 2-finger 3rd → 2nd → 1st team → half-crimp → open
hand). Added weights below are for a ~160 lb climber — scale by body-weight percentage:
- Max-strength: each set <15 s (8–15 hand moves), 1–3 sets, 2–3 min rest. Advanced
  added weight ≈ pinch 20, 3rd team 20, 2nd team 30, 1st team 40, half-crimp 40, open
  hand 40 lb (novices use little or none).
- Strength-endurance: lighter, longer sets (30–90 s ideal; 20 s–2 min range), 1–3
  sets, 3 min rest. Recovery can take up to 72 h.

Energy systems & training zones (train the system that fits the goal):
- Max strength: 90–100% effort, 3–5 reps, sets under ~12 s, 3–5 min rest, ~2×/week.
- Strength / power-endurance (the "pump", anaerobic-lactic): sustained hard efforts of
  ~15 s–2 min with short rests (work:rest ~1:4 down to ~1:1). It is the least trainable
  system and the easiest to overtrain — cap at ~2–3 sessions/week, ideally in a 2–4
  week block before a trip or comp.
- Aerobic / local endurance: efforts over ~2 min at RPE 4–6 (ARC, no pump) up to
  threshold intervals of 2–5 min at RPE 7–8.5 with ~1:1 work:rest. Builds stamina and
  speeds recovery between hard efforts; safe to train most often.

Safety: always warm up gradually (raise heart rate, then mobility and self-massage,
then easy climbing through the first flash pump) before max hangs or HIT; keep
shoulders engaged (chest out, no dead-hang shrug); pair hard finger work with rotator-
cuff / scapular and antagonist (wrist-extensor, pronator) conditioning.`;

module.exports = { TRAINING_REFERENCE };
