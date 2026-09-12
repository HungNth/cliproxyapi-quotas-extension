# CLI Proxy API Quotas

A browser extension for observing the remaining upstream-provider capacity exposed through one configured CLIProxyAPI instance.

## Language

**CLIProxyAPI Instance**:
The single CLIProxyAPI installation whose accounts and quotas are shown by the extension.
_Avoid_: Server profile, connection profile

**Management Key**:
The secret that authorizes the extension to inspect one CLIProxyAPI Instance.
_Avoid_: Provider API key, access token

**Provider Account**:
An upstream provider identity exposed by the CLIProxyAPI Instance, including its availability state and quota information.
_Avoid_: Auth file, credential file

**Provider Group**:
The collection of Provider Accounts that share one upstream provider and the same quota semantics.
_Avoid_: Provider section, account type

**Quota Window**:
A provider-defined allowance period, such as five hours or one week, represented by remaining capacity and its reset time.
_Avoid_: Limit bucket, rate bucket

**Quota Snapshot**:
The collection of Provider Account quota information obtained during one Refresh.
_Avoid_: Cached quota, live status

**Partial Quota Snapshot**:
A Quota Snapshot that preserves successful Provider Account results while identifying accounts whose quota could not be loaded.
_Avoid_: Failed Refresh, incomplete data

**Refresh**:
One network load of a Quota Snapshot, initiated when the popup opens or when the user explicitly requests it.
_Avoid_: Poll, auto-refresh

**CLIProxyAPI Update Notice**:
An indication that the connected CLIProxyAPI Instance is older than the latest available CLIProxyAPI release.
_Avoid_: Extension update, provider update
