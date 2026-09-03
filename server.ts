import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initializer for Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Crux Cloud Hosting API",
    time: new Date().toISOString(),
  });
});

// Real-time server locations & ping stats
app.get("/api/nodes", (_req, res) => {
  res.json({
    timestamp: Date.now(),
    nodes: [
      {
        id: "in-mum-01",
        name: "Mumbai, India",
        flag: "🇮🇳",
        code: "IN-BOM",
        cpu: "AMD Ryzen 9 7950X @ 5.7GHz",
        ram: "DDR5 5600MHz ECC",
        storage: "Samsung Enterprise NVMe Gen4",
        ddosProtection: "2.5 Tbps Game Shield",
        ping: Math.floor(12 + Math.random() * 8),
        status: "operational",
        load: Math.floor(40 + Math.random() * 25),
      },
      {
        id: "sg-sin-01",
        name: "Singapore",
        flag: "🇸🇬",
        code: "SG-SIN",
        cpu: "AMD Ryzen 9 7950X3D",
        ram: "DDR5 5600MHz ECC",
        storage: "PCIe 4.0 NVMe",
        ddosProtection: "1.8 Tbps Game Shield",
        ping: Math.floor(38 + Math.random() * 10),
        status: "operational",
        load: Math.floor(35 + Math.random() * 20),
      },
      {
        id: "de-fra-01",
        name: "Frankfurt, Germany",
        flag: "🇩🇪",
        code: "EU-FRA",
        cpu: "AMD EPYC 9654 (Genoa)",
        ram: "DDR5 4800MHz ECC",
        storage: "Enterprise NVMe RAID 10",
        ddosProtection: "3.2 Tbps Voxility Shield",
        ping: Math.floor(105 + Math.random() * 15),
        status: "operational",
        load: Math.floor(45 + Math.random() * 15),
      },
      {
        id: "us-iad-01",
        name: "Ashburn (US East)",
        flag: "🇺🇸",
        code: "US-IAD",
        cpu: "AMD Ryzen 9 7950X",
        ram: "DDR5 5600MHz",
        storage: "PCIe 4.0 NVMe",
        ddosProtection: "2.0 Tbps Game Shield",
        ping: Math.floor(160 + Math.random() * 20),
        status: "operational",
        load: Math.floor(30 + Math.random() * 25),
      },
    ],
  });
});

// Gemini Multi-turn Chat Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model: requestedModel, roleContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array in request body." });
    }

    // Supported models per guidelines:
    // 'gemini-3.1-pro-preview' (complex tasks/troubleshooting)
    // 'gemini-3.5-flash' (general tasks)
    // 'gemini-3.1-flash-lite' (fast tasks)
    let selectedModel = "gemini-3.5-flash";
    if (requestedModel === "gemini-3.1-pro-preview") {
      selectedModel = "gemini-3.1-pro-preview";
    } else if (requestedModel === "gemini-3.1-flash-lite") {
      selectedModel = "gemini-3.1-flash-lite";
    }

    const systemInstruction =
      roleContext ||
      `You are "Crux AI", the chief server architect and 24/7 technical advisor for "Crux Cloud" (क्रुक्स क्लाउड).
Crux Cloud is a premium game and cloud hosting company specializing in:
1. Minecraft Server Hosting (Dirt 2GB, Iron 4GB, Diamond 8GB, Netherite 16GB, Paper, Purpur, Forge, Fabric, Bedrock, low ping, Ryzen 9 7950X DDR5 hardware, starting ₹199/$2.49/mo).
2. Bot Hosting (Discord bot, Telegram bot, Python, NodeJS, Java, 24/7 uptime, 99.9% SLA, starting ₹79/$0.99/mo).
3. Cloud VPS Hosting (High performance AMD EPYC, full root access, NVMe Gen4, starting ₹449/$5.99/mo).

Your style:
- Helpful, technical yet easy to understand for gamers, developers, and server admins.
- Fluent in English and Hindi (Hinglish too if user speaks Hindi/Hinglish).
- You can recommend RAM/CPU allocations based on player count and plugins/mods.
- You can diagnose Minecraft crash logs, optimize paper.yml / spigot.yml / purpur.yml, help set up Discord.js or discord.py bots, and advise on VPS Linux server configuration.
- Keep answers concise, formatted with clear markdown, code blocks when necessary, and enthusiastic gamer-friendly tone.`;

    const ai = getGemini();

    // Map conversation history to Gemini contents format
    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "I processed your request, but received an empty response. How can I assist you with Crux Cloud servers?";
    res.json({ reply, model: selectedModel });
  } catch (error: any) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate chat response.",
    });
  }
});

// Gemini High Quality Image Generation Endpoint
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1K", aspectRatio = "16:9" } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt string." });
    }

    // Supported image sizes: "1K", "2K", "4K"
    const validSizes = ["1K", "2K", "4K"];
    const imageSize = validSizes.includes(size) ? size : "1K";

    const ai = getGemini();

    // Try with primary requested model: gemini-3-pro-image-preview
    // fallback to gemini-3.1-flash-image if unavailable
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any,
          },
        },
      });
    } catch (primaryErr: any) {
      console.warn("Falling back to gemini-3.1-flash-image:", primaryErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any,
          },
        },
      });
    }

    let imageUrl: string | null = null;
    let descriptionText = "";

    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mime = part.inlineData.mimeType || "image/png";
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        } else if (part.text) {
          descriptionText += part.text;
        }
      }
    }

    if (!imageUrl) {
      return res.status(422).json({
        error: "The model responded without an image payload.",
        text: descriptionText,
      });
    }

    res.json({
      imageUrl,
      size: imageSize,
      aspectRatio,
      prompt,
    });
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate image.",
    });
  }
});

async function startServer() {
  // Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Crux Cloud Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
