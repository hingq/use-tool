/** 默认 TTS 分块大小（字数） */
const DEFAULT_CHUNK_SIZE = 2500;

/** TTS 分块大小的最小值 */
const MIN_CHUNK_SIZE = 1000;

/** TTS 分块大小的最大值 */
const MAX_CHUNK_SIZE = 5000;
/** 章节标题的最大允许长度（字符数） */
const MAX_CHAPTER_LINE_LENGTH = 40;
/** 最少有效章节数量阈值 */
const MIN_VALID_CHAPTER_COUNT = 3;

/** 有效章节的平均字数下界 */
const MIN_AVG_CHAPTER_CHARS = 1000;

/** 有效章节的平均字数上界 */
const MAX_AVG_CHAPTER_CHARS = 50000;
/** TTS 分块时标点回退的搜索窗口大小（字符数） */
const PUNCTUATION_FALLBACK_WINDOW = 200;

/**
 * 标点回退切分的优先级列表。
 * 从最优（段落分隔）到最差（逗号）排列，
 * 搜索时按优先级顺序在窗口内从后向前查找。
 */
const SPLIT_PUNCTUATION_PRIORITY: string[] = [
  "\n\n", // 空行（段落分隔）——最优切分点
  "\n", // 单换行
  "。", // 句号
  "！", // 叹号
  "？", // 问号
  "；", // 分号
  "，", // 逗号——最差切分点
];
/**
 * 将上传文件的原始字节解码为文本，自动识别编码。
 *
 * 中文 TXT（尤其是小说）常见 GBK/GB2312 编码，若一律按 UTF-8 解码会产生乱码。
 * 解码策略：
 * 1. 优先按 BOM 判定（UTF-8 / UTF-16 LE / UTF-16 BE）。
 * 2. 无 BOM 时先以严格模式（fatal）尝试 UTF-8，遇到非法字节序列即抛错。
 * 3. UTF-8 失败则回退到 GB18030（向下兼容 GBK / GB2312）。
 *
 * @param buffer - 上传文件的原始字节
 * @returns 解码后的文本
 */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // 步骤 1：BOM 检测
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  // 步骤 2：无 BOM，先尝试严格 UTF-8
  try {
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch {
    // 步骤 3：UTF-8 解码失败，回退 GB18030（兼容 GBK/GB2312）
    return new TextDecoder("gb18030").decode(bytes);
  }
}

/**
 * 过滤文本中的所有 HTML/XML 标签。
 *
 * 防止 SSML 注入攻击
 *
 * @param text - 待清洗的原始文本
 * @returns 移除所有 HTML/XML 标签后的纯文本
 *
 */
export function cleanHtmlTags(text: string): string {
  // 使用正则匹配所有 < 到 > 之间的内容（包括自闭合标签如 <br/>）
  return text.replace(/<[^>]*>/g, "");
}

/**
 * 规范化换行符，将 Windows 风格的 `\r\n` 统一替换为 Unix 风格的 `\n`。
 *
 * @param text - 待处理的文本
 * @returns 换行符统一为 `\n` 的文本
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}
/**
 * 行首行尾空白修剪与连续空行压缩。
 *
 * @param text - 待处理的文本
 * @returns 修剪并压缩空白后的文本
 */
export function trimAndCompressWhitespace(text: string): string {
  // 步骤 1：按行拆分，对每行进行首尾空白修剪
  // 匹配行首和行尾的空格（半角）、全角空格（\u3000）和制表符（\t）
  const trimmedLines = text
    .split("\n")
    .map((line) => line.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ""));

  // 步骤 2：重新拼合
  let result = trimmedLines.join("\n");

  // 步骤 3：将连续 3 个及以上的换行符压缩为 2 个（保留段落间的单空行分隔）
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}
export function sanitizeText(text: string): string {
  // 管线式调用：每一步的输出作为下一步的输入
  let cleaned = cleanHtmlTags(text);
  cleaned = normalizeLineEndings(cleaned);
  cleaned = trimAndCompressWhitespace(cleaned);
  return cleaned;
}
/**
 * 计算文本的精确字数（基于 Unicode 码点，剔除所有空白符）。
 *
 * JavaScript 的 `String.prototype.length` 基于 UTF-16 编码单元计数，
 * 遇到 Emoji 或其他辅助平面字符（代理对 Surrogate Pairs）时会被计为 2。
 * 本函数使用 `Array.from()` 将字符串按 Unicode 码点展开，
 * 然后过滤掉所有空白字符（空格、换行、制表符等），返回真实的字符计数。
 *
 * @param text - 待统计的文本
 * @returns 剔除空白后的 Unicode 码点数量
 *
 */
export function getCleanCharCount(text: string): number {
  // 步骤 1：使用 Array.from 将字符串按 Unicode 码点展开为数组
  // 这确保了代理对（如 Emoji）被正确识别为单个元素
  // 步骤 2：过滤掉所有匹配 \s 的空白字符（空格、\n、\t、\r 等）
  // 步骤 3：返回过滤后的数组长度即为精确字数
  return Array.from(text).filter((char) => !/\s/.test(char)).length;
}
/**
 * 章节匹配正则表达式（多行模式）。
 *
 * 匹配规则：
 * - 行首可有可选空白
 * - 关键词：序章|楔子|引子|尾声|后记|番外(篇)  或  第X章/回/卷/集/节/篇/部
 *   - X 支持中文数字（一二三…万）和阿拉伯数字
 * - 可选的章节标题（空白分隔，最多 40 字符）
 * - 行尾可有可选空白
 */
const CHAPTER_REGEX =
  /^\s*(序章|楔子|引子|尾声|后记|番外(?:篇)?|第?\s*[一二三四五六七八九十百千万零\d]+\s*(?:(?:章|回|卷|集|节|篇|部)|(?=[\s\u3000])))(?:[\s\u3000]+\S[^\n]{0,40})?\s*$/gm;

/**
 * 将中文数字字符串转换为阿拉伯数字整数。
 *
 * 支持以下格式：
 * - 纯阿拉伯数字：`"123"` → `123`
 * - 简单中文数字：`"三"` → `3`
 * - 复合中文数字：`"二十三"` → `23`、`"一百零五"` → `105`
 * - 带"十"开头的简写：`"十二"` → `12`（省略前缀"一"）
 * - 万级数字：`"一万两千三百"` → `12300`
 *
 * @param chineseStr - 包含中文或阿拉伯数字的章节标记字符串（如 `"第二十三章"`）
 * @returns 转换后的阿拉伯整数（如 `23`）
 *
 * @example
 * ```typescript
 * chineseToNumber('第一百零五章');  // => 105
 * chineseToNumber('第十二回');       // => 12
 * chineseToNumber('第123章');       // => 123
 * ```
 */
export function chineseToNumber(chineseStr: string): number {
  // 数字字符映射表：中文数字和阿拉伯数字均映射到对应的整数值
  const numberMap: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
  };

  // 单位字符映射表：十、百、千、万对应的乘法因子
  const unitMap: Record<string, number> = {
    十: 10,
    百: 100,
    千: 1000,
    万: 10000,
  };

  // 清洗非数字字符，移除章节标记关键字和空白
  const cleanStr = chineseStr.replace(/[第章节回卷集篇部\s]/g, "");

  // 步骤 2：优先处理纯阿拉伯数字的情况（如 "123"），直接 parseInt 返回
  if (/^\d+$/.test(cleanStr)) {
    return parseInt(cleanStr, 10);
  }

  // 逐字符解析中文数字
  let total = 0; // 万级以上的累计总和
  let section = 0; // 当前万级以内的部分累计
  let number = 0; // 临时存储当前待处理的数字值

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];

    if (numberMap[char] !== undefined) {
      // 当前字符是数字：暂存到 number，等待后续的单位字符来决定乘法
      number = numberMap[char];

      // 特殊情况：如果是最后一个字符且没有后续单位，直接累加到 section
      // 例如 "二十三" 中的 "三" 是末尾数字，直接加到 section
      if (i === cleanStr.length - 1) {
        section += number;
      }
    } else if (unitMap[char] !== undefined) {
      const unit = unitMap[char];

      if (unit === 10000) {
        // "万"级单位：将当前 section + number 乘以 10000 累加到 total
        section += number;
        if (section === 0) section = 1; // 兼容 "万" 字开头（表示一万）
        total += section * 10000;
        section = 0;
        number = 0;
      } else if (unit === 10) {
        // "十"级单位：特殊处理省略前缀"一"的情况
        // 例如 "十二" 等价于 "一十二"，此时 number 为 0 且 section 也为 0
        if (number === 0 && section === 0) {
          number = 1; // 隐含的"一"
        }
        section += number * unit;
        number = 0;
      } else {
        // "百"或"千"级单位：number × unit 累加到 section
        section += number * unit;
        number = 0;
      }
    }
    // 忽略不在映射表中的字符（如意外混入的标点）
  }

  // 返回万级累计 + 万以内累计的最终结果
  return total + section;
}

/**
 * 检测文本中的物理章节，使用正则初筛 + 四重后置校验。
 *
 * 算法流程：
 * 1. 正则初筛：使用 `CHAPTER_REGEX` 全局匹配所有候选章节行
 * 2. 行长度校验：候选行整行长度 ≤ 40 字符
 * 3. 物理空行校验：候选行前后必须有空行（或位于文本首尾）
 * 4. 序号单调递增校验：提取数字部分，确保严格递增
 * 5. 总数合理性校验：平均章节字数在 [1000, 50000] 范围内，且章节数 ≥ 3
 *
 * 若校验失败，调用 `splitVirtualChapters` 进行虚拟章节兜底切分。
 *
 * @param text - 已清洗的完整文本
 * @returns 检测到的章节数组（物理章节或虚拟章节）
 */
export function detectChapters(text: string): Chapter[] {
  // 步骤 1：正则初筛 —— 收集所有匹配的候选章节行及其位置
  const candidates: Array<{
    title: string;
    index: number;
    matchedKeyword: string;
  }> = [];

  // 重置正则的 lastIndex（因为使用了 g 标志）
  CHAPTER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHAPTER_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const leadingWhitespaceLength =
      fullMatch.length - fullMatch.trimStart().length;
    candidates.push({
      title: fullMatch.trim(), // 完整匹配行（去除首尾空白）
      index: match.index + leadingWhitespaceLength, // 匹配在全文中的真实字符偏移（排除前面的空白）
      matchedKeyword: match[1], // 捕获组：章节关键词部分（如 "第一章"、"序章"）
    });
  }

  // 步骤 2：行长度校验 —— 移除整行长度超过 40 字符的候选
  const lengthFiltered = candidates.filter(
    (c) => c.title.length <= MAX_CHAPTER_LINE_LENGTH,
  );

  // 步骤 3：物理空行校验 —— 章节行必须是独立段落
  // 条件：前面是文本起点或空行，后面是文本终点或空行
  const isolationFiltered = lengthFiltered.filter((c) => {
    // 检查前方：是否为文本开头，或者前面有空行（\n\n）
    const beforeText = text.substring(0, c.index);
    const isAtStart = c.index === 0;
    const hasPrecedingBlankLine =
      beforeText.endsWith("\n\n") || beforeText.trimEnd().length === 0;

    // 检查后方：是否为文本结尾，或者后面有空行（\n\n）
    const afterStart = c.index + c.title.length;
    const afterText = text.substring(afterStart);
    const isAtEnd = afterStart >= text.length;
    const hasFollowingBlankLine =
      afterText.startsWith("\n\n") || afterText.trimStart().length === 0;

    return (
      (isAtStart || hasPrecedingBlankLine) && (isAtEnd || hasFollowingBlankLine)
    );
  });

  // 步骤 4：序号单调递增校验
  // 提取每个候选章节的数字部分并转为阿拉伯整数
  // 对于特殊关键词（序章、楔子等），不参与递增校验，直接通过
  const numberedChapters: Array<{
    title: string;
    index: number;
    chapterNum: number;
    isSpecial: boolean;
  }> = [];

  const specialKeywords = new Set([
    "序章",
    "楔子",
    "引子",
    "尾声",
    "后记",
    "番外",
    "番外篇",
  ]);

  for (const c of isolationFiltered) {
    if (specialKeywords.has(c.matchedKeyword)) {
      // 特殊关键词不需要数字校验，直接保留
      numberedChapters.push({
        title: c.title,
        index: c.index,
        chapterNum: -1, // 标记为特殊章节
        isSpecial: true,
      });
    } else {
      // 普通章节（如"第X章"）：提取并转换数字部分
      const num = chineseToNumber(c.matchedKeyword);
      numberedChapters.push({
        title: c.title,
        index: c.index,
        chapterNum: num,
        isSpecial: false,
      });
    }
  }

  // 对非特殊章节进行严格单调递增校验
  // 使用贪心策略：维护最后一个有效数字，只保留严格递增的章节
  const monotonicFiltered: typeof numberedChapters = [];
  let lastNum = -Infinity;

  for (const c of numberedChapters) {
    if (c.isSpecial) {
      // 特殊章节直接通过，不影响递增序列
      monotonicFiltered.push(c);
    } else if (c.chapterNum > lastNum) {
      // 数字严格大于上一个有效数字，通过校验
      monotonicFiltered.push(c);
      lastNum = c.chapterNum;
    }
    // 否则跳过（非递增的章节被剔除）
  }
  // 步骤 5：总数合理性校验
  const totalCharCount = getCleanCharCount(text);

  if (monotonicFiltered.length < MIN_VALID_CHAPTER_COUNT) {
    // 有效章节数不足 3，触发虚拟章节兜底
    throw new Error("章节数目过少");
  }

  const avgCharsPerChapter = totalCharCount / monotonicFiltered.length;
  if (
    avgCharsPerChapter < MIN_AVG_CHAPTER_CHARS ||
    avgCharsPerChapter > MAX_AVG_CHAPTER_CHARS
  ) {
    // 平均章节字数不在合理范围内，触发虚拟章节兜底
    throw new Error("章节字数过少");
  }

  // 步骤 6：构建 Chapter 数组
  // 每个章节的内容 = 从当前章节标题开始到下一章节标题（或文本末尾）
  const chapters: Chapter[] = [];
  for (let i = 0; i < monotonicFiltered.length; i++) {
    const current = monotonicFiltered[i];
    const nextIndex =
      i + 1 < monotonicFiltered.length
        ? monotonicFiltered[i + 1].index
        : text.length;

    // 章节内容从标题行后开始（跳过标题行本身后的换行符）
    const titleEnd = current.index + current.title.length;
    const content = text.substring(titleEnd, nextIndex).trim();

    chapters.push({
      title: current.title,
      startIndex: current.index,
      content,
    });
  }

  return chapters;
}

/**
 * 将单个章节切分为多个 TTS 请求分块。
 *
 * 在章节内部按 `chunkSize` 窗口进行切分，使用标点回退算法确保
 * 分块在自然断句处切割，以保证 TTS 合成的语音自然度。
 *
 * 标点回退算法：
 * 1. 从当前位置截取 chunkSize 个字符作为窗口
 * 2. 若窗口未到章节末尾，在窗口最后 200 字内从后向前查找最优标点
 * 3. 标点优先级：\n\n > \n > 。 > ！ > ？ > ； > ，
 * 4. 找到则在标点处断开；未找到则硬截断
 *
 * @param chapter - 待切分的章节
 * @param chapterIndex - 章节在全书中的序号（从 0 开始）
 * @param globalIndex - 全局分片起始序号（累计前序章节的分块数）
 * @param chunkSize - 每个分块的目标字数（默认 2500）
 * @returns 该章节生成的 TTSChunk 数组
 */
export function splitChapterIntoChunks(
  chapter: Chapter,
  chapterIndex: number,
  globalIndex: number,
  chunkSize: number,
): TTSChunk[] {
  const chunks: TTSChunk[] = [];
  const content = chapter.content;

  // 边界情况：空章节直接返回空数组
  if (!content || content.trim().length === 0) {
    return chunks;
  }

  let currentPos = 0; // 当前在章节内容中的字符位置
  let chunkIndex = globalIndex; // 全局分片序号

  while (currentPos < content.length) {
    // 步骤 1：截取 chunkSize 个字符作为窗口
    // 注意：这里使用的是码点级别的切分，通过 Array.from 确保不切断代理对
    const remaining = content.substring(currentPos);
    const remainingCodePoints = Array.from(remaining);

    if (remainingCodePoints.length <= chunkSize) {
      // 剩余内容不超过 chunkSize，整体作为最后一个分块
      const chunkText = remaining.trim();
      if (chunkText.length > 0) {
        chunks.push({
          index: chunkIndex,
          chapterIndex,
          chapterTitle: chapter.title,
          text: chunkText,
          charCount: getCleanCharCount(chunkText),
        });
        chunkIndex++;
      }
      break;
    }

    // 步骤 2：获取 chunkSize 个码点对应的字符串
    const windowText = remainingCodePoints.slice(0, chunkSize).join("");

    // 步骤 3：在窗口最后 PUNCTUATION_FALLBACK_WINDOW 字内从后向前查找最优标点
    let splitPos = windowText.length; // 默认：硬截断位置

    // 计算回退搜索窗口的起始位置
    const fallbackStart = Math.max(
      0,
      windowText.length - PUNCTUATION_FALLBACK_WINDOW,
    );
    const fallbackWindow = windowText.substring(fallbackStart);

    // 按优先级从高到低搜索标点
    let foundPunctuation = false;
    for (const punct of SPLIT_PUNCTUATION_PRIORITY) {
      // 从后向前查找该标点在回退窗口中的最后一次出现
      const lastIdx = fallbackWindow.lastIndexOf(punct);
      if (lastIdx !== -1) {
        // 找到标点：计算在 windowText 中的绝对位置
        // 切分点在标点之后（包含标点在当前分块中）
        splitPos = fallbackStart + lastIdx + punct.length;
        foundPunctuation = true;
        break; // 使用最高优先级的标点
      }
    }

    // 步骤 4：根据切分位置生成分块
    const chunkText = windowText.substring(0, splitPos).trim();
    if (chunkText.length > 0) {
      chunks.push({
        index: chunkIndex,
        chapterIndex,
        chapterTitle: chapter.title,
        text: chunkText,
        charCount: getCleanCharCount(chunkText),
      });
      chunkIndex++;
    }

    // 步骤 5：更新 currentPos，跳过已处理的字符
    // splitPos 是基于 windowText（码点 join 后的字符串）的位置
    currentPos += splitPos;
  }

  return chunks;
}
/**
 * 文本预处理完整管线入口。
 *
 * @param text - 已解码的完整文本内容
 * @param chunkSize - TTS 分块大小（默认 2500 字，范围 1000~5000）
 * @returns 完整的 TTS 分块数组，可直接送入合成引擎
 */
export function processText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): TTSChunk[] {
  // 校验并规范化 chunkSize 参数
  const normalizedChunkSize = Math.max(
    MIN_CHUNK_SIZE,
    Math.min(MAX_CHUNK_SIZE, chunkSize),
  );

  //文本清洗 —— 过滤 HTML 标签、规范化换行符、压缩空白
  const cleanedText = sanitizeText(text);

  // 章节检测 —— 正则初筛 + 四重后置校验（失败则抛错）
  const chapters = detectChapters(cleanedText);

  //TTS 分块 —— 在每章内按 chunkSize 进行标点回退切分
  const allChunks: TTSChunk[] = [];
  let globalIndex = 0; // 全局分片序号计数器

  for (let i = 0; i < chapters.length; i++) {
    const chapterChunks = splitChapterIntoChunks(
      chapters[i],
      i,
      globalIndex,
      normalizedChunkSize,
    );
    allChunks.push(...chapterChunks);
    globalIndex += chapterChunks.length;
  }

  return allChunks;
}
