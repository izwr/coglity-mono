# Azure AI Search Setup for Knowledge Management

This guide covers configuring Azure AI Search to automatically index knowledge sources uploaded to Azure Blob Storage.

## Prerequisites

- Azure subscription with an existing resource group
- Azure Storage Account with the `knowledge-sources` container (already used by the app)
- Azure OpenAI resource with an embedding model deployed (e.g., `text-embedding-3-large`)

## 1. Create Azure AI Search Resource

```bash
az search service create \
  --name <search-service-name> \
  --resource-group <resource-group> \
  --sku basic \
  --partition-count 1 \
  --replica-count 1
```

Minimum **Basic** tier is required for semantic ranking.

## 2. Create the Search Index

```bash
az rest --method PUT \
  --uri "https://<search-service-name>.search.windows.net/indexes/knowledge-sources?api-version=2024-07-01" \
  --headers "Content-Type=application/json" \
  --body '{
    "name": "knowledge-sources",
    "fields": [
      { "name": "chunk_id", "type": "Edm.String", "key": true, "filterable": true },
      { "name": "parent_id", "type": "Edm.String", "filterable": true },
      { "name": "content", "type": "Edm.String", "searchable": true, "retrievable": true },
      { "name": "content_vector", "type": "Collection(Edm.Single)", "searchable": true, "dimensions": 3072, "vectorSearchProfile": "default-profile" },
      { "name": "title", "type": "Edm.String", "searchable": true, "retrievable": true },
      { "name": "metadata_storage_name", "type": "Edm.String", "filterable": true, "retrievable": true },
      { "name": "metadata_storage_path", "type": "Edm.String", "filterable": true },
      { "name": "projectId", "type": "Edm.String", "filterable": true, "retrievable": true }
    ],
    "vectorSearch": {
      "algorithms": [
        { "name": "default-algorithm", "kind": "hnsw", "hnswParameters": { "metric": "cosine", "m": 4, "efConstruction": 400 } }
      ],
      "profiles": [
        { "name": "default-profile", "algorithmConfigurationName": "default-algorithm", "vectorizerName": "default-vectorizer" }
      ],
      "vectorizers": [
        {
          "name": "default-vectorizer",
          "kind": "azureOpenAI",
          "azureOpenAIParameters": {
            "resourceUri": "https://<openai-resource>.openai.azure.com",
            "deploymentId": "text-embedding-3-large",
            "modelName": "text-embedding-3-large"
          }
        }
      ]
    },
    "semantic": {
      "configurations": [
        {
          "name": "default",
          "prioritizedFields": {
            "contentFields": [{ "fieldName": "content" }],
            "titleField": { "fieldName": "title" }
          }
        }
      ]
    }
  }'
```

## 3. Create the Data Source

Point to the blob storage container where knowledge source files are uploaded.

```bash
az rest --method PUT \
  --uri "https://<search-service-name>.search.windows.net/datasources/knowledge-sources-blob?api-version=2024-07-01" \
  --headers "Content-Type=application/json" \
  --body '{
    "name": "knowledge-sources-blob",
    "type": "azureblob",
    "credentials": {
      "connectionString": "ResourceId=/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<storage-account>;"
    },
    "container": {
      "name": "knowledge-sources"
    }
  }'
```

For managed identity auth, use the `ResourceId` connection string format (no keys).

## 4. Create the Skillset

The skillset handles document cracking, text chunking, and embedding generation.

```bash
az rest --method PUT \
  --uri "https://<search-service-name>.search.windows.net/skillsets/knowledge-sources-skillset?api-version=2024-07-01" \
  --headers "Content-Type=application/json" \
  --body '{
    "name": "knowledge-sources-skillset",
    "skills": [
      {
        "@odata.type": "#Microsoft.Skills.Text.SplitSkill",
        "name": "text-split",
        "description": "Split documents into chunks",
        "textSplitMode": "pages",
        "maximumPageLength": 2000,
        "pageOverlapLength": 500,
        "context": "/document",
        "inputs": [{ "name": "text", "source": "/document/content" }],
        "outputs": [{ "name": "textItems", "targetName": "chunks" }]
      },
      {
        "@odata.type": "#Microsoft.Skills.Text.AzureOpenAIEmbeddingSkill",
        "name": "embedding",
        "description": "Generate embeddings for chunks",
        "resourceUri": "https://<openai-resource>.openai.azure.com",
        "deploymentId": "text-embedding-3-large",
        "modelName": "text-embedding-3-large",
        "context": "/document/chunks/*",
        "inputs": [{ "name": "text", "source": "/document/chunks/*" }],
        "outputs": [{ "name": "embedding", "targetName": "content_vector" }]
      }
    ],
    "indexProjections": {
      "selectors": [
        {
          "targetIndexName": "knowledge-sources",
          "parentKeyFieldName": "parent_id",
          "sourceContext": "/document/chunks/*",
          "mappings": [
            { "name": "content", "source": "/document/chunks/*" },
            { "name": "content_vector", "source": "/document/chunks/*/content_vector" },
            { "name": "title", "source": "/document/metadata_storage_name" }
          ]
        }
      ],
      "parameters": { "projectionMode": "generatedKeyAsId" }
    }
  }'
```

## 5. Create the Indexer

The indexer connects the data source to the skillset and index. It runs on a 5-minute schedule.

```bash
az rest --method PUT \
  --uri "https://<search-service-name>.search.windows.net/indexers/knowledge-sources-indexer?api-version=2024-07-01" \
  --headers "Content-Type=application/json" \
  --body '{
    "name": "knowledge-sources-indexer",
    "dataSourceName": "knowledge-sources-blob",
    "targetIndexName": "knowledge-sources",
    "skillsetName": "knowledge-sources-skillset",
    "schedule": { "interval": "PT5M" },
    "parameters": {
      "configuration": {
        "dataToExtract": "contentAndMetadata",
        "parsingMode": "default",
        "imageAction": "generateNormalizedImages"
      }
    },
    "fieldMappings": [
      { "sourceFieldName": "metadata_storage_name", "targetFieldName": "metadata_storage_name" },
      { "sourceFieldName": "metadata_storage_path", "targetFieldName": "metadata_storage_path" }
    ],
    "outputFieldMappings": []
  }'
```

Blob metadata field `projectId` is automatically mapped to the index field when it matches by name.

## 6. Configure Environment Variables

Add these to your `.env` or deployment configuration:

```bash
AZURE_SEARCH_ENDPOINT=https://<search-service-name>.search.windows.net
AZURE_SEARCH_INDEX_NAME=knowledge-sources  # optional, this is the default
```

## 7. Grant Access

The backend uses `ChainedTokenCredential` (Azure CLI for local dev, Managed Identity for production).

Grant the app's identity the **Search Index Data Reader** role on the search service:

```bash
az role assignment create \
  --assignee <app-identity-object-id> \
  --role "Search Index Data Reader" \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Search/searchServices/<search-service-name>
```

For local development, ensure your Azure CLI login (`az login`) has the same role.

## How It Works

1. User uploads a file via the Coglity UI
2. Backend stores the file in Azure Blob Storage with `projectId` metadata
3. Azure AI Search indexer detects the new blob within 5 minutes
4. Skillset cracks the document, chunks the text, generates embeddings
5. Chunks are indexed with the `projectId` and `metadata_storage_name` fields
6. When a user views the knowledge source, the backend polls the index to update the status
7. During AI test case generation, relevant chunks are retrieved via semantic search and injected as context
