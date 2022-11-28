const VERCEL_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
const RAILWAY_STATIC_URL = process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "";
const HEROKU_URL = process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : "";
export const WEBAPP_URL =
  process.env.NEXT_PUBLIC_WEBAPP_URL || VERCEL_URL || RAILWAY_STATIC_URL || HEROKU_URL;
/** @deprecated use `WEBAPP_URL` */
export const BASE_URL = WEBAPP_URL;
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://cal.com";

// This is the URL from which all Cal Links and their assets are served.
// Use website URL to make links shorter(cal.com and not app.cal.com)
// As website isn't setup for preview environments, use the webapp url instead
export const CAL_URL = new URL(WEBAPP_URL).hostname.endsWith(".vercel.app") ? WEBAPP_URL : WEBSITE_URL;

export const CONSOLE_URL =
  new URL(WEBAPP_URL).hostname.endsWith(".cal.dev") || process.env.NODE_ENV !== "production"
    ? `https://console.cal.dev`
    : `https://console.cal.com`;
export const IS_SELF_HOSTED = !(
  new URL(WEBAPP_URL).hostname.endsWith(".cal.dev") || new URL(WEBAPP_URL).hostname.endsWith(".cal.com")
);
export const EMBED_LIB_URL = process.env.NEXT_PUBLIC_EMBED_LIB_URL || `${WEBAPP_URL}/embed/embed.js`;
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const TRIAL_LIMIT_DAYS = 14;
export const HOSTED_CAL_FEATURES = process.env.HOSTED_CAL_FEATURES || BASE_URL === "https://app.cal.com";
/** @deprecated use `WEBAPP_URL` */
export const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_WEBAPP_URL || `https://${process.env.VERCEL_URL}`;
export const LOGO = "/calcom-logo-white-word.svg";
export const LOGO_ICON = "/cal-com-icon-white.svg";
export const ROADMAP = "https://cal.com/roadmap";
export const DESKTOP_APP_LINK = "https://cal.com/download";
export const JOIN_SLACK = "https://cal.com/slack";
export const POWERED_BY_URL = `${WEBSITE_URL}/?utm_source=embed&utm_medium=powered-by-button`;
export const DOCS_URL = "https://docs.cal.com";
export const DEVELOPER_DOCS = "https://developer.cal.com";
export const SEO_IMG_DEFAULT = `${WEBSITE_URL}/og-image.png`;
export const SEO_IMG_OGIMG = `${CAL_URL}/api/social/og/image`;
export const SEO_IMG_OGIMG_VIDEO = `${WEBSITE_URL}/video-og-image.png`;
export const IS_STRIPE_ENABLED = !!(
  process.env.STRIPE_CLIENT_ID &&
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY &&
  process.env.STRIPE_PRIVATE_KEY
);
/** Self hosted shouldn't checkout when creating teams unless required */
export const IS_TEAM_BILLING_ENABLED = IS_STRIPE_ENABLED && (!IS_SELF_HOSTED || HOSTED_CAL_FEATURES);
