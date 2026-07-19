export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="flex gap-2">
        <div className="h-14 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-14 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-14 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="h-24 rounded bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}
