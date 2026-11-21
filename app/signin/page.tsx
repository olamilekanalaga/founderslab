import { databaseUrl, publicDemoAllowed } from "@/lib/server-env";
import AuthScreen from "@/components/AuthScreen";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <AuthScreen
      configured={Boolean(databaseUrl())}
      allowDemo={publicDemoAllowed()}
    />
  );
}
