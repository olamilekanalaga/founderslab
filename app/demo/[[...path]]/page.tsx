import { notFound, redirect } from "next/navigation";
import Workspace from "@/components/Workspace";
import { SECTIONS, type Section } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Demo({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const section = (path[0] || "dashboard") as Section;
  if (
    [
      "research",
      "classification",
      "market-map",
      "opportunities",
      "space-data",
    ].includes(section)
  )
    redirect("/demo/founders");
  if (
    !SECTIONS.includes(section) ||
    path.length > 2 ||
    (path.length === 2 &&
      !["founders", "companies", "spaces"].includes(section))
  )
    notFound();
  return <Workspace demo section={section} id={path[1]} />;
}
