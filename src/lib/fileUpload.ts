/**
 * @description TTS 文本分片序列化助手。
 * 后端 `POST /jobs` 为单请求协议：整本 `TTSChunk[]` 作为一个 `chunks` JSON 文件分片随请求提交。
 * 本助手把分片数组序列化并挂到 FormData，供 audiobook 提交时使用。
 */

/**
 * 把分片数组以 `chunks` JSON 文件分片形式追加到 FormData，匹配后端单请求 `/jobs` 协议。
 *
 * 必须以 Blob（文件分片）追加而非字符串字段：后端只在 `part.type === 'file' && fieldname === 'chunks'`
 * 分支收集；若作为 value 字段提交会被漏收，导致 400。
 * @param form 目标 FormData（已含元数据 + 可选 cover）
 * @param chunks 前端切分得到的分片数组
 */
export function appendChunks(form: FormData, chunks: TTSChunk[]): void {
  const blob = new Blob([JSON.stringify(chunks)], { type: "application/json" });
  form.append("chunks", blob, "chunks.json");
}
