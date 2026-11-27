import { z } from "zod";

export const PROJECT_LOGO_SIZE = 96;
export const PROJECT_LOGO_PREFIX = "data:image/png;base64,";

export const projectLogoSchema = z
  .string()
  .max(53_000, "Use a smaller company logo.")
  .regex(
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Choose a valid company logo.",
  )
  .refine((value) => {
    try {
      const image = atob(value.slice(PROJECT_LOGO_PREFIX.length));
      if (
        !image.startsWith("\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR") ||
        !image.endsWith("IEND\xaeB\x60\x82")
      )
        return false;
      const header = new DataView(
        Uint8Array.from(image.slice(16, 24), (byte) => byte.charCodeAt(0))
          .buffer,
      );
      const width = header.getUint32(0);
      const height = header.getUint32(4);
      return (
        width >= 1 &&
        height >= 1 &&
        width <= PROJECT_LOGO_SIZE &&
        height <= PROJECT_LOGO_SIZE
      );
    } catch {
      return false;
    }
  }, "Choose a valid company logo.");
