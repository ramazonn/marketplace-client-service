export const searchNormalization = (input: string): string => {
  if (!input) return '';

  return input
    .toLowerCase()
    .replace(/[-/\\^$*+?.()|[\]{}&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
};
