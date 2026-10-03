import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsentProvider, useConsent, readConsent } from "./consent";
function Consumer() {
  const { analytics, manage, track } = useConsent();
  return (
    <>
      <output>{analytics ? "analytics on" : "analytics off"}</output>
      <button onClick={manage}>Edit choice</button>
      <button onClick={() => track("search")}>Track search</button>
    </>
  );
}
describe("optional cookie consent", () => {
  it("defaults off, rejects optional analytics and persists a decision", () => {
    render(
      <ConsentProvider>
        <Consumer />
      </ConsentProvider>,
    );
    expect(screen.getByText("analytics off")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reject optional cookies"));
    expect(readConsent()).toEqual({ version: 1, analytics: false });
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
  });
  it("accepts and supports withdrawing consent from preferences", () => {
    render(
      <ConsentProvider>
        <Consumer />
      </ConsentProvider>,
    );
    fireEvent.click(screen.getByText("Accept optional cookies"));
    expect(readConsent()?.analytics).toBe(true);
    fireEvent.click(screen.getByText("Edit choice"));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Optional analytics/ }),
    );
    fireEvent.click(screen.getByText("Save preferences"));
    expect(readConsent()?.analytics).toBe(false);
  });
  it("never requests analytics before consent or after rejecting", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    render(
      <ConsentProvider>
        <Consumer />
      </ConsentProvider>,
    );
    fireEvent.click(screen.getByText("Track search"));
    fireEvent.click(screen.getByText("Reject optional cookies"));
    fireEvent.click(screen.getByText("Track search"));
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
  it("treats corrupt saved preferences as no consent", () => {
    localStorage.setItem("findback-consent-v1", "{broken");
    expect(readConsent()).toBeNull();
  });
});
