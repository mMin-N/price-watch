import Image from "next/image";
import Link from "next/link";

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="mb-8 flex items-center justify-center gap-2 text-xl font-semibold text-brand-purple"
    >
      <Image src="/icon.png" alt="" width={36} height={36} className="rounded-lg" priority />
      Dropt
    </Link>
  );
}
