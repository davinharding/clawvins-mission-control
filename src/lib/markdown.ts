const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const linkify = (text: string) =>
  text.replace(/https?:\/\/[^\s<]+/g, (raw) => {
    let url = raw;
    let trailing = "";
    while (/[.,;:!?)]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    if (!url) return raw;
    return `<a class=\"underline text-sky-500 hover:text-sky-400\" href=\"${url}\" target=\"_blank\" rel=\"noreferrer\">${url}</a>${trailing}`;
  });

export const renderMarkdown = (text: string) => {
  const escaped = escapeHtml(text ?? "");

  const codeBlocks: string[] = [];
  const withoutBlocks = escaped.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const normalized = code.replace(/^\n/, "").replace(/\n$/, "");
    const html = `<pre class=\"bg-muted/40 font-mono text-xs sm:text-sm leading-relaxed rounded-md p-3 overflow-x-auto\"><code>${normalized}</code></pre>`;
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(html);
    return `\n${token}\n`;
  });

  const inlineCodes: string[] = [];
  const applyInline = (input: string) => {
    const withInline = input.replace(/`([^`]+?)`/g, (_match, code) => {
      const html = `<code class=\"bg-muted/40 font-mono text-xs px-1 py-0.5 rounded\">${code}</code>`;
      const token = `__INLINE_CODE_${inlineCodes.length}__`;
      inlineCodes.push(html);
      return token;
    });

    const withBold = withInline.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return linkify(withBold);
  };

  const lines = withoutBlocks.split(/\n/);
  const blocks: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p class=\"text-sm leading-relaxed\">${applyInline(paragraph.join("<br />"))}</p>`);
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const headerMatch = line.match(/^##\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      blocks.push(`<h2 class=\"text-sm font-semibold\">${applyInline(headerMatch[1].trim())}</h2>`);
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const match = lines[j].match(/^\s*[-*]\s+(.*)$/);
        if (!match) break;
        items.push(`<li>${applyInline(match[1].trim())}</li>`);
        j += 1;
      }
      blocks.push(`<ul class=\"pl-4 list-disc space-y-1\">${items.join("")}</ul>`);
      i = j - 1;
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const match = lines[j].match(/^\s*\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(`<li>${applyInline(match[1].trim())}</li>`);
        j += 1;
      }
      blocks.push(`<ol class=\"pl-4 list-decimal space-y-1\">${items.join("")}</ol>`);
      i = j - 1;
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();

  let output = blocks.join("");
  inlineCodes.forEach((html, index) => {
    output = output.replace(`__INLINE_CODE_${index}__`, html);
  });
  codeBlocks.forEach((html, index) => {
    output = output.replace(`__CODE_BLOCK_${index}__`, html);
  });

  return output;
};
