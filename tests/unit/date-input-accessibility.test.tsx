/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DateInput,
  displayDateToIso,
} from "@/components/ui/date-input";

describe("DateInput", () => {
  it.each([
    ["31.02.2026", null],
    ["29.02.2025", null],
    ["29.02.2024", "2024-02-29"],
    ["31.12.2026", "2026-12-31"],
  ])("strictly parses %s", (display, expected) => {
    expect(displayDateToIso(display)).toBe(expected);
  });

  it("keeps the calendar trigger reachable by keyboard", async () => {
    const user = userEvent.setup();
    render(
      <DateInput id="issue-date" value="2026-07-16" onChange={jest.fn()} />,
    );

    await user.tab();
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Otwórz kalendarz" }),
    ).toHaveFocus();
  });

  it("does not emit a normalized value for a nonexistent date", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DateInput value="" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.type(input, "31.02.2026");
    await user.tab();

    expect(onChange).not.toHaveBeenCalledWith("2026-02-31");
  });
});
