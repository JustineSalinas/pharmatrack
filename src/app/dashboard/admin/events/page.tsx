"use client";

/**
 * Admin Event Management — re-uses the facilitator events page since both roles
 * have identical CRUD needs and RLS (is_council()) permits both. The page is
 * intentionally a thin wrapper so the form/list logic stays in one place.
 */
import FacilitatorEvents from "@/app/dashboard/facilitator/events/page";

export default function AdminEventsPage() {
  return <FacilitatorEvents />;
}
