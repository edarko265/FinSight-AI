"use client";

import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonList } from "@/components/ui/Skeleton";

/**
 * What to show while an admin list has no data: a skeleton while loading, or the standard
 * error with a retry once it failed. Renders nothing when `show` is false (data is there).
 */
export function LoadState({
  show,
  failed,
  onRetry,
  rows = 3,
}: {
  show: boolean;
  failed: boolean;
  onRetry: () => void;
  rows?: number;
}): React.JSX.Element | null {
  if (!show) return null;
  if (failed) return <LoadError onRetry={onRetry} messageKey="admin.loadFailed" />;
  return (
    <LoadingRegion>
      <SkeletonList rows={rows} />
    </LoadingRegion>
  );
}
