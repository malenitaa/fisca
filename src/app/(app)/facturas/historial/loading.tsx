export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded bg-neutral-200 dark:bg-neutral-800" />
      ))}
    </div>
  );
}
