export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-6 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-2 h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="h-40 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-20 rounded bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}
