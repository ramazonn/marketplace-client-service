export class CacheTTLUtil {
  static withRandomTTL(seconds: number): number {
    const randomSeconds = Math.floor(Math.random() * (59 * 60));

    return seconds + randomSeconds;
  }
}