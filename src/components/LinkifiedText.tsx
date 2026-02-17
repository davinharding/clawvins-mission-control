import * as React from "react";

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

type Props = {
  text: string;
  className?: string;
};

/**
 * Renders text with http/https URLs converted to clickable <a> tags.
 * Links open in a new tab with rel="noopener noreferrer" for security.
 */
export function LinkifiedText({ text, className }: Props) {
  const parts = React.useMemo(() => {
    const segments: Array<{ type: "text" | "url"; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    URL_REGEX.lastIndex = 0;
    while ((match = URL_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: "url", value: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments;
  }, [text]);

  if (parts.length === 1 && parts[0].type === "text") {
    // No URLs — skip wrapper span overhead
    return <>{text}</>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === "url" ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 break-all"
          >
            {part.value}
          </a>
        ) : (
          <React.Fragment key={index}>{part.value}</React.Fragment>
        )
      )}
    </span>
  );
}
