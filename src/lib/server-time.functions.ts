import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the current server time as a UTC epoch in ms.
 * Used by the client to compute an offset against its own clock so
 * coupon countdowns and the auto-switch to « EN COURS » are robust to
 * a user's device clock being skewed.
 */
export const getServerTime = createServerFn({ method: "GET" }).handler(async () => {
  return { now: Date.now() };
});
