import { describe, expect, it } from "vitest";
import { buildImportErrorMessage } from "./useOperationalData";

describe("buildImportErrorMessage", () => {
  it("explains when the uploaded file does not follow the expected format", () => {
    const message = buildImportErrorMessage("vendas.xlsx", "Faltam colunas obrigatórias: CODIGO, PRODUTO");

    expect(message).toContain('Não foi possível importar "vendas.xlsx"');
    expect(message).toContain("Faltam colunas obrigatórias");
    expect(message).toContain("Revise o formato");
  });
});
