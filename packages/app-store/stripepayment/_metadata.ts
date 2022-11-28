import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Stripe",
  description: _package.description,
  installed: !!(
    process.env.STRIPE_CLIENT_ID &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY &&
    process.env.STRIPE_PRIVATE_KEY
  ),
  slug: "stripe",
  category: "payment",
  logo: "/api/app-store/stripepayment/icon.svg",
  rating: 4.6,
  trending: true,
  reviews: 69,
  imageSrc: "/api/app-store/stripepayment/icon.svg",
  publisher: "Cal.com",
  title: "Stripe",
  type: "stripe_payment",
  url: "https://cal.com/",
  docsUrl: "https://stripe.com/docs",
  variant: "payment",
  extendsFeature: "EventType",
  verified: true,
  email: "help@cal.com",
} as AppMeta;

export default metadata;
