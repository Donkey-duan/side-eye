import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_SECTIONS, pageTitle, sectionMeta, type SiteSection } from "../routes";

type Params = { params: Promise<{ section: string }> };

function isSection(value: string): value is SiteSection {
  return (ALL_SECTIONS as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return ALL_SECTIONS.map((section) => ({ section }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  if (!isSection(section)) return {};
  const meta = sectionMeta[section];
  return {
    title: pageTitle(meta),
    description: meta.description,
    alternates: { canonical: `/${section}` },
  };
}

export default async function SectionPage({ params }: Params) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  return null;
}
