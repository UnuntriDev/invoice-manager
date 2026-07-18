export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryNode[];
  _count?: { documents: number; children: number };
}

export interface FlatCategory {
  id: string;
  label: string;
  depth: number;
}

export function flattenCategories(
  nodes: CategoryNode[],
  options: { prefix?: string; excludeId?: string } = {},
  depth = 0,
): FlatCategory[] {
  const { prefix = "  ", excludeId } = options;
  const result: FlatCategory[] = [];
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    result.push({ id: node.id, label: prefix.repeat(depth) + node.name, depth });
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, options, depth + 1));
    }
  }
  return result;
}
