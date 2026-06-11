export type EventType = "Department" | "University Wide" | "Pharmacy";

export const EVENT_TYPES: EventType[] = ["Department", "University Wide", "Pharmacy"];

export interface EventTypeStyle {
  color: string;
  bg: string;
  border: string;
  label: string;
}

export function getEventTypeStyle(type: string | null | undefined): EventTypeStyle {
  switch (type) {
    case "University Wide":
      return {
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.1)",
        border: "rgba(239, 68, 68, 0.25)",
        label: "University Wide",
      };
    case "Pharmacy":
      return {
        color: "#a78bfa",
        bg: "rgba(167, 139, 250, 0.1)",
        border: "rgba(167, 139, 250, 0.25)",
        label: "Pharmacy",
      };
    default:
      return {
        color: "#D4AF37",
        bg: "rgba(212, 175, 55, 0.1)",
        border: "rgba(212, 175, 55, 0.25)",
        label: "Department",
      };
  }
}
