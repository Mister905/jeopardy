# Trivia Master – AWS Deployment Guide

Deployment runbook for the Trivia Master app: backend on ECS Fargate behind an ALB, frontend as static export on S3 + CloudFront, Supabase as external database. Includes environment variables, health checks, and basic monitoring.

---

## Recommended AWS Services

| Area | Services |
|------|----------|
| **Frontend** | S3 (static build), CloudFront (CDN + HTTPS), Route 53 (optional custom domain) |
| **Backend** | ECS Fargate (NestJS), ECR (images), Application Load Balancer (routing + health), IAM (least privilege) |
| **Config & Ops** | SSM Parameter Store / Secrets Manager (secrets), CloudWatch Logs (logging), CloudWatch Alarms (optional) |
| **Database** | Supabase (external managed Postgres) |

> **Résumé line:**  
> “Containerized backend on ECS Fargate, frontend on CloudFront, secrets in SSM/Secrets Manager.”

---

## Why Static Frontend (No SSR)

- App is login-gated and pulls state from the API; no per-page SEO need.
- SSR would add ECS/operational cost and complexity without improving UX for this use case.

**Options:** Static export → S3 + CloudFront (recommended) | Next.js server on ECS if you need SSR later.

---

## Production Environment Variables

| Component | Variable | Purpose |
|-----------|----------|---------|
| Backend | `DATABASE_URL` | Supabase Postgres connection string |
| Backend | `SUPABASE_URL` | Supabase API URL |
| Backend | `SUPABASE_ANON_KEY` | Supabase anon key |
| Backend | `SUPABASE_JWT_SECRET` | JWT verification |
| Backend | `FRONTEND_URL` | Allowed CORS origin (e.g. CloudFront URL) |
| Backend | `PORT` | Listen port (default `3000`) |
| Frontend | `NEXT_PUBLIC_API_URL` | Backend base URL (ALB or custom domain) |
| Frontend | `NEXT_PUBLIC_SUPABASE_URL` | Supabase client URL |
| Frontend | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

**Backend:** Prefer SSM Parameter Store (SecureString) or Secrets Manager; reference in task definition via `secrets` so values are injected at task start.  
**Frontend:** Set at **build time**; static export bakes `NEXT_PUBLIC_*` into the bundle.

---

# Backend Deployment

## Overview

- **ECS Cluster** (Fargate) runs the NestJS container.
- **ALB** fronts the service; target group health check uses `GET /health` on port 3000.
- **Security groups:** ALB allows 80/443 from internet; ECS tasks allow **inbound TCP 3000 from the ALB security group only**.

## Prerequisites

- VPC with at least two subnets (e.g. public or private depending on design).
- ALB and target group (port 3000, health path `/health`) created and listener attached.
- Execution role for ECS (ECR pull, CloudWatch Logs, SSM read if using secrets from Parameter Store).

## Step 1: Database migrations

Run migrations against the target database **before** deploying the new backend.

```bash
cd backend
export DATABASE_URL="<Supabase connection string>"
npx prisma migrate deploy
```

## Step 2: Build and push the production image

Use **`Dockerfile.prod`** (not the dev Dockerfile). The app listens on `0.0.0.0:3000`.

```bash
cd backend
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# --platform linux/amd64 ensures the image runs on ECS Fargate (x86_64); required on ARM Macs (M1/M2)
docker buildx build --platform linux/amd64 -f Dockerfile.prod -t trivia-master-backend:latest .
docker tag trivia-master-backend:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest
```

### Build Architecture Considerations (ARM vs x86_64)

- Macs with M1/M2 chips (ARM64) build ARM images by default.
- ECS Fargate expects x86_64 images unless the task definition explicitly uses ARM/Graviton.
- Using an ARM64 image on x86_64 Fargate fails with `exec format error`.
- The sequence above uses `docker buildx build --platform linux/amd64` so the image is compatible on both ARM and x86_64 build hosts. In CI/CD on ARM agents, always use `--platform linux/amd64` for Fargate.

## Step 3: Secrets (SSM Parameter Store)

Store sensitive values as SecureString parameters; the task definition references them so ECS injects them at container start.

```bash
aws ssm put-parameter --name "/trivia-master-backend/DATABASE_URL" \
  --type SecureString --value "<connection-string>" --region us-east-1
# Repeat for SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, FRONTEND_URL as needed.
```

Ensure the **task execution role** has `ssm:GetParameters` (and `kms:Decrypt` if using KMS) on these parameters. See `docs/ecs-secrets-guide.md` and `docs/iam-ecs-execution-ssm-policy.json` if needed.

## Step 4: ECS cluster, ECR, task definition, and service

**Option A – Use repo task definition JSON (recommended for consistency):**

```bash
cd backend
aws ecs register-task-definition --cli-input-json file://ecs-task-backend.json --region us-east-1

aws ecs update-service \
  --cluster trivia-master-backend-cluster \
  --service trivia-master-backend-service \
  --task-definition trivia-master-backend-task \
  --desired-count 1 \
  --force-new-deployment \
  --region us-east-1
```

**Option B – Full AWS CLI sequence (first-time or one-off setup):**

```bash
export AWS_REGION="us-east-1"

# ECS service-linked role (required for Fargate)
aws iam get-role --role-name AWSServiceRoleForECS || \
  aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com

# Create ECS cluster
aws ecs create-cluster \
  --cluster-name trivia-master-backend-cluster \
  --capacity-providers FARGATE \
  --settings name=containerInsights,value=enabled \
  --region us-east-1

# Create ECR repository (if needed)
aws ecr create-repository \
  --repository-name trivia-master-backend \
  --region us-east-1

# Login Docker to ECR (replace <ACCOUNT_ID> with your AWS account ID)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build and push image (use Dockerfile.prod for production)
docker build -f Dockerfile.prod -t trivia-master-backend ./backend
docker tag trivia-master-backend:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest

# Register task definition (inline; replace placeholders or use file://ecs-task-backend.json)
aws ecs register-task-definition \
  --family trivia-master-backend-task \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu "256" \
  --memory "512" \
  --execution-role-arn arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole \
  --task-role-arn arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole \
  --container-definitions '[
    {
      "name": "trivia-master-backend",
      "image": "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend:latest",
      "portMappings": [{"containerPort": 3000}],
      "environment": [
        {"name": "PORT", "value": "3000"},
        {"name": "NODE_ENV", "value": "production"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/trivia-master-backend/DATABASE_URL"},
        {"name": "SUPABASE_URL", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/trivia-master-backend/SUPABASE_URL"},
        {"name": "SUPABASE_ANON_KEY", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/trivia-master-backend/SUPABASE_ANON_KEY"},
        {"name": "SUPABASE_JWT_SECRET", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/trivia-master-backend/SUPABASE_JWT_SECRET"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/trivia-master-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]' \
  --region us-east-1

# Create ECS service (replace $SUBNET1_ID, $SUBNET2_ID, $ECS_SG_ID, $TG_ARN with your values)
aws ecs create-service \
  --cluster trivia-master-backend-cluster \
  --service-name trivia-master-backend-service \
  --task-definition trivia-master-backend-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1_ID,$SUBNET2_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=trivia-master-backend,containerPort=3000" \
  --region us-east-1

# Output ALB DNS (replace $ALB_ARN or use your ALB name)
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names trivia-master-backend-alb \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "Backend ALB: http://$ALB_DNS"
```

**Task definition must include:** `containerPort` 3000, `secrets` (or env) for required vars, CloudWatch log configuration; for ECS Exec, a valid `taskRoleArn` with SSM permissions.

## Backend health check

- **Path:** `GET /health` → `200` with `{"status":"ok"}`.
- **ALB target group:** Health check path `/health`, port 3000, HTTP.
- **Security:** ECS task security group must allow **inbound TCP 3000 from the ALB security group**; otherwise targets stay unhealthy and the ALB returns empty or 5xx.

**Verify via the ALB (backend is not reachable by private IP from your machine):**

```bash
# Get ALB DNS (or use your known ALB DNS / custom domain)
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names trivia-master-backend-alb \
  --query 'LoadBalancers[0].DNSName' --output text)

curl -i "http://$ALB_DNS/health"
```

Expect `200 OK` and body `{"status":"ok"}`.

**Optional – verify from inside the container (e.g. when debugging ALB vs app):**

```bash
TASK_ARN=$(aws ecs list-tasks --cluster trivia-master-backend-cluster \
  --service-name trivia-master-backend-service --desired-status RUNNING \
  --region us-east-1 --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster trivia-master-backend-cluster \
  --task $TASK_ARN \
  --container trivia-master-backend \
  --interactive --command "/bin/sh" \
  --region us-east-1
```

Inside the container run: `wget -q -O - http://127.0.0.1:3000/health` (or `curl -s http://127.0.0.1:3000/health`). Use `exit` to leave the shell. ECS Exec must be enabled on the service; see `docs/ecs-service-fix-and-exec.md` if needed.

---

# Frontend Deployment

*(To be updated as you go. Static export → S3 + CloudFront.)*

---

# Health verification

## Via the ALB (recommended)

The backend is not reachable by private IP from your laptop. Use the ALB as the single public endpoint:

```bash
curl -i https://<your-alb-dns-or-domain>/health
```

Expect `200 OK` and `{"status":"ok"}`. If not, check target group health and security groups (ALB → tasks on port 3000).

## From inside the container (optional)

To confirm the app responds on port 3000 inside the task (e.g. when debugging ALB vs app):

```bash
TASK_ARN=$(aws ecs list-tasks --cluster trivia-master-backend-cluster \
  --service-name trivia-master-backend-service --desired-status RUNNING \
  --region us-east-1 --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster trivia-master-backend-cluster \
  --task $TASK_ARN \
  --container trivia-master-backend \
  --interactive --command "/bin/sh" \
  --region us-east-1
```

Inside the container: `wget -q -O - http://127.0.0.1:3000/health` (or `curl -s http://127.0.0.1:3000/health`). Use `exit` to leave the shell. ECS Exec must be enabled on the service and the task role must have SSM permissions; see `docs/ecs-service-fix-and-exec.md` if needed.

---

# Monitoring and operations

- **Logs:** CloudWatch log group `/ecs/trivia-master-backend`. Tail: `aws logs tail /ecs/trivia-master-backend --follow --region us-east-1`.
- **Health:** ALB target group health and `GET /health` as above.
- **Metrics:** ECS task CPU/memory in the ECS console or CloudWatch; add alarms or scaling later as needed.
- **Secrets:** Keep backend secrets in SSM or Secrets Manager; never commit them. Rotate as needed.

**Iteration:** Start with logs + ALB health; then add basic metrics and alarms or auto-scaling when required.

---

# CI/CD notes

- **Backend:** Pipeline can build from `Dockerfile.prod`, push to ECR, then run `aws ecs update-service ... --force-new-deployment` (or register a new task definition revision and update the service).
- **Frontend:** Build with production `NEXT_PUBLIC_*` env vars, then sync `out/` to S3 and invalidate CloudFront cache for the deployed paths.
- Use a single branch or tag for production; keep secrets in the CI environment or a secrets store, not in repo.
