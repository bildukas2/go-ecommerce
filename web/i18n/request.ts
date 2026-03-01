import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';
import {deepMerge} from '@/lib/utils';

export default getRequestConfig(async ({requestLocale}) => {
  // This should typically correspond to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  // Load default messages
  const defaultMessages = (await import(`./messages/${locale}.json`)).default;

  // Try to load override messages
  let overrideMessages = {};
  try {
    // We use a separate try-catch to ensure that if the file doesn't exist, we just skip overrides
    overrideMessages = (await import(`../theme/overrides/messages/${locale}.json`)).default;
  } catch (error) {
    // Ignore error if override file is missing
  }

  return {
    locale,
    messages: deepMerge(defaultMessages, overrideMessages)
  };
});
