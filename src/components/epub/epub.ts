import JSZip from "jszip";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
      default: return c;
    }
  });
}

function logMethod(originalMethod: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);

  // 返回的新函数会直接替换掉原方法
  return function (this: any, ...args: any[]) {
    console.log(`======== [LOG] 调用方法: ${methodName} ========`);
    console.log(`参数:`, args);

    const result = originalMethod.apply(this, args);
    return result;
  };
}
export class StreamTextSplitter {
  private reader: ReadableStreamDefaultReader<string>;
  private buffer: string = "";
  private chapters: Array<{ title: string; content: string }> = [];
  private currentChapterTitle: string = "前言/引言";
  private currentChapterText: string = "";

  // 匹配章节的正则表达式（可根据需求自定义）
  private chapterRegex: RegExp =
    /^\s*(第[\u4e00-\u9fa5\d]+[章节回卷集])[^\n]*/gm;

  constructor(file: File) {
    // 1. 获取防碎字的文本流
    const textStream = file
      .stream()
      .pipeThrough(new TextDecoderStream("utf-8"));
    this.reader = textStream.getReader();
  }

  /**
   * 开始流式扫描并切割
   */
  @logMethod
  public async parse(): Promise<Array<{ title: string; content: string }>> {
    while (true) {
      const { done, value } = await this.reader.read();

      if (done) {
        // 流结束了，把缓冲区里剩下的最后一章吐出来
        this.flushRemaining();
        break;
      }

      // 2. 将新来的文本块追加到缓冲区
      this.buffer += value;

      // 3. 处理当前缓冲区内部的关键词
      this.processBuffer();
    }

    return this.chapters;
  }

  /**
   * 扫描缓冲区中的关键词并切割
   */
  private processBuffer() {
    let match;
    let lastIndex = 0;

    // 重置正则重试位置（因为每次 buffer 在变长）
    this.chapterRegex.lastIndex = 0;

    // 4. 循环寻找 buffer 里的所有章节标题
    while ((match = this.chapterRegex.exec(this.buffer)) !== null) {
      const matchedTitle = match[0].trim();
      const matchIndex = match.index;

      // 5. 找到了新章节！把上一个章节累积的文本切分出来
      // 文本范围：从当前 buffer 的开头（或者是上一个匹配点）到当前新标题之前
      this.currentChapterText += this.buffer.slice(lastIndex, matchIndex);

      // 如果上一章有内容，保存它
      if (this.currentChapterText.trim().length > 0) {
        this.saveChapter(this.currentChapterTitle, this.currentChapterText);
      }

      // 6. 更新状态：将当前找到的标题设为“新一章的标题”
      this.currentChapterTitle = matchedTitle;
      this.currentChapterText = ""; // 清空，准备接收新章正文

      // 更新指针
      lastIndex = matchIndex + match[0].length;
    }

    // 7. 【关键安全机制】：
    // 已经匹配过的文本直接扔掉；未匹配的文本留在 buffer 里，等待跟下一个 Chunk 拼接
    // 这样即便关键词刚好被卡在 Chunk 缝隙里，下一次拼接后也能被正则扫出来
    this.buffer = this.buffer.slice(lastIndex);
  }

  /**
   * 流结束时清空残留
   */
  private flushRemaining() {
    this.currentChapterText += this.buffer;
    if (this.currentChapterText.trim().length > 0) {
      this.saveChapter(this.currentChapterTitle, this.currentChapterText);
    }
  }

  /**
   * 将文本转换为标准的 HTML 段落并存储
   */
  private saveChapter(title: string, rawText: string) {
    const pTagsContent = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `<p>${escapeXml(line)}</p>`)
      .join("\n");

    this.chapters.push({
      title: title,
      content: pTagsContent,
    });
  }
}

export interface EpubOptions {
  title: string;
  author: string;
  language?: string;
  chapters: Array<{ title: string; content: string }>;
}

export class EpubBuilder {
  private options: EpubOptions;

  constructor(options: EpubOptions) {
    this.options = {
      language: "zh-CN",
      ...options,
    };
  }

  public async build(): Promise<Blob> {
    const zip = new JSZip();

    // 1. mimetype (must be first, not compressed)
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

    // 2. META-INF/container.xml
    zip.file("META-INF/container.xml", this.generateContainerXml());

    // 3. OEBPS folder structure
    const oebps = zip.folder("OEBPS");
    if (!oebps) {
      throw new Error("Failed to create OEBPS folder in zip");
    }

    // Stylesheet
    oebps.file("style.css", this.generateStyleCss());

    // Cover
    oebps.file("cover.xhtml", this.generateCoverXhtml());

    // Table of Contents (EPUB 3 nav document)
    oebps.file("toc.xhtml", this.generateTocXhtml());

    // Chapters
    this.options.chapters.forEach((chapter, index) => {
      oebps.file(
        `chapter_${index}.xhtml`,
        this.generateChapterXhtml(index, chapter.title, chapter.content)
      );
    });

    // Content OPF
    oebps.file("content.opf", this.generateContentOpf());

    // Generate zip blob
    return await zip.generateAsync({
      type: "blob",
      mimeType: "application/epub+zip",
    });
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private generateContainerXml(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  private generateStyleCss(): string {
    return `body {
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans CN", sans-serif;
  line-height: 1.8;
  color: #333333;
  margin: 0;
  padding: 8px 16px;
}

h1, h2, h3, h4, h5, h6 {
  color: #111111;
  font-weight: bold;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
  text-align: center;
}

p {
  text-indent: 2em;
  margin-top: 0.6em;
  margin-bottom: 0.6em;
  text-align: justify;
}`;
  }

  private generateCoverXhtml(): string {
    const title = this.options.title;
    const author = this.options.author;
    const language = this.options.language || "zh-CN";

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${language}" xml:lang="${language}">
  <head>
    <title>封面</title>
    <meta charset="utf-8" />
    <style>
      body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: #fcfcfc;
      }
      .cover-container {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 15% 10%;
        text-align: center;
        font-family: "PingFang SC", "Source Han Sans CN", sans-serif;
      }
      .title-box {
        margin-top: 25%;
        width: 100%;
      }
      .title {
        font-size: 2.2em;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 24px;
        line-height: 1.4;
      }
      .divider {
        width: 80px;
        height: 3px;
        background-color: #3498db;
        margin: 0 auto;
      }
      .author {
        font-size: 1.2em;
        color: #7f8c8d;
        margin-bottom: 20%;
      }
    </style>
  </head>
  <body>
    <div class="cover-container">
      <div class="title-box">
        <h1 class="title">${escapeXml(title)}</h1>
        <div class="divider"></div>
      </div>
      <div class="author">作者：${escapeXml(author)}</div>
    </div>
  </body>
</html>`;
  }

  private generateTocXhtml(): string {
    const title = this.options.title;
    const language = this.options.language || "zh-CN";
    const tocLiItems = this.options.chapters
      .map((ch, index) => {
        return `<li><a href="chapter_${index}.xhtml">${escapeXml(ch.title)}</a></li>`;
      })
      .join("\n        ");

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}">
  <head>
    <title>目录</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
    <style>
      nav#toc ol {
        list-style-type: none;
        padding-left: 0;
      }
      nav#toc li {
        margin: 12px 0;
      }
      nav#toc a {
        text-decoration: none;
        color: #2980b9;
      }
    </style>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>${escapeXml(title)} - 目录</h1>
      <ol>
        <li><a href="cover.xhtml">封面</a></li>
        ${tocLiItems}
      </ol>
    </nav>
  </body>
</html>`;
  }

  private generateChapterXhtml(index: number, title: string, content: string): string {
    const language = this.options.language || "zh-CN";
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${language}" xml:lang="${language}">
  <head>
    <title>${escapeXml(title)}</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body>
    <h1>${escapeXml(title)}</h1>
    ${content}
  </body>
</html>`;
  }

  private generateContentOpf(): string {
    const title = this.options.title;
    const author = this.options.author;
    const language = this.options.language || "zh-CN";
    const uuid = this.generateUUID();
    const modifiedTime = new Date().toISOString().split(".")[0] + "Z";

    const manifestItems = this.options.chapters
      .map((ch, index) => {
        return `<item id="chapter_${index}" href="chapter_${index}.xhtml" media-type="application/xhtml+xml" />`;
      })
      .join("\n    ");

    const spineItems = this.options.chapters
      .map((ch, index) => {
        return `<itemref idref="chapter_${index}" />`;
      })
      .join("\n    ");

    return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${language}</dc:language>
    <dc:creator id="creator">${escapeXml(author)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <meta property="dcterms:modified">${modifiedTime}</meta>
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="style.css" media-type="text/css" />
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />
    ${manifestItems}
  </manifest>
  <spine>
    <itemref idref="cover" />
    <itemref idref="toc" />
    ${spineItems}
  </spine>
</package>`;
  }
}
