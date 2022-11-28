import { ArrowRightIcon } from "@heroicons/react/solid";
import { useRouter } from "next/router";
import { FormEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { User } from "@calcom/prisma/client";
import { trpc } from "@calcom/trpc/react";
import { Button, ImageUploader, showToast, TextArea } from "@calcom/ui";

import { AvatarSSR } from "@components/ui/AvatarSSR";

interface IUserProfile {
  user?: User;
}

type FormData = {
  bio: string;
};

const UserProfile = (props: IUserProfile) => {
  const { user } = props;
  const { t } = useLocale();
  const avatarRef = useRef<HTMLInputElement>(null!);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ defaultValues: { bio: user?.bio || "" } });
  const { data: eventTypes } = trpc.viewer.eventTypes.list.useQuery();
  const [imageSrc, setImageSrc] = useState<string>(user?.avatar || "");
  const utils = trpc.useContext();
  const router = useRouter();
  const createEventType = trpc.viewer.eventTypes.create.useMutation();

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (_data, context) => {
      if (context.avatar) {
        showToast(t("your_user_profile_updated_successfully"), "success");
        await utils.viewer.me.refetch();
      } else {
        try {
          if (eventTypes?.length === 0) {
            await Promise.all(
              DEFAULT_EVENT_TYPES.map(async (event) => {
                return createEventType.mutate(event);
              })
            );
          }
        } catch (error) {
          console.error(error);
        }

        await utils.viewer.me.refetch();
        router.push("/");
      }
    },
    onError: () => {
      showToast(t("problem_saving_user_profile"), "error");
    },
  });
  const onSubmit = handleSubmit((data: { bio: string }) => {
    const { bio } = data;

    mutation.mutate({
      bio,
      completedOnboarding: true,
    });
  });

  async function updateProfileHandler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredAvatar = avatarRef.current.value;
    mutation.mutate({
      avatar: enteredAvatar,
    });
  }

  const DEFAULT_EVENT_TYPES = [
    {
      title: t("15min_meeting"),
      slug: "15min",
      length: 15,
    },
    {
      title: t("30min_meeting"),
      slug: "30min",
      length: 30,
    },
    {
      title: t("secret_meeting"),
      slug: "secret",
      length: 15,
      hidden: true,
    },
  ];

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-row items-center justify-start rtl:justify-end">
        {user && <AvatarSSR user={user} alt="Profile picture" className="h-16 w-16" />}
        <input
          ref={avatarRef}
          type="hidden"
          name="avatar"
          id="avatar"
          placeholder="URL"
          className="mt-1 block w-full rounded-sm border border-gray-300 px-3 py-2 text-sm focus:border-neutral-800 focus:outline-none focus:ring-neutral-800"
          defaultValue={imageSrc}
        />
        <div className="flex items-center px-4">
          <ImageUploader
            target="avatar"
            id="avatar-upload"
            buttonMsg={t("add_profile_photo")}
            handleAvatarChange={(newAvatar) => {
              avatarRef.current.value = newAvatar;
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value"
              )?.set;
              nativeInputValueSetter?.call(avatarRef.current, newAvatar);
              const ev2 = new Event("input", { bubbles: true });
              avatarRef.current.dispatchEvent(ev2);
              updateProfileHandler(ev2 as unknown as FormEvent<HTMLFormElement>);
              setImageSrc(newAvatar);
            }}
            imageSrc={imageSrc}
          />
        </div>
      </div>
      <fieldset className="mt-8">
        <label htmlFor="bio" className="mb-2 block text-sm font-medium text-gray-700">
          {t("about")}
        </label>
        <TextArea
          {...register("bio", { required: true })}
          ref={bioRef}
          name="bio"
          id="bio"
          className="mt-1 block h-[60px] w-full rounded-sm border border-gray-300 px-3 py-2 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
          defaultValue={user?.bio || undefined}
          onChange={(event) => {
            setValue("bio", event.target.value);
          }}
        />
        {errors.bio && (
          <p data-testid="required" className="py-2 text-xs text-red-500">
            {t("required")}
          </p>
        )}
        <p className="mt-2 font-sans text-sm font-normal text-gray-600 dark:text-white">
          {t("few_sentences_about_yourself")}
        </p>
      </fieldset>
      <Button
        type="submit"
        className="mt-8 flex w-full flex-row justify-center rounded-md border border-black bg-black p-2 text-center text-sm text-white">
        {t("finish")}
        <ArrowRightIcon className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </form>
  );
};

export default UserProfile;
