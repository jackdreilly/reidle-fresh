import { useEffect, useMemo, useState } from "preact/hooks";

type LinkType = "text" | "url" | "spotify" | "random" | "gif_search";

const GIPHY_API_KEY = "kC0kZcGTTNZITKMQPLaxGwHeGpwYMn4S";

function RandomGif() {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    fetch(
      `https://api.giphy.com/v1/gifs/random?api_key=${GIPHY_API_KEY}`,
    ).then((d) => d.json()).then((d) => setUrl(d.data?.embed_url));
  }, []);
  return url
    ? (
      <iframe
        src={url}
        style={{
          border: "none",
          borderRadius: "8px",
          maxWidth: "100%",
          width: "360px",
          height: "270px",
        }}
      />
    )
    : <span></span>;
}

function SearchGif({ query }: { query: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const trimmed = query.trim();
    const endpoint = trimmed
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(trimmed)}&limit=1`
      : `https://api.giphy.com/v1/gifs/random?api_key=${GIPHY_API_KEY}`;
    fetch(endpoint)
      .then((d) => d.json())
      .then((d) => {
        const embedUrl = trimmed
          ? d.data?.[0]?.embed_url
          : d.data?.embed_url;
        setUrl(embedUrl);
      })
      .catch((e) => console.error("Failed to fetch gif:", e));
  }, [query]);

  return url
    ? (
      <iframe
        src={url}
        style={{
          border: "none",
          borderRadius: "8px",
          maxWidth: "100%",
          width: "360px",
          height: "270px",
        }}
        allowFullScreen={false}
      />
    )
    : <span></span>;
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

function MaybeImage({ url }: { url: string }) {
  const [isImage, setIsImage] = useState(true);
  useEffect(() => {
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
