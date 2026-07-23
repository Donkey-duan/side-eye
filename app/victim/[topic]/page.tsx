import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VICTIM_TOPICS, pageTitle, victimMeta, type VictimTopic } from "../../routes";

type Params = { params: Promise<{ topic: string }> };

function isTopic(value: string): value is VictimTopic {
  return (VICTIM_TOPICS as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return VICTIM_TOPICS.map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topic } = await params;
  if (!isTopic(topic)) return {};
  const meta = victimMeta[topic];
  return {
    title: pageTitle(meta),
    description: meta.description,
    alternates: { canonical: `/victim/${topic}` },
  };
}

export default async function VictimTopicPage({ params }: Params) {
  const { topic } = await params;
  if (!isTopic(topic)) notFound();
  return null;
}
