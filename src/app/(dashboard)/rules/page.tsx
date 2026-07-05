import { RulesView } from "@/components/dashboard/rules-view";

export const metadata = { title: "Rules" };

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ repositoryId?: string }>;
}) {
  const { repositoryId } = await searchParams;
  return <RulesView initialRepositoryId={repositoryId} />;
}
