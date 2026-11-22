import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export default async function Icon() {
  const image = (
    await readFile(join(process.cwd(), "public/founders-lab-logo.jpg"))
  ).toString("base64");
  return new ImageResponse(
    <img
      src={`data:image/jpeg;base64,${image}`}
      width={64}
      height={64}
      alt=""
    />,
    size,
  );
}
