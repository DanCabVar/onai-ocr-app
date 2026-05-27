import { Injectable } from '@nestjs/common';
import { MarkdownNode } from './types';

export interface MarkdownIndex {
  nodes: MarkdownNode[];
  bySlug: Map<string, MarkdownNode>;
}

@Injectable()
export class MarkdownIndexService {
  buildIndex(nodes: MarkdownNode[]): MarkdownIndex {
    return {
      nodes,
      bySlug: new Map(nodes.map((n) => [n.slug, n])),
    };
  }

  retrieve(index: MarkdownIndex, question: string, limit = 4): MarkdownNode[] {
    const questionTokens = this.tokens(question);
    if (questionTokens.length === 0) return [];

    const scored = index.nodes
      .map((node) => ({ node, score: this.scoreNode(node, questionTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.node);

    const expanded = new Map(scored.map((n) => [n.slug, n]));
    for (const node of scored) {
      for (const linkedSlug of node.links) {
        const linked = index.bySlug.get(linkedSlug);
        if (linked) expanded.set(linked.slug, linked);
      }
    }

    return [...expanded.values()].slice(0, limit + 2);
  }

  private scoreNode(node: MarkdownNode, questionTokens: string[]): number {
    const text = node.text.toLowerCase();
    let score = 0;

    for (const token of questionTokens) {
      if (text.includes(token)) score += 2;
      if (node.tipo?.toLowerCase().includes(token)) score += 3;
      if (node.fecha?.toLowerCase().includes(token)) score += 1;
      if (node.documentId?.toLowerCase().includes(token)) score += 4;
    }

    return score;
  }

  private tokens(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9αινσϊρ]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
  }
}
