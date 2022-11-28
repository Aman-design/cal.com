import { InferGetStaticPropsType } from "next";
import Link from "next/link";

import { getAppRegistry } from "@calcom/app-store/_appRegistry";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon, Shell, SkeletonText } from "@calcom/ui";

export default function Apps({ categories }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t, isLocaleReady } = useLocale();

  return (
    <Shell isPublic large>
      <div className="text-md flex items-center gap-1 px-4 pb-3 pt-3 font-normal md:px-8 lg:px-0 lg:pt-0">
        <Link href="/apps">
          <a className="inline-flex items-center justify-start gap-1 rounded-sm py-2 text-gray-900">
            <Icon.FiArrowLeft className="h-4 w-4" />
            {isLocaleReady ? t("app_store") : <SkeletonText className="h-6 w-24" />}{" "}
          </a>
        </Link>
      </div>
      <div className="mb-16">
        <div className="grid h-auto w-full grid-cols-5 gap-3">
          {categories.map((category) => (
            <Link key={category.name} href={"/apps/categories/" + category.name}>
              <a
                data-testid={`app-store-category-${category.name}`}
                className="relative flex rounded-sm bg-gray-100 px-6 py-4 sm:block">
                <div className="self-center">
                  <h3 className="font-medium capitalize">{category.name}</h3>
                  <p className="text-sm text-gray-500">
                    {t("number_apps", { count: category.count })}{" "}
                    <Icon.FiArrowRight className="inline-block h-4 w-4" />
                  </p>
                </div>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export const getStaticProps = async () => {
  const appStore = await getAppRegistry();
  const categories = appStore.reduce((c, app) => {
    c[app.category] = c[app.category] ? c[app.category] + 1 : 1;
    return c;
  }, {} as Record<string, number>);

  return {
    props: {
      categories: Object.entries(categories).map(([name, count]) => ({ name, count })),
    },
  };
};
