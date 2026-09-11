// Menneskelig "hvor længe siden" for et tidspunkt, dansk. Bruges bl.a. til at
// vise hvor længe et sendt interview har ventet på svar.
export function daysAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  return `${days} dage siden`;
}
