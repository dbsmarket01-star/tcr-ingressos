import { describe, expect, it } from "vitest";
import { DESKTOP_DAYS_PER_PAGE, getDailySalesPage, MOBILE_DAYS_PER_PAGE } from "@/components/admin/DashboardDailySalesChart";

describe("paginação do gráfico diário", () => {
  const days = Array.from({ length: 129 }, (_, index) => index);

  it("mostra no máximo 14 dias por tela no desktop, incluindo o dia final", () => {
    const page = getDailySalesPage(days, DESKTOP_DAYS_PER_PAGE, 99);
    expect(page.pageCount).toBe(10);
    expect(page.page).toBe(9);
    expect(page.days).toEqual(days.slice(115));
  });

  it("mostra no máximo 7 dias por tela no celular, sem perder dias", () => {
    const pages = Array.from({ length: 19 }, (_, index) => getDailySalesPage(days, MOBILE_DAYS_PER_PAGE, index));
    expect(pages.flatMap((page) => page.days)).toEqual(days);
    expect(pages.every((page) => page.days.length <= 7)).toBe(true);
  });

  it("mantém uma página vazia e limita navegação fora do intervalo", () => {
    expect(getDailySalesPage([], DESKTOP_DAYS_PER_PAGE, 2)).toEqual({ page: 0, pageCount: 1, days: [] });
    expect(getDailySalesPage(days, DESKTOP_DAYS_PER_PAGE, -3).days).toEqual(days.slice(0, 3));
  });
});
