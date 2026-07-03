type P = { size?: number };
const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export function IconHome({ size = 24 }: P) {
  return <svg {...base(size)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
}
export function IconPig({ size = 24 }: P) {
  // simple savings/wallet mark
  return <svg {...base(size)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12h.5" /><path d="M3 10h13" /></svg>;
}
export function IconList({ size = 24 }: P) {
  return <svg {...base(size)}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>;
}
export function IconMore({ size = 24 }: P) {
  return <svg {...base(size)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
}
export function IconPlus({ size = 26 }: P) {
  return <svg {...base(size)}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}
export function IconBack({ size = 22 }: P) {
  return <svg {...base(size)}><path d="M15 18l-6-6 6-6" /></svg>;
}
