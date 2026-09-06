import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { userSession } from "./fixtures.ts";
import { setSession } from "./msw/handlers.ts";
import { renderApp } from "./render.tsx";

describe("home", () => {
  it("asks a Guest to sign in", async () => {
    await renderApp("/");

    expect(await screen.findByText("Sign in to create an Event")).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeDefined();
  });

  it("shows Create Event for a signed-in User", async () => {
    setSession(userSession("user"));
    await renderApp("/");

    expect(await screen.findByRole("heading", { name: "Create Event" })).toBeDefined();
  });
});
