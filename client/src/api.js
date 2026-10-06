const API_BASE = "/api";

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function uploadAudio({ file, provider, notes }) {
  const formData = new FormData();
  formData.append("audio", file);
  formData.append("provider", provider);
  if (notes) formData.append("notes", notes);

  const res = await fetch(`${API_BASE}/records`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function fetchRecords(query = "") {
  const url = query ? `${API_BASE}/records?q=${encodeURIComponent(query)}` : `${API_BASE}/records`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchRecordById(id) {
  const res = await fetch(`${API_BASE}/records/${encodeURIComponent(id)}`);
  return handleResponse(res);
}
