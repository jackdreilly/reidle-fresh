import { useEffect, useMemo, useState } from "preact/hooks";

type LinkType = "text" | "url" | "spotify" | "random" | "gif_search";

const GIPHY_API_KEY = "kC0kZcGTTNZITKMQPLaxGwHeGpwYMn4S";

function RandomGif() {
  return <SearchGif query="" />;
}

const gifCacheKey = (q: string) => `reidle:gif:${q.toLowerCase()}`;
const cachedGif = (q: string): string | undefined => {
  try { return localStorage.getItem(gifCacheKey(q)) ?? undefined; } catch { return undefined; }
};

function GifFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      style={{ border: "none", borderRadius: "8px", maxWidth: "100%", width: "360px", height: "270px" }}
      allowFullScreen={false}
    />
  );
}

function SearchGif({ query }: { query: string }) {
  const trimmed = query.trim();
  const [url, setUrl] = useState<string | undefined>(() => (trimmed ? cachedGif(trimmed) : undefined));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (url) return; // cached: no API call (the shared Giphy key is rate-limited)
    const endpoint = trimmed
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(trimmed)}&limit=1`
      : `https://api.giphy.com/v1/gifs/random?api_key=${GIPHY_API_KEY}`;
    fetch(endpoint)
      .then((d) => d.json())
      .then((d) => {
        const embedUrl: string | undefined = trimmed ? d.data?.[0]?.embed_url : d.data?.embed_url;
        if (!embedUrl) return setFailed(true);
        if (trimmed) try { localStorage.setItem(gifCacheKey(trimmed), embedUrl); } catch { /* ignore */ }
        setUrl(embedUrl);
      })
      .catch(() => setFailed(true));
  }, [query]);
  if (url) return <GifFrame src={url} />;
  // never render an empty message: say what was meant when Giphy is unavailable
  return failed ? <span class="italic text-gray-400">🖼 /gif {trimmed}</span> : <span></span>;
}

function SpotifyLink({ src }: { src: string }) {
  return (
    <iframe
      style={{ width: "100%", maxWidth: "400px", borderRadius: "8px" }}
      src={src.includes("com/embed")
        ? src
        : src.replace("spotify.com", "spotify.com/embed")}
      height="152"
      frameBorder="0"
      allowFullScreen={false}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    >
    </iframe>
  );
}

function splitStringByURLs(
  text: string,
): { type: LinkType; value: string }[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // Regular expression to match URLs

  const result: { type: LinkType; value: string }[] = [];
  let lastMatchEnd = 0;

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    // Add the text part before the URL (if any)
    if (match.index > lastMatchEnd) {
      result.push({
        type: "text",
        value: text.substring(lastMatchEnd, match.index),
      });
    }

    // Add the URL part
    result.push({
      type: match[0].includes("open.spotify.com") ? "spotify" : "url",
      value: match[0],
    });

    lastMatchEnd = match.index + match[0].length;
  }

  // Add the remaining text part after the last URL (if any)
  if (lastMatchEnd < text.length) {
    result.push({ type: "text", value: text.substring(lastMatchEnd) });
  }

  return result;
}

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)([?#].*)?$/i;
const IMAGE_HOSTS = /^https?:\/\/(media\d*\.giphy\.com|i\.giphy\.com|i\.imgur\.com|media\.tenor\.com)\//i;
const looksLikeImage = (url: string) => IMAGE_URL.test(url) || IMAGE_HOSTS.test(url);

function MaybeImage({ url }: { url: string }) {
  // Only URLs that look like images are fetched as images: otherwise every viewer's browser would
  // contact whatever host a message links to (leaks IPs, loads arbitrary content).
  const [isImage, setIsImage] = useState(looksLikeImage(url));
  useEffect(() => {
    if (!looksLikeImage(url)) return;
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;
    const img = new Image();
    img.onerror = img.onabort = function () {
      clearTimeout(timer);
      setIsImage(false);
    };
    img.onload = function () {
      clearTimeout(timer);
    };
    timer = setTimeout(function () {
      // reset .src to invalid URL so it stops previous
      // loading, but doens't trigger new load
      img.src = "//!!!!/noexist.jpg";
      setIsImage(false);
    }, 3000);
    img.src = url;
  }, [url]);
  return isImage
    ? (
      <img
        src={url}
        style={{
          width: "auto",
          maxHeight: "50vh",
          margin: "10px",
          borderRadius: "5px",
        }}
      />
    )
    : (
      <a
        class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
        href={url}
      >
        {url}
      </a>
    );
}

export default function Message({ message }: { message: string }) {
  const parsed = useMemo(() => {
    const trimmed = message.trim();
    if (trimmed.toLowerCase().startsWith("/gif")) {
      const query = trimmed.slice(4).trim();
      return [{ type: "gif_search" as LinkType, value: query }];
    }
    const messages = splitStringByURLs(message);
    if (
      (messages.length === 1) && messages[0].type === "text" &&
      messages[0].value.toLowerCase().startsWith("a gif") &&
      messages[0].value.length < 40
    ) {
      messages.push({ type: "random", value: "" });
    }
    return messages;
  }, [message]);

  return (
    <>
      {parsed.map(({ type, value }) =>
        type === "gif_search"
          ? <SearchGif query={value} />
          : type === "random"
          ? <RandomGif />
          : type === "spotify"
          ? <SpotifyLink src={value} />
          : type === "text"
          ? value
          : <MaybeImage url={value} />
      )}
    </>
  );
}
