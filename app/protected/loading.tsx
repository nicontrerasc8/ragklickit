export default function ProtectedLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />
        <div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />
        <div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />
      </div>
      <div className="h-24 animate-pulse rounded-2xl border bg-muted/30" />
      <div className="h-56 animate-pulse rounded-2xl border bg-muted/30" />
    </div>
  );
}
