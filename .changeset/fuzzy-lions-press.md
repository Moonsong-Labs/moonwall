---
"@moonwall/types": minor
"@moonwall/util": minor
"@moonwall/cli": minor
"@moonwall/docs": minor
"@moonwall/tests": minor
---

Refactor node process management to Effect-TS:
- Migrate process spawning and lifecycle management to Effect
- Add Effect-based services: `ProcessManagerService`, `NodeReadinessService`, `PortDiscoveryService`, `RpcPortDiscoveryService`
- Replace exec-based node launching with @effect/platform Command
- Replace native WebSocket readiness checks with @effect/platform Socket
- Add legacy launch option for backward compatibility
- Improve port discovery and availability checking
- Add comprehensive test coverage for Effect services
