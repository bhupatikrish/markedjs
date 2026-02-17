# SSO Integration Guide

## Overview
Connect your application to our centralized SSO.

## Configuration
Update your `config.yaml`:

```yaml
auth:
  provider: sso
  endpoint: https://sso.example.com
  client_id: my-app
```

## Testing
Run the connection test tool:
`./test-sso --client-id my-app`
