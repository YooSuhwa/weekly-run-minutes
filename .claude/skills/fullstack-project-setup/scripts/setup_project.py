#!/usr/bin/env python3
"""
Fullstack Project Setup Script

Usage:
    python setup_project.py <project-name> [--skill-path <path>]

Creates a production-ready fullstack monorepo with:
- Next.js 16 frontend
- FastAPI backend  
- Worker service
- mise for tool management
- Docker Compose for local infrastructure
"""

import os
import shutil
import sys
from pathlib import Path


def get_skill_path() -> Path:
    """Get the skill directory path."""
    # Check if running from skill directory
    script_path = Path(__file__).resolve()
    skill_path = script_path.parent.parent
    
    if (skill_path / "templates").exists():
        return skill_path
    
    # Fallback paths
    fallback_paths = [
        Path.home() / ".claude" / "skills" / "fullstack-project-setup",
        Path("/mnt/skills/user/fullstack-project-setup"),
    ]
    
    for path in fallback_paths:
        if (path / "templates").exists():
            return path
    
    raise FileNotFoundError("Could not find skill templates directory")


def create_docker_compose(project_dir: Path) -> None:
    """Create docker-compose.yml for local infrastructure."""
    content = '''services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  redis_data:
  minio_data:
'''
    (project_dir / "docker-compose.yml").write_text(content)


def copy_with_exclusions(src: Path, dst: Path, exclusions: list[str] = None) -> None:
    """Copy directory with exclusions."""
    exclusions = exclusions or []
    default_exclusions = [
        "__pycache__",
        ".pytest_cache",
        "node_modules",
        ".next",
        "dist",
        "build",
        ".git",
        "*.pyc",
        "*.pyo",
        ".env",
        ".env.local",
    ]
    all_exclusions = set(exclusions + default_exclusions)
    
    def ignore_patterns(directory, files):
        ignored = []
        for f in files:
            if f in all_exclusions:
                ignored.append(f)
            elif any(f.endswith(ext) for ext in all_exclusions if ext.startswith("*")):
                ignored.append(f)
        return ignored
    
    if dst.exists():
        shutil.rmtree(dst)
    
    shutil.copytree(src, dst, ignore=ignore_patterns)


def restore_nextjs_routes(web_dir: Path) -> None:
    """Restore Next.js dynamic route folder names from safe names."""
    app_dir = web_dir / "src" / "app"
    
    # Mapping of safe names to original Next.js dynamic route names
    renames = [
        (app_dir / "__locale__", app_dir / "[locale]"),
        (app_dir / "serwist" / "__path__", app_dir / "serwist" / "[path]"),
        (app_dir / "api" / "auth" / "__catchall__", app_dir / "api" / "auth" / "[...all]"),
    ]
    
    for safe_path, original_path in renames:
        if safe_path.exists():
            safe_path.rename(original_path)


def setup_project(project_name: str, skill_path: Path = None) -> None:
    """Setup the fullstack project using templates."""
    if skill_path is None:
        skill_path = get_skill_path()
    
    templates_dir = skill_path / "templates"
    project_dir = Path(project_name).resolve()
    
    if project_dir.exists():
        print(f"❌ Error: Directory '{project_name}' already exists")
        sys.exit(1)
    
    print(f"🚀 Creating fullstack project: {project_name}")
    print(f"   Using templates from: {templates_dir}")
    print()
    
    # Create project directory
    project_dir.mkdir(parents=True)
    
    # Copy root configuration files
    print("📁 Setting up root configuration...")
    root_templates = templates_dir / "root"
    if root_templates.exists():
        for f in root_templates.iterdir():
            if f.name == "gitignore":
                shutil.copy(f, project_dir / ".gitignore")
            else:
                shutil.copy(f, project_dir / f.name)
            print(f"  ✅ {f.name}")
    
    # Create docker-compose.yml
    create_docker_compose(project_dir)
    print("  ✅ docker-compose.yml")
    
    # Copy apps
    apps_dir = project_dir / "apps"
    apps_dir.mkdir()
    
    print()
    print("🐍 Setting up FastAPI backend (apps/api)...")
    api_templates = templates_dir / "api"
    if api_templates.exists():
        copy_with_exclusions(api_templates, apps_dir / "api")
        print("  ✅ apps/api")
    
    print()
    print("⚛️  Setting up Next.js frontend (apps/web)...")
    web_templates = templates_dir / "web"
    if web_templates.exists():
        copy_with_exclusions(web_templates, apps_dir / "web")
        # Restore Next.js dynamic route folder names
        restore_nextjs_routes(apps_dir / "web")
        print("  ✅ apps/web")
    
    print()
    print("⚙️  Setting up Worker service (apps/worker)...")
    worker_templates = templates_dir / "worker"
    if worker_templates.exists():
        copy_with_exclusions(worker_templates, apps_dir / "worker")
        print("  ✅ apps/worker")
    
    # Copy packages
    print()
    print("📦 Setting up shared packages...")
    packages_dir = project_dir / "packages"
    packages_templates = templates_dir / "packages"
    if packages_templates.exists():
        copy_with_exclusions(packages_templates, packages_dir)
        print("  ✅ packages/i18n")
        print("  ✅ packages/design-tokens")
    
    # Copy agent rules
    print()
    print("📝 Setting up AI agent rules...")
    rules_dir = project_dir / ".agent" / "rules"
    rules_templates = templates_dir / "rules"
    if rules_templates.exists():
        rules_dir.mkdir(parents=True)
        for f in rules_templates.iterdir():
            if f.is_file():
                shutil.copy(f, rules_dir / f.name)
        print("  ✅ .agent/rules")
    
    # Create .env.example files
    print()
    print("🔧 Creating environment files...")
    
    api_env = apps_dir / "api" / ".env.example"
    if not api_env.exists():
        api_env.write_text('''APP_NAME=API
DEBUG=true
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/app
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=["http://localhost:3000"]
''')
    print("  ✅ apps/api/.env.example")
    
    web_env = apps_dir / "web" / ".env.example"
    if not web_env.exists():
        web_env.write_text('''NEXT_PUBLIC_API_URL=http://localhost:8000
''')
    print("  ✅ apps/web/.env.example")
    
    # Create GitHub workflows directory
    (project_dir / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
    
    # Create VSCode settings
    vscode_dir = project_dir / ".vscode"
    vscode_dir.mkdir(exist_ok=True)
    (vscode_dir / "settings.json").write_text('''{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff"
  },
  "python.analysis.typeCheckingMode": "basic"
}
''')
    print("  ✅ .vscode/settings.json")
    
    # Print completion message
    print()
    print("=" * 60)
    print(f"✅ Project '{project_name}' created successfully!")
    print("=" * 60)
    print()
    print("Next steps:")
    print()
    print(f"  1. cd {project_name}")
    print()
    print("  2. Install mise (if not installed):")
    print("     curl https://mise.run | sh")
    print()
    print("  3. Install runtimes:")
    print("     mise install")
    print()
    print("  4. Start local infrastructure:")
    print("     mise infra:up")
    print()
    print("  5. Install dependencies:")
    print("     cd apps/web && pnpm install")
    print("     cd ../api && uv sync")
    print("     cd ../worker && uv sync")
    print()
    print("  6. Start development servers:")
    print("     mise dev")
    print()
    print("  Access:")
    print("    - Web:    http://localhost:3000")
    print("    - API:    http://localhost:8000")
    print("    - Worker: http://localhost:8001")
    print("    - MinIO:  http://localhost:9001")
    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python setup_project.py <project-name> [--skill-path <path>]")
        print()
        print("Example:")
        print("  python setup_project.py my-awesome-app")
        sys.exit(1)
    
    project_name = sys.argv[1]
    skill_path = None
    
    # Parse optional --skill-path argument
    if "--skill-path" in sys.argv:
        idx = sys.argv.index("--skill-path")
        if idx + 1 < len(sys.argv):
            skill_path = Path(sys.argv[idx + 1])
    
    setup_project(project_name, skill_path)


if __name__ == "__main__":
    main()
