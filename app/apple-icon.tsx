import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await readFile(
    join(process.cwd(), "public/founders-lab-logo.jpg"),
    "base64",
  );
  return new ImageResponse(
    <img
      src={`data:image/jpeg;base64,${logo}`}
      width={size.width}
      height={size.height}
      alt=""
    />,
    size,
  );
}
