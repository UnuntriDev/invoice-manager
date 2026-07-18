/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryErrorState } from "@/components/query-error-state";

it("shows an API error instead of an empty state and exposes retry", () => {
  const onRetry = jest.fn();
  render(
    <QueryErrorState
      title="Nie udało się pobrać bufora"
      error={new Error("HTTP 500")}
      onRetry={onRetry}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Nie udało się pobrać bufora",
  );
  expect(screen.getByText("HTTP 500")).toBeInTheDocument();
  expect(screen.queryByText("Bufor jest pusty")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
