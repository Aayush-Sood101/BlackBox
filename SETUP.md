# Quick Start Guide

## Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Gemini API Key** ([Get one free](https://aistudio.google.com/))


## Setup (5 minutes)

### 1. Build Docker Sandbox
```bash
cd docker
docker build -t sandbox:latest -f Dockerfile.sandbox .
cd ..
```

### 2. Configure Backend
```bash
cd backend
```

Create `.env` file with your Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
PORT=3001
NODE_ENV=development
SANDBOX_IMAGE=sandbox:latest
```

Install dependencies:
```bash
npm install
cd ..
```

### 3. Configure Frontend
```bash
cd frontend
npm install
cd ..
```

## Run the Project

Open **two terminals**:

**Terminal 1 - Backend (port 3001):**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend (port 3000):**
```bash
cd frontend
npm run dev
```

**Open your browser:** http://localhost:3000

## Test Everything Works

```bash
cd backend
npm test                          # Phase 1 tests
npx ts-node src/test-phase2.ts   # Phase 2 tests
```

## Troubleshooting

### Docker Build Fails on Apple Silicon (M1/M2/M3)
The Dockerfile already includes `--platform=linux/amd64` for compatibility.

### Docker Not Found
Make sure Docker Desktop is running before starting the backend.

### Port Already in Use
Change `PORT=3001` in `backend/.env` to another port.

## What's Next?

Upload a `.exe` file through the UI or test with the demo endpoint:

```bash
curl -X POST http://localhost:3001/api/demo \
  -H "Content-Type: application/json" \
  -d '{
    "inputFormat": "First line: n\nSecond line: n integers",
    "constraints": "1 ≤ n ≤ 100"
  }'
```

See [README.md](README.md) for full documentation.
