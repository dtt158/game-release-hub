export function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `${year}年${Number(value)}月`;
}

export function getMonthRange(anchor = new Date(), monthsBack = 3, monthsForward = 18): string[] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth() - monthsBack, 1);
  const total = monthsBack + monthsForward + 1;
  return Array.from({ length: total }, (_, index) => {
    const month = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return formatMonth(month);
  });
}

export function toMonth(date: string | null | undefined): string | null {
  return date ? date.slice(0, 7) : null;
}

export function getRangeBounds(anchor = new Date(), monthsBack = 3, monthsForward = 18) {
  const months = getMonthRange(anchor, monthsBack, monthsForward);
  const [lastYear, lastMonth] = months[months.length - 1].split("-").map(Number);
  const lastDay = new Date(lastYear, lastMonth, 0).getDate();
  return {
    rangeStart: `${months[0]}-01`,
    rangeEnd: `${months[months.length - 1]}-${String(lastDay).padStart(2, "0")}`,
    months,
  };
}
