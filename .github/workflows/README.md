# GitHub Actions Workflows

## Docker Images (`docker-publish.yml`)

Automatically builds and publishes Docker images to GitHub Container Registry (ghcr.io).

### Triggers

- **Push to `main`**: Builds and pushes images tagged with `latest` and branch name
- **Tags** (`v*`): Builds and pushes images with semantic version tags
- **Pull Requests**: Builds images (but doesn't push) to verify build success
- **Manual**: Can be triggered manually via GitHub Actions UI

### Images Published

- `ghcr.io/tim4724/kickoff-client:latest` - Client (nginx)
- `ghcr.io/tim4724/kickoff-server:latest` - Server (Node.js)

### Tags

Images are automatically tagged with:
- `latest` - Latest from main branch
- `main` - Main branch builds
- `v1.0.0` - Semantic version tags (when you push tags)
- `v1.0` - Major.minor version
- `v1` - Major version
- `main-<sha>` - Git commit SHA

### Using Published Images

Update your `docker-compose.yml` to use published images:

```yaml
services:
  client:
    image: ghcr.io/tim4724/kickoff-client:latest
    # Remove 'build' section
    
  server:
    image: ghcr.io/tim4724/kickoff-server:latest
    # Remove 'build' section
```

Pull images:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
docker pull ghcr.io/tim4724/kickoff-client:latest
docker pull ghcr.io/tim4724/kickoff-server:latest

# Or use docker-compose
docker-compose pull
```

### Multi-Platform Support

Images are built for both:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/Apple Silicon)

### Permissions

The workflow requires:
- ✅ `contents: read` - Read repository code
- ✅ `packages: write` - Push images to ghcr.io
- ✅ `id-token: write` - OIDC token for provenance

These are automatically provided by GitHub Actions via `GITHUB_TOKEN`.

### Making Images Public

By default, packages are private. To make them public:

1. Go to https://github.com/tim4724/Kickoff/pkgs/container/kickoff-client
2. Click "Package settings"
3. Scroll to "Danger Zone"
4. Click "Change visibility" → "Public"
5. Repeat for `kickoff-server`

### Releasing a Version

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0

# This will trigger the workflow and create images tagged with:
# - v1.0.0
# - v1.0
# - v1
# - latest
```

