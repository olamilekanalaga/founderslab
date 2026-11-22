import Image from "next/image";
import logo from "@/public/founders-lab-logo.jpg";

/** Original uploaded logo, optimised at display size for public/private branding. */
export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <Image
      src={logo}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      loading="eager"
      style={{ borderRadius: 5 }}
    />
  );
}
