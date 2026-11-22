import { ImageResponse } from "next/og";
import BrandMark from "@/components/shared/BrandMark";
export const alt =
  "Founders Lab. Meet the founders building Web3. Saturdays on X Spaces with Ola_Crrypt.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
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
        <BrandMark size={42} />
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
        Saturdays on X Spaces. Hosted by Ola_Crrypt.
      </div>
    </div>,
    size,
  );
}
