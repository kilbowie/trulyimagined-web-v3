# CRITICAL — Development Planning Repo Only

**This repository (`trulyimagined-web-v3`) is a development planning workspace.**

It is used for:
- Designing, prototyping, and iterating on new features
- Drafting architecture decisions, sprint plans, and documentation
- Proof-of-concept code that informs production implementation

---

## Production Changes MUST Go Into the Production Repos

All production-readiness changes — code, migrations, tests, config — must be applied to:

| Repo | Path | Purpose |
|------|------|---------|
| **trulyimagined** | `C:\Users\adamr\OneDrive\Desktop\KilbowieConsulting\002-TrulyImagined\trulyimagined` | TrulyImagined web platform (Next.js, Stripe, Auth0) |
| **hdicr** | `C:\Users\adamr\OneDrive\Desktop\KilbowieConsulting\002-TrulyImagined\hdicr` | HDICR consent/identity/licensing/representation services (Lambda) |

---

## Enforcement Rule

> Any AI agent or developer working on this codebase must **never apply production changes directly to this repo**.
>
> If a change is intended for live deployment, it belongs in `trulyimagined` or `hdicr` — not here.

Prototyped code in this repo should be **ported** to the appropriate production repo before being considered complete. See [EXECUTION_BOARD.md](EXECUTION_BOARD.md) for sprint workstream status.
