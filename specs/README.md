# FlowBuilder - Application Specification

## Overview

FlowBuilder is a conversational workflow automation platform that enables users to create, modify, and manage n8n workflows through a natural language chat interface. Powered by Claude (Anthropic), it transforms how users interact with workflow automation - no drag-and-drop required, just describe what you want.

## Vision

Traditional workflow builders require users to understand nodes, connections, and complex UIs. FlowBuilder removes this barrier by allowing users to simply describe their automation needs in plain English. The AI interprets these requests and generates, modifies, or debugs n8n workflows automatically.

## Target Audience

- **End Customers**: Business users and teams who need workflow automation without the technical learning curve
- Non-technical users who want to automate tasks
- Teams looking to streamline operations without dedicated automation engineers

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Convex |
| AI/LLM | Claude (Anthropic) |
| Workflow Engine | n8n |

## Core Features

### Chat-Based Workflow Management

Users interact with the system through a conversational interface to perform all workflow operations:

- **Create Workflows**: Describe a workflow in natural language, and the system generates the corresponding n8n workflow
- **Modify Workflows**: Request changes to existing workflows through chat commands
- **Debug & Troubleshoot**: Get help identifying and fixing workflow issues
- **Query Workflows**: Ask questions about existing workflows and their status

> Detailed specification: [Chat Interface Spec](./chat-interface.md) *(planned)*

### n8n Integration

The platform integrates deeply with n8n to provide full workflow automation capabilities:

- Workflow CRUD operations via n8n API
- Real-time workflow execution and monitoring
- Support for all n8n nodes and integrations

> Detailed specification: [n8n Integration Spec](./n8n-integration.md) *(planned)*

### AI/LLM Processing

The Claude-powered engine translates natural language into workflow definitions:

- Intent recognition for workflow operations
- Workflow JSON generation from descriptions
- Context-aware modifications to existing workflows
- Error explanation and fix suggestions

> Detailed specification: [AI Engine Spec](./ai-engine.md) *(planned)*

## Deployment

FlowBuilder supports flexible deployment options:

- **Cloud/SaaS**: Hosted solution for customers who want managed infrastructure
- **Self-Hosted**: On-premise deployment for customers with specific compliance or data residency requirements

## Project Status

**Current Stage**: Planning & Design

**Completed Setup:**
- n8n API - configured and verified
- Anthropic API (Claude) - configured and verified
- Convex backend - initialized

This specification is a living document that will evolve as the project develops.

## Spec Documents

| Document | Status | Description |
|----------|--------|-------------|
| [README.md](./README.md) | Current | Main specification overview |
| [chat-interface.md](./chat-interface.md) | Planned | Chat UI and interaction patterns |
| [n8n-integration.md](./n8n-integration.md) | Verified | n8n API integration details |
| [ai-engine.md](./ai-engine.md) | Planned | LLM processing and prompt design |
| [api-spec.md](./api-spec.md) | Planned | Backend API specification |
| [data-model.md](./data-model.md) | Planned | Database schema and data structures |
| [project-setup.md](./project-setup.md) | Draft | Project structure and initialization |

## Architecture (High-Level)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React + Vite  │────▶│     Convex      │────▶│   n8n Cloud     │
│   Frontend      │     │   Functions     │     │                 │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │                 │
                        │  Anthropic API  │
                        │    (Claude)     │
                        │                 │
                        └─────────────────┘
```

## Getting Started

*Coming soon - development is in planning phase*

---

## IMPORTANT Guidelines

*Rules and conventions that must always be followed during development.*

1. **When the user says something should "always" be done**, add it to this section immediately. Also add guidelines that seem important even if not explicitly marked as "always" (ask if unsure).
2. **When updating code or project structure**, consider if any specs need to be updated or if a new spec should be created.
3. **When verifying or testing integrations**, update the corresponding spec status from "Draft/Planned" to "Verified" and document any discoveries (e.g., plan requirements, gotchas).

---

*Last updated: 2026-01-19*
