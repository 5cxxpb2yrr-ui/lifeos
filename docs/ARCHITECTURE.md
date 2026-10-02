# LifeOS V2 Architecture

Mission Control is the primary UX. Events are canonical historical objects. Open Loops drive workload. Relationships are first-class. Status is historical truth; Attention is operational truth.

Data flow:
Raw Storage → Repositories → Domain Services → Resolvers → View Models → Components

The UI never owns domain calculations. Each derived calculation has one resolver owner.

MVP storage is IndexedDB. LocalStorage is reserved for small UI/config state.

Cloudflare Workers hosts the web application. The browser remains the canonical personal-data store for the local-first MVP.