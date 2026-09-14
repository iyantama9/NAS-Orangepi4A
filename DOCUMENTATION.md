# NAS Orange Pi 4A documentation

This index separates product orientation, client integration, operations, and security.

| Document | Use it for |
| --- | --- |
| [README](README.md) | Overview, data flow, setup, deployment, and project credits |
| [Architecture](docs/ARCHITECTURE.md) | Services, storage model, upload lifecycle, delivery, cleanup, and failure boundaries |
| [API reference](docs/API_REFERENCE.md) | Authentication, nodes, uploads, shares, system, health, and error behavior |
| [Operations](docs/OPERATIONS.md) | Storage preparation, deployment, backup, restore, monitoring, updates, and incidents |
| [Security](docs/SECURITY.md) | Current controls, known gaps, public exposure checklist, and reporting |

## Recommended reading paths

**User:** README, then the browser routes and sharing sections.

**Operator:** README, Operations, Security, then the persistence sections of Architecture.

**Client developer:** API reference, upload protocol in Architecture, then shared schemas in `packages/shared`.

**Maintainer:** Architecture, API reference, application source, and database migrations.

## Documentation principles

- The implementation and current database migrations are the source of truth.
- Examples contain placeholders rather than live hosts or credentials.
- Storage recovery always considers PostgreSQL and chunk data as one consistency set.
- Public deployment gaps are stated plainly.
- Source availability is not represented as a software license.

## Repository map

```text
apps/api/src/              HTTP routes, services, persistence, and jobs
apps/web/src/              Browser interface and background uploads
packages/shared/src/       Cross-package schemas and types
infra/                     Device deployment helpers
docs/                      Maintainer and operator documentation
docker-compose.yml         Runtime services and persistent mounts
Dockerfile                 Production build and runtime
```
