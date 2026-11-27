import {
  PROJECT_LOGO_SIZE,
  projectLogoSchema,
} from "@/lib/validation/project-logo";

export async function prepareProjectLogo(file: File) {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Choose a JPG, PNG or WebP image under 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const size = Math.min(
      1,
      PROJECT_LOGO_SIZE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * size));
    canvas.height = Math.max(1, Math.round(bitmap.height * size));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not read the logo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const prepared = projectLogoSchema.safeParse(canvas.toDataURL("image/png"));
    if (!prepared.success) throw new Error("Choose a smaller company logo.");
    return prepared.data;
  } finally {
    bitmap.close();
  }
}
