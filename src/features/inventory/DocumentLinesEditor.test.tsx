import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DocumentLinesEditor } from "./DocumentLinesEditor";

const mockUseProducts = vi.fn();

vi.mock("@/features/catalog/hooks", () => ({
  useProducts: (...args: unknown[]) => mockUseProducts(...args),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: vi
      .fn()
      .mockResolvedValue({ data: { stock_quantity_mode: "integer" } }),
  },
}));

function TestHarness() {
  const [lines, setLines] = useState<any[]>([]);

  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DocumentLinesEditor
        lines={lines}
        onChange={setLines}
        showUnitCost
        showUnitPrice
        showDiscount
        showTotals
      />
    </QueryClientProvider>
  );
}

describe("DocumentLinesEditor", () => {
  beforeEach(() => {
    mockUseProducts.mockReset();
  });

  it("focuses the product search after adding an item", async () => {
    mockUseProducts.mockReturnValue({ data: [], isLoading: false });

    const user = userEvent.setup();
    render(<TestHarness />);

    const addButton = screen.getByRole("button", { name: /agregar ítem/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Buscar por nombre o código de barras..."),
      ).toHaveFocus();
    });
  });

  it("auto selects the only matching product from search", async () => {
    const payload = {
      id: 42,
      name: "Producto único",
      isbn: "123",
      codigo_interno: "ABC",
      stock_actual: 5,
      pvp: 100,
    };

    mockUseProducts.mockImplementation(({ name }: { name?: string }) => ({
      data: name ? [payload] : [],
      isLoading: false,
    }));

    const user = userEvent.setup();
    render(<TestHarness />);

    const addButton = screen.getByRole("button", { name: /agregar ítem/i });
    await user.click(addButton);

    const input = screen.getByPlaceholderText(
      "Buscar por nombre o código de barras...",
    );
    await user.type(input, "ABC");

    await waitFor(() => {
      expect(input).toHaveValue("Producto único");
    });
  });
});
