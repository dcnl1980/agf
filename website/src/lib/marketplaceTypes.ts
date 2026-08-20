export type CatalogVersion = {
  version: string;
  digest: string;
  ruleFiles: string[];
  sourceUrl: string;
  publishedAt: string;
  note?: string;
};

export type CatalogEntry = {
  id: string;
  summary: string;
  maintainer: string;
  license: string;
  tags?: string[];
  jurisdiction?: string[];
  versions: CatalogVersion[];
};

export type CommunityCatalog = {
  $schema?: string;
  catalogVersion: string;
  generatedAt?: string;
  entries: CatalogEntry[];
};
