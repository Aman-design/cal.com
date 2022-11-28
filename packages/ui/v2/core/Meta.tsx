import Head from "next/head";
import React, { createContext, useContext, useState, useEffect } from "react";

type MetaType = {
  title: string;
  description: string;
  backButton?: boolean;
  CTA?: React.ReactNode;
};

const initialMeta: MetaType = {
  title: "",
  description: "",
  backButton: false,
  CTA: null,
};

const MetaContext = createContext({
  meta: initialMeta,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setMeta: (newMeta: Partial<MetaType>) => {},
});

export function useMeta() {
  return useContext(MetaContext);
}

export function MetaProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState(initialMeta);
  const setMeta = (newMeta: Partial<MetaType>) => {
    setValue((v) => ({ ...v, ...newMeta }));
  };

  return <MetaContext.Provider value={{ meta: value, setMeta }}>{children}</MetaContext.Provider>;
}

/**
 * The purpose of this component is to simplify title and description handling.
 * Similarly to `next/head`'s `Head` component this allow us to update the metadata for a page
 * from any children, also exposes the metadata via the `useMeta` hook in case we need them
 * elsewhere (ie. on a Heading, Title, Subtitle, etc.)
 * @example <Meta title="Password" description="Manage settings for your account passwords" />
 */
export default function Meta({ title, description, backButton, CTA }: MetaType) {
  const { setMeta, meta } = useMeta();

  /* @TODO: maybe find a way to have this data on first render to prevent flicker */
  useEffect(() => {
    if (meta.title !== title || meta.description !== description) {
      setMeta({ title, description, backButton, CTA });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, backButton, CTA]);

  return (
    <Head>
      <title>{title} | Cal.com</title>
      <meta name="description" content={description} />
    </Head>
  );
}
