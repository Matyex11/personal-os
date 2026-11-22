import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      className={cn("flex items-center gap-3 py-8 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <span className="inline-block size-2 animate-pulse rounded-sm bg-primary" />
      {label}
    </div>
  );
}
