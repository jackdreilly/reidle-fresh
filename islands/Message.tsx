import { useEffect, useMemo, useState } from "preact/hooks";

function splitStringByURLs(
  text: string,
): { type: "text" | "url"; value: string }[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // Regular expression to match URLs

  const result: { type: "text" | "url"; value: string }[] = [];
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
    result.push({ type: "url", value: match[0] });

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
    : url;
}

export default function Message({ message }: { message: string }) {
  const parsed = useMemo(() => {
    return splitStringByURLs(message);
  }, [message]);
  return (
    <>
      {parsed.map(({ type, value }) =>
        type === "text" ? value : <MaybeImage url={value} />
      )}
    </>
  );
}
