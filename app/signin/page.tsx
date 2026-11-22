import { databaseUrl } from "@/server/config/environment";
import AuthScreen from "@/features/auth/components/AdminSignIn";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthScreen configured={Boolean(databaseUrl())} />;
}
