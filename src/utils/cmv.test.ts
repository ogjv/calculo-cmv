import { describe, expect, it } from "vitest";
import { buildDashboardData, formatCurrency, formatNumber, formatPercent, mapRecipeRows, mapSalesRows } from "./cmv";
import type { RawRow, SalesTotalRow } from "../types";

describe("mapSalesRows", () => {
  it("merges rows with the same code and parses pt-BR currency values", () => {
    const rows: RawRow[] = [
      {
        Codigo: "10",
        Produto: "Burger Classic",
        Grupo: "Lanches",
        Subgrupo: "Burger",
        Qte: "2",
        Total: "R$ 45,90"
      },
      {
        codigo: "10",
        produto: "Burger Classic",
        grupo: "Lanches",
        subgrupo: "Burger",
        quantidade: "1",
        faturamento: "20,10"
      }
    ];

    expect(mapSalesRows(rows)).toEqual([
      {
        code: "10",
        itemName: "Burger Classic",
        group: "Lanches",
        subgroup: "Burger",
        quantity: 3,
        revenue: 66
      }
    ]);
  });
});

describe("mapRecipeRows", () => {
  it("derives technical cost from sale price and CMV percent when needed", () => {
    const rows: RawRow[] = [
      {
        Codigo: "20",
        "Produto do cardápio": "Pizza Margherita",
        Grupo: "Pizzas",
        Subgrupo: "Tradicionais",
        PrecoVenda: "50,00",
        CMV: "30"
      }
    ];

    expect(mapRecipeRows(rows)).toEqual([
      {
        code: "20",
        itemName: "Pizza Margherita",
        place: undefined,
        cost: 15,
        salePrice: 50,
        cmvPercent: 30,
        isPromotional: false,
        group: "Pizzas",
        subgroup: "Tradicionais"
      }
    ]);
  });
});

describe("buildDashboardData", () => {
  it("calculates dashboard totals, unmatched items and official total comparison", () => {
    const sales = mapSalesRows([
      {
        Codigo: "10",
        Produto: "Burger Classic",
        Grupo: "Lanches",
        Subgrupo: "Burger",
        Qte: "2",
        Total: "40,00"
      },
      {
        Codigo: "11",
        Produto: "Sobremesa sem FT",
        Grupo: "Sobremesas",
        Subgrupo: "Doces",
        Qte: "1",
        Total: "12,00"
      }
    ]);

    const recipes = mapRecipeRows([
      {
        Codigo: "10",
        Produto: "Burger Classic",
        Grupo: "Lanches",
        Subgrupo: "Burger",
        Custo: "8,50",
        PrecoVenda: "20,00",
        CMV: "42,5"
      }
    ]);

    const totals: SalesTotalRow[] = [
      {
        level: "general",
        label: "Consolidado",
        group: "Todas",
        subgroup: "Todas",
        quantity: 3,
        revenue: 52
      }
    ];

    const dashboard = buildDashboardData(sales, recipes, totals);

    expect(dashboard.totalRevenue).toBe(52);
    expect(dashboard.totalCost).toBe(17);
    expect(dashboard.grossProfit).toBe(35);
    expect(dashboard.totalQuantity).toBe(3);
    expect(dashboard.averageCMV).toBe(42.5);
    expect(dashboard.unmatchedItems).toEqual(["Sobremesa sem FT"]);
    expect(dashboard.totalComparison).toEqual({
      officialRevenue: 52,
      parsedRevenue: 52,
      revenueDifference: 0,
      officialQuantity: 3,
      parsedQuantity: 3,
      quantityDifference: 0
    });
  });
});

describe("formatters", () => {
  it("formats currency, numbers and percent in pt-BR", () => {
    expect(formatCurrency(1234.5)).toBe("R$\u00a01.234,50");
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatPercent(42.5)).toBe("42,50%");
  });
});
