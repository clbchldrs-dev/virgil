export type FlightDeckActionStatus =
  | "idle"
  | "confirming"
  | "submitting"
  | "success"
  | "failed";

export type FlightDeckActionState = {
  status: FlightDeckActionStatus;
  message: string | null;
  requestId: string | null;
};

export type FlightDeckActionEvent =
  | { type: "request_confirm" }
  | { type: "cancel_confirm" }
  | { type: "submit" }
  | { type: "succeeded"; message: string; requestId: string | null }
  | { type: "failed"; message: string }
  | { type: "reset" };

export const initialFlightDeckActionState: FlightDeckActionState = {
  status: "idle",
  message: null,
  requestId: null,
};

export function reduceFlightDeckActionState(
  state: FlightDeckActionState,
  event: FlightDeckActionEvent
): FlightDeckActionState {
  switch (event.type) {
    case "request_confirm":
      if (state.status === "submitting") {
        return state;
      }
      return {
        status: "confirming",
        message: null,
        requestId: null,
      };
    case "cancel_confirm":
      if (state.status !== "confirming") {
        return state;
      }
      return {
        status: "idle",
        message: null,
        requestId: null,
      };
    case "submit":
      if (state.status !== "confirming") {
        return state;
      }
      return {
        status: "submitting",
        message: null,
        requestId: null,
      };
    case "succeeded":
      return {
        status: "success",
        message: event.message,
        requestId: event.requestId,
      };
    case "failed":
      return {
        status: "failed",
        message: event.message,
        requestId: null,
      };
    case "reset":
      return initialFlightDeckActionState;
    default:
      return state;
  }
}
