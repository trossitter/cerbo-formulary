/**
 * Stubbed identity. Real auth is explicitly out of scope (PRD); the app
 * runs as one seeded provider and a fixed roster of patients, switched
 * via a header toggle. This module is the seam where a real auth system
 * (sessions, roles, patient records) would slot in.
 */

export const PROVIDER = {
  name: "Dr. Maya Okafor",
  practice: "Lakeside Functional Medicine",
} as const;

export const PATIENTS = [
  { id: "pt-jordan", name: "Jordan Reyes" },
  { id: "pt-amara", name: "Amara Whitfield" },
  { id: "pt-theo", name: "Theo Lindqvist" },
] as const;

export type Role = "provider" | "patient";

export const ROLE_COOKIE = "viewing-as";
