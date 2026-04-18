import { supabase } from './supabase';

/**
 * Generates a random alphanumeric string of a given length.
 */
function generateShortCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Gets an existing short link for a destination, or creates a new one.
 * @param destination The full URL path (e.g., /reports/club/ladder/date)
 * @returns The short code (e.g., aB3dE)
 */
export async function getOrCreateShortLink(destination: string): Promise<string> {
  // Normalize destination: decode any existing encoding then re-encode properly
  // to ensure '/reports/Club%20Name' is always treated exactly the same.
  const parts = destination.split('/');
  const normalizedDestination = parts.map(p => encodeURIComponent(decodeURIComponent(p))).join('/');

  try {
    // 1. Check if it already exists
    const { data: existing, error: selectError } = await supabase
      .from('short_links')
      .select('id')
      .eq('destination', normalizedDestination)
      .maybeSingle();

    if (selectError) {
      console.warn('Error checking for existing short link:', selectError);
    } else if (existing) {
      return existing.id;
    }

    // 2. Generate a unique code and attempt to insert
    let attempts = 0;
    while (attempts < 5) {
      const code = generateShortCode();
      const { error } = await supabase
        .from('short_links')
        .insert({ id: code, destination: normalizedDestination });

      if (!error) {
        return code;
      }

      // If it's a conflict error (23505)
      if (error.code === '23505') {
        const { data: retryData } = await supabase
          .from('short_links')
          .select('id')
          .eq('destination', normalizedDestination)
          .maybeSingle();
        
        if (retryData) {
          return retryData.id;
        }
        attempts++;
        continue;
      }

      console.error('Database error in getOrCreateShortLink:', error);
      throw error;
    }

    throw new Error('Failed to generate a unique short link.');
  } catch (err: any) {
    console.error('getOrCreateShortLink failed:', err);
    // Alert the error so the user can show us what's wrong
    window.alert('Shortener Error: ' + (err.message || JSON.stringify(err)));
    throw err;
  }
}
