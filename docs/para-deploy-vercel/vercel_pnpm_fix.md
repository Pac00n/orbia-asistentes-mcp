
# 🛠️ Fix Vercel build: ERR_PNPM_OUTDATED_LOCKFILE

## Problema
Vercel ejecuta `pnpm install --frozen-lockfile`.  
Si `pnpm-lock.yaml` no coincide con `package.json`, el build falla con:

```
ERR_PNPM_OUTDATED_LOCKFILE
Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date
```

---

## Solución estándar

```bash
# Sincroniza lockfile localmente
pnpm install          # genera pnpm-lock.yaml

git add pnpm-lock.yaml
git commit -m "fix: update pnpm-lock for Vercel"
git push
```

---

## Versiones distintas de pnpm

### A · Actualizar a pnpm 10 (igual que Vercel)

```bash
corepack enable
corepack prepare pnpm@10.4.0 --activate
pnpm install
```

### B · Obligar a Vercel a usar pnpm 9

```jsonc
// package.json
{ "packageManager": "pnpm@9.1.5" }
```

o en el dashboard de Vercel:  
`ENABLE_COREPACK=true` y `NODE_VERSION=18`

---

## Desactivar frozen lock (parche rápido)

```json
{
  "build": {
    "installCommand": "pnpm install --no-frozen-lockfile"
  }
}
```

---

## Checklist

- `pnpm install` ejecutado localmente  
- `pnpm-lock.yaml` commiteado  
- Versión de pnpm coherente o declarada
