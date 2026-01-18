# n8n Integration Specification

## Overview

FlowBuilder integrates with n8n via its public REST API to provide full workflow management capabilities. This document details the API integration layer.

## API Configuration

### Base URL

| Deployment | Base URL Format |
|------------|-----------------|
| n8n Cloud | `https://<instance-name>.app.n8n.cloud/api/v1` |
| Self-Hosted | `https://<your-domain>/api/v1` |

### Authentication

All API requests require authentication via the `X-N8N-API-KEY` header.

```http
X-N8N-API-KEY: your-api-key-here
```

**Creating an API Key:**
1. Log into your n8n instance
2. Navigate to **Settings → n8n API**
3. Create a new API key
4. Store securely (never commit to version control)

### Important Notes

- n8n Cloud API access requires a **paid tier**
- API playground/Swagger UI is only available on self-hosted instances
- Rate limiting applies - implement exponential backoff for retries

## API Endpoints

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/workflows` | List all workflows |
| `POST` | `/workflows` | Create a new workflow |
| `GET` | `/workflows/{id}` | Get workflow by ID |
| `PUT` | `/workflows/{id}` | Update workflow |
| `DELETE` | `/workflows/{id}` | Delete workflow |
| `POST` | `/workflows/{id}/activate` | Activate workflow |
| `POST` | `/workflows/{id}/deactivate` | Deactivate workflow |

### Executions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/executions` | List workflow executions |
| `GET` | `/executions/{id}` | Get execution details |
| `DELETE` | `/executions/{id}` | Delete execution |

### Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/credentials` | List credentials |
| `POST` | `/credentials` | Create credentials |
| `DELETE` | `/credentials/{id}` | Delete credentials |

## Workflow JSON Structure

n8n workflows are represented as JSON. Here's the basic structure:

```json
{
  "name": "My Workflow",
  "active": false,
  "nodes": [
    {
      "name": "Start",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300],
      "parameters": {}
    },
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "url": "https://api.example.com/data",
        "method": "GET"
      }
    }
  ],
  "connections": {
    "Start": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {}
}
```

### Key Concepts

- **nodes**: Array of node definitions (triggers, actions, etc.)
- **connections**: Defines how nodes are connected (data flow)
- **position**: Visual coordinates in the n8n editor
- **parameters**: Node-specific configuration

## Example API Calls

### List All Workflows

```bash
curl -X GET "https://your-instance.app.n8n.cloud/api/v1/workflows" \
  -H "X-N8N-API-KEY: your-api-key"
```

### Create a Workflow

```bash
curl -X POST "https://your-instance.app.n8n.cloud/api/v1/workflows" \
  -H "X-N8N-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Workflow",
    "nodes": [...],
    "connections": {...},
    "active": false
  }'
```

### Update a Workflow

```bash
curl -X PUT "https://your-instance.app.n8n.cloud/api/v1/workflows/{id}" \
  -H "X-N8N-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Workflow",
    "nodes": [...],
    "connections": {...}
  }'
```

### Activate a Workflow

```bash
curl -X POST "https://your-instance.app.n8n.cloud/api/v1/workflows/{id}/activate" \
  -H "X-N8N-API-KEY: your-api-key"
```

## FlowBuilder Integration Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Chat UI  │────▶│  Node.js API    │────▶│  n8n Cloud/     │
│                 │     │                 │     │  Self-Hosted    │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │ 1. User describes workflow
                               │ 2. Claude generates JSON
                               │ 3. API pushes to n8n
                               ▼
                        ┌─────────────────┐
                        │                 │
                        │  Claude API     │
                        │  (Anthropic)    │
                        │                 │
                        └─────────────────┘
```

### Flow

1. User describes a workflow in natural language
2. FlowBuilder sends prompt to Claude API
3. Claude generates n8n workflow JSON
4. FlowBuilder validates the JSON structure
5. FlowBuilder calls n8n API to create/update workflow
6. Response is sent back to user

## Error Handling

| Status Code | Meaning | Action |
|-------------|---------|--------|
| 401 | Unauthorized | Check API key |
| 404 | Workflow not found | Verify workflow ID |
| 422 | Validation error | Check workflow JSON structure |
| 429 | Rate limited | Implement exponential backoff |
| 500 | Server error | Retry with backoff |

## Environment Variables

```env
# n8n Configuration
N8N_API_URL=https://your-instance.app.n8n.cloud/api/v1
N8N_API_KEY=your-api-key-here

# Anthropic Configuration
ANTHROPIC_API_KEY=your-anthropic-key
```

## Security Considerations

1. **Never expose API keys** in frontend code
2. **Proxy all n8n API calls** through the backend
3. **Validate workflow JSON** before sending to n8n
4. **Implement rate limiting** on the FlowBuilder API
5. **Log API calls** for debugging (without sensitive data)

## References

- [n8n Public REST API Documentation](https://docs.n8n.io/api/)
- [n8n API Reference](https://docs.n8n.io/api/api-reference/)
- [n8n Community - API URL Help](https://community.n8n.io/t/help-with-n8n-api-url/23564)

---

*Status: Draft*
*Last updated: 2026-01-18*
