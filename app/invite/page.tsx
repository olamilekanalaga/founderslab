import AuthScreen from "@/components/AuthScreen";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthScreen invite configured={Boolean(process.env.DATABASE_URL)} />;
}
