# Query live quotas for unavailable provider accounts

CLIProxyAPI marks provider accounts as unavailable when upstream quotas are exhausted or rate-limited. The extension previously excluded unavailable accounts from live quota retrieval, preventing users from seeing remaining capacity and reset countdowns. The extension now queries live quotas for unavailable accounts while preserving their unavailable status badge, allowing users to observe 0% capacity and reset times. Disabled accounts remain excluded from live quota queries.
