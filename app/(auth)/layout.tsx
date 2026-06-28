import { AuthBrand } from "@/components/auth-brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 py-12">
      <AuthBrand />
      {children}
    </div>
  );
}
