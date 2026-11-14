"use client";

import { FocusedRegion } from "@/components/dashboard/FocusedRegion";
import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/** Placeholder shaped like the view tabs, the period row and a grid of widget cards. */
export function DashboardSkeleton({ focus }: { focus: boolean }): React.JSX.Element {
  return (
    <FocusedRegion focus={focus}>
      <LoadingRegion className="flex flex-col gap-4">
        <div
          aria-hidden="true"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3"
        >
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </LoadingRegion>
    </FocusedRegion>
  );
}
