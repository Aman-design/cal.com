import { randomString } from "@calcom/lib/random";
import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Huddle01",
  description: _package.description,
  installed: true,
  type: "huddle01_video",
  imageSrc: "/api/app-store/huddle01video/icon.svg",
  variant: "conferencing",
  logo: "/api/app-store/huddle01video/icon.svg",
  publisher: "huddle01.com",
  url: "https://huddle01.com",
  verified: true,
  rating: 0, // TODO: placeholder for now, pull this from TrustPilot or G2
  reviews: 0, // TODO: placeholder for now, pull this from TrustPilot or G2
  category: "web3",
  slug: "huddle01",
  title: "Huddle01",
  trending: true,
  isGlobal: false,
  email: "support@huddle01.com",
  appData: {
    location: {
      linkType: "dynamic",
      type: "integrations:huddle01",
      label: "Huddle01 Video",
    },
  },
  key: { apikey: randomString(12) },
} as AppMeta;

export default metadata;
