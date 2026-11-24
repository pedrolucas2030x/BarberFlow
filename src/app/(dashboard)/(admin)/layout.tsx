import { requireWorkspace } from "@/features/workspace/access";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireWorkspace();
  return children;
}
