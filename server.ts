import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { pipeline } from "./src/services/parsingPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const JOBS_FILE = path.join(process.cwd(), "jobs.json");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Job status tracking
interface Job {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  resultId?: string;
  error?: string;
}

function getJobs(): Record<string, Job> {
  if (fs.existsSync(JOBS_FILE)) {
    return JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
  }
  return {};
}

function saveJob(job: Job) {
  const jobs = getJobs();
  jobs[job.id] = job;
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const jobId = req.file.filename;
    const job: Job = {
      id: jobId,
      filename: req.file.originalname,
      status: "pending",
      progress: 0
    };
    saveJob(job);

    // Trigger pipeline asynchronously
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    (async () => {
      try {
        const currentJob = getJobs()[jobId];
        currentJob.status = "processing";
        currentJob.progress = 10;
        saveJob(currentJob);

        const resultId = await pipeline.processTextbook(filePath, originalName);
        
        const finalJob = getJobs()[jobId];
        finalJob.status = "completed";
        finalJob.progress = 100;
        finalJob.resultId = resultId;
        saveJob(finalJob);
      } catch (error) {
        console.error("Pipeline error:", error);
        const failedJob = getJobs()[jobId];
        failedJob.status = "failed";
        failedJob.error = error instanceof Error ? error.message : String(error);
        saveJob(failedJob);
      }
    })();

    res.json({ 
      message: "File uploaded and processing started",
      jobId: jobId,
      file: {
        id: req.file.filename,
        name: req.file.originalname,
        size: req.file.size,
        path: `/api/files/${req.file.filename}`,
        uploadedAt: new Date().toISOString()
      }
    });
  });

  app.get("/api/jobs/:id", (req, res) => {
    const jobs = getJobs();
    const job = jobs[req.params.id];
    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ error: "Job not found" });
    }
  });

  app.get("/api/parsed/:id", (req, res) => {
    const data = pipeline.getParsedData(req.params.id);
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: "Parsed data not found" });
    }
  });

  app.get("/api/library", (req, res) => {
    const files = fs.readdirSync(UPLOADS_DIR).map(filename => {
      const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
      const nameParts = filename.split("-");
      const originalName = nameParts.slice(2).join("-");
      
      const jobs = getJobs();
      const job = jobs[filename];

      return {
        id: filename,
        name: originalName || filename,
        size: stats.size,
        path: `/api/files/${filename}`,
        uploadedAt: stats.birthtime.toISOString(),
        status: job?.status || "unknown",
        progress: job?.progress || 0
      };
    });
    res.json(files);
  });

  app.get("/api/files/:filename", (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
