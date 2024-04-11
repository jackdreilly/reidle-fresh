import { useEffect, useMemo, useState } from "preact/hooks";

type LinkType = "text" | "url" | "spotify" | "random";

function RandomGif() {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    fetch(
      "https://api.giphy.com/v1/gifs/random?api_key=kC0kZcGTTNZITKMQPLaxGwHeGpwYMn4S",
    ).then((d) => d.json()).then((d) => setUrl(d.data.embed_url));
  }, []);
  return url ? <iframe src={url} /> : <span></span>;
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
    let timer: number | undefined = undefined;
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
    : <>url</>;
}

export default function Message({ message }: { message: string }) {
  const parsed = useMemo(() => {
    const messages = splitStringByURLs(message);
    if (
      (messages.length === 1) && messages[0].type === "text" &&
      messages[0].value.toLowerCase().includes("a gif")
    ) {
      messages.push({ type: "random", value: "" });
    }
    return messages;
  }, [message]);
  return (
    <>
      {parsed.map(({ type, value }) =>
        type === "random"
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
