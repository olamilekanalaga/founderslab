import { notFound } from "next/navigation";
import PrivateWorkspace from "@/components/PrivateWorkspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  if (!["founders", "companies", "spaces"].includes(section)) notFound();
  return <PrivateWorkspace section={section} id={id} />;
}
