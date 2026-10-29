import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { Notice } from "./ui.jsx";

// Shows setup problems (missing Gemini key, missing Atlas indexes) at the top of every page.
export default function HealthBanner() {
  const [health, setHealth] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setOffline(true));
  }, []);

  if (offline) return <Notice tone="warn">The API server is not reachable. Start it with <code>npm run server</code>.</Notice>;
  if (!health) return null;
  const problems = [];
  if (!health.aiConfigured) problems.push("GEMINI_API_KEY is not set on the server.");
  if (!health.indexes.ok) problems.push(health.indexes.message || "Atlas search indexes are not ready.");
  if (problems.length === 0) return null;
  return (
    <Notice tone="warn">
      <strong>Setup needed:</strong> {problems.join(" ")} See the README, section "MongoDB Atlas setup".
    </Notice>
  );
}
