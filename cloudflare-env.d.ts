declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    SESSION_PEPPER?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    ONAIR_GATEWAY_SECRET?: string;
    ONAIR_GATEWAY_ORIGIN?: string;
  }
}
