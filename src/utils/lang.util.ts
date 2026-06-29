export function getBaseLanguage(lang: string): string {
  // Extract the base language code (e.g., 'en' from 'en-US')
  const baseLang = lang.split('-')[0].toLowerCase();

  // Map the base language to the supported languages in your system
  const supportedLanguages = ['en', 'ru', 'uz'];
  return supportedLanguages.includes(baseLang) ? baseLang : 'uz'; // Default to 'uz' if not supported
}
