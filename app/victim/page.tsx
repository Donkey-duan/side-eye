import type { Metadata } from "next";
import { pageTitle, sectionMeta } from "../routes";

export const metadata: Metadata = {
  title: pageTitle(sectionMeta.victim),
  description: sectionMeta.victim.description,
  alternates: { canonical: "/victim" },
};

export default function VictimHubPage() {
  return null;
}
