import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
export const alt =
  "Founders Lab. Meet the founders building Web3. Sundays on X Spaces with ⭕️La_Crrypt💰₿.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const logo = `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "public/founders-lab-logo.jpg"))).toString("base64")}`;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#f8f5fd",
        width: "100%",
        height: "100%",
        padding: "65px 75px",
        color: "#251c36",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 31,
          fontWeight: 600,
          color: "#6946d3",
        }}
      >
        {/* ImageResponse needs a native image rather than Next.js image optimisation. */}
        <img
          src={logo}
          width={42}
          height={42}
          alt=""
          style={{ borderRadius: 6 }}
        />
        <span>Founders Lab</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 72,
          fontSize: 75,
          fontWeight: 600,
          letterSpacing: -3,
          lineHeight: 1.08,
        }}
      >
        <span>Meet the founders</span>
        <span style={{ color: "#6946d3" }}>building Web3.</span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "auto",
          fontSize: 24,
          color: "#78688a",
        }}
      >
        <span>Sundays on X Spaces. Hosted by </span>
        {/* Local vector symbols preserve the host identity without remote emoji downloads. */}
        <span style={{ display: "flex", alignItems: "center", marginLeft: 6 }}>
          <svg width="23" height="23" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="8"
              fill="none"
              stroke="#ed4245"
              strokeWidth="4"
            />
          </svg>
          <span>La_Crrypt</span>
          <svg width="25" height="27" viewBox="0 0 32 32">
            <path
              d="M11 3h10l-3 6h-4zM13 10C9 14 4 19 6 25c2 6 18 6 20 0 2-6-3-11-7-15z"
              fill="#e8b542"
              stroke="#a77c19"
            />
            <path
              d="M19 16h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-4m3-10v12"
              fill="none"
              stroke="#67501d"
              strokeWidth="1.7"
            />
          </svg>
          <svg width="23" height="25" viewBox="0 0 24 28">
            <path
              d="M7 6h8a4 4 0 0 1 0 8H7h9a4 4 0 0 1 0 8H7V6m3-3v3m4-3v3m-4 16v3m4-3v3"
              fill="none"
              stroke="#78688a"
              strokeWidth="2.4"
            />
          </svg>
        </span>
        <span>.</span>
      </div>
    </div>,
    size,
  );
}
