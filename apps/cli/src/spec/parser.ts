import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toString } from 'mdast-util-to-string';
import type { Heading, List, RootContent } from 'mdast';
import { frontmatterSchema } from './schema';
import type { ParsedSpec } from './types';
import { SpecParseError, SpecValidationError } from '../agents/shared/errors';

export async function parseSpec(filePath: string): Promise<ParsedSpec> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return parseSpecContent(raw, filePath);
}

export function parseSpecContent(raw: string, filePath: string): ParsedSpec {
  const { data, content } = matter(raw);

  const result = frontmatterSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new SpecValidationError(`Invalid frontmatter: ${issues}`);
  }

  const tree = unified().use(remarkParse).parse(content);
  const sections = extractSections(tree.children);

  if (sections.setup === undefined) {
    throw new SpecParseError('Missing required # Setup section');
  }
  if (!sections.steps || sections.steps.length === 0) {
    throw new SpecParseError('Missing required # Steps section or no steps found');
  }

  return {
    ...result.data,
    setup: sections.setup,
    steps: sections.steps,
    filePath,
    rawContent: raw,
  };
}

interface Sections {
  setup?: string;
  steps?: string[];
}

function extractSections(nodes: RootContent[]): Sections {
  const sections: Sections = {};
  let currentHeading: string | null = null;
  let contentNodes: RootContent[] = [];

  function flush() {
    if (!currentHeading) return;
    const key = currentHeading.toLowerCase().trim();

    if (key === 'setup') {
      sections.setup = contentNodes
        .map((n) => toString(n))
        .join('\n\n')
        .trim();
    } else if (key === 'steps') {
      const list = contentNodes.find((n): n is List => n.type === 'list');
      if (list) {
        sections.steps = list.children.map((item) => toString(item).trim());
      }
    }
  }

  for (const node of nodes) {
    if (node.type === 'heading' && (node as Heading).depth === 1) {
      flush();
      currentHeading = toString(node);
      contentNodes = [];
    } else {
      contentNodes.push(node);
    }
  }
  flush();

  return sections;
}
