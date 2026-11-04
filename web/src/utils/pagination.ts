/** 分页器可见页码: 页数过多时只显示当前页附近的窗口, 并用省略号表示被省略的部分 */
export const getVisiblePages = (
  totalPages: number,
  current: number,
  sibling = 1,
): (number | "ellipsis")[] => {
  const MAX_ITEMS = 7; // first + last + current + 2*sibling + 最多2个省略号
  if (totalPages <= MAX_ITEMS)
    return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages]);
  for (
    let i = Math.max(1, current - sibling);
    i <= Math.min(totalPages, current + sibling);
    i++
  ) {
    pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  sorted.forEach((n, idx) => {
    if (idx > 0 && n - sorted[idx - 1] > 1) result.push("ellipsis");
    result.push(n);
  });
  return result;
};
