import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";

// Loads the document list once and gives a `reload` function. Used by both pages.
export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const data = await api.listDocuments();
      setDocuments(data.documents);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { documents, loading, error, reload };
}
