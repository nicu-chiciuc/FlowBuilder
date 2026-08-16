# FlowBuilder

FlowBuilder was an experimental prototype created in January 2026. It is not deployed or
maintained. This repository remains public as a record of the experiment.

## What it does

FlowBuilder provides a chat interface for managing [n8n](https://n8n.io/) workflows. A user
describes an automation in plain English, and Claude converts the request into n8n workflow
operations.

The prototype can:

- create and update workflows;
- activate, deactivate, and delete workflows;
- inspect existing workflows and recent executions;
- help debug failed workflow executions;
- stream assistant responses and show tool activity in the chat interface.

## How it works

1. A React and Vite frontend provides the chat interface.
2. Convex stores the conversation and runs the backend actions.
3. Claude interprets each request and can inspect workflow or execution data when needed.
4. The backend sends the resulting operations to the n8n REST API.

The application requires a Convex deployment and user-provided `ANTHROPIC_API_KEY`, `N8N_API_URL`,
and `N8N_API_KEY` values.

## Project status

This is a single-user proof of concept, not a production application. It has no user
authentication or tenant isolation, no automated tests, and no maintained deployment. The external
APIs and model identifiers used by the code can also have changed since the prototype was built.

See [`specs/`](./specs/) for the original design notes and [`app/`](./app/) for the implementation.
