# Trivia Master – AWS Deployment Guide

Runbook for deploying the Trivia Master app: backend on ECS Fargate behind an ALB, frontend as static export on S3 + CloudFront, Supabase as database. Optimized for future reuse.

---

## Overview

- **Backend:** NestJS in Docker → ECR → ECS Fargate; ALB routes traffic; health at `GET /api/health`.
- **Frontend:** Next.js static export (`output: 'export'`) → S3 bucket → CloudFront; browser calls API via same CloudFront URL.
- **Database:** Supabase (external); connection string and JWT secret in SSM Parameter Store.
- **Critical:** When the ALB is reachable only from CloudFront, **`NEXT_PUBLIC_API_URL`** must be the **CloudFront URL**, not the ALB URL, so the browser hits CloudFront, which routes `/api*` to the backend.

---

## Architecture

```
Browser → CloudFront (HTTPS)
           ├── /api*     → ALB → ECS (NestJS)
           ├── /games/*  → S3 (via viewer-request rewrite)
           └── *         → S3 (static frontend)
```

- **Static frontend:** No SSR; app is login-gated and state comes from the API. Static export keeps cost and ops low.
- **ALB:** Inbound only from CloudFront (managed prefix list); no direct public access.
- **ECS tasks:** Inbound TCP 3000 from ALB security group only.

---

## AWS Console Overview

**Services used:** S3 (frontend assets), CloudFront (CDN, path-based routing, viewer function), Application Load Balancer (backend entry), ECS Fargate (NestJS container), ECR (Docker images), IAM (roles for ECS, SSM). Optional: Route 53 (custom domain), CloudWatch (logs/alarms). An AWS assistant (e.g. Amazon Q) can help export distribution or resource configs as JSON when debugging with external tools.

**Console vs CLI:** CloudFront distribution (origins, behaviors, viewer function, error pages) and S3 bucket/OAC are best created and edited in the **Console**; CLI often fails for S3+custom-origin setups. Backend **deploys** (ECR push, ECS update-service, task definition) and one-off fixes (e.g. target group health path, security group rules) use **CLI** with a named profile (e.g. `--profile admin`).

**Stable vs changing:** Cluster, service, ALB, target group, CloudFront distribution, S3 bucket, and IAM roles are relatively stable. You will frequently: push new images to ECR, run ECS `update-service --force-new-deployment`, sync `frontend/out/` to S3 and invalidate CloudFront. After editing the CloudFront Function code in the Console, you must **Publish** the function for the LIVE version to update.

**How pieces connect:** CloudFront is the single public entry. Requests to the frontend domain hit CloudFront; path `/api*` goes to the ALB origin (and onward to ECS); other paths go to the S3 origin (or are rewritten by the viewer function, e.g. `/games/<id>` → `/games/new.html`). The ALB forwards to the ECS service; ECS runs the container image from ECR.

---

## Backend Deployment

**Profile:** Use `--profile admin` (or your profile) on all `aws` commands below if applicable.

### Prerequisites

- VPC with ≥2 subnets; ALB and target group (health path `/api/health`, port 3000); ECS execution role (ECR pull, CloudWatch Logs, SSM read).

### 1. Migrations

```bash
cd backend
export DATABASE_URL="<Supabase connection string>"
npx prisma migrate deploy
```

### 2. Build and push image

Use `Dockerfile.prod`. Image must be **linux/amd64** for Fargate (e.g. on ARM Macs use `--platform linux/amd64`).

```bash
cd backend
aws ecr get-login-password --region us-east-1 --profile admin | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

docker buildx build --platform linux/amd64 -f Dockerfile.prod -t trivia-master-backend:latest .
docker tag trivia-master-backend:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest
```

### 3. Secrets (SSM)

```bash
aws ssm put-parameter --name "/trivia-master-backend/DATABASE_URL" \
  --type SecureString --value "<connection-string>" --region us-east-1 --profile admin
# Repeat for SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, FRONTEND_URL.
```

**Execution role:** Must allow reading these parameters. Attach an inline policy to the ECS task **execution** role (e.g. `trivia-master-backend-execution-role`) with `ssm:GetParameters` on `arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/trivia-master-backend/*` and, if using KMS, `kms:Decrypt` on the key used by the parameters. After changing parameters or adding this policy, run `update-service --force-new-deployment` so new tasks pick up secrets.

### 4. Deploy / update service

```bash
aws ecs update-service \
  --cluster trivia-master-backend-cluster \
  --service trivia-master-backend-service \
  --task-definition trivia-master-backend-task \
  --desired-count 1 \
  --force-new-deployment \
  --region us-east-1 \
  --profile admin
```

**Health:** ALB target group health path must be **`/api/health`**. One-time fix if it was `/health`:

```bash
TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --profile admin --query 'TargetGroups[?TargetGroupName==`trivia-master-backend-tg`].TargetGroupArn' --output text)
aws elbv2 modify-target-group --target-group-arn "$TG_ARN" --health-check-path /api/health --region us-east-1 --profile admin
```

**Verify (via CloudFront):** `curl -i https://<cloudfront-domain>/api/health` → `200` and `{"status":"ok"}`.

**ECS Exec (optional):** To get a shell in the running container: (1) Enable on the service: `aws ecs update-service ... --enable-execute-command`. (2) Task **role** (not execution role) must allow SSM session: attach a policy with `ssmmessages:CreateControlChannel`, `ssmmessages:CreateDataChannel`, `ssmmessages:OpenControlChannel`, `ssmmessages:OpenDataChannel` (resource `*`). (3) Exec in: `aws ecs execute-command --cluster trivia-master-backend-cluster --task <TASK_ID> --container trivia-master-backend --interactive --command "/bin/sh" --region us-east-1 --profile admin`. Get `<TASK_ID>` from ECS console or `aws ecs list-tasks --cluster trivia-master-backend-cluster --service-name trivia-master-backend-service --query 'taskArns[0]' --output text`.

---

## Frontend Deployment

- Build with **production** `NEXT_PUBLIC_*` in `frontend/.env` (Supabase URL/key, and **CloudFront URL** for `NEXT_PUBLIC_API_URL`).
- Static export writes to `out/`. Sync to S3 and invalidate CloudFront.

```bash
cd frontend
npm run build
aws s3 sync out/ s3://trivia-master-frontend/ --delete --region us-east-1 --profile admin
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths '/*' --region us-east-1 --profile admin
```

Or use the npm script if defined: `npm run deploy` (must include `--profile admin` in the script for `aws` commands).

**Supabase:** In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** and **Redirect URLs** to your CloudFront URL (e.g. `https://<domain>.cloudfront.net` and `https://<domain>.cloudfront.net/**`).

---

## CloudFront Routing Summary

| Path pattern | Origin | Cache | Notes |
|--------------|--------|-------|-------|
| **/api*** | ALB (backend) | Disabled | Origin request policy: **Managed-AllViewerExceptHostHeader** (forwards `Authorization`). |
| **/games/*** | S3 (frontend) | Disabled | Path pattern must include leading slash: `/games/*`. Viewer request: CloudFront Function (see below). |
| **Default (*)** | S3 (frontend) | Optimized | DefaultRootObject `index.html`. Viewer request: same function for `.html` rewrites. |

**Viewer request function:** Code in `frontend/cloudfront-function-rewrite-uri.js`. Rewrites `/games/<id>` → `/games/new.html` so S3 serves the game page; skips `/api`, `/health`, `/me`; adds `.html` for other paths. **After editing in the Console, click Save then Publish** so the LIVE version updates.

**Custom error pages:** 403 and 404 → respond with **200** and **/index.html** so SPA routes work.

**ALB security group:** Allow inbound TCP 80 **only from the CloudFront managed prefix list** (`com.amazonaws.global.cloudfront.origin-facing`). No `0.0.0.0/0`.

---

## Environment Variables

| Component | Variable | Purpose |
|-----------|----------|---------|
| Backend | `DATABASE_URL` | Supabase Postgres connection string |
| Backend | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` | Supabase API and JWT verification |
| Backend | `FRONTEND_URL` | CORS allowed origin (CloudFront URL) |
| Backend | `PORT` | Listen port (default 3000) |
| Frontend | `NEXT_PUBLIC_API_URL` | **CloudFront URL** (so API calls go through CloudFront → backend) |
| Frontend | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (baked at build time) |

---

## Preflight (CI/CD)

Before the first CI/CD run or after changing AWS resources or GitHub Actions secrets, complete the checklist in **`docs/preflight_cicd.md`**: verify AWS resources (ECS, ECR, ALB/target group, S3 versioning, CloudFront, IAM), then GitHub secrets/variables (AWS credentials, ECR_URI, ECS_*, S3_BUCKET, CLOUDFRONT_DIST_ID, NEXT_PUBLIC_*). Optional: confirm health via CloudFront and S3 version restore. All required items (sections 1 and 2) must pass before pushing to `main` or triggering workflows.

---

## CI/CD

Pipelines run on **push to `main`** via GitHub Actions (`.github/workflows/backend-deploy.yml`, `.github/workflows/frontend-deploy.yml`). Credentials use GitHub Actions secrets. If any step fails, later steps do not run—no partial deploy (safe-by-default).

**Backend:** Install deps → run tests → build Docker image (linux/amd64) → push to ECR (deterministic tag + optional `:latest`) → ECS `update-service --force-new-deployment`. If tests or Docker push fail, ECS is not updated. **Rollback:** Re-deploy previous image (update task definition to previous image tag and run `update-service --task-definition <family>:<revision> --force-new-deployment`, or re-run workflow from previous commit). Verify: `curl -i https://<cloudfront-domain>/api/health` → 200 and `{"status":"ok"}`.

**Frontend:** Install deps → build static export (`NEXT_PUBLIC_*` from secrets at build time; changing them requires a rebuild) → sync `out/` to S3 → CloudFront invalidation. If build fails, S3 sync does not run. S3 versioning must be enabled for rollback. **Rollback:** Restore previous S3 object versions for the frontend bucket, then `aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths '/*'`.

---

## Validation Checklist

- [ ] `curl -I https://<cloudfront-domain>/` → 200 (frontend).
- [ ] `curl -i https://<cloudfront-domain>/api/health` → 200 and `{"status":"ok"}`.
- [ ] Create New Game in the app → lands on game page and game starts or shows Start Game.
- [ ] Supabase Dashboard: Site URL and Redirect URLs include CloudFront URL.

---

## Common Pitfalls

- **NEXT_PUBLIC_API_URL** must be the CloudFront URL when ALB is CloudFront-only; otherwise the browser cannot reach the API.
- **CloudFront Function:** After changing the viewer-request function code in the Console, **Publish** the function; otherwise the old LIVE version keeps running.
- **Path pattern for games:** Use **/games/*** (with leading slash) so requests like `/games/abc123` match the behavior that has the rewrite function.
- **/api/health returns 200 with HTML (from S3):** Add a cache behavior for `/api*` → ALB origin, with precedence above Default (*). Ensure the ALB has a listener on port 80 (or 443) forwarding to the target group—CloudFront’s origin uses port 80; if the ALB only listens on another port, the origin fails and CloudFront falls back to the default (S3).
- **Backend 503 / unhealthy:** Check target group health path is `/api/health`; check ECS task security group allows TCP 3000 from the ALB security group; check container listens on `0.0.0.0:3000`.
- **Supabase “Cannot reach”:** Restore project if paused; verify API URL and anon key; ensure Redirect URLs include the CloudFront URL.

---

## Lesson learned: framework and deployment fit

Using Next.js with static export on this stack introduced extra deployment work—CloudFront viewer-request rewrites, error-page handling, and routing behavior—compared to a plain React SPA served as a single `index.html`. The tradeoff was acceptable for this project, but it reinforced that framework choice should align with deployment goals: if the app does not need SSR or incremental static generation, a simpler frontend build can simplify the CDN and routing setup. Matching the tool to the actual requirements (static vs. server-rendered) keeps the pipeline easier to reason about and maintain.

---

## Optional: First-time backend setup (CLI)

For creating cluster, ECR repo, task definition, and service from scratch, use `backend/ecs-task-backend.json` as the task definition template. The deploy steps above assume cluster, service, ALB, and target group already exist.

---

## Monitoring

- **Logs:** CloudWatch log group `/ecs/trivia-master-backend`; `aws logs tail /ecs/trivia-master-backend --follow --region us-east-1`.
- **Health:** ALB target group and `GET /api/health` as in Validation.

---

## Observability, Reliability, and Operational Validation

These activities validate that logs, metrics, health checks, and failure modes are visible and correctly interpreted. NestJS does not log every HTTP request by default; seeing startup and error logs (not per-request lines) is expected unless request logging is added at the app level.

### 1. Backend logs in CloudWatch

- **Purpose:** Confirm ECS → CloudWatch log delivery and that application output (startup, errors) is visible.
- **Console:** CloudWatch → Log groups → `/ecs/trivia-master-backend` → open the most recent log stream. Check for recent timestamps and NestJS output (e.g. "Nest application successfully started").
- **CLI:** `aws logs tail /ecs/trivia-master-backend --follow --region us-east-1 --profile admin`. You may not see a new line for every request unless request logging is enabled in the app.
- **Success:** At least one log stream with recent timestamps and app-generated logs; traffic to the backend confirmed (e.g. 200 from CloudFront `/api/health`).

### 2. CloudWatch Logs Insights

- **Purpose:** Query backend logs by time and content (errors, recent messages) without scanning streams by hand.
- **Steps:** CloudWatch → Logs → Logs Insights. Select log group `/ecs/trivia-master-backend`, set time range (e.g. Last 1 hour).
- **Query — recent messages:** `fields @timestamp, @message | sort @timestamp desc | limit 50`
- **Query — errors (case-insensitive):** `fields @timestamp, @message | filter @message like /(?i)error/ | sort @timestamp desc | limit 20`
- **Success:** First query returns app-like rows; second returns error lines or empty. Both confirm you can filter by content.

### 3. ALB target health

- **Purpose:** See how the ALB sees ECS tasks (healthy vs unhealthy) and why the API might be down or flapping.
- **Console:** EC2 → Target groups → backend target group (e.g. `trivia-master-backend-tg`) → Targets tab. Note health status and, in Details, health check path (`/api/health`) and port (e.g. 3000).
- **CLI:**
  ```bash
  TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --profile admin \
    --query 'TargetGroups[?contains(TargetGroupName,`trivia-master`)].TargetGroupArn' --output text)
  aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --region us-east-1 --profile admin
  aws elbv2 describe-target-groups --target-group-arns "$TG_ARN" --region us-east-1 --profile admin \
    --query 'TargetGroups[0].{HealthCheckPath:HealthCheckPath,HealthCheckPort:HealthCheckPort,Port:Port}'
  ```
- **Success:** At least one target Healthy; health check path `/api/health`. Healthy = ALB sends traffic; Unhealthy = ALB stops after failed checks; Initial = still in first checks.

### 4. ALB and CloudFront metrics (edge vs origin)

- **Purpose:** Distinguish edge (CloudFront) from origin (ALB/backend) when users see 5xx or slowness.
- **CloudFront (edge):** CloudWatch → Metrics → All metrics → **CloudFront** → By distribution. Select your **distribution ID** (e.g. from `aws cloudfront list-distributions`). Add **Requests**, **5xxErrorRate**. CloudFront metrics exist only in **us-east-1**. Optional: add a dashboard (e.g. Trivia-Master-Ops) with a widget; use the correct DistributionId or the graph shows no data.
- **ALB (origin):** Metrics → **Application ELB** → By Load Balancer → select your ALB. Add **RequestCount**, **HTTPCode_ELB_5XX_Count**, **HTTPCode_Target_5XX_Count**, **TargetResponseTime**.
- **Interpretation:** High CloudFront 5xxErrorRate + high origin latency → origin problem. High **HTTPCode_ELB_5XX_Count** → no healthy targets or timeouts. High **HTTPCode_Target_5XX_Count** → backend returning 5xx; check ECS/CloudWatch logs.

### 5. Validate /api/health through CloudFront

- **Purpose:** Confirm the health endpoint is reachable on the same path users use (CloudFront → ALB → backend).
- **Step:** `curl -i https://<cloudfront-domain>/api/health`
- **Success:** HTTP 200 and body `{"status":"ok"}` (or your backend’s response). No 502/503/504. If health works only when hitting the ALB directly but not via CloudFront, target health can be healthy while user traffic fails.
