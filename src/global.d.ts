declare module "*.vue" {
  import { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module "@traptitech/markdown-it-katex";

interface TTSChunk {
  /** 全局唯一分片序号，从 0 开始，在整本书的所有分片中严格递增 */
  index: number;
  /** 所属章节序号（从 0 开始），标识该分片归属于哪一个物理/虚拟章节 */
  chapterIndex: number;
  /** 所属章节标题（如 "第一章 初入江湖" 或虚拟章节 "第 1 部分"） */
  chapterTitle: string;
  /** 待合成的文本内容（已经过编码转换和安全清洗） */
  text: string;
  /** 当前分片的精确字数（基于 Unicode 码点，剔除空白符） */
  charCount: number;
}
/**
 * 章节的内部数据结构。
 */
interface Chapter {
  /** 章节标题（如 "第一章 初入江湖" 或 "第 1 部分"） */
  title: string;
  /** 章节在全文中的起始字符索引（基于 string 的 index 位置） */
  startIndex: number;
  /** 章节的完整文本内容 */
  content: string;
}
