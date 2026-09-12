# Query provider quotas live on every Refresh

Each Refresh first discovers current Provider Accounts and `auth_index` values through `/v0/management/auth-files`, then queries supported upstream quota endpoints through `/v0/management/api-call`. Passive quota signals from `/auth-files` are not the primary source because they can be stale or absent without recent proxy traffic and do not provide equivalent provider coverage.
