import { describe, expect, it } from "vitest";
import { buildImportErrorMessage } from "./useOperationalData";

describe("buildImportErrorMessage", () => {
  it("explains when the uploaded file does not follow the expected format", () => {
    const message = buildImportErrorMessage("vendas.xlsx", "Faltam colunas obrigatórias: CODIGO, PRODUTO");

    expect(message).toContain("não está no padrão esperado pelo sistema");
    expect(message).toContain("Faltam colunas obrigatórias");
    expect(message).toContain("Verifique o formato");
  });
});
