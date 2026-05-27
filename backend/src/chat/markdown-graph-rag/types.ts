export interface MarkdownNode {
  key: string;
  slug: string;
  documentId?: string;
  tenant?: string;
  tipo?: string;
  fecha?: string;
  summary?: string;
  frontmatter: Record<string, string>;
  links: string[];
  text: string;
}

export interface RetrievalSource {
  key: string;
  documentId?: string;
  tenant?: string;
  score: number;
}

export interface HybridRetrievalResult {
  answer: string;
  sources: RetrievalSource[];
}
