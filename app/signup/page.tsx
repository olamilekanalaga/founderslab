import { notFound } from "next/navigation";
import { databaseUrl } from "@/server/config/environment";
import { workspaceSignupEnabled } from "@/server/services/workspace-signup";
import WorkspaceSignup from "@/features/auth/components/WorkspaceSignup";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!process.env.WORKSPACE_SIGNUP_KEY) notFound();
  return (
    <WorkspaceSignup
      enabled={Boolean(databaseUrl()) && (await workspaceSignupEnabled())}
    />
  );
}
