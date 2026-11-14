import { redirect } from "next/navigation";

/** Plans now live on the goals page; old links and shared codes land there. */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}): Promise<never> {
  const { code } = await searchParams;
  redirect(code ? `/goals?code=${encodeURIComponent(code)}` : "/goals");
}
