const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

class FileParserService {
  /**
   * Parse uploaded file based on its type
   * @param {string} filePath - Path to the uploaded file
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<{content: string, sourceType: string}>}
   */
  async parseFile(filePath, mimeType) {
    const ext = path.extname(filePath).toLowerCase();

    try {
      let content = '';
      let sourceType = 'txt';

      if (mimeType === 'application/pdf' || ext === '.pdf') {
        content = await this.parsePdf(filePath);
        sourceType = 'pdf';
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.docx'
      ) {
        content = await this.parseWord(filePath);
        sourceType = 'word';
      } else if (mimeType === 'application/msword' || ext === '.doc') {
        // For .doc files, try mammoth (may not work perfectly)
        content = await this.parseWord(filePath);
        sourceType = 'word';
      } else {
        // Default to plain text
        content = await this.parseText(filePath);
        sourceType = 'txt';
      }

      // Clean up the content
      content = this.cleanContent(content);

      return { content, sourceType };
    } catch (error) {
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Parse Word document (.docx)
   */
  async parseWord(filePath) {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  /**
   * Parse PDF document
   */
  async parsePdf(filePath) {
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }

  /**
   * Parse plain text file
   */
  async parseText(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  }

  /**
   * Clean and normalize content
   */
  cleanContent(content) {
    return content
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      // Remove excessive newlines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Trim
      .trim();
  }

  /**
   * Split content into chunks with overlap
   * @param {string} content - Content to split
   * @param {number} chunkSize - Maximum chunk size
   * @param {number} overlap - Overlap between chunks
   * @returns {string[]} Array of chunks
   */
  splitIntoChunks(content, chunkSize = 3000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < content.length) {
      let end = start + chunkSize;

      // Try to end at a sentence or paragraph boundary
      if (end < content.length) {
        // Look for paragraph break first
        const paragraphBreak = content.lastIndexOf('\n\n', end);
        if (paragraphBreak > start + chunkSize * 0.7) {
          end = paragraphBreak;
        } else {
          // Look for sentence end
          const sentenceEnd = content.substring(start, end).search(/[。！？.!?]\s*$/);
          if (sentenceEnd > chunkSize * 0.7) {
            end = start + sentenceEnd + 1;
          }
        }
      }

      chunks.push(content.substring(start, Math.min(end, content.length)).trim());

      // Move start position with overlap
      start = end - overlap;
      if (start < 0) start = 0;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }
}

module.exports = new FileParserService();
