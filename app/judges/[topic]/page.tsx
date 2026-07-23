import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JUDGE_TOPICS, judgeMeta, pageTitle, type JudgeTopic } from "../../routes";

type Params = { params: Promise<{ topic: string }> };

function isTopic(value: string): value is JudgeTopic {
  return (JUDGE_TOPICS as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return JUDGE_TOPICS.map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topic } = await params;
  if (!isTopic(topic)) return {};
  const meta = judgeMeta[topic];
  return {
    title: pageTitle(meta),
    description: meta.description,
    alternates: { canonical: `/judges/${topic}` },
  };
}

export default async function JudgeTopicPage({ params }: Params) {
  const { topic } = await params;
  if (!isTopic(topic)) notFound();
  return null;
}
