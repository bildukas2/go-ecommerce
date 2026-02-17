export function selectProductGridImage(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const explicitDefault = images.find((image) => image && image.isDefault === true);
  return explicitDefault?.url ?? images[0]?.url ?? null;
}
