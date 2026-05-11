import { SearchClient, SearchIndexClient } from "@azure/search-documents";
import { ChainedTokenCredential, AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";

const endpoint = process.env.AZURE_SEARCH_ENDPOINT ?? "";
const indexName = process.env.AZURE_SEARCH_INDEX_NAME ?? "knowledge-sources";

const credential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new ManagedIdentityCredential(),
);

function isConfigured(): boolean {
  return !!endpoint;
}

function getSearchClient(): SearchClient<{ content: string; projectId: string; metadata_storage_name: string }> {
  if (!endpoint) throw new Error("AZURE_SEARCH_ENDPOINT is not set");
  return new SearchClient(endpoint, indexName, credential);
}

function getIndexClient(): SearchIndexClient {
  if (!endpoint) throw new Error("AZURE_SEARCH_ENDPOINT is not set");
  return new SearchIndexClient(endpoint, credential);
}

export async function checkIndexStatus(blobName: string): Promise<{ indexed: boolean; chunkCount: number }> {
  if (!isConfigured()) return { indexed: false, chunkCount: 0 };
  try {
    const client = getSearchClient();
    const results = await client.search("*", {
      filter: `metadata_storage_name eq '${blobName}'`,
      top: 0,
      includeTotalCount: true,
    });
    const count = results.count ?? 0;
    return { indexed: count > 0, chunkCount: count };
  } catch {
    return { indexed: false, chunkCount: 0 };
  }
}

export async function searchKnowledge(
  projectId: string,
  query: string,
  topK = 10,
): Promise<string[]> {
  if (!isConfigured()) return [];
  try {
    const client = getSearchClient();
    const results = await client.search(query, {
      filter: `projectId eq '${projectId}'`,
      top: topK,
      queryType: "semantic",
      semanticSearchOptions: {
        configurationName: "default",
      },
    });
    const chunks: string[] = [];
    for await (const result of results.results) {
      if (result.document.content) {
        chunks.push(result.document.content);
      }
    }
    return chunks;
  } catch {
    return [];
  }
}
