# CI/CD Phase 1 – Preflight Checklist

Step-by-step verification before running the Trivia Master GitHub Actions pipelines (backend deploy, frontend deploy). Complete each section in order; fix any failures before running the workflows.

**How to use:** For each check, run the verification step. If it passes, mark the checkbox (e.g. replace `- [ ]` with `- [x]` in this doc, or track in a copy). If it fails, apply the fix, re-verify, then mark complete.

---

## 1. AWS resources

### 1.1 ECS cluster, service, and task definition

**Verify:**

```bash
aws ecs describe-clusters --clusters trivia-master-backend-cluster --region us-east-1 --profile admin \
  --query 'clusters[0].{name:clusterName,status:status}'
aws ecs describe-services --cluster trivia-master-backend-cluster --services trivia-master-backend-service \
  --region us-east-1 --profile admin --query 'services[0].{name:serviceName,status:status,taskDefinition:taskDefinition}'
aws ecs describe-task-definition --task-definition trivia-master-backend-task --region us-east-1 --profile admin \
  --query 'taskDefinition.{family:family,revision:revision,container:containerDefinitions[0].name}'
```

**Pass:** Cluster and service exist and are ACTIVE; task definition exists and lists the backend container (e.g. `trivia-master-backend`).

**Mark complete:** Check the box for this item once all three commands return expected output.

**If it fails:** Create cluster, service, and task definition per `docs/deploy.md` (Optional: First-time backend setup). Use `backend/ecs-task-backend.json` if available. Ensure task definition uses the correct ECR image URI and execution/task roles.

---

### 1.2 ECR repository

**Verify:**

```bash
aws ecr describe-repositories --repository-names trivia-master-backend --region us-east-1 --profile admin \
  --query 'repositories[0].repositoryUri'
```

**Pass:** Command returns the repository URI (e.g. `123456789012.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend`).

**Mark complete:** Check the box for this item.

**If it fails:** Create the repo: `aws ecr create-repository --repository-name trivia-master-backend --region us-east-1 --profile admin`. Use the returned `repositoryUri` for the workflow's ECR_URI secret.

---

### 1.3 ALB and target group (health path /api/health)

**Verify:**

```bash
TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --profile admin \
  --query 'TargetGroups[?TargetGroupName==`trivia-master-backend-tg`].TargetGroupArn' --output text)
aws elbv2 describe-target-groups --target-group-arns "$TG_ARN" --region us-east-1 --profile admin \
  --query 'TargetGroups[0].{HealthCheckPath:HealthCheckPath,Port:Port,TargetGroupName:TargetGroupName}'
```

**Pass:** Target group exists; `HealthCheckPath` is **`/api/health`** and port is 3000 (or your backend port).

**Mark complete:** Check the box for this item.

**If it fails:** Create or fix the target group. To fix health path only:  
`aws elbv2 modify-target-group --target-group-arn "$TG_ARN" --health-check-path /api/health --region us-east-1 --profile admin`.  
Then run ECS `update-service --force-new-deployment` so new tasks register with the corrected health check.

---

### 1.4 S3 bucket with versioning enabled

**Verify:**

```bash
aws s3api head-bucket --bucket trivia-master-frontend --profile admin
aws s3api get-bucket-versioning --bucket trivia-master-frontend --profile admin
```

**Pass:** Bucket exists (no 404); `get-bucket-versioning` shows `"Status": "Enabled"`. If the command returns **empty output** (no Status), versioning is **not** enabled—enable it before marking complete.

**Mark complete:** Check the box for this item.

**If it fails:** Create bucket if missing. Enable versioning:

```bash
aws s3api put-bucket-versioning --bucket trivia-master-frontend --versioning-configuration Status=Enabled --profile admin --region us-east-1
```

Versioning is required for frontend rollback (restore previous object versions).

---

### 1.5 CloudFront distribution

**Verify:**

```bash
aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment,'trivia') || contains(Origins.Items[0].DomainName,'trivia')].{Id:Id,DomainName:DomainName,Status:Status}" --output table
# Or by known distribution ID:
aws cloudfront get-distribution --id <YOUR_DIST_ID> --query 'Distribution.{Id:Id,DomainName:DomainName,Status:Status}' --profile admin
```

**Pass:** Distribution exists; Status is Deployed. Note the **Id** (distribution ID) and **DomainName** (e.g. `d1234abcd.cloudfront.net`) for secrets and for the health check URL.

**Mark complete:** Check the box for this item.

**If it fails:** Create or fix the CloudFront distribution per `docs/deploy.md`. Ensure `/api*` behavior points to the ALB origin and default behavior to the S3 origin. Use Console for distribution/origin/behavior setup; CLI for invalidations.

---

### 1.6 IAM roles and permissions

**Verify:**

- **ECS task execution role** (e.g. `trivia-master-backend-execution-role` or `ecsTaskExecutionRole`): can pull from ECR, write to CloudWatch Logs, read SSM parameters `/trivia-master-backend/*`.
- **ECS task role** (if used): permissions required by the app (e.g. no extra AWS calls if app only talks to Supabase).
- **GitHub Actions (CI) identity:** The IAM user or role whose credentials you put in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` must be able to: ECR `GetAuthorizationToken`, ECR push to `trivia-master-backend`, ECS `UpdateService` and `DescribeServices` (and related) on the cluster/service, S3 PutObject/DeleteObject on the frontend bucket, CloudFront `CreateInvalidation`.

**Pass:** Execution role is attached to the task definition and has ECR pull + CloudWatch Logs + SSM read. The CI identity can push to ECR, update the ECS service, sync to S3, and create CloudFront invalidations.

**How to verify (examples):**

```bash
# Execution role on task definition (must include --query value and --region/--profile)
aws ecs describe-task-definition --task-definition trivia-master-backend-task --region us-east-1 --profile admin --query 'taskDefinition.executionRoleArn'

# Test CI permissions (using the same profile or keys you will use in GitHub):
aws ecr get-login-password --region us-east-1 --profile admin
aws ecs describe-services --cluster trivia-master-backend-cluster --services trivia-master-backend-service --region us-east-1 --profile admin
aws s3 ls s3://trivia-master-frontend/ --profile admin
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths '/test-preflight' --profile admin
# (Optional) Delete the test invalidation from Console if desired.
```

**Mark complete:** Check the box once you have confirmed execution role and CI permissions.

**If it fails:** Attach or create the execution role with inline policy for ECR, CloudWatch Logs, and SSM (see `docs/deploy.md`). Add an IAM policy for the CI user/role granting the ECR, ECS, S3, and CloudFront actions above; scope resources to this account and repo.

---

## 2. GitHub repository secrets and variables

Use **Settings → Secrets and variables → Actions** in the GitHub repo. Prefer **secrets** for sensitive values; **variables** for non-sensitive identifiers (e.g. region, bucket name) if you prefer.

### 2.1 AWS credentials and region

| Name | Type | Purpose |
|------|------|---------|
| `AWS_ACCESS_KEY_ID` | Secret | IAM credentials for CI |
| `AWS_SECRET_ACCESS_KEY` | Secret | IAM credentials for CI |
| `AWS_REGION` | Secret or variable | e.g. `us-east-1` |

**Verify:** In the repo, go to Settings → Secrets and variables → Actions. Confirm the three names exist. Do not paste values into the checklist.

**Mark complete:** Check the box when all three are defined.

**If it fails:** Create the missing secrets/variables. Use an IAM user (or OIDC role) that has the CI permissions listed in section 1.6.

---

### 2.2 Backend (ECR / ECS)

| Name | Type | Example / note |
|------|------|----------------|
| `ECR_URI` | Secret or variable | Full ECR repo URI, e.g. `123456789012.dkr.ecr.us-east-1.amazonaws.com/trivia-master-backend` (no `https://`, no trailing slash). |
| `ECS_CLUSTER` | Secret or variable | `trivia-master-backend-cluster` |
| `ECS_SERVICE` | Secret or variable | `trivia-master-backend-service` |
| `ECS_TASK` | Secret or variable | Task definition family, e.g. `trivia-master-backend-task` |

**Verify:** Names and values match your actual ECR URI, cluster name, service name, and task definition family. Workflow will use these in `aws ecs update-service` and Docker tag/push.

**Mark complete:** Check the box when all four are set and match AWS.

**If it fails:** Create or correct the secrets/variables. ECR_URI must be the value from `aws ecr describe-repositories` (repositoryUri).

---

### 2.3 Frontend (S3 / CloudFront)

| Name | Type | Example / note |
|------|------|----------------|
| `S3_BUCKET` | Secret or variable | `trivia-master-frontend` |
| `CLOUDFRONT_DIST_ID` | Secret or variable | CloudFront distribution Id (e.g. `E3PQNFIR6EXJ2L`) |

**Verify:** S3_BUCKET matches the frontend bucket; CLOUDFRONT_DIST_ID matches the distribution used for the app (same as in deploy.md).

**Mark complete:** Check the box when both are set correctly.

**If it fails:** Create or correct the secrets/variables using the bucket name and distribution Id from section 1.

---

### 2.4 Frontend build: NEXT_PUBLIC_* variables

| Name | Type | Purpose |
|------|------|---------|
| `NEXT_PUBLIC_API_URL` | Secret | CloudFront URL (e.g. `https://d1234abcd.cloudfront.net`). Must be the CloudFront URL so the browser hits CloudFront → /api* → backend. |
| `NEXT_PUBLIC_SUPABASE_URL` | Secret | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret | Supabase anon key |

These are **injected at build time** in the frontend workflow. Changing them requires a new build and redeploy.

**Verify:** All three exist in Secrets. Values match production (CloudFront URL, correct Supabase project). No need to paste values here.

**Mark complete:** Check the box when all three are defined and values are correct for production.

**If it fails:** Add or update the secrets. After changing any NEXT_PUBLIC_* value, trigger a frontend build (e.g. push to main or re-run the frontend workflow) to bake the new values into the static export.

---

## 3. Optional sanity checks

Run these after sections 1 and 2 are complete to confirm the live stack and S3 versioning before relying on CI/CD.

### 3.1 Health endpoint via CloudFront

**Verify:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://<cloudfront-domain>/api/health
curl -s https://<cloudfront-domain>/api/health
```

**Pass:** HTTP status 200; response body includes `{"status":"ok"}` (or your backend's health payload). Replace `<cloudfront-domain>` with your distribution domain (e.g. `d1234abcd.cloudfront.net` or your custom domain).

**Mark complete:** Check the box when both commands succeed.

**If it fails:** See `docs/deploy.md` (Common Pitfalls, ALB target health, CloudFront routing). Ensure target group health path is `/api/health`, ECS tasks are healthy, and CloudFront /api* behavior targets the ALB.

---

### 3.2 S3 versioning (test restore)

**Verify:** Confirm that restoring a previous object version is possible (required for frontend rollback).

1. In S3 Console, open bucket `trivia-master-frontend`, enable "Show versions" for objects.
2. Upload a test file (e.g. `test-preflight.txt`), then upload a second version (same key, different content).
3. Select the older version → Actions → Open → or use "Copy" to restore that version as the current object.
4. (Optional) Use CLI: `aws s3api list-object-versions --bucket trivia-master-frontend --prefix test-preflight.txt` and `copy-object` with a specific versionId to restore.

**Pass:** You can list versions and restore (or copy) a previous version. Versioning is enabled (section 1.4).

**Mark complete:** Check the box when you have successfully tested listing/restoring a previous version.

**If it fails:** Ensure bucket versioning is Enabled (section 1.4). If the bucket was created without versioning, enable it; new uploads will get versions; older objects without versions cannot be restored to a prior state.

---

## Summary

- [ ] **1.1** ECS cluster, service, task definition
- [ ] **1.2** ECR repository
- [ ] **1.3** ALB and target group (health path `/api/health`)
- [ ] **1.4** S3 bucket with versioning enabled
- [ ] **1.5** CloudFront distribution
- [ ] **1.6** IAM roles (execution role + CI permissions)
- [ ] **2.1** AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
- [ ] **2.2** ECR_URI, ECS_CLUSTER, ECS_SERVICE, ECS_TASK
- [ ] **2.3** S3_BUCKET, CLOUDFRONT_DIST_ID
- [ ] **2.4** NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] **3.1** (Optional) curl health via CloudFront returns 200 and `{"status":"ok"}`
- [ ] **3.2** (Optional) S3 versioning: test restore of a previous object version

When all required items (sections 1 and 2) are checked, you can run the CI/CD workflows (e.g. push to `main` or manually trigger). Complete section 3 for extra confidence before first production deploy.
