import { LinkIcon, SearchIcon } from "@heroicons/react/outline";
import { Dispatch, SetStateAction, useState } from "react";

import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogFooter } from "@calcom/ui";

interface ISearchDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  onSave: (url: string) => void;
}

const MODE_SEARCH = "search" as const;
const MODE_URL = "url" as const;
type Mode = typeof MODE_SEARCH | typeof MODE_URL;

export const SearchDialog = (props: ISearchDialog) => {
  const { t } = useLocale();
  const [gifImage, setGifImage] = useState<string>("");
  const [nextOffset, setNextOffset] = useState<number>(0);
  const [keyword, setKeyword] = useState<string>("");
  const { isOpenDialog, setIsOpenDialog } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedMode, setSelectedMode] = useState<Mode>(MODE_SEARCH);

  const searchGiphy = async (keyword: string, offset: number) => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    const res = await fetch("/api/integrations/giphy/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword,
        offset,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMessage(json?.message || "Something went wrong");
    } else {
      setGifImage(json.image || "");
      setNextOffset(json.nextOffset);
      if (!json.image) {
        setErrorMessage("No Result found");
      }
    }
    setIsLoading(false);
    return null;
  };

  const getGiphyByUrl = async (url: string) => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    const res = await fetch("/api/integrations/giphy/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMessage(json?.message || json?.[0]?.message || "Something went wrong");
    } else {
      setGifImage(json.image || "");
      if (!json.image) {
        setErrorMessage("No Result found");
      }
    }
    setIsLoading(false);
    return null;
  };

  const renderTab = (Icon: any, text: string, mode: Mode) => (
    <div
      className={classNames(
        "flex cursor-pointer items-center border-b-2 p-2 text-sm",
        selectedMode === mode ? "border-black" : "border-transparent text-gray-500"
      )}
      onClick={() => {
        setKeyword("");
        setGifImage("");
        setSelectedMode(mode);
      }}>
      <Icon color={selectedMode === mode ? "black" : "grey"} className="mr-2 h-4 w-4" />
      {text}
    </div>
  );

  const handleFormSubmit = async (event: React.SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (selectedMode === MODE_SEARCH) {
      searchGiphy(keyword, 0);
    } else if (selectedMode === MODE_URL) {
      getGiphyByUrl(keyword);
    }
  };

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogContent>
        <h3 className="leading-16 font-cal text-xl text-gray-900" id="modal-title">
          {t("add_gif_to_confirmation")}
        </h3>
        <p className="mb-3 text-sm font-light text-neutral-500">{t("find_gif_spice_confirmation")}</p>
        <div className="flex items-center border-b border-solid">
          {renderTab(SearchIcon, t("search_giphy"), MODE_SEARCH)}
          {renderTab(LinkIcon, t("add_link_from_giphy"), MODE_URL)}
        </div>
        <form className="flex w-full justify-center space-x-2 space-y-2" onSubmit={handleFormSubmit}>
          <div className="relative block w-full pt-2">
            <input
              type="text"
              className="block w-full rounded-sm border-gray-300 shadow-sm sm:text-sm"
              placeholder={
                selectedMode === MODE_SEARCH
                  ? t("search_giphy")
                  : "https://media.giphy.com/media/some-id/giphy.gif"
              }
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
            />
          </div>
          <Button type="submit" tabIndex={-1} color="secondary" loading={isLoading}>
            {t("search")}
          </Button>
        </form>
        {gifImage && (
          <div className="flex flex-col items-center space-x-2 space-y-2 pt-3">
            <div className="flex w-full items-center justify-center bg-gray-100">
              {isLoading ? (
                <div className="flex h-[200px] w-full items-center justify-center bg-gray-400 pt-3 pb-3">
                  <svg
                    className={classNames("mx-4 h-5 w-5 animate-spin", "text-white dark:text-black")}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              ) : (
                <img className="h-[200px] pt-3 pb-3" src={gifImage} alt={`Gif from Giphy for ${keyword}`} />
              )}
            </div>
          </div>
        )}
        {errorMessage && <Alert severity="error" title={errorMessage} className="my-4" />}
        {gifImage && selectedMode === MODE_SEARCH && (
          <div className="mt-4 flex items-center justify-between space-x-2">
            <div className="text-sm font-light text-neutral-500">Not the perfect GIF?</div>
            <Button
              size="sm"
              color="secondary"
              type="button"
              loading={isLoading}
              onClick={() => searchGiphy(keyword, nextOffset)}>
              Shuffle
            </Button>
          </div>
        )}
        <DialogFooter>
          <DialogClose
            onClick={() => {
              props.setIsOpenDialog(false);
            }}
            asChild>
            <Button type="button" color="minimal" tabIndex={-1}>
              {t("cancel")}
            </Button>
          </DialogClose>

          <Button
            type="button"
            disabled={!gifImage}
            onClick={() => {
              props.setIsOpenDialog(false);
              props.onSave(gifImage);
              setNextOffset(0);
              setGifImage("");
              setKeyword("");
              return false;
            }}>
            {t("add_gif")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
