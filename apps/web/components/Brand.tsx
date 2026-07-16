/** The app logo tile + wordmark. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="bg-brand flex h-9 w-9 items-center justify-center rounded-xl text-lg shadow-lg shadow-primary/20"
        aria-hidden
      >
        ⛰️
      </span>
      {!compact && (
        <span className="text-gradient display text-lg font-extrabold">Training for Climbing</span>
      )}
    </div>
  );
}
