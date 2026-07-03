export function Money({ cents }: { cents: number }) {
  return (
    <span>
      ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}
